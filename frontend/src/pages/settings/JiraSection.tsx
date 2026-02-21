import { useState } from 'react';
import {
  Plus, Trash2, Edit2, RefreshCw, Loader2, Power, Download, Link2, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { JiraConnectionForm } from '../../components/forms/JiraConnectionForm';
import { useCurrentState } from '../../stores/appStore';
import {
  addJiraConnection, updateJiraConnection, deleteJiraConnection,
  toggleJiraConnectionActive, updateJiraSettings,
} from '../../stores/actions';
import { testJiraConnection } from '../../services/jira';
import { fetchSyncPreview, applySync } from '../../application/jiraSync';
import { useToast } from '../../components/ui/Toast';
import type { JiraConnection, JiraSyncDiff } from '../../types';

export function JiraSection() {
  const { jiraConnections, jiraSettings } = useCurrentState();
  const { showToast } = useToast();

  // Connection modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<JiraConnection | undefined>();

  // Per-connection UI state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState('');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Sync diff preview (US-007)
  const [pendingDiff, setPendingDiff] = useState<JiraSyncDiff | null>(null);

  // Sequential sync-all queue
  const [syncAllQueue, setSyncAllQueue] = useState<string[]>([]);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveConn = (data: Omit<JiraConnection, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingConn) {
      updateJiraConnection(editingConn.id, data);
      showToast('Connection updated', 'success');
    } else {
      addJiraConnection(data);
      showToast('Connection added', 'success');
    }
    setModalOpen(false);
    setEditingConn(undefined);
  };

  const handleTest = async (conn: JiraConnection) => {
    setTestingId(conn.id);
    const result = await testJiraConnection(conn.jiraBaseUrl, conn.userEmail, conn.apiToken);
    if (result.success) {
      updateJiraConnection(conn.id, { lastSyncStatus: 'success', lastSyncError: undefined });
      showToast('Connection successful', 'success');
    } else {
      updateJiraConnection(conn.id, { lastSyncStatus: 'error', lastSyncError: result.error });
      showToast(result.error || 'Connection failed', 'error');
    }
    setTestingId(null);
  };

  // Step 1: fetch from Jira and compute diff → show preview modal (uses application layer)
  const handleSync = async (conn: JiraConnection) => {
    setSyncingId(conn.id);
    setSyncProgress('Fetching from Jira…');

    const { diff, error, empty } = await fetchSyncPreview(conn, jiraSettings, setSyncProgress);

    setSyncingId(null);
    setSyncProgress('');

    if (diff) {
      setPendingDiff(diff);
    } else if (empty) {
      showToast('No items found matching your sync settings', 'info');
    } else if (error) {
      showToast(error, 'error');
    }
  };

  const handleSyncAll = async () => {
    const active = jiraConnections.filter((c) => c.isActive);
    if (active.length === 0) return;
    const [first, ...rest] = active;
    setSyncAllQueue(rest.map((c) => c.id));
    await handleSync(first);
  };

  const advanceQueue = () => {
    if (syncAllQueue.length === 0) return;
    const [nextId, ...remaining] = syncAllQueue;
    setSyncAllQueue(remaining);
    const next = jiraConnections.find((c) => c.id === nextId);
    if (next) handleSync(next);
  };

  // Step 2: user confirmed the diff → apply via application layer
  const handleConfirmSync = () => {
    if (!pendingDiff) return;
    const conn = jiraConnections.find(c => c.id === pendingDiff.connectionId);
    if (!conn) return;
    const { message } = applySync(pendingDiff, conn, jiraSettings);
    showToast(message, 'success');
    setPendingDiff(null);
    advanceQueue();
  };

  const handleCancelSync = () => {
    setPendingDiff(null);
    advanceQueue();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Connections card */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Jira Connections</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Connect to Jira Cloud to sync your work items</p>
              </div>
              <div className="flex items-center gap-2">
                {jiraConnections.filter((c) => c.isActive).length > 1 && (
                  <Button variant="secondary" onClick={handleSyncAll} disabled={!!syncingId}>
                    <Download className="w-4 h-4 mr-2" />
                    Sync All ({jiraConnections.filter((c) => c.isActive).length})
                  </Button>
                )}
                <Button onClick={() => { setEditingConn(undefined); setModalOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />Add Connection
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {jiraConnections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No Jira connections configured</p>
                <p className="text-sm">Click "Add Connection" to connect to your Jira instance</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jiraConnections.map((conn) => (
                  <div key={conn.id} className="rounded-lg border bg-card overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${conn.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <div className="font-medium">{conn.name}</div>
                          <div className="text-sm text-muted-foreground">{conn.jiraBaseUrl} &bull; {conn.jiraProjectKey}</div>
                          {conn.lastSyncAt && (
                            <div className="text-xs text-muted-foreground">
                              Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        {conn.lastSyncStatus === 'success' && <Badge variant="success">Connected</Badge>}
                        {conn.lastSyncStatus === 'error' && <Badge variant="danger">Error</Badge>}
                        {conn.lastSyncStatus === 'syncing' && <Badge variant="warning">Syncing…</Badge>}
                        {conn.lastSyncError && (
                          <span className="text-xs text-red-500 max-w-xs truncate" title={conn.lastSyncError}>
                            {conn.lastSyncError}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleTest(conn)} disabled={testingId === conn.id} title="Test connection">
                          {testingId === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => handleSync(conn)} disabled={syncingId === conn.id || !conn.isActive}>
                          {syncingId === conn.id
                            ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />{syncProgress || 'Fetching…'}</>
                            : <><Download className="w-4 h-4 mr-1" />Sync</>}
                        </Button>
                        {(conn.syncHistory?.length ?? 0) > 0 && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setExpandedHistoryId(expandedHistoryId === conn.id ? null : conn.id)}
                            title="Sync history"
                          >
                            <span className="text-xs">History ({conn.syncHistory!.length})</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => { setEditingConn(conn); setModalOpen(true); }} title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={conn.isActive ? 'ghost' : 'secondary'} size="sm"
                          onClick={() => { toggleJiraConnectionActive(conn.id); showToast('Connection toggled', 'info'); }}
                          title={conn.isActive ? 'Disable' : 'Enable'}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteConfirm({ id: conn.id, name: conn.name })}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Sync history panel (US-011) */}
                    {expandedHistoryId === conn.id && conn.syncHistory && conn.syncHistory.length > 0 && (
                      <div className="border-t bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Sync History (last {conn.syncHistory.length})
                        </p>
                        <div className="space-y-1.5">
                          {conn.syncHistory.map((entry, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${entry.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="text-slate-500 dark:text-slate-400 w-36 shrink-0">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                              {entry.status === 'success' ? (
                                <span className="text-slate-700 dark:text-slate-300">
                                  {entry.itemsSynced} synced — {entry.itemsCreated} new, {entry.itemsUpdated} updated, {entry.itemsRemoved} removed
                                  {entry.mappingsPreserved > 0 && `, ${entry.mappingsPreserved} mappings kept`}
                                </span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">{entry.error || 'Failed'}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync settings card */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Settings</CardTitle>
            <p className="text-sm text-muted-foreground">Configure how items are synced from Jira</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium">Issue Types &amp; Status Filters</label>
              <p className="text-xs text-muted-foreground mb-3">
                Choose which types to sync and which statuses to include for each.
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground w-8"></th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status filter</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell text-xs">Resulting JQL clause</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      { syncKey: 'syncEpics',    filterKey: 'statusFilterEpics',    label: 'Epics',    color: 'text-purple-600' },
                      { syncKey: 'syncFeatures', filterKey: 'statusFilterFeatures', label: 'Features', color: 'text-blue-600'   },
                      { syncKey: 'syncStories',  filterKey: 'statusFilterStories',  label: 'Stories',  color: 'text-green-600'  },
                      { syncKey: 'syncTasks',    filterKey: 'statusFilterTasks',    label: 'Tasks',    color: 'text-cyan-600'   },
                      { syncKey: 'syncBugs',     filterKey: 'statusFilterBugs',     label: 'Bugs',     color: 'text-red-600'    },
                    ].map(({ syncKey, filterKey, label, color }) => {
                      const enabled = jiraSettings[syncKey as keyof typeof jiraSettings] as boolean;
                      const filter = (jiraSettings[filterKey as keyof typeof jiraSettings] ?? 'all') as string;
                      const clauseHint: Record<string, string> = {
                        all: 'all statuses',
                        exclude_done: 'statusCategory != "Done"',
                        active_only: 'statusCategory in ("To Do", "In Progress")',
                        todo_only: 'statusCategory = "To Do"',
                      };
                      return (
                        <tr key={syncKey} className={!enabled ? 'opacity-40' : ''}>
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => updateJiraSettings({ [syncKey]: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className={`px-4 py-2.5 font-medium ${color}`}>{label}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={filter}
                              disabled={!enabled}
                              onChange={(e) => updateJiraSettings({ [filterKey]: e.target.value })}
                              className="text-sm border border-input rounded px-2 py-1 bg-background disabled:cursor-not-allowed"
                            >
                              <option value="all">All statuses</option>
                              <option value="exclude_done">Exclude Done</option>
                              <option value="active_only">Active only (To Do + In Progress)</option>
                              <option value="todo_only">To Do only</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {clauseHint[filter]}
                            </code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium">Story Points to Days</label>
                <p className="text-xs text-muted-foreground mb-2">1 story point = X days of work</p>
                <Input
                  type="number" step="0.1" min="0.1" max="5"
                  value={jiraSettings.storyPointsToDays}
                  onChange={(e) => updateJiraSettings({ storyPointsToDays: parseFloat(e.target.value) || 0.5 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Default Velocity</label>
                <p className="text-xs text-muted-foreground mb-2">Story points per sprint (used for estimates)</p>
                <Input
                  type="number" min="1" max="200"
                  value={jiraSettings.defaultVelocity}
                  onChange={(e) => updateJiraSettings({ defaultVelocity: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={jiraSettings.autoMapByName}
                onChange={(e) => updateJiraSettings({ autoMapByName: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium">Auto-map by name</span>
              <span className="text-xs text-muted-foreground">
                Automatically match Jira items to projects/phases by similar names
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Mapping reference card */}
        <Card>
          <CardHeader><CardTitle>Mapping Reference</CardTitle></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="font-medium text-blue-600">Jira Epic</div>
                <div className="text-muted-foreground">maps to</div>
                <div className="font-medium">Capacity Planner Project</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="font-medium text-purple-600">Jira Feature</div>
                <div className="text-muted-foreground">maps to</div>
                <div className="font-medium">Capacity Planner Phase</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="font-medium text-green-600">Jira Story/Task/Bug</div>
                <div className="text-muted-foreground">maps to</div>
                <div className="font-medium">Work Item (time tracking)</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              <ExternalLink className="w-3 h-3 inline mr-1" />
              Items synced from Jira can be mapped to your existing projects and phases.
              Story points and time tracking data will be used for capacity calculations.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {/* US-007: Sync diff preview */}
      <Modal
        isOpen={!!pendingDiff}
        onClose={handleCancelSync}
        title="Jira Sync Preview"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCancelSync}>Cancel</Button>
            <Button onClick={handleConfirmSync}><Download size={16} />Apply Sync</Button>
          </>
        }
      >
        {pendingDiff && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Review the changes below before applying. Your local mappings will <strong>not</strong> be affected.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <strong>{pendingDiff.toAdd.length}</strong> new items to add
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <strong>{pendingDiff.toUpdate.length}</strong> existing items to update
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${pendingDiff.toRemove.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                <span className={`w-2 h-2 rounded-full ${pendingDiff.toRemove.length > 0 ? 'bg-red-500' : 'bg-slate-400'}`} />
                <strong>{pendingDiff.toRemove.length}</strong> items no longer in Jira
              </div>
              {pendingDiff.mappingsToPreserve > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-sm">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <strong>{pendingDiff.mappingsToPreserve}</strong> local mappings will be kept
                </div>
              )}
            </div>
            {pendingDiff.toRemove.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Items that will be removed:</p>
                <ul className="space-y-1">
                  {pendingDiff.toRemove.slice(0, 10).map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <span className="font-mono text-xs bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded">{item.jiraKey}</span>
                      <span className="truncate">{item.summary}</span>
                      {item.mappedProjectId && <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">⚠ mapped</span>}
                    </li>
                  ))}
                  {pendingDiff.toRemove.length > 10 && (
                    <li className="text-xs text-red-500">… and {pendingDiff.toRemove.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
            {pendingDiff.toAdd.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">New items (first 5):</p>
                <ul className="space-y-1">
                  {pendingDiff.toAdd.slice(0, 5).map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-mono text-xs bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded text-green-700 dark:text-green-300">{item.jiraKey}</span>
                      <span className="truncate">{item.summary}</span>
                    </li>
                  ))}
                  {pendingDiff.toAdd.length > 5 && <li className="text-xs text-slate-400">… and {pendingDiff.toAdd.length - 5} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add/Edit connection */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingConn(undefined); }}
        title={editingConn ? 'Edit Jira Connection' : 'Add Jira Connection'}
        size="lg"
      >
        <JiraConnectionForm
          connection={editingConn}
          onSave={handleSaveConn}
          onCancel={() => { setModalOpen(false); setEditingConn(undefined); }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Connection"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteJiraConnection(deleteConfirm!.id); setDeleteConfirm(null); }}>Delete</Button>
          </>
        }
      >
        <p>Delete connection <strong>{deleteConfirm?.name}</strong>? All synced work items for this connection will also be removed.</p>
      </Modal>
    </>
  );
}
