import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Trash2, Plus, ChevronDown, ChevronRight, Users, X } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { addProject, updateProject, generateId, upsertBusinessAssignment, removeBusinessAssignment } from '../../stores/actions';
import { getCurrentQuarter, getPhaseRange } from '../../utils/calendar';
import type { Project, Phase, ProjectPriority, ProjectStatus, ConfidenceLevel, BusinessAssignment } from '../../types';

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
  const businessContacts = state.businessContacts;

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

  // Business commitments: keyed by phaseId
  const [bizCommitments, setBizCommitments] = useState<Record<string, BusinessAssignment[]>>({});
  const [openBizPanel, setOpenBizPanel] = useState<string | null>(null);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [bizContactId, setBizContactId] = useState('');
  const [bizDays, setBizDays]           = useState('');
  const [bizNotes, setBizNotes]         = useState('');
  const [removedBizIds, setRemovedBizIds] = useState<string[]>([]);

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
      const existing: Record<string, BusinessAssignment[]> = {};
      for (const a of state.businessAssignments.filter(a => a.projectId === project.id)) {
        if (a.phaseId) {
          existing[a.phaseId] = [...(existing[a.phaseId] ?? []), a];
        }
      }
      setBizCommitments(existing);
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
      setBizCommitments({});
    }
    setExpandedPhases(new Set());
    setErrors({});
    setOpenBizPanel(null);
    setShowAddForm(false);
    setRemovedBizIds([]);
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

  const toggleBizPanel = (phaseId: string) => {
    if (openBizPanel === phaseId) {
      setOpenBizPanel(null);
      setShowAddForm(false);
    } else {
      setOpenBizPanel(phaseId);
      setShowAddForm(false);
      setBizContactId('');
      setBizDays('');
      setBizNotes('');
    }
  };

  const contactsForProject = businessContacts.filter(c =>
    !c.projectIds?.length || c.projectIds.includes(project?.id ?? '__new__')
  );

  const handleAddBizCommitment = (phaseId: string) => {
    const days = parseFloat(bizDays);
    if (!bizContactId || isNaN(days) || days <= 0) return;
    const newEntry: BusinessAssignment = {
      id: generateId('biz-assign'),
      contactId: bizContactId,
      projectId: project?.id ?? '__pending__',
      phaseId,
      days,
      notes: bizNotes.trim() || undefined,
    };
    setBizCommitments(prev => ({ ...prev, [phaseId]: [...(prev[phaseId] ?? []), newEntry] }));
    setShowAddForm(false);
    setBizContactId('');
    setBizDays('');
    setBizNotes('');
  };

  const handleUpdateBizCommitmentDays = (phaseId: string, id: string, days: number) => {
    setBizCommitments(prev => ({
      ...prev,
      [phaseId]: (prev[phaseId] ?? []).map(b => b.id === id ? { ...b, days } : b),
    }));
  };

  const handleRemoveBizCommitment = (phaseId: string, id: string) => {
    setBizCommitments(prev => ({
      ...prev,
      [phaseId]: (prev[phaseId] ?? []).filter(b => b.id !== id),
    }));
    if (!id.includes('__pending__')) {
      setRemovedBizIds(prev => [...prev, id]);
    }
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

    let savedProjectId: string;
    if (project) {
      updateProject(project.id, projectData);
      savedProjectId = project.id;
    } else {
      const created = addProject(projectData as Omit<Project, 'id'>);
      savedProjectId = created.id;
    }

    for (const id of removedBizIds) {
      removeBusinessAssignment(id);
    }
    for (const phaseId of Object.keys(bizCommitments)) {
      for (const bc of bizCommitments[phaseId]) {
        const phase = phases.find(p => p.id === phaseId);
        let quarter = bc.quarter;
        if (!quarter && phase) {
          const range = getPhaseRange(phase);
          if (range) {
            const d = new Date(range.start + 'T00:00:00');
            const q = Math.floor(d.getMonth() / 3) + 1;
            quarter = `Q${q} ${d.getFullYear()}`;
          }
        }
        upsertBusinessAssignment({ ...bc, projectId: savedProjectId, phaseId, quarter });
      }
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
              const isBizOpen = openBizPanel === phase.id;
              const phaseCommitments = bizCommitments[phase.id] ?? [];
              const totalBizDays = phaseCommitments.reduce((s, b) => s + b.days, 0);

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

                    {/* BIZ chip — always visible */}
                    <button
                      type="button"
                      onClick={() => toggleBizPanel(phase.id)}
                      title={phaseCommitments.length > 0
                        ? `Business commitments: ${phaseCommitments.length} contact${phaseCommitments.length !== 1 ? 's' : ''}, ${totalBizDays}d`
                        : 'Assign business contact'}
                      className={`mt-1.5 shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        phaseCommitments.length > 0
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                          : 'border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-purple-300 dark:hover:border-purple-600 hover:text-purple-500 dark:hover:text-purple-400'
                      }`}
                    >
                      <Users size={11} />
                      {phaseCommitments.length > 0
                        ? `BIZ: ${phaseCommitments.length} · ${totalBizDays}d`
                        : '+ BIZ'}
                    </button>

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

                  {/* BIZ panel — inline, below header */}
                  {isBizOpen && (
                    <BizPanel
                      commitments={phaseCommitments}
                      contacts={contactsForProject}
                      businessContacts={businessContacts}
                      showAddForm={showAddForm}
                      bizContactId={bizContactId}
                      bizDays={bizDays}
                      bizNotes={bizNotes}
                      onShowAddForm={() => { setShowAddForm(true); setBizContactId(''); setBizDays(''); setBizNotes(''); }}
                      onHideAddForm={() => setShowAddForm(false)}
                      onContactChange={setBizContactId}
                      onDaysChange={setBizDays}
                      onNotesChange={setBizNotes}
                      onAdd={() => handleAddBizCommitment(phase.id)}
                      onRemove={(id) => handleRemoveBizCommitment(phase.id, id)}
                      onUpdateDays={(id, days) => handleUpdateBizCommitmentDays(phase.id, id, days)}
                      onClose={() => { setOpenBizPanel(null); setShowAddForm(false); }}
                    />
                  )}

                  {/* Expanded phase details: dates, notes, confidence */}
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

/* ─── BIZ panel (inline, below feature row header) ──────────────────────────── */

interface BizPanelProps {
  commitments: BusinessAssignment[];
  contacts: ReturnType<typeof useCurrentState>['businessContacts'];
  businessContacts: ReturnType<typeof useCurrentState>['businessContacts'];
  showAddForm: boolean;
  bizContactId: string;
  bizDays: string;
  bizNotes: string;
  onShowAddForm: () => void;
  onHideAddForm: () => void;
  onContactChange: (v: string) => void;
  onDaysChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdateDays: (id: string, days: number) => void;
  onClose: () => void;
}

function BizPanel({
  commitments,
  contacts,
  businessContacts,
  showAddForm,
  bizContactId,
  bizDays,
  bizNotes,
  onShowAddForm,
  onHideAddForm,
  onContactChange,
  onDaysChange,
  onNotesChange,
  onAdd,
  onRemove,
  onUpdateDays,
  onClose,
}: BizPanelProps) {
  return (
    <div className="mx-3 mb-3">
    <div className="w-72 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 shadow-md">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-100 dark:border-purple-800/50">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
          <Users size={11} />
          Business commitment
        </span>
        <div className="flex items-center gap-2">
          {!showAddForm && (
            <button
              type="button"
              onClick={onShowAddForm}
              className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors"
            >
              + Add
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {/* Existing commitments */}
        {commitments.length === 0 && !showAddForm && (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-1 italic">
            {contacts.length === 0
              ? 'Add contacts in Settings → Reference Data first.'
              : 'None yet — click + Add to assign.'}
          </p>
        )}

        {commitments.map(bc => {
          const contact = businessContacts.find(c => c.id === bc.contactId);
          return (
            <div key={bc.id} className="flex items-center gap-2 py-1 rounded px-1 hover:bg-purple-100/50 dark:hover:bg-purple-900/20 group">
              <span className="flex-1 min-w-0 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                {contact?.name ?? bc.contactId}
                {contact?.title && <span className="font-normal text-slate-400 dark:text-slate-500"> — {contact.title}</span>}
              </span>
              <input
                type="number"
                min={0}
                step={0.5}
                defaultValue={bc.days ?? 0}
                onBlur={e => onUpdateDays(bc.id, parseFloat(e.target.value) || 0)}
                className="shrink-0 w-14 text-xs font-bold text-purple-700 dark:text-purple-300 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-purple-400"
                title="Days committed — click to edit"
              />
              {bc.notes && (
                <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[100px]" title={bc.notes}>
                  {bc.notes}
                </span>
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

        {/* Total summary */}
        {commitments.length > 1 && (
          <div className="text-[10px] text-purple-500 dark:text-purple-400 font-medium pt-0.5 border-t border-purple-100 dark:border-purple-800/50">
            {commitments.reduce((s, b) => s + b.days, 0)}d total across {commitments.length} contacts
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="mt-2 pt-2 border-t border-purple-100 dark:border-purple-800/50 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Contact</label>
                <select
                  value={bizContactId}
                  onChange={e => onContactChange(e.target.value)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select contact…</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ''}</option>
                  ))}
                </select>
                {contacts.length === 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">Add contacts in Settings → Reference Data first.</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Days committed</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={bizDays}
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
                value={bizNotes}
                onChange={e => onNotesChange(e.target.value)}
                placeholder="e.g. UAT sign-off, data validation…"
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onHideAddForm} className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={onAdd}
                disabled={!bizContactId || !bizDays}
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
