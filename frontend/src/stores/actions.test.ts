import { afterEach, describe, expect, it } from 'vitest';
import type { AppState, InitiativeCostRecord, Scenario } from '../types';
import { createScenario, deleteScenario, duplicateScenario } from './actions';
import { useAppStore } from './appStore';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'scenario-1',
    name: 'Source Scenario',
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
    isBaseline: false,
    jiraWorkItems: [],
    jiraItemBizAssignments: [],
    teamMembers: [],
    timeOff: [],
    projects: [],
    assignments: [],
    capacityRequests: [],
    capacityAssignments: [],
    plannerLayout: [],
    portfolioBoardEpicKeys: [],
    portfolioManualEpics: [],
    portfolioPhasePlans: [],
    portfolioPhaseAssignments: [],
    skillsMatchingEnabled: true,
    ...overrides,
  };
}

function makeInitiativeCost(overrides: Partial<InitiativeCostRecord> = {}): InitiativeCostRecord {
  return {
    id: 'initiative-cost-1',
    initiativeKind: 'scenario_project',
    initiativeId: 'project-1',
    scenarioId: 'scenario-1',
    contingencyPct: 10,
    hardware: null,
    licenses: [],
    updatedAt: '2026-04-03T00:00:00.000Z',
    ...overrides,
  };
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    version: 11,
    lastModified: '2026-04-03T00:00:00.000Z',
    settings: {
      bauReservePercent: 8,
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
      costing: {
        reportingCurrency: 'EUR',
        supportedCurrencies: ['EUR', 'GBP', 'USD'],
        fxToEur: { EUR: 1, GBP: 1.17, USD: 0.92 },
        internalItDailyRate: { amount: 750, currency: 'EUR' },
        businessDailyRate: { amount: 650, currency: 'EUR' },
      },
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
    capacityRequests: [],
    capacityAssignments: [],
    externalVendors: [],
    initiativeCosts: [],
    ...overrides,
  };
}

afterEach(() => {
  useAppStore.getState().setData(makeState());
  localStorage.clear();
});

describe('scenario initiative cost lifecycle', () => {
  it('clones scenario_project initiative costs when creating from an active scenario', () => {
    const sourceScenario = makeScenario();
    useAppStore.getState().setData(makeState({
      scenarios: [sourceScenario],
      activeScenarioId: sourceScenario.id,
      initiativeCosts: [
        makeInitiativeCost(),
        makeInitiativeCost({
          id: 'portfolio-cost-1',
          initiativeKind: 'portfolio_epic',
          initiativeId: 'FIN-241',
          scenarioId: undefined,
        }),
      ],
    }));

    const created = createScenario('Branch Scenario');
    const initiativeCosts = useAppStore.getState().data.initiativeCosts;
    const cloned = initiativeCosts.filter((record) => record.scenarioId === created.id);

    expect(cloned).toHaveLength(1);
    expect(cloned[0]).toMatchObject({
      initiativeKind: 'scenario_project',
      initiativeId: 'project-1',
      scenarioId: created.id,
    });
    expect(initiativeCosts.filter((record) => record.initiativeKind === 'portfolio_epic')).toHaveLength(1);
  });

  it('clones scenario_project initiative costs when duplicating a scenario', () => {
    const sourceScenario = makeScenario();
    useAppStore.getState().setData(makeState({
      scenarios: [sourceScenario],
      initiativeCosts: [
        makeInitiativeCost(),
        makeInitiativeCost({
          id: 'portfolio-cost-1',
          initiativeKind: 'portfolio_epic',
          initiativeId: 'FIN-241',
          scenarioId: undefined,
        }),
      ],
    }));

    const duplicated = duplicateScenario(sourceScenario.id, 'Copied Scenario');
    expect(duplicated).not.toBeNull();

    const initiativeCosts = useAppStore.getState().data.initiativeCosts;
    const cloned = initiativeCosts.filter((record) => record.scenarioId === duplicated!.id);

    expect(cloned).toHaveLength(1);
    expect(cloned[0]).toMatchObject({
      initiativeKind: 'scenario_project',
      initiativeId: 'project-1',
      scenarioId: duplicated!.id,
    });
    expect(initiativeCosts.filter((record) => record.initiativeKind === 'portfolio_epic')).toHaveLength(1);
  });

  it('removes only scenario-scoped initiative costs when deleting a scenario', () => {
    const sourceScenario = makeScenario();
    useAppStore.getState().setData(makeState({
      scenarios: [sourceScenario],
      initiativeCosts: [
        makeInitiativeCost(),
        makeInitiativeCost({
          id: 'other-scenario-cost',
          scenarioId: 'scenario-2',
          initiativeId: 'project-2',
        }),
        makeInitiativeCost({
          id: 'portfolio-cost-1',
          initiativeKind: 'portfolio_epic',
          initiativeId: 'FIN-241',
          scenarioId: undefined,
        }),
      ],
    }));

    deleteScenario(sourceScenario.id);

    expect(useAppStore.getState().data.scenarios).toHaveLength(0);
    expect(useAppStore.getState().data.initiativeCosts).toEqual([
      expect.objectContaining({ id: 'other-scenario-cost', scenarioId: 'scenario-2' }),
      expect.objectContaining({ id: 'portfolio-cost-1', initiativeKind: 'portfolio_epic', scenarioId: undefined }),
    ]);
  });
});
