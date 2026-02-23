/**
 * Jira Sync Dashboard
 *
 * US-057 / US-058: The Jira tab is now a read-only overview of what has been
 * synced from Jira.  All mapping/planning happens automatically via
 * autoCreateProjects + autoCreateAssignments, or in the Epics tab.
 *
 * Manual mapping dropdowns have been removed.  The only user action here is
 * "Auto-link now" which runs buildProjectsFromJira on already-synced items
 * without triggering a full Jira API fetch.
 */
import { useState, useMemo } from 'react';
import {
  Link2, RefreshCw, Zap, AlertCircle, CheckCircle2,
  ChevronDown, ChevronRight, ExternalLink, Settings,
  FolderKanban, GitBranch, EyeOff, Eye,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { JiraHierarchyTree } from '../components/JiraHierarchyTree';
import { useCurrentState, useAppStore } from '../stores/appStore';
import { autoLinkNow } from '../application/jiraSync';
import type { JiraItemType } from '../types';

// ─── type-badge colours (reused from JiraHierarchyTree) ──────────────────────
const TYPE_COUNT_COLORS: Record<JiraItemType, string> = {
  epic:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  feature: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300',
  story:   'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300',
  task:    'bg-cyan-100   text-cyan-700   dark:bg-cyan-900/30   dark:text-cyan-300',
  bug:     'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-300',
};

// ─────────────────────────────────────────────────────────────────────────────

export function Jira() {
  const state = useCurrentState();
  const { jiraWorkItems, jiraConnections, projects, jiraSettings } = state;
  const setView = useAppStore(s => s.setCurrentView);

  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [autoLinkMsg, setAutoLinkMsg] = useState<Record<string, string>>({});
  const [autoLinking, setAutoLinking] = useState<string | null>(null);
  const [hideClosedEpics, setHideClosedEpics] = useState(true);

  const activeConnection = jiraConnections.find(c => c.isActive);
  const activeBaseUrl = activeConnection?.jiraBaseUrl.replace(/\/+$/, '') ?? '';

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const counts: Partial<Record<JiraItemType, number>> = {};
    let linked = 0;
    for (const item of jiraWorkItems) {
      counts[item.type] = (counts[item.type] ?? 0) + 1;
      if (item.mappedProjectId) linked++;
    }
    return { total: jiraWorkItems.length, linked, unlinked: jiraWorkItems.length - linked, counts };
  }, [jiraWorkItems]);

  // ── Group items: by epic subtree + leftover ───────────────────────────────

  const { epicGroups, unlinkedItems } = useMemo(() => {
    // Collect all keys in a given subtree
    const subtree = (rootKey: string): Set<string> => {
      const ids = new Set<string>();
      const queue = [rootKey];
      const seen = new Set<string>();
      while (queue.length) {
        const k = queue.shift()!;
        if (seen.has(k)) continue;
        seen.add(k);
        for (const item of jiraWorkItems) {
          if (item.parentKey === k) { ids.add(item.id); queue.push(item.jiraKey); }
        }
      }
      return ids;
    };

    const epics = jiraWorkItems.filter(i => i.type === 'epic');
    const assignedIds = new Set<string>();

    const groups = epics.map(epic => {
      const children = [...subtree(epic.jiraKey)].map(id => jiraWorkItems.find(i => i.id === id)!).filter(Boolean);
      children.forEach(i => assignedIds.add(i.id));
      assignedIds.add(epic.id);
      return { epic, items: [epic, ...children] };
    });

    const leftover = jiraWorkItems.filter(i => !assignedIds.has(i.id));
    return { epicGroups: groups, unlinkedItems: leftover };
  }, [jiraWorkItems]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const toggleEpic = (key: string) =>
    setExpandedEpics(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleAutoLink = async (connectionId: string) => {
    setAutoLinking(connectionId);
    const jiraSettings = state.jiraSettings;
    const result = autoLinkNow(connectionId, jiraSettings);
    setAutoLinkMsg(prev => ({ ...prev, [connectionId]: result.message }));
    setAutoLinking(null);
  };

  // ── Empty state ───────────────────────────────────────────────────────────

  if (jiraWorkItems.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jira</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Sync status and item overview</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <Link2 className="w-14 h-14 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Jira items synced yet</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto text-sm">
              Go to Settings → Jira Integration, configure a connection and click Sync.
              Epics and features will be created automatically.
            </p>
            <Button onClick={() => setView('settings')}>
              <Settings size={16} />
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jira</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            {stats.total} items synced
            {activeConnection?.lastSyncAt && (
              <> · Last sync: {new Date(activeConnection.lastSyncAt).toLocaleString()}</>
            )}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setView('settings')}>
          <Settings size={15} />
          Manage connections
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.entries(stats.counts) as [JiraItemType, number][])
          .sort(([a], [b]) => {
            const order: JiraItemType[] = ['epic', 'feature', 'story', 'task', 'bug'];
            return order.indexOf(a) - order.indexOf(b);
          })
          .map(([type, count]) => (
            <div key={type} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${TYPE_COUNT_COLORS[type]}`}>
                {type}
              </span>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{count}</span>
            </div>
          ))}
      </div>

      {/* Auto-link banner per connection */}
      {jiraConnections.filter(c => c.isActive).map(conn => (
        <div key={conn.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
          conn.autoCreateProjects
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/50'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50'
        }`}>
          {conn.autoCreateProjects
            ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            : <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          }
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${conn.autoCreateProjects ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
              {conn.autoCreateProjects
                ? `Auto-import active for ${conn.name}`
                : `Auto-import is off for ${conn.name}`}
            </p>
            <p className={`text-xs mt-0.5 ${conn.autoCreateProjects ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {conn.autoCreateProjects
                ? 'Epics and features are created automatically in the planner on every sync. View them in the Epics tab.'
                : 'Enable "Auto-create epics & features" in Settings → Jira Integration to let Jira drive your planner automatically.'}
            </p>
            {autoLinkMsg[conn.id] && (
              <p className="text-xs mt-1 font-medium text-slate-700 dark:text-slate-300">{autoLinkMsg[conn.id]}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAutoLink(conn.id)}
              disabled={autoLinking === conn.id}
            >
              {autoLinking === conn.id
                ? <><RefreshCw size={13} className="animate-spin mr-1" />Linking…</>
                : <><Zap size={13} className="mr-1" />Auto-link now</>}
            </Button>
          </div>
        </div>
      ))}

      {/* Items — grouped by epic, read-only tree */}
      {epicGroups.length > 0 && (() => {
        const closedCount = epicGroups.filter(g => g.epic.statusCategory === 'done').length;
        const visibleGroups = hideClosedEpics
          ? epicGroups.filter(g => g.epic.statusCategory !== 'done')
          : epicGroups;
        return (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Items by Epic ({visibleGroups.length}{hideClosedEpics && closedCount > 0 ? ` of ${epicGroups.length}` : ''})
            </p>
            {closedCount > 0 && (
              <button
                type="button"
                onClick={() => setHideClosedEpics(h => !h)}
                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {hideClosedEpics
                  ? <><Eye size={13} /> Show {closedCount} closed</>
                  : <><EyeOff size={13} /> Hide {closedCount} closed</>
                }
              </button>
            )}
          </div>
          {visibleGroups.map(({ epic, items }) => {
            const project = projects.find(p => p.jiraSourceKey === epic.jiraKey || p.id === epic.mappedProjectId);
            const isOpen = expandedEpics.has(epic.jiraKey);
            return (
              <Card key={epic.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => toggleEpic(epic.jiraKey)}
                >
                  <button className="shrink-0 text-slate-400">
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${TYPE_COUNT_COLORS['epic']}`}>Epic</span>
                  <a
                    href={`${activeBaseUrl}/browse/${epic.jiraKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-500 hover:underline flex items-center gap-0.5 shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    {epic.jiraKey}<ExternalLink size={10} />
                  </a>
                  <span className={`text-sm font-medium truncate flex-1 ${epic.statusCategory === 'done' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {epic.summary}
                  </span>
                  {epic.statusCategory === 'done' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">Closed</span>
                  )}
                  {project && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                      <FolderKanban size={12} />
                      {project.name}
                    </span>
                  )}
                  <Badge variant="default" className="shrink-0 text-xs">{items.length - 1} items</Badge>
                </div>
                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
                    <JiraHierarchyTree
                      items={items.filter(i => i.id !== epic.id)}
                      jiraBaseUrl={activeBaseUrl}
                      readOnly
                      defaultCollapsedDepth={2}
                      defaultConfidenceLevel={jiraSettings.defaultConfidenceLevel ?? 'medium'}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        );
      })()}

      {/* Unlinked items — no epic parent */}
      {unlinkedItems.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-700/50">
          <div className="px-4 py-3 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {unlinkedItems.length} item{unlinkedItems.length !== 1 ? 's' : ''} with no epic parent
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                These items exist in Jira but are not connected to any synced epic.
                The table below shows what parent key is stored — if it doesn't match
                the epic key above, re-sync to pull the latest parent data.
              </p>
            </div>
          </div>

          {/* Diagnostic table — shows stored parentKey so we can spot mismatches */}
          <div className="border-t border-amber-100 dark:border-amber-800/30 px-4 py-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-amber-100 dark:border-amber-800/30">
                  <th className="pb-1.5 pr-4 font-medium">Key</th>
                  <th className="pb-1.5 pr-4 font-medium">Type</th>
                  <th className="pb-1.5 pr-4 font-medium">Summary</th>
                  <th className="pb-1.5 font-medium">Stored parentKey</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50 dark:divide-amber-900/20">
                {unlinkedItems.map(item => (
                  <tr key={item.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                    <td className="py-1.5 pr-4">
                      <a
                        href={`${activeBaseUrl}/browse/${item.jiraKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-500 hover:underline flex items-center gap-0.5"
                      >
                        {item.jiraKey}<ExternalLink size={9} />
                      </a>
                    </td>
                    <td className="py-1.5 pr-4">
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${TYPE_COUNT_COLORS[item.type]}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {item.summary}
                    </td>
                    <td className="py-1.5">
                      {item.parentKey ? (
                        <span className="font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                          {item.parentKey}
                          <span className="ml-1.5 text-amber-500 dark:text-amber-500 font-sans font-normal">
                            (epic not synced?)
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">none — Epic Link field empty in Jira</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Go to Epics CTA */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <GitBranch size={16} className="text-slate-400 shrink-0" />
        <p className="text-sm text-slate-600 dark:text-slate-400 flex-1">
          View capacity assignments, features, and team allocations in the <strong>Epics</strong> tab.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setView('projects')}>
          Go to Epics →
        </Button>
      </div>

    </div>
  );
}
