import { useState, useMemo, useCallback } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Search, GripVertical, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { JiraWorkItem, JiraItemType, PlannerItem } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPANDED_WIDTH = 268;

type StatusFilter = 'all' | 'todo' | 'in_progress';

// ── Type chip config ──────────────────────────────────────────────────────────

const TYPE_CHIP: Record<JiraItemType, { label: string; className: string }> = {
  epic:    { label: 'EPIC',    className: 'bg-mileway-blue-10 text-mileway-blue' },
  feature: { label: 'FEAT',   className: 'bg-mileway-blue-10 text-mileway-blue' },
  story:   { label: 'STORY',  className: 'bg-mileway-grey-10 text-mileway-grey' },
  task:    { label: 'TASK',   className: 'bg-mileway-grey-10 text-mileway-grey' },
  bug:     { label: 'BUG',    className: 'bg-red-50 text-util-over' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PlannerBacklogProps {
  /** All active Jira items for this scenario (statusCategory !== 'done'). */
  jiraItems: JiraWorkItem[];
  /** Items already placed on the planner timeline in the current scenario. */
  plannerItems: PlannerItem[];
  /**
   * Called when the user drops a timeline bar onto the backlog.
   * Stub for now — wired up in Step 6 (drop behaviour).
   */
  onDropUnschedule?: (plannerItemId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlannerBacklog({ jiraItems, plannerItems, onDropUnschedule: _onDropUnschedule }: PlannerBacklogProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [epicFilter, setEpicFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ── Derive unscheduled list ─────────────────────────────────────────────────
  const scheduledSourceIds = useMemo(
    () => new Set(plannerItems.map(p => p.sourceId)),
    [plannerItems],
  );

  const unscheduled = useMemo(
    () => jiraItems.filter(item => !scheduledSourceIds.has(item.id)),
    [jiraItems, scheduledSourceIds],
  );

  // ── Build epic options for the filter dropdown ──────────────────────────────
  const epicOptions = useMemo<Array<{ key: string; label: string }>>(() => {
    const epics = jiraItems.filter(item => item.type === 'epic');
    return epics.map(e => ({ key: e.jiraKey, label: e.summary }));
  }, [jiraItems]);

  // ── Apply filters ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unscheduled.filter(item => {
      if (q && !item.summary.toLowerCase().includes(q) && !item.jiraKey.toLowerCase().includes(q)) {
        return false;
      }
      if (epicFilter !== 'all' && item.parentKey !== epicFilter) return false;
      if (statusFilter === 'todo' && item.statusCategory !== 'todo') return false;
      if (statusFilter === 'in_progress' && item.statusCategory !== 'in_progress') return false;
      return true;
    });
  }, [unscheduled, search, epicFilter, statusFilter]);

  const hasActiveFilters = search !== '' || epicFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearch('');
    setEpicFilter('all');
    setStatusFilter('all');
  }, []);

  // ── Drop zone (stub — wired in Step 6) ─────────────────────────────────────
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'backlog' });

  // ── Collapsed strip ─────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div
        className="flex-shrink-0 flex flex-col items-center justify-between bg-white border-r border-mileway-border py-4"
        style={{ width: 40 }}
      >
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand backlog"
          title="Expand backlog"
          className="p-1 rounded text-mileway-grey hover:bg-mileway-bg hover:text-mileway-text transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
        >
          <ChevronRight size={16} />
        </button>

        <span
          className="text-xs font-semibold text-mileway-grey select-none"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          aria-label={`${unscheduled.length} unscheduled items`}
        >
          {unscheduled.length} unscheduled
        </span>

        <div aria-hidden="true" />
      </div>
    );
  }

  // ── Expanded panel ──────────────────────────────────────────────────────────
  return (
    <div
      ref={setDropRef}
      className="flex-shrink-0 flex flex-col bg-white border-r border-mileway-border"
      style={{ width: EXPANDED_WIDTH }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mileway-border">
        <span className="text-sm font-semibold text-mileway-text">
          Unscheduled
          <span className="ml-1.5 text-xs font-medium text-mileway-grey">
            ({unscheduled.length})
          </span>
        </span>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse backlog"
          title="Collapse backlog"
          className="p-1 rounded text-mileway-grey hover:bg-mileway-bg hover:text-mileway-text transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mileway-grey pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-mileway-border rounded-lg text-mileway-text placeholder:text-mileway-grey focus:outline-none focus:border-mileway-blue transition-colors duration-fast"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 pb-3 flex items-center gap-2">
        {/* Epic filter */}
        <select
          value={epicFilter}
          onChange={e => setEpicFilter(e.target.value)}
          aria-label="Filter by epic"
          className="flex-1 min-w-0 text-xs border border-mileway-border rounded-lg px-2 py-1.5 text-mileway-text bg-white focus:outline-none focus:border-mileway-blue transition-colors duration-fast"
        >
          <option value="all">All epics</option>
          {epicOptions.map(opt => (
            <option key={opt.key} value={opt.key}>
              {opt.label.length > 22 ? `${opt.label.slice(0, 22)}…` : opt.label}
            </option>
          ))}
        </select>

        {/* Status filter pills */}
        <div className="flex gap-1">
          {(['all', 'todo', 'in_progress'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={[
                'text-xs font-medium px-2 py-1 rounded-pill transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                statusFilter === s
                  ? 'bg-mileway-blue-10 text-mileway-blue'
                  : 'text-mileway-grey hover:bg-mileway-bg',
              ].join(' ')}
            >
              {s === 'all' ? 'All' : s === 'todo' ? 'To do' : 'Active'}
            </button>
          ))}
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {filtered.length === 0 ? (
          <EmptyState
            allEmpty={unscheduled.length === 0}
            hasFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        ) : (
          filtered.map(item => (
            <BacklogItem key={item.id} item={item} />
          ))
        )}

        {/* Drop-to-unschedule overlay — shown when a timeline bar is dragged over */}
        {isOver && (
          <div
            aria-live="polite"
            className="flex items-center justify-center rounded-lg border-2 border-dashed border-mileway-blue bg-mileway-blue-10 py-4 text-sm font-medium text-mileway-blue"
          >
            Drop to unschedule
          </div>
        )}
      </div>
    </div>
  );
}

// ── BacklogItem ───────────────────────────────────────────────────────────────

interface BacklogItemProps {
  item: JiraWorkItem;
}

export function BacklogItem({ item }: BacklogItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: 'backlog-item', jiraItem: item },
  });

  const chip = TYPE_CHIP[item.type] ?? TYPE_CHIP.task;

  return (
    <div
      ref={setNodeRef}
      className={[
        'group relative flex items-start gap-2 p-3 bg-white border border-mileway-border rounded-lg',
        'transition-opacity duration-fast select-none',
        isDragging ? 'opacity-50' : 'opacity-100 hover:border-mileway-blue cursor-grab',
      ].join(' ')}
      {...attributes}
      {...listeners}
    >
      {/* Drag handle — visual affordance only; entire card is draggable */}
      <div
        className="mt-0.5 flex-shrink-0 text-mileway-grey opacity-0 group-hover:opacity-100 transition-opacity duration-fast"
        aria-hidden="true"
      >
        <GripVertical size={14} />
      </div>

      <div className="min-w-0 flex-1">
        {/* Type chip + Jira key row */}
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={[
              'inline-block text-xs font-semibold px-1.5 py-0.5 rounded',
              chip.className,
            ].join(' ')}
          >
            {chip.label}
          </span>
          <span className="text-xs text-mileway-grey truncate">{item.jiraKey}</span>
        </div>

        {/* Summary */}
        <p className="text-sm font-medium text-mileway-text leading-snug line-clamp-2">
          {item.summary}
        </p>
      </div>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  allEmpty: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
}

function EmptyState({ allEmpty, hasFilters, onClearFilters }: EmptyStateProps) {
  if (allEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
        <CheckCircle2 size={24} className="text-util-healthy" />
        <p className="text-sm font-medium text-mileway-text">All items are on the timeline</p>
        <p className="text-xs text-mileway-grey">Nothing left in the backlog.</p>
      </div>
    );
  }

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
        <p className="text-sm font-medium text-mileway-text">No items match your filters</p>
        <button
          onClick={onClearFilters}
          className="text-xs text-mileway-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return null;
}
