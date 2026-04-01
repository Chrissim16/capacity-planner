import { describe, expect, it } from 'vitest';
import type { EpicPhaseAssignment, EpicPhasePlan } from '../types';
import { buildOrderedPhaseEntries, upsertPhaseSequencePlans } from './portfolioPhaseOrdering';

function makePlan(overrides: Partial<EpicPhasePlan> = {}): EpicPhasePlan {
  return {
    id: 'plan-1',
    epicKey: 'EPIC-1',
    phase: 'design',
    phaseInstanceId: 'design',
    phaseOrder: 0,
    startDate: null,
    endDate: null,
    description: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildOrderedPhaseEntries', () => {
  it('keeps cross-phase rollout sequences and renumbers labels by occurrence', () => {
    const rows = buildOrderedPhaseEntries([
      makePlan({ phase: 'design', phaseInstanceId: 'design', phaseOrder: 0 }),
      makePlan({ id: 'plan-2', phase: 'build', phaseInstanceId: 'build', phaseOrder: 1 }),
      makePlan({ id: 'plan-3', phase: 'test', phaseInstanceId: 'test', phaseOrder: 2 }),
      makePlan({ id: 'plan-4', phase: 'hypercare', phaseInstanceId: 'hypercare', phaseOrder: 3 }),
      makePlan({ id: 'plan-5', phase: 'design', phaseInstanceId: 'design-2', phaseOrder: 4 }),
      makePlan({ id: 'plan-6', phase: 'build', phaseInstanceId: 'build-2', phaseOrder: 5 }),
    ], [], 'EPIC-1');

    expect(rows.map((row) => row.phaseInstanceId)).toEqual([
      'design',
      'build',
      'test',
      'deploy',
      'hypercare',
      'design-2',
      'build-2',
    ]);
    expect(rows.filter((row) => row.phase === 'design').map((row) => row.phaseOrdinal)).toEqual([1, 2]);
    expect(rows.filter((row) => row.phase === 'build').map((row) => row.phaseOrdinal)).toEqual([1, 2]);
  });

  it('creates a persisted row for assignment-only default phases when ordered', () => {
    const rows = buildOrderedPhaseEntries([], [
      makeAssignment({ phase: 'build', phaseInstanceId: 'build' }),
    ], 'EPIC-1');

    expect(rows.map((row) => row.phaseInstanceId)).toEqual([
      'design',
      'build',
      'test',
      'deploy',
      'hypercare',
    ]);
    expect(rows.find((row) => row.phaseInstanceId === 'build')?.assignments).toHaveLength(1);
  });
});

describe('upsertPhaseSequencePlans', () => {
  it('renormalizes global phase order for an epic', () => {
    const nextPlans = upsertPhaseSequencePlans([
      makePlan({ phase: 'design', phaseInstanceId: 'design', phaseOrder: 0 }),
      makePlan({ id: 'plan-2', phase: 'build', phaseInstanceId: 'build', phaseOrder: 1 }),
      makePlan({ id: 'plan-3', phase: 'design', phaseInstanceId: 'design-2', phaseOrder: 4 }),
    ], [
      { phase: 'design', phaseInstanceId: 'design' },
      { phase: 'design', phaseInstanceId: 'design-2' },
      { phase: 'build', phaseInstanceId: 'build' },
    ], 'EPIC-1', '2026-02-01T00:00:00.000Z');

    expect(nextPlans.filter((plan) => plan.epicKey === 'EPIC-1').map((plan) => ({
      phaseInstanceId: plan.phaseInstanceId,
      phaseOrder: plan.phaseOrder,
    }))).toEqual([
      { phaseInstanceId: 'design', phaseOrder: 0 },
      { phaseInstanceId: 'design-2', phaseOrder: 1 },
      { phaseInstanceId: 'build', phaseOrder: 2 },
    ]);
  });
});
