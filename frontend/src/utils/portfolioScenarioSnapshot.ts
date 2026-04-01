import type { JiraWorkItem } from '../types';

function mergeCatalogs(
  preferredCatalog: JiraWorkItem[],
  fallbackCatalog: JiraWorkItem[],
): JiraWorkItem[] {
  const byKey = new Map<string, JiraWorkItem>();

  for (const item of fallbackCatalog) {
    byKey.set(item.jiraKey, item);
  }
  for (const item of preferredCatalog) {
    byKey.set(item.jiraKey, item);
  }

  return [...byKey.values()];
}

/**
 * Builds the Jira catalog snapshot needed to keep a portfolio scenario stable
 * even if its source epics later disappear from Jira.
 */
export function buildPortfolioScenarioJiraSnapshot(
  boardEpicKeys: string[],
  preferredCatalog: JiraWorkItem[],
  fallbackCatalog: JiraWorkItem[] = [],
): JiraWorkItem[] {
  const selectedEpicKeys = new Set(
    boardEpicKeys.filter((key) => key && !key.startsWith('MAN-')),
  );

  if (selectedEpicKeys.size === 0) return [];

  const mergedCatalog = mergeCatalogs(preferredCatalog, fallbackCatalog);
  const itemsByKey = new Map(mergedCatalog.map((item) => [item.jiraKey, item]));

  return mergedCatalog.filter((item) => {
    const seenKeys = new Set<string>();
    let current: JiraWorkItem | undefined = item;

    while (current && !seenKeys.has(current.jiraKey)) {
      if (selectedEpicKeys.has(current.jiraKey)) return true;
      seenKeys.add(current.jiraKey);
      current = current.parentKey ? itemsByKey.get(current.parentKey) : undefined;
    }

    return false;
  });
}
