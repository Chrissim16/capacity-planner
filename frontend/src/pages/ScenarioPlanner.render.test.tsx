import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import { act } from 'react';
import { ScenarioPlanner } from './ScenarioPlanner';
import { PortfolioPlanning } from './PortfolioPlanning';
import { useAppStore } from '../stores/appStore';
import type { AppState } from '../types';
import { ToastProvider } from '../components/ui/Toast';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    quarters: ['Q1 2026'],
    sprints: [
      {
        id: 'sprint-1',
        name: 'S1',
        number: 1,
        quarter: 'Q1 2026',
        startDate: '2026-01-05',
        endDate: '2026-01-18',
        isByeWeek: false,
      },
    ],
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
  vi.useRealTimers();
  useAppStore.getState().setData(makeState());
  document.body.innerHTML = '';
  localStorage.clear();
});

async function renderPage(node: ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<ToastProvider>{node}</ToastProvider>);
  });
  return { host, root };
}

describe('ScenarioPlanner render', () => {
  it('mounts without entering a nested update loop', async () => {
    useAppStore.getState().setData(makeState());
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const host = document.createElement('div');
    document.body.appendChild(host);

    const root = createRoot(host);
    await act(async () => {
      expect(() => root.render(
        <ToastProvider>
          <ScenarioPlanner />
        </ToastProvider>,
      )).not.toThrow();
    });
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('getSnapshot'));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('getSnapshot'));
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('shows the shared baseline scenario label in both planning lenses', async () => {
    useAppStore.getState().setData(makeState({
      scenarios: [
        {
          id: 'baseline-1',
          name: 'Baseline',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
          isBaseline: true,
          plannerLayout: [],
          jiraWorkItems: [],
          jiraItemBizAssignments: [],
          teamMembers: [],
          timeOff: [],
          projects: [],
          assignments: [],
          capacityRequests: [],
          capacityAssignments: [],
          portfolioBoardEpicKeys: [],
          portfolioManualEpics: [],
          portfolioPhasePlans: [],
          portfolioPhaseAssignments: [],
          skillsMatchingEnabled: true,
        },
      ],
      activeScenarioId: null,
    }));

    const delivery = await renderPage(<ScenarioPlanner />);
    const portfolio = await renderPage(<PortfolioPlanning />);

    expect(delivery.host.textContent).toContain('Baseline');
    expect(portfolio.host.textContent).toContain('Baseline');
  });

  it('shows the same named scenario across delivery and portfolio planning', async () => {
    useAppStore.getState().setData(makeState({
      scenarios: [
        {
          id: 'scenario-1',
          name: 'Scenario: Delay rollout by 1 sprint',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
          isBaseline: false,
          plannerLayout: [],
          jiraWorkItems: [],
          jiraItemBizAssignments: [],
          teamMembers: [],
          timeOff: [],
          projects: [],
          assignments: [],
          capacityRequests: [],
          capacityAssignments: [],
          portfolioBoardEpicKeys: [],
          portfolioManualEpics: [],
          portfolioPhasePlans: [],
          portfolioPhaseAssignments: [],
          skillsMatchingEnabled: true,
        },
      ],
      activeScenarioId: 'scenario-1',
    }));

    const delivery = await renderPage(<ScenarioPlanner />);
    const portfolio = await renderPage(<PortfolioPlanning />);

    expect(delivery.host.textContent).toContain('Scenario: Delay rollout by 1 sprint');
    expect(portfolio.host.textContent).toContain('Scenario: Delay rollout by 1 sprint');
  });

  it('renders delivery source and readiness badges for planning-only, jira-backed, breakdown-missing, and carryover work', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-25T12:00:00.000Z'));

    useAppStore.getState().setData(makeState({
      scenarios: [
        {
          id: 'baseline-1',
          name: 'Baseline',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
          isBaseline: true,
          plannerLayout: [
            {
              id: 'planner-epic-1',
              sourceId: 'jira-epic-1',
              name: 'Fraud controls',
              type: 'epic',
              jiraKey: 'EPIC-1',
              startSprint: 1,
              spanSprints: 3,
              assignees: [],
              isManual: false,
              labels: [],
              jiraAssignees: [],
              requiredSkillIds: [],
            },
            {
              id: 'planner-manual-1',
              sourceId: 'planner-manual-1',
              name: 'Manual contingency epic',
              type: 'epic',
              jiraKey: 'PLANF-1',
              startSprint: 2,
              spanSprints: 1,
              assignees: [],
              isManual: true,
              labels: [],
              jiraAssignees: [],
              requiredSkillIds: [],
            },
          ],
          jiraWorkItems: [],
          jiraItemBizAssignments: [],
          teamMembers: [],
          timeOff: [],
          projects: [],
          assignments: [],
          capacityRequests: [],
          capacityAssignments: [],
          portfolioBoardEpicKeys: [],
          portfolioManualEpics: [],
          portfolioPhasePlans: [],
          portfolioPhaseAssignments: [],
          skillsMatchingEnabled: true,
        },
      ],
      jiraWorkItems: [
        {
          id: 'jira-epic-1',
          connectionId: 'jira-1',
          jiraKey: 'EPIC-1',
          jiraId: 'jira-epic-1',
          summary: 'Fraud controls',
          type: 'epic',
          typeName: 'Epic',
          status: 'In Progress',
          statusCategory: 'indeterminate',
          labels: [],
          components: [],
          created: '2026-01-01',
          updated: '2026-01-05',
        },
      ],
      sprints: [
        {
          id: 'sprint-1',
          name: 'S1',
          number: 1,
          quarter: 'Q1 2026',
          startDate: '2026-01-05',
          endDate: '2026-01-18',
          isByeWeek: false,
        },
        {
          id: 'sprint-2',
          name: 'S2',
          number: 2,
          quarter: 'Q1 2026',
          startDate: '2026-01-19',
          endDate: '2026-02-01',
          isByeWeek: false,
        },
      ],
      activeScenarioId: null,
    }));

    const { host } = await renderPage(<ScenarioPlanner />);
    const text = host.textContent ?? '';

    expect(text).toContain('Planning only');
    expect(text).toContain('Jira');
    expect(text).toContain('Needs breakdown');
    expect(text).toContain('Carryover');
  });
});
