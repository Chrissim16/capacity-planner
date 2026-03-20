/**
 * Type definitions for the Capacity Planner application
 */

// ═══════════════════════════════════════════════════════════════════════════
// BASE ENTITIES
// ═══════════════════════════════════════════════════════════════════════════

export interface Country {
  id: string;
  code: string;
  name: string;
  flag?: string;
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
  name: string;
}

export interface ProcessTeam {
  id: string;
  name: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAM MEMBERS
// ═══════════════════════════════════════════════════════════════════════════

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  countryId: string;
  skillIds: string[];
  maxConcurrentProjects: number;
  squadId?: string;
  processTeamIds?: string[];
  email?: string;
  jiraAccountId?: string;
  syncedFromJira?: boolean;
  needsEnrichment?: boolean;
  excludedFromCapacity?: boolean;
  nameManuallyEdited?: boolean;
}

export interface TimeOff {
  id: string;
  memberId: string;
  startDate: string;
  endDate: string;
  note?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SPRINTS
// ═══════════════════════════════════════════════════════════════════════════

export interface Sprint {
  id: string;
  name: string;
  number: number;
  year: number;
  startDate: string;
  endDate: string;
  quarter: string;
  isByeWeek?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

export interface Settings {
  bauReserveDays: number;
  hoursPerDay: number;
  defaultView: string;
  quartersToShow: number;
  defaultCountryId: string;
  darkMode: boolean;
  confidenceLevels: {
    high: number;
    medium: number;
    low: number;
    defaultLevel: ConfidenceLevel;
  };
  sprintDurationWeeks: number;
  sprintStartDate: string;
  sprintsToShow: number;
  sprintsPerYear: number;
  byeWeeksAfter: number[];
  holidayWeeksAtEnd: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS CONTACTS
// ═══════════════════════════════════════════════════════════════════════════

export interface BusinessContact {
  id: string;
  name: string;
  title?: string;
  department?: string;
  email?: string;
  countryId: string;
  workingDaysPerWeek?: number;
  workingHoursPerDay?: number;
  bauReserveDays?: number;
  processTeamIds?: string[];
  notes?: string;
  archived?: boolean;
  excludedFromCapacity?: boolean;
}

export interface BusinessTimeOff {
  id: string;
  contactId: string;
  startDate: string;
  endDate: string;
  type: 'holiday' | 'other';
  notes?: string;
}

/** Links a BusinessContact to a specific Jira work item (Feature, Story, Task, Bug) */
export interface JiraItemBizAssignment {
  id: string;
  /** Jira issue key, e.g. "ERP-1976" — must match JiraWorkItem.jiraKey */
  jiraKey: string;
  contactId: string;
  days?: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════════════════════

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
  timeOff: TimeOff[];
  quarters: string[];
  sprints: Sprint[];
  jiraConnections: JiraConnection[];
  jiraWorkItems: JiraWorkItem[];
  jiraSettings: JiraSettings;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  businessContacts: BusinessContact[];
  businessTimeOff: BusinessTimeOff[];
  jiraItemBizAssignments: JiraItemBizAssignment[];
  // Baseline-level planning data (scenario overrides live in Scenario.projects / Scenario.assignments)
  projects: Project[];
  assignments: Assignment[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CAPACITY CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

export type CapacityStatus = 'normal' | 'warning' | 'overallocated';

export interface CapacityBreakdownItem {
  type: 'bau' | 'timeoff' | 'jira' | 'assignment';
  days: number;
  reason?: string;
  jiraKey?: string;
  jiraSummary?: string;
}

export interface CapacityResult {
  totalWorkdays: number;
  usedDays: number;
  availableDays: number;
  availableDaysRaw: number;
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

// ═══════════════════════════════════════════════════════════════════════════
// UI STATE
// ═══════════════════════════════════════════════════════════════════════════

export type ViewType = 'dashboard' | 'timeline' | 'projects' | 'team' | 'jira' | 'scenarios' | 'planner' | 'settings';
export type TeamViewMode = 'current' | 'all';
export type TimelineViewMode = 'week' | 'month' | 'quarter' | 'year';

export interface Filters {
  member: string[];
  system: string[];
  status: string[];
}

export interface EpicFilters {
  search: string;
  priority: string;
  status: string;
  label: string;
  squad: string;
  processTeam: string;
  itMember: string;
  bizContact: string;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// ═══════════════════════════════════════════════════════════════════════════
// WARNINGS
// ═══════════════════════════════════════════════════════════════════════════

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

export interface Warnings {
  overallocated: OverallocationWarning[];
  highUtilization: HighUtilizationWarning[];
  tooManyProjects: TooManyProjectsWarning[];
}

// ═══════════════════════════════════════════════════════════════════════════
// QUARTER UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export interface QuarterRange {
  start: Date;
  end: Date;
  quarter: number;
  year: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// JIRA INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export type JiraItemType = 'epic' | 'feature' | 'story' | 'task' | 'bug';
export type JiraSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface JiraSyncHistoryEntry {
  timestamp: string;
  status: 'success' | 'error';
  itemsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsRemoved: number;
  error?: string;
}

export interface JiraConnection {
  id: string;
  name: string;
  jiraBaseUrl: string;
  jiraProjectKey: string;
  jiraProjectId?: string;
  jiraProjectName?: string;
  apiToken: string;
  apiTokenMasked?: string;
  userEmail: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus: JiraSyncStatus;
  lastSyncError?: string;
  syncHistory?: JiraSyncHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  defaultDaysPerItem: number;
  jqlFilter?: string;
  customFieldIds?: {
    epicLink?:    string;
    epicLinkAlt?: string;
    startDate?:   string;
    sprint?:      string;
  };
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
  /** Sprint start/end dates from Jira's sprint object — used for Gantt bar positioning */
  sprintStartDate?: string;
  sprintEndDate?: string;
  labels: string[];
  components: string[];
  created: string;
  updated: string;
  startDate?: string;
  dueDate?: string;
  /** Set to true when not returned by the last sync query. Cleared when found again. */
  staleFromJira?: boolean;
  /** Per-item confidence override. Falls back to JiraSettings.defaultConfidenceLevel. */
  confidenceLevel?: ConfidenceLevel;
  /** Hierarchy level — used by the Planning Board to build the Epic → Feature → Story tree. */
  hierarchyLevel?: 'epic' | 'feature' | 'story' | 'subtask';
}

/**
 * Controls which Jira statuses are included when syncing a particular item type.
 */
export type JiraStatusFilter = 'all' | 'exclude_done' | 'active_only' | 'todo_only';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface JiraSettings {
  defaultVelocity: number;
  syncFrequency: 'manual' | 'hourly' | 'daily';
  autoMapByName: boolean;
  syncEpics: boolean;
  syncFeatures: boolean;
  syncStories: boolean;
  syncTasks: boolean;
  syncBugs: boolean;
  includeSubtasks: boolean;
  statusFilterEpics: JiraStatusFilter;
  statusFilterFeatures: JiraStatusFilter;
  statusFilterStories: JiraStatusFilter;
  statusFilterTasks: JiraStatusFilter;
  statusFilterBugs: JiraStatusFilter;
  defaultConfidenceLevel: ConfidenceLevel;
}

export interface JiraSyncResult {
  success: boolean;
  itemsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsRemoved: number;
  errors: string[];
  timestamp: string;
  items?: JiraWorkItem[];
}

export interface JiraSyncDiff {
  connectionId: string;
  toAdd: JiraWorkItem[];
  toUpdate: JiraWorkItem[];
  /** Items no longer in Jira — will be deleted. */
  toRemove: JiraWorkItem[];
  fetchedItems: JiraWorkItem[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS & ASSIGNMENTS (Scenario-native planning)
// ═══════════════════════════════════════════════════════════════════════════

export type ProjectPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * A scenario-native project created via the Scenario Wizard or Planning Board.
 * Not derived from Jira — represents work that is being planned in what-if mode.
 */
export interface Project {
  id: string;
  name: string;
  priority: ProjectPriority;
  requiredSkillIds: string[];
  /** Target effort in days per quarter, e.g. { "Q2 2026": 20 } */
  daysPerQuarter: Record<string, number>;
  createdAt: string;
}

/**
 * A manual assignment of a team member (IT or BIZ) to a project or Jira work item.
 * `projectId` is either a Project.id or a JiraWorkItem.jiraKey depending on context.
 */
export interface Assignment {
  id: string;
  memberId: string;
  projectId: string;
  quarter: string;
  days: number;
  /** True when memberId refers to a BusinessContact rather than a TeamMember */
  isBizContact?: boolean;
  /** ISO 8601 start date for sub-quarter precision. When set, `quarter` is derived from this date. */
  startDate?: string;
  /** ISO 8601 end date for sub-quarter precision. `days` is recomputed from the range when set. */
  endDate?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIOS (What-If Planning)
// ═══════════════════════════════════════════════════════════════════════════

export type ScenarioColor = 'purple' | 'blue' | 'green' | 'orange' | 'rose' | 'yellow';

// ─── Scenario Planner types ──────────────────────────────────────────────────

/** All item types that can appear on the planner timeline. Extends JiraItemType with UAT and Hypercare. */
export type PlannerItemType = JiraItemType | 'uat' | 'hypercare';

/** One person's effort allocation on a single PlannerItem. */
export interface PlannerAssignment {
  memberId: string;
  track: 'IT' | 'BIZ';
  /** Flat effort per sprint across all sprints the item covers (1–10 days) */
  daysPerSprint: number;
}

/** One item placed on the planner timeline — Jira-sourced or manually created. */
export interface PlannerItem {
  id: string;
  /** References JiraWorkItem.id when sourced from Jira; empty string for manually created items */
  sourceId: string;
  name: string;
  type: PlannerItemType;
  jiraKey?: string;
  /** Parent's jiraKey — preserves Epic → Feature → Story hierarchy for expand/collapse */
  parentKey?: string;
  /** Sprint number (1–24) where this item starts */
  startSprint: number;
  /** Duration in sprints (minimum 1) */
  spanSprints: number;
  assignees: PlannerAssignment[];
  /** Committed work — immovable by default; true for in_progress or manually committed items */
  locked: boolean;
  /** PM explicitly unlocked this item for exploration in this scenario */
  unlockedInScenario: boolean;
  /** True for items created directly in the planner, not sourced from Jira */
  isManual: boolean;
  /** Jira labels copied on import; editable for manually created items */
  labels: string[];
  /** Jira assignee display names — shown as suggestions in Blank Slate, pre-loaded as assignments in Baseline */
  jiraAssignees: string[];
  /** ISO date from Jira start date — used for Baseline sprint position mapping */
  jiraStartDate?: string;
  /** ISO date from Jira due date — used for Baseline sprint span calculation */
  jiraEndDate?: string;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  color?: ScenarioColor;
  createdAt: string;
  updatedAt: string;
  /** Email or display name of the user who last edited this plan */
  lastEditedBy?: string;
  basedOnSyncAt?: string;
  isBaseline: boolean;
  // Scenario-specific data (copied from baseline, then editable)
  jiraWorkItems: JiraWorkItem[];
  jiraItemBizAssignments: JiraItemBizAssignment[];
  teamMembers: TeamMember[];
  timeOff: TimeOff[];
  // Scenario-native planning data (not Jira-derived)
  projects: Project[];
  assignments: Assignment[];
  /** Planner timeline layout — only populated for scenarios created or edited in the Scenario Planner */
  plannerLayout?: PlannerItem[];
}
