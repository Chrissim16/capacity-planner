import { useCallback, useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { CalendarRange } from 'lucide-react';
import { CapacityBacklog } from '../components/capacity/CapacityBacklog';
import { CapacityRequestCard, type CapacityBacklogItem, type CapacityJiraItemMeta } from '../components/capacity/CapacityRequestCard';
import { CapacitySprintGrid } from '../components/capacity/CapacitySprintGrid';
import { DeliveryBreakdownPanel } from '../components/planning/DeliveryBreakdownPanel';
import { PlanningLensHeader } from '../components/planning/PlanningLensHeader';
import { Button } from '../components/ui/Button';
import {
  addCapacityAssignment,
  addCapacityRequest,
  createScenario,
  deleteScenario,
  duplicateScenario,
  removeCapacityAssignment,
  removeCapacityRequest,
  removeJiraItemBizAssignment,
  switchScenario,
  updateJiraWorkItemAssignee,
  updateScenario,
  upsertJiraItemBizAssignment,
} from '../stores/actions';
import { useActiveScenario, useActiveScenarioId, useAppStore, useCurrentState, useScenarios } from '../stores/appStore';
import { usePortfolioPlan } from '../hooks/usePortfolioPlan';

function estimateItemDays(entry: CapacityBacklogItem): number {
  return entry.kind === 'request'
    ? entry.item.estimatedDays
    : (entry.item.originalEstimate ?? entry.item.storyPoints ?? 1);
}

export function ScenarioPlanner() {
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const planningState = useCurrentState();
  const activeScenario = useActiveScenario();
  const activeScenarioId = useActiveScenarioId();
  const scenarios = useScenarios();
  const portfolioPlan = usePortfolioPlan();
  const [activeEntry, setActiveEntry] = useState<CapacityBacklogItem | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ memberId: string; sprintId: string; entry: CapacityBacklogItem } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'portfolio' | 'current-plan' | 'staffing-risk' | 'external' | 'has-breakdown' | 'missing-breakdown'>('all');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visibleSprints = useMemo(
    () => (planningState.sprints ?? []).filter((sprint) => !sprint.isByeWeek).slice(0, Math.max(6, planningState.settings.sprintsToShow ?? 6)),
    [planningState.sprints, planningState.settings.sprintsToShow],
  );

  const teamMembers = useMemo(
    () => planningState.teamMembers.filter((member) => !member.excludedFromCapacity),
    [planningState.teamMembers],
  );
  const businessContacts = useMemo(
    () => planningState.businessContacts.filter((contact) => !contact.archived && !contact.excludedFromCapacity),
    [planningState.businessContacts],
  );
  const portfolioBoardSet = useMemo(
    () => new Set(activeScenario?.portfolioBoardEpicKeys ?? portfolioPlan.boardEpicKeys),
    [activeScenario?.portfolioBoardEpicKeys, portfolioPlan.boardEpicKeys],
  );

  const jiraItemByKey = useMemo(
    () => new Map(planningState.jiraWorkItems.map((item) => [item.jiraKey, item])),
    [planningState.jiraWorkItems],
  );
  const epicItems = useMemo(
    () => planningState.jiraWorkItems.filter((item) => item.type === 'epic'),
    [planningState.jiraWorkItems],
  );
  const externalMemberIds = useMemo(
    () => new Set(planningState.teamMembers.filter((member) => member.workerType === 'external').map((member) => member.id)),
    [planningState.teamMembers],
  );

  const resolveEpicKey = (item: { jiraKey: string; type: string; parentKey?: string }): string | null => {
    if (item.type === 'epic') return item.jiraKey;
    let currentParentKey = item.parentKey;
    while (currentParentKey) {
      const parent = jiraItemByKey.get(currentParentKey);
      if (!parent) return null;
      if (parent.type === 'epic') return parent.jiraKey;
      currentParentKey = parent.parentKey;
    }
    return null;
  };
  const hasItOwner = useCallback(
    (item: { assigneeEmail?: string; assigneeName?: string }) => Boolean(item.assigneeEmail || item.assigneeName),
    [],
  );

  const epicMeta = useMemo(() => {
    const byEpic = new Map<string, {
      epic: typeof epicItems[number];
      onPortfolioBoard: boolean;
      inCurrentPlan: boolean;
      staffingRisk: boolean;
      usesExternal: boolean;
      hasBreakdown: boolean;
    }>();

    for (const epic of epicItems) {
      byEpic.set(epic.jiraKey, {
        epic,
        onPortfolioBoard: portfolioBoardSet.has(epic.jiraKey),
        inCurrentPlan: false,
        staffingRisk: false,
        usesExternal: false,
        hasBreakdown: false,
      });
    }

    for (const item of planningState.jiraWorkItems) {
      const epicKey = resolveEpicKey(item);
      if (!epicKey) continue;
      const meta = byEpic.get(epicKey);
      if (!meta) continue;
      if (item.type === 'feature' || item.type === 'story' || item.type === 'task' || item.type === 'bug') {
        meta.hasBreakdown = true;
      }
      if (item.type !== 'epic' && (!hasItOwner(item) || !planningState.jiraItemBizAssignments.some((assignment) => assignment.jiraKey === item.jiraKey))) {
        meta.staffingRisk = true;
      }
    }

    for (const assignment of planningState.capacityAssignments ?? []) {
      const sourceItem = assignment.jiraItemId
        ? planningState.jiraWorkItems.find((item) => item.id === assignment.jiraItemId)
        : null;
      const epicKey = sourceItem ? resolveEpicKey(sourceItem) : null;
      if (!epicKey) continue;
      const meta = byEpic.get(epicKey);
      if (!meta) continue;
      meta.inCurrentPlan = true;
      if (externalMemberIds.has(assignment.memberId)) {
        meta.usesExternal = true;
      }
    }

    return byEpic;
  }, [
    epicItems,
    externalMemberIds,
    hasItOwner,
    planningState.capacityAssignments,
    planningState.jiraItemBizAssignments,
    planningState.jiraWorkItems,
    portfolioBoardSet,
  ]);

  const epicMatchesFilter = (epicKey: string) => {
    const meta = epicMeta.get(epicKey);
    if (!meta) return activeFilter === 'all';
    if (activeFilter === 'all') return true;
    if (activeFilter === 'portfolio') return meta.onPortfolioBoard;
    if (activeFilter === 'current-plan') return meta.inCurrentPlan;
    if (activeFilter === 'staffing-risk') return meta.staffingRisk;
    if (activeFilter === 'external') return meta.usesExternal;
    if (activeFilter === 'has-breakdown') return meta.hasBreakdown;
    if (activeFilter === 'missing-breakdown') return !meta.hasBreakdown;
    return true;
  };

  const filteredEpicVisibility = useMemo(
    () => epicItems.filter((epic) => epicMatchesFilter(epic.jiraKey)),
    [epicItems, activeFilter, epicMeta],
  );

  const filterCounts = useMemo(() => ({
    all: epicItems.length,
    portfolio: epicItems.filter((epic) => epicMeta.get(epic.jiraKey)?.onPortfolioBoard).length,
    'current-plan': epicItems.filter((epic) => epicMeta.get(epic.jiraKey)?.inCurrentPlan).length,
    'staffing-risk': epicItems.filter((epic) => epicMeta.get(epic.jiraKey)?.staffingRisk).length,
    external: epicItems.filter((epic) => epicMeta.get(epic.jiraKey)?.usesExternal).length,
    'has-breakdown': epicItems.filter((epic) => epicMeta.get(epic.jiraKey)?.hasBreakdown).length,
    'missing-breakdown': epicItems.filter((epic) => !epicMeta.get(epic.jiraKey)?.hasBreakdown).length,
  }), [epicItems, epicMeta]);

  const jiraItemMetaById = useMemo(() => {
    const metaMap = new Map<string, CapacityJiraItemMeta>();
    for (const item of planningState.jiraWorkItems) {
      if (item.type === 'epic') continue;
      const epicKey = resolveEpicKey(item);
      const meta = epicKey ? epicMeta.get(epicKey) : null;
      metaMap.set(item.id, {
        epicKey: epicKey ?? undefined,
        epicSummary: meta?.epic.summary,
        onPortfolioBoard: meta?.onPortfolioBoard,
        staffingRisk: meta?.staffingRisk,
        usesExternal: meta?.usesExternal,
      });
    }
    return metaMap;
  }, [epicMeta, planningState.jiraWorkItems]);

  const assignedJiraIds = useMemo(
    () => new Set(
      (planningState.capacityAssignments ?? [])
        .map((assignment) => assignment.jiraItemId)
        .filter((jiraItemId): jiraItemId is string => Boolean(jiraItemId)),
    ),
    [planningState.capacityAssignments],
  );
  const assignedRequestIds = useMemo(
    () => new Set(
      (planningState.capacityAssignments ?? [])
        .map((assignment) => assignment.capacityRequestId)
        .filter((capacityRequestId): capacityRequestId is string => Boolean(capacityRequestId)),
    ),
    [planningState.capacityAssignments],
  );

  const backlogJiraItems = useMemo(
    () =>
      planningState.jiraWorkItems.filter((item) =>
        item.statusCategory !== 'done' &&
        ['feature', 'story', 'task', 'bug'].includes(item.type) &&
        !assignedJiraIds.has(item.id) &&
        epicMatchesFilter(resolveEpicKey(item) ?? ''),
      ),
    [planningState.jiraWorkItems, assignedJiraIds, activeFilter, epicMeta],
  );

  const backlogRequests = useMemo(
    () => (planningState.capacityRequests ?? []).filter((request) => !assignedRequestIds.has(request.id)),
    [planningState.capacityRequests, assignedRequestIds],
  );

  const getEntryByDragId = (dragId: string): CapacityBacklogItem | null => {
    const [kind, rawId] = dragId.split(':');
    if (kind === 'jira') {
      const item = backlogJiraItems.find((candidate) => candidate.id === rawId)
        ?? planningState.jiraWorkItems.find((candidate) => candidate.id === rawId);
      return item ? { kind: 'jira', item } : null;
    }
    if (kind === 'request') {
      const item = (planningState.capacityRequests ?? []).find((candidate) => candidate.id === rawId);
      return item ? { kind: 'request', item } : null;
    }
    return null;
  };

  const getSourceItem = (assignment: NonNullable<typeof planningState.capacityAssignments>[number]): CapacityBacklogItem | null => {
    if (assignment.jiraItemId) {
      const item = planningState.jiraWorkItems.find((candidate) => candidate.id === assignment.jiraItemId);
      return item ? { kind: 'jira', item } : null;
    }
    if (assignment.capacityRequestId) {
      const item = (planningState.capacityRequests ?? []).find((candidate) => candidate.id === assignment.capacityRequestId);
      return item ? { kind: 'request', item } : null;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const dragId = String(event.active.id);
    setActiveEntry(getEntryByDragId(dragId));
    setPendingDrop(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const entry = getEntryByDragId(String(event.active.id));
    setActiveEntry(null);
    if (!entry || !event.over) {
      setPendingDrop(null);
      return;
    }

    const [memberId, sprintId] = String(event.over.id).split('::');
    if (!memberId || !sprintId) {
      setPendingDrop(null);
      return;
    }

    setPendingDrop({ memberId, sprintId, entry });
  };

  const handleConfirmAssign = (entry: CapacityBacklogItem, memberId: string, sprintId: string) => {
    addCapacityAssignment({
      memberId,
      sprintId,
      jiraItemId: entry.kind === 'jira' ? entry.item.id : undefined,
      capacityRequestId: entry.kind === 'request' ? entry.item.id : undefined,
      estimatedDays: estimateItemDays(entry),
    });
    setPendingDrop(null);
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

  const handleAssignItOwner = useCallback((workItemId: string, memberId: string | null) => {
    updateJiraWorkItemAssignee(workItemId, memberId);
  }, []);

  const handleAssignBizOwner = useCallback((jiraKey: string, contactId: string | null) => {
    const existingAssignments = planningState.jiraItemBizAssignments.filter((assignment) => assignment.jiraKey === jiraKey);
    const primaryAssignment = existingAssignments[0] ?? null;

    if (!contactId) {
      if (primaryAssignment) removeJiraItemBizAssignment(primaryAssignment.id);
      return;
    }

    upsertJiraItemBizAssignment({
      id: primaryAssignment?.id,
      jiraKey,
      contactId,
      days: primaryAssignment?.days,
      notes: primaryAssignment?.notes,
    });
  }, [planningState.jiraItemBizAssignments]);

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      <PlanningLensHeader
        title="Delivery Planning"
        subtitle="Plan imported delivery breakdown first, then layer scenario-only what-if requests where Jira work does not exist yet."
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onSwitch={switchScenario}
        onCreate={handleCreateScenario}
        onDuplicate={handleDuplicateScenario}
        onRename={handleRenameScenario}
        onDelete={handleDeleteScenario}
        controls={(
          <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DEDFE3] bg-white px-2.5 text-xs font-medium text-[#64748B]">
            <CalendarRange size={13} />
            {visibleSprints.length} sprints
          </div>
        )}
        primaryAction={(
          <Button
            variant="primary"
            size="sm"
            className="h-8 rounded-md px-2.5 text-xs"
            onClick={() => setCurrentView('jira')}
          >
            Import Jira Breakdown
          </Button>
        )}
      />
      <div className="border-b border-[#DEDFE3] bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All epics' },
            { id: 'portfolio', label: 'On portfolio board' },
            { id: 'current-plan', label: 'In current plan' },
            { id: 'staffing-risk', label: 'Staffing risk' },
            { id: 'external', label: 'Uses external' },
            { id: 'has-breakdown', label: 'Has Jira breakdown' },
            { id: 'missing-breakdown', label: 'Missing Jira breakdown' },
          ].map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id as typeof activeFilter)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeFilter === filter.id
                  ? 'border-[#0089DD] bg-[#E6F2FC] text-[#0089DD]'
                  : 'border-[#DEDFE3] bg-white text-[#64748B] hover:border-[#BFDBFE] hover:text-[#1E293B]'
              }`}
            >
              {filter.label} · {filterCounts[filter.id as keyof typeof filterCounts]}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {filteredEpicVisibility.slice(0, 8).map((epic) => {
            const meta = epicMeta.get(epic.jiraKey);
            return (
              <div key={epic.id} className="rounded-xl border border-[#DEDFE3] bg-[#F8FAFC] px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[#0089DD]">{epic.jiraKey}</span>
                  <span className={`rounded-full px-2 py-0.5 ${
                    meta?.hasBreakdown ? 'bg-[#ECFDF5] text-[#047857]' : 'bg-[#FFF7ED] text-[#C2410C]'
                  }`}>
                    {meta?.hasBreakdown ? 'Has breakdown' : 'Missing breakdown'}
                  </span>
                </div>
                <p className="mt-1 max-w-[260px] truncate text-sm font-medium text-[#1E293B]">{epic.summary}</p>
              </div>
            );
          })}
          {filteredEpicVisibility.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No epics match this filter.</p>
          ) : null}
          {filteredEpicVisibility.length > 8 ? (
            <div className="rounded-xl border border-dashed border-[#DEDFE3] px-3 py-2 text-sm text-[#94A3B8]">
              +{filteredEpicVisibility.length - 8} more epics
            </div>
          ) : null}
        </div>
      </div>
      <DeliveryBreakdownPanel
        epicItems={filteredEpicVisibility}
        allItems={planningState.jiraWorkItems}
        assignedJiraIds={assignedJiraIds}
        businessAssignments={planningState.jiraItemBizAssignments ?? []}
        teamMembers={teamMembers}
        businessContacts={businessContacts}
        onAssignItOwner={handleAssignItOwner}
        onAssignBizOwner={handleAssignBizOwner}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-0 flex-1">
          <CapacityBacklog
            jiraItems={backlogJiraItems}
            requests={backlogRequests}
            sprints={visibleSprints}
            onAddRequest={addCapacityRequest}
            onRemoveRequest={removeCapacityRequest}
            jiraItemMetaById={jiraItemMetaById}
          />
          <CapacitySprintGrid
            teamMembers={teamMembers}
            sprints={visibleSprints}
            assignments={planningState.capacityAssignments ?? []}
            getSourceItem={getSourceItem}
            onAssign={(entry, memberId, sprintId) => handleConfirmAssign(entry, memberId, sprintId)}
            onRemoveAssignment={removeCapacityAssignment}
            pendingDrop={pendingDrop}
          />
        </div>

        <DragOverlay>
          {activeEntry ? <CapacityRequestCard entry={activeEntry} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
