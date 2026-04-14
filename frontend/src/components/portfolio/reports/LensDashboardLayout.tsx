import type { ReactNode } from 'react';

export interface LensDashboardLayoutProps {
  chartArea: ReactNode;
  secondaryCharts?: ReactNode;
  /** e.g. collapsible full tables */
  footer?: ReactNode;
}

export function LensDashboardLayout({ chartArea, secondaryCharts, footer }: LensDashboardLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">{chartArea}</div>
      {secondaryCharts ? <div className="grid gap-4 lg:grid-cols-2">{secondaryCharts}</div> : null}
      {footer}
    </div>
  );
}
