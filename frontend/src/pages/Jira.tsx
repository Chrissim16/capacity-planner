import { useState, useMemo } from 'react';
import {
  Link2, Search, ExternalLink, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, FolderOpen, Layers, Zap, Edit2, X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { useAppStore } from '../stores/appStore';
import { updateJiraWorkItemMapping, clearJiraWorkItemMappings } from '../stores/actions';
import type { JiraWorkItem, JiraItemType, Project } from '../types';

const typeColors: Record<JiraItemType, string> = {
  epic:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  feature: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  story:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  task:    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  bug:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const statusCategoryColors: Record<string, string> = {
  todo:        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  done:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

// ─────────────────────────────────────────────────────────────────────────────

export function Jira() {
  const state = useAppStore((s) => s.data);
  const { jiraWorkItems, jiraConnections, projects, teamMembers } = state;

  const [search, setSearch]               = useState('');
  const [filterIssueType, setFilterIssueType] = useState<JiraItemType | 'all'>('all');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(['__unmatched__']));
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const autoEnabled = jiraConnections.some(c => c.isActive && c.autoCreateProjects);
  const activeConnection = jiraConnections.find(c => c.isActive);

  // ── Filtered items ────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    return jiraWorkItems.filter(item => {
      if (search) {
        const q = search.toLowerCase();
        if (!item.summary.toLowerCase().includes(q) && !item.jiraKey.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterIssueType !== 'all' && item.type !== filterIssueType) return false;
      return true;
    });
  }, [jiraWorkItems, search, filterIssueType]);

  // ── Group by mapped project ───────────────────────────────────────────────

  const { projectGroups, unmatchedItems } = useMemo(() => {
    const byProject = new Map<string, JiraWorkItem[]>();
    const unmatched: JiraWorkItem[] = [];

    for (const item of filteredItems) {
      if (item.mappedProjectId) {
        const list = byProject.get(item.mappedProjectId) ?? [];
        list.push(item);
        byProject.set(item.mappedProjectId, list);
      } else {
        unmatched.push(item);
      }
    }

    // Sort each project group: epics/features first, then stories/tasks/bugs
    const order: Record<JiraItemType, number> = { epic: 0, feature: 1, story: 2, task: 3, bug: 4 };
    const sort = (items: JiraWorkItem[]) =>
      [...items].sort((a, b) => (order[a.type] ?? 5) - (order[b.type] ?? 5));

    const groups: { projectId: string; project: Project; items: JiraWorkItem[] }[] = [];
    for (const [projectId, items] of byProject.entries()) {
      const project = projects.find(p => p.id === projectId);
      if (project) groups.push({ projectId, project, items: sort(items) });
    }
    groups.sort((a, b) => a.project.name.localeCompare(b.project.name));

    return { projectGroups: groups, unmatchedItems: sort(unmatched) };
  }, [filteredItems, projects]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total   = jiraWorkItems.length;
    const matched = jiraWorkItems.filter(i => i.mappedProjectId).length;
    return { total, matched, unmatched: total - matched };
  }, [jiraWorkItems]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const connectionBaseUrls = useMemo(() =>
    Object.fromEntries(jiraConnections.map(c => [c.id, c.jiraBaseUrl.replace(/\/+$/, '')])),
    [jiraConnections]
  );

  const projectOptions = [
    { value: '', label: 'Not mapped' },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ];

  const getPhaseOptions = (projectId: string | undefined) => {
    if (!projectId) return [{ value: '', label: 'Select project first' }];
    const project = projects.find(p => p.id === projectId);
    if (!project) return [{ value: '', label: 'No phases' }];
    return [
      { value: '', label: 'Not mapped' },
      ...project.phases.map(ph => ({ value: ph.id, label: ph.name })),
    ];
  };

  const memberOptions = [
    { value: '', label: 'Not assigned' },
    ...teamMembers.map(m => ({ value: m.id, label: m.name })),
  ];

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkClearMapping = () => {
    clearJiraWorkItemMappings(Array.from(selectedItems));
    setSelectedItems(new Set());
  };

  // ── Empty state ───────────────────────────────────────────────────────────

  if (jiraWorkItems.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <Link2 className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              No Jira Items Synced
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Go to Settings → Jira Integration, configure your connection and click Sync.
              Projects and phases will be created automatically.
            </p>
            <Button onClick={() => useAppStore.getState().setCurrentView('settings')}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jira Overview</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
            Items synced from Jira, organised by project
          </p>
        </div>
        {activeConnection?.lastSyncAt && (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Last sync: {new Date(activeConnection.lastSyncAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Auto-import info banner */}
      {autoEnabled && (
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
          <Zap size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-300">
              Auto-import is active
            </p>
            <p className="text-blue-600 dark:text-blue-400 mt-0.5">
              Projects and phases are created automatically from Jira epics and features each time you sync.
              Items are shown below grouped by their auto-created project.
              Use the edit icon (<Edit2 size={12} className="inline" />) to override a mapping for a specific item.
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Total items synced</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Placed in a project</div>
        </Card>
        <Card className={clsx('p-4', stats.unmatched > 0 && 'border-amber-200 dark:border-amber-700/50')}>
          <div className={clsx('text-2xl font-bold', stats.unmatched > 0 ? 'text-amber-600' : 'text-slate-400')}>
            {stats.unmatched}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {stats.unmatched > 0 ? 'Need attention' : 'All placed'}
          </div>
        </Card>
      </div>

      {/* Search + filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by key or summary…"
                className="pl-9"
              />
            </div>
            <Select
              value={filterIssueType}
              onChange={e => setFilterIssueType(e.target.value as JiraItemType | 'all')}
              options={[
                { value: 'all',     label: 'All Types' },
                { value: 'epic',    label: 'Epics' },
                { value: 'feature', label: 'Features' },
                { value: 'story',   label: 'Stories' },
                { value: 'task',    label: 'Tasks' },
                { value: 'bug',     label: 'Bugs' },
              ]}
            />
          </div>

          {selectedItems.size > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </span>
              <Button variant="ghost" size="sm" onClick={handleBulkClearMapping}>
                <X className="w-4 h-4 mr-1" />Clear mapping
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
                Deselect all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Project groups ─────────────────────────────────────────────────── */}
      {projectGroups.map(({ projectId, project, items }) => (
        <ProjectGroup
          key={projectId}
          groupId={projectId}
          title={project.name}
          icon={<FolderOpen size={16} className="text-slate-500 dark:text-slate-400" />}
          items={items}
          projects={projects}
          expanded={expandedProjects.has(projectId)}
          onToggle={() => toggleProject(projectId)}
          editingItemId={editingItemId}
          onEditItem={setEditingItemId}
          projectOptions={projectOptions}
          getPhaseOptions={getPhaseOptions}
          memberOptions={memberOptions}
          connectionBaseUrls={connectionBaseUrls}
          selectedItems={selectedItems}
          onToggleSelect={toggleSelectItem}
        />
      ))}

      {/* ── Unmatched items ────────────────────────────────────────────────── */}
      {unmatchedItems.length > 0 && (
        <ProjectGroup
          groupId="__unmatched__"
          title="Unmatched Items"
          subtitle={
            autoEnabled
              ? 'These items have no epic/feature parent in Jira, so they could not be auto-placed. Assign them manually if needed.'
              : 'These items are not yet linked to a project. Use the dropdowns to map them.'
          }
          icon={<AlertCircle size={16} className="text-amber-500" />}
          items={unmatchedItems}
          projects={projects}
          expanded={expandedProjects.has('__unmatched__')}
          onToggle={() => toggleProject('__unmatched__')}
          editingItemId={editingItemId}
          onEditItem={setEditingItemId}
          projectOptions={projectOptions}
          getPhaseOptions={getPhaseOptions}
          memberOptions={memberOptions}
          connectionBaseUrls={connectionBaseUrls}
          selectedItems={selectedItems}
          onToggleSelect={toggleSelectItem}
          alwaysShowControls
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectGroup
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectGroupProps {
  groupId: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  items: JiraWorkItem[];
  projects: Project[];
  expanded: boolean;
  onToggle: () => void;
  editingItemId: string | null;
  onEditItem: (id: string | null) => void;
  projectOptions: { value: string; label: string }[];
  getPhaseOptions: (pid: string | undefined) => { value: string; label: string }[];
  memberOptions: { value: string; label: string }[];
  connectionBaseUrls: Record<string, string>;
  selectedItems: Set<string>;
  onToggleSelect: (id: string) => void;
  alwaysShowControls?: boolean;
}

function ProjectGroup({
  groupId, title, subtitle, icon, items, projects, expanded, onToggle,
  editingItemId, onEditItem, projectOptions, getPhaseOptions, memberOptions,
  connectionBaseUrls, selectedItems, onToggleSelect, alwaysShowControls = false,
}: ProjectGroupProps) {
  // Group items further by phase within this project
  const phases = useMemo(() => {
    const project = projects.find(p => p.id === groupId);
    const byPhase = new Map<string, JiraWorkItem[]>();
    const noPhase: JiraWorkItem[] = [];
    for (const item of items) {
      if (item.mappedPhaseId) {
        const list = byPhase.get(item.mappedPhaseId) ?? [];
        list.push(item);
        byPhase.set(item.mappedPhaseId, list);
      } else {
        noPhase.push(item);
      }
    }
    const result: { phaseId: string; phaseName: string; items: JiraWorkItem[] }[] = [];
    for (const [phaseId, phaseItems] of byPhase.entries()) {
      const phase = project?.phases.find(ph => ph.id === phaseId);
      result.push({ phaseId, phaseName: phase?.name ?? phaseId, items: phaseItems });
    }
    result.sort((a, b) => a.phaseName.localeCompare(b.phaseName));
    if (noPhase.length) result.push({ phaseId: '__none__', phaseName: 'No phase', items: noPhase });
    return result;
  }, [items, projects, groupId]);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {expanded
              ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            }
            {icon}
            <div className="min-w-0">
              <CardTitle className="truncate">{title}</CardTitle>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">{subtitle}</p>
              )}
            </div>
          </div>
          <Badge variant="default" className="shrink-0 ml-2">{items.length}</Badge>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-2">
          {phases.map(({ phaseId, phaseName, items: phaseItems }) => (
            <div key={phaseId} className="mb-4 last:mb-0">
              {/* Phase sub-header (only when there's more than one phase, or it's a real phase) */}
              {(phases.length > 1 || phaseId !== '__none__') && (
                <div className="flex items-center gap-2 px-2 py-1 mb-1">
                  <Layers size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {phaseName}
                  </span>
                  <span className="text-xs text-slate-400">({phaseItems.length})</span>
                </div>
              )}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
                {phaseItems.map(item => (
                  <JiraItemRow
                    key={item.id}
                    item={item}
                    isSelected={selectedItems.has(item.id)}
                    onToggleSelect={() => onToggleSelect(item.id)}
                    isEditing={editingItemId === item.id}
                    onEdit={() => onEditItem(editingItemId === item.id ? null : item.id)}
                    projectOptions={projectOptions}
                    getPhaseOptions={getPhaseOptions}
                    memberOptions={memberOptions}
                    jiraBaseUrl={connectionBaseUrls[item.connectionId] ?? ''}
                    alwaysShowControls={alwaysShowControls}
                  />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JiraItemRow
// ─────────────────────────────────────────────────────────────────────────────

interface JiraItemRowProps {
  item: JiraWorkItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  isEditing: boolean;
  onEdit: () => void;
  projectOptions: { value: string; label: string }[];
  getPhaseOptions: (pid: string | undefined) => { value: string; label: string }[];
  memberOptions: { value: string; label: string }[];
  jiraBaseUrl: string;
  alwaysShowControls: boolean;
}

function JiraItemRow({
  item, isSelected, onToggleSelect, isEditing, onEdit,
  projectOptions, getPhaseOptions, memberOptions, jiraBaseUrl, alwaysShowControls,
}: JiraItemRowProps) {
  const isMapped = !!item.mappedProjectId;

  const handleMapProject = (projectId: string | undefined) => {
    updateJiraWorkItemMapping(item.id, { mappedProjectId: projectId, mappedPhaseId: undefined });
  };
  const handleMapPhase = (phaseId: string | undefined) => {
    updateJiraWorkItemMapping(item.id, { mappedPhaseId: phaseId });
  };
  const handleMapMember = (memberId: string | undefined) => {
    updateJiraWorkItemMapping(item.id, { mappedMemberId: memberId });
  };

  const showControls = alwaysShowControls || isEditing;

  return (
    <div className={clsx(
      'py-2.5 px-3 flex items-center gap-3 text-sm',
      isSelected && 'bg-blue-50 dark:bg-blue-900/20',
    )}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 shrink-0"
      />

      {isMapped
        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
        : <AlertCircle  className="w-4 h-4 text-amber-500 shrink-0" />
      }

      <Badge className={clsx('shrink-0 text-xs', typeColors[item.type])}>
        {item.typeName}
      </Badge>

      {/* Key + summary */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <a
            href={`${jiraBaseUrl}/browse/${item.jiraKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            {item.jiraKey}
            <ExternalLink className="w-3 h-3" />
          </a>
          <Badge className={clsx('text-xs', statusCategoryColors[item.statusCategory])} variant="default">
            {item.status}
          </Badge>
          {item.storyPoints != null && (
            <span className="text-xs text-slate-400">{item.storyPoints} SP</span>
          )}
        </div>
        <div className="text-slate-700 dark:text-slate-300 truncate mt-0.5">{item.summary}</div>
        {item.assigneeName && !showControls && (
          <div className="text-xs text-slate-400 mt-0.5">Assignee: {item.assigneeName}</div>
        )}
      </div>

      {/* Edit override button (only for already-mapped items) */}
      {!alwaysShowControls && (
        <button
          onClick={onEdit}
          className="shrink-0 p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={isEditing ? 'Close' : 'Override mapping'}
        >
          {isEditing ? <X size={14} /> : <Edit2 size={14} />}
        </button>
      )}

      {/* Mapping controls (unmatched items always, matched items only in edit mode) */}
      {showControls && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Select
            value={item.mappedProjectId || ''}
            onChange={e => handleMapProject(e.target.value || undefined)}
            options={projectOptions}
            className="text-xs w-44"
          />
          {item.mappedProjectId && (
            <Select
              value={item.mappedPhaseId || ''}
              onChange={e => handleMapPhase(e.target.value || undefined)}
              options={getPhaseOptions(item.mappedProjectId)}
              className="text-xs w-40"
            />
          )}
          <Select
            value={item.mappedMemberId || ''}
            onChange={e => handleMapMember(e.target.value || undefined)}
            options={memberOptions}
            className="text-xs w-36"
          />
        </div>
      )}
    </div>
  );
}
