/**
 * PlannerTeamDrawer — right-side overlay drawer showing IT members and BIZ contacts.
 *
 * Replaces PlannerPeopleDrawer with:
 *   - Absolute overlay geometry (right edge of canvas)
 *   - Search + IT/BIZ collapsible sections
 *   - Hybrid drag model: Board = full card draggable; Timeline = grip-only drag
 *   - Member focus callback for Timeline mode (card body click)
 *
 * US-UI-10 · US-UI-11 · US-UI-12
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDraggable, useDndMonitor } from '@dnd-kit/core';
import { X, Search, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import type { TeamMember, BusinessContact } from '../../types';
import { useCurrentState } from '../../stores/appStore';
import { calculateCapacity, calculateBusinessCapacityForQuarter } from '../../utils/capacity';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeamCard {
  id: string;
  name: string;
  subtitle: string;
  track: 'IT' | 'BIZ';
  availableDays: number;
  totalWorkdays: number;
  usedPercent: number;
  isOverloaded: boolean;
}

export interface PlannerTeamDrawerProps {
  selectedQuarter: string;
  activeMode: 'board' | 'timeline';
  /** Called by ✕ button, T key, and Escape — parent unmounts the drawer */
  onClose: () => void;
  /** Timeline mode only — fires when the card body (not grip) is clicked */
  onMemberFocus?: (memberId: string | null) => void;
  /** Currently focused member id — drives card highlight */
  focusedMemberId?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function barColor(pct: number): string {
  if (pct > 100) return 'bg-red-500';
  if (pct > 80)  return 'bg-amber-400';
  if (pct > 50)  return 'bg-mileway-blue';
  return 'bg-green-500';
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ name, track }: { name: string; track: 'IT' | 'BIZ' }) {
  const size = 30;
  return (
    <div
      className={[
        'flex-shrink-0 rounded-full flex items-center justify-center font-semibold select-none',
        track === 'IT'
          ? 'bg-mileway-blue-10 text-mileway-blue'
          : 'bg-purple-50 text-purple-600',
      ].join(' ')}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

// ── TeamMemberCard ─────────────────────────────────────────────────────────────

function TeamMemberCard({
  card,
  activeMode,
  isFocused,
  onBodyClick,
}: {
  card: TeamCard;
  activeMode: 'board' | 'timeline';
  isFocused: boolean;
  onBodyClick?: () => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `people-${card.id}`,
    data: { type: 'people-drag', memberId: card.id, memberName: card.name, track: card.track },
    disabled: false,
  });

  const usedPct = Math.min(card.usedPercent, 100);

  return (
    <div
      className={[
        'group relative flex items-stretch rounded-lg border transition-all duration-fast select-none',
        isDragging   ? 'opacity-40'                             : 'opacity-100',
        isFocused    ? 'border-mileway-blue bg-mileway-blue-10' : 'border-mileway-border bg-white hover:border-mileway-blue/40 hover:shadow-sm',
      ].join(' ')}
    >
      {/* ── Grip column — visual hint on Board only (drag handle is whole card body) */}
      {activeMode === 'board' && (
        <div
          className={[
            'flex items-center justify-center w-4 flex-shrink-0 rounded-l-lg',
            'opacity-100 cursor-grab',
            isDragging ? 'cursor-grabbing' : '',
          ].join(' ')}
          aria-hidden
        >
          <GripVertical size={13} className="text-mileway-grey" />
        </div>
      )}

      {/* ── Card body ───────────────────────────────────────────────────────── */}
      <div
        ref={activeMode === 'board' ? setNodeRef : undefined}
        {...(activeMode === 'board' ? { ...attributes, ...listeners } : {})}
        className={[
          'flex-1 min-w-0 flex items-center gap-2.5 px-2 py-2.5 pr-2.5 rounded-lg',
          activeMode === 'board' ? 'cursor-grab' : 'cursor-default',
          isDragging && activeMode === 'board' ? 'cursor-grabbing' : '',
        ].join(' ')}
        onClick={activeMode === 'timeline' ? onBodyClick : undefined}
        role={activeMode === 'timeline' ? 'button' : undefined}
        tabIndex={activeMode === 'timeline' ? 0 : undefined}
        onKeyDown={activeMode === 'timeline' ? (e) => { if (e.key === 'Enter' || e.key === ' ') onBodyClick?.(); } : undefined}
        aria-pressed={activeMode === 'timeline' ? isFocused : undefined}
        aria-label={activeMode === 'timeline' ? `Focus ${card.name}` : undefined}
      >
        <Avatar name={card.name} track={card.track} />

        <div className="flex-1 min-w-0">
          {/* Name + overloaded badge */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-medium text-mileway-text truncate leading-tight flex-1 min-w-0">
              {card.name}
            </span>
            {card.isOverloaded && (
              <span className="flex-shrink-0 text-[9px] font-bold text-white bg-red-500 px-1 py-0.5 rounded leading-none">
                OVERLOADED
              </span>
            )}
          </div>

          {/* Role / title */}
          <p className="text-[11px] text-mileway-grey truncate mb-1.5">{card.subtitle}</p>

          {/* Mini capacity bar + available days */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-mileway-bg rounded-full overflow-hidden" style={{ height: 3 }}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${barColor(card.usedPercent)}`}
                style={{ width: `${usedPct}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="flex-shrink-0 text-[10px] font-medium text-mileway-grey">
              {card.availableDays > 0
                ? `${Math.round(card.availableDays)}d`
                : <span className="italic">Full</span>}
            </span>
          </div>
        </div>

        {/* IT / BIZ badge */}
        <span
          className={[
            'flex-shrink-0 self-start mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded leading-none',
            card.track === 'IT'
              ? 'bg-mileway-blue-10 text-mileway-blue'
              : 'bg-purple-50 text-purple-600',
          ].join(' ')}
          aria-label={card.track === 'IT' ? 'IT team member' : 'BIZ contact'}
        >
          {card.track}
        </span>
      </div>
    </div>
  );
}

// ── PlannerTeamDrawer ──────────────────────────────────────────────────────────

export function PlannerTeamDrawer({
  selectedQuarter,
  activeMode,
  onClose,
  onMemberFocus,
  focusedMemberId,
}: PlannerTeamDrawerProps) {
  const state = useCurrentState();

  const [search, setSearch]         = useState('');
  const [bizExpanded, setBizExpanded] = useState(false);

  // Track active drag to suppress Escape-close mid-drag
  const [isDragActive, setIsDragActive] = useState(false);
  useDndMonitor({
    onDragStart:  () => setIsDragActive(true),
    onDragEnd:    () => setIsDragActive(false),
    onDragCancel: () => setIsDragActive(false),
  });

  // Close on Escape (not during drag) and on T key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape' && !isDragActive) { onClose(); return; }
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !isDragActive) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, isDragActive]);

  // ── Data ──────────────────────────────────────────────────────────────────

  const itCards = useMemo<TeamCard[]>(() => {
    return (state.teamMembers ?? [])
      .filter((m: TeamMember) => !m.excludedFromCapacity)
      .map((m: TeamMember) => {
        let availableDays = 0;
        let totalWorkdays = 0;
        let usedPercent   = 0;
        let isOverloaded  = false;
        try {
          const cap = calculateCapacity(m.id, selectedQuarter, state);
          availableDays = cap.availableDays;
          totalWorkdays = cap.totalWorkdays;
          usedPercent   = cap.usedPercent;
          isOverloaded  = cap.status === 'overallocated';
        } catch { /* fallback 0 */ }
        return {
          id: m.id,
          name: m.name,
          subtitle: m.role ?? 'Team Member',
          track: 'IT' as const,
          availableDays,
          totalWorkdays,
          usedPercent,
          isOverloaded,
        };
      })
      .sort((a, b) => b.availableDays - a.availableDays);
  }, [state, selectedQuarter]);

  const bizCards = useMemo<TeamCard[]>(() => {
    return (state.businessContacts ?? [])
      .filter((c: BusinessContact) => !c.archived && !c.excludedFromCapacity)
      .map((c: BusinessContact) => {
        let availableDays = 0;
        let usedPercent   = 0;
        let isOverloaded  = false;
        try {
          const result = calculateBusinessCapacityForQuarter(
            c, selectedQuarter,
            state.jiraItemBizAssignments ?? [],
            state.businessTimeOff ?? [],
            state.publicHolidays ?? [],
            state.jiraWorkItems ?? [],
          );
          availableDays = result.availableDays;
          const gross = result.availableDays + (result.allocatedDays ?? 0);
          usedPercent = gross > 0 ? Math.round(((result.allocatedDays ?? 0) / gross) * 100) : 0;
          isOverloaded = availableDays <= 0 && (result.allocatedDays ?? 0) > 0;
        } catch { /* fallback 0 */ }
        return {
          id: c.id,
          name: c.name,
          subtitle: c.title ?? c.department ?? 'BIZ Contact',
          track: 'BIZ' as const,
          availableDays,
          totalWorkdays: 0,
          usedPercent,
          isOverloaded,
        };
      })
      .sort((a, b) => b.availableDays - a.availableDays);
  }, [state, selectedQuarter]);

  const totalCount = itCards.length + bizCards.length;

  const q = search.trim().toLowerCase();
  const filterCards = useCallback((cards: TeamCard[]) => {
    if (!q) return cards;
    return cards.filter(c =>
      c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredIT  = filterCards(itCards);
  const filteredBIZ = filterCards(bizCards);

  const handleBodyClick = useCallback((memberId: string) => {
    if (!onMemberFocus) return;
    onMemberFocus(focusedMemberId === memberId ? null : memberId);
  }, [onMemberFocus, focusedMemberId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="absolute top-0 right-0 bottom-0 flex flex-col bg-white border-l border-mileway-border z-30 animate-slide-in-right-overlay"
      style={{ width: 300, boxShadow: '-4px 0 20px rgba(0,0,0,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-mileway-border flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-mileway-text">Team</span>
            {totalCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-mileway-grey/20 text-mileway-text leading-none">
                {totalCount}
              </span>
            )}
          </div>
          <p className="text-xs text-mileway-grey mt-0.5">
            {totalCount} member{totalCount !== 1 ? 's' : ''} · drag to assign
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close team drawer"
          className="p-1 rounded text-mileway-grey hover:bg-mileway-bg hover:text-mileway-text transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-mileway-border flex-shrink-0">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mileway-grey pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members…"
            aria-label="Search team members"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-mileway-border rounded-lg text-mileway-text placeholder:text-mileway-grey focus:outline-none focus:border-mileway-blue transition-colors duration-fast"
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 min-h-0">

        {/* IT TEAM — expanded by default */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-mileway-grey mb-2 px-0.5">
            IT Team {filteredIT.length > 0 && `(${filteredIT.length})`}
          </p>
          {filteredIT.length > 0 ? (
            <div className="space-y-1.5">
              {filteredIT.map(card => (
                <TeamMemberCard
                  key={card.id}
                  card={card}
                  activeMode={activeMode}
                  isFocused={focusedMemberId === card.id}
                  onBodyClick={() => handleBodyClick(card.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-mileway-grey italic px-0.5">
              {q ? 'No matches' : 'No IT members configured'}
            </p>
          )}
        </section>

        {/* BIZ CONTACTS — collapsed by default */}
        <section>
          <button
            type="button"
            onClick={() => setBizExpanded(v => !v)}
            className="w-full flex items-center gap-1.5 mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded"
            aria-expanded={bizExpanded}
          >
            {bizExpanded
              ? <ChevronDown size={12} className="text-mileway-grey flex-shrink-0" aria-hidden="true" />
              : <ChevronRight size={12} className="text-mileway-grey flex-shrink-0" aria-hidden="true" />
            }
            <span className="text-[10px] font-bold uppercase tracking-wider text-mileway-grey">
              BIZ Contacts {filteredBIZ.length > 0 && `(${filteredBIZ.length})`}
            </span>
          </button>

          {bizExpanded && (
            filteredBIZ.length > 0 ? (
              <div className="space-y-1.5">
                {filteredBIZ.map(card => (
                  <TeamMemberCard
                    key={card.id}
                    card={card}
                    activeMode={activeMode}
                    isFocused={focusedMemberId === card.id}
                    onBodyClick={() => handleBodyClick(card.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-mileway-grey italic px-0.5">
                {q ? 'No matches' : 'No BIZ contacts configured'}
              </p>
            )
          )}
        </section>

        {totalCount === 0 && (
          <p className="text-xs text-mileway-grey text-center py-8 italic">No people records found.</p>
        )}
      </div>
    </div>
  );
}
