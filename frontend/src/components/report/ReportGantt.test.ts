import { describe, it, expect } from 'vitest';
import { computeEpicBarGeometry } from './ReportGantt';
import type { PlannerItem, Sprint } from '../../types';

function makeSprints(): Sprint[] {
  return [
    { id: 's1', name: 'S1', number: 1, year: 2026, startDate: '2026-01-05', endDate: '2026-01-23', quarter: 'Q1 2026' },
    { id: 's2', name: 'S2', number: 2, year: 2026, startDate: '2026-01-26', endDate: '2026-02-13', quarter: 'Q1 2026' },
    { id: 's3', name: 'S3', number: 3, year: 2026, startDate: '2026-02-16', endDate: '2026-03-06', quarter: 'Q1 2026' },
    { id: 's4', name: 'S4', number: 4, year: 2026, startDate: '2026-03-09', endDate: '2026-03-27', quarter: 'Q1 2026' },
    { id: 's5', name: 'S5', number: 5, year: 2026, startDate: '2026-04-07', endDate: '2026-04-24', quarter: 'Q2 2026' },
    { id: 's6', name: 'S6', number: 6, year: 2026, startDate: '2026-04-27', endDate: '2026-05-15', quarter: 'Q2 2026' },
  ];
}

function makeItem(overrides: Partial<PlannerItem> = {}): PlannerItem {
  return {
    id: 'epic-1',
    sourceId: '',
    name: 'Alpha Launch',
    type: 'epic',
    jiraKey: 'PROJ-1',
    startSprint: 1,
    spanSprints: 4,
    assignees: [],
    isManual: false,
    labels: [],
    jiraAssignees: [],
    ...overrides,
  };
}

const QUARTERS = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];
const SPRINTS = makeSprints();

describe('computeEpicBarGeometry', () => {
  it('returns null when quarters is empty', () => {
    expect(computeEpicBarGeometry(makeItem(), SPRINTS, [])).toBeNull();
  });

  it('calculates full Q1 bar (sprints 1–4, 4 quarters displayed)', () => {
    const item = makeItem({ startSprint: 1, spanSprints: 4 });
    const geo = computeEpicBarGeometry(item, SPRINTS, QUARTERS);
    expect(geo).not.toBeNull();
    // Q1 is index 0: left = 0/4 * 100 = 0%, width = 1/4 * 100 = 25%
    expect(geo!.leftPct).toBe(0);
    expect(geo!.widthPct).toBe(25);
  });

  it('calculates bar spanning Q1 and Q2', () => {
    // startSprint=1 (Q1), spanSprints=5 → last sprint=5 (Q2)
    const item = makeItem({ startSprint: 1, spanSprints: 5 });
    const geo = computeEpicBarGeometry(item, SPRINTS, QUARTERS);
    expect(geo).not.toBeNull();
    // start=Q1 (idx 0), end=Q2 (idx 1) → left=0%, width=2/4*100=50%
    expect(geo!.leftPct).toBe(0);
    expect(geo!.widthPct).toBe(50);
  });

  it('calculates bar starting in Q2', () => {
    // startSprint=5 (Q2), spanSprints=2 → last sprint=6 (Q2)
    const item = makeItem({ startSprint: 5, spanSprints: 2 });
    const geo = computeEpicBarGeometry(item, SPRINTS, QUARTERS);
    expect(geo).not.toBeNull();
    // start=Q2 (idx 1), end=Q2 (idx 1) → left=1/4*100=25%, width=1/4*100=25%
    expect(geo!.leftPct).toBe(25);
    expect(geo!.widthPct).toBe(25);
  });

  it('returns null when sprint is not in any displayed quarter', () => {
    // Sprint 99 does not exist in sprints; startSprint maps to no quarter
    const item = makeItem({ startSprint: 99, spanSprints: 1 });
    const geo = computeEpicBarGeometry(item, SPRINTS, QUARTERS);
    expect(geo).toBeNull();
  });

  it('clamps to displayed range when epic extends beyond last quarter', () => {
    // Displays only Q1 2026; epic starts Q1, ends Q2 (outside range) → clamp end to Q1
    const item = makeItem({ startSprint: 1, spanSprints: 5 }); // last sprint is Q2
    const geo = computeEpicBarGeometry(item, SPRINTS, ['Q1 2026']);
    expect(geo).not.toBeNull();
    // Clamped end to index 0 → width = 1/1*100 = 100%
    expect(geo!.widthPct).toBe(100);
  });
});
