/**
 * PlannerBacklog — Sidebar showing unscheduled Jira items in a 3-level tree.
 *
 * SP-01: Epic → Feature → Story tree with per-level expand/collapse.
 * SP-02: Label chips on each card (max 3 visible, +N overflow).
 * SP-03: Jira assignee chip + sprint label / date range on each card.
 * SP-04: "Active in Jira" indicator on in_progress items (visual reminder, not a lock).
 *
 * Sections rendered:
 *   1. Unscheduled Epics (draggable) with their unscheduled children indented below.
 *   2. Scheduled Epics that still have unscheduled children — shown as a non-draggable
 *      header so the PM can still drag those children onto the timeline.
 *   3. "Unlinked items" — Features/Stories with no parent Epic in the Jira data.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDroppable, useDraggable, useDndMonitor } from '@dnd-kit/core';
import {
  Search,
  GripVertical,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { JiraWorkItem, JiraItemType, PlannerItem } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPANDED_WIDTH = 268;
const INDENT_FEATURE = 16;
const INDENT_STORY   = 28;

type StatusFilter = 'all' | 'todo' | 'in_progress';

// ── Type chip config ──────────────────────────────────────────────────────────

const TYPE_CHIP: Record<JiraItemType, { label: string; className: string }> = {
  epic:    { label: 'EPIC',  className: 'bg-mileway-blue-10 text-mileway-blue' },
  feature: { label: 'FEAT',  className: 'bg-mileway-blue-10 text-mileway-blue' },
  story:   { label: 'STORY', className: 'bg-mileway-grey-10 text-mileway-grey' },
  task:    { label: 'TASK',  className: 'bg-mileway-grey-10 text-mileway-grey' },
  bug:     { label: 'BUG',   className: 'bg-red-50 text-util-over' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PlannerBacklogProps {
  jiraItems: JiraWorkItem[];
  plannerItems: PlannerItem[];
  /** Called by ✕ button and Escape key — parent unmounts the drawer */
  onClose: () => void;
  onDropUnschedule?: (plannerItemId: string) => void;
}

// ── Internal tree types ───────────────────────────────────────────────────────

interface TreeNode {
  item: JiraWorkItem;
  /** Children (Features under Epic, or Stories under Feature). */
  children: TreeNode[];
}

interface BacklogSections {
  /** Epics that are not on the timeline, with their unscheduled descendants. */
  unscheduledEpics: TreeNode[];
  /**
   * Epics already on the timeline that still have unscheduled children.
   * Shown as non-draggable headers.
   */
  scheduledEpicHeaders: TreeNode[];
  /** Features/Stories with no resolvable Epic ancestor in the Jira data. */
  orphans: JiraWorkItem[];
  /** Count of unscheduled Epics (for the sidebar header badge). */
  unscheduledEpicCount: number;
}

// ── Tree builder ──────────────────────────────────────────────────────────────

function buildSections(
  jiraItems: JiraWorkItem[],
  plannerItems: PlannerItem[],
): BacklogSections {
  const scheduledSourceIds = new Set(plannerItems.map(p => p.sourceId));

  const isScheduled = (item: JiraWorkItem) => scheduledSourceIds.has(item.id);
  const isUnscheduled = (item: JiraWorkItem) => !isScheduled(item);

  const epics    = jiraItems.filter(i => i.type === 'epic');
  const features = jiraItems.filter(i => i.type === 'feature');
  const stories  = jiraItems.filter(i => i.type !== 'epic' && i.type !== 'feature');

  // Stories grouped under their parent Feature key
  const storiesByFeature = new Map<string, JiraWorkItem[]>();
  for (const s of stories) {
    if (!s.parentKey) continue;
    const bucket = storiesByFeature.get(s.parentKey) ?? [];
    bucket.push(s);
    storiesByFeature.set(s.parentKey, bucket);
  }

  // Build feature TreeNodes (include unscheduled stories beneath them)
  function featureNode(f: JiraWorkItem): TreeNode {
    const childStories = (storiesByFeature.get(f.jiraKey) ?? []).filter(isUnscheduled);
    return { item: f, children: childStories.map(s => ({ item: s, children: [] })) };
  }

  // Features grouped under their parent Epic key
  const featuresByEpic = new Map<string, JiraWorkItem[]>();
  for (const f of features) {
    if (!f.parentKey) continue;
    const bucket = featuresByEpic.get(f.parentKey) ?? [];
    bucket.push(f);
    featuresByEpic.set(f.parentKey, bucket);
  }

  const unscheduledEpics: TreeNode[]        = [];
  const scheduledEpicHeaders: TreeNode[]    = [];
  const coveredFeatureKeys  = new Set<string>();
  const coveredStoryIds     = new Set<string>();

  for (const epic of epics) {
    const epicFeatures = featuresByEpic.get(epic.jiraKey) ?? [];
    const unscheduledFeatures = epicFeatures.filter(isUnscheduled);
    // Track which features/stories are covered by an epic section
    for (const f of epicFeatures) { coveredFeatureKeys.add(f.jiraKey); }
    for (const f of epicFeatures) {
      for (const s of storiesByFeature.get(f.jiraKey) ?? []) coveredStoryIds.add(s.id);
    }

    if (isUnscheduled(epic)) {
      unscheduledEpics.push({
        item: epic,
        children: unscheduledFeatures.map(featureNode),
      });
    } else if (unscheduledFeatures.length > 0) {
      // Epic is on the timeline but has unscheduled children
      scheduledEpicHeaders.push({
        item: epic,
        children: unscheduledFeatures.map(featureNode),
      });
    }
  }

  // Orphans: unscheduled Features/Stories not covered by any Epic section
  const orphanFeatures = features.filter(
    f => isUnscheduled(f) && !coveredFeatureKeys.has(f.jiraKey),
  );
  const orphanStories = stories.filter(
    s => isUnscheduled(s) && !coveredStoryIds.has(s.id) && !s.parentKey,
  );

  return {
    unscheduledEpics,
    scheduledEpicHeaders,
    orphans: [...orphanFeatures, ...orphanStories],
    unscheduledEpicCount: unscheduledEpics.length,
  };
}

// ── Filter helpers ────────────────────────────────────────────────────────────

function matchesFilters(
  item: JiraWorkItem,
  q: string,
  epicFilter: string,
  statusFilter: StatusFilter,
  epicAncestorKey: string | null,
): boolean {
  if (q && !item.summary.toLowerCase().includes(q) && !item.jiraKey.toLowerCase().includes(q)) return false;
  if (epicFilter !== 'all' && epicAncestorKey !== epicFilter && item.jiraKey !== epicFilter) return false;
  if (statusFilter === 'todo' && item.statusCategory !== 'todo') return false;
  if (statusFilter === 'in_progress' && item.statusCategory !== 'in_progress') return false;
  return true;
}

// ── Public component ──────────────────────────────────────────────────────────

export function PlannerBacklog({ jiraItems, plannerItems, onClose, onDropUnschedule: _onDropUnschedule }: PlannerBacklogProps) {
  const [search, setSearch]           = useState('');
  const [epicFilter, setEpicFilter]   = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Track whether a drag is in progress so Escape doesn't close mid-drag
  const [isDragActive, setIsDragActive] = useState(false);
  useDndMonitor({
    onDragStart:  () => setIsDragActive(true),
    onDragEnd:    () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  });

  // Escape key closes the drawer (only when no drag is active)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isDragActive) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, isDragActive]);

  const sections = useMemo(
    () => buildSections(jiraItems, plannerItems),
    [jiraItems, plannerItems],
  );

  const epicOptions = useMemo(
    () => jiraItems.filter(i => i.type === 'epic').map(e => ({ key: e.jiraKey, label: e.summary })),
    [jiraItems],
  );

  const totalUnscheduled =
    sections.unscheduledEpics.length +
    sections.scheduledEpicHeaders.reduce((n, s) => n + s.children.length, 0) +
    sections.orphans.length;

  const hasActiveFilters = search !== '' || epicFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearch('');
    setEpicFilter('all');
    setStatusFilter('all');
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'backlog' });

  const q = search.trim().toLowerCase();

  return (
    <div
      ref={setDropRef}
      className={[
        'absolute top-0 left-0 bottom-0 flex flex-col border-r z-30 animate-slide-in-left transition-colors duration-150',
        isOver ? 'bg-red-50 border-red-300' : 'bg-white border-mileway-border',
      ].join(' ')}
      style={{ width: 280, boxShadow: '4px 0 20px rgba(0,0,0,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-mileway-border flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-mileway-text">Unscheduled</span>
            {sections.unscheduledEpicCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-mileway-blue text-white leading-none">
                {sections.unscheduledEpicCount}
              </span>
            )}
          </div>
          <p className="text-xs text-mileway-grey mt-0.5">
            {totalUnscheduled} item{totalUnscheduled !== 1 ? 's' : ''} · drag to schedule
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close backlog"
          className="p-1 rounded text-mileway-grey hover:bg-mileway-bg hover:text-mileway-text transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mileway-grey pointer-events-none" />
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
      <div className="px-3 pb-3 flex items-center gap-2 flex-shrink-0">
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

      {/* Drop-to-unschedule — full drawer overlay, shown when a bar is dragged over */}
      {isOver && (
        <div
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
        >
          <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-100 border-2 border-dashed border-red-400 text-red-700 text-sm font-semibold shadow-sm">
            Drop to unschedule
          </div>
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-0">

        {/* Unscheduled Epics */}
        {sections.unscheduledEpics.map(node => {
          const epicKey = node.item.jiraKey;
          const expanded = expandedIds.has(epicKey);
          if (!matchesFilters(node.item, q, epicFilter, statusFilter, null)) {
            // If epic itself doesn't match, check if any child matches
            const anyChild = node.children.some(fn =>
              matchesFilters(fn.item, q, epicFilter, statusFilter, epicKey) ||
              fn.children.some(sn => matchesFilters(sn.item, q, epicFilter, statusFilter, epicKey))
            );
            if (!anyChild) return null;
          }
          return (
            <div key={epicKey}>
              <BacklogItem
                item={node.item}
                hasChildren={node.children.length > 0}
                isExpanded={expanded}
                onToggle={() => toggleExpand(epicKey)}
                indent={0}
              />
              {expanded && node.children.map(fn => {
                const featKey = fn.item.jiraKey;
                const featExpanded = expandedIds.has(featKey);
                if (!matchesFilters(fn.item, q, epicFilter, statusFilter, epicKey)) {
                  const anyStory = fn.children.some(sn =>
                    matchesFilters(sn.item, q, epicFilter, statusFilter, epicKey)
                  );
                  if (!anyStory) return null;
                }
                return (
                  <div key={featKey}>
                    <BacklogItem
                      item={fn.item}
                      hasChildren={fn.children.length > 0}
                      isExpanded={featExpanded}
                      onToggle={() => toggleExpand(featKey)}
                      indent={INDENT_FEATURE}
                    />
                    {featExpanded && fn.children.map(sn => {
                      if (!matchesFilters(sn.item, q, epicFilter, statusFilter, epicKey)) return null;
                      return (
                        <BacklogItem key={sn.item.id} item={sn.item} indent={INDENT_STORY} />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Scheduled Epics with unscheduled children */}
        {sections.scheduledEpicHeaders.map(node => {
          const epicKey = node.item.jiraKey;
          const expanded = expandedIds.has(epicKey);
          const visibleChildren = node.children.filter(fn =>
            matchesFilters(fn.item, q, epicFilter, statusFilter, epicKey)
          );
          if (visibleChildren.length === 0 && !(!q && epicFilter === 'all' && statusFilter === 'all')) return null;
          return (
            <div key={epicKey}>
              <ScheduledEpicHeader
                item={node.item}
                childCount={node.children.length}
                isExpanded={expanded}
                onToggle={() => toggleExpand(epicKey)}
              />
              {expanded && visibleChildren.map(fn => (
                <BacklogItem key={fn.item.id} item={fn.item} indent={INDENT_FEATURE} />
              ))}
            </div>
          );
        })}

        {/* Orphans */}
        {sections.orphans.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-mileway-grey uppercase tracking-wider px-1 py-2 mt-1">
              Unlinked items
            </p>
            {sections.orphans
              .filter(i => matchesFilters(i, q, epicFilter, statusFilter, null))
              .map(i => <BacklogItem key={i.id} item={i} indent={0} />)
            }
          </div>
        )}

        {/* Empty state */}
        {totalUnscheduled === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <CheckCircle2 size={24} className="text-util-healthy" />
            <p className="text-sm font-medium text-mileway-text">All items are on the timeline</p>
            <p className="text-xs text-mileway-grey">Nothing left in the backlog.</p>
          </div>
        )}

        {totalUnscheduled > 0 && hasActiveFilters && (
          sections.unscheduledEpics.every(n =>
            !matchesFilters(n.item, q, epicFilter, statusFilter, null) &&
            !n.children.some(fn => matchesFilters(fn.item, q, epicFilter, statusFilter, n.item.jiraKey))
          ) && sections.orphans.every(i => !matchesFilters(i, q, epicFilter, statusFilter, null))
        ) && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <p className="text-sm font-medium text-mileway-text">No items match your filters</p>
            <button
              onClick={clearFilters}
              className="text-xs text-mileway-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ScheduledEpicHeader ───────────────────────────────────────────────────────
// Non-draggable Epic header shown when the Epic is on the timeline but still
// has unscheduled children in the backlog.

function ScheduledEpicHeader({
  item,
  childCount,
  isExpanded,
  onToggle,
}: {
  item: JiraWorkItem;
  childCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-colors duration-fast hover:bg-mileway-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
    >
      {isExpanded ? <ChevronDown size={12} className="text-mileway-grey flex-shrink-0" /> : <ChevronRight size={12} className="text-mileway-grey flex-shrink-0" />}
      <span className="text-xs font-semibold text-mileway-grey truncate flex-1">{item.summary}</span>
      <span className="flex-shrink-0 text-[10px] font-medium text-mileway-grey bg-mileway-bg px-1.5 py-0.5 rounded">
        {item.jiraKey}
      </span>
      <span className="flex-shrink-0 text-[10px] text-mileway-grey">{childCount} left</span>
    </button>
  );
}

// ── BacklogItem ───────────────────────────────────────────────────────────────

interface BacklogItemProps {
  item: JiraWorkItem;
  indent?: number;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function BacklogItem({ item, indent = 0, hasChildren = false, isExpanded = false, onToggle }: BacklogItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: 'backlog-item', jiraItem: item },
  });

  const chip = TYPE_CHIP[item.type] ?? TYPE_CHIP.task;
  const isActive = item.statusCategory === 'in_progress';

  // Sprint or date range display (SP-03)
  const sprintLabel = (() => {
    if (item.sprintName) return item.sprintName;
    if (item.startDate && item.dueDate) {
      const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
      return `${fmt(item.startDate)}–${fmt(item.dueDate)}`;
    }
    return null;
  })();

  return (
    <div style={{ paddingLeft: indent }}>
      <div
        ref={setNodeRef}
        className={[
          'group relative flex items-start gap-2 p-2.5 bg-white border border-mileway-border rounded-lg',
          'transition-opacity duration-fast select-none mb-1',
          isDragging ? 'opacity-50' : 'opacity-100 hover:border-mileway-blue cursor-grab',
        ].join(' ')}
        {...attributes}
        {...listeners}
      >
        {/* Drag handle */}
        <div
          className="mt-0.5 flex-shrink-0 text-mileway-grey opacity-0 group-hover:opacity-100 transition-opacity duration-fast"
          aria-hidden="true"
        >
          <GripVertical size={13} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Row 1: type chip + key + expand toggle */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded ${chip.className}`}>
              {chip.label}
            </span>
            <span className="text-xs text-mileway-grey truncate flex-1">{item.jiraKey}</span>
            {hasChildren && onToggle && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggle(); }}
                aria-label={isExpanded ? 'Collapse children' : 'Expand children'}
                className="flex-shrink-0 p-0.5 rounded text-mileway-grey hover:bg-mileway-bg transition-colors duration-fast focus:outline-none focus-visible:ring-1 focus-visible:ring-mileway-blue"
              >
                {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            )}
          </div>

          {/* Row 2: Summary */}
          <p className="text-sm font-medium text-mileway-text leading-snug line-clamp-2 mb-1.5">
            {item.summary}
          </p>

          {/* Row 3: Active-in-Jira chip (SP-04) */}
          {isActive && (
            <span className="inline-block text-[10px] font-semibold text-mileway-blue bg-mileway-blue-10 px-1.5 py-0.5 rounded mb-1.5">
              Active in Jira
            </span>
          )}

          {/* Row 4: Labels (SP-02) */}
          {item.labels && item.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {item.labels.slice(0, 3).map(label => (
                <span
                  key={label}
                  className="inline-block text-[10px] font-medium text-mileway-grey bg-mileway-bg px-1.5 py-0.5 rounded border border-mileway-border truncate max-w-[80px]"
                  title={label}
                >
                  {label}
                </span>
              ))}
              {item.labels.length > 3 && (
                <span className="inline-block text-[10px] font-medium text-mileway-grey px-1 py-0.5">
                  +{item.labels.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Row 5: Assignee + sprint/date (SP-03) */}
          {(item.assigneeName || sprintLabel) && (
            <div className="flex items-center gap-2 flex-wrap">
              {item.assigneeName && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-mileway-grey bg-mileway-bg px-1.5 py-0.5 rounded border border-mileway-border">
                  <span
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-mileway-blue-10 text-mileway-blue text-[8px] font-bold flex-shrink-0"
                    aria-hidden="true"
                  >
                    {item.assigneeName.trim().split(/\s+/).map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="truncate max-w-[70px]">{item.assigneeName}</span>
                </span>
              )}
              {sprintLabel && (
                <span className="text-[10px] font-medium text-mileway-grey bg-mileway-bg px-1.5 py-0.5 rounded border border-mileway-border truncate max-w-[90px]" title={sprintLabel}>
                  {sprintLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
