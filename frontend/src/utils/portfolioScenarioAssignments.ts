import type { EpicPhaseAssignment } from '../types';

function normalizePhaseAssignment(
  assignment: EpicPhaseAssignment,
): EpicPhaseAssignment {
  const phaseInstanceId = assignment.phaseInstanceId ?? assignment.phase;
  return phaseInstanceId === assignment.phaseInstanceId
    ? assignment
    : { ...assignment, phaseInstanceId };
}

function getAssignmentKey(assignment: EpicPhaseAssignment): string {
  const phaseInstanceId = assignment.phaseInstanceId ?? assignment.phase;
  return `${assignment.epicKey}::${phaseInstanceId}::${assignment.memberId}`;
}

export function materializeScenarioPhaseAssignments(
  baselineAssignments: EpicPhaseAssignment[],
  scenarioAssignments?: EpicPhaseAssignment[],
): EpicPhaseAssignment[] {
  const normalizedBaseline = baselineAssignments.map(normalizePhaseAssignment);
  if (!scenarioAssignments || scenarioAssignments.length === 0) return normalizedBaseline;

  const normalizedScenario = scenarioAssignments.map(normalizePhaseAssignment);

  // Older scenarios can contain only the rows that were explicitly edited.
  // When the snapshot is very sparse, overlay it onto baseline so summary
  // calculations do not drop all unchanged assignments.
  const shouldTreatScenarioAsSparseOverlay = (
    normalizedBaseline.length > 0
    && normalizedScenario.length < (normalizedBaseline.length / 2)
  );

  if (!shouldTreatScenarioAsSparseOverlay) return normalizedScenario;

  const merged = new Map<string, EpicPhaseAssignment>(
    normalizedBaseline.map((assignment) => [getAssignmentKey(assignment), assignment] as const),
  );

  for (const assignment of normalizedScenario) {
    merged.set(getAssignmentKey(assignment), assignment);
  }

  return [...merged.values()];
}
