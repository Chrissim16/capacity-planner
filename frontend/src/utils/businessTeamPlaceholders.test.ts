import { describe, expect, it } from 'vitest';
import type { EpicPhaseAssignment } from '../types';
import {
  normalizeBusinessTeamPlaceholderId,
  normalizeBusinessTeamPlaceholdersInAssignments,
} from './businessTeamPlaceholders';

const businessTeams = [
  { id: 'bt-finance-ops', name: 'Finance Ops' },
  { id: 'bt-controllership', name: 'Controllership' },
];

function makeAssignment(overrides: Partial<EpicPhaseAssignment> = {}): EpicPhaseAssignment {
  return {
    id: 'assign-1',
    epicKey: 'FIN-241',
    phase: 'design',
    phaseInstanceId: 'design',
    memberId: 'TEAM:Finance Ops',
    track: 'BIZ',
    days: 3,
    allocationMode: 'flat',
    updatedAt: '2026-04-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('businessTeamPlaceholders', () => {
  it('normalizes legacy team placeholders to stable id placeholders', () => {
    expect(normalizeBusinessTeamPlaceholderId('TEAM:Finance Ops', businessTeams)).toBe('TEAM:bt-finance-ops');
    expect(normalizeBusinessTeamPlaceholderId('TEAM:bt-finance-ops', businessTeams)).toBe('TEAM:bt-finance-ops');
    expect(normalizeBusinessTeamPlaceholderId('member-123', businessTeams)).toBe('member-123');
  });

  it('normalizes assignment arrays without changing unrelated assignees', () => {
    const assignments = [
      makeAssignment(),
      makeAssignment({ id: 'assign-2', memberId: 'TEAM:bt-controllership' }),
      makeAssignment({ id: 'assign-3', memberId: 'member-123', track: 'IT' }),
      makeAssignment({ id: 'assign-4', memberId: 'TEAM:Unknown Team' }),
    ];

    expect(normalizeBusinessTeamPlaceholdersInAssignments(assignments, businessTeams)).toEqual([
      makeAssignment({ memberId: 'TEAM:bt-finance-ops' }),
      makeAssignment({ id: 'assign-2', memberId: 'TEAM:bt-controllership' }),
      makeAssignment({ id: 'assign-3', memberId: 'member-123', track: 'IT' }),
      makeAssignment({ id: 'assign-4', memberId: 'TEAM:Unknown Team' }),
    ]);
  });
});
