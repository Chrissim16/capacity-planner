# Scenario Planner — Redesign Specification
**Date:** 2026-03-19
**Status:** In Progress
**Author:** Dennis Simon / AI-assisted design session
**Supersedes:** scenario-planner-final-design.md (partial — this document extends and overrides specific sections)

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [Navigation & Home Screen](#2-navigation--home-screen)
3. [Scenario Lifecycle](#3-scenario-lifecycle)
4. [Canvas — General](#4-canvas--general)
5. [Backlog Drawer](#5-backlog-drawer)
6. [Board Mode](#6-board-mode)
7. [Timeline Mode](#7-timeline-mode)
8. [Capacity Ticker](#8-capacity-ticker)
9. [Out of Scope & Deferred](#9-out-of-scope--deferred)

---

## 1. Core Philosophy

### Scenarios are a self-contained sandbox

The Scenario Planner is a standalone planning workspace. It is completely isolated from all other modules in the application. Nothing the PM does inside the Scenario Planner affects or writes back to Jira data, the Epic view, the Team view, or any other module.

**Data flows one way:** Jira data (via the import/baseline) flows into scenarios. Nothing flows out — yet. Future Jira sync (writing planned dates back to Jira) is a separate future feature and must be designed into the data model from the start, even though it will not be built now.

**Why this matters:** The other modules in the app show actuals — what is really happening in Jira. The Scenario Planner shows forecast — what we are planning. These are fundamentally different things and must live in separate spaces.

### Baseline definition

The **baseline** is the current state of all Jira work items as imported into the app. It represents actuals. When a PM creates a scenario and chooses to copy from baseline, they are copying this Jira snapshot into a planning sandbox where they can manipulate it freely without affecting the actuals.

### No context bleed

There are no persistent banners, mode indicators, or notifications elsewhere in the app indicating that the user is working in a scenario. The Scenario Planner is a place you go to — not a mode you are in.

---

## 2. Navigation & Home Screen

### Sidebar entry

The sidebar shows **"Scenario Planner"** as a single navigation entry pointing to `/planner`. The old `/scenarios` route redirects to `/planner`.

### Home screen — default view

When the PM navigates to `/planner`, they land on the **home screen** — a list of all created scenarios. This is the default view, not the canvas.

**List view (only view — no card toggle):**

Each row in the list shows:
- Scenario name
- Created date
- Last modified date
- Item count (e.g. "94 features · 18 epics")
- Status badge: Active / Archived
- Actions: Open · Archive · Delete

**Empty state:** When no scenarios exist, show a clear empty state with a single prominent "Create Scenario" button and a one-line explanation of what the Scenario Planner is for.

### Creating a scenario

The **"Create Scenario"** button appears in two places only:
1. On the home screen (primary entry point)
2. On the canvas toolbar (for creating a new scenario while already planning)

Clicking "Create Scenario" opens a modal with:

| Field | Control | Notes |
|---|---|---|
| Scenario name | Text input, required | — |
| Starting point | Two radio options | See below |

**Radio option A — Copy from baseline**
Deep-copies all active Jira work items (statusCategory !== 'done') into the new scenario. Spillover items that already have dates are placed on the timeline automatically. All remaining items go into the backlog drawer.

**Radio option B — Blank canvas**
Creates an empty scenario. All active Jira work items appear in the backlog drawer. Nothing is on the timeline.

**Buttons:** Create (primary) · Cancel (ghost)

On successful creation, the PM is taken directly to the canvas.

### Returning to the home screen

A small back link is always visible on the canvas — a left arrow icon followed by "Back to overview." Clicking it returns the PM to the home screen without losing any unsaved work (auto-save applies).

---

## 3. Scenario Lifecycle

### Maximum 5 active scenarios

The "Create Scenario" button is disabled when 5 active scenarios exist. A tooltip explains the limit. The PM must archive or delete a scenario before creating a new one.

### Archive

Archiving a scenario removes it from the active list but preserves all data. Archived scenarios are accessible via a toggle ("Show archived") at the top of the home screen list. An archived scenario can be restored to active status as long as the active count is below 5.

### Delete

Deleting a scenario permanently removes all data. A confirmation dialog is shown before deletion. Deletion cannot be undone.

### Save behaviour

The canvas auto-saves all changes via the existing `scheduleSyncToSupabase()` mechanism. A subtle "Saving..." / "Saved" indicator appears in the canvas toolbar. A manual "Save" button is also present for explicit saves.

---

## 4. Canvas — General

### Layout

```
[Back to overview ←]  [Scenario name]  [Board | Timeline]  [Save]  [Create Scenario]
────────────────────────────────────────────────────────────────────────────────────
[Backlog Drawer]  |  [Canvas — Board or Timeline mode]
```

### No context banners

No banner, badge, or indicator appears anywhere outside the Scenario Planner indicating that a scenario is active or being edited.

### Home screen health indicators

Each scenario row on the home screen shows a lightweight health summary — useful for deciding which scenario needs attention before entering it:

```
GL Replan Q2     ⚠ 2 overloaded sprints · 8 unscheduled     Last edited 2h ago
```

- Overloaded sprints: count of sprints where team allocation exceeds 100%
- Unscheduled: count of backlog items not yet placed on the timeline
- Warning icon (⚠) appears only when at least one sprint is overloaded
- No summary strip inside the canvas — the ticker handles in-canvas capacity signalling

### Mode toggle

A segmented control in the toolbar switches between **Board** and **Timeline** mode. All state is preserved when switching — assignments made in Board mode are reflected in Timeline mode and vice versa.

### Session restore

The app remembers the last planning session via `localStorage`. On return, it restores:

- Last open scenario
- Last active mode (Board or Timeline)
- Last active quarter
- Backlog drawer state (open or collapsed)

If the stored scenario has been deleted or archived, the app falls back gracefully to the home screen. State is stored per browser — cross-device restore is deferred to a future user preferences feature in the database.

All Jira work item data (names, Jira keys, assignees, estimates, status) is visible inside the scenario canvas for reference. This data is read-only — it informs planning decisions but cannot be edited here.

---

## 5. Backlog Drawer

### Purpose

The backlog drawer holds all work items that have not yet been placed on the timeline. Items arrive here from the Jira baseline. The PM works through the backlog to schedule items onto the timeline.

### Item hierarchy in the drawer

Planning happens at **Epic and Feature level**. Stories collapse under their parent Feature and inherit dates automatically when the Feature is placed. The drawer never shows raw Story rows — only Epics and Features.

### Initial state on load

| Scenario type | Drawer state on load |
|---|---|
| Blank canvas | Open |
| Copy from baseline (spillover items exist) | Collapsed |

### Collapsed state — the pill

When collapsed, the drawer shrinks to a **flush vertical pill on the left edge** of the screen. The pill shows:

```
→  12 epics · 84 features
```

- Left arrow icon (→ points right, indicating it expands)
- Item count split by type
- No other content

### Expand / collapse behaviour

| Trigger | Result |
|---|---|
| PM clicks the pill | Drawer expands |
| PM successfully drops an item onto the timeline | Drawer auto-collapses |
| PM drags a bar from the timeline back to the backlog | Drawer re-expands automatically |
| PM manually collapses the drawer (X or collapse button) | Drawer stays collapsed until clicked |

**The drawer never collapses mid-drag.** It only collapses on a successful drop.

**Consistent state:** There is one collapse state. If the PM manually collapsed the drawer, it stays collapsed. If it auto-collapsed after a drop, it stays collapsed. The PM always controls re-expansion.

### Animation

Collapse and expand: **150ms ease**. The Gantt canvas area smoothly expands to fill the freed space at the same 150ms speed. No janky snapping.

### Triage step — working through a large backlog

With 80–100 features to schedule, drag-and-drop one at a time is impractical. The drawer supports a lightweight triage flow before placing items:

**Step 1 — Triage**
Each item in the drawer has a triage control with three options:
- **This quarter** — I intend to schedule this now
- **Next quarter** — defer, not now
- **Icebox** — not this year

Default state for all items is untagged. The PM works top-down through the priority-ordered list, assigning triage status quickly.

**Step 2 — Bulk schedule**
A "Schedule all: This quarter" button appears once at least one item is tagged as "This quarter." Clicking it places all tagged items sequentially on the timeline based on priority order and available capacity. The PM then fine-tunes placement individually.

**Step 3 — Fine-tune**
Drag-and-drop and timeline manipulation applies to the ~30–40 placed items rather than the full backlog of 100.

### Unschedule gesture

Dragging any timeline bar back onto the backlog drawer returns it to the backlog. The drawer shows a "Drop to unschedule" label when a bar is dragged over it. On drop, the drawer re-expands automatically so the PM can see where the item landed.

---

## 6. Board Mode

### Purpose

Board mode answers the question: **"Given our available capacity this quarter, which of these demand items can we realistically commit to?"**

This is a capacity-first, commitment decision view — not a scheduling view. The PM does not assign specific sprint dates here. That is Timeline mode's job. Board mode is the gate that decides what is in scope for the quarter at all.

### Layout

```
[Left — Demand stack]  |  [Right — Capacity heatmap]
```

### Left panel — Demand stack

All incoming Epics and Features from demand management, sorted by priority (highest first). The PM works top-down.

Each item shows:
- Priority rank
- Name + Jira key
- Required skills/roles
- Estimated days
- Commit toggle (see below)

### Right panel — Capacity heatmap

**This is the same heatmap that already exists in the other modules.** No new capacity engine. No new calculations. The existing `calculateCapacity()` and related utilities power this panel unchanged.

The heatmap shows per-person available days for the selected quarter, after accounting for:
- Spillover work already committed
- BAU allocation
- Holidays and time-off

### The commitment gesture

Each item in the demand stack has a **"Commit"** button. When clicked:
- The item is marked as committed for this quarter
- Its estimated days are subtracted from the relevant people's capacity in the heatmap in real time
- The heatmap updates immediately showing new allocation percentages and colours

The PM works down the demand stack committing items until capacity is full.

### The commitment line

A visual threshold line moves down the demand stack as capacity fills. Items above the line are committed. Items below the line are deferred — there is not enough capacity to take them on this quarter.

The line is calculated automatically based on available capacity vs cumulative estimated days. The PM can manually override it by committing or uncommitting individual items.

### Bottleneck visibility

When a specific person becomes the constraint (their capacity is exhausted before the team's overall capacity is), the heatmap highlights that person's row and the items in the demand stack that require their skills are flagged. This surfaces the "Erik is the bottleneck" problem immediately.

### Quarter selector

A dropdown in the Board mode toolbar selects which quarter is being planned. Defaults to the current quarter.

### Skill matching

Skill and role matching from `scoreMember()` (when available from US-061) surfaces fit badges on team members in the heatmap — showing who can actually do each committed item. Graceful degradation: if `staffing.ts` hasn't shipped, shows available days only with no fit badges.

---

## 7. Timeline Mode

### Purpose

Timeline mode answers the question: **"When exactly does each committed item happen, and which sprints are overloaded?"**

The PM arrives here after Board mode with a committed list of items for the quarter. Timeline mode is where precise sprint placement happens and crunch points are identified.

### Layout

Same two-column Gantt layout as the existing Timeline view:

```
[Backlog Drawer]  |  [Label column 300px]  |  [Gantt area flex-1]
                                           |  [Capacity panel — toggleable, bottom]
```

### Gantt behaviour

All bar types, positioning logic, continuation arrows, hover states, and expand/collapse behaviour follow the existing Timeline view spec (`timeline-view-spec.md`) exactly. The planner has its own Gantt implementation (`PlannerTimeline.tsx`) but follows the same visual and interaction rules.

### Drag to reposition

Unlocked bars can be dragged horizontally to a new sprint position. Bars snap to sprint boundaries. The capacity panel updates in real time during the drag — the PM sees allocation percentages change as the bar moves.

### Resize to change duration

Hover a bar to reveal resize handles at the left and right edges. Drag to extend or shrink. Minimum span: 1 sprint. Capacity panel updates live during resize.

### Moving Epics with children

When an Epic bar is dragged, a small confirmation asks: "Move children too?" Yes moves all Features and Stories by the same delta. No moves only the Epic bar.

### Lock / unlock

Items with `statusCategory: 'in_progress'` or manually marked committed are locked by default. Locked items show a 🔒 badge and cannot be dragged or resized. The PM can unlock any item in a scenario via right-click → "Unlock in this scenario." Unlocked items render with a dashed border and an "UNLOCKED" badge.

### Capacity panel

Docked at the bottom of the canvas. Toggleable via toolbar button. Max-height 260px with internal scroll. Never pushes the gantt off-screen.

Mirrors the sprint columns exactly. Shows:
- Team summary row (always visible when open): overall allocation % + load/avail days per sprint
- Individual person rows: avatar + name + role badge + per-sprint allocation + OVERLOADED badge when any sprint exceeds 100%

Allocation colour tiers follow the existing eight-tier system (green → yellow → red).

### Person filter

The existing **"All Teams" pill** in the toolbar doubles as a person filter. Selecting a person from the dropdown:

- Their assigned bars remain at full opacity
- All other bars dim to 20% opacity
- The ticker switches from team-level allocation to that person's individual allocation only
- The ticker tooltip in filtered mode shows that person's assignments for the hovered sprint, not the full team breakdown
- Colour tiers in the ticker remain the same thresholds but reflect the individual's capacity

Clearing the filter (selecting "All Teams") returns all bars to full opacity and the ticker back to team-level view.

This is the primary tool for investigating overload — when the ticker shows a red sprint, the PM filters to a person to see all their assignments across the timeline and identify the conflict.

Clicking any bar opens the assign popover. Rendered via portal to `document.body` — never clipped by parent containers. Auto-positioned via `@floating-ui/react`.

Right-clicking a bar also opens the assign popover as a faster alternative.

Shows all team members with fit badges (from `scoreMember()`), an effort slider (days per sprint), and skill match indicators. The slider must not trigger a collapse of the popover on release — the PM must be able to adjust the slider and then click Assign without the popover closing.

---

## 8. Capacity Ticker

### Purpose

The capacity ticker is a persistent, always-visible signal row in the Timeline mode canvas. It shows team-level allocation per sprint at a glance — without requiring the PM to open the full capacity panel. It is the first thing a PM sees when something goes into the red.

### Position

Sits between the sprint column headers and the first Gantt row. Aligned perfectly to the sprint columns. Always visible — it cannot be hidden.

### Structure

```
[Label cell 220px] | [S4 cell] | [S5 cell] | [S6 cell] | [S7 cell] | [S8 cell] | [S9 cell]
```

**Label cell:** Chevron icon (▾) + "Team capacity" text. This is the toggle for the full capacity panel — clicking opens or closes it. No separate toolbar button for the capacity panel exists. The ticker label is the only toggle.

**Sprint cells:** Colour-coded background + allocation percentage in monospace font.

### Height

28px. Compact but readable.

### Colour tiers

Identical to the existing allocation tier system:

| Range | Background | Text |
|---|---|---|
| 0–50% | `#F0FDF4` | `#16A34A` green |
| 51–80% | `#FEFCE8` | `#CA8A04` yellow |
| 81–100% | `#FFF7ED` | `#EA580C` orange |
| >100% | `#FEF2F2` | `#DC2626` red, bold |

### Hover behaviour

Hovering any sprint cell shows a tooltip with a per-person breakdown for that sprint:

```
S8 · 114%
────────────
Erik V.     140%
Sophie L.    88%
Jan de W.    72%
```

Tooltip is rendered via portal (`@floating-ui/react`) — never clipped by parent containers.

### Click behaviour

| Target | Action |
|---|---|
| Chevron / label cell | Toggles the full capacity panel open / closed (150ms ease) |
| Any overloaded cell (>100%) | Opens the full capacity panel AND scrolls directly to the first overloaded person's row |
| Any non-overloaded cell | No action — hover tooltip only |

### Live updates during drag

When the PM drags or resizes a bar, ticker percentages update in real time. Number transitions use a **150ms crossfade** — the old number fades out and the new number fades in. No counting animation. Clean and fast.

### Relationship to the full capacity panel

The ticker is the summary layer. The full capacity panel (individual person rows, load/avail days, mini progress bars) is the detail layer. They are always in sync. The ticker chevron is the only way to open and close the detail panel.

---

## 9. Out of Scope & Deferred

### Deferred to v2

| Item | Reason |
|---|---|
| Jira sync (write back) | App not yet stable enough. Data model must support it from day one even though the feature ships later. |
| Weekly column granularity | Sprint columns sufficient for v1 |
| Cross-quarter drag | Requires multi-quarter view and complex repositioning |
| Per-sprint effort variance | Flat daysPerSprint is sufficient for v1 |
| Scenario comparison (side-by-side diff) | Can extend existing ScenarioDiffModal later |
| Month granularity toggle | Validate demand before building a third column mode |

### Not planned

| Item | Reason |
|---|---|
| Mobile / touch support | Wide-screen planning tool |
| AI-generated scenario suggestions | Need usage data first |
| Undo/redo stack | Significant infrastructure. PM can drag back manually in v1. |
| Export / print of planner view | The planner is a working tool, not a reporting surface |
| Dashboard nudge banner | Removed. Scenario Planner is self-contained. No bleed into other modules. |

---

## Decisions Log

| # | Decision | Rationale |
|---|---|---|
| D1 | Scenario Planner is fully self-contained | No context bleed into other modules |
| D2 | Data flows one way: Jira → scenarios | Scenarios are forecast only. Sync back is a future feature. |
| D3 | Build data model with future Jira sync in mind | Avoid a rewrite later |
| D4 | Home screen is the default landing page | Graceful entry into planning, not disorienting canvas-first |
| D5 | List view only on home screen (no card toggle) | Max 5 scenarios — card toggle adds complexity for no gain |
| D6 | No period field on scenario creation form | The timeline already handles quarter navigation; a creation-time period field adds friction without clear benefit |
| D7 | Create scenario available on home screen AND canvas | PM may need a new scenario mid-session |
| D8 | Archive + delete for scenario lifecycle | Prevents hitting the 5-scenario limit with stale data |
| D9 | Backlog drawer auto-collapses on successful drop | PM needs to see what they just placed |
| D10 | Drawer starts open (blank canvas) / collapsed (spillover) | State on load reflects where the PM is in the planning process |
| D11 | Triage step before placing items | 80-100 features makes one-at-a-time drag impractical |
| D12 | Board mode is commitment-first, not scheduling | Answers "can we do this?" before Timeline answers "when?" |
| D13 | Board mode reuses existing capacity heatmap | No new engine needed |
| D14 | Right-click on bar opens assign popover | Faster alternative to click; team drawer may be removed |
| D23 | Skip sticky "you are here" context indicator | The red TODAY line already handles orientation. No additional indicator needed. |
| D24 | Session restore via localStorage | Simple, no backend needed. Falls back to home screen if stored scenario is gone. Cross-device restore deferred. | The ticker already handles in-canvas capacity signalling. Summary numbers belong on the home screen where they inform scenario selection, not inside the canvas. |
| D20 | Health indicators on home screen scenario list | Overloaded sprints + unscheduled count per scenario row — useful before entering, not while inside |
| D21 | Person filter on existing "All Teams" pill | One place, one interaction. Dims non-matching bars to 20%, switches ticker to individual view |
| D22 | Ticker shows individual allocation when person is filtered | Makes the ticker a personal capacity strip for the selected person |
| D17 | Clicking an overloaded cell scrolls to that person in the full panel | Makes the red cell a direct shortcut to the problem |
| D18 | Ticker label is the only toggle for the full capacity panel | Removes a toolbar button, makes the interaction self-evident |
