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
  safeguardPortfolioScenariosForRemovedItems,
  syncJiraWorkItems,
  setJiraConnectionSyncStatus,
  syncTeamMembersFromJira,
} from '../stores/actions';

export interface FetchPreviewResult {
  diff: JiraSyncDiff | null;
  error: string | null;
  empty: boolean;
}

/**
 * Step 1 of the sync flow: fetch from Jira and compute what would change.
 * Does NOT modify any local data.
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
 * Upserts JiraWorkItems and syncs team members from Jira assignees.
 */
export function applySync(diff: JiraSyncDiff): ApplySyncResult {
  const { connectionId, fetchedItems } = diff;
  const safeguardResult = safeguardPortfolioScenariosForRemovedItems(diff.toRemove);

  const syncResult = syncJiraWorkItems(connectionId, fetchedItems);
  const teamSyncResult = syncTeamMembersFromJira();

  setJiraConnectionSyncStatus(connectionId, 'success', undefined, {
    timestamp: new Date().toISOString(),
    status: 'success',
    itemsSynced: syncResult.itemsSynced,
    itemsCreated: syncResult.itemsCreated,
    itemsUpdated: syncResult.itemsUpdated,
    itemsRemoved: syncResult.itemsRemoved,
  });

  let message = `Synced ${syncResult.itemsSynced} items (${syncResult.itemsCreated} new, ${syncResult.itemsUpdated} updated`;
  if (syncResult.itemsRemoved > 0) message += `, ${syncResult.itemsRemoved} removed`;
  message += `)`;
  if (teamSyncResult.created > 0) message += ` · ${teamSyncResult.created} team member(s) imported`;
  if (safeguardResult.scenariosUpdated > 0) {
    message += ` · safeguarded ${safeguardResult.scenariosUpdated} portfolio plan snapshot(s)`;
  }

  return { message };
}
