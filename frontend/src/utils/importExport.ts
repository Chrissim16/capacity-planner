/**
 * Import/Export utilities for the Capacity Planner
 */

import type { AppState, Project, Phase } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// JSON EXPORT/IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Export state to JSON file
 */
export function exportToJSON(state: AppState, filename = 'capacity-planner-backup'): void {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  downloadBlob(blob, `${filename}-${getDateStamp()}.json`);
}

/**
 * Import state from JSON file
 */
export async function importFromJSON(file: File): Promise<{ data: AppState | null; error?: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as AppState;
    
    // Basic validation
    if (!data.version && !data.settings) {
      return { data: null, error: 'Invalid file format. Missing required fields.' };
    }
    
    return { data };
  } catch (e) {
    return { data: null, error: 'Failed to parse JSON file. Please check the file format.' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Export state to Excel file
 */
export async function exportToExcel(state: AppState, filename = 'capacity-planner-export'): Promise<void> {
  // Dynamically import xlsx library
  const XLSX = await loadXLSX();
  if (!XLSX) {
    throw new Error('Failed to load Excel library');
  }

  const workbook = XLSX.utils.book_new();

  // Settings sheet
  const settingsData = [
    ['Setting', 'Value'],
    ['BAU Reserve Days', state.settings.bauReserveDays],
    ['Hours Per Day', state.settings.hoursPerDay],
    ['Quarters To Show', state.settings.quartersToShow],
    ['Default Country ID', state.settings.defaultCountryId],
    ['Dark Mode', state.settings.darkMode ? 'TRUE' : 'FALSE'],
  ];
  const settingsSheet = XLSX.utils.aoa_to_sheet(settingsData);
  XLSX.utils.book_append_sheet(workbook, settingsSheet, 'Settings');

  // Countries sheet
  const countriesData = [
    ['ID', 'Code', 'Name', 'Flag'],
    ...state.countries.map(c => [c.id, c.code, c.name, c.flag || ''])
  ];
  const countriesSheet = XLSX.utils.aoa_to_sheet(countriesData);
  XLSX.utils.book_append_sheet(workbook, countriesSheet, 'Countries');

  // Public Holidays sheet
  const holidaysData = [
    ['ID', 'Country ID', 'Date', 'Name'],
    ...state.publicHolidays.map(h => [h.id, h.countryId, h.date, h.name])
  ];
  const holidaysSheet = XLSX.utils.aoa_to_sheet(holidaysData);
  XLSX.utils.book_append_sheet(workbook, holidaysSheet, 'Holidays');

  // Roles sheet
  const rolesData = [
    ['ID', 'Name'],
    ...state.roles.map(r => [r.id, r.name])
  ];
  const rolesSheet = XLSX.utils.aoa_to_sheet(rolesData);
  XLSX.utils.book_append_sheet(workbook, rolesSheet, 'Roles');

  // Skills sheet
  const skillsData = [
    ['ID', 'Name', 'Category'],
    ...state.skills.map(s => [s.id, s.name, s.category])
  ];
  const skillsSheet = XLSX.utils.aoa_to_sheet(skillsData);
  XLSX.utils.book_append_sheet(workbook, skillsSheet, 'Skills');

  // Systems sheet
  const systemsData = [
    ['ID', 'Name', 'Description'],
    ...state.systems.map(s => [s.id, s.name, s.description || ''])
  ];
  const systemsSheet = XLSX.utils.aoa_to_sheet(systemsData);
  XLSX.utils.book_append_sheet(workbook, systemsSheet, 'Systems');

  // Team Members sheet
  const membersData = [
    ['ID', 'Name', 'Role', 'Country ID', 'Max Concurrent Projects', 'Skill IDs'],
    ...state.teamMembers.map(m => [
      m.id, m.name, m.role, m.countryId, m.maxConcurrentProjects, 
      (m.skillIds || []).join(';')
    ])
  ];
  const membersSheet = XLSX.utils.aoa_to_sheet(membersData);
  XLSX.utils.book_append_sheet(workbook, membersSheet, 'TeamMembers');

  // Projects sheet
  const projectsData = [
    ['ID', 'Name', 'Priority', 'Status', 'DevOps Link', 'System IDs'],
    ...state.projects.map(p => [
      p.id, p.name, p.priority, p.status, p.devopsLink || '',
      (p.systemIds || []).join(';')
    ])
  ];
  const projectsSheet = XLSX.utils.aoa_to_sheet(projectsData);
  XLSX.utils.book_append_sheet(workbook, projectsSheet, 'Projects');

  // Phases sheet
  const phasesData: (string | number)[][] = [
    ['Project ID', 'Phase ID', 'Name', 'Start Quarter', 'End Quarter', 'Required Skill IDs']
  ];
  state.projects.forEach(p => {
    p.phases.forEach(ph => {
      phasesData.push([
        p.id, ph.id, ph.name, ph.startQuarter, ph.endQuarter,
        (ph.requiredSkillIds || []).join(';')
      ]);
    });
  });
  const phasesSheet = XLSX.utils.aoa_to_sheet(phasesData);
  XLSX.utils.book_append_sheet(workbook, phasesSheet, 'Phases');

  // Assignments sheet
  const assignmentsData: (string | number)[][] = [
    ['Project ID', 'Phase ID', 'Member ID', 'Quarter', 'Days']
  ];
  state.projects.forEach(p => {
    p.phases.forEach(ph => {
      ph.assignments.forEach(a => {
        assignmentsData.push([p.id, ph.id, a.memberId, a.quarter, a.days]);
      });
    });
  });
  const assignmentsSheet = XLSX.utils.aoa_to_sheet(assignmentsData);
  XLSX.utils.book_append_sheet(workbook, assignmentsSheet, 'Assignments');

  // Time Off sheet
  const timeOffData = [
    ['Member ID', 'Quarter', 'Days', 'Reason'],
    ...state.timeOff.map(t => [t.memberId, t.quarter, t.days, t.reason || ''])
  ];
  const timeOffSheet = XLSX.utils.aoa_to_sheet(timeOffData);
  XLSX.utils.book_append_sheet(workbook, timeOffSheet, 'TimeOff');

  // Generate and download
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${filename}-${getDateStamp()}.xlsx`);
}

/**
 * Generate Excel template for import
 */
export async function downloadExcelTemplate(): Promise<void> {
  const XLSX = await loadXLSX();
  if (!XLSX) {
    throw new Error('Failed to load Excel library');
  }

  const workbook = XLSX.utils.book_new();

  // Instructions sheet
  const instructionsData = [
    ['Capacity Planner Import Template'],
    [''],
    ['Instructions:'],
    ['1. Fill in the data in each sheet'],
    ['2. IDs should be unique (e.g., "country-nl", "member-1")'],
    ['3. For references, use the exact ID from the referenced sheet'],
    ['4. Skill IDs and System IDs use semicolon (;) as separator'],
    ['5. Dates should be in YYYY-MM-DD format'],
    [''],
    ['Sheets:'],
    ['- Countries: Define countries for team members'],
    ['- Holidays: Public holidays per country'],
    ['- Roles: Team member roles'],
    ['- Skills: Skills with categories (System, Process, Technical)'],
    ['- Systems: Application systems'],
    ['- TeamMembers: Your team'],
    ['- Projects: Projects with status and priority'],
    ['- Phases: Project phases with quarters'],
    ['- Assignments: Member assignments to phases'],
    ['- TimeOff: Planned time off'],
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // Template sheets with headers and examples
  const templates: Record<string, string[][]> = {
    Countries: [
      ['ID', 'Code', 'Name', 'Flag'],
      ['country-nl', 'NL', 'Netherlands', '🇳🇱'],
      ['country-de', 'DE', 'Germany', '🇩🇪'],
    ],
    Holidays: [
      ['ID', 'Country ID', 'Date', 'Name'],
      ['hol-1', 'country-nl', '2026-01-01', 'New Year'],
      ['hol-2', 'country-nl', '2026-04-27', 'King\'s Day'],
    ],
    Roles: [
      ['ID', 'Name'],
      ['role-dev', 'Developer'],
      ['role-pm', 'Project Manager'],
    ],
    Skills: [
      ['ID', 'Name', 'Category'],
      ['skill-react', 'React', 'Technical'],
      ['skill-sap', 'SAP', 'System'],
    ],
    Systems: [
      ['ID', 'Name', 'Description'],
      ['sys-erp', 'ERP', 'Enterprise Resource Planning'],
      ['sys-crm', 'CRM', 'Customer Relationship Management'],
    ],
    TeamMembers: [
      ['ID', 'Name', 'Role', 'Country ID', 'Max Concurrent Projects', 'Skill IDs'],
      ['member-1', 'John Doe', 'Developer', 'country-nl', '2', 'skill-react;skill-sap'],
    ],
    Projects: [
      ['ID', 'Name', 'Priority', 'Status', 'DevOps Link', 'System IDs'],
      ['proj-1', 'ERP Upgrade', 'High', 'Active', 'https://...', 'sys-erp'],
    ],
    Phases: [
      ['Project ID', 'Phase ID', 'Name', 'Start Quarter', 'End Quarter', 'Required Skill IDs'],
      ['proj-1', 'phase-1', 'Analysis', 'Q1 2026', 'Q1 2026', 'skill-sap'],
    ],
    Assignments: [
      ['Project ID', 'Phase ID', 'Member ID', 'Quarter', 'Days'],
      ['proj-1', 'phase-1', 'member-1', 'Q1 2026', '20'],
    ],
    TimeOff: [
      ['Member ID', 'Quarter', 'Days', 'Reason'],
      ['member-1', 'Q2 2026', '10', 'Vacation'],
    ],
  };

  Object.entries(templates).forEach(([name, data]) => {
    const sheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  });

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, 'capacity-planner-template.xlsx');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Import state from Excel file
 */
export async function importFromExcel(file: File): Promise<{ data: Partial<AppState> | null; error?: string; warnings?: string[] }> {
  try {
    const XLSX = await loadXLSX();
    if (!XLSX) {
      return { data: null, error: 'Failed to load Excel library' };
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const warnings: string[] = [];

    const result: Partial<AppState> = {
      countries: [],
      publicHolidays: [],
      roles: [],
      skills: [],
      systems: [],
      teamMembers: [],
      projects: [],
      timeOff: [],
    };

    // Helper to read sheet data
    const readSheet = <T>(sheetName: string, mapper: (row: Record<string, unknown>) => T | null): T[] => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        warnings.push(`Sheet "${sheetName}" not found`);
        return [];
      }
      const data = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
      return data.map(mapper).filter((item): item is T => item !== null);
    };

    // Import Countries
    result.countries = readSheet('Countries', row => ({
      id: String(row['ID'] || ''),
      code: String(row['Code'] || ''),
      name: String(row['Name'] || ''),
      flag: String(row['Flag'] || ''),
    })).filter(c => c.id && c.code && c.name);

    // Import Holidays
    result.publicHolidays = readSheet('Holidays', row => ({
      id: String(row['ID'] || ''),
      countryId: String(row['Country ID'] || ''),
      date: String(row['Date'] || ''),
      name: String(row['Name'] || ''),
    })).filter(h => h.id && h.countryId && h.date && h.name);

    // Import Roles
    result.roles = readSheet('Roles', row => ({
      id: String(row['ID'] || ''),
      name: String(row['Name'] || ''),
    })).filter(r => r.id && r.name);

    // Import Skills
    result.skills = readSheet('Skills', row => ({
      id: String(row['ID'] || ''),
      name: String(row['Name'] || ''),
      category: (String(row['Category'] || 'Technical') as 'System' | 'Process' | 'Technical'),
    })).filter(s => s.id && s.name);

    // Import Systems
    result.systems = readSheet('Systems', row => ({
      id: String(row['ID'] || ''),
      name: String(row['Name'] || ''),
      description: row['Description'] ? String(row['Description']) : undefined,
    })).filter(s => s.id && s.name);

    // Import Team Members
    result.teamMembers = readSheet('TeamMembers', row => ({
      id: String(row['ID'] || ''),
      name: String(row['Name'] || ''),
      role: String(row['Role'] || ''),
      countryId: String(row['Country ID'] || ''),
      maxConcurrentProjects: Number(row['Max Concurrent Projects'] || 2),
      skillIds: String(row['Skill IDs'] || '').split(';').filter(Boolean),
    })).filter(m => m.id && m.name && m.role);

    // Import Projects and Phases
    const projectsMap = new Map<string, Project>();
    
    readSheet('Projects', row => {
      const id = String(row['ID'] || '');
      if (!id) return null;
      projectsMap.set(id, {
        id,
        name: String(row['Name'] || ''),
        priority: (String(row['Priority'] || 'Medium') as 'High' | 'Medium' | 'Low'),
        status: (String(row['Status'] || 'Planning') as 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Cancelled'),
        devopsLink: row['DevOps Link'] ? String(row['DevOps Link']) : undefined,
        systemIds: String(row['System IDs'] || '').split(';').filter(Boolean),
        phases: [],
      });
      return null;
    });

    // Import Phases
    readSheet('Phases', row => {
      const projectId = String(row['Project ID'] || '');
      const project = projectsMap.get(projectId);
      if (!project) {
        warnings.push(`Phase references unknown project: ${projectId}`);
        return null;
      }
      project.phases.push({
        id: String(row['Phase ID'] || ''),
        name: String(row['Name'] || ''),
        startQuarter: String(row['Start Quarter'] || ''),
        endQuarter: String(row['End Quarter'] || ''),
        requiredSkillIds: String(row['Required Skill IDs'] || '').split(';').filter(Boolean),
        predecessorPhaseId: null,
        assignments: [],
      });
      return null;
    });

    // Import Assignments
    readSheet('Assignments', row => {
      const projectId = String(row['Project ID'] || '');
      const phaseId = String(row['Phase ID'] || '');
      const project = projectsMap.get(projectId);
      if (!project) return null;
      const phase = project.phases.find((p: Phase) => p.id === phaseId);
      if (!phase) {
        warnings.push(`Assignment references unknown phase: ${phaseId}`);
        return null;
      }
      phase.assignments.push({
        memberId: String(row['Member ID'] || ''),
        quarter: String(row['Quarter'] || ''),
        days: Number(row['Days'] || 0),
      });
      return null;
    });

    result.projects = Array.from(projectsMap.values()).filter(p => p.name);

    // Import Time Off
    result.timeOff = readSheet('TimeOff', row => ({
      memberId: String(row['Member ID'] || ''),
      quarter: String(row['Quarter'] || ''),
      days: Number(row['Days'] || 0),
      reason: row['Reason'] ? String(row['Reason']) : undefined,
    })).filter(t => t.memberId && t.quarter);

    return { data: result, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (e) {
    return { data: null, error: 'Failed to parse Excel file. Please use the provided template.' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load XLSX library dynamically
 */
async function loadXLSX(): Promise<typeof import('xlsx') | null> {
  try {
    const XLSX = await import('xlsx');
    return XLSX;
  } catch {
    // Try loading from CDN as fallback
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      script.onload = () => resolve((window as unknown as { XLSX: typeof import('xlsx') }).XLSX);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }
}

/**
 * Download a blob as a file
 */
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

/**
 * Get current date stamp for filenames
 */
function getDateStamp(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}
