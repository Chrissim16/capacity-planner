import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ScenarioPlanner } from './ScenarioPlanner';
import { useAppStore } from '../stores/appStore';
import type { AppState } from '../types';
import { ToastProvider } from '../components/ui/Toast';

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
  useAppStore.getState().setData(makeState());
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('ScenarioPlanner render', () => {
  it('mounts without entering a nested update loop', async () => {
    useAppStore.getState().setData(makeState());
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const host = document.createElement('div');
    document.body.appendChild(host);

    const root = createRoot(host);
    expect(() => root.render(
      <ToastProvider>
        <ScenarioPlanner />
      </ToastProvider>,
    )).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('getSnapshot'));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('getSnapshot'));
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
