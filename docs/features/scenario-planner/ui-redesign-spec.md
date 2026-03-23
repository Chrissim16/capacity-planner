# Scenario Planner — UI Redesign Spec
## Layout, Drawers & Interaction Model

**Date:** 2026-03-19
**Status:** Approved for implementation
**Supersedes:** §2 (Layout & Responsive Behaviour), §4 (Timeline Mode Interactions), §5 (Board Mode Interactions) of `scenario-planner-final-design.md`
**Author:** Dennis Simon / AI-assisted design session
**Reference prototype:** `scenario-planner-mockup.html`

---

## Table of Contents

1. [Design Principle Change](#1-design-principle-change)
2. [Global Layout](#2-global-layout)
3. [Shared Toolbar](#3-shared-toolbar)
4. [Backlog Drawer](#4-backlog-drawer)
5. [Team Members Drawer](#5-team-members-drawer)
6. [Timeline Mode — Gantt Canvas](#6-timeline-mode--gantt-canvas)
7. [Timeline Mode — Capacity Panel](#7-timeline-mode--capacity-panel)
8. [Board Mode — Canvas](#8-board-mode--canvas)
9. [Board Mode — Smart Assignment Panel](#9-board-mode--smart-assignment-panel)
10. [Slide-Out Detail Panel](#10-slide-out-detail-panel)
11. [Drawer Coexistence Rules](#11-drawer-coexistence-rules)
12. [New & Changed Component Files](#12-new--changed-component-files)
13. [Decisions Log (Addendum)](#13-decisions-log-addendum)

---

## 1. Design Principle Change

The previous design placed the Backlog and Team Members panels as **permanent side columns**, taking 268px and ~220px respectively from a horizontally-constrained canvas. Both panels are rarely needed simultaneously and their permanent presence fractured the work surface.

**The new principle:** one primary surface, everything else on demand.

| Previous model | New model |
|---|---|
| Backlog: permanent left sidebar (268px) | Backlog: slide-in left drawer, closed by default |
| Team Members: permanent right column (~220px) | Team Members: slide-in right drawer, closed by default |
| Capacity: permanent section inside right column | Capacity: docked bottom panel, toggled via toolbar |
| Toolbar: 9+ controls | Toolbar: 5 core controls + quarter nav |

Both drawers animate over the canvas without displacing it. When a drawer is open it visually overlays the canvas with a subtle shadow. The canvas itself is never shrunk permanently — it always fills the available width.

---

## 2. Global Layout

The page has two fixed zones and one dynamic zone:

```
┌─ Nav sidebar (220px, app-level) ─────────────────────────────────────────────┐
│ (unchanged — existing sidebar nav)                                           │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ Topbar (48px, full-width) ───────────────────────────────────────────────────┐
│ [scenario mode chip] [Scenario tab pill] [+] │ [Board|Timeline] │ quarter nav │
│ [Backlog N] [Team N] [Capacity toggle] [Save] ← right-aligned               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ Canvas (flex:1, full remaining width) ───────────────────────────────────────┐
│                                                                               │
│  Timeline mode: sprint headers + gantt rows + (capacity panel at bottom)     │
│  Board mode:    project card grid + (SmartAssignment panel at bottom)        │
│                                                                               │
│  ← Backlog drawer slides over left edge when open                           │
│  Team Members drawer slides over right edge when open →                     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Minimum supported viewport:** 1280px wide. Below this, show the existing "best viewed on a wider display" notice.

---

## 3. Shared Toolbar

The toolbar is **identical in both modes**. Controls that are not applicable to a mode are hidden, not disabled.

### Element inventory (left to right)

| Element | Type | Always visible | Notes |
|---|---|---|---|
| Scenario mode chip | Display | ✓ | Icon + "scenario mode" label — communicates context |
| Separator | Visual | ✓ | 1px divider |
| Scenario tab pill | Interactive | ✓ | Shows active scenario name + dropdown chevron. Clicking opens scenario picker dropdown |
| `+` new scenario | Button | ✓ | Disabled at 5 scenarios with tooltip "Maximum 5 scenarios" |
| Separator | Visual | ✓ | |
| `Board \| Timeline` toggle | Segmented control | ✓ | Switches mode, preserves all state |
| Spacer | Layout | ✓ | `flex: 1` — pushes right-aligned controls to the right edge |
| Quarter navigator | `‹ Q1 2026 ›` | Timeline only | Prev disabled at Q1, next disabled at Q4 |
| Separator | Visual | Timeline only | |
| Backlog button | Toggle button | ✓ | Label: "Backlog" + count badge. Active state: blue tint |
| Team button | Toggle button | ✓ | Label: "Team" + count badge. Active state: blue tint |
| Capacity button | Toggle button | Timeline only | Label: "Capacity" + bar chart icon. Active state: blue tint |
| Save button | Primary action | ✓ | Dark background, always rightmost |

### Toolbar visual rules

- Total controls in a typical state: 7 interactive elements
- Quarter navigator is hidden entirely in Board mode — it does not collapse to a disabled state
- Capacity button is hidden entirely in Board mode
- Backlog and Team buttons show their count badges at all times so the PM knows what's available even when drawers are closed
- Save button shows a "Saved" confirmation state for 2 seconds after a successful save, then reverts. A failed save shows a red outline with "Retry" label and persists until resolved

---

## 4. Backlog Drawer

### Purpose

A list of unscheduled work items that can be dragged onto the gantt (Timeline mode) or assigned from (Board mode). Closed by default — opened on demand.

### Trigger

- Click the **Backlog** button in the toolbar (toggle)
- Keyboard shortcut: `B`

### Layout

```
Position: absolute, left edge of canvas, full canvas height
Width: 280px
Opens: slides in from left, transform translateX(-100%) → translateX(0)
Animation: 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)
Overlay: none — drawer overlays the canvas, canvas does not shrink
Shadow: 4px 0 20px rgba(0,0,0,0.08)
Z-index: above canvas content, below slide-out detail panel
```

### Anatomy

```
┌─ Backlog Drawer ──────────────────┐
│ Unscheduled          [✕ close]    │ ← header, 44px
│ 38 items · drag to schedule       │
├───────────────────────────────────┤
│ [🔍 Search items…]                │ ← search input, 44px
├───────────────────────────────────┤
│ Filter: [All epics ▾] [All ▾]    │ ← filter bar, 36px
├───────────────────────────────────┤
│                                   │
│ [EPIC] ERP-3216                   │ ← item cards, scrollable list
│ API Implementation for Treasury   │
│                                   │
│ [FEATURE] ERP-3218                │
│ GL Close Automation – Phase 2     │
│                                   │
│  (drag handle cursor on hover)    │
└───────────────────────────────────┘
```

### Item cards

Each card shows:
- Type pill (EPIC / FEATURE / STORY / UAT / HYPERCARE)
- Jira key (monospace, muted)
- Item name (bold)
- On hover: subtle lift shadow, cursor changes to `grab`

### Close behaviour

- Click the ✕ button in the drawer header
- Click the Backlog toolbar button again
- Press `B` again or `Escape`
- Drawer does NOT close when the user clicks elsewhere on the canvas (to avoid accidental dismissal during drag operations)

### Drop zone (Timeline mode)

When the drawer is open and the PM drags a timeline bar over it:
- Drawer background shifts to a "drop to unschedule" state: subtle red tint + "Drop to unschedule" label centred
- Dropping removes the item from the timeline and returns it to the backlog list with a brief flash animation

### Board mode behaviour

In Board mode the backlog drawer is present but dragging from it is not supported in v1 (items are already shown as project cards on the canvas). The backlog surfaces items that have no corresponding project card — e.g. Features or Stories within an Epic that haven't been individually scheduled. The drawer is still useful for context but drag-to-canvas is a v2 addition.

---

## 5. Team Members Drawer

### Purpose

A list of all active IT team members and non-archived BIZ contacts available for assignment. This is the drag source for Board mode and the quick-reference for capacity in Timeline mode. Closed by default — opened on demand.

### Trigger

- Click the **Team** button in the toolbar (toggle)
- Keyboard shortcut: `T`

### Layout

```
Position: absolute, right edge of canvas, full canvas height
Width: 300px
Opens: slides in from right, transform translateX(100%) → translateX(0)
Animation: 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)
Overlay: none — overlays the canvas, canvas does not shrink
Shadow: -4px 0 20px rgba(0,0,0,0.08)
Z-index: same as Backlog drawer
```

### Anatomy

```
┌─ Team Members Drawer ─────────────────────┐
│ Team                          [✕ close]   │ ← header, 44px
│ 16 members · drag to assign               │
├───────────────────────────────────────────┤
│ [🔍 Search members…]                      │ ← search, 44px
├───────────────────────────────────────────┤
│ IT TEAM (12)                              │ ← section header
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │⠿│[CA] Christina Agustin    [IT]    │   │ ← ⠿ = permanent left-edge drag handle
│ │  │    Solution Lead                 │   │   (Board mode: always visible)
│ │  │    ████████░░ 53d available      │   │   (Timeline mode: visible on hover only)
│ └─────────────────────────────────────┘   │
│                                           │
│ ┌─────────────────────────────────────┐   │
│ │⠿│[MJ] Madhusudan Jay.      [IT]    │   │
│ │  │    ERP Specialist                │   │
│ │  │    ██████████ 51d · OVERLOADED   │   │
│ └─────────────────────────────────────┘   │
│                                           │
│ BIZ CONTACTS (4)              [▾ show]    │ ← collapsible section
│                                           │
└───────────────────────────────────────────┘
```

### Member cards

Each card shows:
- **Drag handle** (`⠿` grip icon, permanent left-edge column, 16px wide):
  - **Board mode:** always visible at full opacity — drag is the primary action from this drawer, so the affordance must be immediately scannable without hover
  - **Timeline mode:** visible on hover only (`opacity: 0` → `opacity: 1`, 120ms) — reinforces that card body click is the default action (focus state), not drag
- Avatar circle (initials + colour-coded by team assignment)
- Name (bold)
- Role / title (muted, truncated)
- IT / BIZ track badge
- Mini capacity bar: fills proportionally to allocation for the selected quarter, coloured by tier (green → yellow → orange → red)
- Available days label (e.g. "53d available")
- If any sprint exceeds 100%: red "OVERLOADED" badge replaces the days label

**Cursor rules:**

| Zone | Board mode | Timeline mode |
|---|---|---|
| Card body (not handle) | `grab` — entire card is draggable | `default` — body click = focus state |
| Drag handle | `grab` | `grab` (visible on hover) |
| During drag | `grabbing` | `grabbing` |

### Sections

**IT TEAM** section is expanded by default and shows all active `TeamMember` records.

**BIZ CONTACTS** section is collapsed by default. Click the section header to expand. Shows all non-archived `BusinessContact` records. The collapse state is remembered for the session.

### Interaction — Timeline mode

In Timeline mode the drawer operates in a **hybrid assignment model**:

**Default — click to focus:** Clicking anywhere on a member card (not the drag handle) activates the **member focus state**: the capacity panel (if open) scrolls to and highlights that person's row, and any bars where they are assigned receive a subtle 400ms pulse highlight on the gantt. No drag occurs. This is the default read-oriented behaviour.

**Advanced — drag-handle assignment:** Each member card exposes a dedicated `⠿` grip icon on the left edge, visible on hover. Dragging from this handle (and only this handle) initiates a person-to-bar drag:
- The handle cursor changes to `grab` on hover, `grabbing` during drag
- All bars on the gantt canvas glow with a 2px accent-blue ring to indicate they are valid drop targets
- Dropping onto a bar opens the Assign Popover with that person pre-selected (existing SP-10 behaviour)
- The gantt bar cursor and the drag-handle cursor are visually distinct, eliminating gesture ambiguity

This keeps the fast direct-assignment workflow available to experienced users while ensuring that accidental card touches never trigger a drag.

### Interaction — Board mode

In Board mode the drawer is the **primary drag source**. Dragging a member card onto a project card initiates the assignment flow (see §8 Board Mode — Canvas for drop behaviour).

During a drag from the team drawer:
- All project cards on the canvas show fit-colour borders (green / amber / red) precomputed via `scoreMember()` at drag-start
- The dragged card shows a reduced-opacity ghost
- A toast at the bottom reads: "Drag onto a project to assign days"

### Close behaviour

- Click ✕ in drawer header
- Click Team toolbar button again
- Press `T` again
- Pressing `Escape` closes this drawer only if no drag operation is in progress

---

## 6. Timeline Mode — Gantt Canvas

### Canvas structure

```
┌─ Gantt header (sticky, 64px) ───────────────────────────────────────────────┐
│ [label col 260px] │ [Sprint headers — 6 equal columns]                      │
│                   │  S1          S2          S3    CURRENT   S5          S6 │
│  [Expand all btn] │  Jan 5–16   Jan 19–30   Feb 2–13   Feb 16–27   Mar 2–13 │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ Gantt body (scrollable) ────────────────────────────────────────────────────┐
│ Epic rows, Feature rows (collapsed), Child rows (collapsed)                  │
│ Bars positioned absolutely with percentage left/width                        │
│ Today line at current date position                                          │
└──────────────────────────────────────────────────────────────────────────────┘
┌─ Capacity panel (docked bottom, toggled, max-height 260px) ──────────────────┐
│ Sprint column headers (aligned to gantt above)                               │
│ Team total row                                                               │
│ Per-person rows (IT then BIZ)                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Sprint header row

- Height: 64px
- Label column: 260px fixed, strong right border (2px, `var(--border-strong)`)
- 6 equal sprint columns for the current quarter
- Each header cell contains:
  - **Current sprint badge** (top-left, if applicable): "Current" chip, 9px uppercase, accent blue — only on the active sprint
  - Sprint label (e.g. `S3`) — 12.5px, bold, `var(--text)`. Accent blue on current sprint.
  - Date range (e.g. `Feb 2–13`) — 10px, JetBrains Mono, `var(--text-3)`
- Current sprint column: `rgba(37,88,201,0.035)` background fill extending full column height into the body
- "Expand all" / "Collapse all" button sits in the left side of the label column header area

### Row types and heights

| Row type | Height | Background | Label indent |
|---|---|---|---|
| Epic | 44px | `var(--surface)` — white | 12px (base) |
| Feature (sub-row) | 36px | `var(--surface-2)` | 28px |
| Story / UAT / Hypercare (sub-row) | 36px | `var(--surface-2)` | 44px |

### Row hover behaviour

On hover, any row:
- Background shifts to `rgba(37,88,201,0.025)`
- A 2px accent-blue top border appears (`::after` pseudo-element)
- Transition: 100ms

This provides a horizontal tracking guide across wide screens — the full row width is highlighted, including both the label column and the gantt cell area.

### Label column content

Epic row:
- Expand/collapse chevron (16×16, rotates 90° when open, 150ms transition)
- 🔒 icon if item is `locked: true`
- Item name (bold, 12.5px, truncated)
- Jira key (monospace, 10px, `var(--text-3)`, right-aligned)

Feature row:
- Expand/collapse chevron
- FEATURE type pill
- Feature name (truncated)
- Jira key

Child rows (Story / UAT / Hypercare):
- Type pill only (no chevron — no children)
- Item name (truncated)
- Jira key if applicable

### Bar rendering

Bars are rendered as absolutely-positioned elements within a `.bar-layer` div spanning the full gantt-cells area. Do **not** use CSS grid for bar placement — percentage `left` and `width` are required for sub-column positioning.

**Bar types, heights, and colours:**

| Type | Height | Background | Border |
|---|---|---|---|
| Epic (epic row) | 28px | `rgba(168,196,245,0.18)` | 2px solid `#6090E0` |
| Feature (sub-row) | 22px | `#A8C4F5` | 1px solid `#6090E0` |
| Story | 18px | `#D0CCC8` | 1px solid `#A09D97` |
| UAT | 18px | `#CDB0F5` | 1px solid `#9B6EE2` |
| Hypercare | 18px | `#90D9B8` | 1px solid `#1A7A52` |

Border radii: Epic 6px, Feature 5px, children 4px.

**Bar contents:**
- Avatar stack (IT then BIZ, max 3 visible + overflow badge): 16×16px circles, -4px left overlap
- No text labels — avatars only
- Lock icon (🔒) at leading edge if item is locked

**Bar hover:** `filter: brightness(0.92)` + `translateY(-1px)`, 150ms transition

**Continuation arrows** — when a bar is clipped by the quarter boundary:
- `.clip-left` class: removes left border and left border-radius, renders left-pointing `::before` arrow
- `.clip-right` class: removes right border and right border-radius, renders right-pointing `::after` arrow
- Arrow: CSS triangle, `rgba(0,0,0,0.22)`, 6px×8px, centred vertically 3px from clipped edge
- `overflow: visible` must be set on gantt rows — never `overflow: hidden`

See `timeline-view-spec.md §Continuation Arrows` for exact CSS.

**Locked item rendering:**
- Bar renders with a dashed border instead of solid
- 🔒 badge visible on the bar
- Drag cursor is `not-allowed`

**Unlocked-in-scenario rendering:**
- Bar renders with dashed border + "UNLOCKED" pill overlaid above the bar (9px, accent orange)

### Expand / collapse behaviour

- Default state: all epics collapsed — only Epic rows visible
- Clicking Epic chevron reveals Feature rows with 150ms height animation (`max-height` transition)
- Clicking Feature chevron reveals child rows
- "Expand all" button in the header label column opens all levels simultaneously; label changes to "Collapse all"
- Sub-row wrappers use `max-height` animation, not `display: none` toggling, to avoid layout jumps

### Drag to reposition (unlocked bars only)

- Drag handle is the entire bar
- Bars snap to sprint boundaries
- Sprint boundary snap: 1/24th of full-year width per sprint
- Visual snap indicator: a 2px accent-blue vertical line at the target sprint boundary appears during drag
- During drag: capacity panel cells animate their values in real time (`transition: width 300ms ease` on mini progress bars)
- On drop: `PlannerItem.startSprint` updates, bar re-renders at new position

### Resize to change duration (unlocked bars only)

- Hover bar → resize handles appear at left and right edges (4px wide, full bar height, `var(--border-strong)` colour, cursor `ew-resize`)
- Minimum bar span: 1 sprint
- Resizing left edge changes `startSprint`; right edge changes `startSprint + spanSprints`
- Capacity panel updates live during resize

### Moving Epics with children

On drag-start of an Epic bar containing scheduled Features:
- A compact confirmation toast appears (not a modal): "Move children with this epic? [Yes] [No]"
- Auto-dismisses after 5 seconds defaulting to Yes
- Yes: all Feature and Story bars shift by the same sprint delta
- No: only the Epic bar moves; child bars stay at original positions (creating a visual misalignment, which is intentional — the PM is exploring)

### Drag from Backlog drawer

- Drag a card from the open backlog drawer onto the gantt
- As the drag enters the gantt area, sprint columns show a highlighted drop zone (full column height, accent-blue tint wash)
- On drop at a sprint column: new bar appears at that sprint spanning 1 sprint by default; assign popover opens automatically at the dropped bar
- If the backlog drawer is closed, drag-from-backlog is unavailable — no implicit opening

### Today line

- 2px solid `#E63946` vertical line, full gantt body height
- Small "TODAY" chip at the top of the line
- Visible only when current date falls within the visible quarter
- Position: calculated from current date within its sprint, then mapped to a percentage of the gantt width

---

## 7. Timeline Mode — Capacity Panel

The capacity panel docks at the bottom of the canvas. It is **closed by default** and toggled via the Capacity button in the toolbar.

### Open / close animation

- `max-height: 0` → `max-height: 260px`, 250ms ease
- `border-top` appears when open: 2px solid `var(--border-strong)`
- Internal content does not animate separately — the container max-height animation is sufficient

### Structure

The panel is a grid that mirrors the gantt sprint columns **exactly**:

```
[label column 260px] | [6 equal sprint cells, matching gantt column widths]
```

The label column width must stay in sync with the gantt label column. If the label column is made resizable (future), the capacity panel label column must resize with it.

### Panel header row

- Height: 36px, `var(--surface-2)` background, sticky within the panel's scroll area
- Label cell: "Capacity" label (11px uppercase bold, `var(--text-3)`) + current quarter label
- Sprint cells: sprint label only (e.g. `S3`), JetBrains Mono 10px, `var(--text-3)`. Current sprint cell in accent blue.

### Team total row

Always visible when panel is open. Height: 44px, `var(--surface-2)` background.

- Label cell: "Team total" bold
- Per-sprint cell: aggregate allocation percentage across all team members + `load / avail` days
- Cell background coloured by allocation tier (see tiers below)

### Individual person rows

Height: 40px each. One row per:
- Active `TeamMember` records (IT section, shown first)
- Non-archived `BusinessContact` records (BIZ section, shown below)

Label cell:
- Avatar (22px circle, initials)
- Name (12px, bold, truncated)
- Track badge (IT blue / BIZ purple)
- "OVERLOADED" badge (red, 9px) if any sprint exceeds 100%

When a row is overloaded:
- Red 3px left border on the entire row
- "OVERLOADED" badge in the label cell

Sprint cells (per person, per sprint):
- Allocation percentage, bold, coloured by tier
- `Xd / Yd` load/available days, JetBrains Mono 9.5px, `var(--text-3)`
- 3px mini progress bar: green/yellow/orange/red fill to 100%, then a separate red overflow segment for >100%
- Progress bar animates `transition: width 300ms ease` during live drag updates

### Allocation colour tiers

| Range | Cell background | Text colour | Mini bar colour |
|---|---|---|---|
| 0% | `#FAFAFA` | `#D1D5DB` | `#E5E7EB` |
| 1–50% | `#F0FDF4` | `#16A34A` | `#16A34A` |
| 51–80% | `#FEFCE8` | `#CA8A04` | `#CA8A04` |
| 81–100% | `#FFF7ED` | `#EA580C` | `#EA580C` |
| >100% | `#FEF2F2` | `#DC2626` | `#DC2626` |

### Live update behaviour

Any of these actions triggers immediate capacity recalculation and cell re-render:
- Bar drag (updates as cursor moves — throttled to `requestAnimationFrame`)
- Bar resize
- Effort slider change in assign popover
- Assignment added or removed

When values change, cells animate their content: number counts up/down over 200ms, progress bar width transitions. This real-time feedback is the core value of the capacity panel.

### Panel scroll

Max-height 260px. If the total content exceeds this, the panel scrolls internally. The gantt area above is never displaced — the canvas uses `flex-direction: column` with `overflow: hidden` on the gantt body.

---

## 8. Board Mode — Canvas

### Purpose

Bulk quarterly staffing. "Who works on what?" at the Epic level, without a time axis.

### Canvas structure

```
┌─ Board toolbar strip (36px) ──────────────────────────────────────────────────┐
│ Quarter: [Q1 2026 ▾]   Group by: [Epic ▾]   Sort: [Priority ▾]              │
└───────────────────────────────────────────────────────────────────────────────┘
┌─ Project cards grid (flex-1, scrollable) ─────────────────────────────────────┐
│                                                                               │
│ [Epic card]  [Epic card]  [Epic card]  [Epic card]                           │
│ [Epic card]  [Epic card]  [Epic card]                                        │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
┌─ Smart Assignment Panel (collapsible, docked bottom) ─────────────────────────┐
│ Visible when a project card is selected                                       │
└───────────────────────────────────────────────────────────────────────────────┘
```

The board canvas takes `100%` of the available width. There are no permanent side panels.

**Team members are accessed via the Team Members Drawer** (see §5). When the drawer is open in Board mode, team member cards are draggable onto project cards.

### Board toolbar strip

A secondary toolbar below the main topbar. Contains:
- **Quarter selector:** `Quarter: [Q1 2026 ▾]` — dropdown for Q1–Q4. Defaults to current quarter. Changing this reloads the assignment data for that quarter.
- **Group by:** `[Epic ▾]` — groups project cards. Default: by Epic. Options: by status, by priority, by assignee (v1: Epic only).
- **Sort:** `[Priority ▾]` — sort order within groups. Options: Priority (default), Name, % assigned.

### Project cards

Each card is a white rectangle, `#EBEBEB` border, 12px radius.

Card content:
- **Top row:** Epic name (bold, 14px) + Priority badge (right-aligned) + **Details icon button** (→ icon, 16px, right of priority badge, visible on hover only — opens the Slide-Out Detail Panel)
- **Second row:** Jira key (monospace, muted) + Feature count chip (e.g. "4 features")
- **Assignment bar:** thin 4px bar showing assigned days vs available days. Coloured by fill percentage using the same allocation tiers as the capacity panel. Unassigned = flat grey.
- **Assigned days label:** `Xd assigned` / `Yd available` in small muted text

Card states:
- Default: white bg, `#EBEBEB` border
- Hover: `box-shadow: 0 4px 16px rgba(0,0,0,0.08)`, `translateY(-1px)`
- Selected (SmartAssignmentPanel open): 2px accent-blue border, accent-light background tint
- Drag target (team member card being dragged over it): border becomes fit-colour (green / amber / red, from `scoreMember()`), pulsing animation
- Locked: 🔒 badge top-right corner

### Selecting a project card

**Single click** on a project card is the primary action and always opens the Smart Assignment Panel:
- Card gets selected state styling (2px accent-blue border, accent-light tint)
- Smart Assignment Panel opens at the bottom of the canvas (see §9)
- Clicking a different card switches the panel to the new selection
- Clicking the same card again deselects it and closes the panel

**Opening item details** is a secondary action, never triggered by a card body click:
- Click the **Details icon button** (→) visible on the card top row on hover
- Or click the **"View epic →"** link in the Smart Assignment Panel header
- This opens the Slide-Out Detail Panel (§10) without deselecting the card or closing the panel

### Drop behaviour (Team Members Drawer → Project Card)

When the Team Members drawer is open and a member card is dragged onto a project card:
1. The entire project card area is the drop target (not a sub-zone)
2. On drop: the **Days popover** appears, positioned via `@floating-ui/react`, anchored above the drop target
3. The Days popover contains: member avatar + name, "How many days?" label, number input (1–max available), Cancel / Assign buttons
4. Confirm → `addAssignment()` or `addBusinessAssignment()` is called; the project card's assignment bar updates; the member card's available days decreases
5. Cancel → no change

### Assignment bar visual update

After assignment:
- Bar animates from its previous fill to the new fill over 300ms
- If the new fill exceeds 100%, the overflow portion renders in `var(--red)`

---

## 9. Board Mode — Smart Assignment Panel

### Purpose

When a project card is selected, the SmartAssignment Panel provides a ranked list of team members for that Epic — with fit scores, available capacity, and skill match. It is the faster alternative to drag-and-drop for detailed assignment decisions.

### Position

Docked at the bottom of the canvas. Height: 220px fixed. The project card grid area contracts (`flex: 1` with overflow scroll) — the cards grid does not get pushed off-screen.

Open/close animation: `max-height: 0` → `max-height: 220px`, 200ms ease.

### Structure

```
┌─ SmartAssignment Panel ───────────────────────────────────────────────────────┐
│ Assigning to: [ERP IAM Workstream]  Q1 2026  [View epic →]  [✕ close]      │
├───────────────────────────────────────────────────────────────────────────────┤
│ [CA]  Christina Agustin   [IT]  [●● GOOD]  53d avail  [Java][ERP]  10 ──── + │
│ [CK]  Cosmina Kiss        [IT]  [● PARTIAL] 46d avail  [TMS]       5  ──── + │
│ [MJ]  Madhusudan Jay.     [IT]  [✕ OVER]   0d avail   [ERP][SAP]  0  ──── + │
│ ─────────────────────── BIZ Contacts ──────────────────────────────────────  │
│ [TV]  Tim Vierhout        [BIZ] [● PARTIAL] 48d avail  [Finance]   8  ──── + │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Row content (per person)

| Element | Detail |
|---|---|
| Avatar | 28px circle |
| Name | Bold, 13px |
| Track badge | IT (blue) / BIZ (purple) |
| Fit badge | `GOOD` (green), `PARTIAL` (amber), `OVER` (red) — from `scoreMember()` |
| Available days | `Xd avail` — remaining capacity for selected quarter |
| Skill chips | Matched skills as green pills; missing skills as grey pills with gap indicator |
| Effort input | Number stepper (days per sprint). Default: 5. Min: 1. Max: available days ÷ sprints in quarter. |
| Assign button | `+` icon button. Triggers `addAssignment()`. Disabled if `OVER`. |

### Sorting

Rows sorted by `rankMemberFits()`: GOOD → PARTIAL → OVER. Within each tier, sorted by available days descending.

### BIZ section

BIZ contacts appear below a divider labelled "BIZ Contacts". Initially collapsed with a "Show BIZ contacts (N)" toggle. Expands in place.

### Graceful degradation

If `staffing.ts` (US-061) has not shipped: fit badges are hidden, rows are sorted by available days descending only. The panel remains fully functional for assignment — it just shows no fit scoring.

### Closing the panel

- Click ✕ button in panel header
- Click the currently selected project card again
- Press `Escape`

---

## 10. Slide-Out Detail Panel

### Trigger

The detail panel is a secondary surface — it is never the primary action of a click on the main canvas.

Opening the detail panel:
- **Timeline mode:** click any bar or any label row
- **Board mode:** click the Details icon button (→) on a project card, or click "Open details" in the Smart Assignment Panel header. A body click on a project card does **not** open the detail panel — it selects the card and opens Smart Assignment instead

### Behaviour

- Slides in from the right, **over** the canvas — does not shrink the canvas
- Width: 400px
- Backdrop: `rgba(0,0,0,0.12)` overlay with `backdrop-filter: blur(2px)`
- Animation: `transform: translateX(100%)` → `translateX(0)`, 220ms cubic-bezier
- Close: ✕ button, click backdrop, or `Escape`
- If Team Members drawer is also open: detail panel renders on top of it (higher z-index)

### Panel header

- Type pill + Jira key (if applicable)
- Item name (16px, bold, tight tracking)
- Close button (top-right)

### Assignees section

Two-column grid: IT track (blue-tinted background) | BIZ track (purple-tinted background).

Each track:
- Section label ("IT Track" / "BIZ Track")
- Per-assignee row: avatar + name + role
- If unassigned: muted "Unassigned" text

### Details section

2-column meta grid:
- Status badge (In Progress / To Do / Done)
- Sprint range (e.g. `S1 – S4`)
- Date range, spanning full width (e.g. `Jan 5 – Mar 27`)
- Duration (phases only): `X sprints · Y weeks`
- Jira ID (Jira items only)
- Lock status: if locked → 🔒 "Committed" + "Unlock in this scenario" link

### Features list (Epics only)

Collapsible section listing child Features:
- Each feature: type pill + name + status badge
- Click a feature row → panel navigates to that feature's detail (back button appears)

---

## 11. Drawer Coexistence Rules

The coexistence model is **soft-responsive**: both drawers may be open simultaneously on wide viewports; on narrower viewports the second drawer auto-closes when the first opens, protecting the usable canvas.

### Viewport breakpoints

| Viewport width | Rule |
|---|---|
| ≥ 1440px | Both drawers may be open simultaneously |
| 1280px – 1439px | Only one side drawer may be open at a time — opening one automatically closes the other with a 150ms slide-out animation |
| < 1280px | Existing "best viewed on a wider display" notice — no drawers shown |

### State table

| State | Canvas visibility | Notes |
|---|---|---|
| Both drawers closed | 100% (overlaid) | Default — full canvas |
| Backlog open only | 100% (overlaid) | Backlog overlays left edge |
| Team open only | 100% (overlaid) | Team overlays right edge |
| Both open (≥ 1440px) | 100% (overlaid on both sides) | Drawers open simultaneously; the one most recently opened is on top at any overlap zone |
| Both open attempted (< 1440px) | 100% (overlaid, one side) | Opening the second drawer triggers a 150ms auto-close of the currently open one before the new one opens |
| Detail panel open | Canvas under all | Detail panel is highest z-index — always renders on top of any open drawers |
| Detail panel opens in Timeline mode (any width) | No auto-close | Detail panel slides in over the canvas and over any open drawer — no drawer is closed. Bar clicks are fast and frequent; a two-step dismiss animation would feel sluggish |
| Detail panel opens in Board mode at < 1440px | Side drawer auto-closes | If a side drawer is open when the detail panel triggers in Board mode, that drawer closes first (150ms) then the detail panel slides in. Board interactions are deliberate, not rapid-fire, so the sequenced animation is acceptable |
| Smart Assignment Panel + Detail panel (Board mode) | Both visible simultaneously | The Smart Assignment Panel is docked at the canvas bottom (220px); the detail panel slides in from the right. They occupy different axes and do not conflict. Both may remain open at the same time — selecting a different card updates the Smart Assignment Panel without closing the detail panel |

### Auto-close behaviour

When a drawer is auto-closed by the viewport rule, a brief dismissal animation plays (150ms slide-out). No toast or warning is shown — the toolbar button for the closed drawer returns to its inactive state, making it easy to reopen.

**Manually closing one drawer never affects the other**, regardless of viewport width.

**Mode-specific detail panel rule:**
- **Timeline mode:** the detail panel always renders on top of any open drawer — no auto-close is triggered. Bar clicks are frequent, and a forced drawer-dismiss before each would create perceivable latency.
- **Board mode:** opening the detail panel at < 1440px auto-closes the open side drawer first (150ms), then the detail panel slides in. Board interactions are deliberate (card → details) so the sequential animation is appropriate.

---

## 12. New & Changed Component Files

### New components (additions to the original file list)

| File | Purpose |
|---|---|
| `frontend/src/components/planner/PlannerTeamDrawer.tsx` | Team Members drawer — member cards, IT/BIZ sections, drag source in Board mode, focus trigger in Timeline mode |
| `frontend/src/components/planner/BoardToolbar.tsx` | Board mode secondary toolbar — quarter selector, group-by, sort |

### Updated components (replaces original spec)

| File | Change from original spec |
|---|---|
| `frontend/src/components/planner/PlannerBacklog.tsx` | Now a **drawer** (absolute position, slide animation) rather than a fixed sidebar. Loses the resize handle. |
| `frontend/src/pages/ScenarioPlanner.tsx` | Manages drawer open/close state for both Backlog and Team drawers. Passes drawer state as props. Removes permanent layout split. |
| `frontend/src/components/planner/PlannerBoard.tsx` | No permanent right panel. Project cards grid is full-width. Team assignment via Team drawer drag or SmartAssignment panel. Includes board toolbar strip. |
| `frontend/src/components/planner/PlannerTimeline.tsx` | No permanent sidebar. Team drawer is separate component. Gantt takes full available width. |

### Shared toolbar state (lifted to page level)

The following state lives in `ScenarioPlanner.tsx` and is passed down:

```typescript
interface PlannerUIState {
  backlogOpen: boolean;
  teamDrawerOpen: boolean;
  capacityOpen: boolean;        // Timeline mode only
  currentQuarter: 1 | 2 | 3 | 4;
  activeMode: 'board' | 'timeline';
  selectedProjectId: string | null;  // Board mode — drives SmartAssignment panel
}
```

All toggle actions are simple `setState` calls — no store involvement needed for UI-only state.

---

## 13. Decisions Log (Addendum)

These decisions supersede or extend the original decisions log in `scenario-planner-final-design.md`.

| # | Decision | Supersedes | Rationale |
|---|---|---|---|
| D18 | Backlog becomes a slide-in drawer | §2 "Backlog sidebar: collapsible to thin pill strip" | Collapsing to a pill strip still permanently occupies layout space. Full overlay drawer gives the gantt 100% width by default. |
| D19 | Team Members becomes a slide-in drawer (right edge) | §2 "Right panel: Team Member Cards" and §5 board layout | Permanent right panel consumed ~220px and was contextually needed only during drag operations. Drawer makes it available on demand with zero canvas cost. |
| D20 | Drawers overlay the canvas, not displace it | New | Displacement creates a jarring reflow every time a drawer opens. Overlay with shadow preserves spatial orientation. |
| D21 | Capacity panel closed by default | §8 "Toggleable via toolbar button" (already correct, now reinforced) | Previously the panel appeared to load in an open state in some implementations. Default state is explicitly closed. |
| D22 | Quarter navigator removed from Board mode toolbar | §5 "Quarter selector: dropdown at the top of Board mode" | Board mode uses a dropdown in the board toolbar strip instead — it is a secondary control, not a primary navigation action. The main topbar should not change appearance between modes. |
| D23 | Board mode has its own secondary toolbar strip | New | Needed to house quarter selector, group-by, and sort without polluting the shared topbar. |
| D24 | Board mode Team drawer drag → Days popover (not inline effort input) | Extends §5 "drag a person card → days popover" | Consistent with the original DaysPopover spec. The draw is between drag-to-assign (fast) and SmartAssignment panel (deliberate). Both paths coexist. |
| D25 | Capacity panel label column must stay in sync with gantt label column | New | Visual misalignment between capacity rows and gantt rows breaks the association between who-owns-what. If label resizing is added later, both must resize together. |
| D26 | Team drawer in Timeline mode uses a dedicated drag-handle for assignment (hybrid model) | New | Card body click = member focus state (read-oriented). Drag handle (⠿, hover-only) initiates person-to-bar drag. Visually separates two cursor targets so bar-drag and person-drag cannot be confused. Preserves expert speed without adding gesture ambiguity. |
| D27 | Board card single click exclusively opens Smart Assignment; details are a secondary action | §10 Trigger "any project card in Board mode" | One primary action per gesture. Details are accessed via a hover-visible icon button on the card or via "Open details" in the Smart Assignment Panel header. Removes the ambiguous "unless the SmartAssignment panel is already handling it" conditional. |
| D28 | Soft-responsive drawer coexistence: both drawers allowed at ≥ 1440px, one-at-a-time below | §11 "No forced close is triggered" | At 1280px with two 280px/300px drawers open, 580px of the canvas is obscured — too little for comfortable drag and scan. Threshold of 1440px gives each open drawer 560px+ of visible canvas, which is sufficient for all planning interactions. Auto-close is silent (animation only, no toast). |
