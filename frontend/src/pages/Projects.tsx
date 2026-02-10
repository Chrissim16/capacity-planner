import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Copy, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { ProjectForm } from '../components/forms/ProjectForm';
import { useAppStore } from '../stores/appStore';
import { deleteProject, duplicateProject } from '../stores/actions';
import type { Project } from '../types';

export function Projects() {
  const state = useAppStore((s) => s.getCurrentState());
  const projects = state.projects;
  const systems = state.systems;
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);
  
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
    }
  };

  const handleDuplicate = (project: Project) => {
    duplicateProject(project.id);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProject(null);
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Projects</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus size={16} />
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
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
          <CardContent className="py-16 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {projects.length === 0 
                ? 'No projects yet. Create your first project to get started.'
                : 'No projects match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map(project => {
            const projectSystems = systems.filter(s => project.systemIds?.includes(s.id));
            
            return (
              <Card 
                key={project.id} 
                className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <CardContent className="flex items-center justify-between">
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
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span>{project.phases.length} phase{project.phases.length !== 1 ? 's' : ''}</span>
                      {projectSystems.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{projectSystems.map(s => s.name).join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
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
                </CardContent>
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Project"
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
          This will also remove all phases and assignments. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
