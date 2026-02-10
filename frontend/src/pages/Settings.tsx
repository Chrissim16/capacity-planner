import { useState } from 'react';
import { 
  Settings2, Shield, Code, Globe, Calendar, 
  Plus, Trash2, ChevronRight, Save, Edit2, Check, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { useAppStore } from '../stores/appStore';
import { 
  addRole, deleteRole, 
  addSkill, deleteSkill, 
  addSystem, updateSystem, deleteSystem, 
  addCountry, deleteCountry,
  addHoliday, deleteHoliday,
  updateSettings 
} from '../stores/actions';
import { useToast } from '../components/ui/Toast';

type SettingsSection = 'general' | 'roles' | 'skills' | 'systems' | 'countries' | 'holidays';

const sections: { id: SettingsSection; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'skills', label: 'Skills', icon: Code },
  { id: 'systems', label: 'Systems', icon: Globe },
  { id: 'countries', label: 'Countries', icon: Globe },
  { id: 'holidays', label: 'Holidays', icon: Calendar },
];

// Common country flags
const countryFlags: Record<string, string> = {
  'NL': '🇳🇱', 'DE': '🇩🇪', 'BE': '🇧🇪', 'FR': '🇫🇷', 'GB': '🇬🇧', 'UK': '🇬🇧',
  'US': '🇺🇸', 'ES': '🇪🇸', 'IT': '🇮🇹', 'PL': '🇵🇱', 'PT': '🇵🇹', 'AT': '🇦🇹',
  'CH': '🇨🇭', 'DK': '🇩🇰', 'SE': '🇸🇪', 'NO': '🇳🇴', 'FI': '🇫🇮', 'IE': '🇮🇪',
  'CZ': '🇨🇿', 'HU': '🇭🇺', 'RO': '🇷🇴', 'BG': '🇧🇬', 'GR': '🇬🇷', 'SK': '🇸🇰',
};

export function Settings() {
  const state = useAppStore((s) => s.getCurrentState());
  const { settings, roles, skills, systems, countries, publicHolidays } = state;
  
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);
  
  // General settings form state
  const [bauDays, setBauDays] = useState(settings.bauReserveDays || 5);
  const [hoursPerDay, setHoursPerDay] = useState(settings.hoursPerDay || 8);
  const [quartersToShow, setQuartersToShow] = useState(settings.quartersToShow || 4);
  const [defaultCountryId, setDefaultCountryId] = useState(settings.defaultCountryId || '');
  
  const { showToast } = useToast();
  
  // Add forms state
  const [newRoleName, setNewRoleName] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'System' | 'Process' | 'Technical'>('Technical');
  const [newSystemName, setNewSystemName] = useState('');
  const [newSystemDesc, setNewSystemDesc] = useState('');
  
  // Edit state for systems
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);
  const [editSystemName, setEditSystemName] = useState('');
  const [editSystemDesc, setEditSystemDesc] = useState('');
  
  // Country form state
  const [newCountryCode, setNewCountryCode] = useState('');
  const [newCountryName, setNewCountryName] = useState('');
  
  // Holiday form state
  const [newHolidayCountryId, setNewHolidayCountryId] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');

  const handleSaveGeneral = () => {
    updateSettings({
      bauReserveDays: bauDays,
      hoursPerDay,
      quartersToShow,
      defaultCountryId,
    });
  };

  const handleAddRole = () => {
    if (newRoleName.trim()) {
      addRole(newRoleName.trim());
      setNewRoleName('');
    }
  };

  const handleAddSkill = () => {
    if (newSkillName.trim()) {
      addSkill(newSkillName.trim(), newSkillCategory);
      setNewSkillName('');
    }
  };

  const handleAddSystem = () => {
    if (newSystemName.trim()) {
      addSystem(newSystemName.trim(), newSystemDesc.trim() || undefined);
      setNewSystemName('');
      setNewSystemDesc('');
      showToast('System added', 'success');
    }
  };

  const handleEditSystem = (systemId: string) => {
    const system = systems.find(s => s.id === systemId);
    if (system) {
      setEditingSystemId(systemId);
      setEditSystemName(system.name);
      setEditSystemDesc(system.description || '');
    }
  };

  const handleSaveSystem = () => {
    if (editingSystemId && editSystemName.trim()) {
      updateSystem(editingSystemId, { 
        name: editSystemName.trim(), 
        description: editSystemDesc.trim() || undefined 
      });
      setEditingSystemId(null);
      showToast('System updated', 'success');
    }
  };

  const handleCancelEditSystem = () => {
    setEditingSystemId(null);
    setEditSystemName('');
    setEditSystemDesc('');
  };

  const handleAddCountry = () => {
    if (newCountryCode.trim() && newCountryName.trim()) {
      const code = newCountryCode.trim().toUpperCase();
      const flag = countryFlags[code] || '🏳️';
      addCountry(code, newCountryName.trim(), flag);
      setNewCountryCode('');
      setNewCountryName('');
    }
  };

  const handleAddHoliday = () => {
    if (newHolidayCountryId && newHolidayDate && newHolidayName.trim()) {
      addHoliday(newHolidayCountryId, newHolidayDate, newHolidayName.trim());
      setNewHolidayDate('');
      setNewHolidayName('');
    }
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    switch (deleteConfirm.type) {
      case 'role': deleteRole(deleteConfirm.id); break;
      case 'skill': deleteSkill(deleteConfirm.id); break;
      case 'system': deleteSystem(deleteConfirm.id); break;
      case 'country': deleteCountry(deleteConfirm.id); break;
      case 'holiday': deleteHoliday(deleteConfirm.id); break;
    }
    setDeleteConfirm(null);
  };

  const countryOptions = [
    { value: '', label: 'Select default country' },
    ...countries.map(c => ({ value: c.id, label: c.name })),
  ];

  const countrySelectOptions = [
    { value: '', label: 'Select country' },
    ...countries.map(c => ({ value: c.id, label: `${c.flag || '🏳️'} ${c.name}` })),
  ];

  const skillCategoryOptions = [
    { value: 'System', label: 'System' },
    { value: 'Process', label: 'Process' },
    { value: 'Technical', label: 'Technical' },
  ];

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, typeof skills>);

  // Sort holidays by date
  const sortedHolidays = [...publicHolidays].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <Card className="w-64 shrink-0">
        <CardContent className="p-2">
          <nav className="space-y-1">
            {sections.map(section => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon size={18} />
                  {section.label}
                  {activeSection === section.id && (
                    <ChevronRight size={16} className="ml-auto" />
                  )}
                </button>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'general' && (
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="bau-days"
                  label="BAU Reserve (days per quarter)"
                  type="number"
                  min={0}
                  max={30}
                  value={bauDays}
                  onChange={(e) => setBauDays(parseInt(e.target.value) || 0)}
                />
                <Input
                  id="hours-per-day"
                  label="Hours per Day"
                  type="number"
                  min={1}
                  max={12}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseInt(e.target.value) || 8)}
                />
                <Input
                  id="quarters-to-show"
                  label="Quarters to Show"
                  type="number"
                  min={1}
                  max={12}
                  value={quartersToShow}
                  onChange={(e) => setQuartersToShow(parseInt(e.target.value) || 4)}
                />
                <Select
                  id="default-country"
                  label="Default Country"
                  value={defaultCountryId}
                  onChange={(e) => setDefaultCountryId(e.target.value)}
                  options={countryOptions}
                />
              </div>
              <Button onClick={handleSaveGeneral}>
                <Save size={16} />
                Save Settings
              </Button>
            </CardContent>
          </Card>
        )}

        {activeSection === 'roles' && (
          <Card>
            <CardHeader>
              <CardTitle>Team Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Role Form */}
              <div className="flex gap-3">
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Enter role name"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
                />
                <Button onClick={handleAddRole}>
                  <Plus size={16} />
                  Add
                </Button>
              </div>
              
              {/* Roles List */}
              <div className="space-y-2">
                {roles.map(role => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200">{role.name}</span>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'role', id: role.id, name: role.name })}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {roles.length === 0 && (
                  <p className="text-center py-8 text-slate-400">No roles defined</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'skills' && (
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Skill Form */}
              <div className="flex gap-3">
                <Input
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="Enter skill name"
                  className="flex-1"
                />
                <Select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value as typeof newSkillCategory)}
                  options={skillCategoryOptions}
                />
                <Button onClick={handleAddSkill}>
                  <Plus size={16} />
                  Add
                </Button>
              </div>
              
              {/* Skills by Category */}
              {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categorySkills.map(skill => (
                      <div
                        key={skill.id}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                      >
                        <span className="font-medium text-slate-700 dark:text-slate-200">{skill.name}</span>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'skill', id: skill.id, name: skill.name })}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {skills.length === 0 && (
                <p className="text-center py-8 text-slate-400">No skills defined</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeSection === 'systems' && (
          <Card>
            <CardHeader>
              <CardTitle>Systems</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add System Form */}
              <div className="flex gap-3">
                <Input
                  value={newSystemName}
                  onChange={(e) => setNewSystemName(e.target.value)}
                  placeholder="System name"
                  className="flex-1"
                />
                <Input
                  value={newSystemDesc}
                  onChange={(e) => setNewSystemDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="flex-1"
                />
                <Button onClick={handleAddSystem}>
                  <Plus size={16} />
                  Add
                </Button>
              </div>
              
              {/* Systems List */}
              <div className="space-y-2">
                {systems.map(system => (
                  <div
                    key={system.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    {editingSystemId === system.id ? (
                      // Edit mode
                      <div className="flex-1 flex items-center gap-3">
                        <Input
                          value={editSystemName}
                          onChange={(e) => setEditSystemName(e.target.value)}
                          placeholder="System name"
                          className="flex-1"
                        />
                        <Input
                          value={editSystemDesc}
                          onChange={(e) => setEditSystemDesc(e.target.value)}
                          placeholder="Description"
                          className="flex-1"
                        />
                        <button
                          onClick={handleSaveSystem}
                          className="p-1.5 text-green-500 hover:text-green-600 transition-colors"
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={handleCancelEditSystem}
                          className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{system.name}</span>
                          {system.description && (
                            <p className="text-sm text-slate-500">{system.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditSystem(system.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'system', id: system.id, name: system.name })}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {systems.length === 0 && (
                  <p className="text-center py-8 text-slate-400">No systems defined</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'countries' && (
          <Card>
            <CardHeader>
              <CardTitle>Countries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Country Form */}
              <div className="flex gap-3">
                <Input
                  value={newCountryCode}
                  onChange={(e) => setNewCountryCode(e.target.value.toUpperCase())}
                  placeholder="Code (e.g., NL)"
                  className="w-24"
                  maxLength={2}
                />
                <Input
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                  placeholder="Country name"
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCountry()}
                />
                <Button onClick={handleAddCountry}>
                  <Plus size={16} />
                  Add
                </Button>
              </div>
              
              {/* Preview flag */}
              {newCountryCode && (
                <p className="text-sm text-slate-500">
                  Flag preview: {countryFlags[newCountryCode.toUpperCase()] || '🏳️'} 
                  {!countryFlags[newCountryCode.toUpperCase()] && ' (generic flag - code not recognized)'}
                </p>
              )}
              
              {/* Countries List */}
              <div className="space-y-2">
                {countries.map(country => (
                  <div
                    key={country.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{country.flag || '🏳️'}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{country.name}</span>
                      <Badge variant="default">{country.code}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400">
                        {publicHolidays.filter(h => h.countryId === country.id).length} holidays
                      </span>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'country', id: country.id, name: country.name })}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete (will also remove all holidays)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {countries.length === 0 && (
                  <p className="text-center py-8 text-slate-400">No countries defined. Add a country to manage holidays.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === 'holidays' && (
          <Card>
            <CardHeader>
              <CardTitle>Public Holidays</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Holiday Form */}
              <div className="flex gap-3 items-end">
                <div className="w-48">
                  <Select
                    label="Country"
                    value={newHolidayCountryId}
                    onChange={(e) => setNewHolidayCountryId(e.target.value)}
                    options={countrySelectOptions}
                  />
                </div>
                <div className="w-40">
                  <Input
                    label="Date"
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="Holiday Name"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    placeholder="e.g., Christmas Day"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddHoliday()}
                  />
                </div>
                <Button onClick={handleAddHoliday}>
                  <Plus size={16} />
                  Add
                </Button>
              </div>
              
              {/* Holidays List by Country */}
              {countries.length === 0 ? (
                <p className="text-center py-8 text-slate-400">
                  Add countries first in the Countries section to manage holidays.
                </p>
              ) : (
                countries.map(country => {
                  const countryHolidays = sortedHolidays.filter(h => h.countryId === country.id);
                  
                  return (
                    <div key={country.id} className="border-t border-slate-200 dark:border-slate-700 pt-4 first:border-t-0 first:pt-0">
                      <h3 className="flex items-center gap-2 text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">
                        <span>{country.flag || '🏳️'}</span>
                        {country.name}
                        <Badge variant="default">{countryHolidays.length}</Badge>
                      </h3>
                      {countryHolidays.length === 0 ? (
                        <p className="text-sm text-slate-400 ml-8">No holidays defined for this country</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {countryHolidays.map(holiday => (
                            <div
                              key={holiday.id}
                              className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-slate-400 w-20">
                                  {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-GB', { 
                                    day: 'numeric', 
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                                <span className="text-slate-600 dark:text-slate-300">{holiday.name}</span>
                              </div>
                              <button
                                onClick={() => setDeleteConfirm({ type: 'holiday', id: holiday.id, name: holiday.name })}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={`Delete ${deleteConfirm?.type}`}
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
          {deleteConfirm?.type === 'country' && ' This will also remove all holidays for this country.'}
          {deleteConfirm?.type !== 'country' && ' This may affect existing assignments and team members.'}
        </p>
      </Modal>
    </div>
  );
}
