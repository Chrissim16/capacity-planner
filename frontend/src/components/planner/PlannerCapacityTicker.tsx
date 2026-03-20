/**
 * PlannerCapacityTicker — Always-visible 28px team allocation strip (redesign §8).
 * Use `usePlannerCapacityTicker` in PlannerTimeline; label + sprint row render in separate columns.
 */
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { calculateCapacity } from '../../utils/capacity';
import type { PlannerItem, Sprint } from '../../types';

const TICKER_H = 28;

interface CellData {
  load: number;
  avail: number;
}

interface PersonSprintLine {
  id: string;
  name: string;
  shortName: string;
  pct: number;
}

interface FilterAssignmentLine {
  itemId: string;
  label: string;
  days: number;
}

function pctFromCell(cell: CellData): number {
  return cell.avail > 0 ? Math.round((cell.load / cell.avail) * 100) : cell.load > 0 ? 100 : 0;
}

function tierTickerStyle(pct: number): { bg: string; color: string; fontWeight: number } {
  if (pct <= 50) return { bg: '#F0FDF4', color: '#16A34A', fontWeight: 500 };
  if (pct <= 80) return { bg: '#FEFCE8', color: '#CA8A04', fontWeight: 500 };
  if (pct <= 100) return { bg: '#FFF7ED', color: '#EA580C', fontWeight: 500 };
  return { bg: '#FEF2F2', color: '#DC2626', fontWeight: 700 };
}

function computeLoadDays(memberId: string, sprintNumber: number, items: PlannerItem[]): number {
  let load = 0;
  for (const item of items) {
    const inRange = sprintNumber >= item.startSprint && sprintNumber < item.startSprint + item.spanSprints;
    if (!inRange) continue;
    for (const a of item.assignees) {
      if (a.memberId === memberId) load += a.daysPerSprint;
    }
  }
  return load;
}

function assignmentsForMemberInSprint(
  memberId: string,
  sprintNumber: number,
  items: PlannerItem[],
): FilterAssignmentLine[] {
  const lines: FilterAssignmentLine[] = [];
  for (const item of items) {
    const inRange = sprintNumber >= item.startSprint && sprintNumber < item.startSprint + item.spanSprints;
    if (!inRange) continue;
    const a = item.assignees.find(x => x.memberId === memberId);
    if (a && a.daysPerSprint > 0) {
      lines.push({ itemId: item.id, label: item.name, days: a.daysPerSprint });
    }
  }
  lines.sort((x, y) => y.days - x.days || x.label.localeCompare(y.label));
  return lines;
}

function shortDisplayName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return full;
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1]!;
  const initial = last[0] ?? '';
  return `${parts[0]} ${initial}.`;
}

function CrossfadePct({
  value,
  bold,
  className,
}: {
  value: number;
  bold?: boolean;
  className?: string;
}) {
  const prevRef = useRef(value);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [outOp, setOutOp] = useState(0);
  const [inOp, setInOp] = useState(1);

  useEffect(() => {
    if (value === prevRef.current) return;
    const from = prevRef.current;
    prevRef.current = value;
    setOutgoing(from);
    setOutOp(1);
    setInOp(0);
    const raf = requestAnimationFrame(() => {
      setOutOp(0);
      setInOp(1);
    });
    const done = window.setTimeout(() => {
      setOutgoing(null);
    }, 160);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [value]);

  const fw = bold ? 700 : 500;

  return (
    <span className={`relative inline-flex items-center justify-center min-w-[2rem] text-[11px] ${className ?? ''}`}>
      {outgoing !== null && (
        <span
          className="tabular-nums absolute inset-0 flex items-center justify-center transition-opacity ease-out"
          style={{ opacity: outOp, transitionDuration: '150ms', fontWeight: fw }}
          aria-hidden
        >
          {outgoing}%
        </span>
      )}
      <span
        className="tabular-nums transition-opacity ease-out"
        style={{ opacity: inOp, transitionDuration: '150ms', fontWeight: fw }}
      >
        {value}%
      </span>
    </span>
  );
}

function SprintTickerCell({
  sprint,
  cell,
  sprintCount,
  peopleLines,
  filterAssignmentLines,
  onOverloadedClick,
}: {
  sprint: Sprint;
  cell: CellData;
  sprintCount: number;
  peopleLines: PersonSprintLine[];
  /** When set, tooltip shows this person's sprint assignments instead of the team breakdown */
  filterAssignmentLines?: FilterAssignmentLine[] | null;
  onOverloadedClick?: () => void;
}) {
  const pct = pctFromCell(cell);
  const { bg, color, fontWeight } = tierTickerStyle(pct);
  const overloaded = pct > 100;
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false, delay: { open: 120, close: 80 } });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  const handleClick = useCallback(() => {
    if (overloaded) onOverloadedClick?.();
  }, [overloaded, onOverloadedClick]);

  const tooltipTeamMode = filterAssignmentLines == null;
  const showTooltip =
    filterAssignmentLines != null ? true : peopleLines.length > 0;

  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps()}
        role={overloaded ? 'button' : undefined}
        tabIndex={overloaded ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={
          overloaded
            ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOverloadedClick?.();
                }
              }
            : undefined
        }
        className={[
          'flex-shrink-0 flex items-center justify-center border-r border-mileway-border last:border-r-0 select-none',
          overloaded ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue' : 'cursor-default',
        ].join(' ')}
        style={{
          width: `${100 / sprintCount}%`,
          height: TICKER_H,
          backgroundColor: bg,
          color,
        }}
      >
        <CrossfadePct value={pct} bold={fontWeight >= 700} />
      </div>

      {open && showTooltip && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[100] rounded-lg border border-mileway-border bg-white px-3 py-2 shadow-lg text-left pointer-events-none"
          >
            <div className="text-xs font-semibold text-mileway-text whitespace-nowrap">
              {sprint.name} · {pct}%
            </div>
            <div className="my-1.5 h-px bg-mileway-divider" />
            {tooltipTeamMode ? (
              <ul className="space-y-0.5 font-mono text-[11px] tabular-nums">
                {peopleLines.map(p => (
                  <li key={p.id} className="flex justify-between gap-6 text-mileway-text">
                    <span className="font-sans font-normal truncate max-w-[140px]">{p.shortName}</span>
                    <span>{p.pct}%</span>
                  </li>
                ))}
              </ul>
            ) : filterAssignmentLines && filterAssignmentLines.length === 0 ? (
              <p className="text-[11px] text-mileway-grey">No assignments this sprint</p>
            ) : filterAssignmentLines && filterAssignmentLines.length > 0 ? (
              <ul className="space-y-0.5 text-[11px] text-mileway-text">
                {filterAssignmentLines.map(line => (
                  <li key={line.itemId} className="flex justify-between gap-4">
                    <span className="truncate max-w-[180px]">{line.label}</span>
                    <span className="font-mono tabular-nums flex-shrink-0">{line.days}d</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

export interface PlannerCapacityTickerProps {
  plannerItems: PlannerItem[];
  activeDragLayout?: PlannerItem[] | undefined;
  /** Pre-filtered sprint window from PlannerTimeline (1 past + current + future). */
  visibleSprints: Sprint[];
  labelWidth: number;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  onOverloadedSprintClick: () => void;
  /** Person filter (redesign §7) — individual allocation + tooltip */
  selectedFilterMemberId?: string | null;
}

export function usePlannerCapacityTicker({
  plannerItems,
  activeDragLayout,
  visibleSprints,
  labelWidth,
  isPanelOpen,
  onTogglePanel,
  onOverloadedSprintClick,
  selectedFilterMemberId = null,
}: PlannerCapacityTickerProps) {
  const state = useCurrentState();
  const itemsForCalc = activeDragLayout ?? plannerItems;

  const quarterSprints = visibleSprints;

  const { teamTotals, peopleBySprintIndex, filterMemberName, assignmentLinesBySprintIndex } = useMemo(() => {
    // Pre-compute per-quarter sprint counts so we can allocate capacity proportionally
    const sprintCountByQuarter = new Map<string, number>();
    for (const s of quarterSprints) {
      if (s.quarter) sprintCountByQuarter.set(s.quarter, (sprintCountByQuarter.get(s.quarter) ?? 0) + 1);
    }

    const memberRows = (state.teamMembers ?? [])
      .filter(m => !m.excludedFromCapacity)
      .map(m => {
        const cells = quarterSprints.map(s => {
          let perSprintAvail = 0;
          try {
            const q = s.quarter ?? '';
            const cap = calculateCapacity(m.id, q, state);
            const fixedUsed = cap.breakdown
              .filter(b => b.type === 'bau' || b.type === 'timeoff')
              .reduce((sum, b) => sum + b.days, 0);
            const quarterAvail = Math.max(0, cap.totalWorkdays - fixedUsed);
            perSprintAvail = Math.round(quarterAvail / (sprintCountByQuarter.get(q) || 1));
          } catch {
            perSprintAvail = 0;
          }
          return { load: computeLoadDays(m.id, s.number, itemsForCalc), avail: perSprintAvail };
        });
        return { id: m.id, name: m.name, cells };
      });

    const contactRows = (state.businessContacts ?? [])
      .filter(c => !c.archived && !c.excludedFromCapacity)
      .map(c => {
        const scale = (c.workingDaysPerWeek ?? 5) / 5;
        const bauPerSprint = Math.round((c.bauReserveDays ?? 5) / 6);
        const perSprintAvail = Math.max(0, Math.round(10 * scale) - bauPerSprint);
        const cells = quarterSprints.map(s => ({
          load: computeLoadDays(c.id, s.number, itemsForCalc),
          avail: perSprintAvail,
        }));
        return { id: c.id, name: c.name, cells };
      });

    const allRows = [...memberRows, ...contactRows];

    const totals: CellData[] = quarterSprints.map((_, idx) => ({
      load: allRows.reduce((s, r) => s + (r.cells[idx]?.load ?? 0), 0),
      avail: allRows.reduce((s, r) => s + (r.cells[idx]?.avail ?? 0), 0),
    }));

    const peopleByIdx: PersonSprintLine[][] = quarterSprints.map((_, idx) => {
      const lines: PersonSprintLine[] = [];
      for (const r of allRows) {
        const c = r.cells[idx];
        if (!c || c.load <= 0) continue;
        const p = pctFromCell(c);
        lines.push({
          id: r.id,
          name: r.name,
          shortName: shortDisplayName(r.name),
          pct: p,
        });
      }
      lines.sort((a, b) => b.pct - a.pct);
      return lines;
    });

    const filteredRow = selectedFilterMemberId
      ? allRows.find(r => r.id === selectedFilterMemberId)
      : undefined;
    const displayTotals =
      !selectedFilterMemberId
        ? totals
        : filteredRow
          ? filteredRow.cells
          : quarterSprints.map(s => ({
              load: computeLoadDays(selectedFilterMemberId, s.number, itemsForCalc),
              avail: 0,
            }));
    const fname =
      filteredRow?.name ??
      (selectedFilterMemberId
        ? (state.teamMembers ?? []).find(m => m.id === selectedFilterMemberId)?.name ??
          (state.businessContacts ?? []).find(c => c.id === selectedFilterMemberId)?.name ??
          null
        : null);
    const assignByIdx =
      selectedFilterMemberId != null
        ? quarterSprints.map(s =>
            assignmentsForMemberInSprint(selectedFilterMemberId, s.number, itemsForCalc),
          )
        : null;

    return {
      teamTotals: displayTotals,
      peopleBySprintIndex: peopleByIdx,
      filterMemberName: fname,
      assignmentLinesBySprintIndex: assignByIdx,
    };
  }, [state, quarterSprints, itemsForCalc, selectedFilterMemberId]);

  const labelCell =
    quarterSprints.length === 0 ? null : (
      <button
        type="button"
        onClick={onTogglePanel}
        className="flex-shrink-0 flex items-center gap-1.5 px-2 border-b border-mileway-border bg-mileway-bg hover:bg-mileway-blue-10/40 transition-colors duration-[150ms] ease-out text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
        style={{ width: labelWidth, height: TICKER_H }}
        aria-expanded={isPanelOpen}
      >
        {isPanelOpen ? (
          <ChevronUp size={14} className="flex-shrink-0 text-mileway-grey" aria-hidden />
        ) : (
          <ChevronDown size={14} className="flex-shrink-0 text-mileway-grey" aria-hidden />
        )}
        <span className="text-[11px] font-semibold text-mileway-text truncate">
          {selectedFilterMemberId && filterMemberName ? filterMemberName : 'Team capacity'}
        </span>
      </button>
    );

  const sprintCount = Math.max(quarterSprints.length, 1);

  const sprintRow =
    quarterSprints.length === 0 ? null : (
      <div className="flex w-full min-w-0 border-b border-mileway-border">
        {quarterSprints.map((s, i) => (
          <SprintTickerCell
            key={s.id}
            sprint={s}
            cell={teamTotals[i] ?? { load: 0, avail: 0 }}
            sprintCount={sprintCount}
            peopleLines={peopleBySprintIndex[i] ?? []}
            filterAssignmentLines={assignmentLinesBySprintIndex?.[i] ?? null}
            onOverloadedClick={onOverloadedSprintClick}
          />
        ))}
      </div>
    );

  return { labelCell, sprintRow, visible: quarterSprints.length > 0 };
}

export const PLANNER_CAPACITY_TICKER_H = TICKER_H;
