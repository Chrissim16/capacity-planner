import { describe, it, expect, vi } from 'vitest';
import { scoreMember, scoreBusinessContact, rankMemberFits } from './staffing';
import type { AppState, Assignment, BusinessContact, TeamMember } from '../types';

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
    skills: [
      { id: 'skill-react', name: 'React', category: 'Technical' },
      { id: 'skill-pm', name: 'PM', category: 'Process' },
    ],
    systems: [],
    squads: [],
    processTeams: [],
    roles: [],
    countries: [],
    publicHolidays: [],
    version: 11,
    lastModified: new Date().toISOString(),
    projects: [],
    assignments: [],
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

function makeMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'm1',
    name: 'Alice',
    role: 'Dev',
    countryId: 'country-nl',
    skillIds: ['skill-react'],
    maxConcurrentProjects: 3,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return { id: 'a1', memberId: 'm1', projectId: 'proj-1', quarter: 'Q1 2026', days: 10, ...overrides };
}

// ── scoreMember ───────────────────────────────────────────────────────────────

describe('scoreMember', () => {
  it('returns good: capacity > 0, all skills match, not at max projects', () => {
    const member = makeMember({ skillIds: ['skill-react'] });
    const state = makeState({ teamMembers: [member] });
    const result = scoreMember(member, 'Q1 2026', ['skill-react'], 'proj-1', state);
    expect(result.fitLevel).toBe('good');
    expect(result.skillMatch).toContain('React');
    expect(result.skillGap).toHaveLength(0);
    expect(result.atMaxProjects).toBe(false);
    expect(result.availableDays).toBeGreaterThan(0);
  });

  it('returns partial: capacity > 0 but missing required skills', () => {
    const member = makeMember({ skillIds: [] });
    const state = makeState({ teamMembers: [member] });
    const result = scoreMember(member, 'Q1 2026', ['skill-react'], 'proj-1', state);
    expect(result.fitLevel).toBe('partial');
    expect(result.skillGap).toContain('React');
    expect(result.skillMatch).toHaveLength(0);
  });

  it('returns partial: capacity > 0, skills match, but at max concurrent projects', () => {
    const member = makeMember({ skillIds: ['skill-react'], maxConcurrentProjects: 2 });
    const existingAssignments: Assignment[] = [
      makeAssignment({ id: 'a1', projectId: 'other-proj-1' }),
      makeAssignment({ id: 'a2', projectId: 'other-proj-2' }),
    ];
    const state = makeState({ teamMembers: [member], assignments: existingAssignments });
    const result = scoreMember(member, 'Q1 2026', ['skill-react'], 'new-proj', state);
    expect(result.fitLevel).toBe('partial');
    expect(result.atMaxProjects).toBe(true);
  });

  it('returns over: adjustedAvailableDays <= 0', () => {
    const member = makeMember();
    // Assign so many days that available goes negative
    const heavyAssignments: Assignment[] = Array.from({ length: 20 }, (_, i) => ({
      id: `a${i}`, memberId: 'm1', projectId: `proj-${i}`, quarter: 'Q1 2026', days: 5,
    }));
    const state = makeState({ teamMembers: [member], assignments: heavyAssignments });
    const result = scoreMember(member, 'Q1 2026', [], 'proj-new', state);
    expect(result.fitLevel).toBe('over');
    expect(result.availableDays).toBeLessThanOrEqual(0);
  });

  it('vacuous skill match: requiredSkillIds=[] → scores on capacity alone', () => {
    const member = makeMember({ skillIds: [] });
    const state = makeState({ teamMembers: [member] });
    const result = scoreMember(member, 'Q1 2026', [], 'proj-1', state);
    expect(result.skillMatch).toHaveLength(0);
    expect(result.skillGap).toHaveLength(0);
    // With no skills required and capacity available, should be good
    expect(result.fitLevel).toBe('good');
  });

  it('subtracts tentativeAssignments days for this member only', () => {
    const member = makeMember();
    const state = makeState({ teamMembers: [member] });
    const baseResult = scoreMember(member, 'Q1 2026', [], 'proj-1', state);
    const tentative = [{ memberId: 'm1', days: 10 }];
    const tentativeResult = scoreMember(member, 'Q1 2026', [], 'proj-1', state, tentative);
    expect(tentativeResult.availableDays).toBe(baseResult.availableDays - 10);
  });

  it('does not subtract tentativeAssignments for other members', () => {
    const member = makeMember();
    const state = makeState({ teamMembers: [member] });
    const baseResult = scoreMember(member, 'Q1 2026', [], 'proj-1', state);
    const tentative = [{ memberId: 'other-member', days: 10 }];
    const result = scoreMember(member, 'Q1 2026', [], 'proj-1', state, tentative);
    expect(result.availableDays).toBe(baseResult.availableDays);
  });

  it('tentativeAssignments can push available below 0 → fitLevel over', () => {
    const member = makeMember();
    const state = makeState({ teamMembers: [member] });
    const baseResult = scoreMember(member, 'Q1 2026', [], 'proj-1', state);
    const tentative = [{ memberId: 'm1', days: baseResult.availableDays + 50 }];
    const result = scoreMember(member, 'Q1 2026', [], 'proj-1', state, tentative);
    expect(result.fitLevel).toBe('over');
    expect(result.availableDays).toBeLessThan(0);
  });

  it('existingDays: returns current assignment days to this project', () => {
    const member = makeMember();
    const state = makeState({
      teamMembers: [member],
      assignments: [makeAssignment({ days: 7 })],
    });
    const result = scoreMember(member, 'Q1 2026', [], 'proj-1', state);
    expect(result.existingDays).toBe(7);
  });

  it('wraps in try/catch → returns fitLevel:over on error, logs error', () => {
    const member = makeMember();
    // Pass a broken state that causes calculateCapacity to throw
    const brokenState = null as unknown as AppState;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = scoreMember(member, 'Q1 2026', [], 'proj-1', brokenState);
    expect(result.fitLevel).toBe('over');
    expect(result.availableDays).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[staffing] scoreMember failed',
      expect.objectContaining({ memberId: 'm1' })
    );
    consoleSpy.mockRestore();
  });
});

// ── scoreBusinessContact ──────────────────────────────────────────────────────

function makeContact(overrides: Partial<BusinessContact> = {}): BusinessContact {
  return {
    id: 'bc1',
    name: 'David',
    countryId: 'country-nl',
    bauReserveDays: 0,
    workingDaysPerWeek: 5,
    workingHoursPerDay: 8,
    archived: false,
    excludedFromCapacity: false,
    ...overrides,
  };
}

describe('scoreBusinessContact', () => {
  it('returns fit based on available BIZ days', () => {
    const contact = makeContact();
    const state = makeState({ businessContacts: [contact] });
    const result = scoreBusinessContact(contact, 'Q1 2026', 'proj-1', state);
    // No assignments, no BAU → should have available days → good
    expect(result.fitLevel).toBe('good');
    expect(result.availableDays).toBeGreaterThan(0);
  });

  it('returns partial when at max concurrent BIZ projects', () => {
    const contact = makeContact();
    const existingBizAssignments: Assignment[] = [
      { id: 'ba1', memberId: 'bc1', projectId: 'proj-a', quarter: 'Q1 2026', days: 5, isBizContact: true },
      { id: 'ba2', memberId: 'bc1', projectId: 'proj-b', quarter: 'Q1 2026', days: 5, isBizContact: true },
      { id: 'ba3', memberId: 'bc1', projectId: 'proj-c', quarter: 'Q1 2026', days: 5, isBizContact: true },
    ];
    const state = makeState({ businessContacts: [contact], assignments: existingBizAssignments });
    const result = scoreBusinessContact(contact, 'Q1 2026', 'new-proj', state);
    expect(result.atMaxProjects).toBe(true);
    expect(result.fitLevel).toBe('partial');
  });
});

// ── rankMemberFits ────────────────────────────────────────────────────────────

describe('rankMemberFits', () => {
  it('sorts good → partial → over, then by availableDays descending within tier', () => {
    const base = makeMember();
    const makeResult = (fitLevel: 'good' | 'partial' | 'over', availableDays: number) => ({
      member: base, fitLevel, availableDays, usedPercent: 50,
      skillMatch: [], skillGap: [], atMaxProjects: false, existingDays: 0,
    });

    const inputs = [
      makeResult('over', 5),
      makeResult('good', 10),
      makeResult('partial', 20),
      makeResult('good', 30),
      makeResult('partial', 8),
    ];

    const sorted = rankMemberFits(inputs);
    expect(sorted[0].fitLevel).toBe('good');
    expect(sorted[0].availableDays).toBe(30);
    expect(sorted[1].fitLevel).toBe('good');
    expect(sorted[1].availableDays).toBe(10);
    expect(sorted[2].fitLevel).toBe('partial');
    expect(sorted[2].availableDays).toBe(20);
    expect(sorted[3].fitLevel).toBe('partial');
    expect(sorted[3].availableDays).toBe(8);
    expect(sorted[4].fitLevel).toBe('over');
  });
});
