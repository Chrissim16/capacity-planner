import type { Project, Assignment } from '../types';

/**
 * Flattens all phase assignments from a list of projects into a single array,
 * annotating each assignment with its parent projectId and phaseId.
 */
export function flattenAssignmentsFromProjects(projects: Project[]): Assignment[] {
  const flattened: Assignment[] = [];
  for (const project of projects) {
    for (const phase of project.phases) {
      for (const assignment of phase.assignments ?? []) {
        flattened.push({
          ...assignment,
          projectId: project.id,
          phaseId: phase.id,
        });
      }
    }
  }
  return flattened;
}
