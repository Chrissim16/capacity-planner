import type {
  AppState,
  BusinessTeam,
  EpicPhaseAssignment,
  PlanningGroupCategory,
  PlanningGroupTrack,
  TeamMember,
  TeamMemberAssignmentCategory,
} from '../types';

export type PlannedDaysBucket =
  | 'total'
  | 'it_team_members'
  | 'business_owners_and_teams'
  | 'other_it_teams'
  | 'external_partners';

export interface PlannedDaysTotals {
  total: number;
  it_team_members: number;
  business_owners_and_teams: number;
  other_it_teams: number;
  external_partners: number;
}

const DEFAULT_GROUP_TRACK: Record<PlanningGroupCategory, PlanningGroupTrack> = {
  business_team: 'BIZ',
  external_partner: 'IT',
  internal_it_team: 'IT',
};

const PLACEHOLDER_PREFIX = 'GROUP:';
const LEGACY_BUSINESS_TEAM_PREFIX = 'TEAM:';

export function getPlanningGroupCategory(group: Pick<BusinessTeam, 'category'>): PlanningGroupCategory {
  return group.category ?? 'business_team';
}

export function getPlanningGroupTrack(group: Pick<BusinessTeam, 'category' | 'track'>): PlanningGroupTrack {
  return group.track ?? DEFAULT_GROUP_TRACK[getPlanningGroupCategory(group)];
}

export function normalizePlanningGroup(group: BusinessTeam): BusinessTeam {
  const category = getPlanningGroupCategory(group);
  return {
    ...group,
    category,
    track: getPlanningGroupTrack(group),
    archived: group.archived ?? false,
  };
}

export function filterPlanningGroupsByCategory(
  groups: BusinessTeam[],
  category: PlanningGroupCategory,
): BusinessTeam[] {
  return groups.filter((group) => getPlanningGroupCategory(group) === category && !group.archived);
}

export function getPlanningGroupCategoryLabel(category: PlanningGroupCategory): string {
  switch (category) {
    case 'business_team':
      return 'Business Team';
    case 'external_partner':
      return 'External Partner';
    case 'internal_it_team':
      return 'Internal IT Team';
  }
}

export function getPlanningGroupCategoryPluralLabel(category: PlanningGroupCategory): string {
  switch (category) {
    case 'business_team':
      return 'Business Teams';
    case 'external_partner':
      return 'External Partners';
    case 'internal_it_team':
      return 'Internal IT Teams';
  }
}

export function getPlanningGroupRoleLabel(category: PlanningGroupCategory): string {
  switch (category) {
    case 'business_team':
      return 'Business team';
    case 'external_partner':
      return 'External partner';
    case 'internal_it_team':
      return 'Internal IT team';
  }
}

export function makePlanningGroupPlaceholderId(groupId: string, category: PlanningGroupCategory): string {
  if (category === 'business_team') return `${LEGACY_BUSINESS_TEAM_PREFIX}${groupId}`;
  return `${PLACEHOLDER_PREFIX}${category}:${groupId}`;
}

export function makeBusinessTeamPlaceholderId(teamId: string): string {
  return makePlanningGroupPlaceholderId(teamId, 'business_team');
}

export function isPlanningGroupPlaceholderId(id: string): boolean {
  return id.startsWith(LEGACY_BUSINESS_TEAM_PREFIX) || id.startsWith(PLACEHOLDER_PREFIX);
}

export function isBusinessTeamPlaceholderId(id: string): boolean {
  if (id.startsWith(LEGACY_BUSINESS_TEAM_PREFIX)) return true;
  return id.startsWith(`${PLACEHOLDER_PREFIX}business_team:`);
}

export function parsePlanningGroupPlaceholderId(
  memberId: string,
): { category: PlanningGroupCategory; rawId: string } | null {
  if (memberId.startsWith(LEGACY_BUSINESS_TEAM_PREFIX)) {
    return { category: 'business_team', rawId: memberId.slice(LEGACY_BUSINESS_TEAM_PREFIX.length) };
  }
  if (!memberId.startsWith(PLACEHOLDER_PREFIX)) return null;

  const raw = memberId.slice(PLACEHOLDER_PREFIX.length);
  const separator = raw.indexOf(':');
  if (separator <= 0) return null;

  const category = raw.slice(0, separator) as PlanningGroupCategory;
  const rawId = raw.slice(separator + 1);
  if (!rawId) return null;
  if (!['business_team', 'external_partner', 'internal_it_team'].includes(category)) return null;
  return { category, rawId };
}

type PlanningGroupRef = Pick<BusinessTeam, 'id' | 'name' | 'category' | 'track' | 'externalVendorId' | 'dailyRateOverride' | 'dailyRateCurrency'>;

export function resolvePlanningGroupPlaceholder<T extends PlanningGroupRef>(
  memberId: string,
  groups: T[],
): T | null {
  const parsed = parsePlanningGroupPlaceholderId(memberId);
  if (!parsed) return null;

  return groups.find((group) =>
    getPlanningGroupCategory(group) === parsed.category &&
    (group.id === parsed.rawId || group.name === parsed.rawId)
  ) ?? null;
}

export function resolveBusinessTeamPlaceholder<T extends PlanningGroupRef>(
  memberId: string,
  groups: T[],
): T | null {
  const group = resolvePlanningGroupPlaceholder(memberId, groups);
  return group && getPlanningGroupCategory(group) === 'business_team' ? group : null;
}

export function normalizePlanningGroupPlaceholderId(
  memberId: string,
  groups: PlanningGroupRef[],
): string {
  const group = resolvePlanningGroupPlaceholder(memberId, groups);
  return group ? makePlanningGroupPlaceholderId(group.id, getPlanningGroupCategory(group)) : memberId;
}

export function normalizeBusinessTeamPlaceholderId(
  memberId: string,
  groups: PlanningGroupRef[],
): string {
  const group = resolveBusinessTeamPlaceholder(memberId, groups);
  return group ? makeBusinessTeamPlaceholderId(group.id) : memberId;
}

export function normalizePlanningGroupPlaceholdersInAssignments<T extends Pick<EpicPhaseAssignment, 'memberId'>>(
  assignments: T[],
  groups: PlanningGroupRef[],
): T[] {
  let changed = false;
  const normalizedAssignments = assignments.map((assignment) => {
    const normalizedMemberId = normalizePlanningGroupPlaceholderId(assignment.memberId, groups);
    if (normalizedMemberId === assignment.memberId) return assignment;
    changed = true;
    return { ...assignment, memberId: normalizedMemberId };
  });

  return changed ? normalizedAssignments : assignments;
}

export function normalizeBusinessTeamPlaceholdersInAssignments<T extends Pick<EpicPhaseAssignment, 'memberId'>>(
  assignments: T[],
  groups: PlanningGroupRef[],
): T[] {
  return normalizePlanningGroupPlaceholdersInAssignments(assignments, groups);
}

function buildAbbreviation(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || name.slice(0, 2).toUpperCase();
}

export function getPlanningGroupPlaceholderDisplay(
  memberId: string,
  groups: PlanningGroupRef[],
): { name: string; abbr: string; category: PlanningGroupCategory; roleLabel: string } {
  const resolvedGroup = resolvePlanningGroupPlaceholder(memberId, groups);
  const parsed = parsePlanningGroupPlaceholderId(memberId);
  const category = resolvedGroup
    ? getPlanningGroupCategory(resolvedGroup)
    : parsed?.category ?? 'business_team';
  const rawName = resolvedGroup?.name
    ?? parsed?.rawId
    ?? memberId.replace(LEGACY_BUSINESS_TEAM_PREFIX, '').replace(PLACEHOLDER_PREFIX, '');

  return {
    name: rawName,
    abbr: buildAbbreviation(rawName),
    category,
    roleLabel: getPlanningGroupRoleLabel(category),
  };
}

export function getBusinessTeamPlaceholderDisplay(
  memberId: string,
  groups: PlanningGroupRef[],
): { name: string; abbr: string } {
  const display = getPlanningGroupPlaceholderDisplay(memberId, groups);
  return { name: display.name, abbr: display.abbr };
}

export function getTeamMemberAssignmentCategory(member: TeamMember): TeamMemberAssignmentCategory {
  if (member.assignmentCategory) return member.assignmentCategory;
  if (member.workerType === 'external') return 'external_partner';
  return 'it_team_member';
}

export function getPlannedDaysBucketForAssignment(
  assignment: Pick<EpicPhaseAssignment, 'memberId' | 'track'>,
  state: Pick<AppState, 'teamMembers' | 'businessContacts' | 'businessTeams'>,
): PlannedDaysBucket {
  if (assignment.track === 'BIZ') return 'business_owners_and_teams';

  const placeholder = resolvePlanningGroupPlaceholder(assignment.memberId, state.businessTeams);
  if (placeholder) {
    switch (getPlanningGroupCategory(placeholder)) {
      case 'business_team':
        return 'business_owners_and_teams';
      case 'external_partner':
        return 'external_partners';
      case 'internal_it_team':
        return 'other_it_teams';
    }
  }

  const member = state.teamMembers.find((item) => item.id === assignment.memberId);
  if (!member) return 'it_team_members';

  switch (getTeamMemberAssignmentCategory(member)) {
    case 'external_partner':
      return 'external_partners';
    case 'other_internal_it':
      return 'other_it_teams';
    case 'it_team_member':
    default:
      return 'it_team_members';
  }
}

export function emptyPlannedDaysTotals(): PlannedDaysTotals {
  return {
    total: 0,
    it_team_members: 0,
    business_owners_and_teams: 0,
    other_it_teams: 0,
    external_partners: 0,
  };
}

export function addToPlannedDaysTotals(
  totals: PlannedDaysTotals,
  bucket: PlannedDaysBucket,
  days: number,
): PlannedDaysTotals {
  const next = { ...totals };
  next.total += days;
  if (bucket !== 'total') next[bucket] += days;
  return next;
}

export function getPlannedDaysBucketLabel(bucket: Exclude<PlannedDaysBucket, 'total'>): string {
  switch (bucket) {
    case 'it_team_members':
      return 'IT Team members';
    case 'business_owners_and_teams':
      return 'Business Owners and Business teams';
    case 'other_it_teams':
      return 'Other IT teams';
    case 'external_partners':
      return 'External Partners';
  }
}
