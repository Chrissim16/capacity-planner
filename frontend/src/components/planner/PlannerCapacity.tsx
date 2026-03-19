/**
 * PlannerCapacity — Per-member sprint allocation panel.
 *
 * Renders below the Gantt in Timeline mode and below the Board in Board mode.
 * Layout: 220px label column | repeat(N, 1fr) sprint cells — mirrors sprint headers above.
 *
 * Allocation colour tiers (from spec §8):
 *   0%       → #FAFAFA / #D1D5DB
 *   1–50%    → #F0FDF4 / #16A34A
 *   51–80%   → #FEFCE8 / #CA8A04
 *   81–100%  → #FFF7ED / #EA580C
 *   >100%    → #FEF2F2 / #DC2626
 */
import { useMemo } from 'react';
import { useCurrentState } from '../../stores/appStore';
import { calculateCapacity } from '../../utils/capacity';
import type { PlannerItem, Sprint } from '../../types';
import type { DragPreview } from './PlannerTimeline';

// ── Constants ─────────────────────────────────────────────────────────────────

const LABEL_W = 220;
const SPRINT_COUNT = 6;

// ── Public types ──────────────────────────────────────────────────────────────

export interface PlannerCapacityProps {
  plannerItems: PlannerItem[];
  sprints: Sprint[];
  selectedQuarter: string;
  /** Live drag preview from PlannerTimeline — used to show provisional allocation. */
  activeDragPreview?: DragPreview | null;
  isVisible: boolean;
}

// ── Tier colour lookup ────────────────────────────────────────────────────────

interface TierStyle { bg: string; color: string }

function tierStyle(pct: number): TierStyle {
  if (pct <= 0)   return { bg: '#FAFAFA', color: '#D1D5DB' };
  if (pct <= 50)  return { bg: '#F0FDF4', color: '#16A34A' };
  if (pct <= 80)  return { bg: '#FEFCE8', color: '#CA8A04' };
  if (pct <= 100) return { bg: '#FFF7ED', color: '#EA580C' };
  return              { bg: '#FEF2F2', color: '#DC2626' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

/**
 * Compute load days for a person in a given sprint from plannerItems.
 * Optionally overrides a single item's start position via activeDragPreview.
 */
function computeLoadDays(
  memberId: string,
  sprintNumber: number,
  items: PlannerItem[],
  preview: DragPreview | null | undefined,
): number {
  let load = 0;
  for (const item of items) {
    const effectiveStart = preview?.itemId === item.id ? preview.newStartSprint : item.startSprint;
    const inRange = sprintNumber >= effectiveStart && sprintNumber < effectiveStart + item.spanSprints;
    if (!inRange) continue;
    for (const a of item.assignees) {
      if (a.memberId === memberId) load += a.daysPerSprint;
    }
  }
  return load;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SprintCellProps {
  loadDays: number;
  availDays: number;
}

function SprintCell({ loadDays, availDays }: SprintCellProps) {
  const pct = availDays > 0 ? Math.round((loadDays / availDays) * 100) : (loadDays > 0 ? 100 : 0);
  const { bg, color } = tierStyle(pct);
  const barPct = Math.min(100, pct);
  const overflowPct = pct > 100 ? Math.min(100, pct - 100) : 0;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: bg,
        borderRight: '1px solid #EBEBEB',
        padding: '5px 8px',
      }}
    >
      <div style={{ color, fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>
        {pct}%
      </div>
      <div style={{ color: '#9CA3AF', fontSize: 10, lineHeight: 1.2, marginTop: 1 }}>
        {loadDays}d / {availDays}d
      </div>
      {/* 3px mini progress bar */}
      <div style={{ height: 3, borderRadius: 2, background: '#E5E7EB', marginTop: 3, overflow: 'hidden', position: 'relative' }}>
        {/* Normal fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${barPct}%`,
            backgroundColor: color,
            borderRadius: 2,
            transition: 'width 300ms ease',
          }}
        />
        {/* Overflow segment (red) */}
        {overflowPct > 0 && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: `${overflowPct}%`,
              backgroundColor: '#DC2626',
              borderRadius: 2,
              transition: 'width 300ms ease',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── PlannerCapacity ───────────────────────────────────────────────────────────

export function PlannerCapacity({
  plannerItems,
  sprints,
  selectedQuarter,
  activeDragPreview,
  isVisible,
}: PlannerCapacityProps) {
  const state = useCurrentState();

  const quarterSprints = useMemo(
    () => sprints.filter(s => s.quarter === selectedQuarter).slice(0, SPRINT_COUNT),
    [sprints, selectedQuarter],
  );

  const activeMembers = useMemo(
    () => (state.teamMembers ?? []).filter(m => !m.excludedFromCapacity),
    [state.teamMembers],
  );

  const activeContacts = useMemo(
    () => (state.businessContacts ?? []).filter(c => !c.archived && !c.excludedFromCapacity),
    [state.businessContacts],
  );

  // Per-member per-sprint data
  const memberData = useMemo(() => {
    const n = quarterSprints.length || 1;
    return activeMembers.map(m => {
      let quarterAvail = 0;
      try {
        const cap = calculateCapacity(m.id, selectedQuarter, state);
        // Available = workdays minus fixed commitments (BAU + time off) only.
        // Planner item load is shown separately in the cell.
        const fixedUsed = cap.breakdown
          .filter(b => b.type === 'bau' || b.type === 'timeoff')
          .reduce((sum, b) => sum + b.days, 0);
        quarterAvail = Math.max(0, cap.totalWorkdays - fixedUsed);
      } catch { quarterAvail = 0; }
      const perSprintAvail = Math.round(quarterAvail / n);
      const cells = quarterSprints.map(s => {
        const load = computeLoadDays(m.id, s.number, plannerItems, activeDragPreview);
        return { load, avail: perSprintAvail };
      });
      const isOverloaded = cells.some(s => s.avail > 0 && s.load > s.avail);
      return { id: m.id, name: m.name, role: m.role, track: 'IT' as const, sprints: cells, isOverloaded };
    });
  }, [activeMembers, quarterSprints, selectedQuarter, plannerItems, activeDragPreview, state]);

  // Per-biz-contact per-sprint data (simplified: workdays * factor - bau)
  const contactData = useMemo(() => {
    const sprintWorkdays = 10; // 2-week sprints
    return activeContacts.map(c => {
      const scale = ((c.workingDaysPerWeek ?? 5) / 5);
      const bauPerSprint = Math.round((c.bauReserveDays ?? 5) / 6);
      const perSprintAvail = Math.max(0, Math.round(sprintWorkdays * scale) - bauPerSprint);
      const sprintItems = quarterSprints.map(s => {
        const load = computeLoadDays(c.id, s.number, plannerItems, activeDragPreview);
        return { load, avail: perSprintAvail };
      });
      const isOverloaded = sprintItems.some(s => s.avail > 0 && s.load > s.avail);
      return { id: c.id, name: c.name, role: c.title ?? c.department ?? 'BIZ', track: 'BIZ' as const, sprints: sprintItems, isOverloaded };
    });
  }, [activeContacts, quarterSprints, plannerItems, activeDragPreview]);

  // Team total row
  const teamTotals = useMemo(() => {
    return quarterSprints.map((_, idx) => {
      const totalLoad = [...memberData, ...contactData].reduce((s, d) => s + (d.sprints[idx]?.load ?? 0), 0);
      const totalAvail = [...memberData, ...contactData].reduce((s, d) => s + (d.sprints[idx]?.avail ?? 0), 0);
      return { load: totalLoad, avail: totalAvail };
    });
  }, [memberData, contactData, quarterSprints]);

  const allRows = [...memberData, ...contactData];

  if (!isVisible || quarterSprints.length === 0) return null;

  return (
    <div
      className="flex-shrink-0 border-t border-mileway-border bg-white"
      style={{ maxHeight: 260, overflowY: 'auto' }}
    >
      {/* Team total row */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #EBEBEB',
          backgroundColor: '#F8FAFC',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: LABEL_W,
            display: 'flex',
            alignItems: 'center',
            padding: '6px 12px',
            borderRight: '1px solid #EBEBEB',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Team total</span>
        </div>
        {teamTotals.map((t, i) => (
          <SprintCell key={i} loadDays={t.load} availDays={t.avail} />
        ))}
      </div>

      {/* Individual person rows */}
      {allRows.map(row => (
        <div
          key={row.id}
          style={{
            display: 'flex',
            borderBottom: '1px solid #F1F5F9',
            borderLeft: row.isOverloaded ? '3px solid #DC2626' : '3px solid transparent',
          }}
        >
          {/* Label */}
          <div
            style={{
              flexShrink: 0,
              width: LABEL_W - 3, // account for 3px left border
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 10px',
              borderRight: '1px solid #EBEBEB',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: row.track === 'IT' ? '#E0F0FB' : '#EDE9FE',
                color: row.track === 'IT' ? '#0089DD' : '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {initials(row.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                  {row.name}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: 3,
                    backgroundColor: row.track === 'IT' ? '#E0F0FB' : '#EDE9FE',
                    color: row.track === 'IT' ? '#0089DD' : '#7C3AED',
                  }}
                >
                  {row.track}
                </span>
                {row.isOverloaded && (
                  <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#DC2626', padding: '1px 4px', borderRadius: 3, backgroundColor: '#FEF2F2' }}>
                    OVERLOADED
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.role}
              </div>
            </div>
          </div>

          {/* Sprint cells */}
          {row.sprints.map((s, i) => (
            <SprintCell key={i} loadDays={s.load} availDays={s.avail} />
          ))}
        </div>
      ))}

      {allRows.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>
          No team members to display.
        </div>
      )}
    </div>
  );
}
