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
    <div className="min-w-[160px] rounded-lg border border-mw-grey-light dark:border-[#1E3550] bg-white dark:bg-[#132133] shadow-lg px-3.5 py-2.5">
      <p className="text-xs font-semibold tracking-wider uppercase text-mw-grey dark:text-[#8BA8BF] mb-2">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="text-sm text-mw-grey dark:text-[#8BA8BF] flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-sm shrink-0"
                style={{ background: entry.color ?? '#0089DD' }}
              />
              {entry.name}
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

