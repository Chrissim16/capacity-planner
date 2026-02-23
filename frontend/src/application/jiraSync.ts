/**
 * Application layer: Jira sync use cases.
 *
 * Orchestrates the fetch → diff → apply flow without knowing anything about
 * React component state or UI rendering. Components call these functions and
 * react to the returned values to update their own UI state.
 */

import type { JiraConnection, JiraSettings, JiraSyncDiff } from '../types';
import { fetchJiraIssues, refreshItemStatuses } from '../services/jira';
import {
  computeSyncDiff,
  syncJiraWorkItems,
  setJiraConnectionSyncStatus,
  syncTeamMembersFromJira,
  updateJiraConnection,
} from '../stores/actions';
import { buildProjectsFromJira, buildAssignmentsFromJira } from './jiraProjectBuilder';
import { useAppStore } from '../stores/appStore';

export interface FetchPreviewResult {
  diff: JiraSyncDiff | null;
  error: string | null;
  empty: boolean;
}

/**
 * Step 1 of the sync flow: fetch from Jira and compute what would change.
 * Does NOT modify any local data.
 * Sets the connection's sync status to 'syncing' while in flight, and to
 * 'error' if the fetch fails. On success it leaves the status as 'syncing'
 * so the caller can decide whether to apply or cancel.
 */
export async function fetchSyncPreview(
  connection: JiraConnection,
  settings: JiraSettings,
  onProgress: (message: string) => void
): Promise<FetchPreviewResult> {
  setJiraConnectionSyncStatus(connection.id, 'syncing');

  try {
    const result = await fetchJiraIssues(connection, settings, onProgress);

    if (result.success && result.items && result.items.length > 0) {
      // Persist the discovered story points field ID so future syncs skip the lookup
      if (result.discoveredStoryPointsFieldId) {
        updateJiraConnection(connection.id, { storyPointsFieldId: result.discoveredStoryPointsFieldId });
      }

      const initialDiff = computeSyncDiff(connection.id, result.items);

      // Refresh stale items (mapped items no longer in the main JQL) so their
      // real current status is fetched directly and included in the sync.
      let fetchedItems = result.items;
      if (initialDiff.toKeepStale.length > 0) {
        onProgress?.(`Refreshing ${initialDiff.toKeepStale.length} stale item(s)…`);
        const staleKeys = initialDiff.toKeepStale.map(i => i.jiraKey);
        const knownSpField = result.discoveredStoryPointsFieldId ?? connection.storyPointsFieldId;
        const refreshed = await refreshItemStatuses(connection, staleKeys, knownSpField);
        if (refreshed.length > 0) {
          // Merge refreshed items into the fetched list so they become normal updates
          const refreshedIds = new Set(refreshed.map(i => i.jiraId));
          fetchedItems = [...result.items.filter(i => !refreshedIds.has(i.jiraId)), ...refreshed];
        }
      }

      const diff = computeSyncDiff(connection.id, fetchedItems);
      return { diff, error: null, empty: false };
    }

    if (result.success) {
      // Jira returned OK but matched no issues with the current filters
      setJiraConnectionSyncStatus(connection.id, 'success');
      return { diff: null, error: null, empty: true };
    }

    const error = result.errors.join(', ');
    setJiraConnectionSyncStatus(connection.id, 'error', error);
    return { diff: null, error: result.errors[0] || 'Sync failed', empty: false };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    setJiraConnectionSyncStatus(connection.id, 'error', error);
    return { diff: null, error, empty: false };
  }
}

export interface ApplySyncResult {
  message: string;
}

/**
 * Step 2 of the sync flow: apply a previously computed diff.
 * Updates local work items (preserving mappings), syncs team members from
 * assignees, auto-creates Projects/Phases/Assignments when the connection
 * has autoCreateProjects / autoCreateAssignments enabled.
 */
export function applySync(diff: JiraSyncDiff, connection: JiraConnection, settings: JiraSettings): ApplySyncResult {
  const { connectionId, fetchedItems } = diff;

  // 1. Merge work items (preserves existing mappings)
  const syncResult = syncJiraWorkItems(connectionId, fetchedItems, settings);

  // 2. Sync team members from assignees (existing behaviour)
  const teamSyncResult = syncTeamMembersFromJira();

  // 3. Auto-build projects/phases if enabled
  let projectsCreated = 0;
  let projectsUpdated = 0;
  let assignmentsCreated = 0;

  if (connection.autoCreateProjects) {
    const state = useAppStore.getState().getCurrentState();
    // Use the freshly-merged work items (mappings now set)
    const mergedItems = state.jiraWorkItems.filter(i => i.connectionId === connectionId);

    const projectResult = buildProjectsFromJira(
      mergedItems,
      connection,
      state.projects,
      state.sprints
    );
    projectsCreated = projectResult.projectsCreated;
    projectsUpdated = projectResult.projectsUpdated;

    // Persist updated projects and work-item mappings
    useAppStore.getState().updateData({
      projects: projectResult.projects,
      jiraWorkItems: [
        ...state.jiraWorkItems.filter(i => i.connectionId !== connectionId),
        ...projectResult.workItems,
      ],
    });

    // 4. Auto-build assignments if enabled
    if (connection.autoCreateAssignments) {
      const freshState = useAppStore.getState().getCurrentState();
      const assignResult = buildAssignmentsFromJira(
        projectResult.workItems,
        freshState.teamMembers,
        freshState.projects,
        freshState.sprints,
        settings,
        connection.defaultDaysPerItem ?? 1
      );
      assignmentsCreated = assignResult.assignmentsCreated;
      useAppStore.getState().updateData({ projects: assignResult.projects });
    }
  }

  setJiraConnectionSyncStatus(connectionId, 'success', undefined, {
    timestamp: new Date().toISOString(),
    status: 'success',
    itemsSynced: syncResult.itemsSynced,
    itemsCreated: syncResult.itemsCreated,
    itemsUpdated: syncResult.itemsUpdated,
    itemsRemoved: syncResult.itemsRemoved,
    mappingsPreserved: syncResult.mappingsPreserved,
  });

  let message = `Synced ${syncResult.itemsSynced} items (${syncResult.itemsCreated} new, ${syncResult.itemsUpdated} updated`;
  if (syncResult.itemsRemoved > 0) message += `, ${syncResult.itemsRemoved} removed`;
  message += `)`;
  if (projectsCreated > 0) message += ` · ${projectsCreated} project(s) created`;
  if (projectsUpdated > 0) message += `, ${projectsUpdated} updated`;
  if (assignmentsCreated > 0) message += ` · ${assignmentsCreated} assignment(s) suggested`;
  if (teamSyncResult.created > 0) message += ` · ${teamSyncResult.created} team member(s) imported`;

  return { message };
}

/**
 * On-demand auto-link: run buildProjectsFromJira against already-synced items for a
 * connection without doing a full Jira API fetch. Useful when autoCreateProjects was
 * off during the last sync, or when items arrived without a parent epic in Jira.
 * Returns a human-readable result message.
 */
export function autoLinkNow(connectionId: string, _settings: JiraSettings): ApplySyncResult {
  const state = useAppStore.getState().getCurrentState();
  const connection = state.jiraConnections.find(c => c.id === connectionId);
  if (!connection) return { message: 'Connection not found' };

  const items = state.jiraWorkItems.filter(i => i.connectionId === connectionId);
  if (items.length === 0) return { message: 'No synced items found — run a sync first' };

  const result = buildProjectsFromJira(items, connection, state.projects, state.sprints);

  useAppStore.getState().updateData({
    projects: result.projects,
    jiraWorkItems: [
      ...state.jiraWorkItems.filter(i => i.connectionId !== connectionId),
      ...result.workItems,
    ],
  });

  const parts: string[] = [];
  if (result.projectsCreated > 0) parts.push(`${result.projectsCreated} epic(s) created`);
  if (result.projectsUpdated > 0) parts.push(`${result.projectsUpdated} updated`);
  if (parts.length === 0) parts.push('All items already linked — no changes needed');

  return { message: parts.join(', ') };
}

/**
 * Manually trigger assignment-building for a connection's already-synced work items.
 * Useful when autoCreateAssignments was off during a previous sync or story points changed.
 */
export function buildAssignmentsNow(connectionId: string, settings: JiraSettings): ApplySyncResult {
  const state = useAppStore.getState().getCurrentState();
  const connection = state.jiraConnections.find(c => c.id === connectionId);
  if (!connection) return { message: 'Connection not found' };

  const items = state.jiraWorkItems.filter(i => i.connectionId === connectionId);
  if (items.length === 0) return { message: 'No synced items found — run a Jira sync first' };

  const result = buildAssignmentsFromJira(
    items,
    state.teamMembers,
    state.projects,
    state.sprints,
    settings,
    connection.defaultDaysPerItem ?? 1
  );
  useAppStore.getState().updateData({ projects: result.projects });

  return {
    message: result.assignmentsCreated > 0
      ? `${result.assignmentsCreated} assignment(s) built from Jira assignees`
      : 'No new assignments — check that work items have assignees and sprint names',
  };
}
