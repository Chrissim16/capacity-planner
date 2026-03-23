# Scenario Planner — Implementation Plan

**Date:** 2026-03-19  
**Status:** Ready for Development  
**Covers:** F-SP-01 through F-SP-08 (26 stories minus skills system F-SP-09 — deferred to separate release)  
**Relates to:** scenario-planner-planning-stories-v2.md, scenario-planner-timeline-spec.md  

---

## Current State Snapshot

The following planner components already exist and are partially functional:

| File | State |
|---|---|
| `ScenarioPlanner.tsx` | Shell working. DndContext lifted to page level. Mode toggle, scenario tabs, save, capacity toggle all functional. |
| `PlannerTimeline.tsx` | Bars render. Drag to reposition works. Resize works. Expand/collapse works. Sprint headers with date range work. Sprint column drop zones registered. Backlog drag handler exists in `useDndMonitor`. |
| `PlannerBacklog.tsx` | Flat item list with search and status/epic filters. Drag sources registered. No hierarchy, no labels, no assignees. |
| `PlannerCapacity.tsx` | Confirmed working — real team member rows, per-sprint allocation, live drag preview. BUG-010 resolved. |
| `PlannerBoard.tsx` | Board mode working. BUG-001–004 resolved. |
| `ScenarioTabs.tsx` | Scenario creation modal (clone/blank). Pill tabs. Working. |

**Not yet created:**
- `AssignPopover.tsx` — the full assignment popover with effort slider
- `DaysPopover.tsx` — Board mode lightweight days entry (has bugs)

**Data model gaps** (`PlannerItem` in `types/index.ts` is missing):
```typescript
isManual: boolean
labels: string[]
jiraAssignees: string[]
jiraStartDate?: string
jiraEndDate?: string
requiredSkills: string[]   // deferred to skills release
```

---

## Phase Map

| Phase | Covers | Stories | Prerequisite |
|---|---|---|---|
| **Phase 0** | Foundation fixes + data model | BUGs + types | None |
| **Phase 1** | Jira data & initialization | SP-01–06 | Phase 0 |
| **Phase 2** | Timeline interactions | SP-07–13 | Phase 1 |
| **Phase 3** | Capacity & manual items | SP-14–19 | Phase 2 |
| **Phase 4** | Filtering | SP-20–21 | Phase 3 |

> **F-SP-09 (skills) is out of scope for this release.** SP-22–26 are tracked separately.

---

## Phase 0 — Foundation & Data Model

**Goal:** Fix all known bugs and extend the data model before any feature work begins.

### 0-A · Data model extension

**File:** `frontend/src/types/index.ts`

Add missing fields to `PlannerItem`:

```typescript
export interface PlannerItem {
  // ... existing fields unchanged ...
  isManual: boolean
  labels: string[]
  jiraAssignees: string[]       // Jira account display names — display only
  jiraStartDate?: string        // ISO date from Jira — used by Baseline init (SP-05)
  jiraEndDate?: string          // ISO date from Jira — used by Baseline init (SP-05)
  // requiredSkills: string[]   // deferred — skills release
}
```

**File:** Add `migratePlannerItem()` in `frontend/src/utils/plannerMigration.ts` (new utility):

```typescript
export function migratePlannerItem(raw: Partial<PlannerItem>): PlannerItem {
  return {
    ...raw,
    isManual: raw.isManual ?? false,
    labels: raw.labels ?? [],
    jiraAssignees: raw.jiraAssignees ?? [],
  } as PlannerItem;
}
```

Call this in `ScenarioPlanner.tsx` when reading `plannerLayout` from store, so scenarios saved before this change deserialize safely.

---

### 0-B · Bug status

All 10 bugs (BUG-001 through BUG-010) are confirmed resolved as of 2026-03-19. No bug-fix work is needed in Phase 0.

---

### 0-C · Replace EpicMovePrompt with undo toast pattern

**Context:** The current `PlannerTimeline.tsx` uses `EpicMovePrompt` — a confirmation modal — when an Epic bar is dragged. US-SP-09 removes this modal in favour of "move all children by default + 5-second undo toast."

**Files:** `PlannerTimeline.tsx`

- Delete the `EpicMovePrompt` component entirely.
- In `onDragEnd` (Case 1 — bar → sprint column), when `item.type === 'epic'`:
  - Move the Epic and all children immediately (delta applied to all).
  - Emit an undo toast via a `useToast` hook (or equivalent app toast system): `"Moved [Epic name] and [N] items — Undo"` with a 5-second action window.
  - The undo callback restores the previous positions from a captured snapshot.
- Keep the Shift modifier path (SP-09 AC #4) as a follow-up in Phase 2 once the base move works.

> **Note:** If no toast system exists yet in the app, add a lightweight `useToast` hook in `hooks/useToast.ts` that renders a fixed-position toast container. Keep it simple — no queue, just a single active toast at a time (matching the spec's "single-action 5-second" model).

**Acceptance check:** Drag an Epic with children → all items move → toast appears → clicking Undo restores positions.

---

## Phase 1 — Jira Data & Initialization

### SP-01 · Backlog hierarchy (tree view)

**File:** `PlannerBacklog.tsx`

Current state: flat list. Replace with a tree derived from `jiraItems`.

**Key changes:**
1. Derive an `unscheduled` tree structure: Epics at root, Features under their Epic, Stories under their Feature. Group orphans in an "Unlinked items" section at the bottom.
2. The backlog header counter shows **Epics only** (not total items). Add a tooltip: `"N epics unscheduled — expand to see features and stories"`.
3. Each Epic and Feature card gets an expand/collapse chevron showing/hiding its children inline in the sidebar list. Track `expandedBacklogIds: Set<string>` in local state.
4. When an item is placed on the timeline (its `sourceId` appears in `plannerItems`), it is removed from the backlog. If an Epic is placed but some of its Features are not, those Features remain in the backlog under their parent Epic.
5. `BacklogItem` component gets a `depth` prop (0/1/2) for indentation.

**New prop needed on `PlannerBacklogProps`:**
```typescript
// No new props — jiraItems and plannerItems already contain all needed data
```

---

### SP-02 · Labels on backlog cards

**File:** `PlannerBacklog.tsx` → `BacklogItem` component  
**Prerequisite:** Phase 0-A data model (labels field on PlannerItem), plus labels must be present on `JiraWorkItem`.

**Check first:** Verify `JiraWorkItem` in `types/index.ts` has a `labels?: string[]` field. If not, add it and update the Jira sync service to populate it.

**Changes:**
1. In `BacklogItem`, below the summary, render label pills when `item.labels?.length > 0`. Show max 3, "+N more" overflow.
2. No custom colouring per label — neutral pill style (`bg-mileway-bg text-mileway-grey`).

---

### SP-03 · Assignees and sprint position on backlog cards

**File:** `PlannerBacklog.tsx` → `BacklogItem` component  
**Prerequisite:** `JiraWorkItem` must carry `assignee?: { displayName: string; avatarUrl?: string }` and `sprint?: string` / `startDate?: string` / `endDate?: string`. Verify presence; add to type and Jira sync if missing.

**Changes:**
1. Show existing Jira assignee avatars as chips (max 3, "+N" overflow). Initials fallback.
2. Show sprint label (e.g. "S7") if present, or date range (e.g. "Mar 30 – Apr 10") if start/end date is set but no sprint. Render nothing if neither exists.
3. These are **display-only** on the backlog card — they do not auto-place the item.

---

### SP-04 · Blank Slate initialization

**File:** `ScenarioPlanner.tsx` — `handleCreateScenario`

Current state: `startMode === 'blank'` calls `createScenario(name)` which leaves `plannerLayout` undefined. This is already correct behaviour for Blank Slate.

**Additions:**
1. When blank slate opens, show the empty state in the timeline: `"Drag items from the backlog to start planning."` — this already exists in `PlannerTimeline.tsx`.
2. Verify the team member panel (Board mode) and capacity panel pre-populate with all active members at 0% allocation. This should follow naturally from Phase 3 capacity panel implementation.
3. Items with `statusCategory: 'in_progress'` in Jira show an "Active in Jira" indicator chip on the backlog card (not locked — visual reminder only).

---

### SP-05 · Baseline initialization (Jira dates → sprint positions)

**Files:** `ScenarioPlanner.tsx`, `stores/actions.ts`, new util `frontend/src/utils/plannerInit.ts`

This is the most complex story in Phase 1. Break it into a standalone utility before wiring it into the UI.

**New utility `plannerInit.ts`:**

```typescript
/** Maps a Jira item's sprint/date data to a PlannerItem starting position.
 *  Returns null if no position can be determined (item stays in backlog). */
export function baselinePositionForItem(
  item: JiraWorkItem,
  sprints: Sprint[],
): { startSprint: number; spanSprints: number } | null
```

Logic (per SP-05 AC #1):
- If `item.sprint` (sprint number) is set → use it directly. Span = `sprint_end - sprint_start + 1` if both set, else defaults (Epic: 6, Feature: 2, Story: 1).
- Else if `item.startDate` and `item.endDate` → map `startDate` to nearest sprint via `sprints` array. Calculate span as `ceil((endDate - startDate) / 14)`, min 1.
- Else → return `null`.

**Store action:**
```typescript
export function initBaselineScenario(scenarioId: string, sprints: Sprint[]): void
```
Builds `PlannerItem[]` from `jiraWorkItems` using `baselinePositionForItem`, sets `locked: true` for `in_progress` items, creates `PlannerAssignment[]` from `jiraAssignees` and `jiraItemBizAssignments`, calls `updatePlannerLayout`.

**UI — `ScenarioTabs.tsx`:**  
When "Clone current plan" is selected in the creation modal, call `initBaselineScenario` after creating the scenario. Show the dismissible banner: `"Loaded from Jira — [N] items placed, [M] unscheduled in backlog."` The banner is stored in local component state and dismissed via an X button.

---

### SP-06 · Actual availability on people cards

**Files:** `PlannerBoard.tsx`, `PlannerCapacity.tsx`

**Changes:**
1. Each team member card in the people panel shows: total available days for the current quarter (working days − PTO − public holidays) via `calculateCapacity()`.
2. A mini capacity bar shows used days vs available days, updating as assignments are made. Wire to `plannerLayout` assignments.
3. Available days tooltip on hover: `"X working days · Y days PTO · Z public holidays."` — extract these sub-values from `calculateCapacity()` output.
4. BIZ contacts use `calculateBusinessCapacityForQuarter()`.
5. "No availability" state for zero-day members.

---

## Phase 2 — Timeline Interactions

### SP-07 · Epic drag from backlog → children follow

**File:** `PlannerTimeline.tsx` — `onDragEnd` Case 3 (backlog → sprint)  
**Current state:** Case 3 places a single item. Extend it for Epic drops.

**Changes:**
1. When `ji.type === 'epic'` is dropped onto a sprint column, also create `PlannerItem` entries for all its descendant Features and Stories from `jiraItems`.
2. Default spans: Epic → 6, Feature → 2, Story → 1.
3. All newly placed items start at the target sprint.
4. **Partial placement edge case:** If a Feature is already on the timeline (`scheduledSourceIds` contains its ID), skip it. The remaining items are placed. Toast: `"Placed [Epic name] with [N] features — [M] already scheduled, left in place."`.
5. No assign popover auto-open on Epic drop.
6. All placed items are removed from the backlog (they will no longer appear in the unscheduled derived view since their `sourceId` is now in `plannerItems`).
7. Toast: `"Placed [Epic name] with [N] features and [M] stories."` (5-second, no undo needed for this action — placement can be undone by dragging back to backlog).

---

### SP-08 · Individual Feature/Story drag refinements

**File:** `PlannerTimeline.tsx`  
**Current state:** Case 3 already handles individual items. Refinements needed:

1. Feature default span → 2, Story default span → 1 (current `NEW_ITEM_SPAN = 2` applies to both; make type-aware).
2. **Parent Epic not on timeline:** When a Feature is placed and its parent Epic is not in `plannerItems`, show a ⚠ icon in `LabelCell`. Tooltip: `"Parent epic not yet scheduled."` This clears when the parent Epic is subsequently placed.
3. **Assign popover on drop:** Open the `AssignPopover` automatically on drop **only if** the item has no `jiraAssignees`. If the item has Jira assignees, show a toast: `"[Item name] placed — click bar to review assignments."` — Requires `AssignPopover` to be built first (see SP-11).

---

### SP-09 · Bar drag with undo toast + Shift modifier

**File:** `PlannerTimeline.tsx`

**Changes:**
1. **Undo toast for Epic moves:** Already specified in Phase 0-C. Confirm the toast fires and the undo callback works correctly.
2. **Shift modifier (Epic-only move):** Track `shiftHeld` state via `window` keydown/keyup listeners (or a `useKeyModifier` hook). When `shiftHeld` is true during an Epic drag, only move the Epic bar (not children). Show label beneath dragged bar: `"Shift held — Epic only"`. Add hover tooltip on Epic bars: `"Drag to move all · Shift+drag to move Epic only"`.
3. **Out-of-bounds snap:** If a drop resolves to a sprint number outside `[firstSprintNum, firstSprintNum + SPRINT_COUNT - 1]`, snap to the nearest valid sprint.
4. **Capacity panel update during drag:** Confirm `onActiveDragChange` is firing live during drag and `PlannerCapacity` responds. If not, wire the preview logic in the capacity panel (Phase 3).

---

### SP-10 · People drawer + drag-to-assign

**Files:** New component `frontend/src/components/planner/PeopleDrawer.tsx`, changes to `ScenarioPlanner.tsx` and `PlannerTimeline.tsx`

**New component `PeopleDrawer.tsx`:**
- 240px collapsible panel, toggled via a "People" button in the toolbar (Timeline mode only).
- Lists all active `TeamMember` (IT) + non-archived `BusinessContact` (BIZ) records.
- Each person card shows: avatar, name, role badge, available days (per SP-06).
- Each card is a `useDraggable` source with `data: { type: 'person-drag', member }`.
- The gantt canvas shrinks when the drawer opens (adjust the flex layout in `ScenarioPlanner.tsx`).

**`PlannerTimeline.tsx`:**
- Register each PlannerBar as a `useDroppable` target for person drops (separate `id` namespace: `"bar-drop-${item.id}"`).
- During a person drag, apply a blue glow outline to all unlocked bars. Skip locked bars.
- In `onDragEnd`: when `aData.type === 'person-drag'` and `over.id` starts with `"bar-drop-"`, extract the `plannerItem` and open `AssignPopover` with the person pre-selected.

**`ScenarioPlanner.tsx`:**
- Add "People" button to the Timeline mode toolbar. Toggle `showPeopleDrawer` state.
- Mount `PeopleDrawer` beside the gantt when in Timeline mode and drawer is open.

---

### SP-11 · Assign popover (full implementation)

**File:** New `frontend/src/components/planner/AssignPopover.tsx`  
**Dependency:** `@floating-ui/react` (already in package.json per design doc)

This is the most complex new component in Phase 2.

**Props:**
```typescript
interface AssignPopoverProps {
  item: PlannerItem;
  teamMembers: TeamMember[];
  businessContacts: BusinessContact[];
  sprints: Sprint[];
  selectedQuarter: string;
  anchorEl: HTMLElement | null;       // the bar element that was clicked/dropped onto
  preSelectedMemberId?: string;       // set when opened via drag-to-assign (SP-10)
  onAssign: (assignment: PlannerAssignment) => void;
  onRemove: (memberId: string) => void;
  onClose: () => void;
}
```

**Content (per SP-11 AC):**
1. Header: item type pill, item name, sprint range (e.g. "S7 – S9").
2. Team member list sorted by fit tier: Good fit → Partial fit → Poor fit. Within each tier, sorted by available days descending. Use `scoreMember()` from `utils/staffing.ts` if available; fall back to available-days sort only.
3. Already-assigned members appear at the top above all tiers with an "Assigned" badge and their current `daysPerSprint`.
4. Clicking an unassigned member row expands the row inline with the effort slider (SP-12). Clicking an already-assigned member opens their slider in edit mode.
5. Multiple people can be assigned in a single popover session.
6. Close on click-outside, scroll, or Escape.
7. Portal to `document.body` via `@floating-ui/react`.

**Trigger integration:**
- `PlannerTimeline.tsx`: clicking any bar calls `setAssignPopoverTarget({ item, anchorEl })` in state. Mount `AssignPopover` at page level in `ScenarioPlanner.tsx`.
- `onAssign` calls `handleItemsChange` with updated `assignees` array.

---

### SP-12 · Effort slider

**File:** `AssignPopover.tsx` — inline within the member row expansion

**Per SP-12 AC:**
1. Range: 1–10 days/sprint, 1-day increments. Min 1 (use "Remove assignment" for zero).
2. Show numeric value: `"3 days / sprint"`.
3. Show calculated total: `"= [N] days total across [X] sprints."` — `N = daysPerSprint × item.spanSprints`.
4. Capacity warning fires live as slider moves (SP-23 is deferred to skills release; for this release, show a basic overload indicator using `calculateCapacity()` data without the full skills tier badges).
5. "Confirm" saves. "Cancel" or click-outside discards.

---

### SP-13 · Assignment removal

**File:** `AssignPopover.tsx` + `PlannerTimeline.tsx` (secondary drag path)

**Primary path (SP-11):** Each assigned member row in the popover shows a "Remove" link. Clicking removes the `PlannerAssignment` and fires an undo toast: `"Removed [Person name] from [Item name] — Undo"` (5-second window).

**Secondary path — drag-to-removal zone:**
1. On hover over a bar that has assignees, small avatar chips appear at the left edge of the bar. These chips are `useDraggable` sources with `data: { type: 'assignment-chip', memberId, plannerItemId }`.
2. Register a fixed-position removal drop zone at the bottom of the gantt canvas (above the capacity panel). Use `useDroppable({ id: 'assignment-removal-zone' })`. Show it only when `dragType === 'assignment-chip'`.
3. Drop → remove the `PlannerAssignment`. Same undo toast.
4. Drop anywhere else → no state change.

---

## Phase 3 — Capacity & Manual Items

### SP-14 · Per-sprint capacity panel (individual rows)

**File:** `PlannerCapacity.tsx`  
**Status:** Read the full file to confirm current state before starting. If the real rows are not yet rendered, implement them now.

**Per SP-14 AC:**
1. One row per active `TeamMember` (IT) and non-archived `BusinessContact` (BIZ). Group within process team sections (see SP-15).
2. Row: avatar, name, role badge (IT: `#0089DD` / BIZ: `#6C7A89`), one cell per sprint.
3. Cell: allocation % (bold, tier-coloured), `load / avail` days (muted), 3px mini progress bar (tier colour, red overflow segment beyond 100%).
4. "OVERLOADED" badge + red left border when any sprint exceeds 100%.
5. All values update live on bar drag, bar resize, effort slider. Capacity panel needs to receive `activeDragPreview` from `ScenarioPlanner` and recalculate provisional allocation.
6. On open after being hidden, recalculate from current `plannerItems` (no stale values, no spinner).

**Props required from `ScenarioPlanner`:**
```typescript
teamMembers: TeamMember[]
businessContacts: BusinessContact[]
businessTimeOff: BusinessTimeOff[]
timeOff: TimeOff[]
```
Add these to `PlannerCapacityProps` and pass from `ScenarioPlanner`.

---

### SP-15 · Process team rollup rows

**File:** `PlannerCapacity.tsx`

**Prerequisite:** Confirm `AppState.processTeams` is accessible from `ScenarioPlanner`. It is global (not scenario-snapshotted), so read from `useCurrentState()`.

**Changes:**
1. Add a `"Team total"` row pinned at the very top (all members combined).
2. For each unique `processTeam` (resolved from `TeamMember.processTeamIds[0]` via `processTeams` lookup), render a summary row above the individual member rows.
3. Summary row cell: total allocated days / total available days for the team as a percentage. Background colour = **worst individual tier in that team for that sprint** (not the average).
4. Sort process team rows by highest per-sprint allocation, descending.
5. Process team rows are collapsible (click to toggle member rows).
6. Members with no `processTeam` → "Unassigned team" section at the bottom. If >20% of active members have no team, show a data-quality notice.

> **Implementation note:** `TeamMember.processTeamIds` is an array. Use `processTeamIds[0]` as the primary process team for grouping. If a member belongs to multiple process teams, they appear in the first team's section only (acceptable simplification for v1).

---

### SP-16 · Capacity panel live update during all planning actions

**File:** `PlannerCapacity.tsx`, `ScenarioPlanner.tsx`

This is wiring work, not new functionality. Confirm:
1. `activeDragPreview` from `ScenarioPlanner` is used by `PlannerCapacity` to show provisional allocation during drag/resize.
2. When `activeDragPreview` is active, compute provisional `plannerItems` (with the dragged item at its preview position) before running capacity calculation.
3. IT and BIZ rows update in the same render cycle.
4. Mini progress bar CSS transition (`transition: width 300ms ease`) applied.

---

### SP-17 · Create an Epic manually

**Files:** New `frontend/src/components/planner/ManualItemModal.tsx`, changes to `PlannerTimeline.tsx` toolbar

**New `ManualItemModal.tsx`:**
- Modal (uses the app's existing `Modal` primitive).
- Fields: name (required), description (optional), labels (multi-select tag input from the label vocabulary — unique labels across all `jiraItems`).
- On save: creates a `PlannerItem` with `isManual: true`, `sourceId: ''`, `type: 'epic'`, and places it in the backlog (does not auto-place on timeline).

**`PlannerTimeline.tsx` toolbar:**
- Add `"+ Add Epic"` button. Opens `ManualItemModal`.
- On modal save, call `onItemsChange([...plannerItems, newItem])` — the item has no `startSprint` yet, so it won't render as a bar. It renders as a backlog card instead.

**Backlog integration:**
- Manually created items (where `isManual: true`) appear in the backlog like any Jira-sourced item. They show a `✏️` badge. Tooltip: `"Manually created — not in Jira."`.
- They are draggable to the timeline using the same backlog drag mechanism.

---

### SP-18 · Create a Feature or Story manually

**File:** `PlannerTimeline.tsx` — label column hover button, `ManualItemModal.tsx`

**Changes:**
1. In `LabelCell`, add a `+` button that appears on hover at the right end of Epic rows (create Feature) and Feature rows (create Story). Uses the same `ManualItemModal` pre-configured to the correct type and parent.
2. The modal pre-fills the parent field. The PM can change it via a dropdown.
3. On save, the new child item appears in the backlog under its parent. If the parent is already on the timeline, the child still starts in the backlog (drag-to-place pattern).
4. `isManual: true` and `✏️` badge treatment apply.

---

### SP-19 · Edit and delete manually created items

**File:** `PlannerTimeline.tsx` — right-click context menu on bars and label cells

**Changes:**
1. Add a `onContextMenu` handler to bar elements and label cells.
2. **Manually created items** (`item.isManual === true`): context menu shows "Edit", "Delete".
   - "Edit" opens `ManualItemModal` pre-filled with current values.
   - "Delete" removes the item and all its children immediately, fires undo toast: `"Deleted [item name] — Undo"` (5-second window). No confirmation modal.
3. **Jira-sourced items** (`item.isManual === false`): context menu shows "View in Jira" (opens `item.jiraKey` URL), "Unlock in this scenario" (if locked). No Edit, no Delete.
4. Context menu: implement as a small floating popover via portal (`@floating-ui/react`), positioned at the mouse click location, closed on click-outside or Escape.

---

## Phase 4 — Filtering

### SP-20 · Label filter

**Files:** `ScenarioPlanner.tsx` (toolbar), `PlannerTimeline.tsx`, `PlannerBacklog.tsx`

**State:** Add `labelFilter: string[]` to `ScenarioPlanner` local state. Pass down to both components.

**Toolbar control:** Multi-select dropdown in the Timeline toolbar showing all unique labels across active items. Active filter shows count badge (e.g. "Labels: 2") and a "Clear" inline button.

**Filter logic in `PlannerTimeline.tsx`:**
- An item matches if it carries at least one selected label.
- Bubble-up rules: Story match → show parent Feature + parent Epic. Feature match → show parent Epic. Epic match → show all children.
- Items that neither match nor are structural ancestors/descendants of a match are hidden from `visibleItems`.
- Expand/collapse state is not affected.
- Capacity panel is not filtered.

**Filter logic in `PlannerBacklog.tsx`:**
- Apply the same label filter to the unscheduled item list.

---

### SP-21 · Epic filter

**Files:** `ScenarioPlanner.tsx` (toolbar), `PlannerTimeline.tsx`, `PlannerBacklog.tsx`

**State:** Add `epicFilter: string[]` (Epic jiraKeys) to `ScenarioPlanner` local state.

**Toolbar control:** Multi-select dropdown showing all Epic names + keys. Shares the "Filters" toolbar group with the label filter. "Clear" button clears both filters simultaneously.

**Filter logic:**
- Selecting Epics shows only those Epics and their descendant Features and Stories.
- **Combined filter logic:** When both label and Epic filters are active, show items that match the Epic filter AND carry at least one of the selected labels (AND between dimensions, OR within).
- Empty state message: `"No items match the current filters — try adjusting your selection."`.

---

## New Files Summary

| File | Phase | Purpose |
|---|---|---|
| `frontend/src/utils/plannerMigration.ts` | 0 | `migratePlannerItem()` normalizer |
| `frontend/src/utils/plannerInit.ts` | 1 | `baselinePositionForItem()` for Baseline mode (SP-05) |
| `frontend/src/components/planner/PeopleDrawer.tsx` | 2 | Collapsible 240px people panel for drag-to-assign |
| `frontend/src/components/planner/AssignPopover.tsx` | 2 | Full assignment popover with member list + effort slider |
| `frontend/src/components/planner/ManualItemModal.tsx` | 3 | Create/edit modal for manually created items |
| `frontend/src/hooks/useToast.ts` | 0 | Lightweight single-toast hook (if not already in app) |
| `frontend/src/hooks/useKeyModifier.ts` | 2 | Tracks Shift key state for Epic-only drag modifier |

---

## Modified Files Summary

| File | Phases | Key changes |
|---|---|---|
| `frontend/src/types/index.ts` | 0 | Add `isManual`, `labels`, `jiraAssignees`, `jiraStartDate`, `jiraEndDate` to `PlannerItem`. Add `labels?: string[]` and `assignee` to `JiraWorkItem` if missing. |
| `frontend/src/pages/ScenarioPlanner.tsx` | 0, 1, 2, 3, 4 | Add label/epic filter state, people drawer toggle, pass `teamMembers`/`businessContacts` to `PlannerCapacity`, Baseline init wiring, AssignPopover mount. |
| `frontend/src/components/planner/PlannerTimeline.tsx` | 0, 2, 3, 4 | Remove `EpicMovePrompt`, undo toast for Epic moves, Shift modifier, SP-07/08 backlog drop hierarchy, bar context menu, label column hover button for SP-18, label filter in visibleItems. |
| `frontend/src/components/planner/PlannerBacklog.tsx` | 1, 4 | Tree view, label chips on cards, assignee chips on cards, sprint position on cards, Active-in-Jira indicator, label filter integration. |
| `frontend/src/components/planner/PlannerCapacity.tsx` | 3 | Real team member rows, process team rollup, live drag preview wiring. |
| `frontend/src/components/planner/PlannerBoard.tsx` | 0 | Fix BUG-001, BUG-002. |
| `frontend/src/components/planner/ScenarioTabs.tsx` | 1 | Baseline mode → call `initBaselineScenario`. Dismissible banner. |
| `frontend/src/stores/actions.ts` | 1 | Add `initBaselineScenario()` action. |

---

## Delivery Sequence Within Each Phase

Each phase is a single dev cycle. Within a phase, implement stories in dependency order:

**Phase 0:** 0-A → 0-B → 0-C (data model before bug verification; bugs before EpicMovePrompt removal)  
**Phase 1:** SP-05 utility first (standalone, testable) → SP-03 type check → SP-01 → SP-02 → SP-03 → SP-04 → SP-05 UI wiring → SP-06  
**Phase 2:** SP-11 + SP-12 first (AssignPopover must exist before SP-08/SP-10 can use it) → SP-07 → SP-08 → SP-09 → SP-10 → SP-13  
**Phase 3:** SP-14 → SP-15 → SP-16 → SP-17 → SP-18 → SP-19 (capacity before manual items; manual items build on label vocabulary from SP-02)  
**Phase 4:** SP-20 → SP-21 (label filter before Epic filter; combined logic in SP-21 depends on SP-20 state)

---

## Out of Scope (this release)

- F-SP-09 (SP-22–26): Skills system, required skills on items, skill mismatch warnings, skill coverage gap badges, smart person suggestions — **separate release**
- Weekly column granularity
- Per-sprint effort variance
- Cross-quarter drag
- Two-way Jira sync
- Full undo/redo stack (single-action 5-second toasts only)
- Admin UI for proposed skills review queue
