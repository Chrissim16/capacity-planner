---
status: Ready for Dev
created: 2026-04-02
author: Design / Planning
---

# UX Coherence + Costing Module — Implementation Handover

## Background & Why We're Doing This

The app was built in reverse order (Epics first, then Scenario Planner, then Portfolio Planning), resulting in three screens with overlapping concerns, duplicate patterns, and no clear user journey. After a full design review of the actual workflow, we've rearchitected around how planning actually happens.

### The workflow

```
Stage 1                    [External]              Stage 2                    Stage 3
Portfolio Planning    →    Jira                →   Capacity Planner      →   Actuals
──────────────────         ──────                  ────────────────          ───────
Epics + phases only        Create Epic/            Sprint grid               Epic→Feature→Story
Management approval        Feature/Story           Drag backlog item          Delivery health
Phase staffing             structure               → see capacity impact      People / stakeholders
Costing                    After approval          What-if requests           Scope validation
```

**Key decisions made:**
- **Stage 2 is kept but radically simplified.** Its unique value is: "drag an item (Jira backlog or manual what-if) onto a sprint → immediately see if it causes overallocation." Nothing more.
- **Story hierarchy lives only in Actuals.** It doesn't exist during Portfolio Planning (stories aren't written yet). It appears after Jira buildout.
- **Scenario/what-if system removed from Stage 2.** Scenarios stay in Portfolio Planning only.
- **Costing lives entirely in Portfolio Planning.** Not in Stage 2 or Actuals.

---

## Architecture Overview

### Three screens

| Screen | Route | Was | Key change |
|---|---|---|---|
| Portfolio Planning | `/portfolio-planning` | Same | Add costing layer |
| Capacity Planner | `/planner` | Scenario Planner | Gut to ~400 lines; new sprint grid + drag UX |
| Actuals | `/epics` | Epics / Projects | Rebuild as 4-tab delivery dashboard |

### What gets deleted

| File | Reason |
|---|---|
| `components/planner/PlannerBoard.tsx` | Board view removed from Stage 2 |
| `components/planner/PlannerPeopleView.tsx` | Removed from Stage 2 |
| `components/planner/PlannerSummaryView.tsx` | Removed from Stage 2 |
| `components/planner/PlannerDetailPanel.tsx` | Removed |
| `components/planner/PlannerTeamDrawer.tsx` | Removed |
| `components/planner/PlannerContextMenu.tsx` | Removed |
| `components/planner/ScenarioTabs.tsx` | No scenario switching in Stage 2 |
| `utils/plannerSessionStorage.ts` | No session persistence needed |

---

## Implementation Steps

---

### Step 1 — Sidebar reorder + rename labels

**Effort:** Small · **Risk:** Low

#### `frontend/src/components/layout/Sidebar.tsx`

Replace the `navItems` array (currently lines 52–61) with:

```typescript
const navItems = [
  { view: 'portfolio-planning', icon: LayoutGrid,      label: 'Portfolio Planning' },
  { view: 'planner',            icon: Layers,          label: 'Capacity Planner' },
  { view: 'projects',           icon: Activity,        label: 'Actuals' },
  { view: 'timeline',           icon: Calendar,        label: 'Timeline' },
  { view: 'team',               icon: Users,           label: 'Team' },
  { view: 'report',             icon: FileBarChart,    label: 'Report' },
  { view: 'settings',           icon: Settings,        label: 'Settings' },
];
```

Add a visual separator (or small section label) between the first three (journey screens) and the rest (data screens). See how to render a separator in the existing sidebar render loop.

#### `frontend/src/pages/Projects.tsx`

Find the `PageHeader` call (~line 412). Change `title="Epics"` to `title="Actuals"`.

#### `frontend/src/pages/ScenarioPlanner.tsx`

Find the `PageHeader` call. Change title to `"Capacity Planner"`.

---

### Step 2 — StageProgressBar component

**Effort:** Small · **Risk:** Low

#### New file: `frontend/src/components/layout/StageProgressBar.tsx`

```tsx
import React from 'react';
import { ChevronRight, Check } from 'lucide-react';

export type AppStage = 'portfolio' | 'capacity' | 'actuals';

interface StageProgressBarProps {
  currentStage: AppStage;
  onNavigate: (view: string) => void;
}

const STAGES: { id: AppStage; view: string; label: string }[] = [
  { id: 'portfolio', view: 'portfolio-planning', label: 'Portfolio Planning' },
  { id: 'capacity',  view: 'planner',            label: 'Capacity Planner' },
  { id: 'actuals',   view: 'projects',           label: 'Actuals' },
];

export function StageProgressBar({ currentStage, onNavigate }: StageProgressBarProps) {
  const currentIdx = STAGES.findIndex(s => s.id === currentStage);
  return (
    <div className="flex items-center gap-1 px-6 py-2 border-b border-[#DEDFE3] bg-white text-xs">
      {STAGES.map((stage, idx) => {
        const isCurrent = stage.id === currentStage;
        const isDone = idx < currentIdx;
        return (
          <React.Fragment key={stage.id}>
            {idx > 0 && <ChevronRight size={11} className="text-[#CBD5E1] flex-shrink-0" />}
            <button
              onClick={() => onNavigate(stage.view)}
              className={[
                'flex items-center gap-1 px-2 py-0.5 rounded transition-colors',
                isCurrent ? 'font-medium text-[#1A1A2E] bg-[#F1F5F9] cursor-default' : '',
                isDone    ? 'text-[#0089DD] hover:bg-[#EFF6FF]' : '',
                !isCurrent && !isDone ? 'text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#64748B]' : '',
              ].join(' ')}
            >
              {isDone && <Check size={10} />}
              {stage.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

#### Add to each screen

In each of the three screens, import `StageProgressBar` and render it immediately after the `PageHeader`. Use the same view-navigation function used in `Sidebar.tsx` (search for `setCurrentView` or `navigate` in `Sidebar.tsx` and use the same pattern).

- `PortfolioPlanning.tsx` → `currentStage="portfolio"`
- `ScenarioPlanner.tsx` (now Capacity Planner) → `currentStage="capacity"`
- `Projects.tsx` (now Actuals) → `currentStage="actuals"`

---

### Step 3 — Rebuild Capacity Planner (Stage 2)

**Effort:** Large · **Risk:** Medium

This is the most significant structural change. The current `ScenarioPlanner.tsx` (1703 lines) is gutted and replaced with three new focused components wired into a minimal shell.

#### New data type

Add to `frontend/src/types/index.ts`:

```typescript
export interface CapacityRequest {
  id: string;                  // crypto.randomUUID()
  name: string;
  estimatedDays: number;
  sprintId?: string;           // target sprint if known
  requiredSkills?: string[];
  jiraItemId?: string;         // if linked to a Jira backlog item
  createdAt: string;
}

export interface CapacityAssignment {
  id: string;                  // crypto.randomUUID()
  memberId: string;
  sprintId: string;
  jiraItemId?: string;         // set if source is a Jira backlog item
  capacityRequestId?: string;  // set if source is a manual request
  estimatedDays: number;
  assignedAt: string;
}
```

Add to `AppState` in `frontend/src/stores/appStore.ts`:
```typescript
capacityRequests: CapacityRequest[];
capacityAssignments: CapacityAssignment[];
```

Add to `defaultAppState`:
```typescript
capacityRequests: [],
capacityAssignments: [],
```

Add actions to `frontend/src/stores/actions.ts`:
```typescript
addCapacityRequest(req: Omit<CapacityRequest, 'id' | 'createdAt'>): void
removeCapacityRequest(id: string): void
updateCapacityRequest(id: string, changes: Partial<CapacityRequest>): void
addCapacityAssignment(a: Omit<CapacityAssignment, 'id' | 'assignedAt'>): void
removeCapacityAssignment(id: string): void
```

#### Source of truth for rebuilt Stage 2

Stage 2 is no longer scenario-driven.

- Do **not** read from or write to `Scenario.plannerLayout`
- Do **not** keep planner session persistence
- The rebuilt Capacity Planner is a single baseline workspace backed by app-root state:
  - `jiraWorkItems`
  - `teamMembers`
  - `sprints`
  - `capacityRequests`
  - `capacityAssignments`

Legacy `Scenario.plannerLayout` rows may remain in saved data for historical scenarios, but the rebuilt Stage 2 ignores them.

#### New file: `frontend/src/components/capacity/CapacityRequestCard.tsx`

A drag-source card shown in the backlog panel. Two variants:

1. **Jira item card** — shows epic key, type badge (Story/Feature), title. Read from `jiraWorkItems` filtered to `status !== 'Done'` and `type` in `['Story', 'Feature', 'Task']`.

2. **What-if request card** — shows a ✎ icon, name, estimated days, optional skill tags. Created from `CapacityRequest` store entries.

Both variants are draggable (use `@dnd-kit/core` DraggableItem, matching the existing pattern in PlannerTimeline).

Inline "Add request" form (renders below the what-if list when expanded):
```tsx
<form onSubmit={handleAdd}>
  <input placeholder="Request name" required />
  <input type="number" placeholder="Days" min={0.5} step={0.5} required />
  <select>{sprints.map(s => <option key={s.id}>{s.name}</option>)}</select>
  {/* optional skills multi-select — can be deferred */}
  <button type="submit">Add</button>
  <button type="button" onClick={cancel}>Cancel</button>
</form>
```

#### New file: `frontend/src/components/capacity/CapacityBacklog.tsx`

Left panel (220px wide, collapsible with same chevron pattern as Portfolio Planning left panel).

Structure:
```
┌─ Backlog ────────────────────────────┐
│ [Search…]                            │
│                                      │
│ — Jira Backlog (N items) —           │
│   [CapacityRequestCard] x N          │
│                                      │
│ — What-if Requests —                 │
│   [CapacityRequestCard] x N          │
│   [+ Add request]                    │
└──────────────────────────────────────┘
```

Props:
```typescript
interface CapacityBacklogProps {
  jiraItems: JiraWorkItem[];          // backlog items from store
  requests: CapacityRequest[];        // from store
  onAddRequest: (req) => void;
  onRemoveRequest: (id: string) => void;
}
```

#### New file: `frontend/src/components/capacity/CapacitySprintGrid.tsx`

Right panel — the main canvas.

**Columns:** One column per sprint (use `sprints` from store, show next 6–8 sprints by default).

**Rows:** One row per team member, showing:
- Name + avatar
- Allocated days bar for each sprint cell (coloured fill, `allocatedDays / availableDays`)
- Overallocation shown in red with `⚠` icon

**Drop zones:** Each sprint cell for each person is a drop target (`@dnd-kit/core` DroppableZone).

**On drop logic:**
```typescript
function handleDrop(item: JiraWorkItem | CapacityRequest, memberId: string, sprintId: string) {
  const days = isCapacityRequest(item) ? item.estimatedDays : estimateFromStoryPoints(item);
  const current = getAllocatedDays(memberId, sprintId);
  const available = getAvailableDays(memberId, sprintId);
  const after = current + days;

  if (after > available) {
    showOverallocationWarning({
      member: getMember(memberId),
      sprint: getSprint(sprintId),
      currentPct: Math.round(current / available * 100),
      afterPct:   Math.round(after   / available * 100),
    });
  } else {
    showAssignConfirm({
      member: getMember(memberId),
      daysAvailable: available - current,
      daysRequested: days,
    });
  }
}
```

Confirmation UI: a small inline popover (not a modal) with two actions: **Assign** and **Cancel**.

Confirm-path persistence:

```typescript
function handleConfirmAssign(item: JiraWorkItem | CapacityRequest, memberId: string, sprintId: string, days: number) {
  addCapacityAssignment({
    memberId,
    sprintId,
    jiraItemId:        isCapacityRequest(item) ? undefined : item.id,
    capacityRequestId: isCapacityRequest(item) ? item.id : undefined,
    estimatedDays: days,
  });
}
```

Allocated days calculation: sum of `capacityAssignments` for that member × sprint.

Backlog filtering rule:

- Jira backlog excludes items already scheduled via `capacityAssignments`
- Manual what-if requests either disappear after assignment or render with a small "Scheduled" state; choose one behavior and use it consistently

#### Rewrite: `frontend/src/pages/ScenarioPlanner.tsx`

Gut the file. New structure:

```tsx
export function ScenarioPlanner() {
  // Read from store
  const { jiraWorkItems, teamMembers, sprints, capacityRequests, capacityAssignments } = useCurrentState();
  const { addCapacityRequest, removeCapacityRequest, addCapacityAssignment } = useActions();

  // Filter to backlog items only (not Done, not already scheduled)
  const backlogItems = useMemo(() =>
    jiraWorkItems.filter(i =>
      i.status !== 'Done' &&
      ['Story','Feature','Task'].includes(i.type) &&
      !capacityAssignments.some(a => a.jiraItemId === i.id)
    ),
    [jiraWorkItems, capacityAssignments]
  );

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC]">
      <StageProgressBar currentStage="capacity" onNavigate={navigate} />
      <PageHeader title="Capacity Planner" subtitle={`${sprints.length} sprints · ${teamMembers.length} people`} />
      <DndContext onDragEnd={handleDrop}>
        <div className="flex flex-1 min-h-0">
          <CapacityBacklog
            jiraItems={backlogItems}
            requests={capacityRequests}
            onAddRequest={addCapacityRequest}
            onRemoveRequest={removeCapacityRequest}
          />
          <CapacitySprintGrid
            teamMembers={teamMembers}
            sprints={sprints}
            assignments={capacityAssignments}
            onAssign={addCapacityAssignment}
          />
        </div>
      </DndContext>
    </div>
  );
}
```

#### Files to delete after Step 3

```
frontend/src/components/planner/PlannerBoard.tsx
frontend/src/components/planner/PlannerPeopleView.tsx
frontend/src/components/planner/PlannerSummaryView.tsx
frontend/src/components/planner/PlannerDetailPanel.tsx
frontend/src/components/planner/PlannerTeamDrawer.tsx
frontend/src/components/planner/PlannerContextMenu.tsx
frontend/src/components/planner/ScenarioTabs.tsx
frontend/src/utils/plannerSessionStorage.ts
```

Verify nothing else imports these before deleting (run a grep across `frontend/src`).

---

### Step 4 — Actuals screen (4-tab delivery dashboard)

**Effort:** Large · **Risk:** Medium

Transform `Projects.tsx` from a Jira browser into a delivery monitoring dashboard.

#### Remove from `Projects.tsx`

- Import and usage of `SmartAssignmentPanel`
- Import and usage of `BulkEditWorkItemsModal`
- All confidence override state and UI (`ConfidenceLevel`, related handlers)
- Filter state variables: `filterPriority`, `filterLabel`, `filterITMember`, `filterBizContact` (keep `search` and `filterStatus` only)
- The filter bar: replace 6 filter controls with search input + status dropdown only
- The Jira sync button from `PageHeader actions` — replace with a small inline sync indicator:
  ```tsx
  <span className="text-xs text-[#94A3B8]">⟳ synced {timeSinceSync}</span>
  ```

#### Add 4-tab structure to `Projects.tsx`

```tsx
import { ActualsScope }          from '../components/actuals/ActualsScope';
import { ActualsDeliveryHealth } from '../components/actuals/ActualsDeliveryHealth';
import { ActualsPeopleView }     from '../components/actuals/ActualsPeopleView';
import { ActualsStakeholders }   from '../components/actuals/ActualsStakeholders';

type ActualsTab = 'scope' | 'health' | 'people' | 'stakeholders';

const TABS: { id: ActualsTab; label: string }[] = [
  { id: 'scope',        label: 'Scope' },
  { id: 'health',       label: 'Delivery Health' },
  { id: 'people',       label: 'People' },
  { id: 'stakeholders', label: 'Stakeholders' },
];

const [activeTab, setActiveTab] = useState<ActualsTab>('scope');
```

Tab bar renders identically to Portfolio Planning's tab bar (same class names, same height).

Tab content:
```tsx
{activeTab === 'scope'        && <ActualsScope epics={filteredEpics} jiraWorkItems={jiraWorkItems} />}
{activeTab === 'health'       && <ActualsDeliveryHealth epics={filteredEpics} phasePlans={phasePlans} />}
{activeTab === 'people'       && <ActualsPeopleView phaseAssignments={phaseAssignments} teamMembers={teamMembers} businessContacts={businessContacts} />}
{activeTab === 'stakeholders' && <ActualsStakeholders epics={filteredEpics} bizAssignments={jiraItemBizAssignments} businessContacts={businessContacts} />}
```

Get `phasePlans` and `phaseAssignments` from the active Portfolio scenario (or main plan):
```typescript
const { scenarios } = useCurrentState();
const portfolioScenario = scenarios.find(s => s.isPortfolioScenario && s.id === activePortfolioScenarioId)
  ?? scenarios.find(s => s.isPortfolioScenario); // fall back to first portfolio scenario
const phasePlans = portfolioScenario?.phasePlans ?? [];
const phaseAssignments = portfolioScenario?.phaseAssignments ?? [];
```

#### New file: `frontend/src/components/actuals/ActualsScope.tsx`

The missing hierarchy view. Epic → Feature → Story tree imported from Jira.

```typescript
interface ActualsScopeProps {
  epics: JiraWorkItem[];
  jiraWorkItems: JiraWorkItem[];   // full flat list — component builds tree
}
```

Rendering:
- Group `jiraWorkItems` by parent: epics at top, features under epics, stories under features
- Collapse all epics by default; expand on click
- Each row: indent level, type icon (Epic/Feature/Story), key, summary, status badge
- Status badges: `Done` (green), `In Progress` (blue), `To Do` (grey), `Blocked` (red)
- Search (passed from parent) filters the tree — show matching rows and their ancestors

Tree building utility (add to `frontend/src/utils/jiraHierarchy.ts` or inline):
```typescript
function buildTree(items: JiraWorkItem[]): EpicNode[] {
  // Group by type, link children to parents via parentKey/epicKey
  // Return top-level epics with nested features and stories
}
```

#### New file: `frontend/src/components/actuals/ActualsDeliveryHealth.tsx`

```typescript
interface ActualsDeliveryHealthProps {
  epics: JiraWorkItem[];
  phasePlans: EpicPhasePlan[];
}
```

**KPI row** (above the table):
```tsx
<div className="grid grid-cols-5 gap-3 p-4">
  <KpiCard label="On Track"  value={counts.green}  color="green" />
  <KpiCard label="At Risk"   value={counts.amber}  color="amber" />
  <KpiCard label="Delayed"   value={counts.red}    color="red"   />
  <KpiCard label="Completed" value={counts.done}   color="grey"  />
  <KpiCard label="Next Delivery" value={nextDeliveryDate} subtitle={nextEpicName} />
</div>
```

**RAG derivation** (pure function, testable):
```typescript
function deriveRag(
  epic: JiraWorkItem,
  lastPhasePlan: EpicPhasePlan | undefined
): 'green' | 'amber' | 'red' | 'grey' {
  if (!lastPhasePlan) return 'grey';
  if (epic.status === 'Done') return 'green';
  const daysOverdue = differenceInDays(new Date(), new Date(lastPhasePlan.endDate));
  if (daysOverdue > 14) return 'red';
  if (daysOverdue > 0)  return 'amber';
  return 'green';
}
```

**Table columns:** Epic | Owner | Current Phase | Planned End | Jira Status | RAG | Days Variance

Table is sortable by any column. Default sort: RAG (red first).

#### New file: `frontend/src/components/actuals/ActualsPeopleView.tsx`

```typescript
interface ActualsPeopleViewProps {
  phaseAssignments: EpicPhaseAssignment[];
  teamMembers: TeamMember[];
  businessContacts: BusinessContact[];
}
```

Two sections:

**IT Team** — for each team member:
- Name + avatar
- Phase allocation chips: "Customer Portal / Build" etc.
- Total allocated days this quarter
- Utilization bar (use shared `UtilizationBar` component from Step 5)

**Business People** — same structure, phase-level allocation only.

#### New file: `frontend/src/components/actuals/ActualsStakeholders.tsx`

Simple table. Columns: Epic | Business Contact | Role | Current Jira Status

Read-only. No editing — ownership is assigned in Portfolio Planning.

---

### Step 5 — Visual alignment pass

**Effort:** Medium · **Risk:** Low

Do this after Steps 1–4 are stable.

#### Shared UtilizationBar component

**New file:** `frontend/src/components/shared/UtilizationBar.tsx`

```typescript
interface UtilizationBarProps {
  allocatedDays: number;
  availableDays: number;
  showLabel?: boolean;             // shows "8 / 10 days" text
  showOverallocationWarning?: boolean;
}

export function UtilizationBar({ allocatedDays, availableDays, showLabel, showOverallocationWarning }: UtilizationBarProps) {
  const pct = availableDays > 0 ? Math.min(allocatedDays / availableDays, 1) : 0;
  const isOver = allocatedDays > availableDays;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-[#0089DD]'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-xs tabular-nums ${isOver ? 'text-red-600 font-semibold' : 'text-[#64748B]'}`}>
          {allocatedDays}/{availableDays}d
        </span>
      )}
      {showOverallocationWarning && isOver && <span className="text-xs text-red-500">⚠</span>}
    </div>
  );
}
```

Replace the utilization bar rendering in:
- `PortfolioPlanning.tsx` PeopleView section
- `ActualsPeopleView.tsx`
- `CapacitySprintGrid.tsx`

#### Tab bar standardization

Reference: `PortfolioPlanning.css` for exact tab bar CSS. Apply the same:
- Tab height and padding
- Active border style (`border-b-2 border-[#0089DD]`)
- Font size and weight

Ensure `ScenarioPlanner.tsx` (Capacity Planner) and `Projects.tsx` (Actuals) use identical markup/classes.

#### Left panel standardization

Both Portfolio Planning and Capacity Planner have a collapsible left panel. Ensure:
- Same default width: `220px` (use CSS variable `--panel-left-width: 220px`)
- Same collapse button: right edge of panel, chevron icon, toggles to 0px
- Same header: title text left, optional count badge or action button right

---

## Track B: Costing Module v1

Costing lives **entirely in Portfolio Planning**. No changes to Capacity Planner or Actuals.

Full data model and SQL spec: `docs/plans/2026-04-02-costing-module-implementation-spec.md`

Execute after Step 2 of Track A.

---

### B1 — Types + shared utilities

#### `frontend/src/types/index.ts` — add:

```typescript
export type CurrencyCode = 'EUR' | 'GBP' | 'USD';

export interface MoneyAmount {
  amount: number;
  currency: CurrencyCode;
}

export interface CostLineItem {
  id: string;           // crypto.randomUUID()
  description: string;
  amount: number;
  currency: CurrencyCode;
  note?: string;
}

export interface CostSettings {
  reportingCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  fxToEur: Record<CurrencyCode, number>;   // "1 unit = X EUR"
  internalItDailyRate: MoneyAmount;
  businessDailyRate: MoneyAmount;
}

export interface ExternalVendor {
  id: string;
  name: string;
  dailyRate: number;
  currency: CurrencyCode;
  notes?: string;
  archived?: boolean;
  countsTowardCapacity?: boolean;
  workingDaysPerWeek?: number;
}

export interface InitiativeCostRecord {
  id: string;
  initiativeKind: 'portfolio_epic' | 'scenario_project';
  initiativeId: string;
  scenarioId?: string;
  contingencyPct: number;
  hardware?: CostLineItem | null;
  licenses: CostLineItem[];
  updatedAt: string;
}
```

Extend existing interfaces:
```typescript
// Settings — add:
costing: CostSettings;

// TeamMember — add:
workerType?: 'internal' | 'external';
externalVendorId?: string;
dailyRateOverride?: number;
dailyRateCurrency?: CurrencyCode;

// BusinessContact — add:
dailyRateOverride?: number;
dailyRateCurrency?: CurrencyCode;

// BusinessTeam — add:
dailyRateOverride?: number;
dailyRateCurrency?: CurrencyCode;

// AppState — add:
externalVendors: ExternalVendor[];
initiativeCosts: InitiativeCostRecord[];
```

#### `frontend/src/stores/appStore.ts`

Add to `defaultSettings`:
```typescript
costing: {
  reportingCurrency: 'EUR',
  supportedCurrencies: ['EUR', 'GBP', 'USD'],
  fxToEur: { EUR: 1, GBP: 1.17, USD: 0.92 },
  internalItDailyRate: { amount: 0, currency: 'EUR' },
  businessDailyRate:   { amount: 0, currency: 'EUR' },
},
```

Add to `defaultAppState`:
```typescript
externalVendors: [],
initiativeCosts: [],
```

In `migrate()`: guard with `if (!state.settings.costing) state.settings.costing = defaultSettings.costing;`

#### New file: `frontend/src/utils/assignableActors.ts`

Placeholder ID helpers. Critical for the `TEAM:<name>` → `TEAM:<id>` migration:

```typescript
export function isBusinessTeamPlaceholderId(id: string): boolean {
  return id.startsWith('TEAM:');
}

export function isExternalVendorPlaceholderId(id: string): boolean {
  return id.startsWith('VENDOR:');
}

export function parsePlaceholderId(id: string) {
  if (id.startsWith('TEAM:'))   return { kind: 'TEAM'   as const, entityId: id.slice(5) };
  if (id.startsWith('VENDOR:')) return { kind: 'VENDOR' as const, entityId: id.slice(7) };
  return null;
}

/**
 * Normalize legacy TEAM:<name> → TEAM:<id>.
 * Keep for at least one release after migration ships.
 */
export function normalizeLegacyTeamPlaceholder(
  id: string,
  businessTeams: Array<{ id: string; name: string }>
): string {
  if (!id.startsWith('TEAM:')) return id;
  const entityId = id.slice(5);
  if (entityId.includes('-')) return id;           // already a UUID
  const match = businessTeams.find(bt => bt.name === entityId);
  return match ? `TEAM:${match.id}` : id;
}

export function isCapacityBacked(id: string): boolean {
  return !isBusinessTeamPlaceholderId(id) && !isExternalVendorPlaceholderId(id);
}
```

#### New file: `frontend/src/utils/currency.ts`

```typescript
import type { CurrencyCode, CostSettings } from '../types';

export function convertToReportingCurrency(
  amount: number,
  sourceCurrency: CurrencyCode,
  settings: CostSettings
): number | null {
  const toEur = settings.fxToEur[sourceCurrency];
  const fromEur = settings.fxToEur[settings.reportingCurrency];
  if (!toEur || !fromEur) return null;
  return (amount * toEur) / fromEur;
}

export function formatCurrency(amount: number, currency: CurrencyCode, compact = true): string {
  if (compact && Math.abs(amount) >= 1000) {
    return `${currency} ${(amount / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${currency} ${amount.toLocaleString('en', { maximumFractionDigits: 0 })}`;
}
```

#### New file: `frontend/src/utils/costing.ts`

Implement these exports (full calculation rules in `docs/plans/2026-04-02-costing-module-implementation-spec.md` — "Calculation Rules" section):

- `resolveEffectiveDailyRate(memberId, ctx)` — returns `{ dailyRate, currency, missingRate }`
- `calculateLaborCost(assignments, ctx)` — returns `{ laborInReporting, hasMissingRate, hasMissingFx }`
- `calculateInitiativeCostBreakdown(laborResult, costRecord, ctx)` — returns full breakdown

Rate precedence (implement exactly):
1. Internal IT: personal override → global internal rate
2. External named person: personal override → linked vendor rate → missing rate warning
3. External vendor placeholder (`VENDOR:<id>`): vendor rate → missing rate warning
4. Business contact: personal override → global business rate
5. Business team placeholder (`TEAM:<id>`): team rate override → global business rate

#### New file: `frontend/src/utils/costing.test.ts`

Write unit tests (TDD — write before implementing `costing.ts`):
- Rate precedence: all 5 cases above
- FX conversion: EUR→EUR, GBP→EUR, USD→reporting USD
- Contingency: applies to labor only, not to licenses or hardware
- Missing rate: `hasMissingRate = true`, line excluded from totals (not treated as zero)
- Missing FX: `hasMissingFx = true`, line excluded

---

### B2 — Persistence (migrations + sync + actions)

#### Supabase migrations

Check `supabase/migrations/` for the highest-numbered file and renumber `047`/`048` accordingly.

**Before creating migrations:** verify `036_business_teams.sql` exists and has been applied. If not, fold the `business_teams` table creation into the first migration.

Full SQL content: see `docs/plans/2026-04-02-costing-module-implementation-spec.md` — "Migration 047" and "Migration 048" sections. Use those exactly (only change: file number prefix).

Summary of what each migration does:
- **047**: `external_vendors` table + rate override columns on `team_members`, `business_contacts`, `business_teams`
- **048**: `initiative_costs` table with constraint that `portfolio_epic` rows have `scenario_id = null` and `scenario_project` rows require a `scenario_id`

#### `frontend/src/stores/actions.ts` — add:

```typescript
addExternalVendor(vendor: Omit<ExternalVendor, 'id'>): void
updateExternalVendor(id: string, changes: Partial<ExternalVendor>): void
deleteExternalVendor(id: string): void
upsertInitiativeCost(record: InitiativeCostRecord): void
deleteInitiativeCost(id: string): void
```

Update scenario lifecycle:
- `duplicateScenario`: clone `initiativeCosts` where `scenarioId === sourceId`, assign new `id` and `scenarioId`. Skip rows with `scenarioId === null`.
- `deleteScenario`: remove `initiativeCosts` where `scenarioId === deletedId`.

#### `frontend/src/services/supabaseSync.ts` — extend:

Add load/save for:
- `external_vendors` table → `externalVendors` state
- `initiative_costs` table → `initiativeCosts` state
- New columns on `team_members`, `business_contacts`, `business_teams`
- `settings.costing` nested object

**Critical:** add graceful fallback — if tables return a 42P01 error (migration not yet applied), log a warning and skip only the costing slice. Do not fail the entire sync. Match the existing fallback pattern in this file.

---

### B3 — Admin / settings UI

#### New file: `frontend/src/pages/settings/CostingSection.tsx`

A settings section with:
1. **Reporting currency** — `<select>` EUR / GBP / USD
2. **FX rates** — table: "1 GBP = [input] EUR" and "1 USD = [input] EUR" (EUR is always 1, read-only)
3. **Global internal IT rate** — daily amount + currency
4. **Global business rate** — daily amount + currency
5. **External vendors list** — name, daily rate, currency, notes. Add / edit / archive / delete.

Saving writes to `settings.costing` and `externalVendors` in the store (which auto-syncs to Supabase).

#### `frontend/src/pages/Settings.tsx`

Import and add `<CostingSection />` to the Planning group, after `GeneralSection`.

#### `frontend/src/components/forms/TeamMemberForm.tsx`

Add:
- Worker type radio: Internal IT / External IT
- If External: optional vendor dropdown (populated from `externalVendors` store)
- Optional rate override: amount input + currency select (disabled when blank)
- Show helper text: "Leave blank to use [vendor rate / global internal rate]"

#### `frontend/src/pages/settings/BusinessContactsSection.tsx`

In the add/edit modal, add:
- Optional daily rate override (amount + currency)

#### `frontend/src/pages/settings/BusinessTeamsSection.tsx`

Upgrade from name-only list to editable rows:
- Name (existing)
- Optional daily rate + currency (new)

---

### B4 — Portfolio Planning cost UX

**This is the most complex step. Do it in this sub-order:**

#### B4a — Normalize business-team placeholder IDs (do this first)

**Problem:** `PortfolioPlanning.tsx` currently emits `TEAM:<businessTeamName>`. Renaming a team orphans all cost references. Must switch to `TEAM:<businessTeamId>`.

In `PortfolioPlanning.tsx`, search for all instances of:
```typescript
`TEAM:${businessTeam.name}`
// or
`TEAM:${bt.name}`
// or similar
```
Change every instance to use `.id` instead of `.name`.

In `frontend/src/hooks/usePortfolioPlan.ts` (or wherever `phaseAssignments` are loaded), normalize on read:
```typescript
const normalizedAssignments = assignments.map(a => ({
  ...a,
  memberId: normalizeLegacyTeamPlaceholder(a.memberId, businessTeams),
}));
```

The `normalizeLegacyTeamPlaceholder` function (from `assignableActors.ts`) handles backward compatibility for existing stored data.

#### B4b — Cost chips on epic rows

In the epic row render in `PortfolioPlanning.tsx`, after the epic title:

```tsx
const epicCost = useMemo(() =>
  calculatePortfolioEpicCost(epic.epicKey, phaseAssignments, initiativeCosts, costCtx),
  [epic.epicKey, phaseAssignments, initiativeCosts, costCtx]
);

{epicCost && (
  <button
    className={`ml-2 px-1.5 py-0.5 text-xs font-medium rounded ${
      epicCost.hasMissingRate
        ? 'bg-red-50 text-red-600'
        : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
    }`}
    onClick={() => openCostDrawer(epic.epicKey)}
    title={epicCost.hasMissingRate ? 'Some rates are missing — totals are partial' : undefined}
  >
    {epicCost.hasMissingRate && '⚠ '}
    {formatCurrency(epicCost.totalInReporting, settings.costing.reportingCurrency)}
  </button>
)}
```

#### B4c — Cost drawer

**New file: `frontend/src/components/portfolio/CostDrawer.tsx`**

A right-side slide-in drawer (not a modal — use the same pattern as existing drawers in Portfolio Planning).

```typescript
interface CostDrawerProps {
  epicKey: string | null;    // null = closed
  isBaseline: boolean;       // false when viewing a portfolio scenario
  onClose: () => void;
}
```

Content layout:
```
┌─ Customer Portal v2 — Cost ─────────────────── [×] ┐
│                                                      │
│  EUR 142,000                    Δ +12k vs baseline   │
│                                                      │
│  Labor breakdown                                     │
│  ─────────────────────────────────────────────────  │
│  Internal IT                            EUR 98,000   │
│    A. Müller   45d × €450/d             EUR 20,250   │
│    J. Chen     60d × €450/d             EUR 27,000   │
│    ...                                               │
│  External IT                            EUR 24,000   │
│    Vendor Co   20d × €600/d             EUR 12,000   │
│  Business                               EUR 6,000    │
│    L. Bergmann 12d × €250/d             EUR 3,000    │
│                                                      │
│  Contingency  [10] %                    EUR 12,800   │
│                                                      │
│  Direct costs                                        │
│  ─────────────────────────────────────────────────  │
│  Licenses                               EUR 8,000    │
│  [+ Add license line]                                │
│  Hardware                               —            │
│  [+ Add hardware item]                               │
│                                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  Total                                  EUR 142,800  │
│                                                      │
│  [if isBaseline=false]                               │
│  ℹ Direct costs are shared from the baseline plan    │
│    and must be edited there.                         │
└──────────────────────────────────────────────────────┘
```

Editing rules:
- `contingencyPct`, license lines, hardware line: **editable only when `isBaseline = true`**
- In scenario view: all direct cost fields show read-only with the info note above
- Saves via `upsertInitiativeCost` action on every field change (debounced 500ms)

#### B4d — Portfolio Summary tab cost section

In the Summary tab of `PortfolioPlanning.tsx` (or its `SummaryView` sub-component):

**Cost KPI row** (below/above existing KPI cards):
```tsx
<div className="grid grid-cols-5 gap-3">
  <CostKpiCard label="Labor"       value={summary.laborInReporting} />
  <CostKpiCard label="Contingency" value={summary.contingencyInReporting} />
  <CostKpiCard label="Licenses"    value={summary.licensesInReporting} />
  <CostKpiCard label="Hardware"    value={summary.hardwareInReporting} />
  <CostKpiCard label="Total"       value={summary.totalInReporting} highlight />
</div>
{(summary.hasMissingRate || summary.hasMissingFx) && (
  <p className="text-xs text-amber-600 mt-2">
    ⚠ Some rates or FX values are missing — totals are partial.
    <a href="/settings#costing" className="underline ml-1">Fix in Settings</a>
  </p>
)}
```

**Cost by Initiative table** (collapsible):

| Epic / Project | Labor | Contingency | Direct Costs | Total | Δ vs Baseline |
|---|---|---|---|---|---|
| Customer Portal v2 | EUR 128k | EUR 13k | EUR 8k | EUR 142k | +EUR 12k |
| ... | | | | | |

- Delta column: red for over, green for under, `—` for scenario-native projects
- Sort by Total descending by default
- Click epic name → opens CostDrawer for that epic

---

## New Files Summary

```
frontend/src/
├── components/
│   ├── layout/
│   │   └── StageProgressBar.tsx             (Step 2)
│   ├── capacity/
│   │   ├── CapacityBacklog.tsx              (Step 3)
│   │   ├── CapacitySprintGrid.tsx           (Step 3)
│   │   └── CapacityRequestCard.tsx          (Step 3)
│   ├── actuals/
│   │   ├── ActualsScope.tsx                 (Step 4)
│   │   ├── ActualsDeliveryHealth.tsx        (Step 4)
│   │   ├── ActualsPeopleView.tsx            (Step 4)
│   │   └── ActualsStakeholders.tsx          (Step 4)
│   ├── portfolio/
│   │   └── CostDrawer.tsx                   (B4c)
│   └── shared/
│       └── UtilizationBar.tsx               (Step 5)
├── pages/settings/
│   └── CostingSection.tsx                   (B3)
└── utils/
    ├── assignableActors.ts                  (B1)
    ├── currency.ts                          (B1)
    ├── costing.ts                           (B1)
    └── costing.test.ts                      (B1)

supabase/migrations/
├── 047_costing_rates_and_external_vendors.sql
└── 048_initiative_costs.sql
```

---

## Verification Checklist

### Navigation
- [ ] Sidebar order: Portfolio Planning → Capacity Planner → Actuals → Timeline → Team → Report → Settings
- [ ] Stage labels: "Portfolio Planning", "Capacity Planner", "Actuals" (not old names)
- [ ] StageProgressBar visible on all three screens
- [ ] Completed stages show ✓ and are clickable
- [ ] Current stage is highlighted

### Capacity Planner (Stage 2)
- [ ] No scenario tabs visible
- [ ] Left panel: Jira backlog items listed (not Done)
- [ ] Left panel: "What-if Requests" section with "+ Add request"
- [ ] "+ Add request" inline form: name, days, sprint, skills
- [ ] Drag Jira backlog item onto person/sprint → overallocation calculation appears
- [ ] Drag manual request card onto person/sprint → same calculation
- [ ] Overallocation: red highlight + "X will be at Y% in Sprint Z"
- [ ] Available: green confirm + "X has N days available"

### Actuals (Stage 3)
- [ ] Page title is "Actuals"
- [ ] 4 tabs: Scope, Delivery Health, People, Stakeholders
- [ ] Scope tab: Epic → Feature → Story hierarchy with status badges
- [ ] Scope tab: collapse/expand per epic; all collapsed by default
- [ ] Scope tab: search filters the tree (shows matching rows + ancestors)
- [ ] Delivery Health tab: KPI cards (On Track / At Risk / Delayed / Completed)
- [ ] Delivery Health tab: sortable table with RAG per epic
- [ ] No SmartAssignmentPanel, no bulk edit, no confidence controls
- [ ] Jira sync is a small indicator, not a primary button

### Costing
- [ ] Settings → Costing section: FX rates, global rates, external vendors
- [ ] Team member form: Internal/External toggle, vendor select, rate override
- [ ] Business contact edit: rate override fields
- [ ] Business team edit: rate fields
- [ ] Portfolio epic rows: cost chip showing formatted amount
- [ ] Cost chip: orange/red with ⚠ when rates are missing
- [ ] Cost drawer: opens from chip, shows labor breakdown + direct costs
- [ ] Cost drawer: direct cost editing available in baseline only; read-only in scenario with info note
- [ ] Portfolio Summary tab: 5 cost KPI cards + initiative cost table
- [ ] Delta column: red = over baseline, green = under, `—` for scenario-native
- [ ] TEAM: placeholder: new writes use `TEAM:<id>`; old `TEAM:<name>` still resolves
- [ ] Missing rate: warning shown and line excluded from totals (not treated as zero)
- [ ] FX rate change in Settings: portfolio totals update immediately
