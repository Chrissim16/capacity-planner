import { describe, it, expect } from 'vitest';
import {
  calculateCapacity,
  calculateBusinessCapacity,
  sprintNameToQuarter,
} from './capacity';
import type { AppState, BusinessContact, JiraItemBizAssignment, JiraWorkItem } from '../types';

// ── Minimal AppState fixture ──────────────────────────────────────────────────

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    teamMembers: [],
    timeOff: [],
    sprints: [],
    jiraWorkItems: [],
    jiraConnections: [],
    businessContacts: [],
    businessTimeOff: [],
    jiraItemBizAssignments: [],
    scenarios: [],
    activeScenarioId: null,
    quarters: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    skills: [],
    systems: [],
    squads: [],
    processTeams: [],
    roles: [],
    countries: [],
    publicHolidays: [],
    version: 11,
    lastModified: new Date().toISOString(),
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
      teamMembers: [{ id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3 }],
    });
    const result = calculateCapacity('m1', 'Q1 2026', state);
    // Q1 2026 NL = 64 workdays; BAU = 5 → usedDays starts at 5
    expect(result.usedDays).toBeGreaterThanOrEqual(5);
    expect(result.breakdown.some(b => b.type === 'bau')).toBe(true);
  });

  it('marks status as overallocated when Jira items exceed capacity', () => {
    const sprint = { id: 's1', name: 'Sprint 1', number: 1, year: 2026, startDate: '2026-01-05', endDate: '2026-01-23', quarter: 'Q1 2026' };
    const jiraItem: JiraWorkItem = {
      id: 'wi1', connectionId: 'c1', jiraKey: 'ERP-1', jiraId: '1',
      summary: 'Big Story', description: undefined,
      type: 'story', typeName: 'Story',
      status: 'In Progress', statusCategory: 'in_progress',
      storyPoints: 200, // way over capacity
      assigneeEmail: 'bob@example.com', assigneeName: 'Bob',
      sprintId: 's1', sprintName: 'Sprint 1',
      labels: [], components: [],
      created: '2026-01-01', updated: '2026-01-01',
    };
    const state = makeState({
      teamMembers: [{ id: 'm1', name: 'Bob', role: 'Dev', countryId: 'country-nl', email: 'bob@example.com', skillIds: [], maxConcurrentProjects: 3 }],
      sprints: [sprint],
      jiraWorkItems: [jiraItem],
    });
    const result = calculateCapacity('m1', 'Q1 2026', state);
    expect(result.status).toBe('overallocated');
    expect(result.usedDays).toBeGreaterThan(result.totalWorkdays);
  });

  it('counts time-off days that fall within the quarter', () => {
    const state = makeState({
      teamMembers: [{ id: 'm1', name: 'Carol', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3 }],
      timeOff: [{ id: 'to1', memberId: 'm1', startDate: '2026-01-05', endDate: '2026-01-09' }],
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

  it('counts a JiraItemBizAssignment that overlaps the week', () => {
    const contact = makeContact({ bauReserveDays: 0 });
    const jiraItem: JiraWorkItem = {
      id: 'wi1', connectionId: 'c1', jiraKey: 'ERP-100', jiraId: '100',
      summary: 'Feature A', description: undefined,
      type: 'feature', typeName: 'Feature',
      status: 'In Progress', statusCategory: 'in_progress',
      sprintStartDate: '2026-01-01', sprintEndDate: '2026-03-31',
      labels: [], components: [],
      created: '2026-01-01', updated: '2026-01-01',
    };
    const assignment: JiraItemBizAssignment = {
      id: 'ba1',
      jiraKey: 'ERP-100',
      contactId: 'bc1',
      days: 10,
    };
    const result = calculateBusinessCapacity(
      contact, '2026-01-05', '2026-01-09',
      [assignment], [], [], [jiraItem]
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
