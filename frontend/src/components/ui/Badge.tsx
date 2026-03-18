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
    const variants: Record<string, string> = {
      default:      'bg-[#F0F2F5] text-[#94A3B8] border border-[#DEDFE3]',
      success:      'bg-[#DCFCE7] text-[#166534] border border-[#A7F3D0]',
      warning:      'bg-[#FEF9C3] text-[#1E293B] border border-[#D97706]',
      danger:       'bg-[#FFF5F5] text-[#991B1B] border border-[#FECACA]',
      primary:      'bg-[#E6F2FC] text-[#0077C2] border border-[#CCE4F9]',
      outline:      'border border-[#DEDFE3] text-[#94A3B8]',
      green:        'bg-[#DCFCE7] text-[#166534] border border-[#A7F3D0]',
      amber:        'bg-[#FEF9C3] text-[#1E293B] border border-[#D97706]',
      red:          'bg-[#FFF5F5] text-[#991B1B] border border-[#FECACA]',
      blue:         'bg-[#E6F2FC] text-[#0077C2] border border-[#CCE4F9]',
      grey:         'bg-[#F0F2F5] text-[#94A3B8] border border-[#DEDFE3]',
      tentative:    'bg-[#F0F2F5] text-[#94A3B8] border border-dashed border-[#94A3B8]',
      beginner:     'bg-[#FEF9C3] text-[#1E293B] border border-[#D97706]',
      intermediate: 'bg-[#E6F2FC] text-[#0077C2] border border-[#CCE4F9]',
      advanced:     'bg-[#E6F2FC] text-[#0089DD] border border-[#CCE4F9]',
      expert:       'bg-[#1E293B] text-white border border-[#1E293B]',
    };

    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center px-2 py-[3px] rounded-full text-xs font-semibold tracking-wide whitespace-nowrap',
          variants[variant] ?? variants.default,
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
