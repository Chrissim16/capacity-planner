import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { formatCurrency } from '../../utils/currency';
import type { CurrencyCode } from '../../types';
import type { PortfolioReportLens, PortfolioReportModels } from '../../utils/portfolioReportAggregators';
import {
  buildPortfolioBucketTotals,
  buildPortfolioOverviewChartModel,
  topEpicsByCost,
  topEpicsByDays,
  topEpicsByMissingRates,
  topEpicsStackedByBucket,
  topPeopleByDays,
  topTeamsByDays,
} from '../../utils/portfolioReportChartModels';
import { PortfolioOverviewDashboard } from './reports/PortfolioOverviewDashboard';
import { LensDashboardLayout } from './reports/LensDashboardLayout';
import { ReportCollapsible } from './reports/ReportCollapsible';
import {
  BucketDonutChart,
  CostCompositionDonut,
  EpicBucketStackedBarChart,
  HorizontalCurrencyBarChart,
  HorizontalDaysBarChart,
} from './reports/ReportCharts';
import { CostTable, EpicEffortTable, EmptyReports, PersonEpicTable, TeamEpicTable } from './reports/PortfolioReportTables';
import { formatReportDays } from '../../utils/portfolioReportChartModels';
import { ReportKpiCard } from './reports/ReportKpiCard';

export interface PortfolioReportsPanelProps {
  models: PortfolioReportModels;
  activeScenarioName: string | null;
}

export type PortfolioReportsTabId = 'overview' | PortfolioReportLens;

const TABS: { id: PortfolioReportsTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'person', label: 'Person' },
  { id: 'processTeam', label: 'Process team' },
  { id: 'planningGroup', label: 'Planning group' },
  { id: 'epic', label: 'Epic' },
  { id: 'costs', label: 'Costs' },
];

function isLens(id: PortfolioReportsTabId): id is PortfolioReportLens {
  return id !== 'overview';
}

export function PortfolioReportsPanel({ models, activeScenarioName }: PortfolioReportsPanelProps) {
  const [tab, setTab] = useState<PortfolioReportsTabId>('overview');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const currency = models.reportingCurrency as CurrencyCode;
  const overviewChart = useMemo(() => buildPortfolioOverviewChartModel(models), [models]);
  const portfolioBuckets = useMemo(() => buildPortfolioBucketTotals(models), [models]);

  const kpis = useMemo(() => {
    if (!isLens(tab)) return [];
    switch (tab) {
      case 'person': {
        const k = models.personSquadNamedKpis;
        return [
          {
            key: 'person-erp-planned',
            label: 'Planned days — ERP squad',
            value: formatReportDays(k.erp.plannedDays),
            subtext: 'Days allocated · VS Finance · ERP squad',
          },
          {
            key: 'person-epm-planned',
            label: 'Planned days — EPM squad',
            value: formatReportDays(k.epm.plannedDays),
            subtext: 'Days allocated · VS Finance · EPM squad',
          },
          {
            key: 'person-erp-over',
            label: 'Over capacity — ERP squad',
            value: String(k.erp.overCapacityCount),
            subtext: 'Members over 100% utilization (ERP)',
          },
          {
            key: 'person-epm-over',
            label: 'Over capacity — EPM squad',
            value: String(k.epm.overCapacityCount),
            subtext: 'Members over 100% utilization (EPM)',
          },
        ];
      }
      case 'processTeam':
        return models.processTeamKpiCards.map((c) => ({
          key: `pt-kpi-${c.teamId}`,
          label: c.label,
          value: formatReportDays(c.plannedDays),
          subtext: 'Days · epic phase effort in reporting period',
        }));
      case 'planningGroup': {
        const rows = models.planningGroupEpicRows;
        const groups = new Set(rows.map((r) => r.teamId));
        const days = rows.reduce((s, r) => s + r.totalVisibleDays, 0);
        return [
          {
            key: 'pg-distinct',
            label: 'Planning groups',
            value: String(groups.size),
            subtext: 'Distinct groups with at least one row',
          },
          {
            key: 'pg-rows',
            label: 'Group × epic rows',
            value: String(rows.length),
            subtext: 'Rows in the planning group × epic table',
          },
          {
            key: 'pg-days',
            label: 'Period days (sum)',
            value: formatReportDays(days),
            subtext: 'Summed visible days across those rows',
          },
        ];
      }
      case 'epic': {
        const rows = models.epicEffortRows;
        const days = rows.reduce((s, r) => s + r.totalVisibleDays, 0);
        return [
          {
            key: 'epic-count',
            label: 'Epics on board',
            value: String(rows.length),
            subtext: 'Epics with effort rows in this period',
          },
          {
            key: 'epic-days',
            label: 'Total period days',
            value: formatReportDays(days),
            subtext: 'Summed visible days across all epics',
          },
          {
            key: 'epic-health',
            label: 'Portfolio epics',
            value: String(models.healthEpicCount),
            subtext: 'Epics counted in portfolio health',
          },
        ];
      }
      case 'costs': {
        const rows = models.costRows;
        const total = rows.reduce((s, r) => s + r.totalCost, 0);
        const gaps = rows.reduce((s, r) => s + r.missingRateCount, 0);
        return [
          {
            key: 'cost-total',
            label: 'Total portfolio cost',
            value: formatCurrency(total, currency),
            subtext: `Converted to ${currency} where needed`,
          },
          {
            key: 'cost-rows',
            label: 'Epics with costs',
            value: String(rows.length),
            subtext: 'Initiatives with a cost row in the table',
          },
          {
            key: 'cost-gaps',
            label: 'Missing rate slots',
            value: String(gaps),
            subtext: 'Labour rate gaps across those rows',
          },
        ];
      }
      default:
        return [];
    }
  }, [currency, models, tab]);

  const personTop = useMemo(() => topPeopleByDays(models.personEpicRows, 5), [models.personEpicRows]);
  const processTeamTop = useMemo(() => topTeamsByDays(models.processTeamEpicRows, 5), [models.processTeamEpicRows]);
  const pgTop = useMemo(() => topTeamsByDays(models.planningGroupEpicRows, 5), [models.planningGroupEpicRows]);
  const epicDaysTop = useMemo(() => topEpicsByDays(models, 5), [models]);
  const epicStacked = useMemo(() => topEpicsStackedByBucket(models, 5), [models]);
  const costTop = useMemo(() => topEpicsByCost(models.costRows, 5), [models.costRows]);
  const missingTop = useMemo(() => topEpicsByMissingRates(models, 5), [models]);

  let lensBody: ReactNode = null;
  if (isLens(tab)) {
    if (tab === 'person') {
      const hasRows = models.personEpicRows.length > 0;
      if (!hasRows) {
        lensBody = <EmptyReports />;
      } else {
        lensBody = (
          <LensDashboardLayout
            chartArea={
              <>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">
                    Top people by planned days
                  </h3>
                  <HorizontalDaysBarChart rows={personTop} title="People ranked by planned days" maxBars={5} />
                </div>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Top epics by days</h3>
                  <HorizontalDaysBarChart
                    rows={epicDaysTop}
                    title="Epics ranked by planned days"
                    maxBars={5}
                    yAxisWidth={168}
                  />
                </div>
              </>
            }
            footer={
              <ReportCollapsible title="Person × epic (full table)" defaultOpen={false}>
                <PersonEpicTable rows={models.personEpicRows} expanded={expanded} onToggle={toggle} />
              </ReportCollapsible>
            }
          />
        );
      }
    } else if (tab === 'processTeam') {
      const hasRows = models.processTeamEpicRows.length > 0;
      if (!hasRows) {
        lensBody = <EmptyReports />;
      } else {
        lensBody = (
          <LensDashboardLayout
            chartArea={
              <>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Top process teams</h3>
                  <HorizontalDaysBarChart rows={processTeamTop} title="Process teams by planned days" maxBars={5} />
                </div>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Top epics by days</h3>
                  <HorizontalDaysBarChart
                    rows={epicDaysTop}
                    title="Epics ranked by planned days"
                    maxBars={5}
                    yAxisWidth={168}
                  />
                </div>
              </>
            }
            footer={
              <ReportCollapsible title="Process team × epic (full table)" defaultOpen={false}>
                <TeamEpicTable rows={models.processTeamEpicRows} expanded={expanded} onToggle={toggle} col1="Process team" />
              </ReportCollapsible>
            }
          />
        );
      }
    } else if (tab === 'planningGroup') {
      const hasRows = models.planningGroupEpicRows.length > 0;
      if (!hasRows) {
        lensBody = <EmptyReports />;
      } else {
        lensBody = (
          <LensDashboardLayout
            chartArea={
              <>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Top planning groups</h3>
                  <HorizontalDaysBarChart rows={pgTop} title="Planning groups by planned days" maxBars={5} />
                </div>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Top epics by days</h3>
                  <HorizontalDaysBarChart
                    rows={epicDaysTop}
                    title="Epics ranked by planned days"
                    maxBars={5}
                    yAxisWidth={168}
                  />
                </div>
              </>
            }
            footer={
              <ReportCollapsible title="Planning group × epic (full table)" defaultOpen={false}>
                <TeamEpicTable rows={models.planningGroupEpicRows} expanded={expanded} onToggle={toggle} col1="Planning group" />
              </ReportCollapsible>
            }
          />
        );
      }
    } else if (tab === 'epic') {
      const hasRows = models.epicEffortRows.length > 0;
      if (!hasRows) {
        lensBody = <EmptyReports />;
      } else {
        lensBody = (
          <LensDashboardLayout
            chartArea={
              <>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm lg:col-span-2">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">
                    Top epics — days by staffing bucket (stacked)
                  </h3>
                  <EpicBucketStackedBarChart rows={epicStacked} title="Epic effort by bucket" />
                </div>
              </>
            }
            secondaryCharts={
              <>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Portfolio bucket mix</h3>
                  <BucketDonutChart segments={portfolioBuckets} title="Portfolio planned days by bucket" />
                </div>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Top epics by days</h3>
                  <HorizontalDaysBarChart
                    rows={epicDaysTop}
                    title="Top epics by days"
                    maxBars={5}
                    yAxisWidth={168}
                  />
                </div>
              </>
            }
            footer={
              <ReportCollapsible title="Epic effort (full table)" defaultOpen={false}>
                <EpicEffortTable rows={models.epicEffortRows} expanded={expanded} onToggle={toggle} />
              </ReportCollapsible>
            }
          />
        );
      }
    } else if (tab === 'costs') {
      const hasRows = models.costRows.length > 0;
      if (!hasRows) {
        lensBody = <EmptyReports />;
      } else {
        const comp = overviewChart.costComposition;
        const showMissing = missingTop.length > 0;
        lensBody = (
          <LensDashboardLayout
            chartArea={
              <>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Cost composition</h3>
                  <CostCompositionDonut slices={comp} title="Portfolio cost composition" currency={currency} />
                </div>
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Top epics by cost</h3>
                  <HorizontalCurrencyBarChart rows={costTop} title="Epics by total cost" currency={currency} maxBars={5} />
                </div>
              </>
            }
            secondaryCharts={
              showMissing ? (
                <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm lg:col-span-2">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Epics with missing rates (top)</h3>
                  <HorizontalDaysBarChart
                    rows={missingTop}
                    title="Missing rate slots by epic"
                    maxBars={5}
                    valueSuffix=""
                    tooltipFormat={(n) => String(Math.round(n))}
                  />
                </div>
              ) : undefined
            }
            footer={
              <ReportCollapsible title="Costs by epic (full table)" defaultOpen={false}>
                <CostTable rows={models.costRows} currency={currency} />
              </ReportCollapsible>
            }
          />
        );
      }
    }
  }

  const kpiGridClass =
    tab === 'processTeam' && kpis.length > 4
      ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6'
      : 'grid grid-cols-2 gap-2 lg:grid-cols-4';

  return (
    <div className="pp-view on flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-4 border-b border-mileway-border bg-mileway-grey-10 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-mileway-grey">
          <span className="rounded-md border border-mileway-border bg-white px-2 py-1 font-medium text-mileway-text">
            {activeScenarioName ? `Scenario: ${activeScenarioName}` : 'Baseline plan'}
          </span>
          <span className="rounded-md border border-mileway-border bg-white px-2 py-1">Period: {models.quarterLabel}</span>
          <span className="rounded-md border border-mileway-border bg-white px-2 py-1">Currency: {models.reportingCurrency}</span>
          <span className="rounded-md border border-mileway-border bg-white px-2 py-1">Plan: {models.planName}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Report lens">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={clsx(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sana-teal',
                tab === t.id
                  ? 'border-mileway-blue bg-mileway-blue-10 text-mileway-blue'
                  : 'border-mileway-border bg-white text-mileway-grey hover:text-mileway-text',
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLens(tab) ? (
          <div className={kpiGridClass}>
            {kpis.map((k) => (
              <ReportKpiCard key={k.key} label={k.label} value={k.value} subtext={k.subtext} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {tab === 'overview' ? (
          <PortfolioOverviewDashboard models={models} currency={currency} onOpenPersonLens={() => setTab('person')} />
        ) : (
          lensBody
        )}
      </div>
    </div>
  );
}
