import type {
  AppState,
  CostLineItem,
  CurrencyCode,
  EpicPhaseAssignment,
  InitiativeCostRecord,
  JiraWorkItem,
  MoneyAmount,
} from '../types';
import {
  getBusinessTeamPlaceholderDisplay,
  isBusinessTeamPlaceholderId,
  resolveBusinessTeamPlaceholder,
} from './businessTeamPlaceholders';

type AssignmentsByInstance = Map<string, EpicPhaseAssignment[]>;

export interface InitiativeCostSummary {
  initiativeId: string;
  initiativeTitle: string;
  laborCost: number;
  itLaborCost: number;
  bizLaborCost: number;
  directCost: number;
  contingencyCost: number;
  totalCost: number;
  missingRateCount: number;
  missingRateLabels: string[];
  directCostRecord: InitiativeCostRecord | null;
}

export interface PortfolioCostSummary {
  reportingCurrency: CurrencyCode;
  initiatives: InitiativeCostSummary[];
  totalLaborCost: number;
  totalDirectCost: number;
  totalContingencyCost: number;
  totalCost: number;
  missingRateCount: number;
  initiativesWithMissingRates: number;
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  fxToEur: Record<CurrencyCode, number>,
): number | null {
  const fromRate = fxToEur[fromCurrency];
  const toRate = fxToEur[toCurrency];
  if (!fromRate || !toRate) return null;
  const amountInEur = amount * fromRate;
  return roundToCents(amountInEur / toRate);
}

function resolveBusinessTeam(
  memberId: string,
  state: AppState,
) {
  return resolveBusinessTeamPlaceholder(memberId, state.businessTeams);
}

function resolveActorLabel(memberId: string, state: AppState): string {
  if (isBusinessTeamPlaceholderId(memberId)) {
    return `${getBusinessTeamPlaceholderDisplay(memberId, state.businessTeams).name} Team`;
  }
  const member = state.teamMembers.find((item) => item.id === memberId);
  if (member) return member.name;
  const contact = state.businessContacts.find((item) => item.id === memberId);
  if (contact) return contact.name;
  return memberId;
}

function resolveRateForAssignment(
  assignment: EpicPhaseAssignment,
  state: AppState,
): MoneyAmount | null {
  if (isBusinessTeamPlaceholderId(assignment.memberId)) {
    const team = resolveBusinessTeam(assignment.memberId, state);
    if (!team) return null;
    if (team.dailyRateOverride != null && team.dailyRateCurrency) {
      return { amount: team.dailyRateOverride, currency: team.dailyRateCurrency };
    }
    return state.settings.costing.businessDailyRate;
  }

  if (assignment.track === 'BIZ') {
    const contact = state.businessContacts.find((item) => item.id === assignment.memberId);
    if (!contact) return null;
    if (contact.dailyRateOverride != null && contact.dailyRateCurrency) {
      return { amount: contact.dailyRateOverride, currency: contact.dailyRateCurrency };
    }
    return state.settings.costing.businessDailyRate;
  }

  const member = state.teamMembers.find((item) => item.id === assignment.memberId);
  if (!member) return null;
  if (member.dailyRateOverride != null && member.dailyRateCurrency) {
    return { amount: member.dailyRateOverride, currency: member.dailyRateCurrency };
  }
  if (member.workerType === 'external') {
    if (!member.externalVendorId) return null;
    const vendor = state.externalVendors.find((item) => item.id === member.externalVendorId);
    if (!vendor) return null;
    return { amount: vendor.dailyRate, currency: vendor.currency };
  }
  return state.settings.costing.internalItDailyRate;
}

function sumDirectCosts(
  record: InitiativeCostRecord | null,
  reportingCurrency: CurrencyCode,
  fxToEur: Record<CurrencyCode, number>,
): number {
  if (!record) return 0;

  const lines: CostLineItem[] = [
    ...(record.hardware ? [record.hardware] : []),
    ...(record.licenses ?? []),
  ];

  return roundToCents(lines.reduce((sum, line) => {
    const converted = convertCurrency(line.amount, line.currency, reportingCurrency, fxToEur);
    return sum + (converted ?? 0);
  }, 0));
}

export function getPortfolioInitiativeCostRecord(
  initiativeCosts: InitiativeCostRecord[],
  initiativeId: string,
): InitiativeCostRecord | null {
  return initiativeCosts.find((record) =>
    record.initiativeKind === 'portfolio_epic' &&
    record.initiativeId === initiativeId &&
    !record.scenarioId,
  ) ?? null;
}

export function buildPortfolioCostSummary(
  state: AppState,
  boardEpics: JiraWorkItem[],
  assignMap: Map<string, AssignmentsByInstance>,
): PortfolioCostSummary {
  const reportingCurrency = state.settings.costing.reportingCurrency;
  const fxToEur = state.settings.costing.fxToEur;

  const initiatives = boardEpics.map((epic): InitiativeCostSummary => {
    const assignmentsByInstance = assignMap.get(epic.jiraKey) ?? new Map<string, EpicPhaseAssignment[]>();
    let itLaborCost = 0;
    let bizLaborCost = 0;
    const missingRateLabels = new Set<string>();

    for (const phaseAssignments of assignmentsByInstance.values()) {
      for (const assignment of phaseAssignments) {
        const rate = resolveRateForAssignment(assignment, state);
        if (!rate) {
          missingRateLabels.add(resolveActorLabel(assignment.memberId, state));
          continue;
        }

        const converted = convertCurrency(
          assignment.days * rate.amount,
          rate.currency,
          reportingCurrency,
          fxToEur,
        );
        if (converted == null) {
          missingRateLabels.add(resolveActorLabel(assignment.memberId, state));
          continue;
        }

        if (assignment.track === 'IT') itLaborCost += converted;
        else bizLaborCost += converted;
      }
    }

    const directCostRecord = getPortfolioInitiativeCostRecord(state.initiativeCosts, epic.jiraKey);
    const directCost = sumDirectCosts(directCostRecord, reportingCurrency, fxToEur);
    const laborCost = roundToCents(itLaborCost + bizLaborCost);
    const contingencyPct = directCostRecord?.contingencyPct ?? 0;
    const contingencyCost = roundToCents((laborCost + directCost) * (contingencyPct / 100));
    const totalCost = roundToCents(laborCost + directCost + contingencyCost);

    return {
      initiativeId: epic.jiraKey,
      initiativeTitle: epic.summary,
      laborCost,
      itLaborCost: roundToCents(itLaborCost),
      bizLaborCost: roundToCents(bizLaborCost),
      directCost,
      contingencyCost,
      totalCost,
      missingRateCount: missingRateLabels.size,
      missingRateLabels: [...missingRateLabels].sort((a, b) => a.localeCompare(b)),
      directCostRecord,
    };
  });

  return {
    reportingCurrency,
    initiatives,
    totalLaborCost: roundToCents(initiatives.reduce((sum, item) => sum + item.laborCost, 0)),
    totalDirectCost: roundToCents(initiatives.reduce((sum, item) => sum + item.directCost, 0)),
    totalContingencyCost: roundToCents(initiatives.reduce((sum, item) => sum + item.contingencyCost, 0)),
    totalCost: roundToCents(initiatives.reduce((sum, item) => sum + item.totalCost, 0)),
    missingRateCount: initiatives.reduce((sum, item) => sum + item.missingRateCount, 0),
    initiativesWithMissingRates: initiatives.filter((item) => item.missingRateCount > 0).length,
  };
}
