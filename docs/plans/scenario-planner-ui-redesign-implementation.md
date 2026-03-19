# Scenario Planner UI Redesign — Implementation Plan
## Layout, Drawers & Interaction Model

**Date:** 2026-03-19
**Status:** Ready for development
**Spec:** `docs/plans/scenario-planner-ui-redesign-spec.md`
**Author:** Dennis Simon / AI-assisted

---

## Overview

This plan breaks the redesign into **7 sequential phases**. Each phase is independently shippable and leaves the product in a working state. Phases 1–3 restructure the shell and drawers; Phases 4–6 update the Board and Timeline canvases; Phase 7 handles the new Slide-Out Detail Panel.

**Total estimated stories: 22**  
**New files: 2** (`PlannerTeamDrawer.tsx`, `BoardToolbar.tsx`)  
**Modified files: 4** (`ScenarioPlanner.tsx`, `PlannerBacklog.tsx`, `PlannerBoard.tsx`, `PlannerTimeline.tsx`)

---

## Dependency order

```
Phase 0 (State shell)
    └─> Phase 1 (Toolbar)
            ├─> Phase 2 (Backlog drawer)
            ├─> Phase 3 (Team drawer)
            │       ├─> Phase 4 (Board canvas)
            │       └─> Phase 5 (Timeline canvas updates)
            └─> Phase 6 (Coexistence rules)
                    └─> Phase 7 (Slide-out detail panel)
```

---

## Phase 0 — State Shell & Layout

**Goal:** Lift all UI toggle state to `ScenarioPlanner.tsx`, replace the permanent flex-split layout with a single full-width canvas container, and add the `position: relative` wrapper that all overlay drawers and the detail panel will anchor to.

---

### US-UI-01 · Lift drawer and mode state to page level

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**As a** developer,  
**I want** all planner UI toggle state in one place at the page shell level,  
**so that** toolbar buttons, drawers, and canvases share a single source of truth without store involvement.

**Acceptance criteria:**

1. Replace the existing ad-hoc `showCapacity`, `showPeople` booleans with a single `plannerUI` state object:

```typescript
interface PlannerUIState {
  backlogOpen: boolean;       // default false
  teamDrawerOpen: boolean;    // default false
  capacityOpen: boolean;      // default false (Timeline only)
  activeMode: 'board' | 'timeline';
  selectedProjectId: string | null; // Board mode — drives SmartAssignment panel
  detailItemId: string | null;      // drives Slide-out Detail Panel
}
```

2. All five boolean fields are toggled by simple `setState` calls — no Zustand store writes.
3. `selectedProjectId` resets to `null` when `activeMode` switches to `timeline`.
4. `detailItemId` resets to `null` when `activeMode` switches.
5. Existing `selectedQuarter`, `mode`, `activeDragPreview`, `assignTarget` state vars are unchanged.

---

### US-UI-02 · Canvas wrapper with overlay anchor

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**As a** developer,  
**I want** the canvas area to use `position: relative; overflow: hidden` so that drawers and the detail panel can be absolutely positioned inside it without affecting page scroll,  
**so that** overlaid surfaces never displace the gantt or card grid.

**Acceptance criteria:**

1. The content area below the toolbar becomes:
   ```tsx
   <div className="flex-1 relative overflow-hidden">
     {/* canvas content */}
     {/* drawers rendered here as absolute children */}
   </div>
   ```
2. Board mode and Timeline mode content each remain `flex-1 h-full` inside this wrapper.
3. No horizontal reflow occurs when drawers open or close — canvas width does not change.
4. The viewport notice (`ViewportNotice`) remains unchanged, shown below `1200px` (existing threshold; spec uses 1280px — do not change the runtime threshold in this story, address in Phase 6).

---

## Phase 1 — Shared Toolbar

**Goal:** Replace the current toolbar with the spec-compliant element set: scenario mode chip, scenario tab pill, `+` button, `Board|Timeline` segmented toggle, quarter navigator (Timeline only), Backlog/Team/Capacity toggle buttons with count badges, Save button.

---

### US-UI-03 · Scenario mode chip and tab pill

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**Acceptance criteria:**

1. Left of all other toolbar controls: a scenario-mode chip renders `[⚡ Scenario mode]` (icon + label) in a muted pill. This is display-only — no interaction.
2. The existing `ScenarioTabs` component is replaced by a single **scenario tab pill**: the active scenario name + a `▾` chevron. Clicking opens the existing scenario picker/dropdown.
3. The `+` new scenario button sits immediately right of the tab pill.
4. All three elements are separated from the rest of the toolbar by a 1px vertical divider.
5. At the 5-scenario limit the `+` button is `disabled` with `title="Maximum 5 scenarios"`.

---

### US-UI-04 · Board | Timeline segmented control

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**Acceptance criteria:**

1. The existing `ModeToggle` component is kept but repositioned — it follows the left-side scenario controls with a `flex: 1` spacer between them (pushing right-side controls to the edge).
2. The toggle labels are `Board` and `Timeline` in that order (Board first, matching current default).
3. Switching mode preserves all data state. `selectedProjectId` and `detailItemId` reset to `null` on switch.

---

### US-UI-05 · Quarter navigator (Timeline mode only)

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**Acceptance criteria:**

1. Right-side controls, before the Backlog button: `‹ Q1 2026 ›` prev/next navigator, shown only when `activeMode === 'timeline'`.
2. `currentQuarter` state lives in `plannerUI` (already from US-UI-01 as an addition — `currentQuarterIndex: 0|1|2|3`). Derive the label `Q1–Q4 YYYY` from the `quarters` array.
3. Prev `‹` is disabled at the first available quarter. Next `›` is disabled at the last.
4. The navigator is **not rendered at all** in Board mode (not disabled — hidden).
5. Changing the quarter updates `selectedQuarter` passed to `PlannerTimeline` and `PlannerCapacity`.

---

### US-UI-06 · Backlog and Team toggle buttons with count badges

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**Acceptance criteria:**

1. `Backlog` button: label "Backlog" + a small badge showing the count of unscheduled epic-level items. Active state: `bg-mileway-blue-10 text-mileway-blue`. Keyboard shortcut: `B` (global, not shadowing existing shortcuts).
2. `Team` button: label "Team" + a badge showing total active IT members + non-archived BIZ contacts. Active state: same as Backlog.
3. `Capacity` button: label "Capacity" + bar-chart icon. Shown only in Timeline mode (same rule as quarter navigator — hidden in Board mode). Active state: same.
4. Both count badges render at all times (when drawer is open or closed) — they communicate what's available.
5. Clicking any button toggles the corresponding boolean in `plannerUI`.
6. The `B` keyboard shortcut toggles `backlogOpen`; `T` toggles `teamDrawerOpen`. Both shortcuts must check that `document.activeElement` is not an input or textarea before firing.

---

### US-UI-07 · Save button confirmation states

**File:** `frontend/src/pages/ScenarioPlanner.tsx` (existing `SaveButton`)

**Acceptance criteria:**

1. Successful save: button label changes to "Saved ✓" for 2 seconds then reverts to "Save". Use `setTimeout` with cleanup in `useEffect`.
2. Failed save: button shows a red outline with label "Retry" and persists in that state until the user clicks it (triggering another save attempt) or a successful save clears it.
3. The "saving" spinner state from the current implementation is preserved.

---

## Phase 2 — Backlog Drawer

**Goal:** Convert `PlannerBacklog` from a permanent flex-child sidebar into an absolute-positioned overlay drawer that slides in from the left edge of the canvas.

---

### US-UI-08 · Backlog as overlay drawer

**File:** `frontend/src/components/planner/PlannerBacklog.tsx`

**Acceptance criteria:**

1. Remove the collapsed "pill strip" mode entirely. The component now has two states only: mounted (open) or unmounted (closed). Mounting/unmounting is controlled by `backlogOpen` in `ScenarioPlanner.tsx`.
2. When mounted, the drawer is:
   ```
   position: absolute
   top: 0, left: 0, bottom: 0
   width: 280px
   z-index: 30  (above canvas rows, below detail panel at z-50)
   box-shadow: 4px 0 20px rgba(0,0,0,0.08)
   ```
3. Open animation: `translateX(-100%)` → `translateX(0)`, 200ms `cubic-bezier(0.25, 0.46, 0.45, 0.94)`. Use a CSS class transition on mount (e.g. `animate-slide-in-left` defined in `index.css`).
4. Close: the ✕ button in the drawer header calls the `onClose` prop passed from `ScenarioPlanner`. The toolbar `Backlog` button also closes it. `Escape` key closes it only when no drag is active.
5. The drawer does **not** close when the user clicks on the canvas behind it. `pointer-events: none` must not be applied to the canvas — clicking the canvas while the drawer is open is a normal drag operation.
6. The drop zone for unscheduling (drag-bar-onto-backlog) continues to function. The `useDroppable({ id: 'backlog' })` node ref is still on the drawer root element.
7. The header shows: "Unscheduled" title + `(N)` epic count badge + ✕ close button (right-aligned).
8. Sub-title line: "N items · drag to schedule".

---

### US-UI-09 · Backlog drawer drop-to-unschedule state

**File:** `frontend/src/components/planner/PlannerBacklog.tsx`

**Acceptance criteria:**

1. When a timeline bar is dragged over the open backlog drawer, the entire drawer background shifts to a subtle red tint (`bg-red-50`) and a centred label "Drop to unschedule" replaces the item list overlay (the list content remains below).
2. On drop, the item is removed from `plannerItems` and the backlog list re-renders with the item back in its correct tree position.
3. A brief flash animation (200ms `bg-mileway-blue-10` pulse) plays on the re-inserted card.

---

## Phase 3 — Team Members Drawer

**Goal:** Create `PlannerTeamDrawer.tsx`, a new component that replaces `PlannerPeopleDrawer` and implements the full spec for the right-side team drawer: search, IT/BIZ sections, hybrid drag-handle model, and Board/Timeline mode awareness.

---

### US-UI-10 · PlannerTeamDrawer scaffold

**File:** `frontend/src/components/planner/PlannerTeamDrawer.tsx` (new)

**Acceptance criteria:**

1. New component with props:
   ```typescript
   interface PlannerTeamDrawerProps {
     selectedQuarter: string;
     activeMode: 'board' | 'timeline';
     onClose: () => void;
   }
   ```
2. Drawer geometry:
   ```
   position: absolute
   top: 0, right: 0, bottom: 0
   width: 300px
   z-index: 30
   box-shadow: -4px 0 20px rgba(0,0,0,0.08)
   ```
3. Open animation: `translateX(100%)` → `translateX(0)`, 200ms same easing as backlog drawer.
4. Header: "Team" title + member/contact total count + ✕ close button.
5. Sub-title: "N members · drag to assign".
6. Search input (full width, magnifier icon left).
7. IT TEAM section (expanded by default): all active `TeamMember` records, sorted by available days descending.
8. BIZ CONTACTS section (collapsed by default): all non-archived `BusinessContact` records. Section header is clickable to expand/collapse. Collapse state is session-only (`useState`).
9. Close triggers: ✕ button, `T` key, `Escape` (only when no drag active). Does **not** close on canvas click.

---

### US-UI-11 · Team drawer member cards with drag handle

**File:** `frontend/src/components/planner/PlannerTeamDrawer.tsx`

**Acceptance criteria:**

1. Each card has a permanent left-edge `⠿` grip column (16px wide). Visibility per mode:
   - **Board mode:** `opacity: 1` always — the full card body area is also a drag source (`useDraggable` on the card root).
   - **Timeline mode:** `opacity: 0` at rest, `opacity: 1` on card hover (120ms transition). Only the grip column triggers `useDraggable`; the card body is not a drag source.
2. Card body cursor: `grab` in Board mode, `default` in Timeline mode (body area only).
3. Card content per spec §5 Member cards: avatar (initials, colour-coded), name, role/title truncated, IT/BIZ badge, mini capacity bar (3px, colour-tiered), available days label. Red "OVERLOADED" badge if any sprint exceeds 100%.
4. Timeline drag: dropping the grip onto a gantt bar fires the existing `people-drag` event and opens `AssignPopover` with the person pre-selected (SP-10 path — no change to `PlannerTimeline.tsx` needed).
5. Board drag: dropping any card onto an epic card fires the existing `member-card` drop path and shows the `DaysPopover`.
6. `PlannerPeopleDrawer.tsx` is **deleted** once this component is wired in.

---

### US-UI-12 · Member focus state (Timeline mode only)

**File:** `frontend/src/components/planner/PlannerTeamDrawer.tsx`, `frontend/src/components/planner/PlannerTimeline.tsx`

**Acceptance criteria:**

1. In Timeline mode, clicking the card body (not the grip) emits an `onMemberFocus(memberId)` callback prop.
2. `ScenarioPlanner.tsx` holds `focusedMemberId: string | null` and passes it down to both `PlannerCapacity` and `PlannerTimeline`.
3. `PlannerCapacity`: when `focusedMemberId` is set, that person's row scrolls into view and receives a 2px left accent border + `bg-mileway-blue-10` background for 2 seconds.
4. `PlannerTimeline`: all bars where `item.assignees.some(a => a.memberId === focusedMemberId)` receive a 400ms CSS pulse animation (`keyframes: 0% opacity 1; 50% opacity 0.4; 100% opacity 1`), applied via a CSS class.
5. Clicking another card body replaces the focused member. Clicking the same card body again clears focus.

---

## Phase 4 — Board Mode Canvas

**Goal:** Remove the permanent right panel from `PlannerBoard`, make the epic cards grid full-width, add `BoardToolbar.tsx`, wire in the new Team drawer, add the Details button on cards and "View epic →" in the Smart Assignment Panel, and document coexistence with the detail panel.

---

### US-UI-13 · Remove permanent right panel from Board

**File:** `frontend/src/components/planner/PlannerBoard.tsx`

**Acceptance criteria:**

1. The 296px right panel (`MemberCard` / `BizContactCard` list) is removed from `PlannerBoard`'s render output.
2. Team member access moves entirely to `PlannerTeamDrawer` (Phase 3). `PlannerBoard` no longer imports `MemberCard` or `BizContactCard`.
3. The epic cards grid becomes `flex-1 w-full` — no max width constraint.
4. The `DaysPopover` continues to work: `PlannerBoard` still handles `handleDragEnd` and `pendingDrop`. The drag source is now `PlannerTeamDrawer` but the drop target (`epic-drop-${jiraKey}`) and popover logic are unchanged.
5. Fit-score precomputation on drag-start (`setFitScores`) is moved to `PlannerBoard` via a callback from `ScenarioPlanner` that fires when a member drag starts from the Team drawer. Alternatively, the `DndContext` wrapping Board mode is lifted to include the Team drawer so fit scores can still be computed in `handleDragStart`.

---

### US-UI-14 · BoardToolbar component

**File:** `frontend/src/components/planner/BoardToolbar.tsx` (new)

**Acceptance criteria:**

1. New component rendered as a secondary toolbar strip (36px, `bg-white`, `border-b border-mileway-border`) between the main topbar and the epic cards grid, visible only in Board mode.
2. Controls:
   - **Quarter selector:** `Quarter: [Q1 2026 ▾]` — uses existing `QuarterSelector` extracted from `PlannerBoard`. Changing it updates `selectedQuarter` via callback prop.
   - **Group by:** `[Epic ▾]` — v1: Epic only. Dropdown present but only one option active.
   - **Sort:** `[Priority ▾]` — options: Priority (default), Name, % assigned. Sort logic applied to `quarterEpics` in `PlannerBoard`.
3. `QuarterSelector` is removed from `PlannerBoard`'s toolbar div and moved into `BoardToolbar`.
4. The strip's `selectedQuarter` and `onQuarterChange` are props from `ScenarioPlanner` (already lives there post US-UI-01).

---

### US-UI-15 · Details button on epic cards and "View epic →" in Smart Assignment Panel

**File:** `frontend/src/components/planner/PlannerBoard.tsx`

**Acceptance criteria:**

1. `EpicCard` renders a `→` icon button on the card top row (right of the priority badge), visible only on hover (`opacity-0 group-hover:opacity-100`).
2. Clicking the `→` button calls `onOpenDetail(epic.jiraKey)` prop — does **not** select the card, does not open Smart Assignment Panel.
3. Clicking the card body (anywhere except the `→` button) remains the primary select action (existing behaviour).
4. The Smart Assignment Panel header renders a `View epic →` text link (muted, 12px) between the epic name and the ✕ close button. Clicking it also calls `onOpenDetail`.
5. `onOpenDetail` sets `plannerUI.detailItemId = epic.jiraKey` in `ScenarioPlanner`. Smart Assignment Panel remains open — both panels coexist (detail panel right edge, Smart Assignment Panel bottom — different axes, no geometric conflict).

---

## Phase 5 — Timeline Canvas Updates

**Goal:** Apply the remaining spec-required changes to `PlannerTimeline` and `PlannerCapacity`: label column width to 260px, today line, current sprint badge, row hover highlight, bar colour corrections, and capacity panel label-width sync.

---

### US-UI-16 · Timeline label column and sprint header updates

**File:** `frontend/src/components/planner/PlannerTimeline.tsx`

**Acceptance criteria:**

1. `LABEL_W_DEFAULT` changes from `220` to `260`. `LABEL_W_MIN` stays at `160`.
2. Sprint header height increases from the current ~33px to **64px** (spec §6). Each header cell now shows two lines: sprint label (e.g. `S3`, bold, 12.5px) on top and date range (e.g. `Feb 2–13`, 10px, monospace) below.
3. The sprint column whose sprint is the current active sprint gets:
   - A "Current" chip (9px uppercase, accent blue) in the top-left of the header cell.
   - A `rgba(37, 88, 201, 0.035)` background fill extending the full column height into the gantt body (applied via a per-column background class on the `SprintColumnZone`).
4. "Expand all" and "Collapse all" buttons move into the header label area (left side, 260px column) instead of the separate sub-toolbar. The sub-toolbar div is removed.

---

### US-UI-17 · Today line

**File:** `frontend/src/components/planner/PlannerTimeline.tsx`

**Acceptance criteria:**

1. A 2px solid `#E63946` vertical line spans the full gantt body height, positioned at the percentage corresponding to today's date within the current sprint.
2. Position calculation: `(today - sprintStart) / (sprintEnd - sprintStart)` gives the fraction within the sprint; the sprint's left offset is `sprintIndex / SPRINT_COUNT`; the final percentage is `(sprintIndex + fraction) / SPRINT_COUNT * 100`.
3. A small "TODAY" chip (`9px uppercase, bg-#E63946, text-white, 4px radius`) anchors to the top of the line.
4. The today line is only rendered when the current date falls within the visible quarter's date range. If today is outside the quarter, no line appears.
5. The line is `pointer-events: none` and `z-index: 15` (above row dividers at z-5, below bars at z-10 — actually above bars, spec intent is it is visible over bars: use z-20 and pointer-events: none).

---

### US-UI-18 · Row hover highlight and bar colour corrections

**File:** `frontend/src/components/planner/PlannerTimeline.tsx`

**Acceptance criteria:**

1. On hover of any gantt row: background shifts to `rgba(37, 88, 201, 0.025)`. The hover state covers the full row width (label column + gantt cells). Implement via a `group` wrapper on each row that spans both the label cell and the gantt row area.
2. Bar colours updated to match spec §6 table exactly:

| Type | bg | border |
|---|---|---|
| epic | `rgba(168,196,245,0.18)` | `2px solid #6090E0` |
| feature | `#A8C4F5` | `1px solid #6090E0` |
| story | `#D0CCC8` | `1px solid #A09D97` |
| uat | `#CDB0F5` | `1px solid #9B6EE2` |
| hypercare | `#90D9B8` | `1px solid #1A7A52` |

3. Current `BAR` constant values (`rgba(0,137,221,0.10)`, `#CCE4F9`, `#F0F2F5`, etc.) are replaced with the spec values above.
4. Border radii: epic 6px, feature 5px, story/uat/hypercare 4px — already correct, confirm no change needed.

---

### US-UI-19 · Capacity panel label-column sync (D25)

**File:** `frontend/src/components/planner/PlannerCapacity.tsx`

**Acceptance criteria:**

1. `LABEL_W` in `PlannerCapacity` is updated from `220` to `260` to match the new gantt label column width.
2. `ScenarioPlanner` passes `labelWidth` as a prop to both `PlannerTimeline` and `PlannerCapacity` so that if the label column is later made resizable, both stay in sync. For now the value is the constant `260`.
3. The capacity panel header row (`"Capacity"` label cell) renders at `260px` fixed width, visually aligning with the sprint header label column above.

---

## Phase 6 — Drawer Coexistence Rules

**Goal:** Implement the soft-responsive viewport rules: both drawers open at ≥ 1440px; one-at-a-time below 1440px; detail panel behavior split by mode.

---

### US-UI-20 · Soft-responsive drawer coexistence

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**Acceptance criteria:**

1. A custom hook `useViewportWidth()` (or inline `useEffect` + `ResizeObserver`) tracks the canvas container width (not `window.innerWidth`, since the nav sidebar takes 220px).
2. When the user opens a second side drawer at container width < 1440px, the currently open one closes first with a 150ms CSS slide-out animation before the new one opens. Implementation: in the `setBacklogOpen(true)` handler, if `teamDrawerOpen` is true and container width < 1440, call `setTeamDrawerOpen(false)` first; vice versa.
3. The toolbar button for the auto-closed drawer returns to its inactive state (reflecting `false` in `plannerUI`).
4. No toast or warning is shown for an auto-close.
5. Manual close of one drawer never affects the other's state.
6. Update the `ViewportNotice` threshold from `max-[1199px]` to `max-[1279px]` (spec minimum is 1280px, current code is 1200px).

---

### US-UI-21 · Detail panel mode-specific coexistence

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**Acceptance criteria:**

1. **Timeline mode:** when `detailItemId` is set, no side drawer is auto-closed regardless of viewport width. The detail panel renders at a higher z-index (z-50) and overlays any open drawer.
2. **Board mode at < 1440px:** when `detailItemId` is set and a side drawer is open, the drawer auto-closes (150ms animation) and then the detail panel slides in.
3. **Board mode at ≥ 1440px:** no auto-close. Detail panel and side drawer coexist.
4. Smart Assignment Panel (Board mode, bottom-docked) and the detail panel (right-edge slide-in) may both be open simultaneously. No forced close between them.

---

## Phase 7 — Slide-Out Detail Panel

**Goal:** Implement the right-edge slide-in `PlannerDetailPanel` component for Timeline bars/labels and Board epic cards (secondary action only).

---

### US-UI-22 · PlannerDetailPanel component

**File:** `frontend/src/components/planner/PlannerDetailPanel.tsx` (new)

**As a** Project Manager,  
**I want** to view the full detail of a work item or epic by clicking a secondary action,  
**so that** I can inspect status, assignees, sprint range, and child features without leaving the planner.

**Acceptance criteria:**

1. Triggered by:
   - **Timeline:** clicking a bar or label row (existing `onBarClick` or a new `onLabelClick` callback in `PlannerTimeline`)
   - **Board:** clicking the `→` Details button on a card, or "View epic →" in the Smart Assignment Panel header
   - These set `plannerUI.detailItemId` in `ScenarioPlanner`
2. Panel geometry:
   ```
   position: absolute
   top: 0, right: 0, bottom: 0
   width: 400px
   z-index: 50
   backdrop: rgba(0,0,0,0.12) overlay behind panel with backdrop-filter: blur(2px)
   ```
3. Slide-in animation: `translateX(100%)` → `translateX(0)`, 220ms `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.
4. Close: ✕ button, click backdrop, `Escape`. Sets `detailItemId` to `null`.
5. Panel sections per spec §10:
   - **Header:** type pill + Jira key + item name (16px bold) + ✕ close button
   - **Assignees:** two-column grid, IT (blue tint) | BIZ (purple tint). Per-track: section label, avatar + name + role rows. "Unassigned" text if empty.
   - **Details:** 2-column meta grid — status badge, sprint range, date range (full width), duration, Jira ID, lock status with "Unlock in this scenario" link if locked.
   - **Features list (Epics only):** collapsible list of child Features — type pill + name + status badge. Clicking a feature row navigates to that feature's detail with a Back button.
6. Data is resolved from the intersection of `plannerItems` (for `PlannerItem` fields) and `jiraItems` (for Jira metadata). Pass both arrays as props.
7. Coexistence: in Board mode the Smart Assignment Panel remains open while this panel is visible. In Timeline mode any open side drawer remains open (it renders underneath at z-30).

---

## Non-functional requirements

| Requirement | Spec reference | Implementation note |
|---|---|---|
| No layout reflow on drawer open | D20 | Drawers are `position: absolute` — canvas width does not change |
| Keyboard shortcuts `B` and `T` | §4, §5 | Check `document.activeElement` is not input/textarea before firing |
| Drawer does not close on canvas click | §4 Close behaviour | No `onClick` backdrop handler on the canvas — drawer only closes on explicit triggers |
| `overflow: visible` on gantt rows | Existing rule (frontend review) | Confirmed in PlannerTimeline — no row must have `overflow: hidden` |
| Capacity panel label width sync | D25 | Both use same constant passed as prop from `ScenarioPlanner` |
| Old `PlannerPeopleDrawer.tsx` deleted | §12 | Delete after `PlannerTeamDrawer` is wired and tested |

---

## File impact summary

| File | Action | Stories |
|---|---|---|
| `frontend/src/pages/ScenarioPlanner.tsx` | Modify | UI-01 through UI-07, UI-20, UI-21 |
| `frontend/src/components/planner/PlannerBacklog.tsx` | Modify | UI-08, UI-09 |
| `frontend/src/components/planner/PlannerTeamDrawer.tsx` | **New** | UI-10, UI-11, UI-12 |
| `frontend/src/components/planner/PlannerBoard.tsx` | Modify | UI-13, UI-14 (via BoardToolbar), UI-15 |
| `frontend/src/components/planner/BoardToolbar.tsx` | **New** | UI-14 |
| `frontend/src/components/planner/PlannerTimeline.tsx` | Modify | UI-16, UI-17, UI-18 |
| `frontend/src/components/planner/PlannerCapacity.tsx` | Modify | UI-19 |
| `frontend/src/components/planner/PlannerDetailPanel.tsx` | **New** | UI-22 |
| `frontend/src/components/planner/PlannerPeopleDrawer.tsx` | **Delete** | UI-11 |
| `frontend/src/index.css` | Modify | UI-08, UI-10 (slide animations), UI-17 (today line), UI-18 (row hover) |
