import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, ExternalLink, Eye, EyeOff, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { testJiraConnection, getJiraProjects, validateJiraUrl } from '../../services/jira';
import type { JiraConnection, JiraHierarchyMode } from '../../types';

interface JiraConnectionFormProps {
  connection?: JiraConnection;
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

export function JiraConnectionForm({ connection, onSave, onCancel }: JiraConnectionFormProps) {
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

  // Import behaviour settings
  const [hierarchyMode, setHierarchyMode] = useState<JiraHierarchyMode>(connection?.hierarchyMode ?? 'auto');
  const [autoCreateProjects, setAutoCreateProjects] = useState(connection?.autoCreateProjects ?? true);
  const [autoCreateAssignments, setAutoCreateAssignments] = useState(connection?.autoCreateAssignments ?? true);
  const [defaultDaysPerItem, setDefaultDaysPerItem] = useState(connection?.defaultDaysPerItem ?? 1);
  const [importBehaviourOpen, setImportBehaviourOpen] = useState(false);

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
    const result = await getJiraProjects(jiraBaseUrl, userEmail, apiToken);
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
      hierarchyMode,
      autoCreateProjects,
      autoCreateAssignments,
      defaultDaysPerItem,
    });
    setIsSaving(false);
  };

  const projectOptions = [{ value: '', label: loadingProjects ? 'Loading...' : 'Select project' }, ...availableProjects.map(p => ({ value: p.key, label: p.key + ' - ' + p.name }))];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input id="name" label="Connection Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Main Project" required error={errors.name} />
      <div>
        <Input id="url" label="Jira URL" value={jiraBaseUrl} onChange={e => { setJiraBaseUrl(e.target.value); setConnectionStatus('idle'); setAvailableProjects([]); }} placeholder="https://company.atlassian.net" required error={errors.jiraBaseUrl} />
        <p className="text-xs text-slate-500 mt-1">Your Atlassian Cloud URL</p>
      </div>
      <Input id="email" label="Email" type="email" value={userEmail} onChange={e => { setUserEmail(e.target.value); setConnectionStatus('idle'); }} placeholder="you@company.com" required error={errors.userEmail} />
      {/* US-010: Token masking */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">API Token</label>
        {isEditing && !tokenChanged ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono text-sm">
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
            <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-3 top-2 text-slate-400 hover:text-slate-600">
              {showToken ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
            {isEditing && (
              <button type="button" onClick={() => { setTokenChanged(false); setApiToken(''); }} className="mt-1 text-xs text-slate-400 hover:text-slate-600">
                ← Keep existing token
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-1">
          <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 inline-flex items-center gap-1">
            Get a token <ExternalLink size={12}/>
          </a>
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button type="button" variant="secondary" onClick={handleTestConnection} disabled={connectionStatus === 'testing'}>
          {connectionStatus === 'testing' ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} Test Connection
        </Button>
        {connectionStatus !== 'idle' && <div className={'flex items-center gap-2 text-sm ' + (connectionStatus === 'success' ? 'text-green-600' : connectionStatus === 'error' ? 'text-red-600' : 'text-slate-500')}>
          {connectionStatus === 'success' && <CheckCircle size={16}/>}{connectionStatus === 'error' && <AlertCircle size={16}/>}<span>{connectionMessage}</span>
        </div>}
      </div>
      {connectionStatus === 'success' && <div className="pt-4 border-t"><Select id="project" label="Jira Project" value={jiraProjectKey} onChange={e => handleProjectSelect(e.target.value)} options={projectOptions} disabled={loadingProjects} required error={errors.jiraProjectKey} /></div>}
      {/* Import Behaviour — collapsible */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          onClick={() => setImportBehaviourOpen(o => !o)}
        >
          <span>Import Behaviour</span>
          {importBehaviourOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
        </button>
        {importBehaviourOpen && (
          <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-200 dark:border-slate-700">
            {/* Hierarchy mode */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Project hierarchy
              </label>
              <div className="space-y-2">
                {([
                  ['auto', 'Auto-detect', 'Uses Epics as projects when available, otherwise Features'],
                  ['epic_as_project', 'Epic = Project', 'Each Epic becomes a project; Features become phases within it'],
                  ['feature_as_project', 'Feature = Project', 'Each Feature becomes a project; no phases created'],
                ] as [JiraHierarchyMode, string, string][]).map(([value, label, hint]) => (
                  <label key={value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="hierarchyMode"
                      value={value}
                      checked={hierarchyMode === value}
                      onChange={() => setHierarchyMode(value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Auto-create toggles */}
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Auto-create projects &amp; phases</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sync automatically creates Projects and Phases from Jira structure</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoCreateProjects}
                  onClick={() => setAutoCreateProjects(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${autoCreateProjects ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${autoCreateProjects ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                </button>
              </label>

              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Auto-suggest assignments</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Creates assignment suggestions from sprint + story points (you can edit or remove them)</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoCreateAssignments}
                  onClick={() => setAutoCreateAssignments(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${autoCreateAssignments ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${autoCreateAssignments ? 'translate-x-4' : 'translate-x-0.5'}`}/>
                </button>
              </label>
            </div>

            {/* Default days fallback */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
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
                  className="w-20 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <span className="text-sm text-slate-500">days per item</span>
              </div>
            </div>
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
