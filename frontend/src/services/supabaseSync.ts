/**
 * Supabase cloud sync service
 *
 * Reads and writes the full AppState using individual relational tables.
 *
 * Strategy:
 *  - On app startup: parallel read from all tables → assemble AppState
 *  - On every data mutation: debounced write to all tables (1.5 s)
 *  - localStorage is kept as an offline cache / instant-load layer
 *
 * Schema mapping:
 *  - DB uses snake_case; TypeScript uses camelCase. All conversion happens here.
 *  - Scenario data is stored as JSONB arrays within the scenarios table.
 *  - The legacy tables (projects, assignments, business_assignments, local_phases)
 *    are intentionally NOT read or written any more — they are kept in Supabase
 *    only as a rollback safety net.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  AppState,
  TeamMember,
  TimeOff,
  Sprint,
  JiraConnection,
  JiraWorkItem,
  Scenario,
  Country,
  PublicHoliday,
  Role,
  Skill,
  System,
  Squad,
  ProcessTeam,
  BusinessTeam,
  Settings,
  JiraSettings,
  BusinessContact,
  BusinessTimeOff,
  JiraItemBizAssignment,
  CapacityRequest,
  CapacityAssignment,
  ExternalVendor,
  InitiativeCostRecord,
} from '../types';
import { generateQuarters } from '../utils/calendar';
import { migratePlannerLayout } from '../utils/plannerMigration';
import { bauPercentToLegacyDays } from '../utils/bau';
import { normalizeBusinessTeamPlaceholdersInAssignments } from '../utils/businessTeamPlaceholders';
import { getPlanningGroupTrack, normalizePlanningGroup } from '../utils/planningGroups';

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES — must stay in sync with appStore.ts
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  bauReservePercent: 8,
  hoursPerDay: 8,
  defaultView: 'dashboard',
  quartersToShow: 4,
  defaultCountryId: 'country-nl',
  darkMode: false,
  confidenceLevels: {
    high: 5,
    medium: 15,
    low: 25,
    defaultLevel: 'medium',
  },
  sprintDurationWeeks: 3,
  sprintStartDate: '2026-01-05',
  sprintsToShow: 6,
  sprintsPerYear: 16,
  byeWeeksAfter: [8, 12],
  holidayWeeksAtEnd: 2,
  costing: {
    reportingCurrency: 'EUR',
    supportedCurrencies: ['EUR', 'GBP', 'USD'],
    fxToEur: {
      EUR: 1,
      GBP: 1.17,
      USD: 0.92,
    },
    internalItDailyRate: {
      amount: 750,
      currency: 'EUR',
    },
    businessDailyRate: {
      amount: 650,
      currency: 'EUR',
    },
  },
};

const DEFAULT_JIRA_SETTINGS: JiraSettings = {
  defaultVelocity: 30,
  syncFrequency: 'manual',
  autoMapByName: true,
  syncEpics: true,
  syncFeatures: true,
  syncStories: true,
  syncTasks: false,
  syncBugs: false,
  includeSubtasks: false,
  statusFilterEpics: 'exclude_done',
  statusFilterFeatures: 'exclude_done',
  statusFilterStories: 'active_only',
  statusFilterTasks: 'active_only',
  statusFilterBugs: 'active_only',
  defaultConfidenceLevel: 'medium',
};

// ─────────────────────────────────────────────────────────────────────────────
// LOAD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads the full AppState from individual Supabase tables in parallel.
 * Returns null if Supabase is not configured, unreachable, or all tables empty.
 */
export async function loadFromSupabase(): Promise<AppState | null> {
  if (!isSupabaseConfigured()) {
    console.info('[Sync] Supabase not configured — using localStorage only.');
    return null;
  }

  try {
    const [
      rolesRes, countriesRes, holidaysRes, skillsRes, systemsRes,
      squadsRes, processTeamsRes, businessTeamsRes,
      teamMembersRes, timeOffRes, settingsRes,
      sprintsRes, jiraConnectionsRes, jiraWorkItemsRes, scenariosRes,
      bizContactsRes, bizTimeOffRes, bizJiraItemsRes,
      externalVendorsRes, initiativeCostsRes,
    ] = await Promise.all([
      supabase.from('roles').select('*').order('name'),
      supabase.from('countries').select('*').order('name'),
      supabase.from('public_holidays').select('*').order('date'),
      supabase.from('skills').select('*').order('name'),
      supabase.from('systems').select('*').order('name'),
      supabase.from('squads').select('*').order('name'),
      supabase.from('process_teams').select('*').order('name'),
      supabase.from('business_teams').select('*').order('name'),
      supabase.from('team_members').select('*').eq('is_active', true).order('name'),
      supabase.from('time_off').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('sprints').select('*').order('year').order('number'),
      supabase.from('jira_connections').select('*').order('created_at'),
      supabase.from('jira_work_items').select('*'),
      supabase.from('scenarios').select('*').order('created_at'),
      supabase.from('business_contacts').select('*').order('name'),
      supabase.from('business_time_off').select('*'),
      supabase.from('jira_item_biz_assignments').select('*'),
      supabase.from('external_vendors').select('*').order('name'),
      supabase.from('initiative_costs').select('*').order('updated_at', { ascending: false }),
    ]);

    const allResults = [
      rolesRes, countriesRes, holidaysRes, skillsRes, systemsRes,
      squadsRes, processTeamsRes, businessTeamsRes,
      teamMembersRes, timeOffRes, settingsRes,
      sprintsRes, jiraConnectionsRes, jiraWorkItemsRes, scenariosRes,
      bizContactsRes, bizTimeOffRes, bizJiraItemsRes,
      externalVendorsRes, initiativeCostsRes,
    ];
    const errorCount = allResults.filter(r => r.error).length;

    allResults
      .filter(r => r.error)
      .forEach(r => console.warn('[Sync] Table load error (continuing with empty):', r.error?.message));

    if (errorCount === allResults.length) {
      console.error('[Sync] All tables failed to load — falling back to localStorage.');
      return null;
    }

    // ── Map DB rows → TypeScript types ───────────────────────────────────────

    const roles: Role[] = (rolesRes.data ?? []).map(r => ({ id: r.id, name: r.name }));

    const countries: Country[] = (countriesRes.data ?? []).map(c => ({
      id: c.id, code: c.code, name: c.name, flag: c.flag ?? undefined,
    }));

    const publicHolidays: PublicHoliday[] = (holidaysRes.data ?? []).map(h => ({
      id: h.id, countryId: h.country_id, date: h.date, name: h.name,
    }));

    const skills: Skill[] = (skillsRes.data ?? []).map(s => ({
      id: s.id, name: s.name, category: s.category as Skill['category'],
    }));

    const systems: System[] = (systemsRes.data ?? []).map(s => ({
      id: s.id, name: s.name, description: s.description ?? undefined,
    }));

    const squads: Squad[] = (squadsRes.data ?? []).map(s => ({ id: s.id, name: s.name }));

    const processTeams: ProcessTeam[] = (processTeamsRes.data ?? []).map(pt => ({
      id: pt.id, name: pt.name,
    }));

    const businessTeams: BusinessTeam[] = (businessTeamsRes.data ?? []).map(bt => ({
      id: bt.id,
      name: bt.name,
      category: bt.category ?? 'business_team',
      track: bt.track ?? getPlanningGroupTrack({ category: bt.category ?? 'business_team' }),
      externalVendorId: bt.external_vendor_id ?? undefined,
      archived: bt.archived ?? false,
      dailyRateOverride: bt.daily_rate_override != null ? Number(bt.daily_rate_override) : undefined,
      dailyRateCurrency: bt.daily_rate_currency ?? undefined,
    })).map(normalizePlanningGroup);

    const teamMembers: TeamMember[] = (teamMembersRes.data ?? []).map(m => ({
      id: m.id,
      name: m.name,
      role: m.role ?? '',
      countryId: m.country_id ?? '',
      skillIds: Array.isArray(m.skill_ids) ? m.skill_ids : [],
      maxConcurrentProjects: m.max_concurrent_projects ?? 2,
      workingDaysPerWeek: m.working_days_per_week ?? 5,
      bauOverride: m.bau_override ?? false,
      bauReservePercent: m.bau_reserve_percent ?? undefined,
      bauReserveDays: m.bau_reserve_days ?? undefined,
      squadId: m.squad_id ?? undefined,
      processTeamIds: Array.isArray(m.process_team_ids) ? m.process_team_ids : [],
      email: m.email ?? undefined,
      jiraAccountId: m.jira_account_id ?? undefined,
      syncedFromJira: m.synced_from_jira ?? false,
      needsEnrichment: m.needs_enrichment ?? false,
      excludedFromCapacity: m.excluded_from_capacity ?? false,
      nameManuallyEdited: m.name_manually_edited ?? false,
      workerType: m.worker_type ?? undefined,
      assignmentCategory: m.assignment_category ?? (m.worker_type === 'external' ? 'external_partner' : undefined),
      externalVendorId: m.external_vendor_id ?? undefined,
      dailyRateOverride: m.daily_rate_override != null ? Number(m.daily_rate_override) : undefined,
      dailyRateCurrency: m.daily_rate_currency ?? undefined,
    }));

    const timeOff: TimeOff[] = (timeOffRes.data ?? []).map(t => ({
      id: t.id, memberId: t.member_id, startDate: t.start_date, endDate: t.end_date, note: t.note ?? undefined,
    }));

    const sprints: Sprint[] = (sprintsRes.data ?? []).map(s => ({
      id: s.id, name: s.name, number: s.number, year: s.year,
      startDate: s.start_date, endDate: s.end_date, quarter: s.quarter, isByeWeek: s.is_bye_week ?? false,
    }));

    const jiraConnections: JiraConnection[] = (jiraConnectionsRes.data ?? []).map(c => ({
      id: c.id,
      name: c.name,
      mode: (c.mode as JiraConnection['mode']) ?? 'standard',
      jiraBaseUrl: c.jira_base_url,
      jiraProjectKey: c.jira_project_key,
      jiraProjectId: c.jira_project_id ?? undefined,
      jiraProjectName: c.jira_project_name ?? undefined,
      apiToken: c.api_token,
      apiTokenMasked: c.api_token_masked ?? undefined,
      userEmail: c.user_email,
      isActive: c.is_active ?? true,
      lastSyncAt: c.last_sync_at ?? undefined,
      lastSyncStatus: c.last_sync_status as JiraConnection['lastSyncStatus'],
      lastSyncError: c.last_sync_error ?? undefined,
      syncHistory: Array.isArray(c.sync_history) ? c.sync_history : [],
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      defaultDaysPerItem: c.default_days_per_item ?? 1,
      jqlFilter: c.jql_filter ?? undefined,
      labelFilter: Array.isArray(c.label_filter) ? c.label_filter : [],
      scenarioPlannerOnly: c.scenario_planner_only ?? false,
      customFieldIds: c.custom_field_ids ?? undefined,
      syncSettingsOverride: c.sync_settings_override ?? undefined,
      discoveryConfig: c.discovery_config ?? undefined,
    }));

    const jiraWorkItems: JiraWorkItem[] = (jiraWorkItemsRes.data ?? []).map(w => ({
      id: w.id,
      connectionId: w.connection_id,
      jiraKey: w.jira_key,
      jiraId: w.jira_id,
      summary: w.summary,
      description: w.description ?? undefined,
      type: w.type as JiraWorkItem['type'],
      typeName: w.type_name,
      status: w.status,
      statusCategory: w.status_category as JiraWorkItem['statusCategory'],
      priority: w.priority ?? undefined,
      storyPoints: w.story_points != null ? Number(w.story_points) : undefined,
      originalEstimate: w.original_estimate != null ? Number(w.original_estimate) : undefined,
      timeSpent: w.time_spent != null ? Number(w.time_spent) : undefined,
      remainingEstimate: w.remaining_estimate != null ? Number(w.remaining_estimate) : undefined,
      assigneeEmail: w.assignee_email ?? undefined,
      assigneeName: w.assignee_name ?? undefined,
      reporterEmail: w.reporter_email ?? undefined,
      reporterName: w.reporter_name ?? undefined,
      parentKey: w.parent_key ?? undefined,
      parentId: w.parent_id ?? undefined,
      sprintId: w.sprint_id ?? undefined,
      sprintName: w.sprint_name ?? undefined,
      sprintStartDate: w.sprint_start_date ?? undefined,
      sprintEndDate: w.sprint_end_date ?? undefined,
      labels: Array.isArray(w.labels) ? w.labels : [],
      components: Array.isArray(w.components) ? w.components : [],
      created: w.created,
      updated: w.updated,
      startDate: w.start_date ?? undefined,
      dueDate: w.due_date ?? undefined,
      staleFromJira: w.stale_from_jira ?? undefined,
      confidenceLevel: (w.confidence_level as JiraWorkItem['confidenceLevel']) ?? undefined,
      // App-only field — never sourced from Jira
      requiredSkillIds: Array.isArray(w.required_skill_ids) ? w.required_skill_ids : null,
    }));

    const scenarios: Scenario[] = (scenariosRes.data ?? []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description ?? undefined,
      color: s.color ?? undefined,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      lastEditedBy: s.last_edited_by ?? undefined,
      basedOnSyncAt: s.based_on_sync_at ?? undefined,
      isBaseline: s.is_baseline ?? false,
      isPortfolioScenario: s.is_portfolio_scenario ?? false,
      archived: s.archived ?? false,
      jiraWorkItems: Array.isArray(s.jira_work_items) ? s.jira_work_items : [],
      jiraItemBizAssignments: Array.isArray(s.jira_item_biz_assignments) ? s.jira_item_biz_assignments : [],
      teamMembers: Array.isArray(s.team_members) ? s.team_members : [],
      timeOff: Array.isArray(s.time_off) ? s.time_off : [],
      projects: Array.isArray(s.projects) ? s.projects : [],
      assignments: Array.isArray(s.assignments) ? s.assignments : [],
      capacityRequests: Array.isArray(s.capacity_requests) ? s.capacity_requests : [],
      capacityAssignments: Array.isArray(s.capacity_assignments) ? s.capacity_assignments : [],
      plannerLayout: migratePlannerLayout(
        Array.isArray(s.planner_layout) ? s.planner_layout : []
      ),
      portfolioBoardEpicKeys: Array.isArray(s.portfolio_board_epic_keys) ? s.portfolio_board_epic_keys : [],
      portfolioManualEpics: Array.isArray(s.portfolio_manual_epics) ? s.portfolio_manual_epics : [],
      portfolioPhasePlans: Array.isArray(s.portfolio_phase_plans) ? s.portfolio_phase_plans : [],
      portfolioPhaseAssignments: Array.isArray(s.portfolio_phase_assignments) ? s.portfolio_phase_assignments : [],
      skillsMatchingEnabled: s.skills_matching_enabled ?? true,
    }));

    // Settings key-value pairs
    const settingsMap = Object.fromEntries(
      (settingsRes.data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])
    );
    const storedSettings = (settingsMap.settings as Partial<Settings>) ?? {};
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      confidenceLevels: {
        ...DEFAULT_SETTINGS.confidenceLevels,
        ...(storedSettings.confidenceLevels ?? {}),
      },
      costing: {
        ...DEFAULT_SETTINGS.costing,
        ...(storedSettings.costing ?? {}),
        fxToEur: {
          ...DEFAULT_SETTINGS.costing.fxToEur,
          ...(storedSettings.costing?.fxToEur ?? {}),
        },
        internalItDailyRate: {
          ...DEFAULT_SETTINGS.costing.internalItDailyRate,
          ...(storedSettings.costing?.internalItDailyRate ?? {}),
        },
        businessDailyRate: {
          ...DEFAULT_SETTINGS.costing.businessDailyRate,
          ...(storedSettings.costing?.businessDailyRate ?? {}),
        },
        supportedCurrencies: storedSettings.costing?.supportedCurrencies?.length
          ? storedSettings.costing.supportedCurrencies
          : DEFAULT_SETTINGS.costing.supportedCurrencies,
      },
    };
    const jiraSettings: JiraSettings = {
      ...DEFAULT_JIRA_SETTINGS,
      ...((settingsMap.jiraSettings as Partial<JiraSettings>) ?? {}),
    };
    const activeScenarioId: string | null = (settingsMap.activeScenarioId as string | null) ?? null;
    const capacityRequests: CapacityRequest[] = Array.isArray(settingsMap.capacityRequests)
      ? settingsMap.capacityRequests as CapacityRequest[]
      : [];
    const capacityAssignments: CapacityAssignment[] = Array.isArray(settingsMap.capacityAssignments)
      ? settingsMap.capacityAssignments as CapacityAssignment[]
      : [];

    const businessContacts: BusinessContact[] = (bizContactsRes.data ?? []).map(c => ({
      id: c.id,
      name: c.name,
      title: c.title ?? undefined,
      department: c.department ?? undefined,
      email: c.email ?? undefined,
      countryId: c.country_id,
      workingDaysPerWeek: c.working_days_per_week ?? 5,
      workingHoursPerDay: c.working_hours_per_day ?? 8,
      bauReservePercent: c.bau_reserve_percent ?? undefined,
      bauReserveDays: c.bau_reserve_days ?? 5,
      processTeamIds: Array.isArray(c.process_team_ids) ? c.process_team_ids : [],
      businessTeamIds: Array.isArray(c.business_team_ids) ? c.business_team_ids : [],
      notes: c.notes ?? undefined,
      archived: c.archived ?? false,
      excludedFromCapacity: c.excluded_from_capacity ?? false,
      dailyRateOverride: c.daily_rate_override != null ? Number(c.daily_rate_override) : undefined,
      dailyRateCurrency: c.daily_rate_currency ?? undefined,
    }));

    const externalVendors: ExternalVendor[] = (externalVendorsRes.data ?? []).map(v => ({
      id: v.id,
      name: v.name,
      dailyRate: Number(v.daily_rate ?? 0),
      currency: v.currency,
      notes: v.notes ?? undefined,
      archived: v.archived ?? false,
      countsTowardCapacity: v.counts_toward_capacity ?? false,
      workingDaysPerWeek: v.working_days_per_week ?? undefined,
    }));

    const businessTimeOff: BusinessTimeOff[] = (bizTimeOffRes.data ?? []).map(t => ({
      id: t.id,
      contactId: t.contact_id,
      startDate: t.start_date,
      endDate: t.end_date,
      type: t.type as 'holiday' | 'other',
      notes: t.notes ?? undefined,
    }));

    const jiraItemBizAssignments: JiraItemBizAssignment[] = (bizJiraItemsRes.data ?? []).map(r => ({
      id: r.id,
      jiraKey: r.jira_key,
      contactId: r.contact_id,
      days: r.days != null ? Number(r.days) : undefined,
      notes: r.notes ?? undefined,
    }));

    const initiativeCosts: InitiativeCostRecord[] = (initiativeCostsRes.data ?? []).map(r => ({
      id: r.id,
      initiativeKind: r.initiative_kind,
      initiativeId: r.initiative_id,
      scenarioId: r.scenario_id ?? undefined,
      contingencyPct: Number(r.contingency_pct ?? 0),
      hardware: r.hardware ?? null,
      licenses: Array.isArray(r.licenses) ? r.licenses : [],
      updatedAt: r.updated_at,
    }));

    const hasAnyData =
      roles.length > 0 ||
      countries.length > 0 ||
      teamMembers.length > 0 ||
      jiraWorkItems.length > 0 ||
      (settingsRes.data ?? []).length > 0;

    if (!hasAnyData) {
      console.info('[Sync] All tables empty — will use localStorage.');
      return null;
    }

    console.info(
      `[Sync] Loaded: ${roles.length} roles, ${countries.length} countries, ` +
      `${teamMembers.length} members, ${jiraWorkItems.length} Jira items, ` +
      `${jiraItemBizAssignments.length} biz assignments`
    );

    return {
      version: 11,
      lastModified: new Date().toISOString(),
      settings,
      jiraSettings,
      countries,
      publicHolidays,
      roles,
      skills,
      systems,
      squads,
      processTeams,
      businessTeams,
      teamMembers,
      timeOff,
      quarters: generateQuarters(8),
      sprints,
      jiraConnections,
      jiraWorkItems,
      scenarios,
      activeScenarioId,
      businessContacts,
      businessTimeOff,
      jiraItemBizAssignments,
      projects: [],
      assignments: [],
      capacityRequests,
      capacityAssignments,
      externalVendors,
      initiativeCosts,
    };
  } catch (err) {
    console.error('[Sync] Unexpected error loading from Supabase:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Saves the full AppState to individual Supabase tables in parallel.
 */
export async function saveToSupabase(state: AppState): Promise<void> {
  if (!isSupabaseConfigured()) return;

  console.info(
    `[Sync] Saving: ${state.roles.length} roles, ${state.countries.length} countries, ` +
    `${state.teamMembers.length} members, ${state.jiraWorkItems.length} Jira items`
  );

  const tasks: [string, Promise<void>][] = [
    ['roles',                        syncRoles(state.roles)],
    ['countries',                    syncCountries(state.countries)],
    ['public_holidays',              syncHolidays(state.publicHolidays)],
    ['skills',                       syncSkills(state.skills)],
    ['systems',                      syncSystems(state.systems)],
    ['squads',                       syncSquads(state.squads)],
    ['process_teams',                syncProcessTeams(state.processTeams)],
    ['business_teams',               syncBusinessTeams(state.businessTeams ?? [])],
    ['team_members',                 syncTeamMembers(state.teamMembers)],
    ['time_off',                     syncTimeOff(state.timeOff)],
    ['sprints',                      syncSprints(state.sprints)],
    ['jira_connections',             syncJiraConnections(state.jiraConnections)],
    ['jira_work_items',              syncJiraWorkItems(state.jiraWorkItems)],
    ['scenarios',                    syncScenarios(state.scenarios, state.businessTeams ?? [])],
    ['settings',                     syncSettings(
      state.settings,
      state.jiraSettings,
      state.activeScenarioId,
      state.capacityRequests ?? [],
      state.capacityAssignments ?? [],
    )],
    ['business_contacts',            syncBusinessContacts(state.businessContacts ?? [])],
    ['business_time_off',            syncBusinessTimeOff(state.businessTimeOff ?? [])],
    ['jira_item_biz_assignments',    syncJiraItemBizAssignments(state.jiraItemBizAssignments ?? [])],
    ['external_vendors',             syncExternalVendors(state.externalVendors ?? [])],
    ['initiative_costs',             syncInitiativeCosts(state.initiativeCosts ?? [])],
  ];

  const results = await Promise.allSettled(tasks.map(([, p]) => p));

  const failures = results
    .map((r, i) => ({ table: tasks[i][0], result: r }))
    .filter(({ result }) => result.status === 'rejected');

  if (failures.length > 0) {
    const messages = failures
      .map(({ table, result }) => `${table}: ${(result as PromiseRejectedResult).reason?.message ?? result}`)
      .join('; ');
    console.error('[Sync] Some tables failed to save:', messages);
    throw new Error(messages);
  }

  console.info('[Sync] All tables saved successfully.');
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-TABLE SYNC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function syncRoles(roles: Role[]): Promise<void> {
  await upsertAndPrune('roles', roles, r => ({ id: r.id, name: r.name }));
}

async function syncCountries(countries: Country[]): Promise<void> {
  await upsertAndPrune('countries', countries, c => ({ id: c.id, code: c.code, name: c.name, flag: c.flag ?? null }));
}

async function syncHolidays(holidays: PublicHoliday[]): Promise<void> {
  await upsertAndPrune('public_holidays', holidays, h => ({
    id: h.id, country_id: h.countryId, date: h.date, name: h.name,
  }));
}

async function syncSkills(skills: Skill[]): Promise<void> {
  await upsertAndPrune('skills', skills, s => ({ id: s.id, name: s.name, category: s.category }));
}

async function syncSystems(systems: System[]): Promise<void> {
  await upsertAndPrune('systems', systems, s => ({ id: s.id, name: s.name, description: s.description ?? null }));
}

async function syncSquads(squads: Squad[]): Promise<void> {
  await upsertAndPrune('squads', squads, s => ({ id: s.id, name: s.name }));
}

async function syncProcessTeams(processTeams: ProcessTeam[]): Promise<void> {
  await upsertAndPrune('process_teams', processTeams, pt => ({ id: pt.id, name: pt.name }));
}

async function syncBusinessTeams(businessTeams: BusinessTeam[]): Promise<void> {
  try {
    await upsertAndPrune('business_teams', businessTeams, bt => ({
      id: bt.id,
      name: bt.name,
      category: bt.category ?? 'business_team',
      track: bt.track ?? getPlanningGroupTrack(bt),
      external_vendor_id: bt.externalVendorId ?? null,
      archived: bt.archived ?? false,
      daily_rate_override: bt.dailyRateOverride ?? null,
      daily_rate_currency: bt.dailyRateCurrency ?? null,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('category') || msg.includes('track') || msg.includes('external_vendor_id') || msg.includes('archived')) {
      await upsertAndPrune('business_teams', businessTeams, bt => ({
        id: bt.id,
        name: bt.name,
        daily_rate_override: bt.dailyRateOverride ?? null,
        daily_rate_currency: bt.dailyRateCurrency ?? null,
      }));
      return;
    }
    if (msg.includes('daily_rate_override') || msg.includes('daily_rate_currency')) {
      await upsertAndPrune('business_teams', businessTeams, bt => ({ id: bt.id, name: bt.name }));
      return;
    }
    if (msg.includes('business_teams') && (msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] business_teams table not found — run migration 036. Skipping.');
      return;
    }
    throw err;
  }
}

const BASE_MEMBER_ROW = (m: TeamMember) => ({
  id: m.id, name: m.name, role: m.role, country_id: m.countryId,
  skill_ids: m.skillIds, max_concurrent_projects: m.maxConcurrentProjects,
  working_days_per_week: m.workingDaysPerWeek ?? 5,
  bau_override: m.bauOverride ?? false,
  bau_reserve_percent: m.bauOverride ? (m.bauReservePercent ?? null) : null,
  bau_reserve_days: m.bauOverride
    ? (m.bauReserveDays ?? (m.bauReservePercent != null ? bauPercentToLegacyDays(m.bauReservePercent) : 0))
    : null,
  email: m.email ?? null, jira_account_id: m.jiraAccountId ?? null,
  synced_from_jira: m.syncedFromJira ?? false,
  needs_enrichment: m.needsEnrichment ?? false, is_active: true,
  excluded_from_capacity: m.excludedFromCapacity ?? false,
  name_manually_edited: m.nameManuallyEdited ?? false,
  worker_type: m.workerType ?? null,
  assignment_category: m.assignmentCategory ?? null,
  external_vendor_id: m.externalVendorId ?? null,
  daily_rate_override: m.dailyRateOverride ?? null,
  daily_rate_currency: m.dailyRateCurrency ?? null,
});

const EXTENDED_MEMBER_ROW = (m: TeamMember) => ({
  ...BASE_MEMBER_ROW(m),
  squad_id: m.squadId ?? null,
  process_team_ids: m.processTeamIds ?? [],
});

const LEGACY_MEMBER_ROW = (m: TeamMember) => ({
  id: m.id, name: m.name, role: m.role, country_id: m.countryId,
  skill_ids: m.skillIds, max_concurrent_projects: m.maxConcurrentProjects,
  email: m.email ?? null, jira_account_id: m.jiraAccountId ?? null,
  synced_from_jira: m.syncedFromJira ?? false,
  needs_enrichment: m.needsEnrichment ?? false, is_active: true,
});

const MEMBER_ROW_NO_CAPACITY_OVERRIDES = (m: TeamMember) => ({
  id: m.id, name: m.name, role: m.role, country_id: m.countryId,
  skill_ids: m.skillIds, max_concurrent_projects: m.maxConcurrentProjects,
  email: m.email ?? null, jira_account_id: m.jiraAccountId ?? null,
  synced_from_jira: m.syncedFromJira ?? false,
  needs_enrichment: m.needsEnrichment ?? false, is_active: true,
  squad_id: m.squadId ?? null,
  process_team_ids: m.processTeamIds ?? [],
  excluded_from_capacity: m.excludedFromCapacity ?? false,
});

const MEMBER_ROW_NO_CAPACITY_OR_EXCLUDED = (m: TeamMember) => ({
  id: m.id, name: m.name, role: m.role, country_id: m.countryId,
  skill_ids: m.skillIds, max_concurrent_projects: m.maxConcurrentProjects,
  email: m.email ?? null, jira_account_id: m.jiraAccountId ?? null,
  synced_from_jira: m.syncedFromJira ?? false,
  needs_enrichment: m.needsEnrichment ?? false, is_active: true,
  squad_id: m.squadId ?? null,
  process_team_ids: m.processTeamIds ?? [],
});

const MEMBER_ROW_NO_NAME_OVERRIDE = (m: TeamMember) => ({
  ...LEGACY_MEMBER_ROW(m),
  working_days_per_week: m.workingDaysPerWeek ?? 5,
  bau_override: m.bauOverride ?? false,
  bau_reserve_days: m.bauOverride
    ? (m.bauReserveDays ?? (m.bauReservePercent != null ? bauPercentToLegacyDays(m.bauReservePercent) : 0))
    : null,
  squad_id: m.squadId ?? null,
  process_team_ids: m.processTeamIds ?? [],
  excluded_from_capacity: m.excludedFromCapacity ?? false,
});

const MEMBER_ROW_NO_EXCLUDED = (m: TeamMember) => ({
  ...LEGACY_MEMBER_ROW(m),
  working_days_per_week: m.workingDaysPerWeek ?? 5,
  bau_override: m.bauOverride ?? false,
  bau_reserve_days: m.bauOverride
    ? (m.bauReserveDays ?? (m.bauReservePercent != null ? bauPercentToLegacyDays(m.bauReservePercent) : 0))
    : null,
  squad_id: m.squadId ?? null,
  process_team_ids: m.processTeamIds ?? [],
});

const softDeleteMembers = async (idsToRemove: string[]) => {
  if (idsToRemove.length > 0) {
    await supabase.from('team_members').update({ is_active: false }).in('id', idsToRemove);
  }
};

async function syncTeamMembersWithoutCapacityOverrides(members: TeamMember[]): Promise<void> {
  try {
    await upsertAndPrune('team_members', members, MEMBER_ROW_NO_CAPACITY_OVERRIDES, softDeleteMembers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('excluded_from_capacity') || msg.includes('worker_type') || msg.includes('assignment_category') || msg.includes('external_vendor_id') || msg.includes('daily_rate_override') || msg.includes('daily_rate_currency')) {
      try {
        await upsertAndPrune('team_members', members, MEMBER_ROW_NO_CAPACITY_OR_EXCLUDED, softDeleteMembers);
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        if (msg2.includes('squad_id') || msg2.includes('process_team_ids')) {
          await upsertAndPrune('team_members', members, LEGACY_MEMBER_ROW, softDeleteMembers);
        } else {
          throw err2;
        }
      }
      return;
    }
    if (msg.includes('squad_id') || msg.includes('process_team_ids')) {
      await upsertAndPrune('team_members', members, LEGACY_MEMBER_ROW, softDeleteMembers);
      return;
    }
    throw err;
  }
}

async function syncTeamMembers(members: TeamMember[]): Promise<void> {
  try {
    await upsertAndPrune('team_members', members, EXTENDED_MEMBER_ROW, softDeleteMembers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('working_days_per_week') || msg.includes('bau_override') || msg.includes('bau_reserve_days') || msg.includes('bau_reserve_percent') || msg.includes('worker_type') || msg.includes('assignment_category') || msg.includes('external_vendor_id') || msg.includes('daily_rate_override') || msg.includes('daily_rate_currency')) {
      await syncTeamMembersWithoutCapacityOverrides(members);
      return;
    }
    if (msg.includes('name_manually_edited')) {
      try {
        await upsertAndPrune('team_members', members, MEMBER_ROW_NO_NAME_OVERRIDE, softDeleteMembers);
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        if (msg2.includes('working_days_per_week') || msg2.includes('bau_override') || msg2.includes('bau_reserve_days') || msg2.includes('bau_reserve_percent')) {
          await syncTeamMembersWithoutCapacityOverrides(members);
        } else if (msg2.includes('excluded_from_capacity')) {
          await upsertAndPrune('team_members', members, MEMBER_ROW_NO_EXCLUDED, softDeleteMembers);
        } else if (msg2.includes('squad_id') || msg2.includes('process_team_ids')) {
          await upsertAndPrune('team_members', members, LEGACY_MEMBER_ROW, softDeleteMembers);
        } else { throw err2; }
      }
    } else if (msg.includes('excluded_from_capacity')) {
      try {
        await upsertAndPrune('team_members', members, MEMBER_ROW_NO_EXCLUDED, softDeleteMembers);
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        if (msg2.includes('working_days_per_week') || msg2.includes('bau_override') || msg2.includes('bau_reserve_days') || msg2.includes('bau_reserve_percent')) {
          await upsertAndPrune('team_members', members, MEMBER_ROW_NO_CAPACITY_OVERRIDES, softDeleteMembers);
        } else if (msg2.includes('squad_id') || msg2.includes('process_team_ids')) {
          await upsertAndPrune('team_members', members, LEGACY_MEMBER_ROW, softDeleteMembers);
        } else { throw err2; }
      }
    } else if (msg.includes('squad_id') || msg.includes('process_team_ids')) {
      await upsertAndPrune('team_members', members, LEGACY_MEMBER_ROW, softDeleteMembers);
    } else {
      throw err;
    }
  }
}

async function syncTimeOff(timeOff: TimeOff[]): Promise<void> {
  await upsertAndPrune('time_off', timeOff, t => ({
    id: t.id, member_id: t.memberId, start_date: t.startDate, end_date: t.endDate, note: t.note ?? null,
  }));
}

async function syncSprints(sprints: Sprint[]): Promise<void> {
  await upsertAndPrune('sprints', sprints, s => ({
    id: s.id, name: s.name, number: s.number, year: s.year,
    start_date: s.startDate, end_date: s.endDate, quarter: s.quarter, is_bye_week: s.isByeWeek ?? false,
  }));
}

async function syncJiraConnections(connections: JiraConnection[]): Promise<void> {
  await upsertAndPrune('jira_connections', connections, c => ({
    id: c.id,
    name: c.name,
    mode: c.mode ?? 'standard',
    jira_base_url: c.jiraBaseUrl,
    jira_project_key: c.jiraProjectKey,
    jira_project_id: c.jiraProjectId ?? null,
    jira_project_name: c.jiraProjectName ?? null,
    api_token: c.apiToken,
    api_token_masked: c.apiTokenMasked ?? null,
    user_email: c.userEmail,
    is_active: c.isActive,
    last_sync_at: c.lastSyncAt ?? null,
    last_sync_status: c.lastSyncStatus,
    last_sync_error: c.lastSyncError ?? null,
    sync_history: c.syncHistory ?? [],
    default_days_per_item: c.defaultDaysPerItem ?? 1,
    jql_filter: c.jqlFilter ?? null,
    label_filter: c.labelFilter ?? [],
    scenario_planner_only: c.scenarioPlannerOnly ?? false,
    custom_field_ids: c.customFieldIds ?? null,
    sync_settings_override: c.syncSettingsOverride ?? null,
    discovery_config: c.discoveryConfig ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }));
}

async function syncJiraWorkItems(items: JiraWorkItem[]): Promise<void> {
  await upsertAndPrune('jira_work_items', items, w => ({
    id: w.id,
    connection_id: w.connectionId,
    jira_key: w.jiraKey,
    jira_id: w.jiraId,
    summary: w.summary,
    description: w.description ?? null,
    type: w.type,
    type_name: w.typeName,
    status: w.status,
    status_category: w.statusCategory,
    priority: w.priority ?? null,
    story_points: w.storyPoints ?? null,
    original_estimate: w.originalEstimate ?? null,
    time_spent: w.timeSpent ?? null,
    remaining_estimate: w.remainingEstimate ?? null,
    assignee_email: w.assigneeEmail ?? null,
    assignee_name: w.assigneeName ?? null,
    reporter_email: w.reporterEmail ?? null,
    reporter_name: w.reporterName ?? null,
    parent_key: w.parentKey ?? null,
    parent_id: w.parentId ?? null,
    sprint_id: w.sprintId ?? null,
    sprint_name: w.sprintName ?? null,
    sprint_start_date: w.sprintStartDate ?? null,
    sprint_end_date: w.sprintEndDate ?? null,
    labels: w.labels,
    components: w.components,
    created: w.created,
    updated: w.updated,
    start_date: w.startDate ?? null,
    due_date: w.dueDate ?? null,
    stale_from_jira: w.staleFromJira ?? null,
    confidence_level: w.confidenceLevel ?? null,
    // App-only field — never read from or written to Jira
    required_skill_ids: w.requiredSkillIds ?? null,
  }));
}

async function syncScenarios(scenarios: Scenario[], businessTeams: BusinessTeam[]): Promise<void> {
  await upsertAndPrune('scenarios', scenarios, s => ({
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    color: s.color ?? null,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    based_on_sync_at: s.basedOnSyncAt ?? null,
    is_baseline: s.isBaseline,
    is_portfolio_scenario: s.isPortfolioScenario ?? false,
    archived: s.archived ?? false,
    jira_work_items: s.jiraWorkItems,
    jira_item_biz_assignments: s.jiraItemBizAssignments,
    team_members: s.teamMembers,
    time_off: s.timeOff,
    planner_layout: s.plannerLayout != null ? s.plannerLayout : null,
    capacity_requests: s.capacityRequests ?? [],
    capacity_assignments: s.capacityAssignments ?? [],
    portfolio_board_epic_keys: s.portfolioBoardEpicKeys ?? [],
    portfolio_manual_epics: s.portfolioManualEpics ?? [],
    portfolio_phase_plans: s.portfolioPhasePlans ?? [],
    portfolio_phase_assignments: normalizeBusinessTeamPlaceholdersInAssignments(
      s.portfolioPhaseAssignments ?? [],
      businessTeams,
    ),
    last_edited_by: s.lastEditedBy ?? null,
    skills_matching_enabled: s.skillsMatchingEnabled ?? true,
  }));
}

async function syncSettings(
  settings: Settings,
  jiraSettings: JiraSettings,
  activeScenarioId: string | null,
  capacityRequests: CapacityRequest[],
  capacityAssignments: CapacityAssignment[],
): Promise<void> {
  const { error } = await supabase.from('settings').upsert([
    { key: 'settings',            value: settings as unknown },
    { key: 'jiraSettings',        value: jiraSettings as unknown },
    { key: 'capacityRequests',    value: capacityRequests as unknown },
    { key: 'capacityAssignments', value: capacityAssignments as unknown },
  ], { onConflict: 'key' });

  if (error) throw new Error(`settings upsert failed: ${error.message}`);

  if (activeScenarioId !== null) {
    const { error: err2 } = await supabase.from('settings').upsert(
      { key: 'activeScenarioId', value: activeScenarioId as unknown },
      { onConflict: 'key' }
    );
    if (err2) throw new Error(`settings activeScenarioId upsert failed: ${err2.message}`);
  } else {
    await supabase.from('settings').delete().eq('key', 'activeScenarioId');
  }
}

async function syncExternalVendors(vendors: ExternalVendor[]): Promise<void> {
  try {
    await upsertAndPrune('external_vendors', vendors, (v) => ({
      id: v.id,
      name: v.name,
      daily_rate: v.dailyRate,
      currency: v.currency,
      notes: v.notes ?? null,
      archived: v.archived ?? false,
      counts_toward_capacity: v.countsTowardCapacity ?? false,
      working_days_per_week: v.workingDaysPerWeek ?? null,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('external_vendors') && (msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] external_vendors table not found — run migration 048. Skipping.');
      return;
    }
    throw err;
  }
}

async function syncInitiativeCosts(records: InitiativeCostRecord[]): Promise<void> {
  try {
    await upsertAndPrune('initiative_costs', records, (r) => ({
      id: r.id,
      initiative_kind: r.initiativeKind,
      initiative_id: r.initiativeId,
      scenario_id: r.scenarioId ?? null,
      contingency_pct: r.contingencyPct,
      hardware: r.hardware ?? null,
      licenses: r.licenses ?? [],
      updated_at: r.updatedAt,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('initiative_costs') && (msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] initiative_costs table not found — run migration 049. Skipping.');
      return;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS CONTACT SYNC (graceful column fallback for incremental migrations)
// ─────────────────────────────────────────────────────────────────────────────

const FULL_BIZ_CONTACT_ROW = (c: BusinessContact) => ({
  id: c.id, name: c.name, title: c.title ?? null, department: c.department ?? null,
  email: c.email ?? null, country_id: c.countryId,
  working_days_per_week: c.workingDaysPerWeek ?? 5, working_hours_per_day: c.workingHoursPerDay ?? 8,
  bau_reserve_percent: c.bauReservePercent ?? null,
  bau_reserve_days: c.bauReserveDays ?? (c.bauReservePercent != null ? bauPercentToLegacyDays(c.bauReservePercent) : 5),
  process_team_ids: c.processTeamIds ?? [],
  business_team_ids: c.businessTeamIds ?? [],
  daily_rate_override: c.dailyRateOverride ?? null,
  daily_rate_currency: c.dailyRateCurrency ?? null,
  notes: c.notes ?? null, archived: c.archived ?? false,
  excluded_from_capacity: c.excludedFromCapacity ?? false,
  updated_at: new Date().toISOString(),
});

const BIZ_CONTACT_ROW_NO_EXCLUDED = (c: BusinessContact) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { excluded_from_capacity: _excl, ...row } = FULL_BIZ_CONTACT_ROW(c);
  return row;
};

const LEGACY_BIZ_CONTACT_ROW = (c: BusinessContact) => ({
  id: c.id, name: c.name, title: c.title ?? null, department: c.department ?? null,
  email: c.email ?? null, country_id: c.countryId,
  working_days_per_week: c.workingDaysPerWeek ?? 5, working_hours_per_day: c.workingHoursPerDay ?? 8,
  bau_reserve_days: c.bauReserveDays ?? (c.bauReservePercent != null ? bauPercentToLegacyDays(c.bauReservePercent) : 5),
  notes: c.notes ?? null, archived: c.archived ?? false, updated_at: new Date().toISOString(),
});

async function syncBusinessContacts(contacts: BusinessContact[]): Promise<void> {
  try {
    await upsertAndPrune('business_contacts', contacts, FULL_BIZ_CONTACT_ROW);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('column') && (msg.includes('relation "business_contacts" does not exist') || msg.includes('table "business_contacts"'))) {
      console.warn('[Sync] business_contacts table not found — run migration 011. Skipping.');
      return;
    }
    if (msg.includes('excluded_from_capacity') || msg.includes('daily_rate_override') || msg.includes('daily_rate_currency')) {
      try {
        await upsertAndPrune('business_contacts', contacts, BIZ_CONTACT_ROW_NO_EXCLUDED);
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        if (msg2.includes('bau_reserve_days') || msg2.includes('bau_reserve_percent') || msg2.includes('process_team_ids') || msg2.includes('business_team_ids') || msg2.includes('daily_rate_override') || msg2.includes('daily_rate_currency')) {
          await upsertAndPrune('business_contacts', contacts, LEGACY_BIZ_CONTACT_ROW);
        } else { throw err2; }
      }
    } else if (msg.includes('bau_reserve_days') || msg.includes('bau_reserve_percent') || msg.includes('process_team_ids') || msg.includes('business_team_ids') || msg.includes('daily_rate_override') || msg.includes('daily_rate_currency')) {
      await upsertAndPrune('business_contacts', contacts, LEGACY_BIZ_CONTACT_ROW);
    } else {
      throw err;
    }
  }
}

async function syncBusinessTimeOff(timeOff: BusinessTimeOff[]): Promise<void> {
  try {
    await upsertAndPrune('business_time_off', timeOff, t => ({
      id: t.id, contact_id: t.contactId, start_date: t.startDate, end_date: t.endDate,
      type: t.type, notes: t.notes ?? null,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('business_time_off') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] business_time_off table not found — run migration 011. Skipping.');
      return;
    }
    throw err;
  }
}

async function syncJiraItemBizAssignments(items: JiraItemBizAssignment[]): Promise<void> {
  try {
    await upsertAndPrune('jira_item_biz_assignments', items, a => ({
      id: a.id, jira_key: a.jiraKey, contact_id: a.contactId,
      days: a.days ?? null, notes: a.notes ?? null,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('jira_item_biz_assignments') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] jira_item_biz_assignments table not found — run migration 012. Skipping.');
      return;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC UPSERT + PRUNE
// ─────────────────────────────────────────────────────────────────────────────

type DeleteFn = (idsToRemove: string[]) => Promise<void>;

async function upsertAndPrune<T extends { id: string }>(
  table: string,
  items: T[],
  toRow: (item: T) => Record<string, unknown>,
  customDelete?: DeleteFn
): Promise<void> {
  const { data: existingRows, error: selectError } = await supabase.from(table).select('id');

  if (selectError) {
    console.warn(`[Sync] ${table} SELECT failed (skipping prune, will still upsert):`, selectError.message);
  } else {
    const existingIds = new Set((existingRows ?? []).map((r: { id: string }) => r.id));
    const currentIds = new Set(items.map(i => i.id));
    const toDelete = [...existingIds].filter(id => !currentIds.has(id));

    if (toDelete.length > 0) {
      if (customDelete) {
        await customDelete(toDelete);
      } else {
        const { error: deleteError } = await supabase.from(table).delete().in('id', toDelete);
        if (deleteError) console.warn(`[Sync] ${table} delete failed:`, deleteError.message);
      }
    }
  }

  if (items.length > 0) {
    const rows = items.map(toRow);
    const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (upsertError) throw new Error(`[Sync] ${table} upsert failed: ${upsertError.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCED SYNC SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

type SyncCallback = (status: 'saving' | 'saved' | 'error', error?: string) => void;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppState | null = null;
let isSaving = false;

export function scheduleSyncToSupabase(state: AppState, onStatus: SyncCallback): void {
  if (!isSupabaseConfigured()) return;

  pendingState = state;
  onStatus('saving');

  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    if (!pendingState) return;
    if (isSaving) {
      scheduleSyncToSupabase(pendingState, onStatus);
      return;
    }
    isSaving = true;
    const stateToSave = pendingState;
    pendingState = null;
    try {
      await saveToSupabase(stateToSave);
      onStatus('saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Sync] Save failed:', msg);
      onStatus('error', msg);
    } finally {
      isSaving = false;
    }
  }, 1500);
}
