/**
 * PlanRightSidebar — collapsible ~180px right panel listing IT team members
 * sorted by available days for the active quarter.
 * Each member card is a @dnd-kit Draggable — drag onto a project row to assign.
 */
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { useCurrentState } from '../../stores/appStore';
import { calculateCapacity } from '../../utils/capacity';
import type { TeamMember } from '../../types';
import { Accent, Background, Border, Text } from '../../theme/tokens';

const SIDEBAR_WIDTH = 180;

export interface PlanRightSidebarProps {
  selectedQuarter: string;
  activeDragMemberId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function PlanRightSidebar({
  selectedQuarter,
  activeDragMemberId,
  collapsed,
  onToggleCollapse,
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

      {/* Member list */}
      <div className="flex-1 overflow-y-auto py-1">
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
  isDimmed: boolean;
}

function DraggableMemberCard({ member, availableDays, isDimmed }: DraggableMemberCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: member.id,
    data: { type: 'member', memberId: member.id, memberName: member.name },
  });

  const style = transform ? { transform: CSS.Transform.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 select-none transition-opacity',
        'cursor-grab active:cursor-grabbing hover:bg-[#F5F3F0]',
        isDragging && 'opacity-0',
        isDimmed && 'opacity-30',
      )}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
        style={{ backgroundColor: Accent.teal }}
      >
        {member.name.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-xs truncate font-medium" style={{ color: Text.primary }}>
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
          {Math.max(0, availableDays)}d free
        </span>
      </div>
    </div>
  );
}
