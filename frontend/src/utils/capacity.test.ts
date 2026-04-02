import { describe, it, expect } from 'vitest';
import {
  calculateCapacity,
  calculateBusinessCapacity,
  calculateSprintCapacity,
  sprintNameToQuarter,
  getWarnings,
} from './capacity';
import type { AppState, Assignment, BusinessContact, JiraItemBizAssignment, JiraWorkItem, Sprint } from '../types';

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
    projects: [],
    assignments: [],
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

  it('uses the global BAU by default but allows a per-member override', () => {
    const baseMember = {
      id: 'm1',
      name: 'Alice',
      role: 'Dev',
      countryId: 'country-nl',
      skillIds: [],
      maxConcurrentProjects: 3,
    };
    const defaultState = makeState({ teamMembers: [baseMember] });
    const overrideState = makeState({
      teamMembers: [{ ...baseMember, bauOverride: true, bauReserveDays: 2 }],
    });

    const defaultResult = calculateCapacity('m1', 'Q1 2026', defaultState);
    const overrideResult = calculateCapacity('m1', 'Q1 2026', overrideState);

    expect(defaultResult.breakdown.find(b => b.type === 'bau')?.days).toBe(5);
    expect(overrideResult.breakdown.find(b => b.type === 'bau')?.days).toBe(2);
  });

  it('calculates BAU from a global percentage setting', () => {
    const state = makeState({
      settings: {
        ...makeState().settings,
        bauReservePercent: 10,
        bauReserveDays: undefined,
      },
      teamMembers: [{ id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3 }],
    });

    const result = calculateCapacity('m1', 'Q1 2026', state);
    expect(result.breakdown.find(b => b.type === 'bau')?.days).toBeCloseTo(6.4, 1);
  });

  it('uses a per-member BAU percentage override when present', () => {
    const state = makeState({
      settings: {
        ...makeState().settings,
        bauReservePercent: 10,
        bauReserveDays: undefined,
      },
      teamMembers: [{
        id: 'm1',
        name: 'Alice',
        role: 'Dev',
        countryId: 'country-nl',
        skillIds: [],
        maxConcurrentProjects: 3,
        bauOverride: true,
        bauReservePercent: 20,
        bauReserveDays: undefined,
      }],
    });

    const result = calculateCapacity('m1', 'Q1 2026', state);
    expect(result.breakdown.find(b => b.type === 'bau')?.days).toBeCloseTo(12.8, 1);
  });

  it('scales IT capacity by workingDaysPerWeek', () => {
    const fullTimeState = makeState({
      teamMembers: [{
        id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3, bauOverride: true, bauReserveDays: 0,
      }],
    });
    const partTimeState = makeState({
      teamMembers: [{
        id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3, workingDaysPerWeek: 3, bauOverride: true, bauReserveDays: 0,
      }],
    });

    const fullResult = calculateCapacity('m1', 'Q1 2026', fullTimeState);
    const partResult = calculateCapacity('m1', 'Q1 2026', partTimeState);

    expect(partResult.totalWorkdays).toBeCloseTo(fullResult.totalWorkdays * 0.6, 1);
  });
});

describe('calculateCapacity — Assignment.days deduction', () => {
  const member = { id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3 };

  function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
    return { id: 'a1', memberId: 'm1', projectId: 'proj-1', quarter: 'Q1 2026', days: 10, ...overrides };
  }

  it('deducts assignment days for the given member and quarter', () => {
    const base = makeState({ teamMembers: [member] });
    const withAssignment = makeState({ teamMembers: [member], assignments: [makeAssignment()] });
    const baseResult = calculateCapacity('m1', 'Q1 2026', base);
    const result = calculateCapacity('m1', 'Q1 2026', withAssignment);
    expect(result.usedDays).toBe(baseResult.usedDays + 10);
    expect(result.breakdown.some(b => b.type === 'assignment' && b.days === 10)).toBe(true);
  });

  it('ignores assignments for other members', () => {
    const state = makeState({
      teamMembers: [member],
      assignments: [makeAssignment({ memberId: 'other-member' })],
    });
    const result = calculateCapacity('m1', 'Q1 2026', state);
    expect(result.breakdown.some(b => b.type === 'assignment')).toBe(false);
  });

  it('ignores assignments in other quarters', () => {
    const state = makeState({
      teamMembers: [member],
      assignments: [makeAssignment({ quarter: 'Q3 2026' })],
    });
    const result = calculateCapacity('m1', 'Q1 2026', state);
    expect(result.breakdown.some(b => b.type === 'assignment')).toBe(false);
  });

  it('handles state.assignments = undefined gracefully (treats as 0)', () => {
    const state = makeState({ teamMembers: [member] });
    // Cast to simulate an old persisted state that lacks the field
    (state as unknown as Record<string, unknown>).assignments = undefined;
    expect(() => calculateCapacity('m1', 'Q1 2026', state)).not.toThrow();
    const result = calculateCapacity('m1', 'Q1 2026', state);
    expect(result.breakdown.some(b => b.type === 'assignment')).toBe(false);
  });

  it('does not double-count: manual assignment days and Jira story points are separate', () => {
    const sprint = { id: 's1', name: 'Sprint 1', number: 1, year: 2026, startDate: '2026-01-05', endDate: '2026-01-23', quarter: 'Q1 2026', isByeWeek: false };
    const jiraItem: JiraWorkItem = {
      id: 'wi1', connectionId: 'c1', jiraKey: 'ERP-1', jiraId: '1',
      summary: 'Story', description: undefined,
      type: 'story', typeName: 'Story',
      status: 'In Progress', statusCategory: 'in_progress',
      storyPoints: 3,
      assigneeEmail: 'alice@example.com', assigneeName: 'Alice',
      sprintId: 's1', sprintName: 'Sprint 1',
      labels: [], components: [],
      created: '2026-01-01', updated: '2026-01-01',
    };
    const state = makeState({
      teamMembers: [{ ...member, email: 'alice@example.com' }],
      sprints: [sprint],
      jiraWorkItems: [jiraItem],
      assignments: [makeAssignment({ days: 5 })],
    });
    const result = calculateCapacity('m1', 'Q1 2026', state);
    const jiraBreakdown = result.breakdown.filter(b => b.type === 'jira');
    const assignmentBreakdown = result.breakdown.filter(b => b.type === 'assignment');
    expect(jiraBreakdown.length).toBeGreaterThan(0);
    expect(assignmentBreakdown.length).toBeGreaterThan(0);
    // Both tracked separately — no collapsing
    expect(jiraBreakdown[0].days).not.toBe(assignmentBreakdown[0].days);
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

  it('calculates business BAU from percentage', () => {
    const contact = makeContact({ bauReservePercent: 20, bauReserveDays: undefined });
    const result = calculateBusinessCapacity(contact, '2026-01-05', '2026-01-09', [], [], [], []);
    expect(result.allocatedDays).toBeCloseTo(1, 1);
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

// ── getWarnings — quarter param ───────────────────────────────────────────────

describe('getWarnings', () => {
  const q1Sprint: Sprint = {
    id: 's1', name: 'Sprint 1', number: 1, year: 2026,
    startDate: '2026-01-05', endDate: '2026-01-23', quarter: 'Q1 2026',
  };
  const q3Sprint: Sprint = {
    id: 's5', name: 'Sprint 5', number: 5, year: 2026,
    startDate: '2026-07-06', endDate: '2026-07-24', quarter: 'Q3 2026',
  };

  it('returns overallocated warning for the explicitly supplied quarter', () => {
    const jiraItem: JiraWorkItem = {
      id: 'wi1', connectionId: 'c1', jiraKey: 'P-1', jiraId: '1',
      summary: 'Big Task', type: 'story', typeName: 'Story',
      status: 'In Progress', statusCategory: 'in_progress',
      storyPoints: 999,
      assigneeEmail: 'alice@example.com',
      sprintId: 's5', sprintName: 'Sprint 5',
      labels: [], components: [],
      created: '2026-01-01', updated: '2026-01-01',
    };
    const state = makeState({
      teamMembers: [{ id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', email: 'alice@example.com', skillIds: [], maxConcurrentProjects: 3 }],
      sprints: [q1Sprint, q3Sprint],
      jiraWorkItems: [jiraItem],
    });

    const q1Warnings = getWarnings(state, 'Q1 2026');
    expect(q1Warnings.overallocated).toHaveLength(0);

    const q3Warnings = getWarnings(state, 'Q3 2026');
    expect(q3Warnings.overallocated).toHaveLength(1);
    expect(q3Warnings.overallocated[0].quarter).toBe('Q3 2026');
  });
});

describe('calculateSprintCapacity', () => {
  it('scales sprint availability for part-time IT members', () => {
    const sprint: Sprint = {
      id: 's1', name: 'Sprint 1', number: 1, year: 2026,
      startDate: '2026-01-05', endDate: '2026-01-23', quarter: 'Q1 2026',
    };
    const fullTimeState = makeState({
      teamMembers: [{
        id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3, bauOverride: true, bauReserveDays: 0,
      }],
      sprints: [sprint],
    });
    const partTimeState = makeState({
      teamMembers: [{
        id: 'm1', name: 'Alice', role: 'Dev', countryId: 'country-nl', skillIds: [], maxConcurrentProjects: 3, workingDaysPerWeek: 3, bauOverride: true, bauReserveDays: 0,
      }],
      sprints: [sprint],
    });

    const fullResult = calculateSprintCapacity('m1', sprint, [], fullTimeState);
    const partResult = calculateSprintCapacity('m1', sprint, [], partTimeState);

    expect(partResult.availableDays).toBeCloseTo(fullResult.availableDays * 0.6, 1);
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
