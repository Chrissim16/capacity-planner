/**
 * PlannerBoard — Quarterly staffing board for Delivery Planning.
 *
 * Epic cards are full-width droppable targets — show fit-colour border during member drag.
 * Team member drag source is now PlannerTeamDrawer (passed as `overlays`), sharing this DndContext.
 * Bottom: SmartAssignmentPanel inline, shown when an epic is selected.
 *
 * BIZ contact drag is deferred to v2 (TODO-002). BIZ assignment via SmartAssignmentPanel only.
 * Fit scores are precomputed on dragStart — not recalculated on every dragOver.
 *
 * US-UI-13 · US-UI-15
 */
import { useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import {
  DndContext,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ArrowRight } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { addAssignment } from '../../stores/actions';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  scoreMember,
  FIT_COLOURS,
  type MemberFit,
} from '../../utils/staffing';
import { SmartAssignmentPanel } from '../SmartAssignmentPanel';
import { ProgressBar } from '../ui/ProgressBar';
import type { TeamMember, JiraWorkItem, PlannerItem } from '../../types';
import { calculateSprintCapacity, type SprintCapacityResult } from '../../utils/capacity';

// ── Props ─────────────────────────────────────────────────────────────────────

export type BoardSort = 'priority' | 'name' | 'assigned';

export interface PlannerBoardProps {
  scenarioId: string;
  /** Quarter string, e.g. "Q1 2026" — controlled by ScenarioPlanner */
  selectedQuarter: string;
  /** Sort order for the epic grid */
  sort: BoardSort;
  /** Called when the user clicks the details (→) button on an epic card */
  onOpenDetail?: (jiraKey: string) => void;
  /** Rendered inside this DndContext so overlays (e.g. PlannerTeamDrawer) share drag events */
  overlays?: ReactNode;
}

// ── Internal types ────────────────────────────────────────────────────────────

interface PendingDrop {
  memberId: string;
  memberName: string;
  projectKey: string;
  projectName: string;
  availableDays: number;
  suggestedDays: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_TEXT: Record<string, string> = {
  highest: 'text-util-over',
  high:    'text-util-over',
  medium:  'text-util-near',
  low:     'text-mileway-grey',
  lowest:  'text-mileway-grey',
};

function priorityBadge(priority?: string): { label: string; cls: string } | null {
  if (!priority) return null;
  const p = priority.toLowerCase();
  const labelMap: Record<string, string> = { highest: 'HIGHEST', high: 'HIGH', medium: 'MED', low: 'LOW', lowest: 'LOW' };
  return { label: labelMap[p] ?? priority.toUpperCase(), cls: PRIORITY_TEXT[p] ?? 'text-mileway-grey' };
}

function fmtSprintRange(start: string, end: string): string {
  const f = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(start)} – ${f(end)}`;
}

// ── EpicCard ──────────────────────────────────────────────────────────────────

interface EpicCardProps {
  epic: JiraWorkItem;
  featureCount: number;
  assignedDays: number;
  isSelected: boolean;
  fitLevel: MemberFit['fitLevel'] | null;
  isDraggingMember: boolean;
  onSelect: (key: string) => void;
  onOpenDetail?: (jiraKey: string) => void;
}

function EpicCard({ epic, featureCount, assignedDays, isSelected, fitLevel, isDraggingMember, onSelect, onOpenDetail }: EpicCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `epic-drop-${epic.jiraKey}`,
    data: { type: 'epic-card', jiraKey: epic.jiraKey },
  });

  const estimated = epic.storyPoints ?? epic.originalEstimate ?? 0;
  const pct = estimated > 0 ? Math.round((assignedDays / estimated) * 100) : 0;
  const badge = priorityBadge(epic.priority);

  // Border: drag-over highlight > fit during drag > selected > default
  let borderCls = 'border-mileway-border';
  if (isSelected && !isDraggingMember) borderCls = 'border-mileway-blue border-2';
  if (isDraggingMember && fitLevel) borderCls = `${FIT_COLOURS[fitLevel].border} border-2`;
  if (isOver) borderCls = 'border-mileway-blue border-2 bg-mileway-blue-10';

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(epic.jiraKey)}
      className={[
        'group bg-white rounded-[10px] p-4 border cursor-pointer',
        'transition-all duration-fast hover:border-mileway-blue',
        borderCls,
      ].join(' ')}
    >
      {/* Name + priority + details button */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-mileway-text leading-snug line-clamp-2 flex-1">
          {epic.summary}
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {badge && (
            <span className={`text-xs font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          {onOpenDetail && (
            <button
              onClick={e => { e.stopPropagation(); onOpenDetail(epic.jiraKey); }}
              aria-label={`Open details for ${epic.summary}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-fast p-0.5 rounded text-mileway-grey hover:text-mileway-blue hover:bg-mileway-blue-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
            >
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Key + feature count */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-medium text-mileway-grey">{epic.jiraKey}</span>
        {featureCount > 0 && (
          <span className="text-xs text-mileway-grey">
            {featureCount} feature{featureCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Capacity bar */}
      {estimated > 0 ? (
        <>
          <ProgressBar
            value={assignedDays}
            max={estimated}
            size="sm"
            status={pct >= 100 ? 'danger' : pct >= 80 ? 'warning' : 'normal'}
          />
          <p className="text-xs text-mileway-grey mt-1">{assignedDays} / {estimated}d assigned</p>
        </>
      ) : (
        <p className="text-xs text-mileway-grey">{assignedDays}d assigned</p>
      )}
    </div>
  );
}

// ── DaysPopover ───────────────────────────────────────────────────────────────

interface DaysPopoverProps {
  drop: PendingDrop;
  canAssign: boolean;
  selectedQuarter: string;
  onConfirm: (days: number) => void;
  onDismiss: () => void;
}

function DaysPopover({ drop, canAssign, selectedQuarter, onConfirm, onDismiss }: DaysPopoverProps) {
  const state = useCurrentState();
  const [rawDays, setRawDays] = useState(String(drop.suggestedDays));
  const parsedDays = Math.max(1, parseInt(rawDays, 10) || 1);
  const isOver = parsedDays > drop.availableDays && drop.availableDays > 0;
  const isValid = rawDays !== '' && parsedDays >= 1 && canAssign;

  const quarterSprints = useMemo(
    () => state.sprints.filter(s => s.quarter === selectedQuarter),
    [state.sprints, selectedQuarter],
  );

  const scenarioPlannerItems = useMemo((): PlannerItem[] => {
    const active = state.scenarios.find(sc => sc.id === state.activeScenarioId);
    return (active?.plannerLayout ?? []) as PlannerItem[];
  }, [state.scenarios, state.activeScenarioId]);

  const overloadedSprints = useMemo(() => {
    if (quarterSprints.length === 0) return [] as SprintCapacityResult[];
    const extraPerSprint = parsedDays / quarterSprints.length;
    const results: SprintCapacityResult[] = [];
    for (const sp of quarterSprints) {
      const cap = calculateSprintCapacity(drop.memberId, sp, scenarioPlannerItems, state, extraPerSprint);
      if (cap.isOverloaded) results.push(cap);
    }
    return results;
  }, [quarterSprints, scenarioPlannerItems, state, drop.memberId, parsedDays]);

  const hasOverload = overloadedSprints.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[#1E293B]/20" onClick={onDismiss} />
      <div className="relative bg-white border border-mileway-border rounded-[10px] p-6 w-80 shadow-md animate-fade-in">
        <p className="text-sm font-semibold text-mileway-text mb-0.5">
          Assign {drop.memberName}
        </p>
        <p className="text-xs text-mileway-grey mb-5 leading-relaxed">
          to <span className="font-medium text-mileway-text">{drop.projectName}</span>
          {drop.availableDays > 0 && ` · ${drop.availableDays}d available this quarter`}
        </p>

        <label htmlFor="assign-days" className="block text-xs font-medium text-mileway-grey mb-1.5">
          Days to assign
        </label>
        <input
          id="assign-days"
          type="number"
          value={rawDays}
          min={1}
          onChange={e => setRawDays(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && isValid) onConfirm(parsedDays); }}
          autoFocus
          className={`w-full border rounded-lg px-3 py-2.5 text-sm text-mileway-text focus:outline-none transition-colors duration-fast ${
            hasOverload ? 'border-orange-400 focus:border-orange-500' : 'border-mileway-border focus:border-mileway-blue'
          }`}
        />

        {hasOverload ? (
          <div className="mt-2 space-y-0.5">
            {overloadedSprints.slice(0, 3).map(r => (
              <p key={r.sprint.number} className="text-[10.5px] text-util-over flex items-start gap-1">
                <span aria-hidden>⚠</span>
                <span>
                  Overloaded in S{r.sprint.number} ({fmtSprintRange(r.sprint.startDate, r.sprint.endDate)}) — {Math.round(r.allocatedDays)}/{Math.round(r.totalWorkdays)} days
                </span>
              </p>
            ))}
            {overloadedSprints.length > 3 && (
              <p className="text-[10.5px] text-util-over pl-4">…and {overloadedSprints.length - 3} more</p>
            )}
          </div>
        ) : isOver ? (
          <p className="text-xs text-util-near mt-1.5">
            This exceeds available capacity for the quarter.
          </p>
        ) : null}
        {!canAssign && (
          <p className="text-xs text-mileway-grey mt-1.5">
            Read-only — contact your IT manager to make assignments.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onDismiss}
            className="text-sm font-medium text-mileway-grey px-4 py-2 rounded-lg hover:bg-mileway-bg transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (isValid) onConfirm(parsedDays); }}
            disabled={!isValid}
            className="text-sm font-medium text-white bg-mileway-blue px-4 py-2 rounded-lg hover:bg-[#0077C2] transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PlannerBoard ──────────────────────────────────────────────────────────────

export function PlannerBoard({ scenarioId: _scenarioId, selectedQuarter, sort, onOpenDetail, overlays }: PlannerBoardProps) {
  const state = useCurrentState();
  const { can } = useCurrentUser();
  const canAssign = can('edit_assignments');

  const [selectedEpicKey, setSelectedEpicKey] = useState<string | null>(null);
  const [draggingMember, setDraggingMember]   = useState<TeamMember | null>(null);
  const [fitScores, setFitScores]             = useState<Map<string, MemberFit>>(new Map());
  const [pendingDrop, setPendingDrop]         = useState<PendingDrop | null>(null);
  const [assignVersion, setAssignVersion]     = useState(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Keep a ref to the latest state so handleDragStart/End are stable (don't
  // depend on `state` directly in the dep array, which changes every store update).
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Derived data ────────────────────────────────────────────────────────────

  const quarterEpics = useMemo(
    () => (state.jiraWorkItems ?? []).filter(i => i.type === 'epic' && i.statusCategory !== 'done'),
    [state.jiraWorkItems],
  );

  const featureCountByEpic = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of (state.jiraWorkItems ?? [])) {
      if (item.type === 'feature' && item.parentKey) {
        map.set(item.parentKey, (map.get(item.parentKey) ?? 0) + 1);
      }
    }
    return map;
  }, [state.jiraWorkItems]);

  const assignedDaysByEpic = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of (state.assignments ?? [])) {
      if (a.quarter === selectedQuarter) {
        map.set(a.projectId, (map.get(a.projectId) ?? 0) + (a.days ?? 0));
      }
    }
    return map;
  }, [state.assignments, selectedQuarter]);

  const activeMembers = useMemo(
    () => (state.teamMembers ?? []).filter(m => !m.excludedFromCapacity),
    [state.teamMembers],
  );

  // Capacity per member — used in handleDragEnd to calculate available days.
  type MemberCapEntry = { usedPercent: number; availableDays: number };

  const memberCapacity = useMemo(() => {
    const map = new Map<string, MemberCapEntry>();
    for (const m of activeMembers) {
      try {
        const fit = scoreMember(m, selectedQuarter, [], '', stateRef.current);
        map.set(m.id, { usedPercent: fit.usedPercent, availableDays: fit.availableDays });
      } catch {
        map.set(m.id, { usedPercent: 0, availableDays: 0 });
      }
    }
    return map;
  }, [activeMembers, selectedQuarter, assignVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort the epic grid
  const sortedEpics = useMemo(() => {
    if (sort === 'name') return [...quarterEpics].sort((a, b) => a.summary.localeCompare(b.summary));
    if (sort === 'assigned') return [...quarterEpics].sort((a, b) => (assignedDaysByEpic.get(b.jiraKey) ?? 0) - (assignedDaysByEpic.get(a.jiraKey) ?? 0));
    return quarterEpics; // 'priority' — keep Jira order
  }, [quarterEpics, sort, assignedDaysByEpic]);

  // ── dnd-kit handlers ────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    let member: TeamMember | null = null;

    if (data?.type === 'member-card') {
      // Legacy format — kept for compatibility
      member = data.member as TeamMember;
    } else if (data?.type === 'people-drag' && data?.track === 'IT') {
      // PlannerTeamDrawer format — look up member by id
      member = stateRef.current.teamMembers?.find((m: TeamMember) => m.id === data.memberId) ?? null;
    }

    if (!member) return;
    setDraggingMember(member);

    // Precompute fit for ALL epics against this member — spec: do NOT recompute on dragOver
    const scores = new Map<string, MemberFit>();
    for (const epic of quarterEpics) {
      try {
        scores.set(epic.jiraKey, scoreMember(member, selectedQuarter, [], epic.jiraKey, stateRef.current));
      } catch {
        // Leave no entry — EpicCard treats missing as null fit (no border)
      }
    }
    setFitScores(scores);
  }, [quarterEpics, selectedQuarter]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { over } = event;
    const member = draggingMember;
    setDraggingMember(null);
    setFitScores(new Map());

    if (!over || !member) return;

    const overId = over.id.toString();
    if (!overId.startsWith('epic-drop-')) return;

    const jiraKey = overId.replace('epic-drop-', '');
    const epic = quarterEpics.find(e => e.jiraKey === jiraKey);
    if (!epic) return;

    const cap = memberCapacity.get(member.id);
    const availableDays = cap?.availableDays ?? 0;

    setPendingDrop({
      memberId: member.id,
      memberName: member.name,
      projectKey: jiraKey,
      projectName: epic.summary,
      availableDays,
      suggestedDays: Math.max(1, Math.min(5, Math.floor(availableDays))),
    });
  }, [draggingMember, quarterEpics, memberCapacity]);

  const handleConfirmAssign = useCallback((days: number) => {
    if (!pendingDrop || !canAssign) return;
    addAssignment({
      memberId: pendingDrop.memberId,
      projectId: pendingDrop.projectKey,
      quarter: selectedQuarter,
      days,
      isBizContact: false,
    });
    setPendingDrop(null);
    setAssignVersion(v => v + 1);
  }, [pendingDrop, canAssign, selectedQuarter]);

  const handleSelectEpic = useCallback((key: string) => {
    setSelectedEpicKey(prev => (prev === key ? null : key));
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedEpic = sortedEpics.find(e => e.jiraKey === selectedEpicKey) ?? null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col flex-1 overflow-hidden">

        {!canAssign && (
          <div className="px-6 py-2 bg-mileway-bg border-b border-mileway-border flex-shrink-0">
            <span className="text-xs text-mileway-grey italic">
              View-only — assignments are read-only
            </span>
          </div>
        )}

        {/* Epic cards grid — full width */}
        <div className="flex-1 overflow-y-auto p-6">
          {sortedEpics.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
              <p className="text-sm font-medium text-mileway-text">No active epics</p>
              <p className="text-xs text-mileway-grey">Sync Jira or add projects to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 w-full">
              {sortedEpics.map(epic => (
                <EpicCard
                  key={epic.jiraKey}
                  epic={epic}
                  featureCount={featureCountByEpic.get(epic.jiraKey) ?? 0}
                  assignedDays={assignedDaysByEpic.get(epic.jiraKey) ?? 0}
                  isSelected={selectedEpicKey === epic.jiraKey}
                  fitLevel={draggingMember ? (fitScores.get(epic.jiraKey)?.fitLevel ?? null) : null}
                  isDraggingMember={draggingMember !== null}
                  onSelect={handleSelectEpic}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          )}
        </div>

        {/* Smart Assignment Panel — inline, shown when epic selected */}
        {selectedEpic && (
          <div
            className="flex-shrink-0 border-t border-mileway-border bg-white overflow-y-auto"
            style={{ maxHeight: 300 }}
          >
            <SmartAssignmentPanel
              projectId={selectedEpic.jiraKey}
              projectName={selectedEpic.summary}
              defaultQuarter={selectedQuarter}
              variant="inline"
              onClose={() => setSelectedEpicKey(null)}
              onOpenDetail={onOpenDetail}
            />
          </div>
        )}
      </div>

      {/* Overlays (e.g. PlannerTeamDrawer) rendered inside this DndContext
          so useDraggable in the drawer shares drag events with the epic drop zones */}
      {overlays}

      {/* Days popover */}
      {pendingDrop && (
        <DaysPopover
          drop={pendingDrop}
          canAssign={canAssign}
          selectedQuarter={selectedQuarter}
          onConfirm={handleConfirmAssign}
          onDismiss={() => setPendingDrop(null)}
        />
      )}
    </DndContext>
  );
}
