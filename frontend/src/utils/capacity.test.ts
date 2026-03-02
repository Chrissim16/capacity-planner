import { describe, it, expect } from 'vitest';
import {
  calculateCapacity,
  calculateBusinessCapacity,
  sprintNameToQuarter,
} from './capacity';
import type { AppState, BusinessContact, BusinessAssignment } from '../types';

// ── Minimal AppState fixture ──────────────────────────────────────────────────

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    teamMembers: [],
    projects: [],
    assignments: [],
    timeOff: [],
    sprints: [],
    jiraWorkItems: [],
    jiraConnections: [],
    businessContacts: [],
    businessAssignments: [],
    businessTimeOff: [],
    jiraItemBizAssignments: [],
    localPhases: [],
    scenarios: [],
    activeScenarioId: null,
    quarters: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    skills: [],
    systems: [],
    squads: [],
    processTeams: [],
    countries: [],
    publicHolidays: [],
    settings: {
      bauReserveDays: 5,
      hoursPerDay: 8,
      defaultView: 'dashboard',
      quartersToShow: 4,
      defaultCountryId: 'country-nl',
      darkMode: false,
      confidenceLevels: { high: 5, medium: 15, low: 25, defaultLevel: 'medium' },
      sprintDurationWeeks: 3,
      sprintStartDate: '2026-01-05',
      sprintsToShow: 6,
      sprintsPerYear: 16,
      byeWeeksAfter: [8, 12],
      holidayWeeksAtEnd: 2,
    },
    jiraSettings: {
      defaultVelocity: 30,
      syncFrequency: 'manual',
      autoMapByName: true,
      syncEpics: true,
      syncFeatures: true,
      syncStories: true,
      syncTasks: false,
      syncBugs: false,
      includeSubtasks: false,
      statusFilterEpics: 'exclude_done',
      statusFilterFeatures: 'active_only',
      statusFilterStories: 'active_only',
      statusFilterTasks: 'active_only',
      statusFilterBugs: 'active_only',
      defaultConfidenceLevel: 'medium',
    },
    ...overrides,
  };
}

// ── calculateCapacity ─────────────────────────────────────────────────────────

describe('calculateCapacity', () => {
  it('returns zeros for unknown member', () => {
    const state = makeState();
    const result = calculateCapacity('unknown-id', 'Q1 2026', state);
    expect(result.totalWorkdays).toBe(0);
    expect(result.usedDays).toBe(0);
    expect(result.status).toBe('normal');
  });

  it('deducts BAU reserve from available days', () => {
    const state = makeState({
      teamMembers: [{ id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3, isActive: true, syncedFromJira: false, needsEnrichment: false, workingDaysPerWeek: 5, workingHoursPerDay: 8 }],
    });
    const result = calculateCapacity('m1', 'Q1 2026', state);
    // Q1 2026 NL = 64 workdays; BAU = 5 → usedDays starts at 5
    expect(result.usedDays).toBeGreaterThanOrEqual(5);
    expect(result.breakdown.some(b => b.type === 'bau')).toBe(true);
  });

  it('marks status as overallocated when usedDays > totalWorkdays', () => {
    const state = makeState({
      teamMembers: [{ id: 'm1', name: 'Bob', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3, isActive: true, syncedFromJira: false, needsEnrichment: false, workingDaysPerWeek: 5, workingHoursPerDay: 8 }],
      projects: [{
        id: 'p1',
        name: 'Over Project',
        priority: 'High',
        status: 'Active',
        systemIds: [],
        phases: [{
          id: 'ph1',
          name: 'Phase 1',
          startQuarter: 'Q1 2026',
          endQuarter: 'Q1 2026',
          assignments: [{ id: 'a1', memberId: 'm1', projectId: 'p1', phaseId: 'ph1', quarter: 'Q1 2026', days: 100 }],
        }],
        devopsLink: '',
        description: '',
        archived: false,
      }],
    });
    const result = calculateCapacity('m1', 'Q1 2026', state);
    expect(result.status).toBe('overallocated');
    expect(result.usedDays).toBeGreaterThan(result.totalWorkdays);
  });

  it('counts time-off days that fall within the quarter', () => {
    const state = makeState({
      teamMembers: [{ id: 'm1', name: 'Carol', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3, isActive: true, syncedFromJira: false, needsEnrichment: false, workingDaysPerWeek: 5, workingHoursPerDay: 8 }],
      timeOff: [{ id: 'to1', memberId: 'm1', quarter: 'Q1 2026', startDate: '2026-01-05', endDate: '2026-01-09', days: 5 }],
    });
    const result = calculateCapacity('m1', 'Q1 2026', state);
    const timeOffItem = result.breakdown.find(b => b.type === 'timeoff');
    expect(timeOffItem).toBeDefined();
    expect(timeOffItem!.days).toBe(5); // Mon–Fri = 5 workdays
  });
});

// ── calculateBusinessCapacity ─────────────────────────────────────────────────

function makeContact(overrides: Partial<BusinessContact> = {}): BusinessContact {
  return {
    id: 'bc1',
    name: 'David',
    role: 'Controller',
    countryId: 'country-nl',
    email: 'david@example.com',
    bauReserveDays: 5,
    workingDaysPerWeek: 5,
    workingHoursPerDay: 8,
    processTeamIds: [],
    archived: false,
    excludedFromCapacity: false,
    ...overrides,
  };
}

describe('calculateBusinessCapacity', () => {
  it('returns 0 allocated when no assignments exist', () => {
    const contact = makeContact({ bauReserveDays: 0 });
    const result = calculateBusinessCapacity(contact, '2026-01-05', '2026-01-09', [], [], [], []);
    expect(result.allocatedDays).toBe(0);
  });

  it('includes BAU reserve in allocated days', () => {
    const contact = makeContact({ bauReserveDays: 10 });
    const result = calculateBusinessCapacity(contact, '2026-01-05', '2026-01-09', [], [], [], []);
    // BAU prorated to the week — some fraction of 10 days per quarter
    expect(result.allocatedDays).toBeGreaterThan(0);
    expect(result.breakdownByProject.some(b => b.projectId === '__bau__')).toBe(true);
  });

  it('scales availability by workingDaysPerWeek', () => {
    const fullTime = makeContact({ workingDaysPerWeek: 5, bauReserveDays: 0 });
    const partTime = makeContact({ workingDaysPerWeek: 3, bauReserveDays: 0 });
    const fullResult = calculateBusinessCapacity(fullTime, '2026-01-05', '2026-01-09', [], [], [], []);
    const partResult = calculateBusinessCapacity(partTime, '2026-01-05', '2026-01-09', [], [], [], []);
    expect(partResult.availableDays).toBeLessThan(fullResult.availableDays);
    expect(partResult.availableDays).toBeCloseTo(fullResult.availableDays * 0.6, 1);
  });

  it('counts an assignment that overlaps the week', () => {
    const contact = makeContact({ bauReserveDays: 0 });
    const assignment: BusinessAssignment = {
      id: 'ba1',
      contactId: 'bc1',
      projectId: 'p1',
      phaseId: 'ph1',
      quarter: 'Q1 2026',
      days: 10,
    };
    const project = {
      id: 'p1', name: 'Project A', priority: 'High', status: 'Active',
      systemIds: [], archived: false, devopsLink: '', description: '',
      phases: [{
        id: 'ph1', name: 'Phase 1',
        startDate: '2026-01-01', endDate: '2026-03-31',
        assignments: [],
      }],
    };
    const result = calculateBusinessCapacity(
      contact, '2026-01-05', '2026-01-09',
      [assignment], [], [], [project as any]
    );
    expect(result.allocatedDays).toBeGreaterThan(0);
  });
});

// ── sprintNameToQuarter ───────────────────────────────────────────────────────

describe('sprintNameToQuarter', () => {
  const sprints = [
    { id: 's1', name: 'S1', number: 1, year: 2026, startDate: '2026-01-05', endDate: '2026-01-23', quarter: 'Q1 2026' },
    { id: 's5', name: 'S5', number: 5, year: 2026, startDate: '2026-04-06', endDate: '2026-04-24', quarter: 'Q2 2026' },
  ];

  it('matches sprint name to quarter', () => {
    expect(sprintNameToQuarter('S1', sprints)).toBe('Q1 2026');
    expect(sprintNameToQuarter('S5', sprints)).toBe('Q2 2026');
  });

  it('returns null for unrecognised sprint name', () => {
    expect(sprintNameToQuarter('S99', sprints)).toBeNull();
    expect(sprintNameToQuarter(undefined, sprints)).toBeNull();
  });
});
