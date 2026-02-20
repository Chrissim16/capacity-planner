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
  Settings,
  JiraSettings,
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
  sprintDurationWeeks: 3,
  sprintStartDate: '2026-01-05',
  sprintsToShow: 6,
  sprintsPerYear: 16,
  byeWeeksAfter: [8, 12],
  holidayWeeksAtEnd: 2,
};

const DEFAULT_JIRA_SETTINGS: JiraSettings = {
  storyPointsToDays: 0.5,
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
      teamMembersRes, projectsRes, timeOffRes, settingsRes,
      sprintsRes, jiraConnectionsRes, jiraWorkItemsRes, scenariosRes,
    ] = await Promise.all([
      supabase.from('roles').select('*').order('name'),
      supabase.from('countries').select('*').order('name'),
      supabase.from('public_holidays').select('*').order('date'),
      supabase.from('skills').select('*').order('name'),
      supabase.from('systems').select('*').order('name'),
      supabase.from('team_members').select('*').eq('is_active', true).order('name'),
      supabase.from('projects').select('*').order('name'),
      supabase.from('time_off').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('sprints').select('*').order('year').order('number'),
      supabase.from('jira_connections').select('*').order('created_at'),
      supabase.from('jira_work_items').select('*'),
      supabase.from('scenarios').select('*').order('created_at'),
    ]);

    // Log any table errors but continue with empty arrays — partial data is
    // better than a full fallback to (possibly empty) localStorage.
    // Only bail out completely if ALL tables fail (network / config problem).
    const allResults = [
      rolesRes, countriesRes, holidaysRes, skillsRes, systemsRes,
      teamMembersRes, projectsRes, timeOffRes, settingsRes,
      sprintsRes, jiraConnectionsRes, jiraWorkItemsRes, scenariosRes,
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

    const teamMembers: TeamMember[] = (teamMembersRes.data ?? []).map(m => ({
      id: m.id,
      name: m.name,
      role: m.role ?? '',
      countryId: m.country_id ?? '',
      skillIds: Array.isArray(m.skill_ids) ? m.skill_ids : [],
      maxConcurrentProjects: m.max_concurrent_projects ?? 2,
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
    }));

    const timeOff: TimeOff[] = (timeOffRes.data ?? []).map(t => ({
      id: t.id,
      memberId: t.member_id,
      quarter: t.quarter,
      days: Number(t.days),
      reason: t.reason ?? undefined,
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
      labels: Array.isArray(w.labels) ? w.labels : [],
      components: Array.isArray(w.components) ? w.components : [],
      created: w.created,
      updated: w.updated,
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

    // Settings are stored as key-value pairs in the settings table
    const settingsMap = Object.fromEntries(
      (settingsRes.data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])
    );
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...((settingsMap.settings as Partial<Settings>) ?? {}),
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
      teamMembers,
      projects,
      timeOff,
      quarters: generateQuarters(8),
      sprints,
      jiraConnections,
      jiraWorkItems,
      scenarios,
      activeScenarioId,
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
    ['team_members',     syncTeamMembers(state.teamMembers)],
    ['projects',         syncProjects(state.projects)],
    ['time_off',         syncTimeOff(state.timeOff)],
    ['sprints',          syncSprints(state.sprints)],
    ['jira_connections', syncJiraConnections(state.jiraConnections)],
    ['jira_work_items',  syncJiraWorkItems(state.jiraWorkItems)],
    ['scenarios',        syncScenarios(state.scenarios)],
    ['settings',         syncSettings(state.settings, state.jiraSettings, state.activeScenarioId)],
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

async function syncTeamMembers(members: TeamMember[]): Promise<void> {
  await upsertAndPrune(
    'team_members',
    members,
    m => ({
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
    }),
    // Soft-delete: mark as inactive rather than deleting, in case data is needed
    async (idsToRemove) => {
      if (idsToRemove.length > 0) {
        await supabase
          .from('team_members')
          .update({ is_active: false })
          .in('id', idsToRemove);
      }
    }
  );
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
    })
  );
}

async function syncTimeOff(timeOff: TimeOff[]): Promise<void> {
  // Ensure every entry has an id
  const withIds = timeOff.map(t => ({
    ...t,
    id: t.id ?? `timeoff-${t.memberId}-${t.quarter}`.replace(/\s/g, '-'),
  }));
  await upsertAndPrune(
    'time_off',
    withIds,
    t => ({
      id: t.id,
      member_id: t.memberId,
      quarter: t.quarter,
      days: t.days,
      reason: t.reason ?? null,
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
      labels: w.labels,
      components: w.components,
      created: w.created,
      updated: w.updated,
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
    const stateToSave = pendingState;
    pendingState = null;

    try {
      await saveToSupabase(stateToSave);
      onStatus('saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Sync] Save failed:', msg);
      onStatus('error', msg);
    }
  }, 1500);
}
