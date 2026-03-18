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
      default:      'bg-[#EEEEF1] text-[#6C7A89] border border-[#CFCFD5]',
      success:      'bg-[#DCFCE7] text-[#166534] border border-[#A7F3D0]',
      warning:      'bg-[#FFF7ED] text-[#92400E] border border-[#FED7AA]',
      danger:       'bg-[#FFF5F5] text-[#991B1B] border border-[#FECACA]',
      primary:      'bg-[#E6F2FC] text-[#0077C2] border border-[#B3D9F5]',
      outline:      'border border-[#CFCFD5] text-[#6C7A89]',
      green:        'bg-[#DCFCE7] text-[#166534] border border-[#A7F3D0]',
      amber:        'bg-[#FFF7ED] text-[#92400E] border border-[#FED7AA]',
      red:          'bg-[#FFF5F5] text-[#991B1B] border border-[#FECACA]',
      blue:         'bg-[#E6F2FC] text-[#0077C2] border border-[#B3D9F5]',
      grey:         'bg-[#EEEEF1] text-[#6C7A89] border border-[#CFCFD5]',
      tentative:    'bg-[#EEEEF1] text-[#6C7A89] border border-dashed border-[#B5BDC4]',
      beginner:     'bg-[#FFF7ED] text-[#92400E] border border-[#FED7AA]',
      intermediate: 'bg-[#E6F2FC] text-[#0077C2] border border-[#B3D9F5]',
      advanced:     'bg-[#E6F2FC] text-[#0089DD] border border-[#B3D9F5]',
      expert:       'bg-[#003565] text-white border border-[#003565]',
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
