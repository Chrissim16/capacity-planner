import { describe, expect, it } from 'vitest';
import type { AppState, EpicPhaseAssignment, EpicPhasePlan, JiraWorkItem } from '../types';
import { buildPortfolioPlanExportData } from './portfolioPlanExport';

function makeEpic(overrides: Partial<JiraWorkItem> = {}): JiraWorkItem {
  return {
    id: 'jira-1',
    connectionId: 'jira-conn',
    jiraKey: 'FIN-241',
    jiraId: '10001',
    summary: 'Treasury Modernisation',
    description: 'h2. Replace manual treasury workflows',
    type: 'epic',
    typeName: 'Epic',
    status: 'To Do',
    statusCategory: 'todo',
    labels: [],
    components: [],
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePlan(overrides: Partial<EpicPhasePlan> = {}): EpicPhasePlan {
  return {
    id: 'plan-1',
    epicKey: 'FIN-241',
    phase: 'design',
    phaseInstanceId: 'design',
    phaseOrder: 0,
    startDate: '2026-04-01',
    endDate: '2026-04-08',
    description: 'Validate target operating model',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<EpicPhaseAssignment> = {}): EpicPhaseAssignment {
  return {
    id: 'assign-1',
    epicKey: 'FIN-241',
    phase: 'design',
    phaseInstanceId: 'design',
    memberId: 'TEAM:Finance Ops',
    track: 'BIZ',
    days: 3,
    allocationMode: 'flat',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeState(): AppState {
  return {
    version: 11,
    lastModified: '2026-04-02T00:00:00.000Z',
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
    countries: [],
    publicHolidays: [],
    roles: [],
    skills: [],
    systems: [],
    squads: [],
    processTeams: [],
    businessTeams: [],
    teamMembers: [],
    timeOff: [],
    quarters: [],
    sprints: [],
    jiraConnections: [],
    jiraWorkItems: [],
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
      statusFilterFeatures: 'exclude_done',
      statusFilterStories: 'active_only',
      statusFilterTasks: 'active_only',
      statusFilterBugs: 'active_only',
      defaultConfidenceLevel: 'medium',
    },
    scenarios: [],
    activeScenarioId: null,
    businessContacts: [],
    businessTimeOff: [],
    jiraItemBizAssignments: [],
    projects: [],
    assignments: [],
  };
}

describe('buildPortfolioPlanExportData', () => {
  it('builds readable epic-view rows with phase and assignment detail', () => {
    const data = buildPortfolioPlanExportData({
      planName: 'Main Plan',
      quarterLabel: 'Q2 2026',
      quarterOpt: { label: 'Q2 2026', q: 1, year: 2026 },
      boardEpics: [makeEpic()],
      phasePlans: [makePlan()],
      phaseAssignments: [makeAssignment()],
      state: makeState(),
      jiraBaseUrl: 'https://jira.example.com',
      exportedAt: new Date('2026-04-02T09:30:00.000Z'),
    });

    const epicRow = data.epicViewRows.find((row) => row[0] === 'Epic');
    const phaseRow = data.epicViewRows.find((row) => row[0] === 'Phase');
    const assignmentRow = data.epicViewRows.find((row) => row[0] === 'Assignment');

    expect(data.filenameBase).toBe('portfolio-plan-main-plan-q2-2026');
    expect(epicRow).toEqual(expect.arrayContaining(['Epic', 'FIN-241', 'Treasury Modernisation']));
    expect(phaseRow).toEqual(expect.arrayContaining(['Phase', 'FIN-241', 'Treasury Modernisation', 'Design', '2026-04-01 -> 2026-04-07']));
    expect(assignmentRow).toEqual(expect.arrayContaining(['Assignment', 'FIN-241', 'Treasury Modernisation', 'Design', '2026-04-01 -> 2026-04-07', 'Validate target operating model', 'Finance Ops Team', 'Business team', 'BIZ', '3d total', 3, 3]));
    expect(data.overviewRows.flat()).toContain('Portfolio Health');
    expect(data.csvRows[0]).toEqual(expect.arrayContaining(['Epic Key', 'Epic Summary', 'Phase', 'Person / Team']));
    expect(data.csvRows[1]).toEqual(expect.arrayContaining(['FIN-241', 'Treasury Modernisation', 'Design', 'Finance Ops Team']));
    expect(data.health.unstaffedEpicCount).toBe(0);
  });
});
