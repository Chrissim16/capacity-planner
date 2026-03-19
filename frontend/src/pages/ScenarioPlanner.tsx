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
import { useState, useCallback, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Loader2, BarChart2 } from 'lucide-react';
import { useAppStore, useActiveScenarioId, useSyncStatus } from '../stores/appStore';
import {
  createScenario,
  duplicateScenario,
  switchScenario,
  updatePlannerLayout,
} from '../stores/actions';
import { getCurrentQuarter } from '../utils/calendar';
import { ScenarioTabs } from '../components/planner/ScenarioTabs';
import { PlannerBacklog } from '../components/planner/PlannerBacklog';
import { PlannerTimeline, type DragPreview } from '../components/planner/PlannerTimeline';
import { PlannerCapacity } from '../components/planner/PlannerCapacity';
import type { PlannerItem } from '../types';

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
  const [activeDragPreview, setActiveDragPreview] = useState<DragPreview | null>(null);
  const [selectedQuarter]             = useState(getCurrentQuarter);

  const activeScenarioId = useActiveScenarioId();

  // Pull scenarios list + sprints from store
  const { scenarios, sprints, jiraItems, plannerItems } = useAppStore(
    useShallow(s => {
      const st = s.getCurrentState();
      const active = st.scenarios.find(sc => sc.id === s.data.activeScenarioId);
      return {
        scenarios: st.scenarios.filter(sc => !sc.isBaseline),
        sprints: st.sprints ?? [],
        jiraItems: st.jiraWorkItems ?? [],
        plannerItems: (active?.plannerLayout ?? []) as PlannerItem[],
      };
    })
  );

  // ── Scenario management ────────────────────────────────────────────────────

  const handleSelectScenario = useCallback((id: string) => {
    switchScenario(id);
  }, []);

  const handleCreateScenario = useCallback((name: string, startMode: 'clone' | 'blank') => {
    if (startMode === 'clone' && activeScenarioId) {
      const cloned = duplicateScenario(activeScenarioId, name);
      if (cloned) switchScenario(cloned.id);
    } else {
      // createScenario deep-copies jira items but leaves plannerLayout undefined
      // → backlog shows all items (blank canvas behaviour)
      createScenario(name);
    }
  }, [activeScenarioId]);

  // ── Layout mutations (forwarded from PlannerTimeline) ─────────────────────

  const handleItemsChange = useCallback((items: PlannerItem[]) => {
    if (!activeScenarioId) return;
    updatePlannerLayout(activeScenarioId, items);
  }, [activeScenarioId]);

  const handleActiveDragChange = useCallback((preview: DragPreview | null) => {
    setActiveDragPreview(preview);
  }, []);

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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Mode toggle */}
          <ModeToggle mode={mode} onChange={setMode} />

          {/* Capacity panel toggle (Timeline mode only) */}
          {mode === 'timeline' && (
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
          )}

          {/* Save */}
          <SaveButton />
        </div>

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">

          {/* Board mode */}
          {mode === 'board' && (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center h-full">
                  <Loader2 size={20} className="animate-spin text-mileway-grey" />
                </div>
              }
            >
              <PlannerBoard scenarioId={activeScenarioId ?? ''} />
            </Suspense>
          )}

          {/* Timeline mode */}
          {mode === 'timeline' && (
            <div className="flex flex-col h-full">
              <div className="flex flex-1 overflow-hidden">
                {/* Backlog sidebar */}
                <PlannerBacklog
                  jiraItems={jiraItems}
                  plannerItems={plannerItems}
                />

                {/* Gantt canvas */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {activeScenarioId ? (
                    <PlannerTimeline
                      plannerItems={plannerItems}
                      jiraItems={jiraItems}
                      sprints={sprints}
                      selectedQuarter={selectedQuarter}
                      scenarioId={activeScenarioId}
                      onItemsChange={handleItemsChange}
                      onActiveDragChange={handleActiveDragChange}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                      <p className="text-sm font-semibold text-mileway-text">No scenario selected</p>
                      <p className="text-xs text-mileway-grey max-w-xs leading-relaxed">
                        Create a scenario using the + button above to start planning on the timeline.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Capacity panel */}
              <PlannerCapacity
                plannerItems={plannerItems}
                sprints={sprints}
                selectedQuarter={selectedQuarter}
                activeDragPreview={activeDragPreview}
                isVisible={showCapacity}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
