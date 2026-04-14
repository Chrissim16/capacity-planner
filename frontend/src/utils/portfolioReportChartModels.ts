import { getPlannedDaysBucketLabel } from './planningGroups';
import type { CostReportRow, PersonEpicReportRow, PortfolioReportModels, TeamEpicReportRow } from './portfolioReportAggregators';

export interface ChartSegment {
  id: string;
  name: string;
  value: number;
}

export interface BarChartRow {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
}

export interface CostCompositionSlice {
  id: string;
  name: string;
  value: number;
}

export interface PortfolioOverviewChartModel {
  bucketSegments: ChartSegment[];
  topEpicsByDays: BarChartRow[];
  costComposition: CostCompositionSlice[];
  totalPeriodDays: number;
  totalPortfolioCost: number;
  missingRateSlots: number;
  epicsWithEffortCount: number;
}

export interface EpicStackedBucketRow {
  epicKey: string;
  epicSummary: string;
  it_team_members: number;
  business_owners_and_teams: number;
  other_it_teams: number;
  external_partners: number;
  total: number;
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatReportDays(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export function buildPortfolioBucketTotals(models: PortfolioReportModels): ChartSegment[] {
  const sums = {
    it_team_members: 0,
    business_owners_and_teams: 0,
    other_it_teams: 0,
    external_partners: 0,
  };
  for (const row of models.epicEffortRows) {
    const b = row.bucketDays;
    sums.it_team_members += b.it_team_members;
    sums.business_owners_and_teams += b.business_owners_and_teams;
    sums.other_it_teams += b.other_it_teams;
    sums.external_partners += b.external_partners;
  }

  const segments: ChartSegment[] = [
    { id: 'it_team_members', name: getPlannedDaysBucketLabel('it_team_members'), value: roundTenth(sums.it_team_members) },
    { id: 'business_owners_and_teams', name: getPlannedDaysBucketLabel('business_owners_and_teams'), value: roundTenth(sums.business_owners_and_teams) },
    { id: 'other_it_teams', name: getPlannedDaysBucketLabel('other_it_teams'), value: roundTenth(sums.other_it_teams) },
    { id: 'external_partners', name: getPlannedDaysBucketLabel('external_partners'), value: roundTenth(sums.external_partners) },
  ];
  return segments.filter((s) => s.value > 0);
}

const MAX_EPIC_BAR_LABEL_LEN = 48;

function epicDaysBarLabel(summary: string, epicKey: string): string {
  const s = summary?.trim() || epicKey;
  if (s.length <= MAX_EPIC_BAR_LABEL_LEN) return s;
  return `${s.slice(0, MAX_EPIC_BAR_LABEL_LEN - 1)}…`;
}

export function topEpicsByDays(models: PortfolioReportModels, limit: number): BarChartRow[] {
  return [...models.epicEffortRows]
    .sort((a, b) => b.totalVisibleDays - a.totalVisibleDays || a.epicKey.localeCompare(b.epicKey))
    .slice(0, limit)
    .map((r) => ({
      id: r.epicKey,
      label: epicDaysBarLabel(r.epicSummary, r.epicKey),
      sublabel: r.epicKey,
      value: r.totalVisibleDays,
    }));
}

export function buildPortfolioCostComposition(models: PortfolioReportModels): CostCompositionSlice[] {
  let itLabor = 0;
  let bizLabor = 0;
  let direct = 0;
  let contingency = 0;
  for (const r of models.costRows) {
    itLabor += r.itLaborCost;
    bizLabor += r.bizLaborCost;
    direct += r.directCost;
    contingency += r.contingencyCost;
  }
  const slices: CostCompositionSlice[] = [
    { id: 'itLabor', name: 'IT labor', value: itLabor },
    { id: 'bizLabor', name: 'BIZ labor', value: bizLabor },
    { id: 'direct', name: 'Direct (HW + licenses)', value: direct },
    { id: 'contingency', name: 'Contingency', value: contingency },
  ];
  return slices.filter((s) => s.value > 0);
}

export function topEpicsByCost(rows: CostReportRow[], limit: number): BarChartRow[] {
  return [...rows]
    .sort((a, b) => b.totalCost - a.totalCost || a.initiativeId.localeCompare(b.initiativeId))
    .slice(0, limit)
    .map((r) => ({
      id: r.initiativeId,
      label: r.initiativeId,
      sublabel: r.initiativeTitle,
      value: r.totalCost,
    }));
}

function aggregatePersonDays(rows: PersonEpicReportRow[]): Map<string, { name: string; days: number }> {
  const map = new Map<string, { name: string; days: number }>();
  for (const r of rows) {
    const cur = map.get(r.actorId);
    if (cur) {
      cur.days = roundTenth(cur.days + r.totalVisibleDays);
    } else {
      map.set(r.actorId, { name: r.actorName, days: r.totalVisibleDays });
    }
  }
  return map;
}

export function topPeopleByDays(rows: PersonEpicReportRow[], limit: number): BarChartRow[] {
  const map = aggregatePersonDays(rows);
  return [...map.entries()]
    .map(([id, v]) => ({ id, label: v.name, value: v.days }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function aggregateTeamDays(rows: TeamEpicReportRow[]): Map<string, { label: string; days: number }> {
  const map = new Map<string, { label: string; days: number }>();
  for (const r of rows) {
    const cur = map.get(r.teamId);
    if (cur) {
      cur.days = roundTenth(cur.days + r.totalVisibleDays);
    } else {
      map.set(r.teamId, { label: r.teamLabel, days: r.totalVisibleDays });
    }
  }
  return map;
}

export function topTeamsByDays(rows: TeamEpicReportRow[], limit: number): BarChartRow[] {
  const map = aggregateTeamDays(rows);
  return [...map.entries()]
    .map(([id, v]) => ({ id, label: v.label, value: v.days }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function topEpicsStackedByBucket(models: PortfolioReportModels, limit: number): EpicStackedBucketRow[] {
  return [...models.epicEffortRows]
    .sort((a, b) => b.totalVisibleDays - a.totalVisibleDays || a.epicKey.localeCompare(b.epicKey))
    .slice(0, limit)
    .map((r) => {
      const b = r.bucketDays;
      return {
        epicKey: r.epicKey,
        epicSummary: r.epicSummary,
        it_team_members: roundTenth(b.it_team_members),
        business_owners_and_teams: roundTenth(b.business_owners_and_teams),
        other_it_teams: roundTenth(b.other_it_teams),
        external_partners: roundTenth(b.external_partners),
        total: r.totalVisibleDays,
      };
    });
}

export function topEpicsByMissingRates(models: PortfolioReportModels, limit: number): BarChartRow[] {
  return [...models.costRows]
    .filter((r) => r.missingRateCount > 0)
    .sort((a, b) => b.missingRateCount - a.missingRateCount || a.initiativeId.localeCompare(b.initiativeId))
    .slice(0, limit)
    .map((r) => ({
      id: r.initiativeId,
      label: r.initiativeId,
      sublabel: r.initiativeTitle,
      value: r.missingRateCount,
    }));
}

export function buildPortfolioOverviewChartModel(models: PortfolioReportModels): PortfolioOverviewChartModel {
  const totalPeriodDays = models.epicEffortRows.reduce((s, r) => s + r.totalVisibleDays, 0);
  const totalPortfolioCost = models.costRows.reduce((s, r) => s + r.totalCost, 0);
  const missingRateSlots = models.costRows.reduce((s, r) => s + r.missingRateCount, 0);
  return {
    bucketSegments: buildPortfolioBucketTotals(models),
    topEpicsByDays: topEpicsByDays(models, 6),
    costComposition: buildPortfolioCostComposition(models),
    totalPeriodDays: roundTenth(totalPeriodDays),
    totalPortfolioCost,
    missingRateSlots,
    epicsWithEffortCount: models.epicEffortRows.filter((e) => e.totalVisibleDays > 0).length,
  };
}

export function normalizeSegmentsForPdf(segments: { name: string; value: number }[]): { name: string; value: number; pct: number }[] {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return [];
  return segments.map((x) => ({
    name: x.name,
    value: x.value,
    pct: x.value / total,
  }));
}
