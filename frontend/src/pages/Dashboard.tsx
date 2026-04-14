import { useMemo, useState, useCallback, Fragment } from 'react';
import {
 Users, FolderKanban, AlertTriangle, TrendingUp, X,
 ChevronRight, CheckCircle2, Circle, Link2, Zap, Globe,
  Clock,
} from 'lucide-react';
import { useAppStore, useCurrentState, useIsLoading, useIsInitializing } from '../stores/appStore';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { ScenarioWizard } from '../components/ScenarioWizard';
import type { DashboardPeopleFilter } from '../stores/appStore';
import { Card, CardContent } from '../components/ui/Card';
import { SkeletonCard, SkeletonList } from '../components/ui/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';
import {
 calculateCapacity, getWarnings,
 calculateBusinessCapacityForQuarter,
} from '../utils/capacity';
import { getCurrentQuarter, getWorkdaysInQuarter } from '../utils/calendar';
import type { CapacityResult, CapacityBreakdownItem } from '../types';
import { globalJiraWorkItems } from '../utils/jiraWorkItemScope';
import { useProcessTeamCapacitySummaries } from '../hooks/useProcessTeamCapacitySummaries';

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

// ── Heatmap color scale (8-tier: green → amber → orange → red) ───────────────
function getCellClass(pct: number): string {
 if (pct <= 10) return 'cell-empty';
 if (pct <= 30) return 'cell-tier1';
 if (pct <= 50) return 'cell-tier2';
 if (pct <= 70) return 'cell-tier3';
 if (pct <= 80) return 'cell-tier4';
 if (pct <= 90) return 'cell-tier5';
 if (pct < 100) return 'cell-tier6';
 return 'cell-overloaded';
}

/** Text colour matching each heatmap tier — mirrors the .cell-* CSS classes in index.css */
const CELL_EMPTY_TEXT = '#94a3b8';
const CELL_NORMAL_TEXT = '#1E293B';
const CELL_OVERLOAD_TEXT = '#8B0000';

function getCellColor(pct: number): string {
 if (pct <= 10) return CELL_EMPTY_TEXT;
 if (pct < 100) return CELL_NORMAL_TEXT;
 return CELL_OVERLOAD_TEXT;
}

/** Inline-style overload accent — matches .cell-overloaded text colour */
const OVERLOAD_COLOR = '#B02030';


// ─── Main component ───────────────────────────────────────────────────────────

export function Dashboard() {
 const state = useCurrentState();
 const setCurrentView = useAppStore(s => s.setCurrentView);
 const peopleFilter = useAppStore(s => s.ui.dashboardPeopleFilter);
 const setPeopleFilter = useAppStore(s => s.setDashboardPeopleFilter);
 const isLoading = useIsLoading();

 const currentQuarter = getCurrentQuarter();
 const yearQuarters = useMemo(() => getCurrentYearQuarters(), []);

  const [selectedCell, setSelectedCell] = useState<{ memberId: string; quarter: string } | null>(null);
  const [selectedBizCell, setSelectedBizCell] = useState<{ contactId: string; quarter: string } | null>(null);
  const [timelineView, setTimelineView] = useState<'heatmap' | 'bars'>('heatmap');
  const [showWizard, setShowWizard] = useState(false);
  const [capacityBankQuarter, setCapacityBankQuarter] = useState(getCurrentQuarter);
 const isInitializing = useIsInitializing();
 const { can } = useCurrentUser();
 const jiraWorkItems = globalJiraWorkItems(state.jiraWorkItems ?? [], state.jiraConnections ?? []);

 const warnings = useMemo(() => getWarnings(state), [state]);

 // Nudge banner logic (D5 + D13) — localStorage dismiss with 7-day TTL
 const NUDGE_KEY = 'nudge_high_util_dismissed';
 const [nudgeDismissed, setNudgeDismissed] = useState(false);
 const highUtilMemberIds = useMemo(() => {
   const ids = new Set<string>();
   warnings.overallocated.forEach(w => ids.add(w.member.id));
   warnings.highUtilization.forEach(w => ids.add(w.member.id));
   return ids;
 }, [warnings]);
 const showNudge = useMemo(() => {
   if (nudgeDismissed || isInitializing || highUtilMemberIds.size < 2) return false;
   try {
     const raw = localStorage.getItem(NUDGE_KEY);
     if (raw) {
       const { dismissedAt, memberIds } = JSON.parse(raw) as { dismissedAt: number; memberIds: string[] };
       const sevenDays = 7 * 24 * 60 * 60 * 1000;
       if (Date.now() - dismissedAt < sevenDays) {
         const storedSet = new Set(memberIds);
         // Re-show if a new member not in the stored set has tipped over
         const hasNewMember = [...highUtilMemberIds].some(id => !storedSet.has(id));
         if (!hasNewMember) return false;
       }
     }
   } catch { /* ignore corrupt localStorage */ }
   return true;
 }, [nudgeDismissed, isInitializing, highUtilMemberIds]);
 const dismissNudge = useCallback(() => {
   try {
     localStorage.setItem(NUDGE_KEY, JSON.stringify({
       dismissedAt: Date.now(),
       memberIds: [...highUtilMemberIds],
     }));
   } catch { /* ignore */ }
   setNudgeDismissed(true);
 }, [highUtilMemberIds]);

 const activeMembers = useMemo(
 () => state.teamMembers.filter(m => !m.needsEnrichment),
 [state.teamMembers]
 );

// Capacity Bank: process team breakdown for selected quarter
 const processTeamSummaries = useProcessTeamCapacitySummaries(capacityBankQuarter);

 // Timeline preview data — excluded members are hidden from the heatmap entirely
 const timelineData = useMemo(() =>
 activeMembers.filter(m => !m.excludedFromCapacity).map(member => ({
 member,
 cells: yearQuarters.map(q => {
 const cap = calculateCapacity(member.id, q, state);
 const bauDays = cap.breakdown.find(b => b.type === 'bau')?.days ?? 0;
 const timeOffDays = cap.breakdown.find(b => b.type === 'timeoff')?.days ?? 0;
  const projectDays = cap.breakdown
    .filter(b => b.type === 'jira')
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
 return state.businessContacts.filter(c => !c.archived && !c.excludedFromCapacity).map(contact => ({
 contact,
 cells: yearQuarters.map(q => {
     const cell = calculateBusinessCapacityForQuarter(
     contact, q,
     state.jiraItemBizAssignments, state.businessTimeOff,
     state.publicHolidays, jiraWorkItems
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

 const isEmpty = state.teamMembers.length === 0 && jiraWorkItems.length === 0;

 if (isLoading && isEmpty) {
 return (
 <div className="space-y-6">
 <div className="h-10 flex items-center justify-between">
 <div className="space-y-1.5">
 <div className="h-6 w-48 rounded-md bg-mw-grey-light animate-shimmer bg-[length:200%_100%]" />
 <div className="h-4 w-64 rounded-md bg-mw-grey-light animate-shimmer bg-[length:200%_100%]" />
 </div>
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <SkeletonCard lines={4} />
 <SkeletonCard lines={4} />
 </div>
 <SkeletonList rows={6} />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 <PageHeader
 title="Capacity Overview"
 subtitle={`VS Finance · ${currentQuarter} · Mileway BV`}
 />


 {/* Onboarding */}
 {isEmpty && <OnboardingChecklist state={state} navigate={setCurrentView} />}

 {/* Utilisation nudge banner (D5 + D13) */}
 {showNudge && (
   <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
     <div className="flex items-center gap-2.5">
       <AlertTriangle size={16} className="text-amber-600 shrink-0" />
       <p className="text-sm text-amber-800">
         <strong>{highUtilMemberIds.size} team members</strong> are at high utilisation this quarter. Plan ahead safely before committing.
       </p>
     </div>
     <div className="flex items-center gap-2 shrink-0">
       {can('edit_assignments') ? (
         <button
           onClick={() => setShowWizard(true)}
           className="text-xs font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
         >
           Plan it safely →
         </button>
       ) : (
         <span className="text-xs text-amber-600">Contact your IT manager</span>
       )}
       <button
         onClick={dismissNudge}
         className="p-1 rounded text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
         aria-label="Dismiss"
       >
         <X size={14} />
       </button>
     </div>
   </div>
 )}


 {/* ── Section 1: Capacity Bank ──────────────────────────────────────────── */}
 {!isEmpty && (
 <section>
  <div className="flex items-center justify-end mb-4">
    <div className="flex items-center gap-1">
       {yearQuarters.map(q => (
         <button
           key={q}
           onClick={() => setCapacityBankQuarter(q)}
           className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
             capacityBankQuarter === q
               ? 'bg-[#0089DD] text-white'
               : 'bg-white border border-[#DEDFE3] text-[#94A3B8] hover:border-[#0089DD] hover:text-[#0089DD]'
           }`}
         >
           {q.split(' ')[0]}
         </button>
       ))}
     </div>
   </div>
   <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
     {processTeamSummaries.map(pt => {
       const { totalDays, usedDays, availableDays, utilization } = pt.data;
       const isNA = totalDays === 0;
       const pct = Math.round(utilization * 100);
       const barWidth = `${Math.min(utilization * 100, 100)}%`;

       const textCls = isNA || pct === 0
         ? 'text-slate-300'
         : pct <= 50
         ? 'text-green-600'
         : pct <= 80
         ? 'text-yellow-600'
         : pct <= 100
         ? 'text-orange-600'
         : 'text-red-600';

       const barFill = isNA || pct === 0
         ? 'bg-slate-200'
         : pct <= 50
         ? 'bg-green-500'
         : pct <= 80
         ? 'bg-yellow-500'
         : pct <= 100
         ? 'bg-orange-500'
         : 'bg-red-500';

       return (
         <div key={pt.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
           <p className="text-[13px] font-semibold text-slate-800 leading-tight">{pt.name}</p>
           <div>
             <p className={`text-[28px] font-bold leading-none ${textCls}`}>
               {isNA ? 'N/A' : `${pct}%`}
             </p>
             <p className="text-[11px] text-slate-400 mt-0.5">utilisation</p>
           </div>
           <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
             <div className={`h-full rounded-full ${barFill}`} style={{ width: barWidth }} />
           </div>
           <div className="grid grid-cols-2">
             <div>
               <p className="text-[13px] font-semibold text-slate-700">{isNA ? '—' : `${Math.round(availableDays)}d`}</p>
               <p className="text-xs text-slate-400">available</p>
             </div>
             <div>
               <p className="text-[13px] font-semibold text-slate-700">{isNA ? '—' : `${Math.round(usedDays)}d`}</p>
               <p className="text-xs text-slate-400">allocated</p>
             </div>
           </div>
         </div>
       );
     })}
   </div>
 </section>
 )}

 {/* ── Section 2: Alerts ────────────────────────────────────────────────── */}
 {!isEmpty && <AlertsGrid warnings={warnings} />}

 {/* ── Section 3: Timeline Preview ──────────────────────────────────────── */}
 {!isEmpty && activeMembers.length > 0 && (
 <section>
 <div className="flex items-end justify-end mb-6">
 <div className="flex items-center gap-2">
 {/* Heatmap / Bars toggle */}
 <div className="flex items-center rounded-lg border border-[#DEDFE3] overflow-hidden text-xs font-medium">
 <button
 onClick={() => setTimelineView('heatmap')}
        className={`px-2.5 py-1.5 transition-colors ${timelineView === 'heatmap' ? 'bg-[#0089DD] text-white' : 'bg-white text-[#94A3B8] hover:text-[#1E293B]'}`}
 >
 Heatmap
 </button>
 <button
 onClick={() => setTimelineView('bars')}
        className={`px-2.5 py-1.5 border-l border-[#DEDFE3] transition-colors ${timelineView === 'bars' ? 'bg-[#0089DD] text-white' : 'bg-white text-[#94A3B8] hover:text-[#1E293B]'}`}
 >
 Bars
 </button>
 </div>
 <select
 value={peopleFilter}
 onChange={e => setPeopleFilter(e.target.value as DashboardPeopleFilter)}
 className="text-xs rounded-lg border border-[#DEDFE3] bg-white text-[#94A3B8] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0089DD]"
 >
 <option value="it_only">IT team only</option>
 <option value="business_only">Business only</option>
 <option value="both">Both</option>
 </select>
 <button
 onClick={() => setCurrentView('timeline')}
 className="inline-flex items-center gap-1 text-xs font-medium text-[#0089DD] hover:underline"
 >
 Full view <ChevronRight size={13} />
 </button>
 </div>
 </div>

 <Card>
 <CardContent className="p-0 overflow-x-auto">
 {/* Header */}
        <div className="grid border-b border-[#DEDFE3] bg-[#F5F8FC]"
        style={{ gridTemplateColumns: '200px repeat(4, 1fr)' }}>
        <div className="px-4 py-3 text-[11px] font-semibold tracking-wide uppercase text-[#94A3B8]">
        {peopleFilter === 'business_only' ? 'Business contact' : 'Member'}
        </div>
        {yearQuarters.map(q => {
        const workdays = getWorkdaysInQuarter(q);
        const isCurrent = q === currentQuarter;
        return (
        <div key={q} className={`px-4 py-3 border-l border-[#DEDFE3] ${isCurrent ? 'bg-[#E6F2FC]' : ''}`}>
        <div className={`text-[11px] font-semibold tracking-wide uppercase ${isCurrent ? 'text-[#0089DD]' : 'text-[#94A3B8]'}`}>{q}</div>
        <div className="text-[10px] text-[#94A3B8] mt-0.5">{workdays} working days</div>
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
 className={`grid border-b border-[#F0F2F5] transition-colors hover:bg-[#E6F2FC]/40 ${isMemberSelected ? 'bg-[#E6F2FC]/60' : ''}`}
 style={{ gridTemplateColumns: '200px repeat(4, 1fr)' }}
 >
 {/* Identity */}
 <div className="px-4 py-3 flex items-center gap-2.5 border-r border-[#DEDFE3]">
 <div className="w-8 h-8 rounded-full bg-[#F0F2F5] border border-[#DEDFE3] flex items-center justify-center text-[10px] font-bold text-[#94A3B8] shrink-0">
 {getInitials(member.name)}
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="text-sm font-semibold text-[#1E293B] truncate">{member.name}</span>
 </div>
 <div className="text-xs text-[#94A3B8] truncate">
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
 const effectiveCellClass = getCellClass(cap.usedPercent);

 if (timelineView === 'heatmap') {
 return (
 <button
 key={quarter}
 onClick={() => handleCellClick(member.id, quarter)}
 className={`heatmap-cell px-3 py-3 border-l border-[#DEDFE3]/80 text-center ${effectiveCellClass} ${isCellSelected ? 'ring-2 ring-inset ring-blue-500' : ''}`}
 title={`${quarter} · ${cap.usedPercent}% allocated · ${isOver ? '−' : ''}${Math.abs(Math.round(remainingDays))}d ${isOver ? 'over' : 'free'}`}
 >
 <div className="text-sm font-bold tabular-nums leading-tight">
 {cap.usedPercent === 0 ? '—' : `${cap.usedPercent}%`}
 </div>
 <div className="text-[10px] mt-0.5" style={{ color: isOver ? OVERLOAD_COLOR : 'inherit' }}>
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
 className={`px-3 py-3 border-l border-[#DEDFE3] text-left transition-colors
 ${isCellSelected ? 'ring-2 ring-inset ring-blue-500' : ''}
 ${quarter === currentQuarter ? 'bg-[#E6F2FC]/40' : ''}
 `}
 >
 {/* Stacked bar */}
 <div className="h-2 rounded-full bg-[#F0F2F5] overflow-hidden flex mb-1.5">
 <div className="h-full bg-[#DEDFE3]" style={{ width: `${bauPct}%` }} />
 <div className="h-full bg-amber-300" style={{ width: `${timeOffPct}%` }} />
 <div
 className={`h-full ${isOver ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-[#0089DD]'}`}
 style={{ width: `${projectPct}%` }}
 />
 </div>
 {/* Label */}
 <div className="flex items-center justify-between">
 <span className={`text-xs font-semibold ${
 isOver ? 'text-red-600'
 : remainingDays < 10 ? 'text-amber-600'
 : remainingDays > 30 ? 'text-[#16A34A]'
 : 'text-[#1E293B] '
 }`}>
 {isOver ? `−${Math.abs(Math.round(remainingDays))}d` : `${Math.round(remainingDays)}d free`}
 </span>
 <span className={`text-[10px] ${isOver ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-[#94A3B8]'}`}>
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
    (b: CapacityBreakdownItem) => b.type === 'jira'
  );
 const overhead = cap.breakdown.filter(
 (b: CapacityBreakdownItem) => b.type === 'bau' || b.type === 'timeoff'
 );

 // Build Epic › Feature breadcrumb for Jira items
 const jiraMap = new Map(jiraWorkItems.map(i => [i.jiraKey, i]));
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
 case 'story': return 'bg-[#E6F2FC] text-[#0077C2] border-[#CCE4F9]';
 case 'uat': return 'bg-amber-50 text-amber-600 border-amber-100';
 case 'hypercare': return 'bg-[#E6F2FC] text-[#0089DD] border-[#CCE4F9]';
 default: return 'bg-[#F0F2F5] text-[#94A3B8] border-[#DEDFE3] ';
 }
 };

 const remainingRaw = cap.totalWorkdays - cap.usedDays;

 return (
 <div className="border-b border-[#DEDFE3] bg-white ">
 {/* Panel header */}
 <div className="flex items-center justify-between px-5 py-3 border-b border-[#DEDFE3]">
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold text-[#1E293B] ">
 {drillDown.quarter} — {drillDown.member.name}
 </span>
 {drillDown.member.role && (
 <span className="text-xs text-[#94A3B8]">{drillDown.member.role}</span>
 )}
 </div>
 <button
 onClick={() => setSelectedCell(null)}
 className="p-1 rounded hover:bg-[#F0F2F5] text-[#94A3B8] transition-colors"
 >
 <X size={15} />
 </button>
 </div>

 {/* Two-column body */}
 <div className="grid grid-cols-[1fr_180px] gap-0 px-5 py-4 max-w-4xl">
 {/* Left — assigned work */}
 <div className="pr-6 min-w-0">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">Assigned Work</p>
 {workItems.length === 0 && overhead.length === 0 ? (
 <p className="text-sm italic text-[#94A3B8]">No work assigned this quarter.</p>
 ) : (
 <div className="space-y-1.5">
 {workItems.map((item: CapacityBreakdownItem, i: number) => {
              const breadcrumb = item.jiraKey ? getBreadcrumb(item.jiraKey) : '';
              const label = item.jiraSummary ?? item.reason ?? '—';
              const typeLabel = 'Story';
 return (
 <div key={i} className="dd-item flex items-start gap-2 pl-2 border-l-2 border-blue-200">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5 flex-wrap">
 {item.jiraKey && (
 <span className="text-[9px] font-mono text-[#94A3B8] shrink-0">{item.jiraKey}</span>
 )}
 <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${typePillClass(typeLabel)}`}>{typeLabel.toUpperCase()}</span>
 </div>
 <p className="dd-item-label text-xs font-medium text-[#1E293B] truncate mt-0.5">{label}</p>
 {breadcrumb && (
 <p className="text-[10px] text-[#94A3B8] truncate">{breadcrumb}</p>
 )}
 </div>
 <span className="text-xs text-[#94A3B8] shrink-0 pt-3 tabular-nums">{item.days.toFixed(1)}d</span>
 </div>
 );
 })}
 {overhead.map((item: CapacityBreakdownItem, i: number) => (
 <div key={`oh-${i}`} className="dd-item flex items-center gap-2 pl-2 border-l-2 border-[#DEDFE3] ">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${typePillClass(item.type)}`}>
 {item.type === 'bau' ? 'BAU' : 'TIME OFF'}
 </span>
 </div>
 <p className="dd-item-label text-xs font-medium text-[#94A3B8] truncate mt-0.5">
 {item.type === 'bau' ? 'BAU Reserve' : 'Time Off'}
 </p>
 </div>
 <span className="text-xs text-[#94A3B8] shrink-0 tabular-nums">{item.days.toFixed(1)}d</span>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Right — quarter summary */}
 <div className="border-l border-[#DEDFE3] pl-5">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-3">Quarter Summary</p>
 <div className="space-y-2.5">
 {[
 { label: 'Available', value: `${cap.totalWorkdays}d`, color: 'text-[#94A3B8] ' },
 { label: 'Allocated', value: `${cap.usedDays.toFixed(1)}d`, color: summaryCellColor },
 {
 label: 'Remaining',
 value: isOver ? `−${Math.abs(Math.round(remainingRaw))}d` : `${Math.round(remainingRaw)}d`,
 color: isOver ? OVERLOAD_COLOR : 'inherit',
 },
 { label: 'Utilization', value: `${pct}%`, color: summaryCellColor },
 ].map(row => (
 <div key={row.label} className="flex items-center justify-between">
 <span className="text-xs text-[#94A3B8] ">{row.label}</span>
 <span className="text-xs font-semibold tabular-nums" style={{ color: row.color }}>{row.value}</span>
 </div>
 ))}
 </div>
 {/* Mini utilization bar */}
 <div className="mt-4 h-1.5 rounded-full bg-[#F0F2F5] overflow-hidden">
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
 <div className="px-4 py-1.5 bg-[#F0F2F5] /50 border-t-2 border-[#DEDFE3] ">
 <span className="text-[10px] font-bold tracking-wider uppercase text-[#94A3B8]">Business</span>
 <span className="ml-2 text-[10px] text-[#94A3B8] italic">(informational only)</span>
 </div>
 )}

 {/* Business rows */}
 {peopleFilter !== 'it_only' && bizTimelineData.map(({ contact, cells }) => {
 const isBizSelected = selectedBizCell?.contactId === contact.id;
 return (
 <Fragment key={contact.id}>
 <div
 className={`grid border-b border-[#DEDFE3] transition-colors hover:bg-[#F0F2F5]/20 ${isBizSelected ? 'bg-[#F0F2F5]/30' : ''}`}
                style={{ gridTemplateColumns: '200px repeat(4, 1fr)' }}
              >
                <div className="px-4 py-3 flex items-center gap-2.5 border-r border-[#DEDFE3]">
                <div className="w-7 h-7 rounded-full bg-[#F0F2F5] border border-[#DEDFE3] flex items-center justify-center text-[10px] font-bold text-[#94A3B8] shrink-0">
                {getInitials(contact.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-normal text-[#94A3B8] truncate">{contact.name}</span>
                    <span className="text-[9px] font-bold tracking-wide uppercase text-[#94A3B8] shrink-0">BIZ</span>
                  </div>
 <div className="text-xs text-[#94A3B8] truncate">{contact.title ?? contact.department ?? ''}</div>
 </div>
 </div>
 {cells.map(({ quarter, cell }) => {
 const pct = cell.usedPercent;
 const isOver = pct > 100;
 const isWarn = pct >= 90 && !isOver;
 const remainingDays = cell.availableDays - cell.allocatedDays;
 const effectiveBizCellClass = getCellClass(pct);
 const isCellSelected = isBizSelected && selectedBizCell?.quarter === quarter;

 if (timelineView === 'heatmap') {
 return (
 <button
 key={quarter}
 onClick={() => setSelectedBizCell(isCellSelected ? null : { contactId: contact.id, quarter })}
                className={`heatmap-cell px-3 py-3 border-l border-[#DEDFE3] text-center ${effectiveBizCellClass} ${isCellSelected ? 'ring-2 ring-inset ring-[#94A3B8]' : ''}`}
 title={`${quarter} · ${pct}% allocated · ${isOver ? '−' : ''}${Math.abs(Math.round(remainingDays))}d ${isOver ? 'over' : 'free'}`}
 >
 <div className="text-sm font-bold tabular-nums leading-tight">
 {pct === 0 ? '—' : `${pct}%`}
 </div>
 <div className="text-[10px] mt-0.5" style={{ color: isOver ? OVERLOAD_COLOR : 'inherit' }}>
 {pct === 0 ? '' : isOver
 ? `−${Math.abs(Math.round(remainingDays))}d`
 : `${Math.round(remainingDays)}d free`}
 </div>
 </button>
 );
 }

 return (
 <div
 key={quarter}
 title={cell.breakdownByProject.map(b => `${b.projectName}${b.phaseName ? ` / ${b.phaseName}` : ''}: ${b.days.toFixed(1)}d`).join('\n')}
 className={`px-3 py-3 border-l border-[#DEDFE3] ${quarter === currentQuarter ? 'bg-[#E6F2FC]/30' : ''}`}
 >
 <div className="h-2 rounded-full bg-[#F0F2F5] overflow-hidden mb-1.5">
 <div
                className={`h-full ${isOver ? 'bg-red-400' : isWarn ? 'bg-amber-400' : 'bg-[#94A3B8]'}`}
 style={{ width: `${Math.min(100, pct)}%` }}
 />
 </div>
 <div className="flex items-center justify-between">
 <span className="text-xs text-[#94A3B8] ">
 {pct > 0 ? `${cell.allocatedDays.toFixed(1)}d` : '—'}
 </span>
 <span className={`text-[10px] ${isOver ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-[#94A3B8]'}`}>
 {pct > 0 ? `${pct}%` : ''}
 </span>
 </div>
 </div>
 );
 })}
 </div>

 {/* BIZ inline drill-down panel */}
 {isBizSelected && (() => {
 const selCellData = cells.find(c => c.quarter === selectedBizCell?.quarter);
 if (!selCellData) return null;
 const cap = selCellData.cell;
 const pct = cap.usedPercent;
 const isOver = pct > 100;
 const remainingRaw = cap.availableDays - cap.allocatedDays;
 const summaryCellColor = getCellColor(pct);

 const workItems = cap.breakdownByProject.filter(b => b.projectId !== '__bau__');
 const bauEntry = cap.breakdownByProject.find(b => b.projectId === '__bau__');

 return (
 <div className="border-b border-[#DEDFE3] bg-white ">
 {/* Panel header */}
 <div className="flex items-center justify-between px-5 py-3 border-b border-[#DEDFE3]">
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold text-[#1E293B] ">
 {selectedBizCell?.quarter} — {contact.name}
 </span>
 {(contact.title || contact.department) && (
 <span className="text-xs text-[#94A3B8]">{contact.title ?? contact.department}</span>
 )}
                 <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#F0F2F5] text-[#94A3B8] border border-[#DEDFE3]">BIZ</span>
 </div>
 <button
 onClick={() => setSelectedBizCell(null)}
 className="p-1 rounded hover:bg-[#F0F2F5] text-[#94A3B8] transition-colors"
 >
 <X size={15} />
 </button>
 </div>

 {/* Two-column body */}
 <div className="grid grid-cols-[1fr_180px] gap-0 px-5 py-4 max-w-4xl">
 {/* Left — assigned work */}
 <div className="pr-6 min-w-0">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">Assigned Work</p>
 {workItems.length === 0 && !bauEntry ? (
 <p className="text-sm italic text-[#94A3B8]">No work assigned this quarter.</p>
 ) : (
 <div className="space-y-1.5">
 {workItems.map((item, i) => (
                 <div key={i} className="dd-item flex items-start gap-2 pl-2 border-l-2 border-[#DEDFE3]">
 <div className="flex-1 min-w-0">
 {item.phaseName && (
 <p className="text-[10px] text-[#94A3B8] truncate">{item.projectName}</p>
 )}
 <p className="dd-item-label text-xs font-medium text-[#1E293B] truncate mt-0.5">
 {item.phaseName ?? item.projectName}
 </p>
 </div>
 <span className="text-xs text-[#94A3B8] shrink-0 pt-0.5 tabular-nums">{item.days.toFixed(1)}d</span>
 </div>
 ))}
 {bauEntry && (
 <div className="dd-item flex items-center gap-2 pl-2 border-l-2 border-[#DEDFE3] ">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-[#F0F2F5] text-[#94A3B8] border-[#DEDFE3] ">BAU</span>
 </div>
 <p className="dd-item-label text-xs font-medium text-[#94A3B8] truncate mt-0.5">BAU Reserve</p>
 </div>
 <span className="text-xs text-[#94A3B8] shrink-0 tabular-nums">{bauEntry.days.toFixed(1)}d</span>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Right — quarter summary */}
 <div className="border-l border-[#DEDFE3] pl-5">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-3">Quarter Summary</p>
 <div className="space-y-2.5">
 {[
 { label: 'Available', value: `${cap.availableDays.toFixed(1)}d`, color: 'text-[#94A3B8] ' },
 { label: 'Allocated', value: `${cap.allocatedDays.toFixed(1)}d`, color: summaryCellColor },
 {
 label: 'Remaining',
 value: isOver ? `−${Math.abs(Math.round(remainingRaw))}d` : `${Math.round(remainingRaw)}d`,
 color: isOver ? OVERLOAD_COLOR : 'inherit',
 },
 { label: 'Utilization', value: `${pct}%`, color: summaryCellColor },
 ].map(row => (
 <div key={row.label} className="flex items-center justify-between">
 <span className="text-xs text-[#94A3B8] ">{row.label}</span>
 <span className="text-xs font-semibold tabular-nums" style={{ color: row.color }}>{row.value}</span>
 </div>
 ))}
 </div>
 {/* Mini utilization bar */}
 <div className="mt-4 h-1.5 rounded-full bg-[#F0F2F5] overflow-hidden">
 <div
 className="h-full rounded-full transition-all"
 style={{ width: `${Math.min(100, pct)}%`, background: summaryCellColor }}
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


 {/* Legend */}
 {timelineView === 'heatmap' ? (
 <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[#DEDFE3] bg-[#F0F2F5]/50 /30 flex-wrap">
 <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-tier1" /><span className="text-[10px] text-[#94A3B8]">11–30%</span></div>
 <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-tier2" /><span className="text-[10px] text-[#94A3B8]">31–50%</span></div>
 <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-tier3" /><span className="text-[10px] text-[#94A3B8]">51–70%</span></div>
 <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-tier4" /><span className="text-[10px] text-[#94A3B8]">71–80%</span></div>
 <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-tier5" /><span className="text-[10px] text-[#94A3B8]">81–90%</span></div>
 <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-tier6" /><span className="text-[10px] text-[#94A3B8]">91–99%</span></div>
 <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm cell-overloaded" /><span className="text-[10px] text-[#94A3B8]">≥100%</span></div>
 <div className="flex-1" />
 <span className="text-[10px] text-[#94A3B8]">Click any IT cell to drill down</span>
 </div>
 ) : (
 <div className="flex items-center gap-5 px-4 py-2.5 border-t border-[#DEDFE3] bg-[#F0F2F5]/50 /30">
 <LegendDot color="bg-[#DEDFE3]" label="BAU" />
 <LegendDot color="bg-amber-300" label="Time off" />
 <LegendDot color="bg-[#0089DD]" label="Planned work" />
 <LegendDot color="bg-red-500" label="Over-allocated" />
 <div className="flex-1" />
 <span className="text-[10px] text-[#94A3B8]">Click any cell to drill down</span>
 </div>
 )}
 </CardContent>
 </Card>
 </section>
 )}


 {/* Scenario Wizard triggered by nudge banner CTA */}
 {showWizard && <ScenarioWizard onClose={() => setShowWizard(false)} />}

 </div>
 );
}

/* ─── Section 2: Alerts grid ──────────────────────────────────────────────── */

function AlertsGrid({ warnings }: {
 warnings: ReturnType<typeof getWarnings>;
}) {
 const alerts: { id: string; icon: React.ReactNode; iconBg: string; title: string; detail: string; badgeCls: string; badgeLabel: string }[] = [];

 for (const w of warnings.overallocated.slice(0, 2)) {
 alerts.push({
 id: `over-${w.member.id}-${w.quarter}`,
 icon: <AlertTriangle size={15} className="text-red-500" />,
 iconBg: 'bg-red-50',
 title: `${w.member.name} over-allocated`,
 detail: `${w.usedDays}d used / ${w.totalDays}d available in ${w.quarter}`,
 badgeCls: 'bg-red-100 text-red-700',
 badgeLabel: 'Fix',
 });
 }

 for (const w of warnings.highUtilization.slice(0, 2)) {
 if (alerts.length >= 4) break;
 alerts.push({
 id: `warn-${w.member.id}-${w.quarter}`,
 icon: <Clock size={15} className="text-amber-500" />,
 iconBg: 'bg-amber-50',
 title: `${w.member.name} at ${w.usedPercent}%`,
 detail: `High utilization in ${w.quarter} — ${w.usedDays}d / ${w.totalDays}d`,
 badgeCls: 'bg-amber-100 text-amber-700',
 badgeLabel: 'Review',
 });
 }

 for (const w of warnings.tooManyProjects.slice(0, 2)) {
 if (alerts.length >= 4) break;
 alerts.push({
 id: `projects-${w.member.id}`,
 icon: <FolderKanban size={15} className="text-amber-500" />,
 iconBg: 'bg-amber-50',
 title: `${w.member.name}: too many projects`,
 detail: `${w.count} active projects (max ${w.max})`,
 badgeCls: 'bg-amber-100 text-amber-700',
 badgeLabel: 'Review',
 });
 }

 if (alerts.length === 0) {
 return (
 <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-100">
 <CheckCircle2 size={16} className="text-green-500 shrink-0" />
 <span className="text-sm text-[#16A34A] font-medium">All clear — no capacity alerts</span>
 </div>
 );
 }

 return (
 <section>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {alerts.map(a => (
 <div key={a.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[#DEDFE3] shadow-sm">
 <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.iconBg}`}>
 {a.icon}
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-sm font-semibold text-[#1E293B] truncate">{a.title}</div>
 <div className="text-xs text-[#94A3B8] mt-0.5 truncate">{a.detail}</div>
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

function LegendDot({ color, label }: { color: string; label: string }) {
 return (
 <span className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
 <span className={`w-2 h-2 rounded-sm inline-block shrink-0 ${color}`} />
 {label}
 </span>
 );
}


// ─── Onboarding Checklist ────────────────────────────────────────────────────

function OnboardingChecklist({ state, navigate }: {
  state: ReturnType<typeof useCurrentState>;
  navigate: (view: 'team' | 'projects' | 'portfolio-planning' | 'settings') => void;
}) {
  const jiraWorkItems = globalJiraWorkItems(state.jiraWorkItems ?? [], state.jiraConnections ?? []);
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
     done: jiraWorkItems.some(w => w.type === 'epic'),
     label: 'Open Portfolio Planning',
     detail: jiraWorkItems.some(w => w.type === 'epic')
     ? `${jiraWorkItems.filter(w => w.type === 'epic').length} epic${jiraWorkItems.filter(w => w.type === 'epic').length !== 1 ? 's' : ''} ready for planning`
     : 'Import delivery work, then move into Portfolio Planning',
 icon: FolderKanban,
 onClick: () => navigate('portfolio-planning'),
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
 <div className="w-14 h-14 rounded-2xl bg-[#E6F2FC] flex items-center justify-center mx-auto mb-4">
 <TrendingUp className="w-7 h-7 text-blue-500" />
 </div>
 <h2 className="text-xl font-bold text-[#1E293B] ">
 Welcome to the planning journey
 </h2>
 <p className="text-sm text-[#94A3B8] mt-1">
 Complete these steps to start your planning journey in Portfolio Planning.
 </p>
 <p className="text-xs text-[#94A3B8] mt-2">
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
 className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors hover:bg-[#F0F2F5] /50 group"
 >
 {step.done
 ? <CheckCircle2 size={20} className="text-green-500 shrink-0" />
 : <Circle size={20} className="text-[#94A3B8] shrink-0" />
 }
 <StepIcon size={16} className="text-[#94A3B8] shrink-0" />
 <div className="flex-1 min-w-0">
 <p className={`text-sm font-medium ${step.done ? 'text-[#94A3B8] line-through' : 'text-[#1E293B] '}`}>
 {step.label}
 </p>
 <p className="text-xs text-[#94A3B8] truncate">{step.detail}</p>
 </div>
 <ChevronRight size={14} className="text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
 </button>
 );
 })}
 </div>
 </div>
 </CardContent>
 </Card>
 );
}
