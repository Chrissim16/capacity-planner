# Data Models

This document describes all data structures used in the Capacity Planner. These correspond to TypeScript interfaces in `src/types/index.ts`.

## Entity Relationship Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Country   │────<│ TeamMember  │────<│   TimeOff   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │ (via Assignment)
       v                   v
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│PublicHoliday│     │   Project   │────<│    Phase    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │                   │
                           v                   v
                    ┌─────────────┐     ┌─────────────┐
                    │   System    │     │ Assignment  │
                    └─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│JiraConnectn │────<│JiraWorkItem │     │  Scenario   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Base Entities

### Country
```typescript
interface Country {
  id: string;          // "country-nl"
  code: string;        // "NL"
  name: string;        // "Netherlands"
  flag?: string;       // "🇳🇱" (emoji)
}
```

### PublicHoliday
```typescript
interface PublicHoliday {
  id: string;
  countryId: string;   // References Country.id
  date: string;        // "2026-01-01" (YYYY-MM-DD)
  name: string;        // "New Year's Day"
}
```

### Role
```typescript
interface Role {
  id: string;
  name: string;        // "Developer", "Analyst", "Architect"
}
```

### Skill
```typescript
interface Skill {
  id: string;
  name: string;
  category: 'System' | 'Process' | 'Technical';
}
```

### System
```typescript
interface System {
  id: string;
  name: string;        // "SAP", "Salesforce"
  description?: string;
}
```

## Team Members

### TeamMember
```typescript
interface TeamMember {
  id: string;
  name: string;
  role: string;                    // Role name (denormalized)
  countryId: string;               // References Country.id
  skillIds: string[];              // References Skill.id[]
  maxConcurrentProjects: number;   // Default: 3
}
```

### TimeOff
```typescript
interface TimeOff {
  id?: string;
  memberId: string;    // References TeamMember.id
  quarter: string;     // "Q1 2026"
  days: number;        // Number of days off
  reason?: string;     // "Vacation", "Training"
}
```

## Projects & Phases

### Project
```typescript
type ProjectPriority = 'High' | 'Medium' | 'Low';
type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Cancelled';

interface Project {
  id: string;
  name: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  systemIds: string[];      // References System.id[]
  devopsLink?: string;      // URL to Azure DevOps/Jira
  description?: string;
  phases: Phase[];          // Nested phases
}
```

### Phase
```typescript
interface Phase {
  id: string;
  name: string;             // "Discovery", "Build", "UAT"
  startQuarter: string;     // "Q1 2026"
  endQuarter: string;       // "Q2 2026"
  requiredSkillIds: string[];
  predecessorPhaseId: string | null;
  assignments: Assignment[];
}
```

### Assignment
```typescript
interface Assignment {
  memberId: string;         // References TeamMember.id
  quarter: string;          // "Q1 2026" (always set)
  days: number;             // Days allocated this quarter
  sprint?: string;          // "Sprint 1 2026" (optional detail)
}
```

## Sprints

### Sprint
```typescript
interface Sprint {
  id: string;               // "sprint-1-2026"
  name: string;             // "Sprint 1"
  number: number;           // 1-16
  year: number;             // 2026
  startDate: string;        // "2026-01-06" (YYYY-MM-DD)
  endDate: string;          // "2026-01-24"
  quarter: string;          // "Q1 2026" (parent quarter)
  isByeWeek?: boolean;      // True if no sprint (holiday/break)
}
```

## Jira Integration

### JiraConnection
```typescript
type JiraSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface JiraConnection {
  id: string;
  name: string;              // User-friendly name
  jiraBaseUrl: string;       // "https://company.atlassian.net"
  jiraProjectKey: string;    // "PROJ"
  jiraProjectId?: string;
  jiraProjectName?: string;
  apiToken: string;          // Jira API token (encrypted storage recommended)
  userEmail: string;         // Email for Basic Auth
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus: JiraSyncStatus;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}
```

### JiraWorkItem
```typescript
type JiraItemType = 'epic' | 'feature' | 'story' | 'task' | 'bug';

interface JiraWorkItem {
  id: string;                // Internal ID
  connectionId: string;      // References JiraConnection.id
  jiraKey: string;           // "PROJ-123"
  jiraId: string;            // Jira's internal ID
  summary: string;
  description?: string;
  type: JiraItemType;
  typeName: string;          // Original Jira type name
  status: string;            // "To Do", "In Progress", "Done"
  statusCategory: 'todo' | 'in_progress' | 'done';
  priority?: string;
  storyPoints?: number;
  originalEstimate?: number; // Hours
  timeSpent?: number;        // Hours
  remainingEstimate?: number;
  assigneeEmail?: string;
  assigneeName?: string;
  reporterEmail?: string;
  reporterName?: string;
  parentKey?: string;        // Epic/parent issue key
  parentId?: string;
  sprintId?: string;
  sprintName?: string;
  labels: string[];
  components: string[];
  created: string;
  updated: string;
  // Local mapping fields (preserved on re-sync)
  mappedProjectId?: string;
  mappedPhaseId?: string;
  mappedMemberId?: string;
}
```

### JiraSettings
```typescript
interface JiraSettings {
  storyPointsToDays: number;        // 1 SP = X days (default: 0.5)
  defaultVelocity: number;          // SP per sprint (default: 30)
  syncFrequency: 'manual' | 'hourly' | 'daily';
  autoMapByName: boolean;           // Auto-match by name similarity
  syncEpics: boolean;
  syncFeatures: boolean;
  syncStories: boolean;
  syncTasks: boolean;
  syncBugs: boolean;
  includeSubtasks: boolean;
}
```

## Scenarios

### Scenario
```typescript
interface Scenario {
  id: string;
  name: string;              // "Q3 Hiring Plan"
  description?: string;
  createdAt: string;
  updatedAt: string;
  basedOnSyncAt?: string;    // When Jira data was synced
  isBaseline: boolean;       // True for read-only Jira baseline
  // Scenario-specific copies (editable)
  projects: Project[];
  teamMembers: TeamMember[];
  assignments: Assignment[];
  timeOff: TimeOff[];
  jiraWorkItems: JiraWorkItem[];
}
```

## Settings

### Settings
```typescript
interface Settings {
  bauReserveDays: number;      // Days reserved for BAU per quarter
  hoursPerDay: number;         // Working hours (default: 8)
  defaultView: string;         // Starting page
  quartersToShow: number;      // Quarters in timeline
  defaultCountryId: string;    // Default country for new members
  darkMode: boolean;
  // Sprint configuration
  sprintDurationWeeks: number; // Default: 3
  sprintStartDate: string;     // First sprint start date
  sprintsToShow: number;       // Sprints in timeline
  sprintsPerYear: number;      // Default: 16
  byeWeeksAfter: number[];     // Sprint numbers followed by bye weeks
  holidayWeeksAtEnd: number;   // End-of-year holiday weeks
}
```

## Application State

### AppState
The root state object stored in localStorage:

```typescript
interface AppState {
  version: number;             // Schema version (for migrations)
  lastModified: string;
  settings: Settings;
  countries: Country[];
  publicHolidays: PublicHoliday[];
  roles: Role[];
  skills: Skill[];
  systems: System[];
  teamMembers: TeamMember[];
  projects: Project[];
  timeOff: TimeOff[];
  quarters: string[];          // Generated quarter strings
  sprints: Sprint[];
  jiraConnections: JiraConnection[];
  jiraWorkItems: JiraWorkItem[];
  jiraSettings: JiraSettings;
  scenarios: Scenario[];
  activeScenarioId: string | null;  // null = Jira Baseline
}
```

## ID Conventions

All IDs follow the pattern: `{type}-{timestamp}-{random}`

Examples:
- `project-1708012345678-abc123def`
- `member-1708012345678-xyz789ghi`
- `jira-conn-1708012345678-jkl456mno`

## Data Storage

- **Primary**: localStorage (`capacity-planner-data` key)
- **Format**: JSON
- **Persistence**: Zustand with persist middleware
- **Migration**: Version field enables schema migrations
