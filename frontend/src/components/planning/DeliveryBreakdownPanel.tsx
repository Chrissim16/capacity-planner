import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Search,
  UserCircle2,
} from 'lucide-react';
import type { BusinessContact, JiraItemBizAssignment, JiraWorkItem, TeamMember } from '../../types';
import { PLANNING_PANEL_CLASS } from './planningShell';

interface DeliveryBreakdownPanelProps {
  epicItems: JiraWorkItem[];
  allItems: JiraWorkItem[];
  assignedJiraIds: Set<string>;
  businessAssignments: JiraItemBizAssignment[];
  teamMembers: TeamMember[];
  businessContacts: BusinessContact[];
  onAssignItOwner: (workItemId: string, memberId: string | null) => void;
  onAssignBizOwner: (jiraKey: string, contactId: string | null) => void;
}

const TYPE_STYLES: Record<JiraWorkItem['type'], string> = {
  epic: 'bg-slate-100 text-slate-700',
  feature: 'bg-blue-100 text-blue-700',
  story: 'bg-emerald-100 text-emerald-700',
  task: 'bg-amber-100 text-amber-700',
  bug: 'bg-rose-100 text-rose-700',
};

function sortByType(a: JiraWorkItem, b: JiraWorkItem): number {
  const order: Record<JiraWorkItem['type'], number> = {
    epic: 0,
    feature: 1,
    story: 2,
    task: 3,
    bug: 4,
  };
  const typeDiff = order[a.type] - order[b.type];
  if (typeDiff !== 0) return typeDiff;
  return a.jiraKey.localeCompare(b.jiraKey);
}

function statusChip(hasItOwner: boolean, hasBizOwner: boolean, isScheduled: boolean) {
  if (!hasItOwner && !hasBizOwner) {
    return {
      label: 'Needs IT + BIZ',
      className: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
    };
  }
  if (!hasItOwner) {
    return {
      label: 'Needs IT owner',
      className: 'border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]',
    };
  }
  if (!hasBizOwner) {
    return {
      label: 'Needs BIZ owner',
      className: 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]',
    };
  }
  if (isScheduled) {
    return {
      label: 'Planned',
      className: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]',
    };
  }
  return {
    label: 'Ready to schedule',
    className: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
  };
}

function BreakdownItemRow({
  item,
  depth = 0,
  assignedJiraIds,
  teamMembers,
  businessContacts,
  businessAssignments,
  currentItOwnerId,
  onAssignItOwner,
  onAssignBizOwner,
}: {
  item: JiraWorkItem;
  depth?: number;
  assignedJiraIds: Set<string>;
  teamMembers: TeamMember[];
  businessContacts: BusinessContact[];
  businessAssignments: JiraItemBizAssignment[];
  currentItOwnerId: string | null;
  onAssignItOwner: (workItemId: string, memberId: string | null) => void;
  onAssignBizOwner: (jiraKey: string, contactId: string | null) => void;
}) {
  const primaryBizAssignment = businessAssignments[0] ?? null;
  const primaryBizContact = businessContacts.find((contact) => contact.id === primaryBizAssignment?.contactId) ?? null;
  const extraBizAssignmentCount = Math.max(0, businessAssignments.length - (primaryBizAssignment ? 1 : 0));
  const hasItOwner = Boolean(item.assigneeEmail || item.assigneeName);
  const hasBizOwner = businessAssignments.length > 0;
  const isScheduled = assignedJiraIds.has(item.id);
  const status = statusChip(hasItOwner, hasBizOwner, isScheduled);
  const itSelectValue = currentItOwnerId ?? (item.assigneeName ? '__unknown__' : '');
  const bizSelectValue = primaryBizAssignment?.contactId
    ?? (primaryBizContact ? primaryBizContact.id : businessAssignments.length > 0 ? '__unknown__' : '');
  const sprintCount = isScheduled ? 1 : 0;

  return (
    <div
      className="grid gap-3 border-t border-[#EEF2F7] px-4 py-3"
      style={{ paddingLeft: `${16 + depth * 28}px`, gridTemplateColumns: 'minmax(280px, 1.5fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr) minmax(120px, 0.7fr)' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TYPE_STYLES[item.type]}`}>
            {item.type}
          </span>
          <span className="font-mono text-xs text-[#0089DD]">{item.jiraKey}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-medium text-[#1E293B]">{item.summary}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
          <span>{sprintCount > 0 ? 'Scheduled in delivery plan' : 'Unscheduled in delivery plan'}</span>
          {item.sprintName ? <span>{item.sprintName}</span> : null}
          {extraBizAssignmentCount > 0 ? <span>+{extraBizAssignmentCount} extra BIZ assignment{extraBizAssignmentCount === 1 ? '' : 's'}</span> : null}
        </div>
      </div>

      <label className="min-w-0">
        <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          <UserCircle2 size={12} />
          IT owner
        </span>
        <select
          value={itSelectValue}
          onChange={(event) => onAssignItOwner(item.id, event.target.value || null)}
          className="w-full rounded-lg border border-[#DEDFE3] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#0089DD]"
        >
          <option value="">Assign IT owner</option>
          {item.assigneeName && !currentItOwnerId ? (
            <option value="__unknown__" disabled>
              Current: {item.assigneeName}
            </option>
          ) : null}
          {teamMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}{member.workerType === 'external' ? ' (External)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-0">
        <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
          <BriefcaseBusiness size={12} />
          Business owner
        </span>
        <select
          value={bizSelectValue}
          onChange={(event) => onAssignBizOwner(item.jiraKey, event.target.value || null)}
          className="w-full rounded-lg border border-[#DEDFE3] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#0089DD]"
        >
          <option value="">Assign BIZ owner</option>
          {businessAssignments.length > 0 && !primaryBizContact ? (
            <option value="__unknown__" disabled>
              Current assignment not matched
            </option>
          ) : null}
          {businessContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}{contact.department ? ` (${contact.department})` : ''}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col justify-center">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Coverage</span>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className={hasItOwner ? 'text-[#15803D]' : 'text-[#C2410C]'}>
            {hasItOwner ? 'IT assigned' : 'IT missing'}
          </span>
          <span className={hasBizOwner ? 'text-[#15803D]' : 'text-[#C2410C]'}>
            {hasBizOwner ? 'BIZ assigned' : 'BIZ missing'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DeliveryBreakdownPanel({
  epicItems,
  allItems,
  assignedJiraIds,
  businessAssignments,
  teamMembers,
  businessContacts,
  onAssignItOwner,
  onAssignBizOwner,
}: DeliveryBreakdownPanelProps) {
  const [search, setSearch] = useState('');
  const [collapsedEpics, setCollapsedEpics] = useState<Record<string, boolean>>({});
  const [collapsedFeatures, setCollapsedFeatures] = useState<Record<string, boolean>>({});

  const activeTeamMembers = useMemo(
    () => teamMembers.filter((member) => !member.excludedFromCapacity),
    [teamMembers],
  );
  const activeBusinessContacts = useMemo(
    () => businessContacts.filter((contact) => !contact.archived && !contact.excludedFromCapacity),
    [businessContacts],
  );

  const businessAssignmentsByJiraKey = useMemo(() => {
    const map = new Map<string, JiraItemBizAssignment[]>();
    for (const assignment of businessAssignments) {
      if (!map.has(assignment.jiraKey)) map.set(assignment.jiraKey, []);
      map.get(assignment.jiraKey)!.push(assignment);
    }
    return map;
  }, [businessAssignments]);

  const businessContactById = useMemo(
    () => new Map(activeBusinessContacts.map((contact) => [contact.id, contact])),
    [activeBusinessContacts],
  );
  const memberByEmail = useMemo(
    () => new Map(
      activeTeamMembers
        .filter((member) => member.email)
        .map((member) => [member.email!.toLowerCase(), member]),
    ),
    [activeTeamMembers],
  );
  const memberByName = useMemo(
    () => new Map(activeTeamMembers.map((member) => [member.name.trim().toLowerCase(), member])),
    [activeTeamMembers],
  );
  const itemsByParentKey = useMemo(() => {
    const map = new Map<string, JiraWorkItem[]>();
    for (const item of allItems) {
      if (item.statusCategory === 'done' || item.type === 'epic' || !item.parentKey) continue;
      if (!map.has(item.parentKey)) map.set(item.parentKey, []);
      map.get(item.parentKey)!.push(item);
    }
    for (const items of map.values()) items.sort(sortByType);
    return map;
  }, [allItems]);

  const resolveTeamMemberId = (item: JiraWorkItem): string | null => {
    if (item.assigneeEmail) {
      const member = memberByEmail.get(item.assigneeEmail.toLowerCase());
      if (member) return member.id;
    }
    if (item.assigneeName) {
      const member = memberByName.get(item.assigneeName.trim().toLowerCase());
      if (member) return member.id;
    }
    return null;
  };

  const query = search.trim().toLowerCase();
  const itemMatchesSearch = (item: JiraWorkItem): boolean => {
    if (!query) return true;
    const bizOwnerNames = (businessAssignmentsByJiraKey.get(item.jiraKey) ?? [])
      .map((assignment) => businessContactById.get(assignment.contactId)?.name ?? assignment.contactId);
    return [
      item.jiraKey,
      item.summary,
      item.typeName,
      item.assigneeName ?? '',
      ...bizOwnerNames,
    ].some((value) => value.toLowerCase().includes(query));
  };

  const visibleEpics = useMemo(
    () =>
      epicItems.filter((epic) => {
        if (!query) return true;
        const directChildren = itemsByParentKey.get(epic.jiraKey) ?? [];
        return itemMatchesSearch(epic)
          || directChildren.some((item) =>
            itemMatchesSearch(item)
            || (itemsByParentKey.get(item.jiraKey) ?? []).some(itemMatchesSearch),
          );
      }),
    [epicItems, itemsByParentKey, query],
  );

  const getEpicBreakdown = (epic: JiraWorkItem) => {
    const directChildren = itemsByParentKey.get(epic.jiraKey) ?? [];
    const featureItems = directChildren.filter((item) => item.type === 'feature');
    const directLeaves = directChildren.filter((item) => item.type !== 'feature');
    const featureChildren = featureItems.flatMap((feature) => itemsByParentKey.get(feature.jiraKey) ?? []);
    const schedulableItems = [...featureItems, ...directLeaves, ...featureChildren];
    const ownerGapCount = schedulableItems.filter((item) =>
      (!(item.assigneeEmail || item.assigneeName))
      || (businessAssignmentsByJiraKey.get(item.jiraKey) ?? []).length === 0,
    ).length;
    const scheduledCount = schedulableItems.filter((item) => assignedJiraIds.has(item.id)).length;

    return {
      directChildren,
      featureItems,
      directLeaves,
      featureChildren,
      schedulableItems,
      ownerGapCount,
      scheduledCount,
    };
  };

  const summary = useMemo(() => {
    let featureCount = 0;
    let deliveryItemCount = 0;
    let scheduledCount = 0;
    let missingOwnerCount = 0;
    let missingBreakdownCount = 0;

    for (const epic of visibleEpics) {
      const {
        featureItems,
        directLeaves,
        featureChildren,
        ownerGapCount,
        scheduledCount: epicScheduledCount,
      } = getEpicBreakdown(epic);
      const deliveryItems = [...directLeaves, ...featureChildren];

      featureCount += featureItems.length;
      deliveryItemCount += deliveryItems.length;
      if (deliveryItems.length === 0) missingBreakdownCount += 1;
      scheduledCount += epicScheduledCount;
      missingOwnerCount += ownerGapCount;
    }

    return { featureCount, deliveryItemCount, scheduledCount, missingOwnerCount, missingBreakdownCount };
  }, [assignedJiraIds, businessAssignmentsByJiraKey, itemsByParentKey, visibleEpics]);

  return (
    <section className="border-b border-[#DEDFE3] bg-[#F8FAFC] px-6 py-5">
      <div className={PLANNING_PANEL_CLASS}>
        <div className="flex flex-col gap-4 border-b border-[#EEF2F7] px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1E293B]">Imported Delivery Breakdown</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Plan delivery on imported features, stories, tasks, and bugs with explicit IT and business ownership.
            </p>
          </div>
          <label className="relative block w-full xl:w-[320px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search epics, features, stories, or owners"
              className="w-full rounded-lg border border-[#DEDFE3] bg-white py-2 pl-9 pr-3 text-sm text-[#1E293B] outline-none focus:border-[#0089DD]"
            />
          </label>
        </div>

        <div className="grid gap-3 border-b border-[#EEF2F7] px-5 py-4 md:grid-cols-4">
          {[
            { label: 'Imported features', value: summary.featureCount },
            { label: 'Delivery items', value: summary.deliveryItemCount },
            { label: 'Scheduled items', value: summary.scheduledCount },
            { label: 'Items missing owners', value: summary.missingOwnerCount },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{card.label}</div>
              <div className="mt-2 text-2xl font-semibold text-[#1E293B]">{card.value}</div>
            </div>
          ))}
        </div>

        {summary.missingBreakdownCount > 0 ? (
          <div className="flex items-center gap-2 border-b border-[#EEF2F7] bg-[#FFF7ED] px-5 py-3 text-sm text-[#9A3412]">
            <AlertTriangle size={16} />
            <span>{summary.missingBreakdownCount} epic{summary.missingBreakdownCount === 1 ? '' : 's'} are visible but not yet ready for detailed delivery planning.</span>
          </div>
        ) : null}

        <div className="max-h-[620px] overflow-y-auto">
          {visibleEpics.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[#94A3B8]">
              No epics match the current delivery planning filters.
            </div>
          ) : visibleEpics.map((epic) => {
            const {
              directChildren,
              featureItems,
              directLeaves,
              ownerGapCount,
              scheduledCount: epicScheduledCount,
            } = getEpicBreakdown(epic);
            const epicMissingBreakdown = directChildren.length === 0;
            const epicExpanded = collapsedEpics[epic.jiraKey] !== true;
            const deliveryItemCount = directLeaves.length + featureItems.reduce(
              (sum, feature) => sum + (itemsByParentKey.get(feature.jiraKey) ?? []).length,
              0,
            );

            return (
              <div key={epic.id} className="border-b border-[#EEF2F7] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setCollapsedEpics((current) => ({ ...current, [epic.jiraKey]: epicExpanded }))}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-[#F8FAFC]"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {epicExpanded ? <ChevronDown size={18} className="mt-0.5 text-[#94A3B8]" /> : <ChevronRight size={18} className="mt-0.5 text-[#94A3B8]" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-[#0089DD]">{epic.jiraKey}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                          Epic
                        </span>
                        {epicMissingBreakdown ? (
                          <span className="rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-2 py-0.5 text-[11px] font-medium text-[#C2410C]">
                            Missing Jira breakdown
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-base font-semibold text-[#1E293B]">{epic.summary}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#64748B]">
                        <span>{featureItems.length} feature{featureItems.length === 1 ? '' : 's'}</span>
                        <span>{deliveryItemCount} delivery item{deliveryItemCount === 1 ? '' : 's'}</span>
                        <span>{ownerGapCount} with owner gaps</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-[#DEDFE3] bg-white px-3 py-1 text-xs font-medium text-[#64748B]">
                    {epicScheduledCount > 0
                      ? `${epicScheduledCount} scheduled`
                      : 'Assign owners before scheduling'}
                  </div>
                </button>

                {epicExpanded ? (
                  epicMissingBreakdown ? (
                    <div className="px-12 pb-4 text-sm text-[#94A3B8]">
                      This epic is already in planning, but it does not yet have imported feature or story breakdown to support detailed delivery planning.
                    </div>
                  ) : (
                    <div className="pb-3">
                      {featureItems.map((feature) => {
                        const featureExpanded = collapsedFeatures[feature.jiraKey] !== true;
                        const featureChildren = itemsByParentKey.get(feature.jiraKey) ?? [];
                        const featureBusinessAssignments = businessAssignmentsByJiraKey.get(feature.jiraKey) ?? [];
                        const featurePrimaryBizAssignment = featureBusinessAssignments[0] ?? null;
                        const featurePrimaryBizContact = activeBusinessContacts.find(
                          (contact) => contact.id === featurePrimaryBizAssignment?.contactId,
                        ) ?? null;
                        const featureItOwnerId = resolveTeamMemberId(feature);
                        const featureHasItOwner = Boolean(feature.assigneeEmail || feature.assigneeName);
                        const featureHasBizOwner = featureBusinessAssignments.length > 0;
                        const featureStatus = statusChip(featureHasItOwner, featureHasBizOwner, assignedJiraIds.has(feature.id));
                        const featureItSelectValue = featureItOwnerId ?? (feature.assigneeName ? '__unknown__' : '');
                        const featureBizSelectValue = featurePrimaryBizAssignment?.contactId
                          ?? (featurePrimaryBizContact ? featurePrimaryBizContact.id : featureBusinessAssignments.length > 0 ? '__unknown__' : '');

                        return (
                          <div key={feature.id}>
                            <div
                              className="grid gap-3 border-t border-[#EEF2F7] px-4 py-3"
                              style={{ paddingLeft: '44px', gridTemplateColumns: 'minmax(280px, 1.5fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr) minmax(120px, 0.7fr)' }}
                            >
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setCollapsedFeatures((current) => ({ ...current, [feature.jiraKey]: featureExpanded }))}
                                  className="flex items-center gap-2 text-left"
                                >
                                  {featureExpanded ? <ChevronDown size={16} className="text-[#94A3B8]" /> : <ChevronRight size={16} className="text-[#94A3B8]" />}
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TYPE_STYLES.feature}`}>
                                    Feature
                                  </span>
                                  <span className="font-mono text-xs text-[#0089DD]">{feature.jiraKey}</span>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${featureStatus.className}`}>
                                    {featureStatus.label}
                                  </span>
                                </button>
                                <p className="mt-1 truncate text-sm font-medium text-[#1E293B]">{feature.summary}</p>
                                <p className="mt-1 text-xs text-[#94A3B8]">{featureChildren.length} child item{featureChildren.length === 1 ? '' : 's'}</p>
                              </div>

                              <label className="min-w-0">
                                <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                                  <UserCircle2 size={12} />
                                  IT owner
                                </span>
                                <select
                                  value={featureItSelectValue}
                                  onChange={(event) => onAssignItOwner(feature.id, event.target.value || null)}
                                  className="w-full rounded-lg border border-[#DEDFE3] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#0089DD]"
                                >
                                  <option value="">Assign IT owner</option>
                                  {feature.assigneeName && !featureItOwnerId ? (
                                    <option value="__unknown__" disabled>
                                      Current: {feature.assigneeName}
                                    </option>
                                  ) : null}
                                  {activeTeamMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name}{member.workerType === 'external' ? ' (External)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="min-w-0">
                                <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                                  <BriefcaseBusiness size={12} />
                                  Business owner
                                </span>
                                <select
                                  value={featureBizSelectValue}
                                  onChange={(event) => onAssignBizOwner(feature.jiraKey, event.target.value || null)}
                                  className="w-full rounded-lg border border-[#DEDFE3] bg-white px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#0089DD]"
                                >
                                  <option value="">Assign BIZ owner</option>
                                  {featureBusinessAssignments.length > 0 && !featurePrimaryBizContact ? (
                                    <option value="__unknown__" disabled>
                                      Current assignment not matched
                                    </option>
                                  ) : null}
                                  {activeBusinessContacts.map((contact) => (
                                    <option key={contact.id} value={contact.id}>
                                      {contact.name}{contact.department ? ` (${contact.department})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <div className="flex items-center text-xs text-[#64748B]">
                                {assignedJiraIds.has(feature.id) ? 'Scheduled' : 'Unscheduled'}
                              </div>
                            </div>

                            {featureExpanded ? (
                              featureChildren.length > 0 ? (
                                featureChildren.map((item) => (
                                  <BreakdownItemRow
                                    key={item.id}
                                    item={item}
                                    depth={2}
                                    assignedJiraIds={assignedJiraIds}
                                    teamMembers={activeTeamMembers}
                                    businessContacts={activeBusinessContacts}
                                    businessAssignments={businessAssignmentsByJiraKey.get(item.jiraKey) ?? []}
                                    currentItOwnerId={resolveTeamMemberId(item)}
                                    onAssignItOwner={onAssignItOwner}
                                    onAssignBizOwner={onAssignBizOwner}
                                  />
                                ))
                              ) : (
                                <div className="px-16 py-3 text-sm text-[#94A3B8]">
                                  This feature is visible, but its story or task breakdown has not been imported yet.
                                </div>
                              )
                            ) : null}
                          </div>
                        );
                      })}

                      {directLeaves.map((item) => (
                        <BreakdownItemRow
                          key={item.id}
                          item={item}
                          depth={1}
                          assignedJiraIds={assignedJiraIds}
                          teamMembers={activeTeamMembers}
                          businessContacts={activeBusinessContacts}
                          businessAssignments={businessAssignmentsByJiraKey.get(item.jiraKey) ?? []}
                          currentItOwnerId={resolveTeamMemberId(item)}
                          onAssignItOwner={onAssignItOwner}
                          onAssignBizOwner={onAssignBizOwner}
                        />
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 border-t border-[#EEF2F7] px-5 py-3 text-xs text-[#64748B]">
          <CheckCircle2 size={14} className="text-[#15803D]" />
          <span>Scheduling still happens in the sprint grid below, but hierarchy and owner gaps are now visible first.</span>
        </div>
      </div>
    </section>
  );
}
