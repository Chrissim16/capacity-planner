import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  progress?: number;
  max?: number;
  status?: 'normal' | 'warning' | 'danger' | 'overallocated' | string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, progress, max = 100, status, showLabel = false, size = 'md', ...props }, ref) => {
    const actualValue = value ?? progress ?? 0;
    const percentage = Math.min(Math.max((actualValue / max) * 100, 0), 100);
    const computedStatus = status || (percentage > 100 ? 'danger' : percentage > 90 ? 'warning' : 'normal');

    const statusColors: Record<string, string> = {
      normal:      'bg-[#22C55E]',
      warning:     'bg-[#F97316]',
      danger:      'bg-[#EF4444]',
      overallocated:'bg-[#EF4444]',
    };

    const sizes = {
      sm: 'h-1',
      md: 'h-1',
      lg: 'h-1.5',
    };

    return (
      <div ref={ref} className={clsx('w-full', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-[#6B7280]">{actualValue}d / {max}d</span>
            <span className={clsx(
              'font-medium',
              computedStatus === 'normal'  && 'text-[#22C55E]',
              computedStatus === 'warning' && 'text-[#F97316]',
              (computedStatus === 'danger' || computedStatus === 'overallocated') && 'text-[#EF4444]',
            )}>
              {Math.round(percentage)}%
            </span>
          </div>
        )}
        <div className={clsx('w-full bg-[#F0EFED] rounded-full overflow-hidden', sizes[size])}>
          <div
            className={clsx('h-full rounded-full transition-all duration-300', statusColors[computedStatus] ?? 'bg-[#22C55E]')}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';
