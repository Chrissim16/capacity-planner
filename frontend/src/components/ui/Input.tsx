import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, required, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label 
            htmlFor={id} 
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          className={clsx(
            'w-full px-3 py-2 rounded-lg border-2 bg-white dark:bg-slate-800',
            'text-slate-900 dark:text-white placeholder-slate-400',
            'focus:outline-none focus:ring-2 focus:border-transparent',
            'transition-colors',
            error 
              ? 'border-red-500 ring-red-500/20 ring-2 focus:ring-red-500' 
              : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
