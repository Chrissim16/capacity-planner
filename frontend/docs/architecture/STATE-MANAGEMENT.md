# State Management

## Overview

The application uses **Zustand** for state management with a single store that handles both data and UI state. State is persisted to localStorage automatically.

## Store Structure

```typescript
interface AppStore {
  // Persisted data
  data: AppState;
  
  // UI state (not persisted)
  ui: UIState;
  
  // Legacy what-if mode
  whatIfData: AppState | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setData: (data: AppState) => void;
  updateData: (updates: Partial<AppState>) => void;
  getCurrentState: () => AppState;
  // ... more actions
}
```

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Component  │────>│   Action    │────>│    Store    │
│  (onClick)  │     │ (addProject)│     │ (updateData)│
└─────────────┘     └─────────────┘     └─────────────┘
       ^                                       │
       │                                       v
       │                              ┌─────────────┐
       └──────────────────────────────│ localStorage│
                                      └─────────────┘
```

## Key Patterns

### 1. Selective Subscriptions

Components subscribe only to the state they need:

```typescript
// ✅ Good - only re-renders when projects change
const projects = useAppStore((s) => s.data.projects);

// ❌ Bad - re-renders on any state change
const { data } = useAppStore();
```

### 2. Actions as Separate Functions

State mutations are defined in `actions.ts`, not in components:

```typescript
// actions.ts
export function addProject(data: Omit<Project, 'id'>): Project {
  const state = useAppStore.getState();
  // ... mutation logic
}

// Component.tsx
import { addProject } from '../stores/actions';

function Component() {
  const handleAdd = () => addProject({ name: 'New' });
}
```

### 3. getCurrentState() Helper

The store provides a method to get the current state, respecting scenarios:

```typescript
// Returns scenario data if viewing a scenario, otherwise returns data
const currentState = useAppStore.getState().getCurrentState();
```

### 4. Immutable Updates

All state updates create new objects:

```typescript
// ✅ Correct
const projects = state.getCurrentState().projects.map(p =>
  p.id === id ? { ...p, ...updates } : p
);
state.updateData({ projects });

// ❌ Wrong - mutating state directly
state.data.projects[0].name = 'New Name';
```

## Persistence

### Storage Key
```typescript
const STORAGE_KEY = 'capacity-planner-data';
```

### Migration Strategy

The `version` field in AppState enables migrations:

```typescript
function loadExistingData(): AppState {
  const stored = localStorage.getItem(STORAGE_KEY);
  const parsed = JSON.parse(stored);
  
  // Merge with defaults to handle new fields
  return {
    ...defaultAppState,
    ...parsed,
    settings: { ...defaultSettings, ...parsed.settings },
    jiraSettings: { ...defaultJiraSettings, ...parsed.jiraSettings },
    // Ensure new arrays exist
    sprints: parsed.sprints || [],
    jiraConnections: parsed.jiraConnections || [],
    scenarios: parsed.scenarios || [],
  };
}
```

### Version History

| Version | Changes |
|---------|---------|
| 1-7 | Initial app development |
| 8 | Added sprints |
| 9 | Added Jira integration |
| 10 | Added scenarios |

## Custom Hooks

### useAppStore
Direct Zustand hook for store access:

```typescript
const projects = useAppStore((s) => s.data.projects);
const updateData = useAppStore((s) => s.updateData);
```

### Convenience Selectors

Pre-defined selectors for common access patterns:

```typescript
export const useCurrentView = () => useAppStore((s) => s.ui.currentView);
export const useSettings = () => useAppStore((s) => s.data.settings);
export const useProjects = () => useAppStore((s) => s.data.projects);
export const useTeamMembers = () => useAppStore((s) => s.data.teamMembers);
```

## UI State

UI state is kept separate and not persisted:

```typescript
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
```

## Action Categories

### Entity CRUD
```typescript
// Pattern: add{Entity}, update{Entity}, delete{Entity}
addProject(data)
updateProject(id, updates)
deleteProject(id)
```

### Bulk Operations
```typescript
// Pattern: set{Entity}s for bulk replacement
setJiraWorkItems(connectionId, items)
clearJiraWorkItemMappings(ids)
```

### Jira Actions
```typescript
addJiraConnection(data)
updateJiraConnection(id, updates)
deleteJiraConnection(id)
toggleJiraConnectionActive(id)
setJiraConnectionSyncStatus(id, status, error?)
syncJiraWorkItems(connectionId, items) // Smart merge
updateJiraWorkItemMapping(id, mapping)
updateJiraSettings(updates)
```

### Scenario Actions
```typescript
createScenario(name, description?)
duplicateScenario(scenarioId, newName)
updateScenario(scenarioId, updates)
deleteScenario(scenarioId)
switchScenario(scenarioId | null) // null = baseline
refreshScenarioFromJira(scenarioId)
```

## Testing State

For development/debugging, the store is accessible globally:

```javascript
// In browser console
window.__ZUSTAND_STORE__ = useAppStore;

// Get current state
useAppStore.getState().data

// Trigger action
useAppStore.getState().updateData({ ... })
```

## Common Patterns

### Adding a New Entity Type

1. Define interface in `types/index.ts`
2. Add to `AppState` interface
3. Add default value in `appStore.ts`
4. Add migration logic in `loadExistingData()`
5. Create CRUD actions in `actions.ts`
6. Export actions from store barrel file

### Adding a New UI Setting

1. Add to `UIState` interface in `appStore.ts`
2. Add default value in `defaultUIState`
3. Create setter action if needed
4. Use with `useAppStore((s) => s.ui.settingName)`
