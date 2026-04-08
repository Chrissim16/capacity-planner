import type { EpicPhaseAssignment, JiraWorkItem } from '../types';

export function filterAssignmentsToBoardEpics(
  assignments: EpicPhaseAssignment[],
  boardEpics: Array<Pick<JiraWorkItem, 'jiraKey'>>,
): EpicPhaseAssignment[] {
  const boardEpicKeys = new Set(boardEpics.map((epic) => epic.jiraKey));
  return assignments.filter((assignment) => boardEpicKeys.has(assignment.epicKey));
}
