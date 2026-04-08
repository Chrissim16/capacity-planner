import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AllocationSegment, EpicPhaseAssignment } from '../types';
import {
  applyScenarioAssignmentReplacement,
  cloneSegmentsForReplacement,
  filterAssignmentsForReplacementUpsert,
} from './portfolioAssignmentReplacement';

function makeSegment(overrides: Partial<AllocationSegment> = {}): AllocationSegment {
  return {
    id: 'segment-1',
    startDate: '2026-04-01',
    endDate: '2026-04-05',
    days: 3,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<EpicPhaseAssignment> = {}): EpicPhaseAssignment {
  return {
    id: 'assign-1',
    epicKey: 'EPIC-1',
    phase: 'design',
    phaseInstanceId: 'design',
    memberId: 'member-1',
    track: 'IT',
    days: 5,
    allocationMode: 'flat',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cloneSegmentsForReplacement', () => {
  it('creates new local ids while preserving date and day values', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1712448000000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);

    const cloned = cloneSegmentsForReplacement([
      makeSegment(),
      makeSegment({ id: 'segment-2', startDate: '2026-04-06', endDate: '2026-04-10', days: 2 }),
    ]);

    expect(cloned).toEqual([
      expect.objectContaining({
        id: 'local-replace-1712448000000-4fzyo8-0',
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        days: 3,
      }),
      expect.objectContaining({
        id: 'local-replace-1712448000000-4fzyo8-1',
        startDate: '2026-04-06',
        endDate: '2026-04-10',
        days: 2,
      }),
    ]);
  });
});

describe('applyScenarioAssignmentReplacement', () => {
  it('removes the replaced assignee and inserts the replacement once', () => {
    const original = makeAssignment();
    const untouched = makeAssignment({
      id: 'assign-2',
      epicKey: 'EPIC-2',
      phaseInstanceId: 'build',
      phase: 'build',
      memberId: 'member-9',
    });

    const result = applyScenarioAssignmentReplacement(
      [original, untouched],
      original,
      'member-2',
      'BIZ',
      8,
      undefined,
      '2026-04-07T12:00:00.000Z',
    );

    expect(result).toEqual([
      untouched,
      expect.objectContaining({
        epicKey: 'EPIC-1',
        phaseInstanceId: 'design',
        memberId: 'member-2',
        track: 'BIZ',
        days: 8,
        updatedAt: '2026-04-07T12:00:00.000Z',
      }),
    ]);
    expect(result.some((assignment) => assignment.memberId === 'member-1')).toBe(false);
  });

  it('merges copied segments into an existing target assignment on the same phase', () => {
    const original = makeAssignment({
      memberId: 'member-1',
      allocationMode: 'segments',
      days: 3,
      segments: [makeSegment()],
    });
    const target = makeAssignment({
      id: 'assign-2',
      memberId: 'member-2',
      allocationMode: 'segments',
      days: 2,
      segments: [makeSegment({ id: 'target-segment', days: 2, startDate: '2026-04-11', endDate: '2026-04-12' })],
    });
    const clonedSegments = [
      makeSegment({ id: 'local-replace-1', days: 4 }),
      makeSegment({ id: 'local-replace-2', days: 1, startDate: '2026-04-13', endDate: '2026-04-14' }),
    ];

    const result = applyScenarioAssignmentReplacement(
      [original, target],
      original,
      'member-2',
      'IT',
      3,
      clonedSegments,
      '2026-04-07T13:00:00.000Z',
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'assign-2',
        memberId: 'member-2',
        days: 7,
        segments: [
          expect.objectContaining({ id: 'target-segment', days: 2 }),
          expect.objectContaining({ id: 'local-replace-1', days: 4 }),
          expect.objectContaining({ id: 'local-replace-2', days: 1 }),
        ],
        updatedAt: '2026-04-07T13:00:00.000Z',
      }),
    ]);
  });
});

describe('filterAssignmentsForReplacementUpsert', () => {
  it('removes both the old and new assignee rows for the replaced phase slot', () => {
    const assignments = [
      makeAssignment({ memberId: 'member-1' }),
      makeAssignment({ id: 'assign-2', memberId: 'member-2' }),
      makeAssignment({ id: 'assign-3', epicKey: 'EPIC-2', phaseInstanceId: 'build', phase: 'build', memberId: 'member-1' }),
    ];

    const filtered = filterAssignmentsForReplacementUpsert(
      assignments,
      'EPIC-1',
      'design',
      'member-2',
      'member-1',
    );

    expect(filtered).toEqual([
      expect.objectContaining({ id: 'assign-3', epicKey: 'EPIC-2', phaseInstanceId: 'build', memberId: 'member-1' }),
    ]);
  });
});
