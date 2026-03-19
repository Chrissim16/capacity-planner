/**
 * PlannerPeopleDrawer — collapsible right-side panel in Timeline mode.
 *
 * Shows IT team members and BIZ contacts with their availability for the
 * selected quarter. Each card is draggable; dropping onto a bar opens the
 * AssignPopover for that person pre-selected (SP-10).
 */

import { useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Users } from 'lucide-react';
import type { TeamMember, BusinessContact } from '../../types';
import { useCurrentState } from '../../stores/appStore';
import { calculateCapacity, calculateBusinessCapacityForQuarter } from '../../utils/capacity';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PeopleCard {
  id: string;
  name: string;
  subtitle: string;
  track: 'IT' | 'BIZ';
  availableDays: number;
}

export interface PlannerPeopleDrawerProps {
  selectedQuarter: string;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div
      className="flex-shrink-0 rounded-full bg-mileway-blue-10 text-mileway-blue flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}

// ── DraggablePersonCard ─────────────────────────────────────────────────────────

function DraggablePersonCard({ card }: { card: PeopleCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `people-${card.id}`,
    data: { type: 'people-drag', memberId: card.id, memberName: card.name, track: card.track },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: isDragging ? 'grabbing' : 'grab' }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-mileway-border hover:border-mileway-blue/40 hover:shadow-sm transition-all duration-fast select-none"
      title={`Drag onto a bar to assign ${card.name}`}
    >
      <Avatar name={card.name} size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mileway-text truncate leading-tight">{card.name}</p>
        <p className="text-[11px] text-mileway-grey truncate">{card.subtitle}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        {card.availableDays > 0 ? (
          <span className="text-[11px] font-semibold text-mileway-text">{Math.round(card.availableDays)}d</span>
        ) : (
          <span className="text-[10px] italic text-mileway-grey">Full</span>
        )}
      </div>
    </div>
  );
}

// ── PlannerPeopleDrawer ────────────────────────────────────────────────────────

export function PlannerPeopleDrawer({ selectedQuarter }: PlannerPeopleDrawerProps) {
  const state = useCurrentState();

  const itCards = useMemo<PeopleCard[]>(() => {
    return state.teamMembers
      .filter(m => !m.excludedFromCapacity)
      .map((m: TeamMember) => {
        let availableDays = 0;
        try {
          availableDays = calculateCapacity(m.id, selectedQuarter, state).availableDays;
        } catch { /* fallback 0 */ }
        return {
          id: m.id,
          name: m.name,
          subtitle: m.role ?? 'Team Member',
          track: 'IT' as const,
          availableDays,
        };
      })
      .sort((a, b) => b.availableDays - a.availableDays);
  }, [state, selectedQuarter]);

  const bizCards = useMemo<PeopleCard[]>(() => {
    return (state.businessContacts ?? [])
      .filter((c: BusinessContact) => !c.archived && !c.excludedFromCapacity)
      .map((c: BusinessContact) => {
        let availableDays = 0;
        try {
          const result = calculateBusinessCapacityForQuarter(
            c, selectedQuarter,
            state.jiraItemBizAssignments ?? [],
            state.businessTimeOff ?? [],
            state.publicHolidays ?? [],
            state.jiraWorkItems ?? [],
          );
          availableDays = result.availableDays;
        } catch { /* fallback 0 */ }
        return {
          id: c.id,
          name: c.name,
          subtitle: c.title ?? c.department ?? 'BIZ Contact',
          track: 'BIZ' as const,
          availableDays,
        };
      })
      .sort((a, b) => b.availableDays - a.availableDays);
  }, [state, selectedQuarter]);

  return (
    <div className="flex flex-col h-full border-l border-mileway-border bg-mileway-bg flex-shrink-0" style={{ width: 240 }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-mileway-border bg-white flex-shrink-0">
        <Users size={14} className="text-mileway-blue" />
        <span className="text-xs font-semibold text-mileway-text">People</span>
        <span className="ml-auto text-[10px] text-mileway-grey italic">Drag to assign</span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* IT section */}
        {itCards.length > 0 && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mileway-grey mb-1.5 px-1">
              IT Team ({itCards.length})
            </p>
            <div className="space-y-1.5">
              {itCards.map(c => <DraggablePersonCard key={c.id} card={c} />)}
            </div>
          </section>
        )}

        {/* BIZ section */}
        {bizCards.length > 0 && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mileway-grey mb-1.5 px-1">
              BIZ Contacts ({bizCards.length})
            </p>
            <div className="space-y-1.5">
              {bizCards.map(c => <DraggablePersonCard key={c.id} card={c} />)}
            </div>
          </section>
        )}

        {itCards.length === 0 && bizCards.length === 0 && (
          <p className="text-xs text-mileway-grey text-center py-8 italic">No people records found.</p>
        )}
      </div>
    </div>
  );
}
