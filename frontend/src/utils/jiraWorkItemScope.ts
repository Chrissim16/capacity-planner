import type { JiraWorkItem, JiraConnection } from '../types';

/**
 * Returns items whose connection is NOT flagged as Scenario Planner only.
 * Used by all non-planner views (Dashboard, Timeline, Team, Projects, Command Palette)
 * so Discovery board items stay out of delivery-focused surfaces.
 */
export function globalJiraWorkItems(
  items: JiraWorkItem[],
  connections: JiraConnection[],
): JiraWorkItem[] {
  const plannerOnlyIds = new Set(
    connections.filter(c => c.scenarioPlannerOnly).map(c => c.id),
  );
  if (plannerOnlyIds.size === 0) return items;
  return items.filter(i => !plannerOnlyIds.has(i.connectionId));
}
