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
import { ChevronRight, ChevronDown, Plus, Pencil } from 'lucide-react';
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
import { useCurrentState, usePlannerTimelineViewMode, useAppStore } from '../../stores/appStore';
import { resolveItemAssignees } from '../../utils/plannerInit';
import { computeSkillGaps, computeRollupGaps, type SkillGapInfo } from '../../utils/skillGap';
import { usePlannerCapacityTicker } from './PlannerCapacityTicker';

// ── Constants ─────────────────────────────────────────────────────────────────

const LABEL_W_DEFAULT = 260;
const LABEL_W_MIN = 200;
const LABEL_W_MAX = 700;
const SPRINT_HEADER_H = 52;
const MIN_SPRINT_W = 100;
const QUARTER_ROW_H = 24;
const MIN_QUARTER_W = 160;

/** Per-type row height — three-tier hierarchy matching Portfolio Planner density. */
function rowH(type: PlannerItemType | 'section'): number {
  if (type === 'epic') return 40;
  if (type === 'feature') return 36;
  return 32; // story, task, bug, uat, hypercare, custom, section
}

interface VisibleQuarter {
  label: string;
  startIdx: number;
  sprintCount: number;
}

const BAR: Record<string, { bg: string; border: string; borderW: number; radius: number }> = {
  epic:      { bg: 'rgba(0,137,221,0.10)', border: '#0089DD', borderW: 1.5, radius: 4 },
  feature:   { bg: '#CCE4F9',              border: '#0089DD', borderW: 1.5, radius: 4 },
  story:     { bg: '#F0F2F5',              border: '#DEDFE3', borderW: 1.5, radius: 4 },
  task:      { bg: '#F0F2F5',              border: '#DEDFE3', borderW: 1.5, radius: 4 },
  bug:       { bg: '#FEE2E2',              border: '#DC2626', borderW: 1.5, radius: 4 },
  uat:       { bg: '#EDE9FE',              border: '#7C3AED', borderW: 1.5, radius: 4 },
  hypercare: { bg: '#DCFCE7',              border: '#16A34A', borderW: 1.5, radius: 4 },
  custom:    { bg: '#F0F2F5',              border: '#DEDFE3', borderW: 1.5, radius: 4 },
};

const INDENT: Partial<Record<PlannerItemType, number>> = {
  epic: 0, feature: 20, story: 36, task: 36, bug: 36, uat: 36, hypercare: 36,
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
  /** US-SP-27: when false, skill gap badges and skill tooltips are suppressed. */
  skillsMatchingEnabled?: boolean;
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

// ── TimelineHeader ────────────────────────────────────────────────────────────

function QuarterRow({
  quarters,
  totalSprints,
  dragOverQuarterLabel,
}: {
  quarters: VisibleQuarter[];
  totalSprints: number;
  dragOverQuarterLabel: string | null;
}) {
  return (
    <div className="flex border-b border-mileway-border" style={{ height: QUARTER_ROW_H, background: 'var(--color-mileway-bg, #F8FAFC)' }}>
      {quarters.map(q => {
        const isOver = dragOverQuarterLabel === q.label;
        const widthPct = (q.sprintCount / totalSprints) * 100;
        return (
          <div
            key={q.label}
            style={{ width: `${widthPct}%` }}
            className={[
              'flex-shrink-0 flex items-center px-3 border-r border-mileway-border last:border-r-0',
              isOver ? 'text-mileway-blue' : 'text-mileway-grey',
            ].join(' ')}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {q.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function QuarterHeaders({
  quarters,
  totalSprints,
  dragOverQuarterLabel,
  currentQuarterLabel,
}: {
  quarters: VisibleQuarter[];
  totalSprints: number;
  dragOverQuarterLabel: string | null;
  currentQuarterLabel: string | null;
}) {
  return (
    <div className="flex border-b border-mileway-border bg-white" style={{ height: SPRINT_HEADER_H }}>
      {quarters.map(q => {
        const isCurrent = q.label === currentQuarterLabel;
        const isOver = dragOverQuarterLabel === q.label;
        const widthPct = (q.sprintCount / totalSprints) * 100;
        return (
          <div
            key={q.label}
            style={{
              width: `${widthPct}%`,
              borderTop: isCurrent ? '3px solid var(--color-mileway-blue, #2558C9)' : '3px solid transparent',
            }}
            className={[
              'flex-shrink-0 relative px-3 border-r border-mileway-border last:border-r-0 transition-colors duration-fast',
              'flex flex-col justify-center gap-1',
              isOver ? 'bg-mileway-blue-10' : '',
            ].join(' ')}
          >
            <span
              style={{ fontSize: 14 }}
              className={['font-bold leading-none', isOver ? 'text-mileway-blue' : 'text-mileway-text'].join(' ')}
            >
              {q.label}
            </span>
            <span style={{ fontSize: 10 }} className="text-mileway-grey leading-none">
              {q.sprintCount} sprint{q.sprintCount !== 1 ? 's' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
              style={{ fontSize: 12, marginTop: isCurrent ? 12 : 0 }}
              className={['font-bold leading-none', dragOverNum === s.number ? 'text-mileway-blue' : 'text-mileway-text'].join(' ')}
            >
              {s.name}
            </span>
            {s.startDate && s.endDate && (
              <span
                style={{ fontSize: 10 }}
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

function TimelineHeader({
  viewMode,
  sprints,
  sprintCount,
  quarters,
  dragOverNum,
  currentSprintNum,
  currentQuarterLabel,
}: {
  viewMode: 'sprint' | 'quarter';
  sprints: Sprint[];
  sprintCount: number;
  quarters: VisibleQuarter[];
  dragOverNum: number | null;
  currentSprintNum: number | null;
  currentQuarterLabel: string | null;
}) {
  const dragOverQuarterLabel = dragOverNum !== null
    ? (sprints.find(s => s.number === dragOverNum)?.quarter ?? null)
    : null;

  if (viewMode === 'quarter') {
    return (
      <QuarterHeaders
        quarters={quarters}
        totalSprints={sprintCount}
        dragOverQuarterLabel={dragOverQuarterLabel}
        currentQuarterLabel={currentQuarterLabel}
      />
    );
  }

  return (
    <>
      <QuarterRow
        quarters={quarters}
        totalSprints={sprintCount}
        dragOverQuarterLabel={dragOverQuarterLabel}
      />
      <SprintHeaders
        sprints={sprints}
        sprintCount={sprintCount}
        dragOverNum={dragOverNum}
        currentSprintNum={currentSprintNum}
      />
    </>
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
  skillGapTooltip,
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
  /** US-SP-25: tooltip text for skill gap badge (direct gap or rollup). */
  skillGapTooltip?: string | null;
}) {
  const indent = (INDENT[item.type] ?? 0) + 12;
  const canAddChild = onAddChild && (item.type === 'epic' || item.type === 'feature');

  return (
    <div
      className={`group flex items-center gap-1.5 h-full border-b hover:bg-mileway-bg transition-colors duration-fast ${item.type === 'epic' ? 'bg-mileway-bg border-mileway-border' : 'bg-white border-mileway-divider'}`}
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

      {item.jiraKey && (
        <span
          className="flex-shrink-0"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#0089DD',
            background: '#E6F2FC',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          {item.jiraKey}
        </span>
      )}

      {skillGapTooltip && (
        <span
          className="flex-shrink-0 text-amber-500 text-xs cursor-default"
          title={skillGapTooltip}
        >
          ⚠
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
  /** US-SP-25: skill gap info for badge rendering */
  skillGapInfo?: SkillGapInfo | null;
  /** US-SP-27: when false, skill gap badges and skill tooltips are suppressed. */
  skillsMatchingEnabled?: boolean;
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
  skillGapInfo,
  skillsMatchingEnabled = true,
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

  const [barHovered, setBarHovered] = useState(false);
  const skillNames = useMemo(() => {
    if (!item.requiredSkillIds?.length) return [];
    const skills = appState.skills ?? [];
    return item.requiredSkillIds
      .map(id => skills.find(s => s.id === id)?.name)
      .filter(Boolean) as string[];
  }, [item.requiredSkillIds, appState.skills]);

  const displayStart = resizePreview?.start ?? item.startSprint;
  const displaySpan  = resizePreview?.span  ?? item.spanSprints;
  const frac = barFracs(displayStart, displaySpan, firstSprintNum, sprintCount);
  if (!frac.visible) return null;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: 'timeline-bar', plannerItem: item },
  });

  const assignOpen = assignPanelItemId === item.id;

  const s = BAR[item.type] ?? BAR.custom;
  const assignedToFilter =
    focusedMemberId != null && item.assignees.some(a => a.memberId === focusedMemberId);

  let barOpacity: number;
  if (focusedMemberId != null && !isDragging) {
    barOpacity = assignedToFilter ? 1 : 0.2;
  } else {
    barOpacity = isDragging ? 0.9 : 1;
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        top: rowTop + 7,
        height: 24,
        left: `${frac.left * 100}%`,
        width: `${frac.width * 100}%`,
        minWidth: 6,
        background: s.bg,
        border: `${s.borderW}px solid ${s.border}`,
        borderRadius: s.radius,
        boxSizing: 'border-box',
        zIndex: 10,
        opacity: barOpacity,
        transition: 'opacity 200ms ease, box-shadow 150ms ease',
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: isDragging
          ? '0 4px 18px rgba(0,0,0,.18)'
          : barHovered
          ? '0 2px 10px rgba(0,0,0,.14)'
          : undefined,
        outline: assignOpen ? '2px solid var(--assign-active-outline, var(--color-primary))' : undefined,
        outlineOffset: assignOpen ? 2 : undefined,
      }}
      {...attributes}
      {...listeners}
      onClick={onBarClick ? () => onBarClick(item) : undefined}
      onContextMenu={onCtxMenu ? e => { e.preventDefault(); onCtxMenu(item, e.clientX, e.clientY); } : undefined}
      onMouseEnter={() => { onRowHover?.(item.id); setBarHovered(true); }}
      onMouseLeave={() => { onRowHover?.(null); setBarHovered(false); }}
      title={
        item.type === 'epic'
          ? 'Click to open assignment panel · Drag to move all · Shift+drag to move Epic only'
          : 'Click to open assignment panel · Drag to reposition'
      }
    >
      <PlannerBarAvatarStack slots={barAvatarSlots} />

      {skillsMatchingEnabled && skillGapInfo && (
        <span
          title={
            skillGapInfo.hasAssignees
              ? `Skill gap: ${skillGapInfo.missingSkills.join(', ')} not covered by any assignee.`
              : `No one assigned — ${skillGapInfo.missingSkills.join(', ')} required.`
          }
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 2, lineHeight: 1 }}
          className="text-amber-500 text-xs cursor-default"
        >
          ⚠
        </span>
      )}

      {/* Left resize handle */}
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

      {/* Right resize handle */}
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

      {skillsMatchingEnabled && barHovered && skillNames.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 6,
            padding: '6px 10px',
            background: '#1E293B',
            color: '#fff',
            borderRadius: 6,
            fontSize: 11,
            whiteSpace: 'nowrap',
            zIndex: 50,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 3, fontWeight: 600 }}>Required:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {skillNames.map(name => (
              <span
                key={name}
                style={{
                  display: 'inline-block',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 3,
                  padding: '1px 6px',
                  fontSize: 10,
                  fontWeight: 500,
                }}
              >
                {name}
              </span>
            ))}
          </div>
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
          height: 24,
          width: 200,
          background: s.bg,
          border: `${s.borderW}px solid ${s.border}`,
          borderRadius: s.radius,
          opacity: 0.9,
          boxShadow: '0 4px 18px rgba(0,0,0,.18)',
          cursor: 'grabbing',
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
  skillsMatchingEnabled = true,
}: PlannerTimelineProps) {
  const [expandedIds, setExpandedIds]         = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll]             = useState(false);
  const [labelWidth, setLabelWidth]           = useState(() => labelWidthProp ?? LABEL_W_DEFAULT);
  const [isLabelHandleDragging, setIsLabelHandleDragging] = useState(false);
  const [hoveredRowId, setHoveredRowId]       = useState<string | null>(null);
  const [dragOverNum, setDragOverNum]         = useState<number | null>(null);
  const [activeItem, setActiveItem]           = useState<PlannerItem | null>(null);
  const [activeBacklogItem, setActiveBacklogItem] = useState<JiraWorkItem | null>(null);
  const [resize, setResize]                   = useState<ResizeState | null>(null);
  const [shiftDuringDrag, setShiftDuringDrag] = useState(false);

  const { showToast } = useToast();
  const timelineState = useCurrentState();

  const canvasRef       = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const labelRowsRef    = useRef<HTMLDivElement>(null);
  const scrollSyncRef   = useRef(false);
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

  const plannerTimelineViewMode = usePlannerTimelineViewMode();
  const setPlannerTimelineViewMode = useAppStore(s => s.setPlannerTimelineViewMode);

  const visibleQuarters = useMemo((): VisibleQuarter[] => {
    const result: VisibleQuarter[] = [];
    for (let i = 0; i < visibleSprints.length; i++) {
      const label = visibleSprints[i].quarter ?? '';
      const last = result[result.length - 1];
      if (last && last.label === label) {
        last.sprintCount++;
      } else {
        result.push({ label, startIdx: i, sprintCount: 1 });
      }
    }
    return result;
  }, [visibleSprints]);

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

  const currentQuarterLabel = useMemo(() => {
    if (currentSprintNum === null) return null;
    return visibleSprints.find(s => s.number === currentSprintNum)?.quarter ?? null;
  }, [currentSprintNum, visibleSprints]);

  const headerH = plannerTimelineViewMode === 'sprint'
    ? SPRINT_HEADER_H + QUARTER_ROW_H
    : SPRINT_HEADER_H;

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
    // Items not under any placed epic → "Unlinked items" section.
    // Within this section we still respect Feature → Story hierarchy:
    // orphan Features are rendered with their child Stories expand/collapsible
    // beneath them, matching the Epic → Feature nesting used above.
    const orphans = plannerItems.filter(p => !seen.has(p.id));
    if (orphans.length > 0) {
      result.push({ kind: 'section', id: '__unlinked__', label: 'Unlinked items' });

      // Process orphan Features first so their child Stories can be nested under them
      const orphanFeatures = orphans.filter(p => p.type === 'feature');
      for (const feat of orphanFeatures) {
        addVisible(feat);
        const children = feat.jiraKey !== undefined && feat.jiraKey !== ''
          ? orphans.filter(p => p.parentKey === feat.jiraKey)
          : [];
        if (expanded(feat.id)) {
          children.forEach(addVisible);
        } else {
          // Feature collapsed — mark children as owned so they don't appear flat below
          children.forEach(markOwned);
        }
      }

      // Remaining orphans: stories/tasks with no feature parent among the orphans,
      // plus items whose parentKey is dangling (parent not in plannerItems at all)
      orphans.filter(p => !seen.has(p.id)).forEach(addVisible);
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

  // ── Skill gap detection (US-SP-25) ─────────────────────────────────────────
  const EMPTY_SKILL_GAP_MAP = useMemo(() => new Map<string, SkillGapInfo>(), []);
  const skillGapMap = useMemo(
    () => skillsMatchingEnabled
      ? computeSkillGaps(plannerItems, timelineState.teamMembers, timelineState.skills ?? [], sprints)
      : EMPTY_SKILL_GAP_MAP,
    [plannerItems, timelineState.teamMembers, timelineState.skills, sprints, skillsMatchingEnabled, EMPTY_SKILL_GAP_MAP],
  );

  const collapsedIds = useMemo(() => {
    if (expandAll) return new Set<string>();
    const s = new Set<string>();
    for (const id of hasChildrenSet) {
      if (!expandedIds.has(id)) s.add(id);
    }
    return s;
  }, [hasChildrenSet, expandedIds, expandAll]);

  const rollupGapMap = useMemo(
    () => computeRollupGaps(plannerItems, skillGapMap, collapsedIds),
    [plannerItems, skillGapMap, collapsedIds],
  );

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

  // ── Canvas → label scroll synchronisation ───────────────────────────────────
  // The label rows div has overflow-y:hidden (no user-scrollable scrollbar).
  // When the canvas scrolls vertically, we mirror its scrollTop to the label rows
  // so both columns stay in sync. requestAnimationFrame guards against double-fire.
  const onCanvasScroll = useCallback(() => {
    if (scrollSyncRef.current) return;
    const labelRows = labelRowsRef.current;
    const canvas    = canvasScrollRef.current;
    if (!labelRows || !canvas) return;
    scrollSyncRef.current = true;
    labelRows.scrollTop = canvas.scrollTop;
    requestAnimationFrame(() => { scrollSyncRef.current = false; });
  }, []);

  // ── Label column resize ─────────────────────────────────────────────────────
  function onLabelHandleDown(e: ReactPointerEvent<HTMLDivElement>) {
    labelDragRef.current = { startX: e.clientX, startW: labelWidth };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsLabelHandleDragging(true);
  }
  function onLabelHandleMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!labelDragRef.current) return;
    setLabelWidth(Math.max(LABEL_W_MIN, Math.min(LABEL_W_MAX, labelDragRef.current.startW + e.clientX - labelDragRef.current.startX)));
  }
  function onLabelHandleUp() { labelDragRef.current = null; setIsLabelHandleDragging(false); }

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
            assignees: resolveItemAssignees(source, timelineState.teamMembers ?? [], timelineState.jiraItemBizAssignments ?? []),
            isManual: false,
            labels: source.labels ?? [],
            jiraAssignees: source.assigneeName ? [source.assigneeName] : [],
            jiraStartDate: source.startDate,
            jiraEndDate: source.dueDate,
            requiredSkillIds: [],
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
  const contentH = visibleRows.reduce(
    (sum, row) => sum + rowH(row.kind === 'section' ? 'section' : row.item.type),
    0,
  );
  // Drop zones must always be hittable — enforce a minimum height so dragging
  // onto an empty timeline still registers. 240px covers ~5 rows of visual space.
  const totalH = Math.max(contentH, 240);

  // Cumulative row top offsets (variable heights per item type).
  const rowTops = useMemo(() => {
    const tops: number[] = [];
    let acc = 0;
    for (const row of visibleRows) {
      tops.push(acc);
      acc += rowH(row.kind === 'section' ? 'section' : row.item.type);
    }
    return tops;
  }, [visibleRows]);

  if (visibleSprints.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-mileway-grey text-sm">
        No sprint data available.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif", '--left-w': `${labelWidth}px` } as CSSProperties}>

        {/* Main body — no separate sub-toolbar; Expand/Collapse live in the label header */}
        <div className="flex flex-1 overflow-hidden">

          {/* Label column — outer div has no own scroll; rows are synced to canvas */}
          <div
            className="flex-shrink-0 flex flex-col bg-white border-r border-mileway-border"
            style={{ width: labelWidth }}
          >
            {/* Label header — fixed, mirrors the sticky sprint-header height in the canvas */}
            <div
              className="flex-shrink-0 flex items-end justify-between px-3 pb-1.5 border-b border-mileway-border bg-mileway-bg"
              style={{ height: headerH }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Epic · Feature · Story
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setExpandAll(true); setExpandedIds(new Set()); }}
                  className="text-[11px] font-medium text-mileway-grey hover:text-mileway-blue px-2 py-0.5 rounded border border-mileway-border hover:border-mileway-blue bg-transparent hover:bg-mileway-blue-10 transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
                >
                  Expand all
                </button>
                <button
                  onClick={() => { setExpandAll(false); setExpandedIds(new Set()); }}
                  className="text-[11px] font-medium text-mileway-grey hover:text-mileway-blue px-2 py-0.5 rounded border border-mileway-border hover:border-mileway-blue bg-transparent hover:bg-mileway-blue-10 transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
                >
                  Collapse all
                </button>
                {/* Sprint | Quarter view toggle */}
                <div className="ml-1 flex rounded border border-mileway-border overflow-hidden" style={{ fontSize: 11 }}>
                  {(['sprint', 'quarter'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPlannerTimelineViewMode(mode)}
                      className={[
                        'px-2 py-0.5 font-medium capitalize transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                        plannerTimelineViewMode === mode
                          ? 'bg-mileway-blue text-white'
                          : 'text-mileway-grey hover:text-mileway-text hover:bg-white',
                      ].join(' ')}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Ticker label — fixed, mirrors the sticky ticker-sprint-row height in the canvas */}
            {ticker.labelCell}
            {/* Rows — overflow-y:hidden (no visible scrollbar); scrollTop driven by canvas onScroll */}
            <div ref={labelRowsRef} className="flex-1 overflow-y-hidden flex flex-col">
              {visibleRows.map((row) => {
                if (row.kind === 'section') {
                  return (
                    <div
                      key={row.id}
                      style={{
                        height: rowH('section'),
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
                      height: rowH(item.type),
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
                      skillGapTooltip={
                        (() => {
                          const gap = skillGapMap.get(item.id);
                          const rollup = rollupGapMap.get(item.id);
                          if (gap) {
                            return gap.hasAssignees
                              ? `Skill gap: ${gap.missingSkills.join(', ')} not covered by any assignee.`
                              : `No one assigned — ${gap.missingSkills.join(', ')} required.`;
                          }
                          if (rollup) return `Skill gaps in ${rollup.join(', ')}.`;
                          return null;
                        })()
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Label resize handle */}
          <div
            className={`flex-shrink-0 cursor-col-resize transition-colors duration-fast ${isLabelHandleDragging ? 'bg-mileway-blue' : 'bg-mileway-divider hover:bg-mileway-blue'}`}
            style={{ width: 4 }}
            onPointerDown={onLabelHandleDown}
            onPointerMove={onLabelHandleMove}
            onPointerUp={onLabelHandleUp}
          />

          {/* Gantt canvas — onScroll drives the label rows sync */}
          <div ref={canvasScrollRef} className="flex-1 overflow-auto" onScroll={onCanvasScroll}>
            {/* Inner wrapper enforces minimum column width so columns never crush below 100px */}
            <div style={{ minWidth: plannerTimelineViewMode === 'quarter'
              ? visibleQuarters.length * MIN_QUARTER_W
              : visibleSprintCount * MIN_SPRINT_W }}>
            {/* Sprint headers — sticky so they stay visible when scrolling */}
            <div className="sticky top-0 z-20 bg-white">
              <div className="relative">
                <TimelineHeader
                  viewMode={plannerTimelineViewMode}
                  sprints={visibleSprints}
                  sprintCount={visibleSprintCount}
                  quarters={visibleQuarters}
                  dragOverNum={dragOverNum}
                  currentSprintNum={currentSprintNum}
                  currentQuarterLabel={currentQuarterLabel}
                />
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
                      position: 'absolute', top: rowTops[idx], height: rowH(row.kind === 'section' ? 'section' : row.item.type), left: 0, right: 0,
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
                    backgroundColor: 'var(--color-primary)',
                    opacity: 0.7,
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
                      backgroundColor: 'var(--color-primary)',
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
                    rowTop={rowTops[idx] ?? 0}
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
                    skillGapInfo={skillGapMap.get(item.id) ?? null}
                    skillsMatchingEnabled={skillsMatchingEnabled}
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
