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
import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { Loader2, BarChart2, Users, Plus, Filter, X } from 'lucide-react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useAppStore, useActiveScenarioId, useCurrentState, useSyncStatus } from '../stores/appStore';
import {
  createScenario,
  duplicateScenario,
  switchScenario,
  updatePlannerLayout,
  initBaselineScenario,
  generateId,
} from '../stores/actions';
import { getCurrentQuarter } from '../utils/calendar';
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

  return (
    <button
      onClick={() => void retrySyncToSupabase()}
      disabled={status === 'saving'}
      className={[
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
        status === 'saving'
          ? 'bg-mileway-blue-10 text-mileway-blue cursor-not-allowed'
          : 'bg-mileway-blue text-white hover:bg-[#0077C2]',
      ].join(' ')}
    >
      {status === 'saving' && <Loader2 size={14} className="animate-spin" />}
      {status === 'saving' ? 'Saving…' : 'Save'}
    </button>
  );
}

// ── ScenarioPlanner ───────────────────────────────────────────────────────────

export function ScenarioPlanner() {
  const [mode, setMode]               = useState<PlannerMode>('board');
  const [showCapacity, setShowCapacity] = useState(true);
  const [showPeople, setShowPeople]     = useState(false);
  const [activeDragPreview, setActiveDragPreview] = useState<DragPreview | null>(null);
  const [selectedQuarter]             = useState(getCurrentQuarter);
  const [baselineBanner, setBaselineBanner] = useState<{ placed: number; unscheduled: number } | null>(null);
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* 1200px minimum viewport notice */}
      <ViewportNotice />

      {/* Main page — hidden below 1200px */}
      <div className="hidden min-[1200px]:flex flex-col h-full bg-mileway-bg">

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white border-b border-mileway-border px-8 py-3 flex items-center gap-4">
          {/* Scenario tabs */}
          <ScenarioTabs
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onSelect={handleSelectScenario}
            onCreate={handleCreateScenario}
          />

          {/* SP-17: + Add Epic (Timeline mode only) */}
          {mode === 'timeline' && activeScenarioId && (
            <button
              onClick={() => setCreateModal({ defaultType: 'epic' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-mileway-blue bg-mileway-blue-10 hover:bg-mileway-blue hover:text-white transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
            >
              <Plus size={14} />
              Add Epic
            </button>
          )}

          {/* SP-20/21: Filters (Timeline mode only) */}
          {mode === 'timeline' && (
            <div className="flex items-center gap-2">
              {/* Label filter */}
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
                {allUniqueLabels.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>

              {/* Epic filter */}
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

              {/* Clear filters */}
              {hasFilters && (
                <button
                  onClick={() => { setFilterLabels([]); setFilterEpics([]); }}
                  title="Clear all filters"
                  className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Mode toggle */}
          <ModeToggle mode={mode} onChange={setMode} />

          {/* People drawer toggle — only relevant in Timeline mode */}
          {mode === 'timeline' && (
            <button
              onClick={() => setShowPeople(v => !v)}
              title={showPeople ? 'Hide people panel' : 'Show people panel'}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                showPeople
                  ? 'bg-mileway-blue-10 text-mileway-blue'
                  : 'text-mileway-grey hover:bg-mileway-bg',
              ].join(' ')}
            >
              <Users size={14} />
              People
            </button>
          )}

          {/* Capacity panel toggle */}
          <button
            onClick={() => setShowCapacity(v => !v)}
            title={showCapacity ? 'Hide capacity panel' : 'Show capacity panel'}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
              showCapacity
                ? 'bg-mileway-blue-10 text-mileway-blue'
                : 'text-mileway-grey hover:bg-mileway-bg',
            ].join(' ')}
          >
            <BarChart2 size={14} />
            Capacity
          </button>

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
        <div className="flex-1 overflow-hidden">

          {/* Board mode — natural scroll; capacity panel docked at the bottom */}
          {mode === 'board' && (
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
                isVisible={showCapacity}
              />
            </div>
          )}

          {/* Timeline mode — DndContext wraps backlog + gantt so they share one drag context */}
          {mode === 'timeline' && (
            <DndContext sensors={timelineSensors}>
              <div className="flex h-full">
                {/* Backlog sidebar */}
                <PlannerBacklog
                  jiraItems={jiraItems}
                  plannerItems={plannerItems}
                />

                {/* Gantt canvas — capacity panel is inside this column for column alignment */}
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
                    isVisible={showCapacity}
                  />
                </div>

                {/* People drawer — right side, collapsible (SP-10) */}
                {showPeople && (
                  <PlannerPeopleDrawer selectedQuarter={selectedQuarter} />
                )}
              </div>
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
      {hasFilters && mode === 'timeline' && (
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
