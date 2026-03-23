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
import { useState, useMemo, useRef, useCallback, useEffect, type CSSProperties } from 'react';
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
import { ChevronRight, ChevronDown, Lock, Plus, Pencil } from 'lucide-react';
import { useToast } from '../ui/Toast';
import type {
  PlannerItem,
  PlannerItemType,
  PlannerAssignment,
  JiraWorkItem,
  Sprint,
  TeamMember,
  BusinessContact,
} from '../../types';
import { generateId } from '../../stores/actions';
import { useCurrentState } from '../../stores/appStore';
import { usePlannerCapacityTicker } from './PlannerCapacityTicker';

// ── Constants ─────────────────────────────────────────────────────────────────

const LABEL_W_DEFAULT = 260;
const LABEL_W_MIN = 160;
const LABEL_W_MAX = 500;
const SPRINT_HEADER_H = 64;
const ROW_H = 44;
const BAR_PAD_Y = 7;
const MIN_SPRINT_W = 100;

const BAR: Record<string, { bg: string; border: string; borderW: number; radius: number }> = {
  epic:      { bg: 'rgba(168,196,245,0.18)', border: '#6090E0', borderW: 2, radius: 6 },
  feature:   { bg: '#A8C4F5',               border: '#6090E0', borderW: 1, radius: 5 },
  story:     { bg: '#D0CCC8',               border: '#A09D97', borderW: 1, radius: 4 },
  task:      { bg: '#D0CCC8',               border: '#A09D97', borderW: 1, radius: 4 },
  bug:       { bg: '#FEE2E2',               border: '#DC2626', borderW: 1, radius: 4 },
  uat:       { bg: '#CDB0F5',               border: '#9B6EE2', borderW: 1, radius: 4 },
  hypercare: { bg: '#90D9B8',               border: '#1A7A52', borderW: 1, radius: 4 },
  custom:    { bg: '#D0CCC8',               border: '#A09D97', borderW: 1, radius: 4 },
};

const INDENT: Partial<Record<PlannerItemType, number>> = {
  epic: 0, feature: 16, story: 32, task: 32, bug: 32, uat: 32, hypercare: 32,
};

/** Stable saturated backgrounds for bar avatars (no per-member colour on types yet). */
const PLANNER_BAR_AVATAR_BGS = [
  '#0089DD', '#7C3AED', '#16A34A', '#D97706', '#DC2626',
  '#0891B2', '#DB2777', '#4F46E5', '#CA8A04', '#0D9488',
  '#2563EB', '#EA580C', '#9333EA',
] as const;

function plannerBarAvatarBackground(memberId: string): string {
  let h = 0;
  for (let i = 0; i < memberId.length; i++) {
    h = Math.imul(31, h) + memberId.charCodeAt(i) | 0;
  }
  return PLANNER_BAR_AVATAR_BGS[Math.abs(h) % PLANNER_BAR_AVATAR_BGS.length];
}

function plannerBarInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface PlannerBarAvatarSlot {
  key: string;
  name: string;
  initials: string;
  background: string;
}

function buildPlannerBarAvatarSlots(
  assignees: PlannerAssignment[],
  teamMembers: TeamMember[],
  businessContacts: BusinessContact[],
): PlannerBarAvatarSlot[] {
  return assignees.map(a => {
    if (a.track === 'IT') {
      const m = teamMembers.find(tm => tm.id === a.memberId);
      if (!m) {
        // BUG-001: member was removed — show a neutral placeholder
        return {
          key: `IT:${a.memberId}`,
          name: 'Removed member',
          initials: '?',
          background: '#94A3B8',
        };
      }
      return {
        key: `IT:${a.memberId}`,
        name: m.name,
        initials: plannerBarInitials(m.name),
        background: plannerBarAvatarBackground(a.memberId),
      };
    }
    const c = businessContacts.find(b => b.id === a.memberId);
    if (!c) {
      return {
        key: `BIZ:${a.memberId}`,
        name: 'Removed contact',
        initials: '?',
        background: '#94A3B8',
      };
    }
    return {
      key: `BIZ:${a.memberId}`,
      name: c.name,
      initials: plannerBarInitials(c.name),
      background: plannerBarAvatarBackground(a.memberId),
    };
  });
}

const barAvatarChipStyle: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: '50%',
  border: '1.5px solid rgba(255,255,255,0.7)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
};

/** Overlapping assignee chips (max 3 visible slots → 2 avatars + +N). */
function PlannerBarAvatarStack({
  slots,
  variant = 'inBar',
}: {
  slots: PlannerBarAvatarSlot[];
  /** `inBar`: absolute layer inside the bar. `inline`: flex row segment (e.g. drag ghost). */
  variant?: 'inBar' | 'inline';
}) {
  if (slots.length === 0) return null;

  const useOverflow = slots.length > 3;
  const visible = useOverflow ? slots.slice(0, 2) : slots;
  const overflowN = useOverflow ? slots.length - 2 : 0;
  const overflowTitle = useOverflow ? slots.slice(2).map(s => s.name).join(', ') : '';

  const wrapperStyle: CSSProperties =
    variant === 'inBar'
      ? {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          pointerEvents: 'none',
          zIndex: 0,
          maxWidth: '100%',
          overflow: 'hidden',
        }
      : {
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        };

  return (
    <div className="planner-bar-avatars" style={wrapperStyle}>
      {visible.map((s, i) => (
        <div
          key={s.key}
          className="planner-bar-avatar"
          title={s.name}
          style={{
            ...barAvatarChipStyle,
            marginLeft: i === 0 ? 0 : -4,
            background: s.background,
            fontSize: 8,
            fontWeight: 700,
          }}
        >
          {s.initials}
        </div>
      ))}
      {overflowN > 0 && (
        <div
          className="planner-bar-avatar planner-bar-avatar-overflow"
          title={overflowTitle}
          style={{
            ...barAvatarChipStyle,
            marginLeft: -4,
            background: 'rgba(0,0,0,0.18)',
            fontSize: 7,
            fontWeight: 800,
          }}
        >
          +{overflowN}
        </div>
      )}
    </div>
  );
}

// ── Timeline row union (item row vs section header row) ───────────────────────
type TimelineRow =
  | { kind: 'item'; item: PlannerItem }
  | { kind: 'section'; id: string; label: string };

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

interface BarFracs { left: number; width: number; visible: boolean }

// ── Public types ──────────────────────────────────────────────────────────────

export interface DragPreview {
  itemId: string;
  newStartSprint: number;
}

export interface PlannerTimelineProps {
  plannerItems: PlannerItem[];
  jiraItems: JiraWorkItem[];
  /** All available sprints — visible window is derived automatically (1 past + current + future). */
  sprints: Sprint[];
  scenarioId: string;
  /** Fires during any drag/resize so PlannerCapacity can show a live preview. */
  onActiveDragChange?: (preview: DragPreview | null) => void;
  /** All mutations flow through here — parent calls updatePlannerLayout(). */
  onItemsChange: (items: PlannerItem[]) => void;
  /** Bar click (not drag) — opens AssignPanel in Timeline mode. */
  onBarClick?: (item: PlannerItem) => void;
  /** Row label (item name) click — same as bar; detail panel uses onLabelClick on → only. */
  onOpenAssignFromLabel?: (item: PlannerItem) => void;
  /** Item id when AssignPanel is open — highlights bar + label row. */
  assignPanelItemId?: string | null;
  /** SP-18: "+" button on a label row — open the create-child modal with the parent pre-filled. */
  onAddChild?: (parentItem: PlannerItem) => void;
  /** SP-19: right-click context menu on a timeline row. */
  onContextMenu?: (item: PlannerItem, x: number, y: number) => void;
  /** Person filter (redesign §7): assigned bars stay full opacity; others dim to 20%. Also drives ticker individual view. */
  focusedMemberId?: string | null;
  /** Initial label column width in px — kept in sync with PlannerCapacity. Default: 260. */
  labelWidth?: number;
  /** US-UI-22: fires when the detail (→) button is clicked on a label row */
  onLabelClick?: (item: PlannerItem) => void;
  /** Live bar-drag preview from parent — merged with local resize preview for the capacity ticker. */
  dragPreview?: DragPreview | null;
  capacityPanelOpen: boolean;
  onCapacityPanelToggle: () => void;
  /** Red §8: overloaded sprint cell opens panel and scrolls to first overloaded member row. */
  onOverloadedTickerClick: () => void;
  /** Backlog drawer — collapse after a backlog item is dropped on a sprint column (not on backlog). */
  onBacklogItemScheduled?: () => void;
  /** Backlog drawer — expand after a timeline bar is dropped on the backlog (unschedule). */
  onBarUnscheduledToBacklog?: () => void;
  /** Inline "+ Add Epic" button in the Gantt header. Only shown when truthy. */
  onAddEpic?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function barFracs(startSprint: number, spanSprints: number, firstSprintNum: number, sprintCount: number): BarFracs {
  const lo = startSprint - firstSprintNum;
  const hi = lo + spanSprints;
  if (lo >= sprintCount || hi <= 0) return { left: 0, width: 0, visible: false };
  const cl = Math.max(0, lo) / sprintCount;
  const cr = Math.min(sprintCount, hi) / sprintCount;
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
  sprintCount,
  dragOverNum,
  currentSprintNum,
}: {
  sprints: Sprint[];
  sprintCount: number;
  dragOverNum: number | null;
  currentSprintNum: number | null;
}) {
  return (
    <div className="flex border-b border-mileway-border bg-white" style={{ height: SPRINT_HEADER_H }}>
      {sprints.map(s => {
        const isCurrent = s.number === currentSprintNum;
        return (
          <div
            key={s.id}
            style={{ width: `${100 / sprintCount}%` }}
            className={[
              'flex-shrink-0 relative px-3 border-r border-mileway-border last:border-r-0 transition-colors duration-fast',
              'flex flex-col justify-center gap-0.5',
              dragOverNum === s.number ? 'bg-mileway-blue-10' : '',
            ].join(' ')}
          >
            {isCurrent && (
              <span
                style={{ fontSize: 9, letterSpacing: '0.06em' }}
                className="absolute top-1.5 left-2 uppercase font-bold bg-mileway-blue text-white px-1 py-0.5 rounded leading-none"
              >
                Current
              </span>
            )}
            <span
              style={{ fontSize: 12.5, marginTop: isCurrent ? 14 : 0 }}
              className={['font-bold leading-none', dragOverNum === s.number ? 'text-mileway-blue' : 'text-mileway-text'].join(' ')}
            >
              {s.name}
            </span>
            {s.startDate && s.endDate && (
              <span
                style={{ fontSize: 10, fontFamily: 'monospace' }}
                className="text-mileway-grey truncate leading-none"
              >
                {formatSprintRange(s.startDate, s.endDate)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SprintColumnZone ──────────────────────────────────────────────────────────

function SprintColumnZone({
  sprint,
  index,
  sprintCount,
  totalHeight,
  dragOverNum,
  isCurrentSprint,
}: {
  sprint: Sprint;
  index: number;
  sprintCount: number;
  totalHeight: number;
  dragOverNum: number | null;
  isCurrentSprint?: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `sprint-col-${sprint.number}`,
    data: { type: 'sprint-column', sprintNumber: sprint.number },
  });

  let bg: string | undefined;
  if (dragOverNum === sprint.number) bg = undefined; // handled via class
  else if (isCurrentSprint) bg = 'rgba(37,88,201,0.035)';

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        top: 0,
        left: `${(index / sprintCount) * 100}%`,
        width: `${(1 / sprintCount) * 100}%`,
        height: totalHeight,
        zIndex: 0,
        backgroundColor: bg,
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
  onAddChild,
  onContextMenu,
  onLabelClick,
  onOpenAssignFromLabel,
}: {
  item: PlannerItem;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  /** SP-18: "+" button — only rendered for epic/feature rows. */
  onAddChild?: (parentItem: PlannerItem) => void;
  /** SP-19: right-click context menu. */
  onContextMenu?: (item: PlannerItem, x: number, y: number) => void;
  /** US-UI-22: opens detail panel for this item */
  onLabelClick?: (item: PlannerItem) => void;
  /** Opens AssignPanel when clicking the row title. */
  onOpenAssignFromLabel?: (item: PlannerItem) => void;
}) {
  const indent = (INDENT[item.type] ?? 0) + 12;
  const canAddChild = onAddChild && (item.type === 'epic' || item.type === 'feature');

  return (
    <div
      className="group flex items-center gap-1.5 h-full border-b border-mileway-divider hover:bg-mileway-bg transition-colors duration-fast"
      style={{ paddingLeft: indent, paddingRight: 8 }}
      onContextMenu={onContextMenu ? e => { e.preventDefault(); onContextMenu(item, e.clientX, e.clientY); } : undefined}
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

      {/* Manual item badge (SP-17) */}
      {item.isManual && (
        <span
          className="flex-shrink-0"
          title="Manually created — not in Jira"
        >
          <Pencil size={10} className="text-mileway-grey" />
        </span>
      )}

      {/* Name — opens AssignPanel (Timeline); → button opens detail only */}
      {onOpenAssignFromLabel ? (
        <button
          type="button"
          onClick={() => onOpenAssignFromLabel(item)}
          className="flex-1 min-w-0 text-sm text-mileway-text truncate text-left hover:text-mileway-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded"
          style={{ fontWeight: item.type === 'epic' ? 600 : 400 }}
        >
          {item.name}
        </button>
      ) : (
        <span
          className="flex-1 min-w-0 text-sm text-mileway-text truncate"
          style={{ fontWeight: item.type === 'epic' ? 600 : 400 }}
        >
          {item.name}
        </span>
      )}

      {/* US-UI-22: detail panel button (visible on hover) */}
      {onLabelClick && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onLabelClick(item); }}
          aria-label={`Open details for ${item.name}`}
          title="Open details"
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-mileway-grey opacity-0 group-hover:opacity-100 hover:bg-mileway-blue-10 hover:text-mileway-blue transition-all duration-fast focus:outline-none focus-visible:ring-1 focus-visible:ring-mileway-blue"
        >
          <ChevronRight size={12} />
        </button>
      )}

      {/* SP-18: "+" add child button (visible on hover) */}
      {canAddChild && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onAddChild!(item); }}
          aria-label={`Add child to ${item.name}`}
          title={item.type === 'epic' ? 'Create Feature under this Epic' : 'Create Story under this Feature'}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-mileway-grey opacity-0 group-hover:opacity-100 hover:bg-mileway-blue-10 hover:text-mileway-blue transition-all duration-fast focus:outline-none focus-visible:ring-1 focus-visible:ring-mileway-blue"
        >
          <Plus size={12} />
        </button>
      )}

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
  sprintCount: number;
  resizePreview: { start: number; span: number } | null;
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>, itemId: string, edge: 'left' | 'right') => void;
  onResizeMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeEnd: () => void;
  onBarClick?: (item: PlannerItem) => void;
  /** When AssignPanel is open for this item — primary outline on bar (spec v2). */
  assignPanelItemId?: string | null;
  /** SP-19: right-click context menu. */
  onContextMenu?: (item: PlannerItem, x: number, y: number) => void;
  /** Person filter — dims non-matching bars when set */
  focusedMemberId?: string | null;
  /** Fires on mouse enter/leave so the parent can sync the row hover highlight */
  onRowHover?: (itemId: string | null) => void;
}

function PlannerBar({
  item,
  rowTop,
  firstSprintNum,
  sprintCount,
  resizePreview,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onBarClick,
  assignPanelItemId,
  onContextMenu: onCtxMenu,
  focusedMemberId,
  onRowHover,
}: PlannerBarProps) {
  const appState = useCurrentState();
  const barAvatarSlots = useMemo(
    () =>
      buildPlannerBarAvatarSlots(
        item.assignees,
        appState.teamMembers,
        appState.businessContacts ?? [],
      ),
    [item.assignees, appState.teamMembers, appState.businessContacts],
  );

  const isInteractive = !item.locked || item.unlockedInScenario;

  const displayStart = resizePreview?.start ?? item.startSprint;
  const displaySpan  = resizePreview?.span  ?? item.spanSprints;
  const frac = barFracs(displayStart, displaySpan, firstSprintNum, sprintCount);
  if (!frac.visible) return null;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: !isInteractive,
    data: { type: 'timeline-bar', plannerItem: item },
  });

  const assignOpen = assignPanelItemId === item.id;

  const s = BAR[item.type] ?? BAR.custom;
  const borderStyle = item.unlockedInScenario ? 'dashed' : 'solid';
  const assignedToFilter =
    focusedMemberId != null && item.assignees.some(a => a.memberId === focusedMemberId);

  let barOpacity: number;
  if (focusedMemberId != null && !isDragging) {
    if (assignedToFilter) {
      barOpacity = item.locked && !item.unlockedInScenario ? 0.6 : 1;
    } else {
      barOpacity = 0.2;
    }
  } else {
    barOpacity = isDragging ? 0.35 : item.locked && !item.unlockedInScenario ? 0.6 : 1;
  }

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
        opacity: barOpacity,
        transition: 'opacity 200ms ease',
        cursor: isInteractive ? 'grab' : 'not-allowed',
        outline: assignOpen && isInteractive ? '2px solid var(--assign-active-outline, var(--color-primary))' : undefined,
        outlineOffset: assignOpen && isInteractive ? 2 : undefined,
      }}
      {...(isInteractive ? { ...attributes, ...listeners } : {})}
      onClick={onBarClick && isInteractive ? () => onBarClick(item) : undefined}
      onContextMenu={onCtxMenu ? e => { e.preventDefault(); onCtxMenu(item, e.clientX, e.clientY); } : undefined}
      onMouseEnter={() => onRowHover?.(item.id)}
      onMouseLeave={() => onRowHover?.(null)}
      title={
        isInteractive
          ? item.type === 'epic'
            ? 'Click to open assignment panel · Drag to move all · Shift+drag to move Epic only'
            : 'Click to open assignment panel · Drag to reposition'
          : undefined
      }
    >
      <PlannerBarAvatarStack slots={barAvatarSlots} />

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

function BarDragOverlay({ item, shiftHeld }: { item: PlannerItem; shiftHeld?: boolean }) {
  const s = BAR[item.type] ?? BAR.custom;
  const appState = useCurrentState();
  const barAvatarSlots = useMemo(
    () =>
      buildPlannerBarAvatarSlots(
        item.assignees,
        appState.teamMembers,
        appState.businessContacts ?? [],
      ),
    [item.assignees, appState.teamMembers, appState.businessContacts],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
          padding: '0 8px',
          gap: 6,
          overflow: 'hidden',
        }}
      >
        <PlannerBarAvatarStack slots={barAvatarSlots} variant="inline" />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#1E293B',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }}
        >
          {item.name}
        </span>
      </div>
      {/* SP-09: Shift indicator shown only for epics */}
      {item.type === 'epic' && shiftHeld && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#0089DD',
            background: '#E0F0FB',
            borderRadius: 4,
            padding: '2px 6px',
            alignSelf: 'flex-start',
          }}
        >
          Shift held — Epic only
        </div>
      )}
    </div>
  );
}

// ── PlannerTimeline ───────────────────────────────────────────────────────────

// Default spans per item type (SP-07/08)
const TYPE_SPAN: Partial<Record<PlannerItemType, number>> = {
  epic:    6,
  feature: 2,
};
function defaultSpan(type: PlannerItemType): number {
  return TYPE_SPAN[type] ?? 1;
}

export function PlannerTimeline({
  plannerItems,
  jiraItems,
  sprints,
  onActiveDragChange,
  onItemsChange,
  onBarClick,
  onOpenAssignFromLabel,
  assignPanelItemId,
  onAddChild,
  onContextMenu,
  focusedMemberId,
  labelWidth: labelWidthProp,
  onLabelClick,
  dragPreview,
  capacityPanelOpen,
  onCapacityPanelToggle,
  onOverloadedTickerClick,
  onBacklogItemScheduled,
  onBarUnscheduledToBacklog,
  onAddEpic,
}: PlannerTimelineProps) {
  const [expandedIds, setExpandedIds]         = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll]             = useState(false);
  const [labelWidth, setLabelWidth]           = useState(() => labelWidthProp ?? LABEL_W_DEFAULT);
  const [hoveredRowId, setHoveredRowId]       = useState<string | null>(null);
  const [dragOverNum, setDragOverNum]         = useState<number | null>(null);
  const [activeItem, setActiveItem]           = useState<PlannerItem | null>(null);
  const [activeBacklogItem, setActiveBacklogItem] = useState<JiraWorkItem | null>(null);
  const [resize, setResize]                   = useState<ResizeState | null>(null);
  const [shiftDuringDrag, setShiftDuringDrag] = useState(false);

  const { showToast } = useToast();

  const canvasRef    = useRef<HTMLDivElement>(null);
  const labelDragRef = useRef<{ startX: number; startW: number } | null>(null);
  // SP-09: track Shift key state for Epic-only move
  const shiftHeldRef = useRef(false);
  const activeItemRef = useRef<PlannerItem | null>(null);
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeldRef.current = true;
        if (activeItemRef.current?.type === 'epic') setShiftDuringDrag(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeldRef.current = false;
        setShiftDuringDrag(false);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // ── Visible sprint window: 1 past + current + all future ────────────────────
  const visibleSprints = useMemo(() => {
    if (!sprints.length) return sprints;
    const now = new Date();
    const currentIdx = sprints.findIndex(
      s => s.startDate && s.endDate &&
           new Date(s.startDate) <= now && now <= new Date(s.endDate),
    );
    // Fall back to first future sprint if no active sprint found
    const anchorIdx = currentIdx >= 0
      ? currentIdx
      : sprints.findIndex(s => s.startDate && new Date(s.startDate) > now);
    const safeAnchor = anchorIdx >= 0 ? anchorIdx : 0;
    const startIdx = Math.max(0, safeAnchor - 1);
    return sprints.slice(startIdx);
  }, [sprints]);

  const visibleSprintCount = Math.max(visibleSprints.length, 1);
  const firstSprintNum = visibleSprints[0]?.number ?? 1;

  const activeDragLayout = useMemo((): PlannerItem[] | undefined => {
    if (resize) {
      return plannerItems.map(p =>
        p.id === resize.itemId
          ? { ...p, startSprint: resize.previewStart, spanSprints: resize.previewSpan }
          : p,
      );
    }
    if (dragPreview) {
      return plannerItems.map(p =>
        p.id === dragPreview.itemId ? { ...p, startSprint: dragPreview.newStartSprint } : p,
      );
    }
    return undefined;
  }, [plannerItems, resize, dragPreview]);

  const ticker = usePlannerCapacityTicker({
    plannerItems,
    activeDragLayout,
    visibleSprints,
    labelWidth,
    isPanelOpen: capacityPanelOpen,
    onTogglePanel: onCapacityPanelToggle,
    onOverloadedSprintClick: onOverloadedTickerClick,
    selectedFilterMemberId: focusedMemberId ?? null,
  });

  // ── Today line & current sprint ─────────────────────────────────────────────
  const { currentSprintNum, todayLinePercent } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < visibleSprints.length; i++) {
      const s = visibleSprints[i];
      if (!s.startDate || !s.endDate) continue;
      const start = new Date(s.startDate); start.setHours(0, 0, 0, 0);
      const end   = new Date(s.endDate);   end.setHours(23, 59, 59, 999);
      if (today >= start && today <= end) {
        const fraction = (today.getTime() - start.getTime()) / (end.getTime() - start.getTime());
        return {
          currentSprintNum: s.number,
          todayLinePercent: (i + fraction) / visibleSprintCount * 100,
        };
      }
    }
    return { currentSprintNum: null, todayLinePercent: null };
  }, [visibleSprints, visibleSprintCount]);

  // ── Flat visible row list (TimelineRow union — item rows + orphan section header) ─────
  const visibleRows = useMemo((): TimelineRow[] => {
    const result: TimelineRow[] = [];
    const seen = new Set<string>();

    // addVisible: adds to seen AND to the visible row list.
    const addVisible = (item: PlannerItem) => {
      if (!seen.has(item.id)) { seen.add(item.id); result.push({ kind: 'item', item }); }
    };
    // markOwned: adds to seen WITHOUT adding to visible rows.
    // Used for children of collapsed parents so they are not mistaken for orphans.
    const markOwned = (item: PlannerItem) => { seen.add(item.id); };

    const expanded = (id: string) => expandAll || expandedIds.has(id);

    const epics = plannerItems.filter(p => p.type === 'epic');
    for (const epic of epics) {
      addVisible(epic);

      // Guard: only match children when jiraKey is defined to avoid undefined===undefined false matches
      const features = epic.jiraKey !== undefined && epic.jiraKey !== ''
        ? plannerItems.filter(p => p.parentKey === epic.jiraKey && p.type === 'feature')
        : [];
      const directChildren = epic.jiraKey !== undefined && epic.jiraKey !== ''
        ? plannerItems.filter(p => p.parentKey === epic.jiraKey && p.type !== 'feature')
        : [];

      if (expanded(epic.id)) {
        for (const feat of features) {
          addVisible(feat);
          const stories = feat.jiraKey !== undefined && feat.jiraKey !== ''
            ? plannerItems.filter(p => p.parentKey === feat.jiraKey)
            : [];
          if (expanded(feat.id)) {
            stories.forEach(addVisible);
          } else {
            // Feature collapsed — mark stories as owned so they don't become orphans
            stories.forEach(markOwned);
          }
        }
        directChildren.forEach(addVisible);
      } else {
        // Epic collapsed — mark all descendants as owned without showing them
        for (const feat of features) {
          markOwned(feat);
          if (feat.jiraKey !== undefined && feat.jiraKey !== '') {
            plannerItems.filter(p => p.parentKey === feat.jiraKey).forEach(markOwned);
          }
        }
        directChildren.forEach(markOwned);
      }
    }
    // Items not under any placed epic → "Unlinked items" section
    const orphans = plannerItems.filter(p => !seen.has(p.id));
    if (orphans.length > 0) {
      result.push({ kind: 'section', id: '__unlinked__', label: 'Unlinked items' });
      orphans.forEach(addVisible);
    }
    return result;
  }, [plannerItems, expandedIds, expandAll]);

  // ── Children lookup ─────────────────────────────────────────────────────────
  const hasChildrenSet = useMemo(() => {
    const s = new Set<string>();
    for (const item of plannerItems) {
      if (item.parentKey) {
        // Guard: only resolve parent when both keys are defined strings to avoid
        // undefined===undefined false matches
        const parent = plannerItems.find(
          p => p.jiraKey !== undefined && p.jiraKey !== '' && p.jiraKey === item.parentKey,
        );
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
    const sprintW = canvasRef.current.getBoundingClientRect().width / visibleSprintCount;
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

  const onBacklogItemScheduledRef = useRef(onBacklogItemScheduled);
  onBacklogItemScheduledRef.current = onBacklogItemScheduled;
  const onBarUnscheduledToBacklogRef = useRef(onBarUnscheduledToBacklog);
  onBarUnscheduledToBacklogRef.current = onBarUnscheduledToBacklog;

  useDndMonitor({
    onDragStart(event: DragStartEvent) {
      const data = event.active.data.current as { type: string; plannerItem?: PlannerItem; jiraItem?: JiraWorkItem } | undefined;
      if (data?.type === 'timeline-bar' && data.plannerItem) {
        setActiveItem(data.plannerItem);
        activeItemRef.current = data.plannerItem;
        if (data.plannerItem.type === 'epic' && shiftHeldRef.current) setShiftDuringDrag(true);
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
      setShiftDuringDrag(false);
      activeItemRef.current = null;
      onActiveDragChange?.(null);
      if (!over) return;

      const aData = active.data.current as { type: string; plannerItem?: PlannerItem; jiraItem?: JiraWorkItem; memberId?: string } | undefined;
      if (!aData) return;
      const overId = over.id.toString();
      const items = plannerItemsRef.current;

      // Case 1: bar → sprint column (reposition)
      if (aData.type === 'timeline-bar' && overId.startsWith('sprint-col-')) {
        const item = aData.plannerItem!;
        const target = sprintNumFrom(overId);
        if (target === item.startSprint) return;

        const epicOnly = shiftHeldRef.current;
        if (item.type === 'epic' && items.some(p => p.parentKey === item.jiraKey) && !epicOnly) {
          // SP-09 off: Move Epic and all children immediately; offer a 5-second undo.
          const snapshot = items;
          const delta = target - item.startSprint;
          const children = items.filter(p => p.parentKey === item.jiraKey);
          onItemsChange(items.map(p => {
            if (p.id === item.id) return { ...p, startSprint: target };
            if (p.parentKey === item.jiraKey) return { ...p, startSprint: Math.max(1, p.startSprint + delta) };
            return p;
          }));
          const n = children.length;
          showToast(`Moved "${item.name}" and ${n} item${n !== 1 ? 's' : ''}`, {
            type: 'info',
            duration: 5000,
            action: { label: 'Undo', onClick: () => onItemsChange(snapshot) },
          });
          return;
        }

        // SP-09 on: Epic-only move (Shift held) or non-epic bar
        commitMove(item.id, target, false);
        return;
      }

      // Case 2: bar → backlog (unschedule)
      if (aData.type === 'timeline-bar' && overId === 'backlog') {
        onItemsChange(items.filter(p => p.id !== active.id));
        onBarUnscheduledToBacklogRef.current?.();
        return;
      }

      // Case 3: backlog item → sprint column (schedule)
      if (aData.type === 'backlog-item' && overId.startsWith('sprint-col-')) {
        const ji = aData.jiraItem!;
        const target = sprintNumFrom(overId);

        function makeItem(source: typeof ji, startSprint: number): PlannerItem {
          return {
            id: generateId('planner'),
            sourceId: source.id,
            name: source.summary,
            type: source.type as PlannerItemType,
            jiraKey: source.jiraKey,
            parentKey: source.parentKey,
            startSprint,
            spanSprints: defaultSpan(source.type as PlannerItemType),
            assignees: [],
            locked: source.statusCategory === 'in_progress',
            unlockedInScenario: false,
            isManual: false,
            labels: source.labels ?? [],
            jiraAssignees: source.assigneeName ? [source.assigneeName] : [],
            jiraStartDate: source.startDate,
            jiraEndDate: source.dueDate,
          };
        }

        // SP-07: Epic drop — place Epic + all unscheduled Features + their Stories
        if (ji.type === 'epic') {
          const epicItem = makeItem(ji, target);
          const added: PlannerItem[] = [epicItem];
          const alreadyScheduledCount = { features: 0 };

          const features = jiraItems.filter(
            f => f.parentKey === ji.jiraKey && f.type === 'feature',
          );

          let featuresPlaced = 0;
          let storiesPlaced = 0;

          for (const feat of features) {
            const alreadyOnTimeline = items.some(p => p.jiraKey === feat.jiraKey);
            if (alreadyOnTimeline) {
              alreadyScheduledCount.features++;
              continue;
            }
            const featItem = makeItem(feat, target);
            added.push(featItem);
            featuresPlaced++;

            const stories = jiraItems.filter(s => s.parentKey === feat.jiraKey);
            for (const story of stories) {
              if (items.some(p => p.jiraKey === story.jiraKey)) continue;
              added.push(makeItem(story, target));
              storiesPlaced++;
            }
          }

          // Also handle stories/tasks directly under the epic (no Feature intermediary)
          const directChildren = jiraItems.filter(
            c => c.parentKey === ji.jiraKey && c.type !== 'feature',
          );
          for (const child of directChildren) {
            if (items.some(p => p.jiraKey === child.jiraKey)) continue;
            added.push(makeItem(child, target));
          }

          const already = alreadyScheduledCount.features;
          const snapshot = items;
          onItemsChange([...items, ...added]);

          const msg = already > 0
            ? `Placed "${ji.summary}" with ${featuresPlaced} features — ${already} already scheduled, left in place`
            : `Placed "${ji.summary}" with ${featuresPlaced} feature${featuresPlaced !== 1 ? 's' : ''} and ${storiesPlaced} stor${storiesPlaced !== 1 ? 'ies' : 'y'}`;

          showToast(msg, {
            type: 'info',
            duration: 5000,
            action: { label: 'Undo', onClick: () => onItemsChange(snapshot) },
          });
          onBacklogItemScheduledRef.current?.();
          return;
        }

        // SP-08: Feature or Story drop
        const newItem = makeItem(ji, target);
        const snapshot = items;
        onItemsChange([...items, newItem]);
        onBacklogItemScheduledRef.current?.();

        // SP-08: parent-not-scheduled warning
        if (ji.parentKey) {
          const parentOnTimeline = items.some(p => p.jiraKey === ji.parentKey);
          if (!parentOnTimeline) {
            showToast(`"${ji.summary}" placed — parent not yet scheduled`, {
              type: 'info',
              duration: 4000,
              action: { label: 'Undo', onClick: () => onItemsChange(snapshot) },
            });
          }
        }
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
  const contentH = visibleRows.length * ROW_H;
  // Drop zones must always be hittable — enforce a minimum height so dragging
  // onto an empty timeline still registers. 240px covers ~5 rows of visual space.
  const totalH = Math.max(contentH, 240);

  if (visibleSprints.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-mileway-grey text-sm">
        No sprint data available.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Main body — no separate sub-toolbar; Expand/Collapse live in the label header */}
        <div className="flex flex-1 overflow-hidden">

          {/* Label column */}
          <div
            className="flex-shrink-0 flex flex-col bg-white border-r border-mileway-border overflow-y-auto"
            style={{ width: labelWidth }}
          >
            {/* Label header — aligned with sprint header row, hosts Expand/Collapse */}
            <div
              className="flex-shrink-0 flex items-end gap-1 px-2 pb-1.5 border-b border-mileway-border bg-mileway-bg"
              style={{ height: SPRINT_HEADER_H }}
            >
              <button
                onClick={() => { setExpandAll(true); setExpandedIds(new Set()); }}
                className="text-[11px] font-medium text-mileway-grey hover:text-mileway-text px-2 py-0.5 rounded hover:bg-white transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
              >
                Expand all
              </button>
              <button
                onClick={() => { setExpandAll(false); setExpandedIds(new Set()); }}
                className="text-[11px] font-medium text-mileway-grey hover:text-mileway-text px-2 py-0.5 rounded hover:bg-white transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
              >
                Collapse all
              </button>
            </div>
            {ticker.labelCell}
            {visibleRows.map((row) => {
              if (row.kind === 'section') {
                return (
                  <div
                    key={row.id}
                    style={{
                      height: ROW_H,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 12,
                      borderTop: '1px solid #E2E8F0',
                      backgroundColor: '#F8FAFC',
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {row.label}
                    </span>
                  </div>
                );
              }
              const { item } = row;
              return (
                <div
                  key={item.id}
                  style={{
                    height: ROW_H,
                    flexShrink: 0,
                    backgroundColor:
                      assignPanelItemId === item.id
                        ? 'var(--assign-active-row-bg, var(--primary-subtle))'
                        : hoveredRowId === item.id
                          ? 'rgba(37,88,201,0.025)'
                          : undefined,
                  }}
                  onMouseEnter={() => setHoveredRowId(item.id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                >
                  <LabelCell
                    item={item}
                    hasChildren={hasChildrenSet.has(item.id)}
                    isExpanded={expandAll || expandedIds.has(item.id)}
                    onToggle={toggleExpand}
                    onAddChild={onAddChild}
                    onContextMenu={onContextMenu}
                    onLabelClick={onLabelClick}
                    onOpenAssignFromLabel={onOpenAssignFromLabel}
                  />
                </div>
              );
            })}
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
            {/* Inner wrapper enforces minimum column width so columns never crush below 100px */}
            <div style={{ minWidth: visibleSprintCount * MIN_SPRINT_W }}>
            {/* Sprint headers — sticky so they stay visible when scrolling */}
            <div className="sticky top-0 z-20 bg-white">
              <div className="relative">
                <SprintHeaders
                  sprints={visibleSprints}
                  sprintCount={visibleSprintCount}
                  dragOverNum={dragOverNum}
                  currentSprintNum={currentSprintNum}
                />
                {onAddEpic && (
                  <button
                    onClick={onAddEpic}
                    title="Add Epic"
                    aria-label="Add Epic"
                    className="absolute top-1.5 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-mileway-blue bg-mileway-blue-10 hover:bg-mileway-blue hover:text-white transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
                  >
                    <Plus size={12} aria-hidden="true" />
                    Add Epic
                  </button>
                )}
              </div>
              {ticker.sprintRow}
            </div>

            {/* Canvas body — never overflow:hidden */}
            <div
              ref={canvasRef}
              className="relative"
              style={{ height: totalH }}
            >
              {/* Full-height sprint column drop zones (z:0) */}
              {visibleSprints.map((s, i) => (
                <SprintColumnZone
                  key={s.id}
                  sprint={s}
                  index={i}
                  sprintCount={visibleSprintCount}
                  totalHeight={totalH}
                  dragOverNum={dragOverNum}
                  isCurrentSprint={s.number === currentSprintNum}
                />
              ))}

              {/* Empty-state hint — shown when no items are on the timeline yet */}
              {visibleRows.length === 0 && (
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

              {/* Row dividers + hover highlights (z:5, pointer-events:none) */}
              {visibleRows.map((row, idx) => {
                const rowKey = row.kind === 'item' ? row.item.id : row.id;
                const isSectionRow = row.kind === 'section';
                const isActive = !isSectionRow && assignPanelItemId === row.item.id;
                const isHovered = !isSectionRow && hoveredRowId === row.item.id;
                return (
                  <div
                    key={rowKey + '-divider'}
                    style={{
                      position: 'absolute', top: idx * ROW_H, height: ROW_H, left: 0, right: 0,
                      zIndex: 5, pointerEvents: 'none',
                      backgroundColor: isSectionRow
                        ? '#F8FAFC'
                        : isActive
                          ? 'var(--assign-active-row-bg, var(--primary-subtle))'
                          : isHovered
                            ? 'rgba(37,88,201,0.025)'
                            : undefined,
                      borderTop: isSectionRow ? '1px solid #E2E8F0' : undefined,
                    }}
                    className="border-b border-mileway-divider"
                  />
                );
              })}

              {/* Today line (z:20, pointer-events:none) */}
              {todayLinePercent !== null && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${todayLinePercent}%`,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    backgroundColor: '#E63946',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E63946',
                      color: 'white',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '2px 4px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Today
                  </div>
                </div>
              )}

              {/* Bars (z:10) — section-header rows have no bar */}
              {visibleRows.map((row, idx) => {
                if (row.kind === 'section') return null;
                const { item } = row;
                return (
                  <PlannerBar
                    key={item.id}
                    item={item}
                    rowTop={idx * ROW_H}
                    firstSprintNum={firstSprintNum}
                    sprintCount={visibleSprintCount}
                    resizePreview={resize?.itemId === item.id ? { start: resize.previewStart, span: resize.previewSpan } : null}
                    onResizeStart={handleResizeStart}
                    onResizeMove={handleResizeMove}
                    onResizeEnd={handleResizeEnd}
                    onBarClick={onBarClick}
                    assignPanelItemId={assignPanelItemId}
                    onContextMenu={onContextMenu}
                    focusedMemberId={focusedMemberId}
                    onRowHover={setHoveredRowId}
                  />
                );
              })}
            </div>
            </div>{/* end minWidth wrapper */}
          </div>
        </div>
      </div>

      {/* Ghost element following cursor during drag */}
      <DragOverlay dropAnimation={null}>
        {activeItem && <BarDragOverlay item={activeItem} shiftHeld={shiftDuringDrag} />}
        {activeBacklogItem && <BacklogItemOverlay item={activeBacklogItem} />}
      </DragOverlay>
    </>
  );
}
