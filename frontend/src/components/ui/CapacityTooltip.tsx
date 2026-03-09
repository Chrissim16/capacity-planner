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
          <div className="bg-white border border-[#E5E5E3] rounded-card shadow-md p-3 text-xs">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-[#F0EFED]">
              <span className="font-semibold text-[#1A1A1A]">Capacity breakdown</span>
              <span className="text-[#9CA3AF]">
                {capacity.usedDays.toFixed(1)}d / {capacity.totalWorkdays}d
              </span>
            </div>

            <div className="space-y-1.5">
              {bauItem && (
                <div className="flex justify-between text-[#9CA3AF]">
                  <span>BAU reserve</span>
                  <span className="font-medium">{bauItem.days}d</span>
                </div>
              )}

              {timeOffItem && (
                <div className="flex justify-between text-[#F97316]">
                  <span>Time off{timeOffItem.reason ? ` (${timeOffItem.reason})` : ''}</span>
                  <span className="font-medium">{timeOffItem.days}d</span>
                </div>
              )}

              {projectItems.length > 0 && (
                <>
                  {(bauItem || timeOffItem) && (
                    <div className="border-t border-[#F0EFED] pt-1.5 mt-1.5" />
                  )}
                  {projectItems.map((item: CapacityBreakdownItem, i: number) => (
                    <div key={i} className="flex justify-between text-[#6B7280]">
                      <span className="truncate max-w-[180px]">
                        {item.projectName}
                        {item.phaseName ? (
                          <span className="text-[#9CA3AF]"> / {item.phaseName}</span>
                        ) : null}
                      </span>
                      <span className="font-medium ml-2 shrink-0">{item.days}d</span>
                    </div>
                  ))}
                </>
              )}

              {projectItems.length === 0 && !timeOffItem && (
                <div className="text-[#9CA3AF] italic">No project assignments yet</div>
              )}
            </div>

            <div className={`flex justify-between mt-2 pt-2 border-t border-[#F0EFED] font-semibold ${
              capacity.status === 'overallocated'
                ? 'text-[#EF4444]'
                : capacity.status === 'warning'
                ? 'text-[#F97316]'
                : 'text-[#22C55E]'
            }`}>
              <span>{capacity.availableDays === 0 && capacity.availableDaysRaw < 0 ? 'Over by' : 'Available'}</span>
              <span>
                {capacity.availableDays === 0 && capacity.availableDaysRaw < 0
                  ? `${Math.abs(capacity.availableDaysRaw).toFixed(1)}d`
                  : `${capacity.availableDays.toFixed(1)}d`}
              </span>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-white border-r border-b border-[#E5E5E3] rotate-45 -mt-1" />
          </div>
        </div>
      )}
    </div>
  );
}
