import { describe, expect, it } from 'vitest';
import type { EpicPhaseAssignment } from '../types';
import { materializeScenarioPhaseAssignments } from './portfolioScenarioAssignments';

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

describe('materializeScenarioPhaseAssignments', () => {
  it('falls back to baseline assignments when a scenario has no snapshot rows', () => {
    const baseline = [
      makeAssignment(),
      makeAssignment({ id: 'assign-2', phase: 'build', phaseInstanceId: 'build', memberId: 'member-2' }),
    ];

    expect(materializeScenarioPhaseAssignments(baseline, [])).toEqual(baseline);
  });

  it('overlays sparse legacy scenario rows onto the baseline set', () => {
    const baseline = [
      makeAssignment(),
      makeAssignment({ id: 'assign-2', phase: 'build', phaseInstanceId: 'build', memberId: 'member-2', days: 8 }),
      makeAssignment({ id: 'assign-3', phase: 'test', phaseInstanceId: 'test', memberId: 'member-3', days: 13 }),
      makeAssignment({ id: 'assign-4', phase: 'deploy', phaseInstanceId: 'deploy', memberId: 'member-4', days: 3 }),
    ];
    const scenario = [
      makeAssignment({ id: 'assign-2-scenario', phase: 'build', phaseInstanceId: 'build', memberId: 'member-2', days: 21 }),
    ];

    expect(materializeScenarioPhaseAssignments(baseline, scenario)).toEqual([
      baseline[0],
      scenario[0],
      baseline[2],
      baseline[3],
    ]);
  });

  it('keeps near-complete scenario snapshots authoritative so removals still work', () => {
    const baseline = [
      makeAssignment(),
      makeAssignment({ id: 'assign-2', phase: 'build', phaseInstanceId: 'build', memberId: 'member-2' }),
      makeAssignment({ id: 'assign-3', phase: 'test', phaseInstanceId: 'test', memberId: 'member-3' }),
      makeAssignment({ id: 'assign-4', phase: 'deploy', phaseInstanceId: 'deploy', memberId: 'member-4' }),
    ];
    const scenario = [
      baseline[0],
      baseline[1],
      baseline[2],
    ];

    expect(materializeScenarioPhaseAssignments(baseline, scenario)).toEqual(scenario);
  });
});
