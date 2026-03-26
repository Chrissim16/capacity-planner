/**
 * Skill inheritance for JiraWorkItems (F-SK-01).
 *
 * requiredSkillIds on JiraWorkItem uses three-state semantics:
 *   null / undefined  →  inherit from nearest ancestor with skills
 *   []                →  explicitly no required skills (overrides inheritance)
 *   [...ids]          →  explicitly set skills
 *
 * Inheritance is resolved at read time by walking up the parentKey chain.
 */

import type { JiraWorkItem } from '../types';

/**
 * Returns the effective required skill IDs for a work item, resolving
 * inheritance from ancestor epics when the item has no explicit skills set.
 *
 * @param item     The work item to resolve skills for.
 * @param allItems All work items (used to walk the parent hierarchy).
 * @returns        Array of resolved skill IDs (never null/undefined).
 */
export function getEffectiveSkills(
  item: JiraWorkItem,
  allItems: JiraWorkItem[],
): string[] {
  // Explicit skills (including explicit empty array) — use them directly
  if (item.requiredSkillIds != null) {
    return item.requiredSkillIds;
  }

  // Walk up the hierarchy to find the nearest ancestor with explicit skills
  const itemsByKey = new Map(allItems.map(i => [i.jiraKey, i]));
  let current: JiraWorkItem | undefined = item;

  while (current?.parentKey) {
    const parent = itemsByKey.get(current.parentKey);
    if (!parent) break;
    if (parent.requiredSkillIds != null) {
      return parent.requiredSkillIds;
    }
    current = parent;
  }

  return [];
}

/**
 * Returns true when the item's skills are inherited from an ancestor
 * rather than explicitly set on the item itself.
 */
export function isSkillInherited(item: JiraWorkItem): boolean {
  return item.requiredSkillIds == null;
}
