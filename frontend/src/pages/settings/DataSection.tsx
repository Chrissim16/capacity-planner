import { useState, useRef } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAppStore, useCurrentState } from '../../stores/appStore';
import { useToast } from '../../components/ui/Toast';
import { exportToJSON, importFromJSON, exportToExcel, importFromExcel, downloadExcelTemplate } from '../../utils/importExport';
import type { AppState } from '../../types';

export function DataSection() {
  const state = useCurrentState();
  const { countries, publicHolidays, roles, skills, systems } = state;
  const { showToast } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ data: Partial<AppState> | null; warnings?: string[]; fileName: string } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [replaceConfirmText, setReplaceConfirmText] = useState('');

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    setIsExporting(true);
    try { exportToJSON(state); showToast('Data exported to JSON', 'success'); }
    catch { showToast('Failed to export data', 'error'); }
    finally { setIsExporting(false); }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try { await exportToExcel(state); showToast('Data exported to Excel', 'success'); }
    catch { showToast('Failed to export Excel. Try JSON export instead.', 'error'); }
    finally { setIsExporting(false); }
  };

  const handleDownloadTemplate = async () => {
    try { await downloadExcelTemplate(); showToast('Template downloaded', 'success'); }
    catch { showToast('Failed to download template', 'error'); }
  };

  const handleJSONFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const result = await importFromJSON(file);
    setIsImporting(false);
    if (result.error) { showToast(result.error, 'error'); return; }
    if (result.data) setImportPreview({ data: result.data, fileName: file.name });
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const result = await importFromExcel(file);
    setIsImporting(false);
    if (result.error) { showToast(result.error, 'error'); return; }
    if (result.data) setImportPreview({ data: result.data, warnings: result.warnings, fileName: file.name });
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  const handleConfirmImport = () => {
    if (!importPreview?.data) return;
    const setData = useAppStore.getState().setData;
    const current = state;
    if (importMode === 'replace') {
      setData({ ...current, ...importPreview.data, settings: importPreview.data.settings || current.settings, lastModified: new Date().toISOString() } as AppState);
    } else {
      setData({
        ...current,
        countries:      [...current.countries,      ...(importPreview.data.countries      || [])],
        publicHolidays: [...current.publicHolidays, ...(importPreview.data.publicHolidays || [])],
        roles:          [...current.roles,          ...(importPreview.data.roles          || [])],
        skills:         [...current.skills,         ...(importPreview.data.skills         || [])],
        systems:        [...current.systems,        ...(importPreview.data.systems        || [])],
        teamMembers:    [...current.teamMembers,    ...(importPreview.data.teamMembers    || [])],
        projects:       [...current.projects,       ...(importPreview.data.projects       || [])],
        timeOff:        [...current.timeOff,        ...(importPreview.data.timeOff        || [])],
        lastModified: new Date().toISOString(),
      });
    }
    showToast(`Data ${importMode === 'replace' ? 'imported' : 'merged'} successfully`, 'success');
    setImportPreview(null);
    setReplaceConfirmText('');
  };

  return (
    <>
      <div className="space-y-6">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download size={20} />Export Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">Export all your data for backup or to transfer to another system.</p>
            <div className="flex gap-3">
              <Button onClick={handleExportJSON} isLoading={isExporting}><FileJson size={16} />Export to JSON</Button>
              <Button variant="secondary" onClick={handleExportExcel} isLoading={isExporting}><FileSpreadsheet size={16} />Export to Excel</Button>
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

        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload size={20} />Import Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Import data from a JSON backup or Excel file. You can choose to replace all data or merge with existing.
            </p>
            <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleJSONFileSelect} />
            <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelFileSelect} />
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => jsonInputRef.current?.click()} isLoading={isImporting}>
                <FileJson size={16} />Import from JSON
              </Button>
              <Button variant="secondary" onClick={() => excelInputRef.current?.click()} isLoading={isImporting}>
                <FileSpreadsheet size={16} />Import from Excel
              </Button>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-2">Need a template?</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                Download an Excel template with the correct structure and example data.
              </p>
              <Button variant="ghost" onClick={handleDownloadTemplate}><Download size={16} />Download Excel Template</Button>
            </div>
          </CardContent>
        </Card>

        {/* Data summary */}
        <Card>
          <CardHeader><CardTitle>Current Data Summary</CardTitle></CardHeader>
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

      {/* Import preview modal */}
      <Modal
        isOpen={!!importPreview}
        onClose={() => { setImportPreview(null); setReplaceConfirmText(''); }}
        title="Import Preview"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setImportPreview(null); setReplaceConfirmText(''); }}>Cancel</Button>
            <Button
              variant={importMode === 'replace' ? 'danger' : 'primary'}
              onClick={handleConfirmImport}
              disabled={importMode === 'replace' && replaceConfirmText !== 'REPLACE'}
            >
              <Upload size={16} />
              {importMode === 'replace' ? 'Replace All Data' : 'Merge Data'}
            </Button>
          </>
        }
      >
        {importPreview && (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-300">File: <strong>{importPreview.fileName}</strong></p>

            {importPreview.warnings && importPreview.warnings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium mb-2">
                  <AlertTriangle size={16} />Warnings
                </div>
                <ul className="text-sm text-amber-600 dark:text-amber-300 space-y-1 ml-6 list-disc">
                  {importPreview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
              <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-3">Import Mode</h4>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="importMode" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="mt-1" />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">Replace All</p>
                    <p className="text-sm text-slate-500">Replace all existing data with imported data</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="importMode" value="merge" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="mt-1" />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">Merge</p>
                    <p className="text-sm text-slate-500">Add imported data to existing data (may create duplicates)</p>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-2">Data to import:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { label: 'Countries',    value: importPreview.data?.countries?.length    || 0 },
                  { label: 'Holidays',     value: importPreview.data?.publicHolidays?.length || 0 },
                  { label: 'Roles',        value: importPreview.data?.roles?.length        || 0 },
                  { label: 'Skills',       value: importPreview.data?.skills?.length       || 0 },
                  { label: 'Systems',      value: importPreview.data?.systems?.length      || 0 },
                  { label: 'Team Members', value: importPreview.data?.teamMembers?.length  || 0 },
                  { label: 'Projects',     value: importPreview.data?.projects?.length     || 0 },
                  { label: 'Time Off',     value: importPreview.data?.timeOff?.length      || 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-100 dark:bg-slate-700 p-3 rounded">
                    <p className="font-medium">{value}</p>
                    <p className="text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {importMode === 'replace' && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    <p className="font-semibold mb-1">This will permanently delete all your existing data.</p>
                    <ul className="list-disc ml-4 space-y-0.5 text-red-600 dark:text-red-400">
                      <li>{state.projects.length} project{state.projects.length !== 1 ? 's' : ''} and all their phases &amp; assignments</li>
                      <li>{state.teamMembers.length} team member{state.teamMembers.length !== 1 ? 's' : ''}</li>
                      <li>{state.timeOff.length} time off record{state.timeOff.length !== 1 ? 's' : ''}</li>
                      <li>All scenarios</li>
                    </ul>
                    <p className="mt-2 text-red-500 dark:text-red-400">Consider exporting a backup first (Export → JSON).</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                    Type <strong>REPLACE</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    value={replaceConfirmText}
                    onChange={(e) => setReplaceConfirmText(e.target.value)}
                    placeholder="Type REPLACE here"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
