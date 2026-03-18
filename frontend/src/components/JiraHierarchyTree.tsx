/**
 * US-041 — Reusable JiraHierarchyTree component
 *
 * Renders a collapsible tree of JiraWorkItems grouped by parentKey.
 * Supports two modes:
 * - readOnly: type/key/status/SP/summary only (Projects page, Timeline)
 * - edit: adds selection checkbox, mapped indicator, and override dropdowns (Jira page)
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronDown, ChevronRight, ExternalLink, User,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from './ui/Badge';
import { updateJiraWorkItemConfidence } from '../stores/actions';
import type { JiraWorkItem, JiraItemType, ConfidenceLevel, Settings } from '../types';
import { computeRollup, getForecastedDays, getConfidenceLabel, type RollupResult } from '../utils/confidence';

// ─── shared colour maps (re-exported so other files don't duplicate them) ────

export const TYPE_COLORS: Record<JiraItemType, string> = {
 epic: 'bg-[#F0F2F5] text-[#1E293B] ',
 feature: 'bg-[#F0F2F5] text-[#1E293B] ',
 story: 'bg-[#F0F2F5] text-[#1E293B] ',
 task: 'bg-[#F0F2F5] text-[#1E293B] ',
 bug: 'bg-red-50 text-red-700',
};

export const STATUS_CATEGORY_COLORS: Record<string, string> = {
 todo: 'bg-[#F0F2F5] text-[#1E293B] ',
 in_progress: 'bg-blue-100 text-blue-700',
 done: 'bg-green-100 text-[#16A34A]',
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
 confidenceSettings?: Settings['confidenceLevels'];
  selectedItems?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

// ─── main component ───────────────────────────────────────────────────────────

export function JiraHierarchyTree({
 items,
 jiraBaseUrl,
 readOnly = false,
 defaultCollapsedDepth,
 defaultConfidenceLevel = 'medium',
 confidenceSettings,
  selectedItems = new Set(),
  onToggleSelect,
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
 () => computeRollup(items, defaultConfidenceLevel, confidenceSettings),
 [items, defaultConfidenceLevel, confidenceSettings]
 );

 const toggle = (key: string) =>
 setCollapsed(prev => {
 const next = new Set(prev);
 next.has(key) ? next.delete(key) : next.add(key);
 return next;
 });

 if (items.length === 0) {
 return <p className="text-xs text-[#94A3B8] italic py-3 px-4">No Jira items</p>;
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
      rollup={rollup}
 defaultConfidenceLevel={defaultConfidenceLevel}
 confidenceSettings={confidenceSettings}
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
 <div className="rounded-lg border border-[#DEDFE3] divide-y divide-[#F0F2F5] overflow-hidden">
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
  rollup?: RollupResult;
  defaultConfidenceLevel: ConfidenceLevel;
  confidenceSettings?: Settings['confidenceLevels'];
}

function TreeRow({
  item, depth, children, isCollapsed, onToggleCollapse,
  jiraBaseUrl, readOnly, isSelected, onToggleSelect,
  rollup, defaultConfidenceLevel, confidenceSettings,
}: TreeRowProps) {
  const hasChildren = children.length > 0;
  const isLeaf = !hasChildren;

  const handleConfidence = (v: string) =>
    updateJiraWorkItemConfidence(item.id, (v as ConfidenceLevel) || null);

 return (
 <div
 className={clsx(
 'flex items-start gap-2 py-2.5 text-sm transition-colors',
 isSelected ? 'bg-[#E6F2FC]' : 'hover:bg-[#F5F8FC] /30',
 depth > 0 && 'border-l-2 border-[#DEDFE3] ml-4',
 )}
 style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: '12px' }}
 >
 {/* Selection checkbox */}
 {!readOnly && onToggleSelect && (
 <input
 type="checkbox"
 checked={isSelected}
 onChange={onToggleSelect}
 className="mt-1 w-4 h-4 rounded border-[#94A3B8] shrink-0"
 />
 )}

    {/* Chevron (always rendered to preserve alignment; invisible when no children) */}
 <button
 onClick={onToggleCollapse}
 className={clsx('mt-0.5 shrink-0 text-[#94A3B8] hover:text-[#94A3B8]', !hasChildren && 'invisible')}
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
 className="font-mono text-xs text-[#0089DD] hover:underline flex items-center gap-0.5 shrink-0"
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
 {isLeaf && item.storyPoints != null && (
 <DaysCell
 item={item}
 defaultConfidenceLevel={defaultConfidenceLevel}
 onConfidence={handleConfidence}
 confidenceSettings={confidenceSettings}
 />
 )}

 {/* Parent items: rolled-up totals */}
 {!isLeaf && rollup && rollup.itemCount > 0 && (
 <span className="text-xs font-semibold text-[#0089DD]">
 {rollup.forecastedDays}d
 <span className="font-normal text-[#94A3B8] ml-1">· {rollup.itemCount} items</span>
 </span>
 )}
 </div>

 {/* Line 2: Summary */}
 <p className="text-sm text-[#1E293B] truncate mt-0.5">{item.summary}</p>

    {/* Assignee */}
    {item.assigneeName && (
 <div className="flex items-center gap-1 mt-1">
 <User size={11} className="text-[#94A3B8] shrink-0" />
 <span className="text-xs text-[#94A3B8] font-medium">{item.assigneeName}</span>
 </div>
 )}

      </div>
 </div>
 );
}

// ─── Compact days + confidence cell ──────────────────────────────────────────

const CONF_COLORS: Record<string, string> = {
 high: 'bg-green-100 text-[#16A34A]',
 medium: 'bg-blue-100 text-blue-700',
 low: 'bg-amber-100 text-amber-700',
};

export function DaysCell({ item, defaultConfidenceLevel, onConfidence, confidenceSettings }: {
 item: JiraWorkItem;
 defaultConfidenceLevel: ConfidenceLevel;
 onConfidence: (v: string) => void;
 confidenceSettings?: Settings['confidenceLevels'];
}) {
 const [open, setOpen] = useState(false);
 const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
 const btnRef = useRef<HTMLButtonElement>(null);
 const confidence = item.confidenceLevel ?? defaultConfidenceLevel;
 const raw = item.storyPoints!;
 const forecasted = getForecastedDays(raw, confidence, confidenceSettings);

 // Position dropdown using fixed coords so it's never clipped by overflow:hidden ancestors.
 useEffect(() => {
 if (!open || !btnRef.current) return;
 const rect = btnRef.current.getBoundingClientRect();
 setDropdownStyle({
 position: 'fixed',
 top: rect.bottom + 4,
 left: rect.left,
 zIndex: 9999,
 });
 }, [open]);

 // Close on outside click
 useEffect(() => {
 if (!open) return;
 const handle = () => setOpen(false);
 document.addEventListener('mousedown', handle);
 return () => document.removeEventListener('mousedown', handle);
 }, [open]);

 return (
 <span className="inline-flex items-center gap-1.5">
 <span className="text-xs text-[#94A3B8] ">{raw}d</span>
 <span className="text-xs text-[#94A3B8]">→</span>
 <span className="text-xs font-semibold text-[#0089DD]">{forecasted}d</span>
 <button
 ref={btnRef}
 onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
 className={clsx(
 'text-xs font-medium rounded-full px-1.5 py-0.5 leading-tight cursor-pointer border',
 CONF_COLORS[confidence],
 )}
 title={`Confidence: ${confidence}`}
 >
 {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
 </button>
 {open && (
 <span
 style={dropdownStyle}
 className="bg-white border border-[#DEDFE3] rounded-lg shadow-xl py-1 min-w-[160px]"
 onMouseDown={e => e.stopPropagation()}
 >
 {(['', 'high', 'medium', 'low'] as const).map(v => (
 <button
 key={v}
 onClick={e => { e.stopPropagation(); onConfidence(v); setOpen(false); }}
 className={clsx(
 'w-full text-left px-3 py-1.5 text-xs hover:bg-[#F5F8FC] transition-colors',
 (v === '' ? !item.confidenceLevel : item.confidenceLevel === v) && 'font-semibold text-[#0089DD]',
 )}
 >
 {v === '' ? `Default (${defaultConfidenceLevel})` : getConfidenceLabel(v, confidenceSettings)}
 </button>
 ))}
 </span>
 )}
 </span>
 );
}
