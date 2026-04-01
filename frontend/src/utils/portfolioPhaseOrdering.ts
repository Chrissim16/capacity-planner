import { PHASES } from './portfolioGeometry';
import type { EpicPhaseAssignment, EpicPhasePlan, PlanningPhase } from '../types';

export interface OrderedPhaseEntry {
  phase: PlanningPhase;
  phaseInstanceId: string;
  phaseOrder: number;
  phaseOrdinal: number;
  plan: EpicPhasePlan | null;
  assignments: EpicPhaseAssignment[];
}

function getDefaultPhaseInstanceId(phase: PlanningPhase): string {
  return phase;
}

function phaseIndex(phase: PlanningPhase): number {
  return PHASES.indexOf(phase);
}

function sortActualEntries(a: Omit<OrderedPhaseEntry, 'phaseOrdinal'>, b: Omit<OrderedPhaseEntry, 'phaseOrdinal'>): number {
  if (a.phaseOrder !== b.phaseOrder) return a.phaseOrder - b.phaseOrder;
  const phaseDiff = phaseIndex(a.phase) - phaseIndex(b.phase);
  if (phaseDiff !== 0) return phaseDiff;
  return a.phaseInstanceId.localeCompare(b.phaseInstanceId);
}

export function getOrderedActualPhaseEntries(
  phasePlans: EpicPhasePlan[],
  phaseAssignments: EpicPhaseAssignment[],
  epicKey: string,
): Array<Omit<OrderedPhaseEntry, 'phaseOrdinal'>> {
  const planByInstance = new Map<string, EpicPhasePlan>();
  for (const plan of phasePlans) {
    if (plan.epicKey !== epicKey) continue;
    planByInstance.set(plan.phaseInstanceId, plan);
  }

  const assignmentsByInstance = new Map<string, EpicPhaseAssignment[]>();
  for (const assignment of phaseAssignments) {
    if (assignment.epicKey !== epicKey) continue;
    if (!assignmentsByInstance.has(assignment.phaseInstanceId)) assignmentsByInstance.set(assignment.phaseInstanceId, []);
    assignmentsByInstance.get(assignment.phaseInstanceId)!.push(assignment);
  }

  const entries: Array<Omit<OrderedPhaseEntry, 'phaseOrdinal'>> = [];
  const seen = new Set<string>();

  for (const plan of planByInstance.values()) {
    entries.push({
      phase: plan.phase,
      phaseInstanceId: plan.phaseInstanceId,
      phaseOrder: plan.phaseOrder,
      plan,
      assignments: assignmentsByInstance.get(plan.phaseInstanceId) ?? [],
    });
    seen.add(plan.phaseInstanceId);
  }

  for (const [phaseInstanceId, assignments] of assignmentsByInstance.entries()) {
    if (seen.has(phaseInstanceId)) continue;
    const phase = assignments[0]?.phase;
    if (!phase) continue;
    entries.push({
      phase,
      phaseInstanceId,
      phaseOrder: phaseInstanceId === getDefaultPhaseInstanceId(phase) ? phaseIndex(phase) : Number.MAX_SAFE_INTEGER,
      plan: null,
      assignments,
    });
  }

  return entries.sort(sortActualEntries);
}

export function getPlaceholderInsertIndex(
  orderedActualEntries: Array<Omit<OrderedPhaseEntry, 'phaseOrdinal'>>,
  phase: PlanningPhase,
): number {
  const targetIndex = phaseIndex(phase);
  const firstAfterIdx = orderedActualEntries.findIndex((entry) => phaseIndex(entry.phase) > targetIndex);
  return firstAfterIdx >= 0 ? firstAfterIdx : orderedActualEntries.length;
}

export function buildOrderedPhaseEntries(
  phasePlans: EpicPhasePlan[],
  phaseAssignments: EpicPhaseAssignment[],
  epicKey: string,
): OrderedPhaseEntry[] {
  const orderedActualEntries = getOrderedActualPhaseEntries(phasePlans, phaseAssignments, epicKey);

  if (orderedActualEntries.length === 0) {
    return PHASES.map((phase, index) => ({
      phase,
      phaseInstanceId: getDefaultPhaseInstanceId(phase),
      phaseOrder: index,
      phaseOrdinal: 1,
      plan: null,
      assignments: [],
    }));
  }

  const rows = [...orderedActualEntries];
  for (const phase of PHASES) {
    if (rows.some((row) => row.phase === phase)) continue;
    rows.splice(getPlaceholderInsertIndex(rows, phase), 0, {
      phase,
      phaseInstanceId: getDefaultPhaseInstanceId(phase),
      phaseOrder: getPlaceholderInsertIndex(rows, phase),
      plan: null,
      assignments: [],
    });
  }

  const phaseCounts = new Map<PlanningPhase, number>();
  return rows.map((row, index) => {
    const phaseOrdinal = (phaseCounts.get(row.phase) ?? 0) + 1;
    phaseCounts.set(row.phase, phaseOrdinal);
    return {
      ...row,
      phaseOrder: row.plan?.phaseOrder ?? index,
      phaseOrdinal,
    };
  });
}

export function upsertPhaseSequencePlans(
  existingPlans: EpicPhasePlan[],
  orderedEntries: Array<{ phase: PlanningPhase; phaseInstanceId: string }>,
  epicKey: string,
  now: string,
): EpicPhasePlan[] {
  const existingByInstance = new Map(
    existingPlans
      .filter((plan) => plan.epicKey === epicKey)
      .map((plan) => [plan.phaseInstanceId, plan] as const),
  );

  const nextEpicPlans = orderedEntries.map((entry, index) => {
    const existing = existingByInstance.get(entry.phaseInstanceId);
    if (existing) return { ...existing, phaseOrder: index, updatedAt: now };
    return {
      id: `local-${epicKey}-${entry.phaseInstanceId}`,
      epicKey,
      phase: entry.phase,
      phaseInstanceId: entry.phaseInstanceId,
      phaseOrder: index,
      startDate: null,
      endDate: null,
      description: null,
      updatedAt: now,
    };
  });

  return [
    ...existingPlans.filter((plan) => plan.epicKey !== epicKey),
    ...nextEpicPlans,
  ];
}
