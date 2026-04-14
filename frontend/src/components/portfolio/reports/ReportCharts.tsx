import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Accent, Biz, Border, Text } from '../../../theme/tokens';
import type { BarChartRow, ChartSegment, CostCompositionSlice, EpicStackedBucketRow } from '../../../utils/portfolioReportChartModels';
import { formatCurrency } from '../../../utils/currency';
import type { CurrencyCode } from '../../../types';
import { getPlannedDaysBucketLabel } from '../../../utils/planningGroups';

const BUCKET_FILL: Record<string, string> = {
  it_team_members: Accent.blue,
  business_owners_and_teams: Accent.green,
  other_it_teams: Text.secondary,
  external_partners: Accent.orange,
};

const DONUT_FALLBACK = [Accent.blue, Accent.green, Biz.DEFAULT, Accent.orange];

function segmentFill(seg: ChartSegment, index: number): string {
  return BUCKET_FILL[seg.id] ?? DONUT_FALLBACK[index % DONUT_FALLBACK.length];
}

function compositionFill(slice: CostCompositionSlice, index: number): string {
  const map: Record<string, string> = {
    itLabor: Accent.blue,
    bizLabor: Text.secondary,
    direct: Accent.green,
    contingency: Accent.orange,
  };
  return map[slice.id] ?? DONUT_FALLBACK[index % DONUT_FALLBACK.length];
}

type TooltipPayload = { name?: string; value?: number; payload?: Record<string, unknown> };

function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix,
  formatValue,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  valueSuffix?: string;
  formatValue?: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const v = typeof p.value === 'number' ? p.value : Number(p.value);
  const text =
    formatValue != null && Number.isFinite(v)
      ? formatValue(v)
      : Number.isFinite(v)
        ? `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}${valueSuffix ?? ''}`
        : '—';
  const name = p.name ?? label ?? '';
  return (
    <div className="rounded-md border border-mileway-border bg-white px-2 py-1.5 text-xs shadow-sm">
      {name ? <div className="font-medium text-mileway-text">{name}</div> : null}
      <div className="tabular-nums text-mileway-grey">{text}</div>
    </div>
  );
}

export function BucketDonutChart({ segments, title }: { segments: ChartSegment[]; title: string }) {
  const data = segments.map((s, i) => ({ ...s, fill: segmentFill(s, i) }));
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-mileway-border bg-mileway-grey-10 text-xs text-mileway-grey">
        No bucket data for this period
      </div>
    );
  }
  return (
    <figure className="h-[240px] w-full" aria-label={title}>
      <figcaption className="sr-only">{title}</figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.fill} stroke={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueSuffix=" d" />} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span className="text-mileway-grey">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function HorizontalDaysBarChart({
  rows,
  title,
  maxBars = 8,
  valueSuffix = ' d',
  tooltipFormat,
  yAxisWidth = 88,
}: {
  rows: BarChartRow[];
  title: string;
  maxBars?: number;
  /** Tooltip value suffix (default: days). Use "" for unitless counts. */
  valueSuffix?: string;
  tooltipFormat?: (n: number) => string;
  /** Wider axis when Y labels are epic titles / long names. */
  yAxisWidth?: number;
}) {
  const slice = rows.slice(0, maxBars);
  const data = [...slice].reverse().map((r) => ({
    id: r.id,
    name: r.label,
    days: r.value,
    full: r.sublabel,
  }));
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-mileway-border bg-mileway-grey-10 text-xs text-mileway-grey">
        No data
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.days), 1);
  return (
    <figure className="h-[240px] w-full min-w-0" aria-label={title}>
      <figcaption className="sr-only">{title}</figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={Border.default} horizontal={false} />
          <XAxis type="number" domain={[0, max]} tick={{ fontSize: 10, fill: Text.secondary }} />
          <YAxis
            type="category"
            dataKey="name"
            width={yAxisWidth}
            tick={{ fontSize: 10, fill: Text.primary }}
            interval={0}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as { name?: string; days?: number; full?: string };
              const v = typeof row?.days === 'number' ? row.days : Number(row?.days);
              const valueText =
                tooltipFormat != null && Number.isFinite(v)
                  ? tooltipFormat(v)
                  : Number.isFinite(v)
                    ? `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}${valueSuffix ?? ''}`
                    : '—';
              return (
                <div className="rounded-md border border-mileway-border bg-white px-2 py-1.5 text-xs shadow-sm">
                  {row?.name ? <div className="font-medium text-mileway-text">{row.name}</div> : null}
                  {row?.full ? (
                    <div className="mt-0.5 font-mono text-[11px] text-mileway-grey">{row.full}</div>
                  ) : null}
                  <div className="tabular-nums text-mileway-grey">{valueText}</div>
                </div>
              );
            }}
          />
          <Bar dataKey="days" name="Days" fill={Accent.blue} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function HorizontalCurrencyBarChart({
  rows,
  title,
  currency,
  maxBars = 8,
}: {
  rows: BarChartRow[];
  title: string;
  currency: CurrencyCode;
  maxBars?: number;
}) {
  const slice = rows.slice(0, maxBars);
  const data = [...slice].reverse().map((r) => ({
    id: r.id,
    name: r.label,
    amount: r.value,
    full: r.sublabel,
  }));
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-mileway-border bg-mileway-grey-10 text-xs text-mileway-grey">
        No cost data
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <figure className="h-[240px] w-full min-w-0" aria-label={title}>
      <figcaption className="sr-only">{title}</figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={Border.default} horizontal={false} />
          <XAxis type="number" domain={[0, max]} tick={{ fontSize: 10, fill: Text.secondary }} />
          <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10, fill: Text.primary }} interval={0} />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                payload={payload as TooltipPayload[]}
                formatValue={(n) => formatCurrency(n, currency)}
              />
            )}
          />
          <Bar dataKey="amount" name="Amount" fill={Accent.green} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function CostCompositionDonut({
  slices,
  title,
  currency,
}: {
  slices: CostCompositionSlice[];
  title: string;
  currency: CurrencyCode;
}) {
  const data = slices.map((s, i) => ({ ...s, fill: compositionFill(s, i) }));
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-mileway-border bg-mileway-grey-10 text-xs text-mileway-grey">
        No cost breakdown
      </div>
    );
  }
  return (
    <figure className="h-[220px] w-full" aria-label={title}>
      <figcaption className="sr-only">{title}</figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} paddingAngle={1}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.fill} stroke={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                payload={payload as TooltipPayload[]}
                formatValue={(n) => formatCurrency(n, currency)}
              />
            )}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    </figure>
  );
}

const K_IT = getPlannedDaysBucketLabel('it_team_members');
const K_BIZ = getPlannedDaysBucketLabel('business_owners_and_teams');
const K_OTH = getPlannedDaysBucketLabel('other_it_teams');
const K_EXT = getPlannedDaysBucketLabel('external_partners');

/** Stacked horizontal bars: each row is an epic, segments are staffing buckets. */
export function EpicBucketStackedBarChart({ rows, title }: { rows: EpicStackedBucketRow[]; title: string }) {
  const data = [...rows].reverse().map((r) => ({
    name: r.epicKey,
    summary: r.epicSummary,
    [K_IT]: r.it_team_members,
    [K_BIZ]: r.business_owners_and_teams,
    [K_OTH]: r.other_it_teams,
    [K_EXT]: r.external_partners,
  }));

  if (rows.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-mileway-border bg-mileway-grey-10 text-xs text-mileway-grey">
        No epics
      </div>
    );
  }

  return (
    <figure className="h-[280px] w-full min-w-0" aria-label={title}>
      <figcaption className="sr-only">{title}</figcaption>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={Border.default} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: Text.secondary }} />
          <YAxis type="category" dataKey="name" width={68} tick={{ fontSize: 10, fill: Text.primary }} interval={0} />
          <Tooltip content={<ChartTooltip valueSuffix=" d" />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Bar dataKey={K_IT} stackId="b" fill={Accent.blue} name={K_IT} />
          <Bar dataKey={K_BIZ} stackId="b" fill={Accent.green} name={K_BIZ} />
          <Bar dataKey={K_OTH} stackId="b" fill={Text.secondary} name={K_OTH} />
          <Bar dataKey={K_EXT} stackId="b" fill={Accent.orange} name={K_EXT} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
