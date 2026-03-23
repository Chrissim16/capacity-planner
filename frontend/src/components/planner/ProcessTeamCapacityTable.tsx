/**
 * ProcessTeamCapacityTable — quarterly capacity summary per process team.
 *
 * Renders a compact table with one row per process team showing:
 *   Team name | Available days | Allocated days | Utilisation %
 *
 * Data is passed in as pre-computed summaries (see useProcessTeamCapacitySummaries).
 * US-SP-03
 */
import { allocationTierClass } from '../../utils/allocationTier';
import type { GroupCapacitySummary } from '../../utils/capacity';

export interface ProcessTeamCapacityTableProps {
  summaries: { id: string; name: string; data: GroupCapacitySummary }[];
}

export function ProcessTeamCapacityTable({ summaries }: ProcessTeamCapacityTableProps) {
  if (summaries.length === 0) {
    return (
      <p className="text-sm text-[#94A3B8] italic">No process teams configured.</p>
    );
  }

  return (
    <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #DEDFE3' }}>
          <th className="text-left py-1.5 pr-4 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
            Team
          </th>
          <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
            Available
          </th>
          <th className="text-right py-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
            Allocated
          </th>
          <th className="text-right py-1.5 pl-2 text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
            Utilisation
          </th>
        </tr>
      </thead>
      <tbody>
        {summaries.map(({ id, name, data }) => {
          const isNa = data.totalDays === 0;
          const pct = isNa ? null : Math.round(data.utilization * 100);
          const tierClass = isNa ? 'text-[#94A3B8]' : allocationTierClass(data.utilization);
          return (
            <tr key={id} style={{ borderBottom: '1px solid #F0F2F5' }}>
              <td className="py-2 pr-4 font-medium text-[#1E293B]">{name}</td>
              <td className="py-2 px-2 text-right tabular-nums text-[#1E293B]">
                {isNa ? '—' : `${data.availableDays}d`}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-[#1E293B]">
                {isNa ? '—' : `${data.usedDays}d`}
              </td>
              <td className={`py-2 pl-2 text-right tabular-nums font-semibold ${tierClass}`}>
                {isNa ? 'N/A' : `${pct}%`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
