import type { BusinessTeam, EpicPhaseAssignment } from '../types';

type BusinessTeamRef = Pick<BusinessTeam, 'id' | 'name'>;

function buildAbbreviation(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || name.slice(0, 2).toUpperCase();
}

export function isBusinessTeamPlaceholderId(id: string): boolean {
  return id.startsWith('TEAM:');
}

export function makeBusinessTeamPlaceholderId(teamId: string): string {
  return `TEAM:${teamId}`;
}

export function resolveBusinessTeamPlaceholder<T extends BusinessTeamRef>(
  memberId: string,
  businessTeams: T[],
): T | null {
  if (!isBusinessTeamPlaceholderId(memberId)) return null;

  const raw = memberId.slice(5);
  return businessTeams.find((team) => team.id === raw)
    ?? businessTeams.find((team) => team.name === raw)
    ?? null;
}

export function normalizeBusinessTeamPlaceholderId(
  memberId: string,
  businessTeams: BusinessTeamRef[],
): string {
  const team = resolveBusinessTeamPlaceholder(memberId, businessTeams);
  return team ? makeBusinessTeamPlaceholderId(team.id) : memberId;
}

export function normalizeBusinessTeamPlaceholdersInAssignments<T extends Pick<EpicPhaseAssignment, 'memberId'>>(
  assignments: T[],
  businessTeams: BusinessTeamRef[],
): T[] {
  let changed = false;

  const normalizedAssignments = assignments.map((assignment) => {
    const normalizedMemberId = normalizeBusinessTeamPlaceholderId(assignment.memberId, businessTeams);
    if (normalizedMemberId === assignment.memberId) return assignment;
    changed = true;
    return { ...assignment, memberId: normalizedMemberId };
  });

  return changed ? normalizedAssignments : assignments;
}

export function getBusinessTeamPlaceholderDisplay(
  memberId: string,
  businessTeams: BusinessTeamRef[],
): { name: string; abbr: string } {
  const resolvedTeam = resolveBusinessTeamPlaceholder(memberId, businessTeams);
  const name = resolvedTeam?.name ?? memberId.replace('TEAM:', '');
  return {
    name,
    abbr: buildAbbreviation(name),
  };
}
