import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { addProject, updateProject, generateId } from '../../stores/actions';
import { getCurrentQuarter } from '../../utils/calendar';
import type { Project, Phase, ProjectPriority, ProjectStatus, ConfidenceLevel } from '../../types';

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

const confidenceOptions = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function makeBlankPhase(n: number, currentQuarter: string, defaultConfidenceLevel: ConfidenceLevel): Phase {
  return {
    id: generateId('phase'),
    name: `Feature ${n}`,
    startQuarter: currentQuarter,
    endQuarter: currentQuarter,
    confidenceLevel: defaultConfidenceLevel,
    requiredSkillIds: [],
    predecessorPhaseId: null,
    assignments: [],
  };
}

export function ProjectForm({ isOpen, onClose, project }: ProjectFormProps) {
  const state = useCurrentState();
  const systems = state.systems;
  const quarters = state.quarters;
  const defaultConfidenceLevel = state.settings.confidenceLevels.defaultLevel;

  const currentQuarter = getCurrentQuarter();

  const [name, setName]               = useState('');
  const [priority, setPriority]       = useState<ProjectPriority>('Medium');
  const [status, setStatus]           = useState<ProjectStatus>('Planning');
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [devopsLink, setDevopsLink]   = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes]             = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [phases, setPhases]           = useState<Phase[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [errors, setErrors]           = useState<Record<string, string>>({});

  useEffect(() => {
    if (project) {
      setName(project.name);
      setPriority(project.priority);
      setStatus(project.status);
      setSelectedSystems(project.systemIds || []);
      setDevopsLink(project.devopsLink || '');
      setDescription(project.description || '');
      setNotes(project.notes || '');
      setStartDate(project.startDate || '');
      setEndDate(project.endDate || '');
      setPhases((project.phases || []).map((phase) => ({
        ...phase,
        confidenceLevel: phase.confidenceLevel ?? defaultConfidenceLevel,
      })));
    } else {
      setName('');
      setPriority('Medium');
      setStatus('Planning');
      setSelectedSystems([]);
      setDevopsLink('');
      setDescription('');
      setNotes('');
      setStartDate('');
      setEndDate('');
      setPhases([makeBlankPhase(1, currentQuarter, defaultConfidenceLevel)]);
    }
    setExpandedPhases(new Set());
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, isOpen]);

  const handleSystemToggle = (systemId: string) => {
    setSelectedSystems(prev =>
      prev.includes(systemId)
        ? prev.filter(id => id !== systemId)
        : [...prev, systemId]
    );
  };

  const handleAddPhase = () => {
    const newPhase = makeBlankPhase(phases.length + 1, currentQuarter, defaultConfidenceLevel);
    setPhases(prev => [...prev, newPhase]);
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

  const togglePhaseExpanded = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId); else next.add(phaseId);
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'This field is mandatory';
    if (phases.length === 0) newErrors.phases = 'At least one feature is required';
    phases.forEach((phase, i) => {
      if (!phase.name.trim()) newErrors[`phase-${i}`] = 'This field is mandatory';
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
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
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
      title={project ? 'Edit Epic' : 'New Epic'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {project ? 'Save Changes' : 'Create Epic'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Basic Info */}
        <Input
          id="project-name"
          label="Epic Name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
          }}
          placeholder="Enter epic name"
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

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="project-start"
            label="Start date (optional)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            id="project-end"
            label="End date (optional)"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this epic..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Decisions, blockers, or context..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Systems */}
        {systems.length > 0 && (
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
        )}

        {/* Features / Phases */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Features
            </label>
            <Button variant="ghost" size="sm" onClick={handleAddPhase}>
              <Plus size={14} />
              Add Feature
            </Button>
          </div>

          {errors.phases && (
            <p className="text-sm text-red-500 mb-2">{errors.phases}</p>
          )}

          <div className="space-y-2">
            {phases.map((phase, index) => {
              const isPhaseExpanded = expandedPhases.has(phase.id);
              return (
                <div
                  key={phase.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden"
                >
                  {/* Phase header row */}
                  <div className="flex items-start gap-3 p-3">
                    <button
                      type="button"
                      onClick={() => togglePhaseExpanded(phase.id)}
                      className="mt-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                    >
                      {isPhaseExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <Input
                        value={phase.name}
                        onChange={(e) => {
                          handlePhaseChange(index, 'name', e.target.value);
                          if (errors[`phase-${index}`]) setErrors(prev => ({ ...prev, [`phase-${index}`]: '' }));
                        }}
                        placeholder="Feature name"
                        required
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
                        className="mt-2 p-1 text-slate-400 hover:text-red-500 shrink-0 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {/* Expanded phase details: dates + notes */}
                  {isPhaseExpanded && (
                    <div className="px-10 pb-3 space-y-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          id={`phase-start-${index}`}
                          label="Start date (optional)"
                          type="date"
                          value={phase.startDate || ''}
                          onChange={(e) => handlePhaseChange(index, 'startDate', e.target.value)}
                        />
                        <Input
                          id={`phase-end-${index}`}
                          label="End date (optional)"
                          type="date"
                          value={phase.endDate || ''}
                          min={phase.startDate || undefined}
                          onChange={(e) => handlePhaseChange(index, 'endDate', e.target.value)}
                        />
                        <Select
                          id={`phase-confidence-${index}`}
                          label="Confidence"
                          value={phase.confidenceLevel ?? defaultConfidenceLevel}
                          onChange={(e) => handlePhaseChange(index, 'confidenceLevel', e.target.value)}
                          options={confidenceOptions}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                          Notes (optional)
                        </label>
                        <textarea
                          value={phase.notes || ''}
                          onChange={(e) => handlePhaseChange(index, 'notes', e.target.value)}
                          placeholder="Decisions, blockers, or context for this feature..."
                          rows={2}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
