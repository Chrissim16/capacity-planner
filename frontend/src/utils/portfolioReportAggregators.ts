import type { AppState } from '../types';
import {
  buildPortfolioPlanExportData,
  type ExportActorSummary,
  type PortfolioPlanExportData,
  type PortfolioPlanExportInput,
} from './portfolioPlanExport';
import {
  splitInitiativeDirectCosts,
  type PortfolioCostSummary,
} from './costing';
import {
  getPlannedDaysBucketForAssignment,
  getPlanningGroupCategory,
  getTeamMemberAssignmentCategory,
  isPlanningGroupMemberId,
  resolvePlanningGroupPlaceholder,
} from './planningGroups';
import type { PlannedDaysBucket, PlannedDaysTotals } from './planningGroups';
import { mergeProcessTeamsWithDefaults } from './processTeams';
import { matchVsFinanceSquadBucket, mergeSquadsWithDefaults } from './squads';

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export type PortfolioReportLens =
  | 'person'
  | 'processTeam'
  | 'planningGroup'
  | 'epic'
  | 'costs';

export interface PhaseDayBreakdown {
  phaseLabel: string;
  phaseOrder: number;
  visibleDays: number;
  itDays: number;
  bizDays: number;
}

export interface PersonEpicReportRow {
  actorId: string;
  actorName: string;
  epicKey: string;
  epicSummary: string;
  totalVisibleDays: number;
  itDays: number;
  bizDays: number;
  phases: PhaseDayBreakdown[];
}

export interface TeamEpicReportRow {
  teamId: string;
  teamLabel: string;
  epicKey: string;
  epicSummary: string;
  totalVisibleDays: number;
  itDays: number;
  bizDays: number;
  phases: PhaseDayBreakdown[];
}

export interface EpicVendorDays {
  vendorLabel: string;
  visibleDays: number;
}

export interface EpicEffortReportRow {
  epicKey: string;
  epicSummary: string;
  totalVisibleDays: number;
  bucketDays: PlannedDaysTotals;
  externalByVendor: EpicVendorDays[];
}

export interface CostReportRow {
  initiativeId: string;
  initiativeTitle: string;
  totalCost: number;
  itLaborCost: number;
  bizLaborCost: number;
  hardwareCost: number;
  licensesCost: number;
  directCost: number;
  contingencyCost: number;
  missingRateCount: number;
}

/** VS Finance = `it_team_member` category; capacity and planned days for the reporting period. */
export interface VsFinanceOverviewMetrics {
  totalCapacityDays: number;
  totalPlannedDays: number;
  utilizationPercent: number | null;
}

export interface NamedSquadLensMetrics {
  plannedDays: number;
  overCapacityCount: number;
}

/** ERP / EPM buckets from squad display name (case-insensitive, word-boundary match). */
export interface PersonSquadNamedKpis {
  erp: NamedSquadLensMetrics;
  epm: NamedSquadLensMetrics;
}

export interface ProcessTeamKpiCard {
  teamId: string;
  label: string;
  plannedDays: number;
}

export interface PortfolioReportModels {
  planName: string;
  quarterLabel: string;
  reportingCurrency: string;
  healthTotalPlannedDays: number;
  healthEpicCount: number;
  vsFinanceOverview: VsFinanceOverviewMetrics;
  personSquadNamedKpis: PersonSquadNamedKpis;
  processTeamKpiCards: ProcessTeamKpiCard[];
  personEpicRows: PersonEpicReportRow[];
  processTeamEpicRows: TeamEpicReportRow[];
  planningGroupEpicRows: TeamEpicReportRow[];
  epicEffortRows: EpicEffortReportRow[];
  costRows: CostReportRow[];
}

function externalVendorLabel(memberId: string, state: AppState): string {
  const group = resolvePlanningGroupPlaceholder(memberId, state.businessTeams);
  if (group && getPlanningGroupCategory(group) === 'external_partner') {
    if (group.externalVendorId) {
      const vendor = state.externalVendors.find((v) => v.id === group.externalVendorId);
      return vendor?.name ?? 'Vendor not found';
    }
    return 'External partner (no vendor)';
  }

  const member = state.teamMembers.find((m) => m.id === memberId);
  if (member?.workerType === 'external') {
    if (!member.externalVendorId) return 'External (no vendor)';
    const vendor = state.externalVendors.find((v) => v.id === member.externalVendorId);
    return vendor?.name ?? 'Vendor not found';
  }

  return 'External';
}

type RollupKeyFn = (args: {
  memberId: string;
  state: AppState;
}) => { id: string; label: string }[];

const rollupKeysProcessTeam: RollupKeyFn = ({ memberId, state }) => {
  if (isPlanningGroupMemberId(memberId, state.businessTeams)) return [];
  const member = state.teamMembers.find((m) => m.id === memberId);
  if (!member) return [];
  const processTeams = mergeProcessTeamsWithDefaults(state.processTeams);
  const ids = member.processTeamIds?.length ? member.processTeamIds : [];
  if (ids.length === 0) {
    return [{ id: '__no_process_team__', label: '(No process team)' }];
  }
  return ids.map((id) => {
    const pt = processTeams.find((p) => p.id === id);
    return { id, label: pt?.name ?? id };
  });
};

const rollupKeysPlanningGroup: RollupKeyFn = ({ memberId, state }) => {
  if (!isPlanningGroupMemberId(memberId, state.businessTeams)) return [];
  const group = resolvePlanningGroupPlaceholder(memberId, state.businessTeams);
  if (group) {
    return [{ id: group.id, label: group.name }];
  }
  return [{ id: memberId, label: memberId }];
};

function upsertPhase(
  phases: PhaseDayBreakdown[],
  phaseLabel: string,
  phaseOrder: number,
  visible: number,
  it: number,
  biz: number,
): void {
  const found = phases.find((p) => p.phaseLabel === phaseLabel);
  if (found) {
    found.visibleDays = roundTenth(found.visibleDays + visible);
    found.itDays = roundTenth(found.itDays + it);
    found.bizDays = roundTenth(found.bizDays + biz);
  } else {
    phases.push({
      phaseLabel,
      phaseOrder,
      visibleDays: roundTenth(visible),
      itDays: roundTenth(it),
      bizDays: roundTenth(biz),
    });
  }
}

function sortPhases(phases: PhaseDayBreakdown[]): PhaseDayBreakdown[] {
  return [...phases].sort((a, b) => {
    if (a.phaseOrder !== b.phaseOrder) return a.phaseOrder - b.phaseOrder;
    return a.phaseLabel.localeCompare(b.phaseLabel);
  });
}

function buildPersonEpicRows(data: PortfolioPlanExportData): PersonEpicReportRow[] {
  const map = new Map<string, PersonEpicReportRow>();

  for (const epic of data.epics) {
    for (const phase of epic.phases) {
      for (const a of phase.assignments) {
        const key = `${a.actor.id}\t${epic.epic.jiraKey}`;
        let row = map.get(key);
        if (!row) {
          row = {
            actorId: a.actor.id,
            actorName: a.actor.name,
            epicKey: epic.epic.jiraKey,
            epicSummary: epic.epic.summary,
            totalVisibleDays: 0,
            itDays: 0,
            bizDays: 0,
            phases: [],
          };
          map.set(key, row);
        }
        row.totalVisibleDays = roundTenth(row.totalVisibleDays + a.visibleDays);
        if (a.track === 'IT') row.itDays = roundTenth(row.itDays + a.visibleDays);
        else row.bizDays = roundTenth(row.bizDays + a.visibleDays);
        upsertPhase(
          row.phases,
          phase.phaseLabel,
          phase.phaseOrder,
          a.visibleDays,
          a.track === 'IT' ? a.visibleDays : 0,
          a.track === 'BIZ' ? a.visibleDays : 0,
        );
      }
    }
  }

  return [...map.values()]
    .map((r) => ({ ...r, phases: sortPhases(r.phases) }))
    .sort((x, y) => {
      const c = x.actorName.localeCompare(y.actorName);
      return c !== 0 ? c : x.epicKey.localeCompare(y.epicKey);
    });
}

function buildTeamEpicRows(
  data: PortfolioPlanExportData,
  state: AppState,
  keysFn: RollupKeyFn,
): TeamEpicReportRow[] {
  const map = new Map<string, TeamEpicReportRow>();

  for (const epic of data.epics) {
    for (const phase of epic.phases) {
      for (const a of phase.assignments) {
        const memberId = a.actor.id;
        const rollups = keysFn({ memberId, state });
        for (const rk of rollups) {
          const key = `${rk.id}\t${epic.epic.jiraKey}`;
          let row = map.get(key);
          if (!row) {
            row = {
              teamId: rk.id,
              teamLabel: rk.label,
              epicKey: epic.epic.jiraKey,
              epicSummary: epic.epic.summary,
              totalVisibleDays: 0,
              itDays: 0,
              bizDays: 0,
              phases: [],
            };
            map.set(key, row);
          }
          row.totalVisibleDays = roundTenth(row.totalVisibleDays + a.visibleDays);
          if (a.track === 'IT') row.itDays = roundTenth(row.itDays + a.visibleDays);
          else row.bizDays = roundTenth(row.bizDays + a.visibleDays);
          upsertPhase(
            row.phases,
            phase.phaseLabel,
            phase.phaseOrder,
            a.visibleDays,
            a.track === 'IT' ? a.visibleDays : 0,
            a.track === 'BIZ' ? a.visibleDays : 0,
          );
        }
      }
    }
  }

  return [...map.values()]
    .map((r) => ({ ...r, phases: sortPhases(r.phases) }))
    .sort((x, y) => {
      const c = x.teamLabel.localeCompare(y.teamLabel);
      return c !== 0 ? c : x.epicKey.localeCompare(y.epicKey);
    });
}

function emptyTotals(): PlannedDaysTotals {
  return {
    total: 0,
    it_team_members: 0,
    business_owners_and_teams: 0,
    other_it_teams: 0,
    external_partners: 0,
  };
}

function addToTotals(t: PlannedDaysTotals, bucket: PlannedDaysBucket, days: number): void {
  t.total = roundTenth(t.total + days);
  if (bucket !== 'total') {
    t[bucket] = roundTenth(t[bucket] + days);
  }
}

function buildEpicEffortRows(data: PortfolioPlanExportData, state: AppState): EpicEffortReportRow[] {
  const rows: EpicEffortReportRow[] = [];

  for (const epic of data.epics) {
    const bucketDays = emptyTotals();
    const vendorMap = new Map<string, number>();

    for (const phase of epic.phases) {
      for (const asg of phase.assignments) {
        const bucket = getPlannedDaysBucketForAssignment(
          { memberId: asg.actor.id, track: asg.track },
          state,
        );
        addToTotals(bucketDays, bucket, asg.visibleDays);

        if (bucket === 'external_partners') {
          const label = externalVendorLabel(asg.actor.id, state);
          vendorMap.set(label, roundTenth((vendorMap.get(label) ?? 0) + asg.visibleDays));
        }
      }
    }

    const externalByVendor = [...vendorMap.entries()]
      .map(([vendorLabel, visibleDays]) => ({ vendorLabel, visibleDays }))
      .sort((a, b) => b.visibleDays - a.visibleDays || a.vendorLabel.localeCompare(b.vendorLabel));

    rows.push({
      epicKey: epic.epic.jiraKey,
      epicSummary: epic.epic.summary,
      totalVisibleDays: epic.visibleDays,
      bucketDays,
      externalByVendor,
    });
  }

  return rows.sort((a, b) => a.epicKey.localeCompare(b.epicKey));
}

function buildCostRows(state: AppState, costSummary: PortfolioCostSummary): CostReportRow[] {
  const fx = state.settings.costing.fxToEur;
  const reportingCurrency = costSummary.reportingCurrency;

  return costSummary.initiatives
    .map((init) => {
      const { hardware, licenses } = splitInitiativeDirectCosts(
        init.directCostRecord,
        reportingCurrency,
        fx,
      );
      return {
        initiativeId: init.initiativeId,
        initiativeTitle: init.initiativeTitle,
        totalCost: init.totalCost,
        itLaborCost: init.itLaborCost,
        bizLaborCost: init.bizLaborCost,
        hardwareCost: hardware,
        licensesCost: licenses,
        directCost: init.directCost,
        contingencyCost: init.contingencyCost,
        missingRateCount: init.missingRateCount,
      };
    })
    .sort((a, b) => a.initiativeId.localeCompare(b.initiativeId));
}

function collectActorSummariesFromExport(data: PortfolioPlanExportData): Map<string, ExportActorSummary> {
  const map = new Map<string, ExportActorSummary>();
  for (const epic of data.epics) {
    for (const phase of epic.phases) {
      for (const asg of phase.assignments) {
        map.set(asg.actor.id, asg.actor);
      }
    }
  }
  return map;
}

function isVsFinanceTeamMember(state: AppState, memberId: string): boolean {
  const member = state.teamMembers.find((m) => m.id === memberId);
  if (!member || member.excludedFromCapacity) return false;
  return getTeamMemberAssignmentCategory(member) === 'it_team_member';
}

function computeVsFinanceOverview(
  state: AppState,
  actorById: Map<string, ExportActorSummary>,
): VsFinanceOverviewMetrics {
  let totalCapacityDays = 0;
  let totalPlannedDays = 0;
  for (const member of state.teamMembers) {
    if (!isVsFinanceTeamMember(state, member.id)) continue;
    const a = actorById.get(member.id);
    if (!a) continue;
    const avail = a.availableDays ?? 0;
    totalCapacityDays = roundTenth(totalCapacityDays + avail);
    totalPlannedDays = roundTenth(totalPlannedDays + a.visibleAssignedDays);
  }
  const utilizationPercent =
    totalCapacityDays > 0 ? roundTenth((totalPlannedDays / totalCapacityDays) * 100) : null;
  return { totalCapacityDays, totalPlannedDays, utilizationPercent };
}

function emptyNamedSquadMetrics(): NamedSquadLensMetrics {
  return { plannedDays: 0, overCapacityCount: 0 };
}

function computePersonSquadNamedKpis(
  state: AppState,
  actorById: Map<string, ExportActorSummary>,
): PersonSquadNamedKpis {
  const erp = emptyNamedSquadMetrics();
  const epm = emptyNamedSquadMetrics();
  const squads = mergeSquadsWithDefaults(state.squads);
  for (const member of state.teamMembers) {
    if (!isVsFinanceTeamMember(state, member.id)) continue;
    if (!member.squadId) continue;
    const squad = squads.find((s) => s.id === member.squadId);
    const bucket = squad?.name ? matchVsFinanceSquadBucket(squad.name) : null;
    if (!bucket) continue;
    const target = bucket === 'erp' ? erp : epm;
    const a = actorById.get(member.id);
    if (!a) continue;
    target.plannedDays = roundTenth(target.plannedDays + a.visibleAssignedDays);
    if (a.utilization !== null && a.utilization > 1) {
      target.overCapacityCount += 1;
    }
  }
  return { erp, epm };
}

const MAX_PROCESS_TEAM_KPI_CARDS = 6;

function buildProcessTeamKpiCards(rows: TeamEpicReportRow[]): ProcessTeamKpiCard[] {
  const agg = new Map<string, { label: string; days: number }>();
  for (const r of rows) {
    const cur = agg.get(r.teamId) ?? { label: r.teamLabel, days: 0 };
    cur.days = roundTenth(cur.days + r.totalVisibleDays);
    agg.set(r.teamId, cur);
  }
  return [...agg.entries()]
    .map(([teamId, v]) => ({ teamId, label: v.label, plannedDays: v.days }))
    .sort((a, b) => b.plannedDays - a.plannedDays || a.label.localeCompare(b.label))
    .slice(0, MAX_PROCESS_TEAM_KPI_CARDS);
}

/**
 * Single export pass, then matrices for portfolio report UI + structured PDF.
 * Uses the same period and board slice as `buildPortfolioPlanExportData`.
 */
export function buildPortfolioReportModels(
  exportInput: PortfolioPlanExportInput,
  costSummary: PortfolioCostSummary,
): PortfolioReportModels {
  const data = buildPortfolioPlanExportData(exportInput);
  const state = exportInput.state;
  const actorById = collectActorSummariesFromExport(data);
  const processTeamEpicRows = buildTeamEpicRows(data, state, rollupKeysProcessTeam);

  return {
    planName: data.planName,
    quarterLabel: data.quarterLabel,
    reportingCurrency: costSummary.reportingCurrency,
    healthTotalPlannedDays: data.health.totalPlannedDays,
    healthEpicCount: data.health.epicCount,
    vsFinanceOverview: computeVsFinanceOverview(state, actorById),
    personSquadNamedKpis: computePersonSquadNamedKpis(state, actorById),
    processTeamKpiCards: buildProcessTeamKpiCards(processTeamEpicRows),
    personEpicRows: buildPersonEpicRows(data),
    processTeamEpicRows,
    planningGroupEpicRows: buildTeamEpicRows(data, state, rollupKeysPlanningGroup),
    epicEffortRows: buildEpicEffortRows(data, state),
    costRows: buildCostRows(state, costSummary),
  };
}
