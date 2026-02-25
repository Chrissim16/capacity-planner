import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Edit2, Trash2, Copy, ExternalLink, UserPlus,
  ChevronDown, ChevronRight, FolderKanban, Filter,
  Archive, ArchiveRestore, StickyNote, Calendar, MoreHorizontal,
  RefreshCw, Zap, AlertCircle, CheckCircle2, Settings, Link2,
  Users, X,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { AvatarStack } from '../components/ui/AvatarStack';
import type { AvatarPerson } from '../components/ui/AvatarStack';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/layout/PageHeader';
import { ProjectForm } from '../components/forms/ProjectForm';
import { AssignmentModal } from '../components/forms/AssignmentModal';
import { useCurrentState, useAppStore } from '../stores/appStore';
import { deleteProject, duplicateProject, archiveProject, unarchiveProject, upsertBusinessAssignment, removeBusinessAssignment, generateId, upsertJiraItemBizAssignment, removeJiraItemBizAssignment } from '../stores/actions';
import { autoLinkNow } from '../application/jiraSync';
import { useToast } from '../components/ui/Toast';
import { calculateCapacity } from '../utils/capacity';
import { getCurrentQuarter } from '../utils/calendar';
import { computeRollup } from '../utils/confidence';
import type { Project, JiraWorkItem, JiraItemType, BusinessAssignment, BusinessContact, JiraItemBizAssignment } from '../types';

export function Projects() {
  const state = useCurrentState();
  const projects = state.projects;
  const systems = state.systems;
  const teamMembers = state.teamMembers;
  const jiraWorkItems = state.jiraWorkItems ?? [];
  const jiraConnections = state.jiraConnections ?? [];
  const jiraSettings = state.jiraSettings;
  const activeConnection = jiraConnections.find(c => c.isActive);
  const activeJiraBaseUrl = activeConnection?.jiraBaseUrl.replace(/\/+$/, '') ?? '';
  const { showToast } = useToast();
  const setView = useAppStore(s => s.setCurrentView);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  // Jira sync section state
  const [showJiraSection, setShowJiraSection] = useState(false);
  const [autoLinkMsg, setAutoLinkMsg] = useState<Record<string, string>>({});
  const [autoLinking, setAutoLinking] = useState<string | null>(null);

  const currentQuarter = getCurrentQuarter();

  useEffect(() => {
    const handler = () => { setEditingProject(null); setIsFormOpen(true); };
    window.addEventListener('keyboard:new', handler);
    return () => window.removeEventListener('keyboard:new', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, view } = (e as CustomEvent).detail;
      if (view !== 'projects') return;
      setExpandedProjects(prev => { const next = new Set(prev); next.add(id); return next; });
      setTimeout(() => {
        document.getElementById(`project-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    };
    window.addEventListener('search:highlight', handler);
    return () => window.removeEventListener('search:highlight', handler);
  }, []);

  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [assignmentContext, setAssignmentContext] = useState<{
    projectId?: string;
    phaseId?: string;
  }>({});

  // BIZ panel state (key = `${projectId}:${phaseId}`)
  const [openBizKey, setOpenBizKey] = useState<string | null>(null);
  const [bizShowAdd, setBizShowAdd] = useState(false);
  const [bizContactId, setBizContactId] = useState('');
  const [bizDays, setBizDays] = useState('');
  const [bizNotes, setBizNotes] = useState('');

  const toggleBizPanel = (projectId: string, phaseId: string) => {
    const key = `${projectId}:${phaseId}`;
    if (openBizKey === key) {
      setOpenBizKey(null);
      setBizShowAdd(false);
    } else {
      setOpenBizKey(key);
      setBizShowAdd(false);
      setBizContactId('');
      setBizDays('');
      setBizNotes('');
    }
  };

  const handleAddBiz = (projectId: string, phaseId: string) => {
    const days = parseFloat(bizDays);
    if (!bizContactId || isNaN(days) || days <= 0) return;
    upsertBusinessAssignment({
      id: generateId('biz-assign'),
      contactId: bizContactId,
      projectId,
      phaseId,
      days,
      notes: bizNotes.trim() || undefined,
    });
    setBizShowAdd(false);
    setBizContactId('');
    setBizDays('');
    setBizNotes('');
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('__open__');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState('');

  const getStatusVariant = (status: string): 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'Active': return 'success';
      case 'On Hold': return 'warning';
      default: return 'default';
    }
  };

  const getPriorityVariant = (_priority: string): 'default' => {
    return 'default';
  };

  const jiraEpicByKey = useMemo(() =>
    new Map(jiraWorkItems.filter(i => i.type === 'epic').map(i => [i.jiraKey, i]))
  , [jiraWorkItems]);

  const filteredProjects = useMemo(() => projects.filter(project => {
    if (!showArchived && project.archived) return false;
    if (showArchived && !project.archived) return false;
    if (search && !project.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === '__open__') {
      if (project.status === 'Completed' || project.status === 'Cancelled') return false;
      const linkedEpic = project.jiraSourceKey ? jiraEpicByKey.get(project.jiraSourceKey) : undefined;
      if (linkedEpic?.statusCategory === 'done') return false;
    }
    if (statusFilter && statusFilter !== '__open__' && project.status !== statusFilter) return false;
    if (priorityFilter && project.priority !== priorityFilter) return false;
    if (systemFilter && !project.systemIds?.includes(systemFilter)) return false;
    return true;
  }), [projects, showArchived, search, statusFilter, priorityFilter, systemFilter, jiraEpicByKey]);

  const archivedCount = useMemo(() => projects.filter(p => p.archived).length, [projects]);

  // ── Jira sync helpers ────────────────────────────────────────────────────

  const jiraStats = useMemo(() => {
    const counts: Partial<Record<JiraItemType, number>> = {};
    let linked = 0;
    for (const item of jiraWorkItems) {
      counts[item.type] = (counts[item.type] ?? 0) + 1;
      if (item.mappedProjectId) linked++;
    }
    return { total: jiraWorkItems.length, linked, unlinked: jiraWorkItems.length - linked, counts };
  }, [jiraWorkItems]);

  const unlinkedOrphanItems = useMemo(() => {
    const epicKeys = new Set(jiraWorkItems.filter(i => i.type === 'epic').map(i => i.jiraKey));
    const subtreeIds = new Set<string>();
    const queue = [...epicKeys];
    const visited = new Set<string>();
    while (queue.length) {
      const k = queue.shift()!;
      if (visited.has(k)) continue;
      visited.add(k);
      for (const item of jiraWorkItems) {
        if (item.parentKey === k) { subtreeIds.add(item.id); queue.push(item.jiraKey); }
      }
    }
    jiraWorkItems.filter(i => i.type === 'epic').forEach(e => subtreeIds.add(e.id));
    return jiraWorkItems.filter(i => !subtreeIds.has(i.id));
  }, [jiraWorkItems]);

  const handleAutoLink = async (connectionId: string) => {
    setAutoLinking(connectionId);
    const result = autoLinkNow(connectionId, jiraSettings);
    setAutoLinkMsg(prev => ({ ...prev, [connectionId]: result.message }));
    setAutoLinking(null);
  };

  // ── Project helpers ──────────────────────────────────────────────────────

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsFormOpen(true);
  };

  const handleDelete = (project: Project) => {
    setDeleteConfirm(project);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const snapshot = JSON.parse(JSON.stringify(state.projects)) as Project[];
    const deletedProject = deleteConfirm;
    deleteProject(deleteConfirm.id);
    setDeleteConfirm(null);
    showToast(`"${deletedProject.name}" deleted`, {
      type: 'warning',
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => {
          useAppStore.getState().updateData({ projects: snapshot });
          showToast('Delete undone', 'success');
        },
      },
    });
  };

  const handleDuplicate = (project: Project) => {
    duplicateProject(project.id);
    showToast(`Duplicated "${project.name}"`, 'success');
  };

  const handleArchive = (project: Project) => {
    archiveProject(project.id);
    showToast(`"${project.name}" archived`, {
      type: 'info',
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          unarchiveProject(project.id);
          showToast('Archive undone', 'success');
        },
      },
    });
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProject(null);
  };

  const toggleExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  const openAssignment = (projectId: string, phaseId?: string) => {
    setAssignmentContext({ projectId, phaseId });
    setIsAssignmentOpen(true);
  };

  const getMemberName = (memberId: string) =>
    teamMembers.find(m => m.id === memberId)?.name ?? 'Unknown';

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatDateRange = (start?: string, end?: string) => {
    if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
    if (start) return `From ${formatDate(start)}`;
    if (end)   return `Until ${formatDate(end)}`;
    return null;
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: '__open__', label: 'Open (not completed)' },
    { value: 'Planning', label: 'Planning' },
    { value: 'Active', label: 'Active' },
    { value: 'On Hold', label: 'On Hold' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'High', label: 'High' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Low', label: 'Low' },
  ];

  const systemOptions = [
    { value: '', label: 'All Systems' },
    ...systems.map(s => ({ value: s.id, label: s.name })),
  ];

  const collectJiraItemsForProject = (project: Project): JiraWorkItem[] => {
    const included = new Set<string>();

    if (project.jiraSourceKey) {
      const queue = [project.jiraSourceKey];
      const visited = new Set<string>();
      while (queue.length > 0) {
        const key = queue.shift()!;
        if (visited.has(key)) continue;
        visited.add(key);
        for (const item of jiraWorkItems) {
          if (item.parentKey === key) {
            included.add(item.id);
            queue.push(item.jiraKey);
          }
        }
      }
    }

    for (const item of jiraWorkItems) {
      if (item.mappedProjectId === project.id) {
        included.add(item.id);
      }
    }

    return jiraWorkItems.filter(i => included.has(i.id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Epics"
        subtitle="Change projects and initiatives"
        actions={
          <div className="flex items-center gap-2">
            {archivedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchived(v => !v)}
              >
                {showArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                {showArchived ? 'Hide archived' : `Archived (${archivedCount})`}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setIsAssignmentOpen(true)}>
              <UserPlus size={16} />
              Assign Team
            </Button>
            <Button onClick={() => { setEditingProject(null); setIsFormOpen(true); }}>
              <Plus size={16} />
              New Epic
            </Button>
          </div>
        }
      />

      {/* ── Jira Sync Strip ───────────────────────────────────────────────── */}
      {jiraWorkItems.length > 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {/* Always-visible summary row */}
          <button
            onClick={() => setShowJiraSection(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
          >
            <Link2 size={15} className="text-blue-500 shrink-0" />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold">{jiraStats.total}</span> Jira items synced
            </span>
            {activeConnection?.lastSyncAt && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                · Last sync {new Date(activeConnection.lastSyncAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {unlinkedOrphanItems.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                {unlinkedOrphanItems.length} orphaned
              </span>
            )}
            <span className="flex-1" />
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${showJiraSection ? 'rotate-180' : ''}`} />
          </button>

          {/* Expandable detail */}
          {showJiraSection && (
            <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3">
              {/* Type counts */}
              <div className="flex flex-wrap gap-2">
                {(Object.entries(jiraStats.counts) as [JiraItemType, number][])
                  .sort(([a], [b]) => {
                    const order: JiraItemType[] = ['epic', 'feature', 'story', 'task', 'bug'];
                    return order.indexOf(a) - order.indexOf(b);
                  })
                  .map(([type, count]) => (
                    <span key={type} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 capitalize">
                      {type}: <span className="font-bold">{count}</span>
                    </span>
                  ))}
              </div>

              {/* Auto-link per connection */}
              {jiraConnections.filter(c => c.isActive).map(conn => (
                <div key={conn.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  conn.autoCreateProjects
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                }`}>
                  {conn.autoCreateProjects
                    ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    : <AlertCircle size={14} className="text-amber-500 shrink-0" />}
                  <span className="flex-1">
                    {conn.autoCreateProjects
                      ? `Auto-import active for ${conn.name}`
                      : `Auto-import off for ${conn.name}`}
                  </span>
                  {autoLinkMsg[conn.id] && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{autoLinkMsg[conn.id]}</span>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAutoLink(conn.id)}
                    disabled={autoLinking === conn.id}
                  >
                    {autoLinking === conn.id
                      ? <><RefreshCw size={12} className="animate-spin mr-1" />Linking…</>
                      : <><Zap size={12} className="mr-1" />Auto-link</>}
                  </Button>
                </div>
              ))}

              {/* Orphaned items */}
              {unlinkedOrphanItems.length > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertCircle size={13} className="text-amber-500" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      {unlinkedOrphanItems.length} item{unlinkedOrphanItems.length !== 1 ? 's' : ''} with no epic parent
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {unlinkedOrphanItems.slice(0, 10).map(item => (
                      <a
                        key={item.id}
                        href={`${activeJiraBaseUrl}/browse/${item.jiraKey}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-mono hover:underline"
                      >
                        {item.jiraKey}
                      </a>
                    ))}
                    {unlinkedOrphanItems.length > 10 && (
                      <span className="text-xs text-amber-500 py-0.5">+{unlinkedOrphanItems.length - 10} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Settings link */}
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setView('settings')}
                  className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors"
                >
                  <Settings size={12} />
                  Manage connections
                </button>
              </div>
            </div>
          )}
        </div>
      ) : jiraConnections.length > 0 ? (
        <button
          onClick={() => setView('settings')}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          <Link2 size={15} />
          No Jira items synced yet — go to Settings to run your first sync
        </button>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search epics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <Select value={statusFilter}   onChange={(e) => setStatusFilter(e.target.value)}   options={statusOptions}   />
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} options={priorityOptions} />
        <Select value={systemFilter}   onChange={(e) => setSystemFilter(e.target.value)}   options={systemOptions}   />
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent>
            {projects.filter(p => !p.archived).length === 0 && !showArchived ? (
              <EmptyState
                icon={FolderKanban}
                title="No epics yet"
                description="Epics group your work into deliverables. Add features inside each epic, then assign team members to plan capacity."
                action={{ label: 'Create first epic', onClick: () => { setEditingProject(null); setIsFormOpen(true); } }}
              />
            ) : (
              <EmptyState
                icon={Filter}
                title="No matches"
                description="No epics match your current filters. Try adjusting your search or filter criteria."
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map(project => {
            const isExpanded = expandedProjects.has(project.id);

            const uniqueMembers = new Map<string, number>();
            project.phases.forEach(ph => {
              ph.assignments.forEach(a => {
                uniqueMembers.set(a.memberId, (uniqueMembers.get(a.memberId) ?? 0) + a.days);
              });
            });

            const jiraItems = collectJiraItemsForProject(project);

            const epicRollup = (() => {
              if (jiraItems.length === 0) return null;
              const rollupMap = computeRollup(
                jiraItems,
                jiraSettings.defaultConfidenceLevel ?? 'medium',
                state.settings.confidenceLevels
              );
              const epicKey = project.jiraSourceKey;
              if (epicKey && rollupMap.has(epicKey)) return rollupMap.get(epicKey)!;
              let raw = 0; let forecasted = 0; let count = 0;
              for (const [, r] of rollupMap) { raw += r.rawDays; forecasted += r.forecastedDays; count += r.itemCount; }
              return count > 0 ? { rawDays: Math.round(raw * 10) / 10, forecastedDays: Math.round(forecasted * 10) / 10, itemCount: count } : null;
            })();

            const jiraFeatureCount = jiraItems.filter(i => i.type === 'feature').length;
            const displayFeatureCount = project.phases.length > 0 ? project.phases.length : jiraFeatureCount;

            const jiraAssigneeNames = new Set(jiraItems.map(i => i.assigneeName).filter(Boolean));
            const displayMemberCount = uniqueMembers.size > 0 ? uniqueMembers.size : jiraAssigneeNames.size;
            const jiraByStatus = jiraItems.reduce<Record<string, number>>((acc, item) => {
              const cat = item.statusCategory ?? 'To Do';
              acc[cat] = (acc[cat] ?? 0) + 1;
              return acc;
            }, {});

            const dateRange = formatDateRange(project.startDate, project.endDate);

            return (
              <Card key={project.id} id={`project-${project.id}`} className="overflow-hidden">
                {/* Project Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => toggleExpanded(project.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button className="p-1 text-slate-400 shrink-0">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                          {project.name}
                        </h3>
                        {project.jiraSourceKey && activeJiraBaseUrl && (
                          <a
                            href={`${activeJiraBaseUrl}/browse/${project.jiraSourceKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-blue-500 hover:text-blue-600 font-mono text-xs shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            title={`Open ${project.jiraSourceKey} in Jira`}
                          >
                            {project.jiraSourceKey}
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                        <span>{displayFeatureCount} feature{displayFeatureCount !== 1 ? 's' : ''}</span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span>{displayMemberCount} member{displayMemberCount !== 1 ? 's' : ''}</span>
                        {epicRollup && epicRollup.itemCount > 0 && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {epicRollup.forecastedDays}d forecasted
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
                    <Badge variant={getPriorityVariant(project.priority)}>{project.priority}</Badge>

                    <button
                      onClick={() => openAssignment(project.id)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Assign Team"
                    >
                      <UserPlus size={16} />
                    </button>

                    <div className="relative group">
                      <button
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="More actions"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 hidden group-focus-within:block hover:block z-20">
                        <button onClick={() => handleEdit(project)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                          <Edit2 size={14} /> Edit
                        </button>
                        <button onClick={() => handleDuplicate(project)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                          <Copy size={14} /> Duplicate
                        </button>
                        {(project.status === 'Completed' || project.status === 'Cancelled') && !project.archived && (
                          <button onClick={() => handleArchive(project)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                            <Archive size={14} /> Archive
                          </button>
                        )}
                        {project.archived && (
                          <button onClick={() => { unarchiveProject(project.id); showToast('Unarchived', 'success'); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
                            <ArchiveRestore size={14} /> Unarchive
                          </button>
                        )}
                        <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                        <button onClick={() => handleDelete(project)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">

                    {(project.description || project.notes || dateRange || uniqueMembers.size > 0) && (
                      <div className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-2 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex-1 min-w-[180px] space-y-1.5">
                          {project.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-300">{project.description}</p>
                          )}
                          {dateRange && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <Calendar size={11} />
                              {dateRange}
                            </div>
                          )}
                          {project.notes && (
                            <div className="flex gap-1.5 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                              <StickyNote size={12} className="text-amber-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-800 dark:text-amber-300 whitespace-pre-wrap">{project.notes}</p>
                            </div>
                          )}
                        </div>

                        {uniqueMembers.size > 0 && (
                          <div className="shrink-0">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                              Team ({uniqueMembers.size})
                            </p>
                            <div className="space-y-0.5">
                              {Array.from(uniqueMembers.entries()).map(([memberId, days]) => {
                                const cap = calculateCapacity(memberId, currentQuarter, state);
                                return (
                                  <div key={memberId} className="flex items-center gap-3 text-sm">
                                    <span className="text-slate-700 dark:text-slate-300">{getMemberName(memberId)}</span>
                                    <span className={`font-semibold ${
                                      cap.status === 'overallocated' ? 'text-red-500' :
                                      cap.status === 'warning' ? 'text-amber-500' : 'text-slate-500'
                                    }`}>{days}d</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {jiraItems.length > 0 && (
                          <div className="shrink-0">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                              Jira ({jiraItems.length})
                            </p>
                            <div className="space-y-0.5">
                              {Object.entries(jiraByStatus).map(([cat, count]) => (
                                <div key={cat} className="flex items-center gap-3 text-sm">
                                  <span className="text-slate-600 dark:text-slate-400">{cat}</span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {jiraItems.length > 0 && (
                      <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                        <EpicGrid
                          items={jiraItems}
                          epicKey={project.jiraSourceKey}
                          jiraBaseUrl={activeJiraBaseUrl}
                          bizAssignments={state.jiraItemBizAssignments ?? []}
                          businessContacts={state.businessContacts}
                        />
                      </div>
                    )}

                    {/* Business commitments for Jira-synced epics: show local phases with BIZ chips */}
                    {jiraItems.length > 0 && project.phases.length > 0 && (
                      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/60">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Users size={11} />
                          Business commitments
                        </p>
                        <div className="space-y-1">
                          {project.phases.map(phase => {
                            const phaseCommitments = state.businessAssignments.filter(a => a.phaseId === phase.id);
                            const bizKey = `${project.id}:${phase.id}`;
                            const isBizOpen = openBizKey === bizKey;
                            return (
                              <div key={phase.id}>
                                <div className="flex items-center justify-between gap-3 py-1">
                                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{phase.name}</span>
                                  <button
                                    onClick={() => toggleBizPanel(project.id, phase.id)}
                                    title={phaseCommitments.length > 0 ? `Business commitments: ${phaseCommitments.length} contact${phaseCommitments.length !== 1 ? 's' : ''}` : 'Assign business contact'}
                                    className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                                      phaseCommitments.length > 0
                                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                                        : 'border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-purple-300 dark:hover:border-purple-600 hover:text-purple-500 dark:hover:text-purple-400'
                                    }`}
                                  >
                                    <Users size={11} />
                                    {phaseCommitments.length > 0
                                      ? `BIZ: ${phaseCommitments.length} · ${phaseCommitments.reduce((s, b) => s + b.days, 0)}d`
                                      : '+ BIZ'}
                                  </button>
                                </div>
                                {isBizOpen && (
                                  <InlineBizPanel
                                    projectId={project.id}
                                    phaseId={phase.id}
                                    commitments={phaseCommitments}
                                    allContacts={state.businessContacts}
                                    showAdd={bizShowAdd}
                                    contactId={bizContactId}
                                    days={bizDays}
                                    notes={bizNotes}
                                    onOpenAdd={() => { setBizShowAdd(true); setBizContactId(''); setBizDays(''); setBizNotes(''); }}
                                    onCancelAdd={() => setBizShowAdd(false)}
                                    onContactChange={setBizContactId}
                                    onDaysChange={setBizDays}
                                    onNotesChange={setBizNotes}
                                    onAdd={() => handleAddBiz(project.id, phase.id)}
                                    onRemove={(id) => removeBusinessAssignment(id)}
                                    onClose={() => { setOpenBizKey(null); setBizShowAdd(false); }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Only show manual phases when the project has no Jira items.
                        When Jira items are present the hierarchy tree above already shows the full
                        feature/story structure — showing the phase list too is redundant. */}
                    {jiraItems.length === 0 && (
                      project.phases.length === 0 ? (
                        <div className="px-5 py-3 text-sm text-slate-400 italic">No features defined</div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {project.phases.map(phase => {
                            const phaseDate = formatDateRange(phase.startDate, phase.endDate);
                            // Look up assignments from the flat store first, fall back to phase.assignments
                            const phaseAssignments = state.assignments.filter(
                              a => a.projectId === project.id && a.phaseId === phase.id
                            );
                            const displayAssignments = phaseAssignments.length > 0 ? phaseAssignments : (phase.assignments ?? []);
                            const phaseCommitments = state.businessAssignments.filter(a => a.phaseId === phase.id);
                            const bizKey = `${project.id}:${phase.id}`;
                            const isBizOpen = openBizKey === bizKey;
                            return (
                              <div key={phase.id} className="px-5 pl-8">
                                <div className="flex items-start justify-between gap-4 py-2.5">
                                  <div className="min-w-0 flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-2" />
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        {phase.name}
                                      </p>
                                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                          {phase.startQuarter}{phase.endQuarter !== phase.startQuarter ? ` – ${phase.endQuarter}` : ''}
                                        </span>
                                        {phaseDate && (
                                          <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Calendar size={10} />
                                            {phaseDate}
                                          </span>
                                        )}
                                      </div>
                                      {phase.notes && (
                                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 italic">
                                          {phase.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {displayAssignments.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5 max-w-xs justify-end">
                                        {displayAssignments.slice(0, 5).map((a, i) => (
                                          <span
                                            key={i}
                                            className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-medium rounded-md"
                                          >
                                            {getMemberName(a.memberId)}
                                            <span className="ml-1 text-xs text-blue-500 dark:text-blue-400 font-normal">{a.days}d</span>
                                          </span>
                                        ))}
                                        {displayAssignments.length > 5 && (
                                          <span className="px-2 py-1 text-slate-500 text-xs">
                                            +{displayAssignments.length - 5} more
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-sm text-slate-400 italic">No assignments</span>
                                    )}
                                    {/* BIZ chip */}
                                    <button
                                      onClick={() => toggleBizPanel(project.id, phase.id)}
                                      title={phaseCommitments.length > 0 ? `Business commitments: ${phaseCommitments.length} contact${phaseCommitments.length !== 1 ? 's' : ''}` : 'Assign business contact'}
                                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                                        phaseCommitments.length > 0
                                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                                          : 'border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-purple-300 dark:hover:border-purple-600 hover:text-purple-500 dark:hover:text-purple-400'
                                      }`}
                                    >
                                      <Users size={11} />
                                      {phaseCommitments.length > 0
                                        ? `BIZ: ${phaseCommitments.length} · ${phaseCommitments.reduce((s, b) => s + b.days, 0)}d`
                                        : '+ BIZ'}
                                    </button>
                                    <button
                                      onClick={() => openAssignment(project.id, phase.id)}
                                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                                      title="Assign team member"
                                    >
                                      <UserPlus size={14} />
                                    </button>
                                  </div>
                                </div>
                                {/* Inline BIZ panel */}
                                {isBizOpen && (
                                  <InlineBizPanel
                                    projectId={project.id}
                                    phaseId={phase.id}
                                    commitments={phaseCommitments}
                                    allContacts={state.businessContacts}
                                    showAdd={bizShowAdd}
                                    contactId={bizContactId}
                                    days={bizDays}
                                    notes={bizNotes}
                                    onOpenAdd={() => { setBizShowAdd(true); setBizContactId(''); setBizDays(''); setBizNotes(''); }}
                                    onCancelAdd={() => setBizShowAdd(false)}
                                    onContactChange={setBizContactId}
                                    onDaysChange={setBizDays}
                                    onNotesChange={setBizNotes}
                                    onAdd={() => handleAddBiz(project.id, phase.id)}
                                    onRemove={(id) => removeBusinessAssignment(id)}
                                    onClose={() => { setOpenBizKey(null); setBizShowAdd(false); }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Project Form Modal */}
      <ProjectForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        project={editingProject}
      />

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={isAssignmentOpen}
        onClose={() => {
          setIsAssignmentOpen(false);
          setAssignmentContext({});
        }}
        projectId={assignmentContext.projectId}
        phaseId={assignmentContext.phaseId}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Epic"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          This will also remove all features and assignments. You can undo for 10 seconds after deletion.
        </p>
      </Modal>
    </div>
  );
}

/* ─── Inline BIZ panel ───────────────────────────────────────────────────── */

interface InlineBizPanelProps {
  projectId: string;
  phaseId: string;
  commitments: BusinessAssignment[];
  allContacts: ReturnType<typeof useCurrentState>['businessContacts'];
  showAdd: boolean;
  contactId: string;
  days: string;
  notes: string;
  onOpenAdd: () => void;
  onCancelAdd: () => void;
  onContactChange: (v: string) => void;
  onDaysChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

function InlineBizPanel({
  projectId: _projectId,
  phaseId: _phaseId,
  commitments,
  allContacts,
  showAdd,
  contactId,
  days,
  notes,
  onOpenAdd,
  onCancelAdd,
  onContactChange,
  onDaysChange,
  onNotesChange,
  onAdd,
  onRemove,
  onClose,
}: InlineBizPanelProps) {
  const contacts = allContacts.filter(c => !c.archived);

  return (
    <div className="flex justify-end px-5 pb-2">
      <div className="w-72 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 shadow-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100 dark:border-purple-800/50">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
          <Users size={11} />
          Business commitment
        </span>
        <div className="flex items-center gap-2">
          {!showAdd && (
            <button
              type="button"
              onClick={onOpenAdd}
              className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors"
            >
              + Add
            </button>
          )}
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {commitments.length === 0 && !showAdd && (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-1 italic">
            {contacts.length === 0
              ? 'Add contacts in Settings → Reference Data first.'
              : 'None yet — click + Add to assign.'}
          </p>
        )}

        {commitments.map(bc => {
          const contact = allContacts.find(c => c.id === bc.contactId);
          return (
            <div key={bc.id} className="flex items-center gap-2 py-1 rounded px-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 group">
              <span className="flex-1 min-w-0 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                {contact?.name ?? bc.contactId}
                {contact?.title && <span className="font-normal text-slate-400"> — {contact.title}</span>}
              </span>
              <span className="shrink-0 text-xs font-bold text-purple-700 dark:text-purple-300">{bc.days}d</span>
              {bc.notes && (
                <span className="shrink-0 text-[10px] text-slate-400 truncate max-w-[80px]" title={bc.notes}>{bc.notes}</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(bc.id)}
                className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {commitments.length > 1 && (
          <div className="text-[10px] text-purple-500 dark:text-purple-400 font-medium pt-0.5 border-t border-purple-100 dark:border-purple-800/50">
            {commitments.reduce((s, b) => s + b.days, 0)}d total · {commitments.length} contacts
          </div>
        )}

        {showAdd && (
          <div className="mt-1 pt-2 border-t border-purple-100 dark:border-purple-800/50 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Contact</label>
                <select
                  value={contactId}
                  onChange={e => onContactChange(e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select…</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={days}
                  onChange={e => onDaysChange(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder="e.g. UAT sign-off…"
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onCancelAdd} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={onAdd}
                disabled={!contactId || !days}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/* ─── Epic Grid (5-column Jira hierarchy with IT + BIZ assignees) ────────── */

const EPIC_GRID_COLS = '1fr 180px 180px 140px 100px';

interface EpicGridProps {
  items: JiraWorkItem[];
  epicKey?: string;
  jiraBaseUrl: string;
  bizAssignments: JiraItemBizAssignment[];
  businessContacts: BusinessContact[];
}

function EpicGrid({ items, epicKey, jiraBaseUrl, bizAssignments, businessContacts }: EpicGridProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [openBizKey, setOpenBizKey] = useState<string | null>(null);
  const [bizShowAdd, setBizShowAdd] = useState(false);
  const [bizContactId, setBizContactId] = useState('');
  const [bizNotes, setBizNotes] = useState('');

  const toggleExpand = (key: string) =>
    setExpandedKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleBiz = (key: string) => {
    if (openBizKey === key) { setOpenBizKey(null); setBizShowAdd(false); }
    else { setOpenBizKey(key); setBizShowAdd(false); setBizContactId(''); setBizNotes(''); }
  };

  const handleAddBiz = (jiraKey: string) => {
    if (!bizContactId) return;
    upsertJiraItemBizAssignment({ jiraKey, contactId: bizContactId, notes: bizNotes.trim() || undefined });
    setBizShowAdd(false); setBizContactId(''); setBizNotes('');
  };

  const getItPeople = (item: JiraWorkItem): AvatarPerson[] =>
    item.assigneeName ? [{ id: item.assigneeEmail ?? item.assigneeName, name: item.assigneeName }] : [];

  const getBizPeople = (key: string): AvatarPerson[] =>
    bizAssignments
      .filter(a => a.jiraKey === key)
      .flatMap(a => {
        const c = businessContacts.find(bc => bc.id === a.contactId && !bc.archived);
        return c ? [{ id: c.id, name: c.name } as AvatarPerson] : [];
      });

  const features = items.filter(i => i.type === 'feature' && (epicKey ? i.parentKey === epicKey : true));
  const displayFeatures = features.length > 0 ? features : items.filter(i => i.type === 'feature');
  const childrenOf = (key: string) => items.filter(i => i.parentKey === key && i.type !== 'feature');

  const StatusBadge = ({ item }: { item: JiraWorkItem }) => {
    const cat = item.statusCategory;
    if (cat === 'done')        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />{item.status}</span>;
    if (cat === 'in_progress') return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-amber-50 text-amber-700 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />{item.status}</span>;
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-500 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />{item.status}</span>;
  };

  const TypeChip = ({ type }: { type: string }) => {
    const t = type.toUpperCase();
    const cls: Record<string, string> = {
      FEATURE: 'bg-[#E8F4FB] text-[#0089DD]',
      STORY:   'bg-slate-100 text-slate-500',
      BUG:     'bg-red-50 text-red-600',
      TASK:    'bg-slate-100 text-slate-500',
    };
    return <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${cls[t] ?? 'bg-slate-100 text-slate-500'}`}>{t}</span>;
  };

  const SprintCell = ({ item }: { item: JiraWorkItem }) => (
    <div className="px-2.5">
      {item.sprintName
        ? <span className="font-mono text-[10.5px] text-slate-600 dark:text-slate-300">{item.sprintName}</span>
        : <span className="text-xs text-slate-300 dark:text-slate-600">—</span>}
    </div>
  );

  const hdrBase = 'text-[10px] font-semibold uppercase tracking-widest pb-2 px-2.5';

  const JiraBizPanelInline = ({ jiraKey }: { jiraKey: string }) => (
    <JiraBizPanel
      jiraKey={jiraKey}
      allBizAssignments={bizAssignments}
      businessContacts={businessContacts}
      showAdd={bizShowAdd}
      contactId={bizContactId}
      notes={bizNotes}
      onOpenAdd={() => { setBizShowAdd(true); setBizContactId(''); setBizNotes(''); }}
      onCancelAdd={() => setBizShowAdd(false)}
      onContactChange={setBizContactId}
      onNotesChange={setBizNotes}
      onAdd={() => handleAddBiz(jiraKey)}
      onRemove={removeJiraItemBizAssignment}
      onClose={() => { setOpenBizKey(null); setBizShowAdd(false); }}
    />
  );

  const nonEpics = items.filter(i => i.type !== 'epic');

  if (displayFeatures.length === 0 && nonEpics.length === 0) return null;

  const renderRows = displayFeatures.length > 0 ? (
    displayFeatures.map(feature => {
      const children = childrenOf(feature.jiraKey);
      const isExp = expandedKeys.has(feature.jiraKey);
      return (
        <div key={feature.id} className="border-t border-slate-100 dark:border-slate-700/60">
          {/* Feature row */}
          <div
            style={{ display: 'grid', gridTemplateColumns: EPIC_GRID_COLS }}
            className="items-center py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            onClick={() => children.length > 0 && toggleExpand(feature.jiraKey)}
          >
            <div className="flex items-center gap-1.5 min-w-0 px-4 pr-4">
              {children.length > 0 ? (
                <button className="p-0.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0" onClick={e => { e.stopPropagation(); toggleExpand(feature.jiraKey); }}>
                  {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              ) : <span className="w-[22px] flex-shrink-0" />}
              <TypeChip type="feature" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{feature.summary}</span>
              {feature.jiraKey && jiraBaseUrl && (
                <a href={`${jiraBaseUrl}/browse/${feature.jiraKey}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[10px] text-slate-400 hover:text-[#0089DD] flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {feature.jiraKey}
                </a>
              )}
              {feature.storyPoints != null && (
                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{feature.storyPoints}d</span>
              )}
            </div>
            {/* IT Assignee */}
            <div className="flex items-center gap-1.5 px-2.5">
              <span className="text-[9px] font-bold tracking-wider uppercase px-1 py-0.5 rounded bg-[#E8F4FB] text-[#0089DD] border border-[#BAE0F7] flex-shrink-0">IT</span>
              <AvatarStack people={getItPeople(feature)} variant="it" />
            </div>
            {/* BIZ Assignee */}
            <div className="flex items-center gap-1.5 px-2.5">
              <span className="text-[9px] font-bold tracking-wider uppercase px-1 py-0.5 rounded bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE] flex-shrink-0">BIZ</span>
              <AvatarStack people={getBizPeople(feature.jiraKey)} variant="biz" onClick={() => toggleBiz(feature.jiraKey)} />
            </div>
            <SprintCell item={feature} />
            <div className="px-2.5"><StatusBadge item={feature} /></div>
          </div>
          {openBizKey === feature.jiraKey && <JiraBizPanelInline jiraKey={feature.jiraKey} />}

          {/* Story rows */}
          {isExp && children.map(child => (
            <div key={child.id}>
              <div
                style={{ display: 'grid', gridTemplateColumns: EPIC_GRID_COLS }}
                className="items-center py-2 bg-white dark:bg-slate-900/20 border-t border-slate-50 dark:border-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0 pr-4 pl-14">
                  <svg className="w-4 h-4 text-slate-200 dark:text-slate-700 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                    <path d="M4 0v10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <TypeChip type={child.typeName || child.type} />
                  <span className="text-[12.5px] text-slate-700 dark:text-slate-300 truncate">{child.summary}</span>
                  {child.jiraKey && jiraBaseUrl && (
                    <a href={`${jiraBaseUrl}/browse/${child.jiraKey}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[10px] text-slate-400 hover:text-[#0089DD] flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {child.jiraKey}
                    </a>
                  )}
                  {child.storyPoints != null && (
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{child.storyPoints}d</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 px-2.5">
                  <AvatarStack people={getItPeople(child)} variant="it" />
                </div>
                <div className="flex items-center gap-1.5 px-2.5">
                  <AvatarStack people={getBizPeople(child.jiraKey)} variant="biz" onClick={() => toggleBiz(child.jiraKey)} />
                </div>
                <SprintCell item={child} />
                <div className="px-2.5"><StatusBadge item={child} /></div>
              </div>
              {openBizKey === child.jiraKey && <JiraBizPanelInline jiraKey={child.jiraKey} />}
            </div>
          ))}
        </div>
      );
    })
  ) : (
    nonEpics.map(item => (
      <div key={item.id}>
        <div
          style={{ display: 'grid', gridTemplateColumns: EPIC_GRID_COLS }}
          className="items-center py-2 border-t border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-1.5 min-w-0 px-4 pr-4">
            <TypeChip type={item.typeName || item.type} />
            <span className="text-sm text-slate-800 dark:text-slate-100 truncate">{item.summary}</span>
            {item.jiraKey && jiraBaseUrl && (
              <a href={`${jiraBaseUrl}/browse/${item.jiraKey}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[10px] text-slate-400 hover:text-[#0089DD] flex-shrink-0" onClick={e => e.stopPropagation()}>
                {item.jiraKey}
              </a>
            )}
            {item.storyPoints != null && (
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{item.storyPoints}d</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 px-2.5">
            <span className="text-[9px] font-bold tracking-wider uppercase px-1 py-0.5 rounded bg-[#E8F4FB] text-[#0089DD] border border-[#BAE0F7] flex-shrink-0">IT</span>
            <AvatarStack people={getItPeople(item)} variant="it" />
          </div>
          <div className="flex items-center gap-1.5 px-2.5">
            <span className="text-[9px] font-bold tracking-wider uppercase px-1 py-0.5 rounded bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE] flex-shrink-0">BIZ</span>
            <AvatarStack people={getBizPeople(item.jiraKey)} variant="biz" onClick={() => toggleBiz(item.jiraKey)} />
          </div>
          <SprintCell item={item} />
          <div className="px-2.5"><StatusBadge item={item} /></div>
        </div>
        {openBizKey === item.jiraKey && <JiraBizPanelInline jiraKey={item.jiraKey} />}
      </div>
    ))
  );

  return (
    <div className="min-w-[640px]">
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: EPIC_GRID_COLS }} className="px-4 pt-2.5 pb-1">
        <div className={`${hdrBase} text-slate-400 dark:text-slate-500 pl-4`}>Feature / Item</div>
        <div className={`${hdrBase} text-[#0089DD]/70`}>IT Assignee</div>
        <div className={`${hdrBase} text-[#7C3AED]/70`}>Business Assignee</div>
        <div className={`${hdrBase} text-slate-400 dark:text-slate-500`}>Sprint</div>
        <div className={`${hdrBase} text-slate-400 dark:text-slate-500`}>Status</div>
      </div>
      {renderRows}
    </div>
  );
}

/* ─── Jira BIZ assignment panel ──────────────────────────────────────────── */

interface JiraBizPanelProps {
  jiraKey: string;
  allBizAssignments: JiraItemBizAssignment[];
  businessContacts: BusinessContact[];
  showAdd: boolean;
  contactId: string;
  notes: string;
  onOpenAdd: () => void;
  onCancelAdd: () => void;
  onContactChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

function JiraBizPanel({
  jiraKey,
  allBizAssignments,
  businessContacts,
  showAdd,
  contactId,
  notes,
  onOpenAdd,
  onCancelAdd,
  onContactChange,
  onNotesChange,
  onAdd,
  onRemove,
  onClose,
}: JiraBizPanelProps) {
  const commitments = allBizAssignments.filter(a => a.jiraKey === jiraKey);
  const contacts = businessContacts.filter(c => !c.archived);

  return (
    <div className="flex justify-end px-4 pb-2">
      <div className="w-72 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 shadow-md">
        <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100 dark:border-purple-800/50">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
            <Users size={11} />
            BIZ · {jiraKey}
          </span>
          <div className="flex items-center gap-2">
            {!showAdd && (
              <button type="button" onClick={onOpenAdd}
                className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors">
                + Add
              </button>
            )}
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
        <div className="px-3 py-2 space-y-1.5">
          {commitments.length === 0 && !showAdd && (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-1 italic">
              {contacts.length === 0 ? 'Add business contacts in Settings → Reference Data first.' : 'No business contacts assigned yet.'}
            </p>
          )}
          {commitments.map(c => {
            const contact = businessContacts.find(bc => bc.id === c.contactId);
            if (!contact) return null;
            return (
              <div key={c.id} className="flex items-center justify-between gap-2 group">
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{contact.name}</span>
                {c.notes && <span className="text-[10px] text-slate-400 truncate italic">{c.notes}</span>}
                <button onClick={() => onRemove(c.id)}
                  className="text-red-400 hover:text-red-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={12} />
                </button>
              </div>
            );
          })}
          {showAdd && (
            <div className="mt-1 pt-2 border-t border-purple-100 dark:border-purple-800/50 space-y-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Contact</label>
                <select value={contactId} onChange={e => onContactChange(e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">Select…</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Notes (optional)</label>
                <input type="text" value={notes} onChange={e => onNotesChange(e.target.value)}
                  placeholder="e.g. UAT sign-off…"
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancelAdd}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={onAdd} disabled={!contactId}
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
