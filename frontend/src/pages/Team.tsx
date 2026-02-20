import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, CalendarOff, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { TeamMemberForm } from '../components/forms/TeamMemberForm';
import { TimeOffForm } from '../components/forms/TimeOffForm';
import { useCurrentState } from '../stores/appStore';
import { deleteTeamMember } from '../stores/actions';
import { useToast } from '../components/ui/Toast';
import type { TeamMember } from '../types';

export function Team() {
  const state = useCurrentState();
  const teamMembers = state.teamMembers;
  const roles = state.roles;
  const countries = state.countries;
  const skills = state.skills;
  const { showToast } = useToast();
  
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TeamMember | null>(null);
  const [isTimeOffOpen, setIsTimeOffOpen] = useState(false);
  const [timeOffMemberId, setTimeOffMemberId] = useState<string>();
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');

  // Filter team members
  const filteredMembers = teamMembers.filter(member => {
    if (search && !member.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && member.role !== roleFilter) return false;
    if (countryFilter && member.countryId !== countryFilter) return false;
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
    if (deleteConfirm) {
      deleteTeamMember(deleteConfirm.id);
      setDeleteConfirm(null);
      showToast('Team member deleted', 'success');
    }
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

  // Group members by role
  const membersByRole = filteredMembers.reduce((acc, member) => {
    if (!acc[member.role]) acc[member.role] = [];
    acc[member.role].push(member);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {filteredMembers.length} team member{filteredMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setIsMemberFormOpen(true)}>
          <Plus size={16} />
          Add Member
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
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
      </div>

      {/* Team List */}
      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              {teamMembers.length === 0 
                ? 'No team members yet. Add your first team member to get started.'
                : 'No team members match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
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
                                <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded" title="Needs country and role">
                                  <AlertTriangle size={12} />
                                  Setup
                                </span>
                              )}
                              {member.syncedFromJira && !member.needsEnrichment && (
                                <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded" title="Synced from Jira">
                                  Jira
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{countryInfo.flag}</span>
                              <span>{countryInfo.name}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => handleAddTimeOff(member.id)}
                              className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Manage Time Off"
                            >
                              <CalendarOff size={14} />
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
                        {timeOff.length > 0 && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                            <CalendarOff size={12} />
                            {timeOff.length} quarter{timeOff.length > 1 ? 's' : ''} with time off
                          </div>
                        )}
                        
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
      )}

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
          This will also remove all their project assignments. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
