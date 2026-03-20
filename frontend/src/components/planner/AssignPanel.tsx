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
import {
  scoreMember,
  scoreBusinessContact,
  rankMemberFits,
  rankBizFits,
  FIT_COLOURS,
  type MemberFit,
  type BizFit,
} from '../../utils/staffing';
import { calculateCapacity } from '../../utils/capacity';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function sortAssigneesKey(assignees: PlannerAssignment[]): string {
  return [...assignees]
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

// ── Assignee row (single component for IT and BIZ — same markup, slider, remove) ─

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
}: AssigneeRowPanelProps) {
  const days = clampAssigneeDays(daysPerSprint);
  const pct = sliderPct(days);

  return (
    <div
      className={[
        'flex items-center gap-2.5 py-2 px-2.5 rounded-lg border transition-all duration-[180ms] bg-mileway-bg',
        'border-biz-light hover:border-mileway-border',
        removing ? 'opacity-0 translate-x-2' : 'opacity-100',
        entering ? 'assignee-row-enter' : '',
      ].join(' ')}
    >
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
          style={{ ['--pct' as string]: pct }}
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
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssignPanelProps {
  item: PlannerItem;
  selectedQuarter: string;
  jiraBaseUrl: string;
  jiraItems: JiraWorkItem[];
  onClose: () => void;
  /** Persist draft assignees to scenario (parent merges filtered layout). */
  onPersistDraft: (draft: PlannerItem) => void;
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

export function AssignPanel({
  item,
  selectedQuarter,
  jiraBaseUrl,
  jiraItems,
  onClose,
  onPersistDraft,
}: AssignPanelProps) {
  const state = useCurrentState();
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerItInputRef = useRef<HTMLInputElement>(null);
  const pickerBizInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PlannerItem>(() => ({ ...item, assignees: [...item.assignees] }));
  const [pickerTrack, setPickerTrack] = useState<PickerTrack>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(new Set());
  const [enteringKeys, setEnteringKeys] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [panelEntered, setPanelEntered] = useState(false);

  const quarterSprints = useMemo(
    () => state.sprints.filter(s => s.quarter === selectedQuarter),
    [state.sprints, selectedQuarter],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setPanelEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    setDraft({ ...item, assignees: [...item.assignees] });
    setPickerTrack(null);
    setPickerSearch('');
    setRemovingKeys(new Set());
  }, [item.id, sortAssigneesKey(item.assignees), item.name]);

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

  const itFits = useMemo(() => {
    const eligible = state.teamMembers.filter(m => !m.excludedFromCapacity);
    return rankMemberFits(
      eligible.map(m => scoreMember(m, selectedQuarter, [], draft.jiraKey ?? draft.id, state)),
    );
  }, [state, selectedQuarter, draft.jiraKey, draft.id]);

  const bizFits = useMemo(() => {
    const eligible = (state.businessContacts ?? []).filter(c => !c.archived && !c.excludedFromCapacity);
    return rankBizFits(
      eligible.map(c => scoreBusinessContact(c, selectedQuarter, draft.jiraKey ?? draft.id, state)),
    );
  }, [state, selectedQuarter, draft.jiraKey, draft.id]);

  const assignedIt = draft.assignees.filter(a => a.track === 'IT');
  const assignedBiz = draft.assignees.filter(a => a.track === 'BIZ');

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
    onPersistDraft(draft);
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

  const pickerList = useMemo(() => {
    if (!pickerTrack) return { available: [] as (MemberFit | BizFit)[], blocked: [] as (MemberFit | BizFit)[] };
    const assigned = new Set(
      draft.assignees.filter(a => a.track === pickerTrack).map(a => a.memberId),
    );
    const fits = pickerTrack === 'IT' ? itFits : bizFits;
    const q = pickerSearch.trim().toLowerCase();
    const filt = (f: MemberFit | BizFit) => {
      if (assigned.has(pickerTrack === 'IT' ? (f as MemberFit).member.id : (f as BizFit).contact.id)) return false;
      if (!q) return true;
      const name = pickerTrack === 'IT' ? (f as MemberFit).member.name : (f as BizFit).contact.name;
      const role =
        pickerTrack === 'IT'
          ? (f as MemberFit).member.role
          : ((f as BizFit).contact.title ?? (f as BizFit).contact.department ?? '');
      return name.toLowerCase().includes(q) || role.toLowerCase().includes(q);
    };
    const pool = fits.filter(filt);
    const order: Record<string, number> = { good: 0, partial: 1, over: 2 };
    pool.sort((a, b) => order[a.fitLevel] - order[b.fitLevel] || b.availableDays - a.availableDays);
    const available = pool.filter(f => f.availableDays > 0);
    const blocked = pool.filter(f => f.availableDays <= 0);
    return { available, blocked };
  }, [pickerTrack, pickerSearch, draft.assignees, itFits, bizFits]);

  function fitBadgeLabel(level: string): string {
    if (level === 'good') return 'Good';
    if (level === 'partial') return 'Partial';
    return '—';
  }

  function renderPickerRow(fit: MemberFit | BizFit, isBiz: boolean) {
    const id = isBiz ? (fit as BizFit).contact.id : (fit as MemberFit).member.id;
    const name = isBiz ? (fit as BizFit).contact.name : (fit as MemberFit).member.name;
    const role = isBiz
      ? ((fit as BizFit).contact.title ?? (fit as BizFit).contact.department ?? 'BIZ')
      : (fit as MemberFit).member.role;
    const fitCls = FIT_COLOURS[fit.fitLevel];
    const freeCls =
      fit.availableDays > 3
        ? 'text-util-healthy'
        : fit.availableDays > 0
          ? 'text-util-near'
          : 'text-mileway-border';
    const freeLabel = fit.availableDays > 0 ? `${Math.round(fit.availableDays)}d free` : '—';

    return (
      <button
        key={id}
        type="button"
        onClick={() => addPerson(id, isBiz ? 'BIZ' : 'IT')}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-transparent bg-transparent hover:bg-mileway-bg hover:border-mileway-border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
      >
        <div
          className={[
            'flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white text-[11px]',
            isBiz ? 'bg-purple-500' : 'bg-mileway-blue',
          ].join(' ')}
          style={{ width: 26, height: 26 }}
        >
          {initials(name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-mileway-text truncate">{name}</div>
          <div className="text-[10.5px] text-mileway-grey truncate">{role}</div>
        </div>
        <span className={`text-[9px] font-bold px-[7px] py-0.5 rounded ${fitCls.badge}`}>
          {fitBadgeLabel(fit.fitLevel)}
        </span>
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
                  placeholder="Search…"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="w-full rounded-lg border border-mileway-border bg-mileway-bg py-1.5 pl-[30px] pr-2.5 text-xs focus:outline-none focus:border-mileway-blue focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,137,221,0.10)]"
                />
              </div>
              <div className="max-h-[180px] overflow-y-auto space-y-0.5">
                {pickerTrack === 'IT' && pickerList.available.map(f => renderPickerRow(f, false))}
                {pickerTrack === 'IT' && pickerList.blocked.length > 0 && (
                  <>
                    <div className="text-[9.5px] font-bold text-mileway-border uppercase tracking-[0.06em] px-2.5 pt-1.5 pb-0.5">
                      No availability
                    </div>
                    <div className="space-y-0.5 opacity-50 pointer-events-none">
                      {pickerList.blocked.map(f => renderPickerRow(f, false))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {renderTrackDivider('BIZ', true)}
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
                {pickerTrack === 'BIZ' && pickerList.available.map(f => renderPickerRow(f, true))}
                {pickerTrack === 'BIZ' && pickerList.blocked.length > 0 && (
                  <>
                    <div className="text-[9.5px] font-bold text-mileway-border uppercase tracking-[0.06em] px-2.5 pt-1.5 pb-0.5">
                      No availability
                    </div>
                    <div className="space-y-0.5 opacity-50 pointer-events-none">
                      {pickerList.blocked.map(f => renderPickerRow(f, true))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
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
