import { describe, expect, it } from 'vitest';
import type { EpicPhaseAssignment } from '../types';
import {
  normalizeBusinessTeamPlaceholderId,
  normalizeBusinessTeamPlaceholdersInAssignments,
} from './businessTeamPlaceholders';
import {
  getPlanningGroupPlaceholderDisplay,
  isPlanningGroupMemberId,
  normalizePlanningGroupPlaceholderId,
} from './planningGroups';

const businessTeams = [
  { id: 'bt-finance-ops', name: 'Finance Ops' },
  { id: 'bt-controllership', name: 'Controllership' },
  { id: 'bt-accenture', name: 'Accenture', category: 'external_partner' as const },
  { id: 'bt-integration-hub', name: 'Integration Hub', category: 'internal_it_team' as const },
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

  it('normalizes new non-business placeholder categories to stable ids', () => {
    expect(normalizePlanningGroupPlaceholderId('GROUP:external_partner:Accenture', businessTeams)).toBe('GROUP:external_partner:bt-accenture');
    expect(normalizePlanningGroupPlaceholderId('GROUP:internal_it_team:Integration Hub', businessTeams)).toBe('GROUP:internal_it_team:bt-integration-hub');
  });

  it('resolves raw business_teams.id (no TEAM:/GROUP: prefix) from pre-migration assignments', () => {
    expect(isPlanningGroupMemberId('bt-accenture', businessTeams)).toBe(true);
    expect(isPlanningGroupMemberId('bt-integration-hub', businessTeams)).toBe(true);
    expect(normalizePlanningGroupPlaceholderId('bt-accenture', businessTeams)).toBe('GROUP:external_partner:bt-accenture');
    expect(normalizePlanningGroupPlaceholderId('bt-integration-hub', businessTeams)).toBe('GROUP:internal_it_team:bt-integration-hub');
    expect(getPlanningGroupPlaceholderDisplay('bt-accenture', businessTeams)).toMatchObject({
      name: 'Accenture',
      category: 'external_partner',
    });
  });

  it('returns category-aware placeholder display metadata', () => {
    expect(getPlanningGroupPlaceholderDisplay('GROUP:external_partner:bt-accenture', businessTeams)).toMatchObject({
      name: 'Accenture',
      category: 'external_partner',
      roleLabel: 'External partner',
    });
  });
});
