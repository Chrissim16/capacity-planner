export interface ReportKpiCardProps {
  label: string;
  value: string;
  subtext: string;
}

/**
 * Portfolio report KPI: label (uppercase micro), prominent value, short subtext.
 */
export function ReportKpiCard({ label, value, subtext }: ReportKpiCardProps) {
  return (
    <div className="rounded-lg border border-mileway-border bg-white px-3 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-mileway-grey">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-mileway-text">{value}</div>
      <div className="mt-1 text-xs leading-snug text-mileway-grey">{subtext}</div>
    </div>
  );
}
