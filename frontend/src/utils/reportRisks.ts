import type { PlannerItem, JiraWorkItem } from '../types';

export interface EpicRisk {
  type: 'no-staff' | 'understaffed';
  epicKey: string;
  epicName: string;
  assignedDays: number;
  storyPoints: number | null;
}

/**
 * Derives staffing risks for all epic-level PlannerItems.
 *
 * Two risk types:
 *  - 'no-staff':    epic has zero assignees
 *  - 'understaffed': total assigned days < jira storyPoints (only when storyPoints !== null)
 *
 * Both IT and BIZ assignees count toward assigned days (dual-track rule).
 */
export function getEpicStaffingRisks(
  plannerItems: PlannerItem[],
  jiraItems: JiraWorkItem[],
): EpicRisk[] {
  const risks: EpicRisk[] = [];

  const jiraByKey = new Map<string, JiraWorkItem>();
  for (const item of jiraItems) {
    jiraByKey.set(item.jiraKey, item);
  }

  for (const item of plannerItems) {
    if (item.type !== 'epic') continue;

    const assignedDays = item.assignees.reduce(
      (sum, a) => sum + a.daysPerSprint * item.spanSprints,
      0,
    );

    const jiraItem = item.jiraKey ? jiraByKey.get(item.jiraKey) : undefined;
    const storyPoints = jiraItem?.storyPoints ?? null;

    if (item.assignees.length === 0) {
      risks.push({
        type: 'no-staff',
        epicKey: item.jiraKey ?? item.id,
        epicName: item.name,
        assignedDays: 0,
        storyPoints,
      });
    } else if (storyPoints !== null && assignedDays < storyPoints) {
      risks.push({
        type: 'understaffed',
        epicKey: item.jiraKey ?? item.id,
        epicName: item.name,
        assignedDays,
        storyPoints,
      });
    }
  }

  return risks;
}
