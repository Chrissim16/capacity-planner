/**
 * PlannerDetailPanel — right-edge slide-in detail panel for any PlannerItem.
 *
 * Geometry: position:absolute, top:0, right:0, bottom:0, width:400px, z-index:50
 * Backdrop: rgba(0,0,0,0.12) + backdrop-filter:blur(2px) behind the panel
 * Animation: translateX(100%) → translateX(0), 220ms cubic-bezier
 *
 * Sections:
 *   Header    — type pill · Jira key · item name · close button
 *   Assignees — IT track (blue tint) | BIZ track (purple tint), avatar + name + role
 *   Details   — status, sprint range, date range, duration, Jira ID
 *   Features  — (epics only) collapsible child-feature list with in-panel navigation
 *
 * US-UI-22
 */

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { stripJiraMarkup } from '../../utils/markup';
import { SkillMultiSelect } from './SkillMultiSelect';
import type { PlannerItem, PlannerItemType, JiraWorkItem, Sprint } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PlannerDetailPanelProps {
  /** jiraKey (preferred) or PlannerItem.id */
  detailItemId: string;
  plannerItems: PlannerItem[];
  jiraItems: JiraWorkItem[];
  sprints: Sprint[];
  onClose: () => void;
  /** Called when requiredSkillIds are updated on a PlannerItem. */
  onUpdateRequiredSkills?: (itemId: string, skillIds: string[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TYPE_PILL: Record<string, { bg: string; text: string; label: string }> = {
  epic:      { bg: 'rgba(96,144,224,0.18)', text: '#4070C0', label: 'Epic' },
  feature:   { bg: '#A8C4F5',               text: '#4070C0', label: 'Feature' },
  story:     { bg: '#D0CCC8',               text: '#6B6460', label: 'Story' },
  task:      { bg: '#D0CCC8',               text: '#6B6460', label: 'Task' },
  bug:       { bg: '#FEE2E2',               text: '#DC2626', label: 'Bug' },
  uat:       { bg: '#CDB0F5',               text: '#7B4EAC', label: 'UAT' },
  hypercare: { bg: '#90D9B8',               text: '#1A7A52', label: 'Hypercare' },
  custom:    { bg: '#F0F2F5',               text: '#60606A', label: 'Custom' },
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  todo:        { bg: '#F0F2F5', text: '#64748B' },
  in_progress: { bg: '#DBEAFE', text: '#1D4ED8' },
  done:        { bg: '#DCFCE7', text: '#16A34A' },
};

function resolveItem(id: string, plannerItems: PlannerItem[], jiraItems: JiraWorkItem[]) {
  const planner = plannerItems.find(
    p => p.id === id || (p.jiraKey != null && p.jiraKey !== '' && p.jiraKey === id),
  );
  const jira =
    jiraItems.find(j => j.jiraKey === id)
    ?? (planner?.jiraKey ? jiraItems.find(j => j.jiraKey === planner.jiraKey) : undefined);
  return { planner, jira };
}

/** UAT / Hypercare never show required skills (any casing / legacy values). */
function isRequiredSkillsSuppressedType(type: string): boolean {
  const t = type.trim().toLowerCase().replace(/\s+/g, '');
  return t === 'uat' || t === 'hypercare';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypePill({ type }: { type: PlannerItemType | string }) {
  const style = TYPE_PILL[type] ?? TYPE_PILL.custom;
  return (
    <span
      style={{ background: style.bg, color: style.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}
    >
      {style.label}
    </span>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase font-semibold tracking-wider text-mileway-grey">{label}</span>
      <div className="text-sm text-mileway-text">{children}</div>
    </div>
  );
}

// ── PlannerDetailPanel ────────────────────────────────────────────────────────

export function PlannerDetailPanel({
  detailItemId,
  plannerItems,
  jiraItems,
  sprints,
  onClose,
  onUpdateRequiredSkills,
}: PlannerDetailPanelProps) {
  const state = useCurrentState();

  // Navigation stack: clicking a child feature pushes its id; Back pops it
  const [idStack, setIdStack] = useState([detailItemId]);
  useEffect(() => { setIdStack([detailItemId]); }, [detailItemId]);

  const currentId = idStack[idStack.length - 1];
  const canGoBack = idStack.length > 1;

  // Features section collapse state
  const [featuresOpen, setFeaturesOpen] = useState(true);

  // US-SPT-06: Summary section expand/collapse state — resets on item navigation
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  useEffect(() => { setSummaryExpanded(false); }, [currentId]);

  // Keyboard close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Resolve item data
  const { planner, jira } = resolveItem(currentId, plannerItems, jiraItems);
  const itemName = planner?.name ?? jira?.summary ?? currentId;
  const itemType: string = planner?.type ?? jira?.type ?? 'custom';

  // Assignees
  const itAssignees = (planner?.assignees ?? [])
    .filter(a => a.track === 'IT')
    .map(a => state.teamMembers?.find(m => m.id === a.memberId))
    .filter(Boolean);

  const bizAssignees = (planner?.assignees ?? [])
    .filter(a => a.track === 'BIZ')
    .map(a => state.businessContacts?.find(c => c.id === a.memberId))
    .filter(Boolean);

  // Sprint range
  const startNum = planner?.startSprint;
  const endNum   = startNum != null && planner ? startNum + planner.spanSprints - 1 : undefined;
  const startSp  = startNum != null ? sprints.find(s => s.number === startNum) : undefined;
  const endSp    = endNum   != null ? sprints.find(s => s.number === endNum)   : undefined;
  const sprintRange = startSp && endSp ? `${startSp.name} – ${endSp.name}` : '—';
  const dateRange   = startSp && endSp
    ? `${formatDate(startSp.startDate)} – ${formatDate(endSp.endDate)}`
    : (jira?.startDate && jira?.dueDate ? `${formatDate(jira.startDate)} – ${formatDate(jira.dueDate)}` : '—');
  const duration = planner ? `${planner.spanSprints} sprint${planner.spanSprints !== 1 ? 's' : ''}` : '—';

  // Status
  const statusCategory = jira?.statusCategory ?? 'todo';
  const statusLabel    = jira?.status ?? (statusCategory === 'in_progress' ? 'In Progress' : statusCategory === 'done' ? 'Done' : 'To Do');
  const statusStyle    = STATUS_BADGE[statusCategory] ?? STATUS_BADGE.todo;

  // Child features (epics only) — planner rows use parent jiraKey, not parent planner id
  const epicParentKeyForChildren = planner?.jiraKey ?? jira?.jiraKey;
  const childFeatures =
    itemType === 'epic' && epicParentKeyForChildren
      ? plannerItems.filter(p => p.parentKey === epicParentKeyForChildren && p.type === 'feature')
      : [];
  const childFeaturesJira = itemType === 'epic' && jira
    ? jiraItems.filter(j => j.parentKey === (jira.jiraKey) && j.type === 'feature')
    : [];
  // Merge: prefer plannerItems, fall back to jira-only features
  const allFeatures: Array<{ id: string; name: string; status?: string; statusCategory?: string; jiraKey?: string }> = [
    ...childFeatures.map(f => ({ id: f.id, name: f.name, status: undefined, statusCategory: undefined, jiraKey: f.jiraKey })),
    ...childFeaturesJira
      .filter(j => !childFeatures.some(f => f.jiraKey === j.jiraKey))
      .map(j => ({ id: j.jiraKey, name: j.summary, status: j.status, statusCategory: j.statusCategory, jiraKey: j.jiraKey })),
  ];

  const navigateTo = useCallback((id: string) => {
    setIdStack(prev => [...prev, id]);
    setFeaturesOpen(true);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.12)',
          backdropFilter: 'blur(2px)',
          zIndex: 49,
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="animate-slide-in-detail"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 400,
          zIndex: 50,
          backgroundColor: '#fff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-mileway-border">
          {canGoBack && (
            <button
              onClick={() => setIdStack(prev => prev.slice(0, -1))}
              className="flex items-center gap-1.5 text-xs text-mileway-blue hover:text-[#0077C2] mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded"
            >
              <ArrowLeft size={13} />
              Back
            </button>
          )}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <TypePill type={itemType} />
                {jira?.jiraKey && (
                  <span className="text-xs font-mono text-mileway-grey">{jira.jiraKey}</span>
                )}
              </div>
              <h2
                className="text-[16px] font-semibold text-mileway-text leading-snug"
                style={{ letterSpacing: '-0.01em' }}
              >
                {itemName}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close detail panel"
              className="flex-shrink-0 p-1.5 rounded-lg text-mileway-grey hover:text-mileway-text hover:bg-mileway-bg transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* US-SPT-06: Summary section */}
          {(() => {
            const rawDescription = jira?.description ?? '';
            const description = rawDescription ? stripJiraMarkup(rawDescription) : '';
            const TRUNCATE_AT = 200;
            const isTruncatable = description.length > TRUNCATE_AT;
            const displayText = isTruncatable && !summaryExpanded
              ? description.slice(0, TRUNCATE_AT) + '…'
              : description;

            return (
              <div className="px-5 py-4 border-b border-mileway-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-mileway-grey mb-2">Summary</p>
                {description ? (
                  <>
                    <p className="text-sm text-mileway-text leading-relaxed whitespace-pre-line">{displayText}</p>
                    {isTruncatable && (
                      <button
                        type="button"
                        onClick={() => setSummaryExpanded(e => !e)}
                        className="mt-1.5 text-xs text-mileway-blue hover:text-[#0077C2] focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded"
                      >
                        {summaryExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-mileway-grey italic">No summary available.</p>
                )}
              </div>
            );
          })()}

          {/* Required Skills — directly under Summary so it stays above the fold (F-SP-09) */}
          {(planner || jira) && !isRequiredSkillsSuppressedType(itemType) && (
            <div className="px-5 py-4 border-b border-mileway-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-mileway-grey mb-2">Required Skills</p>
              {planner ? (
                <>
                  {onUpdateRequiredSkills ? (
                    <SkillMultiSelect
                      selectedIds={planner.requiredSkillIds ?? []}
                      onChange={ids => onUpdateRequiredSkills(planner.id, ids)}
                    />
                  ) : (
                    <SkillMultiSelect
                      selectedIds={planner.requiredSkillIds ?? []}
                      onChange={() => {}}
                      readOnly
                    />
                  )}
                  {(!planner.requiredSkillIds || planner.requiredSkillIds.length === 0) && !onUpdateRequiredSkills && (
                    <p className="text-sm text-mileway-grey italic">No required skills — anyone can be assigned.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-mileway-grey leading-relaxed">
                  This work item is not on the scenario timeline yet. Add it from the backlog or timeline, then open details again to set required skills.
                </p>
              )}
            </div>
          )}

          {/* Assignees section */}
          <div className="px-5 py-4 border-b border-mileway-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-mileway-grey mb-3">Assignees</p>
            <div className="grid grid-cols-2 gap-3">

              {/* IT track */}
              <div
                className="rounded-lg p-3 flex flex-col gap-2"
                style={{ background: 'rgba(0,137,221,0.06)', border: '1px solid rgba(0,137,221,0.15)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-mileway-blue">IT Track</p>
                {itAssignees.length === 0 ? (
                  <p className="text-xs text-mileway-grey italic">Unassigned</p>
                ) : (
                  itAssignees.map(m => m && (
                    <div key={m.id} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-mileway-blue-10 text-mileway-blue text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {initials(m.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-mileway-text truncate">{m.name}</p>
                        <p className="text-[10px] text-mileway-grey truncate">{m.role}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* BIZ track */}
              <div
                className="rounded-lg p-3 flex flex-col gap-2"
                style={{ background: 'rgba(155,110,226,0.06)', border: '1px solid rgba(155,110,226,0.15)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#7B4EAC' }}>BIZ Track</p>
                {bizAssignees.length === 0 ? (
                  <p className="text-xs text-mileway-grey italic">Unassigned</p>
                ) : (
                  bizAssignees.map(c => c && (
                    <div key={c.id} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(155,110,226,0.15)', color: '#7B4EAC' }}
                      >
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-mileway-text truncate">{c.name}</p>
                        <p className="text-[10px] text-mileway-grey truncate">{c.title ?? c.department ?? ''}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Details section */}
          <div className="px-5 py-4 border-b border-mileway-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-mileway-grey mb-3">Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">

              <MetaRow label="Status">
                <span
                  style={{ background: statusStyle.bg, color: statusStyle.text, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}
                >
                  {statusLabel}
                </span>
              </MetaRow>

              <MetaRow label="Sprint range">
                {sprintRange}
              </MetaRow>

              {/* Date range — full width */}
              <div className="col-span-2">
                <MetaRow label="Date range">
                  {dateRange}
                </MetaRow>
              </div>

              {planner && (
                <MetaRow label="Duration">
                  {duration}
                </MetaRow>
              )}

              {jira?.jiraKey && (
                <MetaRow label="Jira ID">
                  <span className="font-mono">{jira.jiraKey}</span>
                </MetaRow>
              )}

            </div>
          </div>

          {/* Features section — Epics only */}
          {allFeatures.length > 0 && (
            <div className="px-5 py-4">
              <button
                onClick={() => setFeaturesOpen(o => !o)}
                className="flex items-center gap-2 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue rounded mb-2"
              >
                {featuresOpen
                  ? <ChevronDown size={14} className="text-mileway-grey flex-shrink-0" />
                  : <ChevronRight size={14} className="text-mileway-grey flex-shrink-0" />
                }
                <span className="text-xs font-semibold uppercase tracking-wider text-mileway-grey">
                  Features ({allFeatures.length})
                </span>
              </button>

              {featuresOpen && (
                <div className="space-y-1">
                  {allFeatures.map(f => {
                    const fStatus = f.statusCategory;
                    const fStatusStyle = fStatus ? (STATUS_BADGE[fStatus] ?? STATUS_BADGE.todo) : null;
                    return (
                      <button
                        key={f.id}
                        onClick={() => navigateTo(f.jiraKey ?? f.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-mileway-blue-10 transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue group"
                      >
                        <TypePill type="feature" />
                        <span className="flex-1 min-w-0 text-sm text-mileway-text truncate group-hover:text-mileway-blue">
                          {f.name}
                        </span>
                        {fStatusStyle && (
                          <span
                            style={{ background: fStatusStyle.bg, color: fStatusStyle.text, fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}
                          >
                            {f.status}
                          </span>
                        )}
                        <ChevronRight size={14} className="text-mileway-grey opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
