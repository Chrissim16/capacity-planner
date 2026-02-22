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

/**
 * Consistent empty state with icon, title, description, and optional CTA button.
 * Used across all pages when lists have no data to display.
 */
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
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-5">
        {description}
      </p>
      {(action || secondaryAction || children) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {action && (
            <button
              onClick={action.onClick}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
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
