import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useAppStore } from '../../stores/appStore';
import { addTeamMember, updateTeamMember } from '../../stores/actions';
import type { TeamMember } from '../../types';

interface TeamMemberFormProps {
  isOpen: boolean;
  onClose: () => void;
  member?: TeamMember | null;
}

export function TeamMemberForm({ isOpen, onClose, member }: TeamMemberFormProps) {
  const state = useAppStore((s) => s.getCurrentState());
  const roles = state.roles;
  const countries = state.countries;
  const skills = state.skills;
  
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [countryId, setCountryId] = useState('');
  const [maxConcurrentProjects, setMaxConcurrentProjects] = useState(2);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when member changes
  useEffect(() => {
    if (member) {
      setName(member.name);
      setRole(member.role);
      setCountryId(member.countryId);
      setMaxConcurrentProjects(member.maxConcurrentProjects);
      setSelectedSkills(member.skillIds || []);
    } else {
      setName('');
      setRole(roles[0]?.name || '');
      setCountryId(countries[0]?.id || '');
      setMaxConcurrentProjects(2);
      setSelectedSkills([]);
    }
    setErrors({});
  }, [member, isOpen, roles, countries]);

  const handleSkillToggle = (skillId: string) => {
    setSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'This field is mandatory';
    if (!role) newErrors.role = 'This field is mandatory';
    if (!countryId) newErrors.countryId = 'This field is mandatory';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const memberData: Partial<TeamMember> & Pick<TeamMember, 'name' | 'role' | 'countryId' | 'skillIds' | 'maxConcurrentProjects'> = {
      name: name.trim(),
      role,
      countryId,
      maxConcurrentProjects,
      skillIds: selectedSkills,
    };

    // Clear needsEnrichment if country and role are now set
    if (member?.needsEnrichment && role && countryId) {
      memberData.needsEnrichment = false;
    }

    if (member) {
      updateTeamMember(member.id, memberData);
    } else {
      addTeamMember(memberData as Omit<TeamMember, 'id'>);
    }

    onClose();
  };

  const roleOptions = roles.map(r => ({ value: r.name, label: r.name }));
  const countryOptions = countries.map(c => ({ value: c.id, label: c.name }));

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, typeof skills>);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={member ? 'Edit Team Member' : 'Add Team Member'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {member ? 'Save Changes' : 'Add Member'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input
          id="member-name"
          label="Name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
          }}
          placeholder="Enter name"
          error={errors.name}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            id="role"
            label="Role"
            required
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              if (errors.role) setErrors(prev => ({ ...prev, role: '' }));
            }}
            options={roleOptions}
            error={errors.role}
          />
          <Select
            id="country"
            label="Country"
            required
            value={countryId}
            onChange={(e) => {
              setCountryId(e.target.value);
              if (errors.countryId) setErrors(prev => ({ ...prev, countryId: '' }));
            }}
            options={countryOptions}
            error={errors.countryId}
          />
        </div>

        <Input
          id="max-projects"
          label="Max Concurrent Projects"
          type="number"
          min={1}
          max={10}
          value={maxConcurrentProjects}
          onChange={(e) => setMaxConcurrentProjects(parseInt(e.target.value) || 2)}
        />

        {/* Skills */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Skills
          </label>
          <div className="space-y-4">
            {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
              <div key={category}>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                  {category}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categorySkills.map(skill => (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => handleSkillToggle(skill.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedSkills.includes(skill.id)
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {skill.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
