import { useState, useMemo, useCallback } from 'react';
import { User, BarChart2, Calendar, Zap, CalendarOff, GripVertical } from 'lucide-react';
import { JiraGantt } from '../components/JiraGantt';
import { AssignPanel } from '../components/planner/AssignPanel';
import { EmptyState } from '../components/ui/EmptyState';
import { Card, CardContent } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { ProgressBar } from '../components/ui/ProgressBar';
import { SkeletonGantt } from '../components/ui/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import { useAppStore, useCurrentState, useIsLoading } from '../stores/appStore';
import { updateBaselineAssignment } from '../stores/actions';
import { getForecastedDays } from '../utils/confidence';
import { calculateCapacity } from '../utils/capacity';
import {
 getCurrentQuarter, getWorkdaysInQuarter, getWorkdaysInDateRangeForQuarter,
} from '../utils/calendar';
import {
 generateSprints, getSprintsForQuarter, formatDateRange, getWorkdaysInSprint,
} from '../utils/sprints';
import type { TeamMember, Sprint, JiraWorkItem, PlannerItem } from '../types';
import { migratePlannerLayout } from '../utils/plannerMigration';
import { globalJiraWorkItems } from '../utils/jiraWorkItemScope';
import { matchesSearch } from '../utils/searchUtils';

type TimelineView = 'gantt' | 'team';
type TimelineGranularity = 'quarter' | 'sprint' | 'dates';

export function Timeline() {
 const state = useCurrentState();
 const setCurrentView = useAppStore(s => s.setCurrentView);
 const isLoading = useIsLoading();
 const { teamMembers, quarters, settings, publicHolidays } = state;
 const jiraWorkItems = globalJiraWorkItems(state.jiraWorkItems ?? [], state.jiraConnections ?? []);

 const [viewMode, setViewMode] = useState<TimelineView>('gantt');
 const [granularity, setGranularity] = useState<TimelineGranularity>('quarter');
 const [labelWidth, setLabelWidth] = useState(256);

 // US-TL-01: AssignPanel for IT-track assignments on Gantt bars
 const [assignPanelJiraItem, setAssignPanelJiraItem] = useState<JiraWorkItem | null>(null);

 const baselineScenario = useMemo(
   () => state.scenarios?.find(s => s.isBaseline) ?? null,
   [state.scenarios],
 );

 const assignPanelPlannerItem = useMemo((): PlannerItem | null => {
   if (!assignPanelJiraItem) return null;
   const existing = (baselineScenario?.plannerLayout ?? []).find(
     p => p.jiraKey === assignPanelJiraItem.jiraKey,
   );
   if (existing) return existing;
   // Build a transient PlannerItem from the JiraWorkItem so AssignPanel can render
   return {
     id: `tl-${assignPanelJiraItem.id}`,
     sourceId: assignPanelJiraItem.id,
     name: assignPanelJiraItem.summary,
     type: assignPanelJiraItem.type as PlannerItem['type'],
     jiraKey: assignPanelJiraItem.jiraKey,
     parentKey: assignPanelJiraItem.parentKey,
     startSprint: 1,
     spanSprints: 1,
     assignees: [],
     isManual: false,
     labels: assignPanelJiraItem.labels ?? [],
     jiraAssignees: assignPanelJiraItem.assigneeName ? [assignPanelJiraItem.assigneeName] : [],
     jiraStartDate: assignPanelJiraItem.startDate,
     jiraEndDate: assignPanelJiraItem.dueDate,
     requiredSkillIds: [],
   };
 }, [assignPanelJiraItem, baselineScenario]);

 const handleBarClick = useCallback((item: JiraWorkItem) => {
   setAssignPanelJiraItem(item);
 }, []);

 // Person / item filters
 const [squadFilter, setSquadFilter] = useState('');
 const [processTeamFilter, setProcessTeamFilter] = useState('');
 const [search, setSearch] = useState('');
 const [bizSearch, setBizSearch] = useState('');
 const [showCompleted, setShowCompleted] = useState(false);
 const [filterLabel, setFilterLabel] = useState('');

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

 const allLabels = useMemo(() => {
   const s = new Set<string>();
   for (const item of jiraWorkItems) {
     item.labels?.forEach(l => s.add(l));
   }
   return [...s].sort();
 }, [jiraWorkItems]);

 // Pre-filter team members for Team view
 const filteredTeamMembers = useMemo(() => {
 let result = teamMembers;
 if (squadFilter) result = result.filter(m => m.squadId === squadFilter);
 if (processTeamFilter) result = result.filter(m => m.processTeamIds?.includes(processTeamFilter));
 if (search) {
 const q = search.toLowerCase();
 result = result.filter(m => m.name.toLowerCase().includes(q));
 }
 return result;
 }, [teamMembers, squadFilter, processTeamFilter, search]);

 // Pre-filter Jira items for Gantt view
 const filteredJiraItems = useMemo(() => {
 const items = jiraWorkItems;

 const bizAssignmentsByKey = new Map<string, string[]>();
 for (const a of state.jiraItemBizAssignments ?? []) {
 const list = bizAssignmentsByKey.get(a.jiraKey) ?? [];
 list.push(a.contactId);
 bizAssignmentsByKey.set(a.jiraKey, list);
 }

 // When filtering by label, resolve all epic/feature/story keys that qualify
 const filteredEpicKeys = filterLabel
   ? new Set(items.filter(i => i.type === 'epic' && i.labels?.includes(filterLabel)).map(i => i.jiraKey))
   : null;
 const filteredFeatureKeys = filteredEpicKeys
   ? new Set(items.filter(i => i.type === 'feature' && filteredEpicKeys!.has(i.parentKey ?? '')).map(i => i.jiraKey))
   : null;

 // First pass: apply structural filters (completion, label, squad, process team, biz)
 const passedItems = items.filter(item => {
   if (!showCompleted && item.statusCategory === 'done') return false;

   if (filteredEpicKeys) {
     const isFilteredEpic = filteredEpicKeys.has(item.jiraKey);
     const isChildOfFilteredEpic = filteredEpicKeys.has(item.parentKey ?? '');
     const isChildOfFilteredFeature = filteredFeatureKeys!.has(item.parentKey ?? '');
     if (!isFilteredEpic && !isChildOfFilteredEpic && !isChildOfFilteredFeature) return false;
   }

   if (squadFilter || processTeamFilter) {
     const member = teamMembers.find(m => m.email && item.assigneeEmail && m.email.toLowerCase() === item.assigneeEmail.toLowerCase());
     if (squadFilter && member?.squadId !== squadFilter) return false;
     if (processTeamFilter && !member?.processTeamIds?.includes(processTeamFilter)) return false;
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

 // Second pass: text search across item summary/key and assignee name, with ancestor inclusion
 if (!search) return passedItems;

 const byKey = new Map(items.map(i => [i.jiraKey, i]));
 const directMatches = new Set<string>();
 for (const item of passedItems) {
   const member = teamMembers.find(m => m.email && item.assigneeEmail && m.email.toLowerCase() === item.assigneeEmail.toLowerCase());
   if (matchesSearch(search, item, [(item.assigneeName ?? ''), (member?.name ?? '')])) {
     directMatches.add(item.jiraKey);
   }
 }

 const includeKeys = new Set(directMatches);
 for (const key of directMatches) {
   let cur: JiraWorkItem | undefined = byKey.get(key);
   while (cur?.parentKey) {
     const parent = byKey.get(cur.parentKey);
     if (parent) { includeKeys.add(parent.jiraKey); cur = parent; } else break;
   }
 }

 return passedItems.filter(item => includeKeys.has(item.jiraKey));
 }, [jiraWorkItems, state.jiraItemBizAssignments, state.businessContacts, teamMembers, showCompleted, squadFilter, processTeamFilter, search, bizSearch, filterLabel]);

 return (
 <div className="space-y-6">
 <PageHeader
 title="Timeline"
 subtitle="Supporting capacity view for baseline Jira timing, team availability, and assignment fit."
 actions={
 <div className="flex items-center gap-3">
 {/* View Toggle */}
 <div className="flex rounded-lg bg-[#F0F2F5] p-1">
 {([
 { id: 'gantt', label: 'Gantt', Icon: BarChart2 },
 { id: 'team', label: 'Team', Icon: User },
 ] as const).map(({ id, label, Icon }) => (
 <button
 key={id}
 onClick={() => setViewMode(id)}
 className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
 viewMode === id
 ? 'bg-white text-[#1E293B] shadow-sm'
 : 'text-[#94A3B8] '
 }`}
 >
 <Icon size={16} />
 {label}
 </button>
 ))}
 </div>

 {/* Granularity toggle — Team only */}
 {viewMode === 'team' && (
 <div className="flex rounded-lg bg-[#F0F2F5] p-1">
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
 ? 'bg-white text-[#1E293B] shadow-sm'
 : 'text-[#94A3B8] '
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
 <span className="text-xs text-[#94A3B8] whitespace-nowrap">From</span>
 <Select
 value={String(fromIdx)}
 onChange={(e) => {
 const next = parseInt(e.target.value);
 setFromIdx(next);
 if (toIdx < next) setToIdx(next);
 }}
 options={fromOptions}
 />
 <span className="text-xs text-[#94A3B8] ">to</span>
 <Select
 value={String(toIdx)}
 onChange={(e) => setToIdx(parseInt(e.target.value))}
 options={toOptions}
 />
 </div>
 )}

         {/* Label filter — Gantt only */}
         {viewMode === 'gantt' && allLabels.length > 0 && (
           <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)} className="w-36 text-sm px-3 py-1.5 rounded-lg border border-[#94A3B8] bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0089DD] cursor-pointer">
             <option value="">All Labels</option>
             {allLabels.map(l => <option key={l} value={l}>{l}</option>)}
           </select>
         )}

         {/* Person filters */}
         {state.squads.length > 0 && (
           <select value={squadFilter} onChange={e => setSquadFilter(e.target.value)} className="w-36 text-sm px-3 py-1.5 rounded-lg border border-[#94A3B8] bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0089DD] cursor-pointer">
 {squadOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 )}
 {state.processTeams.length > 0 && (
 <select value={processTeamFilter} onChange={e => setProcessTeamFilter(e.target.value)} className="w-44 text-sm px-3 py-1.5 rounded-lg border border-[#94A3B8] bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0089DD] cursor-pointer">
 {processTeamOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 )}
 <input
 type="text"
 placeholder="Search..."
 value={search}
 onChange={e => setSearch(e.target.value)}
 className="px-3 py-1.5 rounded-lg border border-[#94A3B8] bg-white text-sm text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0089DD] w-36"
 />
 <input
 type="text"
 placeholder="BIZ contact…"
 value={bizSearch}
 onChange={e => setBizSearch(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#DEDFE3] bg-white text-sm text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0089DD] w-36"
 />
 <label className="flex items-center gap-1.5 text-sm text-[#94A3B8] cursor-pointer select-none whitespace-nowrap">
 <input
 type="checkbox"
 checked={showCompleted}
 onChange={e => setShowCompleted(e.target.checked)}
 className="accent-[#0089DD]"
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
 {jiraWorkItems.length === 0 ? (
 <EmptyState
 icon={BarChart2}
 title="No Jira items yet"
 description="Sync your Jira board to populate the timeline. Go to Settings → Jira to connect and sync."
 />
 ) : (
           <EmptyState
             icon={BarChart2}
             title="No items match your filters"
             description="Try clearing the label, squad, process team, or assignee filters to see all timeline items."
           />
 )}
 </CardContent>
 </Card>
 ) : (
<JiraGantt
  items={filteredJiraItems}
  bizAssignments={state.jiraItemBizAssignments ?? []}
  businessContacts={state.businessContacts ?? []}
  savedSprints={state.sprints ?? []}
  settings={settings}
  quarters={quarters}
  jiraBaseUrl={state.jiraConnections.find(c => c.isActive)?.jiraBaseUrl.replace(/\/+$/, '') ?? ''}
  onBarClick={handleBarClick}
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
 <div className="flex items-center border-b border-[#DEDFE3] bg-[#F0F2F5] /50">
 <div
 className="shrink-0 px-4 py-3 flex items-center justify-between border-r border-[#DEDFE3] relative"
 style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}
 >
 <span className="font-medium text-[#1E293B] ">Team Member</span>
 <div
 onMouseDown={startLabelResize}
 className="absolute right-0 top-0 bottom-0 w-3 flex items-center justify-center cursor-col-resize group select-none"
 title="Drag to resize column"
 >
 <GripVertical size={12} className="text-[#94A3B8] group-hover:text-[#94A3B8] transition-colors" />
 </div>
 </div>

 {granularity === 'dates' ? (
 visibleMonths.map(({ year, month, label }) => {
 const isCurrent = year === new Date().getFullYear() && month === new Date().getMonth();
 return (
 <div
 key={label}
 className={`flex-1 min-w-[100px] px-2 py-3 text-center ${isCurrent ? 'bg-[#E6F2FC] text-blue-700' : 'text-[#94A3B8] '}`}
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
 className={`flex-1 min-w-[150px] px-3 py-3 text-center ${quarter === currentQuarter ? 'bg-[#E6F2FC] text-blue-700' : 'text-[#94A3B8] '}`}
 >
 <div className="font-medium">{quarter}</div>
 <div className="text-xs text-[#94A3B8] mt-0.5">{workDays} working days</div>
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
 className="flex-1 min-w-[120px] px-2 py-2 text-center border-l border-[#DEDFE3] "
 >
 <div className={`font-medium text-xs ${sprint.isByeWeek ? 'text-[#94A3B8]' : 'text-[#94A3B8] '}`}>
 {sprint.isByeWeek ? `${sprint.name} 🏖️` : sprint.name}
 </div>
 <div className="text-xs text-[#94A3B8] mt-0.5">{formatDateRange(sprint.startDate, sprint.endDate)}</div>
 {!sprint.isByeWeek && <div className="text-xs text-[#94A3B8]">{sprintWorkdays}d</div>}
 </div>
 );
 });
 })
 )}
 </div>

 {/* Member rows */}
 <div className="divide-y divide-[#F0F2F5]">
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
            jiraWorkItems={jiraWorkItems}
          />
 ))
 )}
 </div>
 </CardContent>
 </Card>
 )}

 {/* US-TL-01: AssignPanel for IT-track assignments — opens on Gantt bar click */}
 {assignPanelPlannerItem && (
   <AssignPanel
     item={assignPanelPlannerItem}
     plannerItems={migratePlannerLayout(baselineScenario?.plannerLayout ?? [])}
     selectedQuarter={currentQuarter}
     jiraBaseUrl={state.jiraConnections.find(c => c.isActive)?.jiraBaseUrl.replace(/\/+$/, '') ?? ''}
     jiraItems={jiraWorkItems}
     onClose={() => setAssignPanelJiraItem(null)}
     onSave={(itemId, assignees) => {
       updateBaselineAssignment(itemId, assignees, assignPanelPlannerItem);
       setAssignPanelJiraItem(null);
     }}
   />
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
  jiraWorkItems: JiraWorkItem[];
}

function TeamMemberRow({ member, quarters, sprints, granularity, currentQuarter, state, jiraWorkItems }: TeamMemberRowProps) {
 if (granularity === 'quarter') {
 return (
 <div className="flex hover:bg-[#F0F2F5] /30 transition-colors">
 <div className="shrink-0 px-4 py-3 border-r border-[#DEDFE3]" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
 <div className="font-medium text-[#1E293B] truncate" title={member.name}>{member.name}</div>
 <div className="text-xs text-[#94A3B8] mt-0.5">{member.role}</div>
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
 className={`flex-1 min-w-[150px] px-3 py-3 ${quarter === currentQuarter ? 'bg-[#E6F2FC]/50' : ''}`}
 >
 <ProgressBar value={capacity.usedDays} max={capacity.totalWorkdays} status={capacity.status} size="sm" />
 <div className="flex justify-between items-center mt-1">
 <span className="text-xs text-[#94A3B8] ">{capacity.usedDays.toFixed(0)}d / {capacity.totalWorkdays}d</span>
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
 for (const item of jiraWorkItems) {
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
 <div className="flex hover:bg-[#F0F2F5] /30 transition-colors">
 <div className="shrink-0 px-4 py-3 border-r border-[#DEDFE3]" style={{ width: 'var(--lw)', minWidth: 'var(--lw)' }}>
 <div className="font-medium text-[#1E293B] truncate" title={member.name}>{member.name}</div>
 <div className="text-xs text-[#94A3B8] mt-0.5">{member.role}</div>
 </div>
 {sprintCells.map(({ sprint, sprintDays, sprintWorkdays, usedPercent, status }) => (
 <div
 key={sprint.id}
 className={`flex-1 min-w-[120px] px-2 py-3 border-l border-[#DEDFE3] ${sprint.quarter === currentQuarter ? 'bg-[#E6F2FC]/50' : ''}`}
 >
 <ProgressBar value={sprintDays} max={sprintWorkdays} status={status} size="sm" />
 <div className="flex justify-between items-center mt-1">
 <span className="text-xs text-[#94A3B8] ">{sprintDays.toFixed(0)}d</span>
 <span className={`text-xs font-medium ${status === 'overallocated' ? 'text-red-500' : status === 'warning' ? 'text-amber-500' : 'text-green-500'}`}>
 {usedPercent}%
 </span>
 </div>
 </div>
 ))}
 </div>
 );
}
