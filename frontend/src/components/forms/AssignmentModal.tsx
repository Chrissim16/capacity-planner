import { useState, useEffect, useMemo } from 'react';
import { Calculator, AlertTriangle, Users, Calendar, Zap, Sparkles } from 'lucide-react';
import { suggestAssignees } from '../../application/assignmentSuggester';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { useCurrentState } from '../../stores/appStore';
import { setAssignment } from '../../stores/actions';
import { useToast } from '../ui/Toast';
import { calculateCapacity } from '../../utils/capacity';
import { getWorkWeeksInQuarter, getHolidaysByCountry } from '../../utils/calendar';
import { generateSprints, getSprintsForQuarter, getWorkdaysInSprint, formatDateRange } from '../../utils/sprints';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Pre-selection props (optional)
  projectId?: string;
  phaseId?: string;
  memberId?: string;
  quarter?: string;
}

export function AssignmentModal({ 
  isOpen, 
  onClose, 
  projectId: initialProjectId,
  phaseId: initialPhaseId,
  memberId: initialMemberId,
  quarter: initialQuarter
}: AssignmentModalProps) {
  const state = useCurrentState();
  const { projects, teamMembers, quarters, publicHolidays, settings } = state;
  const { showToast } = useToast();
  
  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [assignmentLevel, setAssignmentLevel] = useState<'quarter' | 'sprint'>('quarter');
  const [days, setDays] = useState(0);
  const [daysPerWeek, setDaysPerWeek] = useState(0);
  const [inputMode, setInputMode] = useState<'days' | 'weekly'>('days');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Generate sprints based on settings
  const allSprints = useMemo(() => generateSprints(settings, 2), [settings]);
  
  // Get sprints for selected quarter
  const sprintsInQuarter = useMemo(() => {
    if (!selectedQuarter) return [];
    return getSprintsForQuarter(selectedQuarter, allSprints);
  }, [selectedQuarter, allSprints]);
  
  // Get selected sprint object
  const selectedSprintObj = useMemo(() => {
    if (!selectedSprint) return null;
    return allSprints.find(s => s.id === selectedSprint) || null;
  }, [selectedSprint, allSprints]);

  // Reset form when modal opens or pre-selections change
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId(initialProjectId || '');
      setSelectedPhaseId(initialPhaseId || '');
      setSelectedMemberIds(initialMemberId ? [initialMemberId] : []);
      setSelectedQuarter(initialQuarter || quarters[0] || '');
      setSelectedSprint('');
      setAssignmentLevel('quarter');
      setDays(0);
      setDaysPerWeek(0);
      setInputMode('days');
      setErrors({});
    }
  }, [isOpen, initialProjectId, initialPhaseId, initialMemberId, initialQuarter, quarters]);

  // Get selected project and phase
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedPhase = selectedProject?.phases.find(ph => ph.id === selectedPhaseId);

  // Calculate work weeks/days for selected quarter or sprint
  const { workWeeks, workDays } = useMemo(() => {
    if (selectedMemberIds.length === 0) return { workWeeks: 13, workDays: 65 };
    
    const firstMember = teamMembers.find(m => m.id === selectedMemberIds[0]);
    if (!firstMember) return { workWeeks: 13, workDays: 65 };
    
    const holidays = getHolidaysByCountry(firstMember.countryId, publicHolidays);
    
    if (assignmentLevel === 'sprint' && selectedSprintObj) {
      // Sprint-level: calculate workdays in sprint
      const sprintWorkdays = getWorkdaysInSprint(selectedSprintObj, holidays);
      return { 
        workWeeks: sprintWorkdays / 5, 
        workDays: sprintWorkdays 
      };
    } else if (selectedQuarter) {
      // Quarter-level
      const weeks = getWorkWeeksInQuarter(selectedQuarter, holidays);
      return { workWeeks: weeks, workDays: weeks * 5 };
    }
    
    return { workWeeks: 13, workDays: 65 };
  }, [selectedQuarter, selectedMemberIds, teamMembers, publicHolidays, assignmentLevel, selectedSprintObj]);

  // Convert between days and weekly
  useEffect(() => {
    if (inputMode === 'weekly') {
      setDays(Math.round(daysPerWeek * workWeeks * 10) / 10);
    }
  }, [daysPerWeek, workWeeks, inputMode]);

  useEffect(() => {
    if (inputMode === 'days' && workWeeks > 0) {
      setDaysPerWeek(Math.round((days / workWeeks) * 10) / 10);
    }
  }, [days, workWeeks, inputMode]);

  // Calculate capacity preview for selected members
  const capacityPreviews = useMemo(() => {
    return selectedMemberIds.map(memberId => {
      const member = teamMembers.find(m => m.id === memberId);
      if (!member || !selectedQuarter) return null;
      
      const currentCapacity = calculateCapacity(memberId, selectedQuarter, state);
      const afterCapacity = {
        ...currentCapacity,
        usedDays: currentCapacity.usedDays + days,
        usedPercent: currentCapacity.totalWorkdays > 0 
          ? Math.round(((currentCapacity.usedDays + days) / currentCapacity.totalWorkdays) * 100)
          : 0,
      };
      
      return {
        member,
        current: currentCapacity,
        after: afterCapacity,
        isOverallocated: afterCapacity.usedDays > currentCapacity.totalWorkdays,
      };
    }).filter(Boolean);
  }, [selectedMemberIds, selectedQuarter, days, state, teamMembers]);

  // Toggle member selection
  const toggleMember = (memberId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
    if (errors.members) setErrors(prev => ({ ...prev, members: '' }));
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedProjectId) newErrors.project = 'This field is mandatory';
    if (!selectedPhaseId) newErrors.phase = 'This field is mandatory';
    if (!selectedQuarter) newErrors.quarter = 'This field is mandatory';
    if (assignmentLevel === 'sprint' && !selectedSprint) newErrors.sprint = 'This field is mandatory';
    if (selectedMemberIds.length === 0) newErrors.members = 'Select at least one team member';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;

    // Create assignments for each selected member
    const sprintName = assignmentLevel === 'sprint' && selectedSprintObj 
      ? `${selectedSprintObj.name} ${selectedSprintObj.year}` 
      : undefined;
    
    selectedMemberIds.forEach(memberId => {
      setAssignment(selectedProjectId, selectedPhaseId, memberId, selectedQuarter, days, sprintName);
    });

    // Warn if any member will be overallocated
    const overallocated = capacityPreviews.filter(p => p?.isOverallocated);
    if (overallocated.length > 0) {
      const names = overallocated.map(p => p!.member.name).join(', ');
      showToast(
        overallocated.length === 1
          ? `⚠ ${names} is over-allocated in ${selectedQuarter}`
          : `⚠ ${overallocated.length} members over-allocated in ${selectedQuarter}: ${names}`,
        'warning'
      );
    }

    onClose();
  };

  // Options
  const projectOptions = [
    { value: '', label: 'Select epic...' },
    ...projects
      .filter(p => p.status !== 'Completed')
      .map(p => ({ value: p.id, label: p.name })),
  ];

  const phaseOptions = [
    { value: '', label: 'Select feature...' },
    ...(selectedProject?.phases.map(ph => ({ value: ph.id, label: ph.name })) || []),
  ];

  const quarterOptions = quarters.map(q => ({ value: q, label: q }));

  // Smart suggestions (US-052/053) — shown when project + phase + quarter are selected
  const suggestions = useMemo(() => {
    if (!selectedProjectId || !selectedPhaseId || !selectedQuarter) return [];
    const phase = projects.find(p => p.id === selectedProjectId)
      ?.phases.find(ph => ph.id === selectedPhaseId);
    return suggestAssignees({
      projectId: selectedProjectId,
      phaseId: selectedPhaseId,
      quarter: selectedQuarter,
      requiredSkillIds: phase?.requiredSkillIds ?? [],
      state,
    }).slice(0, 3);
  }, [selectedProjectId, selectedPhaseId, selectedQuarter, projects, state]);

  const hasOverallocation = capacityPreviews.some(p => p?.isOverallocated);
  const canSave = selectedProjectId && selectedPhaseId && selectedMemberIds.length > 0 && selectedQuarter;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Team Members"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!canSave}
            variant={hasOverallocation ? 'warning' : 'primary'}
          >
            {hasOverallocation && <AlertTriangle size={16} />}
            {selectedMemberIds.length > 1 
              ? `Assign ${selectedMemberIds.length} Members` 
              : 'Save Assignment'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Project & Phase Selection */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            id="assign-project"
            label="Epic"
            required
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedPhaseId('');
              if (errors.project) setErrors(prev => ({ ...prev, project: '' }));
            }}
            options={projectOptions}
            error={errors.project}
          />
          <Select
            id="assign-phase"
            label="Feature"
            required
            value={selectedPhaseId}
            onChange={(e) => {
              setSelectedPhaseId(e.target.value);
              if (errors.phase) setErrors(prev => ({ ...prev, phase: '' }));
            }}
            options={phaseOptions}
            disabled={!selectedProjectId}
            error={errors.phase}
          />
        </div>

        {/* Assignment Level Toggle & Time Period Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Assignment Level
            </label>
            <div className="flex rounded-lg bg-slate-200 dark:bg-slate-700 p-0.5">
              <button
                onClick={() => {
                  setAssignmentLevel('quarter');
                  setSelectedSprint('');
                }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  assignmentLevel === 'quarter'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Calendar size={14} />
                Quarter
              </button>
              <button
                onClick={() => setAssignmentLevel('sprint')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  assignmentLevel === 'sprint'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Zap size={14} />
                Sprint
              </button>
            </div>
          </div>

          <div className={assignmentLevel === 'sprint' ? 'grid grid-cols-2 gap-4' : ''}>
            <Select
              id="assign-quarter"
              label="Quarter"
              required
              value={selectedQuarter}
              onChange={(e) => {
                setSelectedQuarter(e.target.value);
                setSelectedSprint(''); // Reset sprint when quarter changes
                if (errors.quarter) setErrors(prev => ({ ...prev, quarter: '' }));
              }}
              options={quarterOptions}
              error={errors.quarter}
            />
            
            {assignmentLevel === 'sprint' && (
              <Select
                id="assign-sprint"
                label="Sprint"
                required
                value={selectedSprint}
                onChange={(e) => {
                  setSelectedSprint(e.target.value);
                  if (errors.sprint) setErrors(prev => ({ ...prev, sprint: '' }));
                }}
                options={[
                  { value: '', label: 'Select sprint...' },
                  ...sprintsInQuarter.map(s => ({ 
                    value: s.id, 
                    label: `${s.name} (${formatDateRange(s.startDate, s.endDate)})` 
                  })),
                ]}
                error={errors.sprint}
                disabled={!selectedQuarter || sprintsInQuarter.length === 0}
              />
            )}
          </div>
          
          {assignmentLevel === 'sprint' && selectedSprintObj && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sprint duration: {settings.sprintDurationWeeks} weeks ({workDays} workdays)
            </p>
          )}
        </div>

        {/* Days Input with Weekly Calculator */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Calculator size={18} />
              Allocation
            </h3>
            <div className="flex rounded-lg bg-slate-200 dark:bg-slate-700 p-0.5">
              <button
                onClick={() => setInputMode('days')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  inputMode === 'days'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Total Days
              </button>
              <button
                onClick={() => setInputMode('weekly')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  inputMode === 'weekly'
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Days/Week
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {inputMode === 'days' ? (
              <>
                <Input
                  id="assign-days"
                  label="Total Days"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={days}
                  onChange={(e) => setDays(parseFloat(e.target.value) || 0)}
                />
                <div className="flex flex-col justify-end">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ≈ <strong>{daysPerWeek}</strong> days/week
                    <br />
                    <span className="text-xs">
                      ({workWeeks.toFixed(1)} work weeks in {assignmentLevel === 'sprint' && selectedSprintObj ? selectedSprintObj.name : selectedQuarter})
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <Input
                  id="assign-weekly"
                  label="Days per Week"
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(parseFloat(e.target.value) || 0)}
                />
                <div className="flex flex-col justify-end">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    = <strong>{days}</strong> total days
                    <br />
                    <span className="text-xs">
                      ({workWeeks.toFixed(1)} work weeks × {daysPerWeek} d/wk)
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Quick allocation buttons */}
          <div className="flex flex-wrap gap-2">
            {[0.5, 1, 2, 3, 4, 5].map(d => (
              <button
                key={d}
                onClick={() => {
                  setInputMode('weekly');
                  setDaysPerWeek(d);
                }}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  daysPerWeek === d
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {d}d/wk
              </button>
            ))}
          </div>
        </div>

        {/* Smart Suggestions (US-053) */}
        {suggestions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-500" />
              Suggested
            </label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {suggestions.map(s => {
                const isSelected = selectedMemberIds.includes(s.member.id);
                return (
                  <button
                    key={s.member.id}
                    onClick={() => toggleMember(s.member.id)}
                    className={`flex flex-col items-start p-3 rounded-lg text-left text-sm transition-colors border-2 ${
                      isSelected
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-yellow-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                        {s.member.name}
                      </span>
                      <span className={`ml-1 shrink-0 text-xs font-bold px-1.5 py-0.5 rounded ${
                        s.score >= 70
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : s.score >= 40
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {s.score}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-full">
                      {s.member.role}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.reasons.map(r => (
                        <span key={r} className="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                          {r}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Team Member Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            <Users size={16} />
            {suggestions.length > 0 ? 'All Members' : 'Select Team Members'}
            <span className="text-red-500">*</span>
          </label>
          <div className={`grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border-2 rounded-lg ${
            errors.members 
              ? 'border-red-500 ring-red-500/20 ring-2' 
              : 'border-slate-200 dark:border-slate-700'
          }`}>
            {teamMembers.map(member => {
              const isSelected = selectedMemberIds.includes(member.id);
              const cap = selectedQuarter
                ? calculateCapacity(member.id, selectedQuarter, state)
                : null;
              const availableDays = cap ? cap.totalWorkdays - cap.usedDays : null;
              const capStatus = cap
                ? cap.usedDays / cap.totalWorkdays > 0.9 ? 'high'
                  : cap.usedDays / cap.totalWorkdays > 0.7 ? 'medium'
                  : 'low'
                : 'low';
              return (
                <button
                  key={member.id}
                  onClick={() => toggleMember(member.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                      : 'bg-slate-50 dark:bg-slate-800 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{member.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
                    {availableDays !== null && (
                      <p className={`text-xs font-medium mt-0.5 ${
                        availableDays <= 0 ? 'text-red-500 dark:text-red-400'
                        : capStatus === 'high' ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                      }`}>
                        {availableDays <= 0
                          ? 'No capacity'
                          : `${availableDays.toFixed(0)}d available`}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {errors.members && (
            <p className="mt-2 text-sm text-red-500 font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.members}
            </p>
          )}
          {selectedMemberIds.length > 0 && (
            <p className="mt-2 text-sm text-slate-500">
              {selectedMemberIds.length} member{selectedMemberIds.length > 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* Capacity Preview — always visible once members are selected */}
        {capacityPreviews.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={16} />
              {days > 0 ? `Capacity after allocation (${selectedQuarter})` : `Current capacity (${selectedQuarter})`}
            </label>
            <div className="space-y-2">
              {capacityPreviews.map(preview => {
                if (!preview) return null;
                const { member, current, after, isOverallocated } = preview;
                return (
                  <div 
                    key={member.id}
                    className={`p-3 rounded-lg ${
                      isOverallocated 
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                        : 'bg-slate-50 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{member.name}</span>
                      <div className="flex items-center gap-2 text-sm">
                        {days > 0 && (
                          <>
                            <span className="text-slate-500">{current.usedDays.toFixed(1)}d</span>
                            <span className="text-slate-400">→</span>
                          </>
                        )}
                        <span className={isOverallocated ? 'text-red-600 font-medium' : 'text-slate-700 dark:text-slate-200'}>
                          {(days > 0 ? after.usedDays : current.usedDays).toFixed(1)}d
                        </span>
                        <span className="text-slate-400">/ {current.totalWorkdays}d</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          isOverallocated
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : (days > 0 ? after.usedPercent : current.usedPercent) > 90
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {isOverallocated ? 'Over' : `${(days > 0 ? after.usedPercent : current.usedPercent)}%`}
                        </span>
                      </div>
                    </div>
                    <ProgressBar 
                      value={days > 0 ? after.usedDays : current.usedDays}
                      max={current.totalWorkdays}
                      status={isOverallocated ? 'danger' : (days > 0 ? after.usedPercent : current.usedPercent) > 90 ? 'warning' : 'normal'}
                      size="sm"
                    />
                    {days > 0 && !isOverallocated && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {(current.totalWorkdays - after.usedDays).toFixed(1)}d remaining after this allocation
                      </p>
                    )}
                    {isOverallocated && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Over-allocated by {(after.usedDays - current.totalWorkdays).toFixed(1)} days
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase info */}
        {selectedPhase && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
            <p className="text-blue-700 dark:text-blue-300">
              <strong>{selectedProject?.name}</strong> → {selectedPhase.name}
            </p>
            <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
              Feature runs: {selectedPhase.startQuarter} – {selectedPhase.endQuarter}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
