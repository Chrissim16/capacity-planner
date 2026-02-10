/**
 * Type definitions for the Capacity Planner application
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BASE ENTITIES
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBERS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS & PHASES
// ═══════════════════════════════════════════════════════════════════════════════

export type ProjectPriority = 'High' | 'Medium' | 'Low';
export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Cancelled';

export interface Assignment {
  memberId: string;
  quarter: string;       // "Q1 2026" format - always set (for aggregation)
  days: number;
  sprint?: string;       // "Sprint 1 2026" format - optional for sprint-level detail
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPRINTS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════════════════════════

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
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPACITY CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// UI STATE
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// WARNINGS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// QUARTER UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuarterRange {
  start: Date;
  end: Date;
  quarter: number;
  year: number;
}
