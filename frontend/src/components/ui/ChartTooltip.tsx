interface TooltipEntry {
  name?: string;
  value?: string | number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="min-w-[160px] rounded-card border border-[#DEDFE3] bg-white shadow-md px-3.5 py-2.5"
      style={{ fontFamily: "'DM Sans', ui-sans-serif, sans-serif" }}
    >
      <p className="text-xs font-medium text-[#94A3B8] mb-2">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="text-sm text-[#94A3B8] flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: entry.color ?? '#D97706' }}
              />
              {entry.name}
            </span>
            <span className="text-sm font-semibold text-[#1E293B] tabular-nums">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
