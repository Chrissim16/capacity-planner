/**
 * Assignment Suggester — US-052
 *
 * Scores and ranks team members for a given phase/quarter assignment.
 *
 * Scoring weights:
 *   40%  Available capacity  (days free in the quarter vs total workdays)
 *   35%  Skill match         (fraction of required skills covered)
 *   25%  Assignment history  (how often they've worked on this project before)
 */

import type { AppState, TeamMember } from '../types';
import { calculateCapacity } from '../utils/capacity';

export interface SuggestionScore {
  member: TeamMember;
  score: number;         // 0–100
  capacityScore: number; // 0–100
  skillScore: number;    // 0–100
  historyScore: number;  // 0–100
  availableDays: number;
  reasons: string[];
}

interface SuggesterInput {
  projectId: string;
  phaseId?: string;
  quarter: string;
  requiredSkillIds: string[];
  state: AppState;
}

export function suggestAssignees(input: SuggesterInput): SuggestionScore[] {
  const { projectId, phaseId, quarter, requiredSkillIds, state } = input;

  const project = state.projects.find(p => p.id === projectId);

  return state.teamMembers
    .map(member => score(member, projectId, phaseId, quarter, requiredSkillIds, state, project))
    .filter(s => s.availableDays > 0)           // exclude already over-capacity
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);                                // top 5
}

function score(
  member: TeamMember,
  _projectId: string,
  phaseId: string | undefined,
  quarter: string,
  requiredSkillIds: string[],
  state: AppState,
  project: ReturnType<typeof state.projects.find> | undefined
): SuggestionScore {

  // ── 1. Capacity ─────────────────────────────────────────────────────────────
  const cap = calculateCapacity(member.id, quarter, state);
  const availableDays = Math.max(0, cap.availableDaysRaw);
  // Map 0 available → 0, ≥15 days free → 100
  const capacityScore = Math.min(100, Math.round((availableDays / Math.max(cap.totalWorkdays, 1)) * 100));

  // ── 2. Skill match ──────────────────────────────────────────────────────────
  let skillScore = 100; // No required skills → perfect match by default
  if (requiredSkillIds.length > 0) {
    const matched = requiredSkillIds.filter(sid => member.skillIds?.includes(sid)).length;
    skillScore = Math.round((matched / requiredSkillIds.length) * 100);
  }

  // ── 3. Assignment history on this project ──────────────────────────────────
  let historyScore = 0;
  if (project) {
    const pastAssignments = project.phases.reduce((count, ph) => {
      if (phaseId && ph.id === phaseId) return count; // exclude current phase
      return count + ph.assignments.filter(a => a.memberId === member.id).length;
    }, 0);
    // ≥3 prior assignments → 100, 2 → 66, 1 → 33, 0 → 0
    historyScore = Math.min(100, pastAssignments * 33);
  }

  const composite = Math.round(
    capacityScore * 0.40 +
    skillScore    * 0.35 +
    historyScore  * 0.25
  );

  // ── Reasons ─────────────────────────────────────────────────────────────────
  const reasons: string[] = [];
  if (availableDays > 0) {
    reasons.push(`${availableDays}d free`);
  }
  if (requiredSkillIds.length > 0) {
    if (skillScore === 100) reasons.push('All skills match');
    else if (skillScore > 0) reasons.push(`${skillScore}% skills`);
  }
  if (historyScore > 0) reasons.push('Worked on this project');

  return {
    member,
    score: composite,
    capacityScore,
    skillScore,
    historyScore,
    availableDays,
    reasons,
  };
}
