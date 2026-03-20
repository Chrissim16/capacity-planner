/**
 * SmartAssignmentPanel — US-061
 *
 * Ranks all active team members by fit (capacity + skills) for a given project/quarter
 * and allows one-click assignment. Available in two variants:
 *   - slideOut: right-side overlay panel with header and close button (used on Projects page)
 *   - inline:   embedded in a parent (used in ScenarioWizard Step 3)
 */

import { useState, useMemo, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, Users, Building2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useCurrentState } from '../stores/appStore';
import { addAssignment } from '../stores/actions';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { scoreMember, scoreBusinessContact, rankMemberFits, rankBizFits, FIT_COLOURS } from '../utils/staffing';
import type { TentativeAssignment } from '../utils/staffing';
import { ProgressBar } from './ui/ProgressBar';
import { Button } from './ui/Button';
import { getCurrentQuarter } from '../utils/calendar';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SmartAssignmentPanelProps {
  projectId: string;
  projectName: string;
  defaultQuarter?: string;
  variant: 'slideOut' | 'inline';
  requiredSkillIds?: string[];
  tentativeAssignments?: TentativeAssignment[];
  onTentativeAssign?: (memberId: string, days: number) => void;
  onTentativeRemove?: (memberId: string) => void;
  onClose?: () => void;
  /** Inline variant only: renders a "View epic →" link in the panel header */
  onOpenDetail?: (jiraKey: string) => void;
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

interface MemberRowProps {
  fit: ReturnType<typeof rankMemberFits>[number];
  quarter: string;
  canAssign: boolean;
  onAssign: (memberId: string, days: number) => Promise<void>;
  assigningId: string | null;
}

function MemberRow({ fit, quarter: _quarter, canAssign, onAssign, assigningId }: MemberRowProps) {
  const [days, setDays] = useState(() => Math.max(1, Math.min(5, fit.availableDays)));
  const { member, fitLevel, availableDays, usedPercent, skillMatch, skillGap, existingDays } = fit;
  const colours = FIT_COLOURS[fitLevel];
  const isOverbooked = days > availableDays && availableDays > 0;
  const isAssigning = assigningId === member.id;

  const handleDaysChange = (v: string) => {
    const n = parseInt(v, 10);
    setDays(isNaN(n) ? 0 : n);
  };

  return (
    <div className="py-3 border-b border-[#DEDFE3] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#1E293B] truncate">{member.name}</span>
            <span className="text-xs text-[#94A3B8]">{member.role}</span>
            <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0', colours.badge)}>
              {fitLevel}
            </span>
          </div>

          {/* Mini capacity bar (D8) */}
          <div className="mt-1.5">
            <ProgressBar
              value={usedPercent}
              max={100}
              size="sm"
              className="w-full"
            />
            <span className="text-xs text-[#94A3B8] mt-0.5 block">
              {availableDays > 0 ? `${availableDays}d available` : 'No capacity'}
            </span>
          </div>

          {/* Skill match / gap */}
          {(skillMatch.length > 0 || skillGap.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {skillMatch.map(s => (
                <span key={s} className="text-xs text-[#16A34A] bg-green-50 px-1.5 py-0.5 rounded">✓ {s}</span>
              ))}
              {skillGap.map(s => (
                <span key={s} className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">✗ {s}</span>
              ))}
            </div>
          )}

          {/* Already assigned badge (D7) */}
          {existingDays > 0 && (
            <p className="text-xs text-[#94A3B8] mt-1">Already assigned: {existingDays}d</p>
          )}
        </div>

        {/* Assignment controls */}
        {canAssign && fitLevel !== 'over' && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={days}
                  onChange={e => handleDaysChange(e.target.value)}
                  className={clsx(
                    'w-16 h-8 text-center text-sm rounded-lg border px-2',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD]',
                    isOverbooked
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-[#DEDFE3] bg-white'
                  )}
                  aria-label={`Days for ${member.name}`}
                />
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={days <= 0 || isNaN(days) || isAssigning}
                isLoading={isAssigning}
                onClick={() => onAssign(member.id, days)}
                className="whitespace-nowrap"
              >
                {existingDays > 0 ? 'Add more' : 'Assign'}
              </Button>
            </div>
            {isOverbooked && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle size={11} />
                <span className="text-xs">Overbooked</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BizRow ───────────────────────────────────────────────────────────────────

interface BizRowProps {
  fit: ReturnType<typeof rankBizFits>[number];
  quarter: string;
  canAssign: boolean;
  onAssign: (contactId: string, days: number) => Promise<void>;
  assigningId: string | null;
}

function BizRow({ fit, canAssign, onAssign, assigningId }: BizRowProps) {
  const [days, setDays] = useState(() => Math.max(1, Math.min(5, fit.availableDays)));
  const { contact, fitLevel, availableDays, usedPercent, existingDays } = fit;
  const colours = FIT_COLOURS[fitLevel];
  const isOverbooked = days > availableDays && availableDays > 0;
  const isAssigning = assigningId === contact.id;

  return (
    <div className="py-3 border-b border-[#DEDFE3] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#1E293B] truncate">{contact.name}</span>
            {contact.title && <span className="text-xs text-[#94A3B8]">{contact.title}</span>}
            <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0', colours.badge)}>
              {fitLevel}
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={usedPercent} max={100} size="sm" />
            <span className="text-xs text-[#94A3B8] mt-0.5 block">
              {availableDays > 0 ? `${availableDays}d available` : 'No capacity'}
            </span>
          </div>
          {existingDays > 0 && (
            <p className="text-xs text-[#94A3B8] mt-1">Already assigned: {existingDays}d</p>
          )}
        </div>

        {canAssign && fitLevel !== 'over' && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={999}
                value={days}
                onChange={e => setDays(parseInt(e.target.value, 10) || 0)}
                className={clsx(
                  'w-16 h-8 text-center text-sm rounded-lg border px-2',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD]',
                  isOverbooked ? 'border-amber-400 bg-amber-50' : 'border-[#DEDFE3] bg-white'
                )}
                aria-label={`Days for ${contact.name}`}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={days <= 0 || isNaN(days) || isAssigning}
                isLoading={isAssigning}
                onClick={() => onAssign(contact.id, days)}
                className="whitespace-nowrap text-[#94A3B8] border-[#DEDFE3] hover:bg-[#F0F2F5]"
              >
                {existingDays > 0 ? 'Add more' : 'Assign'}
              </Button>
            </div>
            {isOverbooked && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle size={11} />
                <span className="text-xs">Overbooked</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SmartAssignmentPanel ─────────────────────────────────────────────────────

export function SmartAssignmentPanel({
  projectId,
  projectName,
  defaultQuarter,
  variant,
  requiredSkillIds = [],
  tentativeAssignments = [],
  onTentativeAssign,
  onTentativeRemove,
  onClose,
  onOpenDetail,
}: SmartAssignmentPanelProps) {
  const currentState = useCurrentState();
  const { can } = useCurrentUser();
  const canAssign = can('edit_assignments');

  const [quarter, setQuarter] = useState(defaultQuarter ?? getCurrentQuarter());
  const [bizOpen, setBizOpen] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Memoised fit scoring — state is a dep so it re-scores when the store updates
  const { itFits, bizFits } = useMemo(() => {
    const itFits = rankMemberFits(
      currentState.teamMembers
        .filter(m => m.maxConcurrentProjects !== undefined || true) // all members
        .filter(m => !m.excludedFromCapacity)
        .map(m => scoreMember(m, quarter, requiredSkillIds, projectId, currentState, tentativeAssignments))
    );
    const bizFits = rankBizFits(
      currentState.businessContacts
        .filter(c => !c.excludedFromCapacity && !c.archived)
        .map(c => scoreBusinessContact(c, quarter, projectId, currentState, tentativeAssignments))
    );
    return { itFits, bizFits };
  }, [currentState, quarter, requiredSkillIds, projectId, tentativeAssignments]);

  const handleAssignIT = useCallback(async (memberId: string, days: number) => {
    setAssigningId(memberId);
    try {
      if (variant === 'inline' && onTentativeAssign) {
        onTentativeAssign(memberId, days);
      } else {
        addAssignment({ memberId, projectId, quarter, days, isBizContact: false });
      }
    } finally {
      setAssigningId(null);
    }
  }, [variant, onTentativeAssign, projectId, quarter]);

  const handleAssignBiz = useCallback(async (contactId: string, days: number) => {
    setAssigningId(contactId);
    try {
      if (variant === 'inline' && onTentativeAssign) {
        onTentativeAssign(contactId, days);
      } else {
        addAssignment({ memberId: contactId, projectId, quarter, days, isBizContact: true });
      }
    } finally {
      setAssigningId(null);
    }
  }, [variant, onTentativeAssign, projectId, quarter]);

  const availableQuarters = currentState.quarters;

  const content = (
    <div className="flex flex-col h-full">
      {/* Quarter selector */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">Quarter</label>
        <select
          value={quarter}
          onChange={e => setQuarter(e.target.value)}
          className="text-sm border border-[#DEDFE3] rounded-lg px-2 py-1 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD] text-[#1E293B]"
          aria-label="Select quarter"
        >
          {availableQuarters.map(q => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>
      </div>

      {/* IT Team section */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} className="text-[#0089DD]" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">IT Team</h3>
        </div>

        {itFits.length === 0 ? (
          <p className="text-sm text-[#94A3B8] py-4 text-center">No active team members</p>
        ) : (
          <div>
            {itFits.map(fit => (
              <MemberRow
                key={fit.member.id}
                fit={fit}
                quarter={quarter}
                canAssign={canAssign}
                onAssign={handleAssignIT}
                assigningId={assigningId}
              />
            ))}
          </div>
        )}

        {/* BIZ contacts — collapsible, collapsed by default (D2) */}
        {bizFits.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setBizOpen(o => !o)}
              className="flex items-center gap-2 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD] rounded"
              aria-expanded={bizOpen}
            >
              {bizOpen ? <ChevronDown size={14} className="text-[#94A3B8]" /> : <ChevronRight size={14} className="text-[#94A3B8]" />}
              <Building2 size={14} className="text-[#94A3B8]" />
              <span className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">
                Business Contacts
              </span>
            </button>

            {bizOpen && (
              <div className="mt-2">
                {bizFits.map(fit => (
                  <BizRow
                    key={fit.contact.id}
                    fit={fit}
                    quarter={quarter}
                    canAssign={canAssign}
                    onAssign={handleAssignBiz}
                    assigningId={assigningId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tentative assignment chips (inline variant) */}
        {variant === 'inline' && tentativeAssignments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#DEDFE3]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">Tentatively assigned</p>
            <div className="flex flex-wrap gap-2">
              {tentativeAssignments.map(ta => {
                const member = currentState.teamMembers.find(m => m.id === ta.memberId)
                  ?? currentState.businessContacts.find(c => c.id === ta.memberId);
                const name = member ? ('name' in member ? member.name : '') : ta.memberId;
                return (
                  <span
                    key={ta.memberId}
                    className="inline-flex items-center gap-1.5 text-xs bg-[#F0F2F5] text-[#1E293B] rounded-full px-2.5 py-1"
                  >
                    {name} · {ta.days}d
                    {onTentativeRemove && (
                      <button
                        onClick={() => onTentativeRemove(ta.memberId)}
                        className="text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                        aria-label={`Remove ${name}`}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Inline variant ──────────────────────────────────────────────────────────
  if (variant === 'inline') {
    const showInlineHeader = !!(onClose || onOpenDetail);
    return (
      <div className="flex flex-col bg-white h-full">
        {showInlineHeader && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#DEDFE3] flex-shrink-0">
            <p className="text-sm font-semibold text-[#1E293B] truncate flex-1">{projectName}</p>
            {onOpenDetail && (
              <button
                onClick={() => onOpenDetail(projectId)}
                className="text-xs text-[#94A3B8] hover:text-[#0089DD] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD] rounded px-1"
              >
                View epic →
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="p-1 rounded text-[#94A3B8] hover:text-[#1E293B] hover:bg-[#F0F2F5] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <div className="p-4 flex-1 overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  // ── SlideOut variant ────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-40 flex"
      role="dialog"
      aria-modal="true"
      aria-label={`Staff: ${projectName}`}
    >
      {/* Backdrop */}
      <div
        className="flex-1 bg-[#1E293B]/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="w-96 max-w-full bg-white shadow-xl border-l border-[#DEDFE3] flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DEDFE3]">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#94A3B8]">Staff this project</p>
            <h2 className="text-base font-semibold text-[#1E293B] truncate mt-0.5">{projectName}</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#94A3B8] hover:bg-[#F0F2F5] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD]"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {content}
        </div>
      </div>
    </div>
  );
}
