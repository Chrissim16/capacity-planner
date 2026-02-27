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
import { loadFromSupabase, saveToSupabase, scheduleSyncToSupabase } from '../services/supabaseSync';
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
  // Sensible defaults: Epics/Features include anything not Done (they span long periods),
  // Stories/Tasks/Bugs only include active work (To Do + In Progress).
  statusFilterEpics: 'exclude_done' as const,
  statusFilterFeatures: 'exclude_done' as const,
  statusFilterStories: 'active_only' as const,
  statusFilterTasks: 'active_only' as const,
  statusFilterBugs: 'active_only' as const,
  defaultConfidenceLevel: 'medium' as const,
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
  squads: [],
  processTeams: [],
  teamMembers: [],
  projects: [],
  assignments: [],
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
  businessAssignments: [],
  jiraItemBizAssignments: [],
  localPhases: [],
};

function flattenAssignmentsFromProjects(projects: AppState['projects']): AppState['assignments'] {
  const flattened: AppState['assignments'] = [];
  for (const project of projects) {
    for (const phase of project.phases) {
      for (const assignment of phase.assignments ?? []) {
        flattened.push({
          ...assignment,
          projectId: project.id,
          phaseId: phase.id,
        });
      }
    }
  }
  return flattened;
}

function quarterToIsoRange(quarter: string): { startDate: string; endDate: string } | null {
  const match = quarter.match(/^Q([1-4])\s+(\d{4})$/);
  if (!match) return null;
  const q = Number(match[1]);
  const year = Number(match[2]);
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: toIso(start), endDate: toIso(end) };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UI STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

type DashboardPeopleFilter = 'it_only' | 'business_only' | 'both';

interface UIState {
  currentView: ViewType;
  currentSettingsSection: string;
  teamViewMode: TeamViewMode;
  projectViewMode: ProjectViewMode;
  timelineViewMode: TimelineViewMode;
  filters: Filters;
  projectFilters: ProjectFilters;
  projectSort: SortConfig;
  dashboardPeopleFilter: DashboardPeopleFilter;
}

const defaultUIState: UIState = {
  currentView: 'dashboard',
  currentSettingsSection: 'general',
  teamViewMode: 'current',
  projectViewMode: 'list',
  timelineViewMode: 'quarter',
  filters: { member: [], system: [], status: [] },
  projectFilters: { search: '', priority: '', status: '', system: '' },
  projectSort: { field: 'name', direction: 'asc' },
  dashboardPeopleFilter: 'both',
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LOAD EXISTING DATA FROM ORIGINAL APP
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function migrate(data: Partial<AppState>, fromVersion: number): AppState {
  const d = { ...data } as Partial<AppState> & Record<string, unknown>;

  if (fromVersion < 10) {
    if (!Array.isArray(d.processTeams)) d.processTeams = [];
    if (!Array.isArray(d.squads)) d.squads = [];
  }

  const migratedProjects = Array.isArray(d.projects)
    ? (d.projects as AppState['projects']).map((project) => ({
        ...project,
        phases: (project.phases ?? []).map((phase) => {
          const next = { ...phase };
          if ((!next.startDate || !next.endDate) && next.startQuarter && next.endQuarter) {
            const startRange = quarterToIsoRange(next.startQuarter);
            const endRange = quarterToIsoRange(next.endQuarter);
            if (startRange && endRange) {
              if (!next.startDate) next.startDate = startRange.startDate;
              if (!next.endDate) next.endDate = endRange.endDate;
            }
          }
          return next;
        }),
      }))
    : [];

  return {
    ...defaultAppState,
    ...d,
    projects: migratedProjects,
    settings: mergeSettingsWithDefaults((d.settings as Partial<Settings>) ?? {}),
    jiraSettings: {
      ...defaultJiraSettings,
      ...((d.jiraSettings as typeof defaultJiraSettings) ?? {}),
    },
    quarters: Array.isArray(d.quarters) && d.quarters.length > 0 ? d.quarters : generateQuarters(8),
    sprints: Array.isArray(d.sprints) ? d.sprints : [],
    jiraConnections: Array.isArray(d.jiraConnections) ? d.jiraConnections : [],
    jiraWorkItems: Array.isArray(d.jiraWorkItems) ? d.jiraWorkItems : [],
    scenarios: Array.isArray(d.scenarios) ? d.scenarios : [],
    assignments: Array.isArray(d.assignments)
      ? (d.assignments as AppState['assignments'])
      : flattenAssignmentsFromProjects(migratedProjects),
    activeScenarioId: (d.activeScenarioId as string | null | undefined) ?? null,
    businessContacts: Array.isArray(d.businessContacts) ? (d.businessContacts as AppState['businessContacts']) : [],
    businessTimeOff: Array.isArray(d.businessTimeOff) ? (d.businessTimeOff as AppState['businessTimeOff']) : [],
    businessAssignments: Array.isArray(d.businessAssignments) ? (d.businessAssignments as AppState['businessAssignments']) : [],
    jiraItemBizAssignments: Array.isArray(d.jiraItemBizAssignments) ? (d.jiraItemBizAssignments as AppState['jiraItemBizAssignments']) : [],
    localPhases: Array.isArray(d.localPhases) ? (d.localPhases as AppState['localPhases']) : [],
  };
}

/** Returns true when localStorage already contains meaningful app data. */
function hasCachedData(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    // Data may be stored at root level (original format) or under state.data (new format)
    const data = parsed?.state?.data ?? parsed;
    return (
      (Array.isArray(data?.teamMembers) && data.teamMembers.length > 0) ||
      (Array.isArray(data?.projects) && data.projects.length > 0)
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
      // The original app stores data directly, not wrapped in { state: { data: ... } }
      // So we need to check the structure
      if (parsed && parsed.teamMembers) {
        console.log('[Store] Loaded existing data from localStorage');
        return migrate(parsed, parsed.version ?? 0);
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
  setDashboardPeopleFilter: (filter: DashboardPeopleFilter) => void;

  // Helper to get current state (respects scenarios)
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
      const mergedSettings = mergeSettingsWithDefaults(parsed.settings || {});
      
      // Convert old format to new format with merged settings
      const converted = {
        state: {
          data: {
            ...defaultAppState,
            ...parsed,
            settings: mergedSettings,
            assignments: Array.isArray(parsed.assignments)
              ? parsed.assignments
              : flattenAssignmentsFromProjects(parsed.projects || []),
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
      isLoading: false,
      // Only block the UI with the loading screen when Supabase is configured AND we
      // have no cached data yet (first-ever visit). If localStorage already has team
      // members or projects we let the app render immediately from cache and sync
      // Supabase silently in the background — prevents the reload-on-tab-focus flicker.
      isInitializing: isSupabaseConfigured() && !hasCachedData(), // true until Supabase load completes
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

        // Only show the full-screen loading spinner when there is nothing cached locally.
        // If we already have data, sync silently in the background.
        if (!hasCachedData()) {
          set({ isInitializing: true });
        }
        try {
          const cloudData = await withTimeout(loadFromSupabase(), 15000, 'Supabase initial load');
          if (cloudData) {
            // Merge with defaults to handle any new fields added since last save
            const mergedSettings = mergeSettingsWithDefaults(cloudData.settings);
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
              assignments: cloudData.assignments?.length
                ? cloudData.assignments
                : flattenAssignmentsFromProjects(cloudData.projects || []),
              activeScenarioId: cloudData.activeScenarioId ?? null,
            };
            set({ data: hydratedData });
            // Mirror to localStorage as offline cache
            localStorage.setItem(STORAGE_KEY, JSON.stringify(hydratedData));
            set({ isInitializing: false, syncStatus: 'saved' });
          } else {
            // No cloud data — using localStorage as-is; show idle (not "Saved") so
            // any new changes will still get pushed to Supabase on next updateData.
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

      // Data actions
      setData: (data) => set({ data, error: null }),

      updateData: (updates) => {
        const state = get();
        const data = state.data;
        const normalizedUpdates: Partial<AppState> =
          updates.projects && !updates.assignments
            ? {
                ...updates,
                assignments: flattenAssignmentsFromProjects(updates.projects),
              }
            : updates;
        const scenarioFields = ['projects', 'teamMembers', 'assignments', 'timeOff', 'jiraWorkItems'] as const;
        const hasScenarioFieldUpdates = scenarioFields.some(field => field in normalizedUpdates);
        
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
              if (field in normalizedUpdates) {
                (updatedScenario as Record<string, unknown>)[field] = normalizedUpdates[field as keyof typeof normalizedUpdates];
              }
            }
            
            // Build baseline updates (non-scenario fields only)
            const baselineUpdates: Partial<AppState> = {};
            for (const key in normalizedUpdates) {
              if (!scenarioFields.includes(key as typeof scenarioFields[number])) {
                (baselineUpdates as Record<string, unknown>)[key] = normalizedUpdates[key as keyof typeof normalizedUpdates];
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
          ...normalizedUpdates,
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

      setDashboardPeopleFilter: (filter) =>
        set((state) => ({ ui: { ...state.ui, dashboardPeopleFilter: filter } })),

      // Helper - returns current state respecting active scenario
      getCurrentState: () => {
        const state = get();
        const data = state.data;
        
        // If a scenario is active, merge scenario data with baseline
        if (data.activeScenarioId) {
          const activeScenario = data.scenarios.find(s => s.id === data.activeScenarioId);
          if (activeScenario) {
            const scenarioAssignments = activeScenario.assignments?.length
              ? activeScenario.assignments
              : flattenAssignmentsFromProjects(activeScenario.projects);
            return {
              ...data,
              // Override with scenario-specific data
              projects: activeScenario.projects,
              teamMembers: activeScenario.teamMembers,
              assignments: scenarioAssignments,
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
          dashboardPeopleFilter: state.ui.dashboardPeopleFilter,
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