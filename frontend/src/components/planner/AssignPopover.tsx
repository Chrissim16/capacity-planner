/**
 * AssignPopover — floating panel for assigning IT members and BIZ contacts to a PlannerItem.
 *
 * Portaled to document.body, auto-positioned via @floating-ui/react.
 * Covers SP-11 (member list + fit tiers), SP-12 (effort slider), SP-13 (removal).
 */

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useInteractions,
  FloatingFocusManager,
} from '@floating-ui/react';
import { X, Trash2, ChevronRight } from 'lucide-react';
import type { PlannerItem, PlannerAssignment } from '../../types';
import { useCurrentState } from '../../stores/appStore';
import {
  scoreMember,
  scoreBusinessContact,
  rankMemberFits,
  rankBizFits,
  FIT_COLOURS,
  type MemberFit,
  type BizFit,
} from '../../utils/staffing';
import { calculateCapacity } from '../../utils/capacity';
import { useToast } from '../ui/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssignPopoverProps {
  item: PlannerItem;
  anchorEl: HTMLElement;
  plannerItems: PlannerItem[];
  selectedQuarter: string;
  onItemsChange: (items: PlannerItem[]) => void;
  onClose: () => void;
  /** Pre-expand this member/contact's slider row (used by people-drawer drag-to-assign). */
  preSelectedMemberId?: string;
}

type TabId = 'it' | 'biz';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sum daysPerSprint committed to a member across all plannerItems that include the given sprint. */
function existingSprintLoad(
  memberId: string,
  sprintNum: number,
  plannerItems: PlannerItem[],
  excludeItemId: string,
): number {
  let total = 0;
  for (const p of plannerItems) {
    if (p.id === excludeItemId) continue;
    if (sprintNum < p.startSprint || sprintNum >= p.startSprint + p.spanSprints) continue;
    const a = p.assignees.find(a => a.memberId === memberId);
    if (a) total += a.daysPerSprint;
  }
  return total;
}

/** True when assigning `days` d/sprint to `memberId` on `item` would overload them in any sprint. */
function wouldOverload(
  memberId: string,
  days: number,
  item: PlannerItem,
  plannerItems: PlannerItem[],
  availPerSprint: number,
): boolean {
  for (let s = item.startSprint; s < item.startSprint + item.spanSprints; s++) {
    const existing = existingSprintLoad(memberId, s, plannerItems, item.id);
    if (existing + days > availPerSprint) return true;
  }
  return false;
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatSprintRange(startSprint: number, spanSprints: number): string {
  const end = startSprint + spanSprints - 1;
  return spanSprints === 1 ? `S${startSprint}` : `S${startSprint} – S${end}`;
}

const TYPE_PILL: Record<string, string> = {
  epic:      'bg-mileway-blue-10 text-mileway-blue',
  feature:   'bg-blue-50 text-blue-600',
  story:     'bg-gray-100 text-mileway-grey',
  task:      'bg-gray-100 text-mileway-grey',
  bug:       'bg-red-50 text-red-600',
  uat:       'bg-sky-50 text-sky-600',
  hypercare: 'bg-indigo-50 text-indigo-600',
};

// ── Avatar ─────────────────────────────────────────────────────────────────────

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

// ── EffortSlider ────────────────────────────────────────────────────────────────

interface EffortSliderProps {
  memberId: string;
  memberName: string;
  initialDays: number;
  item: PlannerItem;
  plannerItems: PlannerItem[];
  availPerSprint: number;
  isEdit: boolean;
  onConfirm: (days: number) => void;
  onCancel: () => void;
  onRemove?: () => void;
}

function EffortSlider({
  memberId,
  memberName: _memberName,
  initialDays,
  item,
  plannerItems,
  availPerSprint,
  isEdit,
  onConfirm,
  onCancel,
  onRemove,
}: EffortSliderProps) {
  const [days, setDays] = useState(initialDays);
  const overloaded = wouldOverload(memberId, days, item, plannerItems, availPerSprint);
  const totalDays = days * item.spanSprints;

  return (
    <div className="mt-2 pt-2 border-t border-mileway-divider space-y-2.5">
      {/* Slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-mileway-grey">
          <span>Effort</span>
          <span className="font-semibold text-mileway-text">{days} day{days !== 1 ? 's' : ''} / sprint</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="w-full accent-mileway-blue cursor-pointer"
          aria-label="Days per sprint"
        />
        <div className="flex justify-between text-[10px] text-mileway-grey">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      {/* Total */}
      <p className="text-xs text-mileway-grey">
        = <span className="font-semibold text-mileway-text">{totalDays}</span> days total across{' '}
        <span className="font-semibold text-mileway-text">{item.spanSprints}</span> sprint{item.spanSprints !== 1 ? 's' : ''}
      </p>

      {/* Capacity warning */}
      {overloaded && (
        <p className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1">
          ⚠ This would exceed available capacity in at least one sprint.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onConfirm(days)}
          className="flex-1 text-xs font-medium bg-mileway-blue text-white rounded px-3 py-1.5 hover:bg-mileway-blue/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
        >
          {isEdit ? 'Update' : 'Assign'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-xs font-medium text-mileway-grey border border-mileway-border rounded px-3 py-1.5 hover:bg-mileway-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
        >
          Cancel
        </button>
      </div>
      {isEdit && onRemove && (
        <button
          onClick={onRemove}
          className="w-full text-xs text-red-600 hover:text-red-700 hover:underline flex items-center justify-center gap-1 focus:outline-none"
        >
          <Trash2 size={11} />
          Remove assignment
        </button>
      )}
    </div>
  );
}

// ── MemberRow ──────────────────────────────────────────────────────────────────

interface MemberRowProps {
  name: string;
  subtitle: string;
  memberId: string;
  fitLevel: MemberFit['fitLevel'] | BizFit['fitLevel'];
  availableDays: number;
  isAssigned: boolean;
  currentDays: number | null;
  isExpanded: boolean;
  item: PlannerItem;
  plannerItems: PlannerItem[];
  availPerSprint: number;
  onToggle: () => void;
  onConfirm: (days: number) => void;
  onRemove: () => void;
}

function MemberRow({
  name,
  subtitle,
  memberId,
  fitLevel,
  availableDays,
  isAssigned,
  currentDays,
  isExpanded,
  item,
  plannerItems,
  availPerSprint,
  onToggle,
  onConfirm,
  onRemove,
}: MemberRowProps) {
  const fitCls = FIT_COLOURS[fitLevel];

  return (
    <div
      className={[
        'rounded-lg border px-3 py-2 transition-colors duration-fast cursor-pointer',
        isAssigned
          ? 'border-mileway-blue/30 bg-mileway-blue-10/40'
          : 'border-mileway-border bg-white hover:bg-mileway-bg',
      ].join(' ')}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onToggle()}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar name={name} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-mileway-text truncate">{name}</span>
            {isAssigned && (
              <span className="flex-shrink-0 text-[10px] font-semibold bg-mileway-blue text-white rounded px-1.5 py-0.5">
                Assigned
              </span>
            )}
          </div>
          <span className="text-[11px] text-mileway-grey truncate block">{subtitle}</span>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
          {isAssigned && currentDays !== null ? (
            <span className="text-[11px] font-semibold text-mileway-text">{currentDays}d/sp</span>
          ) : (
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${fitCls.badge}`}>
              {availableDays > 0 ? `${Math.round(availableDays)}d avail` : 'Full'}
            </span>
          )}
          <ChevronRight
            size={12}
            className={`text-mileway-grey transition-transform duration-fast ${isExpanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {isExpanded && (
        <EffortSlider
          memberId={memberId}
          memberName={name}
          initialDays={currentDays ?? Math.min(3, Math.max(1, Math.floor(availPerSprint)))}
          item={item}
          plannerItems={plannerItems}
          availPerSprint={availPerSprint}
          isEdit={isAssigned}
          onConfirm={onConfirm}
          onCancel={onToggle}
          onRemove={isAssigned ? onRemove : undefined}
        />
      )}
    </div>
  );
}

// ── AssignPopover ─────────────────────────────────────────────────────────────

export function AssignPopover({
  item,
  anchorEl,
  plannerItems,
  selectedQuarter,
  onItemsChange,
  onClose,
  preSelectedMemberId,
}: AssignPopoverProps) {
  const state = useCurrentState();
  const { showToast } = useToast();

  const [tab, setTab] = useState<TabId>('it');
  const [expandedId, setExpandedId] = useState<string | null>(preSelectedMemberId ?? null);
  const [open] = useState(true);

  // Floating-ui setup
  const { refs, floatingStyles, context } = useFloating({
    elements: { reference: anchorEl },
    open,
    onOpenChange: v => { if (!v) onClose(); },
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] }),
      shift({ padding: 8 }),
    ],
  });

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const { getFloatingProps } = useInteractions([dismiss]);

  // Expand pre-selected member when prop changes
  useEffect(() => {
    if (preSelectedMemberId) setExpandedId(preSelectedMemberId);
  }, [preSelectedMemberId]);

  // Quarter sprints for per-sprint capacity calculation
  const quarterSprints = useMemo(
    () => state.sprints.filter(s => s.quarter === selectedQuarter),
    [state.sprints, selectedQuarter],
  );
  const sprintsInQuarter = Math.max(1, quarterSprints.length);

  // Scored + ranked IT members
  const itFits = useMemo(() => {
    const eligible = state.teamMembers.filter(m => !m.excludedFromCapacity);
    const fits = eligible.map(m => scoreMember(m, selectedQuarter, [], item.jiraKey ?? item.id, state));
    return rankMemberFits(fits);
  }, [state, selectedQuarter, item.id, item.jiraKey]);

  // Scored + ranked BIZ contacts
  const bizFits = useMemo(() => {
    const eligible = (state.businessContacts ?? []).filter(c => !c.archived && !c.excludedFromCapacity);
    const fits = eligible.map(c => scoreBusinessContact(c, selectedQuarter, item.jiraKey ?? item.id, state));
    return rankBizFits(fits);
  }, [state, selectedQuarter, item.id, item.jiraKey]);

  // Per-sprint available days for a given member (quarterly avail / sprints in quarter)
  function getAvailPerSprint(memberId: string, isBiz: boolean): number {
    if (isBiz) {
      const fit = bizFits.find(f => f.contact.id === memberId);
      return Math.max(0, (fit?.availableDays ?? 0) / sprintsInQuarter);
    }
    try {
      const result = calculateCapacity(memberId, selectedQuarter, state);
      return Math.max(0, result.availableDays / sprintsInQuarter);
    } catch {
      return 0;
    }
  }

  // Separate already-assigned from unassigned for the current tab
  const assignedIds = new Set(
    item.assignees.filter(a => a.track === (tab === 'it' ? 'IT' : 'BIZ')).map(a => a.memberId),
  );

  const fits = tab === 'it' ? itFits : bizFits;

  // Partition: assigned rows on top, then tier sections
  const assignedFits = fits.filter(f => {
    const id = tab === 'it' ? (f as MemberFit).member.id : (f as BizFit).contact.id;
    return assignedIds.has(id);
  });
  const unassignedFits = fits.filter(f => {
    const id = tab === 'it' ? (f as MemberFit).member.id : (f as BizFit).contact.id;
    return !assignedIds.has(id);
  });

  // Toggle row expand; if closing an already-open row, also close
  function toggleRow(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  // Confirm an assignment (add or update)
  function handleConfirm(memberId: string, days: number, isBiz: boolean) {
    const track: PlannerAssignment['track'] = isBiz ? 'BIZ' : 'IT';
    const newAssignment: PlannerAssignment = { memberId, track, daysPerSprint: days };
    const updated: PlannerItem = {
      ...item,
      assignees: [
        ...item.assignees.filter(a => a.memberId !== memberId),
        newAssignment,
      ],
    };
    onItemsChange(plannerItems.map(p => p.id === item.id ? updated : p));
    setExpandedId(null); // close the slider after confirming
  }

  // Remove an assignment (SP-13)
  function handleRemove(memberId: string, memberName: string) {
    const snapshot = item.assignees;
    const updated: PlannerItem = {
      ...item,
      assignees: item.assignees.filter(a => a.memberId !== memberId),
    };
    onItemsChange(plannerItems.map(p => p.id === item.id ? updated : p));
    setExpandedId(null);
    showToast(`Removed ${memberName} from "${item.name}"`, {
      type: 'info',
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          onItemsChange(plannerItems.map(p =>
            p.id === item.id ? { ...item, assignees: snapshot } : p,
          ));
        },
      },
    });
  }

  // Render a single member row (IT or BIZ)
  function renderRow(fit: MemberFit | BizFit) {
    const isBiz = tab === 'biz';
    const memberId = isBiz ? (fit as BizFit).contact.id : (fit as MemberFit).member.id;
    const name     = isBiz ? (fit as BizFit).contact.name : (fit as MemberFit).member.name;
    const subtitle = isBiz
      ? ((fit as BizFit).contact.title ?? (fit as BizFit).contact.department ?? 'BIZ Contact')
      : ((fit as MemberFit).member.role ?? '');
    const assigned    = assignedIds.has(memberId);
    const assignment  = item.assignees.find(a => a.memberId === memberId);
    const availPerSp  = getAvailPerSprint(memberId, isBiz);

    return (
      <MemberRow
        key={memberId}
        name={name}
        subtitle={subtitle}
        memberId={memberId}
        fitLevel={fit.fitLevel}
        availableDays={fit.availableDays}
        isAssigned={assigned}
        currentDays={assignment?.daysPerSprint ?? null}
        isExpanded={expandedId === memberId}
        item={item}
        plannerItems={plannerItems}
        availPerSprint={availPerSp}
        onToggle={() => toggleRow(memberId)}
        onConfirm={days => handleConfirm(memberId, days, isBiz)}
        onRemove={() => handleRemove(memberId, name)}
      />
    );
  }

  // Group unassigned fits by tier
  const goodFits    = unassignedFits.filter(f => f.fitLevel === 'good');
  const partialFits = unassignedFits.filter(f => f.fitLevel === 'partial');
  const overFits    = unassignedFits.filter(f => f.fitLevel === 'over');

  const popover = (
    <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
      <div
        ref={refs.setFloating}
        style={{ ...floatingStyles, zIndex: 9999, width: 340 }}
        className="bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-mileway-border flex flex-col"
        {...getFloatingProps()}
      >
        {/* Header */}
        <div className="flex items-start gap-2 px-4 pt-4 pb-3 border-b border-mileway-divider flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${TYPE_PILL[item.type] ?? TYPE_PILL.story}`}>
                {item.type}
              </span>
              <span className="text-[11px] text-mileway-grey font-medium">
                {formatSprintRange(item.startSprint, item.spanSprints)}
              </span>
              {item.jiraKey && (
                <span className="text-[11px] text-mileway-grey">{item.jiraKey}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-mileway-text leading-snug line-clamp-2">{item.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 p-1 rounded hover:bg-mileway-bg text-mileway-grey hover:text-mileway-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mileway-divider flex-shrink-0">
          {(['it', 'biz'] as TabId[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setExpandedId(null); }}
              className={[
                'flex-1 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-mileway-blue',
                tab === t
                  ? 'text-mileway-blue border-b-2 border-mileway-blue'
                  : 'text-mileway-grey hover:text-mileway-text',
              ].join(' ')}
            >
              {t === 'it' ? 'IT Team' : 'BIZ Contacts'}
            </button>
          ))}
        </div>

        {/* Member list */}
        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-2" style={{ maxHeight: 380 }}>
          {/* Assigned section */}
          {assignedFits.length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mileway-grey mb-1.5 px-0.5">
                Assigned ({assignedFits.length})
              </p>
              <div className="space-y-1.5">
                {assignedFits.map(renderRow)}
              </div>
            </section>
          )}

          {/* Good fit tier */}
          {goodFits.length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1.5 px-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                Good fit
              </p>
              <div className="space-y-1.5">
                {goodFits.map(renderRow)}
              </div>
            </section>
          )}

          {/* Partial fit tier */}
          {partialFits.length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1.5 px-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                Partial fit
              </p>
              <div className="space-y-1.5">
                {partialFits.map(renderRow)}
              </div>
            </section>
          )}

          {/* Over capacity tier */}
          {overFits.length > 0 && (
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1.5 px-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                Over capacity
              </p>
              <div className="space-y-1.5">
                {overFits.map(renderRow)}
              </div>
            </section>
          )}

          {fits.length === 0 && (
            <p className="text-xs text-mileway-grey text-center py-6 italic">
              No {tab === 'it' ? 'team members' : 'BIZ contacts'} found.
            </p>
          )}
        </div>
      </div>
    </FloatingFocusManager>
  );

  return createPortal(popover, document.body);
}
