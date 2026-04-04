import { useMemo } from 'react';
import type { InitiativeCostSummary, PortfolioCostSummary } from '../utils/costing';
import { formatCurrency } from '../utils/currency';

export interface CostsViewProps {
  boardEpics: any[];
  portfolioCostSummary: PortfolioCostSummary;
  baselinePortfolioCostSummary: PortfolioCostSummary | null;
  quarter: string;
  activeScenarioName: string | null;
  onOpenCostDrawer: (epicKey: string) => void;
}

export function CostsView({
  portfolioCostSummary,
  baselinePortfolioCostSummary,
  activeScenarioName,
  onOpenCostDrawer,
}: CostsViewProps) {
  const costDeltaByInitiative = useMemo(() => {
    if (!baselinePortfolioCostSummary) return new Map<string, number>();
    const baselineMap = new Map<string, number>(
      baselinePortfolioCostSummary.initiatives.map((initiative: InitiativeCostSummary) => [
        initiative.initiativeId,
        initiative.totalCost,
      ]),
    );
    return new Map<string, number>(
      portfolioCostSummary.initiatives.map((initiative: InitiativeCostSummary) => [
        initiative.initiativeId,
        initiative.totalCost - (baselineMap.get(initiative.initiativeId) ?? 0),
      ]),
    );
  }, [baselinePortfolioCostSummary, portfolioCostSummary.initiatives]);

  const totalCostDelta = useMemo(() => {
    let total = 0;
    costDeltaByInitiative.forEach((delta: number) => {
      total += delta;
    });
    return total;
  }, [costDeltaByInitiative]);

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Cost Overview */}
      <div>
        <div className="pp-sec-hd">
          <span className="pp-sec-title">Cost Overview</span>
          <span className="pp-sec-sub">Reporting currency: {portfolioCostSummary.reportingCurrency}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: 'Total Portfolio Cost', value: portfolioCostSummary.totalCost },
            { label: 'Labor Cost', value: portfolioCostSummary.totalLaborCost },
            { label: 'Direct Cost', value: portfolioCostSummary.totalDirectCost },
            { label: 'Contingency', value: portfolioCostSummary.totalContingencyCost },
            { label: 'Rate Gaps', value: portfolioCostSummary.initiativesWithMissingRates, isCount: true },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-[#DEDFE3] bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">{card.label}</div>
              <div className="mt-2 text-xl font-semibold text-[#1E293B]">
                {card.isCount
                  ? card.value
                  : formatCurrency(card.value, portfolioCostSummary.reportingCurrency)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Delta (for scenarios) */}
      {activeScenarioName && baselinePortfolioCostSummary && (
        <div>
          <div className="pp-sec-hd">
            <span className="pp-sec-title">Cost Delta vs Baseline</span>
            <span className="pp-sec-sub">Changes from {baselinePortfolioCostSummary.reportingCurrency === portfolioCostSummary.reportingCurrency ? 'baseline' : 'baseline (converted to ' + portfolioCostSummary.reportingCurrency + ')'}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              {
                label: 'Total Cost Delta',
                value: totalCostDelta,
                delta: totalCostDelta,
              },
              {
                label: 'Labor Cost Delta',
                value: portfolioCostSummary.totalLaborCost - (baselinePortfolioCostSummary.totalLaborCost ?? 0),
                delta: portfolioCostSummary.totalLaborCost - (baselinePortfolioCostSummary.totalLaborCost ?? 0),
              },
              {
                label: 'Direct Cost Delta',
                value: portfolioCostSummary.totalDirectCost - (baselinePortfolioCostSummary.totalDirectCost ?? 0),
                delta: portfolioCostSummary.totalDirectCost - (baselinePortfolioCostSummary.totalDirectCost ?? 0),
              },
              {
                label: 'Contingency Delta',
                value: portfolioCostSummary.totalContingencyCost - (baselinePortfolioCostSummary.totalContingencyCost ?? 0),
                delta: portfolioCostSummary.totalContingencyCost - (baselinePortfolioCostSummary.totalContingencyCost ?? 0),
              },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-[#DEDFE3] bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">{card.label}</div>
                <div className={`mt-2 text-xl font-semibold ${
                  card.delta > 0 ? 'text-[#B91C1C]' : card.delta < 0 ? 'text-[#15803D]' : 'text-[#1E293B]'
                }`}>
                  {`${card.delta > 0 ? '+' : ''}${formatCurrency(card.value, portfolioCostSummary.reportingCurrency)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost by Initiative */}
      {portfolioCostSummary.initiatives.length > 0 && (
        <div>
          <div className="pp-sec-hd">
            <span className="pp-sec-title">Cost by Initiative</span>
            <span className="pp-sec-sub">Labor, direct cost, contingency, and scenario delta</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#DEDFE3] bg-white">
            <div className="grid grid-cols-[1.6fr,1fr,1fr,1fr,1fr,0.9fr] gap-3 border-b border-[#DEDFE3] bg-[#F8FAFC] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
              <div>Initiative</div>
              <div>Labor</div>
              <div>Direct</div>
              <div>Contingency</div>
              <div>Total</div>
              <div>Delta</div>
            </div>
            {portfolioCostSummary.initiatives.map((initiative) => {
              const delta = costDeltaByInitiative.get(initiative.initiativeId) ?? 0;
              return (
                <div
                  key={initiative.initiativeId}
                  onClick={() => onOpenCostDrawer(initiative.initiativeId)}
                  className="grid grid-cols-[1.6fr,1fr,1fr,1fr,1fr,0.9fr] gap-3 border-b border-[#EEF2F7] px-4 py-3 text-sm last:border-b-0 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1E293B]">{initiative.initiativeId}</span>
                      {initiative.missingRateCount > 0 ? (
                        <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] text-[#C2410C]">Missing rates</span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-[#64748B]">{initiative.initiativeTitle}</div>
                  </div>
                  <div>{formatCurrency(initiative.laborCost, portfolioCostSummary.reportingCurrency)}</div>
                  <div>{formatCurrency(initiative.directCost, portfolioCostSummary.reportingCurrency)}</div>
                  <div>{formatCurrency(initiative.contingencyCost, portfolioCostSummary.reportingCurrency)}</div>
                  <div className="font-semibold text-[#1E293B]">{formatCurrency(initiative.totalCost, portfolioCostSummary.reportingCurrency)}</div>
                  <div className={delta > 0 ? 'text-[#B91C1C]' : delta < 0 ? 'text-[#15803D]' : 'text-[#64748B]'}>
                    {baselinePortfolioCostSummary
                      ? `${delta > 0 ? '+' : ''}${formatCurrency(delta, portfolioCostSummary.reportingCurrency)}`
                      : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
