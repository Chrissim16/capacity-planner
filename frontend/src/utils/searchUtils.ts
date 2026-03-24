/**
 * Returns true if the given query matches the item's name/summary, jiraKey,
 * or any of the provided assignee display names.
 *
 * Accepts both JiraWorkItem (uses `summary`) and PlannerItem (uses `name`)
 * via a duck-typed shape so callers don't need an import of either type.
 */
export function matchesSearch(
  query: string,
  item: { summary?: string; name?: string; jiraKey?: string },
  assigneeNames?: string[],
): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const text = (item.summary ?? item.name ?? '').toLowerCase();
  const key  = (item.jiraKey ?? '').toLowerCase();

  if (text.includes(q) || key.includes(q)) return true;
  if (assigneeNames?.some(n => n.toLowerCase().includes(q))) return true;
  return false;
}
