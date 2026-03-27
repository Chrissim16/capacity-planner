/**
 * PlannerCapacity — Per-member sprint allocation panel with process-team rollup.
 *
 * Renders below the Gantt in Timeline mode and below the Board in Board mode.
 * Layout: 220px label column | repeat(N, 1fr) sprint cells — mirrors sprint headers above.
 *
 * Covers:
 *   SP-14 — individual per-sprint capacity rows, allocation tiers, mini progress bar
 *   SP-15 — process-team summary rows (collapsible, worst-case colouring)
 *   SP-16 — live updates via reactive plannerItems + activeDragPreview
 *
 * Allocation colour tiers (from spec §8):
 *   0%       → #FAFAFA / #D1D5DB
 *   1–50%    → #F0FDF4 / #16A34A
 *   51–80%   → #FEFCE8 / #CA8A04
 *   81–100%  → #FFF7ED / #EA580C
 *   >100%    → #FEF2F2 / #DC2626
 */
import { useState, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { calculateSprintCapacity } from '../../utils/capacity';
import type { PlannerItem, Sprint, ProcessTeam } from '../../types';
import type { DragPreview } from './PlannerTimeline';

// ── Constants ─────────────────────────────────────────────────────────────────

const LABEL_W = 260;
const SPRINT_COUNT = 6;

// ── Public types ──────────────────────────────────────────────────────────────

export interface PlannerCapacityProps {
  plannerItems: PlannerItem[];
  sprints: Sprint[];
  selectedQuarter: string;
  activeDragPreview?: DragPreview | null;
  isVisible: boolean;
  /** When set, highlights that person's row with a blue accent */
  focusedMemberId?: string | null;
  /** Label column width in px — kept in sync with PlannerTimeline. Default: 260. */
  labelWidth?: number;
  /** Called when the user edits a day count inline in a capacity cell. */
  onUpdateDays?: (itemId: string, memberId: string, days: number) => void;
}

export type PlannerCapacityHandle = {
  /** Scroll the capacity panel to the first overloaded person row (process-team member rows only). */
  scrollToFirstOverloaded: () => void;
};

// ── Internal types ────────────────────────────────────────────────────────────

interface ContributionEntry { itemId: string; title: string; days: number }
interface CellData { load: number; avail: number; contributions: ContributionEntry[]; sprintNumber: number }

interface PersonRow {
  id: string;
  name: string;
  role: string;
  track: 'IT' | 'BIZ';
  processTeamIds: string[];
  sprints: CellData[];
  isOverloaded: boolean;
}

interface TeamGroup {
  teamId: string;
  teamName: string;
  members: PersonRow[];
  summary: CellData[];
  worstPct: number;
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

function pctFromCell(cell: CellData): number {
  return cell.avail > 0 ? Math.round((cell.load / cell.avail) * 100) : (cell.load > 0 ? 100 : 0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function computeLoadContributions(
  memberId: string,
  sprintNumber: number,
  items: PlannerItem[],
  preview: DragPreview | null | undefined,
): ContributionEntry[] {
  const result: ContributionEntry[] = [];
  for (const item of items) {
    const effectiveStart = preview?.itemId === item.id ? preview.newStartSprint : item.startSprint;
    const inRange = sprintNumber >= effectiveStart && sprintNumber < effectiveStart + item.spanSprints;
    if (!inRange) continue;
    for (const a of item.assignees) {
      if (a.memberId === memberId) {
        result.push({ itemId: item.id, title: item.title ?? item.type, days: a.daysPerSprint });
      }
    }
  }
  return result;
}

// ── SprintCell ───────────────────────────────────────────────────────────────

interface SprintCellEditProps {
  contributions: ContributionEntry[];
  sprintNumber: number;
  memberId: string;
  editingKey: string | null; // "${sprintNumber}:${itemId}"
  onStartEdit: (key: string) => void;
  onCommit: (itemId: string, memberId: string, days: number) => void;
  onCancel: () => void;
}

function SprintCell({
  loadDays,
  availDays,
  editProps,
}: {
  loadDays: number;
  availDays: number;
  editProps?: SprintCellEditProps;
}) {
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
      <div style={{ color, fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{pct}%</div>
      {editProps ? (
        <div style={{ fontSize: 10, lineHeight: 1.4, marginTop: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          {editProps.contributions.length === 0
            ? <span style={{ color: '#D1D5DB' }}>—</span>
            : editProps.contributions.map(c => {
                const key = `${editProps.sprintNumber}:${c.itemId}`;
                const isEditing = editProps.editingKey === key;
                return isEditing ? (
                  <input
                    key={c.itemId}
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={c.days}
                    ref={el => { if (el) { el.focus(); el.select(); } }}
                    style={{ width: 38, fontSize: 10, padding: '0 2px', border: '1px solid #0089DD', borderRadius: 2, outline: 'none' }}
                    onBlur={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= 0) editProps.onCommit(c.itemId, editProps.memberId, v);
                      else editProps.onCancel();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      else if (e.key === 'Escape') { editProps.onCancel(); e.currentTarget.blur(); }
                    }}
                  />
                ) : (
                  <span
                    key={c.itemId}
                    style={{ color: '#6B7280', cursor: 'pointer', borderBottom: '1px dotted #9CA3AF' }}
                    title={`Edit "${c.title}": ${c.days}d`}
                    onClick={() => editProps.onStartEdit(key)}
                  >
                    {c.days}d
                  </span>
                );
              })
          }
          <span style={{ color: '#9CA3AF' }}>/ {availDays}d</span>
        </div>
      ) : (
        <div style={{ color: '#9CA3AF', fontSize: 10, lineHeight: 1.2, marginTop: 1 }}>
          {loadDays}d / {availDays}d
        </div>
      )}
      <div style={{ height: 3, borderRadius: 2, background: '#E5E7EB', marginTop: 3, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            width: `${barPct}%`, backgroundColor: color,
            borderRadius: 2, transition: 'width 300ms ease',
          }}
        />
        {overflowPct > 0 && (
          <div
            style={{
              position: 'absolute', right: 0, top: 0, height: '100%',
              width: `${overflowPct}%`, backgroundColor: '#DC2626',
              borderRadius: 2, transition: 'width 300ms ease',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── PersonLabel ──────────────────────────────────────────────────────────────

function PersonLabel({ row }: { row: PersonRow }) {
  return (
    <div
      style={{
        flexShrink: 0,
        width: LABEL_W - 3,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px',
        borderRight: '1px solid #EBEBEB',
      }}
    >
      <div
        style={{
          flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
          backgroundColor: row.track === 'IT' ? '#E0F0FB' : '#EDE9FE',
          color: row.track === 'IT' ? '#0089DD' : '#7C3AED',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700,
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
              flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
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
  );
}

// ── PersonRow ────────────────────────────────────────────────────────────────

function PersonRowView({
  row,
  isFocused,
  onUpdateDays,
}: {
  row: PersonRow;
  isFocused?: boolean;
  onUpdateDays?: (itemId: string, memberId: string, days: number) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  return (
    <div
      data-planner-cap-member="true"
      data-member-id={row.id}
      data-overloaded={row.isOverloaded ? 'true' : 'false'}
      style={{
        display: 'flex',
        borderBottom: '1px solid #F1F5F9',
        borderLeft: row.isOverloaded
          ? '3px solid #DC2626'
          : isFocused
          ? '3px solid #0089DD'
          : '3px solid transparent',
        background: isFocused ? 'rgba(0,137,221,0.06)' : undefined,
        transition: 'background 300ms, border-left-color 300ms',
      }}
    >
      <PersonLabel row={row} />
      {row.sprints.map((s, i) => (
        <SprintCell
          key={i}
          loadDays={s.load}
          availDays={s.avail}
          editProps={onUpdateDays ? {
            contributions: s.contributions,
            sprintNumber: s.sprintNumber,
            memberId: row.id,
            editingKey,
            onStartEdit: setEditingKey,
            onCommit: (itemId, memberId, days) => {
              onUpdateDays(itemId, memberId, days);
              setEditingKey(null);
            },
            onCancel: () => setEditingKey(null),
          } : undefined}
        />
      ))}
    </div>
  );
}

// ── TeamGroupView ────────────────────────────────────────────────────────────

function TeamGroupView({
  group,
  isExpanded,
  onToggle,
  focusedMemberId,
  onUpdateDays,
}: {
  group: TeamGroup;
  isExpanded: boolean;
  onToggle: () => void;
  focusedMemberId?: string | null;
  onUpdateDays?: (itemId: string, memberId: string, days: number) => void;
}) {
  const summaryOverloaded = group.summary.some(c => pctFromCell(c) > 100);

  return (
    <>
      {/* Summary row (collapsible header) */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #EBEBEB',
          backgroundColor: '#F8FAFC',
          cursor: 'pointer',
          borderLeft: summaryOverloaded ? '3px solid #DC2626' : '3px solid transparent',
        }}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
        title={isExpanded ? `Collapse ${group.teamName}` : `Expand ${group.teamName}`}
      >
        <div
          style={{
            flexShrink: 0,
            width: LABEL_W - 3,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRight: '1px solid #EBEBEB',
          }}
        >
          {isExpanded
            ? <ChevronDown size={12} style={{ flexShrink: 0, color: '#6B7280' }} />
            : <ChevronRight size={12} style={{ flexShrink: 0, color: '#6B7280' }} />
          }
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.teamName}
          </span>
          <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>({group.members.length})</span>
          {summaryOverloaded && (
            <AlertTriangle size={11} style={{ flexShrink: 0, color: '#DC2626' }} />
          )}
        </div>
        {/* Process team summary cells — coloured by worst-case individual tier */}
        {group.summary.map((cell, i) => {
          const worstMemberPct = Math.max(0, ...group.members.map(m => pctFromCell(m.sprints[i])));
          const { bg, color } = tierStyle(worstMemberPct);
          const teamPct = pctFromCell(cell);
          return (
            <div
              key={i}
              style={{
                flex: 1, minWidth: 0, backgroundColor: bg,
                borderRight: '1px solid #EBEBEB', padding: '5px 8px',
              }}
            >
              <div style={{ color, fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{teamPct}%</div>
              <div style={{ color: '#9CA3AF', fontSize: 10, lineHeight: 1.2, marginTop: 1 }}>
                {cell.load}d / {cell.avail}d
              </div>
            </div>
          );
        })}
      </div>

      {/* Individual member rows */}
      {isExpanded && group.members.map(row => (
        <PersonRowView key={row.id} row={row} isFocused={focusedMemberId === row.id} onUpdateDays={onUpdateDays} />
      ))}
    </>
  );
}

// ── PlannerCapacity ──────────────────────────────────────────────────────────

export const PlannerCapacity = forwardRef<PlannerCapacityHandle, PlannerCapacityProps>(function PlannerCapacity(
  {
    plannerItems,
    sprints,
    selectedQuarter,
    activeDragPreview,
    isVisible,
    focusedMemberId,
    labelWidth: labelWidthProp,
    onUpdateDays,
  },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colLabelW = labelWidthProp ?? LABEL_W;
  const state = useCurrentState();

  useImperativeHandle(ref, () => ({
    scrollToFirstOverloaded() {
      const root = scrollRef.current;
      if (!root) return;
      const el = root.querySelector('[data-planner-cap-member="true"][data-overloaded="true"]');
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  }));
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

  const quarterSprints = useMemo(
    () => sprints.filter(s => s.quarter === selectedQuarter).slice(0, SPRINT_COUNT),
    [sprints, selectedQuarter],
  );

  // Process teams lookup
  const processTeamMap = useMemo(() => {
    const map = new Map<string, ProcessTeam>();
    for (const pt of state.processTeams ?? []) map.set(pt.id, pt);
    return map;
  }, [state.processTeams]);

  // Build PersonRow for IT members — per-sprint capacity accounts for absences/holidays
  const memberRows = useMemo((): PersonRow[] => {
    const activeMembers = (state.teamMembers ?? []).filter(m => !m.excludedFromCapacity);
    return activeMembers.map(m => {
      const cells = quarterSprints.map(s => {
        const contributions = computeLoadContributions(m.id, s.number, plannerItems, activeDragPreview);
        const sprintCap = calculateSprintCapacity(m.id, s, [], state);
        return {
          load: contributions.reduce((sum, c) => sum + c.days, 0),
          avail: Math.max(0, sprintCap.availableDays),
          contributions,
          sprintNumber: s.number,
        };
      });
      return {
        id: m.id,
        name: m.name,
        role: m.role,
        track: 'IT' as const,
        processTeamIds: m.processTeamIds ?? [],
        sprints: cells,
        isOverloaded: cells.some(c => c.avail > 0 && c.load > c.avail),
      };
    });
  }, [state, quarterSprints, plannerItems, activeDragPreview]);

  // Build PersonRow for BIZ contacts
  const contactRows = useMemo((): PersonRow[] => {
    const activeContacts = (state.businessContacts ?? []).filter(c => !c.archived && !c.excludedFromCapacity);
    const sprintWorkdays = 10;
    return activeContacts.map(c => {
      const scale = (c.workingDaysPerWeek ?? 5) / 5;
      const bauPerSprint = Math.round((c.bauReserveDays ?? 5) / 6);
      const perSprintAvail = Math.max(0, Math.round(sprintWorkdays * scale) - bauPerSprint);
      const cells = quarterSprints.map(s => {
        const contributions = computeLoadContributions(c.id, s.number, plannerItems, activeDragPreview);
        return {
          load: contributions.reduce((sum, e) => sum + e.days, 0),
          avail: perSprintAvail,
          contributions,
          sprintNumber: s.number,
        };
      });
      return {
        id: c.id,
        name: c.name,
        role: c.title ?? c.department ?? 'BIZ',
        track: 'BIZ' as const,
        processTeamIds: c.processTeamIds ?? [],
        sprints: cells,
        isOverloaded: cells.some(cl => cl.avail > 0 && cl.load > cl.avail),
      };
    });
  }, [state.businessContacts, quarterSprints, plannerItems, activeDragPreview]);

  const allRows = useMemo(() => [...memberRows, ...contactRows], [memberRows, contactRows]);

  // SP-15: Group into process teams
  const { teamGroups, unassignedGroup, unassignedPct } = useMemo(() => {
    const teamMap = new Map<string, PersonRow[]>();
    const unassigned: PersonRow[] = [];

    for (const row of allRows) {
      if (row.processTeamIds.length === 0) {
        unassigned.push(row);
      } else {
        for (const ptId of row.processTeamIds) {
          if (!teamMap.has(ptId)) teamMap.set(ptId, []);
          teamMap.get(ptId)!.push(row);
        }
      }
    }

    const groups: TeamGroup[] = [];
    for (const [ptId, members] of teamMap) {
      const pt = processTeamMap.get(ptId);
      const summary: CellData[] = quarterSprints.map((s, idx) => ({
        load: members.reduce((sum, m) => sum + (m.sprints[idx]?.load ?? 0), 0),
        avail: members.reduce((sum, m) => sum + (m.sprints[idx]?.avail ?? 0), 0),
        contributions: [],
        sprintNumber: s.number,
      }));
      const worstPct = Math.max(0, ...summary.map(c => pctFromCell(c)));
      groups.push({
        teamId: ptId,
        teamName: pt?.name ?? ptId,
        members,
        summary,
        worstPct,
      });
    }
    // Sort: most stressed team first
    groups.sort((a, b) => b.worstPct - a.worstPct);

    // Unassigned group
    const unSummary: CellData[] = quarterSprints.map((s, idx) => ({
      load: unassigned.reduce((sum, m) => sum + (m.sprints[idx]?.load ?? 0), 0),
      avail: unassigned.reduce((sum, m) => sum + (m.sprints[idx]?.avail ?? 0), 0),
      contributions: [],
      sprintNumber: s.number,
    }));
    const unGroup: TeamGroup = {
      teamId: '__unassigned__',
      teamName: 'Unassigned team',
      members: unassigned,
      summary: unSummary,
      worstPct: Math.max(0, ...unSummary.map(c => pctFromCell(c))),
    };

    const itMembers = (state.teamMembers ?? []).filter(m => !m.excludedFromCapacity);
    const unPct = itMembers.length > 0
      ? unassigned.filter(r => r.track === 'IT').length / itMembers.length
      : 0;

    return { teamGroups: groups, unassignedGroup: unGroup, unassignedPct: unPct };
  }, [allRows, processTeamMap, quarterSprints, state.teamMembers]);

  // Team total row
  const teamTotals = useMemo(() => {
    return quarterSprints.map((s, idx) => ({
      load: allRows.reduce((sum, d) => sum + (d.sprints[idx]?.load ?? 0), 0),
      avail: allRows.reduce((sum, d) => sum + (d.sprints[idx]?.avail ?? 0), 0),
      contributions: [] as ContributionEntry[],
      sprintNumber: s.number,
    }));
  }, [allRows, quarterSprints]);

  const toggleTeam = (teamId: string) => {
    setCollapsedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId); else next.add(teamId);
      return next;
    });
  };

  if (!isVisible || quarterSprints.length === 0) return null;

  const hasTeams = teamGroups.length > 0;

  return (
    <div
      ref={scrollRef}
      className="flex-shrink-0 border-t border-mileway-border bg-white"
      style={{ maxHeight: 300, overflowY: 'auto' }}
    >
      {/* Team total row — pinned at top */}
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
            flexShrink: 0, width: colLabelW,
            display: 'flex', alignItems: 'center',
            padding: '6px 12px', borderRight: '1px solid #EBEBEB',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Team total</span>
        </div>
        {teamTotals.map((t, i) => (
          <SprintCell key={i} loadDays={t.load} availDays={t.avail} />
        ))}
      </div>

      {/* Process team groups (SP-15) */}
      {hasTeams ? (
        <>
          {teamGroups.map(group => (
            <TeamGroupView
              key={group.teamId}
              group={group}
              isExpanded={!collapsedTeams.has(group.teamId)}
              onToggle={() => toggleTeam(group.teamId)}
              focusedMemberId={focusedMemberId}
              onUpdateDays={onUpdateDays}
            />
          ))}

          {/* Unassigned team — at the bottom */}
          {unassignedGroup.members.length > 0 && (
            <TeamGroupView
              group={unassignedGroup}
              isExpanded={!collapsedTeams.has('__unassigned__')}
              onToggle={() => toggleTeam('__unassigned__')}
              focusedMemberId={focusedMemberId}
              onUpdateDays={onUpdateDays}
            />
          )}
        </>
      ) : (
        // No process teams at all — flat list
        allRows.map(row => <PersonRowView key={row.id} row={row} isFocused={focusedMemberId === row.id} onUpdateDays={onUpdateDays} />)
      )}

      {/* SP-15 AC7: Data quality notice when >20% of IT members have no process team */}
      {unassignedPct > 0.2 && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', backgroundColor: '#FFFBEB',
            borderTop: '1px solid #FDE68A', fontSize: 11, color: '#92400E',
          }}
        >
          <AlertTriangle size={12} style={{ flexShrink: 0 }} />
          <span>Some members have no process team assigned — update in team settings.</span>
        </div>
      )}

      {allRows.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>
          No team members to display.
        </div>
      )}
    </div>
  );
});

PlannerCapacity.displayName = 'PlannerCapacity';
