import type { ConfidenceLevel, JiraWorkItem, Settings } from '../types';

type ConfidenceSettings = Settings['confidenceLevels'];

const DEFAULT_CONFIDENCE_LEVELS: ConfidenceSettings = {
  high: 5,
  medium: 15,
  low: 25,
  defaultLevel: 'medium',
};

function getConfidenceSettings(settings?: ConfidenceSettings): ConfidenceSettings {
  return {
    ...DEFAULT_CONFIDENCE_LEVELS,
    ...(settings ?? {}),
  };
}

export function getConfidenceLabel(level: ConfidenceLevel, settings?: ConfidenceSettings): string {
  const configured = getConfidenceSettings(settings);
  const pct = configured[level];
  const title = level.charAt(0).toUpperCase() + level.slice(1);
  return `${title} (+${pct}%)`;
}

export function getConfidenceBuffer(level: ConfidenceLevel, settings?: ConfidenceSettings): number {
  const configured = getConfidenceSettings(settings);
  return configured[level] / 100;
}

/**
 * Returns forecasted days for a raw days estimate at the given confidence level.
 * forecastedDays = rawDays × (1 + buffer)
 */
export function getForecastedDays(rawDays: number, level: ConfidenceLevel, settings?: ConfidenceSettings): number {
  return Math.ceil(rawDays * (1 + getConfidenceBuffer(level, settings)));
}

/**
 * Resolves raw days from a work item.
 * Story points field is used directly as days (1 SP = 1 day).
 * Falls back to defaultDaysPerItem when no story points are set.
 */
export function getRawDays(item: JiraWorkItem, defaultDaysPerItem = 0): number {
  return item.storyPoints ?? defaultDaysPerItem;
}

export interface RollupResult {
  rawDays: number;
  forecastedDays: number;
  itemCount: number;
}

/**
 * Computes a map of jiraKey → { rawDays, forecastedDays, itemCount } for every
 * item that has children (features rolling up stories, epics rolling up features).
 *
 * Only leaf-level items (stories, tasks, bugs) contribute days to the rollup —
 * epics and features are structural and their own SP is excluded from child rollups.
 */
export function computeRollup(
  items: JiraWorkItem[],
  defaultConfidence: ConfidenceLevel,
  confidenceSettings?: ConfidenceSettings,
  defaultDaysPerItem = 0
): Map<string, RollupResult> {
  const byKey = new Map(items.map(i => [i.jiraKey, i]));
  const childrenOf = new Map<string, JiraWorkItem[]>();

  for (const item of items) {
    if (item.parentKey) {
      if (!childrenOf.has(item.parentKey)) childrenOf.set(item.parentKey, []);
      childrenOf.get(item.parentKey)!.push(item);
    }
  }

  const rollupCache = new Map<string, RollupResult>();

  function rollup(key: string): RollupResult {
    if (rollupCache.has(key)) return rollupCache.get(key)!;

    const children = childrenOf.get(key) ?? [];
    const item = byKey.get(key);

    if (children.length === 0) {
      // Leaf node — contribute own days
      const raw = item ? getRawDays(item, defaultDaysPerItem) : 0;
      const level = item?.confidenceLevel ?? defaultConfidence;
      const result: RollupResult = {
        rawDays: raw,
        forecastedDays: getForecastedDays(raw, level, confidenceSettings),
        itemCount: item ? 1 : 0,
      };
      rollupCache.set(key, result);
      return result;
    }

    // Non-leaf: sum children
    let rawDays = 0;
    let forecastedDays = 0;
    let itemCount = 0;
    for (const child of children) {
      const r = rollup(child.jiraKey);
      rawDays += r.rawDays;
      forecastedDays += r.forecastedDays;
      itemCount += r.itemCount;
    }
    const result: RollupResult = { rawDays, forecastedDays, itemCount };
    rollupCache.set(key, result);
    return result;
  }

  // Trigger rollup for all non-leaf items (epics and features)
  for (const item of items) {
    if (childrenOf.has(item.jiraKey)) {
      rollup(item.jiraKey);
    }
  }

  return rollupCache;
}
