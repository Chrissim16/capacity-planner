/**
 * PlannerCapacity — Per-member sprint allocation panel (Step 5).
 *
 * This is a placeholder shell with the correct prop contract.
 * The full implementation (heatmap rows, live-drag preview, colour tiers)
 * will be built in the dedicated Step 5 session.
 */
import type { PlannerItem, Sprint } from '../../types';
import type { DragPreview } from './PlannerTimeline';

export interface PlannerCapacityProps {
  plannerItems: PlannerItem[];
  sprints: Sprint[];
  selectedQuarter: string;
  /** Live drag preview from PlannerTimeline — used to show provisional allocation. */
  activeDragPreview?: DragPreview | null;
  isVisible: boolean;
}

export function PlannerCapacity({ isVisible }: PlannerCapacityProps) {
  if (!isVisible) return null;

  return (
    <div
      className="flex-shrink-0 border-t border-mileway-border bg-white flex items-center justify-center"
      style={{ height: 64 }}
    >
      <p className="text-xs text-mileway-grey italic">
        Capacity panel — full implementation coming in Step 5
      </p>
    </div>
  );
}
