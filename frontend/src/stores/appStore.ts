/**
 * Global application state store using Zustand
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
  AppState,
  ViewType,
  Filters,
  EpicFilters,
  SortConfig,
  TeamViewMode,
  TimelineViewMode,
  PlannerTimelineViewMode,
  Settings,
} from '../types';
import { generateQuarters } from '../utils/calendar';
import { hasPlannerSession } from '../utils/plannerSessionStorage';
import { loadFromSupabase, saveToSupabase, scheduleSyncToSupabase } from '../services/supabaseSync';
import { isSupabaseConfigured } from '../services/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// SYNC STATUS TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE KEY
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'capacity-planner-data';

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT STATE
// ═══════════════════════════════════════════════════════════════════════════

const defaultSettings: Settings = {
  bauReserveDays: 5,
  hoursPerDay: 8,
  defaultView: 'dashboard',
  quartersToShow: 4,
  defaultCountryId: 'country-nl',
  darkMode: false,
  confidenceLevels: {
    high: 5,
    medium: 15,
    low: 25,
    defaultLevel: 'medium',
  },
  sprintDurationWeeks: 3,
  sprintStartDate: '2026-01-05',
  sprintsToShow: 6,
  sprintsPerYear: 16,
  byeWeeksAfter: [8, 12],
  holidayWeeksAtEnd: 2,
};

function mergeSettingsWithDefaults(settings?: Partial<Settings>): Settings {
  return {
    ...defaultSettings,
    ...(settings ?? {}),
    confidenceLevels: {
      ...defaultSettings.confidenceLevels,
      ...(settings?.confidenceLevels ?? {}),
    },
  };
}

const defaultJiraSettings = {
  defaultVelocity: 30,
  syncFrequency: 'manual' as const,
  autoMapByName: true,
  syncEpics: true,
  syncFeatures: true,
  syncStories: true,
  syncTasks: false,
  syncBugs: false,
  includeSubtasks: false,
  statusFilterEpics: 'exclude_done' as const,
  statusFilterFeatures: 'exclude_done' as const,
  statusFilterStories: 'active_only' as const,
  statusFilterTasks: 'active_only' as const,
  statusFilterBugs: 'active_only' as const,
  defaultConfidenceLevel: 'medium' as const,
};

const defaultAppState: AppState = {
  version: 11,
  lastModified: new Date().toISOString(),
  settings: defaultSettings,
  countries: [],
  publicHolidays: [],
  roles: [],
  skills: [],
  systems: [],
  squads: [],
  processTeams: [],
  teamMembers: [],
  timeOff: [],
  quarters: generateQuarters(8),
  sprints: [],
  jiraConnections: [],
  jiraWorkItems: [],
  jiraSettings: defaultJiraSettings,
  scenarios: [],
  activeScenarioId: null,
  businessContacts: [],
  businessTimeOff: [],
  jiraItemBizAssignments: [],
  projects: [],
  assignments: [],
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then((value) => { clearTimeout(timer); resolve(value); })
      .catch((error) => { clearTimeout(timer); reject(error); });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UI STATE
// ═══════════════════════════════════════════════════════════════════════════

export type DashboardPeopleFilter = 'it_only' | 'business_only' | 'both';

interface UIState {
  currentView: ViewType;
  currentSettingsSection: string;
  teamViewMode: TeamViewMode;
  timelineViewMode: TimelineViewMode;
  plannerTimelineViewMode: PlannerTimelineViewMode;
  filters: Filters;
  epicFilters: EpicFilters;
  epicsSortConfig: SortConfig;
  dashboardPeopleFilter: DashboardPeopleFilter;
}

const defaultUIState: UIState = {
  currentView: 'dashboard',
  currentSettingsSection: 'general',
  teamViewMode: 'current',
  timelineViewMode: 'quarter',
  plannerTimelineViewMode: 'sprint',
  filters: { member: [], system: [], status: [] },
  epicFilters: { search: '', priority: '', status: '', label: '', squad: '', processTeam: '', itMember: '', bizContact: '' },
  epicsSortConfig: { field: '', direction: 'asc' },
  dashboardPeopleFilter: 'both',
};

// ═══════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════

function migrate(data: Partial<AppState>): AppState {
  const d = { ...data } as Partial<AppState> & Record<string, unknown>;
  return {
    ...defaultAppState,
    ...d,
    settings: mergeSettingsWithDefaults((d.settings as Partial<Settings>) ?? {}),
    jiraSettings: {
      ...defaultJiraSettings,
      ...((d.jiraSettings as typeof defaultJiraSettings) ?? {}),
    },
    quarters: Array.isArray(d.quarters) && (d.quarters as string[]).length > 0
      ? d.quarters as string[]
      : generateQuarters(8),
    sprints: Array.isArray(d.sprints) ? d.sprints as AppState['sprints'] : [],
    jiraConnections: Array.isArray(d.jiraConnections)
      ? d.jiraConnections as AppState['jiraConnections']
      : [],
    jiraWorkItems: Array.isArray(d.jiraWorkItems)
      ? d.jiraWorkItems as AppState['jiraWorkItems']
      : [],
    scenarios: Array.isArray(d.scenarios) ? d.scenarios as AppState['scenarios'] : [],
    activeScenarioId: (d.activeScenarioId as string | null | undefined) ?? null,
    businessContacts: Array.isArray(d.businessContacts)
      ? d.businessContacts as AppState['businessContacts']
      : [],
    businessTimeOff: Array.isArray(d.businessTimeOff)
      ? d.businessTimeOff as AppState['businessTimeOff']
      : [],
    jiraItemBizAssignments: Array.isArray(d.jiraItemBizAssignments)
      ? d.jiraItemBizAssignments as AppState['jiraItemBizAssignments']
      : [],
    projects: Array.isArray(d.projects) ? d.projects as AppState['projects'] : [],
    assignments: Array.isArray(d.assignments) ? d.assignments as AppState['assignments'] : [],
  };
}

/** Returns true when localStorage already contains meaningful app data. */
function hasCachedData(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    const data = parsed?.state?.data ?? parsed;
    return (
      (Array.isArray(data?.teamMembers) && data.teamMembers.length > 0) ||
      (Array.isArray(data?.jiraWorkItems) && data.jiraWorkItems.length > 0)
    );
  } catch {
    return false;
  }
}

function loadExistingData(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.teamMembers) {
        return migrate(parsed);
      }
    }
  } catch (e) {
    console.error('[Store] Failed to load existing data:', e);
  }
  return defaultAppState;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

interface AppStore {
  data: AppState;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;

  syncStatus: SyncStatus;
  syncError: string | null;

  ui: UIState;

  setData: (data: AppState) => void;
  updateData: (updates: Partial<AppState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  initializeFromSupabase: () => Promise<void>;
  retrySyncToSupabase: () => Promise<void>;

  setCurrentView: (view: ViewType) => void;
  setSettingsSection: (section: string) => void;
  setTeamViewMode: (mode: TeamViewMode) => void;
  setTimelineViewMode: (mode: TimelineViewMode) => void;
  setPlannerTimelineViewMode: (mode: PlannerTimelineViewMode) => void;
  setFilters: (filters: Partial<Filters>) => void;
  setEpicFilters: (filters: Partial<EpicFilters>) => void;
  setEpicsSort: (sort: SortConfig) => void;
  toggleDarkMode: () => void;
  setDashboardPeopleFilter: (filter: DashboardPeopleFilter) => void;

  getCurrentState: () => AppState;
  syncToStorage: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM STORAGE
// ═══════════════════════════════════════════════════════════════════════════

const customStorage = {
  getItem: (_name: string): string | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed.state?.data) return stored;
      const mergedSettings = mergeSettingsWithDefaults(parsed.settings || {});
      const converted = {
        state: {
          data: { ...defaultAppState, ...parsed, settings: mergedSettings },
          ui: defaultUIState,
        },
        version: 0,
      };
      return JSON.stringify(converted);
    } catch (e) {
      console.error('[Storage] getItem error:', e);
      return null;
    }
  },
  setItem: (_name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      if (parsed.state?.data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.state.data));
      }
    } catch (e) {
      console.error('[Storage] setItem error:', e);
    }
  },
  removeItem: (_name: string): void => {
    localStorage.removeItem(STORAGE_KEY);
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// STORE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      data: loadExistingData(),
      isLoading: false,
      isInitializing: isSupabaseConfigured() && !hasCachedData(),
      error: null,
      syncStatus: isSupabaseConfigured() ? 'idle' : 'offline',
      syncError: null,
      ui: defaultUIState,

      setSyncStatus: (status, error = null) =>
        set({ syncStatus: status, syncError: error ?? null }),

      initializeFromSupabase: async () => {
        if (!isSupabaseConfigured()) {
          set({ isInitializing: false, syncStatus: 'offline' });
          return;
        }
        if (!hasCachedData()) set({ isInitializing: true });
        try {
          const cloudData = await withTimeout(loadFromSupabase(), 15000, 'Supabase initial load');
          if (cloudData) {
            const hydratedData: AppState = {
              ...defaultAppState,
              ...cloudData,
              settings: mergeSettingsWithDefaults(cloudData.settings),
              jiraSettings: { ...defaultJiraSettings, ...(cloudData.jiraSettings || {}) },
              quarters: cloudData.quarters?.length ? cloudData.quarters : generateQuarters(8),
              sprints: cloudData.sprints || [],
              jiraConnections: cloudData.jiraConnections || [],
              jiraWorkItems: cloudData.jiraWorkItems || [],
              scenarios: cloudData.scenarios || [],
              activeScenarioId: hasPlannerSession()
                ? (cloudData.activeScenarioId ?? null)
                : null,
            };
            set({ data: hydratedData });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(hydratedData));
            set({ isInitializing: false, syncStatus: 'saved' });
          } else {
            set({ isInitializing: false, syncStatus: 'idle' });
          }
        } catch (err) {
          console.error('[Store] Supabase init failed:', err);
          const msg = err instanceof Error ? err.message : 'Could not connect to database';
          set({ isInitializing: false, syncStatus: 'error', syncError: msg });
        }
      },

      retrySyncToSupabase: async () => {
        const { data, setSyncStatus } = get();
        setSyncStatus('saving');
        try {
          await saveToSupabase(data);
          setSyncStatus('saved');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setSyncStatus('error', msg);
        }
      },

      setData: (data) => set({ data, error: null }),

      updateData: (updates) => {
        const state = get();
        const data = state.data;

        // Scenario-specific fields: overlay into the active scenario if one is set
        const scenarioFields = ['jiraWorkItems', 'jiraItemBizAssignments', 'teamMembers', 'timeOff', 'projects', 'assignments'] as const;
        const hasScenarioFieldUpdates = scenarioFields.some(field => field in updates);

        if (data.activeScenarioId && hasScenarioFieldUpdates) {
          const scenarioIndex = data.scenarios.findIndex(s => s.id === data.activeScenarioId);
          if (scenarioIndex !== -1) {
            const updatedScenario = {
              ...data.scenarios[scenarioIndex],
              updatedAt: new Date().toISOString(),
            };
            for (const field of scenarioFields) {
              if (field in updates) {
                (updatedScenario as Record<string, unknown>)[field] = updates[field as keyof typeof updates];
              }
            }
            const baselineUpdates: Partial<AppState> = {};
            for (const key in updates) {
              if (!scenarioFields.includes(key as typeof scenarioFields[number])) {
                (baselineUpdates as Record<string, unknown>)[key] = updates[key as keyof typeof updates];
              }
            }
            const updatedScenarios = [...data.scenarios];
            updatedScenarios[scenarioIndex] = updatedScenario;
            const newData = {
              ...data,
              ...baselineUpdates,
              scenarios: updatedScenarios,
              lastModified: new Date().toISOString(),
            };
            set({ data: newData });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
            scheduleSyncToSupabase(newData, (status, error) =>
              get().setSyncStatus(status as SyncStatus, error)
            );
            return;
          }
        }

        const newData = {
          ...data,
          ...updates,
          lastModified: new Date().toISOString(),
        };
        set({ data: newData });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        scheduleSyncToSupabase(newData, (status, error) =>
          get().setSyncStatus(status as SyncStatus, error)
        );
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      setCurrentView: (view) =>
        set((state) => ({ ui: { ...state.ui, currentView: view } })),

      setSettingsSection: (section) =>
        set((state) => ({ ui: { ...state.ui, currentSettingsSection: section } })),

      setTeamViewMode: (mode) =>
        set((state) => ({ ui: { ...state.ui, teamViewMode: mode } })),

      setTimelineViewMode: (mode) =>
        set((state) => ({ ui: { ...state.ui, timelineViewMode: mode } })),

      setPlannerTimelineViewMode: (mode) =>
        set((state) => ({ ui: { ...state.ui, plannerTimelineViewMode: mode } })),

      setFilters: (filters) =>
        set((state) => ({
          ui: { ...state.ui, filters: { ...state.ui.filters, ...filters } },
        })),

      setEpicFilters: (filters) =>
        set((state) => ({
          ui: { ...state.ui, epicFilters: { ...state.ui.epicFilters, ...filters } },
        })),

      setEpicsSort: (sort) =>
        set((state) => ({ ui: { ...state.ui, epicsSortConfig: sort } })),

      toggleDarkMode: () => {
        const state = get();
        const newData = {
          ...state.data,
          settings: { ...state.data.settings, darkMode: !state.data.settings.darkMode },
        };
        set({ data: newData });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        scheduleSyncToSupabase(newData, (status, error) =>
          get().setSyncStatus(status as SyncStatus, error)
        );
      },

      setDashboardPeopleFilter: (filter) =>
        set((state) => ({ ui: { ...state.ui, dashboardPeopleFilter: filter } })),

      getCurrentState: () => {
        const state = get();
        const data = state.data;
        if (data.activeScenarioId) {
          const activeScenario = data.scenarios.find(s => s.id === data.activeScenarioId);
          if (activeScenario) {
            return {
              ...data,
              jiraWorkItems: activeScenario.jiraWorkItems,
              jiraItemBizAssignments: activeScenario.jiraItemBizAssignments,
              teamMembers: activeScenario.teamMembers,
              timeOff: activeScenario.timeOff,
              projects: activeScenario.projects ?? [],
              assignments: activeScenario.assignments ?? [],
            };
          }
        }
        return data;
      },

      syncToStorage: () => {
        const state = get();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => customStorage),
      partialize: (state) => ({
        data: state.data,
        ui: {
          currentView: state.ui.currentView,
          teamViewMode: state.ui.teamViewMode,
          timelineViewMode: state.ui.timelineViewMode,
          dashboardPeopleFilter: state.ui.dashboardPeopleFilter,
        },
      }),
    }
  )
);

if (import.meta.env.DEV) (window as any).__store = useAppStore;

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

export const useCurrentView = () => useAppStore((state) => state.ui.currentView);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useIsInitializing = () => useAppStore((state) => state.isInitializing);
export const useError = () => useAppStore((state) => state.error);
export const useActiveScenarioId = () => useAppStore((state) => state.data.activeScenarioId);
export const useScenarios = () => useAppStore(useShallow((state) => state.data.scenarios));
export const useIsBaselineWithJira = () => useAppStore((state) =>
  !state.data.activeScenarioId && state.data.jiraConnections.length > 0
);

export const useSettings = () => useAppStore(useShallow((state) => state.data.settings));
export const useTeamMembers = () => useAppStore(useShallow((state) => state.getCurrentState().teamMembers));
export const useSyncStatus = () => useAppStore(useShallow((state) => ({ status: state.syncStatus, error: state.syncError })));
export const useActiveScenario = () => useAppStore(useShallow((state) => {
  const { activeScenarioId, scenarios } = state.data;
  if (!activeScenarioId) return null;
  return scenarios.find(s => s.id === activeScenarioId) || null;
}));

export const useCurrentState = () => useAppStore(useShallow((state) => state.getCurrentState()));
export const usePlannerTimelineViewMode = () => useAppStore((state) => state.ui.plannerTimelineViewMode);
