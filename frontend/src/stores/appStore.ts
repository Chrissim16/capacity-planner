/**
 * Global application state store using Zustand
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE KEY - Must match the original app!
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'capacity-planner-data';

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT STATE
// ═══════════════════════════════════════════════════════════════════════════════

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

const defaultAppState: AppState = {
  version: 7,
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
};

// ═══════════════════════════════════════════════════════════════════════════════
// UI STATE
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD EXISTING DATA FROM ORIGINAL APP
// ═══════════════════════════════════════════════════════════════════════════════

function loadExistingData(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // The original app stores data directly, not wrapped in { state: { data: ... } }
      // So we need to check the structure
      if (parsed && parsed.teamMembers) {
        console.log('[Store] Loaded existing data from localStorage');
        return {
          ...defaultAppState,
          ...parsed,
          // Ensure quarters are regenerated if missing
          quarters: parsed.quarters?.length ? parsed.quarters : generateQuarters(8),
        };
      }
    }
  } catch (e) {
    console.error('[Store] Failed to load existing data:', e);
  }
  return defaultAppState;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

interface AppStore {
  // Data state
  data: AppState;
  whatIfData: AppState | null;
  isLoading: boolean;
  error: string | null;
  
  // UI state
  ui: UIState;
  
  // Data actions
  setData: (data: AppState) => void;
  updateData: (updates: Partial<AppState>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
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
  
  // Helper to get current state (respects what-if mode)
  getCurrentState: () => AppState;
  
  // Sync with localStorage (for compatibility with original app)
  syncToStorage: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM STORAGE - Compatible with original app format
// ═══════════════════════════════════════════════════════════════════════════════

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
      
      // Convert old format to new format
      const converted = {
        state: {
          data: parsed,
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

// ═══════════════════════════════════════════════════════════════════════════════
// STORE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state - load from existing localStorage
      data: loadExistingData(),
      whatIfData: null,
      isLoading: false,
      error: null,
      ui: defaultUIState,
      
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
          const newData = {
            ...state.data,
            ...updates,
            lastModified: new Date().toISOString(),
          };
          set({ data: newData });
          // Also save to localStorage for original app compatibility
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
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
          // Save to localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
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
      },
      
      // Helper
      getCurrentState: () => {
        const state = get();
        return state.ui.isWhatIfMode && state.whatIfData
          ? state.whatIfData
          : state.data;
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

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTORS (for optimized re-renders)
// ═══════════════════════════════════════════════════════════════════════════════

export const useCurrentState = () => useAppStore((state) => state.getCurrentState());
export const useCurrentView = () => useAppStore((state) => state.ui.currentView);
export const useIsWhatIfMode = () => useAppStore((state) => state.ui.isWhatIfMode);
export const useSettings = () => useAppStore((state) => state.data.settings);
export const useTeamMembers = () => useAppStore((state) => state.getCurrentState().teamMembers);
export const useProjects = () => useAppStore((state) => state.getCurrentState().projects);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useError = () => useAppStore((state) => state.error);
