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
import type {
  JiraWorkItem,
  PlannerItem,
  PlannerItemType,
  PlannerAssignment,
  Sprint,
  TeamMember,
  JiraItemBizAssignment,
} from '../types';
import { generateId } from '../stores/actions';

/**
 * Derives the initial PlannerAssignment list for a new PlannerItem by
 * consulting two existing data sources:
 *   • IT track  — matches the Jira assigneeName against teamMembers by name
 *   • BIZ track — finds every jiraItemBizAssignment whose jiraKey matches
 *
 * daysPerSprint defaults to 2 for every resolved assignment (same default
 * used by AssignPanel when a person is first added manually).
 */
export function resolveItemAssignees(
  ji: Pick<JiraWorkItem, 'assigneeName' | 'jiraKey'>,
  teamMembers: TeamMember[],
  jiraItemBizAssignments: JiraItemBizAssignment[],
): PlannerAssignment[] {
  const assignees: PlannerAssignment[] = [];

  if (ji.assigneeName) {
    const needle = ji.assigneeName.trim().toLowerCase();
    const member = teamMembers.find(m => m.name.trim().toLowerCase() === needle);
    if (member) {
      assignees.push({ memberId: member.id, track: 'IT', daysPerSprint: 2 });
    }
  }

  if (ji.jiraKey) {
    for (const biz of jiraItemBizAssignments) {
      if (biz.jiraKey === ji.jiraKey) {
        assignees.push({ memberId: biz.contactId, track: 'BIZ', daysPerSprint: 2 });
      }
    }
  }

  return assignees;
}

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
 *
 * After the initial sprint-data pass, a second pass walks each placed item's
 * ancestor chain and auto-places any missing parents at the child's sprint
 * position. This prevents stories (or features) whose parent was not assigned
 * a sprint in Jira from appearing as "Unlinked items" on the timeline.
 *
 * When teamMembers and jiraItemBizAssignments are supplied, each PlannerItem's
 * assignees field is pre-populated from existing Jira/BIZ assignments so the
 * timeline immediately reflects assignments already visible in the Epics view.
 */
export function buildBaselineLayout(
  jiraItems: JiraWorkItem[],
  sprints: Sprint[],
  teamMembers: TeamMember[] = [],
  jiraItemBizAssignments: JiraItemBizAssignment[] = [],
): { items: PlannerItem[]; placedCount: number; unscheduledCount: number } {
  // Lookup map for fast parent resolution (all items, not just active)
  const jiraByKey = new Map(jiraItems.map(i => [i.jiraKey, i]));

  const active = jiraItems.filter(i => i.statusCategory !== 'done');
  const items: PlannerItem[] = [];

  // Track which jiraKeys are already on the timeline (by key, not internal id)
  const positionedKeys = new Set<string>();

  // ── Pass 1: place items that have their own sprint / date data ─────────────
  for (const ji of active) {
    const pos = baselinePositionForItem(ji, sprints);
    if (!pos) continue;
    positionedKeys.add(ji.jiraKey);
    items.push({
      id:                generateId('planner'),
      sourceId:          ji.id,
      name:              ji.summary,
      type:              ji.type as PlannerItemType,
      jiraKey:           ji.jiraKey,
      parentKey:         ji.parentKey,
      startSprint:       pos.startSprint,
      spanSprints:       pos.spanSprints,
      assignees:         resolveItemAssignees(ji, teamMembers, jiraItemBizAssignments),
      isManual:          false,
      labels:            ji.labels ?? [],
      jiraAssignees:     ji.assigneeName ? [ji.assigneeName] : [],
      jiraStartDate:     ji.startDate,
      jiraEndDate:       ji.dueDate,
      requiredSkillIds:  [],
    });
  }

  // ── Pass 2: auto-place missing ancestors ───────────────────────────────────
  // Iterate until stable: each round may expose a grandparent that was not yet
  // visible (e.g. story placed → feature added → epic still missing).
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...items]) {
      if (!item.parentKey || positionedKeys.has(item.parentKey)) continue;
      const parent = jiraByKey.get(item.parentKey);
      if (!parent) continue;
      // Auto-place the ancestor at the earliest child sprint it is needed for
      positionedKeys.add(parent.jiraKey);
      items.push({
        id:                generateId('planner'),
        sourceId:          parent.id,
        name:              parent.summary,
        type:              parent.type as PlannerItemType,
        jiraKey:           parent.jiraKey,
        parentKey:         parent.parentKey,
        startSprint:       item.startSprint,
        spanSprints:       defaultSpan(parent.type),
        assignees:         resolveItemAssignees(parent, teamMembers, jiraItemBizAssignments),
        isManual:          false,
        labels:            parent.labels ?? [],
        jiraAssignees:     parent.assigneeName ? [parent.assigneeName] : [],
        jiraStartDate:     parent.startDate,
        jiraEndDate:       parent.dueDate,
        requiredSkillIds:  [],
      });
      changed = true;
    }
  }

  // Items not placed by either pass remain in the backlog
  const unscheduledCount = active.filter(ji => !positionedKeys.has(ji.jiraKey)).length;

  return { items, placedCount: items.length, unscheduledCount };
}
