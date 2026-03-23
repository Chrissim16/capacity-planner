import type { EpicRisk } from '../../utils/reportRisks';
import type { TeamMember } from '../../types';

export interface OverbookedMember {
  member: TeamMember;
  usedPercent: number;
  quarter: string;
}

export interface ReportRisksProps {
  epicRisks: EpicRisk[];
  overbookedMembers: OverbookedMember[];
}

export function ReportRisks({ epicRisks, overbookedMembers }: ReportRisksProps) {
  const total = overbookedMembers.length + epicRisks.length;

  const header = (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
        Capacity Risks
      </h2>
      {total > 0 ? (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706]">
          {total} risk{total !== 1 ? 's' : ''} flagged
        </span>
      ) : (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A]">
          No risks
        </span>
      )}
    </div>
  );

  if (total === 0) {
    return (
      <div>
        {header}
        <div className="flex items-center gap-2 text-sm text-[#16A34A]">
          <span>✓</span>
          <span>No capacity risks detected for this quarter.</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <ul className="space-y-2">
        {/* High — overbooked members */}
        {overbookedMembers.map(({ member, usedPercent, quarter }) => (
          <li key={`over-${member.id}-${quarter}`} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-base leading-none" title="High severity">🔴</span>
            <div>
              <span className="text-sm text-[#1E293B]">
                {member.name} — overbooked {usedPercent}%
              </span>
              <span className="ml-2 text-xs text-[#94A3B8]">in {quarter}</span>
            </div>
          </li>
        ))}

        {/* Medium — epic staffing gaps */}
        {epicRisks.map(risk => (
          <li key={`${risk.type}-${risk.epicKey}`} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-base leading-none" title="Medium severity">🟠</span>
            <div>
              {risk.type === 'no-staff' ? (
                <span className="text-sm text-[#1E293B]">
                  {risk.epicName} — no team members assigned
                </span>
              ) : (
                <span className="text-sm text-[#1E293B]">
                  {risk.epicName} — {risk.assignedDays}d assigned vs {risk.storyPoints} story points
                </span>
              )}
              <span className="ml-2 text-xs text-[#94A3B8]">{risk.epicKey}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
