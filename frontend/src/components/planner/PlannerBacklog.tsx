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
import { useToast } from '../ui/Toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const INDENT_FEATURE = 16;
const INDENT_STORY   = 28;

type StatusFilter = 'all' | 'todo' | 'in_progress';

/** Backlog triage tag; map keys use JiraWorkItem.id (same as PlannerItem.sourceId once scheduled). */
export type TriageTag = 'this-quarter' | 'next-quarter' | 'icebox';

type TriageFilter = 'all' | TriageTag;

// ── Type chip config ──────────────────────────────────────────────────────────

const TYPE_CHIP: Record<JiraItemType, { label: string; className: string }> = {
  epic:    { label: 'EPIC',  className: 'bg-mileway-blue-10 text-mileway-blue' },
  feature: { label: 'FEAT',  className: 'bg-mileway-blue-10 text-mileway-blue' },
  story:   { label: 'STORY', className: 'bg-mileway-grey-10 text-mileway-grey' },
  task:    { label: 'TASK',  className: 'bg-mileway-grey-10 text-mileway-grey' },
  bug:     { label: 'BUG',   className: 'bg-red-50 text-util-over' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

const BACKLOG_EXPANDED_W = 280;
const BACKLOG_COLLAPSED_W = 32;

export interface PlannerBacklogProps {
  jiraItems: JiraWorkItem[];
  plannerItems: PlannerItem[];
  /** When false, only the 32px left-edge pill is visible (drawer stays mounted). */
  expanded: boolean;
  /** Clicking the collapsed pill — parent sets expanded true */
  onExpand: () => void;
  /** ✕ button and Escape — parent sets expanded false (collapse to pill) */
  onCollapse: () => void;
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

function visibleForTriage(item: JiraWorkItem, triageFilter: TriageFilter, triageMap: Record<string, TriageTag | null | undefined>): boolean {
  if (triageFilter === 'all') return true;
  return (triageMap[item.id] ?? null) === triageFilter;
}

function itemFullyVisible(
  item: JiraWorkItem,
  epicAncestorKey: string | null,
  q: string,
  epicFilter: string,
  statusFilter: StatusFilter,
  triageFilter: TriageFilter,
  triageMap: Record<string, TriageTag | null | undefined>,
): boolean {
  return matchesFilters(item, q, epicFilter, statusFilter, epicAncestorKey)
    && visibleForTriage(item, triageFilter, triageMap);
}

// ── Public component ──────────────────────────────────────────────────────────

export function PlannerBacklog({ jiraItems, plannerItems, expanded, onExpand, onCollapse, onDropUnschedule: _onDropUnschedule }: PlannerBacklogProps) {
  const { showToast } = useToast();
  const [search, setSearch]           = useState('');
  const [epicFilter, setEpicFilter]   = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('all');
  /** Per-item triage; keys = JiraWorkItem.id (aligns with PlannerItem.sourceId). */
  const [triageMap, setTriageMap] = useState<Record<string, TriageTag | null>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Track whether a drag is in progress so Escape doesn't close mid-drag
  const [isDragActive, setIsDragActive] = useState(false);
  useDndMonitor({
    onDragStart:  () => setIsDragActive(true),
    onDragEnd:    () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  });

  // Escape collapses the drawer (only when expanded and no drag is active)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && expanded && !isDragActive) onCollapse();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expanded, onCollapse, isDragActive]);

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

  const unscheduledFeatureCount = useMemo(() => {
    let n = 0;
    for (const node of sections.unscheduledEpics) n += node.children.length;
    for (const node of sections.scheduledEpicHeaders) n += node.children.length;
    for (const o of sections.orphans) {
      if (o.type === 'feature') n++;
    }
    return n;
  }, [sections]);

  const pillCountLine = `${sections.unscheduledEpicCount} epic${sections.unscheduledEpicCount !== 1 ? 's' : ''} · ${unscheduledFeatureCount} feature${unscheduledFeatureCount !== 1 ? 's' : ''}`;

  const triageCounts = useMemo(() => {
    let thisQ = 0;
    let nextQ = 0;
    let ice = 0;
    for (const v of Object.values(triageMap)) {
      if (v === 'this-quarter') thisQ++;
      else if (v === 'next-quarter') nextQ++;
      else if (v === 'icebox') ice++;
    }
    return { thisQuarter: thisQ, nextQuarter: nextQ, icebox: ice };
  }, [triageMap]);

  const anyTriageTagged = triageCounts.thisQuarter + triageCounts.nextQuarter + triageCounts.icebox > 0;

  const hasActiveFilters = search !== '' || epicFilter !== 'all' || statusFilter !== 'all' || triageFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearch('');
    setEpicFilter('all');
    setStatusFilter('all');
    setTriageFilter('all');
  }, []);

  const setItemTriage = useCallback((itemId: string, tag: TriageTag) => {
    setTriageMap(prev => {
      const cur = prev[itemId] ?? null;
      const nextVal: TriageTag | null = cur === tag ? null : tag;
      return { ...prev, [itemId]: nextVal };
    });
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
        'relative flex-shrink-0 flex flex-col h-full border-r z-30 overflow-hidden',
        isOver ? 'bg-red-50 border-red-300' : 'bg-white border-mileway-border',
      ].join(' ')}
      style={{
        width: expanded ? BACKLOG_EXPANDED_W : BACKLOG_COLLAPSED_W,
        transition: 'width 150ms ease, background-color 150ms ease, border-color 150ms ease',
        boxShadow: expanded ? '4px 0 20px rgba(0,0,0,0.08)' : undefined,
      }}
    >
      {/* Collapsed pill — flush left, full height */}
      {!expanded && (
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Expand backlog, ${pillCountLine}`}
          className="absolute inset-0 flex flex-col items-center justify-start gap-1 pt-3 px-0.5 text-mileway-text hover:bg-mileway-bg transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue focus-visible:ring-inset z-20"
        >
          <ChevronRight size={16} className="text-mileway-grey flex-shrink-0" aria-hidden />
          <span
            className="text-[10px] font-semibold text-mileway-grey leading-tight tracking-wide"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {pillCountLine}
          </span>
        </button>
      )}

      {/* Drop-to-unschedule — visible in both collapsed pill and expanded drawer */}
      {isOver && (
        <div
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
        >
          {expanded ? (
            <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-100 border-2 border-dashed border-red-400 text-red-700 text-sm font-semibold shadow-sm">
              Drop to unschedule
            </div>
          ) : (
            <span
              className="text-[9px] font-bold text-red-700 tracking-wide px-0.5"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              Drop to unschedule
            </span>
          )}
        </div>
      )}

      {/* Expanded panel — clipped while width animates */}
      <div
        className={[
          'relative flex flex-col flex-1 min-h-0 min-w-0 h-full overflow-hidden',
          expanded ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        style={{ width: BACKLOG_EXPANDED_W }}
        aria-hidden={!expanded}
      >
      {/* Header */}
      <div className="px-4 py-3 border-b border-mileway-border flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
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
            onClick={onCollapse}
            aria-label="Collapse backlog"
            className="p-1 rounded text-mileway-grey hover:bg-mileway-bg hover:text-mileway-text transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        {triageCounts.thisQuarter >= 1 && (
          <button
            type="button"
            onClick={() => showToast('Bulk schedule: coming in next step', 'info')}
            className="w-full h-9 rounded-lg text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue focus-visible:ring-offset-2"
          >
            Schedule {triageCounts.thisQuarter} item{triageCounts.thisQuarter !== 1 ? 's' : ''} →
          </button>
        )}
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

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-0">
        {anyTriageTagged && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-mileway-grey px-1 pt-1 pb-2 border-b border-mileway-border/60 mb-1">
            <button
              type="button"
              onClick={() => setTriageFilter('all')}
              className={[
                'font-medium rounded px-1 py-0.5 transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                triageFilter === 'all' ? 'text-mileway-text bg-mileway-bg' : 'hover:text-mileway-text hover:bg-mileway-bg/80',
              ].join(' ')}
            >
              All
            </button>
            <span className="text-mileway-border" aria-hidden>|</span>
            <button
              type="button"
              onClick={() => setTriageFilter('this-quarter')}
              className={[
                'font-medium rounded px-1 py-0.5 transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                triageFilter === 'this-quarter' ? 'text-[#2563EB] bg-[#EFF6FF]' : 'hover:text-mileway-text',
              ].join(' ')}
            >
              {triageCounts.thisQuarter} this quarter
            </button>
            <span className="text-mileway-grey/50">·</span>
            <button
              type="button"
              onClick={() => setTriageFilter('next-quarter')}
              className={[
                'font-medium rounded px-1 py-0.5 transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                triageFilter === 'next-quarter' ? 'text-[#D97706] bg-[#FFFBEB]' : 'hover:text-mileway-text',
              ].join(' ')}
            >
              {triageCounts.nextQuarter} next quarter
            </button>
            <span className="text-mileway-grey/50">·</span>
            <button
              type="button"
              onClick={() => setTriageFilter('icebox')}
              className={[
                'font-medium rounded px-1 py-0.5 transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                triageFilter === 'icebox' ? 'text-[#6B7280] bg-[#F3F4F6]' : 'hover:text-mileway-text',
              ].join(' ')}
            >
              {triageCounts.icebox} icebox
            </button>
          </div>
        )}

        {/* Unscheduled Epics */}
        {sections.unscheduledEpics.map(node => {
          const epicKey = node.item.jiraKey;
          const epicExpanded = expandedIds.has(epicKey);
          if (!itemFullyVisible(node.item, null, q, epicFilter, statusFilter, triageFilter, triageMap)) {
            // If epic itself doesn't match, check if any child matches
            const anyChild = node.children.some(fn =>
              itemFullyVisible(fn.item, epicKey, q, epicFilter, statusFilter, triageFilter, triageMap) ||
              fn.children.some(sn => itemFullyVisible(sn.item, epicKey, q, epicFilter, statusFilter, triageFilter, triageMap))
            );
            if (!anyChild) return null;
          }
          return (
            <div key={epicKey}>
              <BacklogItem
                item={node.item}
                hasChildren={node.children.length > 0}
                isExpanded={epicExpanded}
                onToggle={() => toggleExpand(epicKey)}
                indent={0}
                triageTag={triageMap[node.item.id] ?? null}
                onTriage={setItemTriage}
              />
              {epicExpanded && node.children.map(fn => {
                const featKey = fn.item.jiraKey;
                const featExpanded = expandedIds.has(featKey);
                if (!itemFullyVisible(fn.item, epicKey, q, epicFilter, statusFilter, triageFilter, triageMap)) {
                  const anyStory = fn.children.some(sn =>
                    itemFullyVisible(sn.item, epicKey, q, epicFilter, statusFilter, triageFilter, triageMap)
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
                      triageTag={triageMap[fn.item.id] ?? null}
                      onTriage={setItemTriage}
                    />
                    {featExpanded && fn.children.map(sn => {
                      if (!itemFullyVisible(sn.item, epicKey, q, epicFilter, statusFilter, triageFilter, triageMap)) return null;
                      return (
                        <BacklogItem
                          key={sn.item.id}
                          item={sn.item}
                          indent={INDENT_STORY}
                          triageTag={triageMap[sn.item.id] ?? null}
                          onTriage={setItemTriage}
                        />
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
          const epicExpanded = expandedIds.has(epicKey);
          const visibleChildren = node.children.filter(fn =>
            itemFullyVisible(fn.item, epicKey, q, epicFilter, statusFilter, triageFilter, triageMap)
          );
          const filtersAll = !q && epicFilter === 'all' && statusFilter === 'all' && triageFilter === 'all';
          if (visibleChildren.length === 0 && !filtersAll) return null;
          return (
            <div key={epicKey}>
              <ScheduledEpicHeader
                item={node.item}
                childCount={node.children.length}
                isExpanded={epicExpanded}
                onToggle={() => toggleExpand(epicKey)}
              />
              {epicExpanded && visibleChildren.map(fn => (
                <BacklogItem
                  key={fn.item.id}
                  item={fn.item}
                  indent={INDENT_FEATURE}
                  triageTag={triageMap[fn.item.id] ?? null}
                  onTriage={setItemTriage}
                />
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
              .filter(i => itemFullyVisible(i, null, q, epicFilter, statusFilter, triageFilter, triageMap))
              .map(i => (
                <BacklogItem
                  key={i.id}
                  item={i}
                  indent={0}
                  triageTag={triageMap[i.id] ?? null}
                  onTriage={setItemTriage}
                />
              ))
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
            !itemFullyVisible(n.item, null, q, epicFilter, statusFilter, triageFilter, triageMap) &&
            !n.children.some(fn =>
              itemFullyVisible(fn.item, n.item.jiraKey, q, epicFilter, statusFilter, triageFilter, triageMap) ||
              fn.children.some(sn => itemFullyVisible(sn.item, n.item.jiraKey, q, epicFilter, statusFilter, triageFilter, triageMap))
            )
          ) && sections.orphans.every(i => !itemFullyVisible(i, null, q, epicFilter, statusFilter, triageFilter, triageMap))
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
  triageTag?: TriageTag | null;
  onTriage?: (itemId: string, tag: TriageTag) => void;
}

const TRIAGE_SEGMENTS: { tag: TriageTag; label: string; selectedClass: string; ghostClass: string }[] = [
  { tag: 'this-quarter', label: 'This quarter', selectedClass: 'bg-[#EFF6FF] text-[#2563EB]', ghostClass: 'text-mileway-grey hover:bg-mileway-bg' },
  { tag: 'next-quarter', label: 'Next quarter', selectedClass: 'bg-[#FFFBEB] text-[#D97706]', ghostClass: 'text-mileway-grey hover:bg-mileway-bg' },
  { tag: 'icebox', label: 'Icebox', selectedClass: 'bg-[#F3F4F6] text-[#6B7280]', ghostClass: 'text-mileway-grey hover:bg-mileway-bg' },
];

export function BacklogItem({ item, indent = 0, hasChildren = false, isExpanded = false, onToggle, triageTag = null, onTriage }: BacklogItemProps) {
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
          <p className="text-sm font-medium text-mileway-text leading-snug line-clamp-2 mb-1">
            {item.summary}
          </p>

          {/* Triage (redesign §5) — below title; isolate pointer so drag handle still works */}
          {onTriage && (
            <div
              className="mb-1.5 max-h-6"
              onPointerDown={e => e.stopPropagation()}
              role="group"
              aria-label="Quarter triage"
            >
              <div className="flex h-6 max-h-6 rounded-md border border-mileway-border overflow-hidden bg-white">
                {TRIAGE_SEGMENTS.map(({ tag, label, selectedClass, ghostClass }, idx) => {
                  const selected = triageTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      title={label}
                      onClick={e => { e.stopPropagation(); onTriage(item.id, tag); }}
                      className={[
                        'flex-1 min-w-0 px-0.5 text-[9px] font-semibold leading-none transition-colors duration-fast',
                        'flex items-center justify-center text-center',
                        'focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-mileway-blue focus-visible:ring-inset',
                        idx > 0 ? 'border-l border-mileway-border' : '',
                        selected ? selectedClass : ghostClass,
                      ].join(' ')}
                    >
                      <span className="block w-full truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
