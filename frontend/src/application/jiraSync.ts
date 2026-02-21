/**
 * Application layer: Jira sync use cases.
 *
 * Orchestrates the fetch → diff → apply flow without knowing anything about
 * React component state or UI rendering. Components call these functions and
 * react to the returned values to update their own UI state.
 */

import type { JiraConnection, JiraSettings, JiraSyncDiff } from '../types';
import { fetchJiraIssues } from '../services/jira';
import {
  computeSyncDiff,
  syncJiraWorkItems,
  setJiraConnectionSyncStatus,
  syncTeamMembersFromJira,
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
      const diff = computeSyncDiff(connection.id, result.items);
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
  const syncResult = syncJiraWorkItems(connectionId, fetchedItems);

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
        settings
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
