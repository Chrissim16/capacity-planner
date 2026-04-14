import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../../utils/currency';
import type { CurrencyCode } from '../../../types';
import { getPlannedDaysBucketLabel } from '../../../utils/planningGroups';
import type {
  CostReportRow,
  EpicEffortReportRow,
  PersonEpicReportRow,
  TeamEpicReportRow,
} from '../../../utils/portfolioReportAggregators';
import { formatReportDays as formatDays } from '../../../utils/portfolioReportChartModels';

export function PersonEpicTable({
  rows,
  expanded,
  onToggle,
}: {
  rows: PersonEpicReportRow[];
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyReports />;
  }
  return (
    <table className="w-full min-w-[640px] border-collapse text-left text-xs">
      <thead>
        <tr className="border-b border-mileway-border text-[10px] font-semibold uppercase tracking-wide text-mileway-grey">
          <th className="py-2 pr-3">Person</th>
          <th className="py-2 pr-3">Epic</th>
          <th className="py-2 pr-2 text-right">Days</th>
          <th className="py-2 pr-2 text-right">IT</th>
          <th className="py-2 pr-2 text-right">BIZ</th>
          <th className="w-8 py-2" aria-label="Expand" />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const key = `p:${r.actorId}:${r.epicKey}`;
          const isOpen = expanded[key];
          return (
            <Fragment key={key}>
              <tr className="border-b border-mileway-divider hover:bg-mileway-grey-10">
                <td className="py-2 pr-3 font-medium text-mileway-text">{r.actorName}</td>
                <td className="py-2 pr-3 text-mileway-grey">
                  <span className="font-mono text-[11px] text-mileway-blue">{r.epicKey}</span>
                  <span className="ml-1">{r.epicSummary}</span>
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(r.totalVisibleDays)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(r.itDays)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(r.bizDays)}</td>
                <td className="py-2">
                  <button
                    type="button"
                    className="rounded p-0.5 text-mileway-grey hover:bg-mileway-border focus:outline-none focus:ring-2 focus:ring-sana-teal"
                    aria-expanded={isOpen}
                    onClick={() => onToggle(key)}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </td>
              </tr>
              {isOpen ? (
                <tr className="border-b border-mileway-divider bg-mileway-grey-10">
                  <td colSpan={6} className="px-3 py-2">
                    <PhaseSubTable phases={r.phases} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export function TeamEpicTable({
  rows,
  expanded,
  onToggle,
  col1,
}: {
  rows: TeamEpicReportRow[];
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
  col1: string;
}) {
  if (rows.length === 0) {
    return <EmptyReports />;
  }
  return (
    <table className="w-full min-w-[640px] border-collapse text-left text-xs">
      <thead>
        <tr className="border-b border-mileway-border text-[10px] font-semibold uppercase tracking-wide text-mileway-grey">
          <th className="py-2 pr-3">{col1}</th>
          <th className="py-2 pr-3">Epic</th>
          <th className="py-2 pr-2 text-right">Days</th>
          <th className="py-2 pr-2 text-right">IT</th>
          <th className="py-2 pr-2 text-right">BIZ</th>
          <th className="w-8 py-2" aria-label="Expand" />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const key = `t:${r.teamId}:${r.epicKey}`;
          const isOpen = expanded[key];
          return (
            <Fragment key={key}>
              <tr className="border-b border-mileway-divider hover:bg-mileway-grey-10">
                <td className="py-2 pr-3 font-medium text-mileway-text">{r.teamLabel}</td>
                <td className="py-2 pr-3 text-mileway-grey">
                  <span className="font-mono text-[11px] text-mileway-blue">{r.epicKey}</span>
                  <span className="ml-1">{r.epicSummary}</span>
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(r.totalVisibleDays)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(r.itDays)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(r.bizDays)}</td>
                <td className="py-2">
                  <button
                    type="button"
                    className="rounded p-0.5 text-mileway-grey hover:bg-mileway-border focus:outline-none focus:ring-2 focus:ring-sana-teal"
                    aria-expanded={isOpen}
                    onClick={() => onToggle(key)}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </td>
              </tr>
              {isOpen ? (
                <tr className="border-b border-mileway-divider bg-mileway-grey-10">
                  <td colSpan={6} className="px-3 py-2">
                    <PhaseSubTable phases={r.phases} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function PhaseSubTable({ phases }: { phases: PersonEpicReportRow['phases'] }) {
  return (
    <table className="w-full max-w-lg border-collapse text-[11px]">
      <thead>
        <tr className="text-mileway-grey">
          <th className="py-1 text-left font-medium">Phase</th>
          <th className="py-1 text-right font-medium">Days</th>
          <th className="py-1 text-right font-medium">IT</th>
          <th className="py-1 text-right font-medium">BIZ</th>
        </tr>
      </thead>
      <tbody>
        {phases.map((p) => (
          <tr key={p.phaseLabel}>
            <td className="py-1 pr-2 text-mileway-text">{p.phaseLabel}</td>
            <td className="py-1 text-right tabular-nums">{formatDays(p.visibleDays)}</td>
            <td className="py-1 text-right tabular-nums">{formatDays(p.itDays)}</td>
            <td className="py-1 text-right tabular-nums">{formatDays(p.bizDays)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EpicEffortTable({
  rows,
  expanded,
  onToggle,
}: {
  rows: EpicEffortReportRow[];
  expanded: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyReports />;
  }
  return (
    <table className="w-full min-w-[900px] border-collapse text-left text-xs">
      <thead>
        <tr className="border-b border-mileway-border text-[10px] font-semibold uppercase tracking-wide text-mileway-grey">
          <th className="py-2 pr-3">Epic</th>
          <th className="py-2 pr-2 text-right">Days</th>
          <th className="py-2 pr-2 text-right">{getPlannedDaysBucketLabel('it_team_members')}</th>
          <th className="py-2 pr-2 text-right">{getPlannedDaysBucketLabel('business_owners_and_teams')}</th>
          <th className="py-2 pr-2 text-right">{getPlannedDaysBucketLabel('other_it_teams')}</th>
          <th className="py-2 pr-2 text-right">{getPlannedDaysBucketLabel('external_partners')}</th>
          <th className="w-8 py-2" aria-label="Expand" />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const key = `e:${r.epicKey}`;
          const isOpen = expanded[key];
          const b = r.bucketDays;
          return (
            <Fragment key={key}>
              <tr className="border-b border-mileway-divider hover:bg-mileway-grey-10">
                <td className="py-2 pr-3 text-mileway-grey">
                  <span className="font-mono text-[11px] font-medium text-mileway-blue">{r.epicKey}</span>
                  <span className="ml-1 text-mileway-text">{r.epicSummary}</span>
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(r.totalVisibleDays)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(b.it_team_members)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(b.business_owners_and_teams)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(b.other_it_teams)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatDays(b.external_partners)}</td>
                <td className="py-2">
                  <button
                    type="button"
                    className="rounded p-0.5 text-mileway-grey hover:bg-mileway-border focus:outline-none focus:ring-2 focus:ring-sana-teal"
                    aria-expanded={isOpen}
                    onClick={() => onToggle(key)}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </td>
              </tr>
              {isOpen ? (
                <tr className="border-b border-mileway-divider bg-mileway-grey-10">
                  <td colSpan={7} className="px-3 py-2">
                    {r.externalByVendor.length === 0 ? (
                      <span className="text-[11px] text-mileway-grey">No external partner days in this period.</span>
                    ) : (
                      <table className="w-full max-w-md border-collapse text-[11px]">
                        <thead>
                          <tr className="text-mileway-grey">
                            <th className="py-1 text-left font-medium">External vendor</th>
                            <th className="py-1 text-right font-medium">Days</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.externalByVendor.map((v) => (
                            <tr key={v.vendorLabel}>
                              <td className="py-1 text-mileway-text">{v.vendorLabel}</td>
                              <td className="py-1 text-right tabular-nums">{formatDays(v.visibleDays)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export function CostTable({ rows, currency }: { rows: CostReportRow[]; currency: CurrencyCode }) {
  if (rows.length === 0) {
    return <EmptyReports />;
  }
  return (
    <table className="w-full min-w-[880px] border-collapse text-left text-xs">
      <thead>
        <tr className="border-b border-mileway-border text-[10px] font-semibold uppercase tracking-wide text-mileway-grey">
          <th className="py-2 pr-3">Epic</th>
          <th className="py-2 pr-2 text-right">IT labor</th>
          <th className="py-2 pr-2 text-right">BIZ labor</th>
          <th className="py-2 pr-2 text-right">Hardware</th>
          <th className="py-2 pr-2 text-right">Licenses</th>
          <th className="py-2 pr-2 text-right">Contingency</th>
          <th className="py-2 pr-2 text-right">Total</th>
          <th className="py-2 pr-2 text-right">Rate gaps</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.initiativeId} className="border-b border-mileway-divider hover:bg-mileway-grey-10">
            <td className="py-2 pr-3 text-mileway-grey">
              <span className="font-mono text-[11px] font-medium text-mileway-blue">{r.initiativeId}</span>
              <div className="text-mileway-text">{r.initiativeTitle}</div>
            </td>
            <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(r.itLaborCost, currency)}</td>
            <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(r.bizLaborCost, currency)}</td>
            <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(r.hardwareCost, currency)}</td>
            <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(r.licensesCost, currency)}</td>
            <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(r.contingencyCost, currency)}</td>
            <td className="py-2 pr-2 text-right font-medium tabular-nums text-mileway-text">
              {formatCurrency(r.totalCost, currency)}
            </td>
            <td className="py-2 pr-2 text-right tabular-nums text-util-near">{r.missingRateCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmptyReports() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-mileway-grey">
      <div className="text-2xl opacity-40">▤</div>
      <div className="text-sm font-medium text-mileway-text">Nothing to show for this lens</div>
      <div className="max-w-sm text-xs">Add epics to the board and phase assignments to populate portfolio reports.</div>
    </div>
  );
}
