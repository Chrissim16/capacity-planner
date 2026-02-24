import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'success'
    | 'warning'
    | 'danger'
    | 'primary'
    | 'outline'
    | 'green'
    | 'amber'
    | 'red'
    | 'blue'
    | 'grey'
    | 'tentative'
    | 'beginner'
    | 'intermediate'
    | 'advanced'
    | 'expert';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-mw-grey-lighter text-mw-grey border border-mw-grey-light dark:bg-[#1A2D45] dark:text-[#8BA8BF] dark:border-[#2A4A6B]',
      success: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700/40',
      warning: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40',
      danger: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-700/40',
      primary: 'bg-mw-primary-light text-mw-primary border border-mw-primary/25 dark:bg-mw-primary/20 dark:text-[#8DD0F5] dark:border-mw-primary/40',
      outline: 'border border-mw-grey-light text-mw-grey dark:border-[#2A4A6B] dark:text-[#8BA8BF]',
      green: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700/40',
      amber: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40',
      red: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-700/40',
      blue: 'bg-mw-primary-light text-mw-primary border border-mw-primary/25 dark:bg-mw-primary/20 dark:text-[#8DD0F5] dark:border-mw-primary/40',
      grey: 'bg-mw-grey-lighter text-mw-grey border border-mw-grey-light dark:bg-[#1A2D45] dark:text-[#8BA8BF] dark:border-[#2A4A6B]',
      tentative: 'bg-mw-grey-lighter text-mw-grey border border-dashed border-mw-grey dark:bg-[#1A2D45] dark:text-[#8BA8BF] dark:border-dashed dark:border-[#8BA8BF]',
      beginner: 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40',
      intermediate: 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700/40',
      advanced: 'bg-mw-primary-light text-mw-primary border border-mw-primary/25 dark:bg-mw-primary/20 dark:text-[#8DD0F5] dark:border-mw-primary/40',
      expert: 'bg-mw-dark text-white border border-mw-dark dark:bg-white dark:text-[#0D1B2A] dark:border-white',
    };

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center px-2 py-[3px] rounded-full text-xs font-bold tracking-wide uppercase whitespace-nowrap',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
