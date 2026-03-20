/**
 * ScenarioPlanner — Page shell for the Scenario Planner feature.
 *
 * Composes: ScenarioTabs · PlannerBacklog · PlannerTimeline · PlannerCapacity · PlannerBoard
 *
 * PlannerBoard is lazy-loaded so @dnd-kit stays out of the main bundle when
 * the user never visits Board mode.
 *
 * DndContext note: PlannerTimeline owns its DndContext internally for now.
 * It will be lifted to this shell in a follow-up session so PlannerBacklog's
 * useDroppable({ id: 'backlog' }) participates in the same context and the
 * drag-to-unschedule gesture works natively.
 */
import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react';
import { Loader2, Users, Filter, X, Inbox, Check, ChevronDown } from 'lucide-react';
import {
  useFloating, autoUpdate, offset, flip, shift,
  useClick, useDismiss, useRole, useInteractions,
  FloatingFocusManager, FloatingPortal,
} from '@floating-ui/react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAppStore, useActiveScenarioId, useCurrentState, useSyncStatus } from '../stores/appStore';
import {
  createScenario,
  switchScenario,
  updatePlannerLayout,
  initBaselineScenario,
  generateId,
  deleteScenario,
  updateScenario,
} from '../stores/actions';
import { getCurrentQuarter, generateQuarters } from '../utils/calendar';
import { migratePlannerLayout } from '../utils/plannerMigration';
import {
  appStateForScenario,
  countOverloadedTeamSprints,
  countUnscheduledJiraItems,
} from '../utils/plannerScenarioHealth';
import {
  readPlannerSession,
  persistPlannerSession,
  clearPlannerSession,
} from '../utils/plannerSessionStorage';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { ScenarioTabs, ScenarioCreateModal } from '../components/planner/ScenarioTabs';
import { PlannerBacklog } from '../components/planner/PlannerBacklog';
import { PlannerTimeline, type DragPreview } from '../components/planner/PlannerTimeline';
import { PlannerCapacity, type PlannerCapacityHandle } from '../components/planner/PlannerCapacity';
import { AssignPopover } from '../components/planner/AssignPopover';
import { PlannerTeamDrawer } from '../components/planner/PlannerTeamDrawer';
import { BoardToolbar } from '../components/planner/BoardToolbar';
import { PlannerDetailPanel } from '../components/planner/PlannerDetailPanel';
import { CreateItemModal, type CreateItemData } from '../components/planner/CreateItemModal';
import { PlannerContextMenu, type ContextMenuTarget } from '../components/planner/PlannerContextMenu';
import { PlannerPersonFilterPill } from '../components/planner/PlannerPersonFilterPill';
import type { PlannerItem, PlannerItemType, Scenario, JiraWorkItem } from '../types';
import type { BoardSort } from '../components/planner/PlannerBoard';

// PlannerBoard is lazy so @dnd-kit/core stays out of the initial bundle
const PlannerBoard = lazy(() =>
  import('../components/planner/PlannerBoard').then(m => ({ default: m.PlannerBoard }))
);

type PlannerMode = 'board' | 'timeline';

// ── PlannerUIState ────────────────────────────────────────────────────────────
// All UI-only toggle state for the Scenario Planner shell. Lives here so the
// toolbar, drawers, and canvases share one source of truth. No Zustand writes.

interface PlannerUIState {
  /** Left overlay drawer — Backlog items */
  backlogOpen: boolean;
  /** Right overlay drawer — Team members */
  teamDrawerOpen: boolean;
  /** Bottom capacity panel (Timeline mode only) */
  capacityOpen: boolean;
  /** Active canvas mode */
  activeMode: PlannerMode;
  /** Index into the generateQuarters(8) array — drives the quarter navigator */
  currentQuarterIndex: number;
  /** Board mode — which epic card is selected (drives SmartAssignment panel) */
  selectedProjectId: string | null;
  /** Any mode — which item is open in the Slide-out Detail Panel */
  detailItemId: string | null;
  /** Timeline — person filter (toolbar pill + team drawer); dims bars + individual ticker */
  focusedMemberId: string | null;
  /** Timeline — process team filter; hard-filters items to those assigned to team members */
  focusedProcessTeamId: string | null;
}

const INITIAL_PLANNER_UI: PlannerUIState = {
  backlogOpen: false,
  teamDrawerOpen: false,
  capacityOpen: false,
  activeMode: 'timeline',
  currentQuarterIndex: 0,
  selectedProjectId: null,
  detailItemId: null,
  focusedMemberId: null,
  focusedProcessTeamId: null,
};

// ── ViewportNotice ────────────────────────────────────────────────────────────

function ViewportNotice() {
  return (
    <div className="hidden max-[1279px]:flex items-center justify-center h-screen bg-mileway-bg px-8">
      <div className="bg-mileway-blue-10 border-l-4 border-mileway-blue rounded-lg p-6 max-w-md text-center">
        <p className="text-sm font-semibold text-mileway-text mb-1">Best viewed on a wider display</p>
        <p className="text-xs text-mileway-grey leading-relaxed">
          The Scenario Planner requires at least 1280px of horizontal space.
          Try maximising your browser window.
        </p>
      </div>
    </div>
  );
}

// ── ModeToggle ────────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: PlannerMode; onChange: (m: PlannerMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-mileway-bg rounded-lg p-0.5">
      {(['board', 'timeline'] as PlannerMode[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={[
            'px-3 py-1.5 rounded text-sm font-medium transition-colors duration-fast',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
            mode === m
              ? 'bg-mileway-blue-10 text-mileway-blue'
              : 'text-mileway-grey hover:text-mileway-text',
          ].join(' ')}
        >
          {m === 'board' ? 'Board' : 'Timeline'}
        </button>
      ))}
    </div>
  );
}

// ── SaveButton ────────────────────────────────────────────────────────────────

function SaveButton() {
  const { status } = useSyncStatus();
  const retrySyncToSupabase = useAppStore(s => s.retrySyncToSupabase);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show "Saved ✓" for 2 s when status transitions to 'saved'
  useEffect(() => {
    if (status === 'saved') {
      setShowSaved(true);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
    } else {
      setShowSaved(false);
    }
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [status]);

  const isError   = status === 'error';
  const isSaving  = status === 'saving';
  const isSaved   = showSaved;

  return (
    <button
      onClick={() => void retrySyncToSupabase()}
      disabled={isSaving}
      className={[
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
        isSaving  ? 'bg-mileway-blue-10 text-mileway-blue cursor-not-allowed'
        : isError ? 'bg-white border-2 border-red-500 text-red-600 hover:bg-red-50'
        : isSaved ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-mileway-blue text-white hover:bg-[#0077C2]',
      ].join(' ')}
    >
      {isSaving && <Loader2 size={14} className="animate-spin" />}
      {isSaved  && <Check   size={14} />}
      {isSaving ? 'Saving…' : isError ? 'Retry' : isSaved ? 'Saved' : 'Save'}
    </button>
  );
}

// ── ProcessTeamFilterPill ─────────────────────────────────────────────────────

function ProcessTeamFilterPill({
  options,
  selected,
  onChange,
}: {
  options: { id: string; name: string }[];
  selected: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'listbox' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const selectedName = selected ? (options.find(o => o.id === selected)?.name ?? null) : null;
  const label = selectedName ?? 'All Teams';

  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors duration-fast',
          'border focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
          selected
            ? 'border-mileway-blue bg-mileway-blue-10 text-mileway-blue'
            : 'border-mileway-border bg-white text-mileway-text hover:bg-mileway-bg',
        ].join(' ')}
      >
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown size={12} className="flex-shrink-0 text-current opacity-60" aria-hidden />
      </button>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-[120] min-w-[180px] max-w-[260px] max-h-[min(320px,70vh)] overflow-y-auto rounded-lg border border-mileway-border bg-white py-1 shadow-lg"
              role="listbox"
              aria-label="Filter by process team"
            >
              <button
                type="button"
                role="option"
                aria-selected={selected === null}
                onClick={() => { onChange(null); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-mileway-bg focus:outline-none focus-visible:bg-mileway-blue-10 transition-colors duration-fast"
              >
                <span className="flex-1 font-medium text-mileway-text">All Teams</span>
                {selected === null && <Check size={13} className="flex-shrink-0 text-mileway-blue" aria-hidden />}
              </button>
              {options.length > 0 && <div className="my-1 h-px bg-mileway-divider" role="presentation" />}
              {options.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={selected === opt.id}
                  onClick={() => { onChange(opt.id); setOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-mileway-bg focus:outline-none focus-visible:bg-mileway-blue-10 transition-colors duration-fast"
                >
                  <span className="flex-1 truncate text-mileway-text">{opt.name}</span>
                  {selected === opt.id && <Check size={13} className="flex-shrink-0 text-mileway-blue" aria-hidden />}
                </button>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

// ── EpicsFilterPill ───────────────────────────────────────────────────────────

function EpicsFilterPill({
  options,
  selected,
  onChange,
}: {
  options: { key: string; name: string }[];
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'listbox' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const toggle = useCallback((key: string) => {
    onChange(
      selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key],
    );
  }, [selected, onChange]);

  const label = selected.length > 0 ? `Epics (${selected.length})` : 'Epics';

  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors duration-fast',
          'border focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
          selected.length > 0
            ? 'border-mileway-blue bg-mileway-blue-10 text-mileway-blue'
            : 'border-mileway-border bg-white text-mileway-text hover:bg-mileway-bg',
        ].join(' ')}
      >
        <span>{label}</span>
        <ChevronDown size={12} className="flex-shrink-0 text-current opacity-60" aria-hidden />
      </button>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-[120] min-w-[220px] max-w-[320px] max-h-[min(320px,70vh)] overflow-y-auto rounded-lg border border-mileway-border bg-white py-1 shadow-lg"
              role="listbox"
              aria-multiselectable="true"
              aria-label="Filter by epic"
            >
              {options.length === 0 && (
                <p className="px-3 py-2 text-xs text-mileway-grey italic">No epics available</p>
              )}
              {options.map(opt => {
                const isSelected = selected.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(opt.key)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-mileway-bg focus:outline-none focus-visible:bg-mileway-blue-10 transition-colors duration-fast"
                  >
                    <span className="flex-1 truncate text-mileway-text">
                      {opt.name.length > 40 ? opt.name.slice(0, 40) + '…' : opt.name}
                    </span>
                    {isSelected && (
                      <Check size={13} className="flex-shrink-0 text-mileway-blue" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

// ── ScenarioPlanner ───────────────────────────────────────────────────────────

export function ScenarioPlanner() {
  const [plannerUI, setPlannerUI] = useState<PlannerUIState>(INITIAL_PLANNER_UI);
  const [boardSort, setBoardSort] = useState<BoardSort>('priority');

  const capacityPanelRef = useRef<PlannerCapacityHandle>(null);

  const handleCapacityPanelToggle = useCallback(() => {
    setPlannerUI(prev => ({ ...prev, capacityOpen: !prev.capacityOpen }));
  }, []);

  const handleOverloadedTickerClick = useCallback(() => {
    setPlannerUI(prev => ({ ...prev, capacityOpen: true }));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => capacityPanelRef.current?.scrollToFirstOverloaded());
    });
  }, []);

  // ── Soft-responsive drawer coexistence (US-UI-20) ───────────────────────────
  // Track canvas container width via ResizeObserver (excludes nav sidebar).
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Smart toggle for Backlog: auto-closes Team drawer at < 1440px
  /** Backlog drawer: toggles expanded (280px) vs collapsed (32px pill). */
  const toggleBacklog = useCallback(() => {
    setPlannerUI(prev => {
      if (prev.backlogOpen) return { ...prev, backlogOpen: false };
      const autoClose = prev.teamDrawerOpen && containerWidth < 1440;
      return { ...prev, backlogOpen: true, ...(autoClose ? { teamDrawerOpen: false } : {}) };
    });
  }, [containerWidth]);

  const expandBacklog = useCallback(() => {
    setPlannerUI(prev => {
      const autoClose = prev.teamDrawerOpen && containerWidth < 1440;
      return { ...prev, backlogOpen: true, ...(autoClose ? { teamDrawerOpen: false } : {}) };
    });
  }, [containerWidth]);

  const collapseBacklog = useCallback(() => {
    setPlannerUI(prev => ({ ...prev, backlogOpen: false }));
  }, []);

  // Smart toggle for Team drawer: auto-closes Backlog at < 1440px
  const toggleTeamDrawer = useCallback(() => {
    setPlannerUI(prev => {
      if (prev.teamDrawerOpen) return { ...prev, teamDrawerOpen: false };
      const autoClose = prev.backlogOpen && containerWidth < 1440;
      return { ...prev, teamDrawerOpen: true, ...(autoClose ? { backlogOpen: false } : {}) };
    });
  }, [containerWidth]);

  // Switch mode and clear selection state that belongs to the previous mode
  const handleModeChange = useCallback((m: PlannerMode) => {
    setPlannerUI(prev => ({
      ...prev,
      activeMode: m,
      selectedProjectId: null,
      detailItemId: null,
      focusedMemberId: null,
      focusedProcessTeamId: null,
    }));
  }, []);

  const [activeDragPreview, setActiveDragPreview] = useState<DragPreview | null>(null);

  // Quarter navigation — 8 quarters forward from today, current quarter at index 0
  const quarters = useMemo(() => generateQuarters(8), []);
  const selectedQuarter = quarters[plannerUI.currentQuarterIndex] ?? getCurrentQuarter();
  const [assignTarget, setAssignTarget] = useState<{ item: PlannerItem; anchorEl: HTMLElement; preSelectedMemberId?: string } | null>(null);

  // SP-17/18/19: Create/edit modal and context menu
  const [createModal, setCreateModal] = useState<{
    editItem?: PlannerItem;
    defaultType?: PlannerItemType;
    defaultParentKey?: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);

  // SP-20/21: Filters
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [filterEpics, setFilterEpics]   = useState<string[]>([]);

  // Home screen (no scenario open)
  const [showArchived, setShowArchived] = useState(false);
  const [homeCreateOpen, setHomeCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);

  const { showToast } = useToast();

  // Shared sensors for Timeline mode DndContext
  const timelineSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const activeScenarioId = useActiveScenarioId();

  // Read raw store data — useCurrentState returns a stable ref via useShallow
  // so it only triggers a re-render when the underlying arrays change, not on
  // every store write.  Derived arrays are computed in useMemo below (never
  // inside the selector) to keep the selector result reference-stable.
  const allState = useCurrentState();

  const scenarios = useMemo(
    () => allState.scenarios.filter(sc => !sc.isBaseline),
    [allState.scenarios],
  );

  const appData = useAppStore(s => s.data);

  const scenarioHealthById = useMemo(() => {
    const map = new Map<string, { overloaded: number; unscheduled: number }>();
    for (const sc of scenarios) {
      const merged = appStateForScenario(appData, sc);
      const layout = migratePlannerLayout(sc.plannerLayout ?? []);
      map.set(sc.id, {
        overloaded: countOverloadedTeamSprints(layout, merged, appData.sprints),
        unscheduled: countUnscheduledJiraItems(layout, merged),
      });
    }
    return map;
  }, [appData, scenarios]);

  const listScenarios = useMemo(() => {
    const filtered = scenarios.filter(s => showArchived || !s.archived);
    return [...filtered].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [scenarios, showArchived]);

  const activeScenarioCount = useMemo(
    () => scenarios.filter(s => !s.archived).length,
    [scenarios],
  );

  const homeCreateDisabled = activeScenarioCount >= 5;

  const plannerItems = useMemo((): PlannerItem[] => {
    const active = allState.scenarios.find(sc => sc.id === activeScenarioId);
    const layout = active?.plannerLayout ?? [];
    return migratePlannerLayout(layout);
  }, [allState.scenarios, activeScenarioId]);

  const sprints   = allState.sprints       ?? [];
  const jiraItems = allState.jiraWorkItems ?? [];

  // ── Scenario management ────────────────────────────────────────────────────

  const handleSelectScenario = useCallback((id: string) => {
    switchScenario(id);
  }, []);

  const handleCreateScenario = useCallback((name: string, startMode: 'clone' | 'blank') => {
    if (startMode === 'clone') {
      // SP-05: Baseline — create a fresh scenario then populate plannerLayout
      // from Jira sprint / date data.
      const newScenario = createScenario(name);
      switchScenario(newScenario.id);
      initBaselineScenario(newScenario.id);
      setPlannerUI(prev => ({ ...prev, backlogOpen: false }));
    } else {
      // SP-04: Blank canvas — plannerLayout stays undefined; backlog shows all items.
      const newScenario = createScenario(name);
      switchScenario(newScenario.id);
      setPlannerUI(prev => ({ ...prev, backlogOpen: true }));
    }
  }, []);

  // ── Layout mutations (forwarded from PlannerTimeline) ─────────────────────

  // Ref keeps the latest filteredPlannerItems accessible inside handleItemsChange
  // without creating a forward-reference (filteredPlannerItems is defined later).
  const filteredPlannerItemsRef = useRef<PlannerItem[]>([]);

  const handleItemsChange = useCallback((items: PlannerItem[]) => {
    if (!activeScenarioId) return;
    // PlannerTimeline only receives filteredPlannerItems, so `items` may be a
    // filtered subset. We merge to preserve items outside the current filter:
    //   - untouched: existing items NOT in the filtered view (unchanged)
    //   - inFilteredView: incoming items that were in the filtered view (updated/removed)
    //   - trulyNew: incoming items not previously in plannerItems at all (additions)
    const visibleIds = new Set(filteredPlannerItemsRef.current.map(p => p.id));
    const existingIds = new Set(plannerItems.map(p => p.id));
    const untouched       = plannerItems.filter(p => !visibleIds.has(p.id));
    const inFilteredView  = items.filter(p => visibleIds.has(p.id));
    const trulyNew        = items.filter(p => !visibleIds.has(p.id) && !existingIds.has(p.id));
    updatePlannerLayout(activeScenarioId, [...untouched, ...inFilteredView, ...trulyNew]);
  }, [activeScenarioId, plannerItems]);

  const handleActiveDragChange = useCallback((preview: DragPreview | null) => {
    setActiveDragPreview(preview);
  }, []);

  const handleBulkSchedule = useCallback((itemsToSchedule: JiraWorkItem[]) => {
    if (!activeScenarioId || !itemsToSchedule.length) return;

    // Find the current sprint number — fall back to first future sprint
    const now = new Date();
    const currentSprint = sprints.find(
      s => s.startDate && s.endDate &&
           new Date(s.startDate) <= now && now <= new Date(s.endDate),
    ) ?? sprints.find(s => s.startDate && new Date(s.startDate) > now);
    const startSprint = currentSprint?.number ?? 1;

    const scheduledSourceIds = new Set(plannerItems.map(p => p.sourceId));

    function makeItem(source: JiraWorkItem, sprint: number): PlannerItem {
      const defaultSpan: Partial<Record<string, number>> = { epic: 6, feature: 2 };
      return {
        id: generateId('planner'),
        sourceId: source.id,
        name: source.summary,
        type: source.type as PlannerItem['type'],
        jiraKey: source.jiraKey,
        parentKey: source.parentKey,
        startSprint: sprint,
        spanSprints: defaultSpan[source.type] ?? 1,
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

    const added: PlannerItem[] = [];

    for (const ji of itemsToSchedule) {
      if (scheduledSourceIds.has(ji.id)) continue;

      if (ji.type === 'epic') {
        added.push(makeItem(ji, startSprint));
        scheduledSourceIds.add(ji.id);

        const features = jiraItems.filter(f => f.parentKey === ji.jiraKey && f.type === 'feature');
        for (const feat of features) {
          if (scheduledSourceIds.has(feat.id)) continue;
          added.push(makeItem(feat, startSprint));
          scheduledSourceIds.add(feat.id);
          jiraItems
            .filter(s => s.parentKey === feat.jiraKey)
            .forEach(s => {
              if (scheduledSourceIds.has(s.id)) return;
              added.push(makeItem(s, startSprint));
              scheduledSourceIds.add(s.id);
            });
        }
        // Direct non-feature children of the epic
        jiraItems
          .filter(c => c.parentKey === ji.jiraKey && c.type !== 'feature')
          .forEach(c => {
            if (scheduledSourceIds.has(c.id)) return;
            added.push(makeItem(c, startSprint));
            scheduledSourceIds.add(c.id);
          });
      } else {
        added.push(makeItem(ji, startSprint));
        scheduledSourceIds.add(ji.id);
      }
    }

    if (!added.length) return;
    handleItemsChange([...plannerItems, ...added]);
    collapseBacklog();
  }, [activeScenarioId, sprints, plannerItems, jiraItems, handleItemsChange, collapseBacklog]);

  const handleBarClick = useCallback((item: PlannerItem, anchorEl: HTMLElement, preSelectedMemberId?: string) => {
    if (preSelectedMemberId) {
      // People-drag drop → open assign popover
      setAssignTarget({ item, anchorEl, preSelectedMemberId });
    } else {
      // Direct bar click → open detail panel (US-UI-22)
      setPlannerUI(prev => ({ ...prev, detailItemId: item.jiraKey ?? item.id }));
    }
  }, []);

  const handleLabelClick = useCallback((item: PlannerItem) => {
    setPlannerUI(prev => ({ ...prev, detailItemId: item.jiraKey ?? item.id }));
  }, []);

  // Keep the popover's item in sync with live plannerItems (so assignments reflect immediately)
  const liveAssignTarget = useMemo(() => {
    if (!assignTarget) return null;
    const live = plannerItems.find(p => p.id === assignTarget.item.id);
    return { ...assignTarget, item: live ?? assignTarget.item };
  }, [assignTarget, plannerItems]);

  // ── SP-17/18: Manual item creation ──────────────────────────────────────────

  const handleCreateSave = useCallback((data: CreateItemData) => {
    if (!activeScenarioId) return;
    if (createModal?.editItem) {
      // Edit mode — update the existing item
      const updated: PlannerItem = {
        ...createModal.editItem,
        name: data.name,
        type: data.type,
        parentKey: data.parentKey,
        labels: data.labels,
      };
      handleItemsChange(plannerItems.map(p => p.id === updated.id ? updated : p));
    } else {
      // Create mode — manual items go into the scenario's plannerLayout
      // but WITHOUT a startSprint (they live in the backlog until dragged).
      // We model this as startSprint: 0 and spanSprints: 0 which the backlog
      // can pick up on, OR we add them as jiraWorkItems on the scenario.
      // Since PlannerBacklog reads from jiraItems (JiraWorkItem[]), and manual
      // items need to appear there, we add a synthetic JiraWorkItem to the
      // scenario's jiraWorkItems array. This keeps everything consistent.
      const syntheticId = generateId('manual');
      const syntheticKey = `MANUAL-${Date.now()}`;

      // Add a synthetic JiraWorkItem to the scenario so it appears in the backlog
      const state = useAppStore.getState();
      const current = state.getCurrentState();
      const scenario = current.scenarios.find(s => s.id === activeScenarioId);
      if (scenario) {
        const syntheticJiraItem = {
          id: syntheticId,
          connectionId: '',
          jiraKey: syntheticKey,
          jiraId: '',
          summary: data.name,
          type: data.type as 'epic' | 'feature' | 'story' | 'task' | 'bug',
          typeName: data.type,
          status: 'To Do',
          statusCategory: 'todo' as const,
          parentKey: data.parentKey,
          labels: data.labels,
          components: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        };
        state.updateData({
          scenarios: current.scenarios.map(s =>
            s.id === activeScenarioId
              ? { ...s, jiraWorkItems: [...s.jiraWorkItems, syntheticJiraItem], updatedAt: new Date().toISOString() }
              : s,
          ),
        });
      }
    }
    setCreateModal(null);
  }, [activeScenarioId, createModal, plannerItems, handleItemsChange]);

  // SP-18: "+" button on label row
  const handleAddChild = useCallback((parentItem: PlannerItem) => {
    const childType: PlannerItemType = parentItem.type === 'epic' ? 'feature' : 'story';
    setCreateModal({ defaultType: childType, defaultParentKey: parentItem.jiraKey });
  }, []);

  // SP-19: context menu
  const handleContextMenu = useCallback((item: PlannerItem, x: number, y: number) => {
    setContextMenu({ item, x, y });
  }, []);

  const handleEditItem = useCallback((item: PlannerItem) => {
    setCreateModal({ editItem: item });
  }, []);

  const handleDeleteItem = useCallback((item: PlannerItem) => {
    // Delete the item and all its children, with undo toast
    const childIds = new Set<string>();
    const collectChildren = (parentKey: string | undefined) => {
      if (!parentKey) return;
      for (const p of plannerItems) {
        if (p.parentKey === parentKey && !childIds.has(p.id)) {
          childIds.add(p.id);
          collectChildren(p.jiraKey);
        }
      }
    };
    childIds.add(item.id);
    collectChildren(item.jiraKey);

    const snapshot = plannerItems;
    handleItemsChange(plannerItems.filter(p => !childIds.has(p.id)));

    const childCount = childIds.size - 1;
    const msg = childCount > 0
      ? `Deleted "${item.name}" and ${childCount} child item${childCount !== 1 ? 's' : ''}`
      : `Deleted "${item.name}"`;

    showToast(msg, {
      type: 'info',
      duration: 5000,
      action: { label: 'Undo', onClick: () => handleItemsChange(snapshot) },
    });
  }, [plannerItems, handleItemsChange, showToast]);

  // ── SP-20/21: Filtered items for timeline ─────────────────────────────────

  const hasFilters = filterLabels.length > 0 || filterEpics.length > 0;

  // Resolve which member IDs belong to the focused process team
  const membersInFocusedTeam = useMemo((): Set<string> | null => {
    if (!plannerUI.focusedProcessTeamId) return null;
    const id = plannerUI.focusedProcessTeamId;
    const itIds = (allState.teamMembers ?? [])
      .filter(m => m.processTeamIds?.includes(id))
      .map(m => m.id);
    const bizIds = (allState.businessContacts ?? [])
      .filter(c => c.processTeamIds?.includes(id))
      .map(c => c.id);
    return new Set([...itIds, ...bizIds]);
  }, [plannerUI.focusedProcessTeamId, allState.teamMembers, allState.businessContacts]);

  const filteredPlannerItems = useMemo(() => {
    let items = plannerItems;

    // Process team filter — keep items where at least one assignee is in the team
    if (membersInFocusedTeam !== null) {
      const teamSet = membersInFocusedTeam;
      const teamMatchIds = new Set<string>();
      for (const item of items) {
        if (item.assignees.some(a => teamSet.has(a.memberId))) {
          teamMatchIds.add(item.id);
          // Include ancestors
          let cur = item;
          while (cur.parentKey) {
            const parent = items.find(p => p.jiraKey === cur.parentKey);
            if (parent) { teamMatchIds.add(parent.id); cur = parent; } else break;
          }
        }
      }
      // Also include epics that have at least one child matching
      for (const item of items) {
        if (item.type === 'epic' && !teamMatchIds.has(item.id)) {
          const anyChildMatches = items.some(
            c => c.parentKey === item.jiraKey && teamMatchIds.has(c.id),
          );
          if (anyChildMatches) teamMatchIds.add(item.id);
        }
      }
      items = items.filter(p => teamMatchIds.has(p.id));
    }

    if (!hasFilters) return items;

    const matchingIds = new Set<string>();

    for (const item of plannerItems) {
      // SP-21: Epic filter
      if (filterEpics.length > 0) {
        const isMatchingEpic = item.type === 'epic' && filterEpics.includes(item.jiraKey ?? '');
        const isChildOfMatchingEpic = plannerItems.some(
          p => p.type === 'epic' && filterEpics.includes(p.jiraKey ?? '') && item.parentKey === p.jiraKey,
        );
        const isGrandchild = plannerItems.some(feat => {
          if (feat.type !== 'feature') return false;
          const featParent = plannerItems.find(p => p.type === 'epic' && p.jiraKey === feat.parentKey);
          return featParent && filterEpics.includes(featParent.jiraKey ?? '') && item.parentKey === feat.jiraKey;
        });
        if (!isMatchingEpic && !isChildOfMatchingEpic && !isGrandchild) continue;
      }

      // SP-20: Label filter (OR within labels, AND with epic filter)
      if (filterLabels.length > 0) {
        const itemLabels = item.labels ?? [];
        const directMatch = filterLabels.some(l => itemLabels.includes(l));
        if (!directMatch) {
          // Check bubble: if a child matches, ancestor should be shown
          const anyDescendantMatch = plannerItems.some(child => {
            if (child.parentKey !== item.jiraKey) return false;
            return filterLabels.some(l => (child.labels ?? []).includes(l));
          });
          if (!anyDescendantMatch) continue;
        }
      }

      matchingIds.add(item.id);
    }

    // Bubble up: ensure ancestors of matching items are included
    for (const item of plannerItems) {
      if (!matchingIds.has(item.id)) continue;
      // Walk up parentKey chain
      let current = item;
      while (current.parentKey) {
        const parent = plannerItems.find(p => p.jiraKey === current.parentKey);
        if (parent) {
          matchingIds.add(parent.id);
          current = parent;
        } else break;
      }
    }

    return items.filter(p => matchingIds.has(p.id));
  }, [plannerItems, filterLabels, filterEpics, hasFilters, membersInFocusedTeam]);

  // Keep ref in sync so handleItemsChange can merge filtered vs. full item lists
  filteredPlannerItemsRef.current = filteredPlannerItems;

  // Unique labels and epics for filter dropdowns
  const allUniqueLabels = useMemo(() => {
    const set = new Set<string>();
    for (const item of plannerItems) {
      for (const l of item.labels ?? []) set.add(l);
    }
    for (const item of jiraItems) {
      for (const l of item.labels ?? []) set.add(l);
    }
    return Array.from(set).sort();
  }, [plannerItems, jiraItems]);

  const allEpicOptions = useMemo(() => {
    const epics = plannerItems.filter(p => p.type === 'epic');
    const jiraEpics = jiraItems.filter(i => i.type === 'epic');
    const map = new Map<string, string>();
    for (const e of jiraEpics) map.set(e.jiraKey, e.summary);
    for (const e of epics) if (e.jiraKey) map.set(e.jiraKey, e.name);
    return Array.from(map, ([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [plannerItems, jiraItems]);

  // ── Toolbar badge counts ───────────────────────────────────────────────────

  // Backlog badge: unscheduled epics in jiraItems (not yet placed on timeline)
  const backlogBadgeCount = useMemo(() => {
    const scheduledSourceIds = new Set(plannerItems.map(p => p.sourceId));
    return jiraItems.filter(i => i.type === 'epic' && !scheduledSourceIds.has(i.id)).length;
  }, [plannerItems, jiraItems]);

  // Team badge: active IT members + non-archived BIZ contacts
  const teamBadgeCount = useMemo(() => {
    const itCount = (allState.teamMembers ?? []).filter(m => !m.excludedFromCapacity).length;
    const bizCount = (allState.businessContacts ?? []).filter(c => !c.archived && !c.excludedFromCapacity).length;
    return itCount + bizCount;
  }, [allState.teamMembers, allState.businessContacts]);

  // ── Detail panel coexistence (US-UI-21) ────────────────────────────────────
  // Board mode at < 1440px: auto-close any open side drawer when detailItemId is set.
  // Timeline mode: detail panel always overlays at z-50 — no drawer auto-close.
  useEffect(() => {
    if (!plannerUI.detailItemId) return;
    if (plannerUI.activeMode !== 'board') return;
    if (containerWidth >= 1440) return;
    if (plannerUI.backlogOpen || plannerUI.teamDrawerOpen) {
      setPlannerUI(prev => ({ ...prev, backlogOpen: false, teamDrawerOpen: false }));
    }
  }, [plannerUI.detailItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts (B = Backlog, T = Team) ────────────────────────────
  // Use refs to smart-toggles so the listener never goes stale.
  const toggleBacklogRef  = useRef(toggleBacklog);
  const toggleTeamRef     = useRef(toggleTeamDrawer);
  toggleBacklogRef.current  = toggleBacklog;
  toggleTeamRef.current     = toggleTeamDrawer;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'b' || e.key === 'B') toggleBacklogRef.current();
      if (e.key === 't' || e.key === 'T') toggleTeamRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Active scenario was removed (e.g. sync) — return to home
  useEffect(() => {
    if (!activeScenarioId) return;
    const exists = allState.scenarios.some(s => s.id === activeScenarioId && !s.isBaseline);
    if (!exists) switchScenario(null);
  }, [activeScenarioId, allState.scenarios]);

  // Local planner session: restore open scenario + UI, or home (redesign §2 / §4).
  // TODO: Cross-device restore deferred — state is browser-local only
  useLayoutEffect(() => {
    const session = readPlannerSession();
    if (!session) {
      switchScenario(null);
      return;
    }
    const scenarios = useAppStore.getState().data.scenarios;
    const sc = scenarios.find(s => s.id === session.activeScenarioId);
    const canOpen = Boolean(sc && !sc.isBaseline && !sc.archived);
    if (!canOpen) {
      clearPlannerSession();
      switchScenario(null);
      return;
    }
    switchScenario(session.activeScenarioId);
    setPlannerUI({
      ...INITIAL_PLANNER_UI,
      activeMode: session.lastActiveMode,
      currentQuarterIndex: session.lastActiveQuarter,
      backlogOpen: session.backlogDrawerOpen,
    });
  }, []);

  // Debounced persist of mode / quarter / backlog (same key as activeScenarioId).
  useEffect(() => {
    if (!activeScenarioId) return;
    const t = window.setTimeout(() => {
      persistPlannerSession({
        activeScenarioId,
        lastActiveMode: plannerUI.activeMode,
        lastActiveQuarter: plannerUI.currentQuarterIndex,
        backlogDrawerOpen: plannerUI.backlogOpen,
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [activeScenarioId, plannerUI.activeMode, plannerUI.currentQuarterIndex, plannerUI.backlogOpen]);

  const formatScenarioDate = useCallback((iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* 1200px minimum viewport notice */}
      <ViewportNotice />

      {/* Main page — hidden below 1200px */}
      <div className="hidden min-[1200px]:flex flex-col h-full bg-mileway-bg font-planner">
        {!activeScenarioId ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-auto px-8 py-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-mileway-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={e => setShowArchived(e.target.checked)}
                    className="rounded border-mileway-border text-mileway-blue focus:ring-mileway-blue"
                  />
                  Show archived
                </label>
              </div>
              <button
                type="button"
                disabled={homeCreateDisabled}
                title={
                  homeCreateDisabled
                    ? 'Maximum 5 active scenarios. Archive or delete one to create a new scenario.'
                    : undefined
                }
                onClick={() => !homeCreateDisabled && setHomeCreateOpen(true)}
                className={[
                  'px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-fast',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                  homeCreateDisabled
                    ? 'bg-mileway-bg text-mileway-grey cursor-not-allowed opacity-60'
                    : 'bg-mileway-blue text-white hover:bg-[#0077C2]',
                ].join(' ')}
              >
                Create Scenario
              </button>
            </div>

            {scenarios.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
                <h1 className="text-2xl font-semibold text-mileway-text mb-2">No scenarios yet</h1>
                <p className="text-sm text-mileway-grey max-w-md mb-8 leading-relaxed">
                  Create a scenario to start planning without affecting your actuals.
                </p>
                <button
                  type="button"
                  onClick={() => setHomeCreateOpen(true)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-mileway-blue text-white hover:bg-[#0077C2] transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
                >
                  Create Scenario
                </button>
              </div>
            ) : listScenarios.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-sm text-mileway-grey px-6">
                No active scenarios. Turn on &quot;Show archived&quot; to see archived plans.
              </div>
            ) : (
              <ul className="flex flex-col gap-3 max-w-5xl">
                {listScenarios.map(sc => {
                  const layout = migratePlannerLayout(sc.plannerLayout ?? []);
                  const nFeat = layout.filter(p => p.type === 'feature').length;
                  const nEpic = layout.filter(p => p.type === 'epic').length;
                  const itemLine =
                    layout.length === 0
                      ? 'No items yet'
                      : `${nFeat} feature${nFeat !== 1 ? 's' : ''} · ${nEpic} epic${nEpic !== 1 ? 's' : ''}`;
                  const health = scenarioHealthById.get(sc.id) ?? { overloaded: 0, unscheduled: 0 };
                  const ol = health.overloaded;
                  const un = health.unscheduled;
                  const healthStr = `${ol} overloaded sprint${ol !== 1 ? 's' : ''} · ${un} unscheduled`;
                  const isArchived = Boolean(sc.archived);
                  const restoreBlocked = activeScenarioCount >= 5;

                  return (
                    <li
                      key={sc.id}
                      className="bg-white border border-[#EBEBEB] rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-sm"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-mileway-text truncate">{sc.name}</span>
                          <span
                            className={[
                              'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md',
                              isArchived ? 'bg-mileway-bg text-[#6B7280]' : 'bg-green-50 text-green-700',
                            ].join(' ')}
                          >
                            {isArchived ? 'Archived' : 'Active'}
                          </span>
                        </div>
                        <p className="text-xs text-mileway-grey">
                          Created {formatScenarioDate(sc.createdAt)} · Last modified{' '}
                          {formatScenarioDate(sc.updatedAt)}
                        </p>
                        <p className="text-xs text-mileway-text">{itemLine}</p>
                        <p className="text-xs text-mileway-text">
                          {ol > 0 && (
                            <span className="text-[#D97706] font-medium" aria-hidden="true">
                              ⚠{' '}
                            </span>
                          )}
                          {healthStr}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => switchScenario(sc.id)}
                          className="text-sm font-medium text-mileway-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded px-1"
                        >
                          Open
                        </button>
                        {isArchived ? (
                          <button
                            type="button"
                            disabled={restoreBlocked}
                            title={
                              restoreBlocked
                                ? 'Maximum 5 active scenarios. Archive or delete one to restore.'
                                : 'Restore to active'
                            }
                            onClick={() => !restoreBlocked && updateScenario(sc.id, { archived: false })}
                            className="text-sm font-medium text-mileway-text hover:text-mileway-blue disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded px-1"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateScenario(sc.id, { archived: true })}
                            className="text-sm font-medium text-mileway-grey hover:text-mileway-text focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded px-1"
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(sc)}
                          className="text-sm font-medium text-red-600 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded px-1"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <ScenarioCreateModal
              isOpen={homeCreateOpen}
              onClose={() => setHomeCreateOpen(false)}
              onCreate={handleCreateScenario}
            />
          </div>
        ) : (
          <>
        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        {/*
          Layout: [Scenario chip] [Scenario pill ▾] [+] [|] [Board|Timeline]
                  [flex-1 spacer]
                  [(timeline) Add Epic] [(timeline) Filters] [(timeline) ‹ Q ›]
                  [Backlog (N)] [Team (N)] [Save]
        */}
        <div className="flex-shrink-0 bg-white border-b border-mileway-border px-6 py-3 flex items-center gap-3">

          <button
            type="button"
            onClick={() => switchScenario(null)}
            className="text-sm font-medium text-mileway-grey hover:text-mileway-text focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded-lg px-2 py-1 -ml-1 flex-shrink-0"
          >
            ← Back to overview
          </button>

          {/* Left group: scenario controls + mode toggle (ScenarioTabs renders chip, pill, +, divider) */}
          <ScenarioTabs
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onSelect={handleSelectScenario}
            onCreate={handleCreateScenario}
          />

          {/* Mode toggle — follows the left divider */}
          <ModeToggle mode={plannerUI.activeMode} onChange={handleModeChange} />

          {/* Timeline-only filters — middle section */}
          {plannerUI.activeMode === 'timeline' && (
            <>
              {/* Process Team filter */}
              {activeScenarioId && allState.processTeams.length > 0 && (
                <ProcessTeamFilterPill
                  options={allState.processTeams}
                  selected={plannerUI.focusedProcessTeamId}
                  onChange={id => setPlannerUI(prev => ({ ...prev, focusedProcessTeamId: id }))}
                />
              )}

              {/* People filter */}
              {activeScenarioId && (
                <PlannerPersonFilterPill
                  selectedMemberId={plannerUI.focusedMemberId}
                  onSelectMemberId={id =>
                    setPlannerUI(prev => ({ ...prev, focusedMemberId: id }))
                  }
                />
              )}

              {/* SP-20/21: Label + Epic filters */}
              <div className="flex items-center gap-2">
                <select
                  value=""
                  onChange={e => {
                    const v = e.target.value;
                    if (v && !filterLabels.includes(v)) setFilterLabels(prev => [...prev, v]);
                    e.target.value = '';
                  }}
                  className="text-xs border border-mileway-border rounded-lg px-2 py-1.5 text-mileway-text bg-white focus:outline-none focus:border-mileway-blue transition-colors max-w-[120px]"
                  title="Filter by label"
                >
                  <option value="">Labels{filterLabels.length > 0 ? ` (${filterLabels.length})` : ''}</option>
                  {allUniqueLabels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>

                <EpicsFilterPill
                  options={allEpicOptions}
                  selected={filterEpics}
                  onChange={setFilterEpics}
                />

                {hasFilters && (
                  <button
                    onClick={() => { setFilterLabels([]); setFilterEpics([]); }}
                    title="Clear all filters"
                    className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <X size={12} aria-hidden="true" />
                    Clear
                  </button>
                )}
              </div>
            </>
          )}

          {/* Right-side actions — always visible, never pushed off-screen */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {/* Backlog toggle — icon only (keyboard shortcut: B) */}
            <button
              onClick={toggleBacklog}
              title={`${plannerUI.backlogOpen ? 'Collapse' : 'Expand'} backlog (B)`}
              className={[
                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                plannerUI.backlogOpen
                  ? 'bg-mileway-blue-10 text-mileway-blue'
                  : 'text-mileway-grey hover:bg-mileway-bg',
              ].join(' ')}
            >
              <Inbox size={14} aria-hidden="true" />
              {backlogBadgeCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-mileway-blue text-white leading-none">
                  {backlogBadgeCount}
                </span>
              )}
            </button>

            {/* Team toggle (keyboard shortcut: T) */}
            <button
              onClick={toggleTeamDrawer}
              title={`${plannerUI.teamDrawerOpen ? 'Hide' : 'Show'} team drawer (T)`}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                plannerUI.teamDrawerOpen
                  ? 'bg-mileway-blue-10 text-mileway-blue'
                  : 'text-mileway-grey hover:bg-mileway-bg',
              ].join(' ')}
            >
              <Users size={14} aria-hidden="true" />
              Team
              {teamBadgeCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-mileway-grey/30 text-mileway-text leading-none">
                  {teamBadgeCount}
                </span>
              )}
            </button>

            {/* Save */}
            <SaveButton />
          </div>
        </div>

        {/* ── Content area ─────────────────────────────────────────────────── */}
        {/* position:relative is the overlay anchor — drawers and the detail panel
            are absolutely positioned inside this container.
            contentRef drives the ResizeObserver for soft-responsive coexistence. */}
        <div ref={contentRef} className="flex-1 relative overflow-hidden">

          {/* Board mode — full-width card grid with BoardToolbar; capacity panel docked at bottom */}
          {plannerUI.activeMode === 'board' && (
            <div className="flex flex-col h-full min-h-0">
              <BoardToolbar
                selectedQuarter={selectedQuarter}
                onQuarterChange={q => {
                  const idx = quarters.indexOf(q);
                  if (idx >= 0) setPlannerUI(prev => ({ ...prev, currentQuarterIndex: idx }));
                }}
                sort={boardSort}
                onSortChange={setBoardSort}
              />
              <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
                {/* Board mode: separate DndContext — backlog droppable inert here; matches prior pattern */}
                <DndContext>
                  <div className="flex flex-row flex-1 min-h-0 min-w-0 w-full h-full overflow-hidden">
                    <PlannerBacklog
                      jiraItems={jiraItems}
                      plannerItems={plannerItems}
                      expanded={plannerUI.backlogOpen}
                      onExpand={expandBacklog}
                      onCollapse={collapseBacklog}
                      onBulkSchedule={handleBulkSchedule}
                    />
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                    <Suspense
                      fallback={
                        <div className="flex-1 flex items-center justify-center h-full">
                          <Loader2 size={20} className="animate-spin text-mileway-grey" />
                        </div>
                      }
                    >
                      <PlannerBoard
                        scenarioId={activeScenarioId ?? ''}
                        selectedQuarter={selectedQuarter}
                        sort={boardSort}
                        onOpenDetail={jiraKey => setPlannerUI(prev => ({ ...prev, detailItemId: jiraKey }))}
                        overlays={plannerUI.teamDrawerOpen ? (
                          <PlannerTeamDrawer
                            selectedQuarter={selectedQuarter}
                            activeMode="board"
                            onClose={() => setPlannerUI(prev => ({ ...prev, teamDrawerOpen: false }))}
                            onMemberFocus={() => {}}
                            focusedMemberId={null}
                          />
                        ) : undefined}
                      />
                    </Suspense>
                    </div>
                  </div>
                </DndContext>
              </div>
              <PlannerCapacity
                plannerItems={plannerItems}
                sprints={sprints}
                selectedQuarter={selectedQuarter}
                activeDragPreview={activeDragPreview}
                isVisible={plannerUI.capacityOpen}
                labelWidth={260}
              />
            </div>
          )}

          {/* Timeline mode — DndContext wraps gantt + overlay drawers so all
              useDraggable/useDroppable hooks share a single context */}
          {plannerUI.activeMode === 'timeline' && (
            <DndContext sensors={timelineSensors}>
              <div className="h-full flex flex-row overflow-hidden min-h-0">
                {activeScenarioId ? (
                  <PlannerBacklog
                    jiraItems={jiraItems}
                    plannerItems={plannerItems}
                    expanded={plannerUI.backlogOpen}
                    onExpand={expandBacklog}
                    onCollapse={collapseBacklog}
                    onBulkSchedule={handleBulkSchedule}
                  />
                ) : null}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
                  {activeScenarioId ? (
                    <PlannerTimeline
                      plannerItems={filteredPlannerItems}
                      jiraItems={jiraItems}
                      sprints={sprints}
                      onAddEpic={() => setCreateModal({ defaultType: 'epic' })}
                      scenarioId={activeScenarioId}
                      onItemsChange={handleItemsChange}
                      onActiveDragChange={handleActiveDragChange}
                      onBarClick={handleBarClick}
                      onLabelClick={handleLabelClick}
                      onAddChild={handleAddChild}
                      onContextMenu={handleContextMenu}
                      focusedMemberId={plannerUI.focusedMemberId}
                      labelWidth={260}
                      dragPreview={activeDragPreview}
                      capacityPanelOpen={plannerUI.capacityOpen}
                      onCapacityPanelToggle={handleCapacityPanelToggle}
                      onOverloadedTickerClick={handleOverloadedTickerClick}
                      onBacklogItemScheduled={collapseBacklog}
                      onBarUnscheduledToBacklog={expandBacklog}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                      <p className="text-sm font-semibold text-mileway-text">No scenario selected</p>
                      <p className="text-xs text-mileway-grey max-w-xs leading-relaxed">
                        Create a scenario using the + button above to start planning on the timeline.
                      </p>
                    </div>
                  )}
                  <div
                    className="flex-shrink-0 overflow-hidden transition-[max-height,opacity] duration-150 ease-out"
                    style={{
                      maxHeight: plannerUI.capacityOpen ? 300 : 0,
                      opacity: plannerUI.capacityOpen ? 1 : 0,
                    }}
                  >
                    <PlannerCapacity
                      ref={capacityPanelRef}
                      plannerItems={plannerItems}
                      sprints={sprints}
                      selectedQuarter={selectedQuarter}
                      activeDragPreview={activeDragPreview}
                      isVisible
                      focusedMemberId={plannerUI.focusedMemberId}
                      labelWidth={260}
                    />
                  </div>
                </div>
              </div>

              {/* Team drawer — absolute overlay on right edge of canvas */}
              {plannerUI.teamDrawerOpen && (
                <PlannerTeamDrawer
                  selectedQuarter={selectedQuarter}
                  activeMode="timeline"
                  onClose={() => setPlannerUI(prev => ({ ...prev, teamDrawerOpen: false }))}
                  onMemberFocus={id => setPlannerUI(prev => ({ ...prev, focusedMemberId: id }))}
                  focusedMemberId={plannerUI.focusedMemberId}
                />
              )}
            </DndContext>
          )}

          {/* Detail panel — z-50, renders over side drawers in both modes */}
          {plannerUI.detailItemId && (
            <PlannerDetailPanel
              detailItemId={plannerUI.detailItemId}
              plannerItems={plannerItems}
              jiraItems={jiraItems}
              sprints={sprints}
              onClose={() => setPlannerUI(prev => ({ ...prev, detailItemId: null }))}
            />
          )}
        </div>
          </>
        )}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete scenario"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (deleteTarget) {
                  deleteScenario(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-mileway-text leading-relaxed">
          Delete <span className="font-semibold">{deleteTarget?.name}</span>? This cannot be undone.
        </p>
      </Modal>

      {/* AssignPopover — portaled to document.body, opened on bar click or people-drawer drop */}
      {liveAssignTarget && (
        <AssignPopover
          item={liveAssignTarget.item}
          anchorEl={liveAssignTarget.anchorEl}
          plannerItems={plannerItems}
          selectedQuarter={selectedQuarter}
          onItemsChange={handleItemsChange}
          onClose={() => setAssignTarget(null)}
          preSelectedMemberId={liveAssignTarget.preSelectedMemberId}
        />
      )}

      {/* SP-17/18/19: Create/Edit modal */}
      {createModal && (
        <CreateItemModal
          editItem={createModal.editItem}
          defaultType={createModal.defaultType}
          defaultParentKey={createModal.defaultParentKey}
          onSave={handleCreateSave}
          onClose={() => setCreateModal(null)}
        />
      )}

      {/* SP-19: Context menu */}
      {contextMenu && (
        <PlannerContextMenu
          target={contextMenu}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* SP-20/21: Active filter chips (shown below toolbar when filters are active) */}
      {activeScenarioId && hasFilters && plannerUI.activeMode === 'timeline' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white rounded-full shadow-lg border border-mileway-border px-4 py-2">
          <Filter size={12} className="text-mileway-grey" />
          {filterLabels.map(l => (
            <span key={l} className="inline-flex items-center gap-1 text-xs font-medium bg-mileway-bg text-mileway-text rounded-full px-2 py-0.5">
              {l}
              <button onClick={() => setFilterLabels(prev => prev.filter(x => x !== l))} className="text-mileway-grey hover:text-red-500 focus:outline-none" aria-label={`Remove label filter ${l}`}>×</button>
            </span>
          ))}
          {filterEpics.map(k => {
            const name = allEpicOptions.find(e => e.key === k)?.name ?? k;
            return (
              <span key={k} className="inline-flex items-center gap-1 text-xs font-medium bg-mileway-blue-10 text-mileway-blue rounded-full px-2 py-0.5">
                {name.length > 20 ? name.slice(0, 20) + '…' : name}
                <button onClick={() => setFilterEpics(prev => prev.filter(x => x !== k))} className="text-mileway-blue hover:text-red-500 focus:outline-none" aria-label={`Remove epic filter ${k}`}>×</button>
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
