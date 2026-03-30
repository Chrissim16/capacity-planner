import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, ExternalLink, Eye, EyeOff, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { testJiraConnection, getJiraProjects, validateJiraUrl } from '../../services/jira';
import type { JiraConnection, JiraConnectionSyncSettings, JiraSettings } from '../../types';

interface JiraConnectionFormProps {
 connection?: JiraConnection;
 globalSettings: JiraSettings;
 onSave: (data: Omit<JiraConnection, 'id' | 'createdAt' | 'updatedAt'>) => void;
 onCancel: () => void;
}

interface JiraProject { id: string; key: string; name: string; }
type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

// US-010: Build a masked display string for an existing token
function maskToken(token: string): string {
 if (!token || token.length < 4) return '••••••••';
 return '••••••••' + token.slice(-4);
}

const SYNC_OVERRIDE_ROWS: Array<{
 syncKey: keyof JiraConnectionSyncSettings;
 filterKey: keyof JiraConnectionSyncSettings;
 label: string;
 color: string;
}> = [
 { syncKey: 'syncEpics', filterKey: 'statusFilterEpics', label: 'Epics', color: 'text-[#1E293B]' },
 { syncKey: 'syncFeatures', filterKey: 'statusFilterFeatures', label: 'Features', color: 'text-[#1E293B]' },
 { syncKey: 'syncStories', filterKey: 'statusFilterStories', label: 'Stories', color: 'text-[#1E293B]' },
 { syncKey: 'syncTasks', filterKey: 'statusFilterTasks', label: 'Tasks', color: 'text-[#1E293B]' },
 { syncKey: 'syncBugs', filterKey: 'statusFilterBugs', label: 'Bugs', color: 'text-red-600' },
];

function createSyncOverrideFromSettings(settings: JiraSettings): JiraConnectionSyncSettings {
 return {
  syncEpics: settings.syncEpics,
  syncFeatures: settings.syncFeatures,
  syncStories: settings.syncStories,
  syncTasks: settings.syncTasks,
  syncBugs: settings.syncBugs,
  statusFilterEpics: settings.statusFilterEpics,
  statusFilterFeatures: settings.statusFilterFeatures,
  statusFilterStories: settings.statusFilterStories,
  statusFilterTasks: settings.statusFilterTasks,
  statusFilterBugs: settings.statusFilterBugs,
 };
}

export function JiraConnectionForm({ connection, globalSettings, onSave, onCancel }: JiraConnectionFormProps) {
 const isEditing = !!connection;
 const [name, setName] = useState(connection?.name || '');
 const [jiraBaseUrl, setJiraBaseUrl] = useState(connection?.jiraBaseUrl || '');
 const [userEmail, setUserEmail] = useState(connection?.userEmail || '');
 // US-010: when editing, start with the token masked so it's never shown
 const [apiToken, setApiToken] = useState(isEditing ? '' : '');
 const [tokenChanged, setTokenChanged] = useState(!isEditing); // new connection always "changed"
 const [showToken, setShowToken] = useState(false);
 const [jiraProjectKey, setJiraProjectKey] = useState(connection?.jiraProjectKey || '');
 const [jiraProjectId, setJiraProjectId] = useState(connection?.jiraProjectId || '');
 const [jiraProjectName, setJiraProjectName] = useState(connection?.jiraProjectName || '');
 // When editing with a known-good connection, pre-set status to success so the form is usable
 const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(isEditing ? 'success' : 'idle');
 const [connectionMessage, setConnectionMessage] = useState(isEditing ? `Connected (${connection?.jiraProjectName || connection?.jiraProjectKey})` : '');
 const [availableProjects, setAvailableProjects] = useState<JiraProject[]>([]);
 const [loadingProjects, setLoadingProjects] = useState(false);
 const [errors, setErrors] = useState<Record<string, string>>({});
 const [isSaving, setIsSaving] = useState(false);

 const [defaultDaysPerItem, setDefaultDaysPerItem] = useState(connection?.defaultDaysPerItem ?? 1);
 const [jqlFilter, setJqlFilter] = useState(connection?.jqlFilter || '');
 const [scenarioPlannerOnly, setScenarioPlannerOnly] = useState(connection?.scenarioPlannerOnly ?? false);
 const [importBehaviourOpen, setImportBehaviourOpen] = useState(false);
 const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
 const [syncOverrideOpen, setSyncOverrideOpen] = useState(false);
 const [useGlobalSyncSettings, setUseGlobalSyncSettings] = useState(!connection?.syncSettingsOverride);
 const [cfEpicLink, setCfEpicLink] = useState(connection?.customFieldIds?.epicLink ?? '');
 const [cfEpicLinkAlt, setCfEpicLinkAlt] = useState(connection?.customFieldIds?.epicLinkAlt ?? '');
 const [cfStartDate, setCfStartDate] = useState(connection?.customFieldIds?.startDate ?? '');
 const [cfSprint, setCfSprint] = useState(connection?.customFieldIds?.sprint ?? '');
 const [syncOverride, setSyncOverride] = useState<JiraConnectionSyncSettings>(
  connection?.syncSettingsOverride ?? createSyncOverrideFromSettings(globalSettings)
 );

 useEffect(() => {
 if (connectionStatus === 'success' && availableProjects.length === 0) loadProjects();
 }, [connectionStatus]);

 const handleTestConnection = async () => {
 const urlValidation = validateJiraUrl(jiraBaseUrl);
 if (!urlValidation.valid) { setErrors(prev => ({ ...prev, jiraBaseUrl: urlValidation.error || 'Invalid URL' })); return; }
 // US-010: use stored token when editing and not changed
 const tokenToTest = tokenChanged ? apiToken.trim() : (connection?.apiToken || '');
 if (!userEmail.trim() || !tokenToTest) {
 setErrors(prev => ({ ...prev, userEmail: !userEmail.trim() ? 'Required' : '', apiToken: !tokenToTest ? 'Required' : '' }));
 return;
 }
 setConnectionStatus('testing'); setConnectionMessage('Testing…'); setErrors({});
 const result = await testJiraConnection(jiraBaseUrl, userEmail, tokenToTest);
 if (result.success) { setConnectionStatus('success'); setConnectionMessage('Connected as ' + result.user?.displayName); }
 else { setConnectionStatus('error'); setConnectionMessage(result.error || 'Failed'); }
 };

 const loadProjects = async () => {
 setLoadingProjects(true);
 const tokenToUse = tokenChanged ? apiToken.trim() : (connection?.apiToken || '');
 const result = await getJiraProjects(jiraBaseUrl, userEmail, tokenToUse);
 if (result.success && result.projects) {
 setAvailableProjects(result.projects);
 if (connection?.jiraProjectKey) {
 const p = result.projects.find(p => p.key === connection.jiraProjectKey);
 if (p) { setJiraProjectKey(p.key); setJiraProjectId(p.id); setJiraProjectName(p.name); }
 }
 }
 setLoadingProjects(false);
 };

 const handleProjectSelect = (key: string) => {
 const p = availableProjects.find(p => p.key === key);
 if (p) { setJiraProjectKey(p.key); setJiraProjectId(p.id); setJiraProjectName(p.name); setErrors(prev => ({ ...prev, jiraProjectKey: '' })); }
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 const newErrors: Record<string, string> = {};
 if (!name.trim()) newErrors.name = 'Required';
 if (!jiraProjectKey) newErrors.jiraProjectKey = 'Select a project';
 if (connectionStatus !== 'success') newErrors.general = 'Test connection first';
 // US-010: if editing and token not changed, we must have an existing token stored
 if (tokenChanged && !apiToken.trim()) newErrors.apiToken = 'Required';
 setErrors(newErrors);
 if (Object.keys(newErrors).length > 0) return;
 setIsSaving(true);
 // US-010: use existing token if not changed
 const finalToken = tokenChanged ? apiToken.trim() : (connection?.apiToken || '');
 onSave({
 name: name.trim(), jiraBaseUrl: jiraBaseUrl.replace(/\/+$/, ''), jiraProjectKey, jiraProjectId, jiraProjectName,
 apiToken: finalToken,
 apiTokenMasked: maskToken(finalToken),
 userEmail: userEmail.trim(), isActive: connection?.isActive ?? true,
 lastSyncStatus: connection?.lastSyncStatus || 'idle', lastSyncAt: connection?.lastSyncAt, lastSyncError: connection?.lastSyncError,
 syncHistory: connection?.syncHistory,
 defaultDaysPerItem,
 jqlFilter: jqlFilter.trim() || undefined,
 scenarioPlannerOnly,
 customFieldIds: (cfEpicLink || cfEpicLinkAlt || cfStartDate || cfSprint) ? {
 epicLink: cfEpicLink.trim() || undefined,
 epicLinkAlt: cfEpicLinkAlt.trim() || undefined,
 startDate: cfStartDate.trim() || undefined,
 sprint: cfSprint.trim() || undefined,
 } : undefined,
 syncSettingsOverride: useGlobalSyncSettings ? undefined : syncOverride,
 });
 setIsSaving(false);
 };

 const projectOptions = [{ value: '', label: loadingProjects ? 'Loading...' : 'Select project' }, ...availableProjects.map(p => ({ value: p.key, label: p.key + ' - ' + p.name }))];

 return (
 <form onSubmit={handleSubmit} className="space-y-6">
 <Input id="name" label="Connection Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Main Project" required error={errors.name} />
 <div>
 <Input id="url" label="Jira URL" value={jiraBaseUrl} onChange={e => { setJiraBaseUrl(e.target.value); setConnectionStatus('idle'); setAvailableProjects([]); }} placeholder="https://company.atlassian.net" required error={errors.jiraBaseUrl} />
 <p className="text-xs text-[#94A3B8] mt-1">Your Atlassian Cloud URL</p>
 </div>
 <Input id="email" label="Email" type="email" value={userEmail} onChange={e => { setUserEmail(e.target.value); setConnectionStatus('idle'); }} placeholder="you@company.com" required error={errors.userEmail} />
 {/* US-010: Token masking */}
 <div>
 <label className="block text-sm font-medium text-[#1E293B] mb-1">API Token</label>
 {isEditing && !tokenChanged ? (
 <div className="flex items-center gap-3">
 <div className="flex-1 px-3 py-2 rounded-lg border border-[#DEDFE3] bg-[#F5F8FC] text-[#94A3B8] font-mono text-sm">
 {maskToken(connection?.apiToken || '')}
 </div>
 <Button type="button" variant="secondary" size="sm" onClick={() => { setTokenChanged(true); setApiToken(''); setConnectionStatus('idle'); }}>
 Change Token
 </Button>
 </div>
 ) : (
 <div className="relative">
 <Input id="token" type={showToken ? 'text' : 'password'} value={apiToken}
 onChange={e => { setApiToken(e.target.value); setConnectionStatus('idle'); }}
 placeholder="Paste your API token" required error={errors.apiToken} />
 <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-2 text-[#94A3B8] hover:text-[#94A3B8]">
 {showToken ? <EyeOff size={18}/> : <Eye size={18}/>}
 </button>
 {isEditing && (
 <button type="button" onClick={() => { setTokenChanged(false); setApiToken(''); }} className="mt-1 text-xs text-[#94A3B8] hover:text-[#94A3B8]">
 ← Keep existing token
 </button>
 )}
 </div>
 )}
 <p className="text-xs text-[#94A3B8] mt-1">
 <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 inline-flex items-center gap-1">
 Get a token <ExternalLink size={12}/>
 </a>
 </p>
 </div>
 <div className="flex items-center gap-4">
 <Button type="button" variant="secondary" onClick={handleTestConnection} disabled={connectionStatus === 'testing'}>
 {connectionStatus === 'testing' ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} Test Connection
 </Button>
 {connectionStatus !== 'idle' && <div className={'flex items-center gap-2 text-sm ' + (connectionStatus === 'success' ? 'text-[#16A34A]' : connectionStatus === 'error' ? 'text-red-600' : 'text-[#94A3B8]')}>
 {connectionStatus === 'success' && <CheckCircle size={16}/>}{connectionStatus === 'error' && <AlertCircle size={16}/>}<span>{connectionMessage}</span>
 </div>}
 </div>
 {connectionStatus === 'success' && <div className="pt-4 border-t"><Select id="project" label="Jira Project" value={jiraProjectKey} onChange={e => handleProjectSelect(e.target.value)} options={projectOptions} disabled={loadingProjects} required error={errors.jiraProjectKey} /></div>}
 {/* Import Behaviour — collapsible */}
 <div className="border border-[#DEDFE3] rounded-lg overflow-hidden">
 <button
 type="button"
 className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#1E293B] hover:bg-[#F5F8FC] transition-colors"
 onClick={() => setImportBehaviourOpen(o => !o)}
 >
 <span>Import Behaviour</span>
 {importBehaviourOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
 </button>
 {importBehaviourOpen && (
 <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[#DEDFE3] ">
 {/* Default days fallback */}
 <div>
 <label className="block text-sm font-medium text-[#1E293B] mb-1">
 Default effort (days) when no story points
 </label>
 <div className="flex items-center gap-2">
 <input
 type="number"
 min={0}
 max={20}
 step={0.5}
 value={defaultDaysPerItem}
 onChange={e => setDefaultDaysPerItem(Number(e.target.value))}
 className="w-20 px-3 py-1.5 text-sm border border-[#94A3B8] rounded-lg bg-white text-[#1E293B]"
 />
 <span className="text-sm text-[#94A3B8]">days per item</span>
 </div>
 </div>

 {/* Additional JQL filter */}
 <div>
 <label className="block text-sm font-medium text-[#1E293B] mb-1">
 Additional JQL filter <span className="font-normal text-[#94A3B8]">(optional)</span>
 </label>
 <input
 type="text"
 value={jqlFilter}
 onChange={e => setJqlFilter(e.target.value)}
 placeholder='e.g. sprint in openSprints() OR updatedDate >= -90d'
 className="w-full px-3 py-2 text-sm border border-[#94A3B8] rounded-lg bg-white text-[#1E293B] placeholder-[#94A3B8] font-mono"
 />
             <p className="text-xs text-[#94A3B8] mt-1">
               Appended to every sync query with AND. Use this to narrow scope and avoid Jira's 5,000-item limit — e.g. limit to recent updates or open sprints.
             </p>
           </div>

           {/* Scenario Planner only */}
           <label className="flex items-start gap-3 cursor-pointer">
             <input
               type="checkbox"
               checked={scenarioPlannerOnly}
               onChange={e => setScenarioPlannerOnly(e.target.checked)}
               className="mt-0.5 h-4 w-4 rounded border-[#94A3B8] text-sana-teal accent-sana-teal"
             />
             <span>
               <span className="block text-sm font-medium text-[#1E293B]">Scenario Planner only</span>
               <span className="block text-xs text-[#94A3B8] mt-0.5">
                 Items from this connection will only appear in the Scenario Planner backlog.
                 They are hidden from Dashboard, Timeline, Team, Projects, and Command Palette.
               </span>
             </span>
           </label>
       </div>
      )}
    </div>

 <div className="border border-[#DEDFE3] rounded-lg overflow-hidden">
 <button
 type="button"
 className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#1E293B] hover:bg-[#F5F8FC] transition-colors"
 onClick={() => setSyncOverrideOpen(o => !o)}
 >
 <span>Per-Connection Sync Settings</span>
 {syncOverrideOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
 </button>
 {syncOverrideOpen && (
 <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[#DEDFE3] ">
 <label className="flex items-start gap-3 cursor-pointer">
 <input
 type="checkbox"
 checked={useGlobalSyncSettings}
 onChange={e => setUseGlobalSyncSettings(e.target.checked)}
 className="mt-0.5 h-4 w-4 rounded border-[#94A3B8]"
 />
 <span>
 <span className="block text-sm font-medium text-[#1E293B]">Use global Jira sync settings</span>
 <span className="block text-xs text-[#94A3B8] mt-0.5">
 Keep this enabled for normal projects. Disable it only when this Jira project needs different issue types or status filters.
 </span>
 </span>
 </label>

 {!useGlobalSyncSettings && (
 <div className="space-y-3">
 <p className="text-xs text-[#94A3B8]">
 These overrides apply only to this connection. The global Jira sync settings remain unchanged for the rest of the app.
 </p>
 <div className="border rounded-lg overflow-hidden">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-[#F5F8FC] border-b border-[#DEDFE3]">
 <th className="text-left px-4 py-2 font-medium text-[#94A3B8] w-8"></th>
 <th className="text-left px-4 py-2 font-medium text-[#94A3B8]">Type</th>
 <th className="text-left px-4 py-2 font-medium text-[#94A3B8]">Status filter</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[#DEDFE3]">
 {SYNC_OVERRIDE_ROWS.map(({ syncKey, filterKey, label, color }) => {
 const enabled = syncOverride[syncKey] as boolean;
 const filter = syncOverride[filterKey] as string;
 return (
 <tr key={label} className={!enabled ? 'opacity-40' : ''}>
 <td className="px-4 py-2.5">
 <input
 type="checkbox"
 checked={enabled}
 onChange={(e) => setSyncOverride(prev => ({ ...prev, [syncKey]: e.target.checked }))}
 className="rounded border-[#94A3B8]"
 />
 </td>
 <td className={`px-4 py-2.5 font-medium ${color}`}>{label}</td>
 <td className="px-4 py-2.5">
 <select
 value={filter}
 disabled={!enabled}
 onChange={(e) => setSyncOverride(prev => ({ ...prev, [filterKey]: e.target.value }))}
 className="text-sm border border-input rounded px-2 py-1 bg-background disabled:cursor-not-allowed"
 >
 <option value="all">All statuses</option>
 <option value="exclude_done">Exclude Done</option>
 <option value="active_only">Active only (To Do + In Progress)</option>
 <option value="todo_only">To Do only</option>
 </select>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Custom Field IDs — collapsible */}
 <div className="border border-[#DEDFE3] rounded-lg overflow-hidden">
 <button
 type="button"
 className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#1E293B] hover:bg-[#F5F8FC] transition-colors"
 onClick={() => setCustomFieldsOpen(o => !o)}
 >
 <span>Custom Field IDs <span className="font-normal text-[#94A3B8]">(advanced)</span></span>
 {customFieldsOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
 </button>
 {customFieldsOpen && (
 <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[#DEDFE3] ">
 <p className="text-xs text-[#94A3B8] ">
 Override the default Jira custom field IDs if your instance uses non-standard ones.
 Leave blank to use the Jira Cloud defaults.
 </p>
 {([
 ['epicLink', cfEpicLink, setCfEpicLink, 'Epic Link', 'customfield_10014'],
 ['epicLinkAlt', cfEpicLinkAlt, setCfEpicLinkAlt, 'Epic Link (alt)', 'customfield_10008'],
 ['startDate', cfStartDate, setCfStartDate, 'Start Date', 'customfield_10015'],
 ['sprint', cfSprint, setCfSprint, 'Sprint', 'customfield_10020'],
 ] as [string, string, (v: string) => void, string, string][]).map(([, value, setter, label, placeholder]) => (
 <div key={label}>
 <label className="block text-xs font-medium text-[#94A3B8] mb-1">
 {label}
 </label>
 <input
 type="text"
 value={value}
 onChange={e => setter(e.target.value)}
 placeholder={`default: ${placeholder}`}
 className="w-full px-3 py-1.5 text-sm border border-[#94A3B8] rounded-lg bg-white text-[#1E293B] placeholder-[#94A3B8] font-mono"
 />
 </div>
 ))}
 </div>
 )}
 </div>

 {errors.general && <div className="bg-red-50 border border-red-200 rounded p-3"><p className="text-red-600 text-sm flex items-center gap-2"><AlertCircle size={16}/>{errors.general}</p></div>}
 <div className="flex justify-end gap-3 pt-4 border-t">
 <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
 <Button type="submit" disabled={connectionStatus !== 'success' || isSaving} isLoading={isSaving}>{connection ? 'Update' : 'Add'} Connection</Button>
 </div>
 </form>
 );
}
