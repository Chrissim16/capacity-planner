import { formatCurrency } from '../../../utils/currency';
import type { CurrencyCode } from '../../../types';
import type { PortfolioReportModels } from '../../../utils/portfolioReportAggregators';
import { buildPortfolioOverviewChartModel, formatReportDays } from '../../../utils/portfolioReportChartModels';
import { BucketDonutChart, CostCompositionDonut, HorizontalDaysBarChart } from './ReportCharts';
import { ReportKpiCard } from './ReportKpiCard';

export interface PortfolioOverviewDashboardProps {
  models: PortfolioReportModels;
  currency: CurrencyCode;
  onOpenPersonLens: () => void;
}

export function PortfolioOverviewDashboard({ models, currency, onOpenPersonLens }: PortfolioOverviewDashboardProps) {
  const chart = buildPortfolioOverviewChartModel(models);
  const vf = models.vsFinanceOverview;

  const utilDisplay =
    vf.utilizationPercent != null && Number.isFinite(vf.utilizationPercent)
      ? `${formatReportDays(vf.utilizationPercent)}%`
      : '—';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <ReportKpiCard
          label="Total capacity — VS Finance members"
          value={`${formatReportDays(vf.totalCapacityDays)} d`}
          subtext="Available days · VS Finance track · reporting period"
        />
        <ReportKpiCard
          label="Planned days — VS Finance members"
          value={`${formatReportDays(vf.totalPlannedDays)} d`}
          subtext="Allocated days · same scope and period"
        />
        <ReportKpiCard
          label="Utilization — VS Finance"
          value={utilDisplay}
          subtext="Planned ÷ capacity (blank if capacity is zero)"
        />
        <ReportKpiCard
          label="Portfolio cost"
          value={formatCurrency(chart.totalPortfolioCost, currency)}
          subtext={`Roll-up in ${currency} · initiative cost model`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Planned days by bucket</h3>
          <BucketDonutChart segments={chart.bucketSegments} title="Planned days by staffing bucket" />
        </div>
        <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Top epics by period days</h3>
          <HorizontalDaysBarChart
            rows={chart.topEpicsByDays}
            title="Top epics by planned days in period"
            maxBars={6}
            yAxisWidth={168}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Cost composition</h3>
          <CostCompositionDonut slices={chart.costComposition} title="Portfolio cost composition" currency={currency} />
        </div>
        <div className="rounded-lg border border-mileway-border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-mileway-grey">Detail tables</h3>
          <p className="mb-3 text-xs text-mileway-grey">
            Use the tabs above (Person, Process team, Epic, …) for charts and collapsible full tables for each lens.
          </p>
          <button
            type="button"
            className="rounded-md border border-mileway-blue bg-mileway-blue-10 px-3 py-2 text-xs font-semibold text-mileway-blue hover:bg-mileway-blue-20 focus:outline-none focus:ring-2 focus:ring-sana-teal"
            onClick={onOpenPersonLens}
          >
            Open Person lens
          </button>
        </div>
      </div>
    </div>
  );
}
