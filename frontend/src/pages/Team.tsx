import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, CalendarOff, Users, UserPlus } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { TeamMemberForm } from '../components/forms/TeamMemberForm';
import { TimeOffForm } from '../components/forms/TimeOffForm';
import { AssignmentModal } from '../components/forms/AssignmentModal';
import { useAppStore } from '../stores/appStore';
import { deleteTeamMember } from '../stores/actions';
import { calculateCapacity } from '../utils/capacity';
import { useToast } from '../components/ui/Toast';
import type { TeamMember } from '../types';

export function Team() {
  const state = useAppStore((s) => s.getCurrentState());
  const teamMembers = state.teamMembers;
  const roles = state.roles;
  const countries = state.countries;
  const quarters = state.quarters;
  const skills = state.skills;
  
  const { showToast } = useToast();
  
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TeamMember | null>(null);
  const [isTimeOffOpen, setIsTimeOffOpen] = useState(false);
  const [timeOffMemberId, setTimeOffMemberId] = useState<string>();
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [assignmentMemberId, setAssignmentMemberId] = useState<string>();
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState(quarters[0] || '');

  // Calculate capacity for all members
  const memberCapacities = useMemo(() => {
    return teamMembers.map(member => ({
      member,
      capacity: calculateCapacity(member.id, selectedQuarter, state),
    }));
  }, [state, teamMembers, selectedQuarter]);

  // Filter team members
  const filteredMembers = memberCapacities.filter(({ member }) => {
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

  const handleAssign = (memberId: string) => {
    setAssignmentMemberId(memberId);
    setIsAssignmentOpen(true);
  };

  const handleAddTimeOff = (memberId: string) => {
    setTimeOffMemberId(memberId);
    setIsTimeOffOpen(true);
  };

  const handleCloseMemberForm = () => {
    setIsMemberFormOpen(false);
    setEditingMember(null);
  };

  const getCountryName = (countryId: string) => {
    return countries.find(c => c.id === countryId)?.name || countryId;
  };

  const getMemberSkills = (skillIds: string[]) => {
    return skillIds.map(id => skills.find(s => s.id === id)?.name).filter(Boolean);
  };

  const roleOptions = [
    { value: '', label: 'All Roles' },
    ...roles.map(r => ({ value: r.name, label: r.name })),
  ];

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...countries.map(c => ({ value: c.id, label: c.name })),
  ];

  const quarterOptions = quarters.map(q => ({ value: q, label: q }));

  // Statistics
  const stats = useMemo(() => {
    const overAllocated = memberCapacities.filter(m => m.capacity.usedPercent > 100).length;
    const available = memberCapacities.filter(m => m.capacity.usedPercent < 80).length;
    return { total: teamMembers.length, overAllocated, available };
  }, [memberCapacities, teamMembers.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {stats.total} members • {stats.available} available • {stats.overAllocated} over-allocated
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            options={quarterOptions}
          />
          <Button onClick={() => setIsMemberFormOpen(true)}>
            <Plus size={16} />
            Add Member
          </Button>
        </div>
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
        <div className="grid gap-4">
          {filteredMembers.map(({ member, capacity }) => {
            const memberSkills = getMemberSkills(member.skillIds || []);
            
            return (
              <Card 
                key={member.id} 
                className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                          {member.name}
                        </h3>
                        <Badge variant="default">{member.role}</Badge>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {getCountryName(member.countryId)}
                        </span>
                      </div>
                      {memberSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {memberSkills.slice(0, 5).map(skill => (
                            <span 
                              key={skill} 
                              className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded"
                            >
                              {skill}
                            </span>
                          ))}
                          {memberSkills.length > 5 && (
                            <span className="px-2 py-0.5 text-xs text-slate-400">
                              +{memberSkills.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAssign(member.id)}
                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Assign to Project"
                      >
                        <UserPlus size={16} />
                      </button>
                      <button
                        onClick={() => handleAddTimeOff(member.id)}
                        className="p-2 text-slate-400 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Add Time Off"
                      >
                        <CalendarOff size={16} />
                      </button>
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Capacity Bar */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <ProgressBar progress={Math.min(capacity.usedPercent, 100)} status={capacity.status as string} />
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="font-medium">{capacity.usedDays.toFixed(1)}d</span>
                      <span className="text-slate-400"> / {capacity.totalWorkdays}d</span>
                      <span className="ml-2 text-slate-400">({capacity.usedPercent}%)</span>
                    </div>
                  </div>
                  
                  {/* Warnings */}
                  {capacity.usedPercent > 100 && (
                    <p className="mt-2 text-sm text-red-500">
                      Over-allocated by {(capacity.usedDays - capacity.totalWorkdays).toFixed(1)} days
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
        quarter={selectedQuarter}
      />

      {/* Assignment Modal */}
      <AssignmentModal
        isOpen={isAssignmentOpen}
        onClose={() => {
          setIsAssignmentOpen(false);
          setAssignmentMemberId(undefined);
        }}
        memberId={assignmentMemberId}
        quarter={selectedQuarter}
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
