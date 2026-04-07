/**
 * PlannerPeopleView — People View tab for the Scenario Planner.
 *
 * Shows each team member / BIZ contact as a row with:
 *  - Left panel: avatar, name, role, utilisation badge (quarters total)
 *  - Right Gantt: per-sprint utilisation cells + collapsible per-item bars
 *
 * Filterable by process team.
 */
import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { calculateBusinessCapacity, calculateSprintCapacity } from '../../utils/capacity';
import type { PlannerItem, Sprint } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRINT_COUNT = 6;
const BAR_H = 16;

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierStyle(pct: number): { bg: string; color: string } {
  if (pct <= 0)   return { bg: 'transparent',           color: '#CBD5E1' };
  if (pct <= 50)  return { bg: 'rgba(22,163,74,0.08)',  color: '#16A34A' };
  if (pct <= 80)  return { bg: 'rgba(202,138,4,0.10)',  color: '#CA8A04' };
  if (pct <= 100) return { bg: 'rgba(234,88,12,0.10)',  color: '#EA580C' };
  return              { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626' };
}

const ITEM_COLORS = [
  '#6090E0', '#7C3AED', '#16A34A', '#D97706', '#DC2626',
  '#0891B2', '#DB2777', '#4F46E5', '#CA8A04', '#0D9488',
  '#2563EB', '#EA580C', '#9333EA',
] as const;

function itemColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
  return ITEM_COLORS[Math.abs(h) % ITEM_COLORS.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlannerPeopleViewProps {
  plannerItems: PlannerItem[];
  sprints: Sprint[];
  selectedQuarter: string;
  labelWidth?: number;
}

interface ItemEntry {
  itemId: string;
  title: string;
  startSprint: number;
  spanSprints: number;
  daysPerSprint: number;
}

interface PersonViewRow {
  id: string;
  name: string;
  role: string;
  track: 'IT' | 'BIZ';
  processTeamIds: string[];
  bizScale: number;       // working days / 5 (BIZ only)
  bizBauPerSprint: number;
  items: ItemEntry[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlannerPeopleView({
  plannerItems,
  sprints,
  selectedQuarter,
  labelWidth = 260,
}: PlannerPeopleViewProps) {
  const state = useCurrentState();
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [filterTeam, setFilterTeam] = useState('');

  const quarterSprints = useMemo(
    () => sprints.filter(s => s.quarter === selectedQuarter).slice(0, SPRINT_COUNT),
    [sprints, selectedQuarter],
  );

  const processTeams = useMemo(() => state.processTeams ?? [], [state.processTeams]);

  // Build person rows
  const allRows = useMemo((): PersonViewRow[] => {
    const rows: PersonViewRow[] = [];
    const qFirst = quarterSprints[0]?.number ?? 1;
    const qLast  = quarterSprints[quarterSprints.length - 1]?.number ?? qFirst;

    for (const m of state.teamMembers ?? []) {
      if (m.excludedFromCapacity) continue;
      const items = plannerItems.flatMap(item => {
        const a = item.assignees.find(x => x.memberId === m.id);
        if (!a) return [];
        if (item.startSprint + item.spanSprints - 1 < qFirst || item.startSprint > qLast) return [];
        return [{ itemId: item.id, title: item.name || item.type, startSprint: item.startSprint, spanSprints: item.spanSprints, daysPerSprint: a.daysPerSprint }];
      });
      rows.push({ id: m.id, name: m.name, role: m.role, track: 'IT', processTeamIds: m.processTeamIds ?? [], bizScale: 1, bizBauPerSprint: 0, items });
    }

    for (const c of state.businessContacts ?? []) {
      if (c.archived || c.excludedFromCapacity) continue;
      const items = plannerItems.flatMap(item => {
        const a = item.assignees.find(x => x.memberId === c.id);
        if (!a) return [];
        if (item.startSprint + item.spanSprints - 1 < qFirst || item.startSprint > qLast) return [];
        return [{ itemId: item.id, title: item.name || item.type, startSprint: item.startSprint, spanSprints: item.spanSprints, daysPerSprint: a.daysPerSprint }];
      });
      if (items.length === 0) continue;
      rows.push({ id: c.id, name: c.name, role: c.title ?? c.department ?? 'BIZ', track: 'BIZ', processTeamIds: c.processTeamIds ?? [], bizScale: 1, bizBauPerSprint: 0, items });
    }

    return rows;
  }, [state, plannerItems, quarterSprints]);

  // Apply team filter
  const rows = useMemo(
    () => filterTeam ? allRows.filter(r => r.processTeamIds.includes(filterTeam)) : allRows,
    [allRows, filterTeam],
  );

  // Per-person per-sprint available days
  const sprintAvail = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of rows) {
      const vals = quarterSprints.map(s => {
        if (row.track === 'IT') {
          try { return Math.max(0, calculateSprintCapacity(row.id, s, [], state).availableDays); }
          catch { return 0; }
        }
        const contact = state.businessContacts?.find(c => c.id === row.id);
        if (!contact) return 0;
        const cap = calculateBusinessCapacity(
          contact,
          s.startDate,
          s.endDate,
          [],
          state.businessTimeOff ?? [],
          state.publicHolidays ?? [],
          [],
        );
        return Math.max(0, cap.availableDays - cap.allocatedDays);
      });
      map.set(row.id, vals);
    }
    return map;
  }, [rows, quarterSprints, state]);

  const toggleExpanded = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (quarterSprints.length === 0) {
    return <div style={{ padding: 24, color: '#64748B', fontSize: 13 }}>No sprints configured for this quarter.</div>;
  }

  const N = quarterSprints.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#fff', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #E2E8F0', flexShrink: 0, backgroundColor: '#FAFAFA' }}>
        <span style={{ fontSize: 11, color: '#6B7280' }}>Team:</span>
        <select
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
          style={{ fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 4, padding: '2px 6px', color: '#374151', background: '#fff' }}
        >
          <option value="">All teams</option>
          {processTeams.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748B' }}>{rows.length} people</span>
      </div>

      {/* Sprint header */}
      <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
        <div style={{ flexShrink: 0, width: labelWidth, padding: '5px 12px', borderRight: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#1E293B' }}>
          Person
        </div>
        {quarterSprints.map(s => (
          <div key={s.id} style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid #E2E8F0', fontSize: 10, fontWeight: 600, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.name}
          </div>
        ))}
      </div>

      {/* Person rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 12 }}>No people to display.</div>
        )}
        {rows.map(row => {
          const avails   = sprintAvail.get(row.id) ?? quarterSprints.map(() => 0);
          const totalAvail = avails.reduce((s, v) => s + v, 0);
          const totalLoad  = row.items.reduce((sum, it) => {
            const overlap = quarterSprints.filter(s => s.number >= it.startSprint && s.number < it.startSprint + it.spanSprints).length;
            return sum + it.daysPerSprint * overlap;
          }, 0);
          const utilPct   = totalAvail > 0 ? Math.round((totalLoad / totalAvail) * 100) : (totalLoad > 0 ? 100 : 0);
          const badge     = tierStyle(utilPct);
          const isExp     = expanded.has(row.id);

          return (
            <div key={row.id} style={{ borderBottom: '1px solid #F1F5F9' }}>

              {/* Person header */}
              <div
                style={{ display: 'flex', alignItems: 'stretch', cursor: 'pointer', minHeight: 36 }}
                onClick={() => toggleExpanded(row.id)}
              >
                <div style={{ flexShrink: 0, width: labelWidth, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 10px', borderRight: '1px solid #E2E8F0' }}>
                  {isExp
                    ? <ChevronDown  size={10} style={{ flexShrink: 0, color: '#64748B' }} />
                    : <ChevronRight size={10} style={{ flexShrink: 0, color: '#64748B' }} />
                  }
                  <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', backgroundColor: row.track === 'IT' ? '#E0F0FB' : '#EDE9FE', color: row.track === 'IT' ? '#0089DD' : '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700 }}>
                    {initials(row.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                    <div style={{ fontSize: 10, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.role}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: badge.bg, color: badge.color }}>
                    {utilPct}%
                  </span>
                </div>
                {/* Sprint utilisation cells */}
                {quarterSprints.map((s, idx) => {
                  const load = row.items.reduce((sum, it) => {
                    const inRange = s.number >= it.startSprint && s.number < it.startSprint + it.spanSprints;
                    return sum + (inRange ? it.daysPerSprint : 0);
                  }, 0);
                  const avail = avails[idx] ?? 0;
                  const pct   = avail > 0 ? Math.round((load / avail) * 100) : (load > 0 ? 100 : 0);
                  const { bg, color } = tierStyle(pct);
                  return (
                    <div key={s.id} style={{ flex: 1, backgroundColor: bg, borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3px 6px' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color }}>{pct}%</div>
                      <div style={{ fontSize: 9, color: '#64748B' }}>{load}d/{avail}d</div>
                    </div>
                  );
                })}
              </div>

              {/* Expanded: per-item bars */}
              {isExp && row.items.map(it => {
                const col = itemColor(it.itemId);
                return (
                  <div key={it.itemId} style={{ display: 'flex', borderTop: '1px solid #F1F5F9', minHeight: 28, backgroundColor: '#FAFAFA' }}>
                    <div style={{ flexShrink: 0, width: labelWidth, padding: '4px 8px 4px 40px', borderRight: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: col, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={it.title}>{it.title}</span>
                      <span style={{ fontSize: 9, color: '#64748B', flexShrink: 0 }}>{it.daysPerSprint}d</span>
                    </div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)` }}>
                      {quarterSprints.map(s => {
                        const inRange = s.number >= it.startSprint && s.number < it.startSprint + it.spanSprints;
                        return (
                          <div key={s.id} style={{ borderRight: '1px solid #F1F5F9', padding: '5px 3px', display: 'flex', alignItems: 'center' }}>
                            {inRange && (
                              <div style={{ height: BAR_H, width: '100%', borderRadius: 3, backgroundColor: `${col}22`, border: `1.5px solid ${col}`, display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 600, color: col }}>{it.daysPerSprint}d</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
