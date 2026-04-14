import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useCurrentState } from '../../stores/appStore';
import { addTeamMember, updateTeamMember } from '../../stores/actions';
import { CURRENCY_OPTIONS } from '../../utils/currency';
import type { CurrencyCode, TeamMember, TeamMemberAssignmentCategory } from '../../types';
import { getSettingsBauPercent, getTeamMemberBauPercent } from '../../utils/bau';
import { getTeamMemberAssignmentCategory } from '../../utils/planningGroups';
import { mergeProcessTeamsWithDefaults } from '../../utils/processTeams';
import { mergeSquadsWithDefaults } from '../../utils/squads';

interface TeamMemberFormProps {
 isOpen: boolean;
 onClose: () => void;
 member?: TeamMember | null;
}

export function TeamMemberForm({ isOpen, onClose, member }: TeamMemberFormProps) {
 const state = useCurrentState();
 const roles = state.roles;
 const countries = state.countries;
 const skills = state.skills;
 const squads = mergeSquadsWithDefaults(state.squads);
 const processTeams = mergeProcessTeamsWithDefaults(state.processTeams);
 const externalVendors = state.externalVendors;
 
 const [name, setName] = useState('');
 const [email, setEmail] = useState('');
 const [role, setRole] = useState('');
 const [countryId, setCountryId] = useState('');
 const [squadId, setSquadId] = useState('');
 const [selectedProcessTeamIds, setSelectedProcessTeamIds] = useState<string[]>([]);
 const [maxConcurrentProjects, setMaxConcurrentProjects] = useState(2);
 const [workingDaysPerWeek, setWorkingDaysPerWeek] = useState('5');
 const [bauOverride, setBauOverride] = useState(false);
 const [bauReservePercent, setBauReservePercent] = useState(String(getSettingsBauPercent(state.settings)));
 const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
 const [excludedFromCapacity, setExcludedFromCapacity] = useState(false);
 const [assignmentCategory, setAssignmentCategory] = useState<TeamMemberAssignmentCategory>('it_team_member');
 const [externalVendorId, setExternalVendorId] = useState('');
 const [dailyRateOverride, setDailyRateOverride] = useState('');
 const [dailyRateCurrency, setDailyRateCurrency] = useState<CurrencyCode | ''>('');
 const [errors, setErrors] = useState<Record<string, string>>({});

 // Reset form only when the modal opens or the target member changes.
 // roles/countries are intentionally excluded from deps — background syncs
 // create new array references which would silently reset the user's selections.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(() => {
 if (member) {
 setName(member.name);
 setEmail(member.email || '');
 setRole(member.role);
 setCountryId(member.countryId);
 setSquadId(member.squadId || '');
 setSelectedProcessTeamIds(member.processTeamIds || []);
 setMaxConcurrentProjects(member.maxConcurrentProjects);
 setWorkingDaysPerWeek(String(member.workingDaysPerWeek ?? 5));
 setBauOverride(member.bauOverride ?? false);
 setBauReservePercent(String(getTeamMemberBauPercent(member, state.settings)));
 setSelectedSkills(member.skillIds || []);
 setExcludedFromCapacity(member.excludedFromCapacity ?? false);
 setAssignmentCategory(getTeamMemberAssignmentCategory(member));
 setExternalVendorId(member.externalVendorId ?? '');
 setDailyRateOverride(member.dailyRateOverride != null ? String(member.dailyRateOverride) : '');
 setDailyRateCurrency(member.dailyRateCurrency ?? '');
 } else {
 setName('');
 setEmail('');
 setRole(roles[0]?.name || '');
 setCountryId(countries[0]?.id || '');
 setSquadId('');
 setSelectedProcessTeamIds([]);
 setMaxConcurrentProjects(2);
 setWorkingDaysPerWeek('5');
 setBauOverride(false);
 setBauReservePercent(String(getSettingsBauPercent(state.settings)));
 setSelectedSkills([]);
 setExcludedFromCapacity(false);
 setAssignmentCategory('it_team_member');
 setExternalVendorId('');
 setDailyRateOverride('');
 setDailyRateCurrency('');
 }
 setErrors({});
 }, [member?.id, isOpen]);

 const handleSkillToggle = (skillId: string) => {
 setSelectedSkills(prev =>
 prev.includes(skillId)
 ? prev.filter(id => id !== skillId)
 : [...prev, skillId]
 );
 };

 const handleProcessTeamToggle = (ptId: string) => {
 setSelectedProcessTeamIds(prev =>
 prev.includes(ptId)
 ? prev.filter(id => id !== ptId)
 : [...prev, ptId]
 );
 };

 const validate = (): boolean => {
 const newErrors: Record<string, string> = {};
 if (!name.trim()) newErrors.name = 'This field is mandatory';
 if (!role) newErrors.role = 'This field is mandatory';
 if (!countryId) newErrors.countryId = 'This field is mandatory';
 if ((dailyRateOverride.trim() === '') !== (dailyRateCurrency === '')) {
 newErrors.dailyRateOverride = 'Rate and currency must be filled together';
 }
 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSubmit = () => {
 if (!validate()) return;

 const memberData: Partial<TeamMember> & Pick<TeamMember, 'name' | 'role' | 'countryId' | 'skillIds' | 'maxConcurrentProjects'> = {
 name: name.trim(),
 email: email.trim() || undefined,
 role,
 countryId,
 workingDaysPerWeek: Math.min(5, Math.max(0.5, parseFloat(workingDaysPerWeek) || 5)),
 bauOverride,
 bauReservePercent: bauOverride ? Math.max(0, parseFloat(bauReservePercent) || 0) : undefined,
 bauReserveDays: undefined,
 squadId: assignmentCategory === 'external_partner' ? undefined : (squadId || undefined),
 processTeamIds: selectedProcessTeamIds,
 maxConcurrentProjects,
 skillIds: selectedSkills,
 excludedFromCapacity,
      workerType: assignmentCategory === 'external_partner' ? 'external' : 'internal',
      assignmentCategory,
      externalVendorId: assignmentCategory === 'external_partner' && externalVendorId ? externalVendorId : undefined,
 dailyRateOverride: dailyRateOverride.trim() === '' ? undefined : Math.max(0, parseFloat(dailyRateOverride) || 0),
 dailyRateCurrency: dailyRateCurrency || undefined,
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

 // Placeholder empty option prevents the browser from silently showing
 // the first real option when the value is '' (which caused the "mandatory
 // field" error — the field appeared filled but the state was empty).
 const roleOptions = [
 { value: '', label: '— Select a role —' },
 ...roles.map(r => ({ value: r.name, label: r.name })),
 ];
 const countryOptions = [
 { value: '', label: '— Select a country —' },
 ...countries.map(c => ({ value: c.id, label: c.name })),
 ];
 const squadOptions = [
 { value: '', label: 'Not assigned' },
 ...squads.map(s => ({ value: s.id, label: s.name })),
 ];
 const vendorOptions = [
 { value: '', label: 'No linked vendor' },
 ...externalVendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
 ];
 const assignmentCategoryOptions = [
{ value: 'it_team_member', label: 'VS Finance' },
 { value: 'other_internal_it', label: 'Other Internal IT' },
 { value: 'external_partner', label: 'External Partner' },
 ];

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

 <Input
 id="member-email"
 label="Email"
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="user@company.com"
 hint="Used to match with Jira assignees"
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

 <div className="grid grid-cols-2 gap-4">
 <Select
 id="assignment-category"
 label="Planning Category"
 value={assignmentCategory}
 onChange={(e) => setAssignmentCategory(e.target.value as TeamMemberAssignmentCategory)}
 options={assignmentCategoryOptions}
 />
 <Select
 id="external-vendor"
 label="Linked Vendor"
 value={externalVendorId}
 onChange={(e) => setExternalVendorId(e.target.value)}
 options={vendorOptions}
 disabled={assignmentCategory !== 'external_partner'}
 />
 </div>

 {/* Squad: ERP/EPM (VS Finance); always shown for internal IT categories */}
 {(assignmentCategory === 'it_team_member' || assignmentCategory === 'other_internal_it') && (
 <div className="space-y-1">
 <Select
 id="squad"
 label="IT team (squad)"
 value={squadId}
 onChange={(e) => setSquadId(e.target.value)}
 options={squadOptions}
 />
 <p className="text-xs text-[#94A3B8]">
 For VS Finance members, pick ERP or EPM so portfolio reports can split planned days by squad.
 </p>
 </div>
 )}

 {processTeams.length > 0 && (
 <div>
 <label className="block text-sm font-medium text-[#1E293B] mb-2">
 Process Teams
 </label>
 <div className="flex flex-wrap gap-2">
 {processTeams.map(pt => (
 <button
 key={pt.id}
 type="button"
 onClick={() => handleProcessTeamToggle(pt.id)}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
 selectedProcessTeamIds.includes(pt.id)
 ? 'bg-blue-100 text-blue-700'
 : 'bg-[#F0F2F5] text-[#94A3B8] hover:bg-[#DEDFE3]'
 }`}
 >
 {pt.name}
 </button>
 ))}
 </div>
 </div>
 )}

 <Input
 id="max-projects"
 label="Max Concurrent Epics"
 type="number"
 min={1}
 max={10}
 value={maxConcurrentProjects}
 onChange={(e) => setMaxConcurrentProjects(parseInt(e.target.value) || 2)}
 />

 <div className="grid grid-cols-2 gap-4">
 <Input
 id="working-days-per-week"
 label="Working Days / Week"
 type="number"
 min={0.5}
 max={5}
 step={0.5}
 value={workingDaysPerWeek}
 onChange={(e) => setWorkingDaysPerWeek(e.target.value)}
 hint="Use this to make someone part-time."
 />
 <div className="space-y-1.5">
 <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
 BAU Reserve
 </label>
 <label className="flex items-start justify-between gap-3 rounded-lg border border-[#DEDFE3] bg-white px-3 py-2.5 cursor-pointer">
 <div>
 <span className="block text-sm font-medium text-[#1E293B]">Override BAU percentage</span>
 <p className="text-xs text-[#94A3B8] mt-1">
 {bauOverride
 ? 'This member uses a custom BAU reserve.'
 : `Using global setting: ${getSettingsBauPercent(state.settings)}% of capacity.`}
 </p>
 </div>
 <input
 type="checkbox"
 checked={bauOverride}
 onChange={e => setBauOverride(e.target.checked)}
 className="mt-0.5 w-4 h-4 rounded border-[#94A3B8] text-blue-600 focus:ring-[#0089DD] cursor-pointer"
 />
 </label>
 </div>
 </div>

 {bauOverride && (
 <Input
 id="bau-reserve-percent"
 label="BAU Reserve (% of capacity)"
 type="number"
 min={0}
 max={100}
 step={0.5}
 value={bauReservePercent}
 onChange={(e) => setBauReservePercent(e.target.value)}
 />
 )}

 <div className="grid grid-cols-2 gap-4">
 <Input
 id="daily-rate-override"
 label="Daily Rate Override"
 type="number"
 min={0}
 step={10}
 value={dailyRateOverride}
 error={errors.dailyRateOverride}
 onChange={(e) => {
 setDailyRateOverride(e.target.value);
 if (errors.dailyRateOverride) setErrors(prev => ({ ...prev, dailyRateOverride: '' }));
 }}
 hint="Leave blank to use global or vendor-derived rates."
 />
 <Select
 id="daily-rate-currency"
 label="Rate Currency"
 value={dailyRateCurrency}
 onChange={(e) => {
 setDailyRateCurrency(e.target.value as CurrencyCode | '');
 if (errors.dailyRateOverride) setErrors(prev => ({ ...prev, dailyRateOverride: '' }));
 }}
 options={[{ value: '', label: 'No override currency' }, ...CURRENCY_OPTIONS]}
 />
 </div>

 <label className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none">
 <div>
 <span className="text-sm font-medium text-[#1E293B] ">Exclude from capacity calculation</span>
 <p className="text-xs text-[#94A3B8] mt-0.5">Member is still visible but not counted in capacity totals</p>
 </div>
 <input
 type="checkbox"
 checked={excludedFromCapacity}
 onChange={e => setExcludedFromCapacity(e.target.checked)}
 className="w-4 h-4 rounded border-[#94A3B8] text-blue-600 focus:ring-[#0089DD] cursor-pointer"
 />
 </label>

 {/* Skills */}
 <div>
 <label className="block text-sm font-medium text-[#1E293B] mb-3">
 Skills
 </label>
 <div className="space-y-4">
 {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
 <div key={category}>
 <p className="text-xs font-medium text-[#94A3B8] mb-2 uppercase tracking-wide">
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
 ? 'bg-blue-100 text-blue-700'
 : 'bg-[#F0F2F5] text-[#94A3B8] hover:bg-[#DEDFE3]'
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
