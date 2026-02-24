/**
 * Capacity calculation utilities
 * Pure functions - no side effects, fully testable
 */

import type {
  AppState,
  CapacityResult,
  CapacityBreakdownItem,
  CapacityStatus,
  Warnings,
  Sprint,
  Assignment,
} from '../types';
import { 
  getWorkdaysInQuarter, 
  getHolidaysByCountry, 
  isQuarterInRange,
  parseQuarter,
  getCurrentQuarter,
  getWorkdaysInDateRangeForQuarter,
} from './calendar';
import { getForecastedDays } from './confidence';

/** Map a Jira sprint name to a quarter string ("Q1 2026") using configured sprints. */
export function sprintNameToQuarter(sprintName: string | undefined, sprints: Sprint[]): string | null {
  if (!sprintName) return null;
  const lower = sprintName.toLowerCase();
  const match = sprints.find(s => lower.includes(s.name.toLowerCase()));
  return match ? match.quarter : null;
}

function phaseOverlapsQuarter(phase: { startDate?: string; endDate?: string; startQuarter?: string; endQuarter?: string }, quarter: string): boolean {
  if (phase.startDate && phase.endDate) {
    const q = parseQuarter(quarter);
    if (!q) return false;
    const start = new Date(phase.startDate);
    const end = new Date(phase.endDate);
    return start <= q.end && end >= q.start;
  }
  if (phase.startQuarter && phase.endQuarter) {
    return isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter);
  }
  return false;
}

function getPhaseAssignments(
  state: AppState,
  projectId: string,
  phase: { id: string; assignments: Assignment[] }
): Assignment[] {
  if (state.assignments && state.assignments.length > 0) {
    return state.assignments.filter(a => a.projectId === projectId && a.phaseId === phase.id);
  }
  return phase.assignments;
}

/**
 * Calculate capacity for a team member in a specific quarter
 */
export function calculateCapacity(
  memberId: string,
  quarter: string,
  state: AppState
): CapacityResult {
  const member = state.teamMembers.find(m => m.id === memberId);
  if (!member) {
    return {
      totalWorkdays: 0,
      usedDays: 0,
      availableDays: 0,
      availableDaysRaw: 0,
      usedPercent: 0,
      status: 'normal',
      breakdown: [],
    };
  }

  // Get member's country-specific holidays
  const memberHolidays = getHolidaysByCountry(
    member.countryId || state.settings.defaultCountryId,
    state.publicHolidays
  );
  const totalWorkdays = getWorkdaysInQuarter(quarter, memberHolidays);

  let usedDays = 0;
  const breakdown: CapacityBreakdownItem[] = [];

  // BAU Reserve (in days)
  const bauDays = state.settings.bauReserveDays || 5;
  usedDays += bauDays;
  breakdown.push({ type: 'bau', days: bauDays });

  // Time Off (date-range based — sum working days that overlap this quarter)
  const memberTimeOff = state.timeOff.filter(t => t.memberId === memberId);
  let totalTimeOffDays = 0;
  for (const to of memberTimeOff) {
    totalTimeOffDays += getWorkdaysInDateRangeForQuarter(
      to.startDate,
      to.endDate,
      quarter,
      memberHolidays
    );
  }
  if (totalTimeOffDays > 0) {
    usedDays += totalTimeOffDays;
    breakdown.push({ type: 'timeoff', days: totalTimeOffDays });
  }

  // Project assignments (in days) — only count manual assignments
  const hasJiraSyncedAssignment = new Set<string>();
  state.projects.forEach(project => {
    if (project.status === 'Completed') return;
    
    project.phases.forEach(phase => {
      if (phaseOverlapsQuarter(phase, quarter)) {
        const phaseAssignments = getPhaseAssignments(state, project.id, phase);
        const matchingAssignments = phaseAssignments.filter(
          a => a.memberId === memberId && a.quarter === quarter
        );
        if (matchingAssignments.length > 0) {
          if (matchingAssignments.some(a => a.jiraSynced)) {
            hasJiraSyncedAssignment.add(`${project.id}:${phase.id}`);
          }
          const phaseConfidence = phase.confidenceLevel ?? state.settings.confidenceLevels.defaultLevel;
          const assignDays = matchingAssignments.reduce(
            (sum, a) => sum + getForecastedDays(a.days || 0, phaseConfidence, state.settings.confidenceLevels),
            0
          );
          usedDays += assignDays;
          breakdown.push({
            type: 'project',
            projectId: project.id,
            projectName: project.name,
            phaseId: phase.id,
            phaseName: phase.name,
            days: assignDays,
          });
        }
      }
    });
  });

  // Jira work items — direct capacity link
  // Items with story points assigned to this member count against their capacity,
  // skipping items already covered by a jiraSynced assignment (to avoid double-counting).
  if (member.email && state.jiraWorkItems.length > 0) {
    const memberEmail = member.email.toLowerCase();
    const defaultConfidence = state.jiraSettings?.defaultConfidenceLevel ?? 'medium';

    // Build set of Jira item IDs that are already covered by jiraSynced assignments
    // by checking which items are mapped to phases that have jiraSynced assignments for this member+quarter
    const coveredByAssignment = new Set<string>();
    for (const item of state.jiraWorkItems) {
      if (
        item.mappedProjectId &&
        item.mappedPhaseId &&
        hasJiraSyncedAssignment.has(`${item.mappedProjectId}:${item.mappedPhaseId}`)
      ) {
        coveredByAssignment.add(item.jiraKey);
      }
    }

    let jiraDays = 0;
    const jiraItems: { key: string; summary: string; days: number }[] = [];

    for (const item of state.jiraWorkItems) {
      if (coveredByAssignment.has(item.jiraKey)) continue;
      if (item.statusCategory === 'done') continue;
      if (item.storyPoints == null) continue;
      if (!item.assigneeEmail || item.assigneeEmail.toLowerCase() !== memberEmail) continue;

      const itemQuarter = sprintNameToQuarter(item.sprintName, state.sprints);
      if (itemQuarter !== quarter) continue;

      const confidence = item.confidenceLevel ?? defaultConfidence;
      const days = getForecastedDays(item.storyPoints, confidence, state.settings.confidenceLevels);
      if (days <= 0) continue;

      jiraDays += days;
      jiraItems.push({ key: item.jiraKey, summary: item.summary, days });
    }

    if (jiraDays > 0) {
      usedDays += jiraDays;
      for (const ji of jiraItems) {
        breakdown.push({
          type: 'jira',
          days: ji.days,
          jiraKey: ji.key,
          jiraSummary: ji.summary,
        });
      }
    }
  }

  const availableDaysRaw = totalWorkdays - usedDays; // Can be negative
  const availableDays = Math.max(0, availableDaysRaw);
  const usedPercent = totalWorkdays > 0 
    ? Math.round((usedDays / totalWorkdays) * 100) 
    : 0;

  let status: CapacityStatus = 'normal';
  if (usedDays > totalWorkdays) {
    status = 'overallocated';
  } else if (usedPercent > 90) {
    status = 'warning';
  }

  return {
    totalWorkdays,
    usedDays,
    availableDays,
    availableDaysRaw,
    usedPercent,
    status,
    breakdown,
  };
}

/**
 * Get the number of projects a member is assigned to in a quarter
 */
export function getMemberProjectCount(
  memberId: string,
  quarter: string,
  state: AppState
): number {
  const projects = new Set<string>();
  
  state.projects.forEach(project => {
    if (project.status === 'Completed') return;
    
    project.phases.forEach(phase => {
      if (phaseOverlapsQuarter(phase, quarter)) {
        const phaseAssignments = getPhaseAssignments(state, project.id, phase);
        const hasAssignment = phaseAssignments.some(
          a => a.memberId === memberId && a.quarter === quarter
        );
        if (hasAssignment) {
          projects.add(project.id);
        }
      }
    });
  });
  
  return projects.size;
}

/**
 * Check if a member has all required skills for a phase
 */
export function checkSkillMatch(
  memberId: string,
  requiredSkillIds: string[],
  state: AppState
): { matched: boolean; missingSkills: string[] } {
  const member = state.teamMembers.find(m => m.id === memberId);
  if (!member) {
    return { matched: false, missingSkills: requiredSkillIds };
  }

  const missingSkillIds = requiredSkillIds.filter(
    skillId => !member.skillIds.includes(skillId)
  );
  
  const missingSkills = missingSkillIds.map(skillId => {
    const skill = state.skills.find(s => s.id === skillId);
    return skill?.name || skillId;
  });

  return {
    matched: missingSkills.length === 0,
    missingSkills,
  };
}

/**
 * Get all warnings for the current state
 */
export function getWarnings(state: AppState): Warnings {
  const currentQ = getCurrentQuarter();
  const warnings: Warnings = {
    overallocated: [],
    highUtilization: [],
    tooManyProjects: [],
    skillMismatch: [],
  };

  // Check each team member
  state.teamMembers.forEach(member => {
    const cap = calculateCapacity(member.id, currentQ, state);
    
    if (cap.status === 'overallocated') {
      warnings.overallocated.push({
        member,
        usedDays: cap.usedDays,
        totalDays: cap.totalWorkdays,
        quarter: currentQ,
      });
    } else if (cap.status === 'warning') {
      warnings.highUtilization.push({
        member,
        usedDays: cap.usedDays,
        totalDays: cap.totalWorkdays,
        usedPercent: cap.usedPercent,
        quarter: currentQ,
      });
    }

    const projectCount = getMemberProjectCount(member.id, currentQ, state);
    if (projectCount > member.maxConcurrentProjects) {
      warnings.tooManyProjects.push({
        member,
        count: projectCount,
        max: member.maxConcurrentProjects,
      });
    }
  });

  // Check skill mismatches
  state.projects.forEach(project => {
    if (project.status === 'Completed') return;
    
    project.phases.forEach(phase => {
      if (phase.requiredSkillIds && phase.requiredSkillIds.length > 0) {
        const phaseAssignments = getPhaseAssignments(state, project.id, phase);
        phaseAssignments.forEach(assignment => {
          const member = state.teamMembers.find(m => m.id === assignment.memberId);
          if (!member) return;
          
          const match = checkSkillMatch(
            assignment.memberId,
            phase.requiredSkillIds,
            state
          );
          
          if (!match.matched) {
            warnings.skillMismatch.push({
              member,
              project,
              phase,
              missingSkills: match.missingSkills,
            });
          }
        });
      }
    });
  });

  return warnings;
}

/**
 * Calculate team utilization summary for a quarter
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

  state.teamMembers.forEach(member => {
    const cap = calculateCapacity(member.id, quarter, state);
    totalUtilization += cap.usedPercent;
    
    if (cap.status === 'overallocated') {
      overallocated++;
    } else if (cap.status === 'warning') {
      highUtilization++;
    } else {
      normal++;
    }
  });

  const totalMembers = state.teamMembers.length;
  const averageUtilization = totalMembers > 0 
    ? Math.round(totalUtilization / totalMembers) 
    : 0;

  return {
    totalMembers,
    overallocated,
    highUtilization,
    normal,
    averageUtilization,
  };
}

/**
 * Get project allocation summary
 */
export function getProjectAllocationSummary(
  projectId: string,
  state: AppState
): {
  totalDays: number;
  byQuarter: Record<string, number>;
  byMember: Record<string, number>;
} {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) {
    return { totalDays: 0, byQuarter: {}, byMember: {} };
  }

  let totalDays = 0;
  const byQuarter: Record<string, number> = {};
  const byMember: Record<string, number> = {};

  project.phases.forEach(phase => {
    const phaseAssignments = getPhaseAssignments(state, project.id, phase);
    phaseAssignments.forEach(assignment => {
      totalDays += assignment.days;
      
      byQuarter[assignment.quarter] = 
        (byQuarter[assignment.quarter] || 0) + assignment.days;
      
      byMember[assignment.memberId] = 
        (byMember[assignment.memberId] || 0) + assignment.days;
    });
  });

  return { totalDays, byQuarter, byMember };
}

/**
 * Convert days per week to quarterly total
 */
export function weeklyToQuarterly(
  daysPerWeek: number,
  workWeeks: number
): number {
  return Math.round(daysPerWeek * workWeeks * 10) / 10;
}

/**
 * Convert quarterly total to days per week
 */
export function quarterlyToWeekly(
  totalDays: number,
  workWeeks: number
): number {
  if (workWeeks === 0) return 0;
  return Math.round((totalDays / workWeeks) * 10) / 10;
}
