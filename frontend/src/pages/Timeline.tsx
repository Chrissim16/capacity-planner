import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff, User, FolderKanban, Calendar, Zap, Filter, CalendarOff, GripVertical } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { ProgressBar } from '../components/ui/ProgressBar';
import { AssignmentModal } from '../components/forms/AssignmentModal';
import { useAppStore, useCurrentState } from '../stores/appStore';
import { calculateCapacity } from '../utils/capacity';
import { isQuarterInRange, getCurrentQuarter, getWorkWeeksInQuarter, getWorkdaysInDateRangeForQuarter } from '../utils/calendar';
import { generateSprints, getSprintsForQuarter, formatDateRange, getWorkdaysInSprint } from '../utils/sprints';
import type { Project, TeamMember, Sprint } from '../types';

type TimelineView = 'projects' | 'team';
type TimelineGranularity = 'quarter' | 'sprint' | 'dates';

export function Timeline() {
  const state = useCurrentState();
  const setCurrentView = useAppStore(s => s.setCurrentView);
  const { projects, teamMembers, quarters, settings, publicHolidays } = state;
  
  const [viewMode, setViewMode] = useState<TimelineView>('projects');
  const [granularity, setGranularity] = useState<TimelineGranularity>('quarter');
  const [showCompleted, setShowCompleted] = useState(false);
  const [labelWidth, setLabelWidth] = useState(256);

  const startLabelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = labelWidth;
    const onMove = (ev: MouseEvent) => {
      setLabelWidth(Math.max(140, Math.min(520, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Date-range filter: from/to quarter indices within state.quarters
  const defaultFromIdx = Math.max(0, quarters.indexOf(getCurrentQuarter()));
  const [fromIdx, setFromIdx] = useState(defaultFromIdx);
  const [toIdx, setToIdx] = useState(Math.min(quarters.length - 1, defaultFromIdx + 3));

  // Derived values (keep legacy names so downstream code stays unchanged)
  const startQuarterIndex = fromIdx;
  const quartersToShow = Math.max(1, toIdx - fromIdx + 1);
  const [assignContext, setAssignContext] = useState<{ projectId?: string; phaseId?: string }>({});
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const openAssign = (projectId: string, phaseId?: string) => {
    setAssignContext({ projectId, phaseId });
    setIsAssignOpen(true);
  };

  const currentQuarter = getCurrentQuarter();
  
  // Generate all sprints
  const allSprints = useMemo(() => generateSprints(settings, 2), [settings]);
  
  // Get visible quarters
  const visibleQuarters = quarters.slice(startQuarterIndex, startQuarterIndex + quartersToShow);

  // For 'dates' granularity: compute visible months (3 per quarter × quartersToShow)
  const visibleMonths = useMemo(() => {
    const firstQ = visibleQuarters[0];
    if (!firstQ) return [];
    const [q, yr] = firstQ.split(' ');
    const year = parseInt(yr);
    const startMonth = (parseInt(q.slice(1)) - 1) * 3; // Q1→0, Q2→3, Q3→6, Q4→9
    const totalMonths = quartersToShow * 3;
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 0; i < totalMonths; i++) {
      const m = (startMonth + i) % 12;
      const y = year + Math.floor((startMonth + i) / 12);
      months.push({
        year: y,
        month: m,
        label: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]} ${y}`,
      });
    }
    return months;
  }, [visibleQuarters, quartersToShow]);
  
  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (!showCompleted && p.status === 'Completed') return false;
      return true;
    });
  }, [projects, showCompleted]);

  // Quarter select options for the From / To dropdowns
  const fromOptions = quarters.map((q, i) => ({ value: String(i), label: q }));
  const toOptions = quarters
    .map((q, i) => ({ value: String(i), label: q }))
    .filter((_, i) => i >= fromIdx);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500';
      case 'Planning': return 'bg-blue-500';
      case 'On Hold': return 'bg-amber-500';
      case 'Completed': return 'bg-slate-400';
      default: return 'bg-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'border-l-red-500';
      case 'Medium': return 'border-l-amber-500';
      case 'Low': return 'border-l-slate-400';
      default: return 'border-l-slate-300';
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Timeline</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {viewMode === 'projects' 
              ? `${filteredProjects.length} projects` 
              : `${teamMembers.length} team members`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setViewMode('projects')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'projects'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <FolderKanban size={16} />
              Projects
            </button>
            <button
              onClick={() => setViewMode('team')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'team'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <User size={16} />
              Team
            </button>
          </div>

          {/* Granularity Toggle */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setGranularity('quarter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                granularity === 'quarter'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Calendar size={14} />
              Quarters
            </button>
            <button
              onClick={() => setGranularity('sprint')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                granularity === 'sprint'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Zap size={14} />
              Sprints
            </button>
            <button
              onClick={() => setGranularity('dates')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                granularity === 'dates'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <CalendarOff size={14} />
              Dates
            </button>
          </div>
          
          {viewMode === 'projects' && (
            <Button
              variant="secondary"
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? <Eye size={16} /> : <EyeOff size={16} />}
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </Button>
          )}

          {/* Date-range filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">From</span>
            <Select
              value={String(fromIdx)}
              onChange={(e) => {
                const next = parseInt(e.target.value);
                setFromIdx(next);
                if (toIdx < next) setToIdx(next);
              }}
              options={fromOptions}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">to</span>
            <Select
              value={String(toIdx)}
              onChange={(e) => setToIdx(parseInt(e.target.value))}
              options={toOptions}
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-0 overflow-x-auto" style={{ '--lw': `${labelWidth}px` } as React.CSSProperties}>
          {/* Quarter Navigation Header */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            {/* Left column - resizable header */}
            <div
              className="shrink-0 px-4 py-3 flex items-center justify-between border-r border-slate-200 dark:border-slate-700 relative"
              style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}
            >
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {viewMode === 'projects' ? 'Project' : 'Team Member'}
              </span>
              {/* Drag handle */}
              <div
                onMouseDown={startLabelResize}
                className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize group select-none"
                title="Drag to resize column"
              >
                <GripVertical size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
              </div>
            </div>
            
            {/* Quarter / Sprint / Dates Headers */}
            {granularity === 'dates' ? (
              visibleMonths.map(({ year, month, label }) => {
                const nowY = new Date().getFullYear();
                const nowM = new Date().getMonth();
                const isCurrent = year === nowY && month === nowM;
                return (
                  <div
                    key={label}
                    className={`flex-1 min-w-[100px] px-2 py-3 text-center ${
                      isCurrent ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-medium text-xs">{label}</div>
                  </div>
                );
              })
            ) : granularity === 'quarter' ? (
              // Quarter headers — show working day count per quarter
              visibleQuarters.map(quarter => {
                const workWeeks = getWorkWeeksInQuarter(quarter, []);
                const workDays = Math.round(workWeeks * 5);
                return (
                  <div
                    key={quarter}
                    className={`flex-1 min-w-[150px] px-3 py-3 text-center ${
                      quarter === currentQuarter
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-medium">{quarter}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {workDays} working days
                    </div>
                  </div>
                );
              })
            ) : granularity === 'sprint' ? (
              // Sprint headers — show working day count per sprint
              visibleQuarters.flatMap(quarter => {
                const sprintsInQ = getSprintsForQuarter(quarter, allSprints);
                return sprintsInQ.map(sprint => {
                  const sprintWorkdays = sprint.isByeWeek
                    ? 0
                    : getWorkdaysInSprint(sprint, publicHolidays);
                  return (
                    <div
                      key={sprint.id}
                      className="flex-1 min-w-[120px] px-2 py-2 text-center border-l border-slate-200 dark:border-slate-700"
                    >
                      <div className={`font-medium text-xs ${sprint.isByeWeek ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                        {sprint.isByeWeek ? `${sprint.name} 🏖️` : sprint.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatDateRange(sprint.startDate, sprint.endDate)}
                      </div>
                      {!sprint.isByeWeek && (
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {sprintWorkdays}d
                        </div>
                      )}
                    </div>
                  );
                });
              })
            ) : null}
          </div>

          {/* Rows */}
          {granularity === 'dates' && viewMode === 'projects' ? (
            // Date view — project bars spanning months
            <DateView
              projects={filteredProjects}
              months={visibleMonths}
              getPriorityColor={getPriorityColor}
              getStatusColor={getStatusColor}
              onAssign={openAssign}
            />
          ) : granularity !== 'dates' && viewMode === 'projects' ? (
            // Project View (quarter / sprint)
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProjects.length === 0 ? (
                projects.length === 0 ? (
                  <EmptyState
                    icon={FolderKanban}
                    title="No epics to display"
                    description="Create your first epic and add features to see them on the timeline."
                    action={{ label: 'Go to Epics', onClick: () => setCurrentView('projects') }}
                  />
                ) : (
                  <EmptyState
                    icon={Filter}
                    title="No matches"
                    description="No epics match your current filters."
                  />
                )
              ) : (
                filteredProjects.map(project => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    quarters={visibleQuarters}
                    sprints={allSprints}
                    granularity={granularity}
                    currentQuarter={currentQuarter}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    onAssign={openAssign}
                    teamMembers={teamMembers}
                  />
                ))
              )}
            </div>
          ) : (
            // Team View (quarter / sprint) — dates mode shows no team rows
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamMembers.length === 0 ? (
                <EmptyState
                  icon={User}
                  title="No team members yet"
                  description="Add team members to see their capacity and assignments on the timeline."
                  action={{ label: 'Go to Team', onClick: () => setCurrentView('team') }}
                />
              ) : (
                teamMembers.map(member => (
                  <TeamMemberRow
                    key={member.id}
                    member={member}
                    quarters={visibleQuarters}
                    sprints={allSprints}
                    granularity={granularity as 'quarter' | 'sprint'}
                    currentQuarter={currentQuarter}
                    state={state}
                  />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline Assignment Modal (US-016) */}
      <AssignmentModal
        isOpen={isAssignOpen}
        onClose={() => { setIsAssignOpen(false); setAssignContext({}); }}
        projectId={assignContext.projectId}
        phaseId={assignContext.phaseId}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-400">Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-600 dark:text-slate-400">Planning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-600 dark:text-slate-400">On Hold</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          <span className="text-slate-600 dark:text-slate-400">Completed</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE VIEW COMPONENT (US-046)
// ═══════════════════════════════════════════════════════════════════════════════

interface MonthInfo { year: number; month: number; label: string; }

function quarterToDateRange(q: string): { start: string; end: string } {
  const [qStr, yr] = q.split(' ');
  const year = parseInt(yr);
  const qNum = parseInt(qStr.slice(1));
  const startMonth = (qNum - 1) * 3;
  const endMonth = startMonth + 2;
  const endDay = [31,28,31,30,31,30,31,31,30,31,30,31][endMonth];
  const pad = (n: number) => String(n + 1).padStart(2, '0');
  return {
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(endMonth)}-${endDay}`,
  };
}

interface DateViewProps {
  projects: Project[];
  months: MonthInfo[];
  getPriorityColor: (p: string) => string;
  getStatusColor: (s: string) => string;
  onAssign?: (projectId: string, phaseId?: string) => void;
}

function DateView({ projects, months, getPriorityColor, getStatusColor, onAssign }: DateViewProps) {
  if (months.length === 0) return null;

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const viewStart = new Date(firstMonth.year, firstMonth.month, 1);
  const viewEnd = new Date(lastMonth.year, lastMonth.month + 1, 0);
  const totalDays = Math.ceil((viewEnd.getTime() - viewStart.getTime()) / 86400000) + 1;

  const getBarStyle = (startStr: string | undefined, endStr: string | undefined) => {
    if (!startStr || !endStr) return null;
    const s = new Date(startStr + 'T00:00:00');
    const e = new Date(endStr + 'T23:59:59');
    if (e < viewStart || s > viewEnd) return null;
    const clampedS = s < viewStart ? viewStart : s;
    const clampedE = e > viewEnd ? viewEnd : e;
    const offsetDays = Math.ceil((clampedS.getTime() - viewStart.getTime()) / 86400000);
    const spanDays = Math.ceil((clampedE.getTime() - clampedS.getTime()) / 86400000) + 1;
    return {
      left: `${(offsetDays / totalDays) * 100}%`,
      width: `${Math.max((spanDays / totalDays) * 100, 1.5)}%`,
    };
  };

  const today = new Date().toISOString().split('T')[0];
  const todayOffset = Math.ceil((new Date(today).getTime() - viewStart.getTime()) / 86400000);
  const todayPct = totalDays > 0 ? (todayOffset / totalDays) * 100 : -1;

  const STATUS_COLORS: Record<string, string> = {
    'Active': 'bg-emerald-500',
    'Planning': 'bg-blue-500',
    'On Hold': 'bg-amber-500',
    'Completed': 'bg-slate-400',
    'Cancelled': 'bg-red-400',
  };

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {projects.map(project => {
        // Determine project date range
        let projStart = project.startDate;
        let projEnd = project.endDate;
        if (!projStart && !projEnd && project.phases.length > 0) {
          const allQuarters = project.phases.flatMap(ph => {
            const r = quarterToDateRange(ph.startQuarter);
            const r2 = quarterToDateRange(ph.endQuarter);
            return [r.start, r2.end];
          });
          projStart = allQuarters.sort()[0];
          projEnd = allQuarters.sort().reverse()[0];
        }

        const barStyle = getBarStyle(projStart, projEnd);
        const color = STATUS_COLORS[project.status] ?? 'bg-blue-400';

        return (
          <div key={project.id} className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
            {/* Project label */}
            <div className={`shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800 border-l-4 ${getPriorityColor(project.priority)}`} style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
              <div className="font-medium text-slate-900 dark:text-white truncate text-sm" title={project.name}>
                {project.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`} />
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {projStart && projEnd ? `${projStart} → ${projEnd}` : 'No dates set'}
                </span>
              </div>
            </div>

            {/* Bar area */}
            <div className="flex-1 relative py-4 overflow-hidden min-w-0">
              {/* Month grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {months.map((m, i) => (
                  <div key={m.label} className={`flex-1 ${i > 0 ? 'border-l border-slate-100 dark:border-slate-800' : ''}`} />
                ))}
              </div>

              {/* Today line */}
              {todayPct >= 0 && todayPct <= 100 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-400 dark:bg-red-500 z-10 pointer-events-none"
                  style={{ left: `${todayPct}%` }}
                />
              )}

              {/* Project bar */}
              {barStyle ? (
                <button
                  className={`absolute top-1/2 -translate-y-1/2 h-6 rounded ${color} opacity-80 hover:opacity-100 transition-opacity flex items-center px-2 overflow-hidden`}
                  style={barStyle}
                  onClick={() => onAssign?.(project.id)}
                  title={`${project.name} — click to assign`}
                >
                  <span className="text-white text-xs font-medium truncate">{project.name}</span>
                </button>
              ) : (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 italic">
                  no dates
                </span>
              )}

              {/* Phase bars below project bar */}
              {project.phases.map((phase, pIdx) => {
                const phStart = phase.startDate ?? quarterToDateRange(phase.startQuarter).start;
                const phEnd = phase.endDate ?? quarterToDateRange(phase.endQuarter).end;
                const phStyle = getBarStyle(phStart, phEnd);
                if (!phStyle) return null;
                const top = `${50 + 26 + pIdx * 18}%`;
                return (
                  <button
                    key={phase.id}
                    className="absolute h-4 rounded bg-blue-300 dark:bg-blue-700 opacity-70 hover:opacity-100 flex items-center px-1 overflow-hidden transition-opacity"
                    style={{ ...phStyle, top, transform: 'translateY(-50%)' }}
                    onClick={() => onAssign?.(project.id, phase.id)}
                    title={`${phase.name} — click to assign`}
                  >
                    <span className="text-blue-900 dark:text-blue-100 text-[9px] truncate">{phase.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {projects.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">No epics match the current filters.</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface ProjectRowProps {
  project: Project;
  quarters: string[];
  sprints: Sprint[];
  granularity: TimelineGranularity;
  currentQuarter: string;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
  onAssign?: (projectId: string, phaseId?: string) => void;
  teamMembers: TeamMember[];
}

function ProjectRow({ project, quarters, sprints, granularity, currentQuarter, getPriorityColor, getStatusColor, onAssign, teamMembers }: ProjectRowProps) {
  const getMemberName = (id: string) => teamMembers.find(m => m.id === id)?.name ?? 'Unknown';
  // US-044: collapse/expand feature sub-rows
  const [expanded, setExpanded] = useState(false);
  const hasPhases = project.phases.length > 0;
  const featureLabel = `${project.phases.length} feature${project.phases.length !== 1 ? 's' : ''}`;

  if (granularity === 'quarter') {
    const quarterData = quarters.map(quarter => {
      const activePhases = project.phases.filter(phase =>
        isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter)
      );
      const totalDays = activePhases.reduce((sum, phase) =>
        sum + phase.assignments.reduce((asum, a) => a.quarter === quarter ? asum + a.days : asum, 0), 0
      );
      return { quarter, activePhases, totalDays };
    });

    return (
      <div>
        {/* Epic / project summary row */}
        <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
          <div className={`shrink-0 px-3 py-3 border-r border-slate-100 dark:border-slate-800 border-l-4 ${getPriorityColor(project.priority)}`} style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
            <div className="flex items-center gap-1.5">
              {hasPhases && (
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title={expanded ? 'Collapse features' : 'Expand features'}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              <div className="font-medium text-slate-900 dark:text-white truncate" title={project.name}>
                {project.name}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 pl-5">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`} />
              <span className="text-xs text-slate-500 dark:text-slate-400">{featureLabel}</span>
            </div>
          </div>

          {/* Quarter Cells — aggregate when expanded, detailed when collapsed */}
          {quarterData.map(({ quarter, activePhases, totalDays }) => (
            <div
              key={quarter}
              className={`flex-1 min-w-[150px] px-3 py-3 ${quarter === currentQuarter ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
            >
              {!expanded && activePhases.length > 0 && (
                <div className="space-y-1">
                  {activePhases.map(phase => (
                    <button
                      key={phase.id}
                      onClick={() => onAssign?.(project.id, phase.id)}
                      className="w-full text-left px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded text-xs font-medium text-blue-700 dark:text-blue-300 truncate transition-colors group"
                      title={`${phase.name} — click to edit assignments`}
                    >
                      <span className="truncate">{phase.name}</span>
                      <span className="hidden group-hover:inline ml-1 text-blue-500 dark:text-blue-400">✎</span>
                    </button>
                  ))}
                  {totalDays > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{totalDays}d allocated</div>
                  )}
                </div>
              )}
              {expanded && totalDays > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{totalDays}d total</div>
              )}
              {activePhases.length === 0 && !expanded && onAssign && (
                <button
                  onClick={() => onAssign(project.id)}
                  className="w-full text-left px-2 py-1 rounded text-xs text-slate-300 dark:text-slate-600 hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100"
                >
                  + Assign
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Feature sub-rows — shown when expanded */}
        {expanded && project.phases.map(phase => {
          const phaseQuarterData = quarters.map(quarter => {
            const isActive = isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter);
            const quarterAssignments = isActive
              ? phase.assignments.filter(a => a.quarter === quarter)
              : [];
            const days = quarterAssignments.reduce((sum, a) => sum + a.days, 0);
            return { quarter, isActive, quarterAssignments, days };
          });

          // All unique assignees across all quarters for the label column
          const allAssignees = [...new Map(
            phase.assignments.map(a => [a.memberId, getMemberName(a.memberId)])
          ).values()];

          return (
            <div key={phase.id} className="flex border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
              <div className="shrink-0 pl-8 pr-3 py-2.5 border-r border-slate-100 dark:border-slate-800" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={phase.name}>
                    {phase.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 pl-3.5 flex-wrap">
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {phase.startQuarter}{phase.endQuarter !== phase.startQuarter ? ` – ${phase.endQuarter}` : ''}
                  </span>
                  {allAssignees.length > 0 && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">
                      {allAssignees.slice(0, 2).join(', ')}{allAssignees.length > 2 ? ` +${allAssignees.length - 2}` : ''}
                    </span>
                  )}
                </div>
              </div>
              {phaseQuarterData.map(({ quarter, isActive, quarterAssignments, days }) => (
                <div
                  key={quarter}
                  className={`flex-1 min-w-[150px] px-2 py-2.5 ${quarter === currentQuarter ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
                >
                  {isActive ? (
                    <button
                      onClick={() => onAssign?.(project.id, phase.id)}
                      className="w-full text-left group"
                      title={`${phase.name} — click to edit assignments`}
                    >
                      {days > 0 ? (
                        <div className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-colors">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{days}d</span>
                            <span className="text-xs text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                          </div>
                          <div className="space-y-0.5">
                            {quarterAssignments.map((a, i) => (
                              <div key={i} className="flex items-center justify-between gap-1">
                                <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{getMemberName(a.memberId)}</span>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{a.days}d</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="px-2 py-1 rounded border border-dashed border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs text-slate-400">+ Assign</span>
                        </div>
                      )}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Sprint view ──────────────────────────────────────────────────────────────
  const sprintCells = quarters.flatMap(quarter => {
    const sprintsInQ = getSprintsForQuarter(quarter, sprints);
    return sprintsInQ.map(sprint => {
      const activePhases = project.phases.filter(phase =>
        isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter)
      );
      const sprintDays = activePhases.reduce((sum, phase) =>
        sum + phase.assignments.reduce((asum, a) => {
          if (a.sprint === `${sprint.name} ${sprint.year}`) return asum + a.days;
          if (a.quarter === quarter && !a.sprint) {
            const sprintCount = sprintsInQ.length || 1;
            return asum + (a.days / sprintCount);
          }
          return asum;
        }, 0), 0
      );
      return { sprint, activePhases, sprintDays };
    });
  });

  return (
    <div>
      {/* Epic / project summary row */}
      <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
        <div className={`shrink-0 px-3 py-3 border-r border-slate-100 dark:border-slate-800 border-l-4 ${getPriorityColor(project.priority)}`} style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
          <div className="flex items-center gap-1.5">
            {hasPhases && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title={expanded ? 'Collapse features' : 'Expand features'}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            <div className="font-medium text-slate-900 dark:text-white truncate" title={project.name}>
              {project.name}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 pl-5">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`} />
            <span className="text-xs text-slate-500 dark:text-slate-400">{featureLabel}</span>
          </div>
        </div>

        {sprintCells.map(({ sprint, activePhases, sprintDays }) => (
          <div
            key={sprint.id}
            className={`flex-1 min-w-[120px] px-2 py-3 border-l border-slate-100 dark:border-slate-800 ${
              sprint.quarter === currentQuarter ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
            }`}
          >
            {activePhases.length > 0 && sprintDays > 0 && (
              <button
                onClick={() => onAssign?.(project.id)}
                className="w-full space-y-1 group"
                title="Click to edit assignments"
              >
                <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden group-hover:ring-2 group-hover:ring-blue-400 transition-all">
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (sprintDays / 15) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  {sprintDays.toFixed(1)}d
                </div>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Feature sub-rows in sprint view */}
      {expanded && project.phases.map(phase => {
        const phaseSprintCells = quarters.flatMap(quarter => {
          const sprintsInQ = getSprintsForQuarter(quarter, sprints);
          return sprintsInQ.map(sprint => {
            const isActive = isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter);
            const days = isActive
              ? phase.assignments.reduce((sum, a) => {
                  if (a.sprint === `${sprint.name} ${sprint.year}`) return sum + a.days;
                  if (a.quarter === quarter && !a.sprint) {
                    const sc = sprintsInQ.length || 1;
                    return sum + (a.days / sc);
                  }
                  return sum;
                }, 0)
              : 0;
            return { sprint, isActive, days };
          });
        });
        return (
          <div key={phase.id} className="flex border-t border-dashed border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <div className="shrink-0 pl-10 pr-3 py-2 border-r border-slate-100 dark:border-slate-800" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate" title={phase.name}>
                  {phase.name}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 pl-2.5">
                {phase.startQuarter} – {phase.endQuarter}
              </div>
            </div>
            {phaseSprintCells.map(({ sprint, isActive, days }) => (
              <div
                key={sprint.id}
                className={`flex-1 min-w-[120px] px-2 py-2 border-l border-slate-100 dark:border-slate-800 ${
                  sprint.quarter === currentQuarter ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''
                }`}
              >
                {isActive && days > 0 && (
                  <button
                    onClick={() => onAssign?.(project.id, phase.id)}
                    className="w-full space-y-1 group"
                    title={`${phase.name} — click to edit`}
                  >
                    <div className="h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 dark:bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, (days / 15) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-400 text-center">{days.toFixed(1)}d</div>
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBER ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface TeamMemberRowProps {
  member: TeamMember;
  quarters: string[];
  sprints: Sprint[];
  granularity: 'quarter' | 'sprint';
  currentQuarter: string;
  state: ReturnType<typeof useAppStore.getState>['data'];
}

function TeamMemberRow({ member, quarters, sprints, granularity, currentQuarter, state }: TeamMemberRowProps) {
  if (granularity === 'quarter') {
    return (
      <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        {/* Member Info */}
        <div className="shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
          <div className="font-medium text-slate-900 dark:text-white truncate" title={member.name}>
            {member.name}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {member.role}
          </div>
        </div>
        
        {/* Quarter Cells with Capacity */}
        {quarters.map(quarter => {
          const capacity = calculateCapacity(member.id, quarter, state);
          const memberHolidays = state.publicHolidays.filter(
            h => h.countryId === (member.countryId || state.settings.defaultCountryId)
          );
          const timeOffDays = state.timeOff
            .filter(t => t.memberId === member.id)
            .reduce((sum, t) => sum + getWorkdaysInDateRangeForQuarter(t.startDate, t.endDate, quarter, memberHolidays), 0);
          
          return (
            <div
              key={quarter}
              className={`flex-1 min-w-[150px] px-3 py-3 ${
                quarter === currentQuarter 
                  ? 'bg-blue-50/50 dark:bg-blue-900/10' 
                  : ''
              }`}
            >
              <ProgressBar 
                value={capacity.usedDays} 
                max={capacity.totalWorkdays} 
                status={capacity.status}
                size="sm"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {capacity.usedDays.toFixed(0)}d / {capacity.totalWorkdays}d
                </span>
                <span className={`text-xs font-medium ${
                  capacity.status === 'overallocated' ? 'text-red-500' :
                  capacity.status === 'warning' ? 'text-amber-500' :
                  'text-green-500'
                }`}>
                  {capacity.usedPercent}%
                </span>
              </div>
              {timeOffDays > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <CalendarOff size={10} className="text-orange-500 shrink-0" />
                  <span className="text-xs text-orange-500 font-medium">
                    {timeOffDays}d off
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Sprint view - show allocation per sprint
  const sprintCells = quarters.flatMap(quarter => {
    const sprintsInQ = getSprintsForQuarter(quarter, sprints);
    const quarterCapacity = calculateCapacity(member.id, quarter, state);
    const sprintWorkdays = Math.round(quarterCapacity.totalWorkdays / (sprintsInQ.length || 1));
    
    return sprintsInQ.map(sprint => {
      // Calculate sprint-specific allocation from assignments
      let sprintDays = 0;
      state.projects.forEach(project => {
        project.phases.forEach(phase => {
          phase.assignments.forEach(a => {
            if (a.memberId !== member.id) return;
            if (a.sprint === `${sprint.name} ${sprint.year}`) {
              sprintDays += a.days;
            } else if (a.quarter === quarter && !a.sprint) {
              // Distribute quarter assignment across sprints
              sprintDays += a.days / (sprintsInQ.length || 1);
            }
          });
        });
      });
      
      // Add BAU (distributed across sprints)
      const bauPerSprint = (quarterCapacity.breakdown.find(b => b.type === 'bau')?.days || 0) / (sprintsInQ.length || 1);
      sprintDays += bauPerSprint;
      
      const usedPercent = sprintWorkdays > 0 ? Math.round((sprintDays / sprintWorkdays) * 100) : 0;
      const status = usedPercent > 100 ? 'overallocated' : usedPercent > 90 ? 'warning' : 'normal';
      
      return { sprint, sprintDays, sprintWorkdays, usedPercent, status };
    });
  });

  return (
    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      {/* Member Info */}
      <div className="shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
        <div className="font-medium text-slate-900 dark:text-white truncate" title={member.name}>
          {member.name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {member.role}
        </div>
      </div>
      
      {/* Sprint Cells with Capacity */}
      {sprintCells.map(({ sprint, sprintDays, sprintWorkdays, usedPercent, status }) => (
        <div
          key={sprint.id}
          className={`flex-1 min-w-[120px] px-2 py-3 border-l border-slate-100 dark:border-slate-800 ${
            sprint.quarter === currentQuarter 
              ? 'bg-blue-50/50 dark:bg-blue-900/10' 
              : ''
          }`}
        >
          <ProgressBar 
            value={sprintDays} 
            max={sprintWorkdays} 
            status={status}
            size="sm"
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {sprintDays.toFixed(0)}d
            </span>
            <span className={`text-xs font-medium ${
              status === 'overallocated' ? 'text-red-500' :
              status === 'warning' ? 'text-amber-500' :
              'text-green-500'
            }`}>
              {usedPercent}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
