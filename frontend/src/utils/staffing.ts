/**
 * Fit scoring engine — shared by SmartAssignmentPanel and ScenarioWizard.
 *
 * All functions are pure given a fully resolved AppState.
 * IMPORTANT: callers must pass `getCurrentState()` output, not `store.data` directly,
 * so that active-scenario overlays (projects, assignments, teamMembers, etc.) are applied.
 */

import type { AppState, BusinessContact, TeamMember, Sprint, PlannerItem } from '../types';
import { calculateCapacity, calculateBusinessCapacityForQuarter, calculateSprintCapacity } from './capacity';

// ─── Public types ────────────────────────────────────────────────────────────

export type FitLevel = 'good' | 'partial' | 'over';

/** A provisional assignment held in UI state before committing to the store. */
export interface TentativeAssignment {
  memberId: string;
  days: number;
}

export interface MemberFit {
  member: TeamMember;
  fitLevel: FitLevel;
  /** Remaining available days after BAU, time-off, Jira items, manual assignments, and tentative days. */
  availableDays: number;
  /** Utilisation percentage from calculateCapacity — drives the mini capacity bar (D8). */
  usedPercent: number;
  /** Skill names from state.skills that match requiredSkillIds. */
  skillMatch: string[];
  /** Required skill names that the member lacks. */
  skillGap: string[];
  /** True when the member has reached maxConcurrentProjects for this quarter. */
  atMaxProjects: boolean;
  /** Days already assigned to THIS project in THIS quarter (D7 "already assigned" badge). */
  existingDays: number;
}

export interface BizFit {
  contact: BusinessContact;
  fitLevel: FitLevel;
  availableDays: number;
  usedPercent: number;
  /** True when the contact has reached maxConcurrentProjects (default 3) for this quarter. */
  atMaxProjects: boolean;
  /** Days already assigned to THIS project in THIS quarter (D7). */
  existingDays: number;
}

// ─── Fit colour tokens ───────────────────────────────────────────────────────
// Import from here in components — never inline these mappings.

export const FIT_COLOURS: Record<FitLevel, { badge: string; border: string; text: string }> = {
  good:    { badge: 'bg-[var(--success-light)] text-[var(--success)]', border: 'border-emerald-500', text: 'text-[var(--success)]' },
  partial: { badge: 'bg-[var(--warning-light)] text-amber-900',         border: 'border-amber-500',   text: 'text-amber-900' },
  over:    { badge: 'bg-mileway-bg text-mileway-grey',                 border: 'border-mileway-border', text: 'text-mileway-grey' },
};

// ─── Glow classes for drag interaction ───────────────────────────────────────

export const FIT_GLOW: Record<FitLevel, string> = {
  good:    'ring-2 ring-[#0089DD]/20 shadow-[0_0_0_3px_rgba(14,211,207,0.2)]',
  partial: 'ring-2 ring-[#D97706]/20 shadow-[0_0_0_3px_rgba(249,115,22,0.2)]',
  over:    'ring-2 ring-[#DC2626]/20 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]',
};

// ─── scoreMember ─────────────────────────────────────────────────────────────

/**
 * Score a single IT team member's fit for a project in a given quarter.
 *
 * @param state - MUST be `getCurrentState()` output, not `store.data` directly.
 *   This ensures active-scenario overlays (assignments, teamMembers, etc.) are applied.
 * @param tentativeAssignments - UI-only provisional assignments not yet persisted to the store.
 *   Only this member's tentative days are subtracted from their available capacity.
 *
 * Callers MUST filter out members with `excludedFromCapacity: true` before calling —
 * this function does not filter internally, as different callers have different needs.
 */
export function scoreMember(
  member: TeamMember,
  quarter: string,
  requiredSkillIds: string[],
  projectId: string,
  state: AppState,
  tentativeAssignments: TentativeAssignment[] = []
): MemberFit {
  try {
    const capacityResult = calculateCapacity(member.id, quarter, state);
    const { usedPercent } = capacityResult;

    // Subtract only this member's tentative days
    const tentativeDays = tentativeAssignments
      .filter(t => t.memberId === member.id)
      .reduce((sum, t) => sum + t.days, 0);
    const adjustedAvailableDays = capacityResult.availableDays - tentativeDays;

    // Skill matching
    // When requiredSkillIds is empty, skill matching is vacuously satisfied —
    // all members are scored on capacity + atMaxProjects alone.
    let skillMatch: string[] = [];
    let skillGap: string[] = [];
    if (requiredSkillIds.length > 0) {
      for (const skillId of requiredSkillIds) {
        const skill = state.skills.find(s => s.id === skillId);
        const skillName = skill?.name ?? skillId;
        if (member.skillIds.includes(skillId)) {
          skillMatch.push(skillName);
        } else {
          skillGap.push(skillName);
        }
      }
    }

    // Max concurrent projects check
    const assignedProjectIds = new Set(
      (state.assignments ?? [])
        .filter(a => a.memberId === member.id && a.quarter === quarter && !a.isBizContact)
        .map(a => a.projectId)
    );
    const maxProjects = member.maxConcurrentProjects ?? 3;
    const atMaxProjects = assignedProjectIds.size >= maxProjects;

    // Days already assigned to THIS project this quarter (D7)
    const existingDays = (state.assignments ?? [])
      .filter(a => a.memberId === member.id && a.projectId === projectId && a.quarter === quarter && !a.isBizContact)
      .reduce((sum, a) => sum + (a.days ?? 0), 0);

    // Determine fit level
    let fitLevel: FitLevel;
    if (adjustedAvailableDays <= 0) {
      fitLevel = 'over';
    } else if (skillGap.length === 0 && !atMaxProjects) {
      fitLevel = 'good';
    } else {
      fitLevel = 'partial';
    }

    return { member, fitLevel, availableDays: adjustedAvailableDays, usedPercent, skillMatch, skillGap, atMaxProjects, existingDays };
  } catch (error) {
    console.error('[staffing] scoreMember failed', { memberId: member.id, quarter, error });
    return {
      member,
      fitLevel: 'over',
      availableDays: 0,
      usedPercent: 100,
      skillMatch: [],
      skillGap: [],
      atMaxProjects: false,
      existingDays: 0,
    };
  }
}

// ─── scoreBusinessContact ─────────────────────────────────────────────────────

/**
 * Score a BIZ contact's fit for a project in a given quarter.
 * Simpler than scoreMember — no skill matching, capacity via calculateBusinessCapacityForQuarter.
 *
 * @param state - MUST be `getCurrentState()` output.
 */
export function scoreBusinessContact(
  contact: BusinessContact,
  quarter: string,
  projectId: string,
  state: AppState,
  tentativeAssignments: TentativeAssignment[] = []
): BizFit {
  try {
    const capacityResult = calculateBusinessCapacityForQuarter(
      contact,
      quarter,
      state.jiraItemBizAssignments,
      state.businessTimeOff,
      state.publicHolidays,
      state.jiraWorkItems
    );
    const { usedPercent } = capacityResult;

    const tentativeDays = tentativeAssignments
      .filter(t => t.memberId === contact.id)
      .reduce((sum, t) => sum + t.days, 0);
    const adjustedAvailableDays = capacityResult.availableDays - tentativeDays;

    // Max concurrent projects for BIZ: count distinct projectIds in scenario assignments
    const assignedProjectIds = new Set(
      (state.assignments ?? [])
        .filter(a => a.memberId === contact.id && a.quarter === quarter && a.isBizContact)
        .map(a => a.projectId)
    );
    const atMaxProjects = assignedProjectIds.size >= 3;

    // Days already assigned to THIS project this quarter (D7)
    const existingDays = (state.assignments ?? [])
      .filter(a => a.memberId === contact.id && a.projectId === projectId && a.quarter === quarter && a.isBizContact)
      .reduce((sum, a) => sum + (a.days ?? 0), 0);

    let fitLevel: FitLevel;
    if (adjustedAvailableDays <= 0) {
      fitLevel = 'over';
    } else if (!atMaxProjects) {
      fitLevel = 'good';
    } else {
      fitLevel = 'partial';
    }

    return { contact, fitLevel, availableDays: adjustedAvailableDays, usedPercent, atMaxProjects, existingDays };
  } catch (error) {
    console.error('[staffing] scoreBusinessContact failed', { contactId: contact.id, quarter, error });
    return { contact, fitLevel: 'over', availableDays: 0, usedPercent: 100, atMaxProjects: false, existingDays: 0 };
  }
}

// ─── rankMemberFits ──────────────────────────────────────────────────────────

/** Sort: good → partial → over; within each tier, most available days first. */
export function rankMemberFits(fits: MemberFit[]): MemberFit[] {
  const order: Record<FitLevel, number> = { good: 0, partial: 1, over: 2 };
  return [...fits].sort((a, b) =>
    order[a.fitLevel] - order[b.fitLevel] ||
    b.availableDays - a.availableDays
  );
}

/** Sort BIZ fits: same ordering as rankMemberFits. */
export function rankBizFits(fits: BizFit[]): BizFit[] {
  const order: Record<FitLevel, number> = { good: 0, partial: 1, over: 2 };
  return [...fits].sort((a, b) =>
    order[a.fitLevel] - order[b.fitLevel] ||
    b.availableDays - a.availableDays
  );
}

// ─── scoreMemberForPlanner (sprint-based, F-SP-09 / US-SP-26) ────────────────

export interface PlannerMemberFit {
  member: TeamMember;
  fitLevel: FitLevel;
  /** Minimum available days across all covered sprints. */
  availableDays: number;
  skillMatch: string[];
  skillGap: string[];
  /** Sprint numbers where the member is overloaded. */
  overloadedSprints: number[];
}

/**
 * Score a team member's fit for a planner item across its sprint range.
 *
 * Tier logic (simplified, per design decision #2):
 *   - **Good**: capacity in all covered sprints AND all required skills matched (or no skills required)
 *   - **Partial**: capacity in all sprints but missing skills
 *   - **Over**: no available capacity in any covered sprint (takes precedence)
 *
 * @param member - the IT team member
 * @param coveredSprints - sprints the item spans
 * @param requiredSkillIds - skill IDs required by the item
 * @param plannerItems - all items for allocation calculations
 * @param state - full resolved state (getCurrentState())
 */
export function scoreMemberForPlanner(
  member: TeamMember,
  coveredSprints: Sprint[],
  requiredSkillIds: string[],
  plannerItems: PlannerItem[],
  state: AppState,
): PlannerMemberFit {
  const overloadedSprints: number[] = [];
  let minAvailable = Infinity;

  for (const sprint of coveredSprints) {
    const cap = calculateSprintCapacity(member.id, sprint, plannerItems, state);
    if (cap.availableDays < minAvailable) minAvailable = cap.availableDays;
    if (cap.isOverloaded) overloadedSprints.push(sprint.number);
  }

  if (coveredSprints.length === 0) minAvailable = 0;

  // Skill matching
  let skillMatch: string[] = [];
  let skillGap: string[] = [];
  if (requiredSkillIds.length > 0) {
    for (const skillId of requiredSkillIds) {
      const skill = state.skills.find(s => s.id === skillId);
      const name = skill?.name ?? skillId;
      if (member.skillIds.includes(skillId)) {
        skillMatch.push(name);
      } else {
        skillGap.push(name);
      }
    }
  }

  // Tier determination: Over > Partial > Good
  let fitLevel: FitLevel;
  if (overloadedSprints.length > 0) {
    fitLevel = 'over';
  } else if (skillGap.length > 0) {
    fitLevel = 'partial';
  } else {
    fitLevel = 'good';
  }

  return {
    member,
    fitLevel,
    availableDays: minAvailable === Infinity ? 0 : minAvailable,
    skillMatch,
    skillGap,
    overloadedSprints,
  };
}

/** Sort planner fits: good → partial → over; then by available days descending. */
export function rankPlannerFits(fits: PlannerMemberFit[]): PlannerMemberFit[] {
  const order: Record<FitLevel, number> = { good: 0, partial: 1, over: 2 };
  return [...fits].sort((a, b) =>
    order[a.fitLevel] - order[b.fitLevel] ||
    b.availableDays - a.availableDays
  );
}
