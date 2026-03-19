import type { PlannerItem } from '../types';

/**
 * Normalises a PlannerItem that may have been persisted before the v2 data
 * model extension. Fills any missing fields with safe defaults so downstream
 * code can always rely on the full interface shape without null-guards.
 *
 * Call this once when reading plannerLayout out of the scenario snapshot,
 * not in hot render paths.
 */
export function migratePlannerItem(raw: Partial<PlannerItem>): PlannerItem {
  return {
    id:                raw.id                ?? '',
    sourceId:          raw.sourceId          ?? '',
    name:              raw.name              ?? '',
    type:              raw.type              ?? 'story',
    jiraKey:           raw.jiraKey,
    parentKey:         raw.parentKey,
    startSprint:       raw.startSprint       ?? 1,
    spanSprints:       raw.spanSprints       ?? 1,
    assignees:         raw.assignees         ?? [],
    locked:            raw.locked            ?? false,
    unlockedInScenario: raw.unlockedInScenario ?? false,
    isManual:          raw.isManual          ?? false,
    labels:            raw.labels            ?? [],
    jiraAssignees:     raw.jiraAssignees     ?? [],
    jiraStartDate:     raw.jiraStartDate,
    jiraEndDate:       raw.jiraEndDate,
  };
}

/** Convenience wrapper for migrating an entire plannerLayout array. */
export function migratePlannerLayout(items: Partial<PlannerItem>[]): PlannerItem[] {
  return items.map(migratePlannerItem);
}
