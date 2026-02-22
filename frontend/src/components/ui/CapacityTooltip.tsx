import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CapacityResult, CapacityBreakdownItem } from '../../types';

interface CapacityTooltipProps {
  capacity: CapacityResult;
  children: ReactNode;
}

/**
 * Wraps any element with a hover tooltip showing the full capacity breakdown:
 * BAU reserve, time off, and per-project allocations.
 */
export function CapacityTooltip({ capacity, children }: CapacityTooltipProps) {
  const [visible, setVisible] = useState(false);

  const bauItem = capacity.breakdown.find((b: CapacityBreakdownItem) => b.type === 'bau');
  const timeOffItem = capacity.breakdown.find((b: CapacityBreakdownItem) => b.type === 'timeoff');
  const projectItems = capacity.breakdown.filter((b: CapacityBreakdownItem) => b.type === 'project');

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}

      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-3 text-xs">
            {/* Header */}
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Capacity breakdown</span>
              <span className="text-slate-500 dark:text-slate-400">
                {capacity.usedDays.toFixed(1)}d / {capacity.totalWorkdays}d
              </span>
            </div>

            <div className="space-y-1.5">
              {/* BAU */}
              {bauItem && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>BAU reserve</span>
                  <span className="font-medium">{bauItem.days}d</span>
                </div>
              )}

              {/* Time off */}
              {timeOffItem && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Time off{timeOffItem.reason ? ` (${timeOffItem.reason})` : ''}</span>
                  <span className="font-medium">{timeOffItem.days}d</span>
                </div>
              )}

              {/* Projects */}
              {projectItems.length > 0 && (
                <>
                  {(bauItem || timeOffItem) && (
                    <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5 mt-1.5" />
                  )}
                  {projectItems.map((item: CapacityBreakdownItem, i: number) => (
                    <div key={i} className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="truncate max-w-[180px]">
                        {item.projectName}
                        {item.phaseName ? (
                          <span className="text-slate-400"> / {item.phaseName}</span>
                        ) : null}
                      </span>
                      <span className="font-medium ml-2 shrink-0">{item.days}d</span>
                    </div>
                  ))}
                </>
              )}

              {projectItems.length === 0 && !timeOffItem && (
                <div className="text-slate-400 italic">No project assignments yet</div>
              )}
            </div>

            {/* Available */}
            <div className={`flex justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 font-semibold ${
              capacity.status === 'overallocated'
                ? 'text-red-600 dark:text-red-400'
                : capacity.status === 'warning'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              <span>{capacity.availableDays === 0 && capacity.availableDaysRaw < 0 ? 'Over by' : 'Available'}</span>
              <span>
                {capacity.availableDays === 0 && capacity.availableDaysRaw < 0
                  ? `${Math.abs(capacity.availableDaysRaw).toFixed(1)}d`
                  : `${capacity.availableDays.toFixed(1)}d`}
              </span>
            </div>
          </div>
          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-white dark:bg-slate-800 border-r border-b border-slate-200 dark:border-slate-700 rotate-45 -mt-1" />
          </div>
        </div>
      )}
    </div>
  );
}
