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
}

export interface TimeOff {
  id?: string;
  memberId: string;
  quarter: string; // "Q1 2026" format
  days: number;
  reason?: string;
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

export type ViewType = 'dashboard' | 'timeline' | 'projects' | 'team' | 'settings';
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

export interface JiraConnection {
  id: string;
  name: string;
  jiraBaseUrl: string;
  jiraProjectKey: string;
  jiraProjectId?: string;
  jiraProjectName?: string;
  apiToken: string;
  userEmail: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus: JiraSyncStatus;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
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
  mappedProjectId?: string;
  mappedPhaseId?: string;
  mappedMemberId?: string;
}

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
}

export interface JiraSyncResult {
  success: boolean;
  itemsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsRemoved: number;
  errors: string[];
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIOS (What-If Planning)
// ═══════════════════════════════════════════════════════════════════════════

export interface Scenario {
  id: string;
  name: string;
  description?: string;
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
