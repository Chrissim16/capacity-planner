/**
 * PlanRightSidebar — collapsible 260px right panel listing IT team members
 * sorted by available days for the active quarter.
 *
 * v2.1 improvements:
 *  - Expanded to 260px with card-style items (border-radius, padding, gap)
 *  - Avatar enlarged to 32px, drag handle affordance visible on hover
 *  - Shows an amber removal drop zone when a canvas-member drag is in flight
 */
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Users, GripVertical } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { useCurrentState } from '../../stores/appStore';
import { calculateCapacity } from '../../utils/capacity';
import type { TeamMember } from '../../types';
import { Accent, Background, Border, Text } from '../../theme/tokens';
import type { ActiveDragType } from './PlanLeftSidebar';

const SIDEBAR_WIDTH = 260;

// Drop zone id used by the DnD context to identify the "remove from project" zone
export const RIGHT_SIDEBAR_REMOVE_ZONE_ID = '__right-sidebar-remove-zone__';

export interface PlanRightSidebarProps {
  selectedQuarter: string;
  activeDragMemberId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Current drag type from the DnD context — controls removal zone visibility */
  activeDragType?: ActiveDragType;
}

export function PlanRightSidebar({
  selectedQuarter,
  activeDragMemberId,
  collapsed,
  onToggleCollapse,
  activeDragType = null,
}: PlanRightSidebarProps) {
  const state = useCurrentState();

  const sortedMembers = useMemo(() => {
    const members = (state.teamMembers ?? []).filter(m => !m.excludedFromCapacity);
    return [...members].sort((a, b) => {
      const capA = calculateCapacity(a.id, selectedQuarter, state);
      const capB = calculateCapacity(b.id, selectedQuarter, state);
      return capB.availableDays - capA.availableDays;
    });
  }, [state, selectedQuarter]);

  const isDraggingSomeone = activeDragMemberId !== null;

  // Removal drop zone: only visible when a canvas-member drag is active
  const showRemoveZone = activeDragType === 'canvas-member';
  const { setNodeRef: setRemoveRef, isOver: isOverRemove } = useDroppable({
    id: RIGHT_SIDEBAR_REMOVE_ZONE_ID,
    disabled: !showRemoveZone,
  });

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 gap-3 border-l shrink-0"
        style={{ width: 40, borderColor: Border.subtle, backgroundColor: Background.card }}
      >
        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F5F3F0] transition-colors focus:ring-2 focus:ring-sana-teal"
          style={{ color: Text.tertiary }}
          onClick={onToggleCollapse}
          aria-label="Expand team sidebar"
        >
          <ChevronLeft size={14} />
        </button>
        <Users size={14} style={{ color: Text.tertiary }} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col border-l shrink-0 overflow-hidden"
      style={{ width: SIDEBAR_WIDTH, borderColor: Border.subtle, backgroundColor: Background.card }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: Border.subtle }}
      >
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#F5F3F0] transition-colors focus:ring-2 focus:ring-sana-teal"
          style={{ color: Text.tertiary }}
          onClick={onToggleCollapse}
          aria-label="Collapse team sidebar"
        >
          <ChevronRight size={13} />
        </button>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: Text.tertiary }}
        >
          Team
        </span>
      </div>

      {/* Quarter context label */}
      <div
        className="px-3 py-1 text-[10px] border-b"
        style={{ color: Text.tertiary, borderColor: Border.subtle }}
      >
        Capacity · {selectedQuarter}
      </div>

      {/* Removal drop zone — amber, only visible during canvas-member drag */}
      {showRemoveZone && (
        <div
          ref={setRemoveRef}
          className={clsx(
            'mx-2 my-2 rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors shrink-0',
            isOverRemove
              ? 'bg-amber-100 border-2 border-amber-400'
              : 'border-2 border-dashed border-amber-300 bg-amber-50'
          )}
          style={{ height: 40, color: '#92400E' }}
          aria-label="Remove person from project"
        >
          <span>↩</span>
          <span>Remove from project</span>
        </div>
      )}

      {/* Member list */}
      <div className="flex-1 overflow-y-auto py-1.5 px-2 flex flex-col gap-1.5">
        {sortedMembers.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <span className="text-xs" style={{ color: Text.tertiary }}>No team members</span>
          </div>
        ) : (
          sortedMembers.map(member => {
            const cap = calculateCapacity(member.id, selectedQuarter, state);
            const isBeingDragged = activeDragMemberId === member.id;
            const isDimmed = isDraggingSomeone && !isBeingDragged;
            return (
              <DraggableMemberCard
                key={member.id}
                member={member}
                availableDays={cap.availableDays}
                selectedQuarter={selectedQuarter}
                isDimmed={isDimmed}
              />
            );
          })
        )}
      </div>

      {/* Drag hint */}
      <div
        className="px-3 py-2 text-[10px] text-center border-t"
        style={{ color: Text.tertiary, borderColor: Border.subtle }}
      >
        Drag onto a project row
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Draggable member card
// ─────────────────────────────────────────────────────────────────────────────

interface DraggableMemberCardProps {
  member: TeamMember;
  availableDays: number;
  selectedQuarter: string;
  isDimmed: boolean;
}

function DraggableMemberCard({ member, availableDays, selectedQuarter, isDimmed }: DraggableMemberCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: member.id,
    data: { type: 'member', memberId: member.id, memberName: member.name },
  });

  const style = transform ? { transform: CSS.Transform.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderRadius: 8,
        borderLeft: `3px solid ${Border.subtle}`,
        backgroundColor: Background.primary,
        opacity: isDragging ? 0 : isDimmed ? 0.35 : 1,
      }}
      className="flex items-center gap-2 px-3 py-2.5 select-none transition-opacity group hover:shadow-sm"
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity shrink-0 cursor-grab active:cursor-grabbing"
        style={{ color: Text.tertiary }}
        aria-label="Drag to assign"
      >
        <GripVertical size={13} />
      </div>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
        style={{ backgroundColor: Accent.teal }}
      >
        {member.name.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[13px] font-medium truncate" style={{ color: Text.primary }}>
            {member.name}
          </span>
          <span
            className="text-[9px] font-semibold tracking-wide shrink-0"
            style={{ color: Accent.teal }}
          >
            IT
          </span>
        </div>
        <span className="text-[10px]" style={{ color: Text.tertiary }}>
          {Math.max(0, availableDays)}d free · {selectedQuarter}
        </span>
      </div>
    </div>
  );
}
