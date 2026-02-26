/**
 * Supabase cloud sync service
 *
 * Reads and writes the full AppState using individual relational tables instead
 * of a single JSON blob. Each entity type (roles, countries, team members, etc.)
 * lives in its own table, giving full visibility in the Supabase dashboard.
 *
 * Strategy:
 *  - On app startup: parallel read from all tables → assemble AppState
 *  - On every data mutation: debounced write to all tables (1.5 s)
 *  - localStorage is kept as an offline cache / instant-load layer
 *
 * Schema mapping:
 *  - DB uses snake_case; TypeScript uses camelCase. All conversion happens here.
 *  - TeamMember.role stores the role NAME (not a UUID FK) — by design of the app.
 *  - Project.phases is stored as JSONB (nested assignments make full normalisation
 *    impractical for a single-user app).
 *  - Scenario data (projects, teamMembers, etc.) is stored as JSONB arrays
 *    within the scenarios table.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  AppState,
  TeamMember,
  Project,
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
  Settings,
  JiraSettings,
  Assignment,
  BusinessContact,
  BusinessTimeOff,
  BusinessAssignment,
  JiraItemBizAssignment,
} from '../types';
import { generateQuarters } from '../utils/calendar';

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES — mirrors defaults in appStore.ts
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  bauReserveDays: 5,
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

function flattenAssignmentsFromProjects(projects: Project[]): Assignment[] {
  const flattened: Assignment[] = [];
  for (const project of projects) {
    for (const phase of project.phases) {
      for (const assignment of phase.assignments ?? []) {
        flattened.push({
          ...assignment,
          projectId: project.id,
          phaseId: phase.id,
        });
      }
    }
  }
  return flattened;
}

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
      squadsRes, processTeamsRes,
      teamMembersRes, projectsRes, timeOffRes, settingsRes,
      sprintsRes, jiraConnectionsRes, jiraWorkItemsRes, scenariosRes, assignmentsRes,
      bizContactsRes, bizTimeOffRes, bizAssignmentsRes, bizJiraItemsRes, localPhasesRes,
    ] = await Promise.all([
      supabase.from('roles').select('*').order('name'),
      supabase.from('countries').select('*').order('name'),
      supabase.from('public_holidays').select('*').order('date'),
      supabase.from('skills').select('*').order('name'),
      supabase.from('systems').select('*').order('name'),
      supabase.from('squads').select('*').order('name'),
      supabase.from('process_teams').select('*').order('name'),
      supabase.from('team_members').select('*').eq('is_active', true).order('name'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('time_off').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('sprints').select('*').order('year').order('number'),
      supabase.from('jira_connections').select('*').order('created_at'),
      supabase.from('jira_work_items').select('*'),
      supabase.from('scenarios').select('*').order('created_at'),
      supabase.from('assignments').select('*'),
      supabase.from('business_contacts').select('*').order('name'),
      supabase.from('business_time_off').select('*'),
      supabase.from('business_assignments').select('*'),
      supabase.from('jira_item_biz_assignments').select('*'),
      supabase.from('local_phases').select('*').order('created_at'),
    ]);

    // Log any table errors but continue with empty arrays — partial data is
    // better than a full fallback to (possibly empty) localStorage.
    // Only bail out completely if ALL tables fail (network / config problem).
    const allResults = [
      rolesRes, countriesRes, holidaysRes, skillsRes, systemsRes,
      squadsRes, processTeamsRes,
      teamMembersRes, projectsRes, timeOffRes, settingsRes,
      sprintsRes, jiraConnectionsRes, jiraWorkItemsRes, scenariosRes, assignmentsRes,
      localPhasesRes,
      bizContactsRes, bizTimeOffRes, bizAssignmentsRes, bizJiraItemsRes,
    ];
    const errorCount = allResults.filter(r => r.error).length;

    allResults
      .filter(r => r.error)
      .forEach(r => console.warn('[Sync] Table load error (continuing with empty):', r.error?.message));

    // If every single table failed it's a connectivity / configuration problem
    if (errorCount === allResults.length) {
      console.error('[Sync] All tables failed to load — falling back to localStorage.');
      return null;
    }

    // ── Map DB rows → TypeScript types ───────────────────────────────────────

    const roles: Role[] = (rolesRes.data ?? []).map(r => ({
      id: r.id,
      name: r.name,
    }));

    const countries: Country[] = (countriesRes.data ?? []).map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      flag: c.flag ?? undefined,
    }));

    const publicHolidays: PublicHoliday[] = (holidaysRes.data ?? []).map(h => ({
      id: h.id,
      countryId: h.country_id,
      date: h.date,
      name: h.name,
    }));

    const skills: Skill[] = (skillsRes.data ?? []).map(s => ({
      id: s.id,
      name: s.name,
      category: s.category as Skill['category'],
    }));

    const systems: System[] = (systemsRes.data ?? []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description ?? undefined,
    }));

    const squads: Squad[] = (squadsRes.data ?? []).map(s => ({
      id: s.id,
      name: s.name,
    }));

    const processTeams: ProcessTeam[] = (processTeamsRes.data ?? []).map(pt => ({
      id: pt.id,
      name: pt.name,
    }));

    const teamMembers: TeamMember[] = (teamMembersRes.data ?? []).map(m => ({
      id: m.id,
      name: m.name,
      role: m.role ?? '',
      countryId: m.country_id ?? '',
      skillIds: Array.isArray(m.skill_ids) ? m.skill_ids : [],
      maxConcurrentProjects: m.max_concurrent_projects ?? 2,
      squadId: m.squad_id ?? undefined,
      processTeamIds: Array.isArray(m.process_team_ids) ? m.process_team_ids : [],
      email: m.email ?? undefined,
      jiraAccountId: m.jira_account_id ?? undefined,
      syncedFromJira: m.synced_from_jira ?? false,
      needsEnrichment: m.needs_enrichment ?? false,
    }));

    const projects: Project[] = (projectsRes.data ?? []).map(p => ({
      id: p.id,
      name: p.name,
      priority: p.priority as Project['priority'],
      status: p.status as Project['status'],
      systemIds: Array.isArray(p.system_ids) ? p.system_ids : [],
      phases: Array.isArray(p.phases) ? p.phases : [],
      devopsLink: p.devops_link ?? undefined,
      description: p.description ?? undefined,
      notes: p.notes ?? undefined,
      startDate: p.start_date ?? undefined,
      endDate: p.end_date ?? undefined,
      archived: p.archived ?? false,
      jiraSourceKey: p.jira_source_key ?? undefined,
      syncedFromJira: p.synced_from_jira ?? false,
    }));

    const timeOff: TimeOff[] = (timeOffRes.data ?? []).map(t => ({
      id: t.id,
      memberId: t.member_id,
      startDate: t.start_date,
      endDate: t.end_date,
      note: t.note ?? undefined,
    }));

    const sprints: Sprint[] = (sprintsRes.data ?? []).map(s => ({
      id: s.id,
      name: s.name,
      number: s.number,
      year: s.year,
      startDate: s.start_date,
      endDate: s.end_date,
      quarter: s.quarter,
      isByeWeek: s.is_bye_week ?? false,
    }));

    const jiraConnections: JiraConnection[] = (jiraConnectionsRes.data ?? []).map(c => ({
      id: c.id,
      name: c.name,
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
      // Import behaviour — default to safe values for rows created before migration 003
      hierarchyMode: (c.hierarchy_mode ?? 'auto') as JiraConnection['hierarchyMode'],
      autoCreateProjects: c.auto_create_projects ?? true,
      autoCreateAssignments: c.auto_create_assignments ?? true,
      defaultDaysPerItem: c.default_days_per_item ?? 1,
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
      sprintEndDate:   w.sprint_end_date   ?? undefined,
      labels: Array.isArray(w.labels) ? w.labels : [],
      components: Array.isArray(w.components) ? w.components : [],
      created: w.created,
      updated: w.updated,
      startDate:  w.start_date  ?? undefined,
      dueDate:    w.due_date    ?? undefined,
      staleFromJira: w.stale_from_jira ?? undefined,
      confidenceLevel: (w.confidence_level as JiraWorkItem['confidenceLevel']) ?? undefined,
      mappedProjectId: w.mapped_project_id ?? undefined,
      mappedPhaseId: w.mapped_phase_id ?? undefined,
      mappedMemberId: w.mapped_member_id ?? undefined,
    }));

    const scenarios: Scenario[] = (scenariosRes.data ?? []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description ?? undefined,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      basedOnSyncAt: s.based_on_sync_at ?? undefined,
      isBaseline: s.is_baseline ?? false,
      projects: Array.isArray(s.projects) ? s.projects : [],
      teamMembers: Array.isArray(s.team_members) ? s.team_members : [],
      assignments: Array.isArray(s.assignments) ? s.assignments : [],
      timeOff: Array.isArray(s.time_off) ? s.time_off : [],
      jiraWorkItems: Array.isArray(s.jira_work_items) ? s.jira_work_items : [],
    }));

    const assignments: Assignment[] = (assignmentsRes.data ?? []).map(a => ({
      projectId: a.project_id,
      phaseId: a.phase_id,
      memberId: a.member_id,
      quarter: a.quarter,
      days: Number(a.days ?? 0),
      sprint: a.sprint ?? undefined,
      jiraSynced: a.jira_synced ?? undefined,
    }));

    // Settings are stored as key-value pairs in the settings table
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
    };
    const jiraSettings: JiraSettings = {
      ...DEFAULT_JIRA_SETTINGS,
      ...((settingsMap.jiraSettings as Partial<JiraSettings>) ?? {}),
    };
    const activeScenarioId: string | null =
      (settingsMap.activeScenarioId as string | null) ?? null;

    // If every table is empty and settings is also empty, treat as no cloud data
    const hasAnyData =
      roles.length > 0 ||
      countries.length > 0 ||
      teamMembers.length > 0 ||
      projects.length > 0 ||
      assignments.length > 0 ||
      (settingsRes.data ?? []).length > 0;

    if (!hasAnyData) {
      console.info('[Sync] All tables empty — will use localStorage.');
      return null;
    }

    console.info(
      `[Sync] Loaded: ${roles.length} roles, ${countries.length} countries, ` +
      `${teamMembers.length} members, ${projects.length} projects, ` +
      `${jiraWorkItems.length} Jira items`
    );

    // Business contacts
    const businessContacts: BusinessContact[] = (bizContactsRes.data ?? []).map(c => ({
      id: c.id,
      name: c.name,
      title: c.title ?? undefined,
      department: c.department ?? undefined,
      email: c.email ?? undefined,
      countryId: c.country_id,
      workingDaysPerWeek: c.working_days_per_week ?? 5,
      workingHoursPerDay: c.working_hours_per_day ?? 8,
      projectIds: Array.isArray(c.project_ids) ? c.project_ids : [],
      notes: c.notes ?? undefined,
      archived: c.archived ?? false,
    }));

    const businessTimeOff: BusinessTimeOff[] = (bizTimeOffRes.data ?? []).map(t => ({
      id: t.id,
      contactId: t.contact_id,
      startDate: t.start_date,
      endDate: t.end_date,
      type: t.type as 'holiday' | 'other',
      notes: t.notes ?? undefined,
    }));

    const businessAssignments: BusinessAssignment[] = (bizAssignmentsRes.data ?? []).map(a => ({
      id: a.id,
      contactId: a.contact_id,
      projectId: a.project_id,
      phaseId: a.phase_id ?? undefined,
      quarter: a.quarter ?? undefined,
      days: Number(a.days),
      notes: a.notes ?? undefined,
    }));

    const jiraItemBizAssignments: JiraItemBizAssignment[] = (bizJiraItemsRes.data ?? []).map(r => ({
      id: r.id,
      jiraKey: r.jira_key,
      contactId: r.contact_id,
      days: r.days != null ? Number(r.days) : undefined,
      notes: r.notes ?? undefined,
    }));

    const localPhases = (localPhasesRes.data ?? []).map(r => ({
      id: r.id as string,
      jiraKey: r.jira_key as string,
      type: r.type as 'uat' | 'hypercare',
      name: r.name as string,
      startDate: r.start_date as string,
      endDate: r.end_date as string,
    }));

    return {
      version: 10,
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
      teamMembers,
      projects,
      assignments: assignments.length > 0 ? assignments : flattenAssignmentsFromProjects(projects),
      timeOff,
      quarters: generateQuarters(8),
      sprints,
      jiraConnections,
      jiraWorkItems,
      scenarios,
      activeScenarioId,
      businessContacts,
      businessTimeOff,
      businessAssignments,
      jiraItemBizAssignments,
      localPhases,
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
 * Each table uses "upsert existing + delete removed" semantics.
 * Throws on error so the caller can update the sync status indicator.
 */
export async function saveToSupabase(state: AppState): Promise<void> {
  if (!isSupabaseConfigured()) return;

  console.info(
    `[Sync] Saving: ${state.roles.length} roles, ${state.countries.length} countries, ` +
    `${state.teamMembers.length} members, ${state.projects.length} projects`
  );

  // Run all table syncs in parallel. Collect per-table errors instead of
  // short-circuiting on the first failure, so one bad table doesn't block others.
  const tasks: [string, Promise<void>][] = [
    ['roles',            syncRoles(state.roles)],
    ['countries',        syncCountries(state.countries)],
    ['public_holidays',  syncHolidays(state.publicHolidays)],
    ['skills',           syncSkills(state.skills)],
    ['systems',          syncSystems(state.systems)],
    ['squads',           syncSquads(state.squads)],
    ['process_teams',    syncProcessTeams(state.processTeams)],
    ['team_members',     syncTeamMembers(state.teamMembers)],
    ['projects',         syncProjects(state.projects)],
    ['assignments',      syncAssignments(state.assignments.length > 0 ? state.assignments : flattenAssignmentsFromProjects(state.projects))],
    ['time_off',         syncTimeOff(state.timeOff)],
    ['sprints',          syncSprints(state.sprints)],
    ['jira_connections', syncJiraConnections(state.jiraConnections)],
    ['jira_work_items',  syncJiraWorkItems(state.jiraWorkItems)],
    ['scenarios',             syncScenarios(state.scenarios)],
    ['settings',              syncSettings(state.settings, state.jiraSettings, state.activeScenarioId)],
    ['business_contacts',          syncBusinessContacts(state.businessContacts ?? [])],
    ['business_time_off',          syncBusinessTimeOff(state.businessTimeOff ?? [])],
    ['business_assignments',       syncBusinessAssignments(state.businessAssignments ?? [])],
    ['jira_item_biz_assignments',  syncJiraItemBizAssignments(state.jiraItemBizAssignments ?? [])],
    ['local_phases',               syncLocalPhases(state.localPhases ?? [])],
  ];

  const results = await Promise.allSettled(tasks.map(([, p]) => p));

  const failures = results
    .map((r, i) => ({ table: tasks[i][0], result: r }))
    .filter(({ result }) => result.status === 'rejected');

  if (failures.length > 0) {
    const messages = failures
      .map(({ table, result }) =>
        `${table}: ${(result as PromiseRejectedResult).reason?.message ?? result}`
      )
      .join('; ');
    console.error('[Sync] Some tables failed to save:', messages);
    throw new Error(messages);
  }

  console.info('[Sync] All tables saved successfully.');
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-TABLE SYNC HELPERS
// Each helper: upserts current rows, deletes rows that are no longer present.
// ─────────────────────────────────────────────────────────────────────────────

async function syncRoles(roles: Role[]): Promise<void> {
  await upsertAndPrune(
    'roles',
    roles,
    r => ({ id: r.id, name: r.name })
  );
}

async function syncCountries(countries: Country[]): Promise<void> {
  await upsertAndPrune(
    'countries',
    countries,
    c => ({ id: c.id, code: c.code, name: c.name, flag: c.flag ?? null })
  );
}

async function syncHolidays(holidays: PublicHoliday[]): Promise<void> {
  await upsertAndPrune(
    'public_holidays',
    holidays,
    h => ({ id: h.id, country_id: h.countryId, date: h.date, name: h.name })
  );
}

async function syncSkills(skills: Skill[]): Promise<void> {
  await upsertAndPrune(
    'skills',
    skills,
    s => ({ id: s.id, name: s.name, category: s.category })
  );
}

async function syncSystems(systems: System[]): Promise<void> {
  await upsertAndPrune(
    'systems',
    systems,
    s => ({ id: s.id, name: s.name, description: s.description ?? null })
  );
}

async function syncSquads(squads: Squad[]): Promise<void> {
  await upsertAndPrune(
    'squads',
    squads,
    s => ({ id: s.id, name: s.name })
  );
}

async function syncProcessTeams(processTeams: ProcessTeam[]): Promise<void> {
  await upsertAndPrune(
    'process_teams',
    processTeams,
    pt => ({ id: pt.id, name: pt.name })
  );
}

const BASE_MEMBER_ROW = (m: TeamMember) => ({
  id: m.id,
  name: m.name,
  role: m.role,
  country_id: m.countryId,
  skill_ids: m.skillIds,
  max_concurrent_projects: m.maxConcurrentProjects,
  email: m.email ?? null,
  jira_account_id: m.jiraAccountId ?? null,
  synced_from_jira: m.syncedFromJira ?? false,
  needs_enrichment: m.needsEnrichment ?? false,
  is_active: true,
});

const EXTENDED_MEMBER_ROW = (m: TeamMember) => ({
  ...BASE_MEMBER_ROW(m),
  // Added by migration 004 — may not exist on all Supabase instances
  squad_id: m.squadId ?? null,
  process_team_ids: m.processTeamIds ?? [],
});

const softDeleteMembers = async (idsToRemove: string[]) => {
  if (idsToRemove.length > 0) {
    await supabase.from('team_members').update({ is_active: false }).in('id', idsToRemove);
  }
};

async function syncTeamMembers(members: TeamMember[]): Promise<void> {
  try {
    // Try with squad / process-team columns (migration 004)
    await upsertAndPrune('team_members', members, EXTENDED_MEMBER_ROW, softDeleteMembers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If the error is specifically about missing squad/process-team columns
    // (migration 004 not yet applied), fall back to base columns only.
    if (msg.includes('squad_id') || msg.includes('process_team_ids')) {
      console.warn(
        '[Sync] team_members: squad_id / process_team_ids columns missing — ' +
        'falling back to base sync. Run supabase/migrations/004_squads_and_process_teams.sql to enable.'
      );
      await upsertAndPrune('team_members', members, BASE_MEMBER_ROW, softDeleteMembers);
    } else {
      throw err; // Re-throw unrelated errors
    }
  }
}

async function syncProjects(projects: Project[]): Promise<void> {
  await upsertAndPrune(
    'projects',
    projects,
    p => ({
      id: p.id,
      name: p.name,
      priority: p.priority,
      status: p.status,
      system_ids: p.systemIds,
      phases: p.phases,
      devops_link: p.devopsLink ?? null,
      description: p.description ?? null,
      notes: p.notes ?? null,
      start_date: p.startDate ?? null,
      end_date: p.endDate ?? null,
      archived: p.archived ?? false,
      jira_source_key: p.jiraSourceKey ?? null,
      synced_from_jira: p.syncedFromJira ?? false,
    })
  );
}

async function syncAssignments(assignments: Assignment[]): Promise<void> {
  try {
    await upsertAndPrune(
      'assignments',
      assignments.map((a, idx) => ({
        id: `${a.projectId ?? 'project'}:${a.phaseId ?? 'phase'}:${a.memberId}:${a.quarter}:${a.sprint ?? 'quarter'}:${idx}`,
        ...a,
      })),
      a => ({
        id: a.id,
        project_id: a.projectId ?? null,
        phase_id: a.phaseId ?? null,
        member_id: a.memberId,
        quarter: a.quarter,
        days: a.days,
        sprint: a.sprint ?? null,
        jira_synced: a.jiraSynced ?? false,
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('relation "assignments" does not exist') ||
      msg.includes('could not find the table public.assignments') ||
      msg.includes("Could not find the table 'public.assignments'") ||
      msg.includes('assignments table missing')
    ) {
      console.warn('[Sync] assignments table missing — run migration to enable flattened assignments.');
      return;
    }
    throw err;
  }
}

async function syncTimeOff(timeOff: TimeOff[]): Promise<void> {
  await upsertAndPrune(
    'time_off',
    timeOff,
    t => ({
      id: t.id,
      member_id: t.memberId,
      start_date: t.startDate,
      end_date: t.endDate,
      note: t.note ?? null,
    })
  );
}

async function syncSprints(sprints: Sprint[]): Promise<void> {
  await upsertAndPrune(
    'sprints',
    sprints,
    s => ({
      id: s.id,
      name: s.name,
      number: s.number,
      year: s.year,
      start_date: s.startDate,
      end_date: s.endDate,
      quarter: s.quarter,
      is_bye_week: s.isByeWeek ?? false,
    })
  );
}

async function syncJiraConnections(connections: JiraConnection[]): Promise<void> {
  await upsertAndPrune(
    'jira_connections',
    connections,
    c => ({
      id: c.id,
      name: c.name,
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
      hierarchy_mode: c.hierarchyMode ?? 'auto',
      auto_create_projects: c.autoCreateProjects ?? true,
      auto_create_assignments: c.autoCreateAssignments ?? true,
      default_days_per_item: c.defaultDaysPerItem ?? 1,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    })
  );
}

async function syncJiraWorkItems(items: JiraWorkItem[]): Promise<void> {
  await upsertAndPrune(
    'jira_work_items',
    items,
    w => ({
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
      sprint_end_date:   w.sprintEndDate   ?? null,
      labels: w.labels,
      components: w.components,
      created: w.created,
      updated: w.updated,
      start_date:  w.startDate  ?? null,
      due_date:    w.dueDate    ?? null,
      stale_from_jira: w.staleFromJira ?? null,
      confidence_level: w.confidenceLevel ?? null,
      mapped_project_id: w.mappedProjectId ?? null,
      mapped_phase_id: w.mappedPhaseId ?? null,
      mapped_member_id: w.mappedMemberId ?? null,
    })
  );
}

async function syncScenarios(scenarios: Scenario[]): Promise<void> {
  await upsertAndPrune(
    'scenarios',
    scenarios,
    s => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
      based_on_sync_at: s.basedOnSyncAt ?? null,
      is_baseline: s.isBaseline,
      projects: s.projects,
      team_members: s.teamMembers,
      assignments: s.assignments,
      time_off: s.timeOff,
      jira_work_items: s.jiraWorkItems,
    })
  );
}

async function syncSettings(
  settings: Settings,
  jiraSettings: JiraSettings,
  activeScenarioId: string | null
): Promise<void> {
  // Upsert settings and jiraSettings (always non-null objects)
  const { error } = await supabase.from('settings').upsert([
    { key: 'settings',     value: settings     as unknown },
    { key: 'jiraSettings', value: jiraSettings as unknown },
  ], { onConflict: 'key' });

  if (error) {
    throw new Error(`settings upsert failed: ${error.message}`);
  }

  // activeScenarioId is nullable — handle separately
  if (activeScenarioId !== null) {
    const { error: err2 } = await supabase.from('settings').upsert(
      { key: 'activeScenarioId', value: activeScenarioId as unknown },
      { onConflict: 'key' }
    );
    if (err2) throw new Error(`settings activeScenarioId upsert failed: ${err2.message}`);
  } else {
    // Delete the row so it reads back as null on next load
    await supabase.from('settings').delete().eq('key', 'activeScenarioId');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC UPSERT + PRUNE
// ─────────────────────────────────────────────────────────────────────────────

// ─── BUSINESS CONTACT SYNC ────────────────────────────────────────────────────

async function syncBusinessContacts(contacts: BusinessContact[]): Promise<void> {
  try {
    await upsertAndPrune(
      'business_contacts',
      contacts,
      c => ({
        id: c.id,
        name: c.name,
        title: c.title ?? null,
        department: c.department ?? null,
        email: c.email ?? null,
        country_id: c.countryId,
        working_days_per_week: c.workingDaysPerWeek ?? 5,
        working_hours_per_day: c.workingHoursPerDay ?? 8,
        project_ids: c.projectIds ?? [],
        notes: c.notes ?? null,
        archived: c.archived ?? false,
        updated_at: new Date().toISOString(),
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('business_contacts') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] business_contacts table not found — run migration 011. Skipping.');
      return;
    }
    throw err;
  }
}

async function syncBusinessTimeOff(timeOff: BusinessTimeOff[]): Promise<void> {
  try {
    await upsertAndPrune(
      'business_time_off',
      timeOff,
      t => ({
        id: t.id,
        contact_id: t.contactId,
        start_date: t.startDate,
        end_date: t.endDate,
        type: t.type,
        notes: t.notes ?? null,
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('business_time_off') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] business_time_off table not found — run migration 011. Skipping.');
      return;
    }
    throw err;
  }
}

async function syncBusinessAssignments(assignments: BusinessAssignment[]): Promise<void> {
  try {
    await upsertAndPrune(
      'business_assignments',
      assignments,
      a => ({
        id: a.id,
        contact_id: a.contactId,
        project_id: a.projectId,
        phase_id: a.phaseId ?? null,
        quarter: a.quarter ?? null,
        days: a.days,
        notes: a.notes ?? null,
        updated_at: new Date().toISOString(),
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('business_assignments') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] business_assignments table not found — run migration 011. Skipping.');
      return;
    }
    throw err;
  }
}

async function syncJiraItemBizAssignments(items: JiraItemBizAssignment[]): Promise<void> {
  try {
    await upsertAndPrune(
      'jira_item_biz_assignments',
      items,
      a => ({
        id: a.id,
        jira_key: a.jiraKey,
        contact_id: a.contactId,
        days: a.days ?? null,
        notes: a.notes ?? null,
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('jira_item_biz_assignments') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] jira_item_biz_assignments table not found — run migration 012. Skipping.');
      return;
    }
    throw err;
  }
}

async function syncLocalPhases(phases: import('../types').LocalPhase[]): Promise<void> {
  try {
    await upsertAndPrune(
      'local_phases',
      phases,
      p => ({
        id: p.id,
        jira_key: p.jiraKey,
        type: p.type,
        name: p.name,
        start_date: p.startDate,
        end_date: p.endDate,
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('local_phases') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation'))) {
      console.warn('[Sync] local_phases table not found — run migration 013. Skipping.');
      return;
    }
    throw err;
  }
}

type DeleteFn = (idsToRemove: string[]) => Promise<void>;

/**
 * Upserts all current items into a table, then deletes rows whose IDs are no
 * longer present in the current state.
 *
 * @param table        Supabase table name
 * @param items        Current items from the app state
 * @param toRow        Maps a TypeScript item to a DB row object
 * @param customDelete Optional override for delete behaviour (e.g. soft delete)
 */
async function upsertAndPrune<T extends { id: string }>(
  table: string,
  items: T[],
  toRow: (item: T) => Record<string, unknown>,
  customDelete?: DeleteFn
): Promise<void> {
  // 1. Try to load existing IDs so we can prune removed items.
  //    If SELECT fails (e.g. schema cache stale after migration), we skip the
  //    prune step but still upsert current data — data safety > stale row cleanup.
  const { data: existingRows, error: selectError } = await supabase
    .from(table)
    .select('id');

  if (selectError) {
    console.warn(`[Sync] ${table} SELECT failed (skipping prune, will still upsert):`, selectError.message);
  } else {
    // 2. Delete IDs that are in the DB but not in the current state
    const existingIds = new Set((existingRows ?? []).map((r: { id: string }) => r.id));
    const currentIds = new Set(items.map(i => i.id));
    const toDelete = [...existingIds].filter(id => !currentIds.has(id));

    if (toDelete.length > 0) {
      if (customDelete) {
        await customDelete(toDelete);
      } else {
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .in('id', toDelete);
        if (deleteError) {
          console.warn(`[Sync] ${table} delete failed:`, deleteError.message);
        }
      }
    }
  }

  // 3. Upsert current items (always runs, even when SELECT failed above)
  if (items.length > 0) {
    const rows = items.map(toRow);
    const { error: upsertError } = await supabase
      .from(table)
      .upsert(rows, { onConflict: 'id' });

    if (upsertError) {
      throw new Error(`[Sync] ${table} upsert failed: ${upsertError.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCED SYNC SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

type SyncCallback = (status: 'saving' | 'saved' | 'error', error?: string) => void;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppState | null = null;
let isSaving = false;

/**
 * Schedule a debounced save to Supabase.
 * Multiple rapid calls coalesce into a single save 1.5 s after the last call.
 */
export function scheduleSyncToSupabase(state: AppState, onStatus: SyncCallback): void {
  if (!isSupabaseConfigured()) return;

  pendingState = state;
  onStatus('saving');

  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    if (!pendingState) return;
    if (isSaving) {
      // A save is already in-flight; keep the latest pending state and try again.
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
