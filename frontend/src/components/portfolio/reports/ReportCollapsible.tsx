import { useId, useState, type ReactNode } from 'react';

export interface ReportCollapsibleProps {
  title: string;
  /** When false (default), content is hidden until expanded. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export function ReportCollapsible({ title, defaultOpen = false, children }: ReportCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="rounded-lg border border-mileway-border bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-mileway-grey transition-colors hover:bg-mileway-grey-10 focus:outline-none focus:ring-2 focus:ring-sana-teal focus:ring-inset"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="shrink-0 tabular-nums text-mileway-text" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-mileway-border px-4 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
