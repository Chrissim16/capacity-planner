/**
 * AssignPanel — Timeline mode slide-out for IT/BIZ assignments (assign-panel-spec-v2).
 * Draft edits + Save; single-column IT/BIZ sections; range sliders; inline picker.
 */

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { PlannerItem, PlannerAssignment, JiraWorkItem, Sprint } from '../../types';
import { useCurrentState } from '../../stores/appStore';
import { SkillChip } from './SkillMultiSelect';
import {
  scoreBusinessContact,
  rankBizFits,
  scoreMemberForPlanner,
  rankPlannerFits,
  FIT_COLOURS,
  type PlannerMemberFit,
  type BizFit,
  type FitLevel,
} from '../../utils/staffing';
import { calculateCapacity, calculateSprintCapacity, type SprintCapacityResult } from '../../utils/capacity';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function sortAssigneesKey(assignees: PlannerAssignment[] | undefined): string {
  return [...(assignees ?? [])]
    .sort((a, b) => a.memberId.localeCompare(b.memberId))
    .map(a => `${a.memberId}:${a.track}:${a.daysPerSprint}`)
    .join('|');
}

function draftEqualsItem(draft: PlannerItem, saved: PlannerItem): boolean {
  return (
    draft.id === saved.id &&
    sortAssigneesKey(draft.assignees) === sortAssigneesKey(saved.assignees)
  );
}

function typePillClass(type: string): string {
  const base =
    'text-[10px] font-bold uppercase tracking-[0.04em] rounded px-2 py-0.5';
  switch (type) {
    case 'epic':
    case 'feature':
      return `${base} bg-[var(--primary-light)] text-[var(--color-primary)]`;
    case 'story':
    case 'task':
    case 'custom':
      return `${base} bg-biz-light text-biz`;
    case 'bug':
      return `${base} bg-[var(--danger-light)] text-[var(--danger)]`;
    case 'uat':
      return `${base} bg-violet-100 text-violet-700`;
    case 'hypercare':
      return `${base} bg-[var(--success-light)] text-[var(--success)]`;
    default:
      return `${base} bg-biz-light text-biz`;
  }
}

function sliderPct(days: number): string {
  const pct = ((Math.min(10, Math.max(1, days)) - 1) / 9) * 100;
  return `${pct}%`;
}

/** Normalise days for slider / totals when persisted data is incomplete (IT and BIZ treated the same). */
function clampAssigneeDays(d: number | undefined): number {
  if (d == null || !Number.isFinite(d)) return 2;
  return Math.min(10, Math.max(1, Math.round(d)));
}

function assigneeRowKey(memberId: string, track: 'IT' | 'BIZ'): string {
  return `${track}:${memberId}`;
}

function fmtSprintRange(start: string, end: string): string {
  const f = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(start)} – ${f(end)}`;
}

// ── Assignee row (single component for IT and BIZ — same markup, slider, remove) ─

interface SkillMatchResult {
  matched: string[];
  missing: string[];
}

interface AssigneeRowPanelProps {
  memberId: string;
  name: string;
  role: string;
  track: 'IT' | 'BIZ';
  daysPerSprint: number;
  removing: boolean;
  entering: boolean;
  onDaysChange: (memberId: string, track: 'IT' | 'BIZ', days: number) => void;
  onRemove: (memberId: string, track: 'IT' | 'BIZ') => void;
  overloadedSprints: SprintCapacityResult[];
  skillMatch?: SkillMatchResult;
}

function AssigneeRowPanel({
  memberId,
  name,
  role,
  track,
  daysPerSprint,
  removing,
  entering,
  onDaysChange,
  onRemove,
  overloadedSprints,
  skillMatch,
}: AssigneeRowPanelProps) {
  const days = clampAssigneeDays(daysPerSprint);
  const pct = sliderPct(days);
  const hasOverload = overloadedSprints.length > 0;
  const hasMissing = (skillMatch?.missing.length ?? 0) > 0;

  return (
    <div
      className={[
        'py-2 px-2.5 rounded-lg border transition-all duration-[180ms] bg-mileway-bg',
        hasOverload ? 'border-orange-400' : 'border-biz-light hover:border-mileway-border',
        removing ? 'opacity-0 translate-x-2' : 'opacity-100',
        entering ? 'assignee-row-enter' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white text-[11px] bg-mileway-blue"
          style={{ width: 28, height: 28 }}
        >
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-[12.5px] font-semibold text-mileway-text truncate whitespace-nowrap">{name}</div>
          <div className="text-[10.5px] text-mileway-grey mt-px truncate">{role || '—'}</div>
        </div>
        <div className="w-[130px] flex-shrink-0 flex flex-col gap-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[10.5px] text-mileway-grey">Days / sprint</span>
            <span className="text-xs font-bold text-mileway-text tabular-nums">
              {days}
              <span className="text-mileway-grey font-normal">d</span>
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={days}
            aria-label={`Days per sprint for ${name}`}
            className="assign-days-slider w-full"
            style={{
              ['--pct' as string]: pct,
              ...(hasOverload
                ? { outline: '2px solid #fb923c', outlineOffset: '1px', borderRadius: '4px' }
                : {}),
            }}
            onChange={e => onDaysChange(memberId, track, Number(e.target.value))}
          />
        </div>
        <button
          type="button"
          aria-label={`Remove ${name}`}
          className="flex-shrink-0 w-[22px] h-[22px] rounded-[5px] border-0 bg-transparent text-mileway-border text-xs cursor-pointer hover:bg-[var(--danger-light)] hover:text-[var(--danger)] focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
          onClick={() => onRemove(memberId, track)}
        >
          ✕
        </button>
      </div>
      {hasOverload && (
        <div className="mt-1.5 pl-[38px] space-y-0.5">
          {overloadedSprints.slice(0, 3).map(r => (
            <p key={r.sprint.number} className="text-[10.5px] text-util-over flex items-start gap-1">
              <span aria-hidden>⚠</span>
              <span>
                Overloaded in S{r.sprint.number} ({fmtSprintRange(r.sprint.startDate, r.sprint.endDate)}) — {Math.round(r.allocatedDays)}/{Math.round(r.totalWorkdays)} days
              </span>
            </p>
          ))}
          {overloadedSprints.length > 3 && (
            <p className="text-[10.5px] text-util-over pl-4">…and {overloadedSprints.length - 3} more</p>
          )}
        </div>
      )}
      {skillMatch && (skillMatch.matched.length > 0 || skillMatch.missing.length > 0) && (
        <div className="mt-1.5 pl-[38px]">
          {hasMissing && (
            <p className="text-[10.5px] text-util-over flex items-start gap-1 mb-1">
              <span aria-hidden>⚠</span>
              <span>Missing skills: {skillMatch.missing.join(', ')}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {skillMatch.matched.map(s => (
              <SkillChip key={s} name={s} variant="green" readOnly />
            ))}
            {skillMatch.missing.map(s => (
              <SkillChip key={s} name={s} variant="red" readOnly />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssignPanelProps {
  item: PlannerItem;
  /** Full planner layout for sprint capacity scoring. Omit or pass [] when not in scenario planner (e.g. baseline Timeline). */
  plannerItems?: PlannerItem[];
  selectedQuarter: string;
  jiraBaseUrl: string;
  jiraItems: JiraWorkItem[];
  onClose: () => void;
  /** Called when the user confirms changes — writes to scenario or baseline depending on caller. */
  onSave: (itemId: string, assignees: PlannerAssignment[]) => void;
  /** US-SP-27: when false, skill chips, "Requires" line, and tiered ranking are suppressed. */
  skillsMatchingEnabled?: boolean;
}

type PickerTrack = 'IT' | 'BIZ' | null;

interface SprintCellModel {
  sprintNum: number;
  sprintLabel: string;
  dayTotal: number;
  teamPct: number;
}

// ── Allocation grid ───────────────────────────────────────────────────────────

function useSprintCells(
  draft: PlannerItem,
  selectedQuarter: string,
  state: ReturnType<typeof useCurrentState>,
  quarterSprints: Sprint[],
): SprintCellModel[] {
  return useMemo(() => {
    const sprintCountByQuarter = new Map<string, number>();
    for (const s of quarterSprints) {
      if (s.quarter) sprintCountByQuarter.set(s.quarter, (sprintCountByQuarter.get(s.quarter) ?? 0) + 1);
    }

    const dayTotal = draft.assignees.reduce((sum, a) => sum + clampAssigneeDays(a.daysPerSprint), 0);

    const cells: SprintCellModel[] = [];
    for (let s = draft.startSprint; s < draft.startSprint + draft.spanSprints; s++) {
      const sp = quarterSprints.find(x => x.number === s);
      const q = sp?.quarter ?? selectedQuarter;
      let teamPerSprintAvail = 0;
      for (const m of state.teamMembers.filter(tm => !tm.excludedFromCapacity)) {
        try {
          const cap = calculateCapacity(m.id, q, state);
          const fixedUsed = cap.breakdown
            .filter(b => b.type === 'bau' || b.type === 'timeoff')
            .reduce((sum, b) => sum + b.days, 0);
          const quarterAvail = Math.max(0, cap.totalWorkdays - fixedUsed);
          teamPerSprintAvail += Math.round(quarterAvail / (sprintCountByQuarter.get(q) || 1));
        } catch {
          /* skip */
        }
      }
      const teamPct = teamPerSprintAvail > 0 ? Math.round((dayTotal / teamPerSprintAvail) * 100) : dayTotal > 0 ? 100 : 0;
      cells.push({
        sprintNum: s,
        sprintLabel: `S${s}`,
        dayTotal,
        teamPct,
      });
    }
    return cells;
  }, [draft, state, quarterSprints, selectedQuarter]);
}

function tierCellClass(pct: number): string {
  if (pct <= 0) {
    return 'bg-mileway-bg border-mileway-border text-mileway-grey';
  }
  if (pct <= 50) {
    return 'bg-mileway-bg border-mileway-border text-util-healthy';
  }
  if (pct <= 80) {
    return 'border-[color:var(--alloc-border-near)] text-util-near';
  }
  if (pct <= 100) {
    return 'border-[color:var(--alloc-border-warn)] text-util-near';
  }
  return 'border-[color:var(--alloc-border-over)] text-util-over';
}

function tierCellStyle(pct: number): CSSProperties {
  if (pct <= 50) return {};
  if (pct <= 80) return { backgroundColor: 'var(--whatif-bg)' };
  if (pct <= 100) return { backgroundColor: 'var(--warning-light)' };
  return { backgroundColor: 'var(--danger-light)' };
}

// ── Main component ────────────────────────────────────────────────────────────

function normalizePlannerItemForPanel(raw: PlannerItem): PlannerItem {
  return {
    ...raw,
    assignees: [...(raw.assignees ?? [])],
    requiredSkillIds: Array.isArray(raw.requiredSkillIds) ? raw.requiredSkillIds : [],
  };
}

export function AssignPanel({
  item,
  plannerItems = [],
  selectedQuarter,
  jiraBaseUrl,
  jiraItems,
  onClose,
  onSave,
  skillsMatchingEnabled = true,
}: AssignPanelProps) {
  const state = useCurrentState();
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerItInputRef = useRef<HTMLInputElement>(null);
  const pickerBizInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PlannerItem>(() => normalizePlannerItemForPanel(item));
  const [pickerTrack, setPickerTrack] = useState<PickerTrack>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(new Set());
  const [enteringKeys, setEnteringKeys] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [panelEntered, setPanelEntered] = useState(false);
  const [bizSectionOpen, setBizSectionOpen] = useState(() => ['uat', 'hypercare', 'epic'].includes(item.type));

  const quarterSprints = useMemo(
    () => state.sprints.filter(s => s.quarter === selectedQuarter),
    [state.sprints, selectedQuarter],
  );

  const coveredSprints = useMemo(
    () => state.sprints.filter(s => s.number >= draft.startSprint && s.number < draft.startSprint + draft.spanSprints),
    [state.sprints, draft.startSprint, draft.spanSprints],
  );

  const capacityPlannerItems = useMemo(() => {
    const list = plannerItems ?? [];
    const merged = list.map(p => (p.id === draft.id ? draft : p));
    return list.some(p => p.id === draft.id) ? merged : [...merged, draft];
  }, [plannerItems, draft]);

  const overloadedByMember = useMemo(() => {
    const map = new Map<string, SprintCapacityResult[]>();
    const itemSprints = state.sprints.filter(
      s => s.number >= draft.startSprint && s.number < draft.startSprint + draft.spanSprints,
    );
    for (const a of draft.assignees) {
      const key = assigneeRowKey(a.memberId, a.track);
      const overloaded: SprintCapacityResult[] = [];
      for (const sp of itemSprints) {
        const cap = calculateSprintCapacity(a.memberId, sp, capacityPlannerItems, state, 0);
        if (cap.isOverloaded) overloaded.push(cap);
      }
      if (overloaded.length > 0) map.set(key, overloaded);
    }
    return map;
  }, [draft, state, capacityPlannerItems]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPanelEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    setDraft(normalizePlannerItemForPanel(item));
    setPickerTrack(null);
    setPickerSearch('');
    setRemovingKeys(new Set());
  }, [item.id, sortAssigneesKey(item.assignees), item.name]);

  useEffect(() => {
    setBizSectionOpen(['uat', 'hypercare', 'epic'].includes(item.type));
  }, [item.id, item.type]);

  useEffect(() => {
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [item.id]);

  useEffect(() => {
    if (!pickerTrack) return;
    const t = window.setTimeout(() => {
      (pickerTrack === 'IT' ? pickerItInputRef : pickerBizInputRef).current?.focus();
    }, 220);
    return () => window.clearTimeout(t);
  }, [pickerTrack]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const jiraRow = useMemo(
    () => (item.jiraKey ? jiraItems.find(j => j.jiraKey === item.jiraKey) : undefined),
    [jiraItems, item.jiraKey],
  );

  const statusBadge = useMemo(() => {
    const st = (jiraRow?.status ?? '').toLowerCase();
    const cat = jiraRow?.statusCategory;
    if (st.includes('block')) {
      return {
        label: 'Blocked',
        style: { background: 'var(--danger-light)', color: 'var(--danger)' } as CSSProperties,
      };
    }
    if (cat === 'done') {
      return {
        label: jiraRow?.status ?? 'Done',
        style: { background: 'var(--success-light)', color: 'var(--success)' } as CSSProperties,
      };
    }
    if (cat === 'in_progress') {
      return {
        label: jiraRow?.status ?? 'In Progress',
        style: { background: 'var(--warning-light)', color: 'var(--warning)' } as CSSProperties,
      };
    }
    return {
      label: jiraRow?.status ?? 'To Do',
      style: { background: 'var(--color-bg)', color: 'var(--color-grey)' } as CSSProperties,
    };
  }, [jiraRow]);

  const effortSum = useMemo(
    () => draft.assignees.reduce((s, a) => s + clampAssigneeDays(a.daysPerSprint), 0),
    [draft.assignees],
  );

  const dirty = !draftEqualsItem(draft, item);

  const cells = useSprintCells(draft, selectedQuarter, state, quarterSprints);

  const overloadedLabels = useMemo(
    () => cells.filter(c => c.teamPct > 100).map(c => c.sprintLabel),
    [cells],
  );

  const triggerPulse = useCallback(() => {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 150);
  }, []);

  const itPlannerFits = useMemo(() => {
    const eligible = state.teamMembers.filter(m => !m.excludedFromCapacity);
    return rankPlannerFits(
      eligible.map(m =>
        scoreMemberForPlanner(m, coveredSprints, draft.requiredSkillIds ?? [], capacityPlannerItems, state),
      ),
    );
  }, [state, coveredSprints, draft.requiredSkillIds, capacityPlannerItems]);

  const bizFits = useMemo(() => {
    const eligible = (state.businessContacts ?? []).filter(c => !c.archived && !c.excludedFromCapacity);
    return rankBizFits(
      eligible.map(c => scoreBusinessContact(c, selectedQuarter, draft.jiraKey ?? draft.id, state)),
    );
  }, [state, selectedQuarter, draft.jiraKey, draft.id]);

  const assignedIt = draft.assignees.filter(a => a.track === 'IT');
  const assignedBiz = draft.assignees.filter(a => a.track === 'BIZ');

  const skillMatchByMember = useMemo(() => {
    const reqIds = draft.requiredSkillIds;
    if (!reqIds || reqIds.length === 0) return new Map<string, SkillMatchResult>();
    const skills = state.skills ?? [];
    const map = new Map<string, SkillMatchResult>();
    for (const a of assignedIt) {
      const member = state.teamMembers.find(m => m.id === a.memberId);
      if (!member) continue;
      const memberSkillSet = new Set(member.skillIds ?? []);
      const matched: string[] = [];
      const missing: string[] = [];
      for (const rid of reqIds) {
        const skill = skills.find(s => s.id === rid);
        if (!skill) continue;
        if (memberSkillSet.has(rid)) matched.push(skill.name);
        else missing.push(skill.name);
      }
      map.set(a.memberId, { matched, missing });
    }
    return map;
  }, [draft.requiredSkillIds, assignedIt, state.teamMembers, state.skills]);

  const updateAssignmentDays = (memberId: string, track: 'IT' | 'BIZ', days: number) => {
    const d = Math.min(10, Math.max(1, Math.round(days)));
    setDraft(prev => ({
      ...prev,
      assignees: prev.assignees.map(a =>
        a.memberId === memberId && a.track === track ? { ...a, daysPerSprint: d } : a,
      ),
    }));
    triggerPulse();
  };

  const removeAssignee = (memberId: string, track: 'IT' | 'BIZ') => {
    const key = assigneeRowKey(memberId, track);
    setRemovingKeys(prev => new Set(prev).add(key));
    window.setTimeout(() => {
      setDraft(prev => ({
        ...prev,
        assignees: prev.assignees.filter(a => !(a.memberId === memberId && a.track === track)),
      }));
      setRemovingKeys(prev => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
      triggerPulse();
    }, 180);
  };

  const addPerson = (memberId: string, track: 'IT' | 'BIZ') => {
    if (draft.assignees.some(a => a.memberId === memberId && a.track === track)) return;
    const key = assigneeRowKey(memberId, track);
    setDraft(prev => ({
      ...prev,
      assignees: [...prev.assignees, { memberId, track, daysPerSprint: 2 }],
    }));
    setEnteringKeys(prev => new Set(prev).add(key));
    window.setTimeout(() => {
      setEnteringKeys(prev => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    }, 160);
    triggerPulse();
  };

  const handleSave = () => {
    onSave(draft.id, draft.assignees);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const openJira = () => {
    if (!item.jiraKey || !jiraBaseUrl) return;
    const base = jiraBaseUrl.replace(/\/+$/, '');
    window.open(`${base}/browse/${item.jiraKey}`, '_blank', 'noopener,noreferrer');
  };

  const durationLabel = useMemo(() => {
    const w = draft.spanSprints * 2;
    return `${w} weeks · ${draft.spanSprints} sprint${draft.spanSprints !== 1 ? 's' : ''}`;
  }, [draft.spanSprints]);

  const endSprintNum = draft.startSprint + draft.spanSprints - 1;

  const itPickerTiers = useMemo(() => {
    const empty = { assigned: [] as PlannerMemberFit[], good: [] as PlannerMemberFit[], partial: [] as PlannerMemberFit[], over: [] as PlannerMemberFit[] };
    if (pickerTrack !== 'IT') return empty;
    const assignedIds = new Set(draft.assignees.filter(a => a.track === 'IT').map(a => a.memberId));
    const q = pickerSearch.trim().toLowerCase();
    const matchesSearch = (fit: PlannerMemberFit) => {
      if (!q) return true;
      if (fit.member.name.toLowerCase().includes(q)) return true;
      if (fit.member.role.toLowerCase().includes(q)) return true;
      const memberSkillNames = (fit.member.skillIds ?? [])
        .map(id => (state.skills ?? []).find(s => s.id === id)?.name ?? '')
        .filter(Boolean);
      return memberSkillNames.some(n => n.toLowerCase().includes(q));
    };
    const assigned: PlannerMemberFit[] = [];
    const good: PlannerMemberFit[] = [];
    const partial: PlannerMemberFit[] = [];
    const over: PlannerMemberFit[] = [];
    for (const fit of itPlannerFits) {
      if (!matchesSearch(fit)) continue;
      if (assignedIds.has(fit.member.id)) assigned.push(fit);
      else if (fit.fitLevel === 'good') good.push(fit);
      else if (fit.fitLevel === 'partial') partial.push(fit);
      else over.push(fit);
    }
    return { assigned, good, partial, over };
  }, [pickerTrack, pickerSearch, draft.assignees, itPlannerFits, state.skills]);

  const bizPickerList = useMemo(() => {
    const empty = { available: [] as BizFit[], blocked: [] as BizFit[] };
    if (pickerTrack !== 'BIZ') return empty;
    const assignedIds = new Set(draft.assignees.filter(a => a.track === 'BIZ').map(a => a.memberId));
    const q = pickerSearch.trim().toLowerCase();
    const pool = bizFits.filter(f => {
      if (assignedIds.has(f.contact.id)) return false;
      if (!q) return true;
      return f.contact.name.toLowerCase().includes(q) ||
        (f.contact.title ?? f.contact.department ?? '').toLowerCase().includes(q);
    });
    return {
      available: pool.filter(f => f.availableDays > 0),
      blocked: pool.filter(f => f.availableDays <= 0),
    };
  }, [pickerTrack, pickerSearch, draft.assignees, bizFits]);

  const tierLabels: Record<FitLevel, string> = { good: 'Good fit', partial: 'Partial fit', over: 'Over capacity' };

  function renderTierHeader(label: string, fitLevel: FitLevel, count: number) {
    if (count === 0) return null;
    const cls = FIT_COLOURS[fitLevel];
    return (
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <span className={`text-[9px] font-bold px-[6px] py-0.5 rounded ${cls.badge}`}>{label}</span>
        <span className="text-[10px] text-mileway-grey">{count}</span>
        <span className="flex-1 h-px bg-mileway-border" />
      </div>
    );
  }

  function renderItPickerRow(fit: PlannerMemberFit) {
    const fitCls = FIT_COLOURS[fit.fitLevel];
    const freeCls =
      fit.availableDays > 3 ? 'text-util-healthy' : fit.availableDays > 0 ? 'text-util-near' : 'text-mileway-border';
    const freeLabel = fit.availableDays > 0 ? `${Math.round(fit.availableDays)}d free` : '—';
    const badgeCls = skillsMatchingEnabled
      ? fitCls.badge
      : fit.availableDays > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    const badgeLabel = skillsMatchingEnabled
      ? tierLabels[fit.fitLevel]
      : fit.availableDays > 0 ? 'Available' : 'Over capacity';
    return (
      <button
        key={fit.member.id}
        type="button"
        onClick={() => addPerson(fit.member.id, 'IT')}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-transparent bg-transparent hover:bg-mileway-bg hover:border-mileway-border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
      >
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white text-[11px] bg-mileway-blue"
          style={{ width: 26, height: 26 }}
        >
          {initials(fit.member.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-mileway-text truncate">{fit.member.name}</div>
          <div className="text-[10.5px] text-mileway-grey truncate">{fit.member.role}</div>
        </div>
        <span className={`text-[9px] font-bold px-[7px] py-0.5 rounded ${badgeCls}`}>
          {badgeLabel}
        </span>
        <span className={`text-[10.5px] font-semibold flex-shrink-0 tabular-nums ${freeCls}`}>{freeLabel}</span>
      </button>
    );
  }

  function renderAssignedItRow(fit: PlannerMemberFit) {
    const a = draft.assignees.find(x => x.memberId === fit.member.id && x.track === 'IT');
    const days = a ? clampAssigneeDays(a.daysPerSprint) : 0;
    return (
      <div
        key={fit.member.id}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-mileway-bg/50"
      >
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white text-[11px] bg-mileway-blue"
          style={{ width: 26, height: 26 }}
        >
          {initials(fit.member.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-mileway-text truncate">{fit.member.name}</div>
          <div className="text-[10.5px] text-mileway-grey truncate">{fit.member.role}</div>
        </div>
        <span className="text-[9px] font-bold px-[7px] py-0.5 rounded bg-mileway-blue/10 text-mileway-blue">Assigned</span>
        <span className="text-[10.5px] font-semibold text-mileway-text tabular-nums flex-shrink-0">{days}d</span>
      </div>
    );
  }

  function renderBizPickerRow(fit: BizFit) {
    const fitCls = FIT_COLOURS[fit.fitLevel];
    const freeCls =
      fit.availableDays > 3 ? 'text-util-healthy' : fit.availableDays > 0 ? 'text-util-near' : 'text-mileway-border';
    const freeLabel = fit.availableDays > 0 ? `${Math.round(fit.availableDays)}d free` : '—';
    const badgeCls = skillsMatchingEnabled ? fitCls.badge
      : fit.availableDays > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
    const badgeLabel = skillsMatchingEnabled
      ? (fit.fitLevel === 'good' ? 'Good' : fit.fitLevel === 'partial' ? 'Partial' : '—')
      : (fit.availableDays > 0 ? 'Available' : 'Over capacity');
    return (
      <button
        key={fit.contact.id}
        type="button"
        onClick={() => addPerson(fit.contact.id, 'BIZ')}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-transparent bg-transparent hover:bg-mileway-bg hover:border-mileway-border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
      >
        <div
          className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white text-[11px] bg-purple-500"
          style={{ width: 26, height: 26 }}
        >
          {initials(fit.contact.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-mileway-text truncate">{fit.contact.name}</div>
          <div className="text-[10.5px] text-mileway-grey truncate">{fit.contact.title ?? fit.contact.department ?? 'BIZ'}</div>
        </div>
        <span className={`text-[9px] font-bold px-[7px] py-0.5 rounded ${badgeCls}`}>{badgeLabel}</span>
        <span className={`text-[10.5px] font-semibold flex-shrink-0 tabular-nums ${freeCls}`}>{freeLabel}</span>
      </button>
    );
  }

  function renderTrackDivider(label: string, isBiz: boolean) {
    return (
      <div className={`flex items-center w-full ${isBiz ? 'mt-2.5' : ''}`}>
        <span
          className="text-[10.5px] font-bold uppercase tracking-[0.06em] flex-shrink-0"
          style={{ color: isBiz ? 'var(--color-grey)' : 'var(--color-primary)' }}
        >
          {label}
        </span>
        <span className="flex-1 h-px bg-mileway-border ml-2" />
      </div>
    );
  }

  function togglePicker(track: 'IT' | 'BIZ') {
    setPickerTrack(pickerTrack === track ? null : track);
    if (pickerTrack !== track) setPickerSearch('');
  }

  const gridMinWidth = cells.length > 6 ? cells.length * 72 : undefined;

  const ui = (
    <div
      className={[
        'assign-panel fixed inset-y-0 right-0 z-[55] flex flex-col border-l transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        panelEntered ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      style={{
        width: 'var(--assign-panel-width, 440px)',
        borderColor: 'var(--assign-panel-border)',
        boxShadow: 'var(--assign-panel-shadow)',
        backgroundColor: 'var(--color-surface)',
      }}
      ref={panelRef}
      role="dialog"
      aria-labelledby="assign-panel-title"
    >
      {/* Header */}
      <header
        className="flex-shrink-0 border-b border-mileway-border"
        style={{ padding: '16px 20px 14px' }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
            <span className={typePillClass(draft.type)}>{draft.type}</span>
            {draft.jiraKey && (
              <button
                type="button"
                onClick={openJira}
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-[5px] px-2 py-0.5 border transition-colors hover:bg-[var(--primary-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
                style={{
                  background: 'var(--jira-badge-bg)',
                  borderColor: 'var(--jira-badge-border)',
                  color: 'var(--jira-badge-text)',
                }}
              >
                ↗ {draft.jiraKey}
              </button>
            )}
            <span
              className="text-[10.5px] font-bold rounded-full px-2 py-0.5"
              style={statusBadge.style}
            >
              {statusBadge.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assignment panel"
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-mileway-bg text-mileway-grey focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="assign-panel-title" className="text-[15px] font-extrabold text-mileway-text leading-[1.3] mt-1 mb-2.5">
          {draft.name}
        </h2>
        {(draft.requiredSkillIds?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {(draft.requiredSkillIds ?? []).map(id => {
              const skill = (state.skills ?? []).find(s => s.id === id);
              return skill ? <SkillChip key={id} name={skill.name} readOnly /> : null;
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono text-xs font-bold tabular-nums rounded-[5px] px-2.5 py-0.5 border border-mileway-border text-mileway-text bg-mileway-bg"
            style={{ paddingTop: 3, paddingBottom: 3 }}
          >
            S{draft.startSprint}
          </span>
          <span className="text-mileway-grey text-sm">→</span>
          <span className="font-mono text-xs font-bold tabular-nums rounded-[5px] px-2.5 py-0.5 border border-mileway-border text-mileway-text bg-mileway-bg">
            S{endSprintNum}
          </span>
          <span className="text-[11.5px] text-mileway-grey">{durationLabel}</span>
          <span className="ml-auto inline-flex items-center rounded-full border border-mileway-border bg-mileway-bg px-2.5 py-0.5 text-[11.5px] font-bold text-mileway-text tabular-nums">
            {effortSum}
            <span className="text-mileway-grey font-normal">d</span>
            <span className="text-mileway-grey font-normal"> / sprint</span>
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Allocation impact */}
        <section className="border-b border-biz-light" style={{ padding: '14px 20px' }}>
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-mileway-grey mb-2.5">
            Allocation impact
          </h3>
          <div
            className={['overflow-x-auto transition-opacity duration-150', pulse ? 'opacity-50' : 'opacity-100'].join(
              ' ',
            )}
          >
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
                minWidth: gridMinWidth,
              }}
            >
              {cells.map(c => (
                <div
                  key={c.sprintNum}
                  className={['rounded-lg border px-1.5 py-2 text-center', tierCellClass(c.teamPct)].join(' ')}
                  style={tierCellStyle(c.teamPct)}
                >
                  <div className="text-[10px] font-mono font-bold text-mileway-grey mb-0.5">{c.sprintLabel}</div>
                  <div className="text-sm font-extrabold tabular-nums leading-none text-mileway-text">{c.dayTotal}</div>
                  <div className="text-[10px] font-medium opacity-75 tabular-nums text-mileway-text">{c.teamPct}%</div>
                </div>
              ))}
            </div>
          </div>
          {overloadedLabels.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-util-over">
              <span aria-hidden>⚠</span>
              <span>
                {overloadedLabels.join(', ')}: team is overloaded with this assignment
              </span>
            </p>
          )}
        </section>

        {/* Assignees */}
        <section className="border-b border-biz-light" style={{ padding: '14px 20px' }}>
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-mileway-grey mb-2.5">Assignees</h3>

          {renderTrackDivider('IT', false)}
          <div className="mt-2 space-y-1.5">
            {assignedIt.map(a => {
              const m = state.teamMembers.find(tm => tm.id === a.memberId);
              const rk = assigneeRowKey(a.memberId, 'IT');
              return (
                <AssigneeRowPanel
                  key={rk}
                  memberId={a.memberId}
                  name={m?.name ?? a.memberId}
                  role={m?.role ?? ''}
                  track="IT"
                  daysPerSprint={a.daysPerSprint}
                  removing={removingKeys.has(rk)}
                  entering={enteringKeys.has(rk)}
                  onDaysChange={updateAssignmentDays}
                  onRemove={removeAssignee}
                  overloadedSprints={overloadedByMember.get(rk) ?? []}
                  skillMatch={skillsMatchingEnabled ? skillMatchByMember.get(a.memberId) : undefined}
                />
              );
            })}
          </div>
          <button
            type="button"
            className="mt-2 w-full text-left text-xs font-semibold rounded-lg py-1.5 px-2.5 border border-dashed border-[var(--jira-badge-border)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--primary-light)] hover:border-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
            onClick={() => togglePicker('IT')}
          >
            {pickerTrack === 'IT' ? 'Cancel' : '+ Add IT person'}
          </button>
          <div className={['assign-inline-picker', pickerTrack === 'IT' ? 'open' : ''].join(' ')}>
            <div className="pt-2 space-y-2">
              {skillsMatchingEnabled && (draft.requiredSkillIds?.length ?? 0) > 0 && (
                <p className="text-[10.5px] text-mileway-grey px-2.5">
                  <span className="font-semibold">Requires:</span>{' '}
                  {(draft.requiredSkillIds ?? []).map(id => (state.skills ?? []).find(s => s.id === id)?.name ?? id).join(', ')}.
                </p>
              )}
              <div className="relative">
                <svg
                  className="absolute left-[9px] top-1/2 -translate-y-1/2 text-mileway-grey pointer-events-none"
                  width={13}
                  height={13}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  ref={pickerItInputRef}
                  type="search"
                  placeholder="Search by name or skill…"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="w-full rounded-lg border border-mileway-border bg-mileway-bg py-1.5 pl-[30px] pr-2.5 text-xs focus:outline-none focus:border-mileway-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,137,221,0.10)]"
                />
              </div>
              <div className="max-h-[260px] overflow-y-auto space-y-0.5">
                {pickerTrack === 'IT' && skillsMatchingEnabled && (
                  <>
                    {itPickerTiers.assigned.length > 0 && (
                      <>
                        <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-1">
                          <span className="text-[9px] font-bold px-[6px] py-0.5 rounded bg-mileway-blue/10 text-mileway-blue">Assigned</span>
                          <span className="text-[10px] text-mileway-grey">{itPickerTiers.assigned.length}</span>
                          <span className="flex-1 h-px bg-mileway-border" />
                        </div>
                        {itPickerTiers.assigned.map(f => renderAssignedItRow(f))}
                      </>
                    )}
                    {renderTierHeader('Good fit', 'good', itPickerTiers.good.length)}
                    {itPickerTiers.good.map(f => renderItPickerRow(f))}
                    {renderTierHeader('Partial fit', 'partial', itPickerTiers.partial.length)}
                    {itPickerTiers.partial.map(f => renderItPickerRow(f))}
                    {itPickerTiers.over.length > 0 && (
                      <>
                        {renderTierHeader('Over capacity', 'over', itPickerTiers.over.length)}
                        <div className="opacity-50">
                          {itPickerTiers.over.map(f => renderItPickerRow(f))}
                        </div>
                      </>
                    )}
                    {itPickerTiers.assigned.length === 0 && itPickerTiers.good.length === 0 && itPickerTiers.partial.length === 0 && itPickerTiers.over.length === 0 && (
                      <p className="text-[11px] text-mileway-grey text-center py-4">No team members found.</p>
                    )}
                  </>
                )}
                {pickerTrack === 'IT' && !skillsMatchingEnabled && (() => {
                  const available = [...itPickerTiers.good, ...itPickerTiers.partial];
                  const overCapacity = itPickerTiers.over;
                  return (
                    <>
                      {itPickerTiers.assigned.length > 0 && (
                        <>
                          <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-1">
                            <span className="text-[9px] font-bold px-[6px] py-0.5 rounded bg-mileway-blue/10 text-mileway-blue">Assigned</span>
                            <span className="text-[10px] text-mileway-grey">{itPickerTiers.assigned.length}</span>
                            <span className="flex-1 h-px bg-mileway-border" />
                          </div>
                          {itPickerTiers.assigned.map(f => renderAssignedItRow(f))}
                        </>
                      )}
                      {available.length > 0 && (
                        <>
                          <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-1">
                            <span className="text-[9px] font-bold px-[6px] py-0.5 rounded bg-green-100 text-green-700">Available</span>
                            <span className="text-[10px] text-mileway-grey">{available.length}</span>
                            <span className="flex-1 h-px bg-mileway-border" />
                          </div>
                          {available.map(f => renderItPickerRow(f))}
                        </>
                      )}
                      {overCapacity.length > 0 && (
                        <>
                          <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-1">
                            <span className="text-[9px] font-bold px-[6px] py-0.5 rounded bg-red-100 text-red-700">Over capacity</span>
                            <span className="text-[10px] text-mileway-grey">{overCapacity.length}</span>
                            <span className="flex-1 h-px bg-mileway-border" />
                          </div>
                          <div className="opacity-50">
                            {overCapacity.map(f => renderItPickerRow(f))}
                          </div>
                        </>
                      )}
                      {itPickerTiers.assigned.length === 0 && available.length === 0 && overCapacity.length === 0 && (
                        <p className="text-[11px] text-mileway-grey text-center py-4">No team members found.</p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* BIZ section — collapsible, default depends on item type */}
          <button
            type="button"
            className="flex items-center w-full mt-2.5 group cursor-pointer bg-transparent border-0 p-0"
            onClick={() => {
              if (bizSectionOpen && pickerTrack === 'BIZ') setPickerTrack(null);
              setBizSectionOpen(prev => !prev);
            }}
          >
            <span
              className="text-[10.5px] font-bold uppercase tracking-[0.06em] flex-shrink-0"
              style={{ color: 'var(--color-grey)' }}
            >
              BIZ{assignedBiz.length > 0 ? ` (${assignedBiz.length})` : ''}
            </span>
            <span className="flex-1 h-px bg-mileway-border ml-2" />
            <span className="ml-2 text-[10px] text-mileway-grey group-hover:text-mileway-text transition-colors">
              {bizSectionOpen ? '▾' : '▸'}
            </span>
          </button>
          {bizSectionOpen && (
            <>
              <div className="mt-2 space-y-1.5">
                {assignedBiz.map(a => {
                  const c = state.businessContacts?.find(b => b.id === a.memberId);
                  const rk = assigneeRowKey(a.memberId, 'BIZ');
                  return (
                    <AssigneeRowPanel
                      key={rk}
                      memberId={a.memberId}
                      name={c?.name ?? a.memberId}
                      role={c?.title ?? c?.department ?? ''}
                      track="BIZ"
                      daysPerSprint={a.daysPerSprint}
                      removing={removingKeys.has(rk)}
                      entering={enteringKeys.has(rk)}
                      onDaysChange={updateAssignmentDays}
                      onRemove={removeAssignee}
                      overloadedSprints={overloadedByMember.get(rk) ?? []}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                className="mt-2 w-full text-left text-xs font-semibold rounded-lg py-1.5 px-2.5 border border-dashed border-mileway-border text-mileway-grey bg-transparent hover:bg-mileway-bg hover:border-mileway-grey focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
                onClick={() => togglePicker('BIZ')}
              >
                {pickerTrack === 'BIZ' ? 'Cancel' : '+ Add BIZ person'}
              </button>
              <div className={['assign-inline-picker', pickerTrack === 'BIZ' ? 'open' : ''].join(' ')}>
                <div className="pt-2 space-y-2">
                  <div className="relative">
                    <svg
                      className="absolute left-[9px] top-1/2 -translate-y-1/2 text-mileway-grey pointer-events-none"
                      width={13}
                      height={13}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      ref={pickerBizInputRef}
                      type="search"
                      placeholder="Search…"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      className="w-full rounded-lg border border-mileway-border bg-mileway-bg py-1.5 pl-[30px] pr-2.5 text-xs focus:outline-none focus:border-mileway-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,137,221,0.10)]"
                    />
                  </div>
                  <div className="max-h-[180px] overflow-y-auto space-y-0.5">
                    {pickerTrack === 'BIZ' && bizPickerList.available.map(f => renderBizPickerRow(f))}
                    {pickerTrack === 'BIZ' && bizPickerList.blocked.length > 0 && (
                      <>
                        <div className="text-[9.5px] font-bold text-mileway-border uppercase tracking-[0.06em] px-2.5 pt-1.5 pb-0.5">
                          No availability
                        </div>
                        <div className="space-y-0.5 opacity-50 pointer-events-none">
                          {bizPickerList.blocked.map(f => renderBizPickerRow(f))}
                        </div>
                      </>
                    )}
                    {pickerTrack === 'BIZ' && bizPickerList.available.length === 0 && bizPickerList.blocked.length === 0 && (
                      <p className="text-[11px] text-mileway-grey text-center py-4">No team members found.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer
        className="flex-shrink-0 border-t border-mileway-border bg-[var(--color-surface)]"
        style={{ padding: '14px 20px' }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty}
          className={[
            'w-full text-xs font-bold py-2 px-4 rounded-[7px] border-0 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
            dirty
              ? 'bg-[var(--color-primary)] hover:bg-[var(--primary-hover)] cursor-pointer'
              : savedFlash
                ? 'bg-[var(--color-primary)] cursor-default opacity-100'
                : 'bg-[var(--color-primary)] cursor-not-allowed opacity-45',
          ].join(' ')}
        >
          {savedFlash ? 'Saved ✓' : 'Save changes'}
        </button>
      </footer>
    </div>
  );

  return createPortal(ui, document.body);
}
