# Scenarios (What-If Planning)

## Overview

Scenarios allow creating snapshots of your data for what-if planning. Make changes freely without affecting your Jira baseline data.

## Concept

```
┌─────────────────────────────────────────────────────────────┐
│                     Jira Baseline                            │
│  (Live data from Jira - read-only when viewing scenarios)   │
└─────────────────────────────────────────────────────────────┘
         │
         │ Create Scenario (snapshot)
         v
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Q3 Plan A      │  │  Q3 Plan B      │  │  Hiring Impact  │
│  (editable)     │  │  (editable)     │  │  (editable)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Key Features

### Jira Baseline
- Always available as "Jira Baseline" option
- Contains live data synced from Jira
- Read-only foundation for scenarios
- Updates when you sync from Jira

### Scenarios
- Named snapshots ("Q3 Hiring Plan", "Budget Option A")
- Start as copies of current baseline
- Fully editable - changes don't affect baseline
- Can be duplicated, renamed, deleted
- Track when they were based on a sync

## Data Model

### Scenario Interface
```typescript
interface Scenario {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  basedOnSyncAt?: string;  // When Jira sync was captured
  isBaseline: boolean;     // Reserved for future use
  
  // Scenario-specific data (copies)
  projects: Project[];
  teamMembers: TeamMember[];
  assignments: Assignment[];
  timeOff: TimeOff[];
  jiraWorkItems: JiraWorkItem[];
}
```

### State Fields
```typescript
interface AppState {
  // ... other fields
  scenarios: Scenario[];
  activeScenarioId: string | null;  // null = Jira Baseline
}
```

## User Interface

### Scenario Selector (Header)
**Location**: Header bar, replaces old "What-If" button

```
┌──────────────────────────────────────────┐
│ [Database Icon] Jira Baseline        [v] │  ← Dropdown trigger
└──────────────────────────────────────────┘
         │
         v (dropdown open)
┌──────────────────────────────────────────┐
│ [Database] Jira Baseline            [✓]  │
├──────────────────────────────────────────┤
│ [Branch] Q3 Plan A          [Copy][Del]  │
│ [Branch] Q3 Plan B          [Copy][Del]  │
├──────────────────────────────────────────┤
│ [+] Create New Scenario                  │
└──────────────────────────────────────────┘
```

### Scenario Banner
When viewing a scenario, a banner appears below the header:

```
┌──────────────────────────────────────────────────────────────┐
│ [Branch] Viewing Scenario: Q3 Plan A                         │
│          Changes here don't affect your Jira baseline        │
│                                                              │
│                    [Refresh from Jira] [Back to Baseline]    │
└──────────────────────────────────────────────────────────────┘
```

### Create Scenario Modal
Simple modal with:
- Name input field
- Create/Cancel buttons
- Different text for "Create" vs "Duplicate"

## Actions

### createScenario
```typescript
export function createScenario(name: string, description?: string): Scenario {
  const state = useAppStore.getState();
  const current = state.getCurrentState();
  
  const newScenario: Scenario = {
    id: generateId('scenario'),
    name,
    description,
    createdAt: new Date().toISOString(),
    basedOnSyncAt: current.jiraConnections.find(c => c.lastSyncAt)?.lastSyncAt,
    isBaseline: false,
    // Deep copy all data
    projects: JSON.parse(JSON.stringify(current.projects)),
    teamMembers: JSON.parse(JSON.stringify(current.teamMembers)),
    // ... etc
  };
  
  state.updateData({ 
    scenarios: [...current.scenarios, newScenario],
    activeScenarioId: newScenario.id  // Switch to new scenario
  });
  
  return newScenario;
}
```

### switchScenario
```typescript
export function switchScenario(scenarioId: string | null): void {
  // null = Jira Baseline
  const state = useAppStore.getState();
  state.updateData({ activeScenarioId: scenarioId });
}
```

### duplicateScenario
```typescript
export function duplicateScenario(scenarioId: string, newName: string): Scenario {
  // Deep copy existing scenario with new name
}
```

### deleteScenario
```typescript
export function deleteScenario(scenarioId: string): void {
  // Remove scenario, switch to baseline if it was active
}
```

### refreshScenarioFromJira
```typescript
export function refreshScenarioFromJira(scenarioId: string): void {
  // Update scenario's Jira work items from current baseline
  // Preserves other scenario changes (team, projects)
}
```

## Use Cases

### 1. Planning a Hiring Decision
```
1. Sync latest from Jira
2. Create scenario "With 2 New Developers"
3. Add 2 team members to scenario
4. Assign them to projects
5. Compare capacity utilization to baseline
```

### 2. Comparing Project Prioritization
```
1. Create scenario "Option A - Focus on Project X"
2. Increase allocations to Project X
3. Decrease allocations to Projects Y, Z
4. Create scenario "Option B - Balanced"
5. Different allocation distribution
6. Switch between scenarios to compare
```

### 3. Impact Analysis
```
1. Create scenario "If Project X is Cancelled"
2. Remove/reduce Project X allocations
3. See which team members have freed capacity
4. Plan reallocation
```

## Technical Details

### Data Isolation
Each scenario contains its own copies of:
- Projects (including phases and assignments)
- Team members
- Time off
- Jira work items

Shared across scenarios (not copied):
- Countries
- Public holidays
- Roles
- Skills
- Systems
- Settings
- Jira connections
- Jira settings

### Performance Considerations
- Deep copying on scenario create may be slow for large datasets
- Consider lazy copying or structural sharing for optimization
- Current implementation uses `JSON.parse(JSON.stringify())` for simplicity

### Future: getCurrentState()
The store provides `getCurrentState()` to get data based on active scenario:

```typescript
getCurrentState: () => {
  const { data, activeScenarioId, scenarios } = get();
  
  if (activeScenarioId) {
    const scenario = scenarios.find(s => s.id === activeScenarioId);
    if (scenario) {
      return {
        ...data,
        projects: scenario.projects,
        teamMembers: scenario.teamMembers,
        // ... merge scenario data
      };
    }
  }
  
  return data;  // Jira Baseline
}
```

**Note**: This integration is partially implemented. Currently, scenarios store data but `getCurrentState()` needs updating to properly return scenario data when active.

## Best Practices

1. **Name scenarios descriptively**: "Q3 2026 - Add 2 FTE" not "Test 1"
2. **Delete old scenarios**: Clean up after decisions are made
3. **Refresh before comparing**: Ensure baseline is current
4. **Document assumptions**: Use description field

## Future Enhancements

1. **Scenario comparison view**: Side-by-side capacity comparison
2. **Merge scenarios**: Apply scenario changes to baseline
3. **Scenario history**: Track changes within a scenario
4. **Share scenarios**: Export/import scenario definitions
5. **Scenario templates**: Pre-built scenario starting points
