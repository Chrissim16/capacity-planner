import { useState } from 'react';
import {
  Plus, Trash2, Edit2, RefreshCw, Loader2, Power, Download, Link2, Zap, ChevronDown, ChevronRight, Search, CheckCircle, AlertCircle, Copy,
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
import { testJiraConnection, buildJQL, getJiraIssueTypes, diagnoseJiraKey } from '../../services/jira';
import type { JiraIssueType, JiraKeyDiagnostic } from '../../services/jira';
import { fetchSyncPreview, applySync, buildAssignmentsNow } from '../../application/jiraSync';
import { useToast } from '../../components/ui/Toast';
import type { JiraConnection, JiraSyncDiff } from '../../types';

export function JiraSection() {
  const { jiraConnections, jiraSettings, jiraWorkItems } = useCurrentState();
  const { showToast } = useToast();

  // Connection modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<JiraConnection | undefined>();

  // Per-connection UI state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState('');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [expandedSettingsId, setExpandedSettingsId] = useState<string | null>(null);

  // Sync diff preview (US-007)
  const [pendingDiff, setPendingDiff] = useState<JiraSyncDiff | null>(null);

  // Sequential sync-all queue
  const [syncAllQueue, setSyncAllQueue] = useState<string[]>([]);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Issue type checker
  const [issueTypeCheckConnId, setIssueTypeCheckConnId] = useState<string | null>(null);
  const [issueTypeCheckLoading, setIssueTypeCheckLoading] = useState(false);
  const [issueTypeCheckResult, setIssueTypeCheckResult] = useState<JiraIssueType[] | null>(null);
  const [issueTypeCheckError, setIssueTypeCheckError] = useState<string | null>(null);

  // Key lookup diagnostic
  const [keyLookupInput, setKeyLookupInput] = useState('');
  const [keyLookupLoading, setKeyLookupLoading] = useState(false);
  const [keyLookupResult, setKeyLookupResult] = useState<JiraKeyDiagnostic | null>(null);
  const [keyLookupError, setKeyLookupError] = useState<string | null>(null);

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

  const handleBuildAssignments = (conn: JiraConnection) => {
    setBuildingId(conn.id);
    const { message } = buildAssignmentsNow(conn.id, jiraSettings);
    showToast(message, 'success');
    setBuildingId(null);
  };

  const handleCheckIssueTypes = async (conn: JiraConnection) => {
    setIssueTypeCheckConnId(conn.id);
    setIssueTypeCheckLoading(true);
    setIssueTypeCheckResult(null);
    setIssueTypeCheckError(null);
    const result = await getJiraIssueTypes(conn);
    setIssueTypeCheckLoading(false);
    if (result.success && result.issueTypes) {
      setIssueTypeCheckResult(result.issueTypes);
    } else {
      setIssueTypeCheckError(result.error || 'Failed to fetch issue types');
    }
  };

  const handleKeyLookup = async () => {
    const key = keyLookupInput.trim().toUpperCase();
    if (!key) return;
    const conn = jiraConnections.find(c => c.isActive);
    if (!conn) { setKeyLookupError('No active Jira connection'); return; }
    setKeyLookupLoading(true);
    setKeyLookupResult(null);
    setKeyLookupError(null);
    const result = await diagnoseJiraKey(conn, key, jiraSettings);
    setKeyLookupLoading(false);
    if (result.success && result.data) {
      setKeyLookupResult(result.data);
    } else {
      setKeyLookupError(result.error || 'Lookup failed');
    }
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
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setExpandedSettingsId(expandedSettingsId === conn.id ? null : conn.id)}
                          title="Automation settings"
                        >
                          {expandedSettingsId === conn.id
                            ? <><ChevronDown className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Settings</span></>
                            : <><ChevronRight className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Settings</span></>}
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

                    {/* Automation settings panel */}
                    {expandedSettingsId === conn.id && (
                      <div className="border-t bg-slate-50 dark:bg-slate-800/50 px-4 py-4 space-y-4">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Automation Settings
                        </p>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={conn.autoCreateProjects}
                            onChange={(e) => updateJiraConnection(conn.id, { autoCreateProjects: e.target.checked })}
                            className="mt-0.5 rounded border-gray-300"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Auto-create epics &amp; features</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              When syncing, automatically create or update Epics and Features in the planner based on Jira epics and features.
                            </p>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={conn.autoCreateAssignments}
                            onChange={(e) => updateJiraConnection(conn.id, { autoCreateAssignments: e.target.checked })}
                            className="mt-0.5 rounded border-gray-300"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Auto-build capacity assignments</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              When syncing, create capacity allocations for team members based on their Jira assignments and story points.
                            </p>
                          </div>
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              Fallback days per item
                            </label>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Days to allocate for items without story points.
                            </p>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max="30"
                            step="0.5"
                            value={conn.defaultDaysPerItem}
                            onChange={(e) => updateJiraConnection(conn.id, { defaultDaysPerItem: parseFloat(e.target.value) || 1 })}
                            className="w-20 text-sm border border-input rounded px-2 py-1 bg-background text-right"
                          />
                        </div>
                        <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleBuildAssignments(conn)}
                            disabled={buildingId === conn.id}
                          >
                            {buildingId === conn.id
                              ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Building…</>
                              : <><Zap className="w-4 h-4 mr-1" />Build assignments from Jira now</>}
                          </Button>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                            Builds capacity assignments from already-synced items without running a full sync.
                          </p>
                        </div>
                      </div>
                    )}

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

            {/* Generated JQL preview */}
            {jiraConnections.filter(c => c.isActive).length > 0 && (
              <div>
                <label className="text-sm font-medium">Generated JQL (for active connections)</label>
                <p className="text-xs text-muted-foreground mb-2">
                  This is the exact query sent to Jira. Copy it into Jira's issue navigator to verify which items are in scope.
                </p>
                <div className="space-y-2">
                  {jiraConnections.filter(c => c.isActive).map(conn => {
                    const jql = buildJQL(conn, jiraSettings);
                    return (
                      <div key={conn.id} className="rounded-lg border bg-slate-50 dark:bg-slate-800/60 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{conn.name} ({conn.jiraProjectKey})</span>
                          <button
                            type="button"
                            onClick={() => jql && navigator.clipboard.writeText(jql)}
                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                            title="Copy JQL"
                          >
                            <Copy size={12} /> Copy
                          </button>
                        </div>
                        <code className="text-xs text-slate-700 dark:text-slate-300 break-all whitespace-pre-wrap">
                          {jql ?? '(no issue types enabled)'}
                        </code>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                Automatically match Jira items to epics/features by similar names
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Key lookup diagnostic */}
        {jiraConnections.filter(c => c.isActive).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Key Lookup Diagnostic</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter a Jira key to see exactly how it would be linked in the sync — what parent fields Jira returns,
                whether it exists in the local store, and what <code className="bg-muted px-1 rounded text-xs">parentKey</code> would be stored.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={keyLookupInput}
                  onChange={e => setKeyLookupInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleKeyLookup()}
                  placeholder="e.g. ERP-3647"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
                <Button onClick={handleKeyLookup} disabled={keyLookupLoading || !keyLookupInput.trim()}>
                  {keyLookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </Button>
              </div>
              {keyLookupError && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle size={14} /> {keyLookupError}
                </div>
              )}
              {keyLookupResult && (() => {
                const d = keyLookupResult;
                const localItem = jiraWorkItems?.find(i => i.jiraKey === d.key);
                const SYNCED_NAMES = new Set(['Epic', 'Feature', 'Story', 'Task', 'Bug']);
                const settings = jiraSettings;
                const typeEnabled =
                  (d.typeName === 'Epic' && settings.syncEpics) ||
                  (d.typeName === 'Feature' && settings.syncFeatures) ||
                  (d.typeName === 'Story' && settings.syncStories) ||
                  (d.typeName === 'Task' && settings.syncTasks) ||
                  (d.typeName === 'Bug' && settings.syncBugs);
                const typeSupported = SYNCED_NAMES.has(d.typeName);

                return (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/60 overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground w-48">Key</td>
                            <td className="px-4 py-2.5 font-mono font-semibold">{d.key}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground">Summary</td>
                            <td className="px-4 py-2.5 truncate max-w-xs">{d.summary}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground">Type</td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono">{d.typeName}</span>
                              {' '}
                              {!typeSupported
                                ? <span className="text-xs text-red-500 ml-1">not a supported type name</span>
                                : !typeEnabled
                                  ? <span className="text-xs text-amber-500 ml-1">disabled in settings</span>
                                  : <span className="text-xs text-green-600 ml-1">✓ enabled</span>
                              }
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground">Status</td>
                            <td className="px-4 py-2.5">
                              {d.statusName}
                              <span className="text-xs text-muted-foreground ml-1">({d.statusCategory})</span>
                            </td>
                          </tr>
                          <tr className={!d.parentKey ? 'bg-amber-50 dark:bg-amber-900/20' : ''}>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground">parent.key (hierarchy)</td>
                            <td className="px-4 py-2.5 font-mono">
                              {d.parentKey
                                ? <span className="text-green-700 dark:text-green-400">{d.parentKey}</span>
                                : <span className="text-slate-400 italic">not set</span>}
                            </td>
                          </tr>
                          <tr className={!d.cf10014 ? 'opacity-60' : ''}>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground">customfield_10014 (Epic Link)</td>
                            <td className="px-4 py-2.5 font-mono">
                              {d.cf10014
                                ? <span className="text-blue-700 dark:text-blue-400">{d.cf10014}</span>
                                : <span className="text-slate-400 italic">not set</span>}
                            </td>
                          </tr>
                          <tr className={!d.cf10008 ? 'opacity-60' : ''}>
                            <td className="px-4 py-2.5 font-medium text-muted-foreground">customfield_10008 (alt. Epic Link)</td>
                            <td className="px-4 py-2.5 font-mono">
                              {d.cf10008
                                ? <span className="text-blue-700 dark:text-blue-400">{d.cf10008}</span>
                                : <span className="text-slate-400 italic">not set</span>}
                            </td>
                          </tr>
                          <tr className="bg-slate-100 dark:bg-slate-700/50">
                            <td className="px-4 py-2.5 font-semibold">Resolved parentKey (what sync stores)</td>
                            <td className="px-4 py-2.5 font-mono font-semibold">
                              {d.resolvedParentKey
                                ? <span className="text-indigo-700 dark:text-indigo-300">{d.resolvedParentKey}</span>
                                : <span className="text-red-500 italic">none — would be unlinked</span>}
                            </td>
                          </tr>
                          {d.matchedByKeyOnly !== undefined && (
                            <tr className={d.matchedByKeyOnly ? '' : 'bg-red-50 dark:bg-red-900/20'}>
                              <td className="px-4 py-2.5 font-medium text-muted-foreground">
                                Test 0: bare key
                                {d.testStatuses && <span className="ml-1 text-slate-400">HTTP {d.testStatuses.keyOnly}</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs">
                                <code className="bg-muted px-1 rounded">{`key = "${d.key}"`}</code>
                                {' → '}
                                {d.matchedByKeyOnly
                                  ? <span className="text-green-600">✓ found — API token can see this issue</span>
                                  : <span className="text-red-600 font-semibold">✗ NOT FOUND — API token cannot see this issue at all (security level or permissions)</span>}
                              </td>
                            </tr>
                          )}
                          {d.matchedByProjectOnly !== undefined && (
                            <tr className={d.matchedByProjectOnly ? '' : 'bg-red-50 dark:bg-red-900/20'}>
                              <td className="px-4 py-2.5 font-medium text-muted-foreground">Test 1: project only
                                {d.testStatuses && <span className="ml-1 text-slate-400">HTTP {d.testStatuses.projectOnly}</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs">
                                <code className="bg-muted px-1 rounded">{`project = "${d.key.split('-')[0]}" AND key = "${d.key}"`}</code>
                                {' → '}
                                {d.matchedByProjectOnly
                                  ? <span className="text-green-600">✓ found</span>
                                  : <span className="text-red-600 font-semibold">✗ NOT FOUND — wrong project key in connection settings</span>}
                              </td>
                            </tr>
                          )}
                          {d.matchedByProjectAndType !== undefined && (
                            <tr className={d.matchedByProjectAndType ? '' : 'bg-red-50 dark:bg-red-900/20'}>
                              <td className="px-4 py-2.5 font-medium text-muted-foreground">Test 2: project + type
                                {d.testStatuses && <span className="ml-1 text-slate-400">HTTP {d.testStatuses.projectAndType}</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs">
                                <code className="bg-muted px-1 rounded">{`... AND issuetype = "${d.typeName}"`}</code>
                                {' → '}
                                {d.matchedByProjectAndType
                                  ? <span className="text-green-600">✓ found</span>
                                  : <span className="text-red-600 font-semibold">✗ NOT FOUND — type name mismatch in JQL</span>}
                              </td>
                            </tr>
                          )}
                          {d.matchedByJql !== undefined && (
                            <tr className={d.matchedByJql ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}>
                              <td className="px-4 py-2.5 font-semibold">Test 3: full sync JQL
                                {d.testStatuses && <span className="ml-1 font-normal text-slate-400">HTTP {d.testStatuses.fullJql}</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                {d.matchedByJql
                                  ? <span className="flex items-center gap-1 text-green-700 dark:text-green-400 text-xs font-medium"><CheckCircle size={12} /> Matched — item IS in scope</span>
                                  : <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium"><AlertCircle size={12} /> NOT matched — status filter is excluding this item</span>
                                }
                              </td>
                            </tr>
                          )}
                          {d.jqlUsed && (
                            <tr>
                              <td className="px-4 py-2.5 font-medium text-muted-foreground">JQL used for test</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-start gap-2">
                                  <code className="text-xs break-all text-slate-600 dark:text-slate-400 flex-1">{d.jqlUsed}</code>
                                  <button type="button" onClick={() => navigator.clipboard.writeText(d.jqlUsed!)} className="shrink-0 text-blue-500 hover:text-blue-700" title="Copy JQL">
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {d.jqlTotal !== undefined && (
                            <tr className={d.jqlTotal >= 5000 ? 'bg-amber-50 dark:bg-amber-900/20' : ''}>
                              <td className="px-4 py-2.5 font-medium text-muted-foreground">Total items in JQL scope</td>
                              <td className="px-4 py-2.5">
                                <span className={`font-mono font-semibold ${d.jqlTotal >= 5000 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {d.jqlTotal.toLocaleString()}
                                </span>
                                {d.jqlTotal >= 5000 && (
                                  <span className="text-xs text-amber-600 ml-2">⚠ at or above Jira's 5,000-item limit — older items will be cut off</span>
                                )}
                              </td>
                            </tr>
                          )}
                          <tr className={!localItem ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}>
                            <td className="px-4 py-2.5 font-semibold">In local sync store?</td>
                            <td className="px-4 py-2.5">
                              {localItem
                                ? <span className="flex items-center gap-1 text-green-700 dark:text-green-400 text-xs font-medium">
                                    <CheckCircle size={12} /> Yes — stored parentKey: <code className="font-mono ml-1">{localItem.parentKey ?? 'none'}</code>
                                  </span>
                                : <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-medium">
                                    <AlertCircle size={12} /> Not in local store — run a sync to fetch it
                                  </span>
                              }
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {d.resolvedParentKey && d.resolvedParentKey !== 'ERP-3394' && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200">
                        <strong>The resolved parent key is not ERP-3394.</strong>
                        {' '}Jira is linking this item to <code className="font-mono">{d.resolvedParentKey}</code> rather than ERP-3394.
                        This is what Jira's API returns — the hierarchy in the planner will reflect this.
                      </div>
                    )}
                    {!d.resolvedParentKey && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-xs text-red-800 dark:text-red-200">
                        <strong>No parent key found in any field.</strong>
                        {' '}This item will appear as an unlinked item after sync. In Jira, ensure it has a parent set
                        (in a next-gen project) or an Epic Link (in a classic project).
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Issue type checker */}
        {jiraConnections.filter(c => c.isActive).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Issue Type Checker</CardTitle>
              <p className="text-sm text-muted-foreground">
                Fetch the actual issue type names from your Jira project and compare them against
                the five names the sync queries (<code className="bg-muted px-1 rounded text-xs">Epic, Feature, Story, Task, Bug</code>).
                If any items are missing, a type name mismatch is likely the cause.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {jiraConnections.filter(c => c.isActive).map(conn => (
                  <Button
                    key={conn.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCheckIssueTypes(conn)}
                    disabled={issueTypeCheckLoading && issueTypeCheckConnId === conn.id}
                  >
                    {issueTypeCheckLoading && issueTypeCheckConnId === conn.id
                      ? <><Loader2 size={14} className="animate-spin mr-1" />Fetching…</>
                      : <><Search size={14} className="mr-1" />Check {conn.jiraProjectKey}</>}
                  </Button>
                ))}
              </div>
              {issueTypeCheckError && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle size={14} /> {issueTypeCheckError}
                </div>
              )}
              {issueTypeCheckResult && (() => {
                const SYNCED_NAMES = new Set(['Epic', 'Feature', 'Story', 'Task', 'Bug']);
                const conn = jiraConnections.find(c => c.id === issueTypeCheckConnId);
                const jql = conn ? buildJQL(conn, jiraSettings) : null;
                const enabledNames = new Set<string>();
                if (jiraSettings.syncEpics)    enabledNames.add('Epic');
                if (jiraSettings.syncFeatures) enabledNames.add('Feature');
                if (jiraSettings.syncStories)  enabledNames.add('Story');
                if (jiraSettings.syncTasks)    enabledNames.add('Task');
                if (jiraSettings.syncBugs)     enabledNames.add('Bug');
                return (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Project: <strong>{conn?.jiraProjectKey}</strong> — {issueTypeCheckResult.length} issue type(s) found
                    </p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Jira Type Name</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sub-task?</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sync status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {issueTypeCheckResult.map(t => {
                            const inEnabled = enabledNames.has(t.name);
                            const inSupported = SYNCED_NAMES.has(t.name);
                            return (
                              <tr key={t.id}>
                                <td className="px-4 py-2.5 font-mono text-xs font-medium">{t.name}</td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.subtask ? 'Yes' : 'No'}</td>
                                <td className="px-4 py-2.5">
                                  {inEnabled
                                    ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> Will be synced</span>
                                    : inSupported
                                      ? <span className="flex items-center gap-1 text-amber-600 text-xs"><AlertCircle size={12} /> Supported but disabled (turn on in settings)</span>
                                      : <span className="flex items-center gap-1 text-red-500 text-xs"><AlertCircle size={12} /> Not supported — type name doesn't match</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {issueTypeCheckResult.some(t => !SYNCED_NAMES.has(t.name)) && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200">
                        <strong>Types not matching the 5 supported names will never be synced.</strong>
                        {' '}Use the <em>Additional JQL filter</em> field in your connection settings to narrow scope,
                        or check in Jira what exact type ERP-3423, ERP-2841, ERP-3647 are assigned.
                      </div>
                    )}
                    {jql && (
                      <div className="text-xs text-muted-foreground">
                        Current query: <code className="bg-muted px-1 rounded">{jql}</code>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* How auto-import works */}
        <Card>
          <CardHeader><CardTitle>How Auto-Import Works</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="font-medium text-purple-600">Jira Epic</div>
                <div className="text-muted-foreground text-xs mt-0.5">becomes</div>
                <div className="font-medium">→ Epic</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="font-medium text-blue-600">Jira Feature</div>
                <div className="text-muted-foreground text-xs mt-0.5">becomes</div>
                <div className="font-medium">→ Feature within its Epic</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="font-medium text-green-600">Story / Task / Bug</div>
                <div className="text-muted-foreground text-xs mt-0.5">drives</div>
                <div className="font-medium">→ Assignment (via story points + sprint)</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Every time you sync, the planner checks whether new epics or features have appeared and creates or updates
              epics and features accordingly. Manually edited epics are never overwritten.
              You can review the result in the <strong>Jira Overview</strong> page.
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
