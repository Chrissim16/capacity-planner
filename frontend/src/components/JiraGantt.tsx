/**
 * JiraGantt — Gantt-style timeline for Jira items
 *
 * Layout: 300px fixed label column | flex-1 horizontally-scrollable gantt area
 * Bars are positioned absolutely using date fractions over the visible time window.
 * Continuation arrows (clip-left / clip-right) are CSS pseudo-elements defined in index.css.
 * Colors: Mileway primary blue (#0089DD) for IT / purple (#7C3AED) for BIZ.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ExternalLink, X, Plus, Trash2 } from 'lucide-react';
import { generateSprints, getSprintsForQuarter, parseSprint, formatDateRange } from '../utils/sprints';
import type {
  JiraWorkItem, JiraItemBizAssignment, BusinessContact, Settings, Sprint, LocalPhase,
} from '../types';

// ── Constants ────────────────────────────────────────────────────────────────

const LABEL_W_DEFAULT = 300;
const LABEL_W_MIN     = 200;
const LABEL_W_MAX     = 600;
const ROW_EPIC        = 44;
const ROW_SUB         = 36;

// Bar fill + border per item type — keeps feature/story/uat/hypercare colours
// from the spec; epic and feature use Mileway blue instead of spec's #6090E0
const BAR: Record<string, { bg: string; border: string; borderW: number; radius: number }> = {
  epic:      { bg: 'rgba(0,137,221,0.10)', border: '#0089DD', borderW: 2, radius: 6 },
  feature:   { bg: '#BAE0F7',              border: '#0089DD', borderW: 1, radius: 5 },
  story:     { bg: '#D0CCC8',              border: '#A09D97', borderW: 1, radius: 4 },
  task:      { bg: '#D0CCC8',              border: '#A09D97', borderW: 1, radius: 4 },
  bug:       { bg: '#FECACA',              border: '#EF4444', borderW: 1, radius: 4 },
  uat:       { bg: '#CDB0F5',              border: '#9B6EE2', borderW: 1, radius: 4 },
  hypercare: { bg: '#90D9B8',              border: '#1A7A52', borderW: 1, radius: 4 },
};

const TYPE_CHIP_STYLE: Record<string, { bg: string; color: string }> = {
  feature:   { bg: '#E8F4FB', color: '#0089DD' },
  story:     { bg: '#F0EFED', color: '#5A5754' },
  task:      { bg: '#F0EFED', color: '#5A5754' },
  bug:       { bg: '#FEF2F2', color: '#DC2626' },
  uat:       { bg: '#F3EEFF', color: '#6B2EC2' },
  hypercare: { bg: '#EEFAF5', color: '#1A7A52' },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface BarLayout {
  left: number; width: number;
  clipLeft: boolean; clipRight: boolean;
  hidden: boolean;
}

export interface JiraGanttProps {
  items: JiraWorkItem[];
  bizAssignments: JiraItemBizAssignment[];
  businessContacts: BusinessContact[];
  localPhases: LocalPhase[];
  settings: Settings;
  /** Saved sprints from the store — used as an additional sprint-date source */
  savedSprints?: Sprint[];
  quarters: string[];
  jiraBaseUrl: string;
  onAddLocalPhase: (phase: Omit<LocalPhase, 'id'>) => void;
  onRemoveLocalPhase: (id: string) => void;
}

// ── Helper functions ─────────────────────────────────────────────────────────

function boundsForQuarter(q: string, sprints: Sprint[]): { start: Date; end: Date } | null {
  const qs = sprints.filter(s => s.quarter === q).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!qs.length) return null;
  return { start: new Date(qs[0].startDate + 'T00:00:00'), end: new Date(qs[qs.length - 1].endDate + 'T00:00:00') };
}

function boundsForYear(year: number, sprints: Sprint[]): { start: Date; end: Date } | null {
  const ys = sprints.filter(s => s.year === year).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!ys.length) return null;
  return { start: new Date(ys[0].startDate + 'T00:00:00'), end: new Date(ys[ys.length - 1].endDate + 'T00:00:00') };
}

function itemDates(item: JiraWorkItem, sprints: Sprint[]): { start: Date | null; end: Date | null } {
  // 1. Prefer explicit Jira start/due dates
  let start: Date | null = item.startDate ? new Date(item.startDate + 'T00:00:00') : null;
  let end:   Date | null = item.dueDate   ? new Date(item.dueDate   + 'T00:00:00') : null;

  // 2. Fill gaps from sprint dates stored directly on the item (fetched from Jira sprint object)
  if (!start && item.sprintStartDate) start = new Date(item.sprintStartDate + 'T00:00:00');
  if (!end   && item.sprintEndDate)   end   = new Date(item.sprintEndDate   + 'T00:00:00');

  // 3. Fall back to locally-generated sprint lookup by name number
  if ((!start || !end) && item.sprintName) {
    // a) exact name match against generated sprints
    const byName = sprints.find(s => s.name.toLowerCase() === item.sprintName!.toLowerCase());
    if (byName) {
      if (!start) start = new Date(byName.startDate + 'T00:00:00');
      if (!end)   end   = new Date(byName.endDate   + 'T00:00:00');
    } else {
      // b) parse number from the sprint name and match by number
      const parsed = parseSprint(item.sprintName);
      if (parsed) {
        const sp = sprints.find(s => s.number === parsed.number && (!parsed.year || s.year === parsed.year));
        if (sp) {
          if (!start) start = new Date(sp.startDate + 'T00:00:00');
          if (!end)   end   = new Date(sp.endDate   + 'T00:00:00');
        }
      }
    }
  }
  return { start, end };
}

function barLayout(
  start: Date | null, end: Date | null,
  vStart: Date, vEnd: Date,
): BarLayout {
  if (!start || !end) return { left: 0, width: 0, clipLeft: false, clipRight: false, hidden: true };
  const total = vEnd.getTime() - vStart.getTime();
  if (total <= 0 || end <= vStart || start >= vEnd)
    return { left: 0, width: 0, clipLeft: false, clipRight: false, hidden: true };
  const clipLeft  = start < vStart;
  const clipRight = end   > vEnd;
  const dStart = clipLeft  ? vStart : start;
  const dEnd   = clipRight ? vEnd   : end;
  return {
    left:  (dStart.getTime() - vStart.getTime()) / total,
    width: (dEnd.getTime()   - dStart.getTime()) / total,
    clipLeft, clipRight, hidden: false,
  };
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TypeChip({ type }: { type: string }) {
  const t = type.toLowerCase();
  const s = TYPE_CHIP_STYLE[t] ?? { bg: '#F0EFED', color: '#5A5754' };
  return (
    <span
      style={{ background: s.bg, color: s.color }}
      className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex-shrink-0"
    >
      {t}
    </span>
  );
}

function StatusBadge({ item }: { item: JiraWorkItem }) {
  const cat = item.statusCategory;
  if (cat === 'done')
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-50 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />{item.status}</span>;
  if (cat === 'in_progress')
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />{item.status}</span>;
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />{item.status}</span>;
}

// ── Slide-out panel ──────────────────────────────────────────────────────────

function SlidePanel({
  item, jiraBaseUrl, bizAssignments, businessContacts, onClose,
}: {
  item: JiraWorkItem | null;
  jiraBaseUrl: string;
  bizAssignments: JiraItemBizAssignment[];
  businessContacts: BusinessContact[];
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const bizContacts = item
    ? bizAssignments
        .filter(a => a.jiraKey === item.jiraKey)
        .map(a => businessContacts.find(c => c.id === a.contactId))
        .filter(Boolean) as BusinessContact[]
    : [];

  const open = !!item;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[300] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 bottom-0 w-[420px] bg-white dark:bg-slate-900 shadow-2xl z-[301] flex flex-col overflow-hidden transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {item && (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <TypeChip type={item.type} />
                  {item.jiraKey && jiraBaseUrl && (
                    <a
                      href={`${jiraBaseUrl}/browse/${item.jiraKey}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[10px] text-slate-400 hover:text-[#0089DD] flex items-center gap-0.5 transition-colors"
                    >
                      {item.jiraKey}<ExternalLink size={9} />
                    </a>
                  )}
                </div>
                <p className="text-[15px] font-semibold text-slate-900 dark:text-white leading-snug">{item.summary}</p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Assignees */}
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2.5">Assignees</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* IT track */}
                  <div className="p-3 rounded-lg border border-[#BAE0F7] bg-[#F0F9FF] dark:bg-[#0089DD]/10 dark:border-[#0089DD]/30">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#0089DD] mb-2">IT</p>
                    {item.assigneeName ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#E8F4FB] text-[#0089DD] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {initials(item.assigneeName)}
                        </div>
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-tight">{item.assigneeName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Unassigned</span>
                    )}
                  </div>
                  {/* BIZ track */}
                  <div className="p-3 rounded-lg border border-[#DDD6FE] bg-[#FAF5FF] dark:bg-[#7C3AED]/10 dark:border-[#7C3AED]/30">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#7C3AED] mb-2">Business</p>
                    {bizContacts.length ? (
                      bizContacts.map(c => (
                        <div key={c.id} className="flex items-center gap-2 mb-1.5 last:mb-0">
                          <div className="w-7 h-7 rounded-full bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {initials(c.name)}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-tight">{c.name}</p>
                            {c.title && <p className="text-[10px] text-slate-400 leading-tight">{c.title}</p>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">Unassigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2.5">Details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Status</p>
                    <StatusBadge item={item} />
                  </div>
                  {item.sprintName && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Sprint</p>
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300">{item.sprintName}</p>
                    </div>
                  )}
                  {(item.startDate || item.dueDate) && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Dates</p>
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300">
                        {item.startDate && new Date(item.startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {item.startDate && item.dueDate && ' – '}
                        {item.dueDate && new Date(item.dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {item.storyPoints != null && (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Days</p>
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300">{item.storyPoints}d</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function JiraGantt({
  items, bizAssignments, businessContacts, localPhases, settings, savedSprints = [], quarters, jiraBaseUrl,
  onAddLocalPhase, onRemoveLocalPhase,
}: JiraGanttProps) {
  // Merge generated + saved sprints so sprint-name lookups can match both sources
  const allSprints = useMemo(() => {
    const generated = generateSprints(settings, 3);
    // Add any saved sprints that have unique names not already present
    const names = new Set(generated.map(s => s.name.toLowerCase()));
    const extras = (savedSprints ?? []).filter(s => !names.has(s.name.toLowerCase()));
    return [...generated, ...extras];
  }, [settings, savedSprints]);

  // ── Resizable label column ─────────────────────────────────────────────────
  const [labelW, setLabelW] = useState(LABEL_W_DEFAULT);
  const dragRef  = useRef<{ startX: number; startW: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: labelW };
    const onMove = (mv: MouseEvent) => {
      if (!dragRef.current) return;
      const next = Math.max(LABEL_W_MIN, Math.min(LABEL_W_MAX,
        dragRef.current.startW + mv.clientX - dragRef.current.startX));
      setLabelW(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [labelW]);

  const [viewMode,      setViewMode]      = useState<'quarter' | 'year'>('quarter');
  const [qtrIdx,        setQtrIdx]        = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const idx = quarters.findIndex(q => {
      const qs = allSprints.filter(s => s.quarter === q).sort((a, b) => a.startDate.localeCompare(b.startDate));
      return qs.length > 0 && today >= qs[0].startDate && today <= qs[qs.length - 1].endDate;
    });
    return Math.max(0, idx);
  });
  const [expandedEpics,    setExpandedEpics]    = useState<Set<string>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [allExpanded,      setAllExpanded]      = useState(false);
  const [panelItem,        setPanelItem]        = useState<JiraWorkItem | null>(null);

  const epics    = useMemo(() => items.filter(i => i.type === 'epic'), [items]);
  const features = useMemo(() => items.filter(i => i.type === 'feature'), [items]);

  // Pre-compute resolved dates for every item, then roll up from children to parents
  const resolvedDates = useMemo(() => {
    const map = new Map<string, { start: Date; end: Date }>();

    // Pass 1: resolve leaf dates directly
    for (const item of items) {
      const { start, end } = itemDates(item, allSprints);
      if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()))
        map.set(item.jiraKey, { start, end });
    }

    // Pass 2: roll up features from their children (stories/tasks)
    for (const feat of features) {
      if (!map.has(feat.jiraKey)) {
        const children = items.filter(i => i.parentKey === feat.jiraKey && i.type !== 'feature');
        let minStart: Date | null = null, maxEnd: Date | null = null;
        for (const child of children) {
          const d = map.get(child.jiraKey);
          if (!d) continue;
          if (!minStart || d.start < minStart) minStart = d.start;
          if (!maxEnd   || d.end   > maxEnd)   maxEnd   = d.end;
        }
        if (minStart && maxEnd) map.set(feat.jiraKey, { start: minStart, end: maxEnd });
      }
    }

    // Pass 3: roll up epics from their features (which may themselves be rolled up)
    for (const epic of epics) {
      if (!map.has(epic.jiraKey)) {
        const epicFeatures = features.filter(f => f.parentKey === epic.jiraKey);
        const epicChildren = items.filter(i => i.parentKey === epic.jiraKey && i.type !== 'feature');
        let minStart: Date | null = null, maxEnd: Date | null = null;
        for (const item of [...epicFeatures, ...epicChildren]) {
          const d = map.get(item.jiraKey);
          if (!d) continue;
          if (!minStart || d.start < minStart) minStart = d.start;
          if (!maxEnd   || d.end   > maxEnd)   maxEnd   = d.end;
        }
        if (minStart && maxEnd) map.set(epic.jiraKey, { start: minStart, end: maxEnd });
      }
    }

    return map;
  }, [items, features, epics, allSprints]);

  // View bounds (start/end dates for bar positioning)
  const { vStart, vEnd } = useMemo(() => {
    if (viewMode === 'year') {
      const yr = parseInt((quarters[0] ?? '2026 ').split(' ')[1] ?? '2026', 10);
      const b = boundsForYear(yr, allSprints);
      if (b) return { vStart: b.start, vEnd: b.end };
    }
    const b = boundsForQuarter(quarters[qtrIdx] ?? '', allSprints);
    if (b) return { vStart: b.start, vEnd: b.end };

    // Fallback: derive window from actual item dates if sprint config doesn't match
    const allDates = Array.from(resolvedDates.values());
    if (allDates.length > 0) {
      const minD = allDates.reduce((m, d) => d.start < m ? d.start : m, allDates[0].start);
      const maxD = allDates.reduce((m, d) => d.end   > m ? d.end   : m, allDates[0].end);
      return { vStart: minD, vEnd: maxD };
    }

    const now = new Date();
    return { vStart: now, vEnd: new Date(now.getTime() + 90 * 86400_000) };
  }, [viewMode, qtrIdx, quarters, allSprints, resolvedDates]);

  // Unique sprint columns derived from actual Jira sprint data on work items
  const jiraSprintCols = useMemo(() => {
    if (viewMode !== 'quarter') return null;
    const currentQ = quarters[qtrIdx] ?? '';
    const map = new Map<string, { start: string; end: string }>();
    items.forEach(item => {
      if (item.sprintName && item.sprintStartDate && item.sprintEndDate) {
        if (!map.has(item.sprintName)) {
          const d = new Date(item.sprintStartDate + 'T00:00:00');
          const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
          if (q === currentQ) map.set(item.sprintName, { start: item.sprintStartDate, end: item.sprintEndDate });
        }
      }
    });
    if (map.size === 0) return null;
    return [...map.entries()]
      .sort(([, a], [, b]) => a.start.localeCompare(b.start))
      .map(([name, { start, end }]) => ({ name, start, end }));
  }, [viewMode, qtrIdx, quarters, items]);

  // Column headers
  const columns = useMemo(() => {
    if (viewMode === 'year') {
      return quarters.slice(0, 4).map((q, i) => {
        const qs = allSprints.filter(s => s.quarter === q).sort((a, b) => a.startDate.localeCompare(b.startDate));
        return { label: q, sub: qs.length >= 2 ? `${qs[0].name}–${qs[qs.length - 1].name}` : '', isCurrent: i === qtrIdx };
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (jiraSprintCols) {
      return jiraSprintCols.map(sp => ({
        label: sp.name,
        sub: formatDateRange(sp.start, sp.end),
        isCurrent: today >= sp.start && today <= sp.end,
      }));
    }
    // Fallback to generated/saved sprints
    const qs = getSprintsForQuarter(quarters[qtrIdx] ?? '', allSprints).sort((a, b) => a.number - b.number);
    return qs.map(sp => ({
      label: sp.name,
      sub: formatDateRange(sp.startDate, sp.endDate),
      isCurrent: today >= sp.startDate && today <= sp.endDate,
    }));
  }, [viewMode, qtrIdx, quarters, allSprints, jiraSprintCols]);

  const colCount = Math.max(columns.length, 1);

  // Today line fraction
  const todayFrac = useMemo(() => {
    const now = new Date();
    const total = vEnd.getTime() - vStart.getTime();
    if (total <= 0 || now < vStart || now > vEnd) return null;
    return (now.getTime() - vStart.getTime()) / total;
  }, [vStart, vEnd]);

  // Current sprint highlight (quarter mode only)
  const sprintHighlight = useMemo(() => {
    if (viewMode !== 'quarter') return null;
    const today = new Date().toISOString().slice(0, 10);
    if (jiraSprintCols) {
      const idx = jiraSprintCols.findIndex(s => today >= s.start && today <= s.end);
      if (idx < 0) return null;
      return { left: idx / colCount, width: 1 / colCount };
    }
    const qs = getSprintsForQuarter(quarters[qtrIdx] ?? '', allSprints).sort((a, b) => a.number - b.number);
    const idx = qs.findIndex(s => today >= s.startDate && today <= s.endDate);
    if (idx < 0) return null;
    return { left: idx / colCount, width: 1 / colCount };
  }, [viewMode, qtrIdx, quarters, allSprints, jiraSprintCols, colCount]);

  // Track which epic has the "+ Add Phase" form open
  const [addPhaseForEpic, setAddPhaseForEpic] = useState<string | null>(null);

  // Flat row list for parallel label + gantt rendering
  type RowEntry =
    | { kind: 'jira';       item: JiraWorkItem; level: 0 | 1 | 2 }
    | { kind: 'phase';      phase: LocalPhase;  epicKey: string }
    | { kind: 'add-phase';  epicKey: string };

  const rows: RowEntry[] = useMemo(() => {
    const result: RowEntry[] = [];
    epics.forEach(epic => {
      result.push({ kind: 'jira', item: epic, level: 0 });
      if (!expandedEpics.has(epic.jiraKey)) return;
      // Feature + child rows
      const epicFeatures = features.filter(f => f.parentKey === epic.jiraKey);
      epicFeatures.forEach(feat => {
        result.push({ kind: 'jira', item: feat, level: 1 });
        if (!expandedFeatures.has(feat.jiraKey)) return;
        items
          .filter(i => i.parentKey === feat.jiraKey && i.type !== 'feature')
          .forEach(child => result.push({ kind: 'jira', item: child, level: 2 }));
      });
      // Local phase rows (UAT / Hypercare) — shown after all features
      (localPhases ?? [])
        .filter(p => p.jiraKey === epic.jiraKey)
        .forEach(p => result.push({ kind: 'phase', phase: p, epicKey: epic.jiraKey }));
      // Add-phase form row (shown when that epic's form is open)
      if (addPhaseForEpic === epic.jiraKey) {
        result.push({ kind: 'add-phase', epicKey: epic.jiraKey });
      }
    });
    return result;
  }, [epics, features, items, expandedEpics, expandedFeatures, localPhases, addPhaseForEpic]);

  const handleExpandAll = () => {
    if (allExpanded) {
      setExpandedEpics(new Set()); setExpandedFeatures(new Set()); setAllExpanded(false);
    } else {
      setExpandedEpics(new Set(epics.map(e => e.jiraKey)));
      setExpandedFeatures(new Set(features.map(f => f.jiraKey)));
      setAllExpanded(true);
    }
  };

  if (epics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <p className="text-sm">No Jira epics synced yet.</p>
        <p className="text-xs mt-1">Sync Jira items from Settings to see the Gantt.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 mr-2">
            {[
              { label: 'Feature', bg: '#BAE0F7', border: '#0089DD' },
              { label: 'Story',   bg: '#D0CCC8', border: '#A09D97' },
              { label: 'UAT',     bg: '#CDB0F5', border: '#9B6EE2' },
              { label: 'Hypercare', bg: '#90D9B8', border: '#1A7A52' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.bg, border: `1px solid ${l.border}` }} />
                {l.label}
              </span>
            ))}
          </div>
          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#BAE0F7] hover:text-[#0089DD] hover:bg-[#F0F9FF] transition-colors"
          >
            <ChevronRight size={12} className={`transition-transform ${allExpanded ? 'rotate-90' : ''}`} />
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Quarter navigator (hidden in Full Year) */}
          {viewMode === 'quarter' && (
            <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg">
              <button
                disabled={qtrIdx === 0}
                onClick={() => setQtrIdx(i => i - 1)}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-default transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2L3 5l3 3"/></svg>
              </button>
              <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 min-w-[72px] text-center">
                {quarters[qtrIdx]}
              </span>
              <button
                disabled={qtrIdx >= Math.min(quarters.length - 1, 3)}
                onClick={() => setQtrIdx(i => i + 1)}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-default transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 2l3 3-3 3"/></svg>
              </button>
            </div>
          )}
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-0.5">
            {(['quarter', 'year'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === v
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {v === 'quarter' ? 'Quarter' : 'Full Year'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline body */}
      <div className="flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">

        {/* ── Label column ── */}
        <div
          className="shrink-0 relative bg-white dark:bg-slate-900 z-10"
          style={{ width: labelW }}
        >
          {/* Header cell */}
          <div className="h-16 flex items-end px-4 pb-2.5 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400">Epic / Feature / Item</span>
          </div>

          {/* Drag-resize handle */}
          <div
            onMouseDown={onDragStart}
            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize group z-20 flex items-center justify-center"
            title="Drag to resize column"
          >
            <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700 group-hover:bg-[#0089DD] group-active:bg-[#0089DD] transition-colors" />
          </div>

          {/* Label rows */}
          {rows.map((row) => {
            // ── Add-phase form row ──────────────────────────────────────────
            if (row.kind === 'add-phase') {
              return (
                <AddPhaseForm
                  key={`add-phase-${row.epicKey}`}
                  epicKey={row.epicKey}
                  onAdd={(phase) => { onAddLocalPhase(phase); setAddPhaseForEpic(null); }}
                  onCancel={() => setAddPhaseForEpic(null)}
                />
              );
            }

            // ── Local phase row ─────────────────────────────────────────────
            if (row.kind === 'phase') {
              const { phase } = row;
              const phaseChipStyle = phase.type === 'uat'
                ? { bg: '#F3EEFF', color: '#6B2EC2' }
                : { bg: '#EEFAF5', color: '#1A7A52' };
              return (
                <div
                  key={phase.id}
                  className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 group select-none"
                  style={{ height: ROW_SUB, paddingLeft: 32 }}
                >
                  <span
                    style={{ background: phaseChipStyle.bg, color: phaseChipStyle.color }}
                    className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                  >
                    {phase.type}
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1" title={phase.name}>
                    {phase.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {phase.startDate.slice(5)} – {phase.endDate.slice(5)}
                  </span>
                  <button
                    className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0 mr-2"
                    onClick={() => onRemoveLocalPhase(phase.id)}
                    title="Remove phase"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            }

            // ── Jira item row ───────────────────────────────────────────────
            const { item, level } = row;
            const h = level === 0 ? ROW_EPIC : ROW_SUB;
            const pl = level === 0 ? 14 : level === 1 ? 32 : 48;
            const isExpEpic = level === 0 && expandedEpics.has(item.jiraKey);
            const isExpFeat = level === 1 && expandedFeatures.has(item.jiraKey);
            const hasSubs   = level === 0
              ? features.some(f => f.parentKey === item.jiraKey)
              : level === 1
              ? items.some(i => i.parentKey === item.jiraKey && i.type !== 'feature')
              : false;
            const bg = level === 0
              ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              : 'bg-slate-50/80 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60';

            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer select-none transition-colors group ${bg}`}
                style={{ height: h, paddingLeft: pl }}
                onClick={() => setPanelItem(item)}
              >
                {/* Expand button (levels 0 and 1) */}
                {level < 2 && (
                  <button
                    className="w-[18px] h-[18px] flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0 transition-colors disabled:opacity-0"
                    disabled={!hasSubs}
                    onClick={e => {
                      e.stopPropagation();
                      if (level === 0) setExpandedEpics(prev => { const n = new Set(prev); n.has(item.jiraKey) ? n.delete(item.jiraKey) : n.add(item.jiraKey); return n; });
                      else setExpandedFeatures(prev => { const n = new Set(prev); n.has(item.jiraKey) ? n.delete(item.jiraKey) : n.add(item.jiraKey); return n; });
                    }}
                  >
                    <svg
                      viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                      width="9" height="9"
                      style={{
                        transform: (level === 0 ? isExpEpic : isExpFeat) ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                        color: '#9CA3AF',
                      }}
                    >
                      <path d="M3 2l4 3-4 3" />
                    </svg>
                  </button>
                )}
                {/* Type chip (sub-rows only) */}
                {level > 0 && <TypeChip type={item.type} />}
                {/* Name */}
                <span
                  className={`truncate flex-1 ${level === 0 ? 'text-[13px] font-semibold text-slate-800 dark:text-slate-100' : 'text-xs text-slate-700 dark:text-slate-300'}`}
                  title={item.summary}
                >
                  {item.summary}
                </span>
                {/* Jira ID (epic level) + Add Phase button */}
                {level === 0 && item.jiraKey && (
                  <>
                    <button
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider transition-all flex-shrink-0 border border-dashed border-[#C4B5FD] text-[#7C3AED] bg-[#F5F3FF] hover:bg-[#EDE9FE] hover:border-[#7C3AED]"
                      onClick={e => {
                        e.stopPropagation();
                        if (!expandedEpics.has(item.jiraKey)) {
                          setExpandedEpics(prev => { const n = new Set(prev); n.add(item.jiraKey); return n; });
                        }
                        setAddPhaseForEpic(prev => prev === item.jiraKey ? null : item.jiraKey);
                      }}
                      title="Add UAT / Hypercare phase"
                    >
                      <Plus size={9} />Phase
                    </button>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 shrink-0 pr-2">{item.jiraKey}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Gantt area ── */}
        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ minWidth: 560 }}>

            {/* Column headers */}
            <div
              className="grid border-b border-slate-200 dark:border-slate-700 h-16"
              style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
            >
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={`flex flex-col justify-center px-3 border-r border-slate-100 dark:border-slate-700/50 last:border-r-0 overflow-hidden ${col.isCurrent ? 'bg-[rgba(0,137,221,0.03)]' : ''}`}
                >
                  <span className={`text-[12.5px] font-semibold truncate ${col.isCurrent ? 'text-[#0089DD]' : 'text-slate-800 dark:text-slate-100'}`}>{col.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{col.sub}</span>
                </div>
              ))}
            </div>

            {/* Vertical grid lines */}
            <div
              className="absolute pointer-events-none z-[1] grid"
              style={{ top: 64, left: 0, right: 0, bottom: 0, gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
            >
              {columns.map((_, i) => (
                <div key={i} className={i < colCount - 1 ? 'border-r border-dashed border-slate-100 dark:border-slate-700/30' : ''} />
              ))}
            </div>

            {/* Current sprint highlight */}
            {sprintHighlight && (
              <div
                className="absolute pointer-events-none z-[0]"
                style={{
                  top: 64, bottom: 0,
                  left: `${(sprintHighlight.left * 100).toFixed(2)}%`,
                  width: `${(sprintHighlight.width * 100).toFixed(2)}%`,
                  background: 'rgba(0,137,221,0.04)',
                }}
              />
            )}

            {/* Today line */}
            {todayFrac != null && (
              <div
                className="absolute z-[8] pointer-events-none"
                style={{ top: 0, bottom: 0, left: `${(todayFrac * 100).toFixed(2)}%`, width: 2, background: '#E63946' }}
              >
                <span className="absolute top-1 left-1.5 text-[9px] font-bold text-red-500 uppercase tracking-wider whitespace-nowrap">Today</span>
              </div>
            )}

            {/* Gantt rows */}
            {rows.map((row) => {
              // Add-phase form: empty gantt row (form is in the label column)
              if (row.kind === 'add-phase') {
                return (
                  <div
                    key={`add-phase-gantt-${row.epicKey}`}
                    className="relative border-b border-slate-100 dark:border-slate-700/50 bg-[#FAF5FF] dark:bg-[#7C3AED]/5"
                    style={{ height: ROW_SUB, overflow: 'visible' }}
                  />
                );
              }

              // Local phase bar
              if (row.kind === 'phase') {
                const { phase } = row;
                const start = new Date(phase.startDate + 'T00:00:00');
                const end   = new Date(phase.endDate   + 'T00:00:00');
                const layout = barLayout(start, end, vStart, vEnd);
                const bs = BAR[phase.type] ?? BAR.uat;
                const clipCls = [
                  layout.clipLeft  ? 'gantt-bar-clip-left'  : '',
                  layout.clipRight ? 'gantt-bar-clip-right' : '',
                ].filter(Boolean).join(' ');
                return (
                  <div
                    key={phase.id}
                    className="relative border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/30"
                    style={{ height: ROW_SUB, overflow: 'visible' }}
                  >
                    {!layout.hidden && (
                      <div
                        className={`absolute transition-[filter,transform] duration-150 hover:brightness-90 ${clipCls}`}
                        style={{
                          left:         `${(layout.left  * 100).toFixed(2)}%`,
                          width:        `${(layout.width * 100).toFixed(2)}%`,
                          height:       22,
                          top:          '50%',
                          transform:    'translateY(-50%)',
                          background:   bs.bg,
                          border:       `${bs.borderW}px solid ${bs.border}`,
                          borderRadius: bs.radius,
                          zIndex:       5,
                          overflow:     'visible',
                          minWidth:     4,
                        }}
                      />
                    )}
                  </div>
                );
              }

              // Jira item bar
              const { item, level } = row;
              const h = level === 0 ? ROW_EPIC : ROW_SUB;
              const bg = level === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/80 dark:bg-slate-800/30';
              const resolved = resolvedDates.get(item.jiraKey);
              const start = resolved?.start ?? null;
              const end   = resolved?.end   ?? null;
              const layout = barLayout(start, end, vStart, vEnd);
              const barH = level === 0 ? 30 : (level === 1 ? 22 : 18);
              const bs = BAR[item.type.toLowerCase()] ?? BAR.story;
              const clipCls = [
                layout.clipLeft  ? 'gantt-bar-clip-left'  : '',
                layout.clipRight ? 'gantt-bar-clip-right' : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={item.id}
                  className={`relative border-b border-slate-100 dark:border-slate-700/50 ${bg}`}
                  style={{ height: h, overflow: 'visible' }}
                >
                  {!layout.hidden && (
                    <div
                      className={`absolute cursor-pointer transition-[filter,transform] duration-150 hover:brightness-90 hover:-translate-y-px ${clipCls}`}
                      style={{
                        left:         `${(layout.left  * 100).toFixed(2)}%`,
                        width:        `${(layout.width * 100).toFixed(2)}%`,
                        height:       barH,
                        top:          '50%',
                        transform:    'translateY(-50%)',
                        background:   bs.bg,
                        border:       `${bs.borderW}px solid ${bs.border}`,
                        borderRadius: bs.radius,
                        zIndex:       5,
                        overflow:     'visible',
                        minWidth:     4,
                      }}
                      onClick={() => setPanelItem(item)}
                    />
                  )}
                  {/* Ghost row for items with no dates */}
                  {layout.hidden && !start && (
                    <div
                      className="absolute inset-y-[30%] left-[4%] right-[4%] rounded border border-dashed border-slate-200 dark:border-slate-600"
                      title="No dates set in Jira for this item"
                      style={{ zIndex: 5 }}
                    />
                  )}
                </div>
              );
            })}

          </div>
        </div>
      </div>

      {/* Slide-out panel */}
      <SlidePanel
        item={panelItem}
        jiraBaseUrl={jiraBaseUrl}
        bizAssignments={bizAssignments}
        businessContacts={businessContacts}
        onClose={() => setPanelItem(null)}
      />
    </div>
  );
}

// ── Add Phase inline form ────────────────────────────────────────────────────

function AddPhaseForm({
  epicKey,
  onAdd,
  onCancel,
}: {
  epicKey: string;
  onAdd: (phase: Omit<LocalPhase, 'id'>) => void;
  onCancel: () => void;
}) {
  const [type,      setType]      = useState<'uat' | 'hypercare'>('uat');
  const [name,      setName]      = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');

  const canSubmit = name.trim() && startDate && endDate && endDate >= startDate;

  const submit = () => {
    if (!canSubmit) return;
    onAdd({ jiraKey: epicKey, type, name: name.trim(), startDate, endDate });
  };

  return (
    <div
      className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 bg-[#FAF5FF] dark:bg-[#7C3AED]/5 px-4"
      style={{ height: ROW_SUB, paddingLeft: 32 }}
    >
      {/* Type */}
      <select
        value={type}
        onChange={e => {
          setType(e.target.value as 'uat' | 'hypercare');
          if (!name) setName(e.target.value === 'uat' ? 'UAT' : 'Hypercare');
        }}
        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#DDD6FE] bg-[#F3EEFF] text-[#6B2EC2] cursor-pointer focus:outline-none"
      >
        <option value="uat">UAT</option>
        <option value="hypercare">Hypercare</option>
      </select>
      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Label…"
        className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-0.5 w-28 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#9B6EE2]"
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
      />
      {/* Start */}
      <input
        type="date"
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
        className="text-[10px] border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#9B6EE2]"
      />
      <span className="text-[10px] text-slate-400">–</span>
      {/* End */}
      <input
        type="date"
        value={endDate}
        min={startDate}
        onChange={e => setEndDate(e.target.value)}
        className="text-[10px] border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-[#9B6EE2]"
      />
      {/* Add */}
      <button
        disabled={!canSubmit}
        onClick={submit}
        className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-[#7C3AED] text-white hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
      >
        Add
      </button>
      {/* Cancel */}
      <button
        onClick={onCancel}
        className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
      >
        <X size={11} />
      </button>
    </div>
  );
}
