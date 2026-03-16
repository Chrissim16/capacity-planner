/**
 * AssignPopover — search + days input for "+ Assign person/project" actions.
 *
 * In People view: searches projects (IT or BIZ) to assign to a person.
 * In Projects view: searches members (IT) ranked by available capacity using scoreMember.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useCurrentState } from '../../stores/appStore';
import { scoreMember } from '../../utils/staffing';
import { Accent, Background, Border, Text, Semantic, Biz } from '../../theme/tokens';
import type { Project, TeamMember } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AssignMode = 'project' | 'person';

interface AssignProjectResult {
  type: 'project';
  project: Project;
}

interface AssignPersonResult {
  type: 'person';
  member: TeamMember;
  availableDays: number;
  usedPercent: number;
}

type AssignResult = AssignProjectResult | AssignPersonResult;

interface AssignPopoverProps {
  mode: AssignMode;
  quarter: string;
  /** In People view: the memberId this will be assigned to (used to filter out already-assigned projects) */
  memberId?: string;
  /** In Projects view: the projectId this will be assigned from (used to filter out already-assigned members) */
  projectId?: string;
  /** IDs of projects already assigned in this quarter for this member (People view) */
  assignedProjectIds?: Set<string>;
  /** IDs of members already assigned in this quarter for this project (Projects view) */
  assignedMemberIds?: Set<string>;
  onAssign: (targetId: string, days: number) => void;
  onClose: () => void;
}

const DEFAULT_DAYS = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AssignPopover({
  mode,
  quarter,
  assignedProjectIds,
  assignedMemberIds,
  onAssign,
  onClose,
}: AssignPopoverProps) {
  const state = useCurrentState();
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [selected, setSelected] = useState<AssignResult | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search on mount
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Close on click outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Build the result list
  const results = useMemo<AssignResult[]>(() => {
    const q = search.toLowerCase();

    if (mode === 'project') {
      // Show projects not yet assigned to this member in this quarter
      return (state.projects ?? [])
        .filter(p => {
          if (assignedProjectIds?.has(p.id)) return false;
          if (q && !p.name.toLowerCase().includes(q)) return false;
          return true;
        })
        .map(p => ({ type: 'project' as const, project: p }));
    } else {
      // Show members ranked by available capacity
      const members = state.teamMembers.filter(m => {
        if (m.excludedFromCapacity) return false;
        if (assignedMemberIds?.has(m.id)) return false;
        if (q && !m.name.toLowerCase().includes(q)) return false;
        return true;
      });

      return members
        .map(m => {
          const fit = scoreMember(m, quarter, [], '', state, []);
          return {
            type: 'person' as const,
            member: m,
            availableDays: fit.availableDays,
            usedPercent: fit.usedPercent,
          };
        })
        .sort((a, b) => b.availableDays - a.availableDays);
    }
  }, [mode, search, state, assignedProjectIds, assignedMemberIds, quarter]);

  const handleConfirm = useCallback(() => {
    if (!selected || days <= 0) return;
    const targetId = selected.type === 'project' ? selected.project.id : selected.member.id;
    onAssign(targetId, days);
    onClose();
  }, [selected, days, onAssign, onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute z-30 rounded-xl shadow-xl border overflow-hidden"
      style={{
        backgroundColor: Background.card,
        borderColor: Border.subtle,
        width: 280,
        top: '100%',
        left: 0,
        marginTop: 4,
      }}
      role="dialog"
      aria-label={mode === 'project' ? 'Assign project' : 'Assign person'}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: Border.subtle }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: Text.tertiary }}>
          {mode === 'project' ? 'Assign Project' : 'Assign Person'}
        </span>
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#F5F3F0] focus:ring-2 focus:ring-sana-teal"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={13} style={{ color: Text.tertiary }} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b" style={{ borderColor: Border.subtle }}>
        <div className="flex items-center gap-2">
          <Search size={13} style={{ color: Text.tertiary }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={mode === 'project' ? 'Search projects…' : 'Search people…'}
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: Text.primary }}
            aria-label={mode === 'project' ? 'Search projects' : 'Search people'}
          />
        </div>
      </div>

      {/* Results list */}
      <div className="max-h-48 overflow-y-auto">
        {results.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs" style={{ color: Text.tertiary }}>
            No {mode === 'project' ? 'projects' : 'people'} found
          </div>
        ) : (
          results.map((r) => {
            const id = r.type === 'project' ? r.project.id : r.member.id;
            const isSelected = selected
              ? (selected.type === 'project'
                  ? selected.project.id === id
                  : selected.member.id === id)
              : false;

            return (
              <button
                key={id}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-[#E8F8F8]'
                    : 'hover:bg-[#F5F3F0]'
                )}
                onClick={() => setSelected(r)}
                aria-pressed={isSelected}
              >
                {r.type === 'project' ? (
                  <span className="truncate" style={{ color: Text.primary }}>{r.project.name}</span>
                ) : (
                  <>
                    <span className="truncate" style={{ color: Text.primary }}>{r.member.name}</span>
                    <span
                      className="text-xs shrink-0 ml-2"
                      style={{ color: r.availableDays > 0 ? Semantic.success : Semantic.danger }}
                    >
                      {r.availableDays}d free
                    </span>
                  </>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Days + confirm */}
      {selected && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-t"
          style={{ borderColor: Border.subtle, backgroundColor: Background.secondary }}
        >
          <span className="text-xs shrink-0" style={{ color: Text.secondary }}>Days</span>
          <input
            type="number"
            min={1}
            max={999}
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            className="w-16 border rounded px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-sana-teal"
            style={{ borderColor: Border.subtle, color: Text.primary }}
          />
          <button
            className="ml-auto px-3 py-1 rounded-lg text-xs font-medium text-white focus:ring-2 focus:ring-sana-teal"
            style={{ backgroundColor: Accent.teal }}
            onClick={handleConfirm}
          >
            Assign
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ITBizBadge — small badge used in person rows
// ─────────────────────────────────────────────────────────────────────────────

interface ITBizBadgeProps {
  type: 'it' | 'biz';
}

export function ITBizBadge({ type }: ITBizBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded text-[9px] font-semibold px-1 py-0.5 uppercase tracking-wide"
      style={
        type === 'it'
          ? { backgroundColor: '#E8F8F8', color: Accent.teal }
          : { backgroundColor: Biz.mid, color: Biz.DEFAULT }
      }
    >
      {type === 'it' ? 'IT' : 'BIZ'}
    </span>
  );
}
