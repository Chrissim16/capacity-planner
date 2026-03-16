/**
 * ScenarioWizard — US-060
 *
 * 5-step narrative wizard for creating a scenario with a new project and tentative staffing.
 * Uses useReducer (Decision D11) to manage accumulating wizard state across steps.
 * Step 3 embeds SmartAssignmentPanel inline for live fit scoring.
 * Step 5 calls createScenarioWithPlan() which atomically creates the scenario + project + assignments.
 */

import { useReducer, useMemo, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, X, Check, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from './ui/Modal';
import { ConfirmModal } from './ui/ConfirmModal';
import { Button } from './ui/Button';
import { ProgressBar } from './ui/ProgressBar';
import { SmartAssignmentPanel } from './SmartAssignmentPanel';
import { useCurrentState, useActiveScenarioId, useScenarios } from '../stores/appStore';
import { createScenarioWithPlan, switchScenario } from '../stores/actions';
import { calculateCapacity } from '../utils/capacity';
import { useToast } from './ui/Toast';
import type { ProjectPriority } from '../types';
import type { TentativeAssignment } from '../utils/staffing';

// ─── Wizard state ─────────────────────────────────────────────────────────────

interface WizardState {
  step: number;
  name: string;
  priority: ProjectPriority;
  baseOn: 'baseline' | 'active';
  quarters: string[];
  daysPerQuarter: Record<string, number>;
  skillIds: string[];
  tentativeAssignments: TentativeAssignment[];
  submitting: boolean;
}

type WizardAction =
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_PRIORITY'; payload: ProjectPriority }
  | { type: 'SET_BASE_ON'; payload: 'baseline' | 'active' }
  | { type: 'SET_QUARTERS'; payload: string[] }
  | { type: 'SET_DAYS_PER_QUARTER'; payload: Record<string, number> }
  | { type: 'SET_SKILL_IDS'; payload: string[] }
  | { type: 'ADD_TENTATIVE'; payload: TentativeAssignment }
  | { type: 'REMOVE_TENTATIVE'; payload: { memberId: string } }
  | { type: 'RESET_TENTATIVE' }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_SUBMITTING'; payload: boolean };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_NAME':    return { ...state, name: action.payload };
    case 'SET_PRIORITY': return { ...state, priority: action.payload };
    case 'SET_BASE_ON': return { ...state, baseOn: action.payload };
    case 'SET_QUARTERS': return { ...state, quarters: action.payload };
    case 'SET_DAYS_PER_QUARTER': return { ...state, daysPerQuarter: action.payload };
    case 'SET_SKILL_IDS':
      // Skill changes invalidate Step 3 selections because fit scores change.
      return { ...state, skillIds: action.payload, tentativeAssignments: [] };
    case 'ADD_TENTATIVE': {
      const existing = state.tentativeAssignments.find(t => t.memberId === action.payload.memberId);
      if (existing) {
        return { ...state, tentativeAssignments: state.tentativeAssignments.map(t =>
          t.memberId === action.payload.memberId ? action.payload : t
        )};
      }
      return { ...state, tentativeAssignments: [...state.tentativeAssignments, action.payload] };
    }
    case 'REMOVE_TENTATIVE':
      return { ...state, tentativeAssignments: state.tentativeAssignments.filter(t => t.memberId !== action.payload.memberId) };
    case 'RESET_TENTATIVE': return { ...state, tentativeAssignments: [] };
    case 'SET_STEP':    return { ...state, step: action.payload };
    case 'SET_SUBMITTING': return { ...state, submitting: action.payload };
    default:            return state;
  }
}

const initialState: WizardState = {
  step: 1,
  name: '',
  priority: 'medium',
  baseOn: 'baseline',
  quarters: [],
  daysPerQuarter: {},
  skillIds: [],
  tentativeAssignments: [],
  submitting: false,
};

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEP_LABELS = ['Name', 'Define need', 'Who can staff?', 'Impact', 'Confirm'];

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={clsx(
            'rounded-full transition-all duration-200',
            i + 1 === current ? 'w-6 h-2 bg-[#0ED3CF]' : i + 1 < current ? 'w-2 h-2 bg-[#0ED3CF]/40' : 'w-2 h-2 bg-[#E5E5E3]'
          )}
        />
      ))}
    </div>
  );
}

// ─── ScenarioWizard ───────────────────────────────────────────────────────────

interface ScenarioWizardProps {
  onClose: () => void;
}

export function ScenarioWizard({ onClose }: ScenarioWizardProps) {
  const [wiz, dispatch] = useReducer(wizardReducer, initialState);
  const currentState = useCurrentState();
  const activeScenarioId = useActiveScenarioId();
  const scenarios = useScenarios();
  const { showToast } = useToast();

  const activeScenarioName = scenarios.find(s => s.id === activeScenarioId)?.name;
  const availableSkills = currentState.skills;
  const availableQuarters = currentState.quarters;

  // Dismiss confirm
  const [showDismissConfirm, setShowDismissConfirm] = (
    // eslint-disable-next-line react-hooks/rules-of-hooks
    [false, (v: boolean) => setShowDismissConfirmState(v)] as [boolean, (v: boolean) => void]
  );
  const [showDismissConfirmState, setShowDismissConfirmState] = useReducer(
    (_: boolean, v: boolean) => v, false
  );

  const handleClose = useCallback(() => {
    if (wiz.tentativeAssignments.length > 0) {
      setShowDismissConfirmState(true);
    } else {
      onClose();
    }
  }, [wiz.tentativeAssignments.length, onClose]);

  // Keyboard: Enter to advance
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
        if (wiz.step < 5 && canAdvance) dispatch({ type: 'SET_STEP', payload: wiz.step + 1 });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  const canAdvance = useMemo(() => {
    if (wiz.step === 1) return wiz.name.trim().length > 0;
    if (wiz.step === 2) return wiz.quarters.length > 0;
    return true;
  }, [wiz.step, wiz.name, wiz.quarters]);

  // Primary quarter for staffing (first selected)
  const primaryQuarter = wiz.quarters[0] ?? availableQuarters[0] ?? '';

  // ── Step 1 ────────────────────────────────────────────────────────────────
  const step1 = (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">
          Project name *
        </label>
        <input
          type="text"
          autoFocus
          value={wiz.name}
          onChange={e => dispatch({ type: 'SET_NAME', payload: e.target.value })}
          placeholder="e.g. ERP Migration Phase 2"
          className="w-full text-lg border-0 border-b-2 border-[#E5E5E3] focus:border-[#0ED3CF] outline-none py-2 bg-transparent text-[#1A1A1A] placeholder-[#D1D5DB] transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">Priority</label>
        <div className="flex gap-2 flex-wrap">
          {(['critical', 'high', 'medium', 'low'] as ProjectPriority[]).map(p => (
            <button
              key={p}
              onClick={() => dispatch({ type: 'SET_PRIORITY', payload: p })}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize',
                wiz.priority === p
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : 'bg-white text-[#6B7280] border-[#E5E5E3] hover:border-[#1A1A1A]'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Base on toggle — only shown when a scenario is active (D4) */}
      {activeScenarioId && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">Base on</label>
          <div className="flex gap-2">
            {(['baseline', 'active'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => dispatch({ type: 'SET_BASE_ON', payload: opt })}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm border transition-all',
                  wiz.baseOn === opt
                    ? 'bg-[#0ED3CF]/10 text-[#0ED3CF] border-[#0ED3CF]'
                    : 'bg-white text-[#6B7280] border-[#E5E5E3] hover:border-[#9CA3AF]'
                )}
              >
                {opt === 'baseline' ? 'Baseline' : `Current: ${activeScenarioName}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const step2 = (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">
          Quarters involved
        </label>
        <div className="flex flex-wrap gap-2">
          {availableQuarters.map(q => {
            const selected = wiz.quarters.includes(q);
            return (
              <button
                key={q}
                onClick={() => {
                  const newQ = selected ? wiz.quarters.filter(x => x !== q) : [...wiz.quarters, q];
                  dispatch({ type: 'SET_QUARTERS', payload: newQ });
                  if (!selected) {
                    dispatch({ type: 'SET_DAYS_PER_QUARTER', payload: { ...wiz.daysPerQuarter, [q]: wiz.daysPerQuarter[q] ?? 20 } });
                  } else {
                    const { [q]: _, ...rest } = wiz.daysPerQuarter;
                    dispatch({ type: 'SET_DAYS_PER_QUARTER', payload: rest });
                  }
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm border transition-all',
                  selected
                    ? 'bg-[#0ED3CF]/10 text-[#0ED3CF] border-[#0ED3CF]'
                    : 'bg-white text-[#6B7280] border-[#E5E5E3] hover:border-[#9CA3AF]'
                )}
              >
                {q}
              </button>
            );
          })}
        </div>
      </div>

      {wiz.quarters.length > 0 && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">
            Days required per quarter
          </label>
          <div className="space-y-3">
            {wiz.quarters.map(q => (
              <div key={q} className="flex items-center gap-3">
                <span className="text-sm text-[#6B7280] w-20 shrink-0">{q}</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={wiz.daysPerQuarter[q] ?? 20}
                  onChange={e => dispatch({
                    type: 'SET_DAYS_PER_QUARTER',
                    payload: { ...wiz.daysPerQuarter, [q]: parseInt(e.target.value, 10) || 0 }
                  })}
                  className="w-20 h-9 text-center text-sm rounded-lg border border-[#E5E5E3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ED3CF]"
                />
                <span className="text-sm text-[#9CA3AF]">days</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">
          Skills needed (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {availableSkills.map(skill => {
            const selected = wiz.skillIds.includes(skill.id);
            return (
              <button
                key={skill.id}
                onClick={() => {
                  const newIds = selected ? wiz.skillIds.filter(id => id !== skill.id) : [...wiz.skillIds, skill.id];
                  dispatch({ type: 'SET_SKILL_IDS', payload: newIds });
                }}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs border transition-all',
                  selected
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                    : 'bg-white text-[#6B7280] border-[#E5E5E3] hover:border-[#9CA3AF]'
                )}
              >
                {skill.name}
              </button>
            );
          })}
        </div>
        {availableSkills.length === 0 && (
          <p className="text-sm text-[#9CA3AF]">No skills configured. You can add them in Settings.</p>
        )}
      </div>
    </div>
  );

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const step3 = (
    <div>
      <p className="text-sm text-[#6B7280] mb-4">
        Select people to tentatively assign to <strong>{wiz.name}</strong> for {primaryQuarter}.
        Scores update live as you make selections.
      </p>
      <SmartAssignmentPanel
        variant="inline"
        projectId={`wizard-${wiz.name}`}
        projectName={wiz.name}
        defaultQuarter={primaryQuarter}
        requiredSkillIds={wiz.skillIds}
        tentativeAssignments={wiz.tentativeAssignments}
        onTentativeAssign={(memberId, days) =>
          dispatch({ type: 'ADD_TENTATIVE', payload: { memberId, days } })
        }
        onTentativeRemove={memberId =>
          dispatch({ type: 'REMOVE_TENTATIVE', payload: { memberId } })
        }
      />
    </div>
  );

  // ── Step 4 ────────────────────────────────────────────────────────────────
  const impactRows = useMemo(() => {
    return wiz.tentativeAssignments.map(ta => {
      const member = currentState.teamMembers.find(m => m.id === ta.memberId)
        ?? currentState.businessContacts.find(c => c.id === ta.memberId);
      const name = member ? member.name : ta.memberId;
      return wiz.quarters.map(q => {
        const before = calculateCapacity(ta.memberId, q, currentState);
        const afterUsed = Math.min(before.usedDays + ta.days, before.totalWorkdays + ta.days);
        const afterPct = before.totalWorkdays > 0
          ? Math.round((afterUsed / before.totalWorkdays) * 100) : 0;
        return { name, quarter: q, beforePct: before.usedPercent, afterPct };
      });
    }).flat();
  }, [wiz.tentativeAssignments, wiz.quarters, currentState]);

  const step4 = (
    <div className="space-y-4">
      <p className="text-sm text-[#6B7280]">
        Capacity impact of adding <strong>{wiz.name}</strong> for selected team members.
      </p>
      {impactRows.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] italic">No tentative assignments to show impact for.</p>
      ) : (
        <div className="space-y-4">
          {impactRows.map((row, i) => (
            <div key={i}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-[#1A1A1A]">{row.name}</span>
                <span className="text-xs text-[#9CA3AF]">{row.quarter}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#9CA3AF] w-10 text-right shrink-0">Before</span>
                  <ProgressBar value={row.beforePct} max={100} size="sm" className="flex-1" />
                  <span className="text-xs text-[#9CA3AF] w-8">{row.beforePct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#9CA3AF] w-10 text-right shrink-0">After</span>
                  <ProgressBar
                    value={row.afterPct}
                    max={100}
                    size="sm"
                    className="flex-1"
                    status={row.afterPct > 100 ? 'danger' : row.afterPct > 90 ? 'warning' : 'normal'}
                  />
                  <span className="text-xs font-medium w-8"
                    style={{ color: row.afterPct > 100 ? '#EF4444' : row.afterPct > 90 ? '#F97316' : '#22C55E' }}>
                    {row.afterPct}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Step 5 ────────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (wiz.submitting) return;
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    const result = createScenarioWithPlan({
      name: wiz.name,
      baseOn: wiz.baseOn,
      activeScenarioId,
      project: {
        name: wiz.name,
        priority: wiz.priority,
        requiredSkillIds: wiz.skillIds,
        daysPerQuarter: wiz.daysPerQuarter,
      },
      tentativeAssignments: wiz.tentativeAssignments.map(t => ({ ...t, isBizContact: false })),
      quarter: primaryQuarter,
    });

    if ('error' in result) {
      showToast(result.error, 'error');
      dispatch({ type: 'SET_SUBMITTING', payload: false });
    } else {
      switchScenario(result.scenarioId);
      showToast(`Scenario "${wiz.name}" created successfully!`, 'success');
      onClose();
    }
  }, [wiz, activeScenarioId, primaryQuarter, showToast, onClose]);

  const step5 = (
    <div className="space-y-5">
      <div className="bg-[#FAF9F7] rounded-xl p-4 space-y-3 border border-[#F0EFED]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#0ED3CF]" />
          <h3 className="text-base font-semibold text-[#1A1A1A]">{wiz.name}</h3>
          <span className="text-xs font-medium bg-[#E5E5E3] text-[#6B7280] px-2 py-0.5 rounded-full capitalize">{wiz.priority}</span>
        </div>
        <div className="text-sm text-[#6B7280] space-y-1">
          <p>Quarters: {wiz.quarters.join(', ') || '—'}</p>
          <p>Base on: {wiz.baseOn === 'active' ? `"${activeScenarioName}"` : 'Baseline'}</p>
          {wiz.skillIds.length > 0 && (
            <p>Skills needed: {wiz.skillIds.map(id => currentState.skills.find(s => s.id === id)?.name).filter(Boolean).join(', ')}</p>
          )}
        </div>
      </div>

      {wiz.tentativeAssignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">Assignments</p>
          <div className="space-y-1.5">
            {wiz.tentativeAssignments.map(ta => {
              const member = currentState.teamMembers.find(m => m.id === ta.memberId)
                ?? currentState.businessContacts.find(c => c.id === ta.memberId);
              return (
                <div key={ta.memberId} className="flex justify-between items-center text-sm">
                  <span className="text-[#1A1A1A]">{member?.name ?? ta.memberId}</span>
                  <span className="text-[#9CA3AF]">{ta.days}d · {primaryQuarter}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const steps = [step1, step2, step3, step4, step5];

  return (
    <>
      <Modal
        isOpen={true}
        onClose={handleClose}
        title={STEP_LABELS[wiz.step - 1]}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <StepDots current={wiz.step} total={5} />
            <div className="flex gap-2">
              {wiz.step > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => dispatch({ type: 'SET_STEP', payload: wiz.step - 1 })}
                >
                  <ArrowLeft size={14} />
                  Back
                </Button>
              )}
              {wiz.step < 5 ? (
                <Button
                  size="sm"
                  onClick={() => dispatch({ type: 'SET_STEP', payload: wiz.step + 1 })}
                  disabled={!canAdvance}
                >
                  Next
                  <ArrowRight size={14} />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={wiz.submitting}
                  isLoading={wiz.submitting}
                >
                  <Check size={14} />
                  Create Scenario
                </Button>
              )}
            </div>
          </div>
        }
      >
        {steps[wiz.step - 1]}
      </Modal>

      <ConfirmModal
        isOpen={showDismissConfirmState}
        onClose={() => setShowDismissConfirmState(false)}
        onConfirm={onClose}
        title="Discard changes?"
        message="You have unsaved staffing selections. Discard and close?"
        confirmLabel="Discard"
        variant="warning"
      />
    </>
  );
}
