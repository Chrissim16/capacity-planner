/**
 * Import/Export utilities for the Capacity Planner
 */

import type { AppState, TimeOff } from '../types';
import { getSettingsBauPercent } from './bau';

// ═══════════════════════════════════════════════════════════════════════════════
// JSON EXPORT/IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function exportToJSON(state: AppState, filename = 'capacity-planner-backup'): void {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  downloadBlob(blob, `${filename}-${getDateStamp()}.json`);
}

export async function importFromJSON(file: File): Promise<{ data: AppState | null; error?: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as AppState;
    if (!data.version && !data.settings) {
      return { data: null, error: 'Invalid file format. Missing required fields.' };
    }
    return { data };
  } catch {
    return { data: null, error: 'Failed to parse JSON file. Please check the file format.' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function exportToExcel(state: AppState, filename = 'capacity-planner-export'): Promise<void> {
  const XLSX = await loadXLSX();
  if (!XLSX) throw new Error('Failed to load Excel library');

  const workbook = XLSX.utils.book_new();

  const settingsSheet = XLSX.utils.aoa_to_sheet([
    ['Setting', 'Value'],
    ['BAU Reserve %', getSettingsBauPercent(state.settings)],
    ['Hours Per Day', state.settings.hoursPerDay],
    ['Quarters To Show', state.settings.quartersToShow],
    ['Default Country ID', state.settings.defaultCountryId],
    ['Dark Mode', state.settings.darkMode ? 'TRUE' : 'FALSE'],
  ]);
  XLSX.utils.book_append_sheet(workbook, settingsSheet, 'Settings');

  const countriesSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Code', 'Name', 'Flag'],
    ...state.countries.map(c => [c.id, c.code, c.name, c.flag || '']),
  ]);
  XLSX.utils.book_append_sheet(workbook, countriesSheet, 'Countries');

  const holidaysSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Country ID', 'Date', 'Name'],
    ...state.publicHolidays.map(h => [h.id, h.countryId, h.date, h.name]),
  ]);
  XLSX.utils.book_append_sheet(workbook, holidaysSheet, 'Holidays');

  const rolesSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Name'],
    ...state.roles.map(r => [r.id, r.name]),
  ]);
  XLSX.utils.book_append_sheet(workbook, rolesSheet, 'Roles');

  const skillsSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Name', 'Category'],
    ...state.skills.map(s => [s.id, s.name, s.category]),
  ]);
  XLSX.utils.book_append_sheet(workbook, skillsSheet, 'Skills');

  const systemsSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Name', 'Description'],
    ...state.systems.map(s => [s.id, s.name, s.description || '']),
  ]);
  XLSX.utils.book_append_sheet(workbook, systemsSheet, 'Systems');

  const membersSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Name', 'Role', 'Country ID', 'Email', 'Squad', 'Skill IDs'],
    ...state.teamMembers.map(m => [
      m.id, m.name, m.role, m.countryId, m.email || '', m.squadId || '',
      (m.skillIds || []).join(';'),
    ]),
  ]);
  XLSX.utils.book_append_sheet(workbook, membersSheet, 'TeamMembers');

  // Jira Work Items (read-only reference)
  const jiraItemsSheet = XLSX.utils.aoa_to_sheet([
    ['Jira Key', 'Summary', 'Type', 'Status', 'Priority', 'Assignee Email', 'Sprint', 'Story Points', 'Parent Key', 'Labels'],
    ...state.jiraWorkItems.map(w => [
      w.jiraKey, w.summary, w.type, w.status, w.priority || '',
      w.assigneeEmail || '', w.sprintName || '', w.storyPoints ?? '', w.parentKey || '',
      (w.labels || []).join(';'),
    ]),
  ]);
  XLSX.utils.book_append_sheet(workbook, jiraItemsSheet, 'JiraWorkItems');

  // BIZ Assignments
  const bizAssignmentsSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Jira Key', 'Contact ID', 'Days', 'Notes'],
    ...state.jiraItemBizAssignments.map(a => [a.id, a.jiraKey, a.contactId, a.days ?? '', a.notes || '']),
  ]);
  XLSX.utils.book_append_sheet(workbook, bizAssignmentsSheet, 'BizAssignments');

  const timeOffSheet = XLSX.utils.aoa_to_sheet([
    ['ID', 'Member ID', 'Start Date', 'End Date', 'Note'],
    ...state.timeOff.map(t => [t.id, t.memberId, t.startDate, t.endDate, t.note || '']),
  ]);
  XLSX.utils.book_append_sheet(workbook, timeOffSheet, 'TimeOff');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${filename}-${getDateStamp()}.xlsx`);
}

export async function downloadExcelTemplate(): Promise<void> {
  const XLSX = await loadXLSX();
  if (!XLSX) throw new Error('Failed to load Excel library');

  const workbook = XLSX.utils.book_new();

  const instructionsSheet = XLSX.utils.aoa_to_sheet([
    ['Capacity Planner Import Template'],
    [''],
    ['Instructions:'],
    ['1. Fill in the data in each sheet'],
    ['2. IDs should be unique (e.g., "country-nl", "member-1")'],
    ['3. For references, use the exact ID from the referenced sheet'],
    ['4. Dates should be in YYYY-MM-DD format'],
    [''],
    ['Sheets:'],
    ['- Countries: Define countries for team members'],
    ['- Holidays: Public holidays per country'],
    ['- Roles: Team member roles'],
    ['- Skills: Skills with categories (System, Process, Technical)'],
    ['- Systems: Application systems'],
    ['- TeamMembers: Your team'],
    ['- TimeOff: Planned time off'],
  ]);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  const templates: Record<string, string[][]> = {
    Countries: [
      ['ID', 'Code', 'Name', 'Flag'],
      ['country-nl', 'NL', 'Netherlands', '🇳🇱'],
    ],
    Holidays: [
      ['ID', 'Country ID', 'Date', 'Name'],
      ['hol-1', 'country-nl', '2026-01-01', 'New Year'],
    ],
    Roles: [
      ['ID', 'Name'],
      ['role-dev', 'Developer'],
    ],
    Skills: [
      ['ID', 'Name', 'Category'],
      ['skill-react', 'React', 'Technical'],
    ],
    Systems: [
      ['ID', 'Name', 'Description'],
      ['sys-erp', 'ERP', 'Enterprise Resource Planning'],
    ],
    TeamMembers: [
      ['ID', 'Name', 'Role', 'Country ID', 'Max Concurrent Projects', 'Skill IDs'],
      ['member-1', 'John Doe', 'Developer', 'country-nl', '2', 'skill-react'],
    ],
    TimeOff: [
      ['ID', 'Member ID', 'Start Date', 'End Date', 'Note'],
      ['to-1', 'member-1', '2026-04-15', '2026-04-19', 'Vacation'],
    ],
  };

  Object.entries(templates).forEach(([name, data]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), name);
  });

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, 'capacity-planner-template.xlsx');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function importFromExcel(file: File): Promise<{ data: Partial<AppState> | null; error?: string; warnings?: string[] }> {
  try {
    const XLSX = await loadXLSX();
    if (!XLSX) return { data: null, error: 'Failed to load Excel library' };

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const warnings: string[] = [];

    const result: Partial<AppState> = {
      countries: [], publicHolidays: [], roles: [], skills: [], systems: [],
      teamMembers: [], timeOff: [],
    };

    const readSheet = <T>(sheetName: string, mapper: (row: Record<string, unknown>) => T | null): T[] => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) { warnings.push(`Sheet "${sheetName}" not found`); return []; }
      return (XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[])
        .map(mapper).filter((item): item is T => item !== null);
    };

    result.countries = readSheet('Countries', row => ({
      id: String(row['ID'] || ''), code: String(row['Code'] || ''),
      name: String(row['Name'] || ''), flag: String(row['Flag'] || ''),
    })).filter(c => c.id && c.code && c.name);

    result.publicHolidays = readSheet('Holidays', row => ({
      id: String(row['ID'] || ''), countryId: String(row['Country ID'] || ''),
      date: String(row['Date'] || ''), name: String(row['Name'] || ''),
    })).filter(h => h.id && h.countryId && h.date && h.name);

    result.roles = readSheet('Roles', row => ({
      id: String(row['ID'] || ''), name: String(row['Name'] || ''),
    })).filter(r => r.id && r.name);

    result.skills = readSheet('Skills', row => ({
      id: String(row['ID'] || ''), name: String(row['Name'] || ''),
      category: (String(row['Category'] || 'Technical') as 'System' | 'Process' | 'Technical'),
    })).filter(s => s.id && s.name);

    result.systems = readSheet('Systems', row => ({
      id: String(row['ID'] || ''), name: String(row['Name'] || ''),
      description: row['Description'] ? String(row['Description']) : undefined,
    })).filter(s => s.id && s.name);

    result.teamMembers = readSheet('TeamMembers', row => ({
      id: String(row['ID'] || ''), name: String(row['Name'] || ''),
      role: String(row['Role'] || ''), countryId: String(row['Country ID'] || ''),
      maxConcurrentProjects: Number(row['Max Concurrent Projects'] || 2),
      skillIds: String(row['Skill IDs'] || '').split(';').filter(Boolean),
    })).filter(m => m.id && m.name && m.role);

    result.timeOff = (readSheet('TimeOff', row => ({
      id: String(row['ID'] || `timeoff-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      memberId: String(row['Member ID'] || ''),
      startDate: String(row['Start Date'] || ''),
      endDate: String(row['End Date'] || ''),
      note: row['Note'] ? String(row['Note']) : undefined,
    })) as TimeOff[]).filter((t: TimeOff) => t.memberId && t.startDate && t.endDate);

    return { data: result, warnings: warnings.length > 0 ? warnings : undefined };
  } catch {
    return { data: null, error: 'Failed to parse Excel file. Please use the provided template.' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function loadXLSX(): Promise<typeof import('xlsx') | null> {
  try {
    return await import('xlsx');
  } catch {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      script.onload = () => resolve((window as unknown as { XLSX: typeof import('xlsx') }).XLSX);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getDateStamp(): string {
  return new Date().toISOString().split('T')[0];
}
