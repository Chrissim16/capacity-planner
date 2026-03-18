import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1
          className="text-2xl font-bold text-[#003565] leading-tight"
        >
          {title}
        </h1>
        <p className="text-sm text-[#6C7A89] mt-1">{subtitle}</p>
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0 pt-1">{actions}</div> : null}
    </div>
  );
}
