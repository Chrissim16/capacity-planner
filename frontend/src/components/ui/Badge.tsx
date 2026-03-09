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
      default:      'bg-[#F5F3F0] text-[#6B7280] border border-[#E5E5E3]',
      success:      'bg-[#DCFCE7] text-[#166534] border border-[#A7F3D0]',
      warning:      'bg-[#FFF7ED] text-[#92400E] border border-[#FED7AA]',
      danger:       'bg-[#FFF5F5] text-[#991B1B] border border-[#FECACA]',
      primary:      'bg-[#CCFBF1] text-[#0BB8B5] border border-[#99F6E4]',
      outline:      'border border-[#E5E5E3] text-[#6B7280]',
      green:        'bg-[#DCFCE7] text-[#166534] border border-[#A7F3D0]',
      amber:        'bg-[#FFF7ED] text-[#92400E] border border-[#FED7AA]',
      red:          'bg-[#FFF5F5] text-[#991B1B] border border-[#FECACA]',
      blue:         'bg-[#CCFBF1] text-[#0BB8B5] border border-[#99F6E4]',
      grey:         'bg-[#F5F3F0] text-[#6B7280] border border-[#E5E5E3]',
      tentative:    'bg-[#F5F3F0] text-[#6B7280] border border-dashed border-[#9CA3AF]',
      beginner:     'bg-[#FFF7ED] text-[#92400E] border border-[#FED7AA]',
      intermediate: 'bg-[#CCFBF1] text-[#0BB8B5] border border-[#99F6E4]',
      advanced:     'bg-[#E8F8F8] text-[#0ED3CF] border border-[#99F6E4]',
      expert:       'bg-[#1A1A1A] text-white border border-[#1A1A1A]',
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
