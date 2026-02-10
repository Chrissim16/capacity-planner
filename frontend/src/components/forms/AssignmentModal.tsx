import { useState, useEffect, useMemo } from 'react';
import { Calculator, AlertTriangle, Users, Calendar } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { useAppStore } from '../../stores/appStore';
import { setAssignment } from '../../stores/actions';
import { calculateCapacity } from '../../utils/capacity';
import { getWorkWeeksInQuarter, getHolidaysByCountry } from '../../utils/calendar';

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
  const state = useAppStore((s) => s.getCurrentState());
  const { projects, teamMembers, quarters, publicHolidays } = state;
  
  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [days, setDays] = useState(0);
  const [daysPerWeek, setDaysPerWeek] = useState(0);
  const [inputMode, setInputMode] = useState<'days' | 'weekly'>('days');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens or pre-selections change
  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId(initialProjectId || '');
      setSelectedPhaseId(initialPhaseId || '');
      setSelectedMemberIds(initialMemberId ? [initialMemberId] : []);
      setSelectedQuarter(initialQuarter || quarters[0] || '');
      setDays(0);
      setDaysPerWeek(0);
      setInputMode('days');
      setErrors({});
    }
  }, [isOpen, initialProjectId, initialPhaseId, initialMemberId, initialQuarter, quarters]);

  // Get selected project and phase
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedPhase = selectedProject?.phases.find(ph => ph.id === selectedPhaseId);

  // Calculate work weeks for selected quarter (using first selected member's country)
  const workWeeks = useMemo(() => {
    if (!selectedQuarter || selectedMemberIds.length === 0) return 13; // Default
    const firstMember = teamMembers.find(m => m.id === selectedMemberIds[0]);
    if (!firstMember) return 13;
    const holidays = getHolidaysByCountry(firstMember.countryId, publicHolidays);
    return getWorkWeeksInQuarter(selectedQuarter, holidays);
  }, [selectedQuarter, selectedMemberIds, teamMembers, publicHolidays]);

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
    if (selectedMemberIds.length === 0) newErrors.members = 'Select at least one team member';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validate()) return;

    // Create assignments for each selected member
    selectedMemberIds.forEach(memberId => {
      setAssignment(selectedProjectId, selectedPhaseId, memberId, selectedQuarter, days);
    });

    onClose();
  };

  // Options
  const projectOptions = [
    { value: '', label: 'Select project...' },
    ...projects
      .filter(p => p.status !== 'Completed')
      .map(p => ({ value: p.id, label: p.name })),
  ];

  const phaseOptions = [
    { value: '', label: 'Select phase...' },
    ...(selectedProject?.phases.map(ph => ({ value: ph.id, label: ph.name })) || []),
  ];

  const quarterOptions = quarters.map(q => ({ value: q, label: q }));

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
            label="Project"
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
            label="Phase"
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

        {/* Quarter Selection */}
        <Select
          id="assign-quarter"
          label="Quarter"
          required
          value={selectedQuarter}
          onChange={(e) => {
            setSelectedQuarter(e.target.value);
            if (errors.quarter) setErrors(prev => ({ ...prev, quarter: '' }));
          }}
          options={quarterOptions}
          error={errors.quarter}
        />

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
                    <span className="text-xs">({workWeeks.toFixed(1)} work weeks in {selectedQuarter})</span>
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
                    <span className="text-xs">({workWeeks.toFixed(1)} work weeks × {daysPerWeek} d/wk)</span>
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

        {/* Team Member Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            <Users size={16} />
            Select Team Members
            <span className="text-red-500">*</span>
          </label>
          <div className={`grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border-2 rounded-lg ${
            errors.members 
              ? 'border-red-500 ring-red-500/20 ring-2' 
              : 'border-slate-200 dark:border-slate-700'
          }`}>
            {teamMembers.map(member => {
              const isSelected = selectedMemberIds.includes(member.id);
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
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{member.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
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

        {/* Capacity Preview */}
        {capacityPreviews.length > 0 && days > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={16} />
              Capacity Preview ({selectedQuarter})
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
                        <span className="text-slate-500">{current.usedDays.toFixed(1)}d</span>
                        <span className="text-slate-400">→</span>
                        <span className={isOverallocated ? 'text-red-600 font-medium' : 'text-slate-700 dark:text-slate-200'}>
                          {after.usedDays.toFixed(1)}d
                        </span>
                        <span className="text-slate-400">/ {current.totalWorkdays}d</span>
                      </div>
                    </div>
                    <ProgressBar 
                      value={after.usedDays} 
                      max={current.totalWorkdays}
                      status={isOverallocated ? 'danger' : after.usedPercent > 90 ? 'warning' : 'normal'}
                      size="sm"
                    />
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
              Phase runs: {selectedPhase.startQuarter} – {selectedPhase.endQuarter}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
