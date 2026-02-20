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
  ProjectFilters,
  SortConfig,
  TeamViewMode,
  ProjectViewMode,
  TimelineViewMode,
  Settings,
} from '../types';
import { generateQuarters } from '../utils/calendar';
import { loadFromSupabase, scheduleSyncToSupabase } from '../services/supabaseSync';
import { isSupabaseConfigured } from '../services/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// SYNC STATUS TYPES (US-001, US-004)
// ─────────────────────────────────────────────────────────────────────────────
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STORAGE KEY - Must match the original app!
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const STORAGE_KEY = 'capacity-planner-data';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEFAULT STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const defaultSettings: Settings = {
  bauReserveDays: 5,
  hoursPerDay: 8,
  defaultView: 'dashboard',
  quartersToShow: 4,
  defaultCountryId: 'country-nl',
  darkMode: false,
  sprintDurationWeeks: 3,
  sprintStartDate: '2026-01-05',
  sprintsToShow: 6,
  sprintsPerYear: 16,
  byeWeeksAfter: [8, 12],
  holidayWeeksAtEnd: 2,
};

const defaultJiraSettings = {
  storyPointsToDays: 0.5,
  defaultVelocity: 30,
  syncFrequency: 'manual' as const,
  autoMapByName: true,
  syncEpics: true,
  syncFeatures: true,
  syncStories: true,
  syncTasks: false,
  syncBugs: false,
  includeSubtasks: false,
  // Sensible defaults: Epics/Features include anything not Done (they span long periods),
  // Stories/Tasks/Bugs only include active work (To Do + In Progress).
  statusFilterEpics: 'exclude_done' as const,
  statusFilterFeatures: 'exclude_done' as const,
  statusFilterStories: 'active_only' as const,
  statusFilterTasks: 'active_only' as const,
  statusFilterBugs: 'active_only' as const,
};

const defaultAppState: AppState = {
  version: 10,
  lastModified: new Date().toISOString(),
  settings: defaultSettings,
  countries: [],
  publicHolidays: [],
  roles: [],
  skills: [],
  systems: [],
  teamMembers: [],
  projects: [],
  timeOff: [],
  quarters: generateQuarters(8),
  sprints: [],
  jiraConnections: [],
  jiraWorkItems: [],
  jiraSettings: defaultJiraSettings,
  scenarios: [],
  activeScenarioId: null,
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UI STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface UIState {
  currentView: ViewType;
  currentSettingsSection: string;
  isWhatIfMode: boolean;
  teamViewMode: TeamViewMode;
  projectViewMode: ProjectViewMode;
  timelineViewMode: TimelineViewMode;
  filters: Filters;
  projectFilters: ProjectFilters;
  projectSort: SortConfig;
}

const defaultUIState: UIState = {
  currentView: 'dashboard',
  currentSettingsSection: 'general',
  isWhatIfMode: false,
  teamViewMode: 'current',
  projectViewMode: 'list',
  timelineViewMode: 'quarter',
  filters: { member: [], system: [], status: [] },
  projectFilters: { search: '', priority: '', status: '', system: '' },
  projectSort: { field: 'name', direction: 'asc' },
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LOAD EXISTING DATA FROM ORIGINAL APP
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function loadExistingData(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // The original app stores data directly, not wrapped in { state: { data: ... } }
      // So we need to check the structure
      if (parsed && parsed.teamMembers) {
        console.log('[Store] Loaded existing data from localStorage');
        // Merge settings with defaults to handle new fields added in updates
        const mergedSettings: Settings = {
          ...defaultSettings,
          ...(parsed.settings || {}),
        };
        // Merge jiraSettings with defaults
        const mergedJiraSettings = {
          ...defaultJiraSettings,
          ...(parsed.jiraSettings || {}),
        };
        return {
          ...defaultAppState,
          ...parsed,
          // Merge settings properly so new fields have defaults
          settings: mergedSettings,
          // Ensure quarters are regenerated if missing
          quarters: parsed.quarters?.length ? parsed.quarters : generateQuarters(8),
          // Ensure new arrays exist
          sprints: parsed.sprints || [],
          jiraConnections: parsed.jiraConnections || [],
          jiraWorkItems: parsed.jiraWorkItems || [],
          jiraSettings: mergedJiraSettings,
          scenarios: parsed.scenarios || [],
          activeScenarioId: parsed.activeScenarioId ?? null,
        };
      }
    }
  } catch (e) {
    console.error('[Store] Failed to load existing data:', e);
  }
  return defaultAppState;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STORE INTERFACE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface AppStore {
  // Data state
  data: AppState;
  whatIfData: AppState | null;
  isLoading: boolean;
  isInitializing: boolean;  // True during first Supabase load (US-002)
  error: string | null;

  // Sync status (US-001, US-004)
  syncStatus: SyncStatus;
  syncError: string | null;

  // UI state
  ui: UIState;

  // Data actions
  setData: (data: AppState) => void;
  updateData: (updates: Partial<AppState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Sync actions
  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  initializeFromSupabase: () => Promise<void>;
  retrySyncToSupabase: () => Promise<void>;

  // What-If mode
  enterWhatIfMode: () => void;
  exitWhatIfMode: (save: boolean) => void;

  // UI actions
  setCurrentView: (view: ViewType) => void;
  setSettingsSection: (section: string) => void;
  setTeamViewMode: (mode: TeamViewMode) => void;
  setProjectViewMode: (mode: ProjectViewMode) => void;
  setTimelineViewMode: (mode: TimelineViewMode) => void;
  setFilters: (filters: Partial<Filters>) => void;
  setProjectFilters: (filters: Partial<ProjectFilters>) => void;
  setProjectSort: (sort: SortConfig) => void;
  toggleDarkMode: () => void;

  // Helper to get current state (respects what-if mode and scenarios)
  getCurrentState: () => AppState;

  // Sync with localStorage (for compatibility with original app)
  syncToStorage: () => void;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CUSTOM STORAGE - Compatible with original app format
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const customStorage = {
  getItem: (_name: string): string | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      
      // If it's already in the new format (has state.data), return as-is
      if (parsed.state?.data) {
        return stored;
      }
      
      // Merge settings with defaults to handle new fields
      const mergedSettings = {
        ...defaultSettings,
        ...(parsed.settings || {}),
      };
      
      // Convert old format to new format with merged settings
      const converted = {
        state: {
          data: {
            ...defaultAppState,
            ...parsed,
            settings: mergedSettings,
          },
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
      // Save the data in original app format (just the data object)
      // This keeps compatibility with the original app
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// STORE IMPLEMENTATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state - load from existing localStorage
      data: loadExistingData(),
      whatIfData: null,
      isLoading: false,
      isInitializing: isSupabaseConfigured(), // true until Supabase load completes
      error: null,
      syncStatus: isSupabaseConfigured() ? 'idle' : 'offline',
      syncError: null,
      ui: defaultUIState,

      // Sync actions (US-001, US-004)
      setSyncStatus: (status, error = null) =>
        set({ syncStatus: status, syncError: error ?? null }),

      initializeFromSupabase: async () => {
        if (!isSupabaseConfigured()) {
          set({ isInitializing: false, syncStatus: 'offline' });
          return;
        }

        set({ isInitializing: true });
        try {
          const cloudData = await loadFromSupabase();
          if (cloudData) {
            // Merge with defaults to handle any new fields added since last save
            const mergedSettings: Settings = { ...defaultSettings, ...(cloudData.settings || {}) };
            const mergedJiraSettings = { ...defaultJiraSettings, ...(cloudData.jiraSettings || {}) };
            const hydratedData: AppState = {
              ...defaultAppState,
              ...cloudData,
              settings: mergedSettings,
              jiraSettings: mergedJiraSettings,
              quarters: cloudData.quarters?.length ? cloudData.quarters : generateQuarters(8),
              sprints: cloudData.sprints || [],
              jiraConnections: cloudData.jiraConnections || [],
              jiraWorkItems: cloudData.jiraWorkItems || [],
              scenarios: cloudData.scenarios || [],
              activeScenarioId: cloudData.activeScenarioId ?? null,
            };
            set({ data: hydratedData });
            // Mirror to localStorage as offline cache
            localStorage.setItem(STORAGE_KEY, JSON.stringify(hydratedData));
          }
          set({ isInitializing: false, syncStatus: 'saved' });
        } catch (err) {
          console.error('[Store] Supabase init failed:', err);
          set({ isInitializing: false, syncStatus: 'error', syncError: 'Could not connect to database' });
        }
      },

      retrySyncToSupabase: async () => {
        const { data, setSyncStatus } = get();
        setSyncStatus('saving');
        try {
          const { saveToSupabase } = await import('../services/supabaseSync');
          await saveToSupabase(data);
          setSyncStatus('saved');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setSyncStatus('error', msg);
        }
      },

      // Data actions
      setData: (data) => set({ data, error: null }),

      updateData: (updates) => {
        const state = get();
        if (state.ui.isWhatIfMode && state.whatIfData) {
          set({
            whatIfData: {
              ...state.whatIfData,
              ...updates,
              lastModified: new Date().toISOString(),
            },
          });
        } else {
          const data = state.data;
          const scenarioFields = ['projects', 'teamMembers', 'timeOff', 'jiraWorkItems'] as const;
          const hasScenarioFieldUpdates = scenarioFields.some(field => field in updates);
          
          // If a scenario is active and we're updating scenario-specific fields,
          // update the scenario instead of the baseline
          if (data.activeScenarioId && hasScenarioFieldUpdates) {
            const scenarioIndex = data.scenarios.findIndex(s => s.id === data.activeScenarioId);
            if (scenarioIndex !== -1) {
              const updatedScenario = {
                ...data.scenarios[scenarioIndex],
                updatedAt: new Date().toISOString(),
              };
              
              // Apply scenario-specific updates to the scenario
              for (const field of scenarioFields) {
                if (field in updates) {
                  (updatedScenario as Record<string, unknown>)[field] = updates[field as keyof typeof updates];
                }
              }
              
              // Build baseline updates (non-scenario fields only)
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

          // No active scenario or no scenario-specific updates - update baseline normally
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
        }
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      // What-If mode
      enterWhatIfMode: () => {
        const state = get();
        set({
          whatIfData: JSON.parse(JSON.stringify(state.data)),
          ui: { ...state.ui, isWhatIfMode: true },
        });
      },
      
      exitWhatIfMode: (save) => {
        const state = get();
        if (save && state.whatIfData) {
          const newData = state.whatIfData;
          set({
            data: newData,
            whatIfData: null,
            ui: { ...state.ui, isWhatIfMode: false },
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
          scheduleSyncToSupabase(newData, (status, error) =>
            get().setSyncStatus(status as SyncStatus, error)
          );
        } else {
          set({
            whatIfData: null,
            ui: { ...state.ui, isWhatIfMode: false },
          });
        }
      },
      
      // UI actions
      setCurrentView: (view) =>
        set((state) => ({
          ui: { ...state.ui, currentView: view },
        })),
      
      setSettingsSection: (section) =>
        set((state) => ({
          ui: { ...state.ui, currentSettingsSection: section },
        })),
      
      setTeamViewMode: (mode) =>
        set((state) => ({
          ui: { ...state.ui, teamViewMode: mode },
        })),
      
      setProjectViewMode: (mode) =>
        set((state) => ({
          ui: { ...state.ui, projectViewMode: mode },
        })),
      
      setTimelineViewMode: (mode) =>
        set((state) => ({
          ui: { ...state.ui, timelineViewMode: mode },
        })),
      
      setFilters: (filters) =>
        set((state) => ({
          ui: {
            ...state.ui,
            filters: { ...state.ui.filters, ...filters },
          },
        })),
      
      setProjectFilters: (filters) =>
        set((state) => ({
          ui: {
            ...state.ui,
            projectFilters: { ...state.ui.projectFilters, ...filters },
          },
        })),
      
      setProjectSort: (sort) =>
        set((state) => ({
          ui: { ...state.ui, projectSort: sort },
        })),
      
      toggleDarkMode: () => {
        const state = get();
        const newData = {
          ...state.data,
          settings: {
            ...state.data.settings,
            darkMode: !state.data.settings.darkMode,
          },
        };
        set({ data: newData });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        scheduleSyncToSupabase(newData, (status, error) =>
          get().setSyncStatus(status as SyncStatus, error)
        );
      },

      // Helper - returns current state respecting active scenario
      getCurrentState: () => {
        const state = get();
        const data = state.ui.isWhatIfMode && state.whatIfData
          ? state.whatIfData
          : state.data;
        
        // If a scenario is active, merge scenario data with baseline
        if (data.activeScenarioId) {
          const activeScenario = data.scenarios.find(s => s.id === data.activeScenarioId);
          if (activeScenario) {
            return {
              ...data,
              // Override with scenario-specific data
              projects: activeScenario.projects,
              teamMembers: activeScenario.teamMembers,
              timeOff: activeScenario.timeOff,
              jiraWorkItems: activeScenario.jiraWorkItems,
            };
          }
        }
        
        return data;
      },
      
      // Sync to localStorage (for manual sync)
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
          projectViewMode: state.ui.projectViewMode,
          timelineViewMode: state.ui.timelineViewMode,
        },
      }),
    }
  )
);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SELECTORS (for optimized re-renders)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Selectors that return primitives — safe as-is with React 19 useSyncExternalStore
export const useCurrentView = () => useAppStore((state) => state.ui.currentView);
export const useIsWhatIfMode = () => useAppStore((state) => state.ui.isWhatIfMode);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useIsInitializing = () => useAppStore((state) => state.isInitializing);
export const useError = () => useAppStore((state) => state.error);
export const useActiveScenarioId = () => useAppStore((state) => state.data.activeScenarioId);
export const useScenarios = () => useAppStore((state) => state.data.scenarios);
export const useIsBaselineWithJira = () => useAppStore((state) =>
  !state.data.activeScenarioId && state.data.jiraConnections.length > 0
);

// Selectors that return objects — use useShallow so React 19's useSyncExternalStore
// snapshot comparisons use shallow equality instead of Object.is, which would
// otherwise detect "new object = new snapshot" on every render and force infinite
// re-renders (React error #185).
export const useSettings = () => useAppStore(useShallow((state) => state.data.settings));
export const useTeamMembers = () => useAppStore(useShallow((state) => state.getCurrentState().teamMembers));
export const useProjects = () => useAppStore(useShallow((state) => state.getCurrentState().projects));
export const useSyncStatus = () => useAppStore(useShallow((state) => ({ status: state.syncStatus, error: state.syncError })));
export const useActiveScenario = () => useAppStore(useShallow((state) => {
  const { activeScenarioId, scenarios } = state.data;
  if (!activeScenarioId) return null;
  return scenarios.find(s => s.id === activeScenarioId) || null;
}));

// useCurrentState — when a scenario is active, getCurrentState() builds a merged
// object from scratch on every call. useShallow ensures React 19 treats two
// shallowly-equal snapshots as the same, preventing the re-render loop.
export const useCurrentState = () => useAppStore(useShallow((state) => state.getCurrentState()));