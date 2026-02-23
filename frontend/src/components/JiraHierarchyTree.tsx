/**
 * US-041 — Reusable JiraHierarchyTree component
 *
 * Renders a collapsible tree of JiraWorkItems grouped by parentKey.
 * Supports two modes:
 *  - readOnly: type/key/status/SP/summary only (Projects page, Timeline)
 *  - edit:     adds selection checkbox, mapped indicator, and override dropdowns (Jira page)
 */
import { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, ExternalLink,
  CheckCircle2, AlertCircle, Edit2, X, User,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from './ui/Badge';
import { Select } from './ui/Select';
import { updateJiraWorkItemMapping } from '../stores/actions';
import type { JiraWorkItem, JiraItemType, ConfidenceLevel } from '../types';
import { computeRollup, getForecastedDays, type RollupResult } from '../utils/confidence';

// ─── shared colour maps (re-exported so other files don't duplicate them) ────

export const TYPE_COLORS: Record<JiraItemType, string> = {
  epic:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  feature: 'bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300',
  story:   'bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300',
  task:    'bg-cyan-100   text-cyan-700   dark:bg-cyan-900/30   dark:text-cyan-300',
  bug:     'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-300',
};

export const STATUS_CATEGORY_COLORS: Record<string, string> = {
  todo:        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-blue-100  text-blue-700  dark:bg-blue-900/30 dark:text-blue-300',
  done:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

// ─── tree builder ─────────────────────────────────────────────────────────────

function buildHierarchy(items: JiraWorkItem[]) {
  const byKey = new Map<string, JiraWorkItem>(items.map(i => [i.jiraKey, i]));
  const childrenOf = new Map<string, JiraWorkItem[]>();
  const roots: JiraWorkItem[] = [];

  for (const item of items) {
    if (item.parentKey && byKey.has(item.parentKey)) {
      const list = childrenOf.get(item.parentKey) ?? [];
      list.push(item);
      childrenOf.set(item.parentKey, list);
    } else {
      roots.push(item);
    }
  }
  return { roots, childrenOf };
}

const TYPE_ORDER: Record<JiraItemType, number> = { epic: 0, feature: 1, story: 2, task: 3, bug: 4 };
const sortByType = (arr: JiraWorkItem[]) =>
  [...arr].sort((a, b) => (TYPE_ORDER[a.type] ?? 5) - (TYPE_ORDER[b.type] ?? 5));

// ─── public interface ─────────────────────────────────────────────────────────

export interface JiraHierarchyTreeProps {
  items: JiraWorkItem[];
  jiraBaseUrl: string;
  /** Read-only: hides checkboxes, mapped indicators and override controls */
  readOnly?: boolean;
  /** Max nesting depth to show initially (default unlimited) */
  defaultCollapsedDepth?: number;
  /** Default confidence level from JiraSettings — used for rollup and display */
  defaultConfidenceLevel?: ConfidenceLevel;
  // Edit-mode props (Jira page)
  projectOptions?: { value: string; label: string }[];
  getPhaseOptions?: (pid: string | undefined) => { value: string; label: string }[];
  memberOptions?: { value: string; label: string }[];
  selectedItems?: Set<string>;
  onToggleSelect?: (id: string) => void;
  editingItemId?: string | null;
  onEditItem?: (id: string | null) => void;
  alwaysShowControls?: boolean;
}

// ─── main component ───────────────────────────────────────────────────────────

export function JiraHierarchyTree({
  items,
  jiraBaseUrl,
  readOnly = false,
  defaultCollapsedDepth,
  defaultConfidenceLevel = 'medium',
  projectOptions = [],
  getPhaseOptions = () => [],
  memberOptions = [],
  selectedItems = new Set(),
  onToggleSelect,
  editingItemId = null,
  onEditItem,
  alwaysShowControls = false,
}: JiraHierarchyTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    // Pre-collapse items at or beyond defaultCollapsedDepth
    if (defaultCollapsedDepth == null) return new Set();
    const { roots, childrenOf } = buildHierarchy(items);
    const toCollapse = new Set<string>();
    const walk = (item: JiraWorkItem, depth: number) => {
      if (depth >= defaultCollapsedDepth) { toCollapse.add(item.jiraKey); return; }
      (childrenOf.get(item.jiraKey) ?? []).forEach(c => walk(c, depth + 1));
    };
    roots.forEach(r => walk(r, 0));
    return toCollapse;
  });

  const { roots, childrenOf } = useMemo(() => buildHierarchy(items), [items]);

  const rollupMap = useMemo(
    () => computeRollup(items, defaultConfidenceLevel),
    [items, defaultConfidenceLevel]
  );

  const toggle = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (items.length === 0) {
    return <p className="text-xs text-slate-400 italic py-3 px-4">No Jira items</p>;
  }

  const renderNode = (item: JiraWorkItem, depth: number) => {
    const children = sortByType(childrenOf.get(item.jiraKey) ?? []);
    const isCollapsed = collapsed.has(item.jiraKey);
    const rollup = rollupMap.get(item.jiraKey);

    return (
      <div key={item.id}>
        <TreeRow
          item={item}
          depth={depth}
          children={children}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => toggle(item.jiraKey)}
          jiraBaseUrl={jiraBaseUrl}
          readOnly={readOnly}
          isSelected={selectedItems.has(item.id)}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(item.id) : undefined}
          isEditing={editingItemId === item.id}
          onEdit={onEditItem ? () => onEditItem(editingItemId === item.id ? null : item.id) : undefined}
          projectOptions={projectOptions}
          getPhaseOptions={getPhaseOptions}
          memberOptions={memberOptions}
          alwaysShowControls={alwaysShowControls}
          rollup={rollup}
          defaultConfidenceLevel={defaultConfidenceLevel}
        />
        {children.length > 0 && !isCollapsed && (
          <div>
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
      {sortByType(roots).map(r => renderNode(r, 0))}
    </div>
  );
}

// ─── tree row ────────────────────────────────────────────────────────────────

const CONFIDENCE_OPTIONS = [
  { value: '', label: 'Default confidence' },
  { value: 'high',   label: 'High (+5%)' },
  { value: 'medium', label: 'Medium (+15%)' },
  { value: 'low',    label: 'Low (+25%)' },
];

const CONFIDENCE_BADGE: Record<ConfidenceLevel, string> = {
  high:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  low:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

interface TreeRowProps {
  item: JiraWorkItem;
  depth: number;
  children: JiraWorkItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  jiraBaseUrl: string;
  readOnly: boolean;
  isSelected: boolean;
  onToggleSelect?: () => void;
  isEditing: boolean;
  onEdit?: () => void;
  projectOptions: { value: string; label: string }[];
  getPhaseOptions: (pid: string | undefined) => { value: string; label: string }[];
  memberOptions: { value: string; label: string }[];
  alwaysShowControls: boolean;
  rollup?: RollupResult;
  defaultConfidenceLevel: ConfidenceLevel;
}

function TreeRow({
  item, depth, children, isCollapsed, onToggleCollapse,
  jiraBaseUrl, readOnly, isSelected, onToggleSelect,
  isEditing, onEdit, projectOptions, getPhaseOptions, memberOptions, alwaysShowControls,
  rollup, defaultConfidenceLevel,
}: TreeRowProps) {
  const isMapped = !!item.mappedProjectId;
  const showControls = !readOnly && (alwaysShowControls || isEditing);
  const hasChildren = children.length > 0;
  const isLeaf = !hasChildren;

  const handleMapProject = (v: string) =>
    updateJiraWorkItemMapping(item.id, { mappedProjectId: v || undefined, mappedPhaseId: undefined });
  const handleMapPhase = (v: string) =>
    updateJiraWorkItemMapping(item.id, { mappedPhaseId: v || undefined });
  const handleMapMember = (v: string) =>
    updateJiraWorkItemMapping(item.id, { mappedMemberId: v || undefined });
  const handleConfidence = (v: string) =>
    updateJiraWorkItemMapping(item.id, { confidenceLevel: (v as ConfidenceLevel) || null });

  return (
    <div
      className={clsx(
        'flex items-start gap-2 py-2 text-sm transition-colors',
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
        depth > 0 && 'border-l-2 border-slate-200 dark:border-slate-700 ml-4',
      )}
      style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: '12px' }}
    >
      {/* Selection checkbox */}
      {!readOnly && onToggleSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 shrink-0"
        />
      )}

      {/* Mapped indicator */}
      {!readOnly && (
        isMapped
          ? <CheckCircle2 className="mt-0.5 w-4 h-4 text-green-500 shrink-0" />
          : <AlertCircle  className="mt-0.5 w-4 h-4 text-amber-500 shrink-0" />
      )}

      {/* Chevron (always rendered to preserve alignment; invisible when no children) */}
      <button
        onClick={onToggleCollapse}
        className={clsx('mt-0.5 shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200', !hasChildren && 'invisible')}
      >
        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Type badge */}
      <Badge className={clsx('shrink-0 text-[10px] mt-0.5', TYPE_COLORS[item.type])}>
        {item.typeName}
      </Badge>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Key · status · SP */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <a
            href={`${jiraBaseUrl}/browse/${item.jiraKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 shrink-0"
            onClick={e => e.stopPropagation()}
          >
            {item.jiraKey}
            <ExternalLink className="w-3 h-3" />
          </a>
          <Badge
            className={clsx('text-[10px]', STATUS_CATEGORY_COLORS[item.statusCategory] ?? STATUS_CATEGORY_COLORS['todo'])}
            variant="default"
          >
            {item.status}
          </Badge>

          {/* Leaf items: show raw days and forecasted days */}
          {isLeaf && item.storyPoints != null && (() => {
            const confidence = item.confidenceLevel ?? defaultConfidenceLevel;
            const raw = item.storyPoints;
            const forecasted = getForecastedDays(raw, confidence);
            return (
              <>
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  {raw}d raw
                </span>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  → {forecasted}d forecasted
                </span>
                {item.confidenceLevel && (
                  <Badge className={clsx('text-[10px]', CONFIDENCE_BADGE[item.confidenceLevel])}>
                    {item.confidenceLevel}
                  </Badge>
                )}
              </>
            );
          })()}

          {/* Parent items: show rolled-up totals */}
          {!isLeaf && rollup && rollup.itemCount > 0 && (
            <>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                {rollup.rawDays}d raw
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                → {rollup.forecastedDays}d forecasted
              </span>
              <span className="text-[10px] text-slate-400">({rollup.itemCount} items)</span>
            </>
          )}

          {hasChildren && (
            <span className="text-[10px] text-slate-400">
              {children.length} child{children.length !== 1 ? 'ren' : ''}
            </span>
          )}
        </div>

        {/* Summary */}
        <p className="text-slate-700 dark:text-slate-300 truncate mt-0.5">{item.summary}</p>

        {/* Labels + components + dates */}
        <div className="flex flex-wrap gap-1 mt-1 empty:hidden">
          {item.labels.map(l => (
            <span key={l} className="px-1.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded">
              {l}
            </span>
          ))}
          {item.components.map(c => (
            <span key={c} className="px-1.5 text-[10px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 rounded">
              {c}
            </span>
          ))}
          {(item.startDate || item.dueDate) && (
            <span className="text-[10px] text-slate-400">
              {item.startDate && new Date(item.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {item.startDate && item.dueDate && ' – '}
              {item.dueDate && new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Assignee (read-only mode or not editing) */}
        {item.assigneeName && !showControls && (
          <div className="flex items-center gap-1 mt-1">
            <User size={11} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{item.assigneeName}</span>
          </div>
        )}

        {/* Mapping controls */}
        {showControls && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Select
              value={item.mappedProjectId ?? ''}
              onChange={e => handleMapProject(e.target.value)}
              options={projectOptions}
              className="text-xs w-44"
            />
            {item.mappedProjectId && (
              <Select
                value={item.mappedPhaseId ?? ''}
                onChange={e => handleMapPhase(e.target.value)}
                options={getPhaseOptions(item.mappedProjectId)}
                className="text-xs w-40"
              />
            )}
            <Select
              value={item.mappedMemberId ?? ''}
              onChange={e => handleMapMember(e.target.value)}
              options={memberOptions}
              className="text-xs w-36"
            />
            {/* Confidence override — only meaningful on leaf items that carry days */}
            {isLeaf && item.storyPoints != null && (
              <Select
                value={item.confidenceLevel ?? ''}
                onChange={e => handleConfidence(e.target.value)}
                options={CONFIDENCE_OPTIONS}
                className="text-xs w-40"
              />
            )}
          </div>
        )}
      </div>

      {/* Edit / close button */}
      {!readOnly && !alwaysShowControls && onEdit && (
        <button
          onClick={onEdit}
          className="shrink-0 p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={isEditing ? 'Close' : 'Override mapping'}
        >
          {isEditing ? <X size={14} /> : <Edit2 size={14} />}
        </button>
      )}
    </div>
  );
}
