/**
 * PlannerTimeline — Sprint-level Gantt for the Scenario Planner.
 *
 * Bars are position:absolute, left/width as percentages of a 6-sprint canvas.
 * Sprint numbers (not dates) drive positioning — simpler than JiraGantt.
 *
 * NOTE: DndContext lives here temporarily. It will be lifted to ScenarioPlanner
 * during page assembly so PlannerBacklog's useDroppable({ id: 'backlog' }) joins
 * the same context and the unschedule drop zone works natively.
 *
 * Rules (same as JiraGantt):
 *   - No overflow:hidden on any gantt row
 *   - Bars are percentage-positioned, never grid-based
 */
import { useState, useMemo, useRef, useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  DragOverlay,
  useDraggable,
  useDroppable,
  useDndMonitor,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronRight, ChevronDown, Lock } from 'lucide-react';
import type { PlannerItem, PlannerItemType, JiraWorkItem, Sprint } from '../../types';
import { generateId } from '../../stores/actions';

// ── Constants ─────────────────────────────────────────────────────────────────

const LABEL_W_DEFAULT = 220;
const LABEL_W_MIN = 160;
const LABEL_W_MAX = 500;
const ROW_H = 44;
const BAR_PAD_Y = 7;
const SPRINT_COUNT = 6;
const NEW_ITEM_SPAN = 2;

const BAR: Record<string, { bg: string; border: string; borderW: number; radius: number }> = {
  epic:      { bg: 'rgba(0,137,221,0.10)', border: '#0089DD', borderW: 2, radius: 6 },
  feature:   { bg: '#CCE4F9',              border: '#0089DD', borderW: 1, radius: 5 },
  story:     { bg: '#F0F2F5',              border: '#DEDFE3', borderW: 1, radius: 4 },
  task:      { bg: '#F0F2F5',              border: '#DEDFE3', borderW: 1, radius: 4 },
  bug:       { bg: '#FEE2E2',              border: '#DC2626', borderW: 1, radius: 4 },
  uat:       { bg: '#E6F2FC',              border: '#94A3B8', borderW: 1, radius: 4 },
  hypercare: { bg: '#CCE4F9',              border: '#0089DD', borderW: 1, radius: 4 },
  custom:    { bg: '#F0F2F5',              border: '#DEDFE3', borderW: 1, radius: 4 },
};

const INDENT: Partial<Record<PlannerItemType, number>> = {
  epic: 0, feature: 16, story: 32, task: 32, bug: 32, uat: 32, hypercare: 32,
};

// ── Internal types ────────────────────────────────────────────────────────────

interface ResizeState {
  itemId: string;
  edge: 'left' | 'right';
  startX: number;
  origStart: number;
  origSpan: number;
  previewStart: number;
  previewSpan: number;
}

interface EpicMoveState {
  itemId: string;
  newStartSprint: number;
}

interface BarFracs { left: number; width: number; visible: boolean }

// ── Public types ──────────────────────────────────────────────────────────────

export interface DragPreview {
  itemId: string;
  newStartSprint: number;
}

export interface PlannerTimelineProps {
  plannerItems: PlannerItem[];
  jiraItems: JiraWorkItem[];
  /** Sprints for the current year — used to derive the 6 visible columns. */
  sprints: Sprint[];
  /** e.g. "Q2 2026" */
  selectedQuarter: string;
  scenarioId: string;
  /** Fires during any drag/resize so PlannerCapacity can show a live preview. */
  onActiveDragChange?: (preview: DragPreview | null) => void;
  /** All mutations flow through here — parent calls updatePlannerLayout(). */
  onItemsChange: (items: PlannerItem[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function barFracs(startSprint: number, spanSprints: number, firstSprintNum: number): BarFracs {
  const lo = startSprint - firstSprintNum;
  const hi = lo + spanSprints;
  if (lo >= SPRINT_COUNT || hi <= 0) return { left: 0, width: 0, visible: false };
  const cl = Math.max(0, lo) / SPRINT_COUNT;
  const cr = Math.min(SPRINT_COUNT, hi) / SPRINT_COUNT;
  return { left: cl, width: cr - cl, visible: true };
}

function sprintNumFrom(colId: string): number {
  return parseInt(colId.replace('sprint-col-', ''), 10);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSprintRange(startDate: string, endDate: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  return `${fmt(startDate)}–${fmt(endDate)}`;
}

// ── SprintHeaders ─────────────────────────────────────────────────────────────

function SprintHeaders({
  sprints,
  dragOverNum,
}: {
  sprints: Sprint[];
  dragOverNum: number | null;
}) {
  return (
    <div className="flex border-b border-mileway-border bg-white">
      {sprints.map(s => (
        <div
          key={s.id}
          style={{ width: `${100 / SPRINT_COUNT}%` }}
          className={[
            'flex-shrink-0 px-3 py-2 text-xs font-semibold text-mileway-grey',
            'border-r border-mileway-border last:border-r-0 transition-colors duration-fast',
            dragOverNum === s.number ? 'bg-mileway-blue-10 text-mileway-blue' : '',
          ].join(' ')}
        >
          <span className="block">{s.name}</span>
          {s.startDate && s.endDate && (
            <span className="block text-[10px] font-normal text-mileway-grey mt-0.5 truncate">
              {formatSprintRange(s.startDate, s.endDate)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── SprintColumnZone ──────────────────────────────────────────────────────────

function SprintColumnZone({
  sprint,
  index,
  totalHeight,
  dragOverNum,
}: {
  sprint: Sprint;
  index: number;
  totalHeight: number;
  dragOverNum: number | null;
}) {
  const { setNodeRef } = useDroppable({
    id: `sprint-col-${sprint.number}`,
    data: { type: 'sprint-column', sprintNumber: sprint.number },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        top: 0,
        left: `${(index / SPRINT_COUNT) * 100}%`,
        width: `${(1 / SPRINT_COUNT) * 100}%`,
        height: totalHeight,
        zIndex: 0,
      }}
      className={[
        'border-r border-mileway-divider last:border-r-0 transition-colors duration-fast',
        dragOverNum === sprint.number ? 'bg-mileway-blue-10' : '',
      ].join(' ')}
    />
  );
}

// ── LabelCell ─────────────────────────────────────────────────────────────────

function LabelCell({
  item,
  hasChildren,
  isExpanded,
  onToggle,
}: {
  item: PlannerItem;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}) {
  const indent = (INDENT[item.type] ?? 0) + 12;

  return (
    <div
      className="flex items-center gap-1.5 h-full border-b border-mileway-divider hover:bg-mileway-bg transition-colors duration-fast"
      style={{ paddingLeft: indent, paddingRight: 8 }}
    >
      {/* Expand / collapse chevron */}
      <button
        type="button"
        onClick={() => hasChildren && onToggle(item.id)}
        tabIndex={hasChildren ? 0 : -1}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
        className={[
          'flex-shrink-0 w-4 h-4 flex items-center justify-center rounded text-mileway-grey',
          'transition-colors duration-fast focus:outline-none focus-visible:ring-1 focus-visible:ring-mileway-blue',
          hasChildren ? 'hover:bg-mileway-border cursor-pointer' : 'invisible',
        ].join(' ')}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {/* Name */}
      <span
        className="flex-1 min-w-0 text-sm text-mileway-text truncate"
        style={{ fontWeight: item.type === 'epic' ? 600 : 400 }}
      >
        {item.name}
      </span>

      {/* Locked badge */}
      {item.locked && !item.unlockedInScenario && (
        <Lock size={11} className="flex-shrink-0 text-mileway-grey" aria-label="Locked" />
      )}

      {/* Unlocked-in-scenario badge */}
      {item.unlockedInScenario && (
        <span className="flex-shrink-0 text-[9px] font-bold tracking-wider text-mileway-blue bg-mileway-blue-10 px-1 py-0.5 rounded">
          UNLOCKED
        </span>
      )}
    </div>
  );
}

// ── PlannerBar ────────────────────────────────────────────────────────────────

interface PlannerBarProps {
  item: PlannerItem;
  rowTop: number;
  firstSprintNum: number;
  resizePreview: { start: number; span: number } | null;
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>, itemId: string, edge: 'left' | 'right') => void;
  onResizeMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeEnd: () => void;
}

function PlannerBar({
  item,
  rowTop,
  firstSprintNum,
  resizePreview,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: PlannerBarProps) {
  const isInteractive = !item.locked || item.unlockedInScenario;

  const displayStart = resizePreview?.start ?? item.startSprint;
  const displaySpan  = resizePreview?.span  ?? item.spanSprints;
  const frac = barFracs(displayStart, displaySpan, firstSprintNum);
  if (!frac.visible) return null;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !isInteractive,
    data: { type: 'timeline-bar', plannerItem: item },
  });

  const s = BAR[item.type] ?? BAR.custom;
  const borderStyle = item.unlockedInScenario ? 'dashed' : 'solid';

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        top: rowTop + BAR_PAD_Y,
        height: ROW_H - BAR_PAD_Y * 2,
        left: `${frac.left * 100}%`,
        width: `${frac.width * 100}%`,
        minWidth: 6,
        background: s.bg,
        border: `${s.borderW}px ${borderStyle} ${s.border}`,
        borderRadius: s.radius,
        boxSizing: 'border-box',
        zIndex: 10,
        opacity: isDragging ? 0.35 : (item.locked && !item.unlockedInScenario ? 0.6 : 1),
        cursor: isInteractive ? 'grab' : 'not-allowed',
      }}
      {...(isInteractive ? { ...attributes, ...listeners } : {})}
    >
      {/* Left resize handle */}
      {isInteractive && (
        <div
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 1 }}
          onPointerDown={e => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onResizeStart(e, item.id, 'left');
          }}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          aria-hidden="true"
        >
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-white opacity-50" />
        </div>
      )}

      {/* Right resize handle */}
      {isInteractive && (
        <div
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 1 }}
          onPointerDown={e => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onResizeStart(e, item.id, 'right');
          }}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          aria-hidden="true"
        >
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-white opacity-50" />
        </div>
      )}
    </div>
  );
}

// ── BacklogItemOverlay ────────────────────────────────────────────────────────

function BacklogItemOverlay({ item }: { item: JiraWorkItem }) {
  return (
    <div
      style={{
        width: 220,
        background: '#fff',
        border: '1px solid #0089DD',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
        padding: '8px 10px',
        opacity: 0.95,
        cursor: 'grabbing',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: 4,
            background: '#E0F0FB',
            color: '#0089DD',
            textTransform: 'uppercase',
          }}
        >
          {item.type}
        </span>
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{item.jiraKey}</span>
      </div>
      <p style={{ fontSize: 12, fontWeight: 500, color: '#1E293B', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {item.summary}
      </p>
    </div>
  );
}

// ── BarDragOverlay ────────────────────────────────────────────────────────────

function BarDragOverlay({ item }: { item: PlannerItem }) {
  const s = BAR[item.type] ?? BAR.custom;
  return (
    <div
      style={{
        height: ROW_H - BAR_PAD_Y * 2,
        width: 200,
        background: s.bg,
        border: `${s.borderW}px solid ${s.border}`,
        borderRadius: s.radius,
        opacity: 0.9,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 10,
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.name}
      </span>
    </div>
  );
}

// ── EpicMovePrompt ────────────────────────────────────────────────────────────

function EpicMovePrompt({
  onConfirm,
  onDismiss,
}: {
  onConfirm: (moveChildren: boolean) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="bg-white border border-mileway-border rounded-lg p-5 shadow-md pointer-events-auto w-72 animate-fade-in">
        <p className="text-sm font-semibold text-mileway-text mb-1">Move child items too?</p>
        <p className="text-xs text-mileway-grey leading-relaxed mb-4">
          This epic has features or stories. Should they shift by the same amount?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDismiss}
            className="text-sm font-medium text-mileway-grey px-3 py-1.5 rounded-lg hover:bg-mileway-bg transition-colors duration-fast"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(false)}
            className="text-sm font-medium text-mileway-text border border-mileway-border px-3 py-1.5 rounded-lg hover:bg-mileway-bg transition-colors duration-fast"
          >
            Epic only
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="text-sm font-medium text-white bg-mileway-blue px-3 py-1.5 rounded-lg hover:bg-[#0077C2] transition-colors duration-fast"
          >
            Move all
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PlannerTimeline ───────────────────────────────────────────────────────────

export function PlannerTimeline({
  plannerItems,
  jiraItems: _jiraItems,
  sprints,
  selectedQuarter,
  onActiveDragChange,
  onItemsChange,
}: PlannerTimelineProps) {
  const [expandedIds, setExpandedIds]         = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll]             = useState(false);
  const [labelWidth, setLabelWidth]           = useState(LABEL_W_DEFAULT);
  const [dragOverNum, setDragOverNum]         = useState<number | null>(null);
  const [activeItem, setActiveItem]           = useState<PlannerItem | null>(null);
  const [activeBacklogItem, setActiveBacklogItem] = useState<JiraWorkItem | null>(null);
  const [resize, setResize]                   = useState<ResizeState | null>(null);
  const [epicMove, setEpicMove]               = useState<EpicMoveState | null>(null);

  const canvasRef    = useRef<HTMLDivElement>(null);
  const labelDragRef = useRef<{ startX: number; startW: number } | null>(null);

  // ── Quarter sprints ─────────────────────────────────────────────────────────
  const quarterSprints = useMemo(
    () => sprints.filter(s => s.quarter === selectedQuarter).slice(0, SPRINT_COUNT),
    [sprints, selectedQuarter],
  );
  const firstSprintNum = quarterSprints[0]?.number ?? 1;

  // ── Flat visible row list ───────────────────────────────────────────────────
  const visibleItems = useMemo(() => {
    const result: PlannerItem[] = [];
    const seen = new Set<string>();
    const add = (item: PlannerItem) => { if (!seen.has(item.id)) { seen.add(item.id); result.push(item); } };
    const expanded = (id: string) => expandAll || expandedIds.has(id);

    const epics = plannerItems.filter(p => p.type === 'epic');
    for (const epic of epics) {
      add(epic);
      if (expanded(epic.id)) {
        const features = plannerItems.filter(p => p.parentKey === epic.jiraKey && p.type === 'feature');
        for (const feat of features) {
          add(feat);
          if (expanded(feat.id)) {
            plannerItems.filter(p => p.parentKey === feat.jiraKey).forEach(add);
          }
        }
        // Non-feature direct children of the epic
        plannerItems.filter(p => p.parentKey === epic.jiraKey && p.type !== 'feature').forEach(add);
      }
    }
    // Items not under any epic
    plannerItems.filter(p => !seen.has(p.id)).forEach(add);
    return result;
  }, [plannerItems, expandedIds, expandAll]);

  // ── Children lookup ─────────────────────────────────────────────────────────
  const hasChildrenSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of plannerItems) {
      if (item.parentKey) {
        const parent = plannerItems.find(p => p.jiraKey === item.parentKey);
        if (parent) s.add(parent.id);
      }
    }
    return s;
  }, [plannerItems]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const commitMove = useCallback((itemId: string, newStart: number, moveChildren: boolean) => {
    const item = plannerItems.find(p => p.id === itemId);
    if (!item) return;
    const delta = newStart - item.startSprint;
    onItemsChange(plannerItems.map(p => {
      if (p.id === itemId) return { ...p, startSprint: newStart };
      if (moveChildren && p.parentKey === item.jiraKey) return { ...p, startSprint: Math.max(1, p.startSprint + delta) };
      return p;
    }));
    setEpicMove(null);
  }, [plannerItems, onItemsChange]);

  // ── Label column resize ─────────────────────────────────────────────────────
  function onLabelHandleDown(e: ReactPointerEvent<HTMLDivElement>) {
    labelDragRef.current = { startX: e.clientX, startW: labelWidth };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onLabelHandleMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!labelDragRef.current) return;
    setLabelWidth(Math.max(LABEL_W_MIN, Math.min(LABEL_W_MAX, labelDragRef.current.startW + e.clientX - labelDragRef.current.startX)));
  }
  function onLabelHandleUp() { labelDragRef.current = null; }

  // ── Bar resize ──────────────────────────────────────────────────────────────
  const handleResizeStart = useCallback((
    e: ReactPointerEvent<HTMLDivElement>,
    itemId: string,
    edge: 'left' | 'right',
  ) => {
    const item = plannerItems.find(p => p.id === itemId);
    if (!item) return;
    setResize({
      itemId, edge,
      startX: e.clientX,
      origStart: item.startSprint, origSpan: item.spanSprints,
      previewStart: item.startSprint, previewSpan: item.spanSprints,
    });
  }, [plannerItems]);

  const handleResizeMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resize || !canvasRef.current) return;
    const sprintW = canvasRef.current.getBoundingClientRect().width / SPRINT_COUNT;
    const delta = Math.round((e.clientX - resize.startX) / sprintW);
    const newStart = resize.edge === 'left' ? Math.max(1, resize.origStart + delta) : resize.origStart;
    const newSpan  = resize.edge === 'right'
      ? Math.max(1, resize.origSpan + delta)
      : Math.max(1, resize.origSpan - delta);
    setResize(prev => prev ? { ...prev, previewStart: newStart, previewSpan: newSpan } : null);
    onActiveDragChange?.({ itemId: resize.itemId, newStartSprint: newStart });
  }, [resize, onActiveDragChange]);

  const handleResizeEnd = useCallback(() => {
    if (!resize) return;
    onItemsChange(plannerItems.map(p =>
      p.id === resize.itemId
        ? { ...p, startSprint: resize.previewStart, spanSprints: resize.previewSpan }
        : p,
    ));
    setResize(null);
    onActiveDragChange?.(null);
  }, [resize, plannerItems, onItemsChange, onActiveDragChange]);

  // ── dnd-kit event handlers (subscribed via useDndMonitor — context lives in ScenarioPlanner) ──
  const plannerItemsRef = useRef(plannerItems);
  plannerItemsRef.current = plannerItems;

  useDndMonitor({
    onDragStart(event: DragStartEvent) {
      const data = event.active.data.current as { type: string; plannerItem?: PlannerItem; jiraItem?: JiraWorkItem } | undefined;
      if (data?.type === 'timeline-bar' && data.plannerItem) {
        setActiveItem(data.plannerItem);
        onActiveDragChange?.({ itemId: data.plannerItem.id, newStartSprint: data.plannerItem.startSprint });
      }
      if (data?.type === 'backlog-item' && data.jiraItem) {
        setActiveBacklogItem(data.jiraItem);
      }
    },
    onDragMove(event: DragMoveEvent) {
      const overId = event.over?.id?.toString() ?? '';
      if (overId.startsWith('sprint-col-')) {
        const num = sprintNumFrom(overId);
        setDragOverNum(num);
        const data = event.active.data.current as { type: string; plannerItem?: PlannerItem } | undefined;
        if (data?.type === 'timeline-bar' && data.plannerItem) {
          onActiveDragChange?.({ itemId: data.plannerItem.id, newStartSprint: num });
        }
      } else {
        setDragOverNum(null);
      }
    },
    onDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      setActiveItem(null);
      setActiveBacklogItem(null);
      setDragOverNum(null);
      onActiveDragChange?.(null);
      if (!over) return;

      const aData = active.data.current as { type: string; plannerItem?: PlannerItem; jiraItem?: JiraWorkItem } | undefined;
      if (!aData) return;
      const overId = over.id.toString();
      const items = plannerItemsRef.current;

      // Case 1: bar → sprint column (reposition)
      if (aData.type === 'timeline-bar' && overId.startsWith('sprint-col-')) {
        const item = aData.plannerItem!;
        const target = sprintNumFrom(overId);
        if (target === item.startSprint) return;
        if (item.type === 'epic' && items.some(p => p.parentKey === item.jiraKey)) {
          setEpicMove({ itemId: item.id, newStartSprint: target });
          return;
        }
        commitMove(item.id, target, false);
        return;
      }

      // Case 2: bar → backlog (unschedule)
      if (aData.type === 'timeline-bar' && overId === 'backlog') {
        onItemsChange(items.filter(p => p.id !== active.id));
        return;
      }

      // Case 3: backlog item → sprint column (schedule)
      if (aData.type === 'backlog-item' && overId.startsWith('sprint-col-')) {
        const ji = aData.jiraItem!;
        const target = sprintNumFrom(overId);
        const newItem: PlannerItem = {
          id: generateId('planner'),
          sourceId: ji.id,
          name: ji.summary,
          type: ji.type as PlannerItemType,
          jiraKey: ji.jiraKey,
          parentKey: ji.parentKey,
          startSprint: target,
          spanSprints: NEW_ITEM_SPAN,
          assignees: [],
          locked: ji.statusCategory === 'in_progress',
          unlockedInScenario: false,
        };
        onItemsChange([...items, newItem]);
      }
    },
  });

  // ── Toggle expand ───────────────────────────────────────────────────────────
  const toggleExpand = useCallback((id: string) => {
    // Reset the global expandAll flag so individual row toggles take full control
    setExpandAll(false);
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  const contentH = visibleItems.length * ROW_H;
  // Drop zones must always be hittable — enforce a minimum height so dragging
  // onto an empty timeline still registers. 240px covers ~5 rows of visual space.
  const totalH = Math.max(contentH, 240);

  if (quarterSprints.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-mileway-grey text-sm">
        No sprint data available for {selectedQuarter}.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-mileway-border bg-white flex-shrink-0">
          <button
            onClick={() => { setExpandAll(true); setExpandedIds(new Set()); }}
            className="text-xs font-medium text-mileway-grey hover:text-mileway-text px-2.5 py-1 rounded hover:bg-mileway-bg transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
          >
            Expand all
          </button>
          <button
            onClick={() => { setExpandAll(false); setExpandedIds(new Set()); }}
            className="text-xs font-medium text-mileway-grey hover:text-mileway-text px-2.5 py-1 rounded hover:bg-mileway-bg transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
          >
            Collapse all
          </button>
        </div>

        {/* Main body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Label column */}
          <div
            className="flex-shrink-0 flex flex-col bg-white border-r border-mileway-border overflow-y-auto"
            style={{ width: labelWidth }}
          >
            {/* Spacer aligns with sprint header row */}
            <div className="flex-shrink-0 border-b border-mileway-border bg-mileway-bg" style={{ height: 33 }} />
            {visibleItems.map(item => (
              <div key={item.id} style={{ height: ROW_H, flexShrink: 0 }}>
                <LabelCell
                  item={item}
                  hasChildren={hasChildrenSet.has(item.id)}
                  isExpanded={expandAll || expandedIds.has(item.id)}
                  onToggle={toggleExpand}
                />
              </div>
            ))}
          </div>

          {/* Label resize handle */}
          <div
            className="w-1 flex-shrink-0 bg-mileway-divider hover:bg-mileway-blue cursor-col-resize transition-colors duration-fast"
            onPointerDown={onLabelHandleDown}
            onPointerMove={onLabelHandleMove}
            onPointerUp={onLabelHandleUp}
          />

          {/* Gantt canvas */}
          <div className="flex-1 overflow-auto">
            {/* Sprint headers */}
            <div className="sticky top-0 z-20">
              <SprintHeaders sprints={quarterSprints} dragOverNum={dragOverNum} />
            </div>

            {/* Canvas body — never overflow:hidden */}
            <div
              ref={canvasRef}
              className="relative"
              style={{ height: totalH }}
            >
              {/* Full-height sprint column drop zones (z:0) */}
              {quarterSprints.map((s, i) => (
                <SprintColumnZone
                  key={s.id}
                  sprint={s}
                  index={i}
                  totalHeight={totalH}
                  dragOverNum={dragOverNum}
                />
              ))}

              {/* Empty-state hint — shown when no items are on the timeline yet */}
              {visibleItems.length === 0 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    pointerEvents: 'none',
                  }}
                >
                  <p className="text-xs text-mileway-grey italic">
                    Drag items from the backlog to schedule them
                  </p>
                </div>
              )}

              {/* Row dividers (z:5, pointer-events:none so bars stay interactive) */}
              {visibleItems.map((item, idx) => (
                <div
                  key={item.id + '-divider'}
                  style={{ position: 'absolute', top: idx * ROW_H, height: ROW_H, left: 0, right: 0, zIndex: 5, pointerEvents: 'none' }}
                  className="border-b border-mileway-divider"
                />
              ))}

              {/* Bars (z:10) */}
              {visibleItems.map((item, idx) => (
                <PlannerBar
                  key={item.id}
                  item={item}
                  rowTop={idx * ROW_H}
                  firstSprintNum={firstSprintNum}
                  resizePreview={resize?.itemId === item.id ? { start: resize.previewStart, span: resize.previewSpan } : null}
                  onResizeStart={handleResizeStart}
                  onResizeMove={handleResizeMove}
                  onResizeEnd={handleResizeEnd}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ghost element following cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {activeItem && <BarDragOverlay item={activeItem} />}
        {activeBacklogItem && <BacklogItemOverlay item={activeBacklogItem} />}
      </DragOverlay>

      {/* Epic move confirmation */}
      {epicMove && (
        <EpicMovePrompt
          onConfirm={moveChildren => commitMove(epicMove.itemId, epicMove.newStartSprint, moveChildren)}
          onDismiss={() => setEpicMove(null)}
        />
      )}
    </>
  );
}
