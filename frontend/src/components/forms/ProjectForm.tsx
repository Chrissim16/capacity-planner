import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Trash2, Plus } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { addProject, updateProject, generateId } from '../../stores/actions';
import { getCurrentQuarter } from '../../utils/calendar';
import type { Project, Phase, ProjectPriority, ProjectStatus } from '../../types';

interface ProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
}

const priorityOptions = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const statusOptions = [
  { value: 'Planning', label: 'Planning' },
  { value: 'Active', label: 'Active' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export function ProjectForm({ isOpen, onClose, project }: ProjectFormProps) {
  const state = useAppStore((s) => s.getCurrentState());
  const systems = state.systems;
  const quarters = state.quarters;
  
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('Medium');
  const [status, setStatus] = useState<ProjectStatus>('Planning');
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [devopsLink, setDevopsLink] = useState('');
  const [phases, setPhases] = useState<Phase[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentQuarter = getCurrentQuarter();

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setName(project.name);
      setPriority(project.priority);
      setStatus(project.status);
      setSelectedSystems(project.systemIds || []);
      setDevopsLink(project.devopsLink || '');
      setPhases(project.phases || []);
    } else {
      setName('');
      setPriority('Medium');
      setStatus('Planning');
      setSelectedSystems([]);
      setDevopsLink('');
      setPhases([{
        id: generateId('phase'),
        name: 'Main',
        startQuarter: currentQuarter,
        endQuarter: currentQuarter,
        requiredSkillIds: [],
        predecessorPhaseId: null,
        assignments: [],
      }]);
    }
    setErrors({});
  }, [project, isOpen, currentQuarter]);

  const handleSystemToggle = (systemId: string) => {
    setSelectedSystems(prev =>
      prev.includes(systemId)
        ? prev.filter(id => id !== systemId)
        : [...prev, systemId]
    );
  };

  const handleAddPhase = () => {
    setPhases(prev => [...prev, {
      id: generateId('phase'),
      name: `Phase ${prev.length + 1}`,
      startQuarter: currentQuarter,
      endQuarter: currentQuarter,
      requiredSkillIds: [],
      predecessorPhaseId: null,
      assignments: [],
    }]);
  };

  const handlePhaseChange = (index: number, field: keyof Phase, value: string) => {
    setPhases(prev => prev.map((phase, i) =>
      i === index ? { ...phase, [field]: value } : phase
    ));
  };

  const handleRemovePhase = (index: number) => {
    if (phases.length > 1) {
      setPhases(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Project name is required';
    if (phases.length === 0) newErrors.phases = 'At least one phase is required';
    phases.forEach((phase, i) => {
      if (!phase.name.trim()) newErrors[`phase-${i}`] = 'Phase name is required';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const projectData = {
      name: name.trim(),
      priority,
      status,
      systemIds: selectedSystems,
      devopsLink: devopsLink.trim() || undefined,
      phases,
    };

    if (project) {
      updateProject(project.id, projectData);
    } else {
      addProject(projectData as Omit<Project, 'id'>);
    }

    onClose();
  };

  const quarterOptions = quarters.map(q => ({ value: q, label: q }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project ? 'Edit Project' : 'New Project'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {project ? 'Save Changes' : 'Create Project'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Basic Info */}
        <Input
          id="project-name"
          label="Project Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter project name"
          error={errors.name}
        />

        <div className="grid grid-cols-3 gap-4">
          <Select
            id="priority"
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as ProjectPriority)}
            options={priorityOptions}
          />
          <Select
            id="status"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            options={statusOptions}
          />
          <Input
            id="devops-link"
            label="DevOps Link"
            value={devopsLink}
            onChange={(e) => setDevopsLink(e.target.value)}
            placeholder="https://..."
          />
        </div>

        {/* Systems */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Systems
          </label>
          <div className="flex flex-wrap gap-2">
            {systems.map(system => (
              <button
                key={system.id}
                type="button"
                onClick={() => handleSystemToggle(system.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedSystems.includes(system.id)
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {system.name}
              </button>
            ))}
          </div>
        </div>

        {/* Phases */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Phases
            </label>
            <Button variant="ghost" size="sm" onClick={handleAddPhase}>
              <Plus size={14} />
              Add Phase
            </Button>
          </div>
          
          {errors.phases && (
            <p className="text-sm text-red-500 mb-2">{errors.phases}</p>
          )}
          
          <div className="space-y-3">
            {phases.map((phase, index) => (
              <div
                key={phase.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <Input
                      value={phase.name}
                      onChange={(e) => handlePhaseChange(index, 'name', e.target.value)}
                      placeholder="Phase name"
                      error={errors[`phase-${index}`]}
                    />
                    <Select
                      value={phase.startQuarter}
                      onChange={(e) => handlePhaseChange(index, 'startQuarter', e.target.value)}
                      options={quarterOptions}
                    />
                    <Select
                      value={phase.endQuarter}
                      onChange={(e) => handlePhaseChange(index, 'endQuarter', e.target.value)}
                      options={quarterOptions}
                    />
                  </div>
                  {phases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhase(index)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
