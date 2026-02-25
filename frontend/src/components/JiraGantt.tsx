/**
 * JiraGantt — Gantt-style timeline for Jira items
 *
 * Layout: 300px fixed label column | flex-1 horizontally-scrollable gantt area
 * Bars are positioned absolutely using date fractions over the visible time window.
 * Continuation arrows (clip-left / clip-right) are CSS pseudo-elements defined in index.css.
 * Colors: Mileway primary blue (#0089DD) for IT / purple (#7C3AED) for BIZ.
 */

import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ExternalLink, X } from 'lucide-react';
import { generateSprints, getSprintsForQuarter, parseSprint, formatDateRange } from '../utils/sprints';
import type {
  JiraWorkItem, JiraItemBizAssignment, BusinessContact, Settings, Sprint,
} from '../types';

// ── Constants ────────────────────────────────────────────────────────────────

const LABEL_W   = 300;
const ROW_EPIC  = 44;
const ROW_SUB   = 36;

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
  settings: Settings;
  quarters: string[];
  jiraBaseUrl: string;
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
  let start: Date | null = item.startDate ? new Date(item.startDate + 'T00:00:00') : null;
  let end:   Date | null = item.dueDate   ? new Date(item.dueDate   + 'T00:00:00') : null;
  if ((!start || !end) && item.sprintName) {
    const parsed = parseSprint(item.sprintName);
    if (parsed) {
      const sp = sprints.find(s => s.number === parsed.number && (!parsed.year || s.year === parsed.year));
      if (sp) {
        if (!start) start = new Date(sp.startDate + 'T00:00:00');
        if (!end)   end   = new Date(sp.endDate   + 'T00:00:00');
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
  items, bizAssignments, businessContacts, settings, quarters, jiraBaseUrl,
}: JiraGanttProps) {
  const allSprints = useMemo(() => generateSprints(settings, 2), [settings]);

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

  // View bounds (start/end dates for bar positioning)
  const { vStart, vEnd } = useMemo(() => {
    if (viewMode === 'year') {
      const yr = parseInt((quarters[0] ?? '2026 ').split(' ')[1] ?? '2026', 10);
      const b = boundsForYear(yr, allSprints);
      if (b) return { vStart: b.start, vEnd: b.end };
    }
    const b = boundsForQuarter(quarters[qtrIdx] ?? '', allSprints);
    if (b) return { vStart: b.start, vEnd: b.end };
    const now = new Date();
    return { vStart: now, vEnd: new Date(now.getTime() + 90 * 86400_000) };
  }, [viewMode, qtrIdx, quarters, allSprints]);

  // Column headers
  const columns = useMemo(() => {
    if (viewMode === 'year') {
      return quarters.slice(0, 4).map((q, i) => {
        const qs = allSprints.filter(s => s.quarter === q).sort((a, b) => a.number - b.number);
        return { label: q, sub: qs.length >= 2 ? `S${qs[0].number}–S${qs[qs.length - 1].number}` : '', isCurrent: i === qtrIdx };
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    const qs = getSprintsForQuarter(quarters[qtrIdx] ?? '', allSprints).sort((a, b) => a.number - b.number);
    return qs.map(sp => ({
      label: `S${sp.number}`,
      sub: formatDateRange(sp.startDate, sp.endDate),
      isCurrent: today >= sp.startDate && today <= sp.endDate,
    }));
  }, [viewMode, qtrIdx, quarters, allSprints]);

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
    const qs = getSprintsForQuarter(quarters[qtrIdx] ?? '', allSprints).sort((a, b) => a.number - b.number);
    const idx = qs.findIndex(s => today >= s.startDate && today <= s.endDate);
    if (idx < 0) return null;
    return { left: idx / colCount, width: 1 / colCount };
  }, [viewMode, qtrIdx, quarters, allSprints, colCount]);

  // Flat row list for parallel label + gantt rendering
  type RowEntry = { item: JiraWorkItem; level: 0 | 1 | 2 };
  const rows: RowEntry[] = useMemo(() => {
    const result: RowEntry[] = [];
    epics.forEach(epic => {
      result.push({ item: epic, level: 0 });
      if (!expandedEpics.has(epic.jiraKey)) return;
      const epicFeatures = features.filter(f => f.parentKey === epic.jiraKey);
      epicFeatures.forEach(feat => {
        result.push({ item: feat, level: 1 });
        if (!expandedFeatures.has(feat.jiraKey)) return;
        items
          .filter(i => i.parentKey === feat.jiraKey && i.type !== 'feature')
          .forEach(child => result.push({ item: child, level: 2 }));
      });
    });
    return result;
  }, [epics, features, items, expandedEpics, expandedFeatures]);

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
          className="shrink-0 border-r-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-10"
          style={{ width: LABEL_W }}
        >
          {/* Header cell */}
          <div className="h-16 flex items-end px-4 pb-2.5 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-400">Epic / Feature / Item</span>
          </div>

          {/* Label rows */}
          {rows.map(({ item, level }) => {
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
                className={`flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer select-none transition-colors ${bg}`}
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
                {/* Jira ID (epic level) */}
                {level === 0 && item.jiraKey && (
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 shrink-0 pr-3">{item.jiraKey}</span>
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
            {rows.map(({ item, level }) => {
              const h = level === 0 ? ROW_EPIC : ROW_SUB;
              const bg = level === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/80 dark:bg-slate-800/30';
              const { start, end } = itemDates(item, allSprints);
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
