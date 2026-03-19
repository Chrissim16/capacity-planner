# Scenario Planner — Timeline Mode: Functional Specification

**Date:** 2026-03-19  
**Status:** Approved  
**Source:** Derived from `scenario-planner-final-design.md`, `scenario-planner-design-review.md`, `timeline-view.md`  
**Component:** `frontend/src/components/planner/PlannerTimeline.tsx`

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Layout](#2-layout)
3. [Sprint Headers](#3-sprint-headers)
4. [Row Hierarchy & Expand/Collapse](#4-row-hierarchy--expandcollapse)
5. [Bar Rendering](#5-bar-rendering)
6. [Locked vs Unlocked Items](#6-locked-vs-unlocked-items)
7. [Drag to Reposition](#7-drag-to-reposition)
8. [Resize to Change Duration](#8-resize-to-change-duration)
9. [Moving Epics with Children](#9-moving-epics-with-children)
10. [Drag from Backlog Sidebar](#10-drag-from-backlog-sidebar)
11. [Unschedule Gesture (Drag Back to Backlog)](#11-unschedule-gesture-drag-back-to-backlog)
12. [Drop Zone Behaviour](#12-drop-zone-behaviour)
13. [Assign Popover](#13-assign-popover)
14. [Capacity Panel](#14-capacity-panel)
15. [Toolbar](#15-toolbar)
16. [Data Model](#16-data-model)
17. [Interactions Summary](#17-interactions-summary)
18. [Known Bugs](#18-known-bugs)
19. [Out of Scope (v1)](#19-out-of-scope-v1)

---

## 1. Purpose

Timeline mode is one of the two modes in the Scenario Planner (the other being Board mode). It answers:

- **"What if we shift this work to different sprints?"** — drag bars horizontally on a time axis
- **"Where does new work fit without overloading the team?"** — capacity heatmap updates live as bars are moved
- **"What if committed work slips?"** — locked items can be unlocked per scenario and repositioned

Timeline mode is the precision tool. Board mode is for rough staffing; Timeline mode is for fine-tuning sprint placement and spotting crunch points.

---

## 2. Layout

```
┌─ Backlog Sidebar (268px, collapsible) ──┐  ┌─ Canvas (flex: 1) ─────────────────────┐
│ Unscheduled (N)                         │  │ Toolbar: [Board|Timeline] [Capacity] …  │
│ [Search/filter]                         │  │                                         │
│ [Draggable item card]                   │  │ Sprint headers (64px row)               │
│ [Draggable item card]                   │  │ ─────────────────────────────────────── │
│ [Draggable item card]                   │  │ Gantt rows (label col + bar area)       │
│ ← drop here to unschedule →            │  │                                         │
│                                         │  │ ─── Capacity Panel (toggleable, max     │
└─────────────────────────────────────────┘  │      260px, internal scroll) ─────────  │
                                             │ Team total: 72% 68% 91% …              │
                                             │ Erik V. IT: 80% 65% 110% …            │
                                             └─────────────────────────────────────────┘
```

### Sizing rules

| Element | Width / Height | Notes |
|---|---|---|
| Backlog sidebar | 268px default | Collapsible to a thin "N unscheduled" pill strip |
| Backlog drag handle | Right edge of sidebar | Resizable, mirrors label column pattern |
| Canvas | `flex: 1` | Always takes remaining space; never shrinks below usable minimum |
| Label column (gantt) | 300px default | Resizable drag handle on right edge; min 200px, max 600px |
| Sprint header row | 64px | Sprint name + date range |
| Capacity panel | Max-height 260px | Docked at bottom; internal scroll; never pushes gantt off-screen |
| Minimum viewport | 1200px | Below this, show an informational "best viewed on a wider display" notice |

---

## 3. Sprint Headers

Each sprint column header is **64px tall** and contains two lines:

1. **Sprint label** — e.g. `S7` or `Sprint 7` — bold, 12.5px
2. **Date range** — e.g. `Mar 30 – Apr 10` — monospace, 10px, muted colour

Sprint column count: **6 per quarter** (v1 is sprint granularity only — weekly is deferred).

### Current sprint highlight

The current sprint column receives a subtle blue tint background: `rgba(0, 137, 221, 0.04)`.

### Today line

A 2px solid `#E63946` vertical line drawn across all rows at the exact position of today.  
Label: `TODAY` in `text-[9px] font-bold text-red-500 uppercase tracking-wider` at the top.  
Position: `(now - viewStart) / (viewEnd - viewStart)` as a percentage of the visible window.

### Grid lines

- Sprint boundaries: dashed, `border-slate-100`

---

## 4. Row Hierarchy & Expand/Collapse

### Hierarchy levels

| Level | Type | Height | Indent |
|---|---|---|---|
| 0 | Epic | 44px | 0 |
| 1 | Feature | 36px | 32px |
| 2 | Story / Task / Bug | 36px | 48px |

### Default state

Epics only (all features and children collapsed). This is the default view when the timeline is opened.

### Expand behaviour

- Click the chevron on an **Epic row** → reveals its Feature rows
- Click the chevron on a **Feature row** → reveals its Story/Task/Bug rows
- State tracked in `expandedIds: Set<string>` keyed on `jiraKey`

### Toolbar controls

- **Expand All** button: sets all Epic and Feature keys in `expandedIds`
- **Collapse All** button: clears `expandedIds` entirely

### Row derivation

A flat `rows` array is derived from `expandedIds`. The label column and the gantt bar area both render from this same array in sync.

---

## 5. Bar Rendering

All bars are positioned absolutely within their gantt row using `left` and `width` as percentages of the sprint grid.

### Bar visual styles

| Type | Fill | Border | Height | Radius |
|---|---|---|---|---|
| Epic | `rgba(0,137,221,0.10)` | `#0089DD` 2px | 30px | 6px |
| Feature | `#BAE0F7` | `#0089DD` 1px | 22px | 5px |
| Story / Task | `#D0CCC8` | `#A09D97` 1px | 18px | 4px |
| Bug | `#FECACA` | `#EF4444` 1px | 18px | 4px |

> These are the same bar colours as the existing Timeline view (`JiraGantt.tsx`).

### Bar hover

`hover:brightness-90 hover:-translate-y-px`, transition 150ms.

### No text on bars

Bars are plain coloured rectangles. No text labels inside bars.

### Ghost bar (no position yet)

Items that exist in the planner but have no `startSprint` assigned show a dashed empty rectangle (`border-dashed border-slate-200`) as a placeholder row.

### Snap to sprint

Bars always align to sprint boundaries. There is no sub-sprint positioning.

### Position formula

```
column width = 1 / 6  (equal columns for 6 sprints)

left  = (startSprint - 1) / 6
width = spanSprints / 6
```

---

## 6. Locked vs Unlocked Items

### Locked items

Items with `statusCategory: 'in_progress'` or manually marked as committed are `locked: true` by default.

- Display a **🔒 badge** in the label column
- **Cannot be dragged or resized** — no resize handles appear, drag has no effect
- Show no drop highlight when other items are dragged over a locked bar's row
- Can be unlocked per-scenario via a context menu action: "Unlock in this scenario"

### Unlocked-in-scenario items

When a PM unlocks a locked item in the current scenario:

- `unlockedInScenario: true` is set on the `PlannerItem`
- Bar renders with a **dashed border** (same colour as locked variant) instead of solid
- Shows an **"UNLOCKED" badge** in the label column (replaces the lock icon)
- Becomes fully draggable and resizable
- Lock status in all other scenarios is unaffected (full snapshot isolation)

---

## 7. Drag to Reposition

| Attribute | Behaviour |
|---|---|
| Drag axis | Horizontal only |
| Snap | Sprint boundaries — the bar snaps to the nearest sprint start |
| Snap indicator | Visual indicator shown at the target sprint boundary during drag |
| Live feedback | Capacity panel updates in real time as the bar moves across sprint columns |
| On drop | Updates `PlannerItem.startSprint`; capacity panel re-calculates |
| Locked items | Not draggable; no interaction |

### Drag feedback

- Dragged element gets a subtle shadow and slight opacity reduction
- A bottom toast displays: "Moving [item name] — drop on a sprint"
- Invalid targets (locked item rows) show no highlight

---

## 8. Resize to Change Duration

| Attribute | Behaviour |
|---|---|
| Trigger | Hover a bar — resize handles appear as small vertical lines at left and right edges |
| Drag direction | Left handle extends/shrinks from start; right handle extends/shrinks from end |
| Minimum span | 1 sprint |
| Snap | Sprint boundaries |
| Live feedback | Capacity panel updates in real time during resize |
| On release | Updates `PlannerItem.spanSprints` (and `startSprint` if left handle moved) |
| Locked items | No resize handles rendered |

---

## 9. Moving Epics with Children

When the PM drags an **Epic bar**, a small confirmation prompt appears:

> "Move children too?"

| Response | Effect |
|---|---|
| **Yes** | All Features and Stories under the Epic shift by the same delta (number of sprints moved) |
| **No** | Only the Epic-level bar repositions; Feature and Story bars remain in their current positions |

---

## 10. Drag from Backlog Sidebar

| Attribute | Behaviour |
|---|---|
| Source | Any item card in the backlog sidebar |
| Target | Any sprint column in the gantt area |
| Drop zone | The **entire sprint column** highlights (full height, not just one row) — a tinted overlay (subtle brand blue wash) tracks the cursor horizontally |
| On drop | A new gantt row appears for the item at the target sprint; the assign popover opens automatically |
| Live feedback | Toast: "Placing [item name] — drop on a sprint" |

---

## 11. Unschedule Gesture (Drag Back to Backlog)

| Attribute | Behaviour |
|---|---|
| Source | Any scheduled (unlocked) bar in the gantt |
| Target | Backlog sidebar drop zone |
| Drop zone label | "Drop to unschedule" label appears when a bar is dragged over the sidebar |
| On drop | Item removed from `plannerLayout`; row disappears from gantt; item returns to backlog sidebar list |

This is the primary way to remove an item from the timeline — faster than a right-click "Remove" action.

---

## 12. Drop Zone Behaviour

### Sprint columns

- Registered as `useDroppable` targets (one per sprint, full height)
- On drag-over: tinted background overlay in the hovered column
- On drag-leave: overlay removed immediately

### Backlog sidebar

- Single full-area drop zone
- On drag-over from a gantt bar: "Drop to unschedule" label appears
- On drop: calls `removePlannerItem()` + returns item to backlog

### Invalid targets

- Locked item rows are not drop targets and show no highlight

### Library

`@dnd-kit/core` + `@dnd-kit/utilities`. The `DndContext` wraps the full timeline page shell.

---

## 13. Assign Popover

### Trigger

Clicking any bar (Epic, Feature, or Story) opens the assign popover for that item.  
It also opens **automatically** when a backlog item is dropped onto a sprint column.

### Assignment hierarchy

| Level | Coverage |
|---|---|
| Epic | Effort spread across all sprints the epic spans |
| Feature | Effort within the feature's sprint range (most common) |
| Story / Task / Bug | Sprint-precise; one sprint typically |

### Popover content

For each team member:

| Element | Description |
|---|---|
| Avatar + name | Visual identity |
| Role badge | IT (Light Blue `#0089DD`) or BIZ (Cool Grey `#6C7A89`) |
| Fit badge | `good` / `partial` / `over` — computed by `scoreMember()` from `utils/staffing.ts` |
| Effort slider | Per-person `daysPerSprint` value (1–10), flat across all sprints the item covers |
| Skill match chips | Matched skills as green chips; missing skills shown as gaps |

Members are sorted: good → partial → over (via `rankMemberFits()`).

### Graceful degradation

If `utils/staffing.ts` (US-061) is not yet available:
- Members sorted by available days only
- No fit badges or skill match chips
- Popover is fully functional; skill matching lights up automatically when US-061 ships

### Popover positioning

- Rendered via portal to `document.body` — never clipped by gantt container overflow
- Uses `@floating-ui/react` to auto-position (flip up/down/left/right) based on available viewport space
- Closes on scroll or click-outside

---

## 14. Capacity Panel

### Visibility

Docked at the bottom of the canvas. Toggled via a toolbar button. Visible by default.

### Structure

A grid that **exactly mirrors the sprint columns** above it:

```
[220px label column] | [sprint 1] | [sprint 2] | [sprint 3] | [sprint 4] | [sprint 5] | [sprint 6]
```

Cell edges align vertically with gantt sprint column boundaries.

### Team summary row

Always visible when the panel is open.

| Element | Detail |
|---|---|
| Label | "Team total" — bold |
| Per-sprint cell | Overall team allocation % + `load / avail` days |
| Cell background | Follows allocation tier colour (see below) |

### Individual person rows

One row per active `TeamMember` (IT track) and non-archived `BusinessContact` (BIZ track).

| Element | Detail |
|---|---|
| Label | Avatar + name + role badge |
| IT role badge | Light Blue `#0089DD` with `E6F2FC` tint background |
| BIZ role badge | Cool Grey `#6C7A89` with `EEEEF1` tint background |
| Overloaded badge | "OVERLOADED" badge shown when any sprint for this person exceeds 100% |
| Overloaded row | Subtle red left border |

This section is expandable/collapsible (expanded by default).

### Per-sprint cell content

| Element | Detail |
|---|---|
| Allocation % | Bold, coloured by tier |
| `load / avail` days | Small muted text below the percentage |
| `avail` computation | Workdays in sprint minus public holidays, time-off, and BAU — via `calculateCapacity()` |
| Mini progress bar | 3px bar; fills to 100% in tier colour; red overflow segment beyond 100% |
| Progress bar animation | `transition: width 300ms ease` — animates during live drag feedback |

### Live updates

The capacity panel recalculates and re-renders **immediately** whenever:
- A bar is dragged (repositioned)
- A bar is resized
- An effort slider in the assign popover is adjusted

This real-time feedback loop is the core value of the Timeline mode.

### Constraints

- Max-height 260px with internal scroll
- The gantt area above is never pushed off-screen by the panel

### Allocation colour tiers

| Range | Cell background | Text colour |
|---|---|---|
| 0% | `#EEEEF1` | `#6C7A89` |
| 1–50% | `#E6F2FC` | `#0089DD` |
| 51–80% | `#FEF9C3` | `#CA8A04` |
| 81–100% | `#FFEDD5` | `#EA580C` |
| >100% | `#FEE2E2` | `#DC2626` |

---

## 15. Toolbar

Shared toolbar at the top of the canvas, visible in both Board and Timeline modes.

| Control | Description |
|---|---|
| Mode toggle | `[Board \| Timeline]` segmented control — switches modes while preserving all state |
| Capacity toggle | Shows/hides the capacity panel |
| Expand All / Collapse All | Expands or collapses all rows in the gantt |
| Save scenario | Persists the current `plannerLayout` and all assignment data to the scenario snapshot |
| Scenario tabs | Pill-style tabs (max 5) — switching tabs changes the active scenario |
| Create scenario button | Opens the scenario creation modal (clone / blank canvas) |

---

## 16. Data Model

### PlannerItem

Represents one item placed on the timeline.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique planner item ID |
| `sourceId` | `string` | References `JiraWorkItem.id` |
| `name` | `string` | Display name |
| `type` | `enum` | `epic / feature / story / task / bug / uat / hypercare` |
| `jiraKey` | `string?` | Jira key if sourced from Jira |
| `parentKey` | `string?` | Parent's `jiraKey` — preserves hierarchy for expand/collapse |
| `startSprint` | `number` | 1–24 sprint number |
| `spanSprints` | `number` | Duration in sprints (minimum 1) |
| `assignees` | `PlannerAssignment[]` | People assigned to this item |
| `locked` | `boolean` | Committed work — immovable by default |
| `unlockedInScenario` | `boolean` | PM explicitly unlocked for exploration in this scenario |

### PlannerAssignment

One person's effort on one item.

| Field | Type | Description |
|---|---|---|
| `memberId` | `string` | `TeamMember.id` or `BusinessContact.id` |
| `track` | `'IT' \| 'BIZ'` | Which track |
| `daysPerSprint` | `number` | Flat effort value across all sprints the item covers (1–10) |

### Capacity computation

The timeline does **not** implement its own capacity engine. It feeds `PlannerAssignment` data into the existing `calculateCapacity()` and `scoreMember()` utilities. Available days already account for holidays, time-off, and BAU.

### Backlog source

All `JiraWorkItem` records with `statusCategory !== 'done'` that do **not** have a corresponding `PlannerItem` in the current scenario. The backlog is a **derived view** — filtered, not copied. Supports search and filtering by Epic, label, and status category.

### Persistence

"Save scenario" flows through the existing `scheduleSyncToSupabase()` mechanism. The `plannerLayout` field is persisted inside the existing `scenarios` JSONB column — no new database tables or migrations required.

---

## 17. Interactions Summary

| Action | Result |
|---|---|
| Click expand chevron on Epic | Reveals Feature rows beneath |
| Click expand chevron on Feature | Reveals Story/Task/Bug rows beneath |
| Click "Expand All" | All Epic and Feature keys added to `expandedIds` |
| Click "Collapse All" | `expandedIds` cleared; all rows collapse |
| Click any bar | Opens the assign popover |
| Drag an unlocked bar horizontally | Repositions bar; capacity panel updates live |
| Release bar on a sprint column | Updates `startSprint`; layout saves to planner state |
| Hover bar edges | Resize handles appear |
| Drag resize handle | Extends or shrinks `spanSprints`; capacity panel updates live |
| Drag Epic bar | Prompts "Move children too?" |
| Drag backlog item onto sprint column | Creates new row; assign popover opens automatically |
| Drag bar onto backlog sidebar | Removes item from timeline; item returns to backlog |
| Click "Unlock in this scenario" | Sets `unlockedInScenario: true`; bar becomes draggable |
| Toggle Capacity button | Shows/hides capacity panel |
| Click Save | Persists `plannerLayout` and assignments to scenario snapshot |

---

## 18. Known Bugs

The following bugs are tracked in `.cursor/bugs/scenario-planner-bugs.md` and affect the timeline mode:

| ID | Title | Description |
|---|---|---|
| BUG-005 | Drag from backlog does not work | Dropping a backlog item onto a sprint column has no effect; no bar is created. Sprint columns need `useDroppable` registration and `onDragEnd` wired to `addPlannerItem()`. |
| BUG-006 | No team members in Timeline view | The capacity panel shows no team member rows. `TeamMember` and `BusinessContact` records are not being passed into `PlannerCapacity` from the active scenario snapshot. |
| BUG-007 | "Expand All" does not expand rows | `expandAll` action does not set all keys in `expandedIds`, or row visibility is not derived from that set. |
| BUG-008 | "Collapse All" does not collapse rows | Same root cause as BUG-007 — `collapseAll` does not clear `expandedIds`. |
| BUG-009 | Sprint headers show name only, no date range | Date range second line is not rendered. Needs `getSprintDateRange(sprintNumber)` helper wired into the header cell. |
| BUG-010 | Capacity panel shows placeholder text | `PlannerCapacity` renders a stub message instead of real data. `calculateCapacity()` needs to be wired per member per sprint and the allocation grid rendered per spec §14. |

---

## 19. Out of Scope (v1)

| Item | Notes |
|---|---|
| Weekly column granularity | Sprint columns (6 per quarter) only. Weekly view deferred to v2. |
| Per-sprint effort variance | `daysPerSprint` is flat across all sprints an item covers. Varying effort per sprint is deferred. |
| Cross-quarter drag | Dragging a bar from one quarter into the next requires multi-quarter view. Tracked as TODO-001. |
| Time-off highlighting on capacity rows | Available days already account for time-off in the number; visual row highlighting is polish for v2. |
| Undo/redo stack | PM can drag things back manually in v1. |
| Today line navigation | Clicking the today line does nothing in v1. |
| Avatar stacks on bars | Bars are plain coloured rectangles; assignees are only visible in the assign popover or capacity panel. |
| Continuation arrows | Bars that extend beyond the sprint grid boundary are clipped; no left/right triangle indicators in the planner (unlike the read-only Timeline view). |
| Mobile / touch support | Wide-screen planning tool; touch drag is unreliable for sprint placement. |
