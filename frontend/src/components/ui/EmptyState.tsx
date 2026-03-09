import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
  children,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-[#F5F3F0] flex items-center justify-center mb-5">
        <Icon className="w-7 h-7 text-[#9CA3AF]" />
      </div>
      <h3 className="text-base font-semibold text-[#1A1A1A] mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-[#6B7280] max-w-sm leading-relaxed mb-6">
        {description}
      </p>
      {(action || secondaryAction || children) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {action && (
            <button
              onClick={action.onClick}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1A1A1A] hover:opacity-85 rounded-lg transition-opacity duration-150"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 text-sm font-medium text-[#1A1A1A] bg-white border border-[#E5E5E3] hover:bg-[#F5F3F0] rounded-lg transition-colors duration-150"
            >
              {secondaryAction.label}
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
