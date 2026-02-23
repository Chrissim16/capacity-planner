import { useMemo, useState, useCallback } from 'react';
import { Users, FolderKanban, AlertTriangle, TrendingUp, CalendarOff, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore, useCurrentState } from '../stores/appStore';
import { Card, CardContent } from '../components/ui/Card';
import { calculateCapacity, getWarnings, getTeamUtilizationSummary } from '../utils/capacity';
import { getCurrentQuarter, generateQuarters } from '../utils/calendar';
import type { CapacityResult, CapacityBreakdownItem } from '../types';

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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Capacity Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Team utilization across quarters
          </p>
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <EmptyState
            icon={TrendingUp}
            title="Welcome to the Capacity Planner"
            description="Get started by adding your team members and epics. Once you have data, the capacity heatmap will appear here."
            action={{ label: 'Add team members', onClick: () => setCurrentView('team') }}
            secondaryAction={{ label: 'Add an epic', onClick: () => setCurrentView('projects') }}
          />
        </div>
      )}

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
            {/* Quarter nav */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setStartIndex(i => Math.max(0, i - 1))}
                disabled={!canGoBack}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={18} className="text-slate-500" />
              </button>
              <div className="flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                {visibleQuarters[0]} — {visibleQuarters[visibleQuarters.length - 1]}
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
                    <th className="text-left py-3 pl-5 pr-4 font-medium text-sm text-slate-500 dark:text-slate-400 w-52">Team Member</th>
                    {visibleQuarters.map(q => (
                      <th key={q} className={`text-center py-3 px-2 font-medium text-sm min-w-[90px] ${q === currentQuarter ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {q}
                        {q === currentQuarter && <span className="block text-[10px] font-normal text-blue-400 dark:text-blue-500">current</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map(({ member, cells }) => (
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
                                  <span className="text-[10px] font-medium">{timeOffDays}d</span>
                                </div>
                              )}
                            </button>
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
