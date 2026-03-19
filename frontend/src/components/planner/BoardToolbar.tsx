/**
 * BoardToolbar — secondary toolbar strip for Board mode.
 *
 * 36px strip rendered between the main top-bar and the epic cards grid.
 * Contains: quarter selector · group-by (v1: Epic only) · sort order.
 *
 * US-UI-14
 */

import { useMemo } from 'react';
import { generateQuarters } from '../../utils/calendar';
import type { BoardSort } from './PlannerBoard';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BoardToolbarProps {
  selectedQuarter: string;
  onQuarterChange: (q: string) => void;
  sort: BoardSort;
  onSortChange: (s: BoardSort) => void;
}

// ── BoardToolbar ──────────────────────────────────────────────────────────────

export function BoardToolbar({ selectedQuarter, onQuarterChange, sort, onSortChange }: BoardToolbarProps) {
  const quarters = useMemo(() => generateQuarters(8), []);

  return (
    <div className="flex items-center gap-4 px-6 border-b border-mileway-border bg-white flex-shrink-0 h-9">
      {/* Quarter */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-mileway-grey">Quarter</span>
        <select
          value={selectedQuarter}
          onChange={e => onQuarterChange(e.target.value)}
          aria-label="Select quarter"
          className="text-xs border border-mileway-border rounded px-2 py-0.5 text-mileway-text bg-white focus:outline-none focus:border-mileway-blue transition-colors duration-fast"
        >
          {quarters.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      </div>

      <div className="h-4 w-px bg-mileway-border" />

      {/* Group by */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-mileway-grey">Group by</span>
        <select
          value="epic"
          disabled
          aria-label="Group by"
          className="text-xs border border-mileway-border rounded px-2 py-0.5 text-mileway-text bg-white focus:outline-none disabled:opacity-60 cursor-not-allowed"
        >
          <option value="epic">Epic</option>
        </select>
      </div>

      <div className="h-4 w-px bg-mileway-border" />

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-mileway-grey">Sort</span>
        <select
          value={sort}
          onChange={e => onSortChange(e.target.value as BoardSort)}
          aria-label="Sort epics"
          className="text-xs border border-mileway-border rounded px-2 py-0.5 text-mileway-text bg-white focus:outline-none focus:border-mileway-blue transition-colors duration-fast"
        >
          <option value="priority">Priority</option>
          <option value="name">Name</option>
          <option value="assigned">% Assigned</option>
        </select>
      </div>
    </div>
  );
}
