/**
 * Global application state store using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      data: defaultAppState,
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
          set({
            data: {
              ...state.data,
              ...updates,
              lastModified: new Date().toISOString(),
            },
          });
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
          set({
            data: state.whatIfData,
            whatIfData: null,
            ui: { ...state.ui, isWhatIfMode: false },
          });
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
      
      toggleDarkMode: () =>
        set((state) => ({
          data: {
            ...state.data,
            settings: {
              ...state.data.settings,
              darkMode: !state.data.settings.darkMode,
            },
          },
        })),
      
      // Helper
      getCurrentState: () => {
        const state = get();
        return state.ui.isWhatIfMode && state.whatIfData
          ? state.whatIfData
          : state.data;
      },
    }),
    {
      name: 'capacity-planner-storage',
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
