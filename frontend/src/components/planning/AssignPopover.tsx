/**
 * AssignPopover — search + days/dates input for assignment actions.
 *
 * In People view: searches projects (IT or BIZ) to assign to a person.
 * In Projects view: searches members (IT) ranked by available capacity using scoreMember.
 *
 * v2.1: Adds "By days" / "By dates" mode toggle. In "By dates" mode the user picks
 * start + end dates, and days are computed automatically from the working-day range.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useCurrentState } from '../../stores/appStore';
import { scoreMember } from '../../utils/staffing';
import { getWorkdaysInDateRange } from '../../utils/calendar';
import { Accent, Background, Border, Text, Semantic, Biz } from '../../theme/tokens';
import type { JiraWorkItem, Project, TeamMember } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AssignMode = 'project' | 'person';
export type AssignInputMode = 'days' | 'dates';

interface AssignProjectResult {
  type: 'project';
  project: Project;
}

interface AssignJiraResult {
  type: 'jira';
  item: JiraWorkItem;
}

interface AssignPersonResult {
  type: 'person';
  member: TeamMember;
  availableDays: number;
  usedPercent: number;
}

type AssignResult = AssignProjectResult | AssignJiraResult | AssignPersonResult;

export interface AssignPopoverProps {
  mode: AssignMode;
  quarter: string;
  /** In People view: the memberId this will be assigned to */
  memberId?: string;
  /** In Projects view: the projectId this will be assigned from */
  projectId?: string;
  /** IDs of projects already assigned in this quarter for this member (People view) */
  assignedProjectIds?: Set<string>;
  /** IDs of members already assigned in this quarter for this project (Projects view) */
  assignedMemberIds?: Set<string>;
  onAssign: (targetId: string, days: number, startDate?: string, endDate?: string) => void;
  onClose: () => void;
}

const DEFAULT_DAYS = 10;

/** Derives a quarter string from an ISO date, e.g. "2026-03-15" → "Q1 2026" */
function dateToQuarter(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

/** Today's date as YYYY-MM-DD */
function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

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
  const [inputMode, setInputMode] = useState<AssignInputMode>('days');
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(() => {
    // Default end = 2 weeks after start
    const d = new Date();
    d.setDate(d.getDate() + 13);
    return d.toISOString().split('T')[0];
  });
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Computed days from date range (read-only in "by dates" mode)
  const computedDays = useMemo(() => {
    if (inputMode !== 'dates' || !startDate || !endDate) return days;
    return getWorkdaysInDateRange(startDate, endDate);
  }, [inputMode, startDate, endDate, days]);

  const derivedQuarter = useMemo(() => {
    if (inputMode === 'dates' && startDate) return dateToQuarter(startDate);
    return quarter;
  }, [inputMode, startDate, quarter]);

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
      const nativeResults: AssignResult[] = (state.projects ?? [])
        .filter(p => {
          if (assignedProjectIds?.has(p.id)) return false;
          if (q && !p.name.toLowerCase().includes(q)) return false;
          return true;
        })
        .map(p => ({ type: 'project' as const, project: p }));

      const jiraResults: AssignResult[] = (state.jiraWorkItems ?? [])
        .filter(w => {
          if (w.type !== 'epic') return false;
          if (w.statusCategory === 'done') return false;
          if (assignedProjectIds?.has(w.jiraKey)) return false;
          if (q && !w.summary.toLowerCase().includes(q) && !w.jiraKey.toLowerCase().includes(q)) return false;
          return true;
        })
        .map(w => ({ type: 'jira' as const, item: w }));

      return [...nativeResults, ...jiraResults];
    } else {
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
    if (!selected) return;
    const effectiveDays = inputMode === 'dates' ? computedDays : days;
    if (effectiveDays <= 0) return;
    let targetId: string;
    if (selected.type === 'project') targetId = selected.project.id;
    else if (selected.type === 'jira') targetId = selected.item.jiraKey;
    else targetId = selected.member.id;
    onAssign(
      targetId,
      effectiveDays,
      inputMode === 'dates' ? startDate : undefined,
      inputMode === 'dates' ? endDate : undefined,
    );
    onClose();
  }, [selected, days, inputMode, computedDays, startDate, endDate, onAssign, onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute z-30 rounded-xl shadow-xl border overflow-hidden"
      style={{
        backgroundColor: Background.card,
        borderColor: Border.subtle,
        width: 300,
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
            const id = r.type === 'project'
              ? r.project.id
              : r.type === 'jira'
                ? r.item.jiraKey
                : r.member.id;

            const isSelected = selected
              ? (selected.type === 'project' ? selected.project.id === id
                : selected.type === 'jira' ? selected.item.jiraKey === id
                : selected.member.id === id)
              : false;

            return (
              <button
                key={id}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                  isSelected ? 'bg-[#E8F8F8]' : 'hover:bg-[#F5F3F0]'
                )}
                onClick={() => setSelected(r)}
                aria-pressed={isSelected}
              >
                {r.type === 'project' ? (
                  <span className="truncate" style={{ color: Text.primary }}>{r.project.name}</span>
                ) : r.type === 'jira' ? (
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate text-sm" style={{ color: Text.primary }}>{r.item.summary}</span>
                    <span className="text-[10px]" style={{ color: Text.tertiary }}>{r.item.jiraKey}</span>
                  </div>
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

      {/* Days / dates input */}
      {selected && (
        <div
          className="border-t"
          style={{ borderColor: Border.subtle, backgroundColor: Background.secondary }}
        >
          {/* Input mode toggle */}
          <div className="flex items-center gap-0 px-3 pt-2.5 pb-1">
            <button
              className={clsx(
                'px-2.5 py-1 text-[11px] font-medium rounded-l-md border transition-colors focus:ring-2 focus:ring-inset focus:ring-sana-teal',
                inputMode === 'days'
                  ? 'text-white'
                  : 'hover:bg-[#F5F3F0]'
              )}
              style={
                inputMode === 'days'
                  ? { backgroundColor: Accent.teal, borderColor: Accent.teal, color: '#fff' }
                  : { borderColor: Border.subtle, color: Text.secondary, backgroundColor: Background.card }
              }
              onClick={() => setInputMode('days')}
              aria-pressed={inputMode === 'days'}
            >
              By days
            </button>
            <button
              className={clsx(
                'px-2.5 py-1 text-[11px] font-medium rounded-r-md border-t border-b border-r transition-colors focus:ring-2 focus:ring-inset focus:ring-sana-teal',
                inputMode === 'dates'
                  ? 'text-white'
                  : 'hover:bg-[#F5F3F0]'
              )}
              style={
                inputMode === 'dates'
                  ? { backgroundColor: Accent.teal, borderColor: Accent.teal, color: '#fff' }
                  : { borderColor: Border.subtle, color: Text.secondary, backgroundColor: Background.card }
              }
              onClick={() => setInputMode('dates')}
              aria-pressed={inputMode === 'dates'}
            >
              By dates
            </button>
          </div>

          {/* By days inputs */}
          {inputMode === 'days' && (
            <div className="flex items-center gap-2 px-3 pb-2.5">
              <span className="text-xs shrink-0" style={{ color: Text.secondary }}>Days</span>
              <input
                type="number"
                min={1}
                max={999}
                value={days}
                onChange={(e) => setDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                className="w-16 border rounded px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-sana-teal"
                style={{ borderColor: Border.subtle, color: Text.primary, backgroundColor: Background.card }}
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

          {/* By dates inputs */}
          {inputMode === 'dates' && (
            <div className="px-3 pb-2.5 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs shrink-0 w-12" style={{ color: Text.secondary }}>Start</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sana-teal"
                  style={{ borderColor: Border.subtle, color: Text.primary, backgroundColor: Background.card }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs shrink-0 w-12" style={{ color: Text.secondary }}>End</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-sana-teal"
                  style={{ borderColor: Border.subtle, color: Text.primary, backgroundColor: Background.card }}
                />
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px]" style={{ color: Text.tertiary }}>
                  {computedDays}d workdays · {derivedQuarter}
                </span>
                <button
                  className="px-3 py-1 rounded-lg text-xs font-medium text-white focus:ring-2 focus:ring-sana-teal"
                  style={{ backgroundColor: Accent.teal }}
                  onClick={handleConfirm}
                  disabled={computedDays <= 0}
                >
                  Assign
                </button>
              </div>
            </div>
          )}
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
