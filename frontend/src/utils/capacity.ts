/**
 * Capacity calculation utilities
 * Pure functions — no side effects, fully testable.
 *
 * IT effort  : derived from JiraWorkItem (assigneeEmail + storyPoints + sprintName)
 * BIZ effort : derived from JiraItemBizAssignment (explicit days per item)
 */

import type {
  AppState,
  CapacityResult,
  CapacityBreakdownItem,
  CapacityStatus,
  Warnings,
  Sprint,
  BusinessContact,
  BusinessTimeOff,
  JiraItemBizAssignment,
  JiraWorkItem,
  PublicHoliday,
  PlannerItem,
} from '../types';
import {
  formatDate,
  getWorkdaysInQuarter,
  getHolidaysByCountry,
  parseQuarter,
  getCurrentQuarter,
  getWorkdaysInDateRangeForQuarter,
  getWorkdaysInDateRange,
  prorateDaysToWeek,
} from './calendar';
import { getForecastedDays } from './confidence';
import {
  calculateBusinessContactBauDays,
  calculateTeamMemberBauDays,
} from './bau';

// ─── BUSINESS CAPACITY ────────────────────────────────────────────────────────

export interface BusinessCellData {
  allocatedDays: number;
  availableDays: number;
  usedPercent: number;
  utilisationPct: number;
  isTimeOff: boolean;
  isPublicHoliday: boolean;
  breakdownByProject: {
    projectId: string;
    projectName: string;
    phaseId?: string;
    phaseName?: string;
    days: number;
    notes?: string;
  }[];
}

/**
 * Compute a business contact's allocation and availability for a single calendar week.
 * BIZ effort is derived exclusively from JiraItemBizAssignments, prorated into the week
 * using the item's sprint date range.
 */
export function calculateBusinessCapacity(
  contact: BusinessContact,
  weekStart: string,
  weekEnd: string,
  jiraItemBizAssignments: JiraItemBizAssignment[],
  businessTimeOff: BusinessTimeOff[],
  publicHolidays: PublicHoliday[],
  jiraWorkItems: JiraWorkItem[]
): BusinessCellData {
  const contactHolidays = getHolidaysByCountry(contact.countryId, publicHolidays);
  const weekStartDate = new Date(weekStart + 'T00:00:00');
  const weekEndDate   = new Date(weekEnd   + 'T00:00:00');

  const capacityScale = ((contact.workingDaysPerWeek ?? 5) / 5) * ((contact.workingHoursPerDay ?? 8) / 8);
  const workdays = getWorkdaysInDateRange(weekStart, weekEnd, contactHolidays) * capacityScale;

  const timeOffDays = businessTimeOff
    .filter(t => t.contactId === contact.id)
    .reduce((sum, t) =>
      sum + getWorkdaysInDateRange(t.startDate, t.endDate, contactHolidays, weekStartDate, weekEndDate) * capacityScale,
    0);

  const usesPercentBau = contact.bauReservePercent != null || contact.bauReserveDays == null;
  const bauDays = usesPercentBau
    ? calculateBusinessContactBauDays(workdays, contact)
    : (() => {
        const bauReserveDays = contact.bauReserveDays ?? 5;
        const d = new Date(weekStart + 'T00:00:00');
        const yr = d.getFullYear();
        const qn = Math.ceil((d.getMonth() + 1) / 3);
        const qStarts = ['01-01', '04-01', '07-01', '10-01'];
        const qEnds = ['03-31', '06-30', '09-30', '12-31'];
        return prorateDaysToWeek(
          bauReserveDays,
          `${yr}-${qStarts[qn - 1]}`,
          `${yr}-${qEnds[qn - 1]}`,
          weekStart,
          weekEnd,
          contactHolidays,
        );
      })();
  const availableDays = Math.max(0, workdays - timeOffDays);

  const breakdownByProject: BusinessCellData['breakdownByProject'] = [];
  let allocated = 0;

  // BAU reserve
  if (bauDays > 0) {
    allocated += bauDays;
    breakdownByProject.push({ projectId: '__bau__', projectName: 'BAU Reserve', days: bauDays });
  }

  // Jira item BIZ assignments — prorate each item's days into this week
  const myAssignments = jiraItemBizAssignments.filter(
    a => a.contactId === contact.id && (a.days ?? 0) > 0
  );

  for (const a of myAssignments) {
    const item = jiraWorkItems.find(w => w.jiraKey === a.jiraKey);
    if (!item) continue;

    const rangeStart = item.sprintStartDate ?? item.startDate;
    const rangeEnd   = item.sprintEndDate   ?? item.dueDate;
    if (!rangeStart || !rangeEnd) continue;

    const days = prorateDaysToWeek(a.days!, rangeStart, rangeEnd, weekStart, weekEnd, contactHolidays);
    if (days === 0) continue;

    allocated += days;
    breakdownByProject.push({
      projectId: a.jiraKey,
      projectName: `${item.jiraKey}: ${item.summary}`,
      days,
      notes: a.notes,
    });
  }

  const utilisationPct = availableDays > 0 ? allocated / availableDays : 0;
  return {
    allocatedDays: allocated,
    availableDays,
    usedPercent: Math.round(utilisationPct * 100),
    utilisationPct,
    isTimeOff: timeOffDays >= workdays && workdays > 0,
    isPublicHoliday: workdays === 0,
    breakdownByProject,
  };
}

/**
 * Quarter-level BIZ capacity.
 * Sums JiraItemBizAssignment days for items whose sprint falls in the given quarter.
 */
export function calculateBusinessCapacityForQuarter(
  contact: BusinessContact,
  quarterStr: string,
  jiraItemBizAssignments: JiraItemBizAssignment[],
  businessTimeOff: BusinessTimeOff[],
  publicHolidays: PublicHoliday[],
  jiraWorkItems: JiraWorkItem[]
): BusinessCellData {
  const q = parseQuarter(quarterStr);
  if (!q) {
    return {
      allocatedDays: 0, availableDays: 0, usedPercent: 0,
      utilisationPct: 0, isTimeOff: false, isPublicHoliday: false, breakdownByProject: [],
    };
  }

  const weekStart = formatDate(q.start);
  const weekEnd   = formatDate(q.end);

  return calculateBusinessCapacity(
    contact, weekStart, weekEnd,
    jiraItemBizAssignments, businessTimeOff, publicHolidays, jiraWorkItems
  );
}

/**
 * Map a Jira sprint name to a quarter string ("Q1 2026") using configured sprints.
 * Falls back to deriving the quarter from sprintStartDate when name matching fails —
 * this handles cases where Jira sprint names don't match any configured sprint name.
 */
export function sprintNameToQuarter(
  sprintName: string | undefined,
  sprints: Sprint[],
  sprintStartDate?: string,
): string | null {
  if (!sprintName && !sprintStartDate) return null;

  if (sprintName) {
    const lower = sprintName.toLowerCase();
    const match = sprints.find(s => lower.includes(s.name.toLowerCase()));
    if (match) return match.quarter;
  }

  // Fallback: derive quarter from sprint start date when name matching fails
  if (sprintStartDate) {
    const d = new Date(sprintStartDate + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      const q = Math.ceil((d.getMonth() + 1) / 3);
      return `Q${q} ${d.getFullYear()}`;
    }
  }

  return null;
}

// ─── IT CAPACITY ──────────────────────────────────────────────────────────────

/**
 * Calculate IT capacity for a team member in a specific quarter.
 * Usage is derived exclusively from JiraWorkItem (assigneeEmail + storyPoints + sprintName).
 */
export function calculateCapacity(
  memberId: string,
  quarter: string,
  state: AppState
): CapacityResult {
  const member = state.teamMembers.find(m => m.id === memberId);
  if (!member) {
    return {
      totalWorkdays: 0, usedDays: 0, availableDays: 0,
      availableDaysRaw: 0, usedPercent: 0, status: 'normal', breakdown: [],
    };
  }

  const memberHolidays = getHolidaysByCountry(
    member.countryId || state.settings.defaultCountryId,
    state.publicHolidays
  );
  const capacityScale = (member.workingDaysPerWeek ?? 5) / 5;
  const totalWorkdays = getWorkdaysInQuarter(quarter, memberHolidays) * capacityScale;

  let usedDays = 0;
  const breakdown: CapacityBreakdownItem[] = [];

  // BAU Reserve
  const bauDays = calculateTeamMemberBauDays(totalWorkdays, member, state.settings);
  usedDays += bauDays;
  breakdown.push({ type: 'bau', days: bauDays });

  // Time Off
  const memberTimeOff = state.timeOff.filter(t => t.memberId === memberId);
  let totalTimeOffDays = 0;
  for (const to of memberTimeOff) {
    totalTimeOffDays += getWorkdaysInDateRangeForQuarter(
      to.startDate, to.endDate, quarter, memberHolidays
    ) * capacityScale;
  }
  if (totalTimeOffDays > 0) {
    usedDays += totalTimeOffDays;
    breakdown.push({ type: 'timeoff', days: totalTimeOffDays });
  }

  // Jira work items — only leaf-level items with story points
  if (member.email && state.jiraWorkItems.length > 0) {
    const memberEmail = member.email.toLowerCase();
    const defaultConfidence = state.jiraSettings?.defaultConfidenceLevel ?? 'medium';

    for (const item of state.jiraWorkItems) {
      if (item.statusCategory === 'done') continue;
      if (item.storyPoints == null) continue;
      if (!item.assigneeEmail || item.assigneeEmail.toLowerCase() !== memberEmail) continue;
      if (item.type === 'epic' || item.type === 'feature') continue; // Epics/features aggregate children

      const itemQuarter = sprintNameToQuarter(item.sprintName, state.sprints, item.sprintStartDate);
      if (itemQuarter !== quarter) continue;

      const confidence = item.confidenceLevel ?? defaultConfidence;
      const days = getForecastedDays(item.storyPoints, confidence, state.settings.confidenceLevels);
      if (days <= 0) continue;

      usedDays += days;
      breakdown.push({ type: 'jira', days, jiraKey: item.jiraKey, jiraSummary: item.summary });
    }
  }

  // Manual project assignments (not Jira-derived — Decision D1)
  const assignmentDays = (state.assignments ?? [])
    .filter(a => a.memberId === memberId && a.quarter === quarter)
    .reduce((sum, a) => sum + (a.days ?? 0), 0);
  if (assignmentDays > 0) {
    usedDays += assignmentDays;
    breakdown.push({ type: 'assignment', days: assignmentDays });
  }

  const availableDaysRaw = totalWorkdays - usedDays;
  const availableDays = Math.max(0, availableDaysRaw);
  const usedPercent = totalWorkdays > 0 ? Math.round((usedDays / totalWorkdays) * 100) : 0;

  let status: CapacityStatus = 'normal';
  if (usedDays > totalWorkdays) status = 'overallocated';
  else if (usedPercent > 90) status = 'warning';

  return { totalWorkdays, usedDays, availableDays, availableDaysRaw, usedPercent, status, breakdown };
}

/**
 * Count the number of distinct epics a member is involved in for a quarter
 * (via any child JiraWorkItem with story points in that quarter assigned to them).
 */
export function getMemberEpicCount(
  memberId: string,
  quarter: string,
  state: AppState
): number {
  const member = state.teamMembers.find(m => m.id === memberId);
  if (!member?.email) return 0;

  const memberEmail = member.email.toLowerCase();
  const epicKeys = new Set<string>();

  // Build epic ancestry map
  const epicByKey = new Map<string, string>(); // jiraKey → epic jiraKey
  for (const item of state.jiraWorkItems) {
    if (item.type === 'epic') {
      epicByKey.set(item.jiraKey, item.jiraKey);
    }
  }
  for (const item of state.jiraWorkItems) {
    if (item.type !== 'epic' && item.parentKey) {
      const parentIsEpic = state.jiraWorkItems.find(
        w => w.jiraKey === item.parentKey && w.type === 'epic'
      );
      if (parentIsEpic) epicByKey.set(item.jiraKey, item.parentKey);
    }
  }

  for (const item of state.jiraWorkItems) {
    if (item.statusCategory === 'done') continue;
    if (!item.assigneeEmail || item.assigneeEmail.toLowerCase() !== memberEmail) continue;
    if (item.type === 'epic' || item.type === 'feature') continue;
    const itemQuarter = sprintNameToQuarter(item.sprintName, state.sprints, item.sprintStartDate);
    if (itemQuarter !== quarter) continue;
    const epicKey = epicByKey.get(item.jiraKey);
    if (epicKey) epicKeys.add(epicKey);
  }

  return epicKeys.size;
}

/**
 * Get all capacity warnings for the given quarter (defaults to the real-world
 * current quarter so existing callers require no change).
 */
export function getWarnings(state: AppState, quarter: string = getCurrentQuarter()): Warnings {
  const warnings: Warnings = {
    overallocated: [],
    highUtilization: [],
    tooManyProjects: [],
  };

  for (const member of state.teamMembers) {
    const cap = calculateCapacity(member.id, quarter, state);

    if (cap.status === 'overallocated') {
      warnings.overallocated.push({ member, usedDays: cap.usedDays, totalDays: cap.totalWorkdays, quarter });
    } else if (cap.status === 'warning') {
      warnings.highUtilization.push({
        member, usedDays: cap.usedDays, totalDays: cap.totalWorkdays, usedPercent: cap.usedPercent, quarter,
      });
    }

    const epicCount = getMemberEpicCount(member.id, quarter, state);
    if (epicCount > member.maxConcurrentProjects) {
      warnings.tooManyProjects.push({ member, count: epicCount, max: member.maxConcurrentProjects });
    }
  }

  return warnings;
}

/**
 * Calculate team utilization summary for a quarter.
 */
export function getTeamUtilizationSummary(
  quarter: string,
  state: AppState
): {
  totalMembers: number;
  overallocated: number;
  highUtilization: number;
  normal: number;
  averageUtilization: number;
} {
  let overallocated = 0;
  let highUtilization = 0;
  let normal = 0;
  let totalUtilization = 0;

  for (const member of state.teamMembers) {
    const cap = calculateCapacity(member.id, quarter, state);
    totalUtilization += cap.usedPercent;
    if (cap.status === 'overallocated') overallocated++;
    else if (cap.status === 'warning') highUtilization++;
    else normal++;
  }

  const totalMembers = state.teamMembers.length;
  return {
    totalMembers,
    overallocated,
    highUtilization,
    normal,
    averageUtilization: totalMembers > 0 ? Math.round(totalUtilization / totalMembers) : 0,
  };
}

// ─── GROUP CAPACITY ───────────────────────────────────────────────────────────

export interface GroupCapacitySummary {
  totalDays: number;
  usedDays: number;
  availableDays: number;
  utilization: number;
}

const EMPTY_GROUP: GroupCapacitySummary = { totalDays: 0, usedDays: 0, availableDays: 0, utilization: 0 };

export function calculateCapacityBySquad(
  squadId: string,
  quarter: string,
  state: AppState,
): GroupCapacitySummary {
  const members = state.teamMembers.filter(m => m.squadId === squadId && !m.excludedFromCapacity);
  if (members.length === 0) return EMPTY_GROUP;

  let totalDays = 0;
  let usedDays = 0;

  for (const m of members) {
    const cap = calculateCapacity(m.id, quarter, state);
    totalDays += cap.totalWorkdays;
    usedDays  += cap.usedDays;
  }

  const availableDays = Math.max(0, totalDays - usedDays);
  const utilization = totalDays > 0 ? usedDays / totalDays : 0;
  return {
    totalDays: Math.round(totalDays), usedDays: Math.round(usedDays),
    availableDays: Math.round(availableDays), utilization,
  };
}

export function calculateCapacityByProcessTeam(
  processTeamId: string,
  quarter: string,
  state: AppState,
): GroupCapacitySummary {
  let totalDays = 0;
  let usedDays = 0;

  const itMembers = state.teamMembers.filter(
    m => m.processTeamIds?.includes(processTeamId) && !m.excludedFromCapacity,
  );
  for (const m of itMembers) {
    const cap = calculateCapacity(m.id, quarter, state);
    totalDays += cap.totalWorkdays;
    usedDays  += cap.usedDays;
  }

  const bizContacts = state.businessContacts.filter(
    c => !c.archived && !c.excludedFromCapacity && c.processTeamIds?.includes(processTeamId),
  );
  for (const c of bizContacts) {
    const biz = calculateBusinessCapacityForQuarter(
      c, quarter,
      state.jiraItemBizAssignments,
      state.businessTimeOff,
      state.publicHolidays,
      state.jiraWorkItems,
    );
    const grossDays = biz.availableDays + biz.allocatedDays;
    totalDays += grossDays;
    usedDays  += biz.allocatedDays;
  }

  if (totalDays === 0) return EMPTY_GROUP;

  const availableDays = Math.max(0, totalDays - usedDays);
  const utilization = totalDays > 0 ? usedDays / totalDays : 0;
  return {
    totalDays: Math.round(totalDays), usedDays: Math.round(usedDays),
    availableDays: Math.round(availableDays), utilization,
  };
}

export function weeklyToQuarterly(daysPerWeek: number, workWeeks: number): number {
  return Math.round(daysPerWeek * workWeeks * 10) / 10;
}

export function quarterlyToWeekly(totalDays: number, workWeeks: number): number {
  if (workWeeks === 0) return 0;
  return Math.round((totalDays / workWeeks) * 10) / 10;
}

// ─── SPRINT-LEVEL CAPACITY (F-SP-09 / US-SP-23) ──────────────────────────────

export interface SprintCapacityResult {
  sprint: Sprint;
  totalWorkdays: number;
  allocatedDays: number;
  availableDays: number;
  usedPercent: number;
  isOverloaded: boolean;
}

/**
 * Calculate a team member's capacity for a single sprint, accounting for
 * public holidays, time-off, BAU reserve (prorated), and PlannerItem allocations.
 *
 * @param memberId - the team member
 * @param sprint - sprint to evaluate
 * @param plannerItems - all items on the planner (used to sum existing allocations)
 * @param state - full resolved AppState (use getCurrentState())
 * @param extraDaysPerSprint - additional days to hypothetically add (e.g. the slider value being considered)
 */
export function calculateSprintCapacity(
  memberId: string,
  sprint: Sprint,
  plannerItems: PlannerItem[],
  state: AppState,
  extraDaysPerSprint: number = 0,
): SprintCapacityResult {
  const member = state.teamMembers.find(m => m.id === memberId);
  if (!member) {
    return { sprint, totalWorkdays: 0, allocatedDays: 0, availableDays: 0, usedPercent: 0, isOverloaded: false };
  }

  const holidays = getHolidaysByCountry(
    member.countryId || state.settings.defaultCountryId,
    state.publicHolidays,
  );

  const capacityScale = (member.workingDaysPerWeek ?? 5) / 5;
  const totalWorkdays = getWorkdaysInDateRange(sprint.startDate, sprint.endDate, holidays) * capacityScale;

  const usesPercentBau = member.bauOverride
    ? (member.bauReservePercent != null || member.bauReserveDays == null)
    : (state.settings.bauReservePercent != null || state.settings.bauReserveDays == null);
  const bauProrated = usesPercentBau
    ? calculateTeamMemberBauDays(totalWorkdays, member, state.settings)
    : (() => {
        const bauPerQuarter = member.bauOverride
          ? (member.bauReserveDays ?? 0)
          : (state.settings.bauReserveDays ?? 5);
        const weeksInQuarter = 13;
        const sprintWeeks = state.settings.sprintDurationWeeks || 3;
        return Math.round(((bauPerQuarter / weeksInQuarter) * sprintWeeks) * 10) / 10;
      })();

  const timeOffDays = state.timeOff
    .filter(t => t.memberId === memberId)
    .reduce((sum, t) => {
      const sprintStart = new Date(sprint.startDate + 'T00:00:00');
      const sprintEnd = new Date(sprint.endDate + 'T00:00:00');
      return sum + (getWorkdaysInDateRange(t.startDate, t.endDate, holidays, sprintStart, sprintEnd) * capacityScale);
    }, 0);

  let allocatedDays = 0;
  for (const item of plannerItems) {
    const inRange = sprint.number >= item.startSprint && sprint.number < item.startSprint + item.spanSprints;
    if (!inRange) continue;
    for (const a of item.assignees) {
      if (a.memberId === memberId) allocatedDays += a.daysPerSprint;
    }
  }
  allocatedDays += extraDaysPerSprint;

  const usedDays = bauProrated + timeOffDays + allocatedDays;
  const availableDays = totalWorkdays - usedDays;
  const usedPercent = totalWorkdays > 0 ? Math.round((usedDays / totalWorkdays) * 100) : 0;

  return {
    sprint,
    totalWorkdays,
    allocatedDays: usedDays,
    availableDays,
    usedPercent,
    isOverloaded: availableDays < 0,
  };
}
