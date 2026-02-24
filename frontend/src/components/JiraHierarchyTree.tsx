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
  epic:    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  feature: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  story:   'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  task:    'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  bug:     'bg-red-50    text-red-700    dark:bg-red-900/30    dark:text-red-300',
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
        'flex items-start gap-2 py-2.5 text-sm transition-colors',
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
      <Badge className={clsx('shrink-0 text-xs mt-0.5', TYPE_COLORS[item.type])}>
        {item.typeName}
      </Badge>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Key + status + days */}
        <div className="flex items-center gap-2 flex-wrap">
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
            className={clsx('text-xs', STATUS_CATEGORY_COLORS[item.statusCategory] ?? STATUS_CATEGORY_COLORS['todo'])}
            variant="default"
          >
            {item.status}
          </Badge>

          {/* Leaf items: compact days display */}
          {isLeaf && item.storyPoints != null && <DaysCell item={item} defaultConfidenceLevel={defaultConfidenceLevel} onConfidence={handleConfidence} />}

          {/* Parent items: rolled-up totals */}
          {!isLeaf && rollup && rollup.itemCount > 0 && (
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {rollup.forecastedDays}d
              <span className="font-normal text-slate-400 ml-1">· {rollup.itemCount} items</span>
            </span>
          )}
        </div>

        {/* Line 2: Summary */}
        <p className="text-sm text-slate-700 dark:text-slate-300 truncate mt-0.5">{item.summary}</p>

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

// ─── Compact days + confidence cell ──────────────────────────────────────────

const CONF_LABELS: Record<string, string> = { high: 'High', medium: 'Med', low: 'Low' };
const CONF_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function DaysCell({ item, defaultConfidenceLevel, onConfidence }: {
  item: JiraWorkItem;
  defaultConfidenceLevel: ConfidenceLevel;
  onConfidence: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const confidence = item.confidenceLevel ?? defaultConfidenceLevel;
  const raw = item.storyPoints!;
  const forecasted = getForecastedDays(raw, confidence);

  return (
    <span className="inline-flex items-center gap-1.5 relative">
      <span className="text-xs text-slate-500 dark:text-slate-400">{raw}d</span>
      <span className="text-xs text-slate-400 dark:text-slate-500">→</span>
      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{forecasted}d</span>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className={clsx(
          'text-xs font-medium rounded-full px-1.5 py-0.5 leading-tight cursor-pointer border',
          CONF_COLORS[confidence],
        )}
        title={`Confidence: ${confidence}`}
      >
        {CONF_LABELS[confidence]}
      </button>
      {open && (
        <span className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[140px]">
          {(['', 'high', 'medium', 'low'] as const).map(v => (
            <button
              key={v}
              onClick={e => { e.stopPropagation(); onConfidence(v); setOpen(false); }}
              className={clsx(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
                (v === '' ? !item.confidenceLevel : item.confidenceLevel === v) && 'font-semibold text-blue-600 dark:text-blue-400',
              )}
            >
              {v === '' ? `Default (${defaultConfidenceLevel})` : `${v.charAt(0).toUpperCase() + v.slice(1)} (+${v === 'high' ? 5 : v === 'medium' ? 15 : 25}%)`}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
