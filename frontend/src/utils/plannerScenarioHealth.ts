/**
 * Home-screen health metrics for a scenario — mirrors PlannerCapacity team totals
 * (per-sprint load vs availability) and uses calculateCapacity() for IT availability.
 */
import type { AppState, PlannerItem, Sprint } from '../types';
import { calculateCapacity } from './capacity';

const SPRINT_COUNT = 6;

interface CellData {
  load: number;
  avail: number;
}

function computeLoadDays(memberId: string, sprintNumber: number, items: PlannerItem[]): number {
  let load = 0;
  for (const item of items) {
    const inRange =
      sprintNumber >= item.startSprint && sprintNumber < item.startSprint + item.spanSprints;
    if (!inRange) continue;
    for (const a of item.assignees) {
      if (a.memberId === memberId) load += a.daysPerSprint;
    }
  }
  return load;
}

function pctFromCell(cell: CellData): number {
  return cell.avail > 0 ? Math.round((cell.load / cell.avail) * 100) : cell.load > 0 ? 100 : 0;
}

/** Team total row for one quarter — same aggregation as PlannerCapacity `teamTotals`. */
function teamTotalsForQuarter(
  plannerItems: PlannerItem[],
  state: AppState,
  sprints: Sprint[],
  quarter: string,
): CellData[] {
  const quarterSprints = sprints.filter(s => s.quarter === quarter).slice(0, SPRINT_COUNT);
  const n = quarterSprints.length || 1;

  const memberCells = (state.teamMembers ?? [])
    .filter(m => !m.excludedFromCapacity)
    .map(m => {
      let quarterAvail = 0;
      try {
        const cap = calculateCapacity(m.id, quarter, state);
        const fixedUsed = cap.breakdown
          .filter(b => b.type === 'bau' || b.type === 'timeoff')
          .reduce((sum, b) => sum + b.days, 0);
        quarterAvail = Math.max(0, cap.totalWorkdays - fixedUsed);
      } catch {
        quarterAvail = 0;
      }
      const perSprintAvail = Math.round(quarterAvail / n);
      return quarterSprints.map(s => ({
        load: computeLoadDays(m.id, s.number, plannerItems),
        avail: perSprintAvail,
      }));
    });

  const contactCells = (state.businessContacts ?? [])
    .filter(c => !c.archived && !c.excludedFromCapacity)
    .map(c => {
      const scale = (c.workingDaysPerWeek ?? 5) / 5;
      const bauPerSprint = Math.round((c.bauReserveDays ?? 5) / 6);
      const perSprintAvail = Math.max(0, Math.round(10 * scale) - bauPerSprint);
      return quarterSprints.map(s => ({
        load: computeLoadDays(c.id, s.number, plannerItems),
        avail: perSprintAvail,
      }));
    });

  const allRows = [...memberCells, ...contactCells];

  return quarterSprints.map((_, idx) => ({
    load: allRows.reduce((s, row) => s + (row[idx]?.load ?? 0), 0),
    avail: allRows.reduce((s, row) => s + (row[idx]?.avail ?? 0), 0),
  }));
}

/** Merges scenario snapshot fields into baseline app data for capacity helpers. */
export function appStateForScenario(base: AppState, scenario: AppState['scenarios'][number]): AppState {
  return {
    ...base,
    jiraWorkItems: scenario.jiraWorkItems,
    jiraItemBizAssignments: scenario.jiraItemBizAssignments,
    teamMembers: scenario.teamMembers,
    timeOff: scenario.timeOff,
    projects: scenario.projects ?? [],
    assignments: scenario.assignments ?? [],
  };
}

/**
 * Counts sprint columns (across all quarters in `sprints`) where team total allocation exceeds 100%.
 */
export function countOverloadedTeamSprints(
  plannerItems: PlannerItem[],
  state: AppState,
  sprints: Sprint[],
): number {
  const quarters = [...new Set(sprints.map(s => s.quarter))];
  let count = 0;
  for (const q of quarters) {
    const totals = teamTotalsForQuarter(plannerItems, state, sprints, q);
    for (const cell of totals) {
      if (pctFromCell(cell) > 100) count++;
    }
  }
  return count;
}

/**
 * Active Jira items not represented by any PlannerItem.sourceId in the layout.
 */
export function countUnscheduledJiraItems(plannerItems: PlannerItem[], state: AppState): number {
  const scheduled = new Set(
    plannerItems.map(p => p.sourceId).filter((id): id is string => Boolean(id)),
  );
  return state.jiraWorkItems.filter(
    j => j.statusCategory !== 'done' && !scheduled.has(j.id),
  ).length;
}
