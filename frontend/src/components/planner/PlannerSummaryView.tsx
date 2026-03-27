/**
 * PlannerSummaryView — Summary / KPI tab for the Scenario Planner.
 *
 * Shows:
 *  - KPI cards: overloaded sprints, planned items, unscheduled items, avg utilisation
 *  - Process-team breakdown table: utilisation %, days summary, worst sprint
 */
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { calculateSprintCapacity } from '../../utils/capacity';
import {
  countOverloadedTeamSprints,
  countUnscheduledJiraItems,
} from '../../utils/plannerScenarioHealth';
import type { PlannerItem, Sprint } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierStyle(pct: number): { bg: string; color: string } {
  if (pct <= 0)   return { bg: '#F9FAFB', color: '#9CA3AF' };
  if (pct <= 50)  return { bg: '#F0FDF4', color: '#16A34A' };
  if (pct <= 80)  return { bg: '#FEFCE8', color: '#CA8A04' };
  if (pct <= 100) return { bg: '#FFF7ED', color: '#EA580C' };
  return              { bg: '#FEF2F2', color: '#DC2626' };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlannerSummaryViewProps {
  plannerItems: PlannerItem[];
  sprints: Sprint[];
  selectedQuarter: string;
}

interface TeamRow {
  teamId: string;
  teamName: string;
  memberCount: number;
  assignedDays: number;
  availDays: number;
  utilPct: number;
  worstSprintName: string;
  worstSprintPct: number;
}

const SPRINT_COUNT = 6;

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140, padding: '14px 16px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#fff', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ?? '#1E293B', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{sub}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlannerSummaryView({ plannerItems, sprints, selectedQuarter }: PlannerSummaryViewProps) {
  const state = useCurrentState();

  const quarterSprints = useMemo(
    () => sprints.filter(s => s.quarter === selectedQuarter).slice(0, SPRINT_COUNT),
    [sprints, selectedQuarter],
  );

  // ── KPI values ──────────────────────────────────────────────────────────────

  const overloadedSprints = useMemo(
    () => countOverloadedTeamSprints(plannerItems, state, sprints),
    [plannerItems, state, sprints],
  );

  const unscheduled = useMemo(
    () => countUnscheduledJiraItems(plannerItems, state),
    [plannerItems, state],
  );

  // Avg utilisation across all IT members for the selected quarter
  const avgUtil = useMemo(() => {
    const activeMembers = (state.teamMembers ?? []).filter(m => !m.excludedFromCapacity);
    if (!activeMembers.length || !quarterSprints.length) return 0;
    let totalLoad = 0, totalAvail = 0;
    for (const m of activeMembers) {
      for (const s of quarterSprints) {
        const load = plannerItems.reduce((sum, item) => {
          const inRange = s.number >= item.startSprint && s.number < item.startSprint + item.spanSprints;
          if (!inRange) return sum;
          const a = item.assignees.find(x => x.memberId === m.id);
          return sum + (a?.daysPerSprint ?? 0);
        }, 0);
        const avail = (() => {
          try { return Math.max(0, calculateSprintCapacity(m.id, s, [], state).availableDays); }
          catch { return 0; }
        })();
        totalLoad  += load;
        totalAvail += avail;
      }
    }
    return totalAvail > 0 ? Math.round((totalLoad / totalAvail) * 100) : 0;
  }, [state, plannerItems, quarterSprints]);

  // ── Process-team table ──────────────────────────────────────────────────────

  const teamRows = useMemo((): TeamRow[] => {
    const processTeams = state.processTeams ?? [];
    if (!processTeams.length || !quarterSprints.length) return [];

    return processTeams.map(pt => {
      const members = (state.teamMembers ?? []).filter(
        m => !m.excludedFromCapacity && (m.processTeamIds ?? []).includes(pt.id),
      );

      let assignedDays = 0;
      let availDays    = 0;
      let worstPct     = 0;
      let worstSprintName = '—';

      for (const s of quarterSprints) {
        let sprintLoad  = 0;
        let sprintAvail = 0;
        for (const m of members) {
          const load = plannerItems.reduce((sum, item) => {
            const inRange = s.number >= item.startSprint && s.number < item.startSprint + item.spanSprints;
            if (!inRange) return sum;
            const a = item.assignees.find(x => x.memberId === m.id);
            return sum + (a?.daysPerSprint ?? 0);
          }, 0);
          const avail = (() => {
            try { return Math.max(0, calculateSprintCapacity(m.id, s, [], state).availableDays); }
            catch { return 0; }
          })();
          sprintLoad  += load;
          sprintAvail += avail;
        }
        assignedDays += sprintLoad;
        availDays    += sprintAvail;
        const sprintPct = sprintAvail > 0 ? Math.round((sprintLoad / sprintAvail) * 100) : (sprintLoad > 0 ? 100 : 0);
        if (sprintPct > worstPct) {
          worstPct = sprintPct;
          worstSprintName = s.name;
        }
      }

      const utilPct = availDays > 0 ? Math.round((assignedDays / availDays) * 100) : (assignedDays > 0 ? 100 : 0);

      return {
        teamId: pt.id,
        teamName: pt.name,
        memberCount: members.length,
        assignedDays,
        availDays,
        utilPct,
        worstSprintName,
        worstSprintPct: worstPct,
      };
    }).filter(r => r.memberCount > 0).sort((a, b) => b.utilPct - a.utilPct);
  }, [state, plannerItems, quarterSprints]);

  const utilAccent = avgUtil > 100 ? '#DC2626' : avgUtil > 85 ? '#EA580C' : avgUtil > 50 ? '#CA8A04' : '#16A34A';

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', height: '100%' }}>

      {/* KPI cards */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {selectedQuarter} Overview
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <KpiCard
            label="Overloaded sprints"
            value={overloadedSprints}
            sub="sprints where team total &gt;100%"
            accent={overloadedSprints > 0 ? '#DC2626' : '#16A34A'}
          />
          <KpiCard
            label="Items planned"
            value={plannerItems.length}
            sub="in this scenario"
          />
          <KpiCard
            label="Unscheduled items"
            value={unscheduled}
            sub="Jira items not in planner"
            accent={unscheduled > 0 ? '#CA8A04' : undefined}
          />
          <KpiCard
            label="Avg IT utilisation"
            value={`${avgUtil}%`}
            sub={`across ${quarterSprints.length} sprints`}
            accent={utilAccent}
          />
        </div>
      </div>

      {/* Process-team breakdown */}
      {teamRows.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Team breakdown
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 1fr 1fr 80px 1fr', padding: '8px 12px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
              {['Team', 'People', 'Assigned', 'Available', 'Util %', 'Worst sprint'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
              ))}
            </div>
            {/* Team rows */}
            {teamRows.map((row, i) => {
              const { bg, color } = tierStyle(row.utilPct);
              const isOverloaded = row.worstSprintPct > 100;
              return (
                <div
                  key={row.teamId}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 60px 1fr 1fr 80px 1fr', padding: '10px 12px', borderBottom: i < teamRows.length - 1 ? '1px solid #F1F5F9' : 'none', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isOverloaded && <AlertTriangle size={11} style={{ flexShrink: 0, color: '#EA580C' }} />}
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1E293B' }}>{row.teamName}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{row.memberCount}</div>
                  <div style={{ fontSize: 12, color: '#374151' }}>{row.assignedDays}d</div>
                  <div style={{ fontSize: 12, color: '#374151' }}>{row.availDays}d</div>
                  <div style={{ display: 'inline-flex' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, backgroundColor: bg, color }}>{row.utilPct}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: row.worstSprintPct > 100 ? '#EA580C' : '#6B7280' }}>
                    {row.worstSprintName}
                    {row.worstSprintPct > 0 && <span style={{ marginLeft: 4, color: '#9CA3AF' }}>({row.worstSprintPct}%)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {teamRows.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
          No process teams configured. Add teams in team settings to see the breakdown.
        </div>
      )}
    </div>
  );
}
