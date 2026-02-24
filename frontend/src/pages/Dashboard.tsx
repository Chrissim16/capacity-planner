import { useMemo, useState, useCallback } from 'react';
import { Users, FolderKanban, AlertTriangle, TrendingUp, CalendarOff, X, ChevronLeft, ChevronRight, CheckCircle2, Circle, Link2, Zap, Globe } from 'lucide-react';
import { useAppStore, useCurrentState } from '../stores/appStore';
import { Card, CardContent } from '../components/ui/Card';
import { PageHeader } from '../components/layout/PageHeader';
import { calculateCapacity, getWarnings, getTeamUtilizationSummary, calculateBusinessCapacityForQuarter } from '../utils/capacity';
import { getCurrentQuarter, generateQuarters } from '../utils/calendar';
import type { CapacityResult, CapacityBreakdownItem } from '../types';

type PeopleFilter = 'it_only' | 'business_only' | 'both';

export function Dashboard() {
  const state = useCurrentState();
  const setCurrentView = useAppStore(s => s.setCurrentView);

  const currentQuarter = getCurrentQuarter();
  const allQuarters = useMemo(() => generateQuarters(12), []);

  const [startIndex, setStartIndex] = useState(() => {
    const idx = allQuarters.indexOf(currentQuarter);
    return idx >= 0 ? idx : 0;
  });
  const visibleCount = 6;
  const visibleQuarters = allQuarters.slice(startIndex, startIndex + visibleCount);
  const canGoBack = startIndex > 0;
  const canGoForward = startIndex + visibleCount < allQuarters.length;

  const [selectedCell, setSelectedCell] = useState<{ memberId: string; quarter: string } | null>(null);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('it_only');

  const warnings = useMemo(() => getWarnings(state), [state]);
  const totalWarnings =
    warnings.overallocated.length +
    warnings.highUtilization.length +
    warnings.tooManyProjects.length;

  const activeProjects = state.projects.filter(
    p => p.status === 'Active' || p.status === 'Planning'
  ).length;

  const currentSummary = useMemo(
    () => getTeamUtilizationSummary(currentQuarter, state),
    [currentQuarter, state]
  );

  const heatmapData = useMemo(() => {
    return state.teamMembers.map(member => ({
      member,
      cells: visibleQuarters.map(q => ({
        quarter: q,
        capacity: calculateCapacity(member.id, q, state),
      })),
    }));
  }, [state, visibleQuarters]);

  const bizHeatmapData = useMemo(() => {
    const activeContacts = state.businessContacts.filter(c => !c.archived);
    return activeContacts.map(contact => ({
      contact,
      cells: visibleQuarters.map(q => ({
        quarter: q,
        cell: calculateBusinessCapacityForQuarter(
          contact, q,
          state.businessAssignments,
          state.businessTimeOff,
          state.publicHolidays,
          state.projects
        ),
      })),
    }));
  }, [state, visibleQuarters]);

  const drillDown = useMemo<{ member: typeof state.teamMembers[0]; quarter: string; capacity: CapacityResult } | null>(() => {
    if (!selectedCell) return null;
    const member = state.teamMembers.find(m => m.id === selectedCell.memberId);
    if (!member) return null;
    return {
      member,
      quarter: selectedCell.quarter,
      capacity: calculateCapacity(member.id, selectedCell.quarter, state),
    };
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
      />

      {/* Onboarding checklist */}
      {isEmpty && <OnboardingChecklist state={state} navigate={setCurrentView} />}

      {/* Compact Stats Strip */}
      {!isEmpty && (
        <div className="flex items-center gap-6 px-1">
          <Stat icon={Users} label="Team" value={state.teamMembers.length} color="blue" />
          <Stat icon={FolderKanban} label="Active Epics" value={activeProjects} color="slate" />
          <Stat icon={TrendingUp} label="Avg Utilization" value={`${currentSummary.averageUtilization}%`} color="slate" />
          {totalWarnings > 0 && (
            <Stat icon={AlertTriangle} label="Warnings" value={totalWarnings} color="red" />
          )}
          <div className="flex-1" />
          <span className="text-xs text-slate-400 dark:text-slate-500">{currentQuarter} (current)</span>
        </div>
      )}

      {/* Warning banner */}
      {totalWarnings > 0 && (
        <div className="flex flex-wrap gap-2">
          {warnings.overallocated.map((w, i) => (
            <span key={`o-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
              <AlertTriangle size={13} />
              {w.member.name} overallocated ({w.usedDays}d / {w.totalDays}d)
            </span>
          ))}
          {warnings.highUtilization.map((w, i) => (
            <span key={`h-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800">
              {w.member.name} at {w.usedPercent}%
            </span>
          ))}
          {warnings.tooManyProjects.map((w, i) => (
            <span key={`p-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800">
              {w.member.name}: {w.count}/{w.max} projects
            </span>
          ))}
        </div>
      )}

      {/* Heatmap — the hero */}
      {!isEmpty && (
        <Card>
          <CardContent className="p-0">
            {/* Quarter nav + people filter */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setStartIndex(i => Math.max(0, i - 1))}
                disabled={!canGoBack}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={18} className="text-slate-500" />
              </button>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                  {visibleQuarters[0]} — {visibleQuarters[visibleQuarters.length - 1]}
                </div>
                <select
                  value={peopleFilter}
                  onChange={e => setPeopleFilter(e.target.value as PeopleFilter)}
                  className="text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="it_only">IT team only</option>
                  <option value="business_only">Business only</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <button
                onClick={() => setStartIndex(i => Math.min(allQuarters.length - visibleCount, i + 1))}
                disabled={!canGoForward}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left py-3 pl-5 pr-4 font-medium text-sm text-slate-500 dark:text-slate-400 w-52">
                      {peopleFilter === 'business_only' ? 'Business contact' : 'Team member'}
                    </th>
                    {visibleQuarters.map(q => (
                      <th key={q} className={`text-center py-3 px-2 font-medium text-sm min-w-[90px] ${q === currentQuarter ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {q}
                        {q === currentQuarter && <span className="block text-xs font-normal text-blue-400 dark:text-blue-500">current</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* IT rows */}
                  {peopleFilter !== 'business_only' && heatmapData.map(({ member, cells }) => (
                    <tr key={member.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                      <td className="py-2.5 pl-5 pr-4">
                        <div className="font-medium text-sm text-slate-900 dark:text-white truncate max-w-[180px]">{member.name}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{member.role}</div>
                      </td>
                      {cells.map(({ quarter, capacity }) => {
                        const pct = capacity.usedPercent;
                        const isOver = capacity.status === 'overallocated';
                        const isWarn = capacity.status === 'warning';
                        const isSelected = selectedCell?.memberId === member.id && selectedCell?.quarter === quarter;
                        const cellBg = isOver
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : isWarn
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : pct > 0
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500';
                        const timeOffDays = capacity.breakdown.find((b: CapacityBreakdownItem) => b.type === 'timeoff')?.days ?? 0;

                        return (
                          <td key={quarter} className="py-2.5 px-1.5 text-center">
                            <button
                              onClick={() => handleCellClick(member.id, quarter)}
                              className={`w-full rounded-lg py-2 px-1 text-xs font-semibold transition-all cursor-pointer
                                ${cellBg}
                                ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900' : 'hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600'}
                              `}
                            >
                              <div>{pct > 0 ? `${pct}%` : '—'}</div>
                              {timeOffDays > 0 && (
                                <div className="flex items-center justify-center gap-0.5 mt-0.5 text-amber-500 dark:text-amber-400">
                                  <CalendarOff size={9} />
                                  <span className="text-xs font-medium">{timeOffDays}d</span>
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Divider row between IT and Business */}
                  {peopleFilter === 'both' && bizHeatmapData.length > 0 && (
                    <tr>
                      <td colSpan={visibleQuarters.length + 1} className="py-1 pl-5 bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Business</span>
                        <span className="ml-2 text-xs text-slate-400 italic">(informational only — does not affect IT capacity)</span>
                      </td>
                    </tr>
                  )}

                  {/* Business rows */}
                  {peopleFilter !== 'it_only' && bizHeatmapData.map(({ contact, cells }) => (
                    <tr key={contact.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                      <td className="py-2.5 pl-5 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-normal text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px]">{contact.name}</span>
                          <span className="shrink-0 text-[10px] font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500">BIZ</span>
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{contact.title ?? contact.department ?? ''}</div>
                      </td>
                      {cells.map(({ quarter, cell }) => {
                        const pct = cell.usedPercent;
                        const isOver = pct >= 100;
                        const isWarn = pct >= 90 && !isOver;
                        const cellBg = isOver
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                          : isWarn
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                          : pct > 0
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600';
                        return (
                          <td key={quarter} className="py-2.5 px-1.5 text-center">
                            <div
                              title={cell.breakdownByProject.map(b => `${b.projectName}${b.phaseName ? ` / ${b.phaseName}` : ''}: ${b.days.toFixed(1)}d`).join('\n')}
                              className={`w-full rounded-lg py-2 px-1 text-xs font-semibold ${cellBg}`}
                            >
                              {pct > 0 ? `${pct}%` : '—'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 dark:bg-green-800 inline-block" /> Available (&lt;90%)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800 inline-block" /> High (90–99%)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 dark:bg-red-800 inline-block" /> Over-allocated (≥100%)</span>
              <span className="flex items-center gap-1.5 ml-2"><CalendarOff size={11} className="text-amber-500" /> Time off</span>
              <div className="flex-1" />
              <span className="text-slate-400">Click any cell to drill down</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drill-down panel */}
      {drillDown && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {drillDown.member.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {drillDown.member.role} · {drillDown.quarter}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <CapacityBadge capacity={drillDown.capacity} />
                <button onClick={() => setSelectedCell(null)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Summary bar */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    drillDown.capacity.status === 'overallocated'
                      ? 'bg-red-500'
                      : drillDown.capacity.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, drillDown.capacity.usedPercent)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-20 text-right">
                {drillDown.capacity.usedDays.toFixed(1)}d / {drillDown.capacity.totalWorkdays}d
              </span>
            </div>

            {/* Breakdown grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {drillDown.capacity.breakdown.map((item: CapacityBreakdownItem, i: number) => (
                <BreakdownCard key={i} item={item} />
              ))}

              {/* Available / Over */}
              <div className={`rounded-lg p-3 border ${
                drillDown.capacity.status === 'overallocated'
                  ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  : drillDown.capacity.status === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                  : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
              }`}>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {drillDown.capacity.availableDaysRaw < 0 ? 'Over-allocated by' : 'Available'}
                </div>
                <div className={`text-lg font-bold ${
                  drillDown.capacity.status === 'overallocated'
                    ? 'text-red-700 dark:text-red-300'
                    : drillDown.capacity.status === 'warning'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-green-700 dark:text-green-300'
                }`}>
                  {drillDown.capacity.availableDaysRaw < 0
                    ? `${Math.abs(drillDown.capacity.availableDaysRaw).toFixed(1)}d`
                    : `${drillDown.capacity.availableDays.toFixed(1)}d`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Small helpers ──────────────────────────────────────────────────────── */

function Stat({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'blue' | 'slate' | 'red';
}) {
  const iconColors = {
    blue: 'text-blue-500',
    slate: 'text-slate-400',
    red: 'text-red-500',
  };
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className={iconColors[color]} />
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function CapacityBadge({ capacity }: { capacity: CapacityResult }) {
  const cls =
    capacity.status === 'overallocated'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : capacity.status === 'warning'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  const label =
    capacity.status === 'overallocated' ? 'Over-allocated'
    : capacity.status === 'warning' ? 'High utilization'
    : 'Available';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {capacity.usedPercent}% · {label}
    </span>
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
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {step.detail}
                    </p>
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

function BreakdownCard({ item }: { item: CapacityBreakdownItem }) {
  if (item.type === 'bau') {
    return (
      <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">BAU Reserve</div>
        <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{item.days}d</div>
      </div>
    );
  }
  if (item.type === 'timeoff') {
    return (
      <div className="rounded-lg p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
        <div className="text-xs text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
          <CalendarOff size={11} />
          Time Off
        </div>
        <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{item.days}d</div>
      </div>
    );
  }
  if (item.type === 'jira') {
    return (
      <div className="rounded-lg p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800">
        <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1 truncate flex items-center gap-1" title={`${item.jiraKey}: ${item.jiraSummary}`}>
          <Zap size={11} />
          {item.jiraKey}
          {item.jiraSummary && <span className="text-indigo-400 dark:text-indigo-500 truncate"> {item.jiraSummary}</span>}
        </div>
        <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{item.days}d</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
      <div className="text-xs text-blue-600 dark:text-blue-400 mb-1 truncate" title={`${item.projectName} / ${item.phaseName}`}>
        {item.projectName}
        {item.phaseName && <span className="text-blue-400 dark:text-blue-500"> / {item.phaseName}</span>}
      </div>
      <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{item.days}d</div>
    </div>
  );
}
