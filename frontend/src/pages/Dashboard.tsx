import { useMemo, useState, useCallback, Fragment } from 'react';
import {
  Users, FolderKanban, AlertTriangle, TrendingUp, X,
  ChevronRight, CheckCircle2, Circle, Link2, Zap, Globe,
  Clock, PlayCircle,
} from 'lucide-react';
import { useAppStore, useCurrentState } from '../stores/appStore';
import { Card, CardContent } from '../components/ui/Card';
import { PageHeader } from '../components/layout/PageHeader';
import {
  calculateCapacity, getWarnings, getTeamUtilizationSummary,
  calculateBusinessCapacityForQuarter,
} from '../utils/capacity';
import { getCurrentQuarter, getWorkdaysInQuarter } from '../utils/calendar';
import type { CapacityResult, CapacityBreakdownItem, Project } from '../types';

type PeopleFilter = 'it_only' | 'business_only' | 'both';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getCurrentYearQuarters(): string[] {
  const year = new Date().getFullYear();
  return [`Q1 ${year}`, `Q2 ${year}`, `Q3 ${year}`, `Q4 ${year}`];
}

function isPastQuarter(q: string, current: string): boolean {
  const [ql, qy] = q.split(' ');
  const [cl, cy] = current.split(' ');
  if (qy !== cy) return Number(qy) < Number(cy);
  return Number(ql.slice(1)) < Number(cl.slice(1));
}

// ── Heatmap color scale (5-tier: green → amber → orange → red) ───────────────
function getCellClass(pct: number): string {
  if (pct === 0)  return 'cell-empty';
  if (pct <= 60)  return 'cell-low';
  if (pct <= 85)  return 'cell-moderate';
  if (pct <= 100) return 'cell-high';
  return 'cell-overloaded';
}

function getCellColor(pct: number): string {
  if (pct === 0)  return '#AAAAAA';
  if (pct <= 60)  return '#2A7A45';
  if (pct <= 85)  return '#8A6000';
  if (pct <= 100) return '#B04500';
  return '#B02030';
}


// ─── Main component ───────────────────────────────────────────────────────────

export function Dashboard() {
  const state = useCurrentState();
  const setCurrentView = useAppStore(s => s.setCurrentView);

  const currentQuarter = getCurrentQuarter();
  const yearQuarters = useMemo(() => getCurrentYearQuarters(), []);

  const [selectedCell, setSelectedCell] = useState<{ memberId: string; quarter: string } | null>(null);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('it_only');
  const [timelineView, setTimelineView] = useState<'heatmap' | 'bars'>('heatmap');

  const warnings = useMemo(() => getWarnings(state), [state]);

  const activeMembers = useMemo(
    () => state.teamMembers.filter(m => !m.needsEnrichment),
    [state.teamMembers]
  );

  const activeProjects = state.projects.filter(
    p => p.status === 'Active' || p.status === 'Planning'
  ).length;

  const currentSummary = useMemo(
    () => getTeamUtilizationSummary(currentQuarter, state),
    [currentQuarter, state]
  );

  // Capacity Bank: team-wide totals per quarter
  const capacityBank = useMemo(() =>
    yearQuarters.map(q => {
      let totalWorkdays = 0;
      let totalUsed = 0;
      let totalBau = 0;
      let totalProject = 0;
      let totalTimeOff = 0;

      for (const m of state.teamMembers) {
        const cap = calculateCapacity(m.id, q, state);
        totalWorkdays += cap.totalWorkdays;
        totalUsed += cap.usedDays;
        totalBau += cap.breakdown.find(b => b.type === 'bau')?.days ?? 0;
        totalTimeOff += cap.breakdown.find(b => b.type === 'timeoff')?.days ?? 0;
        totalProject += cap.breakdown
          .filter(b => b.type === 'project' || b.type === 'jira')
          .reduce((s, b) => s + b.days, 0);
      }

      const remainingDays = Math.round(totalWorkdays - totalUsed);
      const bauPct = totalWorkdays > 0 ? Math.min(100, (totalBau / totalWorkdays) * 100) : 0;
      const timeOffPct = totalWorkdays > 0 ? Math.min(100, (totalTimeOff / totalWorkdays) * 100) : 0;
      const projectPct = totalWorkdays > 0 ? Math.min(100, (totalProject / totalWorkdays) * 100) : 0;

      const isPast = isPastQuarter(q, currentQuarter);
      const isCurrent = q === currentQuarter;
      const isTight = !isPast && remainingDays < 15;
      const isOpen = !isPast && remainingDays > 80;

      return { quarter: q, totalWorkdays, remainingDays, bauPct, timeOffPct, projectPct, isPast, isCurrent, isTight, isOpen };
    }),
    [yearQuarters, currentQuarter, state]
  );

  // Timeline preview data
  const timelineData = useMemo(() =>
    activeMembers.map(member => ({
      member,
      cells: yearQuarters.map(q => {
        const cap = calculateCapacity(member.id, q, state);
        const bauDays = cap.breakdown.find(b => b.type === 'bau')?.days ?? 0;
        const timeOffDays = cap.breakdown.find(b => b.type === 'timeoff')?.days ?? 0;
        const projectDays = cap.breakdown
          .filter(b => b.type === 'project' || b.type === 'jira')
          .reduce((s, b) => s + b.days, 0);
        const bauPct = cap.totalWorkdays > 0 ? Math.min(100, (bauDays / cap.totalWorkdays) * 100) : 0;
        const timeOffPct = cap.totalWorkdays > 0 ? Math.min(100, (timeOffDays / cap.totalWorkdays) * 100) : 0;
        const projectPct = cap.totalWorkdays > 0 ? Math.min(100, (projectDays / cap.totalWorkdays) * 100) : 0;
        return { quarter: q, cap, bauDays, timeOffDays, projectDays, bauPct, timeOffPct, projectPct };
      }),
    })),
    [activeMembers, yearQuarters, state]
  );

  const bizTimelineData = useMemo(() => {
    if (peopleFilter === 'it_only') return [];
    return state.businessContacts.filter(c => !c.archived).map(contact => ({
      contact,
      cells: yearQuarters.map(q => {
        const cell = calculateBusinessCapacityForQuarter(
          contact, q, state.businessAssignments, state.businessTimeOff,
          state.publicHolidays, state.projects,
          state.jiraItemBizAssignments, state.jiraWorkItems
        );
        return { quarter: q, cell };
      }),
    }));
  }, [peopleFilter, state, yearQuarters]);

  const drillDown = useMemo<{ member: typeof state.teamMembers[0]; quarter: string; capacity: CapacityResult } | null>(() => {
    if (!selectedCell) return null;
    const member = state.teamMembers.find(m => m.id === selectedCell.memberId);
    if (!member) return null;
    return { member, quarter: selectedCell.quarter, capacity: calculateCapacity(member.id, selectedCell.quarter, state) };
  }, [selectedCell, state]);

  const handleCellClick = useCallback((memberId: string, quarter: string) => {
    setSelectedCell(prev =>
      prev?.memberId === memberId && prev?.quarter === quarter ? null : { memberId, quarter }
    );
  }, []);

  const isEmpty = state.teamMembers.length === 0 && state.projects.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capacity Overview"
        subtitle={`VS Finance · ${currentQuarter} · Mileway BV`}
        actions={
          <button
            onClick={() => setCurrentView('projects')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            + New Epic
          </button>
        }
      />

      {/* Onboarding */}
      {isEmpty && <OnboardingChecklist state={state} navigate={setCurrentView} />}

      {/* Stats strip */}
      {!isEmpty && (
        <div className="flex items-center gap-6 px-1">
          <Stat icon={Users} label="Team" value={activeMembers.length} color="blue" />
          <Stat icon={FolderKanban} label="Active Epics" value={activeProjects} color="slate" />
          <Stat icon={TrendingUp} label="Avg utilization" value={`${currentSummary.averageUtilization}%`} color="slate" />
          {(warnings.overallocated.length + warnings.highUtilization.length) > 0 && (
            <Stat
              icon={AlertTriangle}
              label="Alerts"
              value={warnings.overallocated.length + warnings.highUtilization.length}
              color="red"
            />
          )}
          <div className="flex-1" />
          <span className="text-xs text-slate-400 dark:text-slate-500">{currentQuarter} (current)</span>
        </div>
      )}

      {/* ── Section 1: Capacity Bank ──────────────────────────────────────────── */}
      {!isEmpty && (
        <section>
          <SectionLabel title="Capacity Bank" subtitle="Team-wide remaining days per quarter" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {capacityBank.map(q => (
              <CapacityBankCard key={q.quarter} {...q} />
            ))}
          </div>
        </section>
      )}

      {/* ── Section 2: Alerts ────────────────────────────────────────────────── */}
      {!isEmpty && <AlertsGrid warnings={warnings} projects={state.projects} />}

      {/* ── Section 3: Timeline Preview ──────────────────────────────────────── */}
      {!isEmpty && activeMembers.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-3">
            <SectionLabel
              title="Team Timeline"
              subtitle="Capacity by member · current year"
              inline
            />
            <div className="flex items-center gap-2">
              {/* Heatmap / Bars toggle */}
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-medium">
                <button
                  onClick={() => setTimelineView('heatmap')}
                  className={`px-2.5 py-1.5 transition-colors ${timelineView === 'heatmap' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Heatmap
                </button>
                <button
                  onClick={() => setTimelineView('bars')}
                  className={`px-2.5 py-1.5 border-l border-slate-200 dark:border-slate-700 transition-colors ${timelineView === 'bars' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Bars
                </button>
              </div>
              <select
                value={peopleFilter}
                onChange={e => setPeopleFilter(e.target.value as PeopleFilter)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="it_only">IT team only</option>
                <option value="business_only">Business only</option>
                <option value="both">Both</option>
              </select>
              <button
                onClick={() => setCurrentView('timeline')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Full view <ChevronRight size={13} />
              </button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {/* Header */}
              <div className="grid border-b border-slate-100 dark:border-slate-800 bg-slate-800 dark:bg-slate-900"
                style={{ gridTemplateColumns: '200px repeat(4, 1fr)' }}>
                <div className="px-4 py-3 text-xs font-bold tracking-wide uppercase text-slate-300">
                  {peopleFilter === 'business_only' ? 'Business contact' : 'Member'}
                </div>
                {yearQuarters.map(q => {
                  const workdays = getWorkdaysInQuarter(q);
                  const isCurrent = q === currentQuarter;
                  return (
                    <div key={q} className={`px-4 py-3 border-l border-white/10 ${isCurrent ? 'bg-blue-700/30' : ''}`}>
                      <div className={`text-xs font-bold tracking-wide uppercase ${isCurrent ? 'text-blue-300' : 'text-slate-300'}`}>{q}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{workdays} working days</div>
                    </div>
                  );
                })}
              </div>


              {/* IT Member rows */}
              {peopleFilter !== 'business_only' && timelineData.map(({ member, cells }) => {
                const country = state.countries.find(c => c.id === member.countryId);
                const isMemberSelected = selectedCell?.memberId === member.id;
                return (
                  <Fragment key={member.id}>
                    <div
                      className={`grid border-b border-slate-50 dark:border-slate-800/50 transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/5 ${isMemberSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                      style={{ gridTemplateColumns: '200px repeat(4, 1fr)' }}
                    >
                      {/* Identity */}
                      <div className="px-4 py-3 flex items-center gap-2.5 border-r border-slate-100 dark:border-slate-800">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                          {getInitials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{member.name}</div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            {member.role}{country ? ` · ${country.code}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* Quarter cells */}
                      {cells.map(({ quarter, cap, bauPct, timeOffPct, projectPct }) => {
                        const isOver = cap.status === 'overallocated';
                        const isWarn = cap.status === 'warning';
                        const isCellSelected = isMemberSelected && selectedCell?.quarter === quarter;
                        const remainingDays = cap.totalWorkdays - cap.usedDays;

                        if (timelineView === 'heatmap') {
                          return (
                            <button
                              key={quarter}
                              onClick={() => handleCellClick(member.id, quarter)}
                              className={`px-3 py-3 border-l border-slate-100/80 dark:border-slate-800 text-center transition-all ${getCellClass(cap.usedPercent)} ${isCellSelected ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                              style={{ filter: isCellSelected ? undefined : 'none' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.94)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
                              title={`${quarter} · ${cap.usedPercent}% allocated · ${isOver ? '−' : ''}${Math.abs(Math.round(remainingDays))}d ${isOver ? 'over' : 'free'}`}
                            >
                              <div className="text-sm font-bold tabular-nums leading-tight">
                                {cap.usedPercent === 0 ? '—' : `${cap.usedPercent}%`}
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: isOver ? '#B02030' : 'inherit' }}>
                                {cap.usedPercent === 0 ? '' : isOver
                                  ? `−${Math.abs(Math.round(remainingDays))}d`
                                  : `${Math.round(remainingDays)}d free`}
                              </div>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={quarter}
                            onClick={() => handleCellClick(member.id, quarter)}
                            className={`px-3 py-3 border-l border-slate-100 dark:border-slate-800 text-left transition-colors
                              ${isCellSelected ? 'ring-2 ring-inset ring-blue-500' : ''}
                              ${quarter === currentQuarter ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}
                            `}
                          >
                            {/* Stacked bar */}
                            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex mb-1.5">
                              <div className="h-full bg-slate-300 dark:bg-slate-600" style={{ width: `${bauPct}%` }} />
                              <div className="h-full bg-amber-300 dark:bg-amber-600" style={{ width: `${timeOffPct}%` }} />
                              <div
                                className={`h-full ${isOver ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-blue-500'}`}
                                style={{ width: `${projectPct}%` }}
                              />
                            </div>
                            {/* Label */}
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold ${
                                isOver ? 'text-red-600 dark:text-red-400'
                                : remainingDays < 10 ? 'text-amber-600 dark:text-amber-400'
                                : remainingDays > 30 ? 'text-green-600 dark:text-green-400'
                                : 'text-slate-700 dark:text-slate-300'
                              }`}>
                                {isOver ? `−${Math.abs(Math.round(remainingDays))}d` : `${Math.round(remainingDays)}d free`}
                              </span>
                              <span className={`text-[10px] ${isOver ? 'text-red-500 dark:text-red-400' : isWarn ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                {cap.usedPercent}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Inline drill-down panel */}
                    {isMemberSelected && drillDown && (() => {
                      const cap = drillDown.capacity;
                      const pct = cap.usedPercent;
                      const isOver = pct > 100;
                      const summaryCellColor = getCellColor(pct);

                      // Separate breakdown into work items vs. overhead
                      const workItems = cap.breakdown.filter(
                        (b: CapacityBreakdownItem) => b.type === 'jira' || b.type === 'project'
                      );
                      const overhead = cap.breakdown.filter(
                        (b: CapacityBreakdownItem) => b.type === 'bau' || b.type === 'timeoff'
                      );

                      // Build Epic › Feature breadcrumb for Jira items
                      const jiraMap = new Map(state.jiraWorkItems.map(i => [i.jiraKey, i]));
                      const getBreadcrumb = (jiraKey: string): string => {
                        const item = jiraMap.get(jiraKey);
                        if (!item) return '';
                        const parent = item.parentKey ? jiraMap.get(item.parentKey) : undefined;
                        const grandParent = parent?.parentKey ? jiraMap.get(parent.parentKey) : undefined;
                        const parts: string[] = [];
                        if (grandParent) parts.push(grandParent.summary);
                        else if (parent) parts.push(parent.summary);
                        if (grandParent && parent) parts.push(parent.summary);
                        return parts.join(' › ');
                      };

                      const typePillClass = (type: string) => {
                        switch (type.toLowerCase()) {
                          case 'story': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
                          case 'uat': return 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300';
                          case 'hypercare': return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300';
                          default: return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
                        }
                      };

                      const remainingRaw = cap.totalWorkdays - cap.usedDays;

                      return (
                        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          {/* Panel header */}
                          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {drillDown.quarter} — {drillDown.member.name}
                              </span>
                              {drillDown.member.role && (
                                <span className="text-xs text-slate-400">{drillDown.member.role}</span>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedCell(null)}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                            >
                              <X size={15} />
                            </button>
                          </div>

                          {/* Two-column body */}
                          <div className="grid grid-cols-[1fr_180px] gap-0 px-5 py-4">
                            {/* Left — assigned work */}
                            <div className="pr-6 min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Assigned Work</p>
                              {workItems.length === 0 && overhead.length === 0 ? (
                                <p className="text-sm italic text-slate-400">No work assigned this quarter.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {workItems.map((item: CapacityBreakdownItem, i: number) => {
                                    const breadcrumb = item.jiraKey ? getBreadcrumb(item.jiraKey) : (item.phaseName ? `${item.projectName} › ${item.phaseName}` : item.projectName ?? '');
                                    const label = item.jiraSummary ?? item.phaseName ?? item.projectName ?? '—';
                                    const typeLabel = item.type === 'jira' ? 'Story' : 'Project';
                                    return (
                                      <div key={i} className="flex items-start gap-2 pl-2 border-l-2 border-blue-200 dark:border-blue-800">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {item.jiraKey && (
                                              <span className="text-[9px] font-mono text-slate-400 shrink-0">{item.jiraKey}</span>
                                            )}
                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${typePillClass(typeLabel)}`}>{typeLabel.toUpperCase()}</span>
                                          </div>
                                          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">{label}</p>
                                          {breadcrumb && (
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{breadcrumb}</p>
                                          )}
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 pt-3 tabular-nums">{item.days.toFixed(1)}d</span>
                                      </div>
                                    );
                                  })}
                                  {overhead.map((item: CapacityBreakdownItem, i: number) => (
                                    <div key={`oh-${i}`} className="flex items-center gap-2 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${typePillClass(item.type)}`}>
                                            {item.type === 'bau' ? 'BAU' : 'TIME OFF'}
                                          </span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                          {item.type === 'bau' ? 'BAU Reserve' : 'Time Off'}
                                        </p>
                                      </div>
                                      <span className="text-xs text-slate-400 shrink-0 tabular-nums">{item.days.toFixed(1)}d</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Right — quarter summary */}
                            <div className="border-l border-slate-100 dark:border-slate-800 pl-5">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Quarter Summary</p>
                              <div className="space-y-2.5">
                                {[
                                  { label: 'Available', value: `${cap.totalWorkdays}d`, color: 'text-slate-600 dark:text-slate-300' },
                                  { label: 'Allocated', value: `${cap.usedDays.toFixed(1)}d`, color: summaryCellColor },
                                  {
                                    label: 'Remaining',
                                    value: isOver ? `−${Math.abs(Math.round(remainingRaw))}d` : `${Math.round(remainingRaw)}d`,
                                    color: isOver ? '#B02030' : 'inherit',
                                  },
                                  { label: 'Utilization', value: `${pct}%`, color: summaryCellColor },
                                ].map(row => (
                                  <div key={row.label} className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{row.label}</span>
                                    <span className="text-xs font-semibold tabular-nums" style={{ color: row.color }}>{row.value}</span>
                                  </div>
                                ))}
                              </div>
                              {/* Mini utilization bar */}
                              <div className="mt-4 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, pct)}%`,
                                    background: summaryCellColor,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </Fragment>
                );
              })}

              {/* Business divider */}
              {peopleFilter === 'both' && bizTimelineData.length > 0 && (
                <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Business</span>
                  <span className="ml-2 text-[10px] text-slate-400 italic">(informational only)</span>
                </div>
              )}

              {/* Business rows */}
              {peopleFilter !== 'it_only' && bizTimelineData.map(({ contact, cells }) => (
                <div
                  key={contact.id}
                  className="grid border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-purple-50/20 dark:hover:bg-purple-900/5 transition-colors"
                  style={{ gridTemplateColumns: '200px repeat(4, 1fr)' }}
                >
                  <div className="px-4 py-3 flex items-center gap-2.5 border-r border-slate-100 dark:border-slate-800">
                    <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 flex items-center justify-center text-[10px] font-bold text-purple-600 dark:text-purple-400 shrink-0">
                      {getInitials(contact.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-normal text-slate-600 dark:text-slate-400 truncate">{contact.name}</span>
                        <span className="text-[9px] font-bold tracking-wide uppercase text-purple-400 shrink-0">BIZ</span>
                      </div>
                      <div className="text-xs text-slate-400 truncate">{contact.title ?? contact.department ?? ''}</div>
                    </div>
                  </div>
                  {cells.map(({ quarter, cell }) => {
                    const pct = cell.usedPercent;
                    const isOver = pct > 100;
                    const isWarn = pct >= 90 && !isOver;
                    const remainingDays = cell.availableDays - cell.allocatedDays;

                    if (timelineView === 'heatmap') {
                      return (
                        <div
                          key={quarter}
                          className={`px-3 py-3 border-l border-slate-100/80 dark:border-slate-800 text-center ${getCellClass(pct)}`}
                          title={`${quarter} · ${pct}% allocated · ${isOver ? '−' : ''}${Math.abs(Math.round(remainingDays))}d ${isOver ? 'over' : 'free'}`}
                        >
                          <div className="text-sm font-bold tabular-nums leading-tight">
                            {pct === 0 ? '—' : `${pct}%`}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: isOver ? '#B02030' : 'inherit' }}>
                            {pct === 0 ? '' : isOver
                              ? `−${Math.abs(Math.round(remainingDays))}d`
                              : `${Math.round(remainingDays)}d free`}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={quarter}
                        title={cell.breakdownByProject.map(b => `${b.projectName}${b.phaseName ? ` / ${b.phaseName}` : ''}: ${b.days.toFixed(1)}d`).join('\n')}
                        className={`px-3 py-3 border-l border-slate-100 dark:border-slate-800 ${quarter === currentQuarter ? 'bg-blue-50/20 dark:bg-blue-900/5' : ''}`}
                      >
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-1.5">
                          <div
                            className={`h-full ${isOver ? 'bg-red-400' : isWarn ? 'bg-amber-400' : 'bg-purple-400'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {pct > 0 ? `${cell.allocatedDays.toFixed(1)}d` : '—'}
                          </span>
                          <span className={`text-[10px] ${isOver ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-slate-400'}`}>
                            {pct > 0 ? `${pct}%` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Legend */}
              {timelineView === 'heatmap' ? (
                <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex-wrap">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-low" /><span className="text-[10px] text-slate-500">1–60%</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-moderate" /><span className="text-[10px] text-slate-500">61–85%</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-high" /><span className="text-[10px] text-slate-500">86–100%</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-overloaded" /><span className="text-[10px] text-slate-500">Over 100%</span></div>
                  <div className="flex-1" />
                  <span className="text-[10px] text-slate-400">Click any IT cell to drill down</span>
                </div>
              ) : (
                <div className="flex items-center gap-5 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <LegendDot color="bg-slate-300 dark:bg-slate-600" label="BAU" />
                  <LegendDot color="bg-amber-300 dark:bg-amber-600" label="Time off" />
                  <LegendDot color="bg-blue-500" label="Projects" />
                  <LegendDot color="bg-red-500" label="Over-allocated" />
                  <div className="flex-1" />
                  <span className="text-[10px] text-slate-400">Click any cell to drill down</span>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

    </div>
  );
}

/* ─── Section 1: Capacity Bank card ─────────────────────────────────────────── */

function CapacityBankCard({ quarter, remainingDays, bauPct, timeOffPct, projectPct, isPast, isCurrent, isTight, isOpen }: {
  quarter: string;
  remainingDays: number;
  bauPct: number;
  timeOffPct: number;
  projectPct: number;
  isPast: boolean;
  isCurrent: boolean;
  isTight: boolean;
  isOpen: boolean;
}) {
  const badgeLabel = isPast ? 'Closed' : isCurrent ? 'Current' : isTight ? 'Tight' : isOpen ? 'Open' : 'Planned';
  const badgeCls = isPast
    ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
    : isCurrent
    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
    : isTight
    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
    : isOpen
    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400';

  const daysCls = isPast
    ? 'text-slate-400 dark:text-slate-500'
    : isTight
    ? 'text-amber-600 dark:text-amber-400'
    : isOpen
    ? 'text-green-600 dark:text-green-400'
    : 'text-blue-600 dark:text-blue-400';

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 ${isCurrent ? 'border-t-2 border-t-blue-500' : ''}`}>
      {/* Quarter + badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold tracking-wide uppercase text-slate-500 dark:text-slate-400">{quarter}</span>
        <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full ${badgeCls}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Big number */}
      <div className={`text-3xl font-bold leading-none tracking-tight ${daysCls}`}>
        {remainingDays < 0 ? `−${Math.abs(remainingDays)}` : remainingDays}
      </div>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {remainingDays < 0 ? 'days over capacity' : 'days remaining'}
      </div>

      {/* Stacked bar */}
      <div className="mt-4 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
        <div className="h-full bg-slate-300 dark:bg-slate-500" style={{ width: `${bauPct}%` }} />
        <div className="h-full bg-amber-300 dark:bg-amber-600" style={{ width: `${timeOffPct}%` }} />
        <div className="h-full bg-blue-500" style={{ width: `${projectPct}%` }} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2.5">
        <LegendDot color="bg-slate-300 dark:bg-slate-500" label="BAU" />
        <LegendDot color="bg-amber-300 dark:bg-amber-600" label="Leave" />
        <LegendDot color="bg-blue-500" label="Projects" />
      </div>
    </div>
  );
}

/* ─── Section 2: Alerts grid ──────────────────────────────────────────────── */

function AlertsGrid({ warnings, projects }: {
  warnings: ReturnType<typeof getWarnings>;
  projects: Project[];
}) {
  // Build alert items from existing warnings + go-live check
  const alerts: { id: string; icon: React.ReactNode; iconBg: string; title: string; detail: string; badgeCls: string; badgeLabel: string }[] = [];

  for (const w of warnings.overallocated.slice(0, 2)) {
    alerts.push({
      id: `over-${w.member.id}-${w.quarter}`,
      icon: <AlertTriangle size={15} className="text-red-500" />,
      iconBg: 'bg-red-50 dark:bg-red-900/20',
      title: `${w.member.name} over-allocated`,
      detail: `${w.usedDays}d used / ${w.totalDays}d available in ${w.quarter}`,
      badgeCls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      badgeLabel: 'Fix',
    });
  }

  for (const w of warnings.highUtilization.slice(0, 2)) {
    if (alerts.length >= 4) break;
    alerts.push({
      id: `warn-${w.member.id}-${w.quarter}`,
      icon: <Clock size={15} className="text-amber-500" />,
      iconBg: 'bg-amber-50 dark:bg-amber-900/20',
      title: `${w.member.name} at ${w.usedPercent}%`,
      detail: `High utilization in ${w.quarter} — ${w.usedDays}d / ${w.totalDays}d`,
      badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      badgeLabel: 'Review',
    });
  }

  // Go-live milestones within 30 days
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  for (const project of projects) {
    if (alerts.length >= 4) break;
    for (const phase of project.phases) {
      if (alerts.length >= 4) break;
      const endDate = phase.endDate;
      if (!endDate) continue;
      const d = new Date(endDate + 'T00:00:00');
      if (d >= now && d <= soon) {
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
        alerts.push({
          id: `milestone-${phase.id}`,
          icon: <PlayCircle size={15} className="text-blue-500" />,
          iconBg: 'bg-blue-50 dark:bg-blue-900/20',
          title: `Go-live: ${phase.name}`,
          detail: `${project.name} · in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${endDate})`,
          badgeCls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
          badgeLabel: 'Plan',
        });
      }
    }
  }

  for (const w of warnings.tooManyProjects.slice(0, 2)) {
    if (alerts.length >= 4) break;
    alerts.push({
      id: `projects-${w.member.id}`,
      icon: <FolderKanban size={15} className="text-amber-500" />,
      iconBg: 'bg-amber-50 dark:bg-amber-900/20',
      title: `${w.member.name}: too many projects`,
      detail: `${w.count} active projects (max ${w.max})`,
      badgeCls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      badgeLabel: 'Review',
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800">
        <CheckCircle2 size={16} className="text-green-500 shrink-0" />
        <span className="text-sm text-green-700 dark:text-green-300 font-medium">All clear — no capacity alerts</span>
      </div>
    );
  }

  return (
    <section>
      <SectionLabel title="Alerts" subtitle={`${alerts.length} item${alerts.length !== 1 ? 's' : ''} require attention`} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.map(a => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.iconBg}`}>
              {a.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">{a.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{a.detail}</div>
            </div>
            <span className={`shrink-0 text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full ${a.badgeCls}`}>
              {a.badgeLabel}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Small helpers ──────────────────────────────────────────────────────── */

function SectionLabel({ title, subtitle, inline = false }: {
  title: string;
  subtitle: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">{title}</span>
        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{subtitle}</span>
      </div>
    );
  }
  return (
    <div className="mb-3">
      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">{title}</div>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
      <span className={`w-2 h-2 rounded-sm inline-block shrink-0 ${color}`} />
      {label}
    </span>
  );
}

function Stat({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'blue' | 'slate' | 'red';
}) {
  const iconColors = { blue: 'text-blue-500', slate: 'text-slate-400', red: 'text-red-500' };
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className={iconColors[color]} />
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

// ─── Onboarding Checklist ────────────────────────────────────────────────────

function OnboardingChecklist({ state, navigate }: {
  state: ReturnType<typeof useCurrentState>;
  navigate: (view: 'team' | 'projects' | 'settings') => void;
}) {
  const steps = [
    {
      done: state.teamMembers.length > 0,
      label: 'Add team members',
      detail: state.teamMembers.length > 0
        ? `${state.teamMembers.length} member${state.teamMembers.length !== 1 ? 's' : ''} added`
        : 'Define who is available for project work',
      icon: Users,
      onClick: () => navigate('team'),
    },
    {
      done: state.projects.length > 0,
      label: 'Create your first epic',
      detail: state.projects.length > 0
        ? `${state.projects.length} epic${state.projects.length !== 1 ? 's' : ''} created`
        : 'Epics group features and stories into deliverables',
      icon: FolderKanban,
      onClick: () => navigate('projects'),
    },
    {
      done: state.jiraConnections.length > 0,
      label: 'Connect to Jira',
      detail: state.jiraConnections.length > 0
        ? `${state.jiraConnections.length} connection${state.jiraConnections.length !== 1 ? 's' : ''} configured`
        : 'Optional — sync epics and stories from Jira',
      icon: Link2,
      onClick: () => navigate('settings'),
    },
    {
      done: state.sprints.length > 0,
      label: 'Set up sprints',
      detail: state.sprints.length > 0
        ? `${state.sprints.length} sprint${state.sprints.length !== 1 ? 's' : ''} generated`
        : 'Auto-generate sprints for the year',
      icon: Zap,
      onClick: () => navigate('settings'),
    },
    {
      done: state.countries.length > 0 && state.publicHolidays.length > 0,
      label: 'Add countries & holidays',
      detail: state.countries.length > 0
        ? `${state.countries.length} countr${state.countries.length !== 1 ? 'ies' : 'y'}, ${state.publicHolidays.length} holidays`
        : 'Import public holidays so capacity reflects time off',
      icon: Globe,
      onClick: () => navigate('settings'),
    },
  ];

  const completed = steps.filter(s => s.done).length;

  return (
    <Card>
      <CardContent className="py-10 px-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Welcome to the Capacity Planner
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Complete these steps to get your capacity heatmap up and running.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              {completed} of {steps.length} complete
            </p>
          </div>
          <div className="space-y-1">
            {steps.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <button
                  key={i}
                  onClick={step.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
                >
                  {step.done
                    ? <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                    : <Circle size={20} className="text-slate-300 dark:text-slate-600 shrink-0" />
                  }
                  <StepIcon size={16} className="text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.done ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{step.detail}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

