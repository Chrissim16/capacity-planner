import { describe, it, expect } from 'vitest';
import { getConfidenceLabel, getConfidenceBuffer, getForecastedDays, computeRollup } from './confidence';
import type { JiraWorkItem } from '../types';

const DEFAULT_SETTINGS = { high: 5, medium: 15, low: 25, defaultLevel: 'medium' as const };

// ── getConfidenceLabel ────────────────────────────────────────────────────────

describe('getConfidenceLabel', () => {
  it('formats high correctly', () => {
    expect(getConfidenceLabel('high', DEFAULT_SETTINGS)).toBe('High (+5%)');
  });
  it('formats medium correctly', () => {
    expect(getConfidenceLabel('medium', DEFAULT_SETTINGS)).toBe('Medium (+15%)');
  });
  it('formats low correctly', () => {
    expect(getConfidenceLabel('low', DEFAULT_SETTINGS)).toBe('Low (+25%)');
  });
  it('uses default settings when none provided', () => {
    expect(getConfidenceLabel('high')).toBe('High (+5%)');
  });
});

// ── getConfidenceBuffer ───────────────────────────────────────────────────────

describe('getConfidenceBuffer', () => {
  it('returns 0.05 for high', () => {
    expect(getConfidenceBuffer('high', DEFAULT_SETTINGS)).toBeCloseTo(0.05);
  });
  it('returns 0.15 for medium', () => {
    expect(getConfidenceBuffer('medium', DEFAULT_SETTINGS)).toBeCloseTo(0.15);
  });
  it('returns 0.25 for low', () => {
    expect(getConfidenceBuffer('low', DEFAULT_SETTINGS)).toBeCloseTo(0.25);
  });
});

// ── getForecastedDays ─────────────────────────────────────────────────────────

describe('getForecastedDays', () => {
  it('applies 5% buffer for high confidence (10 days → 11)', () => {
    expect(getForecastedDays(10, 'high', DEFAULT_SETTINGS)).toBe(11);
  });
  it('applies 15% buffer for medium confidence (10 days → 12)', () => {
    // 10 × 1.15 = 11.5 → ceil = 12
    expect(getForecastedDays(10, 'medium', DEFAULT_SETTINGS)).toBe(12);
  });
  it('applies 25% buffer for low confidence (10 days → 13)', () => {
    // 10 × 1.25 = 12.5 → ceil = 13
    expect(getForecastedDays(10, 'low', DEFAULT_SETTINGS)).toBe(13);
  });
  it('returns 0 for 0 raw days', () => {
    expect(getForecastedDays(0, 'low', DEFAULT_SETTINGS)).toBe(0);
  });
  it('rounds up (ceil) not down', () => {
    // 1 × 1.05 = 1.05 → ceil = 2
    expect(getForecastedDays(1, 'high', DEFAULT_SETTINGS)).toBe(2);
  });
});

// ── computeRollup ─────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<JiraWorkItem>): JiraWorkItem {
  return {
    id: overrides.jiraKey ?? 'ITEM-1',
    jiraId: overrides.jiraKey ?? 'ITEM-1',
    jiraKey: overrides.jiraKey ?? 'ITEM-1',
    summary: 'Test item',
    type: 'Story',
    status: 'In Progress',
    statusCategory: 'inprogress',
    priority: 'Medium',
    parentKey: undefined,
    storyPoints: undefined,
    assigneeEmail: undefined,
    assigneeName: undefined,
    sprintName: undefined,
    sprintStartDate: undefined,
    sprintEndDate: undefined,
    startDate: undefined,
    dueDate: undefined,
    labels: [],
    components: [],
    confidenceLevel: undefined,
    mappedProjectId: undefined,
    mappedPhaseId: undefined,
    archived: false,
    ...overrides,
  };
}

describe('computeRollup', () => {
  it('returns empty map for empty items list', () => {
    expect(computeRollup([], 'medium', DEFAULT_SETTINGS).size).toBe(0);
  });

  it('rolls up story points from children to parent', () => {
    const epic = makeItem({ jiraKey: 'EPIC-1', type: 'Epic', storyPoints: undefined });
    const story1 = makeItem({ jiraKey: 'STORY-1', type: 'Story', parentKey: 'EPIC-1', storyPoints: 5 });
    const story2 = makeItem({ jiraKey: 'STORY-2', type: 'Story', parentKey: 'EPIC-1', storyPoints: 3 });

    const rollup = computeRollup([epic, story1, story2], 'medium', DEFAULT_SETTINGS);

    const epicResult = rollup.get('EPIC-1');
    expect(epicResult).toBeDefined();
    expect(epicResult!.rawDays).toBe(8); // 5 + 3
    expect(epicResult!.itemCount).toBe(2);
  });

  it('applies confidence buffer in forecastedDays', () => {
    const epic = makeItem({ jiraKey: 'EPIC-1', type: 'Epic' });
    const story = makeItem({ jiraKey: 'STORY-1', type: 'Story', parentKey: 'EPIC-1', storyPoints: 10 });

    const rollup = computeRollup([epic, story], 'medium', DEFAULT_SETTINGS);
    const epicResult = rollup.get('EPIC-1')!;

    // 10 × 1.15 = 11.5 → ceil = 12
    expect(epicResult.forecastedDays).toBe(12);
  });

  it('handles two-level hierarchy (epic → feature → story)', () => {
    const epic = makeItem({ jiraKey: 'EPIC-1', type: 'Epic' });
    const feature = makeItem({ jiraKey: 'FEAT-1', type: 'Feature', parentKey: 'EPIC-1' });
    const story = makeItem({ jiraKey: 'STORY-1', type: 'Story', parentKey: 'FEAT-1', storyPoints: 4 });

    const rollup = computeRollup([epic, feature, story], 'high', DEFAULT_SETTINGS);

    expect(rollup.get('FEAT-1')!.rawDays).toBe(4);
    expect(rollup.get('EPIC-1')!.rawDays).toBe(4);
  });

  it('cascades epic confidence to child stories without their own level', () => {
    // Epic has 'high' confidence set; its stories have none → should inherit 'high'
    const epic = makeItem({ jiraKey: 'EPIC-1', type: 'Epic', confidenceLevel: 'high' });
    const story = makeItem({ jiraKey: 'STORY-1', type: 'Story', parentKey: 'EPIC-1', storyPoints: 10 });

    // Global default is 'low' — should NOT be used because ancestor sets 'high'
    const rollup = computeRollup([epic, story], 'low', DEFAULT_SETTINGS);

    // 10 × 1.05 = 10.5 → ceil = 11  (high buffer, not low 25%)
    expect(rollup.get('EPIC-1')!.forecastedDays).toBe(11);
  });

  it('cascades feature confidence to child stories, overriding the global default', () => {
    const epic = makeItem({ jiraKey: 'EPIC-1', type: 'Epic' });
    const feature = makeItem({ jiraKey: 'FEAT-1', type: 'Feature', parentKey: 'EPIC-1', confidenceLevel: 'low' });
    const story = makeItem({ jiraKey: 'STORY-1', type: 'Story', parentKey: 'FEAT-1', storyPoints: 10 });

    // Global default is 'high' — feature sets 'low', so story should use 'low'
    const rollup = computeRollup([epic, feature, story], 'high', DEFAULT_SETTINGS);

    // 10 × 1.25 = 12.5 → ceil = 13  (low buffer)
    expect(rollup.get('FEAT-1')!.forecastedDays).toBe(13);
    expect(rollup.get('EPIC-1')!.forecastedDays).toBe(13);
  });

  it("story's own confidence level takes precedence over parent epic's", () => {
    const epic = makeItem({ jiraKey: 'EPIC-1', type: 'Epic', confidenceLevel: 'low' });
    const story = makeItem({ jiraKey: 'STORY-1', type: 'Story', parentKey: 'EPIC-1', storyPoints: 10, confidenceLevel: 'high' });

    const rollup = computeRollup([epic, story], 'medium', DEFAULT_SETTINGS);

    // Story's own 'high' wins over epic's 'low': 10 × 1.05 = 10.5 → ceil = 11
    expect(rollup.get('EPIC-1')!.forecastedDays).toBe(11);
  });
});
