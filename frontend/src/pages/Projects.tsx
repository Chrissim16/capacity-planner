import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Copy, ExternalLink, UserPlus, ChevronDown, ChevronRight, Users, FolderKanban, Filter } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { ProjectForm } from '../components/forms/ProjectForm';
import { AssignmentModal } from '../components/forms/AssignmentModal';
import { useCurrentState } from '../stores/appStore';
import { deleteProject, duplicateProject } from '../stores/actions';
import { useToast } from '../components/ui/Toast';
import type { Project } from '../types';

export function Projects() {
  const state = useCurrentState();
  const projects = state.projects;
  const systems = state.systems;
  const teamMembers = state.teamMembers;
  const { showToast } = useToast();
  
  const [isFormOpen, setIsFormOpen] = useState(false);

  // N shortcut → open "Add epic" form
  useEffect(() => {
    const handler = () => { setEditingProject(null); setIsFormOpen(true); };
    window.addEventListener('keyboard:new', handler);
    return () => window.removeEventListener('keyboard:new', handler);
  }, []);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
  // Assignment modal state
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [assignmentContext, setAssignmentContext] = useState<{
    projectId?: string;
    phaseId?: string;
  }>({});
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [systemFilter, setSystemFilter] = useState('');

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Planning': return 'primary';
      case 'On Hold': return 'warning';
      case 'Completed': return 'default';
      case 'Cancelled': return 'default';
      default: return 'default';
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'High': return 'danger';
      case 'Medium': return 'warning';
      case 'Low': return 'default';
      default: return 'default';
    }
  };

  // Filter projects
  const filteredProjects = projects.filter(project => {
    if (search && !project.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && project.status !== statusFilter) return false;
    if (priorityFilter && project.priority !== priorityFilter) return false;
    if (systemFilter && !project.systemIds?.includes(systemFilter)) return false;
    return true;
  });

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setIsFormOpen(true);
  };

  const handleDelete = (project: Project) => {
    setDeleteConfirm(project);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteProject(deleteConfirm.id);
      setDeleteConfirm(null);
      showToast('Epic deleted', 'success');
    }
  };

  const handleDuplicate = (project: Project) => {
    duplicateProject(project.id);
    showToast(`Duplicated "${project.name}"`, 'success');
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProject(null);
  };

  const toggleExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const openAssignment = (projectId: string, phaseId?: string) => {
    setAssignmentContext({ projectId, phaseId });
    setIsAssignmentOpen(true);
  };

  const getMemberName = (memberId: string) => {
    return teamMembers.find(m => m.id === memberId)?.name || 'Unknown';
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Epics</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {filteredProjects.length} epic{filteredProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setIsAssignmentOpen(true)}>
            <UserPlus size={16} />
            Assign Team
          </Button>
          <Button onClick={() => setIsFormOpen(true)}>
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
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={statusOptions}
        />
        <Select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          options={priorityOptions}
        />
        <Select
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
          options={systemOptions}
        />
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent>
            {projects.length === 0 ? (
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
            const totalAssignments = project.phases.reduce((sum, ph) => sum + ph.assignments.length, 0);
            
            return (
              <Card 
                key={project.id} 
                className="overflow-hidden"
              >
                {/* Project Header */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => toggleExpanded(project.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button className="p-1 text-slate-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                          {project.name}
                        </h3>
                        {project.devopsLink && (
                          <a
                            href={project.devopsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{project.phases.length} feature{project.phases.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {totalAssignments} assignment{totalAssignments !== 1 ? 's' : ''}
                        </span>
                        {projectSystems.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{projectSystems.map(s => s.name).join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Badge variant={getPriorityVariant(project.priority)}>
                        {project.priority}
                      </Badge>
                      <Badge variant={getStatusVariant(project.status)}>
                        {project.status}
                      </Badge>
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

                {/* Expanded Phases */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                    {project.phases.length === 0 ? (
                      <div className="px-12 py-4 text-sm text-slate-400">
                        No features defined
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {project.phases.map(phase => (
                          <div key={phase.id} className="px-12 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-700 dark:text-slate-200">
                                  {phase.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {phase.startQuarter} – {phase.endQuarter}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                {phase.assignments.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 max-w-md">
                                    {phase.assignments.slice(0, 5).map((a, i) => (
                                      <span 
                                        key={i}
                                        className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
                                      >
                                        {getMemberName(a.memberId)} ({a.days}d)
                                      </span>
                                    ))}
                                    {phase.assignments.length > 5 && (
                                      <span className="px-2 py-0.5 text-slate-400 text-xs">
                                        +{phase.assignments.length - 5} more
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">No assignments</span>
                                )}
                                <button
                                  onClick={() => openAssignment(project.id, phase.id)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                                  title="Assign to this phase"
                                >
                                  <UserPlus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
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
          This will also remove all features and assignments. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
