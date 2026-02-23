import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Edit2, Trash2, Copy, ExternalLink, UserPlus,
  ChevronDown, ChevronRight, Users, FolderKanban, Filter,
  Archive, ArchiveRestore, StickyNote, Calendar,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { JiraHierarchyTree } from '../components/JiraHierarchyTree';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { ProjectForm } from '../components/forms/ProjectForm';
import { AssignmentModal } from '../components/forms/AssignmentModal';
import { useCurrentState, useAppStore } from '../stores/appStore';
import { deleteProject, duplicateProject, archiveProject, unarchiveProject } from '../stores/actions';
import { useToast } from '../components/ui/Toast';
import { calculateCapacity } from '../utils/capacity';
import { getCurrentQuarter } from '../utils/calendar';
import type { Project, JiraWorkItem } from '../types';

export function Projects() {
  const state = useCurrentState();
  const projects = state.projects;
  const systems = state.systems;
  const teamMembers = state.teamMembers;
  const jiraWorkItems = state.jiraWorkItems ?? [];
  const jiraConnections = state.jiraConnections ?? [];
  const activeJiraBaseUrl = jiraConnections.find(c => c.isActive)?.jiraBaseUrl.replace(/\/+$/, '') ?? '';
  const { showToast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const currentQuarter = getCurrentQuarter();

  // N shortcut → open "Add epic" form
  useEffect(() => {
    const handler = () => { setEditingProject(null); setIsFormOpen(true); };
    window.addEventListener('keyboard:new', handler);
    return () => window.removeEventListener('keyboard:new', handler);
  }, []);

  // Command palette highlight → expand the matching project
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

  // Assignment modal state
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [assignmentContext, setAssignmentContext] = useState<{
    projectId?: string;
    phaseId?: string;
  }>({});

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('__open__');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState('');

  const getStatusVariant = (status: string): 'success' | 'primary' | 'warning' | 'default' => {
    switch (status) {
      case 'Active': return 'success';
      case 'Planning': return 'primary';
      case 'On Hold': return 'warning';
      default: return 'default';
    }
  };

  const getPriorityVariant = (priority: string): 'danger' | 'warning' | 'default' => {
    switch (priority) {
      case 'High': return 'danger';
      case 'Medium': return 'warning';
      default: return 'default';
    }
  };

  // Filter projects
  const filteredProjects = useMemo(() => projects.filter(project => {
    if (!showArchived && project.archived) return false;
    if (showArchived && !project.archived) return false;
    if (search && !project.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === '__open__' && (project.status === 'Completed' || project.status === 'Cancelled')) return false;
    if (statusFilter && statusFilter !== '__open__' && project.status !== statusFilter) return false;
    if (priorityFilter && project.priority !== priorityFilter) return false;
    if (systemFilter && !project.systemIds?.includes(systemFilter)) return false;
    return true;
  }), [projects, showArchived, search, statusFilter, priorityFilter, systemFilter]);

  const archivedCount = useMemo(() => projects.filter(p => p.archived).length, [projects]);

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

  /**
   * Collect all Jira work items that belong to a project, via two routes:
   *   1. jiraSourceKey subtree — items whose ancestor is the epic key
   *      (set when autoCreateProjects builds the project from Jira).
   *   2. mappedProjectId — items manually mapped to this project in the
   *      Jira tab (no jiraSourceKey required on the project).
   * Using both means manually-mapped AND auto-created items both appear
   * in the Epics tab, and the hierarchy tree renders the full depth.
   */
  const collectJiraItemsForProject = (project: Project): JiraWorkItem[] => {
    const included = new Set<string>();

    // Route 1: breadth-first walk of the Jira subtree
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

    // Route 2: items explicitly mapped to this project in the Jira tab
    for (const item of jiraWorkItems) {
      if (item.mappedProjectId === project.id) {
        included.add(item.id);
      }
    }

    return jiraWorkItems.filter(i => included.has(i.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Epics</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {filteredProjects.length} epic{filteredProjects.length !== 1 ? 's' : ''}
            {showArchived && ' (archived)'}
          </p>
        </div>
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
      </div>

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
        <div className="space-y-3">
          {filteredProjects.map(project => {
            const projectSystems = systems.filter(s => project.systemIds?.includes(s.id));
            const isExpanded = expandedProjects.has(project.id);

            // — US-048 summary data —
            const uniqueMembers = new Map<string, number>();
            project.phases.forEach(ph => {
              ph.assignments.forEach(a => {
                uniqueMembers.set(a.memberId, (uniqueMembers.get(a.memberId) ?? 0) + a.days);
              });
            });

            const jiraItems = collectJiraItemsForProject(project);

            // Feature count: use planner phases when populated, otherwise fall back
            // to Jira feature-type items (epics auto-created from Jira may have phases
            // from Jira features rather than hand-crafted planner phases).
            const jiraFeatureCount = jiraItems.filter(i => i.type === 'feature').length;
            const displayFeatureCount = project.phases.length > 0 ? project.phases.length : jiraFeatureCount;

            // Member count: planner assignments take precedence; fall back to unique
            // Jira assignees so the counter isn't stuck at 0 for auto-imported epics.
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
                      <div className="flex items-center gap-3 mb-1">
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
                        {project.devopsLink && (
                          <a
                            href={project.devopsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-500 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        {project.notes && (
                          <span title="Has notes">
                            <StickyNote size={13} className="text-amber-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
                        <span>{displayFeatureCount} feature{displayFeatureCount !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {displayMemberCount} member{displayMemberCount !== 1 ? 's' : ''}
                        </span>
                        {dateRange && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {dateRange}
                            </span>
                          </>
                        )}
                        {projectSystems.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{projectSystems.map(s => s.name).join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityVariant(project.priority)}>{project.priority}</Badge>
                      <Badge variant={getStatusVariant(project.status)}>{project.status}</Badge>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openAssignment(project.id)}
                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Assign Team"
                      >
                        <UserPlus size={16} />
                      </button>
                      <button
                        onClick={() => handleEdit(project)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDuplicate(project)}
                        className="p-2 text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </button>
                      {(project.status === 'Completed' || project.status === 'Cancelled') && !project.archived && (
                        <button
                          onClick={() => handleArchive(project)}
                          className="p-2 text-slate-400 hover:text-violet-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="Archive"
                        >
                          <Archive size={16} />
                        </button>
                      )}
                      {project.archived && (
                        <button
                          onClick={() => { unarchiveProject(project.id); showToast('Unarchived', 'success'); }}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="Unarchive"
                        >
                          <ArchiveRestore size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(project)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">

                    {/* Summary row — only rendered when there's metadata to show */}
                    {(project.description || project.notes || dateRange || uniqueMembers.size > 0) && (
                      <div className="px-5 py-3 flex flex-wrap gap-x-6 gap-y-2 border-b border-slate-200 dark:border-slate-700">
                        {/* Description / Notes / Date */}
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

                        {/* Team allocation summary */}
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

                        {/* Jira stats */}
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

                    {/* Jira hierarchy */}
                    {jiraItems.length > 0 && (
                      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Jira Items ({jiraItems.length})
                        </p>
                        <JiraHierarchyTree
                          items={jiraItems}
                          jiraBaseUrl={activeJiraBaseUrl}
                          readOnly
                        />
                      </div>
                    )}

                    {/* Feature list */}
                    {project.phases.length === 0 ? (
                      <div className="px-5 py-3 text-sm text-slate-400 italic">No features defined</div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                        {project.phases.map(phase => {
                          const phaseDate = formatDateRange(phase.startDate, phase.endDate);
                          return (
                            <div key={phase.id} className="px-5 py-2.5 pl-8">
                              <div className="flex items-start justify-between gap-4">
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
                                <div className="flex items-center gap-4 shrink-0">
                                  {phase.assignments.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 max-w-xs justify-end">
                                      {phase.assignments.slice(0, 5).map((a, i) => (
                                        <span
                                          key={i}
                                          className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm font-medium rounded-md"
                                        >
                                          {getMemberName(a.memberId)}
                                          <span className="ml-1 text-xs text-blue-500 dark:text-blue-400 font-normal">{a.days}d</span>
                                        </span>
                                      ))}
                                      {phase.assignments.length > 5 && (
                                        <span className="px-2 py-1 text-slate-500 text-xs">
                                          +{phase.assignments.length - 5} more
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-400 italic">No assignments</span>
                                  )}
                                  <button
                                    onClick={() => openAssignment(project.id, phase.id)}
                                    className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                                    title="Assign to this feature"
                                  >
                                    <UserPlus size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
