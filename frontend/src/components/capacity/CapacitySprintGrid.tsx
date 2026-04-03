import { useDroppable } from '@dnd-kit/core';
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import type { CapacityAssignment, Sprint, TeamMember } from '../../types';
import type { CapacityBacklogItem } from './CapacityRequestCard';

interface CapacitySprintGridProps {
  teamMembers: TeamMember[];
  sprints: Sprint[];
  assignments: CapacityAssignment[];
  getSourceItem: (assignment: CapacityAssignment) => CapacityBacklogItem | null;
  onAssign: (entry: CapacityBacklogItem, memberId: string, sprintId: string, availableDays: number) => void;
  onRemoveAssignment: (id: string) => void;
  pendingDrop: { memberId: string; sprintId: string; entry: CapacityBacklogItem } | null;
}

function SprintCell({
  member,
  sprint,
  assignments,
  getSourceItem,
  onAssign,
  onRemoveAssignment,
  pendingDrop,
}: {
  member: TeamMember;
  sprint: Sprint;
  assignments: CapacityAssignment[];
  getSourceItem: (assignment: CapacityAssignment) => CapacityBacklogItem | null;
  onAssign: (entry: CapacityBacklogItem, memberId: string, sprintId: string, availableDays: number) => void;
  onRemoveAssignment: (id: string) => void;
  pendingDrop: { memberId: string; sprintId: string; entry: CapacityBacklogItem } | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${member.id}::${sprint.id}` });
  const assignedDays = assignments.reduce((sum, assignment) => sum + assignment.estimatedDays, 0);
  const sprintCapacity = (member.workingDaysPerWeek ?? 5) * 3;
  const remainingDays = sprintCapacity - assignedDays;
  const droppedDays = pendingDrop?.entry.kind === 'request'
    ? pendingDrop.entry.item.estimatedDays
    : (pendingDrop?.entry.item.originalEstimate ?? pendingDrop?.entry.item.storyPoints ?? 1);
  const projectedRemaining = pendingDrop ? remainingDays - droppedDays : remainingDays;
  const isPending = pendingDrop?.memberId === member.id && pendingDrop.sprintId === sprint.id;
  const wouldOverallocate = isPending && projectedRemaining < 0;

  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-[150px] rounded-xl border p-3 transition-colors',
        isOver ? 'border-[#0089DD] bg-[#EFF6FF]' : 'border-[#DEDFE3] bg-white',
        wouldOverallocate ? 'border-[#F97316] bg-[#FFF7ED]' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#334155]">{assignedDays.toFixed(1)}d allocated</p>
          <p className="text-[11px] text-[#94A3B8]">{remainingDays.toFixed(1)}d remaining</p>
        </div>
        <div
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            remainingDays < 0 ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#ECFDF5] text-[#047857]'
          }`}
        >
          {sprintCapacity.toFixed(0)}d cap
        </div>
      </div>

      {isPending ? (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${wouldOverallocate ? 'border-[#FDBA74] bg-[#FFF7ED] text-[#C2410C]' : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]'}`}>
          <div className="flex items-center gap-2">
            {wouldOverallocate ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            <span>
              {wouldOverallocate
                ? `Overallocated by ${Math.abs(projectedRemaining).toFixed(1)}d if confirmed`
                : `Fits with ${projectedRemaining.toFixed(1)}d remaining`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onAssign(pendingDrop.entry, member.id, sprint.id, remainingDays)}
            className={`mt-2 rounded-lg px-3 py-1.5 font-medium ${wouldOverallocate ? 'bg-[#F97316] text-white hover:bg-[#EA580C]' : 'bg-[#16A34A] text-white hover:bg-[#15803D]'}`}
          >
            Confirm assignment
          </button>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {assignments.map((assignment) => {
          const source = getSourceItem(assignment);
          const label = source?.kind === 'jira'
            ? `${source.item.jiraKey} · ${source.item.summary}`
            : source?.kind === 'request'
              ? source.item.name
              : (assignment.jiraItemId ?? assignment.capacityRequestId ?? assignment.id);
          return (
            <div key={assignment.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[#1E293B]">{label}</p>
                  <p className="text-[11px] text-[#64748B]">{assignment.estimatedDays}d scheduled</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAssignment(assignment.id)}
                  className="rounded-md p-1 text-[#94A3B8] hover:bg-white hover:text-[#DC2626]"
                  aria-label="Remove assignment"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CapacitySprintGrid({
  teamMembers,
  sprints,
  assignments,
  getSourceItem,
  onAssign,
  onRemoveAssignment,
  pendingDrop,
}: CapacitySprintGridProps) {
  return (
    <div className="flex-1 overflow-auto bg-[#F8FAFC] p-6">
      <div className="min-w-[900px] space-y-4">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `220px repeat(${sprints.length}, minmax(180px, 1fr))` }}
        >
          <div />
          {sprints.map((sprint) => (
            <div key={sprint.id} className="rounded-xl border border-[#DEDFE3] bg-white px-4 py-3">
              <p className="text-sm font-semibold text-[#1E293B]">{sprint.name}</p>
              <p className="text-xs text-[#94A3B8]">{sprint.startDate} to {sprint.endDate}</p>
            </div>
          ))}
        </div>

        {teamMembers.map((member) => (
          <div
            key={member.id}
            className="grid gap-3"
            style={{ gridTemplateColumns: `220px repeat(${sprints.length}, minmax(180px, 1fr))` }}
          >
            <div className="rounded-xl border border-[#DEDFE3] bg-white px-4 py-4">
              <p className="text-sm font-semibold text-[#1E293B]">{member.name}</p>
              <p className="text-xs text-[#94A3B8]">{member.role || 'Team member'}</p>
            </div>
            {sprints.map((sprint) => (
              <SprintCell
                key={`${member.id}-${sprint.id}`}
                member={member}
                sprint={sprint}
                assignments={assignments.filter((assignment) => assignment.memberId === member.id && assignment.sprintId === sprint.id)}
                getSourceItem={getSourceItem}
                onAssign={onAssign}
                onRemoveAssignment={onRemoveAssignment}
                pendingDrop={pendingDrop}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
