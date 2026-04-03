import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, ChevronDown, ChevronRight, ExternalLink,
  RefreshCw, Loader2, X, Filter, Users,
  AlertCircle, UserCircle2, Building2,
} from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/layout/PageHeader';
import { StageProgressBar } from '../components/layout/StageProgressBar';
import { useAppStore, useCurrentState } from '../stores/appStore';
import { WorkItemSkillsCell } from '../components/WorkItemSkillsCell';
import { fetchSyncPreview, applySync } from '../application/jiraSync';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useToast } from '../components/ui/Toast';
import { computeRollup, getConfidenceLabel, getForecastedDays } from '../utils/confidence';
import { globalJiraWorkItems } from '../utils/jiraWorkItemScope';
import { matchesSearch } from '../utils/searchUtils';
import type {
  JiraWorkItem,
  JiraItemBizAssignment,
  BusinessContact,
  JiraSyncDiff,
} from '../types';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  done: 'bg-green-100 text-[#16A34A]',
  in_progress: 'bg-blue-100 text-blue-700',
  todo: 'bg-[#F0F2F5] text-[#94A3B8]',
};

const PRIORITY_COLORS: Record<string, string> = {
  Highest: 'bg-red-100 text-red-700',
  High:    'bg-[#FEF9C3] text-[#D97706]',
  Medium:  'bg-yellow-100 text-yellow-700',
  Low:     'bg-[#F0F2F5] text-[#94A3B8]',
  Lowest:  'bg-[#F0F2F5] text-[#94A3B8]',
};

function statusLabel(cat: string): string {
  if (cat === 'done') return 'Done';
  if (cat === 'in_progress') return 'In Progress';
  return 'To Do';
}

function daysFmt(days: number): string {
  if (days === 0) return '—';
  return days === Math.round(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

// ─── BIZ ASSIGNMENT POPOVER ───────────────────────────────────────────────────

interface BizPopoverProps {
  jiraKey: string;
  existingAssignments: JiraItemBizAssignment[];
  contacts: BusinessContact[];
  onClose: () => void;
}

function BizPopover({ jiraKey, existingAssignments, contacts, onClose }: BizPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const assignmentsWithContacts = existingAssignments.map((assignment) => ({
    assignment,
    contact: contacts.find((contact) => contact.id === assignment.contactId) ?? null,
  }));

  return (
    <div
      ref={ref}
      className="absolute z-50 right-0 top-full mt-1 w-64 bg-white border border-[#DEDFE3] rounded-lg shadow-xl p-3 space-y-2"
    >
      <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">BIZ Assignments</p>
      <p className="text-[11px] text-[#94A3B8]">{jiraKey}</p>

      {assignmentsWithContacts.length > 0 ? (
        <div className="space-y-1">
          {assignmentsWithContacts.map(({ assignment, contact }) => (
            <div key={assignment.id} className="rounded bg-[#F0F2F5] px-2 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#1E293B]">{contact?.name ?? assignment.contactId}</span>
                <span className="font-medium text-[#64748B]">{assignment.days}d</span>
              </div>
              {assignment.notes ? (
                <p className="mt-1 text-[11px] leading-relaxed text-[#94A3B8]">{assignment.notes}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-[#94A3B8]">
          No business assignments are tracked for this item yet.
        </p>
      )}
    </div>
  );
}

const CONFIDENCE_BADGE_STYLES: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-green-100 text-[#16A34A]',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-amber-100 text-amber-700',
};

function TrackingEstimateCell({
  item,
  defaultConfidenceLevel,
  confidenceSettings,
}: {
  item: JiraWorkItem;
  defaultConfidenceLevel: 'high' | 'medium' | 'low';
  confidenceSettings: NonNullable<ReturnType<typeof useCurrentState>['settings']>['confidenceLevels'];
}) {
  if (item.storyPoints == null) return <span className="text-xs text-[#0089DD] font-medium">—</span>;

  const confidence = item.confidenceLevel ?? defaultConfidenceLevel;
  const forecastedDays = getForecastedDays(item.storyPoints, confidence, confidenceSettings);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-[#94A3B8]">{item.storyPoints}d</span>
      <span className="text-xs text-[#94A3B8]">→</span>
      <span className="text-xs font-semibold text-[#0089DD]">{forecastedDays}d</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${CONFIDENCE_BADGE_STYLES[confidence]}`}
        title={getConfidenceLabel(confidence, confidenceSettings)}
      >
        {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
      </span>
    </span>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function Projects() {
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const state = useCurrentState();
  const jiraConnections = state.jiraConnections ?? [];
  const jiraWorkItems = globalJiraWorkItems(state.jiraWorkItems ?? [], jiraConnections);
  const jiraSettings = state.jiraSettings;
  const jiraItemBizAssignments = state.jiraItemBizAssignments ?? [];
  const businessContacts = state.businessContacts ?? [];
  const activeConnection = jiraConnections.find(c => c.isActive);
  const activeJiraBaseUrl = activeConnection?.jiraBaseUrl.replace(/\/+$/, '') ?? '';
  const { showToast } = useToast();
  const { can } = useCurrentUser();
  const showSyncShortcut = can('sync_jira') && !can('manage_settings');

  // Sync shortcut
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState('');
  const [pendingDiff, setPendingDiff] = useState<JiraSyncDiff | null>(null);

  const handleSync = async (conn: (typeof jiraConnections)[0]) => {
    setSyncingId(conn.id);
    setSyncProgress('Fetching from Jira…');
    const { diff, error, empty } = await fetchSyncPreview(conn, jiraSettings, setSyncProgress);
    setSyncingId(null);
    setSyncProgress('');
    if (error) { showToast(error, 'error'); return; }
    if (empty) { showToast('Nothing new to sync.', 'info'); return; }
    if (diff) setPendingDiff(diff);
  };

  const handleSyncConfirm = () => {
    if (!pendingDiff) return;
    const { message } = applySync(pendingDiff);
    showToast(message, 'success');
    setPendingDiff(null);
  };

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterLabel, setFilterLabel] = useState('');
  const [filterITMember, setFilterITMember] = useState('');
  const [filterBizContact, setFilterBizContact] = useState('');
  const [showStories, setShowStories] = useState(false);

  // Expand state
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  // BIZ assignment popover
  const [openBizPopover, setOpenBizPopover] = useState<string | null>(null);

  // Build hierarchy
  const { epics, featuresByEpic, childrenByParent } = useMemo(() => {
    const epics: JiraWorkItem[] = [];
    const featuresByEpic = new Map<string, JiraWorkItem[]>();
    const childrenByParent = new Map<string, JiraWorkItem[]>();

    for (const item of jiraWorkItems) {
      if (item.type === 'epic') {
        epics.push(item);
        featuresByEpic.set(item.jiraKey, []);
        childrenByParent.set(item.jiraKey, []);
      }
    }
    for (const item of jiraWorkItems) {
      if (item.type === 'feature' && item.parentKey) {
        featuresByEpic.get(item.parentKey)?.push(item);
        childrenByParent.set(item.jiraKey, []);
      }
    }
    for (const item of jiraWorkItems) {
      if (item.type !== 'epic' && item.type !== 'feature' && item.parentKey) {
        childrenByParent.get(item.parentKey)?.push(item);
      }
    }
    // Sort epics by status then name
    epics.sort((a, b) => {
      const sc = ['todo', 'in_progress', 'done'].indexOf(a.statusCategory) - ['todo', 'in_progress', 'done'].indexOf(b.statusCategory);
      return sc !== 0 ? sc : a.summary.localeCompare(b.summary);
    });
    return { epics, featuresByEpic, childrenByParent };
  }, [jiraWorkItems]);

  // Rollup IT days (confidence-adjusted) for display on the Epics page.
  // NOTE: computeRollup includes ALL items regardless of quarter or status (including done).
  // This intentionally shows total scope per epic, not remaining capacity.
  // The capacity bank (Dashboard) uses calculateCapacity() instead, which filters
  // to non-done leaf items in a specific quarter with story points and a matched sprint.
  const rollupMap = useMemo(() => computeRollup(
    jiraWorkItems,
    state.jiraSettings.defaultConfidenceLevel,
    state.settings.confidenceLevels
  ), [jiraWorkItems, state.jiraSettings, state.settings.confidenceLevels]);

  // BIZ days per jiraKey (direct)
  const bizDaysByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of jiraItemBizAssignments) {
      m.set(a.jiraKey, (m.get(a.jiraKey) ?? 0) + (a.days ?? 0));
    }
    return m;
  }, [jiraItemBizAssignments]);

  // BIZ contacts per jiraKey
  const bizContactsByKey = useMemo(() => {
    const m = new Map<string, BusinessContact[]>();
    for (const a of jiraItemBizAssignments) {
      const c = businessContacts.find(x => x.id === a.contactId);
      if (c) {
        const arr = m.get(a.jiraKey) ?? [];
        arr.push(c);
        m.set(a.jiraKey, arr);
      }
    }
    return m;
  }, [jiraItemBizAssignments, businessContacts]);

  // BIZ rollup: total for an epic = sum of all items under it + epic itself
  function epicBizDays(epicKey: string): number {
    let total = bizDaysByKey.get(epicKey) ?? 0;
    for (const feature of featuresByEpic.get(epicKey) ?? []) {
      total += bizDaysByKey.get(feature.jiraKey) ?? 0;
      for (const child of childrenByParent.get(feature.jiraKey) ?? []) {
        total += bizDaysByKey.get(child.jiraKey) ?? 0;
      }
    }
    for (const child of childrenByParent.get(epicKey) ?? []) {
      total += bizDaysByKey.get(child.jiraKey) ?? 0;
    }
    return total;
  }

  function featureBizDays(featureKey: string): number {
    let total = bizDaysByKey.get(featureKey) ?? 0;
    for (const child of childrenByParent.get(featureKey) ?? []) {
      total += bizDaysByKey.get(child.jiraKey) ?? 0;
    }
    return total;
  }

  // IT members per epic
  function epicITMembers(epicKey: string): string[] {
    const emails = new Set<string>();
    for (const feature of featuresByEpic.get(epicKey) ?? []) {
      for (const child of childrenByParent.get(feature.jiraKey) ?? []) {
        if (child.assigneeEmail) emails.add(child.assigneeEmail);
      }
    }
    for (const child of childrenByParent.get(epicKey) ?? []) {
      if (child.assigneeEmail) emails.add(child.assigneeEmail);
    }
    return [...emails];
  }

  // All labels for filter dropdown
  const allLabels = useMemo(() => {
    const s = new Set<string>();
    for (const item of epics) item.labels?.forEach(l => s.add(l));
    return [...s].sort();
  }, [epics]);

  // Keys of items that directly match the current search query (used for highlight + force-expand)
  const searchMatchKeys = useMemo(() => {
    if (!search) return null;
    const keys = new Set<string>();
    for (const item of jiraWorkItems) {
      if (matchesSearch(search, item)) keys.add(item.jiraKey);
    }
    return keys;
  }, [search, jiraWorkItems]);

  // Filtered epics — includes epics whose descendants match the search query
  const filteredEpics = useMemo(() => {
    return epics.filter(epic => {
      if (filterStatus && epic.statusCategory !== filterStatus) return false;
      if (filterPriority && epic.priority !== filterPriority) return false;
      if (filterLabel && !epic.labels?.includes(filterLabel)) return false;
      if (filterITMember) {
        const memberEmails = epicITMembers(epic.jiraKey);
        const member = state.teamMembers.find(m => m.id === filterITMember);
        if (!member?.email || !memberEmails.includes(member.email)) return false;
      }
      if (filterBizContact) {
        const contacts = bizContactsByKey.get(epic.jiraKey) ?? [];
        if (!contacts.some(c => c.id === filterBizContact)) return false;
      }
      if (search) {
        // Direct epic match
        if (searchMatchKeys!.has(epic.jiraKey)) return true;
        // Match on any feature or grandchild under this epic
        for (const feat of featuresByEpic.get(epic.jiraKey) ?? []) {
          if (searchMatchKeys!.has(feat.jiraKey)) return true;
          for (const child of childrenByParent.get(feat.jiraKey) ?? []) {
            if (searchMatchKeys!.has(child.jiraKey)) return true;
          }
        }
        for (const child of childrenByParent.get(epic.jiraKey) ?? []) {
          if (searchMatchKeys!.has(child.jiraKey)) return true;
        }
        return false;
      }
      return true;
    });
  }, [epics, search, searchMatchKeys, filterStatus, filterPriority, filterLabel, filterITMember, filterBizContact, bizContactsByKey, state.teamMembers, featuresByEpic, childrenByParent]);

  const hasFilters = search || filterStatus || filterPriority || filterLabel || filterITMember || filterBizContact;

  const toggleEpic = (key: string) =>
    setExpandedEpics(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleFeature = (key: string) =>
    setExpandedFeatures(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const jiraLink = (key: string) => activeJiraBaseUrl ? `${activeJiraBaseUrl}/browse/${key}` : null;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Delivery Tracking"
        subtitle={`Read Jira status, hierarchy, and actual delivery progress.${jiraWorkItems.length > 0 ? ` ${filteredEpics.length} epic${filteredEpics.length !== 1 ? 's' : ''} in view.` : ''}`}
        actions={
          showSyncShortcut && activeConnection ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSync(activeConnection)}
              disabled={!!syncingId}
            >
              {syncingId ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
              Sync Jira
            </Button>
          ) : undefined
        }
      />
      <div className="mx-[-24px] mb-4">
        <StageProgressBar currentStage="actuals" onNavigate={setCurrentView} />
      </div>

      {/* Sync progress */}
      {syncProgress && (
        <div className="mx-6 mb-2 flex items-center gap-2 text-xs text-blue-600">
          <Loader2 size={12} className="animate-spin" />
          {syncProgress}
        </div>
      )}

      {/* Filters */}
      <div className="px-6 pb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search epics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#DEDFE3] rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0089DD]"
          />
        </div>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-[#DEDFE3] rounded-lg px-2 py-1.5 bg-white text-gray-700">
          <option value="">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="text-sm border border-[#DEDFE3] rounded-lg px-2 py-1.5 bg-white text-gray-700">
          <option value="">All Priorities</option>
          {['Highest', 'High', 'Medium', 'Low', 'Lowest'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {allLabels.length > 0 && (
          <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)}
            className="text-sm border border-[#DEDFE3] rounded-lg px-2 py-1.5 bg-white text-gray-700">
            <option value="">All Labels</option>
            {allLabels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}

        <select value={filterITMember} onChange={e => setFilterITMember(e.target.value)}
          className="text-sm border border-[#DEDFE3] rounded-lg px-2 py-1.5 bg-white text-gray-700">
          <option value="">All IT Members</option>
          {state.teamMembers.filter(m => m.email).map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select value={filterBizContact} onChange={e => setFilterBizContact(e.target.value)}
          className="text-sm border border-[#DEDFE3] rounded-lg px-2 py-1.5 bg-white text-gray-700">
          <option value="">All BIZ Contacts</option>
          {businessContacts.filter(c => !c.archived).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm text-[#94A3B8] cursor-pointer">
          <input type="checkbox" checked={showStories} onChange={e => setShowStories(e.target.checked)}
            className="rounded border-[#94A3B8] text-[#0089DD]" />
          Show stories
        </label>

        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterLabel(''); setFilterITMember(''); setFilterBizContact(''); }}
            className="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-gray-700"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Epics list */}
      <div className="flex-1 overflow-auto px-6 pb-6 space-y-3">
        {jiraWorkItems.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="No Jira data yet"
            description="Connect your Jira project in Settings → Jira and run a sync to import epics, features, and stories."
          />
        ) : filteredEpics.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No epics match your filters"
            description="Try adjusting your search or filter criteria."
          />
        ) : (
          filteredEpics.map(epic => {
            const epicMatchesDirect = !search || (searchMatchKeys?.has(epic.jiraKey) ?? false);
            const epicForceExpanded  = !!search && !epicMatchesDirect;
            const isExpanded = expandedEpics.has(epic.jiraKey) || epicForceExpanded;
            const features = featuresByEpic.get(epic.jiraKey) ?? [];
            const directChildren = childrenByParent.get(epic.jiraKey) ?? [];
            const itDays = rollupMap.get(epic.jiraKey)?.forecastedDays ?? 0;
            const bizTotal = epicBizDays(epic.jiraKey);
            const memberEmails = epicITMembers(epic.jiraKey);
            const link = jiraLink(epic.jiraKey);

            return (
              <div key={epic.jiraKey} className="bg-white border rounded-xl shadow-sm border-[#DEDFE3]">
                {/* Epic header */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-[#F5F8FC] select-none"
                  onClick={() => toggleEpic(epic.jiraKey)}
                >
                  <div className="mt-0.5 text-[#94A3B8] shrink-0">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs font-mono text-[#0089DD] hover:underline flex items-center gap-0.5"
                        >
                          {epic.jiraKey}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs font-mono text-[#94A3B8]">{epic.jiraKey}</span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[epic.statusCategory] ?? STATUS_COLORS.todo}`}
                      >
                        {statusLabel(epic.statusCategory)}
                      </span>
                      {epic.priority && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[epic.priority] ?? PRIORITY_COLORS.Medium}`}>
                          {epic.priority}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-semibold truncate ${epicMatchesDirect ? 'text-gray-900' : 'text-gray-400'}`}>{epic.summary}</p>

                    {/* Labels */}
                    {epic.labels && epic.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {epic.labels.map(l => (
                          <span key={l} className="text-xs bg-[#F0F2F5] text-[#94A3B8] px-2 py-0.5 rounded-full">{l}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0" onClick={e => e.stopPropagation()}>
                    <div className="text-center min-w-12">
                      <p className="text-xs text-[#94A3B8]">Features</p>
                      <p className="text-sm font-semibold text-gray-700">{features.length}</p>
                    </div>
                    <div className="text-center min-w-14">
                      <p className="text-xs text-blue-400">IT Days</p>
                      <p className="text-sm font-semibold text-[#0089DD]">{daysFmt(itDays)}</p>
                    </div>
                    <div className="text-center min-w-14">
                      <p className="text-xs text-[#94A3B8]">BIZ Days</p>
                      <p className="text-sm font-semibold text-[#94A3B8]">{daysFmt(bizTotal)}</p>
                    </div>
                    {memberEmails.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-[#94A3B8]">
                        <Users size={12} />
                        {memberEmails.length}
                      </div>
                    )}
                    <WorkItemSkillsCell item={epic} allItems={jiraWorkItems} />
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Feature rows */}
                    {features.map(feature => {
                      const children = childrenByParent.get(feature.jiraKey) ?? [];
                      const featMatchesDirect = !search || (searchMatchKeys?.has(feature.jiraKey) ?? false);
                      const featHasChildMatch = !!search && children.some(c => searchMatchKeys?.has(c.jiraKey));
                      const featForceExpanded = !!search && !featMatchesDirect && featHasChildMatch;
                      const featExpanded = expandedFeatures.has(feature.jiraKey) || featForceExpanded;
                      const featItDays = rollupMap.get(feature.jiraKey)?.forecastedDays ?? 0;
                      const featBizDays = featureBizDays(feature.jiraKey);
                      const featBizAssignments = jiraItemBizAssignments.filter(a => a.jiraKey === feature.jiraKey);
                      const featLink = jiraLink(feature.jiraKey);
                      const itMembers = [...new Set(children.map(c => c.assigneeName).filter(Boolean) as string[])];
                      // Dim features that don't match and have no matching children
                      const featDimmed = !!search && !featMatchesDirect && !featHasChildMatch;

                      return (
                        <div key={feature.jiraKey} className={`border-t border-gray-50${featDimmed ? ' opacity-40' : ''}`}>
                          {/* Feature row */}
                          <div className={`flex items-center gap-2 px-4 py-2.5 pl-10 hover:bg-[#F5F8FC] group${featMatchesDirect ? ' border-l-2 border-[#0089DD]' : ''}`}>
                            {(showStories || featForceExpanded) && children.length > 0 ? (
                              <button
                                onClick={() => toggleFeature(feature.jiraKey)}
                                className="text-[#94A3B8] hover:text-[#94A3B8] shrink-0"
                              >
                                {featExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <span className="w-3.5 shrink-0" />
                            )}

                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              {featLink ? (
                                <a href={featLink} target="_blank" rel="noopener noreferrer"
                                  className="text-xs font-mono text-[#0089DD] hover:underline flex items-center gap-0.5 shrink-0">
                                  {feature.jiraKey}<ExternalLink size={9} />
                                </a>
                              ) : (
                                <span className="text-xs font-mono text-[#94A3B8] shrink-0">{feature.jiraKey}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[feature.statusCategory] ?? STATUS_COLORS.todo}`}>
                                {statusLabel(feature.statusCategory)}
                              </span>
                              <span className={`text-sm truncate ${featMatchesDirect ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{feature.summary}</span>
                            </div>

                            {/* IT assignees */}
                            <div className="hidden sm:flex items-center gap-1 text-xs text-[#94A3B8] shrink-0 min-w-24">
                              {itMembers.length > 0 && (
                                <>
                                  <UserCircle2 size={12} className="text-[#0089DD]" />
                                  <span className="truncate max-w-20">{itMembers.slice(0, 2).join(', ')}{itMembers.length > 2 ? ` +${itMembers.length - 2}` : ''}</span>
                                </>
                              )}
                            </div>

                            {/* IT days */}
                            <div className="text-xs text-right text-[#0089DD] font-medium shrink-0 min-w-14">
                              {daysFmt(featItDays)}
                            </div>

                            {/* Required skills */}
                            <WorkItemSkillsCell item={feature} allItems={jiraWorkItems} />

                            {/* BIZ days — click to open popover */}
                            <div className="relative shrink-0 min-w-14">
                              <button
                                onClick={() => setOpenBizPopover(openBizPopover === feature.jiraKey ? null : feature.jiraKey)}
                                className={`text-xs font-medium px-2 py-0.5 rounded hover:bg-[#F0F2F5] transition-colors ${featBizDays > 0 ? 'text-[#94A3B8]' : 'text-[#DEDFE3]'}`}
                                title="View BIZ assignments"
                              >
                                <span className="flex items-center gap-1">
                                  <Building2 size={11} />
                                  {daysFmt(featBizDays)}
                                </span>
                              </button>
                              {openBizPopover === feature.jiraKey && (
                                <BizPopover
                                  jiraKey={feature.jiraKey}
                                  existingAssignments={featBizAssignments}
                                  contacts={businessContacts}
                                  onClose={() => setOpenBizPopover(null)}
                                />
                              )}
                            </div>
                          </div>

                          {/* Story rows */}
                          {(showStories || featForceExpanded) && featExpanded && children.map(child => {
                            const childMatchesDirect = !search || (searchMatchKeys?.has(child.jiraKey) ?? false);
                            const childDimmed = !!search && !childMatchesDirect;
                            // When a search is active, hide non-matching children unless showStories is on
                            if (search && !showStories && !childMatchesDirect) return null;
                            const childBizAssignments = jiraItemBizAssignments.filter(a => a.jiraKey === child.jiraKey);
                            const childBizDays = bizDaysByKey.get(child.jiraKey) ?? 0;
                            const childLink = jiraLink(child.jiraKey);
                            const childItDays = rollupMap.get(child.jiraKey)?.forecastedDays ?? 0;

                            return (
                              <div key={child.jiraKey} className={`flex items-center gap-2 px-4 py-2 pl-20 bg-[#F5F8FC]/50 hover:bg-[#F5F8FC] border-t border-gray-50${childMatchesDirect ? ' border-l-2 border-[#0089DD]' : ''}${childDimmed ? ' opacity-40' : ''}`}>
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                  {childLink ? (
                                    <a href={childLink} target="_blank" rel="noopener noreferrer"
                                      className="text-xs font-mono text-[#94A3B8] hover:text-[#0089DD] shrink-0 flex items-center gap-0.5">
                                      {child.jiraKey}<ExternalLink size={8} />
                                    </a>
                                  ) : (
                                    <span className="text-xs font-mono text-[#94A3B8] shrink-0">{child.jiraKey}</span>
                                  )}
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[child.statusCategory] ?? STATUS_COLORS.todo}`}>
                                    {statusLabel(child.statusCategory)}
                                  </span>
                                  <span className={`text-xs truncate ${childMatchesDirect ? 'font-semibold text-gray-800' : 'text-[#94A3B8]'}`}>{child.summary}</span>
                                </div>

                                {/* Assignee */}
                                <div className="hidden sm:flex items-center gap-1 text-xs text-[#94A3B8] shrink-0 min-w-24">
                                  {child.assigneeName && (
                                    <>
                                      <UserCircle2 size={11} className="text-[#0089DD]" />
                                      <span className="truncate max-w-20">{child.assigneeName}</span>
                                    </>
                                  )}
                                </div>

                                {/* Sprint */}
                                <span className="hidden md:block text-xs text-[#94A3B8] shrink-0 min-w-20 text-center truncate">
                                  {child.sprintName ?? '—'}
                                </span>

                                {/* IT days + confidence */}
                                <div className="shrink-0 min-w-20 flex justify-end">
                                  {child.storyPoints != null ? (
                                    <TrackingEstimateCell
                                      item={child}
                                      defaultConfidenceLevel={state.jiraSettings.defaultConfidenceLevel}
                                      confidenceSettings={state.settings.confidenceLevels}
                                    />
                                  ) : (
                                    <span className="text-xs text-[#0089DD] font-medium">{daysFmt(childItDays)}</span>
                                  )}
                                </div>

                                {/* Required skills */}
                                <WorkItemSkillsCell item={child} allItems={jiraWorkItems} />

                                {/* BIZ days popover */}
                                <div className="relative shrink-0 min-w-14">
                                  <button
                                    onClick={() => setOpenBizPopover(openBizPopover === child.jiraKey ? null : child.jiraKey)}
                                    className={`text-xs font-medium px-2 py-0.5 rounded hover:bg-[#F0F2F5] transition-colors ${childBizDays > 0 ? 'text-[#94A3B8]' : 'text-[#DEDFE3]'}`}
                                    title="View BIZ assignments"
                                  >
                                    <span className="flex items-center gap-1">
                                      <Building2 size={11} />
                                      {daysFmt(childBizDays)}
                                    </span>
                                  </button>
                                  {openBizPopover === child.jiraKey && (
                                    <BizPopover
                                      jiraKey={child.jiraKey}
                                      existingAssignments={childBizAssignments}
                                      contacts={businessContacts}
                                      onClose={() => setOpenBizPopover(null)}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Direct children of epic (stories/tasks directly under epic) */}
                    {(showStories || epicForceExpanded) && directChildren.map(child => {
                      const childMatchesDirect = !search || (searchMatchKeys?.has(child.jiraKey) ?? false);
                      if (search && !showStories && !childMatchesDirect) return null;
                      const childBizAssignments = jiraItemBizAssignments.filter(a => a.jiraKey === child.jiraKey);
                      const childBizDays = bizDaysByKey.get(child.jiraKey) ?? 0;
                      const childLink = jiraLink(child.jiraKey);
                      const childItDays = rollupMap.get(child.jiraKey)?.forecastedDays ?? 0;

                      return (
                        <div key={child.jiraKey} className={`flex items-center gap-2 px-4 py-2 pl-12 bg-[#F5F8FC]/30 hover:bg-[#F5F8FC] border-t border-gray-50${childMatchesDirect ? ' border-l-2 border-[#0089DD]' : ''}${search && !childMatchesDirect ? ' opacity-40' : ''}`}>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            {childLink ? (
                              <a href={childLink} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-mono text-[#94A3B8] hover:text-[#0089DD] shrink-0 flex items-center gap-0.5">
                                {child.jiraKey}<ExternalLink size={8} />
                              </a>
                            ) : (
                              <span className="text-xs font-mono text-[#94A3B8] shrink-0">{child.jiraKey}</span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[child.statusCategory] ?? STATUS_COLORS.todo}`}>
                              {statusLabel(child.statusCategory)}
                            </span>
                            <span className={`text-xs truncate ${childMatchesDirect ? 'font-semibold text-gray-800' : 'text-[#94A3B8]'}`}>{child.summary}</span>
                          </div>
                          <div className="hidden sm:flex items-center gap-1 text-xs text-[#94A3B8] shrink-0 min-w-24">
                            {child.assigneeName && (
                              <><UserCircle2 size={11} className="text-[#0089DD]" /><span className="truncate max-w-20">{child.assigneeName}</span></>
                            )}
                          </div>
                          <span className="hidden md:block text-xs text-[#94A3B8] shrink-0 min-w-20 text-center truncate">{child.sprintName ?? '—'}</span>
                          <div className="shrink-0 min-w-20 flex justify-end">
                            {child.storyPoints != null ? (
                              <TrackingEstimateCell
                                item={child}
                                defaultConfidenceLevel={state.jiraSettings.defaultConfidenceLevel}
                                confidenceSettings={state.settings.confidenceLevels}
                              />
                            ) : (
                              <span className="text-xs text-[#0089DD] font-medium">{daysFmt(childItDays)}</span>
                            )}
                          </div>
                          {/* Required skills */}
                          <WorkItemSkillsCell item={child} allItems={jiraWorkItems} />

                          <div className="relative shrink-0 min-w-14">
                            <button
                              onClick={() => setOpenBizPopover(openBizPopover === child.jiraKey ? null : child.jiraKey)}
                              className={`text-xs font-medium px-2 py-0.5 rounded hover:bg-[#F0F2F5] ${childBizDays > 0 ? 'text-[#94A3B8]' : 'text-[#DEDFE3]'}`}
                              title="View BIZ assignments"
                            >
                              <span className="flex items-center gap-1"><Building2 size={11} />{daysFmt(childBizDays)}</span>
                            </button>
                            {openBizPopover === child.jiraKey && (
                              <BizPopover
                                jiraKey={child.jiraKey}
                                existingAssignments={childBizAssignments}
                                contacts={businessContacts}
                                onClose={() => setOpenBizPopover(null)}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {features.length === 0 && directChildren.length === 0 && (
                      <div className="px-10 py-3 text-xs text-[#94A3B8] italic">
                        No features or stories under this epic.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sync confirmation modal */}
      {pendingDiff && (
        <Modal
          isOpen={true}
          onClose={() => setPendingDiff(null)}
          title="Confirm Jira Sync"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-lg font-bold text-[#16A34A]">{pendingDiff.toAdd.length}</p>
                <p className="text-xs text-[#16A34A]">New</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-lg font-bold text-blue-600">{pendingDiff.toUpdate.length}</p>
                <p className="text-xs text-blue-600">Updated</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-lg font-bold text-red-600">{pendingDiff.toRemove.length}</p>
                <p className="text-xs text-red-600">Removed</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setPendingDiff(null)}>Cancel</Button>
              <Button onClick={handleSyncConfirm}>Apply Sync</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
