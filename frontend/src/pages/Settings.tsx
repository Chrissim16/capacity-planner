import { useState, useRef } from 'react';
import { 
  Settings2, Shield, Code, Globe, Calendar, Database, Zap, Link2,
  Plus, Trash2, ChevronRight, Save, Edit2, Check, X,
  Download, Upload, FileJson, FileSpreadsheet, AlertTriangle, RefreshCw, Loader2, Power, ExternalLink
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
  addSprint, updateSprint, deleteSprint, generateSprintsForYear,
  updateSettings,
  addJiraConnection, updateJiraConnection, deleteJiraConnection, toggleJiraConnectionActive, updateJiraSettings, syncJiraWorkItems, setJiraConnectionSyncStatus
} from '../stores/actions';
import { useToast } from '../components/ui/Toast';
import { 
  exportToJSON, 
  importFromJSON, 
  exportToExcel, 
  importFromExcel,
  downloadExcelTemplate 
} from '../utils/importExport';
import type { AppState, Sprint, JiraConnection } from '../types';
import { SprintForm } from '../components/forms/SprintForm';
import { JiraConnectionForm } from '../components/forms/JiraConnectionForm';
import { testJiraConnection, fetchJiraIssues } from '../services/jira';

type SettingsSection = 'general' | 'roles' | 'skills' | 'systems' | 'countries' | 'holidays' | 'sprints' | 'jira' | 'data';

const sections: { id: SettingsSection; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'skills', label: 'Skills', icon: Code },
  { id: 'systems', label: 'Systems', icon: Globe },
  { id: 'countries', label: 'Countries', icon: Globe },
  { id: 'holidays', label: 'Holidays', icon: Calendar },
  { id: 'sprints', label: 'Sprints', icon: Zap },
  { id: 'jira', label: 'Jira Integration', icon: Link2 },
  { id: 'data', label: 'Import / Export', icon: Database },
];

// Common country flags
const countryFlags: Record<string, string> = {
  'NL': 'ðŸ‡³ðŸ‡±', 'DE': 'ðŸ‡©ðŸ‡ª', 'BE': 'ðŸ‡§ðŸ‡ª', 'FR': 'ðŸ‡«ðŸ‡·', 'GB': 'ðŸ‡¬ðŸ‡§', 'UK': 'ðŸ‡¬ðŸ‡§',
  'US': 'ðŸ‡ºðŸ‡¸', 'ES': 'ðŸ‡ªðŸ‡¸', 'IT': 'ðŸ‡®ðŸ‡¹', 'PL': 'ðŸ‡µðŸ‡±', 'PT': 'ðŸ‡µðŸ‡¹', 'AT': 'ðŸ‡¦ðŸ‡¹',
  'CH': 'ðŸ‡¨ðŸ‡­', 'DK': 'ðŸ‡©ðŸ‡°', 'SE': 'ðŸ‡¸ðŸ‡ª', 'NO': 'ðŸ‡³ðŸ‡´', 'FI': 'ðŸ‡«ðŸ‡®', 'IE': 'ðŸ‡®ðŸ‡ª',
  'CZ': 'ðŸ‡¨ðŸ‡¿', 'HU': 'ðŸ‡­ðŸ‡º', 'RO': 'ðŸ‡·ðŸ‡´', 'BG': 'ðŸ‡§ðŸ‡¬', 'GR': 'ðŸ‡¬ðŸ‡·', 'SK': 'ðŸ‡¸ðŸ‡°',
};

export function Settings() {
  const state = useAppStore((s) => s.getCurrentState());
  const { settings, roles, skills, systems, countries, publicHolidays, sprints, jiraConnections, jiraSettings } = state;
  
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
  
  // Sprint form state
  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | undefined>();
  const [generateYearInput, setGenerateYearInput] = useState(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Import/Export state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ data: Partial<AppState> | null; warnings?: string[]; fileName: string } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Jira state
  const [jiraModalOpen, setJiraModalOpen] = useState(false);
  const [editingJiraConnection, setEditingJiraConnection] = useState<JiraConnection | undefined>();
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<string>('');

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
      const flag = countryFlags[code] || 'ðŸ³ï¸';
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

  // Sprint handlers
  const handleAddSprint = () => {
    setEditingSprint(undefined);
    setSprintModalOpen(true);
  };

  const handleEditSprint = (sprint: Sprint) => {
    setEditingSprint(sprint);
    setSprintModalOpen(true);
  };

  const handleSaveSprint = (data: Omit<Sprint, 'id'>) => {
    if (editingSprint) {
      updateSprint(editingSprint.id, data);
      showToast('Sprint updated', 'success');
    } else {
      addSprint(data);
      showToast('Sprint added', 'success');
    }
    setSprintModalOpen(false);
    setEditingSprint(undefined);
  };

  const handleGenerateSprints = () => {
    setIsGenerating(true);
    try {
      const generated = generateSprintsForYear(generateYearInput);
      showToast(`Generated ${generated.length} sprints for ${generateYearInput}`, 'success');
    } catch {
      showToast('Failed to generate sprints', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Group sprints by year
  const sprintsByYear = sprints.reduce((acc, sprint) => {
    if (!acc[sprint.year]) acc[sprint.year] = [];
    acc[sprint.year].push(sprint);
    return acc;
  }, {} as Record<number, Sprint[]>);

  // Get available years for generating sprints
  const yearsWithSprints = Object.keys(sprintsByYear).map(Number).sort();
  // Jira handlers
  const handleAddJiraConnection = () => { setEditingJiraConnection(undefined); setJiraModalOpen(true); };
  const handleEditJiraConnection = (conn: JiraConnection) => { setEditingJiraConnection(conn); setJiraModalOpen(true); };
  const handleSaveJiraConnection = (data: Omit<JiraConnection, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingJiraConnection) { updateJiraConnection(editingJiraConnection.id, data); showToast('Connection updated', 'success'); }
    else { addJiraConnection(data); showToast('Connection added', 'success'); }
    setJiraModalOpen(false); setEditingJiraConnection(undefined);
  };
  const handleTestJiraConnection = async (conn: JiraConnection) => {
    setTestingConnectionId(conn.id);
    const result = await testJiraConnection(conn.jiraBaseUrl, conn.userEmail, conn.apiToken);
    if (result.success) { updateJiraConnection(conn.id, { lastSyncStatus: 'success', lastSyncError: undefined }); showToast('Connection successful', 'success'); }
    else { updateJiraConnection(conn.id, { lastSyncStatus: 'error', lastSyncError: result.error }); showToast(result.error || 'Connection failed', 'error'); }
    setTestingConnectionId(null);
  };
  const handleToggleJiraConnection = (id: string) => { toggleJiraConnectionActive(id); showToast('Connection toggled', 'info'); };

  const handleSyncJira = async (conn: JiraConnection) => {
    setSyncingConnectionId(conn.id);
    setSyncProgress('Starting sync...');
    setJiraConnectionSyncStatus(conn.id, 'syncing');
    
    try {
      const result = await fetchJiraIssues(conn, jiraSettings, (msg) => setSyncProgress(msg));
      
      if (result.success && result.itemsSynced > 0) {
        const items = result.items || [];
        const syncResult = syncJiraWorkItems(conn.id, items);
        setJiraConnectionSyncStatus(conn.id, 'success');
        showToast(
          `Synced ${syncResult.itemsSynced} items (${syncResult.itemsCreated} new, ${syncResult.itemsUpdated} updated)`,
          'success'
        );
      } else if (result.success) {
        setJiraConnectionSyncStatus(conn.id, 'success');
        showToast('No items found matching your sync settings', 'info');
      } else {
        setJiraConnectionSyncStatus(conn.id, 'error', result.errors.join(', '));
        showToast(result.errors[0] || 'Sync failed', 'error');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setJiraConnectionSyncStatus(conn.id, 'error', errorMsg);
      showToast(errorMsg, 'error');
    }
    
    setSyncingConnectionId(null);
    setSyncProgress('');
  };


  // Import/Export handlers
  const handleExportJSON = () => {
    setIsExporting(true);
    try {
      exportToJSON(state);
      showToast('Data exported to JSON', 'success');
    } catch {
      showToast('Failed to export data', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await exportToExcel(state);
      showToast('Data exported to Excel', 'success');
    } catch {
      showToast('Failed to export Excel. Try JSON export instead.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadExcelTemplate();
      showToast('Template downloaded', 'success');
    } catch {
      showToast('Failed to download template', 'error');
    }
  };

  const handleJSONFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    const result = await importFromJSON(file);
    setIsImporting(false);
    
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    
    if (result.data) {
      setImportPreview({ data: result.data, fileName: file.name });
    }
    
    // Reset file input
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    const result = await importFromExcel(file);
    setIsImporting(false);
    
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    
    if (result.data) {
      setImportPreview({ data: result.data, warnings: result.warnings, fileName: file.name });
    }
    
    // Reset file input
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  const handleConfirmImport = () => {
    if (!importPreview?.data) return;
    
    const setData = useAppStore.getState().setData;
    const currentData = state;
    
    if (importMode === 'replace') {
      // Full replace - use imported data with current settings if not provided
      setData({
        ...currentData,
        ...importPreview.data,
        settings: importPreview.data.settings || currentData.settings,
        lastModified: new Date().toISOString(),
      } as AppState);
    } else {
      // Merge mode - append to existing data
      setData({
        ...currentData,
        countries: [...currentData.countries, ...(importPreview.data.countries || [])],
        publicHolidays: [...currentData.publicHolidays, ...(importPreview.data.publicHolidays || [])],
        roles: [...currentData.roles, ...(importPreview.data.roles || [])],
        skills: [...currentData.skills, ...(importPreview.data.skills || [])],
        systems: [...currentData.systems, ...(importPreview.data.systems || [])],
        teamMembers: [...currentData.teamMembers, ...(importPreview.data.teamMembers || [])],
        projects: [...currentData.projects, ...(importPreview.data.projects || [])],
        timeOff: [...currentData.timeOff, ...(importPreview.data.timeOff || [])],
        lastModified: new Date().toISOString(),
      });
    }
    
    showToast(`Data ${importMode === 'replace' ? 'imported' : 'merged'} successfully`, 'success');
    setImportPreview(null);
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    switch (deleteConfirm.type) {
      case 'role': deleteRole(deleteConfirm.id); break;
      case 'skill': deleteSkill(deleteConfirm.id); break;
      case 'system': deleteSystem(deleteConfirm.id); break;
      case 'country': deleteCountry(deleteConfirm.id); break;
      case 'holiday': deleteHoliday(deleteConfirm.id); break;
      case 'sprint': deleteSprint(deleteConfirm.id); break;
      case 'jira': deleteJiraConnection(deleteConfirm.id); break;
    }
    setDeleteConfirm(null);
  };

  const countryOptions = [
    { value: '', label: 'Select default country' },
    ...countries.map(c => ({ value: c.id, label: c.name })),
  ];

  const countrySelectOptions = [
    { value: '', label: 'Select country' },
    ...countries.map(c => ({ value: c.id, label: `${c.flag || 'ðŸ³ï¸'} ${c.name}` })),
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
                  Flag preview: {countryFlags[newCountryCode.toUpperCase()] || 'ðŸ³ï¸'} 
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
                      <span className="text-2xl">{country.flag || 'ðŸ³ï¸'}</span>
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
                        <span>{country.flag || 'ðŸ³ï¸'}</span>
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

        {activeSection === 'sprints' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Sprints</span>
                <Button size="sm" onClick={handleAddSprint}>
                  <Plus size={16} />
                  Add Sprint
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Generate Sprints */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <RefreshCw size={16} />
                  Auto-Generate Sprints
                </h4>
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                  Automatically generate all sprints for a year based on your settings 
                  ({settings.sprintsPerYear} sprints/year, {settings.sprintDurationWeeks} weeks each).
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    value={generateYearInput}
                    onChange={(e) => setGenerateYearInput(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-28"
                  />
                  <Button onClick={handleGenerateSprints} isLoading={isGenerating}>
                    <Zap size={16} />
                    Generate {generateYearInput} Sprints
                  </Button>
                </div>
                {yearsWithSprints.includes(generateYearInput) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    âš ï¸ This will replace all existing sprints for {generateYearInput}
                  </p>
                )}
              </div>

              {/* Sprints List by Year */}
              {Object.keys(sprintsByYear).length === 0 ? (
                <div className="text-center py-12">
                  <Zap size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400 mb-2">No sprints defined</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Use the auto-generate feature above or add sprints manually
                  </p>
                </div>
              ) : (
                Object.entries(sprintsByYear)
                  .sort(([a], [b]) => Number(b) - Number(a)) // Sort years descending
                  .map(([year, yearSprints]) => (
                    <div key={year} className="border-t border-slate-200 dark:border-slate-700 pt-4 first:border-t-0 first:pt-0">
                      <h3 className="flex items-center gap-2 text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">
                        {year}
                        <Badge variant="default">{yearSprints.length} sprints</Badge>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {yearSprints
                          .sort((a, b) => a.number - b.number)
                          .map(sprint => (
                            <div
                              key={sprint.id}
                              className={`flex items-center justify-between p-3 rounded-lg ${
                                sprint.isByeWeek 
                                  ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                                  : 'bg-slate-50 dark:bg-slate-800/50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {sprint.name}
                                  </span>
                                  {sprint.isByeWeek && (
                                    <Badge variant="warning" className="text-xs">Bye</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {new Date(sprint.startDate + 'T00:00:00').toLocaleDateString('en-GB', { 
                                    day: 'numeric', 
                                    month: 'short'
                                  })} - {new Date(sprint.endDate + 'T00:00:00').toLocaleDateString('en-GB', { 
                                    day: 'numeric', 
                                    month: 'short'
                                  })} â€¢ {sprint.quarter}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  onClick={() => handleEditSprint(sprint)}
                                  className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ type: 'sprint', id: sprint.id, name: sprint.name })}
                                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        )}
        {activeSection === 'jira' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Jira Connections</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Connect to Jira Cloud to sync your work items</p>
                  </div>
                  <Button onClick={handleAddJiraConnection}><Plus className="w-4 h-4 mr-2" />Add Connection</Button>
                </div>
              </CardHeader>
              <CardContent>
                {jiraConnections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No Jira connections configured</p>
                    <p className="text-sm">Click "Add Connection" to connect to your Jira instance</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jiraConnections.map((conn) => (
                      <div key={conn.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${conn.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <div>
                            <div className="font-medium">{conn.name}</div>
                            <div className="text-sm text-muted-foreground">{conn.jiraBaseUrl} &bull; {conn.jiraProjectKey}</div>
                            {conn.lastSyncAt && <div className="text-xs text-muted-foreground">Last sync: {new Date(conn.lastSyncAt).toLocaleString()}</div>}
                          </div>
                          {conn.lastSyncStatus === 'success' && <Badge variant="success">Connected</Badge>}
                          {conn.lastSyncStatus === 'error' && <Badge variant="danger">Error</Badge>}
                          {conn.lastSyncStatus === 'syncing' && <Badge variant="warning">Syncing</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleTestJiraConnection(conn)} disabled={testingConnectionId === conn.id}>
                            {testingConnectionId === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          </Button>
                          <Button variant="primary" size="sm" onClick={() => handleSyncJira(conn)} disabled={syncingConnectionId === conn.id || !conn.isActive}>
                            {syncingConnectionId === conn.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}{syncingConnectionId === conn.id && syncProgress ? syncProgress : "Sync"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditJiraConnection(conn)}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant={conn.isActive ? "ghost" : "secondary"} size="sm" onClick={() => handleToggleJiraConnection(conn.id)}>
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm({ type: 'jira', id: conn.id, name: conn.name })}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sync Settings</CardTitle>
                <p className="text-sm text-muted-foreground">Configure how items are synced from Jira</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium">Issue Types to Sync</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
                    {[
                      { key: 'syncEpics', label: 'Epics' },
                      { key: 'syncFeatures', label: 'Features' },
                      { key: 'syncStories', label: 'Stories' },
                      { key: 'syncTasks', label: 'Tasks' },
                      { key: 'syncBugs', label: 'Bugs' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={jiraSettings[key as keyof typeof jiraSettings] as boolean}
                          onChange={(e) => updateJiraSettings({ [key]: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium">Story Points to Days</label>
                    <p className="text-xs text-muted-foreground mb-2">1 story point = X days of work</p>
                    <Input type="number" step="0.1" min="0.1" max="5" value={jiraSettings.storyPointsToDays} onChange={(e) => updateJiraSettings({ storyPointsToDays: parseFloat(e.target.value) || 0.5 })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Default Velocity</label>
                    <p className="text-xs text-muted-foreground mb-2">Story points per sprint (used for estimates)</p>
                    <Input type="number" min="1" max="200" value={jiraSettings.defaultVelocity} onChange={(e) => updateJiraSettings({ defaultVelocity: parseInt(e.target.value) || 30 })} />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={jiraSettings.autoMapByName} onChange={(e) => updateJiraSettings({ autoMapByName: e.target.checked })} className="rounded border-gray-300" />
                    <span className="text-sm font-medium">Auto-map by name</span>
                    <span className="text-xs text-muted-foreground">Automatically match Jira items to projects/phases by similar names</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mapping Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="font-medium text-blue-600">Jira Epic</div>
                    <div className="text-muted-foreground">maps to</div>
                    <div className="font-medium">Capacity Planner Project</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="font-medium text-purple-600">Jira Feature</div>
                    <div className="text-muted-foreground">maps to</div>
                    <div className="font-medium">Capacity Planner Phase</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="font-medium text-green-600">Jira Story/Task/Bug</div>
                    <div className="text-muted-foreground">maps to</div>
                    <div className="font-medium">Work Item (time tracking)</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  <ExternalLink className="w-3 h-3 inline mr-1" />
                  Items synced from Jira can be mapped to your existing projects and phases. Story points and time tracking data will be used for capacity calculations.
                </p>
              </CardContent>
            </Card>
          </div>
        )}


        {activeSection === 'data' && (
          <div className="space-y-6">
            {/* Export Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download size={20} />
                  Export Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600 dark:text-slate-400">
                  Export all your data for backup or to transfer to another system.
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleExportJSON} isLoading={isExporting}>
                    <FileJson size={16} />
                    Export to JSON
                  </Button>
                  <Button variant="secondary" onClick={handleExportExcel} isLoading={isExporting}>
                    <FileSpreadsheet size={16} />
                    Export to Excel
                  </Button>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-2">What gets exported:</h4>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 ml-4 list-disc">
                    <li>Settings (BAU reserve, hours per day, etc.)</li>
                    <li>{countries.length} countries and {publicHolidays.length} holidays</li>
                    <li>{roles.length} roles and {skills.length} skills</li>
                    <li>{systems.length} systems</li>
                    <li>{state.teamMembers.length} team members</li>
                    <li>{state.projects.length} projects with phases and assignments</li>
                    <li>{state.timeOff.length} time off entries</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Import Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload size={20} />
                  Import Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600 dark:text-slate-400">
                  Import data from a JSON backup or Excel file. You can choose to replace all data or merge with existing.
                </p>
                
                {/* Hidden file inputs */}
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleJSONFileSelect}
                />
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleExcelFileSelect}
                />
                
                <div className="flex gap-3">
                  <Button 
                    variant="secondary" 
                    onClick={() => jsonInputRef.current?.click()}
                    isLoading={isImporting}
                  >
                    <FileJson size={16} />
                    Import from JSON
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => excelInputRef.current?.click()}
                    isLoading={isImporting}
                  >
                    <FileSpreadsheet size={16} />
                    Import from Excel
                  </Button>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-2">Need a template?</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    Download an Excel template with the correct structure and example data.
                  </p>
                  <Button variant="ghost" onClick={handleDownloadTemplate}>
                    <Download size={16} />
                    Download Excel Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Data Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Current Data Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{state.teamMembers.length}</p>
                    <p className="text-sm text-slate-500">Team Members</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{state.projects.length}</p>
                    <p className="text-sm text-slate-500">Projects</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {state.projects.reduce((sum, p) => sum + p.phases.length, 0)}
                    </p>
                    <p className="text-sm text-slate-500">Phases</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {state.projects.reduce((sum, p) => sum + p.phases.reduce((s, ph) => s + ph.assignments.length, 0), 0)}
                    </p>
                    <p className="text-sm text-slate-500">Assignments</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-4 text-center">
                  Last modified: {new Date(state.lastModified || Date.now()).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
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

      {/* Import Preview Modal */}
      <Modal
        isOpen={!!importPreview}
        onClose={() => setImportPreview(null)}
        title="Import Preview"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportPreview(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport}>
              <Upload size={16} />
              {importMode === 'replace' ? 'Replace All Data' : 'Merge Data'}
            </Button>
          </>
        }
      >
        {importPreview && (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-300">
              File: <strong>{importPreview.fileName}</strong>
            </p>

            {/* Warnings */}
            {importPreview.warnings && importPreview.warnings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium mb-2">
                  <AlertTriangle size={16} />
                  Warnings
                </div>
                <ul className="text-sm text-amber-600 dark:text-amber-300 space-y-1 ml-6 list-disc">
                  {importPreview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Import Mode Selection */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-3">Import Mode</h4>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">Replace All</p>
                    <p className="text-sm text-slate-500">Replace all existing data with imported data</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">Merge</p>
                    <p className="text-sm text-slate-500">Add imported data to existing data (may create duplicates)</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Data Preview */}
            <div>
              <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-2">Data to import:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                  <p className="font-medium">{importPreview.data?.countries?.length || 0}</p>
                  <p className="text-slate-500">Countries</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                  <p className="font-medium">{importPreview.data?.publicHolidays?.length || 0}</p>
                  <p className="text-slate-500">Holidays</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                  <p className="font-medium">{importPreview.data?.roles?.length || 0}</p>
                  <p className="text-slate-500">Roles</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                  <p className="font-medium">{importPreview.data?.skills?.length || 0}</p>
                  <p className="text-slate-500">Skills</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                  <p className="font-medium">{importPreview.data?.systems?.length || 0}</p>
                  <p className="text-slate-500">Systems</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                  <p className="font-medium">{importPreview.data?.teamMembers?.length || 0}</p>
                  <p className="text-slate-500">Team Members</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                  <p className="font-medium">{importPreview.data?.projects?.length || 0}</p>
                  <p className="text-slate-500">Projects</p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                  <p className="font-medium">{importPreview.data?.timeOff?.length || 0}</p>
                  <p className="text-slate-500">Time Off</p>
                </div>
              </div>
            </div>

            {importMode === 'replace' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400 text-sm">
                  <strong>Warning:</strong> Replacing all data will permanently remove your existing data. 
                  Consider exporting a backup first.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Sprint Add/Edit Modal */}
      <Modal
        isOpen={sprintModalOpen}
        onClose={() => {
          setSprintModalOpen(false);
          setEditingSprint(undefined);
        }}
        title={editingSprint ? 'Edit Sprint' : 'Add Sprint'}
        size="md"
      >
        <SprintForm
          sprint={editingSprint}
          onSave={handleSaveSprint}
          onCancel={() => {
            setSprintModalOpen(false);
            setEditingSprint(undefined);
          }}
        />
      </Modal>

      {/* Jira Connection Add/Edit Modal */}
      <Modal
        isOpen={jiraModalOpen}
        onClose={() => {
          setJiraModalOpen(false);
          setEditingJiraConnection(undefined);
        }}
        title={editingJiraConnection ? 'Edit Jira Connection' : 'Add Jira Connection'}
        size="lg"
      >
        <JiraConnectionForm
          connection={editingJiraConnection}
          onSave={handleSaveJiraConnection}
          onCancel={() => {
            setJiraModalOpen(false);
            setEditingJiraConnection(undefined);
          }}
        />
      </Modal>
    </div>
  );
}
