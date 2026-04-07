import type { JiraWorkItem, JiraConnection } from '../types';

/**
 * Returns items whose connection is NOT flagged as planning-pages only.
 * Used by all non-planning views (Dashboard, Timeline, Team, Projects, Command Palette)
 * so planning-only items stay out of shared delivery surfaces.
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
