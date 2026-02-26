import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, CalendarOff, Users, AlertTriangle, Mail, Filter, CalendarDays, GitBranch, LayoutGrid, List, Building2, Archive, ArchiveRestore, CheckSquare, X } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { TeamMemberForm } from '../components/forms/TeamMemberForm';
import { TimeOffForm } from '../components/forms/TimeOffForm';
import { MemberCalendarModal } from '../components/ui/MemberCalendarModal';
import { PageHeader } from '../components/layout/PageHeader';
import { useCurrentState, useAppStore } from '../stores/appStore';
import { deleteTeamMember, addBusinessContact, updateBusinessContact, deleteBusinessContact, bulkUpdateTeamMembers, bulkUpdateBusinessContacts } from '../stores/actions';
import { useToast } from '../components/ui/Toast';
import { calculateBusinessCapacityForQuarter } from '../utils/capacity';
import { getCurrentQuarter } from '../utils/calendar';
import type { TeamMember, BusinessContact, ProcessTeam } from '../types';

type GroupBy = 'role' | 'country' | 'squad' | 'processTeam' | 'dept' | 'none';
type TabType = 'it' | 'biz' | 'all';

/** Groups items by a key that can map to multiple groups (e.g. process teams). */
function groupItems<T>(
  items: T[],
  getGroups: (item: T) => Array<{ key: string; label: string }>,
): Array<{ label: string; items: T[] }> {
  const map = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    for (const g of getGroups(item)) {
      if (!map.has(g.key)) map.set(g.key, { label: g.label, items: [] });
      map.get(g.key)!.items.push(item);
    }
  }
  return Array.from(map.values());
}

export function Team() {
  const state = useCurrentState();
  const teamMembers = state.teamMembers;
  const roles = state.roles;
  const countries = state.countries;
  const skills = state.skills;
  const squads = state.squads;
  const processTeams = state.processTeams;
  const { showToast } = useToast();
  
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);

  // N shortcut → open "Add member" form
  useEffect(() => {
    const handler = () => { setEditingMember(null); setIsMemberFormOpen(true); };
    window.addEventListener('keyboard:new', handler);
    return () => window.removeEventListener('keyboard:new', handler);
  }, []);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TeamMember | null>(null);
  const [isTimeOffOpen, setIsTimeOffOpen] = useState(false);
  const [timeOffMemberId, setTimeOffMemberId] = useState<string>();
  const [calendarMember, setCalendarMember] = useState<TeamMember | null>(null);
  
  // ── Unified filter + view state ────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [processTeamFilter, setProcessTeamFilter] = useState('');
  // IT-specific filters
  const [roleFilter, setRoleFilter] = useState('');
  const [squadFilter, setSquadFilter] = useState('');
  // Shared group-by and view mode
  const [groupBy, setGroupBy] = useState<GroupBy>('role');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  // Tab
  const [activeTab, setActiveTab] = useState<TabType>('it');
  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [massUpdateOpen, setMassUpdateOpen] = useState(false);

  // Business contact form / delete
  const [bizFormOpen, setBizFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<BusinessContact | null>(null);
  const [bizDeleteConfirm, setBizDeleteConfirm] = useState<BusinessContact | null>(null);

  const currentQuarter = useMemo(() => getCurrentQuarter(), []);

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredMembers = useMemo(() => teamMembers.filter(m => {
    const low = search.toLowerCase();
    if (low && !m.name.toLowerCase().includes(low)) return false;
    if (roleFilter && m.role !== roleFilter) return false;
    if (countryFilter && m.countryId !== countryFilter) return false;
    if (squadFilter && m.squadId !== squadFilter) return false;
    if (processTeamFilter && !(m.processTeamIds ?? []).includes(processTeamFilter)) return false;
    return true;
  }), [teamMembers, search, roleFilter, countryFilter, squadFilter, processTeamFilter]);

  const filteredContacts = useMemo(() => {
    const low = search.toLowerCase();
    return state.businessContacts.filter(c => {
      if (low && !c.name.toLowerCase().includes(low) &&
          !(c.department ?? '').toLowerCase().includes(low) &&
          !(c.title ?? '').toLowerCase().includes(low)) return false;
      if (countryFilter && c.countryId !== countryFilter) return false;
      if (processTeamFilter && !(c.processTeamIds ?? []).includes(processTeamFilter)) return false;
      return true;
    });
  }, [state.businessContacts, search, countryFilter, processTeamFilter]);

  // ── Group-by helpers ───────────────────────────────────────────────────────
  const getCountryInfo = (countryId: string) => {
    const country = countries.find(c => c.id === countryId);
    return country ? { name: country.name, flag: country.flag } : { name: countryId, flag: '🏳️' };
  };

  const getMemberGroups = (m: TeamMember) => {
    switch (groupBy) {
      case 'country': {
        const ci = getCountryInfo(m.countryId);
        return [{ key: m.countryId || 'none', label: `${ci.flag || '🏳️'} ${ci.name}` }];
      }
      case 'squad': {
        const sq = squads.find(s => s.id === m.squadId);
        return [{ key: m.squadId || 'none', label: sq?.name ?? 'No Squad' }];
      }
      case 'processTeam': {
        const pts = (m.processTeamIds ?? []).map(id => {
          const pt = processTeams.find(p => p.id === id);
          return { key: id, label: pt?.name ?? id };
        });
        return pts.length > 0 ? pts : [{ key: 'none', label: 'No Process Team' }];
      }
      case 'none':
        return [{ key: 'all', label: 'All IT Members' }];
      default: // 'role' | 'dept'
        return [{ key: m.role || 'none', label: m.role || '— Needs Setup —' }];
    }
  };

  const getContactGroups = (c: BusinessContact) => {
    switch (groupBy) {
      case 'country': {
        const ci = getCountryInfo(c.countryId);
        return [{ key: c.countryId || 'none', label: `${ci.flag || '🏳️'} ${ci.name}` }];
      }
      case 'processTeam': {
        const pts = (c.processTeamIds ?? []).map(id => {
          const pt = processTeams.find(p => p.id === id);
          return { key: id, label: pt?.name ?? id };
        });
        return pts.length > 0 ? pts : [{ key: 'none', label: 'No Process Team' }];
      }
      case 'none':
        return [{ key: 'all', label: 'All Business Contacts' }];
      default: // 'dept' | 'role'
        return [{ key: c.department || 'none', label: c.department || 'No Department' }];
    }
  };

  // ── Grouped member sets ────────────────────────────────────────────────────
  const needsEnrichmentMembers = teamMembers.filter(m => m.needsEnrichment);
  const [enrichmentMode, setEnrichmentMode] = useState(false);
  const displayMembers = enrichmentMode ? needsEnrichmentMembers : filteredMembers;
  const itGroups = useMemo(() => groupItems(displayMembers, getMemberGroups), [displayMembers, groupBy]);
  const bizGroups = useMemo(() => groupItems(filteredContacts.filter(c => !c.archived), getContactGroups), [filteredContacts, groupBy]);

  // ── Select helpers ─────────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelectedIds(new Set());
  const selectedMembers = teamMembers.filter(m => selectedIds.has(m.id));
  const selectedContacts = state.businessContacts.filter(c => selectedIds.has(c.id));

  // ── IT member actions ──────────────────────────────────────────────────────
  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setIsMemberFormOpen(true);
  };

  const handleDelete = (member: TeamMember) => {
    setDeleteConfirm(member);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const snapshotMembers  = JSON.parse(JSON.stringify(state.teamMembers));
    const snapshotProjects = JSON.parse(JSON.stringify(state.projects));
    const deleted = deleteConfirm;
    deleteTeamMember(deleteConfirm.id);
    setDeleteConfirm(null);
    showToast(`"${deleted.name}" deleted`, {
      type: 'warning',
      duration: 10000,
      action: {
        label: 'Undo',
        onClick: () => {
          useAppStore.getState().updateData({ teamMembers: snapshotMembers, projects: snapshotProjects });
          showToast('Delete undone', 'success');
        },
      },
    });
  };

  const handleAddTimeOff = (memberId: string) => {
    setTimeOffMemberId(memberId);
    setIsTimeOffOpen(true);
  };

  const handleCloseMemberForm = () => {
    setIsMemberFormOpen(false);
    setEditingMember(null);
  };

  const getMemberSkills = (skillIds: string[]) => {
    return skillIds.map(id => skills.find(s => s.id === id)?.name).filter(Boolean);
  };

  const getMemberTimeOff = (memberId: string) => state.timeOff.filter(t => t.memberId === memberId);

  // ── Filter option lists ────────────────────────────────────────────────────
  const roleOptions = [
    { value: '', label: 'All Roles' },
    ...roles.map(r => ({ value: r.name, label: r.name })),
  ];

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.map(c => ({ value: c.id, label: `${c.flag || '🏳️'} ${c.name}` })),
  ];

  const squadFilterOptions = [
    { value: '', label: 'All Squads' },
    ...squads.map(s => ({ value: s.id, label: s.name })),
  ];

  const processTeamFilterOptions = [
    { value: '', label: 'All Process Teams' },
    ...processTeams.map(pt => ({ value: pt.id, label: pt.name })),
  ];

  const groupByOptions: Array<{ value: GroupBy; label: string }> = [
    { value: 'role', label: 'Group: Role / Dept' },
    { value: 'country', label: 'Group: Country' },
    ...(activeTab === 'it' ? [{ value: 'squad' as GroupBy, label: 'Group: Squad' }] : []),
    ...(processTeams.length > 0 ? [{ value: 'processTeam' as GroupBy, label: 'Group: Process Teams' }] : []),
    { value: 'none', label: 'No Grouping' },
  ];

  const activeScenarioId = useAppStore(s => s.data.activeScenarioId);
  const activeScenario = useAppStore(s => s.data.scenarios.find(sc => sc.id === s.data.activeScenarioId));

  return (
    <div className="space-y-6">
      {/* Scenario isolation notice */}
      {activeScenarioId && activeScenario && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
          <GitBranch size={15} className="shrink-0 text-blue-500" />
          <span>
            <strong>Scenario: {activeScenario.name}</strong> — Team members and time off shown here are isolated to this scenario. Changes won't affect the baseline.
          </span>
        </div>
      )}
      <PageHeader
        title="Team"
        subtitle={
          activeTab === 'it' ? `${filteredMembers.length} members · ${countries.length} countries`
          : activeTab === 'biz' ? `${filteredContacts.filter(c => !c.archived).length} business contacts`
          : `${filteredMembers.length + filteredContacts.filter(c => !c.archived).length} people`
        }
        actions={
          activeTab === 'it' ? (
            <Button onClick={() => setIsMemberFormOpen(true)}>
              <Plus size={16} />
              Add Member
            </Button>
          ) : activeTab === 'biz' ? (
            <Button onClick={() => { setEditingContact(null); setBizFormOpen(true); }}>
              <Plus size={16} />
              Add Contact
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsMemberFormOpen(true)}>
                <Plus size={16} />IT Member
              </Button>
              <Button onClick={() => { setEditingContact(null); setBizFormOpen(true); }}>
                <Plus size={16} />Biz Contact
              </Button>
            </div>
          )
        }
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
        {([
          { id: 'it' as TabType, icon: Users, label: 'IT Members', count: teamMembers.length, activeColor: 'border-[#0089DD] text-[#0089DD]', badgeActive: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
          { id: 'biz' as TabType, icon: Building2, label: 'Business Contacts', count: state.businessContacts.filter(c => !c.archived).length, activeColor: 'border-purple-600 text-purple-600', badgeActive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
          { id: 'all' as TabType, icon: Users, label: 'All', count: teamMembers.length + state.businessContacts.filter(c => !c.archived).length, activeColor: 'border-slate-600 text-slate-700 dark:text-slate-200', badgeActive: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200' },
        ] as const).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive ? tab.activeColor : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={15} />
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? tab.badgeActive : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Unified filter bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'biz' ? 'Search contacts…' : 'Search members…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {(activeTab === 'it' || activeTab === 'all') && (
          <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} options={roleOptions} />
        )}
        <Select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} options={countryOptions} />
        {activeTab === 'it' && squads.length > 0 && (
          <Select value={squadFilter} onChange={e => setSquadFilter(e.target.value)} options={squadFilterOptions} />
        )}
        {processTeams.length > 0 && (
          <Select value={processTeamFilter} onChange={e => setProcessTeamFilter(e.target.value)} options={processTeamFilterOptions} />
        )}
        {/* Group-by */}
        <Select
          value={groupBy}
          onChange={e => setGroupBy(e.target.value as GroupBy)}
          options={groupByOptions}
        />
        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 transition-colors ${viewMode === 'card' ? 'bg-[#0089DD] text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title="Card view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[#0089DD] text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {activeTab === 'it' && <>

      {/* Enrichment banner — shown when Jira-imported members are missing role/country */}
      {needsEnrichmentMembers.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {needsEnrichmentMembers.length} team member{needsEnrichmentMembers.length !== 1 ? 's' : ''} imported from Jira need{needsEnrichmentMembers.length === 1 ? 's' : ''} a role and country set
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Without these, capacity calculations won't include them correctly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {enrichmentMode ? (
              <Button size="sm" variant="secondary" onClick={() => setEnrichmentMode(false)}>Show all</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEnrichmentMode(true)}>
                Set up now ({needsEnrichmentMembers.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Team List */}
      {displayMembers.length === 0 ? (
        <Card>
          <CardContent>
            {teamMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No team members yet"
                description="Add your team members to start planning capacity. Include their role, country, and skills for the best results."
                action={{ label: 'Add first team member', onClick: () => { setIsMemberFormOpen(true); setEditingMember(null); } }}
              />
            ) : (
              <EmptyState
                icon={Filter}
                title="No matches"
                description="No team members match your current filters. Try clearing a filter to see more results."
              />
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        /* ── Card grid view ─────────────────────────────────────────────── */
        <div className="space-y-6">
          {itGroups.map(({ label, items: members }) => (
            <div key={label}>
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                {label} ({members.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {members.map(member => {
                  const memberSkills = getMemberSkills(member.skillIds || []);
                  const countryInfo = getCountryInfo(member.countryId);
                  const timeOff = getMemberTimeOff(member.id);
                  
                  return (
                    <Card 
                      key={member.id} 
                      className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                                {member.name}
                              </h3>
                              {member.needsEnrichment && (
                                <button
                                  type="button"
                                  onClick={() => handleEdit(member)}
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                  title="Click to complete setup"
                                >
                                  <AlertTriangle size={12} />
                                  Setup
                                </button>
                              )}
                              {member.syncedFromJira && !member.needsEnrichment && (
                                <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded" title="Synced from Jira">
                                  Jira
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{countryInfo.flag}</span>
                              <span>{countryInfo.name}</span>
                            </p>
                            {member.email && (
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate" title={member.email}>
                                <Mail size={11} className="shrink-0" />
                                {member.email}
                              </p>
                            )}
                            {/* Squad + Process Teams */}
                            {(member.squadId || (member.processTeamIds ?? []).length > 0) && (
                              <div className="flex items-center flex-wrap gap-1 mt-1.5">
                                {member.squadId && (() => {
                                  const squad = squads.find(s => s.id === member.squadId);
                                  return squad ? (
                                    <span className="px-1.5 py-0 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded">
                                      {squad.name}
                                    </span>
                                  ) : null;
                                })()}
                                {(member.processTeamIds ?? []).map(ptId => {
                                  const pt = processTeams.find(p => p.id === ptId);
                                  return pt ? (
                                    <span key={ptId} className="px-1.5 py-0 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded">
                                      {pt.name}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => handleAddTimeOff(member.id)}
                              className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Manage Time Off"
                            >
                              <CalendarOff size={14} />
                            </button>
                            <button
                              onClick={() => setCalendarMember(member)}
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="View Availability Calendar"
                            >
                              <CalendarDays size={14} />
                            </button>
                            <button
                              onClick={() => handleEdit(member)}
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(member)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {/* Skills */}
                        {memberSkills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {memberSkills.slice(0, 4).map(skill => (
                              <span 
                                key={skill} 
                                className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                              >
                                {skill}
                              </span>
                            ))}
                            {memberSkills.length > 4 && (
                              <span className="px-2 py-0.5 text-xs text-slate-400">
                                +{memberSkills.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Time Off indicator */}
                        {timeOff.length > 0 && (() => {
                          const today = new Date().toISOString().split('T')[0];
                          const upcoming = timeOff
                            .filter(t => t.endDate >= today)
                            .sort((a, b) => a.startDate.localeCompare(b.startDate));
                          const next = upcoming[0];
                          const fmt = (d: string) =>
                            new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          return (
                            <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <CalendarOff size={12} />
                              {timeOff.length} absence{timeOff.length > 1 ? 's' : ''}
                              {next && (
                                <span className="text-amber-400 dark:text-amber-500">
                                  · Next: {fmt(next.startDate)}{next.startDate !== next.endDate ? `–${fmt(next.endDate)}` : ''}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        
                        {/* Max projects */}
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <p className="text-xs text-slate-400">
                            Max {member.maxConcurrentProjects} concurrent projects
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Compact list view ──────────────────────────────────────────── */
        <Card>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {/* Table header */}
            <div className="grid grid-cols-[24px_1fr_140px_140px_160px_auto] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
              <span />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Name</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Role</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Country</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Skills / Squad</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 text-right pr-1">Actions</span>
            </div>

            {itGroups.map(({ label, items: members }) => (
              <div key={label}>
                {/* Group header */}
                <div className="px-4 py-1.5 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700/40">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {label} · {members.length}
                  </span>
                </div>

                {members.map(member => {
                  const memberSkills = getMemberSkills(member.skillIds || []);
                  const countryInfo  = getCountryInfo(member.countryId);
                  const timeOff      = getMemberTimeOff(member.id);
                  const squad        = squads.find(s => s.id === member.squadId);

                  const today    = new Date().toISOString().split('T')[0];
                  const nextOff  = timeOff
                    .filter(t => t.endDate >= today)
                    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
                  const fmt = (d: string) =>
                    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                  // Avatar initials
                  const initials = member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={member.id}
                      className="grid grid-cols-[24px_1fr_140px_140px_160px_auto] gap-2 items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedIds.has(member.id)}
                        onChange={() => toggleSelect(member.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      {/* Name + badges */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#0089DD]/10 text-[#0089DD] text-[10px] font-bold flex items-center justify-center shrink-0 select-none">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{member.name}</span>
                            {member.needsEnrichment && (
                              <button
                                onClick={() => handleEdit(member)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-200 transition-colors"
                                title="Complete setup"
                              >
                                <AlertTriangle size={10} />Setup
                              </button>
                            )}
                            {member.syncedFromJira && !member.needsEnrichment && (
                              <span className="px-1 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">Jira</span>
                            )}
                          </div>
                          {member.email && (
                            <p className="text-[11px] text-slate-400 truncate">{member.email}</p>
                          )}
                          {nextOff && (
                            <p className="text-[10px] text-amber-500 flex items-center gap-0.5 mt-0.5">
                              <CalendarOff size={9} />
                              {fmt(nextOff.startDate)}{nextOff.startDate !== nextOff.endDate ? `–${fmt(nextOff.endDate)}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Role */}
                      <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{member.role || <span className="text-slate-300 dark:text-slate-600">—</span>}</span>

                      {/* Country */}
                      <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <span>{countryInfo.flag}</span>
                        <span className="truncate">{countryInfo.name || <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
                      </span>

                      {/* Skills / Squad */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {squad && (
                          <span className="px-1.5 py-0 text-[10px] font-medium bg-[#E8F4FB] text-[#0089DD] rounded shrink-0">{squad.name}</span>
                        )}
                        {memberSkills.slice(0, 2).map(skill => (
                          <span key={skill} className="px-1.5 py-0 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">{skill}</span>
                        ))}
                        {memberSkills.length > 2 && (
                          <span className="text-[10px] text-slate-400">+{memberSkills.length - 2}</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleAddTimeOff(member.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Manage Time Off"
                        >
                          <CalendarOff size={13} />
                        </button>
                        <button
                          onClick={() => setCalendarMember(member)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="View Availability Calendar"
                        >
                          <CalendarDays size={13} />
                        </button>
                        <button
                          onClick={() => handleEdit(member)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

      </> /* end activeTab === 'it' */}

      {/* ── Business Contacts Tab ─────────────────────────────────────────── */}
      {activeTab === 'biz' && (
        <div className="space-y-4">
          {filteredContacts.filter(c => !c.archived).length === 0 && filteredContacts.filter(c => c.archived).length === 0 ? (
            <Card>
              <CardContent>
                {state.businessContacts.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No business contacts yet"
                    description="Add business contacts to track their availability and effort on Jira items alongside IT capacity."
                    action={{ label: 'Add first contact', onClick: () => { setEditingContact(null); setBizFormOpen(true); } }}
                  />
                ) : (
                  <EmptyState icon={Filter} title="No matches" description="No contacts match your filters." />
                )}
              </CardContent>
            </Card>
          ) : viewMode === 'card' ? (
            <>
              {bizGroups.map(({ label, items }) => (
                <div key={label}>
                  <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                    {label} ({items.length})
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {items.map(contact => (
                      <BizContactCard
                        key={contact.id}
                        contact={contact}
                        currentQuarter={currentQuarter}
                        state={state}
                        countries={countries}
                        processTeams={processTeams}
                        onEdit={() => { setEditingContact(contact); setBizFormOpen(true); }}
                        onArchive={() => updateBusinessContact(contact.id, { archived: true })}
                        onDelete={() => setBizDeleteConfirm(contact)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {/* Archived */}
              {filteredContacts.filter(c => c.archived).length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">
                    Archived ({filteredContacts.filter(c => c.archived).length})
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                    {filteredContacts.filter(c => c.archived).map(contact => (
                      <BizContactCard
                        key={contact.id} contact={contact} currentQuarter={currentQuarter}
                        state={state} countries={countries} processTeams={processTeams}
                        onEdit={() => { setEditingContact(contact); setBizFormOpen(true); }}
                        onArchive={() => updateBusinessContact(contact.id, { archived: false })}
                        onDelete={() => setBizDeleteConfirm(contact)}
                        isArchived
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── Biz list view ── */
            <Card>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                <div className="grid grid-cols-[24px_1fr_180px_140px_200px_auto] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
                  <span />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Name</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Title / Dept</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Country</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Process Teams</span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 text-right pr-1">Actions</span>
                </div>
                {bizGroups.map(({ label, items }) => (
                  <div key={label}>
                    <div className="px-4 py-1.5 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700/40">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label} · {items.length}</span>
                    </div>
                    {items.map(contact => {
                      const ci = getCountryInfo(contact.countryId);
                      const initials = contact.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <div key={contact.id} className="grid grid-cols-[24px_1fr_180px_140px_200px_auto] gap-2 items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(contact.id)}
                            onChange={() => toggleSelect(contact.id)}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate block">{contact.name}</span>
                              {contact.email && <span className="text-[11px] text-slate-400 truncate block">{contact.email}</span>}
                            </div>
                          </div>
                          <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{contact.title ?? contact.department ?? <span className="text-slate-300 dark:text-slate-600">—</span>}</span>
                          <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <span>{ci.flag}</span><span className="truncate">{ci.name}</span>
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {(contact.processTeamIds ?? []).map(ptId => {
                              const pt = processTeams.find(p => p.id === ptId);
                              return pt ? (
                                <span key={ptId} className="px-1.5 py-0 text-[10px] font-medium bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded">{pt.name}</span>
                              ) : null;
                            })}
                          </div>
                          <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingContact(contact); setBizFormOpen(true); }} className="p-1.5 text-slate-400 hover:text-purple-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title="Edit"><Edit2 size={13} /></button>
                            <button onClick={() => updateBusinessContact(contact.id, { archived: true })} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title="Archive"><Archive size={13} /></button>
                            <button onClick={() => setBizDeleteConfirm(contact)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded" title="Remove"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── All Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'all' && (() => {
        const activeMembers = filteredMembers;
        const activeContacts = filteredContacts.filter(c => !c.archived);

        if (activeMembers.length === 0 && activeContacts.length === 0) {
          return (
            <Card><CardContent>
              <EmptyState icon={Users} title="No matches" description="No team members or business contacts match your current filters." />
            </CardContent></Card>
          );
        }

        const allGroups = (() => {
          const map = new Map<string, { label: string; members: TeamMember[]; contacts: BusinessContact[] }>();
          for (const m of activeMembers) {
            for (const g of getMemberGroups(m)) {
              if (!map.has(g.key)) map.set(g.key, { label: g.label, members: [], contacts: [] });
              map.get(g.key)!.members.push(m);
            }
          }
          for (const c of activeContacts) {
            for (const g of getContactGroups(c)) {
              if (!map.has(g.key)) map.set(g.key, { label: g.label, members: [], contacts: [] });
              map.get(g.key)!.contacts.push(c);
            }
          }
          return Array.from(map.values());
        })();

        return (
          <div className="space-y-6">
            {allGroups.map(({ label, members, contacts }) => (
              <div key={label}>
                <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                  {label} ({members.length + contacts.length})
                </h2>
                {viewMode === 'card' ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {members.map(member => {
                      const memberSkills = getMemberSkills(member.skillIds || []);
                      const countryInfo = getCountryInfo(member.countryId);
                      return (
                        <Card key={member.id} className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 dark:text-white truncate text-sm">{member.name}</span>
                                  <span className="text-[9px] font-bold tracking-wide uppercase px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-500 border border-blue-100 dark:border-blue-800 shrink-0">IT</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{member.role || '—'}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">{countryInfo.flag} {countryInfo.name}</p>
                                {memberSkills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {memberSkills.slice(0, 3).map(s => <span key={s} className="px-1.5 py-0 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 rounded">{s}</span>)}
                                    {memberSkills.length > 3 && <span className="text-[10px] text-slate-400">+{memberSkills.length - 3}</span>}
                                  </div>
                                )}
                              </div>
                              <button onClick={() => handleEdit(member)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><Edit2 size={13} /></button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {contacts.map(contact => (
                      <BizContactCard
                        key={contact.id} contact={contact} currentQuarter={currentQuarter}
                        state={state} countries={countries} processTeams={processTeams}
                        onEdit={() => { setEditingContact(contact); setBizFormOpen(true); }}
                        onArchive={() => updateBusinessContact(contact.id, { archived: true })}
                        onDelete={() => setBizDeleteConfirm(contact)}
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      <div className="grid grid-cols-[24px_1fr_140px_140px_160px_auto] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
                        <span /><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Name</span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Role / Title</span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Country</span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Process Teams</span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 text-right pr-1">Actions</span>
                      </div>
                      {members.map(m => {
                        const ci = getCountryInfo(m.countryId);
                        const initials = m.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                        return (
                          <div key={m.id} className="grid grid-cols-[24px_1fr_140px_140px_160px_auto] gap-2 items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                            <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelect(m.id)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0">{initials}</div>
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate block">{m.name}</span>
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-500 border border-blue-100">IT</span>
                              </div>
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{m.role || '—'}</span>
                            <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1"><span>{ci.flag}</span><span className="truncate">{ci.name}</span></span>
                            <div className="flex flex-wrap gap-1">
                              {(m.processTeamIds ?? []).map(ptId => {
                                const pt = processTeams.find(p => p.id === ptId);
                                return pt ? <span key={ptId} className="px-1.5 py-0 text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded">{pt.name}</span> : null;
                              })}
                            </div>
                            <div className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(m)} className="p-1.5 text-slate-400 hover:text-blue-500 rounded"><Edit2 size={13} /></button>
                            </div>
                          </div>
                        );
                      })}
                      {contacts.map(c => {
                        const ci = getCountryInfo(c.countryId);
                        const initials = c.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                        return (
                          <div key={c.id} className="grid grid-cols-[24px_1fr_140px_140px_160px_auto] gap-2 items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                            <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer" />
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0">{initials}</div>
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate block">{c.name}</span>
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-500 border border-purple-100">BIZ</span>
                              </div>
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{c.title ?? c.department ?? '—'}</span>
                            <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1"><span>{ci.flag}</span><span className="truncate">{ci.name}</span></span>
                            <div className="flex flex-wrap gap-1">
                              {(c.processTeamIds ?? []).map(ptId => {
                                const pt = processTeams.find(p => p.id === ptId);
                                return pt ? <span key={ptId} className="px-1.5 py-0 text-[10px] bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded">{pt.name}</span> : null;
                              })}
                            </div>
                            <div className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingContact(c); setBizFormOpen(true); }} className="p-1.5 text-slate-400 hover:text-purple-500 rounded"><Edit2 size={13} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Business Contact Form Modal */}
      {bizFormOpen && (
        <BizContactFormModal
          contact={editingContact}
          countries={countries}
          processTeams={processTeams}
          onSave={data => {
            if (editingContact) {
              updateBusinessContact(editingContact.id, data);
            } else {
              addBusinessContact(data);
            }
            setBizFormOpen(false);
            setEditingContact(null);
          }}
          onClose={() => { setBizFormOpen(false); setEditingContact(null); }}
        />
      )}

      {/* Business Contact Delete Confirmation */}
      <Modal
        isOpen={!!bizDeleteConfirm}
        onClose={() => setBizDeleteConfirm(null)}
        title="Remove Business Contact"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBizDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => {
              if (bizDeleteConfirm) { deleteBusinessContact(bizDeleteConfirm.id); setBizDeleteConfirm(null); }
            }}>Remove</Button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">
          Are you sure you want to remove <strong>{bizDeleteConfirm?.name}</strong>? This will also remove their capacity assignments.
        </p>
      </Modal>

      {/* Team Member Form Modal */}
      <TeamMemberForm
        isOpen={isMemberFormOpen}
        onClose={handleCloseMemberForm}
        member={editingMember}
      />

      {/* Time Off Form Modal */}
      <TimeOffForm
        isOpen={isTimeOffOpen}
        onClose={() => setIsTimeOffOpen(false)}
        memberId={timeOffMemberId}
      />

      {/* Member Availability Calendar (US-033) */}
      <MemberCalendarModal
        isOpen={!!calendarMember}
        onClose={() => setCalendarMember(null)}
        member={calendarMember}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Team Member"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          This will also remove all their project assignments. You can undo for 10 seconds after deletion.
        </p>
      </Modal>

      {/* ── Bulk action bar ────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl shadow-2xl">
          <CheckSquare size={16} className="text-blue-400 dark:text-blue-600" />
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="w-px h-5 bg-slate-700 dark:bg-slate-300 mx-1" />
          <button
            onClick={() => setMassUpdateOpen(true)}
            className="text-sm font-medium text-blue-400 dark:text-blue-600 hover:text-blue-300 dark:hover:text-blue-700 transition-colors"
          >
            Bulk edit
          </button>
          <button
            onClick={clearSelection}
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-900 rounded transition-colors"
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Mass Update Modal */}
      {massUpdateOpen && (
        <MassUpdateModal
          selectedMembers={selectedMembers}
          selectedContacts={selectedContacts}
          processTeams={processTeams}
          countries={countries}
          onSave={({ memberUpdates, contactUpdates, arrayMode }) => {
            if (memberUpdates && selectedMembers.length > 0) {
              bulkUpdateTeamMembers(selectedMembers.map(m => m.id), memberUpdates, arrayMode);
            }
            if (contactUpdates && selectedContacts.length > 0) {
              bulkUpdateBusinessContacts(selectedContacts.map(c => c.id), contactUpdates, arrayMode);
            }
            setMassUpdateOpen(false);
            clearSelection();
            showToast(`Updated ${selectedIds.size} ${selectedIds.size === 1 ? 'person' : 'people'}`, 'success');
          }}
          onClose={() => setMassUpdateOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Business Contact Card ────────────────────────────────────────────────────

function BizContactCard({
  contact, currentQuarter, state, countries, processTeams,
  onEdit, onArchive, onDelete, isArchived = false,
}: {
  contact: BusinessContact;
  currentQuarter: string;
  state: ReturnType<typeof useCurrentState>;
  countries: ReturnType<typeof useCurrentState>['countries'];
  processTeams: ProcessTeam[];
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isArchived?: boolean;
}) {
  const country = countries.find(c => c.id === contact.countryId);
  const cap = useMemo(() => calculateBusinessCapacityForQuarter(
    contact, currentQuarter,
    state.businessAssignments, state.businessTimeOff, state.publicHolidays, state.projects,
    state.jiraItemBizAssignments, state.jiraWorkItems
  ), [contact, currentQuarter, state]);

  const pct = cap.usedPercent;
  const isOver = pct >= 100;
  const isWarn = pct >= 80 && !isOver;

  const initials = contact.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card className={`hover:border-purple-300 dark:hover:border-purple-700 transition-colors ${isArchived ? 'opacity-70' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400 shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{contact.name}</span>
                <span className="text-[9px] font-bold tracking-wide uppercase px-1 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-500 border border-purple-100 dark:border-purple-800 shrink-0">BIZ</span>
              </div>
              {(contact.title || contact.department) && (
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{contact.title ?? contact.department}</p>
              )}
              {contact.email && (
                <p className="text-xs text-slate-400 flex items-center gap-1 truncate mt-0.5">
                  <Mail size={10} className="shrink-0" />{contact.email}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 ml-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-purple-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Edit">
              <Edit2 size={13} />
            </button>
            <button onClick={onArchive} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title={isArchived ? 'Unarchive' : 'Archive'}>
              {isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
            </button>
            <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Remove">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Process team chips */}
        {(contact.processTeamIds ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(contact.processTeamIds ?? []).map(ptId => {
              const pt = processTeams.find(p => p.id === ptId);
              return pt ? (
                <span key={ptId} className="px-1.5 py-0 text-[10px] font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800 rounded">
                  {pt.name}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Country + capacity row */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            {country ? `${country.flag || '🏳️'} ${country.name}` : '—'}
          </span>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
            isOver ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            : isWarn ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
            : pct > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : 'bg-slate-50 dark:bg-slate-700/40 text-slate-400'
          }`} title={`${currentQuarter} · ${cap.allocatedDays.toFixed(1)}d allocated of ${cap.availableDays.toFixed(1)}d available`}>
            {pct > 0 ? `${pct}% · ${currentQuarter}` : `Free · ${currentQuarter}`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mass Update Modal ────────────────────────────────────────────────────────

function MassUpdateModal({
  selectedMembers, selectedContacts, processTeams, countries, onSave, onClose,
}: {
  selectedMembers: TeamMember[];
  selectedContacts: BusinessContact[];
  processTeams: ProcessTeam[];
  countries: ReturnType<typeof useCurrentState>['countries'];
  onSave: (opts: { memberUpdates?: Partial<TeamMember>; contactUpdates?: Partial<BusinessContact>; arrayMode: 'replace' | 'add' }) => void;
  onClose: () => void;
}) {
  const hasMix = selectedMembers.length > 0 && selectedContacts.length > 0;
  const onlyMembers = selectedMembers.length > 0 && selectedContacts.length === 0;
  const onlyContacts = selectedContacts.length > 0 && selectedMembers.length === 0;

  // Common fields (always shown)
  const [countryId, setCountryId] = useState('');
  const [processTeamIds, setProcessTeamIds] = useState<string[]>([]);
  const [ptMode, setPtMode] = useState<'add' | 'replace'>('add');

  // IT-member-only fields
  const [bauDays, setBauDays] = useState('');

  // Biz-contact-only fields
  const [bizBauDays, setBizBauDays] = useState('');
  const [department, setDepartment] = useState('');

  const togglePt = (id: string) =>
    setProcessTeamIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const fieldClass = "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1";

  const handleSave = () => {
    const arrayMode: 'add' | 'replace' = ptMode;
    const memberUpdates: Partial<TeamMember> = {};
    const contactUpdates: Partial<BusinessContact> = {};

    if (countryId) {
      memberUpdates.countryId = countryId;
      contactUpdates.countryId = countryId;
    }
    if (processTeamIds.length > 0) {
      memberUpdates.processTeamIds = processTeamIds;
      contactUpdates.processTeamIds = processTeamIds;
    }
    if (bauDays && !isNaN(parseFloat(bauDays))) {
      (memberUpdates as Record<string, unknown>).bauDays = parseFloat(bauDays);
    }
    if (bizBauDays && !isNaN(parseFloat(bizBauDays))) {
      contactUpdates.bauReserveDays = parseFloat(bizBauDays);
    }
    if (department) {
      contactUpdates.department = department;
    }

    onSave({
      memberUpdates: (onlyContacts || Object.keys(memberUpdates).length === 0) ? undefined : memberUpdates,
      contactUpdates: (onlyMembers || Object.keys(contactUpdates).length === 0) ? undefined : contactUpdates,
      arrayMode,
    });
  };

  const title = hasMix
    ? `Edit ${selectedMembers.length + selectedContacts.length} people`
    : onlyMembers
    ? `Edit ${selectedMembers.length} IT member${selectedMembers.length !== 1 ? 's' : ''}`
    : `Edit ${selectedContacts.length} business contact${selectedContacts.length !== 1 ? 's' : ''}`;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Apply changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Only fields you fill in will be updated. Leave blank to keep existing values.
        </p>

        {/* Country */}
        <div>
          <label className={labelClass}>Country</label>
          <select className={fieldClass} value={countryId} onChange={e => setCountryId(e.target.value)}>
            <option value="">— no change —</option>
            {countries.map(c => <option key={c.id} value={c.id}>{c.flag || '🏳️'} {c.name}</option>)}
          </select>
        </div>

        {/* Process teams */}
        {processTeams.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass + ' mb-0'}>Process teams</label>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="ptMode" value="add" checked={ptMode === 'add'} onChange={() => setPtMode('add')} className="text-blue-600" />
                  Add
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="ptMode" value="replace" checked={ptMode === 'replace'} onChange={() => setPtMode('replace')} className="text-blue-600" />
                  Replace
                </label>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {processTeams.map(pt => {
                const active = processTeamIds.includes(pt.id);
                return (
                  <button
                    key={pt.id} type="button" onClick={() => togglePt(pt.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-blue-400'
                    }`}
                  >{pt.name}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* IT member BAU — hidden for biz-only selection */}
        {!onlyContacts && (
          <div>
            <label className={labelClass}>IT member BAU (days/qtr)</label>
            <input className={fieldClass} type="number" min={0} placeholder="— no change —" value={bauDays} onChange={e => setBauDays(e.target.value)} />
          </div>
        )}

        {/* Biz contact fields — hidden for IT-only selection */}
        {!onlyMembers && (
          <>
            <div>
              <label className={labelClass}>BAU reserve (days/qtr)</label>
              <input className={fieldClass} type="number" min={0} placeholder="— no change —" value={bizBauDays} onChange={e => setBizBauDays(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <input className={fieldClass} placeholder="— no change —" value={department} onChange={e => setDepartment(e.target.value)} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Business Contact Form Modal ──────────────────────────────────────────────

function BizContactFormModal({
  contact, countries, processTeams, onSave, onClose,
}: {
  contact: BusinessContact | null;
  countries: ReturnType<typeof useCurrentState>['countries'];
  processTeams: ProcessTeam[];
  onSave: (data: Omit<BusinessContact, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(contact?.name ?? '');
  const [title, setTitle] = useState(contact?.title ?? '');
  const [department, setDepartment] = useState(contact?.department ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [countryId, setCountryId] = useState(contact?.countryId ?? '');
  const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState(String(contact?.workingDaysPerWeek ?? 5));
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(String(contact?.workingHoursPerDay ?? 8));
  const [bauReserveDays, setBauReserveDays] = useState(String(contact?.bauReserveDays ?? 5));
  const [selectedProcessTeamIds, setSelectedProcessTeamIds] = useState<string[]>(contact?.processTeamIds ?? []);

  const toggleProcessTeam = (id: string) =>
    setSelectedProcessTeamIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const isValid = name.trim().length > 0 && countryId.length > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      name: name.trim(),
      title: title.trim() || undefined,
      department: department.trim() || undefined,
      email: email.trim() || undefined,
      countryId,
      workingDaysPerWeek: parseFloat(workingDaysPerWeek) || 5,
      workingHoursPerDay: parseFloat(workingHoursPerDay) || 8,
      bauReserveDays: parseFloat(bauReserveDays) || 5,
      processTeamIds: selectedProcessTeamIds,
      archived: contact?.archived ?? false,
      projectIds: contact?.projectIds ?? [],
    });
  };

  const fieldClass = "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500";
  const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={contact ? 'Edit Business Contact' : 'Add Business Contact'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40"
          >
            {contact ? 'Save changes' : 'Add contact'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Full name *</label>
          <input className={fieldClass} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Smith" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Job title</label>
            <input className={fieldClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Finance Manager" />
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <input className={fieldClass} value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Finance" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input className={fieldClass} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane.smith@mileway.com" />
        </div>
        <div>
          <label className={labelClass}>Country *</label>
          <select className={fieldClass} value={countryId} onChange={e => setCountryId(e.target.value)}>
            <option value="">Select country…</option>
            {countries.map(c => (
              <option key={c.id} value={c.id}>{c.flag || '🏳️'} {c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Working days / week</label>
            <input className={fieldClass} type="number" min={1} max={7} step={0.5} value={workingDaysPerWeek} onChange={e => setWorkingDaysPerWeek(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Working hours / day</label>
            <input className={fieldClass} type="number" min={1} max={24} step={0.5} value={workingHoursPerDay} onChange={e => setWorkingHoursPerDay(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>BAU reserve (days/qtr)</label>
            <input className={fieldClass} type="number" min={0} max={65} step={1} value={bauReserveDays} onChange={e => setBauReserveDays(e.target.value)} />
          </div>
        </div>
        {processTeams.length > 0 && (
          <div>
            <label className={labelClass}>Process teams</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {processTeams.map(pt => {
                const active = selectedProcessTeamIds.includes(pt.id);
                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => toggleProcessTeam(pt.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-purple-400'
                    }`}
                  >
                    {pt.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
