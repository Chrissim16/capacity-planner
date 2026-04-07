import type { AllocationSegment, EpicPhaseAssignment } from '../types';

export function cloneSegmentsForReplacement(segments?: AllocationSegment[]): AllocationSegment[] | undefined {
  if (!segments || segments.length === 0) return undefined;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return segments.map((segment, index) => ({
    ...segment,
    id: `local-replace-${stamp}-${index}`,
  }));
}

export function applyScenarioAssignmentReplacement(
  assignments: EpicPhaseAssignment[],
  assignment: EpicPhaseAssignment,
  toMemberId: string,
  toTrack: 'IT' | 'BIZ',
  days: number,
  replacementSegments: AllocationSegment[] | undefined,
  updatedAt: string,
): EpicPhaseAssignment[] {
  const remainingAssignments = assignments.filter(
    (candidate) => !(
      candidate.epicKey === assignment.epicKey
      && candidate.phaseInstanceId === assignment.phaseInstanceId
      && candidate.memberId === assignment.memberId
    ),
  );
  const targetIndex = remainingAssignments.findIndex(
    (candidate) => (
      candidate.epicKey === assignment.epicKey
      && candidate.phaseInstanceId === assignment.phaseInstanceId
      && candidate.memberId === toMemberId
    ),
  );

  const nextSegments = assignment.allocationMode === 'segments'
    ? [...(targetIndex >= 0 ? remainingAssignments[targetIndex].segments ?? [] : []), ...(replacementSegments ?? [])]
    : targetIndex >= 0
      ? remainingAssignments[targetIndex].segments
      : undefined;
  const nextDays = assignment.allocationMode === 'segments'
    ? nextSegments?.reduce((sum, segment) => sum + segment.days, 0) ?? 0
    : days;

  if (targetIndex >= 0) {
    return remainingAssignments.map((candidate, index) => (
      index === targetIndex
        ? {
            ...candidate,
            track: toTrack,
            days: nextDays,
            allocationMode: assignment.allocationMode,
            daysPerWeek: assignment.daysPerWeek,
            segments: nextSegments,
            updatedAt,
          }
        : candidate
    ));
  }

  return [
    ...remainingAssignments,
    {
      id: `local-${assignment.epicKey}-${assignment.phaseInstanceId}-${toMemberId}`,
      epicKey: assignment.epicKey,
      phase: assignment.phase,
      phaseInstanceId: assignment.phaseInstanceId,
      memberId: toMemberId,
      track: toTrack,
      days: nextDays,
      allocationMode: assignment.allocationMode,
      daysPerWeek: assignment.daysPerWeek,
      segments: nextSegments,
      updatedAt,
    },
  ];
}

export function filterAssignmentsForReplacementUpsert(
  assignments: EpicPhaseAssignment[],
  epicKey: string,
  phaseInstanceId: string,
  memberId: string,
  replaceMemberId?: string,
): EpicPhaseAssignment[] {
  return assignments.filter(
    (assignment) => !(
      assignment.epicKey === epicKey
      && assignment.phaseInstanceId === phaseInstanceId
      && (assignment.memberId === memberId || (replaceMemberId !== undefined && assignment.memberId === replaceMemberId))
    ),
  );
}
