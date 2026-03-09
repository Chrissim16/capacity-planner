import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, required, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[#1A1A1A]"
          >
            {label}
            {required && <span className="text-[#EF4444] ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          required={required}
          className={clsx(
            'w-full px-3 py-2 rounded-lg border bg-white',
            'text-[#1A1A1A]',
            'focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-150 cursor-pointer',
            error
              ? 'border-[#EF4444] ring-[#EF4444]/20 ring-2 focus:ring-[#EF4444]'
              : 'border-[#E5E5E3] focus:ring-[#0ED3CF]/40 focus:border-[#0ED3CF]',
            className
          )}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-sm text-[#EF4444] font-medium flex items-center gap-1">
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

Select.displayName = 'Select';
