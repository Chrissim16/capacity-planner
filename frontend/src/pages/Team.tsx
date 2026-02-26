import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, CalendarOff, Users, AlertTriangle, Mail, Filter, CalendarDays, GitBranch, LayoutGrid, List, Building2, Archive, ArchiveRestore } from 'lucide-react';
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
import { deleteTeamMember, addBusinessContact, updateBusinessContact, deleteBusinessContact } from '../stores/actions';
import { useToast } from '../components/ui/Toast';
import { calculateBusinessCapacityForQuarter } from '../utils/capacity';
import { getCurrentQuarter } from '../utils/calendar';
import type { TeamMember, BusinessContact } from '../types';

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
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [squadFilter, setSquadFilter] = useState('');
  const [processTeamFilter, setProcessTeamFilter] = useState('');

  // Filter team members
  const filteredMembers = teamMembers.filter(member => {
    if (search && !member.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && member.role !== roleFilter) return false;
    if (countryFilter && member.countryId !== countryFilter) return false;
    if (squadFilter && member.squadId !== squadFilter) return false;
    if (processTeamFilter && !(member.processTeamIds ?? []).includes(processTeamFilter)) return false;
    return true;
  });

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

  const getCountryInfo = (countryId: string) => {
    const country = countries.find(c => c.id === countryId);
    return country ? { name: country.name, flag: country.flag } : { name: countryId, flag: '🏳️' };
  };

  const getMemberSkills = (skillIds: string[]) => {
    return skillIds.map(id => skills.find(s => s.id === id)?.name).filter(Boolean);
  };

  // Get time off for a member
  const getMemberTimeOff = (memberId: string) => {
    return state.timeOff.filter(t => t.memberId === memberId);
  };

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

  const activeScenarioId = useAppStore(s => s.data.activeScenarioId);
  const activeScenario = useAppStore(s => s.data.scenarios.find(sc => sc.id === s.data.activeScenarioId));

  // Tab switcher: IT Members vs Business Contacts
  const [activeTab, setActiveTab] = useState<'it' | 'biz'>('it');

  // Business contacts state
  const [bizFormOpen, setBizFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<BusinessContact | null>(null);
  const [bizSearch, setBizSearch] = useState('');
  const [bizDeleteConfirm, setBizDeleteConfirm] = useState<BusinessContact | null>(null);

  const currentQuarter = useMemo(() => getCurrentQuarter(), []);

  const filteredContacts = useMemo(() => {
    const lower = bizSearch.toLowerCase();
    return state.businessContacts.filter(c =>
      !lower || c.name.toLowerCase().includes(lower) ||
      (c.department ?? '').toLowerCase().includes(lower) ||
      (c.title ?? '').toLowerCase().includes(lower)
    );
  }, [state.businessContacts, bizSearch]);

  // View mode: card grid or compact list
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Members needing enrichment (imported from Jira but missing role/country)
  const needsEnrichmentMembers = teamMembers.filter(m => m.needsEnrichment);
  const [enrichmentMode, setEnrichmentMode] = useState(false);


  // In enrichment mode, override filters to show only needing-enrichment members
  const displayMembers = enrichmentMode
    ? needsEnrichmentMembers
    : filteredMembers;

  // Group members by role
  const membersByRole = displayMembers.reduce((acc, member) => {
    const key = member.role || '— Needs Setup —';
    if (!acc[key]) acc[key] = [];
    acc[key].push(member);
    return acc;
  }, {} as Record<string, TeamMember[]>);

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
        subtitle={activeTab === 'it'
          ? `${filteredMembers.length} members · ${countries.length} countries · VS Finance`
          : `${filteredContacts.length} business contacts`}
        actions={
          activeTab === 'it' ? (
            <Button onClick={() => setIsMemberFormOpen(true)}>
              <Plus size={16} />
              Add Member
            </Button>
          ) : (
            <Button onClick={() => { setEditingContact(null); setBizFormOpen(true); }}>
              <Plus size={16} />
              Add Contact
            </Button>
          )
        }
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('it')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'it'
              ? 'border-[#0089DD] text-[#0089DD]'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users size={15} />
          IT Members
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'it' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
            {teamMembers.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('biz')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'biz'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Building2 size={15} />
          Business Contacts
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'biz' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
            {state.businessContacts.filter(c => !c.archived).length}
          </span>
        </button>
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
              <Button size="sm" variant="secondary" onClick={() => setEnrichmentMode(false)}>
                Show all
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEnrichmentMode(true)}>
                Set up now ({needsEnrichmentMembers.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search team members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={roleOptions}
        />
        <Select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          options={countryOptions}
        />
        {squads.length > 0 && (
          <Select
            value={squadFilter}
            onChange={(e) => setSquadFilter(e.target.value)}
            options={squadFilterOptions}
          />
        )}
        {processTeams.length > 0 && (
          <Select
            value={processTeamFilter}
            onChange={(e) => setProcessTeamFilter(e.target.value)}
            options={processTeamFilterOptions}
          />
        )}
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
          {Object.entries(membersByRole).map(([role, members]) => (
            <div key={role}>
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                {role} ({members.length})
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
            <div className="grid grid-cols-[1fr_140px_140px_160px_auto] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Name</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Role</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Country</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Skills / Squad</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 text-right pr-1">Actions</span>
            </div>

            {Object.entries(membersByRole).map(([role, members]) => (
              <div key={role}>
                {/* Role group header */}
                <div className="px-4 py-1.5 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700/40">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {role} · {members.length}
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
                      className="grid grid-cols-[1fr_140px_140px_160px_auto] gap-2 items-center px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                    >
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
          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search business contacts…"
                value={bizSearch}
                onChange={e => setBizSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {filteredContacts.length === 0 ? (
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
                  <EmptyState
                    icon={Filter}
                    title="No matches"
                    description="No contacts match your search."
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Active contacts */}
              {filteredContacts.filter(c => !c.archived).length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                    Active ({filteredContacts.filter(c => !c.archived).length})
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {filteredContacts.filter(c => !c.archived).map(contact => (
                      <BizContactCard
                        key={contact.id}
                        contact={contact}
                        currentQuarter={currentQuarter}
                        state={state}
                        countries={countries}
                        onEdit={() => { setEditingContact(contact); setBizFormOpen(true); }}
                        onArchive={() => updateBusinessContact(contact.id, { archived: true })}
                        onDelete={() => setBizDeleteConfirm(contact)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {/* Archived contacts */}
              {filteredContacts.filter(c => c.archived).length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">
                    Archived ({filteredContacts.filter(c => c.archived).length})
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                    {filteredContacts.filter(c => c.archived).map(contact => (
                      <BizContactCard
                        key={contact.id}
                        contact={contact}
                        currentQuarter={currentQuarter}
                        state={state}
                        countries={countries}
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
          )}
        </div>
      )}

      {/* Business Contact Form Modal */}
      {bizFormOpen && (
        <BizContactFormModal
          contact={editingContact}
          countries={countries}
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
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-slate-600 dark:text-slate-300">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
          This will also remove all their project assignments. You can undo for 10 seconds after deletion.
        </p>
      </Modal>
    </div>
  );
}

// ─── Business Contact Card ────────────────────────────────────────────────────

function BizContactCard({
  contact, currentQuarter, state, countries,
  onEdit, onArchive, onDelete, isArchived = false,
}: {
  contact: BusinessContact;
  currentQuarter: string;
  state: ReturnType<typeof useCurrentState>;
  countries: ReturnType<typeof useCurrentState>['countries'];
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

// ─── Business Contact Form Modal ──────────────────────────────────────────────

function BizContactFormModal({
  contact, countries, onSave, onClose,
}: {
  contact: BusinessContact | null;
  countries: ReturnType<typeof useCurrentState>['countries'];
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Working days / week</label>
            <input className={fieldClass} type="number" min={1} max={7} step={0.5} value={workingDaysPerWeek} onChange={e => setWorkingDaysPerWeek(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Working hours / day</label>
            <input className={fieldClass} type="number" min={1} max={24} step={0.5} value={workingHoursPerDay} onChange={e => setWorkingHoursPerDay(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
