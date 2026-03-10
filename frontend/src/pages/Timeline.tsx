import { useState, useMemo } from 'react';
import { User, BarChart2, Calendar, Zap, CalendarOff, GripVertical } from 'lucide-react';
import { JiraGantt } from '../components/JiraGantt';
import { EmptyState } from '../components/ui/EmptyState';
import { Card, CardContent } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { ProgressBar } from '../components/ui/ProgressBar';
import { SkeletonGantt } from '../components/ui/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { useAppStore, useCurrentState, useIsLoading } from '../stores/appStore';
import { getForecastedDays } from '../utils/confidence';
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
 const state = useCurrentState();
 const setCurrentView = useAppStore(s => s.setCurrentView);
 const isLoading = useIsLoading();
 const { teamMembers, quarters, settings, publicHolidays } = state;

 const [viewMode, setViewMode] = useState<TimelineView>('gantt');
 const [granularity, setGranularity] = useState<TimelineGranularity>('quarter');
 const [labelWidth, setLabelWidth] = useState(256);

 // Person filters
 const [squadFilter, setSquadFilter] = useState('');
 const [processTeamFilter, setProcessTeamFilter] = useState('');
 const [memberSearch, setMemberSearch] = useState('');
 const [bizSearch, setBizSearch] = useState('');
 const [showCompleted, setShowCompleted] = useState(false);

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
 const [toIdx, setToIdx] = useState(Math.min(quarters.length - 1, defaultFromIdx + 3));

 const quartersToShow = Math.max(1, toIdx - fromIdx + 1);
 const currentQuarter = getCurrentQuarter();
 const allSprints = useMemo(() => generateSprints(settings, 2), [settings]);
 const defaultCountryHolidays = useMemo(
 () => publicHolidays.filter(h => h.countryId === settings.defaultCountryId),
 [publicHolidays, settings.defaultCountryId],
 );
 const visibleQuarters = quarters.slice(fromIdx, fromIdx + quartersToShow);

 const visibleMonths = useMemo(() => {
 const firstQ = visibleQuarters[0];
 if (!firstQ) return [];
 const [q, yr] = firstQ.split(' ');
 const year = parseInt(yr);
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
 const toOptions = quarters.map((q, i) => ({ value: String(i), label: q })).filter((_, i) => i >= fromIdx);

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

 const bizAssignmentsByKey = new Map<string, string[]>();
 for (const a of state.jiraItemBizAssignments ?? []) {
 const list = bizAssignmentsByKey.get(a.jiraKey) ?? [];
 list.push(a.contactId);
 bizAssignmentsByKey.set(a.jiraKey, list);
 }

 return items.filter(item => {
 if (!showCompleted && item.statusCategory === 'done') return false;

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
 }, [state.jiraWorkItems, state.jiraItemBizAssignments, state.businessContacts, teamMembers, showCompleted, squadFilter, processTeamFilter, memberSearch, bizSearch]);

 return (
 <div className="space-y-6">
 <PageHeader
 title="Timeline"
 subtitle="Q1–Q4 2026 · VS Finance · Mileway BV"
 actions={
 <div className="flex items-center gap-3">
 {/* View Toggle */}
 <div className="flex rounded-lg bg-slate-100 p-1">
 {([
 { id: 'gantt', label: 'Gantt', Icon: BarChart2 },
 { id: 'team', label: 'Team', Icon: User },
 ] as const).map(({ id, label, Icon }) => (
 <button
 key={id}
 onClick={() => setViewMode(id)}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
 viewMode === id
 ? 'bg-white text-slate-900 shadow-sm'
 : 'text-slate-600 '
 }`}
 >
 <Icon size={16} />
 {label}
 </button>
 ))}
 </div>

 {/* Granularity toggle — Team only */}
 {viewMode === 'team' && (
 <div className="flex rounded-lg bg-slate-100 p-1">
 {([
 { id: 'quarter', label: 'Quarters', Icon: Calendar },
 { id: 'sprint', label: 'Sprints', Icon: Zap },
 { id: 'dates', label: 'Dates', Icon: CalendarOff },
 ] as const).map(({ id, label, Icon }) => (
 <button
 key={id}
 onClick={() => setGranularity(id)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
 granularity === id
 ? 'bg-white text-slate-900 shadow-sm'
 : 'text-slate-600 '
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
 <span className="text-xs text-slate-500 whitespace-nowrap">From</span>
 <Select
 value={String(fromIdx)}
 onChange={(e) => {
 const next = parseInt(e.target.value);
 setFromIdx(next);
 if (toIdx < next) setToIdx(next);
 }}
 options={fromOptions}
 />
 <span className="text-xs text-slate-500 ">to</span>
 <Select
 value={String(toIdx)}
 onChange={(e) => setToIdx(parseInt(e.target.value))}
 options={toOptions}
 />
 </div>
 )}

 {/* Person filters */}
 {state.squads.length > 0 && (
 <select value={squadFilter} onChange={e => setSquadFilter(e.target.value)} className="w-36 text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0ED3CF] cursor-pointer">
 {squadOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 )}
 {state.processTeams.length > 0 && (
 <select value={processTeamFilter} onChange={e => setProcessTeamFilter(e.target.value)} className="w-44 text-sm px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0ED3CF] cursor-pointer">
 {processTeamOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 )}
 <input
 type="text"
 placeholder="IT member…"
 value={memberSearch}
 onChange={e => setMemberSearch(e.target.value)}
 className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0ED3CF] w-36"
 />
 <input
 type="text"
 placeholder="BIZ contact…"
 value={bizSearch}
 onChange={e => setBizSearch(e.target.value)}
 className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-36"
 />
 <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none whitespace-nowrap">
 <input
 type="checkbox"
 checked={showCompleted}
 onChange={e => setShowCompleted(e.target.checked)}
 className="accent-mw-primary"
 />
 Show completed
 </label>
 </div>
 }
 />

 {/* ── Gantt View ─────────────────────────────────────────────────────── */}
 {viewMode === 'gantt' && isLoading && filteredJiraItems.length === 0 && (
 <Card><CardContent><SkeletonGantt rows={8} /></CardContent></Card>
 )}
 {viewMode === 'gantt' && !isLoading && (
 filteredJiraItems.length === 0 ? (
 <Card>
 <CardContent>
 {(state.jiraWorkItems ?? []).length === 0 ? (
 <EmptyState
 icon={BarChart2}
 title="No Jira items yet"
 description="Sync your Jira board to populate the timeline. Go to Settings → Jira to connect and sync."
 />
 ) : (
 <EmptyState
 icon={BarChart2}
 title="No items match your filters"
 description="Try clearing the squad, process team, or assignee filters to see all timeline items."
 />
 )}
 </CardContent>
 </Card>
 ) : (
<JiraGantt
 items={filteredJiraItems}
 bizAssignments={state.jiraItemBizAssignments ?? []}
 businessContacts={state.businessContacts ?? []}
 teamMembers={teamMembers}
 savedSprints={state.sprints ?? []}
 settings={settings}
 quarters={quarters}
 jiraBaseUrl={state.jiraConnections.find(c => c.isActive)?.jiraBaseUrl.replace(/\/+$/, '') ?? ''}
/>
 )
 )}

 {/* ── Team View ──────────────────────────────────────────────────────── */}
 {viewMode === 'team' && (
 <Card>
 <CardContent
 className="p-0 overflow-x-auto"
 style={{ '--lw': `${labelWidth}px` } as React.CSSProperties}
 >
 {/* Column headers */}
 <div className="flex items-center border-b border-slate-200 bg-[#F5F3F0] /50">
 <div
 className="shrink-0 px-4 py-3 flex items-center justify-between border-r border-slate-200 relative"
 style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}
 >
 <span className="font-medium text-slate-700 ">Team Member</span>
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
 className={`flex-1 min-w-[100px] px-2 py-3 text-center ${isCurrent ? 'bg-[#E8F8F8] text-blue-700 dark:text-blue-400' : 'text-slate-600 '}`}
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
 className={`flex-1 min-w-[150px] px-3 py-3 text-center ${quarter === currentQuarter ? 'bg-[#E8F8F8] text-blue-700 dark:text-blue-400' : 'text-slate-600 '}`}
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
 className="flex-1 min-w-[120px] px-2 py-2 text-center border-l border-slate-200 "
 >
 <div className={`font-medium text-xs ${sprint.isByeWeek ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 '}`}>
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
 <div className="flex hover:bg-[#F5F3F0] /30 transition-colors">
 <div className="shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
 <div className="font-medium text-slate-900 truncate" title={member.name}>{member.name}</div>
 <div className="text-xs text-slate-500 mt-0.5">{member.role}</div>
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
 className={`flex-1 min-w-[150px] px-3 py-3 ${quarter === currentQuarter ? 'bg-[#E8F8F8]/50 dark:bg-blue-900/10' : ''}`}
 >
 <ProgressBar value={capacity.usedDays} max={capacity.totalWorkdays} status={capacity.status} size="sm" />
 <div className="flex justify-between items-center mt-1">
 <span className="text-xs text-slate-500 ">{capacity.usedDays.toFixed(0)}d / {capacity.totalWorkdays}d</span>
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
 if (member.email && !sprint.isByeWeek) {
 const memberEmail = member.email.toLowerCase();
 const defaultConfidence = state.jiraSettings?.defaultConfidenceLevel ?? 'medium';
 for (const item of state.jiraWorkItems) {
 if (item.statusCategory === 'done') continue;
 if (item.storyPoints == null) continue;
 if (item.type === 'epic' || item.type === 'feature') continue;
 if (!item.assigneeEmail || item.assigneeEmail.toLowerCase() !== memberEmail) continue;
 if (item.sprintName && item.sprintName.toLowerCase().includes(sprint.name.toLowerCase())) {
 const confidence = item.confidenceLevel ?? defaultConfidence;
 sprintDays += getForecastedDays(item.storyPoints, confidence, state.settings.confidenceLevels);
 }
 }
 }
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
 <div className="flex hover:bg-[#F5F3F0] /30 transition-colors">
 <div className="shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
 <div className="font-medium text-slate-900 truncate" title={member.name}>{member.name}</div>
 <div className="text-xs text-slate-500 mt-0.5">{member.role}</div>
 </div>
 {sprintCells.map(({ sprint, sprintDays, sprintWorkdays, usedPercent, status }) => (
 <div
 key={sprint.id}
 className={`flex-1 min-w-[120px] px-2 py-3 border-l border-slate-100 dark:border-slate-800 ${sprint.quarter === currentQuarter ? 'bg-[#E8F8F8]/50 dark:bg-blue-900/10' : ''}`}
 >
 <ProgressBar value={sprintDays} max={sprintWorkdays} status={status} size="sm" />
 <div className="flex justify-between items-center mt-1">
 <span className="text-xs text-slate-500 ">{sprintDays.toFixed(0)}d</span>
 <span className={`text-xs font-medium ${status === 'overallocated' ? 'text-red-500' : status === 'warning' ? 'text-amber-500' : 'text-green-500'}`}>
 {usedPercent}%
 </span>
 </div>
 </div>
 ))}
 </div>
 );
}
