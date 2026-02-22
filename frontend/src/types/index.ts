/**
 * Type definitions for the Capacity Planner application
 */

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BASE ENTITIES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface Country {
  id: string;
  code: string;
  name: string;
  flag?: string; // Emoji flag
}

export interface PublicHoliday {
  id: string;
  countryId: string;
  date: string; // YYYY-MM-DD format
  name: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface Skill {
  id: string;
  name: string;
  category: 'System' | 'Process' | 'Technical';
}

export interface System {
  id: string;
  name: string;
  description?: string;
}

export interface Squad {
  id: string;
  name: string;   // e.g. "ERP" | "EPM"
}

export interface ProcessTeam {
  id: string;
  name: string;   // e.g. "R2R" | "L2C" | "P2P" | "Planning" | "Treasury" | "FP&A"
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TEAM MEMBERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  countryId: string;
  skillIds: string[];
  maxConcurrentProjects: number;
  // Organisational structure
  squadId?: string;                  // IT team: ERP or EPM
  processTeamIds?: string[];         // Cross-functional process teams: R2R, L2C, P2P, etc.
  // Jira integration fields
  email?: string;                    // For matching with Jira assignees
  jiraAccountId?: string;            // Jira user account ID
  syncedFromJira?: boolean;          // True if auto-created from Jira
  needsEnrichment?: boolean;         // True if missing local fields (country, role, etc.)
}

export interface TimeOff {
  id: string;
  memberId: string;
  startDate: string; // ISO date "2026-04-15"
  endDate: string;   // ISO date "2026-04-19"
  note?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROJECTS & PHASES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type ProjectPriority = 'High' | 'Medium' | 'Low';
export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Cancelled';

export interface Assignment {
  memberId: string;
  quarter: string;       // "Q1 2026" format - always set (for aggregation)
  days: number;
  sprint?: string;       // "Sprint 1 2026" format - optional for sprint-level detail
  jiraSynced?: boolean;  // true = auto-created from Jira; false/undefined = manually set
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPRINTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface Sprint {
  id: string;           // "sprint-1-2026"
  name: string;         // "Sprint 1"
  number: number;       // 1-16
  year: number;
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  quarter: string;      // "Q1 2026" - parent quarter
  isByeWeek?: boolean;  // True if this is a bye week (no sprint)
}

export interface Phase {
  id: string;
  name: string;
  startQuarter: string;
  endQuarter: string;
  requiredSkillIds: string[];
  predecessorPhaseId: string | null;
  assignments: Assignment[];
  jiraSourceKey?: string;   // Jira key of the Feature/Epic this phase was created from
}

export interface Project {
  id: string;
  name: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  systemIds: string[];
  devopsLink?: string;
  description?: string;
  phases: Phase[];
  jiraSourceKey?: string;   // Jira key of the Epic/Feature this project was created from
  syncedFromJira?: boolean; // true = created automatically during Jira sync
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SETTINGS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface Settings {
  bauReserveDays: number;
  hoursPerDay: number;
  defaultView: string;
  quartersToShow: number;
  defaultCountryId: string;
  darkMode: boolean;
  // Sprint configuration
  sprintDurationWeeks: number;
  sprintStartDate: string;
  sprintsToShow: number;
  sprintsPerYear: number;
  byeWeeksAfter: number[];
  holidayWeeksAtEnd: number;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// APPLICATION STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface AppState {
  version: number;
  lastModified: string;
  settings: Settings;
  countries: Country[];
  publicHolidays: PublicHoliday[];
  roles: Role[];
  skills: Skill[];
  systems: System[];
  squads: Squad[];
  processTeams: ProcessTeam[];
  teamMembers: TeamMember[];
  projects: Project[];
  timeOff: TimeOff[];
  quarters: string[];
  sprints: Sprint[];
  jiraConnections: JiraConnection[];
  jiraWorkItems: JiraWorkItem[];
  jiraSettings: JiraSettings;
  // Scenario support
  scenarios: Scenario[];
  activeScenarioId: string | null; // null = viewing Jira Baseline
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CAPACITY CALCULATIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type CapacityStatus = 'normal' | 'warning' | 'overallocated';

export interface CapacityBreakdownItem {
  type: 'bau' | 'timeoff' | 'project';
  days: number;
  reason?: string;
  projectId?: string;
  projectName?: string;
  phaseId?: string;
  phaseName?: string;
}

export interface CapacityResult {
  totalWorkdays: number;
  usedDays: number;
  availableDays: number;
  availableDaysRaw: number; // Can be negative
  usedPercent: number;
  status: CapacityStatus;
  breakdown: CapacityBreakdownItem[];
}

export interface MemberCapacitySummary {
  memberId: string;
  memberName: string;
  role: string;
  countryCode: string;
  quarters: Record<string, CapacityResult>;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UI STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type ViewType = 'dashboard' | 'timeline' | 'projects' | 'team' | 'jira' | 'settings';
export type TeamViewMode = 'current' | 'all';
export type ProjectViewMode = 'cards' | 'list';
export type TimelineViewMode = 'week' | 'month' | 'quarter' | 'year';

export interface Filters {
  member: string[];
  system: string[];
  status: string[];
}

export interface ProjectFilters {
  search: string;
  priority: string;
  status: string;
  system: string;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WARNINGS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface OverallocationWarning {
  member: TeamMember;
  usedDays: number;
  totalDays: number;
  quarter: string;
}

export interface HighUtilizationWarning {
  member: TeamMember;
  usedDays: number;
  totalDays: number;
  usedPercent: number;
  quarter: string;
}

export interface TooManyProjectsWarning {
  member: TeamMember;
  count: number;
  max: number;
}

export interface SkillMismatchWarning {
  member: TeamMember;
  project: Project;
  phase: Phase;
  missingSkills: string[];
}

export interface Warnings {
  overallocated: OverallocationWarning[];
  highUtilization: HighUtilizationWarning[];
  tooManyProjects: TooManyProjectsWarning[];
  skillMismatch: SkillMismatchWarning[];
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// QUARTER UTILITIES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface QuarterRange {
  start: Date;
  end: Date;
  quarter: number;
  year: number;
}

// JIRA INTEGRATION

export type JiraItemType = 'epic' | 'feature' | 'story' | 'task' | 'bug';
export type JiraSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// US-011: one entry per sync attempt, kept on the connection record
export interface JiraSyncHistoryEntry {
  timestamp: string;
  status: 'success' | 'error';
  itemsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsRemoved: number;
  mappingsPreserved: number;
  error?: string;
}

export type JiraHierarchyMode = 'auto' | 'epic_as_project' | 'feature_as_project';

export interface JiraConnection {
  id: string;
  name: string;
  jiraBaseUrl: string;
  jiraProjectKey: string;
  jiraProjectId?: string;
  jiraProjectName?: string;
  apiToken: string;          // stored value (plain text for now — US-010 masks in UI)
  apiTokenMasked?: string;   // display-only masked version: "••••••••abcd"
  userEmail: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus: JiraSyncStatus;
  lastSyncError?: string;
  syncHistory?: JiraSyncHistoryEntry[];  // US-011
  createdAt: string;
  updatedAt: string;
  // Import behaviour settings
  hierarchyMode: JiraHierarchyMode;    // how to map Jira types to Projects/Phases
  autoCreateProjects: boolean;         // auto-create Projects/Phases on sync
  autoCreateAssignments: boolean;      // auto-create Assignments from sprint+SP on sync
  defaultDaysPerItem: number;          // fallback effort when story points absent (days)
}

export interface JiraWorkItem {
  id: string;
  connectionId: string;
  jiraKey: string;
  jiraId: string;
  summary: string;
  description?: string;
  type: JiraItemType;
  typeName: string;
  status: string;
  statusCategory: 'todo' | 'in_progress' | 'done';
  priority?: string;
  storyPoints?: number;
  originalEstimate?: number;
  timeSpent?: number;
  remainingEstimate?: number;
  assigneeEmail?: string;
  assigneeName?: string;
  reporterEmail?: string;
  reporterName?: string;
  parentKey?: string;
  parentId?: string;
  sprintId?: string;
  sprintName?: string;
  labels: string[];
  components: string[];
  created: string;
  updated: string;
  startDate?: string;  // YYYY-MM-DD from Jira (custom field or planned start)
  dueDate?: string;    // YYYY-MM-DD from Jira duedate field
  mappedProjectId?: string;
  mappedPhaseId?: string;
  mappedMemberId?: string;
}

/**
 * Controls which Jira statuses are included when syncing a particular item type.
 * - all:          No status filter (fetch everything regardless of status)
 * - exclude_done: Exclude items whose statusCategory is "Done" (To Do + In Progress)
 * - active_only:  Only "To Do" and "In Progress" (same as exclude_done in practice, clearer intent)
 * - todo_only:    Only items that haven't been started yet
 */
export type JiraStatusFilter = 'all' | 'exclude_done' | 'active_only' | 'todo_only';

export interface JiraSettings {
  storyPointsToDays: number;
  defaultVelocity: number;
  syncFrequency: 'manual' | 'hourly' | 'daily';
  autoMapByName: boolean;
  syncEpics: boolean;
  syncFeatures: boolean;
  syncStories: boolean;
  syncTasks: boolean;
  syncBugs: boolean;
  includeSubtasks: boolean;
  // Per-item-type status filters — control which Jira statuses are fetched for each type
  statusFilterEpics: JiraStatusFilter;
  statusFilterFeatures: JiraStatusFilter;
  statusFilterStories: JiraStatusFilter;
  statusFilterTasks: JiraStatusFilter;
  statusFilterBugs: JiraStatusFilter;
}

export interface JiraSyncResult {
  success: boolean;
  itemsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsRemoved: number;
  mappingsPreserved: number;
  projectsCreated: number;
  projectsUpdated: number;
  assignmentsCreated: number;
  errors: string[];
  timestamp: string;
  items?: JiraWorkItem[]; // Fetched items (before merging)
}

// US-007: diff preview before a sync is applied
export interface JiraSyncDiff {
  connectionId: string;
  toAdd: JiraWorkItem[];
  toUpdate: JiraWorkItem[];
  toRemove: JiraWorkItem[];
  mappingsToPreserve: number;
  fetchedItems: JiraWorkItem[]; // full list, ready to apply after user confirms
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIOS (What-If Planning)
// ═══════════════════════════════════════════════════════════════════════════

export type ScenarioColor = 'purple' | 'blue' | 'green' | 'orange' | 'rose' | 'yellow';

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  color?: ScenarioColor;   // Visual label colour for the scenario chip
  createdAt: string;
  updatedAt: string;
  basedOnSyncAt?: string; // When the Jira data was synced that this scenario is based on
  isBaseline: boolean; // True for the "Jira Baseline" scenario (read-only when viewing)
  // Scenario-specific data (copies from baseline, then editable)
  projects: Project[];
  teamMembers: TeamMember[];
  assignments: Assignment[]; // Flattened assignments for easier scenario editing
  timeOff: TimeOff[];
  jiraWorkItems: JiraWorkItem[];
}
