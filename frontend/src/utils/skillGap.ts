/**
 * Skill gap detection for planner items (US-SP-25).
 *
 * Computes which PlannerItems have uncovered required skills, applying:
 * - IT-only skill coverage (BIZ assignees ignored)
 * - Proximity gating (current sprint + next sprint only)
 * - Phase exclusion (UAT / Hypercare items are never flagged)
 */

import type { PlannerItem, Sprint, TeamMember, Skill } from '../types';

export interface SkillGapInfo {
  /** Skill names that no IT assignee covers. */
  missingSkills: string[];
  /** True when the item has at least one assignee (IT or BIZ). */
  hasAssignees: boolean;
}

/**
 * Determine the "current sprint number" based on today's date.
 * During a bye week, returns the next non-bye sprint after today.
 */
export function getCurrentSprintNumber(sprints: Sprint[], now: Date = new Date()): number {
  const today = now.toISOString().split('T')[0];

  for (const s of sprints) {
    if (s.isByeWeek) continue;
    if (today >= s.startDate && today <= s.endDate) return s.number;
  }

  // Today is between sprints (bye week or gap) — find the next upcoming sprint
  const upcoming = sprints
    .filter(s => !s.isByeWeek && s.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return upcoming.length > 0 ? upcoming[0].number : 1;
}

/**
 * Get the next non-bye sprint number after `currentNumber`.
 */
function getNextSprintNumber(sprints: Sprint[], currentNumber: number): number {
  const candidates = sprints
    .filter(s => !s.isByeWeek && s.number > currentNumber)
    .sort((a, b) => a.number - b.number);
  return candidates.length > 0 ? candidates[0].number : currentNumber + 1;
}

/**
 * Compute skill gaps across all planner items.
 *
 * @returns Map from item ID to gap info. Only items with gaps are included.
 */
export function computeSkillGaps(
  items: PlannerItem[],
  teamMembers: TeamMember[],
  skills: Skill[],
  sprints: Sprint[],
  now?: Date,
): Map<string, SkillGapInfo> {
  const currentSprint = getCurrentSprintNumber(sprints, now);
  const nextSprint = getNextSprintNumber(sprints, currentSprint);
  const memberMap = new Map(teamMembers.map(m => [m.id, m]));
  const skillNameMap = new Map(skills.map(s => [s.id, s.name]));

  const gaps = new Map<string, SkillGapInfo>();

  for (const item of items) {
    // Phase items excluded
    if (item.type === 'uat' || item.type === 'hypercare') continue;
    // No required skills → no gap possible
    if (!item.requiredSkillIds || item.requiredSkillIds.length === 0) continue;

    // Proximity gate: item must overlap current or next sprint
    const itemEnd = item.startSprint + item.spanSprints - 1;
    const inProximity =
      (item.startSprint <= currentSprint && itemEnd >= currentSprint) ||
      (item.startSprint <= nextSprint && itemEnd >= nextSprint);
    if (!inProximity) continue;

    // Collect all skill IDs covered by IT assignees
    const coveredSkillIds = new Set<string>();
    const itAssignees = item.assignees.filter(a => a.track === 'IT');
    for (const a of itAssignees) {
      const member = memberMap.get(a.memberId);
      if (member) {
        for (const sid of member.skillIds) coveredSkillIds.add(sid);
      }
    }

    const missing = item.requiredSkillIds.filter(sid => !coveredSkillIds.has(sid));
    if (missing.length > 0) {
      gaps.set(item.id, {
        missingSkills: missing.map(sid => skillNameMap.get(sid) ?? sid),
        hasAssignees: item.assignees.length > 0,
      });
    }
  }

  return gaps;
}

/**
 * Compute rollup skill gaps for collapsed parent items.
 *
 * @returns Map from parent item ID to list of child names that have skill gaps.
 */
export function computeRollupGaps(
  items: PlannerItem[],
  itemGaps: Map<string, SkillGapInfo>,
  collapsedIds: Set<string>,
): Map<string, string[]> {
  const rollups = new Map<string, string[]>();

  for (const item of items) {
    if (!item.parentKey) continue;
    if (!itemGaps.has(item.id)) continue;

    // Find the parent in the items list
    const parent = items.find(i => i.jiraKey === item.parentKey);
    if (!parent) continue;
    if (!collapsedIds.has(parent.id)) continue;

    const existing = rollups.get(parent.id) ?? [];
    existing.push(item.name);
    rollups.set(parent.id, existing);
  }

  return rollups;
}
