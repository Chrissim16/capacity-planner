# Import / Export

## Overview

The Capacity Planner supports importing and exporting data in JSON and Excel formats for backup, migration, and data sharing.

## Formats Supported

| Format | Export | Import | Use Case |
|--------|--------|--------|----------|
| JSON | ✅ | ✅ | Full backup, migration |
| Excel | ✅ | ✅ | Data review, bulk edits |

## JSON Export/Import

### Full State Export
Exports the complete application state as JSON:

```typescript
function exportToJSON(): void {
  const state = useAppStore.getState().data;
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json'
  });
  downloadBlob(blob, `capacity-planner-${timestamp}.json`);
}
```

### JSON Structure
```json
{
  "version": 10,
  "lastModified": "2026-02-19T10:00:00Z",
  "settings": { ... },
  "countries": [ ... ],
  "publicHolidays": [ ... ],
  "roles": [ ... ],
  "skills": [ ... ],
  "systems": [ ... ],
  "teamMembers": [ ... ],
  "projects": [ ... ],
  "timeOff": [ ... ],
  "quarters": [ ... ],
  "sprints": [ ... ],
  "jiraConnections": [ ... ],
  "jiraWorkItems": [ ... ],
  "jiraSettings": { ... },
  "scenarios": [ ... ],
  "activeScenarioId": null
}
```

### JSON Import
Replaces current state with imported data:

```typescript
function importFromJSON(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text);
  
  // Validate structure
  if (!data.version || !data.teamMembers) {
    throw new Error('Invalid format');
  }
  
  // Merge with defaults for new fields
  const merged = {
    ...defaultAppState,
    ...data,
    settings: { ...defaultSettings, ...data.settings },
  };
  
  useAppStore.getState().setData(merged);
}
```

## Excel Export/Import

### Excel Structure
Multi-sheet workbook with normalized data:

**Sheet: Team Members**
| ID | Name | Role | Country | Skills | Max Projects |
|----|------|------|---------|--------|--------------|
| member-1 | Alice | Developer | NL | SAP, Azure | 3 |
| member-2 | Bob | Analyst | DE | Process | 4 |

**Sheet: Projects**
| ID | Name | Priority | Status | Systems | Description |
|----|------|----------|--------|---------|-------------|
| project-1 | ERP Migration | High | Active | SAP | ... |

**Sheet: Phases**
| ID | Project ID | Name | Start | End | Skills |
|----|------------|------|-------|-----|--------|
| phase-1 | project-1 | Discovery | Q1 2026 | Q1 2026 | ... |

**Sheet: Assignments**
| Phase ID | Member ID | Quarter | Days | Sprint |
|----------|-----------|---------|------|--------|
| phase-1 | member-1 | Q1 2026 | 20 | Sprint 1 |

**Sheet: Countries**
| ID | Code | Name | Flag |
|----|------|------|------|
| country-nl | NL | Netherlands | 🇳🇱 |

**Sheet: Public Holidays**
| ID | Country ID | Date | Name |
|----|------------|------|------|
| holiday-1 | country-nl | 2026-01-01 | New Year |

**Sheet: Time Off**
| ID | Member ID | Quarter | Days | Reason |
|----|-----------|---------|------|--------|
| timeoff-1 | member-1 | Q1 2026 | 5 | Vacation |

### Excel Export
```typescript
function exportToExcel(): void {
  const state = useAppStore.getState().data;
  const workbook = XLSX.utils.book_new();
  
  // Create each sheet
  const teamSheet = XLSX.utils.json_to_sheet(
    state.teamMembers.map(m => ({
      ID: m.id,
      Name: m.name,
      Role: m.role,
      Country: m.countryId,
      Skills: m.skillIds.join(', '),
      'Max Projects': m.maxConcurrentProjects,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, teamSheet, 'Team Members');
  
  // ... add other sheets
  
  XLSX.writeFile(workbook, `capacity-planner-${timestamp}.xlsx`);
}
```

### Excel Import
```typescript
function importFromExcel(file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  
  // Parse each sheet
  const teamData = XLSX.utils.sheet_to_json(workbook.Sheets['Team Members']);
  const projectData = XLSX.utils.sheet_to_json(workbook.Sheets['Projects']);
  // ... parse other sheets
  
  // Convert to app state format
  const teamMembers = teamData.map(row => ({
    id: row.ID,
    name: row.Name,
    role: row.Role,
    countryId: row.Country,
    skillIds: row.Skills?.split(', ') || [],
    maxConcurrentProjects: row['Max Projects'] || 3,
  }));
  
  // ... convert other entities
  
  useAppStore.getState().updateData({
    teamMembers,
    projects,
    // ...
  });
}
```

### Excel Template
Download empty template with correct headers:

```typescript
function downloadExcelTemplate(): void {
  const workbook = XLSX.utils.book_new();
  
  // Team Members template
  const teamTemplate = XLSX.utils.json_to_sheet([{
    ID: 'member-1 (auto-generated if empty)',
    Name: 'Required',
    Role: 'Required',
    Country: 'country-xx',
    Skills: 'skill-id1, skill-id2',
    'Max Projects': 3,
  }]);
  XLSX.utils.book_append_sheet(workbook, teamTemplate, 'Team Members');
  
  // ... add other template sheets
  
  XLSX.writeFile(workbook, 'capacity-planner-template.xlsx');
}
```

## User Interface

### Settings → Import/Export Section

```
┌─────────────────────────────────────────────────────────┐
│ Import / Export                                          │
├─────────────────────────────────────────────────────────┤
│ Export Data                                              │
│                                                          │
│ [Export JSON]  [Export Excel]                           │
│                                                          │
│ Full backup of all data including team, projects,       │
│ assignments, and settings.                               │
├─────────────────────────────────────────────────────────┤
│ Import Data                                              │
│                                                          │
│ [Import JSON]  [Import Excel]  [Download Template]      │
│                                                          │
│ ⚠ Warning: Importing will replace all existing data.    │
│   Consider exporting a backup first.                     │
└─────────────────────────────────────────────────────────┘
```

## Validation

### Import Validation
```typescript
function validateImport(data: unknown): ValidationResult {
  const errors: string[] = [];
  
  // Check required fields
  if (!data.teamMembers) errors.push('Missing team members');
  if (!data.projects) errors.push('Missing projects');
  
  // Check references
  for (const project of data.projects) {
    for (const systemId of project.systemIds) {
      if (!data.systems.find(s => s.id === systemId)) {
        errors.push(`Project ${project.name} references unknown system ${systemId}`);
      }
    }
  }
  
  // Check data types
  for (const member of data.teamMembers) {
    if (typeof member.maxConcurrentProjects !== 'number') {
      errors.push(`Invalid maxConcurrentProjects for ${member.name}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

## Best Practices

1. **Export before import**: Always create a backup first
2. **Use JSON for backups**: Full fidelity, no data loss
3. **Use Excel for bulk edits**: Easier to edit in spreadsheet
4. **Validate IDs**: Ensure referenced IDs exist
5. **Test with sample**: Import to test environment first

## Limitations

- **Jira tokens**: API tokens not included in exports (security)
- **Large files**: Excel has row limits (~1M rows)
- **Formulas**: Excel formulas not supported in import
- **Images**: No image/attachment support

## Error Handling

```typescript
try {
  await importFromJSON(file);
  showToast('Import successful', 'success');
} catch (error) {
  if (error.message.includes('JSON')) {
    showToast('Invalid JSON format', 'error');
  } else if (error.message.includes('version')) {
    showToast('Incompatible file version', 'error');
  } else {
    showToast('Import failed: ' + error.message, 'error');
  }
}
```
