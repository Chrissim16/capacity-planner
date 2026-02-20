import { useState, useMemo } from 'react';
import {
  Link2, Search, ChevronDown, ChevronRight, ExternalLink,
  CheckCircle2, AlertCircle, Minus, ArrowRight, Sparkles, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { useAppStore } from '../stores/appStore';
import { updateJiraWorkItemMapping, clearJiraWorkItemMappings } from '../stores/actions';
import type { JiraWorkItem, JiraItemType } from '../types';

type FilterType = 'all' | 'mapped' | 'unmapped';
type GroupBy = 'type' | 'status' | 'none';

const typeColors: Record<JiraItemType, string> = {
  epic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  feature: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  story: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  task: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  bug: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const statusCategoryColors: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

export function Jira() {
  const state = useAppStore((s) => s.data);
  const { jiraWorkItems, jiraConnections, projects, teamMembers, jiraSettings } = state;

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterIssueType, setFilterIssueType] = useState<JiraItemType | 'all'>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('type');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['epic', 'feature', 'story']));
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const activeConnection = jiraConnections.find((c) => c.isActive);

  const filteredItems = useMemo(() => {
    return jiraWorkItems.filter((item) => {
      if (search && !item.summary.toLowerCase().includes(search.toLowerCase()) && 
          !item.jiraKey.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filterType === 'mapped' && !item.mappedProjectId) return false;
      if (filterType === 'unmapped' && item.mappedProjectId) return false;
      if (filterIssueType !== 'all' && item.type !== filterIssueType) return false;
      return true;
    });
  }, [jiraWorkItems, search, filterType, filterIssueType]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, JiraWorkItem[]> = {};
    
    if (groupBy === 'none') {
      groups['All Items'] = filteredItems;
    } else if (groupBy === 'type') {
      for (const item of filteredItems) {
        const key = item.type;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }
    } else if (groupBy === 'status') {
      for (const item of filteredItems) {
        const key = item.statusCategory;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }
    }
    
    return groups;
  }, [filteredItems, groupBy]);

  const stats = useMemo(() => {
    const total = jiraWorkItems.length;
    const mapped = jiraWorkItems.filter((i) => i.mappedProjectId).length;
    const epics = jiraWorkItems.filter((i) => i.type === 'epic').length;
    const features = jiraWorkItems.filter((i) => i.type === 'feature').length;
    const stories = jiraWorkItems.filter((i) => i.type === 'story' || i.type === 'task' || i.type === 'bug').length;
    return { total, mapped, unmapped: total - mapped, epics, features, stories };
  }, [jiraWorkItems]);

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(filteredItems.map((i) => i.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleMapToProject = (itemId: string, projectId: string | undefined) => {
    updateJiraWorkItemMapping(itemId, { mappedProjectId: projectId, mappedPhaseId: undefined });
  };

  const handleMapToPhase = (itemId: string, phaseId: string | undefined) => {
    updateJiraWorkItemMapping(itemId, { mappedPhaseId: phaseId });
  };

  const handleMapToMember = (itemId: string, memberId: string | undefined) => {
    updateJiraWorkItemMapping(itemId, { mappedMemberId: memberId });
  };

  const handleBulkClearMapping = () => {
    if (selectedItems.size === 0) return;
    clearJiraWorkItemMappings(Array.from(selectedItems));
    setSelectedItems(new Set());
  };

  const handleAutoMap = () => {
    if (!jiraSettings.autoMapByName) return;
    
    let mapped = 0;
    for (const item of jiraWorkItems) {
      if (item.mappedProjectId) continue;
      
      if (item.type === 'epic') {
        const matchingProject = projects.find(
          (p) => p.name.toLowerCase().includes(item.summary.toLowerCase()) ||
                 item.summary.toLowerCase().includes(p.name.toLowerCase())
        );
        if (matchingProject) {
          updateJiraWorkItemMapping(item.id, { mappedProjectId: matchingProject.id });
          mapped++;
        }
      }
    }
    
    alert(`Auto-mapped ${mapped} items by name matching.`);
  };

  const projectOptions = [
    { value: '', label: 'Not mapped' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const getPhaseOptions = (projectId: string | undefined) => {
    if (!projectId) return [{ value: '', label: 'Select project first' }];
    const project = projects.find((p) => p.id === projectId);
    if (!project) return [{ value: '', label: 'No phases' }];
    return [
      { value: '', label: 'Not mapped' },
      ...project.phases.map((ph) => ({ value: ph.id, label: ph.name })),
    ];
  };

  const memberOptions = [
    { value: '', label: 'Not mapped' },
    ...teamMembers.map((m) => ({ value: m.id, label: m.name })),
  ];

  // Build a lookup of connectionId → baseUrl for "open in Jira" links
  const connectionBaseUrls = useMemo(() =>
    Object.fromEntries(jiraConnections.map(c => [c.id, c.jiraBaseUrl.replace(/\/+$/, '')])),
    [jiraConnections]
  );

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
              Connect to Jira and sync your issues to see them here. Go to Settings → Jira Integration to configure your connection.
            </p>
            <Button onClick={() => useAppStore.getState().setCurrentView('settings')}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Jira Mapping</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Map Jira items to your projects and phases for capacity tracking
          </p>
        </div>
        {activeConnection && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Connected to: <span className="font-medium">{activeConnection.jiraProjectKey}</span>
            {activeConnection.lastSyncAt && (
              <> · Last sync: {new Date(activeConnection.lastSyncAt).toLocaleString()}</>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Total Items</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.mapped}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Mapped</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.unmapped}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Unmapped</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.epics}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Epics</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.features + stats.stories}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Features/Stories</div>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by key or summary..."
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              options={[
                { value: 'all', label: 'All Items' },
                { value: 'mapped', label: 'Mapped Only' },
                { value: 'unmapped', label: 'Unmapped Only' },
              ]}
            />
            
            <Select
              value={filterIssueType}
              onChange={(e) => setFilterIssueType(e.target.value as JiraItemType | 'all')}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'epic', label: 'Epics' },
                { value: 'feature', label: 'Features' },
                { value: 'story', label: 'Stories' },
                { value: 'task', label: 'Tasks' },
                { value: 'bug', label: 'Bugs' },
              ]}
            />
            
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              options={[
                { value: 'type', label: 'Group by Type' },
                { value: 'status', label: 'Group by Status' },
                { value: 'none', label: 'No Grouping' },
              ]}
            />

            <Button variant="secondary" onClick={handleAutoMap}>
              <Sparkles className="w-4 h-4 mr-2" />
              Auto-Map
            </Button>
          </div>

          {selectedItems.size > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </span>
              <Button variant="ghost" size="sm" onClick={handleBulkClearMapping}>
                <X className="w-4 h-4 mr-1" />
                Clear Mappings
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Deselect All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mapping Legend */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Mapping:</span>
            <div className="flex items-center gap-2">
              <Badge className={typeColors.epic}>Epic</Badge>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>Project</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={typeColors.feature}>Feature</Badge>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>Phase</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={typeColors.story}>Story/Task/Bug</Badge>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span>Team Member</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([group, items]) => (
          <Card key={group}>
            <CardHeader
              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              onClick={() => toggleGroup(group)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedGroups.has(group) ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <CardTitle className="capitalize">{group.replace('_', ' ')}</CardTitle>
                  <Badge variant="default">{items.length}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); selectAll(); }}>
                  Select All
                </Button>
              </div>
            </CardHeader>

            {expandedGroups.has(group) && (
              <CardContent className="pt-0">
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {items.map((item) => (
                    <JiraItemRow
                      key={item.id}
                      item={item}
                      isSelected={selectedItems.has(item.id)}
                      onToggleSelect={() => toggleSelectItem(item.id)}
                      projectOptions={projectOptions}
                      getPhaseOptions={getPhaseOptions}
                      memberOptions={memberOptions}
                      onMapProject={handleMapToProject}
                      onMapPhase={handleMapToPhase}
                      onMapMember={handleMapToMember}
                      projects={projects}
                      jiraBaseUrl={connectionBaseUrls[item.connectionId] || ''}
                    />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

interface JiraItemRowProps {
  item: JiraWorkItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  projectOptions: { value: string; label: string }[];
  getPhaseOptions: (projectId: string | undefined) => { value: string; label: string }[];
  memberOptions: { value: string; label: string }[];
  onMapProject: (itemId: string, projectId: string | undefined) => void;
  onMapPhase: (itemId: string, phaseId: string | undefined) => void;
  onMapMember: (itemId: string, memberId: string | undefined) => void;
  projects: { id: string; name: string; phases: { id: string; name: string }[] }[];
  jiraBaseUrl: string;
}

function JiraItemRow({
  item,
  isSelected,
  onToggleSelect,
  projectOptions,
  getPhaseOptions,
  memberOptions,
  onMapProject,
  onMapPhase,
  onMapMember,
  jiraBaseUrl,
}: JiraItemRowProps) {
  const isMapped = !!item.mappedProjectId || !!item.mappedMemberId;
  
  return (
    <div className={clsx(
      'py-3 flex items-center gap-4',
      isSelected && 'bg-blue-50 dark:bg-blue-900/20 -mx-6 px-6'
    )}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
      />

      {/* Status Icon */}
      <div className="flex-shrink-0">
        {isMapped ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-500" />
        )}
      </div>

      {/* Type Badge */}
      <Badge className={clsx('flex-shrink-0', typeColors[item.type])}>
        {item.typeName}
      </Badge>

      {/* Key & Summary */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={`${jiraBaseUrl}/browse/${item.jiraKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {item.jiraKey}
            <ExternalLink className="w-3 h-3" />
          </a>
          <Badge className={statusCategoryColors[item.statusCategory]} variant="default">
            {item.status}
          </Badge>
          {item.storyPoints && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {item.storyPoints} SP
            </span>
          )}
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-300 truncate">
          {item.summary}
        </div>
        {item.assigneeName && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Assignee: {item.assigneeName}
          </div>
        )}
      </div>

      {/* Mapping Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {(item.type === 'epic') && (
          <Select
            value={item.mappedProjectId || ''}
            onChange={(e) => onMapProject(item.id, e.target.value || undefined)}
            options={projectOptions}
            className="w-48"
          />
        )}

        {(item.type === 'feature') && (
          <>
            <Select
              value={item.mappedProjectId || ''}
              onChange={(e) => onMapProject(item.id, e.target.value || undefined)}
              options={projectOptions}
              className="w-40"
            />
            <Minus className="w-4 h-4 text-slate-400" />
            <Select
              value={item.mappedPhaseId || ''}
              onChange={(e) => onMapPhase(item.id, e.target.value || undefined)}
              options={getPhaseOptions(item.mappedProjectId)}
              className="w-40"
              disabled={!item.mappedProjectId}
            />
          </>
        )}

        {(item.type === 'story' || item.type === 'task' || item.type === 'bug') && (
          <>
            <Select
              value={item.mappedProjectId || ''}
              onChange={(e) => onMapProject(item.id, e.target.value || undefined)}
              options={projectOptions}
              className="w-36"
            />
            <Select
              value={item.mappedMemberId || ''}
              onChange={(e) => onMapMember(item.id, e.target.value || undefined)}
              options={memberOptions}
              className="w-36"
            />
          </>
        )}
      </div>
    </div>
  );
}
