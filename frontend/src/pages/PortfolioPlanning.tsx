/**
 * PortfolioPlanning — phase-level effort planning for Jira Epics.
 *
 * Three tabs: Epic View (Gantt with phase bars), People View (per-person
 * utilisation + assignment bars), Summary (KPI cards + compact Gantt +
 * capacity alerts table).
 *
 * All styling lives in PortfolioPlanning.css, scoped under .pp-root.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCurrentState, useAppStore } from '../stores/appStore';
import { useShallow } from 'zustand/react/shallow';
import { calculateCapacity, calculateBusinessCapacityForQuarter } from '../utils/capacity';
import { getEffectiveSkills } from '../utils/workItemSkills';
import {
  getPortfolioQuarterOpts,
  getRollingPortfolioQuarterOpts,
  genWeeksForQOpt,
  calcWeekW,
  dToX,
  dToW,
  dayToDateStr,
  todayDayOffset,
  calcBarWidthDays,
  phaseBarWidthDays,
  totalDaysFromAssignment,
  weeksBetween,
  dateToDay,
  dayToIsoDate,
  PHASES,
  PH_KEY,
  PH_LBL,
  PH_SHORT,
  type QOpt,
  type PortfolioWeek,
} from '../utils/portfolioGeometry';
import { usePortfolioPlan } from '../hooks/usePortfolioPlan';
import {
  createPortfolioScenario,
  updatePortfolioScenario,
  deleteScenario,
  type PortfolioScenarioSnapshot,
} from '../stores/actions';
import { AddManualEpicModal } from './AddManualEpicModal';
import type {
  JiraWorkItem,
  TeamMember,
  BusinessContact,
  PlanningPhase,
  EpicPhasePlan,
  EpicPhaseAssignment,
  AllocationMode,
  AllocationSegment,
  ProcessTeam,
  BusinessTeam,
  ManualEpic,
  Scenario,
} from '../types';
import './PortfolioPlanning.css';

// ── Portfolio scenarios (what-if plans) ──────────────────────────────────────
const ACTIVE_SCENARIO_KEY = 'pp.activeScenarioId';

function loadActiveScenarioId(): string | null {
  try { return localStorage.getItem(ACTIVE_SCENARIO_KEY) ?? null; } catch { return null; }
}
function saveActiveScenarioId(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_SCENARIO_KEY);
    else localStorage.setItem(ACTIVE_SCENARIO_KEY, id);
  } catch {}
}

function isPortfolioScenario(scenario: Scenario): boolean {
  return scenario.isPortfolioScenario === true;
}

function teamEntryForId(id: string): { name: string; abbr: string } {
  const name = id.replace('TEAM:', '');
  const abbr = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || name.slice(0, 2).toUpperCase();
  return { name, abbr };
}

function manualToJiraWorkItem(m: ManualEpic): JiraWorkItem {
  return {
    id:              `manual-${m.epicKey}`,
    connectionId:    'manual',
    jiraKey:         m.epicKey,
    jiraId:          m.epicKey,
    summary:         m.summary,
    description:     m.description,
    type:            'epic',
    typeName:        'Manual Epic',
    status:          'Manual',
    statusCategory:  'todo',
    labels:          [],
    components:      [],
    created:         '',
    updated:         '',
  };
}

// ── Avatar color palette ───────────────────────────────────────────────────────
const AV_PALETTE = [
  '#0089DD','#7C3AED','#D97706','#16A34A','#DB2777',
  '#1D6FE8','#059669','#D97706','#7C3AED','#DB2777','#64748B',
];
function avColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF;
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length];
}
function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// ── Util tier ─────────────────────────────────────────────────────────────────
function utilTier(pct: number): string {
  if (pct > 1)    return 'over';
  if (pct > 0.85) return 'near';
  if (pct > 0.05) return 'ok';
  return 'bench';
}

type PhasePlansByType = Map<PlanningPhase, EpicPhasePlan[]>;
type PhaseAssignmentsByInstance = Map<string, EpicPhaseAssignment[]>;

interface PhaseInstanceRow {
  phase: PlanningPhase;
  phaseInstanceId: string;
  phaseOrder: number;
  plan: EpicPhasePlan | null;
  assignments: EpicPhaseAssignment[];
}

type PhasePlanChanges = {
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
};

function getDefaultPhaseInstanceId(phase: PlanningPhase): string {
  return phase;
}

function getPhaseDisplayLabel(phase: PlanningPhase, phaseOrder: number): string {
  return phaseOrder > 0 ? `${PH_LBL[phase]} ${phaseOrder + 1}` : PH_LBL[phase];
}

function getPhaseInstanceRows(
  plansByType: PhasePlansByType,
  assignmentsByInstance: PhaseAssignmentsByInstance,
): PhaseInstanceRow[] {
  const rows: PhaseInstanceRow[] = [];

  for (const phase of PHASES) {
    const plans = [...(plansByType.get(phase) ?? [])].sort((a, b) => a.phaseOrder - b.phaseOrder);
    const instanceIds = new Set<string>(plans.map(plan => plan.phaseInstanceId));

    for (const [phaseInstanceId, assignments] of assignmentsByInstance.entries()) {
      if (assignments[0]?.phase === phase) instanceIds.add(phaseInstanceId);
    }

    if (instanceIds.size === 0) {
      rows.push({
        phase,
        phaseInstanceId: getDefaultPhaseInstanceId(phase),
        phaseOrder: 0,
        plan: null,
        assignments: [],
      });
      continue;
    }

    const sortedInstanceIds = [...instanceIds].sort((a, b) => {
      const planA = plans.find(plan => plan.phaseInstanceId === a);
      const planB = plans.find(plan => plan.phaseInstanceId === b);
      const orderA = planA?.phaseOrder ?? (a === getDefaultPhaseInstanceId(phase) ? 0 : Number.MAX_SAFE_INTEGER);
      const orderB = planB?.phaseOrder ?? (b === getDefaultPhaseInstanceId(phase) ? 0 : Number.MAX_SAFE_INTEGER);
      return orderA - orderB || a.localeCompare(b);
    });

    for (const [idx, phaseInstanceId] of sortedInstanceIds.entries()) {
      const plan = plans.find(item => item.phaseInstanceId === phaseInstanceId) ?? null;
      rows.push({
        phase,
        phaseInstanceId,
        phaseOrder: plan?.phaseOrder ?? idx,
        plan,
        assignments: assignmentsByInstance.get(phaseInstanceId) ?? [],
      });
    }
  }

  return rows;
}

function getCapacityQuarters(qOpt: QOpt): string[] {
  if (qOpt.q === -1) {
    return [0, 1, 2, 3].map(q => `Q${q + 1} ${qOpt.year}`);
  }
  return [`Q${qOpt.q + 1} ${qOpt.year}`];
}

function calculateMemberAvailableDays(
  memberId: string,
  qOpt: QOpt,
  state: ReturnType<typeof useCurrentState>,
): number {
  return getCapacityQuarters(qOpt)
    .reduce((sum, quarter) => sum + calculateCapacity(memberId, quarter, state).availableDays, 0);
}

function calculateBusinessAvailableDays(
  contact: BusinessContact,
  qOpt: QOpt,
  state: ReturnType<typeof useCurrentState>,
): number {
  return getCapacityQuarters(qOpt).reduce((sum, quarter) => (
    sum + calculateBusinessCapacityForQuarter(
      contact,
      quarter,
      state.jiraItemBizAssignments,
      state.businessTimeOff,
      state.publicHolidays,
      state.jiraWorkItems,
    ).availableDays
  ), 0);
}

// ── Absence lookup (time-off days in visible period) ───────────────────────────
function buildAbsenceLookup(
  qOpt: QOpt,
  members: TeamMember[],
  state: ReturnType<typeof useCurrentState>,
): Record<string, number> {
  const lookup: Record<string, number> = {};
  for (const m of members) {
    const toDays = getCapacityQuarters(qOpt).reduce((sum, quarter) => {
      const cap = calculateCapacity(m.id, quarter, state);
      return sum + cap.breakdown
        .filter(b => b.type === 'timeoff')
        .reduce((s, b) => s + b.days, 0);
    }, 0);
    lookup[m.id] = toDays;
  }
  return lookup;
}

// ── GANTT HEADER (shared between Epic and People views) ───────────────────────
function GanttHeader({ weeks, totalW }: { weeks: PortfolioWeek[]; totalW: number }) {
  const months: { label: string; count: number }[] = [];
  let cur: string | null = null;
  for (const w of weeks) {
    if (w.month !== cur) { months.push({ label: w.month, count: 1 }); cur = w.month; }
    else months[months.length - 1].count++;
  }
  return (
    <div className="pp-g-head" style={{ minWidth: totalW }}>
      <div className="pp-g-months">
        {months.map((m, i) => (
          <div key={i} className="pp-g-month" style={{ width: `calc(var(--week-w) * ${m.count})` }}>
            {m.label}
          </div>
        ))}
      </div>
      <div className="pp-g-weeks">
        {weeks.map(w => (
          <div key={w.idx} className={`pp-g-week${w.isMonthStart ? ' ms' : ''}${w.isTodayWeek ? ' today-week' : ''}`}>
            <span className="pp-g-wnum">W{w.num}</span>
            <span className="pp-g-wdate">{w.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GRID BACKGROUND ───────────────────────────────────────────────────────────
function GridBg({ weeks }: { weeks: PortfolioWeek[] }) {
  return (
    <div className="pp-g-grid">
      {weeks.map(w => (
        <div key={w.idx} className={`pp-g-col${w.isMonthStart ? ' ms' : ''}${w.isTodayWeek ? ' today-col' : ''}`} />
      ))}
    </div>
  );
}

// ── TODAY LINE ────────────────────────────────────────────────────────────────
function TodayLine({ tStart, totalW, dayW }: { tStart: Date; totalW: number; dayW: number }) {
  const x = dToX(todayDayOffset(tStart), dayW);
  if (x < 0 || x > totalW) return null;
  return <div className="pp-today-line" style={{ left: x }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLOCATION EDITOR
// ─────────────────────────────────────────────────────────────────────────────

function AllocEditor({
  assign, phaseStartDate, phaseEndDate,
  onClose, onUpdateDays, onUpdateMode, onUpsertSegment, onRemoveSegment,
}: {
  assign: EpicPhaseAssignment;
  phaseStartDate: string | null;
  phaseEndDate: string | null;
  onClose: () => void;
  onUpdateDays: (days: number) => void;
  onUpdateMode: (mode: AllocationMode, daysPerWeek?: number) => void;
  onUpsertSegment: (seg: AllocationSegment) => void;
  onRemoveSegment: (segmentId: string) => void;
}) {
  const mode = assign.allocationMode ?? 'flat';
  const segs = assign.segments ?? [];

  const computedTotal = mode === 'rate' && assign.daysPerWeek && phaseStartDate && phaseEndDate
    ? Math.round(assign.daysPerWeek * weeksBetween(phaseStartDate, phaseEndDate) * 10) / 10
    : null;

  const addSegment = () => {
    const today = new Date().toISOString().slice(0, 10);
    onUpsertSegment({
      id: `local-seg-${Date.now()}`,
      startDate: phaseStartDate ?? today,
      endDate:   phaseEndDate   ?? today,
      days: 1,
    });
  };

  return (
    <div className="ev-alloc-editor" onClick={e => e.stopPropagation()}>
      <div className="ev-alloc-mode-tabs">
        <button className={`ev-alloc-tab${mode === 'flat' ? ' on' : ''}`}
          onClick={() => onUpdateMode('flat')}>Flat</button>
        <button className={`ev-alloc-tab${mode === 'rate' ? ' on' : ''}`}
          onClick={() => onUpdateMode('rate', assign.daysPerWeek ?? 1)}>Rate</button>
        <button className={`ev-alloc-tab${mode === 'segments' ? ' on' : ''}`}
          onClick={() => onUpdateMode('segments')}>Segments</button>
      </div>

      {mode === 'flat' && (
        <div className="ev-alloc-flat">
          <input
            type="number" min="0" step="0.5"
            defaultValue={assign.days}
            autoFocus
            onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onUpdateDays(v); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.currentTarget.blur(); onClose(); } }}
          />
          <span className="ev-alloc-unit">d total</span>
        </div>
      )}

      {mode === 'rate' && (
        <div className="ev-alloc-rate">
          <input
            type="number" min="0.5" step="0.5"
            defaultValue={assign.daysPerWeek ?? 1}
            autoFocus
            onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onUpdateMode('rate', v); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.currentTarget.blur(); onClose(); } }}
          />
          <span className="ev-alloc-unit">d/wk</span>
          {computedTotal !== null && (
            <span className="ev-alloc-computed">≈ {computedTotal}d total</span>
          )}
        </div>
      )}

      {mode === 'segments' && (
        <div className="ev-alloc-segs">
          {segs.map(seg => (
            <div key={seg.id} className="ev-seg-row">
              <input type="date" defaultValue={seg.startDate}
                onBlur={e => onUpsertSegment({ ...seg, startDate: e.target.value })} />
              <span className="ev-seg-arrow">→</span>
              <input type="date" defaultValue={seg.endDate}
                onBlur={e => onUpsertSegment({ ...seg, endDate: e.target.value })} />
              <input type="number" min="0.5" step="0.5" defaultValue={seg.days}
                onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onUpsertSegment({ ...seg, days: v }); }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <span className="ev-alloc-unit">d</span>
              <button className="ev-seg-remove" onClick={() => onRemoveSegment(seg.id)}>×</button>
            </div>
          ))}
          <button className="ev-seg-add" onClick={addSegment}>+ Add segment</button>
        </div>
      )}

      <button className="ev-alloc-done" onClick={onClose}>Done</button>
    </div>
  );
}

function PhaseEditorPopover({
  startDate,
  endDate,
  description,
  onCommit,
  onClose,
}: {
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  onCommit: (changes: PhasePlanChanges) => void;
  onClose: () => void;
}) {
  const [draftStartDate, setDraftStartDate] = useState(startDate ?? '');
  const [draftEndDate, setDraftEndDate] = useState(endDate ?? '');
  const [draftDescription, setDraftDescription] = useState(description ?? '');

  const commitAndClose = useCallback(() => {
    const changes: PhasePlanChanges = {};
    const normalizedDescription = draftDescription.trim();
    if (draftStartDate !== (startDate ?? '')) changes.startDate = draftStartDate || null;
    if (draftEndDate !== (endDate ?? '')) changes.endDate = draftEndDate || null;
    if (normalizedDescription !== (description ?? '')) changes.description = normalizedDescription || null;
    if ('startDate' in changes || 'endDate' in changes || 'description' in changes) onCommit(changes);
    onClose();
  }, [description, draftDescription, draftEndDate, draftStartDate, endDate, onClose, onCommit, startDate]);

  return (
    <div
      className="ph-editor-popover"
      onClick={e => e.stopPropagation()}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitAndClose();
      }}
      onKeyDown={e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          commitAndClose();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="ph-editor-grid">
        <label className="ph-editor-field">
          <span>Start date</span>
          <input
            type="date"
            value={draftStartDate}
            autoFocus
            onChange={e => setDraftStartDate(e.target.value)}
          />
        </label>
        <label className="ph-editor-field">
          <span>End date</span>
          <input
            type="date"
            value={draftEndDate}
            onChange={e => setDraftEndDate(e.target.value)}
          />
        </label>
      </div>
      <label className="ph-editor-field ph-editor-notes">
        <span>Description</span>
        <textarea
          value={draftDescription}
          onChange={e => setDraftDescription(e.target.value)}
          rows={4}
          placeholder="Add context for this phase"
        />
      </label>
      <div className="ph-editor-actions">
        <button className="ph-editor-btn subtle" onClick={onClose} type="button">Cancel</button>
        <button className="ph-editor-btn primary" onClick={commitAndClose} type="button">Save</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EPIC VIEW
// ─────────────────────────────────────────────────────────────────────────────
interface EpicViewProps {
  boardEpics:    JiraWorkItem[];
  phasePlansMap: Map<string, PhasePlansByType>;
  assignMap:     Map<string, PhaseAssignmentsByInstance>;
  absenceLookup: Record<string, number>;
  memberMap:     Map<string, TeamMember>;
  contactMap:    Map<string, BusinessContact>;
  weeks:         PortfolioWeek[];
  tStart:        Date;
  dayW:          number;
  panelWidth:    number;
  epicCollapsed: Record<string, boolean>;
  phasePersonCollapsed: Record<string, boolean>;
  onToggleEpic:  (key: string) => void;
  onTogglePhasePersons: (epicKey: string, phaseInstanceId: string) => void;
  onRemoveEpic:  (key: string) => void;
  onAddPhaseInstance: (epicKey: string, phase: PlanningPhase) => void;
  onRemovePhaseInstance: (epicKey: string, phaseInstanceId: string) => void;
  onSetPhaseStart: (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, weekIdx: number) => void;
  onDragPhaseStart: (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, e: React.MouseEvent) => void;
  onDragPhaseEnd:   (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, e: React.MouseEvent) => void;
  onClearPhase:  (epicKey: string, phase: PlanningPhase, phaseInstanceId: string) => void;
  onRemoveAssignment: (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string) => void;
  onUpdateDays:  (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, days: number) => void;
  onUpdateAllocationMode: (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, mode: AllocationMode, daysPerWeek?: number) => void;
  onUpsertSegment: (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, seg: AllocationSegment) => void;
  onRemoveSegment: (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, segmentId: string) => void;
  onUpdatePhasePlan: (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, changes: PhasePlanChanges) => void;
  onAddPerson:   (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, rect: DOMRect) => void;
  onExpandAll:   () => void;
  onCollapseAll: () => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  lpRef:         React.RefObject<HTMLDivElement | null>;
  ganttRef:      React.RefObject<HTMLDivElement | null>;
  onTimelineScroll: (el: HTMLDivElement) => void;
  personOverloadMap: Map<string, 'over' | 'near'>;
  allJiraItems: JiraWorkItem[];
  jiraBaseUrl: string;
}

function EpicView({
  boardEpics, phasePlansMap, assignMap, absenceLookup, memberMap, contactMap,
  weeks, tStart, dayW, panelWidth,
  epicCollapsed, phasePersonCollapsed,
  onToggleEpic, onTogglePhasePersons, onRemoveEpic, onAddPhaseInstance, onRemovePhaseInstance, onSetPhaseStart,
  onDragPhaseStart, onDragPhaseEnd, onClearPhase, onRemoveAssignment,
  onUpdateDays, onUpdateAllocationMode, onUpsertSegment, onRemoveSegment,
  onUpdatePhasePlan, onAddPerson,
  onExpandAll, onCollapseAll, onResizeMouseDown, lpRef, ganttRef,
  onTimelineScroll,
  personOverloadMap, allJiraItems, jiraBaseUrl,
}: EpicViewProps) {
  const totalW = weeks.length * (dayW * 5);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingPhaseKey, setEditingPhaseKey] = useState<string | null>(null);
  const bottomScrollbarRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollSyncRef = useRef<'gantt' | 'bottom' | null>(null);

  const syncGanttFromLp = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (ganttRef.current) ganttRef.current.scrollTop = e.currentTarget.scrollTop;
  }, [ganttRef]);
  const syncLpFromGantt = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (horizontalScrollSyncRef.current === 'bottom') {
      horizontalScrollSyncRef.current = null;
    } else if (bottomScrollbarRef.current && bottomScrollbarRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
      horizontalScrollSyncRef.current = 'gantt';
      bottomScrollbarRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    if (lpRef.current) lpRef.current.scrollTop = e.currentTarget.scrollTop;
    onTimelineScroll(e.currentTarget);
  }, [ganttRef, lpRef, onTimelineScroll]);
  const syncGanttFromBottomScrollbar = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (horizontalScrollSyncRef.current === 'gantt') {
      horizontalScrollSyncRef.current = null;
      return;
    }
    if (ganttRef.current && ganttRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
      horizontalScrollSyncRef.current = 'bottom';
      ganttRef.current.scrollLeft = e.currentTarget.scrollLeft;
      onTimelineScroll(ganttRef.current);
    }
  }, [ganttRef, onTimelineScroll]);

  useEffect(() => {
    if (ganttRef.current && bottomScrollbarRef.current && bottomScrollbarRef.current.scrollLeft !== ganttRef.current.scrollLeft) {
      bottomScrollbarRef.current.scrollLeft = ganttRef.current.scrollLeft;
    }
  }, [ganttRef, totalW]);

  if (!boardEpics.length) {
    return (
      <div className="pp-view on">
        <div className="pp-lp" style={{ width: panelWidth }}>
          <div className="pp-lp-hd"><span className="pp-lp-hd-label">Epic · Phase · Person</span></div>
          <div className="pp-empty-state">
            <div className="pp-empty-icon">◈</div>
            <div className="pp-empty-title">No Epics added yet</div>
            <div className="pp-empty-sub">Click <strong>+ Add Epics</strong> to select Epics from Jira, or <strong>+ Create Manual Epic</strong> (inside the drawer) to add one manually.</div>
          </div>
        </div>
        <div className="pp-lp-resize" onMouseDown={onResizeMouseDown} />
        <div className="pp-rp"><div className="pp-rp-scroll" /></div>
      </div>
    );
  }

  const lpRows: React.ReactNode[] = [];
  const ganttRows: React.ReactNode[] = [];

  for (const epic of boardEpics) {
    const epicKey  = epic.jiraKey;
    const phPlans  = phasePlansMap.get(epicKey) ?? new Map<PlanningPhase, EpicPhasePlan[]>();
    const phAssign = assignMap.get(epicKey)     ?? new Map<string, EpicPhaseAssignment[]>();
    const phaseRows = getPhaseInstanceRows(phPlans, phAssign);
    const collapsed = epicCollapsed[epicKey] ?? false;
    const epicRequiredSkills = getEffectiveSkills(epic, allJiraItems);

    const totalDays = phaseRows.reduce((sum, row) => sum + row.assignments.reduce((acc, assignment) => acc + assignment.days, 0), 0);

    // ── Epic row
    lpRows.push(
      <div key={`e-${epicKey}`} className="ev-epic" onClick={() => onToggleEpic(epicKey)}>
        <span className={`pp-chev${collapsed ? '' : ' open'}`}>▶</span>
        {jiraBaseUrl && !epicKey.startsWith('MAN-')
          ? <a href={`${jiraBaseUrl}/browse/${epicKey}`} target="_blank" rel="noopener noreferrer" className="pp-jkey">{epicKey}</a>
          : <span className="pp-jkey">{epicKey}</span>
        }
        <span className="ev-epic-name">{epic.summary}</span>
        {totalDays > 0 && <span className="ev-epic-total">{totalDays}d</span>}
        <button className="ev-epic-remove" onClick={e => { e.stopPropagation(); onRemoveEpic(epicKey); }}>×</button>
      </div>
    );

    // Epic Gantt row — phase summary bars
    ganttRows.push(
      <div key={`ge-${epicKey}`} className="pp-g-epic" style={{ minWidth: totalW }}>
        <GridBg weeks={weeks} />
        <TodayLine tStart={tStart} totalW={totalW} dayW={dayW} />
        {phaseRows.map(row => {
          const phasePlan = row.plan;
          const ph = row.phase;
          const startDate = phasePlan?.startDate ?? null;
          if (!startDate) return null;
          const startDay = dateToDay(startDate, tStart);
          const assignments = row.assignments;
          const barW = phasePlan ? (phaseBarWidthDays(phasePlan, tStart) ?? calcBarWidthDays(assignments, absenceLookup)) : calcBarWidthDays(assignments, absenceLookup);
          if (barW <= 0) return null;
          const shortLabel = row.phaseOrder > 0 ? `${PH_SHORT[ph]} ${row.phaseOrder + 1}` : PH_SHORT[ph];
          const label = barW >= 4 ? `${shortLabel} ${barW}d` : `${barW}d`;
          const overTier = assignments.some(a => personOverloadMap.get(a.memberId) === 'over') ? 'over'
            : assignments.some(a => personOverloadMap.get(a.memberId) === 'near') ? 'near'
            : null;
          return (
            <div
              key={row.phaseInstanceId}
              className={`pp-pbar ${PH_KEY[ph]}${overTier === 'over' ? ' overloaded' : overTier === 'near' ? ' near-cap' : ''}`}
              style={{ left: dToX(startDay, dayW), width: dToW(barW, dayW) }}
              onMouseDown={e => onDragPhaseStart(epicKey, ph, row.phaseInstanceId, e)}
            >
              {label}
            </div>
          );
        })}
      </div>
    );

    if (!collapsed) {
      for (const row of phaseRows) {
        const ph = row.phase;
        const phasePlan  = row.plan;
        const startDate  = phasePlan?.startDate ?? null;
        const endDate    = phasePlan?.endDate ?? null;
        const startDay   = startDate !== null ? dateToDay(startDate, tStart) : null;
        const assignments = row.assignments;
        const barW       = phasePlan ? (phaseBarWidthDays(phasePlan, tStart) ?? calcBarWidthDays(assignments, absenceLookup)) : calcBarWidthDays(assignments, absenceLookup);
        const hasStart   = startDay !== null;
        const hasEnd     = endDate !== null;
        const hasBar     = hasStart && barW > 0;
        const phKey      = `${epicKey}_${row.phaseInstanceId}`;
        const pCollapsed = phasePersonCollapsed[phKey] ?? false;
        const totalPhDays = assignments.reduce((s, a) => s + totalDaysFromAssignment(a, startDate, endDate), 0);
        const isDuplicate = row.phaseOrder > 0;
        const description = phasePlan?.description?.trim() ?? '';
        const descriptionPreview = description.length > 56 ? `${description.slice(0, 56)}...` : description;

        let dateStr = 'No start date set';
        let durStr  = '';
        if (startDay !== null) {
          const endLabel = endDate
            ? dayToDateStr(dateToDay(endDate, tStart), tStart)
            : hasBar ? dayToDateStr(startDay + barW, tStart) : '…';
          dateStr = `${dayToDateStr(startDay, tStart)} → ${endLabel}`;
          if (hasBar && startDate && endDate) {
            const wks = weeksBetween(startDate, endDate);
            durStr = `${wks}wk`;
          } else if (hasBar) {
            durStr = `${barW}d`;
          }
        }

        // Phase left-panel row
        lpRows.push(
          <div key={`p-${phKey}`} className={`ev-phase${isDuplicate ? ' duplicate' : ''}`} onClick={() => { if (editingPhaseKey !== phKey) onTogglePhasePersons(epicKey, row.phaseInstanceId); }}>
            <button className="ph-add" onClick={e => { e.stopPropagation(); onAddPhaseInstance(epicKey, ph); }} title={`Add another ${PH_LBL[ph]} phase`}>+</button>
            <span className={`pp-chev ph-expand${pCollapsed ? '' : ' open'}`}>▶</span>
            <span className={`pp-ph-label ${PH_KEY[ph]}`}>{getPhaseDisplayLabel(ph, row.phaseOrder)}</span>
            {editingPhaseKey === phKey ? (
              <PhaseEditorPopover
                startDate={startDate}
                endDate={endDate}
                description={phasePlan?.description ?? null}
                onCommit={changes => onUpdatePhasePlan(epicKey, ph, row.phaseInstanceId, changes)}
                onClose={() => setEditingPhaseKey(null)}
              />
            ) : (
              <button
                className="ph-edit-trigger"
                onClick={e => { e.stopPropagation(); setEditingPhaseKey(phKey); }}
                title="Edit phase details"
                type="button"
              >
                <span className={`ph-dates${hasStart ? ' set' : ''}`}>{dateStr}</span>
                {descriptionPreview && <span className="ph-desc-preview">{descriptionPreview}</span>}
              </button>
            )}
            {editingPhaseKey !== phKey && (
              <button className="ph-edit-btn" onClick={e => { e.stopPropagation(); setEditingPhaseKey(phKey); }} title="Edit phase details" type="button">Edit</button>
            )}
            {editingPhaseKey !== phKey && durStr && <span className="ph-dur">{durStr}</span>}
            {editingPhaseKey !== phKey && <span className="ph-total">{totalPhDays > 0 ? `${Math.round(totalPhDays * 10) / 10}d` : ''}</span>}
            {editingPhaseKey !== phKey && (
              isDuplicate
                ? <button className="ph-remove" onClick={e => { e.stopPropagation(); onRemovePhaseInstance(epicKey, row.phaseInstanceId); }} title="Remove this phase">×</button>
                : hasStart
                  ? <button className="ph-remove" onClick={e => { e.stopPropagation(); onClearPhase(epicKey, ph, row.phaseInstanceId); }} title="Clear dates">×</button>
                  : null
            )}
          </div>
        );

        // Phase Gantt row
        if (!hasStart) {
          ganttRows.push(
            <div key={`gp-${phKey}`} className="pp-g-phase empty-phase" style={{ minWidth: totalW }}>
              <GridBg weeks={weeks} />
              <TodayLine tStart={tStart} totalW={totalW} dayW={dayW} />
              <div className="pp-g-click-cols">
                {weeks.map((_, i) => (
                  <div key={i} className="pp-g-click-col" onClick={() => onSetPhaseStart(epicKey, ph, row.phaseInstanceId, i)} />
                ))}
              </div>
              <div className="pp-set-start-hint">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                </svg>
                Click a week to set start date
              </div>
            </div>
          );
        } else {
          const overTier = assignments.some(a => personOverloadMap.get(a.memberId) === 'over') ? 'over'
            : assignments.some(a => personOverloadMap.get(a.memberId) === 'near') ? 'near'
            : null;
          const barLabel = barW >= 4 ? `${PH_SHORT[ph]} ${barW}d` : `${barW}d`;
          ganttRows.push(
            <div key={`gp-${phKey}`} className="pp-g-phase" style={{ minWidth: totalW }}>
              <GridBg weeks={weeks} />
              <TodayLine tStart={tStart} totalW={totalW} dayW={dayW} />
              <div
                className={`pp-pbar ${PH_KEY[ph]}${overTier === 'over' ? ' overloaded' : overTier === 'near' ? ' near-cap' : ''}${!hasEnd ? ' no-end' : ''}`}
                style={{ left: dToX(startDay!, dayW), width: dToW(barW, dayW) }}
                onMouseDown={e => onDragPhaseStart(epicKey, ph, row.phaseInstanceId, e)}
              >
                {barLabel}
                <div
                  className="pp-pbar-end-handle"
                  onMouseDown={e => { e.stopPropagation(); onDragPhaseEnd(epicKey, ph, row.phaseInstanceId, e); }}
                  title="Drag to set end date"
                />
              </div>
            </div>
          );
        }

        // Person rows (if phase section expanded)
        if (!pCollapsed) {
          for (const assign of assignments) {
            const isTeam   = assign.memberId.startsWith('TEAM:');
            const member   = isTeam ? undefined : memberMap.get(assign.memberId);
            const contact  = isTeam ? undefined : contactMap.get(assign.memberId);
            const name     = member?.name ?? contact?.name ?? assign.memberId;
            const role     = member?.role ?? contact?.title ?? '';
            const rowKey   = `${phKey}_${assign.memberId}`;
            const isEditing = editingKey === rowKey;

            // Person Gantt row — allocation visualization
            const allocBarStartDay = startDay ?? 0;
            ganttRows.push(
              <div key={`gperson-${phKey}-${assign.memberId}`} className="pp-g-person" style={{ minWidth: totalW, position: 'relative' }}>
                <GridBg weeks={weeks} />
                <TodayLine tStart={tStart} totalW={totalW} dayW={dayW} />
                {hasStart && barW > 0 && assign.allocationMode !== 'segments' && (
                  <div
                    className={`pp-alloc-bar${assign.allocationMode === 'rate' ? ' rate' : ''}`}
                    style={{ left: dToX(allocBarStartDay, dayW), width: dToW(barW, dayW) }}
                    title={assign.allocationMode === 'rate' ? `${assign.daysPerWeek}d/wk` : `${assign.days}d`}
                  >
                    <span className="pp-alloc-bar-label">
                      {assign.allocationMode === 'rate' ? `${assign.daysPerWeek}d/wk` : `${assign.days}d`}
                    </span>
                  </div>
                )}
                {assign.allocationMode === 'segments' && (assign.segments ?? []).map(seg => {
                  const segStart = dateToDay(seg.startDate, tStart);
                  const segEnd   = dateToDay(seg.endDate,   tStart);
                  return (
                    <div
                      key={seg.id}
                      className="pp-alloc-chip"
                      style={{ left: dToX(segStart, dayW), width: dToW(Math.max(1, segEnd - segStart), dayW) }}
                      title={`${seg.days}d: ${seg.startDate} → ${seg.endDate}`}
                    >
                      {seg.days}d
                    </div>
                  );
                })}
              </div>
            );

            // Skill match tier for IT team members
            let skillTier: 'matched' | 'partial' | 'missing' | null = null;
            if (!isTeam && member && epicRequiredSkills.length > 0) {
              const matched = epicRequiredSkills.filter(s => member.skillIds.includes(s));
              skillTier = matched.length === epicRequiredSkills.length ? 'matched'
                : matched.length > 0 ? 'partial'
                : 'missing';
            }

            // Build the avatar + name/role part depending on team vs person
            let avatarEl: React.ReactNode;
            let nameEl: React.ReactNode;
            if (isTeam) {
              const { name: teamName, abbr } = teamEntryForId(assign.memberId);
              avatarEl = <div className="pp-av team">{abbr}</div>;
              nameEl = (
                <>
                  <span className="ev-pname">{teamName} Team</span>
                  <span className="pp-picker-badge team">Team</span>
                </>
              );
            } else {
              avatarEl = <div className="pp-av" style={{ background: avColor(assign.memberId) }}>{initials(name)}</div>;
              nameEl = (
                <>
                  <span className="ev-pname">{name}</span>
                  <span className="ev-prole">{role}</span>
                  {skillTier && (
                    <span
                      className={`pp-skill-dot ${skillTier}`}
                      title={
                        skillTier === 'matched' ? 'All required skills matched'
                        : skillTier === 'partial' ? 'Partial skill match'
                        : 'Required skills missing'
                      }
                    />
                  )}
                </>
              );
            }

            // Mode-aware days label
            const daysLabel = assign.allocationMode === 'rate'
              ? `${assign.daysPerWeek ?? 0}d/wk`
              : assign.allocationMode === 'segments'
                ? `${assign.days}d · ${(assign.segments ?? []).length}seg`
                : `${assign.days}d`;

            lpRows.push(
              <div key={`person-${phKey}-${assign.memberId}`} className={`ev-person${isEditing ? ' editing' : ''}`}>
                {avatarEl}
                {nameEl}
                {isEditing ? (
                  <AllocEditor
                    assign={assign}
                    phaseStartDate={startDate}
                    phaseEndDate={endDate}
                    onClose={() => setEditingKey(null)}
                    onUpdateDays={days => onUpdateDays(epicKey, ph, row.phaseInstanceId, assign.memberId, days)}
                    onUpdateMode={(mode, dpw) => onUpdateAllocationMode(epicKey, ph, row.phaseInstanceId, assign.memberId, mode, dpw)}
                    onUpsertSegment={seg => onUpsertSegment(epicKey, ph, row.phaseInstanceId, assign.memberId, seg)}
                    onRemoveSegment={segId => onRemoveSegment(epicKey, ph, row.phaseInstanceId, assign.memberId, segId)}
                  />
                ) : (
                  <span className="ev-days" onClick={() => setEditingKey(rowKey)}>{daysLabel}</span>
                )}
                {!isEditing && (
                  <button className="ev-person-remove" onClick={() => onRemoveAssignment(epicKey, ph, row.phaseInstanceId, assign.memberId)}>×</button>
                )}
              </div>
            );
          }
          // "Add person or team" row — always rendered
          if (!pCollapsed) {
            lpRows.push(
              <div
                key={`add-${phKey}`}
                className="ev-add-person"
                onClick={e => onAddPerson(epicKey, ph, row.phaseInstanceId, (e.currentTarget as HTMLElement).getBoundingClientRect())}
              >
                + Add person or team
              </div>
            );
            ganttRows.push(
              <div key={`gadd-${phKey}`} className="pp-g-add" style={{ minWidth: totalW }}>
                <GridBg weeks={weeks} />
                <TodayLine tStart={tStart} totalW={totalW} dayW={dayW} />
              </div>
            );
          }
        }
      }
    }
  }

  return (
    <div className="pp-view on">
      <div className="pp-lp" style={{ width: panelWidth }}>
        <div className="pp-lp-hd">
          <span className="pp-lp-hd-label">Epic · Phase · Person</span>
          <span style={{ flex: 1 }} />
          <button className="pp-collapse-btn" onClick={onExpandAll}>Expand all</button>
          <button className="pp-collapse-btn" onClick={onCollapseAll} style={{ marginLeft: 4 }}>Collapse all</button>
        </div>
        <div className="pp-lp-body" ref={lpRef} onScroll={syncGanttFromLp}>
          {lpRows}
        </div>
      </div>
      <div className="pp-lp-resize" onMouseDown={onResizeMouseDown} />
      <div className="pp-rp pp-rp-epic">
        <div className="pp-rp-scroll pp-rp-scroll-epic" ref={ganttRef} onScroll={syncLpFromGantt}>
          <div className="pp-gantt-inner" style={{ minWidth: totalW }}>
            <GanttHeader weeks={weeks} totalW={totalW} />
            {ganttRows}
          </div>
        </div>
        <div className="pp-bottom-scroll" ref={bottomScrollbarRef} onScroll={syncGanttFromBottomScrollbar}>
          <div className="pp-bottom-scroll-inner" style={{ width: totalW }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PEOPLE VIEW
// ─────────────────────────────────────────────────────────────────────────────

interface PersonAssignEntry {
  epic: JiraWorkItem;
  phase: PlanningPhase;
  phaseInstanceId: string;
  phaseOrder: number;
  days: number;
  startDay: number;
  barW: number;
}

interface PersonSummary {
  id: string;
  member?: TeamMember;
  contact?: BusinessContact;
  name: string;
  role: string;
  availDays: number;
  assignments: PersonAssignEntry[];
}

function PeopleView({
  peopleSummaries, weeks, tStart, dayW, panelWidth,
  pvExpanded, onTogglePerson,
  onResizeMouseDown, lpRef, ganttRef, onTimelineScroll, jiraBaseUrl,
}: {
  peopleSummaries: PersonSummary[];
  weeks: PortfolioWeek[];
  tStart: Date;
  dayW: number;
  panelWidth: number;
  pvExpanded: Record<string, boolean>;
  onTogglePerson: (id: string) => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  lpRef: React.RefObject<HTMLDivElement | null>;
  ganttRef: React.RefObject<HTMLDivElement | null>;
  onTimelineScroll: (el: HTMLDivElement) => void;
  jiraBaseUrl: string;
}) {
  const totalW = weeks.length * (dayW * 5);
  const [sortBy, setSortBy] = useState<'name' | 'utilization'>('name');

  const syncGanttFromLp = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (ganttRef.current) ganttRef.current.scrollTop = e.currentTarget.scrollTop;
  }, [ganttRef]);
  const syncLpFromGantt = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (lpRef.current) lpRef.current.scrollTop = e.currentTarget.scrollTop;
    onTimelineScroll(e.currentTarget);
  }, [lpRef, onTimelineScroll]);

  const sortedPeopleSummaries = useMemo(() => {
    const getDisplayName = (ps: PersonSummary) => {
      const pid = ps.member?.id ?? ps.contact?.id ?? ps.name;
      return pid.startsWith('TEAM:') ? `${teamEntryForId(pid).name} Team` : ps.name;
    };

    return [...peopleSummaries].sort((a, b) => {
      if (sortBy === 'utilization') {
        const assignedA = a.assignments.reduce((sum, assignment) => sum + assignment.days, 0);
        const assignedB = b.assignments.reduce((sum, assignment) => sum + assignment.days, 0);
        const utilA = a.availDays > 0 ? assignedA / a.availDays : -1;
        const utilB = b.availDays > 0 ? assignedB / b.availDays : -1;
        if (utilB !== utilA) return utilB - utilA;
      }

      return getDisplayName(a).localeCompare(getDisplayName(b));
    });
  }, [peopleSummaries, sortBy]);

  if (!peopleSummaries.length) {
    return (
      <div className="pp-view on">
        <div className="pp-empty-state" style={{ width: '100%' }}>
          <div className="pp-empty-icon">◎</div>
          <div className="pp-empty-title">No assignments yet</div>
          <div className="pp-empty-sub">Add people to phase rows in the Epic View to see utilisation here.</div>
        </div>
      </div>
    );
  }

  const isTeamEntry = (pid: string) => pid.startsWith('TEAM:');

  const lpRows:    React.ReactNode[] = [];
  const ganttRows: React.ReactNode[] = [];

  for (const ps of sortedPeopleSummaries) {
    const pid       = ps.member?.id ?? ps.contact?.id ?? ps.name;
    const expanded  = pvExpanded[pid] ?? false;
    const estDays   = ps.assignments.reduce((s, a) => s + a.days, 0);
    const utilPct   = ps.availDays > 0 ? estDays / ps.availDays : 0;
    const tier      = utilTier(utilPct);

    // Week-by-week utilisation
    const weekUtils = weeks.map((_, i) => {
      let used = 0;
      for (const a of ps.assignments) {
        const endDay = a.startDay + a.barW;
        const overlap = Math.min(endDay, (i + 1) * 5) - Math.max(a.startDay, i * 5);
        if (overlap > 0) used += overlap;
      }
      const pct = used / 5;
      return { pct, cls: utilTier(pct) };
    });

    const isTeam = isTeamEntry(pid);

    // Left panel — person header
    lpRows.push(
      <div key={`pvhd-${pid}`} className="pv-person-hd" onClick={() => onTogglePerson(pid)}>
        <div className={`pp-chev${expanded ? ' open' : ''}`}>▶</div>
        {isTeam
          ? <div className="pp-av-lg team" style={{ background: '#F5F8FC', color: '#64748B', borderRadius: 6, border: '1px solid #E2E8F0' }}>{teamEntryForId(pid).abbr}</div>
          : <div className="pp-av-lg" style={{ background: avColor(pid) }}>{initials(ps.name)}</div>
        }
        <div className="pv-pinfo">
          <div className="pv-pname">{isTeam ? `${teamEntryForId(pid).name} Team` : ps.name}</div>
          <div className="pv-prole">{isTeam ? 'Business team' : ps.role}</div>
        </div>
        {!isTeam && (
          <div className={`pv-util-pill ${tier}`}>
            {Math.round(utilPct * 100)}%
          </div>
        )}
      </div>
    );
    // Capacity bar row — teams show placeholder instead of utilisation
    lpRows.push(
      <div key={`pvcap-${pid}`} className="pv-cap-row">
        {isTeam
          ? <span className="pv-team-placeholder">No capacity data — team placeholder</span>
          : <>
              <div className="pv-cap-bar">
                <div className={`pv-cap-fill ${tier}`} style={{ width: `${Math.min(100, utilPct * 100)}%` }} />
              </div>
              <span className="pv-cap-label">{estDays}d / {ps.availDays}d</span>
            </>
        }
      </div>
    );

    // Gantt — person header row with heatmap
    ganttRows.push(
      <div key={`gpvhd-${pid}`} className="pp-g-pv-phd" style={{ minWidth: totalW }}>
        <GridBg weeks={weeks} />
        <div className="pp-heat-row">
          {weekUtils.map((w, i) => (
            <div key={i} className={`pp-heat-cell ${w.cls}${weeks[i].isMonthStart ? ' ms' : ''}`}>
              {w.pct > 0.05 ? `${Math.round(w.pct * 100)}%` : ''}
            </div>
          ))}
        </div>
      </div>
    );
    // Capacity bar row in gantt (empty — aligns with left panel row)
    ganttRows.push(
      <div key={`gpvcap-${pid}`} className="pp-g-pv-cap" style={{ minWidth: totalW }}>
        <GridBg weeks={weeks} />
      </div>
    );

    // Assignment rows (expanded only)
    if (expanded) {
      for (const a of ps.assignments) {
        const phK   = PH_KEY[a.phase];
        const label = a.barW >= 4 ? `${a.epic.jiraKey} ${a.days}d` : `${a.days}d`;
        lpRows.push(
          <div key={`pvasn-${pid}-${a.epic.jiraKey}-${a.phaseInstanceId}`} className="pv-assign">
            {jiraBaseUrl
              ? <a href={`${jiraBaseUrl}/browse/${a.epic.jiraKey}`} target="_blank" rel="noopener noreferrer" className="pv-assign-key">{a.epic.jiraKey}</a>
              : <span className="pv-assign-key">{a.epic.jiraKey}</span>
            }
            <span className="pv-assign-name">{a.epic.summary}</span>
            <span className={`pp-pv-pp ${phK}`}>{getPhaseDisplayLabel(a.phase, a.phaseOrder)}</span>
            <span className="pv-assign-days">{a.days}d</span>
          </div>
        );
        ganttRows.push(
          <div key={`gpvasn-${pid}-${a.epic.jiraKey}-${a.phaseInstanceId}`} className="pp-g-pv-asgn" style={{ minWidth: totalW }}>
            <GridBg weeks={weeks} />
            <TodayLine tStart={tStart} totalW={totalW} dayW={dayW} />
            {a.startDay !== null && a.barW > 0 && (
              <div
                className={`pp-abar ${phK}`}
                style={{ left: dToX(a.startDay, dayW), width: dToW(a.barW, dayW) }}
              >
                {label}
              </div>
            )}
          </div>
        );
      }
    }
  }

  return (
    <div className="pp-view on">
      <div className="pp-lp" style={{ width: panelWidth }}>
        <div className="pp-lp-hd">
          <span className="pp-lp-hd-label">Person · Epic assignments</span>
          <label className="pv-sort">
            <span className="pv-sort-label">Sort</span>
            <select
              className="pv-sort-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'name' | 'utilization')}
              aria-label="Sort people view"
            >
              <option value="name">Name</option>
              <option value="utilization">Utilization</option>
            </select>
          </label>
        </div>
        <div className="pp-lp-body" ref={lpRef} onScroll={syncGanttFromLp}>
          {lpRows}
        </div>
      </div>
      <div className="pp-lp-resize" onMouseDown={onResizeMouseDown} />
      <div className="pp-rp">
        <div className="pp-rp-scroll" ref={ganttRef} onScroll={syncLpFromGantt}>
          <div className="pp-gantt-inner" style={{ minWidth: totalW }}>
            <GanttHeader weeks={weeks} totalW={totalW} />
            {ganttRows}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY VIEW
// ─────────────────────────────────────────────────────────────────────────────

function SummaryView({
  processTeams, boardEpics, peopleSummaries, phasePlansMap, assignMap,
  absenceLookup, weeks, quarter, quarterOpt, state, jiraBaseUrl,
  activeScenarioName, baselinePhasePlans, baselinePhaseAssignments,
}: {
  processTeams: ProcessTeam[];
  boardEpics: JiraWorkItem[];
  peopleSummaries: PersonSummary[];
  phasePlansMap: Map<string, PhasePlansByType>;
  assignMap: Map<string, PhaseAssignmentsByInstance>;
  absenceLookup: Record<string, number>;
  weeks: PortfolioWeek[];
  quarter: string;
  quarterOpt: QOpt;
  state: ReturnType<typeof useCurrentState>;
  jiraBaseUrl: string;
  activeScenarioName: string | null;
  baselinePhasePlans: EpicPhasePlan[];
  baselinePhaseAssignments: EpicPhaseAssignment[];
}) {
  const periodLabel = quarterOpt.q === -1 ? 'year' : 'quarter';
  const totalPlannedDays = useMemo(
    () => peopleSummaries.reduce((sum, person) => sum + person.assignments.reduce((acc, a) => acc + a.days, 0), 0),
    [peopleSummaries],
  );

  const totalAvailableDays = useMemo(() => {
    const memberAvail = state.teamMembers
      .filter(member => !member.excludedFromCapacity)
      .reduce((sum, member) => sum + calculateMemberAvailableDays(member.id, quarterOpt, state), 0);
    const contactAvail = state.businessContacts
      .filter(contact => !contact.archived && !contact.excludedFromCapacity)
      .reduce((sum, contact) => sum + calculateBusinessAvailableDays(contact, quarterOpt, state), 0);
    return memberAvail + contactAvail;
  }, [quarterOpt, state]);

  const overCapacityPeopleCount = useMemo(
    () => peopleSummaries.filter(person => person.availDays > 0 && person.assignments.reduce((sum, a) => sum + a.days, 0) / person.availDays > 1).length,
    [peopleSummaries],
  );

  const nearCapacityPeopleCount = useMemo(
    () => peopleSummaries.filter(person => {
      if (person.availDays <= 0) return false;
      const utilization = person.assignments.reduce((sum, a) => sum + a.days, 0) / person.availDays;
      return utilization > 0.85 && utilization <= 1;
    }).length,
    [peopleSummaries],
  );

  const epicRiskSummary = useMemo(() => {
    return boardEpics.map(epic => {
      const phaseRows = getPhaseInstanceRows(
        phasePlansMap.get(epic.jiraKey) ?? new Map(),
        assignMap.get(epic.jiraKey) ?? new Map(),
      );
      const totalAssigned = phaseRows.flatMap(row => row.assignments).reduce((sum, assignment) => sum + assignment.days, 0);
      const missingStartPhases = PHASES.filter(phase => {
        const phaseInstances = phaseRows.filter(row => row.phase === phase && row.assignments.length > 0);
        if (phaseInstances.length === 0) return false;
        return phaseInstances.some(row => !row.plan?.startDate);
      });
      return {
        epic,
        totalAssigned,
        isUnstaffed: totalAssigned <= 0,
        missingStartPhases,
      };
    });
  }, [assignMap, boardEpics, phasePlansMap]);

  const unstaffedEpicCount = epicRiskSummary.filter(epic => epic.isUnstaffed).length;
  const missingPhaseDateCount = epicRiskSummary.reduce((sum, epic) => sum + epic.missingStartPhases.length, 0);

  const portfolioUtilization = totalAvailableDays > 0 ? totalPlannedDays / totalAvailableDays : 0;

  const baselineDelta = useMemo(() => {
    if (!activeScenarioName) return null;

    const baselineAssignMap = new Map<string, PhaseAssignmentsByInstance>();
    for (const assignment of baselinePhaseAssignments) {
      if (!baselineAssignMap.has(assignment.epicKey)) baselineAssignMap.set(assignment.epicKey, new Map());
      const byInstance = baselineAssignMap.get(assignment.epicKey)!;
      if (!byInstance.has(assignment.phaseInstanceId)) byInstance.set(assignment.phaseInstanceId, []);
      byInstance.get(assignment.phaseInstanceId)!.push(assignment);
    }

    const baselinePlansMap = new Map<string, PhasePlansByType>();
    for (const plan of baselinePhasePlans) {
      if (!baselinePlansMap.has(plan.epicKey)) baselinePlansMap.set(plan.epicKey, new Map());
      const byPhase = baselinePlansMap.get(plan.epicKey)!;
      if (!byPhase.has(plan.phase)) byPhase.set(plan.phase, []);
      byPhase.get(plan.phase)!.push(plan);
    }

    const baselinePlannedDays = baselinePhaseAssignments.reduce((sum, assignment) => sum + assignment.days, 0);

    const baselinePeople = new Map<string, { assigned: number; available: number }>();
    for (const person of peopleSummaries) {
      baselinePeople.set(person.id, { assigned: 0, available: person.availDays });
    }
    for (const assignment of baselinePhaseAssignments) {
      const row = baselinePeople.get(assignment.memberId);
      if (!row) continue;
      row.assigned += assignment.days;
    }
    let baselineOver = 0;
    let baselineNear = 0;
    baselinePeople.forEach(person => {
      if (person.available <= 0) return;
      const utilization = person.assigned / person.available;
      if (utilization > 1) baselineOver += 1;
      else if (utilization > 0.85) baselineNear += 1;
    });

    let baselineUnstaffed = 0;
    let baselineMissingDates = 0;
    for (const epic of boardEpics) {
      const phaseRows = getPhaseInstanceRows(
        baselinePlansMap.get(epic.jiraKey) ?? new Map(),
        baselineAssignMap.get(epic.jiraKey) ?? new Map(),
      );
      const totalAssigned = phaseRows.flatMap(row => row.assignments).reduce((sum, assignment) => sum + assignment.days, 0);
      if (totalAssigned <= 0) baselineUnstaffed += 1;
      baselineMissingDates += PHASES.filter(phase => {
        const phaseInstances = phaseRows.filter(row => row.phase === phase && row.assignments.length > 0);
        if (phaseInstances.length === 0) return false;
        return phaseInstances.some(row => !row.plan?.startDate);
      }).length;
    }

    return {
      plannedDays: totalPlannedDays - baselinePlannedDays,
      overCapacityPeople: overCapacityPeopleCount - baselineOver,
      nearCapacityPeople: nearCapacityPeopleCount - baselineNear,
      unstaffedEpics: unstaffedEpicCount - baselineUnstaffed,
      missingPhaseDates: missingPhaseDateCount - baselineMissingDates,
    };
  }, [
    activeScenarioName,
    baselinePhaseAssignments,
    baselinePhasePlans,
    boardEpics,
    missingPhaseDateCount,
    nearCapacityPeopleCount,
    overCapacityPeopleCount,
    peopleSummaries,
    totalPlannedDays,
    unstaffedEpicCount,
  ]);

  const portfolioRisks = useMemo(() => {
    const peopleRisks = peopleSummaries
      .map(person => {
        const assigned = person.assignments.reduce((sum, a) => sum + a.days, 0);
        const utilization = person.availDays > 0 ? assigned / person.availDays : 0;
        if (utilization <= 0.85) return null;
        const severity = utilization > 1 ? 'high' : 'medium';
        return {
          id: `person-${person.id}`,
          severity,
          kind: 'person',
          label: person.name,
          summary: utilization > 1 ? `Over capacity this ${periodLabel}` : `Near capacity this ${periodLabel}`,
          detail: `${Math.round(assigned)}d planned vs ${Math.round(person.availDays)}d available (${Math.round(utilization * 100)}%)`,
        };
      })
      .filter(Boolean) as Array<{ id: string; severity: 'high' | 'medium'; kind: 'person' | 'epic'; label: string; summary: string; detail: string }>;

    const epicRisks = epicRiskSummary.flatMap(({ epic, isUnstaffed, missingStartPhases, totalAssigned }) => {
      const risks: Array<{ id: string; severity: 'high' | 'medium'; kind: 'person' | 'epic'; label: string; summary: string; detail: string }> = [];
      if (isUnstaffed) {
        risks.push({
          id: `epic-${epic.jiraKey}-unstaffed`,
          severity: 'high',
          kind: 'epic',
          label: epic.jiraKey,
          summary: 'Epic has no staffing assigned',
          detail: epic.summary,
        });
      }
      if (missingStartPhases.length > 0) {
        risks.push({
          id: `epic-${epic.jiraKey}-dates`,
          severity: 'medium',
          kind: 'epic',
          label: epic.jiraKey,
          summary: 'Assigned phase is missing a start date',
          detail: `${missingStartPhases.map(phase => PH_LBL[phase]).join(', ')}${totalAssigned > 0 ? ` · ${Math.round(totalAssigned)}d planned` : ''}`,
        });
      }
      return risks;
    });

    return [...peopleRisks, ...epicRisks].sort((a, b) => {
      const severityScore = { high: 0, medium: 1 };
      return severityScore[a.severity] - severityScore[b.severity] || a.label.localeCompare(b.label);
    });
  }, [epicRiskSummary, peopleSummaries]);

  const epicEffortCards = useMemo(() => {
    const businessTeamMap = new Map(state.businessTeams.map(team => [team.id, team.name]));

    return boardEpics.map(epic => {
      const assignmentsByPhase = assignMap.get(epic.jiraKey) ?? new Map<string, EpicPhaseAssignment[]>();
      let itDays = 0;
      let bizDays = 0;
      const businessTeams = new Map<string, number>();
      const businessContacts = new Map<string, number>();

      for (const phaseAssignments of assignmentsByPhase.values()) {
        for (const assignment of phaseAssignments) {
          if (assignment.track === 'IT') {
            itDays += assignment.days;
            continue;
          }

          bizDays += assignment.days;
          const contact = state.businessContacts.find(item => item.id === assignment.memberId);
          const contactName = contact?.name ?? assignment.memberId;
          businessContacts.set(contactName, (businessContacts.get(contactName) ?? 0) + assignment.days);

          const primaryBusinessTeamId = contact?.businessTeamIds?.[0];
          const businessTeamName = primaryBusinessTeamId
            ? businessTeamMap.get(primaryBusinessTeamId) ?? 'Unmapped team'
            : 'Unmapped team';
          businessTeams.set(businessTeamName, (businessTeams.get(businessTeamName) ?? 0) + assignment.days);
        }
      }

      const totalDays = itDays + bizDays;
      const itPct = totalDays > 0 ? (itDays / totalDays) * 100 : 0;
      const bizPct = totalDays > 0 ? (bizDays / totalDays) * 100 : 0;

      return {
        epic,
        totalDays,
        itDays,
        bizDays,
        itPct,
        bizPct,
        businessTeams: [...businessTeams.entries()]
          .map(([name, days]) => ({ name, days }))
          .sort((a, b) => b.days - a.days),
        businessContacts: [...businessContacts.entries()]
          .map(([name, days]) => ({ name, days }))
          .sort((a, b) => b.days - a.days),
      };
    }).sort((a, b) => b.totalDays - a.totalDays || a.epic.jiraKey.localeCompare(b.epic.jiraKey));
  }, [assignMap, boardEpics, state.businessContacts, state.businessTeams]);

  // KPI cards — one per process team
  const kpiCards = useMemo(() => {
    return processTeams.map(pt => {
      const members = state.teamMembers.filter(m => m.processTeamIds?.includes(pt.id) && !m.excludedFromCapacity);
      const availDays = members.reduce((s, m) => s + calculateMemberAvailableDays(m.id, quarterOpt, state), 0);
      // Also BIZ contacts
      const contacts = state.businessContacts.filter(c => c.processTeamIds?.includes(pt.id) && !c.excludedFromCapacity);
      const bizAvail = contacts.reduce((s, c) => s + calculateBusinessAvailableDays(c, quarterOpt, state), 0);
      const totalAvail = availDays + bizAvail;

      // Estimate days = sum of assignments for members/contacts in this team
      const allIds = new Set([...members.map(m => m.id), ...contacts.map(c => c.id)]);
      let estDays = 0;
      for (const epic of boardEpics) {
        const phAssign = assignMap.get(epic.jiraKey) ?? new Map();
        for (const assignments of phAssign.values()) {
          for (const a of assignments) {
            if (allIds.has(a.memberId)) estDays += a.days;
          }
        }
      }

      const utilPct = totalAvail > 0 ? estDays / totalAvail : 0;
      const tier    = utilTier(utilPct);
      return { id: pt.id, name: pt.name, estDays, totalAvail, utilPct, tier, memberCount: allIds.size };
    });
  }, [assignMap, boardEpics, processTeams, quarterOpt, state]);

  // Capacity alerts — people over or near capacity (exclude team placeholders)
  const alertRows = useMemo(() => {
    return peopleSummaries
      .filter(ps => {
        const pid = ps.member?.id ?? ps.contact?.id ?? ps.name;
        if (pid.startsWith('TEAM:')) return false;
        const utilPct = ps.availDays > 0 ? ps.assignments.reduce((s, a) => s + a.days, 0) / ps.availDays : 0;
        return utilPct > 0.85;
      })
      .map(ps => {
        const estDays = ps.assignments.reduce((s, a) => s + a.days, 0);
        const utilPct = ps.availDays > 0 ? estDays / ps.availDays : 0;
        const tier    = utilTier(utilPct);
        const delta   = estDays - ps.availDays;
        return { name: ps.name, id: ps.member?.id ?? ps.contact?.id ?? '', estDays, availDays: ps.availDays, utilPct, tier, delta };
      })
      .sort((a, b) => b.utilPct - a.utilPct);
  }, [peopleSummaries]);

  // Compact Gantt — weeks use flex:1
  const nWeeks = weeks.length;

  return (
    <div className="pp-view on">
      <div className="pp-sv">
        <div>
          <div className="pp-sec-hd">
            <span className="pp-sec-title">Portfolio Health</span>
            <span className="pp-sec-sub">{quarter}</span>
          </div>
          <div className="pp-health-grid">
            <div className="pp-health-card">
              <span className="pp-health-label">Planned vs available</span>
              <div className="pp-health-value">
                {Math.round(totalPlannedDays)} / {Math.round(totalAvailableDays)}d
              </div>
              <div className="pp-health-meta">
                <span className={`pp-health-chip ${utilTier(portfolioUtilization)}`}>
                  {Math.round(portfolioUtilization * 100)}% utilized
                </span>
              </div>
            </div>
            <div className="pp-health-card">
              <span className="pp-health-label">People at risk</span>
              <div className="pp-health-value">{overCapacityPeopleCount + nearCapacityPeopleCount}</div>
              <div className="pp-health-meta">
                <span className="pp-health-note">{overCapacityPeopleCount} over</span>
                <span className="pp-health-note">{nearCapacityPeopleCount} near</span>
              </div>
            </div>
            <div className="pp-health-card">
              <span className="pp-health-label">Unstaffed epics</span>
              <div className="pp-health-value">{unstaffedEpicCount}</div>
              <div className="pp-health-meta">
                <span className="pp-health-note">{boardEpics.length} epics on the board</span>
              </div>
            </div>
            <div className="pp-health-card">
              <span className="pp-health-label">Missing phase dates</span>
              <div className="pp-health-value">{missingPhaseDateCount}</div>
              <div className="pp-health-meta">
                <span className="pp-health-note">Assigned phases without a start date</span>
              </div>
            </div>
          </div>
        </div>

        {baselineDelta && (
          <div>
            <div className="pp-sec-hd">
              <span className="pp-sec-title">Scenario Delta</span>
              <span className="pp-sec-sub">Compared with baseline for {activeScenarioName}</span>
            </div>
            <div className="pp-delta-grid">
              {[
                { label: 'Planned days', value: baselineDelta.plannedDays, suffix: 'd' },
                { label: 'Over-capacity people', value: baselineDelta.overCapacityPeople },
                { label: 'Near-capacity people', value: baselineDelta.nearCapacityPeople },
                { label: 'Unstaffed epics', value: baselineDelta.unstaffedEpics },
                { label: 'Missing phase dates', value: baselineDelta.missingPhaseDates },
              ].map(item => (
                <div key={item.label} className="pp-delta-card">
                  <span className="pp-delta-label">{item.label}</span>
                  <span className={`pp-delta-value ${item.value > 0 ? 'worse' : item.value < 0 ? 'better' : 'same'}`}>
                    {item.value > 0 ? '+' : ''}{item.value}{item.suffix ?? ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {epicEffortCards.length > 0 && (
          <div>
            <div className="pp-sec-hd">
              <span className="pp-sec-title">Effort by Epic</span>
              <span className="pp-sec-sub">Ranked view of IT vs business effort</span>
            </div>
            <div className="pp-effort-list">
              <div className="pp-effort-head">
                <div className="pp-effort-head-cell">Epic</div>
                <div className="pp-effort-head-cell">Effort split</div>
              </div>
              {epicEffortCards.map((card, index) => {
                return (
                  <div key={card.epic.jiraKey} className="pp-effort-row">
                    <div className="pp-effort-main">
                      <div className="pp-effort-rank">{index + 1}</div>
                      <div className="pp-effort-title">
                        <div className="pp-effort-title-top">
                          <span className="pp-effort-total">{Math.round(card.totalDays)}d</span>
                          <span className="pp-effort-total-label">total</span>
                        </div>
                        <div className="pp-effort-title-body">
                          {jiraBaseUrl
                            ? <a href={`${jiraBaseUrl}/browse/${card.epic.jiraKey}`} target="_blank" rel="noopener noreferrer" className="pp-effort-key">{card.epic.jiraKey}</a>
                            : <span className="pp-effort-key">{card.epic.jiraKey}</span>
                          }
                          <span className="pp-effort-name">{card.epic.summary}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pp-effort-split">
                      <div className="pp-effort-bar">
                        <div className="pp-effort-bar-it" style={{ width: `${card.itPct}%` }} />
                        <div className="pp-effort-bar-biz" style={{ width: `${card.bizPct}%` }} />
                      </div>

                      <div className="pp-effort-stats">
                        <div className="pp-effort-stat it">
                          <span className="pp-effort-stat-label">IT</span>
                          <span className="pp-effort-stat-value">{Math.round(card.itDays)}d</span>
                        </div>
                        <div className="pp-effort-stat biz">
                          <span className="pp-effort-stat-label">Biz</span>
                          <span className="pp-effort-stat-value">{Math.round(card.bizDays)}d</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div>
          <div className="pp-sec-hd">
            <span className="pp-sec-title">Capacity by Team</span>
            <span className="pp-sec-sub">{quarter}</span>
          </div>
          <div className="pp-kpi-grid">
            {kpiCards.map(c => (
              <div key={c.id} className="pp-kpi-card">
                <div className="pp-kpi-card-top">
                  <span className="pp-kpi-team">{c.name}</span>
                  {c.utilPct > 1 && <span className="pp-kpi-badge over">Over</span>}
                  {c.utilPct > 0.85 && c.utilPct <= 1 && <span className="pp-kpi-badge over" style={{ background: '#FEF3C7', color: '#B45309' }}>Near</span>}
                </div>
                <div className="pp-kpi-nums">
                  <span className="pp-kpi-est">{Math.round(c.estDays)}</span>
                  <span className="pp-kpi-avail">/ {Math.round(c.totalAvail)}d</span>
                </div>
                <div className="pp-kpi-bar">
                  <div className={`pp-kpi-bar-fill ${c.tier}`} style={{ width: `${Math.min(100, c.utilPct * 100)}%` }} />
                </div>
                <div className="pp-kpi-members">{c.memberCount} {c.memberCount === 1 ? 'person' : 'people'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Gantt */}
        {boardEpics.length > 0 && (
          <div>
            <div className="pp-sec-hd">
              <span className="pp-sec-title">Portfolio Timeline</span>
              <span className="pp-sec-sub">Risk badges highlight epics needing attention</span>
            </div>
            <div className="pp-cg-wrap">
              <div className="pp-cg-head">
                <div className="pp-cg-label-col"><span className="pp-cg-label-hd">Epic</span></div>
                <div className="pp-cg-weeks-hd">
                  {weeks.map(w => (
                    <div key={w.idx} className={`pp-cg-week-hd${w.isMonthStart ? ' ms' : ''}${w.isTodayWeek ? ' today-w' : ''}`}>
                      W{w.num}
                    </div>
                  ))}
                </div>
              </div>
              {boardEpics.map(epic => {
                const epicKey  = epic.jiraKey;
                const phaseRows = getPhaseInstanceRows(
                  phasePlansMap.get(epicKey) ?? new Map(),
                  assignMap.get(epicKey) ?? new Map(),
                );
                const epicSummary = epicRiskSummary.find(item => item.epic.jiraKey === epicKey);
                return (
                  <div key={epicKey} className="pp-cg-epic-row">
                    <div className="pp-cg-epic-label">
                      {jiraBaseUrl
                        ? <a href={`${jiraBaseUrl}/browse/${epicKey}`} target="_blank" rel="noopener noreferrer" className="pp-cg-epic-key">{epicKey}</a>
                        : <span className="pp-cg-epic-key">{epicKey}</span>
                      }
                      <span className="pp-cg-epic-name">{epic.summary}</span>
                      {epicSummary?.isUnstaffed && <span className="pp-cg-risk-badge high">No staff</span>}
                      {!epicSummary?.isUnstaffed && (epicSummary?.missingStartPhases.length ?? 0) > 0 && (
                        <span className="pp-cg-risk-badge medium">Dates</span>
                      )}
                    </div>
                    <div className="pp-cg-epic-gantt" style={{ position: 'relative' }}>
                      <div className="pp-cg-grid">
                        {weeks.map(w => (
                          <div key={w.idx} className={`pp-cg-col${w.isMonthStart ? ' ms' : ''}${w.isTodayWeek ? ' today-c' : ''}`} />
                        ))}
                      </div>
                      {/* Today line — positioned proportionally across flex columns */}
                      {phaseRows.map(row => {
                        const ph = row.phase;
                        const phasePlan = row.plan;
                        const startDate = phasePlan?.startDate ?? null;
                        if (!startDate) return null;
                        const tStartSv  = weeks[0]?.startDate ?? new Date();
                        const startDay  = dateToDay(startDate, tStartSv);
                        const assignments = row.assignments;
                        const barW = phasePlan ? (phaseBarWidthDays(phasePlan, tStartSv) ?? calcBarWidthDays(assignments, absenceLookup)) : calcBarWidthDays(assignments, absenceLookup);
                        if (barW <= 0) return null;
                        // Compact Gantt uses flex:1 per column, so positions are percentages of total days
                        const totalDays = nWeeks * 5;
                        const leftPct   = (startDay / totalDays) * 100;
                        const widthPct  = Math.max(1 / totalDays * 100, (barW / totalDays) * 100);
                        return (
                          <div
                            key={row.phaseInstanceId}
                            className={`pp-cg-bar ${PH_KEY[ph]}`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Capacity alerts */}
        <div>
          <div className="pp-sec-hd">
            <span className="pp-sec-title">Portfolio Risks</span>
            <span className="pp-sec-sub">People and epics that need attention first</span>
          </div>
          <div className="pp-risk-wrap">
            <div className="pp-risk-hd">
              <div className="pp-risk-hd-cell">Severity</div>
              <div className="pp-risk-hd-cell">Type</div>
              <div className="pp-risk-hd-cell">Item</div>
              <div className="pp-risk-hd-cell">Issue</div>
              <div className="pp-risk-hd-cell">Detail</div>
            </div>
            {portfolioRisks.length === 0 ? (
              <div className="pp-pct-empty">No over-allocated or near-capacity team members — looking good!</div>
            ) : portfolioRisks.map(risk => (
              <div key={risk.id} className="pp-risk-row">
                <div className="pp-risk-cell">
                  <span className={`pp-risk-pill ${risk.severity}`}>{risk.severity === 'high' ? 'High' : 'Medium'}</span>
                </div>
                <div className="pp-risk-cell">{risk.kind === 'person' ? 'Person' : 'Epic'}</div>
                <div className="pp-risk-cell pp-risk-item">{risk.label}</div>
                <div className="pp-risk-cell">{risk.summary}</div>
                <div className="pp-risk-cell pp-risk-detail">{risk.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Capacity alerts */}
        <div>
          <div className="pp-sec-hd">
            <span className="pp-sec-title">Capacity Alerts</span>
            <span className="pp-sec-sub">Over-allocated and near-capacity members</span>
          </div>
          <div className="pp-pct-wrap">
            <div className="pp-pct-hd">
              <div className="pp-pct-hd-cell">Person</div>
              <div className="pp-pct-hd-cell">Estimated</div>
              <div className="pp-pct-hd-cell">Available</div>
              <div className="pp-pct-hd-cell">Utilisation</div>
              <div className="pp-pct-hd-cell">Delta</div>
            </div>
            {alertRows.length === 0 ? (
              <div className="pp-pct-empty">No over-allocated or near-capacity team members — looking good!</div>
            ) : alertRows.map(r => (
              <div key={r.id} className="pp-pct-row">
                <div className="pp-pct-cell pp-pct-person">
                  <div className="pp-av" style={{ background: avColor(r.id) }}>{initials(r.name)}</div>
                  {r.name}
                </div>
                <div className="pp-pct-cell">{Math.round(r.estDays)}d</div>
                <div className="pp-pct-cell">{Math.round(r.availDays)}d</div>
                <div className="pp-pct-cell pp-pct-bar-cell">
                  <div className="pp-pct-bar">
                    <div className={`pp-pct-bar-fill ${r.tier}`} style={{ width: `${Math.min(100, r.utilPct * 100)}%` }} />
                  </div>
                  <span className="pp-pct-bar-label">{Math.round(r.utilPct * 100)}%</span>
                </div>
                <div className="pp-pct-cell">
                  <span className={`pp-pct-delta ${r.tier}`}>{r.delta > 0 ? '+' : ''}{Math.round(r.delta)}d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function PortfolioDrawer({
  open, allEpics, boardEpicKeys, manualEpics, onClose, onSave, onCreateManual, onEditManual, onDeleteManual,
}: {
  open: boolean;
  allEpics: JiraWorkItem[];
  boardEpicKeys: string[];
  manualEpics: ManualEpic[];
  onClose: () => void;
  onSave: (keys: string[]) => void;
  onCreateManual: () => void;
  onEditManual: (epic: ManualEpic) => void;
  onDeleteManual: (epicKey: string) => void;
}) {
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(boardEpicKeys));
  const [openDd, setOpenDd]     = useState<'label' | 'assignee' | 'status' | null>(null);
  const [labelSearch, setLabelSearch]       = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [statusSearch, setStatusSearch]     = useState('');
  const [selLabels, setSelLabels]     = useState<Set<string>>(new Set());
  const [selAssignees, setSelAssignees] = useState<Set<string>>(new Set());
  const [selStatuses, setSelStatuses]   = useState<Set<string>>(new Set());

  // Reset selection to current board keys whenever the drawer opens or board keys change externally
  useEffect(() => { setSelected(new Set(boardEpicKeys)); }, [open, boardEpicKeys]);

  const allLabels   = useMemo(() => [...new Set(allEpics.flatMap(e => e.labels))].sort(), [allEpics]);
  const allAssignees = useMemo(() => [...new Set(allEpics.map(e => e.assigneeName).filter(Boolean) as string[])].sort(), [allEpics]);
  const allStatuses  = useMemo(() => [...new Set(allEpics.map(e => e.status))].sort(), [allEpics]);

  const filtered = useMemo(() => {
    return allEpics.filter(e => {
      const q = search.toLowerCase();
      if (q && !e.summary.toLowerCase().includes(q) && !e.jiraKey.toLowerCase().includes(q)) return false;
      if (selLabels.size   > 0 && !e.labels.some(l => selLabels.has(l)))          return false;
      if (selAssignees.size > 0 && !selAssignees.has(e.assigneeName ?? ''))        return false;
      if (selStatuses.size  > 0 && !selStatuses.has(e.status))                    return false;
      return true;
    });
  }, [allEpics, search, selLabels, selAssignees, selStatuses]);

  const allChecked = filtered.length > 0 && filtered.every(e => selected.has(e.jiraKey));

  const toggle = (key: string) => setSelected(prev => {
    const s = new Set(prev);
    s.has(key) ? s.delete(key) : s.add(key);
    return s;
  });

  function statusDisplayCls(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('progress')) return 'in-progress';
    if (s.includes('done') || s.includes('closed')) return 'active';
    if (s.includes('backlog')) return 'backlog';
    return 'planned';
  }

  function FilterDropdown({
    id, label, items, selItems, setSelItems, searchVal, setSearchVal,
  }: {
    id: 'label' | 'assignee' | 'status';
    label: string;
    items: string[];
    selItems: Set<string>;
    setSelItems: (s: Set<string>) => void;
    searchVal: string;
    setSearchVal: (v: string) => void;
  }) {
    const shown = items.filter(i => i.toLowerCase().includes(searchVal.toLowerCase()));
    return (
      <div style={{ position: 'relative' }}>
        <button
          className={`pp-flt-btn${selItems.size > 0 ? ' active' : ''}${openDd === id ? ' open' : ''}`}
          onClick={() => setOpenDd(prev => prev === id ? null : id)}
        >
          {label}
          {selItems.size > 0 && <span className="pp-flt-count">{selItems.size}</span>}
          <span className="pp-flt-chevron">▼</span>
        </button>
        <div className={`pp-flt-dropdown${openDd === id ? ' open' : ''}`}>
          <div className="pp-flt-dd-search">
            <input
              placeholder={`Search ${label.toLowerCase()}…`}
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
            />
          </div>
          <div className="pp-flt-dd-list">
            {shown.length === 0
              ? <div className="pp-flt-dd-empty">No results</div>
              : shown.map(item => (
                  <div
                    key={item}
                    className={`pp-flt-dd-item${selItems.has(item) ? ' checked' : ''}`}
                    onClick={() => {
                      const s = new Set(selItems);
                      s.has(item) ? s.delete(item) : s.add(item);
                      setSelItems(s);
                    }}
                  >
                    <div className={`pp-cb${selItems.has(item) ? ' on' : ''}`} />
                    {item}
                  </div>
                ))
            }
          </div>
          <div className="pp-flt-dd-footer">
            <span className="pp-flt-dd-clear" onClick={() => setSelItems(new Set())}>Clear all</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`pp-drawer${open ? ' open' : ''}`}>
      <div className="pp-dr-head">
        <span className="pp-dr-title">Add Epics to Portfolio</span>
        <button className="pp-dr-close" onClick={onClose}>×</button>
      </div>
      <div className="pp-dr-filters">
        <div className="pp-dr-search">
          <span style={{ color: 'var(--txt3)', fontSize: 13 }}>🔍</span>
          <input
            placeholder="Search by name or key…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="pp-dr-filter-row">
          <FilterDropdown
            id="label" label="Labels"
            items={allLabels.filter(l => l.toLowerCase().includes(labelSearch.toLowerCase()))}
            selItems={selLabels} setSelItems={setSelLabels}
            searchVal={labelSearch} setSearchVal={setLabelSearch}
          />
          <FilterDropdown
            id="assignee" label="Assignee"
            items={allAssignees.filter(a => a.toLowerCase().includes(assigneeSearch.toLowerCase()))}
            selItems={selAssignees} setSelItems={setSelAssignees}
            searchVal={assigneeSearch} setSearchVal={setAssigneeSearch}
          />
          <FilterDropdown
            id="status" label="Status"
            items={allStatuses.filter(s => s.toLowerCase().includes(statusSearch.toLowerCase()))}
            selItems={selStatuses} setSelItems={setSelStatuses}
            searchVal={statusSearch} setSearchVal={setStatusSearch}
          />
        </div>
      </div>
      {/* ── Manual epics section ── */}
      {manualEpics.length > 0 && (
        <div className="pp-dr-manual-section">
          <div className="pp-dr-section-hd">Manual Epics</div>
          {manualEpics.map(e => (
            <div
              key={e.epicKey}
              className={`pp-dr-epic-item pp-dr-manual-item${selected.has(e.epicKey) ? ' checked' : ''}`}
              onClick={() => {
                setSelected(prev => {
                  const s = new Set(prev);
                  s.has(e.epicKey) ? s.delete(e.epicKey) : s.add(e.epicKey);
                  return s;
                });
              }}
            >
              <div className={`pp-cb${selected.has(e.epicKey) ? ' on' : ''}`} />
              <div className="pp-dr-epic-info">
                <div className="pp-dr-epic-key">{e.epicKey}</div>
                <div className="pp-dr-epic-name">{e.summary}</div>
                {e.description && <div className="pp-dr-epic-meta">{e.description}</div>}
              </div>
              <div className="pp-dr-manual-actions">
                {e.startDate && (
                  <span className="pp-dr-manual-dates">
                    {e.startDate.slice(5)} → {e.endDate ? e.endDate.slice(5) : '?'}
                  </span>
                )}
                <button
                  className="pp-dr-manual-btn edit"
                  title="Edit"
                  onClick={ev => { ev.stopPropagation(); onEditManual(e); }}
                >✎</button>
                <button
                  className="pp-dr-manual-btn delete"
                  title="Delete permanently"
                  onClick={ev => {
                    ev.stopPropagation();
                    if (confirm(`Delete "${e.summary}" (${e.epicKey}) permanently?`)) {
                      onDeleteManual(e.epicKey);
                    }
                  }}
                >🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pp-dr-list-head">
        <label className="pp-dr-select-all" onClick={() => {
          if (allChecked) setSelected(prev => { const s = new Set(prev); filtered.forEach(e => s.delete(e.jiraKey)); return s; });
          else setSelected(prev => { const s = new Set(prev); filtered.forEach(e => s.add(e.jiraKey)); return s; });
        }}>
          <div className={`pp-cb${allChecked ? ' on' : ''}`} />
          Select all visible
        </label>
          <span className="pp-dr-count">{filtered.length} epic{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="pp-dr-list" onClick={() => setOpenDd(null)}>
        {filtered.map(e => (
          <div
            key={e.jiraKey}
            className={`pp-dr-epic-item${selected.has(e.jiraKey) ? ' checked' : ''}`}
            onClick={() => toggle(e.jiraKey)}
          >
            <div className={`pp-cb${selected.has(e.jiraKey) ? ' on' : ''}`} />
            <div className="pp-dr-epic-info">
              <div className="pp-dr-epic-key">{e.jiraKey}</div>
              <div className="pp-dr-epic-name">{e.summary}</div>
              {e.assigneeName && <div className="pp-dr-epic-meta">{e.assigneeName}</div>}
            </div>
            <div className={`pp-dr-epic-status ${statusDisplayCls(e.status)}`}>{e.status}</div>
          </div>
        ))}
      </div>
      <div className="pp-dr-footer">
        <button className="pp-btn pp-dr-create-btn" onClick={onCreateManual}>
          + Create Manual Epic
        </button>
        <button className="pp-btn" onClick={onClose}>Cancel</button>
        <button className="pp-btn primary" onClick={() => onSave([...selected])}>
          Add to portfolio
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PICKER POPOVER
// ─────────────────────────────────────────────────────────────────────────────

function PortfolioPickerPopover({
  epicKey: _epicKey, phase: _phase, anchorRect, existingMemberIds, memberMap, contactMap, businessTeams,
  onSelect, onClose,
}: {
  epicKey: string;
  phase: PlanningPhase;
  anchorRect: DOMRect;
  existingMemberIds: Set<string>;
  memberMap: Map<string, TeamMember>;
  contactMap: Map<string, BusinessContact>;
  businessTeams: BusinessTeam[];
  onSelect: (memberId: string, track: 'IT' | 'BIZ') => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  // Build flat entry list: IT members + BIZ contacts + business teams
  const entries = useMemo(() => {
    const it = [...memberMap.values()]
      .filter(m => !m.excludedFromCapacity)
      .map(m => ({ id: m.id, name: m.name, sub: m.role ?? '', track: 'IT' as const, isTeam: false }));
    const biz = [...contactMap.values()]
      .filter(c => !c.excludedFromCapacity)
      .map(c => ({ id: c.id, name: c.name, sub: c.title ?? '', track: 'BIZ' as const, isTeam: false }));
    const teams = businessTeams.map(bt => ({
      id: `TEAM:${bt.name}`,
      name: bt.name,
      sub: 'Business team',
      track: 'BIZ' as const,
      isTeam: true,
    }));
    return [...it, ...biz, ...teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [memberMap, contactMap, businessTeams]);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(e => e.name.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q));
  }, [entries, query]);

  // Dismiss on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('pp-picker-popover');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Position: below the anchor, flip up if near bottom
  const above = anchorRect.bottom + 240 > window.innerHeight;
  const style: React.CSSProperties = {
    top: above ? anchorRect.top - 244 : anchorRect.bottom + 4,
    left: Math.min(anchorRect.left, window.innerWidth - 290),
  };

  return (
    <div id="pp-picker-popover" className="pp-picker" style={style}>
      <div className="pp-picker-search">
        <span style={{ color: '#94A3B8', fontSize: 13 }}>🔍</span>
        <input
          autoFocus
          placeholder="Search people or teams…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="pp-picker-list">
        {filtered.length === 0
          ? <div className="pp-picker-empty">No results</div>
          : filtered.map(e => {
              const isAdded = existingMemberIds.has(e.id);
              const teamEntry = e.isTeam ? teamEntryForId(e.id) : null;
              return (
                <div
                  key={e.id}
                  className={`pp-picker-item${isAdded ? ' disabled' : ''}`}
                  onClick={() => { if (!isAdded) { onSelect(e.id, e.track); } }}
                >
                  {e.isTeam
                    ? <div className="pp-picker-av team">{teamEntry?.abbr ?? e.name.slice(0, 2).toUpperCase()}</div>
                    : <div className="pp-picker-av" style={{ background: avColor(e.id) }}>{initials(e.name)}</div>
                  }
                  <div className="pp-picker-info">
                    <div className="pp-picker-name">{e.name}{e.isTeam ? ' Team' : ''}</div>
                    <div className="pp-picker-sub">{e.sub}</div>
                  </div>
                  {isAdded
                    ? <span className="pp-picker-added">Added</span>
                    : <span className={`pp-picker-badge ${e.isTeam ? 'team' : e.track.toLowerCase()}`}>
                        {e.isTeam ? 'Team' : e.track}
                      </span>
                  }
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function PortfolioPlanning() {
  const state = useCurrentState();
  const plan  = usePortfolioPlan();
  const scenarios = useAppStore(useShallow(s => s.data.scenarios));

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]   = useState<'epic' | 'people' | 'summary'>('epic');
  const [drawerOpen, setDrawerOpen]           = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingManualEpic, setEditingManualEpic] = useState<ManualEpic | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(loadActiveScenarioId);
  const [renamingScenarioId, setRenamingScenarioId] = useState<string | null>(null);
  const [activeQIdx, setActiveQIdx] = useState(1);
  const [epicCollapsed, setEpicCollapsed]   = useState<Record<string, boolean>>({});
  const [phasePersonCollapsed, setPhasePersonCollapsed] = useState<Record<string, boolean>>({});
  const [pvExpanded, setPvExpanded] = useState<Record<string, boolean>>({});
  const [weekW, setWeekW]           = useState(52);
  const [panelWidth, setPanelWidth] = useState(460);
  const [pickerTarget, setPickerTarget] = useState<{
    epicKey: string; phase: PlanningPhase; phaseInstanceId: string; rect: DOMRect;
  } | null>(null);

  // ── Drag state (phase bars) ────────────────────────────────────────────────
  const dragRef = useRef<{ epicKey: string; phase: PlanningPhase; phaseInstanceId: string; startX: number; origDay: number } | null>(null);

  // ── Resize state (left panel) ──────────────────────────────────────────────
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const ppRootRef    = useRef<HTMLDivElement>(null);
  const epicLpRef    = useRef<HTMLDivElement>(null);
  const epicGanttRef = useRef<HTMLDivElement>(null);
  const pvLpRef      = useRef<HTMLDivElement>(null);
  const pvGanttRef   = useRef<HTMLDivElement>(null);

  // ── Derived data ───────────────────────────────────────────────────────────
  const rollingQuarterOpts = useMemo(() => getRollingPortfolioQuarterOpts(), []);
  const fullYearOpt = useMemo(
    () => getPortfolioQuarterOpts().find(opt => opt.q === -1) ?? {
      label: `Full Year ${new Date().getFullYear()}`,
      q: -1,
      year: new Date().getFullYear(),
    },
    [],
  );
  const quarterIndicatorOpts = useMemo(
    () => [...rollingQuarterOpts, fullYearOpt],
    [fullYearOpt, rollingQuarterOpts],
  );
  const activeQuarterOpt = quarterIndicatorOpts[activeQIdx] ?? quarterIndicatorOpts[1] ?? fullYearOpt;
  const isFullYearActive = activeQuarterOpt.q === -1;
  const timelineOpts = useMemo(
    () => (isFullYearActive ? [activeQuarterOpt] : rollingQuarterOpts),
    [activeQuarterOpt, isFullYearActive, rollingQuarterOpts],
  );
  const quarterWeeks = useMemo(
    () => timelineOpts.map(q => genWeeksForQOpt(q)),
    [timelineOpts],
  );
  const quarterSegments = useMemo(() => {
    let startWeekIdx = 0;
    return timelineOpts.map((q, idx) => {
      const weekCount = quarterWeeks[idx]?.length ?? 0;
      const segment = { ...q, startWeekIdx, weekCount };
      startWeekIdx += weekCount;
      return segment;
    });
  }, [quarterWeeks, timelineOpts]);
  const weeks = useMemo(() => {
    let idxOffset = 0;
    return quarterWeeks.flatMap(group => {
      const normalized = group.map(week => ({ ...week, idx: idxOffset + week.idx }));
      idxOffset += group.length;
      return normalized;
    });
  }, [quarterWeeks]);
  const visibleSegmentIdx = isFullYearActive ? 0 : Math.max(0, Math.min(activeQIdx, quarterSegments.length - 1));
  const dayW   = weekW / 5;
  const tStart = weeks[0]?.startDate ?? new Date();
  const quarter = activeQuarterOpt.q === -1
    ? `Full Year ${activeQuarterOpt.year}`
    : `Q${activeQuarterOpt.q + 1} ${activeQuarterOpt.year}`;
  const initialTimelineWeekOffset = useMemo(() => {
    if (weeks.length === 0) return 0;
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 1);
    let weekOffset = 0;
    for (const week of weeks) {
      if (week.startDate > targetDate) break;
      weekOffset = week.idx;
    }
    return weekOffset;
  }, [weeks]);
  const pendingQuarterScrollRef = useRef<number | null>(null);
  const ganttWeekOffsetRef = useRef(initialTimelineWeekOffset);

  const portfolioCandidateConnectionIds = useMemo(
    () => new Set(
      state.jiraConnections
        .filter(connection => connection.scenarioPlannerOnly)
        .map(connection => connection.id)
    ),
    [state.jiraConnections]
  );
  const allEpics = useMemo(
    () => state.jiraWorkItems.filter(item =>
      item.type === 'epic' || portfolioCandidateConnectionIds.has(item.connectionId)
    ),
    [state.jiraWorkItems, portfolioCandidateConnectionIds]
  );
  const jiraBaseUrl = useMemo(() => {
    const conn = state.jiraConnections.find(c => c.isActive);
    return conn?.jiraBaseUrl.replace(/\/+$/, '') ?? '';
  }, [state.jiraConnections]);
  const portfolioScenarios = useMemo(
    () => scenarios.filter(isPortfolioScenario),
    [scenarios]
  );

  // Active scenario (null = live base plan)
  const activeScenario = portfolioScenarios.find(s => s.id === activeScenarioId) ?? null;
  const activeBoardEpicKeys = activeScenario?.portfolioBoardEpicKeys ?? plan.boardEpicKeys;
  const activeManualEpics = activeScenario?.portfolioManualEpics ?? plan.manualEpics;
  const activePhasePlansRaw = activeScenario?.portfolioPhasePlans ?? plan.phasePlans;
  const activePhaseAssignmentsRaw = activeScenario?.portfolioPhaseAssignments ?? plan.phaseAssignments;
  const activePhasePlans = useMemo(
    () => activePhasePlansRaw.map(item => ({
      ...item,
      phaseInstanceId: item.phaseInstanceId ?? item.phase,
      phaseOrder: item.phaseOrder ?? 0,
      description: item.description ?? null,
    })),
    [activePhasePlansRaw],
  );
  const activePhaseAssignments = useMemo(
    () => activePhaseAssignmentsRaw.map(item => ({ ...item, phaseInstanceId: item.phaseInstanceId ?? item.phase })),
    [activePhaseAssignmentsRaw],
  );

  useEffect(() => {
    if (activeScenarioId !== null && !activeScenario) {
      setActiveScenarioId(null);
      saveActiveScenarioId(null);
    }
  }, [activeScenarioId, activeScenario]);

  const nextManualCode = useMemo(() => {
    const nums = activeManualEpics
      .map(e => e.epicKey.match(/^MAN-(\d+)$/)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number);
    const max = nums.length > 0 ? Math.max(...nums) : 999;
    return `MAN-${max + 1}`;
  }, [activeManualEpics]);

  const manualEpicMap = useMemo(
    () => new Map(activeManualEpics.map(e => [e.epicKey, e])),
    [activeManualEpics]
  );

  const boardEpics = useMemo(() => {
    return activeBoardEpicKeys.map(k => {
      const jira = allEpics.find(e => e.jiraKey === k);
      if (jira) return jira;
      const manual = manualEpicMap.get(k);
      if (manual) return manualToJiraWorkItem(manual);
      return null;
    }).filter(Boolean) as JiraWorkItem[];
  }, [activeBoardEpicKeys, allEpics, manualEpicMap]);

  const memberMap  = useMemo(() => new Map(state.teamMembers.map(m => [m.id, m])), [state.teamMembers]);
  const contactMap = useMemo(() => new Map(state.businessContacts.map(c => [c.id, c])), [state.businessContacts]);

  // Maps epicKey → phase → phase instances[]
  const phasePlansMap = useMemo(() => {
    const m = new Map<string, PhasePlansByType>();
    for (const p of activePhasePlans) {
      if (!m.has(p.epicKey)) m.set(p.epicKey, new Map());
      const phaseMap = m.get(p.epicKey)!;
      if (!phaseMap.has(p.phase)) phaseMap.set(p.phase, []);
      phaseMap.get(p.phase)!.push(p);
    }
    for (const phaseMap of m.values()) {
      for (const plans of phaseMap.values()) plans.sort((a, b) => a.phaseOrder - b.phaseOrder);
    }
    return m;
  }, [activePhasePlans]);

  // Maps epicKey → phaseInstanceId → assignments[]
  const assignMap = useMemo(() => {
    const m = new Map<string, PhaseAssignmentsByInstance>();
    for (const a of activePhaseAssignments) {
      if (!m.has(a.epicKey)) m.set(a.epicKey, new Map());
      const phMap = m.get(a.epicKey)!;
      if (!phMap.has(a.phaseInstanceId)) phMap.set(a.phaseInstanceId, []);
      phMap.get(a.phaseInstanceId)!.push(a);
    }
    return m;
  }, [activePhaseAssignments]);

  const absenceLookup = useMemo(
    () => buildAbsenceLookup(activeQuarterOpt, state.teamMembers, state),
    [activeQuarterOpt, state]
  );

  // People summaries for People View and Summary View
  const peopleSummaries = useMemo((): PersonSummary[] => {
    const map = new Map<string, PersonSummary>();

    for (const epic of boardEpics) {
      const phaseRows = getPhaseInstanceRows(
        phasePlansMap.get(epic.jiraKey) ?? new Map(),
        assignMap.get(epic.jiraKey) ?? new Map(),
      );
      for (const row of phaseRows) {
        const phase = row.phase;
        const assignments = row.assignments;
        const phasePlan = row.plan;
        const startDate = phasePlan?.startDate ?? null;
        const startDay  = startDate !== null ? dateToDay(startDate, tStart) : null;
        const barW      = phasePlan ? (phaseBarWidthDays(phasePlan, tStart) ?? calcBarWidthDays(assignments, absenceLookup)) : calcBarWidthDays(assignments, absenceLookup);
        for (const a of assignments) {
          if (!map.has(a.memberId)) {
            const member  = memberMap.get(a.memberId);
            const contact = contactMap.get(a.memberId);
            const name    = member?.name ?? contact?.name ?? a.memberId;
            const role    = member?.role ?? contact?.title ?? '';
            let availDays = 0;
            if (member) {
              availDays = calculateMemberAvailableDays(member.id, activeQuarterOpt, state);
            } else if (contact) {
              availDays = calculateBusinessAvailableDays(contact, activeQuarterOpt, state);
            }
            map.set(a.memberId, { id: a.memberId, member, contact, name, role, availDays, assignments: [] });
          }
          map.get(a.memberId)!.assignments.push({
            epic, phase, phaseInstanceId: row.phaseInstanceId, phaseOrder: row.phaseOrder, days: a.days,
            startDay: startDay ?? 0,
            barW,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeQuarterOpt, boardEpics, assignMap, phasePlansMap, absenceLookup, memberMap, contactMap, state, tStart]);

  // Maps memberId → overload tier ('over' | 'near') for quarter-level capacity
  const personOverloadMap = useMemo((): Map<string, 'over' | 'near'> => {
    const m = new Map<string, 'over' | 'near'>();
    for (const ps of peopleSummaries) {
      if (ps.availDays <= 0) continue;
      const totalDays = ps.assignments.reduce((s, a) => s + a.days, 0);
      const pct = totalDays / ps.availDays;
      if (pct > 1) m.set(ps.id, 'over');
      else if (pct > 0.85) m.set(ps.id, 'near');
    }
    return m;
  }, [peopleSummaries]);

  const handleTimelineScroll = useCallback((el: HTMLDivElement) => {
    ganttWeekOffsetRef.current = weekW > 0 ? el.scrollLeft / weekW : 0;
    if (isFullYearActive) return;

    const viewportLeft = el.scrollLeft;
    const viewportRight = viewportLeft + el.clientWidth;
    const tolerance = Math.max(12, weekW * 0.35);

    let nextActiveIdx: number | null = null;
    for (let i = 0; i < quarterSegments.length; i++) {
      const segment = quarterSegments[i];
      const startPx = segment.startWeekIdx * weekW;
      const endPx = (segment.startWeekIdx + segment.weekCount) * weekW;
      const visibleWidth = Math.max(0, Math.min(endPx, viewportRight) - Math.max(startPx, viewportLeft));
      if (visibleWidth >= (endPx - startPx) - tolerance) {
        nextActiveIdx = i;
        break;
      }
    }

    if (nextActiveIdx !== null && nextActiveIdx !== activeQIdx) {
      setActiveQIdx(nextActiveIdx);
    }
  }, [activeQIdx, isFullYearActive, quarterSegments, weekW]);

  // ── Week width (recalculates when panel resizes or drawer opens) ───────────
  useEffect(() => {
    const apply = () => {
      const visibleQuarterWeeks = quarterSegments[visibleSegmentIdx]?.weekCount ?? 1;
      const w = calcWeekW(visibleQuarterWeeks, drawerOpen, panelWidth);
      setWeekW(w);
      ppRootRef.current?.style.setProperty('--week-w', w + 'px');
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [drawerOpen, panelWidth, quarterSegments, visibleSegmentIdx]);

  useEffect(() => {
    if (activeTab === 'summary') return;

    const ganttEl = activeTab === 'epic' ? epicGanttRef.current : pvGanttRef.current;
    if (!ganttEl) return;

    const targetWeekOffset = pendingQuarterScrollRef.current !== null
      ? quarterSegments[pendingQuarterScrollRef.current]?.startWeekIdx ?? ganttWeekOffsetRef.current
      : ganttWeekOffsetRef.current;
    const targetScrollLeft = targetWeekOffset * weekW;

    ganttEl.scrollLeft = targetScrollLeft;
    ganttWeekOffsetRef.current = targetWeekOffset;
    pendingQuarterScrollRef.current = null;
  }, [activeTab, quarterSegments, weekW]);

  // ── Sync --left-w CSS variable when panel width changes ────────────────────
  useEffect(() => {
    ppRootRef.current?.style.setProperty('--left-w', panelWidth + 'px');
  }, [panelWidth]);

  // ── Left panel resize event handlers ──────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const newW = Math.max(200, Math.min(700, resizeRef.current.startW + (e.clientX - resizeRef.current.startX)));
      setPanelWidth(newW);
    };
    const onUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ── Left panel resize ─────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startW: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  const handleQuarterIndicatorClick = useCallback((idx: number) => {
    const nextOpt = quarterIndicatorOpts[idx];
    if (!nextOpt) return;

    const nextIsFullYear = nextOpt.q === -1;
    const targetSegmentIdx = nextIsFullYear ? 0 : idx;
    pendingQuarterScrollRef.current = targetSegmentIdx;
    setActiveQIdx(idx);

    const ganttEl = activeTab === 'epic' ? epicGanttRef.current : activeTab === 'people' ? pvGanttRef.current : null;
    if (!ganttEl || isFullYearActive !== nextIsFullYear) return;

    const targetWeekOffset = quarterSegments[targetSegmentIdx]?.startWeekIdx ?? 0;
    ganttWeekOffsetRef.current = targetWeekOffset;
    ganttEl.scrollTo({ left: targetWeekOffset * weekW, behavior: 'smooth' });
  }, [activeTab, isFullYearActive, quarterIndicatorOpts, quarterSegments, weekW]);

  // ── Person / team picker ───────────────────────────────────────────────────
  const handleAddPerson = useCallback((epicKey: string, phase: PlanningPhase, phaseInstanceId: string, rect: DOMRect) => {
    setPickerTarget(prev =>
      prev?.epicKey === epicKey && prev?.phaseInstanceId === phaseInstanceId ? null : { epicKey, phase, phaseInstanceId, rect }
    );
  }, []);

  // ── Mutation helpers (route to fork state or base plan) ───────────────────

  const updateActiveScenario = useCallback((
    updater: (snapshot: PortfolioScenarioSnapshot) => PortfolioScenarioSnapshot
  ) => {
    if (!activeScenario) return;
    const next = updater({
      boardEpicKeys: activeScenario.portfolioBoardEpicKeys ?? [],
      manualEpics: activeScenario.portfolioManualEpics ?? [],
      phasePlans: activeScenario.portfolioPhasePlans ?? [],
      phaseAssignments: activeScenario.portfolioPhaseAssignments ?? [],
    });
    updatePortfolioScenario(activeScenario.id, {
      portfolioBoardEpicKeys: next.boardEpicKeys,
      portfolioManualEpics: next.manualEpics,
      portfolioPhasePlans: next.phasePlans,
      portfolioPhaseAssignments: next.phaseAssignments,
    });
  }, [activeScenario]);

  const handleAddPhaseInstance = useCallback(async (epicKey: string, phase: PlanningPhase) => {
    if (activeScenario) {
      const now = new Date().toISOString();
      const phaseOrder = activePhasePlans.filter(p => p.epicKey === epicKey && p.phase === phase).length;
      const phaseInstanceId = `${phase}-${Date.now()}`;
      updateActiveScenario(s => ({
        ...s,
        phasePlans: [...s.phasePlans, { id: `local-${epicKey}-${phaseInstanceId}`, epicKey, phase, phaseInstanceId, phaseOrder, startDate: null, endDate: null, description: null, updatedAt: now }],
      }));
      return;
    }
    await plan.addPhaseInstance(epicKey, phase);
  }, [activeScenario, activePhasePlans, updateActiveScenario, plan]);

  const handleRemovePhaseInstance = useCallback(async (epicKey: string, phaseInstanceId: string) => {
    if (activeScenario) {
      updateActiveScenario(s => ({
        ...s,
        phasePlans: s.phasePlans.filter(p => !(p.epicKey === epicKey && p.phaseInstanceId === phaseInstanceId)),
        phaseAssignments: s.phaseAssignments.filter(a => !(a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId)),
      }));
      return;
    }
    await plan.removePhaseInstance(epicKey, phaseInstanceId);
  }, [activeScenario, updateActiveScenario, plan]);

  const handleUpdatePhasePlan = useCallback(async (
    epicKey: string,
    phase: PlanningPhase,
    phaseInstanceId: string,
    changes: PhasePlanChanges,
  ) => {
    if (activeScenario) {
      const now = new Date().toISOString();
      updateActiveScenario(s => {
        const phaseOrder = s.phasePlans.find(p => p.epicKey === epicKey && p.phaseInstanceId === phaseInstanceId)?.phaseOrder
          ?? s.phasePlans.filter(p => p.epicKey === epicKey && p.phase === phase).length;
        const existing = s.phasePlans.find(p => p.epicKey === epicKey && p.phaseInstanceId === phaseInstanceId);
        const nextPlan: EpicPhasePlan = existing
          ? { ...existing, ...changes, updatedAt: now }
          : {
              id: `local-${epicKey}-${phaseInstanceId}`,
              epicKey,
              phase,
              phaseInstanceId,
              phaseOrder,
              startDate: changes.startDate ?? null,
              endDate: changes.endDate ?? null,
              description: changes.description ?? null,
              updatedAt: now,
            };
        const phasePlans = s.phasePlans.filter(p => !(p.epicKey === epicKey && p.phaseInstanceId === phaseInstanceId));
        return { ...s, phasePlans: [...phasePlans, nextPlan] };
      });
      return;
    }
    await plan.updatePhasePlan(epicKey, phase, changes, phaseInstanceId);
  }, [activeScenario, updateActiveScenario, plan]);

  const handleSetPhaseStartDate = useCallback(async (epicKey: string, phase: PlanningPhase, startDate: string, phaseInstanceId: string = getDefaultPhaseInstanceId(phase)) => {
    await handleUpdatePhasePlan(epicKey, phase, phaseInstanceId, { startDate });
  }, [handleUpdatePhasePlan]);

  const handleSetPhaseEndDate = useCallback(async (epicKey: string, phase: PlanningPhase, endDate: string, phaseInstanceId: string = getDefaultPhaseInstanceId(phase)) => {
    await handleUpdatePhasePlan(epicKey, phase, phaseInstanceId, { endDate });
  }, [handleUpdatePhasePlan]);

  const handleClearPhase = useCallback(async (epicKey: string, phase: PlanningPhase, phaseInstanceId: string = getDefaultPhaseInstanceId(phase)) => {
    await handleUpdatePhasePlan(epicKey, phase, phaseInstanceId, { startDate: null, endDate: null });
  }, [handleUpdatePhasePlan]);

  const handleUpsertAssignment = useCallback(async (
    epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, days: number, track: 'IT' | 'BIZ',
    options?: { allocationMode?: AllocationMode; daysPerWeek?: number }
  ) => {
    const mode = options?.allocationMode ?? 'flat';
    const dpw  = options?.daysPerWeek;
    if (activeScenario) {
      const now = new Date().toISOString();
      updateActiveScenario((s: PortfolioScenarioSnapshot) => {
        const existing = s.phaseAssignments.find(
          (a: EpicPhaseAssignment) => a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId
        );
        const newAssignments: EpicPhaseAssignment[] = existing
          ? s.phaseAssignments.map((a: EpicPhaseAssignment) =>
              a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId
                ? { ...a, days, track, allocationMode: mode, daysPerWeek: dpw, updatedAt: now } : a
            )
          : [...s.phaseAssignments, { id: `local-${epicKey}-${phaseInstanceId}-${memberId}`, epicKey, phase, phaseInstanceId, memberId, days, track, allocationMode: mode, daysPerWeek: dpw, updatedAt: now }];
        return { ...s, phaseAssignments: newAssignments };
      });
    } else {
      await plan.upsertAssignment(epicKey, phase, phaseInstanceId, memberId, days, track, { allocationMode: mode, daysPerWeek: dpw });
    }
  }, [activeScenario, updateActiveScenario, plan]);

  const handleUpdateAllocationMode = useCallback(async (
    epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, mode: AllocationMode, daysPerWeek?: number
  ) => {
    const existing = activePhaseAssignments.find(
      (a: EpicPhaseAssignment) => a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId
    );
    if (!existing) return;
    await handleUpsertAssignment(epicKey, phase, phaseInstanceId, memberId, existing.days, existing.track, { allocationMode: mode, daysPerWeek });
  }, [activePhaseAssignments, handleUpsertAssignment]);

  const handleUpsertSegment = useCallback(async (
    epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, seg: AllocationSegment
  ) => {
    if (activeScenario) {
      const now = new Date().toISOString();
      updateActiveScenario((s: PortfolioScenarioSnapshot) => ({
        ...s,
        phaseAssignments: s.phaseAssignments.map((a: EpicPhaseAssignment) => {
          if (a.epicKey !== epicKey || a.phaseInstanceId !== phaseInstanceId || a.memberId !== memberId) return a;
          const existing: AllocationSegment[] = a.segments ?? [];
          const idx = existing.findIndex((s2: AllocationSegment) => s2.id === seg.id);
          const newSegs: AllocationSegment[] = idx >= 0 ? existing.map((s2: AllocationSegment, i: number) => (i === idx ? seg : s2)) : [...existing, seg];
          return { ...a, segments: newSegs, days: newSegs.reduce((sum: number, s2: AllocationSegment) => sum + s2.days, 0), updatedAt: now };
        }),
      }));
    } else {
      await plan.upsertSegment(epicKey, phase, phaseInstanceId, memberId, seg);
    }
  }, [activeScenario, updateActiveScenario, plan]);

  const handleRemoveSegment = useCallback(async (
    epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string, segmentId: string
  ) => {
    if (activeScenario) {
      const now = new Date().toISOString();
      updateActiveScenario((s: PortfolioScenarioSnapshot) => ({
        ...s,
        phaseAssignments: s.phaseAssignments.map((a: EpicPhaseAssignment) => {
          if (a.epicKey !== epicKey || a.phaseInstanceId !== phaseInstanceId || a.memberId !== memberId) return a;
          const newSegs: AllocationSegment[] = (a.segments ?? []).filter((sg: AllocationSegment) => sg.id !== segmentId);
          return { ...a, segments: newSegs, days: newSegs.reduce((sum: number, sg: AllocationSegment) => sum + sg.days, 0), updatedAt: now };
        }),
      }));
    } else {
      await plan.removeSegment(epicKey, phase, phaseInstanceId, memberId, segmentId);
    }
  }, [activeScenario, updateActiveScenario, plan]);

  const handleRemoveAssignment = useCallback(async (epicKey: string, phase: PlanningPhase, phaseInstanceId: string, memberId: string) => {
    if (activeScenario) {
      updateActiveScenario((s: PortfolioScenarioSnapshot) => ({
        ...s,
        phaseAssignments: s.phaseAssignments.filter(
          (a: EpicPhaseAssignment) => !(a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId)
        ),
      }));
    } else {
      await plan.removeAssignment(epicKey, phase, phaseInstanceId, memberId);
    }
  }, [activeScenario, updateActiveScenario, plan]);

  const handleRemoveEpic = useCallback((epicKey: string) => {
    if (activeScenario) {
      updateActiveScenario((s: PortfolioScenarioSnapshot) => ({
        ...s,
        boardEpicKeys: s.boardEpicKeys.filter((k: string) => k !== epicKey),
        phasePlans: s.phasePlans.filter((p: EpicPhasePlan) => p.epicKey !== epicKey),
        phaseAssignments: s.phaseAssignments.filter((a: EpicPhaseAssignment) => a.epicKey !== epicKey),
      }));
      return;
    }
    plan.removeEpicFromBoard(epicKey);
  }, [activeScenario, updateActiveScenario, plan]);

  const handleCreateManualEpic = useCallback((input: {
    summary: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    if (activeScenario) {
      const epicKey = nextManualCode;
      const manualEpic: ManualEpic = {
        epicKey,
        summary: input.summary,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
      };
      updateActiveScenario((s: PortfolioScenarioSnapshot) => ({
        ...s,
        manualEpics: [...s.manualEpics, manualEpic],
        boardEpicKeys: s.boardEpicKeys.includes(epicKey) ? s.boardEpicKeys : [...s.boardEpicKeys, epicKey],
      }));
      return epicKey;
    }
    return plan.addManualEpic(input);
  }, [activeScenario, nextManualCode, updateActiveScenario, plan]);

  const handleUpdateManualEpic = useCallback((
    epicKey: string,
    changes: { summary?: string; description?: string; startDate?: string; endDate?: string },
  ) => {
    if (activeScenario) {
      updateActiveScenario((s: PortfolioScenarioSnapshot) => ({
        ...s,
        manualEpics: s.manualEpics.map((epic: ManualEpic) => epic.epicKey === epicKey ? { ...epic, ...changes } : epic),
      }));
      return;
    }
    plan.updateManualEpic(epicKey, changes);
  }, [activeScenario, updateActiveScenario, plan]);

  const handleDeleteManualEpic = useCallback((epicKey: string) => {
    if (activeScenario) {
      updateActiveScenario((s: PortfolioScenarioSnapshot) => ({
        ...s,
        boardEpicKeys: s.boardEpicKeys.filter((k: string) => k !== epicKey),
        manualEpics: s.manualEpics.filter((epic: ManualEpic) => epic.epicKey !== epicKey),
        phasePlans: s.phasePlans.filter((planItem: EpicPhasePlan) => planItem.epicKey !== epicKey),
        phaseAssignments: s.phaseAssignments.filter((assignment: EpicPhaseAssignment) => assignment.epicKey !== epicKey),
      }));
      return;
    }
    plan.deleteManualEpic(epicKey);
  }, [activeScenario, updateActiveScenario, plan]);

  // ── Scenario management ────────────────────────────────────────────────────

  const forkCurrentPlan = useCallback((name: string) => {
    const created = createPortfolioScenario(name, {
      boardEpicKeys: activeBoardEpicKeys,
      manualEpics: activeManualEpics,
      phasePlans: activePhasePlans,
      phaseAssignments: activePhaseAssignments,
    });
    setActiveScenarioId(created.id);
    saveActiveScenarioId(created.id);
  }, [activeBoardEpicKeys, activeManualEpics, activePhasePlans, activePhaseAssignments]);

  const renameScenario = useCallback((id: string, name: string) => {
    updatePortfolioScenario(id, { name });
  }, []);

  const handleDeleteScenario = useCallback((id: string) => {
    deleteScenario(id);
    if (activeScenarioId === id) {
      setActiveScenarioId(null);
      saveActiveScenarioId(null);
    }
  }, [activeScenarioId]);

  const switchScenario = useCallback((id: string | null) => {
    setActiveScenarioId(id);
    saveActiveScenarioId(id);
    setRenamingScenarioId(null);
  }, []);

  // ── Drag to reposition / resize phase bar ────────────────────────────────
  const handleDragPhaseStart = useCallback((epicKey: string, phase: PlanningPhase, phaseInstanceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const plan0 = (phasePlansMap.get(epicKey)?.get(phase) ?? []).find(plan => plan.phaseInstanceId === phaseInstanceId) ?? null;
    const startDate = plan0?.startDate ?? null;
    const origDay   = startDate !== null ? dateToDay(startDate, tStart) : 0;
    dragRef.current = { epicKey, phase, phaseInstanceId, startX: e.clientX, origDay };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx     = ev.clientX - dragRef.current.startX;
      const dDay   = Math.round(dx / dayW);
      const newDay = Math.max(0, dragRef.current.origDay + dDay);
      const newDate = dayToIsoDate(newDay, tStart);
      handleSetPhaseStartDate(dragRef.current.epicKey, dragRef.current.phase, newDate, dragRef.current.phaseInstanceId);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [phasePlansMap, dayW, tStart, handleSetPhaseStartDate]);

  const handleDragPhaseEnd = useCallback((epicKey: string, phase: PlanningPhase, phaseInstanceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const plan0   = (phasePlansMap.get(epicKey)?.get(phase) ?? []).find(plan => plan.phaseInstanceId === phaseInstanceId) ?? null;
    const endDate = plan0?.endDate ?? plan0?.startDate ?? null;
    const origDay = endDate !== null ? dateToDay(endDate, tStart) : 0;
    dragRef.current = { epicKey, phase, phaseInstanceId, startX: e.clientX, origDay };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx     = ev.clientX - dragRef.current.startX;
      const dDay   = Math.round(dx / dayW);
      const newDay = Math.max(1, dragRef.current.origDay + dDay);
      const newDate = dayToIsoDate(newDay, tStart);
      handleSetPhaseEndDate(dragRef.current.epicKey, dragRef.current.phase, newDate, dragRef.current.phaseInstanceId);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [phasePlansMap, dayW, tStart, handleSetPhaseEndDate]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleEpic = useCallback((key: string) => {
    setEpicCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const togglePhasePersons = useCallback((epicKey: string, phaseInstanceId: string) => {
    const key = `${epicKey}_${phaseInstanceId}`;
    setPhasePersonCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSaveDrawer = useCallback((keys: string[]) => {
    if (activeScenario) {
      updateActiveScenario(s => ({ ...s, boardEpicKeys: keys }));
      setDrawerOpen(false);
      return;
    }
    const removed = plan.boardEpicKeys.filter(k => !keys.includes(k));
    const added   = keys.filter(k => !plan.boardEpicKeys.includes(k));
    removed.forEach(k => plan.removeEpicFromBoard(k));
    added.forEach(k => plan.addEpicToBoard(k));
    setDrawerOpen(false);
  }, [activeScenario, updateActiveScenario, plan]);

  const expandAll = useCallback(() => {
    const ec: Record<string, boolean> = {};
    const ppc: Record<string, boolean> = {};
    for (const e of boardEpics) {
      ec[e.jiraKey] = false;
      const phaseRows = getPhaseInstanceRows(
        phasePlansMap.get(e.jiraKey) ?? new Map(),
        assignMap.get(e.jiraKey) ?? new Map(),
      );
      for (const row of phaseRows) ppc[`${e.jiraKey}_${row.phaseInstanceId}`] = false;
    }
    setEpicCollapsed(ec);
    setPhasePersonCollapsed(ppc);
  }, [boardEpics, phasePlansMap, assignMap]);

  const collapseAll = useCallback(() => {
    const ec: Record<string, boolean> = {};
    for (const e of boardEpics) ec[e.jiraKey] = true;
    setEpicCollapsed(ec);
  }, [boardEpics]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pp-root" ref={ppRootRef}>
      {/* Topbar */}
      <div className={`pp-topbar${drawerOpen ? ' drawer-open' : ''}`}>
        <div className="pp-tb-title">
          Portfolio Planning
          <span className="pp-tb-badge">VS Finance · {quarter}</span>
        </div>
        <div className="pp-seg">
          {quarterIndicatorOpts.map((q, i) => (
            <button
              key={i}
              className={`pp-seg-btn${i === activeQIdx ? ' on' : ''}`}
              onClick={() => handleQuarterIndicatorClick(i)}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="pp-divider" />
        <button className="pp-btn primary" onClick={() => setDrawerOpen(true)}>
          + Add Epics
        </button>
      </div>

      {/* Scenario bar */}
      <div className="pp-scenario-bar">
        <button
          className={`pp-scenario-pill${activeScenarioId === null ? ' on' : ''}`}
          onClick={() => switchScenario(null)}
        >
          Main Plan
        </button>
        {portfolioScenarios.map(s => (
          <span key={s.id} className={`pp-scenario-pill-wrap${activeScenarioId === s.id ? ' on' : ''}`}>
            {renamingScenarioId === s.id ? (
              <input
                className="pp-scenario-rename-inp"
                defaultValue={s.name}
                autoFocus
                onBlur={e => { renameScenario(s.id, e.target.value || s.name); setRenamingScenarioId(null); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setRenamingScenarioId(null); }
                }}
              />
            ) : (
              <button
                className={`pp-scenario-pill${activeScenarioId === s.id ? ' on' : ''}`}
                onClick={() => switchScenario(s.id)}
                onDoubleClick={() => setRenamingScenarioId(s.id)}
                title="Double-click to rename"
              >
                {s.name}
              </button>
            )}
            <button
              className="pp-scenario-delete"
              onClick={() => handleDeleteScenario(s.id)}
              title="Delete scenario"
            >
              ×
            </button>
          </span>
        ))}
        <button
          className="pp-scenario-fork-btn"
          onClick={() => forkCurrentPlan(`Plan ${portfolioScenarios.length + 2}`)}
          title="Duplicate current plan as a new scenario"
        >
          + Duplicate
        </button>
      </div>

      {/* Tab bar */}
      <div className="pp-tabbar">
        <button className={`pp-tab${activeTab === 'epic'    ? ' on' : ''}`} onClick={() => setActiveTab('epic')}>⬡ Epic View</button>
        <button className={`pp-tab${activeTab === 'people'  ? ' on' : ''}`} onClick={() => setActiveTab('people')}>◎ People View</button>
        <button className={`pp-tab${activeTab === 'summary' ? ' on' : ''}`} onClick={() => setActiveTab('summary')}>▦ Summary</button>
      </div>

      {/* Views */}
      <div className="pp-body" style={{ position: 'relative' }}>
        {activeTab === 'epic' && (
          <EpicView
            boardEpics={boardEpics}
            phasePlansMap={phasePlansMap}
            assignMap={assignMap}
            absenceLookup={absenceLookup}
            memberMap={memberMap}
            contactMap={contactMap}
            weeks={weeks}
            tStart={tStart}
            dayW={dayW}
            panelWidth={panelWidth}
            epicCollapsed={epicCollapsed}
            phasePersonCollapsed={phasePersonCollapsed}
            onToggleEpic={toggleEpic}
            onTogglePhasePersons={togglePhasePersons}
            onRemoveEpic={handleRemoveEpic}
            onAddPhaseInstance={handleAddPhaseInstance}
            onRemovePhaseInstance={handleRemovePhaseInstance}
            onSetPhaseStart={(epicKey, phase, phaseInstanceId, weekIdx) =>
              handleSetPhaseStartDate(epicKey, phase, dayToIsoDate(weekIdx * 5, tStart), phaseInstanceId)
            }
            onDragPhaseStart={handleDragPhaseStart}
            onDragPhaseEnd={handleDragPhaseEnd}
            onClearPhase={handleClearPhase}
            onRemoveAssignment={handleRemoveAssignment}
            onUpdateDays={(epicKey, phase, phaseInstanceId, memberId, days) => {
              const existing = activePhaseAssignments.find(a => a.epicKey === epicKey && a.phaseInstanceId === phaseInstanceId && a.memberId === memberId);
              if (existing) handleUpsertAssignment(epicKey, phase, phaseInstanceId, memberId, days, existing.track, { allocationMode: existing.allocationMode, daysPerWeek: existing.daysPerWeek });
            }}
            onUpdatePhasePlan={handleUpdatePhasePlan}
            onUpdateAllocationMode={handleUpdateAllocationMode}
            onUpsertSegment={handleUpsertSegment}
            onRemoveSegment={handleRemoveSegment}
            onAddPerson={handleAddPerson}
            onExpandAll={expandAll}
            onCollapseAll={collapseAll}
            onResizeMouseDown={handleResizeMouseDown}
            lpRef={epicLpRef}
            ganttRef={epicGanttRef}
            onTimelineScroll={handleTimelineScroll}
            personOverloadMap={personOverloadMap}
            allJiraItems={state.jiraWorkItems}
            jiraBaseUrl={jiraBaseUrl}
          />
        )}
        {activeTab === 'people' && (
          <PeopleView
            peopleSummaries={peopleSummaries}
            weeks={weeks}
            tStart={tStart}
            dayW={dayW}
            panelWidth={panelWidth}
            pvExpanded={pvExpanded}
            onTogglePerson={id => setPvExpanded(prev => ({ ...prev, [id]: !prev[id] }))}
            onResizeMouseDown={handleResizeMouseDown}
            lpRef={pvLpRef}
            ganttRef={pvGanttRef}
            onTimelineScroll={handleTimelineScroll}
            jiraBaseUrl={jiraBaseUrl}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryView
            processTeams={state.processTeams}
            boardEpics={boardEpics}
            peopleSummaries={peopleSummaries}
            phasePlansMap={phasePlansMap}
            assignMap={assignMap}
            absenceLookup={absenceLookup}
            weeks={weeks}
            quarter={quarter}
            quarterOpt={activeQuarterOpt}
            state={state}
            jiraBaseUrl={jiraBaseUrl}
            activeScenarioName={activeScenario?.name ?? null}
            baselinePhasePlans={plan.phasePlans}
            baselinePhaseAssignments={plan.phaseAssignments}
          />
        )}

        {/* Manual epic create modal */}
        {manualModalOpen && (
          <AddManualEpicModal
              mode="create"
              nextCode={nextManualCode}
              onSave={input => {
              handleCreateManualEpic(input);
              setManualModalOpen(false);
            }}
            onClose={() => setManualModalOpen(false)}
          />
        )}

        {/* Manual epic edit modal */}
        {editingManualEpic && (
          <AddManualEpicModal
            mode="edit"
            epic={editingManualEpic}
            onSave={changes => {
              handleUpdateManualEpic(editingManualEpic.epicKey, changes);
              setEditingManualEpic(null);
            }}
            onClose={() => setEditingManualEpic(null)}
          />
        )}

        {/* Drawer */}
        <PortfolioDrawer
          open={drawerOpen}
          allEpics={allEpics}
          boardEpicKeys={activeBoardEpicKeys}
          manualEpics={activeManualEpics}
          onClose={() => setDrawerOpen(false)}
          onSave={handleSaveDrawer}
          onCreateManual={() => { setDrawerOpen(false); setManualModalOpen(true); }}
          onEditManual={epic => { setEditingManualEpic(epic); setDrawerOpen(false); }}
          onDeleteManual={handleDeleteManualEpic}
        />

        {/* Person / team picker popover */}
        {pickerTarget && (
          <PortfolioPickerPopover
            epicKey={pickerTarget.epicKey}
            phase={pickerTarget.phase}
            anchorRect={pickerTarget.rect}
            existingMemberIds={new Set(
              (assignMap.get(pickerTarget.epicKey)?.get(pickerTarget.phaseInstanceId) ?? []).map(a => a.memberId)
            )}
            memberMap={memberMap}
            contactMap={contactMap}
            businessTeams={state.businessTeams}
            onSelect={(memberId, track) => {
              handleUpsertAssignment(pickerTarget.epicKey, pickerTarget.phase, pickerTarget.phaseInstanceId, memberId, 0, track);
              setPickerTarget(null);
            }}
            onClose={() => setPickerTarget(null)}
          />
        )}
      </div>
    </div>
  );
}
