import { useMemo, useState } from 'react';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { AssignPanel } from '../components/planner/AssignPanel';
import { CreateItemModal, type CreateItemData } from '../components/planner/CreateItemModal';
import { PlannerBacklog } from '../components/planner/PlannerBacklog';
import { PlannerDetailPanel } from '../components/planner/PlannerDetailPanel';
import { PlannerTimeline } from '../components/planner/PlannerTimeline';
import { DeliveryBreakdownPanel } from '../components/planning/DeliveryBreakdownPanel';
import { PlanningHeaderActionMenu } from '../components/planning/PlanningHeaderActionMenu';
import { PlanningLensHeader } from '../components/planning/PlanningLensHeader';
import { PLANNING_PAGE_SURFACE_CLASS } from '../components/planning/planningShell';
import {
  createScenario,
  deleteScenario,
  duplicateScenario,
  generateId,
  generateJiraId,
  removeJiraItemBizAssignment,
  switchScenario,
  updateJiraWorkItemAssignee,
  updatePlannerLayoutForCurrentContext,
  updateScenario,
  upsertJiraItemBizAssignment,
} from '../stores/actions';
import {
  useActiveScenario,
  useActiveScenarioId,
  useAppStore,
  useCurrentState,
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

function hasImportedBreakdown(epicKey: string, jiraItems: Array<{ parentKey?: string | null }>): boolean {
  return jiraItems.some((item) => item.parentKey === epicKey);
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

  const [assignPanelItemId, setAssignPanelItemId] = useState<string | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [capacityPanelOpen, setCapacityPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'summary'>('timeline');
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

  const breakdownMissingEpicKeys = useMemo(
    () => new Set(
      jiraItems
        .filter((item) => item.type === 'epic')
        .filter((item) => !hasImportedBreakdown(item.jiraKey, jiraItems))
        .map((item) => item.jiraKey),
    ),
    [jiraItems],
  );

  const carryoverEpicKeys = useMemo(() => {
    const currentSprintNumber = visibleSprints.find((sprint) => {
      if (!sprint.startDate || !sprint.endDate) return false;
      const now = new Date();
      return new Date(sprint.startDate) <= now && now <= new Date(sprint.endDate);
    })?.number;

    if (!currentSprintNumber) return new Set<string>();

    return new Set(
      plannerItems
        .filter((item) => item.type === 'epic' && item.jiraKey)
        .filter((item) => item.startSprint < currentSprintNumber && item.startSprint + item.spanSprints - 1 >= currentSprintNumber)
        .map((item) => item.jiraKey!),
    );
  }, [plannerItems, visibleSprints]);

  const assignedJiraIds = useMemo(
    () => new Set(
      plannerItems
        .filter((item) => !item.isManual)
        .map((item) => item.sourceId),
    ),
    [plannerItems],
  );

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

  const handleAssignItOwner = (workItemId: string, memberId: string | null) => {
    updateJiraWorkItemAssignee(workItemId, memberId);
  };

  const handleAssignBizOwner = (jiraKey: string, contactId: string | null) => {
    const existingAssignments = (planningState.jiraItemBizAssignments ?? []).filter((assignment) => assignment.jiraKey === jiraKey);
    existingAssignments.forEach((assignment) => removeJiraItemBizAssignment(assignment.id));

    if (contactId) {
      upsertJiraItemBizAssignment({ jiraKey, contactId });
    }
  };

  return (
    <div className={`flex h-full flex-col ${PLANNING_PAGE_SURFACE_CLASS}`}>
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
        showSaveState
      />

      <div className="border-b border-[#E2E8F0] bg-white px-6">
        <div className="flex h-10 items-stretch">
          <button
            type="button"
            className={[
              'flex items-center border-b-2 px-4 text-sm font-medium transition-colors',
              activeTab === 'timeline'
                ? 'border-[#0089DD] text-[#0089DD]'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B]',
            ].join(' ')}
            onClick={() => setActiveTab('timeline')}
            aria-pressed={activeTab === 'timeline'}
          >
            Timeline
          </button>
          <button
            type="button"
            className={[
              'flex items-center border-b-2 px-4 text-sm font-medium transition-colors',
              activeTab === 'summary'
                ? 'border-[#0089DD] text-[#0089DD]'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B]',
            ].join(' ')}
            onClick={() => setActiveTab('summary')}
            aria-pressed={activeTab === 'summary'}
          >
            Summary
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab === 'timeline' ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter}>
            <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)]">
              <section className="min-h-0 overflow-hidden border-r border-[#E2E8F0] bg-white">
                <PlannerBacklog
                  jiraItems={jiraItems}
                  plannerItems={plannerItems}
                  expanded
                  variant="embedded"
                  onExpand={() => {}}
                  onCollapse={() => {}}
                  onBulkSchedule={(items) => scheduleImportedItemsAtSprint(items, visibleSprints[0]?.number ?? 1)}
                />
              </section>

              <section className="min-h-0 overflow-hidden bg-white">
                <div className="border-b border-[#E2E8F0] px-6 py-4">
                  <h2 className="text-base font-semibold text-[#1E293B]">Delivery Timeline</h2>
                  <p className="mt-1 text-sm text-[#64748B]">
                    Jira-backed work and planning-only items share one sprint plan, while hierarchy and readiness stay explicit.
                  </p>
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
                  breakdownMissingEpicKeys={breakdownMissingEpicKeys}
                  carryoverEpicKeys={carryoverEpicKeys}
                />
              </section>
            </div>
          </DndContext>
        ) : (
          <div className="h-full overflow-y-auto bg-white">
            <DeliveryBreakdownPanel
              epicItems={jiraItems.filter((item) => item.type === 'epic')}
              allItems={jiraItems}
              assignedJiraIds={assignedJiraIds}
              businessAssignments={planningState.jiraItemBizAssignments ?? []}
              teamMembers={planningState.teamMembers ?? []}
              businessContacts={planningState.businessContacts ?? []}
              onAssignItOwner={handleAssignItOwner}
              onAssignBizOwner={handleAssignBizOwner}
            />
          </div>
        )}

        {activeTab === 'timeline' && detailItemId ? (
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

      {activeTab === 'timeline' && activeAssignItem ? (
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
