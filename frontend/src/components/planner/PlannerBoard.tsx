/**
 * PlannerBoard — Quarterly staffing board for the Scenario Planner.
 *
 * Left panel:  Epic cards (droppable) — show fit-colour border during member drag
 * Right panel: Team member cards (draggable IT) + BIZ contacts (read-only in v1)
 * Bottom:      SmartAssignmentPanel inline, shown when an epic is selected
 *
 * BIZ contact drag is deferred to v2 (TODO-002). BIZ assignment via SmartAssignmentPanel only.
 * Fit scores are precomputed on dragStart — not recalculated on every dragOver.
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useCurrentState } from '../../stores/appStore';
import { addAssignment } from '../../stores/actions';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import {
  scoreMember,
  scoreBusinessContact,
  FIT_COLOURS,
  type MemberFit,
} from '../../utils/staffing';
import { getCurrentQuarter, generateQuarters } from '../../utils/calendar';
import { SmartAssignmentPanel } from '../SmartAssignmentPanel';
import { ProgressBar } from '../ui/ProgressBar';
import type { TeamMember, BusinessContact, JiraWorkItem } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PlannerBoardProps {
  /** Used for future scenario-specific overrides; passed through to SmartAssignmentPanel. */
  scenarioId: string;
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

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

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

// ── QuarterSelector ───────────────────────────────────────────────────────────

function QuarterSelector({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const quarters = useMemo(() => generateQuarters(8), []);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-mileway-grey">Quarter</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Select quarter"
        className="text-sm border border-mileway-border rounded-lg px-3 py-1.5 text-mileway-text bg-white focus:outline-none focus:border-mileway-blue transition-colors duration-fast"
      >
        {quarters.map(q => <option key={q} value={q}>{q}</option>)}
      </select>
    </div>
  );
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
}

function EpicCard({ epic, featureCount, assignedDays, isSelected, fitLevel, isDraggingMember, onSelect }: EpicCardProps) {
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
        'bg-white rounded-[10px] p-4 border cursor-pointer',
        'transition-all duration-fast hover:border-mileway-blue',
        borderCls,
      ].join(' ')}
    >
      {/* Name + priority */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-mileway-text leading-snug line-clamp-2 flex-1">
          {epic.summary}
        </p>
        {badge && (
          <span className={`flex-shrink-0 text-xs font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        )}
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

// ── MemberCard ────────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: TeamMember;
  usedPercent: number;
  availableDays: number;
  canAssign: boolean;
}

function MemberCard({ member, usedPercent, availableDays, canAssign }: MemberCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `member-${member.id}`,
    disabled: !canAssign,
    data: { type: 'member-card', member },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'bg-white border border-mileway-border rounded-lg p-3 flex items-center gap-3',
        'transition-all duration-fast select-none',
        canAssign ? 'cursor-grab hover:border-mileway-blue hover:bg-mileway-blue-10' : '',
        isDragging ? 'opacity-40' : 'opacity-100',
      ].join(' ')}
      {...(canAssign ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mileway-blue-10 text-mileway-blue flex items-center justify-center text-xs font-semibold">
        {initials(member.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-sm font-medium text-mileway-text truncate">{member.name}</p>
          <span className="flex-shrink-0 text-[10px] font-semibold bg-mileway-blue-10 text-mileway-blue px-1.5 py-0.5 rounded">
            IT
          </span>
        </div>
        <ProgressBar value={usedPercent} max={100} size="sm" />
        <p className="text-xs text-mileway-grey mt-0.5">{Math.max(0, availableDays)}d available</p>
      </div>
    </div>
  );
}

// ── BizContactCard ────────────────────────────────────────────────────────────
// Read-only in v1 — BIZ assignment via SmartAssignmentPanel only (TODO-002).

interface BizContactCardProps {
  contact: BusinessContact;
  usedPercent: number;
  availableDays: number;
}

function BizContactCard({ contact, usedPercent, availableDays }: BizContactCardProps) {
  return (
    <div className="bg-biz-light border border-mileway-border rounded-lg p-3 flex items-center gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#DEDFE3] text-mileway-grey flex items-center justify-center text-xs font-semibold">
        {initials(contact.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-sm font-medium text-mileway-text truncate">{contact.name}</p>
          <span className="flex-shrink-0 text-[10px] font-semibold bg-[#DEDFE3] text-mileway-grey px-1.5 py-0.5 rounded">
            BIZ
          </span>
        </div>
        <ProgressBar value={usedPercent} max={100} size="sm" />
        <p className="text-xs text-mileway-grey mt-0.5">{Math.max(0, availableDays)}d available</p>
      </div>
    </div>
  );
}

// ── DaysPopover ───────────────────────────────────────────────────────────────

interface DaysPopoverProps {
  drop: PendingDrop;
  canAssign: boolean;
  onConfirm: (days: number) => void;
  onDismiss: () => void;
}

function DaysPopover({ drop, canAssign, onConfirm, onDismiss }: DaysPopoverProps) {
  const [rawDays, setRawDays] = useState(String(drop.suggestedDays));
  const parsedDays = Math.max(1, parseInt(rawDays, 10) || 1);
  const isOver = parsedDays > drop.availableDays && drop.availableDays > 0;
  const isValid = rawDays !== '' && parsedDays >= 1 && canAssign;

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
          className="w-full border border-mileway-border rounded-lg px-3 py-2.5 text-sm text-mileway-text focus:outline-none focus:border-mileway-blue transition-colors duration-fast"
        />

        {isOver && (
          <p className="text-xs text-util-near mt-1.5">
            This exceeds available capacity for the quarter.
          </p>
        )}
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

export function PlannerBoard({ scenarioId: _scenarioId }: PlannerBoardProps) {
  const state = useCurrentState();
  const { can } = useCurrentUser();
  const canAssign = can('edit_assignments');

  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter);
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

  const activeContacts = useMemo(
    () => (state.businessContacts ?? []).filter(c => !c.archived && !c.excludedFromCapacity),
    [state.businessContacts],
  );

  // Capacity per member — computed once per render, animated by ProgressBar's own transition.
  // stateRef is used instead of `state` so these memos don't re-run on every store write.
  const memberCapacity = useMemo(() => {
    const map = new Map<string, { usedPercent: number; availableDays: number }>();
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

  const bizCapacity = useMemo(() => {
    const map = new Map<string, { usedPercent: number; availableDays: number }>();
    for (const c of activeContacts) {
      try {
        const fit = scoreBusinessContact(c, selectedQuarter, '', stateRef.current);
        map.set(c.id, { usedPercent: fit.usedPercent, availableDays: fit.availableDays });
      } catch {
        map.set(c.id, { usedPercent: 0, availableDays: 0 });
      }
    }
    return map;
  }, [activeContacts, selectedQuarter, assignVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── dnd-kit handlers ────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const member = event.active.data.current?.member as TeamMember | undefined;
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

  const selectedEpic = quarterEpics.find(e => e.jiraKey === selectedEpicKey) ?? null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-mileway-border bg-white flex-shrink-0">
          <QuarterSelector value={selectedQuarter} onChange={setSelectedQuarter} />
          {!canAssign && (
            <span className="text-xs text-mileway-grey italic">
              View-only — assignments are read-only
            </span>
          )}
        </div>

        {/* Main panels */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT — Epic cards */}
          <div className="flex-1 overflow-y-auto p-6">
            {quarterEpics.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
                <p className="text-sm font-medium text-mileway-text">No active epics</p>
                <p className="text-xs text-mileway-grey">Sync Jira or add projects to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 max-w-xl">
                {quarterEpics.map(epic => (
                  <EpicCard
                    key={epic.jiraKey}
                    epic={epic}
                    featureCount={featureCountByEpic.get(epic.jiraKey) ?? 0}
                    assignedDays={assignedDaysByEpic.get(epic.jiraKey) ?? 0}
                    isSelected={selectedEpicKey === epic.jiraKey}
                    fitLevel={draggingMember ? (fitScores.get(epic.jiraKey)?.fitLevel ?? null) : null}
                    isDraggingMember={draggingMember !== null}
                    onSelect={handleSelectEpic}
                  />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Team member + BIZ contact cards */}
          <div
            className="flex-shrink-0 border-l border-mileway-border overflow-y-auto p-4 space-y-3"
            style={{ width: 296 }}
          >
            {/* IT section */}
            {activeMembers.length > 0 && (
              <>
                <p className="text-xs font-semibold text-mileway-grey uppercase tracking-wider px-1">
                  IT
                </p>
                {activeMembers.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    usedPercent={memberCapacity.get(m.id)?.usedPercent ?? 0}
                    availableDays={memberCapacity.get(m.id)?.availableDays ?? 0}
                    canAssign={canAssign}
                  />
                ))}
              </>
            )}

            {/* BIZ section */}
            {activeContacts.length > 0 && (
              <>
                <p className="text-xs font-semibold text-mileway-grey uppercase tracking-wider px-1 pt-2">
                  BIZ
                </p>
                {activeContacts.map(c => (
                  <BizContactCard
                    key={c.id}
                    contact={c}
                    usedPercent={bizCapacity.get(c.id)?.usedPercent ?? 0}
                    availableDays={bizCapacity.get(c.id)?.availableDays ?? 0}
                  />
                ))}
              </>
            )}

            {activeMembers.length === 0 && activeContacts.length === 0 && (
              <p className="text-xs text-mileway-grey text-center py-8">No team members found.</p>
            )}
          </div>
        </div>

        {/* BOTTOM — SmartAssignmentPanel (inline, shown when epic selected) */}
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
            />
          </div>
        )}
      </div>

      {/* Days popover */}
      {pendingDrop && (
        <DaysPopover
          drop={pendingDrop}
          canAssign={canAssign}
          onConfirm={handleConfirmAssign}
          onDismiss={() => setPendingDrop(null)}
        />
      )}
    </DndContext>
  );
}
