import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  status?: 'normal' | 'warning' | 'danger' | 'overallocated';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, status, showLabel = false, size = 'md', ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    
    // Auto-determine status if not provided
    const computedStatus = status || (percentage > 100 ? 'danger' : percentage > 90 ? 'warning' : 'normal');
    
    const statusColors: Record<string, string> = {
      normal: 'bg-green-500',
      warning: 'bg-amber-500',
      danger: 'bg-red-500',
      overallocated: 'bg-red-500',
    };
    
    const sizes = {
      sm: 'h-1.5',
      md: 'h-2',
      lg: 'h-3',
    };

    return (
      <div ref={ref} className={clsx('w-full', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-400">{value}d / {max}d</span>
            <span className={clsx(
              'font-medium',
              computedStatus === 'normal' && 'text-green-600 dark:text-green-400',
              computedStatus === 'warning' && 'text-amber-600 dark:text-amber-400',
              computedStatus === 'danger' && 'text-red-600 dark:text-red-400',
            )}>
              {Math.round(percentage)}%
            </span>
          </div>
        )}
        <div className={clsx('w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden', sizes[size])}>
          <div
            className={clsx('h-full rounded-full transition-all duration-300', statusColors[computedStatus])}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';
