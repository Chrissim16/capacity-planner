/**
 * Tests for the Portfolio Planning geometry utilities introduced in migration 040:
 *   - phaseBarWidthDays    — explicit start/end → working-day bar width
 *   - weeksBetween         — calendar-week count between two ISO dates
 *   - totalDaysFromAssignment — mode-aware effort total (flat / rate / segments)
 *
 * Also covers the legacy calcBarWidthDays fallback so regressions are caught.
 */

import { describe, it, expect } from 'vitest';
import {
  phaseBarWidthDays,
  weeksBetween,
  totalDaysFromAssignment,
  calcBarWidthDays,
} from './portfolioGeometry';
import type { EpicPhasePlan, EpicPhaseAssignment, AllocationSegment } from '../types';

// ── Factories ──────────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<EpicPhasePlan> = {}): EpicPhasePlan {
  return {
    id: 'plan-1',
    epicKey: 'TEST-1',
    phase: 'design',
    startDate: null,
    endDate: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<EpicPhaseAssignment> = {}): EpicPhaseAssignment {
  return {
    id: 'assign-1',
    epicKey: 'TEST-1',
    phase: 'design',
    memberId: 'member-1',
    track: 'IT',
    days: 5,
    allocationMode: 'flat',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSegment(overrides: Partial<AllocationSegment> = {}): AllocationSegment {
  return {
    id: 'seg-1',
    startDate: '2026-01-06',
    endDate: '2026-01-09',
    days: 2,
    ...overrides,
  };
}

/**
 * A fixed Monday used as the timeline origin (tStart) in all phaseBarWidthDays tests.
 * 2026-01-05 is a Monday.
 */
const T_START = new Date('2026-01-05');

// ─────────────────────────────────────────────────────────────────────────────
// weeksBetween
// ─────────────────────────────────────────────────────────────────────────────

describe('weeksBetween', () => {
  it('returns 1 for exactly 7 days apart', () => {
    expect(weeksBetween('2026-01-05', '2026-01-12')).toBe(1);
  });

  it('returns 2 for exactly 14 days apart', () => {
    expect(weeksBetween('2026-01-05', '2026-01-19')).toBe(2);
  });

  it('returns 5 for exactly 35 days apart', () => {
    expect(weeksBetween('2026-01-05', '2026-02-09')).toBe(5);
  });

  it('rounds to nearest whole week', () => {
    // 10 days = 1.43 weeks → rounds to 1
    expect(weeksBetween('2026-01-05', '2026-01-15')).toBe(1);
    // 11 days = 1.57 weeks → rounds to 2
    expect(weeksBetween('2026-01-05', '2026-01-16')).toBe(2);
  });

  it('returns minimum of 1 for same-day start and end', () => {
    expect(weeksBetween('2026-01-05', '2026-01-05')).toBe(1);
  });

  it('returns minimum of 1 when end is before start', () => {
    expect(weeksBetween('2026-01-12', '2026-01-05')).toBe(1);
  });

  it('handles month and year boundaries correctly', () => {
    // Jan 5 → Apr 6 = 90 days = ~12.86 weeks → 13
    expect(weeksBetween('2026-01-05', '2026-04-06')).toBe(13);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phaseBarWidthDays
// ─────────────────────────────────────────────────────────────────────────────

describe('phaseBarWidthDays', () => {
  it('returns null when startDate is missing', () => {
    const plan = makePlan({ endDate: '2026-01-19' });
    expect(phaseBarWidthDays(plan, T_START)).toBeNull();
  });

  it('returns null when endDate is missing', () => {
    const plan = makePlan({ startDate: '2026-01-05' });
    expect(phaseBarWidthDays(plan, T_START)).toBeNull();
  });

  it('returns null when both dates are missing', () => {
    const plan = makePlan();
    expect(phaseBarWidthDays(plan, T_START)).toBeNull();
  });

  it('returns working-day span for a 2-week phase', () => {
    // 2026-01-05 → 2026-01-19 = 14 calendar days ≈ 10 working days
    const plan = makePlan({ startDate: '2026-01-05', endDate: '2026-01-19' });
    expect(phaseBarWidthDays(plan, T_START)).toBe(10);
  });

  it('returns working-day span for a 5-week phase', () => {
    // 2026-01-05 → 2026-02-09 = 35 calendar days ≈ 25 working days
    const plan = makePlan({ startDate: '2026-01-05', endDate: '2026-02-09' });
    expect(phaseBarWidthDays(plan, T_START)).toBe(25);
  });

  it('returns minimum of 1 when end equals start', () => {
    const plan = makePlan({ startDate: '2026-01-05', endDate: '2026-01-05' });
    expect(phaseBarWidthDays(plan, T_START)).toBe(1);
  });

  it('returns minimum of 1 when end is before start', () => {
    const plan = makePlan({ startDate: '2026-01-12', endDate: '2026-01-05' });
    expect(phaseBarWidthDays(plan, T_START)).toBe(1);
  });

  it('handles phase starting before tStart (negative offset)', () => {
    // Phase starts 7 calendar days before tStart → start offset is negative
    // but the width (end - start) is still positive
    const plan = makePlan({ startDate: '2025-12-29', endDate: '2026-01-12' });
    const width = phaseBarWidthDays(plan, T_START);
    expect(width).not.toBeNull();
    expect(width!).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// totalDaysFromAssignment — flat mode
// ─────────────────────────────────────────────────────────────────────────────

describe('totalDaysFromAssignment — flat mode', () => {
  it('returns assignment.days for a flat allocation', () => {
    const a = makeAssignment({ days: 7, allocationMode: 'flat' });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(7);
  });

  it('ignores phase dates for flat mode', () => {
    const a = makeAssignment({ days: 3, allocationMode: 'flat' });
    expect(totalDaysFromAssignment(a, null, null)).toBe(3);
  });

  it('ignores segments for flat mode (segments field is irrelevant)', () => {
    const a = makeAssignment({
      days: 4,
      allocationMode: 'flat',
      segments: [makeSegment({ days: 10 }), makeSegment({ id: 'seg-2', days: 6 })],
    });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-01-19')).toBe(4);
  });

  it('returns 0 days when assignment.days is 0', () => {
    const a = makeAssignment({ days: 0, allocationMode: 'flat' });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-01-19')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// totalDaysFromAssignment — rate mode
// ─────────────────────────────────────────────────────────────────────────────

describe('totalDaysFromAssignment — rate mode', () => {
  it('computes daysPerWeek × weeks for a 2-week phase', () => {
    // 2 weeks × 1 d/wk = 2d
    const a = makeAssignment({ days: 0, allocationMode: 'rate', daysPerWeek: 1 });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-01-19')).toBe(2);
  });

  it('computes correctly for a 5-week phase at 1 d/wk', () => {
    // 5 weeks × 1 d/wk = 5d
    const a = makeAssignment({ days: 0, allocationMode: 'rate', daysPerWeek: 1 });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(5);
  });

  it('computes correctly at 2 d/wk over 5 weeks', () => {
    const a = makeAssignment({ days: 0, allocationMode: 'rate', daysPerWeek: 2 });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(10);
  });

  it('rounds to 1 decimal place', () => {
    // 3 d/wk × 3 weeks = 9d (no decimal issue)
    const a = makeAssignment({ days: 0, allocationMode: 'rate', daysPerWeek: 3 });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-01-26')).toBe(9);
  });

  it('falls back to assignment.days when daysPerWeek is missing', () => {
    const a = makeAssignment({ days: 4, allocationMode: 'rate', daysPerWeek: undefined });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(4);
  });

  it('falls back to assignment.days when phaseStartDate is null', () => {
    const a = makeAssignment({ days: 6, allocationMode: 'rate', daysPerWeek: 2 });
    expect(totalDaysFromAssignment(a, null, '2026-02-09')).toBe(6);
  });

  it('falls back to assignment.days when phaseEndDate is null', () => {
    const a = makeAssignment({ days: 6, allocationMode: 'rate', daysPerWeek: 2 });
    expect(totalDaysFromAssignment(a, '2026-01-05', null)).toBe(6);
  });

  it('falls back to assignment.days when both phase dates are null', () => {
    const a = makeAssignment({ days: 8, allocationMode: 'rate', daysPerWeek: 3 });
    expect(totalDaysFromAssignment(a, null, null)).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// totalDaysFromAssignment — segments mode
// ─────────────────────────────────────────────────────────────────────────────

describe('totalDaysFromAssignment — segments mode', () => {
  it('sums all segment days', () => {
    const a = makeAssignment({
      days: 0,
      allocationMode: 'segments',
      segments: [
        makeSegment({ id: 'seg-1', days: 2 }),
        makeSegment({ id: 'seg-2', days: 3 }),
      ],
    });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(5);
  });

  it('returns 0 when there are no segments', () => {
    const a = makeAssignment({ days: 5, allocationMode: 'segments', segments: [] });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(0);
  });

  it('returns 0 when segments is undefined', () => {
    const a = makeAssignment({ days: 5, allocationMode: 'segments', segments: undefined });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(0);
  });

  it('ignores phase dates — total comes from segments only', () => {
    const a = makeAssignment({
      days: 99,
      allocationMode: 'segments',
      segments: [makeSegment({ days: 1 })],
    });
    // phase dates don't change the result
    expect(totalDaysFromAssignment(a, null, null)).toBe(1);
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-03-01')).toBe(1);
  });

  it('handles fractional segment days', () => {
    const a = makeAssignment({
      days: 0,
      allocationMode: 'segments',
      segments: [
        makeSegment({ id: 'seg-1', days: 0.5 }),
        makeSegment({ id: 'seg-2', days: 1.5 }),
      ],
    });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(2);
  });

  it('handles many segments correctly', () => {
    const segs = Array.from({ length: 10 }, (_, i) =>
      makeSegment({ id: `seg-${i}`, days: 1 })
    );
    const a = makeAssignment({ days: 0, allocationMode: 'segments', segments: segs });
    expect(totalDaysFromAssignment(a, '2026-01-05', '2026-02-09')).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcBarWidthDays (legacy fallback — regression guard)
// ─────────────────────────────────────────────────────────────────────────────

describe('calcBarWidthDays (legacy)', () => {
  it('returns 0 for empty assignments', () => {
    expect(calcBarWidthDays([], {})).toBe(0);
  });

  it('uses the assignment with the most days as the anchor', () => {
    const assignments = [
      makeAssignment({ memberId: 'a', days: 3 }),
      makeAssignment({ memberId: 'b', days: 7 }),
      makeAssignment({ memberId: 'c', days: 5 }),
    ];
    expect(calcBarWidthDays(assignments, {})).toBe(7);
  });

  it('adds absence days for the anchor member', () => {
    const assignments = [
      makeAssignment({ memberId: 'a', days: 10 }),
      makeAssignment({ memberId: 'b', days: 6 }),
    ];
    const absenceLookup = { a: 3, b: 8 };
    // anchor = a (10d), absence = 3d → total = 13
    expect(calcBarWidthDays(assignments, absenceLookup)).toBe(13);
  });

  it('uses 0 absence days when member not in lookup', () => {
    const assignments = [makeAssignment({ memberId: 'x', days: 5 })];
    expect(calcBarWidthDays(assignments, {})).toBe(5);
  });

  it('picks member with highest days even if another has more absences', () => {
    // member-a has 4d + 5d absence = 9d
    // member-b has 8d + 0d absence = 8d
    // anchor should be member-b (max days), total = 8d
    const assignments = [
      makeAssignment({ memberId: 'a', days: 4 }),
      makeAssignment({ memberId: 'b', days: 8 }),
    ];
    expect(calcBarWidthDays(assignments, { a: 5, b: 0 })).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: phaseBarWidthDays takes priority over calcBarWidthDays
// ─────────────────────────────────────────────────────────────────────────────

describe('explicit endDate overrides legacy bar width', () => {
  it('uses explicit end date when both are present', () => {
    // 10 working days explicit vs. hypothetical legacy 3d
    const plan = makePlan({ startDate: '2026-01-05', endDate: '2026-01-19' });
    const assignments = [makeAssignment({ days: 3 })];

    const explicit = phaseBarWidthDays(plan, T_START);
    const legacy   = calcBarWidthDays(assignments, {});

    expect(explicit).toBe(10);
    expect(legacy).toBe(3);
    // caller should prefer explicit
    const barW = explicit ?? legacy;
    expect(barW).toBe(10);
  });

  it('falls back to legacy when endDate is missing', () => {
    const plan = makePlan({ startDate: '2026-01-05' }); // no endDate
    const assignments = [makeAssignment({ days: 8 })];

    const explicit = phaseBarWidthDays(plan, T_START);
    const legacy   = calcBarWidthDays(assignments, {});

    expect(explicit).toBeNull();
    const barW = explicit ?? legacy;
    expect(barW).toBe(8);
  });
});
