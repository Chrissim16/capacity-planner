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
          className="text-4xl font-bold tracking-tight text-[#1A1A1A] leading-tight"
          style={{ fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>
        <p className="text-base text-[#6B7280] mt-1.5">{subtitle}</p>
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0 pt-1">{actions}</div> : null}
    </div>
  );
}
