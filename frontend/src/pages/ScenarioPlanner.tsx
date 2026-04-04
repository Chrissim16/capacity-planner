import { useMemo, useState } from 'react';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CalendarRange, CheckCircle2, Layers3, ShieldAlert, Sparkles, WifiOff, Workflow } from 'lucide-react';
import { AssignPanel } from '../components/planner/AssignPanel';
import { CreateItemModal, type CreateItemData } from '../components/planner/CreateItemModal';
import { PlannerBacklog } from '../components/planner/PlannerBacklog';
import { PlannerDetailPanel } from '../components/planner/PlannerDetailPanel';
import { PlannerTimeline } from '../components/planner/PlannerTimeline';
import { PlanningHeaderActionMenu } from '../components/planning/PlanningHeaderActionMenu';
import { PlanningLensHeader } from '../components/planning/PlanningLensHeader';
import {
  createScenario,
  deleteScenario,
  duplicateScenario,
  generateId,
  generateJiraId,
  switchScenario,
  updatePlannerLayoutForCurrentContext,
  updateScenario,
} from '../stores/actions';
import {
  useActiveScenario,
  useActiveScenarioId,
  useAppStore,
  useCurrentState,
  useSyncStatus,
} from '../stores/appStore';
import type { PlannerItem, PlannerItemType, PlannerAssignment, Scenario } from '../types';
import { migratePlannerLayout } from '../utils/plannerMigration';
import { resolveItemAssignees } from '../utils/plannerInit';
import { useShallow } from 'zustand/react/shallow';

const TYPE_SPAN: Record<PlannerItemType, number> = {
  epic: 6,
  feature: 2,
  story: 1,
  task: 1,
  bug: 1,
  uat: 1,
  hypercare: 1,
};

function defaultSpan(type: PlannerItemType): number {
  return TYPE_SPAN[type] ?? 1;
}

function hasOwnerOnTrack(item: PlannerItem, track: PlannerAssignment['track']): boolean {
  return item.assignees.some((assignee) => assignee.track === track);
}

function saveStateLabel(status: ReturnType<typeof useSyncStatus>['status']): string {
  if (status === 'offline') return 'Local only';
  if (status === 'saving') return 'Saving';
  if (status === 'error') return 'Not saved';
  return 'Saved';
}

function saveStateTone(status: ReturnType<typeof useSyncStatus>['status']): string {
  if (status === 'offline') return 'border-[#DEDFE3] bg-white text-[#94A3B8]';
  if (status === 'saving') return 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]';
  if (status === 'error') return 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]';
  return 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]';
}

export function ScenarioPlanner() {
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const baselineScenario = useAppStore((state) => state.data.scenarios.find((scenario) => scenario.isBaseline) ?? null);
  const planningState = useCurrentState();
  const activeScenario = useActiveScenario();
  const activeScenarioId = useActiveScenarioId();
  const scenarios = useAppStore(useShallow((state) =>
    state.data.scenarios.filter((scenario) => !scenario.archived && !scenario.isBaseline),
  ));
  const sync = useSyncStatus();

  const [assignPanelItemId, setAssignPanelItemId] = useState<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [capacityPanelOpen, setCapacityPanelOpen] = useState(true);
  const [createModalState, setCreateModalState] = useState<{
    defaultType: PlannerItemType;
    defaultParentKey?: string;
  } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const scenarioForPlanner: Scenario | null = activeScenario ?? baselineScenario;
  const plannerItems = useMemo(
    () => migratePlannerLayout(scenarioForPlanner?.plannerLayout ?? []),
    [scenarioForPlanner?.plannerLayout],
  );
  const jiraItems = useMemo(
    () => planningState.jiraWorkItems.filter((item) => item.statusCategory !== 'done'),
    [planningState.jiraWorkItems],
  );
  const visibleSprints = useMemo(
    () => (planningState.sprints ?? []).filter((sprint) => !sprint.isByeWeek),
    [planningState.sprints],
  );
  const selectedQuarter = useMemo(() => {
    const now = new Date();
    const currentSprint = visibleSprints.find((sprint) => {
      if (!sprint.startDate || !sprint.endDate) return false;
      return new Date(sprint.startDate) <= now && now <= new Date(sprint.endDate);
    });
    return currentSprint?.quarter ?? visibleSprints[0]?.quarter ?? planningState.quarters[0] ?? 'Q1 2026';
  }, [planningState.quarters, visibleSprints]);

  const plannerItemsById = useMemo(
    () => new Map(plannerItems.map((item) => [item.id, item])),
    [plannerItems],
  );
  const parentCandidates = useMemo(() => {
    const seen = new Set<string>();
    const candidates: Array<{ key: string; label: string; type: PlannerItemType }> = [];

    for (const item of jiraItems) {
      if (item.type !== 'epic' && item.type !== 'feature') continue;
      if (seen.has(item.jiraKey)) continue;
      seen.add(item.jiraKey);
      candidates.push({
        key: item.jiraKey,
        label: `${item.jiraKey}: ${item.summary}`,
        type: item.type as PlannerItemType,
      });
    }

    for (const item of plannerItems) {
      if (!item.jiraKey || (item.type !== 'epic' && item.type !== 'feature')) continue;
      if (seen.has(item.jiraKey)) continue;
      seen.add(item.jiraKey);
      candidates.push({
        key: item.jiraKey,
        label: `${item.jiraKey}: ${item.name}${item.isManual ? ' (Planning only)' : ''}`,
        type: item.type,
      });
    }

    return candidates;
  }, [jiraItems, plannerItems]);

  const onItemsChange = (items: PlannerItem[]) => {
    updatePlannerLayoutForCurrentContext(items);

    if (assignPanelItemId && !items.some((item) => item.id === assignPanelItemId)) {
      setAssignPanelItemId(null);
    }
    if (detailItemId && !items.some((item) => item.id === detailItemId || item.jiraKey === detailItemId)) {
      setDetailItemId(null);
    }
  };

  const handleCreateScenario = (name: string) => {
    createScenario(name);
  };

  const handleDuplicateScenario = (scenarioId: string | null, name: string) => {
    const sourceId = scenarioId ?? activeScenarioId;
    if (!sourceId) {
      const created = createScenario(name);
      switchScenario(created.id);
      return;
    }
    const duplicated = duplicateScenario(sourceId, name);
    if (duplicated) switchScenario(duplicated.id);
  };

  const handleRenameScenario = (scenarioId: string, name: string) => {
    updateScenario(scenarioId, { name });
  };

  const handleDeleteScenario = (scenarioId: string) => {
    deleteScenario(scenarioId);
  };

  const scheduleImportedItemsAtSprint = (itemsToSchedule: typeof jiraItems, targetSprint: number) => {
    const byJiraKey = new Map(jiraItems.map((item) => [item.jiraKey, item]));
    const nextItems = [...plannerItems];
    const scheduledJiraKeys = new Set(plannerItems.map((item) => item.jiraKey).filter(Boolean));
    const addedJiraKeys = new Set<string>();

    const pushJiraItem = (jiraItem: (typeof jiraItems)[number], startSprint: number) => {
      if (scheduledJiraKeys.has(jiraItem.jiraKey) || addedJiraKeys.has(jiraItem.jiraKey)) return;
      nextItems.push({
        id: generateId('planner'),
        sourceId: jiraItem.id,
        name: jiraItem.summary,
        type: jiraItem.type as PlannerItemType,
        jiraKey: jiraItem.jiraKey,
        parentKey: jiraItem.parentKey,
        startSprint,
        spanSprints: defaultSpan(jiraItem.type as PlannerItemType),
        assignees: resolveItemAssignees(
          jiraItem,
          planningState.teamMembers ?? [],
          planningState.jiraItemBizAssignments ?? [],
        ),
        isManual: false,
        labels: jiraItem.labels ?? [],
        jiraAssignees: jiraItem.assigneeName ? [jiraItem.assigneeName] : [],
        jiraStartDate: jiraItem.startDate,
        jiraEndDate: jiraItem.dueDate,
        requiredSkillIds: [],
      });
      addedJiraKeys.add(jiraItem.jiraKey);
    };

    for (const jiraItem of itemsToSchedule) {
      if (jiraItem.type === 'epic') {
        pushJiraItem(jiraItem, targetSprint);
        const featureItems = jiraItems.filter((item) => item.parentKey === jiraItem.jiraKey && item.type === 'feature');
        for (const feature of featureItems) {
          pushJiraItem(feature, targetSprint);
          const storyItems = jiraItems.filter((item) => item.parentKey === feature.jiraKey);
          for (const story of storyItems) {
            pushJiraItem(story, targetSprint);
          }
        }
        const directLeaves = jiraItems.filter((item) => item.parentKey === jiraItem.jiraKey && item.type !== 'feature');
        for (const leaf of directLeaves) pushJiraItem(leaf, targetSprint);
        continue;
      }

      pushJiraItem(jiraItem, targetSprint);

      if (jiraItem.parentKey && !scheduledJiraKeys.has(jiraItem.parentKey) && !addedJiraKeys.has(jiraItem.parentKey)) {
        const parent = byJiraKey.get(jiraItem.parentKey);
        if (parent) {
          pushJiraItem(parent, targetSprint);
          if (parent.parentKey && !scheduledJiraKeys.has(parent.parentKey) && !addedJiraKeys.has(parent.parentKey)) {
            const grandparent = byJiraKey.get(parent.parentKey);
            if (grandparent) pushJiraItem(grandparent, targetSprint);
          }
        }
      }
    }

    onItemsChange(nextItems);
  };

  const handleSaveManualItem = (data: CreateItemData) => {
    const parentPlannerItem = data.parentKey
      ? plannerItems.find((item) => item.jiraKey === data.parentKey) ?? null
      : null;
    const parentJiraItem = data.parentKey
      ? jiraItems.find((item) => item.jiraKey === data.parentKey) ?? null
      : null;
    const parentSprintFromJira = parentJiraItem?.sprintName
      ? visibleSprints.find((sprint) => sprint.name === parentJiraItem.sprintName)?.number
      : undefined;
    const anchorSprint = parentPlannerItem?.startSprint
      ?? parentSprintFromJira
      ?? visibleSprints[0]?.number
      ?? 1;

    const plannerId = generateId('planner');
    const keyPrefix = data.type === 'epic' ? 'PLAN' : data.type === 'feature' ? 'PLANF' : 'PLANS';
    const manualItem: PlannerItem = {
      id: plannerId,
      sourceId: plannerId,
      name: data.name,
      type: data.type,
      jiraKey: generateJiraId(keyPrefix),
      parentKey: data.parentKey,
      startSprint: anchorSprint,
      spanSprints: defaultSpan(data.type),
      assignees: [],
      isManual: true,
      labels: data.labels,
      jiraAssignees: [],
      requiredSkillIds: data.requiredSkillIds,
    };

    onItemsChange([...plannerItems, manualItem]);
    setCreateModalState(null);
    setDetailItemId(null);
    setAssignPanelItemId(plannerId);
  };

  const handleAssignSave = (itemId: string, assignees: PlannerAssignment[]) => {
    onItemsChange(
      plannerItems.map((item) =>
        item.id === itemId
          ? { ...item, assignees }
          : item,
      ),
    );
  };

  const handleUpdateRequiredSkills = (itemId: string, skillIds: string[]) => {
    onItemsChange(
      plannerItems.map((item) =>
        item.id === itemId
          ? { ...item, requiredSkillIds: skillIds }
          : item,
      ),
    );
  };

  const activeAssignItem = assignPanelItemId ? plannerItemsById.get(assignPanelItemId) ?? null : null;

  const summary = useMemo(() => {
    const scheduledSourceIds = new Set(plannerItems.map((item) => item.sourceId));
    const importedBacklogCount = jiraItems.filter((item) => !scheduledSourceIds.has(item.id)).length;
    const scheduledEpicCount = plannerItems.filter((item) => item.type === 'epic').length;
    const planningOnlyCount = plannerItems.filter((item) => item.isManual).length;
    const staffingRiskCount = plannerItems.filter(
      (item) => !hasOwnerOnTrack(item, 'IT') || !hasOwnerOnTrack(item, 'BIZ'),
    ).length;
    const missingBreakdownCount = jiraItems.filter((item) => {
      if (item.type !== 'epic') return false;
      return !jiraItems.some((candidate) => candidate.parentKey === item.jiraKey);
    }).length;

    return {
      importedBacklogCount,
      scheduledEpicCount,
      planningOnlyCount,
      staffingRiskCount,
      missingBreakdownCount,
    };
  }, [jiraItems, plannerItems]);

  const scenarioSummary = useMemo(() => {
    const importedFeatures = jiraItems.filter((item) => item.type === 'feature').length;
    const importedStories = jiraItems.filter((item) => item.type === 'story' || item.type === 'task' || item.type === 'bug').length;
    const plannedItems = plannerItems.length;
    const manualItems = plannerItems.filter((item) => item.isManual).length;
    return {
      importedFeatures,
      importedStories,
      plannedItems,
      manualItems,
    };
  }, [jiraItems, plannerItems]);

  const addWorkMenu = (
    <PlanningHeaderActionMenu
      label="Add Work"
      items={[
        { label: 'Import Jira Breakdown', onSelect: () => setCurrentView('jira') },
        { label: 'Create Manual Epic', onSelect: () => setCreateModalState({ defaultType: 'epic' }) },
        { label: 'Create Manual Feature', onSelect: () => setCreateModalState({ defaultType: 'feature' }) },
        { label: 'Create Manual Story', onSelect: () => setCreateModalState({ defaultType: 'story' }) },
      ]}
      className="border-[#0089DD] bg-[#0089DD] text-white hover:bg-[#0077C2] hover:text-white"
    />
  );

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      <PlanningLensHeader
        title="Delivery Planning"
        subtitle="Plan feature and story delivery capacity after Jira breakdown and approval."
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onSwitch={switchScenario}
        onCreate={handleCreateScenario}
        onDuplicate={handleDuplicateScenario}
        onRename={handleRenameScenario}
        onDelete={handleDeleteScenario}
        primaryAction={addWorkMenu}
        showSaveState={false}
      />

      <div className="border-b border-[#DEDFE3] bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${saveStateTone(sync.status)}`}>
            {sync.status === 'offline' ? <WifiOff size={13} /> : <CheckCircle2 size={13} />}
            {saveStateLabel(sync.status)}
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DEDFE3] bg-white px-2.5 text-xs font-medium text-[#64748B]">
            <CalendarRange size={13} />
            {visibleSprints.length} delivery sprints
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DEDFE3] bg-white px-2.5 text-xs font-medium text-[#64748B]">
            <Workflow size={13} />
            {summary.importedBacklogCount} imported items unscheduled
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DEDFE3] bg-white px-2.5 text-xs font-medium text-[#64748B]">
            <Layers3 size={13} />
            {summary.scheduledEpicCount} epics on plan
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E0E7FF] bg-[#F8FAFF] px-2.5 text-xs font-medium text-[#4338CA]">
            {summary.planningOnlyCount} planning-only items
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#FED7AA] bg-[#FFF7ED] px-2.5 text-xs font-medium text-[#C2410C]">
            {summary.staffingRiskCount} items need staffing
          </span>
          {summary.missingBreakdownCount > 0 ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2.5 text-xs font-medium text-[#B45309]">
              {summary.missingBreakdownCount} epics still need Jira breakdown
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[#E0E7FF] bg-[#F8FAFF] px-4 py-3 text-sm text-[#475569]">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-[#4F46E5]" />
          <p>
            Imported Jira work stays in the backlog until scheduled. Manual items land on the plan immediately and are marked as planning-only so they stay distinct from Jira reality.
          </p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden p-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter}>
          <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)_280px] gap-6">
            <div className="min-h-0 overflow-hidden rounded-[28px] border border-[#DEDFE3] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <PlannerBacklog
                jiraItems={jiraItems}
                plannerItems={plannerItems}
                expanded
                variant="embedded"
                onExpand={() => {}}
                onCollapse={() => {}}
                onBulkSchedule={(items) => scheduleImportedItemsAtSprint(items, visibleSprints[0]?.number ?? 1)}
              />
            </div>

            <div className="min-h-0 overflow-hidden rounded-[32px] border border-[#D9E2EC] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="border-b border-[#EEF2F7] px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-[#1E293B]">Imported Delivery Breakdown</h2>
                    <p className="mt-1 text-sm text-[#64748B]">
                      Capacity planning happens on imported features and stories, with both IT and business assignments.
                    </p>
                  </div>
                  <div className="inline-flex rounded-full border border-[#DEDFE3] bg-[#F8FAFC] p-1 text-xs font-medium text-[#64748B]">
                    <span className="rounded-full bg-white px-3 py-1 text-[#0F172A] shadow-sm">Timeline</span>
                    <span className="px-3 py-1">Summary</span>
                  </div>
                </div>
              </div>

              <PlannerTimeline
                plannerItems={plannerItems}
                jiraItems={jiraItems}
                sprints={visibleSprints}
                scenarioId={activeScenarioId ?? 'baseline'}
                onItemsChange={onItemsChange}
                onBarClick={(item) => {
                  setDetailItemId(null);
                  setAssignPanelItemId(item.id);
                }}
                onOpenAssignFromLabel={(item) => {
                  setDetailItemId(null);
                  setAssignPanelItemId(item.id);
                }}
                assignPanelItemId={assignPanelItemId}
                onAddChild={(parentItem) => setCreateModalState({
                  defaultType: parentItem.type === 'epic' ? 'feature' : 'story',
                  defaultParentKey: parentItem.jiraKey,
                })}
                onLabelClick={(item) => {
                  setAssignPanelItemId(null);
                  setDetailItemId(item.jiraKey ?? item.id);
                }}
                capacityPanelOpen={capacityPanelOpen}
                onCapacityPanelToggle={() => setCapacityPanelOpen((value) => !value)}
                onOverloadedTickerClick={() => setCapacityPanelOpen(true)}
                onBacklogItemScheduled={() => {}}
                onBarUnscheduledToBacklog={() => {}}
                skillsMatchingEnabled={scenarioForPlanner?.skillsMatchingEnabled ?? true}
              />
            </div>

            <aside className="flex min-h-0 flex-col gap-4">
              <div className="rounded-[28px] border border-[#DEDFE3] bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Scenario Summary</span>
                <h3 className="mt-2 text-lg font-semibold text-[#1E293B]">{activeScenario?.name ?? 'Baseline'}</h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748B]">Imported features</span>
                    <strong className="text-[#1E293B]">{scenarioSummary.importedFeatures}</strong>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748B]">Stories and tasks</span>
                    <strong className="text-[#1E293B]">{scenarioSummary.importedStories}</strong>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748B]">Items on plan</span>
                    <strong className="text-[#1E293B]">{scenarioSummary.plannedItems}</strong>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748B]">Planning-only items</span>
                    <strong className="text-[#4338CA]">{scenarioSummary.manualItems}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#DEDFE3] bg-white px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-2 text-[#B45309]">
                  <ShieldAlert size={16} />
                  <span className="text-sm font-semibold">Delivery Risks</span>
                </div>
                <div className="mt-4 space-y-3 text-sm text-[#475569]">
                  <div className="rounded-2xl bg-[#FFF7ED] px-3 py-3 text-[#9A3412]">
                    {summary.staffingRiskCount} planned items still miss either IT or business ownership.
                  </div>
                  <div className="rounded-2xl bg-[#F8FAFC] px-3 py-3">
                    {summary.importedBacklogCount} imported items are still unscheduled in this delivery scenario.
                  </div>
                  <div className="rounded-2xl bg-[#F8FAFC] px-3 py-3">
                    {summary.missingBreakdownCount > 0
                      ? `${summary.missingBreakdownCount} epics still need Jira feature or story breakdown before detailed delivery planning is complete.`
                      : 'All visible epics have delivery breakdown available for planning.'}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </DndContext>

        {detailItemId ? (
          <PlannerDetailPanel
            detailItemId={detailItemId}
            plannerItems={plannerItems}
            jiraItems={jiraItems}
            sprints={visibleSprints}
            onClose={() => setDetailItemId(null)}
            onUpdateRequiredSkills={handleUpdateRequiredSkills}
          />
        ) : null}
      </div>

      {activeAssignItem ? (
        <AssignPanel
          item={activeAssignItem}
          plannerItems={plannerItems}
          selectedQuarter={visibleSprints.find((sprint) => sprint.number === activeAssignItem.startSprint)?.quarter ?? selectedQuarter}
          jiraBaseUrl={planningState.jiraConnections[0]?.jiraBaseUrl ?? ''}
          jiraItems={jiraItems}
          onClose={() => setAssignPanelItemId(null)}
          onSave={handleAssignSave}
          skillsMatchingEnabled={scenarioForPlanner?.skillsMatchingEnabled ?? true}
        />
      ) : null}

      {createModalState ? (
        <CreateItemModal
          defaultType={createModalState.defaultType}
          defaultParentKey={createModalState.defaultParentKey}
          parentCandidates={parentCandidates}
          onSave={handleSaveManualItem}
          onClose={() => setCreateModalState(null)}
        />
      ) : null}
    </div>
  );
}
