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
import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2, BarChart2, Users, Plus, Filter, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAppStore, useActiveScenarioId, useCurrentState, useSyncStatus } from '../stores/appStore';
import {
  createScenario,
  switchScenario,
  updatePlannerLayout,
  initBaselineScenario,
  generateId,
} from '../stores/actions';
import { getCurrentQuarter, generateQuarters } from '../utils/calendar';
import { migratePlannerLayout } from '../utils/plannerMigration';
import { useToast } from '../components/ui/Toast';
import { ScenarioTabs } from '../components/planner/ScenarioTabs';
import { PlannerBacklog } from '../components/planner/PlannerBacklog';
import { PlannerTimeline, type DragPreview } from '../components/planner/PlannerTimeline';
import { PlannerCapacity } from '../components/planner/PlannerCapacity';
import { AssignPopover } from '../components/planner/AssignPopover';
import { PlannerPeopleDrawer } from '../components/planner/PlannerPeopleDrawer';
import { CreateItemModal, type CreateItemData } from '../components/planner/CreateItemModal';
import { PlannerContextMenu, type ContextMenuTarget } from '../components/planner/PlannerContextMenu';
import type { PlannerItem, PlannerItemType } from '../types';

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
}

const INITIAL_PLANNER_UI: PlannerUIState = {
  backlogOpen: false,
  teamDrawerOpen: false,
  capacityOpen: false,
  activeMode: 'board',
  currentQuarterIndex: 0,
  selectedProjectId: null,
  detailItemId: null,
};

// ── ViewportNotice ────────────────────────────────────────────────────────────

function ViewportNotice() {
  return (
    <div className="hidden max-[1199px]:flex items-center justify-center h-screen bg-mileway-bg px-8">
      <div className="bg-mileway-blue-10 border-l-4 border-mileway-blue rounded-lg p-6 max-w-md text-center">
        <p className="text-sm font-semibold text-mileway-text mb-1">Best viewed on a wider display</p>
        <p className="text-xs text-mileway-grey leading-relaxed">
          The Scenario Planner requires at least 1200px of horizontal space.
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

// ── ScenarioPlanner ───────────────────────────────────────────────────────────

export function ScenarioPlanner() {
  const [plannerUI, setPlannerUI] = useState<PlannerUIState>(INITIAL_PLANNER_UI);

  // Convenience: toggle a single boolean field in plannerUI
  const toggleUI = useCallback((key: 'backlogOpen' | 'teamDrawerOpen' | 'capacityOpen') => {
    setPlannerUI(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Switch mode and clear selection state that belongs to the previous mode
  const handleModeChange = useCallback((m: PlannerMode) => {
    setPlannerUI(prev => ({
      ...prev,
      activeMode: m,
      selectedProjectId: null,
      detailItemId: null,
    }));
  }, []);

  const [activeDragPreview, setActiveDragPreview] = useState<DragPreview | null>(null);
  const [baselineBanner, setBaselineBanner] = useState<{ placed: number; unscheduled: number } | null>(null);

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
      const { placedCount, unscheduledCount } = initBaselineScenario(newScenario.id);
      setBaselineBanner({ placed: placedCount, unscheduled: unscheduledCount });
    } else {
      // SP-04: Blank canvas — plannerLayout stays undefined; backlog shows all items.
      const newScenario = createScenario(name);
      switchScenario(newScenario.id);
    }
  }, []);

  // ── Layout mutations (forwarded from PlannerTimeline) ─────────────────────

  const handleItemsChange = useCallback((items: PlannerItem[]) => {
    if (!activeScenarioId) return;
    updatePlannerLayout(activeScenarioId, items);
  }, [activeScenarioId]);

  const handleActiveDragChange = useCallback((preview: DragPreview | null) => {
    setActiveDragPreview(preview);
  }, []);

  const handleBarClick = useCallback((item: PlannerItem, anchorEl: HTMLElement, preSelectedMemberId?: string) => {
    setAssignTarget({ item, anchorEl, preSelectedMemberId });
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

  const filteredPlannerItems = useMemo(() => {
    if (!hasFilters) return plannerItems;

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

    return plannerItems.filter(p => matchingIds.has(p.id));
  }, [plannerItems, filterLabels, filterEpics, hasFilters]);

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
    return Array.from(map, ([key, name]) => ({ key, name }));
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

  // ── Keyboard shortcuts (B = Backlog, T = Team) ────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'b' || e.key === 'B') {
        setPlannerUI(prev => ({ ...prev, backlogOpen: !prev.backlogOpen }));
      }
      if (e.key === 't' || e.key === 'T') {
        setPlannerUI(prev => ({ ...prev, teamDrawerOpen: !prev.teamDrawerOpen }));
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* 1200px minimum viewport notice */}
      <ViewportNotice />

      {/* Main page — hidden below 1200px */}
      <div className="hidden min-[1200px]:flex flex-col h-full bg-mileway-bg">

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        {/*
          Layout: [Scenario chip] [Scenario pill ▾] [+] [|] [Board|Timeline]
                  [flex-1 spacer]
                  [(timeline) Add Epic] [(timeline) Filters] [(timeline) ‹ Q ›]
                  [Backlog (N)] [Team (N)] [(timeline) Capacity] [Save]
        */}
        <div className="flex-shrink-0 bg-white border-b border-mileway-border px-6 py-3 flex items-center gap-3">

          {/* Left group: scenario controls + mode toggle (ScenarioTabs renders chip, pill, +, divider) */}
          <ScenarioTabs
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onSelect={handleSelectScenario}
            onCreate={handleCreateScenario}
          />

          {/* Mode toggle — follows the left divider */}
          <ModeToggle mode={plannerUI.activeMode} onChange={handleModeChange} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right group — Timeline-only controls */}
          {plannerUI.activeMode === 'timeline' && (
            <>
              {/* SP-17: Add Epic */}
              {activeScenarioId && (
                <button
                  onClick={() => setCreateModal({ defaultType: 'epic' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-mileway-blue bg-mileway-blue-10 hover:bg-mileway-blue hover:text-white transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add Epic
                </button>
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

                <select
                  value=""
                  onChange={e => {
                    const v = e.target.value;
                    if (v && !filterEpics.includes(v)) setFilterEpics(prev => [...prev, v]);
                    e.target.value = '';
                  }}
                  className="text-xs border border-mileway-border rounded-lg px-2 py-1.5 text-mileway-text bg-white focus:outline-none focus:border-mileway-blue transition-colors max-w-[120px]"
                  title="Filter by epic"
                >
                  <option value="">Epics{filterEpics.length > 0 ? ` (${filterEpics.length})` : ''}</option>
                  {allEpicOptions.map(e => (
                    <option key={e.key} value={e.key}>{e.name.length > 25 ? e.name.slice(0, 25) + '…' : e.name}</option>
                  ))}
                </select>

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

              {/* Quarter navigator — ‹ Q1 2026 › */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setPlannerUI(prev => ({ ...prev, currentQuarterIndex: prev.currentQuarterIndex - 1 }))}
                  disabled={plannerUI.currentQuarterIndex === 0}
                  aria-label="Previous quarter"
                  className="flex items-center justify-center w-6 h-7 rounded text-mileway-grey hover:bg-mileway-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <span className="text-xs font-semibold text-mileway-text px-1 min-w-[60px] text-center select-none">
                  {selectedQuarter}
                </span>
                <button
                  onClick={() => setPlannerUI(prev => ({ ...prev, currentQuarterIndex: prev.currentQuarterIndex + 1 }))}
                  disabled={plannerUI.currentQuarterIndex >= quarters.length - 1}
                  aria-label="Next quarter"
                  className="flex items-center justify-center w-6 h-7 rounded text-mileway-grey hover:bg-mileway-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </>
          )}

          {/* Backlog toggle (all modes) — keyboard shortcut: B */}
          <button
            onClick={() => toggleUI('backlogOpen')}
            title={`${plannerUI.backlogOpen ? 'Hide' : 'Show'} backlog (B)`}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
              plannerUI.backlogOpen
                ? 'bg-mileway-blue-10 text-mileway-blue'
                : 'text-mileway-grey hover:bg-mileway-bg',
            ].join(' ')}
          >
            Backlog
            {backlogBadgeCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-mileway-blue text-white leading-none">
                {backlogBadgeCount}
              </span>
            )}
          </button>

          {/* Team toggle (all modes) — keyboard shortcut: T */}
          <button
            onClick={() => toggleUI('teamDrawerOpen')}
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

          {/* Capacity — Timeline mode only */}
          {plannerUI.activeMode === 'timeline' && (
            <button
              onClick={() => toggleUI('capacityOpen')}
              title={plannerUI.capacityOpen ? 'Hide capacity panel' : 'Show capacity panel'}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                plannerUI.capacityOpen
                  ? 'bg-mileway-blue-10 text-mileway-blue'
                  : 'text-mileway-grey hover:bg-mileway-bg',
              ].join(' ')}
            >
              <BarChart2 size={14} aria-hidden="true" />
              Capacity
            </button>
          )}

          {/* Save */}
          <SaveButton />
        </div>

        {/* ── Baseline banner (SP-05) ──────────────────────────────────────── */}
        {baselineBanner && (
          <div className="flex-shrink-0 flex items-center justify-between gap-4 px-6 py-2 bg-mileway-blue-10 border-b border-mileway-blue/20 text-sm text-mileway-blue">
            <span>
              Loaded from Jira — <strong>{baselineBanner.placed}</strong> items placed
              {baselineBanner.unscheduled > 0 && (
                <>, <strong>{baselineBanner.unscheduled}</strong> unscheduled in backlog</>
              )}
            </span>
            <button
              onClick={() => setBaselineBanner(null)}
              aria-label="Dismiss"
              className="text-mileway-blue hover:text-mileway-text transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded px-2 py-0.5 text-xs font-medium"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Content area ─────────────────────────────────────────────────── */}
        {/* position:relative is the overlay anchor — drawers and the detail panel
            are absolutely positioned inside this container */}
        <div className="flex-1 relative overflow-hidden">

          {/* Board mode — full-width card grid; capacity panel docked at bottom */}
          {plannerUI.activeMode === 'board' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto">
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center h-full">
                      <Loader2 size={20} className="animate-spin text-mileway-grey" />
                    </div>
                  }
                >
                  <PlannerBoard scenarioId={activeScenarioId ?? ''} />
                </Suspense>
              </div>
              <PlannerCapacity
                plannerItems={plannerItems}
                sprints={sprints}
                selectedQuarter={selectedQuarter}
                activeDragPreview={activeDragPreview}
                isVisible={plannerUI.capacityOpen}
              />
            </div>
          )}

          {/* Board mode backlog overlay — needs its own DndContext for useDroppable;
              no drag events fire in Board mode so the context is effectively inert */}
          {plannerUI.activeMode === 'board' && plannerUI.backlogOpen && (
            <DndContext>
              <PlannerBacklog
                jiraItems={jiraItems}
                plannerItems={plannerItems}
                onClose={() => toggleUI('backlogOpen')}
              />
            </DndContext>
          )}

          {/* Timeline mode — DndContext wraps gantt + overlay drawers so all
              useDraggable/useDroppable hooks share a single context */}
          {plannerUI.activeMode === 'timeline' && (
            <DndContext sensors={timelineSensors}>
              {/* Gantt fills full width — backlog is now overlay, not a flex sibling */}
              <div className="h-full flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                  {activeScenarioId ? (
                    <PlannerTimeline
                      plannerItems={filteredPlannerItems}
                      jiraItems={jiraItems}
                      sprints={sprints}
                      selectedQuarter={selectedQuarter}
                      scenarioId={activeScenarioId}
                      onItemsChange={handleItemsChange}
                      onActiveDragChange={handleActiveDragChange}
                      onBarClick={handleBarClick}
                      onAddChild={handleAddChild}
                      onContextMenu={handleContextMenu}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                      <p className="text-sm font-semibold text-mileway-text">No scenario selected</p>
                      <p className="text-xs text-mileway-grey max-w-xs leading-relaxed">
                        Create a scenario using the + button above to start planning on the timeline.
                      </p>
                    </div>
                  )}
                  <PlannerCapacity
                    plannerItems={plannerItems}
                    sprints={sprints}
                    selectedQuarter={selectedQuarter}
                    activeDragPreview={activeDragPreview}
                    isVisible={plannerUI.capacityOpen}
                  />
                </div>

                {/* People drawer — still flex sibling; replaced by PlannerTeamDrawer overlay in Phase 3 */}
                {plannerUI.teamDrawerOpen && (
                  <PlannerPeopleDrawer selectedQuarter={selectedQuarter} />
                )}
              </div>

              {/* Backlog overlay — absolute-positioned within the relative canvas anchor */}
              {plannerUI.backlogOpen && (
                <PlannerBacklog
                  jiraItems={jiraItems}
                  plannerItems={plannerItems}
                  onClose={() => toggleUI('backlogOpen')}
                />
              )}
            </DndContext>
          )}
        </div>
      </div>

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
      {hasFilters && plannerUI.activeMode === 'timeline' && (
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
