/**
 * plannerInit.ts — SP-05 Baseline initialization helpers.
 *
 * Converts a scenario's Jira work items into PlannerItem records by mapping
 * each item's Jira sprint / start date to the app's known sprint list.
 *
 * Positioning priority (per SP-05 AC #1):
 *   1. sprintName  →  normalized match to Sprint.name, use sprint.number
 *   2. sprintStartDate  →  Jira sprint window contained in app Sprint dates
 *   3. startDate (+ dueDate)  →  map issue startDate to sprint window / nearest
 *   4. Neither  →  return null (item stays in backlog)
 *
 * Default spans when explicit end data is absent:
 *   Epic → 6 sprints (1 quarter), Feature → 2 sprints, Story/other → 1 sprint
 */
import type { JiraWorkItem, PlannerItem, PlannerItemType, Sprint } from '../types';
import { generateId } from '../stores/actions';

const DEFAULT_SPANS: Record<string, number> = {
  epic:    6,
  feature: 2,
};
function defaultSpan(type: string): number {
  return DEFAULT_SPANS[type] ?? 1;
}

/**
 * Maps a JiraWorkItem to a { startSprint, spanSprints } position using the
 * given sprint list. Returns null if no position can be determined.
 */
export function baselinePositionForItem(
  item: JiraWorkItem,
  sprints: Sprint[],
): { startSprint: number; spanSprints: number } | null {
  const sortedSprints = [...sprints].sort((a, b) => a.number - b.number);
  const normalizeSprintName = (n: string) =>
    n.trim().toLowerCase().replace(/\s+/g, '');

  // ── Path 1: sprint name match ────────────────────────────────────────────
  if (item.sprintName) {
    const target = normalizeSprintName(item.sprintName);
    const found = sortedSprints.find(s => normalizeSprintName(s.name) === target);
    if (found) {
      let spanSprints = defaultSpan(item.type);
      // If the item also has a dueDate, try to extend the span
      if (item.startDate && item.dueDate) {
        const start = new Date(item.startDate).getTime();
        const end   = new Date(item.dueDate).getTime();
        const days  = (end - start) / (1000 * 60 * 60 * 24);
        spanSprints = Math.max(1, Math.ceil(days / 14));
      }
      return { startSprint: found.number, spanSprints };
    }
  }

  // ── Path 2: Jira sprint start date falls inside an app Sprint window ─────
  if (item.sprintStartDate) {
    const jiraSprintStart = new Date(item.sprintStartDate).getTime();
    if (!Number.isNaN(jiraSprintStart)) {
      for (const s of sortedSprints) {
        if (!s.startDate || !s.endDate) continue;
        const sStart = new Date(s.startDate).getTime();
        const sEnd   = new Date(s.endDate).getTime();
        if (Number.isNaN(sStart) || Number.isNaN(sEnd)) continue;
        if (jiraSprintStart >= sStart && jiraSprintStart <= sEnd) {
          let spanSprints = defaultSpan(item.type);
          if (item.startDate && item.dueDate) {
            const start = new Date(item.startDate).getTime();
            const end   = new Date(item.dueDate).getTime();
            const days  = (end - start) / (1000 * 60 * 60 * 24);
            spanSprints = Math.max(1, Math.ceil(days / 14));
          }
          return { startSprint: s.number, spanSprints };
        }
      }
    }
  }

  // ── Path 3: issue startDate → sprint window / nearest ────────────────────
  if (item.startDate) {
    const itemStart = new Date(item.startDate).getTime();
    // Find the sprint whose window contains the start date, or the nearest one after it
    let bestSprint: Sprint | null = null;
    for (const s of sortedSprints) {
      if (!s.startDate || !s.endDate) continue;
      const sStart = new Date(s.startDate).getTime();
      const sEnd   = new Date(s.endDate).getTime();
      if (itemStart >= sStart && itemStart <= sEnd) {
        bestSprint = s;
        break;
      }
      if (itemStart < sStart && !bestSprint) {
        bestSprint = s; // first sprint that starts after item start
      }
    }
    if (!bestSprint) return null;

    let spanSprints = defaultSpan(item.type);
    if (item.dueDate) {
      const start = new Date(item.startDate).getTime();
      const end   = new Date(item.dueDate).getTime();
      const days  = (end - start) / (1000 * 60 * 60 * 24);
      spanSprints = Math.max(1, Math.ceil(days / 14));
    }
    return { startSprint: bestSprint.number, spanSprints };
  }

  return null;
}

/**
 * Builds a full PlannerItem[] baseline from a set of Jira work items.
 * Items that cannot be positioned are omitted (they remain in the backlog).
 * Returns both the placed items and the count of items left unpositioned.
 */
export function buildBaselineLayout(
  jiraItems: JiraWorkItem[],
  sprints: Sprint[],
): { items: PlannerItem[]; placedCount: number; unscheduledCount: number } {
  const active = jiraItems.filter(i => i.statusCategory !== 'done');
  const items: PlannerItem[] = [];
  let unscheduledCount = 0;

  for (const ji of active) {
    const pos = baselinePositionForItem(ji, sprints);
    if (!pos) {
      unscheduledCount++;
      continue;
    }
    items.push({
      id:                generateId('planner'),
      sourceId:          ji.id,
      name:              ji.summary,
      type:              ji.type as PlannerItemType,
      jiraKey:           ji.jiraKey,
      parentKey:         ji.parentKey,
      startSprint:       pos.startSprint,
      spanSprints:       pos.spanSprints,
      assignees:         [],
      locked:            ji.statusCategory === 'in_progress',
      unlockedInScenario: false,
      isManual:          false,
      labels:            ji.labels ?? [],
      jiraAssignees:     ji.assigneeName ? [ji.assigneeName] : [],
      jiraStartDate:     ji.startDate,
      jiraEndDate:       ji.dueDate,
    });
  }

  return { items, placedCount: items.length, unscheduledCount };
}
