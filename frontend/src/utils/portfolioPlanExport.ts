import type {
  AppState,
  BusinessContact,
  EpicPhaseAssignment,
  EpicPhasePlan,
  JiraWorkItem,
  PlanningPhase,
} from '../types';
import { calculateBusinessCapacityForQuarter, calculateCapacity } from './capacity';
import { getWorkdaysInDateRange, parseQuarter } from './calendar';
import { stripJiraMarkup } from './markup';
import { buildOrderedPhaseEntries } from './portfolioPhaseOrdering';
import {
  addToPlannedDaysTotals,
  emptyPlannedDaysTotals,
  getPlannedDaysBucketForActor,
  getPlanningGroupPlaceholderDisplay,
  isPlanningGroupPlaceholderId,
  type PlannedDaysTotals,
} from './planningGroups';
import {
  PH_LBL,
  storedPhaseEndDateToDisplayDate,
  totalDaysFromAssignment,
  type QOpt,
} from './portfolioGeometry';

type CellValue = string | number;

export interface ExportActorSummary {
  id: string;
  name: string;
  role: string;
  type: 'person' | 'contact' | 'team' | 'unknown';
  availableDays: number | null;
  visibleAssignedDays: number;
  utilization: number | null;
}

export interface ExportAssignmentDetail {
  actor: ExportActorSummary;
  track: 'IT' | 'BIZ';
  allocation: string;
  totalDays: number;
  visibleDays: number;
  statusNotes: string[];
}

export interface ExportPhaseDetail {
  phase: PlanningPhase;
  phaseLabel: string;
  phaseOrder: number;
  phaseOrdinal: number;
  startDate: string;
  endDate: string;
  dateLabel: string;
  durationWorkdays: number | null;
  description: string;
  totalDays: number;
  visibleDays: number;
  itDays: number;
  bizDays: number;
  assigneeSummary: string;
  statusNotes: string[];
  assignments: ExportAssignmentDetail[];
}

export interface ExportEpicDetail {
  epic: JiraWorkItem;
  epicUrl: string;
  description: string;
  totalDays: number;
  visibleDays: number;
  itDays: number;
  bizDays: number;
  phaseCount: number;
  statusNotes: string[];
  phases: ExportPhaseDetail[];
}

export interface ExportRiskRow {
  severity: 'High' | 'Medium';
  type: 'Epic' | 'Person';
  item: string;
  issue: string;
  detail: string;
  url: string;
}

export interface ExportTeamCapacityRow {
  name: string;
  plannedDays: number;
  availableDays: number;
  utilization: number | null;
  peopleCount: number;
}

export interface PortfolioHealthSummary {
  epicCount: number;
  totalPlannedDays: number;
  totalAvailableDays: number;
  portfolioUtilization: number | null;
  peopleAtRiskCount: number;
  overCapacityPeopleCount: number;
  nearCapacityPeopleCount: number;
  unstaffedEpicCount: number;
  missingPhaseDateCount: number;
}

export interface PortfolioPlanExportData {
  planName: string;
  quarterLabel: string;
  exportedAt: string;
  filenameBase: string;
  health: PortfolioHealthSummary;
  epics: ExportEpicDetail[];
  teamCapacityRows: ExportTeamCapacityRow[];
  risks: ExportRiskRow[];
  overviewRows: CellValue[][];
  epicViewRows: CellValue[][];
  riskRows: CellValue[][];
  csvRows: CellValue[][];
}

export interface PortfolioPlanExportInput {
  planName: string;
  quarterLabel: string;
  quarterOpt: QOpt;
  boardEpics: JiraWorkItem[];
  phasePlans: EpicPhasePlan[];
  phaseAssignments: EpicPhaseAssignment[];
  state: AppState;
  jiraBaseUrl?: string;
  exportedAt?: Date;
}

function buildHistoricMemberLookup(state: AppState): Map<string, { name: string; role: string }> {
  const historicMembers = new Map<string, { name: string; role: string }>();

  for (const scenario of state.scenarios) {
    for (const member of scenario.teamMembers ?? []) {
      if (!historicMembers.has(member.id)) {
        historicMembers.set(member.id, { name: member.name, role: member.role });
      }
    }
  }

  return historicMembers;
}

function resolveActorIdentity(
  id: string,
  state: AppState,
  historicMembers: Map<string, { name: string; role: string }>,
): Pick<ExportActorSummary, 'id' | 'name' | 'role' | 'type'> {
  if (isPlanningGroupPlaceholderId(id)) {
    const group = getPlanningGroupPlaceholderDisplay(id, state.businessTeams);
    return {
      id,
      name: group.name,
      role: group.roleLabel,
      type: 'team',
    };
  }

  const member = state.teamMembers.find((item) => item.id === id);
  if (member) {
    return {
      id,
      name: member.name,
      role: member.role,
      type: 'person',
    };
  }

  const contact = state.businessContacts.find((item) => item.id === id);
  if (contact) {
    return {
      id,
      name: contact.name,
      role: contact.title ?? '',
      type: 'contact',
    };
  }

  const historicMember = historicMembers.get(id);
  if (historicMember) {
    return {
      id,
      name: historicMember.name,
      role: historicMember.role || 'Former team member',
      type: 'person',
    };
  }

  return {
    id,
    name: 'Unresolved assignee',
    role: 'Reference only',
    type: 'unknown',
  };
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${Math.round(value * 100)}%`;
}

function cleanText(value?: string | null): string {
  if (!value) return '';
  return stripJiraMarkup(value).replace(/\s+/g, ' ').trim();
}

function sanitizeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'portfolio-plan';
}

function getCapacityQuarters(qOpt: QOpt): string[] {
  if (qOpt.q === -1) {
    return [0, 1, 2, 3].map((quarter) => `Q${quarter + 1} ${qOpt.year}`);
  }
  return [`Q${qOpt.q + 1} ${qOpt.year}`];
}

function getQuarterDateRange(qOpt: QOpt): { start: Date; end: Date } {
  if (qOpt.q === -1) {
    return { start: new Date(qOpt.year, 0, 1), end: new Date(qOpt.year, 11, 31) };
  }

  const parsed = parseQuarter(`Q${qOpt.q + 1} ${qOpt.year}`);
  return parsed
    ? { start: parsed.start, end: parsed.end }
    : { start: new Date(qOpt.year, 0, 1), end: new Date(qOpt.year, 11, 31) };
}

function calculateMemberAvailableDays(memberId: string, qOpt: QOpt, state: AppState): number {
  return getCapacityQuarters(qOpt)
    .reduce((sum, quarter) => sum + calculateCapacity(memberId, quarter, state).availableDays, 0);
}

function calculateBusinessAvailableDays(contact: BusinessContact, qOpt: QOpt, state: AppState): number {
  return getCapacityQuarters(qOpt).reduce((sum, quarter) => (
    sum + calculateBusinessCapacityForQuarter(
      contact,
      quarter,
      state.jiraItemBizAssignments,
      state.businessTimeOff,
      state.publicHolidays,
      state.jiraWorkItems,
    ).availableDays
  ), 0);
}

function getPhaseDisplayLabel(phase: PlanningPhase, phaseOrdinal: number): string {
  return phaseOrdinal > 1 ? `${PH_LBL[phase]} ${phaseOrdinal}` : PH_LBL[phase];
}

function getPhaseInstanceRows(
  phasePlans: EpicPhasePlan[],
  phaseAssignments: EpicPhaseAssignment[],
  epicKey: string,
) {
  return buildOrderedPhaseEntries(phasePlans, phaseAssignments, epicKey)
    .filter((row) => row.plan !== null || row.assignments.length > 0);
}

function getAssignmentDaysForPeriod(
  assignment: EpicPhaseAssignment,
  phaseStartDate: string | null,
  phaseEndDate: string | null,
  qOpt: QOpt,
): number {
  const quarterRange = getQuarterDateRange(qOpt);

  if (assignment.allocationMode === 'segments') {
    return roundToTenth((assignment.segments ?? []).reduce((sum, segment) => {
      const segmentWorkdays = getWorkdaysInDateRange(segment.startDate, segment.endDate);
      if (segmentWorkdays <= 0) return sum;

      const overlapWorkdays = getWorkdaysInDateRange(
        segment.startDate,
        segment.endDate,
        [],
        quarterRange.start,
        quarterRange.end,
      );
      if (overlapWorkdays <= 0) return sum;

      return sum + (segment.days * overlapWorkdays) / segmentWorkdays;
    }, 0));
  }

  if (!phaseStartDate || !phaseEndDate) return assignment.days;

  const phaseWorkdays = getWorkdaysInDateRange(phaseStartDate, phaseEndDate);
  if (phaseWorkdays <= 0) return 0;

  const overlapWorkdays = getWorkdaysInDateRange(
    phaseStartDate,
    phaseEndDate,
    [],
    quarterRange.start,
    quarterRange.end,
  );
  if (overlapWorkdays <= 0) return 0;

  if (assignment.allocationMode === 'rate') {
    return roundToTenth((assignment.daysPerWeek ?? 0) * (overlapWorkdays / 5));
  }

  const totalAssignedDays = totalDaysFromAssignment(assignment, phaseStartDate, phaseEndDate);
  return roundToTenth((totalAssignedDays * overlapWorkdays) / phaseWorkdays);
}

function getAssignmentAllocationLabel(assignment: EpicPhaseAssignment): string {
  if (assignment.allocationMode === 'rate') {
    return `${assignment.daysPerWeek ?? 0}d/wk`;
  }
  if (assignment.allocationMode === 'segments') {
    const segments = (assignment.segments ?? [])
      .map((segment) => `${segment.startDate} to ${segment.endDate}: ${segment.days}d`)
      .join('; ');
    return segments ? `Segments: ${segments}` : 'Segments';
  }
  return `${assignment.days}d total`;
}

function resolveEpicUrl(epicKey: string, jiraBaseUrl: string): string {
  if (!jiraBaseUrl || epicKey.startsWith('MAN-')) return '';
  return `${jiraBaseUrl.replace(/\/+$/, '')}/browse/${epicKey}`;
}

function toIsoTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function buildActorSummaryMap(
  state: AppState,
  qOpt: QOpt,
  visibleAssignedDays: Map<string, number>,
): Map<string, ExportActorSummary> {
  const summaries = new Map<string, ExportActorSummary>();
  const historicMembers = buildHistoricMemberLookup(state);

  const addSummary = (id: string, summary: ExportActorSummary) => {
    summaries.set(id, {
      ...summary,
      visibleAssignedDays: roundToTenth(visibleAssignedDays.get(id) ?? 0),
      utilization: summary.availableDays && summary.availableDays > 0
        ? roundToTenth((visibleAssignedDays.get(id) ?? 0) / summary.availableDays)
        : null,
    });
  };

  for (const member of state.teamMembers) {
    addSummary(member.id, {
      id: member.id,
      name: member.name,
      role: member.role,
      type: 'person',
      availableDays: member.excludedFromCapacity ? 0 : roundToTenth(calculateMemberAvailableDays(member.id, qOpt, state)),
      visibleAssignedDays: 0,
      utilization: null,
    });
  }

  for (const contact of state.businessContacts) {
    addSummary(contact.id, {
      id: contact.id,
      name: contact.name,
      role: contact.title ?? '',
      type: 'contact',
      availableDays: contact.archived || contact.excludedFromCapacity ? 0 : roundToTenth(calculateBusinessAvailableDays(contact, qOpt, state)),
      visibleAssignedDays: 0,
      utilization: null,
    });
  }

  for (const id of visibleAssignedDays.keys()) {
    if (summaries.has(id)) continue;
    const actor = resolveActorIdentity(id, state, historicMembers);
    summaries.set(id, {
      ...actor,
      availableDays: null,
      visibleAssignedDays: roundToTenth(visibleAssignedDays.get(id) ?? 0),
      utilization: null,
    });
  }

  return summaries;
}

function addSection(
  rows: CellValue[][],
  title: string,
  headers: CellValue[],
  sectionRows: CellValue[][],
): void {
  rows.push([title]);
  rows.push(headers);
  if (sectionRows.length === 0) {
    rows.push(['No data']);
  } else {
    rows.push(...sectionRows);
  }
  rows.push([]);
}

function buildPortfolioCsvRows(epics: ExportEpicDetail[]): CellValue[][] {
  const rows: CellValue[][] = [[
    'Epic Key',
    'Epic Summary',
    'Phase',
    'Phase Dates',
    'Phase Description',
    'Person / Team',
    'Reference ID',
    'Role / Team',
    'Track',
    'Allocation',
    'Total Planned Days',
    'Selected Period Days',
    'Available Days',
    'Utilisation',
    'Phase Status',
    'Assignment Status',
    'Jira URL',
  ]];

  for (const epic of epics) {
    if (epic.phases.length === 0) {
      rows.push([
        epic.epic.jiraKey,
        epic.epic.summary,
        '',
        '',
        epic.description,
        '',
        '',
        '',
        '',
        '',
        epic.totalDays,
        epic.visibleDays,
        '',
        '',
        epic.statusNotes.join('; '),
        '',
        epic.epicUrl,
      ]);
      continue;
    }

    for (const phase of epic.phases) {
      if (phase.assignments.length === 0) {
        rows.push([
          epic.epic.jiraKey,
          epic.epic.summary,
          phase.phaseLabel,
          phase.dateLabel,
          phase.description,
          '',
          '',
          '',
          '',
          '',
          phase.totalDays,
          phase.visibleDays,
          '',
          '',
          phase.statusNotes.join('; '),
          '',
          epic.epicUrl,
        ]);
        continue;
      }

      for (const assignment of phase.assignments) {
        rows.push([
          epic.epic.jiraKey,
          epic.epic.summary,
          phase.phaseLabel,
          phase.dateLabel,
          phase.description,
          assignment.actor.name,
          assignment.actor.id,
          assignment.actor.role,
          assignment.track,
          assignment.allocation,
          assignment.totalDays,
          assignment.visibleDays,
          assignment.actor.availableDays ?? 'N/A',
          formatPercent(assignment.actor.utilization),
          phase.statusNotes.join('; '),
          assignment.statusNotes.join('; '),
          epic.epicUrl,
        ]);
      }
    }
  }

  return rows;
}

export function buildPortfolioPlanExportData({
  planName,
  quarterLabel,
  quarterOpt,
  boardEpics,
  phasePlans,
  phaseAssignments,
  state,
  jiraBaseUrl = '',
  exportedAt = new Date(),
}: PortfolioPlanExportInput): PortfolioPlanExportData {
  const visibleAssignedDaysByActor = new Map<string, number>();
  const historicMembers = buildHistoricMemberLookup(state);

  const epicDetails = boardEpics.map((epic): ExportEpicDetail => {
    const rows = getPhaseInstanceRows(
      phasePlans.filter((plan) => plan.epicKey === epic.jiraKey),
      phaseAssignments.filter((assignment) => assignment.epicKey === epic.jiraKey),
      epic.jiraKey,
    );

    const phases = rows.map((row): ExportPhaseDetail => {
      const totalDays = roundToTenth(row.assignments.reduce(
        (sum, assignment) => sum + totalDaysFromAssignment(assignment, row.plan?.startDate ?? null, row.plan?.endDate ?? null),
        0,
      ));
      const visibleDays = roundToTenth(row.assignments.reduce(
        (sum, assignment) => sum + getAssignmentDaysForPeriod(assignment, row.plan?.startDate ?? null, row.plan?.endDate ?? null, quarterOpt),
        0,
      ));
      const itDays = roundToTenth(row.assignments
        .filter((assignment) => assignment.track === 'IT')
        .reduce((sum, assignment) => sum + totalDaysFromAssignment(assignment, row.plan?.startDate ?? null, row.plan?.endDate ?? null), 0));
      const bizDays = roundToTenth(row.assignments
        .filter((assignment) => assignment.track === 'BIZ')
        .reduce((sum, assignment) => sum + totalDaysFromAssignment(assignment, row.plan?.startDate ?? null, row.plan?.endDate ?? null), 0));
      const startDate = row.plan?.startDate ?? '';
      const endDate = row.plan?.endDate ? storedPhaseEndDateToDisplayDate(row.plan.endDate) : '';
      const dateLabel = startDate
        ? endDate ? `${startDate} -> ${endDate}` : startDate
        : '';
      const durationWorkdays = startDate && endDate ? getWorkdaysInDateRange(startDate, endDate) : null;

      const assignments = row.assignments.map((assignment): ExportAssignmentDetail => {
        const totalAssignmentDays = roundToTenth(totalDaysFromAssignment(
          assignment,
          row.plan?.startDate ?? null,
          row.plan?.endDate ?? null,
        ));
        const visibleAssignmentDays = roundToTenth(getAssignmentDaysForPeriod(
          assignment,
          row.plan?.startDate ?? null,
          row.plan?.endDate ?? null,
          quarterOpt,
        ));
        visibleAssignedDaysByActor.set(
          assignment.memberId,
          roundToTenth((visibleAssignedDaysByActor.get(assignment.memberId) ?? 0) + visibleAssignmentDays),
        );

        const actorIdentity = resolveActorIdentity(assignment.memberId, state, historicMembers);

        return {
          actor: {
            ...actorIdentity,
            availableDays: null,
            visibleAssignedDays: visibleAssignmentDays,
            utilization: null,
          },
          track: assignment.track,
          allocation: getAssignmentAllocationLabel(assignment),
          totalDays: totalAssignmentDays,
          visibleDays: visibleAssignmentDays,
          statusNotes: [],
        };
      });

      const assigneeSummary = assignments.map((assignment) => assignment.actor.name).join(', ');
      const statusNotes: string[] = [];
      if (row.assignments.length === 0) statusNotes.push('No staffing assigned');
      if (row.assignments.length > 0 && !row.plan?.startDate) statusNotes.push('Missing start date');
      if (row.assignments.length > 0 && row.plan?.startDate && !row.plan?.endDate) statusNotes.push('Missing end date');

      return {
        phase: row.phase,
        phaseLabel: getPhaseDisplayLabel(row.phase, row.phaseOrdinal),
        phaseOrder: row.phaseOrder,
        phaseOrdinal: row.phaseOrdinal,
        startDate,
        endDate,
        dateLabel,
        durationWorkdays,
        description: cleanText(row.plan?.description),
        totalDays,
        visibleDays,
        itDays,
        bizDays,
        assigneeSummary,
        statusNotes,
        assignments,
      };
    });

    const totalDays = roundToTenth(phases.reduce((sum, phase) => sum + phase.totalDays, 0));
    const visibleDays = roundToTenth(phases.reduce((sum, phase) => sum + phase.visibleDays, 0));
    const itDays = roundToTenth(phases.reduce((sum, phase) => sum + phase.itDays, 0));
    const bizDays = roundToTenth(phases.reduce((sum, phase) => sum + phase.bizDays, 0));
    const missingStartPhases = phases
      .filter((phase) => phase.totalDays > 0 && !phase.startDate)
      .map((phase) => phase.phaseLabel);
    const statusNotes: string[] = [];
    if (totalDays <= 0) statusNotes.push('No staffing assigned');
    if (missingStartPhases.length > 0) statusNotes.push(`Missing dates: ${missingStartPhases.join(', ')}`);

    return {
      epic,
      epicUrl: resolveEpicUrl(epic.jiraKey, jiraBaseUrl),
      description: cleanText(epic.description),
      totalDays,
      visibleDays,
      itDays,
      bizDays,
      phaseCount: phases.length,
      statusNotes,
      phases,
    };
  });

  const actorSummaryMap = buildActorSummaryMap(state, quarterOpt, visibleAssignedDaysByActor);

  for (const epic of epicDetails) {
    for (const phase of epic.phases) {
      for (const assignment of phase.assignments) {
        const actor = actorSummaryMap.get(assignment.actor.id);
        assignment.actor = actor ?? assignment.actor;
        if (actor && actor.utilization !== null) {
          if (actor.utilization > 1) assignment.statusNotes.push('Over capacity');
          else if (actor.utilization > 0.85) assignment.statusNotes.push('Near capacity');
        }
      }
    }
  }

  const totalPlannedDays = roundToTenth(epicDetails.reduce((sum, epic) => sum + epic.visibleDays, 0));
  const plannedDaysByCategory = epicDetails.reduce<PlannedDaysTotals>((totals, epic) => (
    epic.phases.reduce<PlannedDaysTotals>((phaseTotals, phase) => (
      phase.assignments.reduce<PlannedDaysTotals>((assignmentTotals, assignment) => addToPlannedDaysTotals(
        assignmentTotals,
        getPlannedDaysBucketForActor(assignment.actor.id, state),
        assignment.visibleDays,
      ), phaseTotals)
    ), totals)
  ), emptyPlannedDaysTotals());
  const totalAvailableDays = roundToTenth(
    state.teamMembers
      .filter((member) => !member.excludedFromCapacity)
      .reduce((sum, member) => sum + calculateMemberAvailableDays(member.id, quarterOpt, state), 0)
    + state.businessContacts
      .filter((contact) => !contact.archived && !contact.excludedFromCapacity)
      .reduce((sum, contact) => sum + calculateBusinessAvailableDays(contact, quarterOpt, state), 0),
  );
  const portfolioUtilization = totalAvailableDays > 0 ? totalPlannedDays / totalAvailableDays : null;

  const peopleAtRisk = [...actorSummaryMap.values()]
    .filter((actor) => actor.type !== 'team' && actor.type !== 'unknown' && actor.availableDays !== null && actor.availableDays > 0 && actor.utilization !== null && actor.utilization > 0.85);
  const overCapacityPeopleCount = peopleAtRisk.filter((actor) => (actor.utilization ?? 0) > 1).length;
  const nearCapacityPeopleCount = peopleAtRisk.filter((actor) => {
    const utilization = actor.utilization ?? 0;
    return utilization > 0.85 && utilization <= 1;
  }).length;
  const unstaffedEpicCount = epicDetails.filter((epic) => epic.totalDays <= 0).length;
  const missingPhaseDateCount = epicDetails.reduce(
    (sum, epic) => sum + epic.phases.filter((phase) => phase.totalDays > 0 && !phase.startDate).length,
    0,
  );

  const teamCapacityRows: ExportTeamCapacityRow[] = state.processTeams.map((team) => {
    const peopleIds = new Set<string>([
      ...state.teamMembers.filter((member) => !member.excludedFromCapacity && (member.processTeamIds ?? []).includes(team.id)).map((member) => member.id),
      ...state.businessContacts.filter((contact) => !contact.archived && !contact.excludedFromCapacity && (contact.processTeamIds ?? []).includes(team.id)).map((contact) => contact.id),
    ]);

    const plannedDays = roundToTenth([...peopleIds].reduce(
      (sum, id) => sum + (visibleAssignedDaysByActor.get(id) ?? 0),
      0,
    ));
    const availableDays = roundToTenth([...peopleIds].reduce((sum, id) => {
      const actor = actorSummaryMap.get(id);
      return sum + (actor?.availableDays ?? 0);
    }, 0));

    return {
      name: team.name,
      plannedDays,
      availableDays,
      utilization: availableDays > 0 ? roundToTenth(plannedDays / availableDays) : null,
      peopleCount: peopleIds.size,
    };
  }).filter((row) => row.peopleCount > 0);

  const risks: ExportRiskRow[] = [
    ...peopleAtRisk.map((actor) => ({
      severity: (actor.utilization ?? 0) > 1 ? 'High' as const : 'Medium' as const,
      type: 'Person' as const,
      item: actor.name,
      issue: (actor.utilization ?? 0) > 1 ? 'Over capacity this period' : 'Near capacity this period',
      detail: `${actor.visibleAssignedDays}d planned vs ${actor.availableDays ?? 0}d available (${formatPercent(actor.utilization)})`,
      url: '',
    })),
    ...epicDetails.flatMap((epic) => {
      const nextRisks: ExportRiskRow[] = [];
      if (epic.totalDays <= 0) {
        nextRisks.push({
          severity: 'High',
          type: 'Epic',
          item: epic.epic.jiraKey,
          issue: 'Epic has no staffing assigned',
          detail: epic.epic.summary,
          url: epic.epicUrl,
        });
      }
      const missingStartPhases = epic.phases.filter((phase) => phase.totalDays > 0 && !phase.startDate);
      if (missingStartPhases.length > 0) {
        nextRisks.push({
          severity: 'Medium',
          type: 'Epic',
          item: epic.epic.jiraKey,
          issue: 'Assigned phase is missing dates',
          detail: missingStartPhases.map((phase) => phase.phaseLabel).join(', '),
          url: epic.epicUrl,
        });
      }
      return nextRisks;
    }),
  ].sort((left, right) => {
    const severityOrder = { High: 0, Medium: 1 };
    return severityOrder[left.severity] - severityOrder[right.severity] || left.item.localeCompare(right.item);
  });

  const overviewRows: CellValue[][] = [
    ['Portfolio Planning Export'],
    ['Plan', planName],
    ['Period', quarterLabel],
    ['Exported At', toIsoTimestamp(exportedAt)],
    ['Epics on board', boardEpics.length],
    [],
  ];

  addSection(overviewRows, 'Portfolio Health', ['Metric', 'Value', 'Notes'], [
    ['Planned days (selected period)', totalPlannedDays, `${totalAvailableDays}d available`],
    ['Planned days VS Finance', roundToTenth(plannedDaysByCategory.it_team_members), 'Named VS Finance members'],
    ['Planned days Business Owners and Business teams', roundToTenth(plannedDaysByCategory.business_owners_and_teams), 'Business contacts and business team placeholders'],
    ['Planned days Other IT teams', roundToTenth(plannedDaysByCategory.other_it_teams), 'Other internal IT teams or contributors'],
    ['Planned days External Partners', roundToTenth(plannedDaysByCategory.external_partners), 'External people and partner team placeholders'],
    ['Portfolio utilisation', portfolioUtilization === null ? 'N/A' : formatPercent(portfolioUtilization), portfolioUtilization === null ? 'No available capacity found' : 'Across IT and business capacity'],
    ['People at risk', peopleAtRisk.length, `${overCapacityPeopleCount} over / ${nearCapacityPeopleCount} near`],
    ['Unstaffed epics', unstaffedEpicCount, `${boardEpics.length} epics on the board`],
    ['Assigned phases missing dates', missingPhaseDateCount, 'Phases with effort but missing planned dates'],
  ]);

  addSection(overviewRows, 'Epic Overview', ['Epic Key', 'Epic Summary', 'Total Planned Days', 'Selected Period Days', 'IT Days', 'BIZ Days', 'Phases', 'Status'], epicDetails
    .sort((left, right) => right.totalDays - left.totalDays || left.epic.jiraKey.localeCompare(right.epic.jiraKey))
    .map((epic) => [
      epic.epic.jiraKey,
      epic.epic.summary,
      epic.totalDays,
      epic.visibleDays,
      epic.itDays,
      epic.bizDays,
      epic.phaseCount,
      epic.statusNotes.join('; '),
    ]));

  addSection(overviewRows, 'Capacity by Team', ['Team', 'Selected Period Days', 'Available Days', 'Utilisation', 'People'], teamCapacityRows.map((row) => [
    row.name,
    row.plannedDays,
    row.availableDays,
    formatPercent(row.utilization),
    row.peopleCount,
  ]));

  addSection(overviewRows, 'Portfolio Risks', ['Severity', 'Type', 'Item', 'Issue', 'Detail'], risks.map((risk) => [
    risk.severity,
    risk.type,
    risk.item,
    risk.issue,
    risk.detail,
  ]));

  const epicViewRows: CellValue[][] = [[
    'Level',
    'Epic Key',
    'Epic Summary',
    'Phase',
    'Phase Dates',
    'Phase Description',
    'Person / Team',
    'Reference ID',
    'Role / Team',
    'Track',
    'Allocation',
    'Total Planned Days',
    'Selected Period Days',
    'Available Days',
    'Utilisation',
    'Status',
    'Jira URL',
  ]];

  for (const epic of epicDetails) {
      epicViewRows.push([
        'Epic',
        epic.epic.jiraKey,
        epic.epic.summary,
        '',
        '',
        epic.description,
        '',
        '',
        '',
        '',
        '',
        epic.totalDays,
      epic.visibleDays,
      '',
      '',
      epic.statusNotes.join('; '),
      epic.epicUrl,
    ]);

    for (const phase of epic.phases) {
      epicViewRows.push([
        'Phase',
        epic.epic.jiraKey,
        epic.epic.summary,
        phase.phaseLabel,
        phase.dateLabel,
        phase.description,
        phase.assigneeSummary,
        '',
        '',
        '',
        phase.durationWorkdays === null ? '' : `${phase.durationWorkdays} workdays`,
        phase.totalDays,
        phase.visibleDays,
        '',
        '',
        phase.statusNotes.join('; '),
        epic.epicUrl,
      ]);

      for (const assignment of phase.assignments) {
        epicViewRows.push([
          'Assignment',
          epic.epic.jiraKey,
          epic.epic.summary,
          phase.phaseLabel,
          phase.dateLabel,
          phase.description,
          assignment.actor.name,
          assignment.actor.id,
          assignment.actor.role,
          assignment.track,
          assignment.allocation,
          assignment.totalDays,
          assignment.visibleDays,
          assignment.actor.availableDays ?? 'N/A',
          formatPercent(assignment.actor.utilization),
          assignment.statusNotes.join('; '),
          epic.epicUrl,
        ]);
      }
    }
  }

  const riskRows: CellValue[][] = [[
    'Severity',
    'Type',
    'Item',
    'Issue',
    'Detail',
    'Jira URL',
  ]];
  if (risks.length === 0) {
    riskRows.push(['None', '', '', 'No active portfolio risks found for this period', '', '']);
  } else {
    riskRows.push(...risks.map((risk) => [
      risk.severity,
      risk.type,
      risk.item,
      risk.issue,
      risk.detail,
      risk.url,
    ]));
  }

  const health: PortfolioHealthSummary = {
    epicCount: boardEpics.length,
    totalPlannedDays,
    totalAvailableDays,
    portfolioUtilization,
    peopleAtRiskCount: peopleAtRisk.length,
    overCapacityPeopleCount,
    nearCapacityPeopleCount,
    unstaffedEpicCount,
    missingPhaseDateCount,
  };

  const csvRows = buildPortfolioCsvRows(epicDetails);

  return {
    planName,
    quarterLabel,
    exportedAt: toIsoTimestamp(exportedAt),
    filenameBase: `portfolio-plan-${sanitizeFilePart(planName)}-${sanitizeFilePart(quarterLabel)}`,
    health,
    epics: epicDetails,
    teamCapacityRows,
    risks,
    overviewRows,
    epicViewRows,
    riskRows,
    csvRows,
  };
}

async function loadXLSX(): Promise<typeof import('xlsx') | null> {
  try {
    return await import('xlsx');
  } catch {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      script.onload = () => resolve((window as unknown as { XLSX: typeof import('xlsx') }).XLSX);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function encodeCsvCell(value: CellValue): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(rows: CellValue[][]): string {
  return rows.map((row) => row.map(encodeCsvCell).join(',')).join('\n');
}

function applyColumnWidths(sheet: Record<string, unknown>, widths: number[]): void {
  sheet['!cols'] = widths.map((width) => ({ wch: width }));
}

export async function exportPortfolioPlanToExcel(input: PortfolioPlanExportInput): Promise<void> {
  const XLSX = await loadXLSX();
  if (!XLSX) throw new Error('Failed to load Excel library');

  const data = buildPortfolioPlanExportData(input);
  const workbook = XLSX.utils.book_new();

  const overviewSheet = XLSX.utils.aoa_to_sheet(data.overviewRows);
  const epicViewSheet = XLSX.utils.aoa_to_sheet(data.epicViewRows);
  const risksSheet = XLSX.utils.aoa_to_sheet(data.riskRows);

  applyColumnWidths(overviewSheet as Record<string, unknown>, [28, 24, 48]);
  applyColumnWidths(epicViewSheet as Record<string, unknown>, [12, 14, 34, 18, 26, 40, 24, 24, 22, 10, 36, 16, 18, 16, 14, 28, 42]);
  applyColumnWidths(risksSheet as Record<string, unknown>, [12, 10, 20, 34, 50, 42]);

  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');
  XLSX.utils.book_append_sheet(workbook, epicViewSheet, 'Epic View');
  XLSX.utils.book_append_sheet(workbook, risksSheet, 'Risks');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${data.filenameBase}.xlsx`);
}

export function exportPortfolioPlanToCsv(input: PortfolioPlanExportInput): void {
  const data = buildPortfolioPlanExportData(input);
  const csv = buildCsvContent(data.csvRows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${data.filenameBase}.csv`);
}
