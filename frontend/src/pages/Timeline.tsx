import { useState, useMemo } from 'react';
import { User, BarChart2, Calendar, Zap, CalendarOff, GripVertical } from 'lucide-react';
import { JiraGantt } from '../components/JiraGantt';
import { EmptyState } from '../components/ui/EmptyState';
import { Card, CardContent } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PageHeader } from '../components/layout/PageHeader';
import { useAppStore, useCurrentState } from '../stores/appStore';
import { addLocalPhase, removeLocalPhase, generateId } from '../stores/actions';
import type { LocalPhase } from '../types';
import { calculateCapacity } from '../utils/capacity';
import {
  getCurrentQuarter, getWorkdaysInQuarter, getWorkdaysInDateRangeForQuarter,
} from '../utils/calendar';
import {
  generateSprints, getSprintsForQuarter, formatDateRange, getWorkdaysInSprint,
} from '../utils/sprints';
import type { TeamMember, Sprint } from '../types';

type TimelineView = 'gantt' | 'team';
type TimelineGranularity = 'quarter' | 'sprint' | 'dates';

export function Timeline() {
  const state       = useCurrentState();
  const setCurrentView = useAppStore(s => s.setCurrentView);
  const { teamMembers, quarters, settings, publicHolidays } = state;

  const [viewMode,    setViewMode]    = useState<TimelineView>('gantt');
  const [granularity, setGranularity] = useState<TimelineGranularity>('quarter');
  const [labelWidth,  setLabelWidth]  = useState(256);

  // Person filters
  const [squadFilter, setSquadFilter]           = useState('');
  const [processTeamFilter, setProcessTeamFilter] = useState('');
  const [memberSearch, setMemberSearch]           = useState('');
  const [bizSearch, setBizSearch]                 = useState('');

  const startLabelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = labelWidth;
    const onMove = (ev: MouseEvent) =>
      setLabelWidth(Math.max(140, Math.min(520, startW + ev.clientX - startX)));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const defaultFromIdx = Math.max(0, quarters.indexOf(getCurrentQuarter()));
  const [fromIdx, setFromIdx] = useState(defaultFromIdx);
  const [toIdx,   setToIdx]   = useState(Math.min(quarters.length - 1, defaultFromIdx + 3));

  const quartersToShow  = Math.max(1, toIdx - fromIdx + 1);
  const currentQuarter  = getCurrentQuarter();
  const allSprints      = useMemo(() => generateSprints(settings, 2), [settings]);
  const defaultCountryHolidays = useMemo(
    () => publicHolidays.filter(h => h.countryId === settings.defaultCountryId),
    [publicHolidays, settings.defaultCountryId],
  );
  const visibleQuarters = quarters.slice(fromIdx, fromIdx + quartersToShow);

  const visibleMonths = useMemo(() => {
    const firstQ = visibleQuarters[0];
    if (!firstQ) return [];
    const [q, yr] = firstQ.split(' ');
    const year       = parseInt(yr);
    const startMonth = (parseInt(q.slice(1)) - 1) * 3;
    const months: { year: number; month: number; label: string }[] = [];
    const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let i = 0; i < quartersToShow * 3; i++) {
      const m = (startMonth + i) % 12;
      const y = year + Math.floor((startMonth + i) / 12);
      months.push({ year: y, month: m, label: `${MONTH_LABELS[m]} ${y}` });
    }
    return months;
  }, [visibleQuarters, quartersToShow]);

  const fromOptions = quarters.map((q, i) => ({ value: String(i), label: q }));
  const toOptions   = quarters.map((q, i) => ({ value: String(i), label: q })).filter((_, i) => i >= fromIdx);

  const squadOptions = useMemo(() => [
    { value: '', label: 'All Squads' },
    ...state.squads.map(s => ({ value: s.id, label: s.name })),
  ], [state.squads]);

  const processTeamOptions = useMemo(() => [
    { value: '', label: 'All Process Teams' },
    ...state.processTeams.map(t => ({ value: t.id, label: t.name })),
  ], [state.processTeams]);

  // Pre-filter team members for Team view
  const filteredTeamMembers = useMemo(() => {
    let result = teamMembers;
    if (squadFilter) result = result.filter(m => m.squadId === squadFilter);
    if (processTeamFilter) result = result.filter(m => m.processTeamIds?.includes(processTeamFilter));
    if (memberSearch) {
      const q = memberSearch.toLowerCase();
      result = result.filter(m => m.name.toLowerCase().includes(q));
    }
    return result;
  }, [teamMembers, squadFilter, processTeamFilter, memberSearch]);

  // Pre-filter Jira items for Gantt view
  const filteredJiraItems = useMemo(() => {
    const items = state.jiraWorkItems ?? [];
    if (!squadFilter && !processTeamFilter && !memberSearch && !bizSearch) return items;

    const bizAssignmentsByKey = new Map<string, string[]>();
    for (const a of state.jiraItemBizAssignments ?? []) {
      const list = bizAssignmentsByKey.get(a.jiraKey) ?? [];
      list.push(a.contactId);
      bizAssignmentsByKey.set(a.jiraKey, list);
    }

    return items.filter(item => {
      if (squadFilter || processTeamFilter || memberSearch) {
        const member = teamMembers.find(m => m.email && item.assigneeEmail && m.email.toLowerCase() === item.assigneeEmail.toLowerCase());
        if (squadFilter && member?.squadId !== squadFilter) return false;
        if (processTeamFilter && !member?.processTeamIds?.includes(processTeamFilter)) return false;
        if (memberSearch) {
          const q = memberSearch.toLowerCase();
          if (!(item.assigneeName ?? '').toLowerCase().includes(q) && !(member?.name ?? '').toLowerCase().includes(q)) return false;
        }
      }
      if (bizSearch) {
        const q = bizSearch.toLowerCase();
        const contactIds = bizAssignmentsByKey.get(item.jiraKey) ?? [];
        const bizMatch = contactIds.some(id => {
          const c = state.businessContacts.find(bc => bc.id === id);
          return c && c.name.toLowerCase().includes(q);
        });
        if (!bizMatch) return false;
      }
      return true;
    });
  }, [state.jiraWorkItems, state.jiraItemBizAssignments, state.businessContacts, teamMembers, squadFilter, processTeamFilter, memberSearch, bizSearch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline"
        subtitle="Q1–Q4 2026 · VS Finance · Mileway BV"
        actions={
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {([
                { id: 'gantt', label: 'Gantt', Icon: BarChart2 },
                { id: 'team',  label: 'Team',  Icon: User },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            {/* Granularity toggle — Team only */}
            {viewMode === 'team' && (
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                {([
                  { id: 'quarter', label: 'Quarters', Icon: Calendar },
                  { id: 'sprint',  label: 'Sprints',  Icon: Zap },
                  { id: 'dates',   label: 'Dates',    Icon: CalendarOff },
                ] as const).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setGranularity(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      granularity === id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Date-range filter — Team only */}
            {viewMode === 'team' && (
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
            )}

            {/* Person filters */}
            {state.squads.length > 0 && (
              <Select value={squadFilter} onChange={e => setSquadFilter(e.target.value)} options={squadOptions} className="w-36" />
            )}
            {state.processTeams.length > 0 && (
              <Select value={processTeamFilter} onChange={e => setProcessTeamFilter(e.target.value)} options={processTeamOptions} className="w-44" />
            )}
            <input
              type="text"
              placeholder="IT member…"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
            <input
              type="text"
              placeholder="BIZ contact…"
              value={bizSearch}
              onChange={e => setBizSearch(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-36"
            />
          </div>
        }
      />

      {/* ── Gantt View ─────────────────────────────────────────────────────── */}
      {viewMode === 'gantt' && (
        <JiraGantt
          items={filteredJiraItems}
          bizAssignments={state.jiraItemBizAssignments ?? []}
          businessContacts={state.businessContacts ?? []}
          teamMembers={teamMembers}
          localPhases={state.localPhases ?? []}
          savedSprints={state.sprints ?? []}
          settings={settings}
          quarters={quarters}
          jiraBaseUrl={state.jiraConnections.find(c => c.isActive)?.jiraBaseUrl.replace(/\/+$/, '') ?? ''}
          onAddLocalPhase={(p: Omit<LocalPhase, 'id'>) => addLocalPhase({ ...p, id: generateId('lp') })}
          onRemoveLocalPhase={(id: string) => removeLocalPhase(id)}
        />
      )}

      {/* ── Team View ──────────────────────────────────────────────────────── */}
      {viewMode === 'team' && (
        <Card>
          <CardContent
            className="p-0 overflow-x-auto"
            style={{ '--lw': `${labelWidth}px` } as React.CSSProperties}
          >
            {/* Column headers */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div
                className="shrink-0 px-4 py-3 flex items-center justify-between border-r border-slate-200 dark:border-slate-700 relative"
                style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">Team Member</span>
                <div
                  onMouseDown={startLabelResize}
                  className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize group select-none"
                  title="Drag to resize column"
                >
                  <GripVertical size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
                </div>
              </div>

              {granularity === 'dates' ? (
                visibleMonths.map(({ year, month, label }) => {
                  const isCurrent = year === new Date().getFullYear() && month === new Date().getMonth();
                  return (
                    <div
                      key={label}
                      className={`flex-1 min-w-[100px] px-2 py-3 text-center ${isCurrent ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      <div className="font-medium text-xs">{label}</div>
                    </div>
                  );
                })
              ) : granularity === 'quarter' ? (
                visibleQuarters.map(quarter => {
                  const workDays = getWorkdaysInQuarter(quarter, defaultCountryHolidays);
                  return (
                    <div
                      key={quarter}
                      className={`flex-1 min-w-[150px] px-3 py-3 text-center ${quarter === currentQuarter ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      <div className="font-medium">{quarter}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{workDays} working days</div>
                    </div>
                  );
                })
              ) : (
                visibleQuarters.flatMap(quarter => {
                  const sprintsInQ = getSprintsForQuarter(quarter, allSprints);
                  return sprintsInQ.map(sprint => {
                    const sprintWorkdays = sprint.isByeWeek ? 0 : getWorkdaysInSprint(sprint, publicHolidays);
                    return (
                      <div
                        key={sprint.id}
                        className="flex-1 min-w-[120px] px-2 py-2 text-center border-l border-slate-200 dark:border-slate-700"
                      >
                        <div className={`font-medium text-xs ${sprint.isByeWeek ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                          {sprint.isByeWeek ? `${sprint.name} 🏖️` : sprint.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{formatDateRange(sprint.startDate, sprint.endDate)}</div>
                        {!sprint.isByeWeek && <div className="text-xs text-slate-400 dark:text-slate-500">{sprintWorkdays}d</div>}
                      </div>
                    );
                  });
                })
              )}
            </div>

            {/* Member rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamMembers.length === 0 ? (
                <EmptyState
                  icon={User}
                  title="No team members yet"
                  description="Add team members to see their capacity and assignments on the timeline."
                  action={{ label: 'Go to Team', onClick: () => setCurrentView('team') }}
                />
              ) : filteredTeamMembers.length === 0 ? (
                <EmptyState
                  icon={User}
                  title="No members match filters"
                  description="Try adjusting the squad, process team, or name filters."
                />
              ) : (
                filteredTeamMembers.map(member => (
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBER ROW
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
        <div className="shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
          <div className="font-medium text-slate-900 dark:text-white truncate" title={member.name}>{member.name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{member.role}</div>
        </div>
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
              className={`flex-1 min-w-[150px] px-3 py-3 ${quarter === currentQuarter ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
            >
              <ProgressBar value={capacity.usedDays} max={capacity.totalWorkdays} status={capacity.status} size="sm" />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">{capacity.usedDays.toFixed(0)}d / {capacity.totalWorkdays}d</span>
                <span className={`text-xs font-medium ${capacity.status === 'overallocated' ? 'text-red-500' : capacity.status === 'warning' ? 'text-amber-500' : 'text-green-500'}`}>
                  {capacity.usedPercent}%
                </span>
              </div>
              {timeOffDays > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <CalendarOff size={10} className="text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-500 font-medium">{timeOffDays}d off</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Sprint view
  const sprintCells = quarters.flatMap(quarter => {
    const sprintsInQ = getSprintsForQuarter(quarter, sprints);
    const quarterCapacity = calculateCapacity(member.id, quarter, state);
    const activeSprintCount = sprintsInQ.filter(s => !s.isByeWeek).length || 1;
    const memberHolidays = state.publicHolidays.filter(
      h => h.countryId === (member.countryId || state.settings.defaultCountryId)
    );
    return sprintsInQ.map(sprint => {
      const sprintWorkdays = sprint.isByeWeek ? 0 : getWorkdaysInSprint(sprint, memberHolidays);
      let sprintDays = 0;
      state.projects.forEach(project => {
        project.phases.forEach(phase => {
          phase.assignments.forEach(a => {
            if (a.memberId !== member.id) return;
            if (a.sprint === `${sprint.name} ${sprint.year}`) {
              sprintDays += a.days;
            } else if (a.quarter === quarter && !a.sprint && !sprint.isByeWeek) {
              sprintDays += a.days / activeSprintCount;
            }
          });
        });
      });
      const bauPerSprint = sprint.isByeWeek
        ? 0
        : (quarterCapacity.breakdown.find(b => b.type === 'bau')?.days || 0) / activeSprintCount;
      sprintDays += bauPerSprint;
      const usedPercent = sprintWorkdays > 0 ? Math.round((sprintDays / sprintWorkdays) * 100) : 0;
      const status = usedPercent > 100 ? 'overallocated' : usedPercent > 90 ? 'warning' : 'normal';
      return { sprint, sprintDays, sprintWorkdays, usedPercent, status };
    });
  });

  return (
    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <div className="shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
        <div className="font-medium text-slate-900 dark:text-white truncate" title={member.name}>{member.name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{member.role}</div>
      </div>
      {sprintCells.map(({ sprint, sprintDays, sprintWorkdays, usedPercent, status }) => (
        <div
          key={sprint.id}
          className={`flex-1 min-w-[120px] px-2 py-3 border-l border-slate-100 dark:border-slate-800 ${sprint.quarter === currentQuarter ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
        >
          <ProgressBar value={sprintDays} max={sprintWorkdays} status={status} size="sm" />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">{sprintDays.toFixed(0)}d</span>
            <span className={`text-xs font-medium ${status === 'overallocated' ? 'text-red-500' : status === 'warning' ? 'text-amber-500' : 'text-green-500'}`}>
              {usedPercent}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
