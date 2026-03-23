# Assignment Panel — Scenario Planner / Timeline Mode
## Product Specification for Implementation

**Date:** 2026-03-20
**Status:** Approved
**Supersedes:** `AssignPopover.tsx` as described in `scenario-planner-final-design.md` §4 and §8
**Author:** Dennis Simon / AI-assisted design session

---

## Overview

This spec defines the **Assignment Panel** — a slide-out drawer that replaces the previously planned `AssignPopover` for Timeline mode. It is triggered by clicking any bar or row label in the Scenario Planner's Timeline view.

The panel replaces the drag-person-onto-bar assignment gesture entirely in Timeline mode. Drag in Timeline mode now means one thing only: **repositioning a bar in time**. All people assignment happens through this panel.

---

## Table of Contents

1. [Trigger & Dismissal](#1-trigger--dismissal)
2. [Layout & Sizing](#2-layout--sizing)
3. [Panel Header](#3-panel-header)
4. [Allocation Impact Section](#4-allocation-impact-section)
5. [Assignees Section](#5-assignees-section)
6. [Inline Person Picker](#6-inline-person-picker)
7. [Panel Footer](#7-panel-footer)
8. [Visual Design Tokens](#8-visual-design-tokens)
9. [Interactions Summary](#9-interactions-summary)
10. [Component & File Scope](#10-component--file-scope)
11. [What Changes vs Previous Spec](#11-what-changes-vs-previous-spec)

---

## 1. Trigger & Dismissal

### Opening
The panel opens when the user clicks:
- Any **bar** in the gantt (Epic, Feature, Story, UAT, Hypercare)
- Any **row label** in the label column

Both targets open the same panel for that item. There is no right-click or hover requirement — a single left-click is the trigger.

### Active state on the gantt
When the panel is open for an item:
- The corresponding bar receives `outline: 2px solid #0ED3CF; outline-offset: 2px` — Sana teal accent
- The corresponding row gets a subtle teal tint background: `background: rgba(14,211,207,0.06)`
- Both states are removed when the panel closes

### Canvas compression
When the panel opens, the gantt canvas shifts left to avoid the panel overlapping content:

```css
.canvas {
  transition: padding-right 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.canvas.panel-open {
  padding-right: 440px;
}
```

This keeps the gantt fully readable alongside the panel on wide screens. The capacity panel below the gantt compresses with the canvas — it is not covered by the slide-out.

### Dismissal
Panel closes on:
- Clicking the **✕** button in the panel header
- Pressing **Escape**
- Clicking a **different bar or row** — panel re-opens immediately for the new item (no close-then-open flicker)

There is **no backdrop overlay**. The panel coexists with the gantt; the user should be able to keep reading the timeline while the panel is open.

---

## 2. Layout & Sizing

```
┌─ Gantt canvas (flex:1, compresses right) ──┐  ┌─ Assignment Panel (440px fixed) ─┐
│  Sprint headers                             │  │  Panel header (sticky)           │
│  Gantt rows                                 │  │  ─────────────────────────────── │
│                                             │  │  Scrollable body:                │
│  ─── Capacity panel ───────────────────── │  │    · Allocation impact            │
│  Team total: 72% 68% 91%...               │  │    · Assignees (IT + BIZ)         │
│  Erik V. IT: 80% 65% 110%...              │  │    · Details                      │
└─────────────────────────────────────────────┘  │  ─────────────────────────────── │
                                                  │  Panel footer (sticky)           │
                                                  └──────────────────────────────────┘
```

**Panel dimensions:**
- Width: `440px`, fixed
- Position: `fixed`, `top: 0`, `right: 0`, `bottom: 0` — full viewport height
- Background: `#ffffff`
- Left border: `1px solid #E5E3DF`
- Box shadow: `-12px 0 40px rgba(0,0,0,0.09)`
- Transform on closed: `translateX(100%)`
- Transform on open: `translateX(0)`
- Transition: `transform 300ms cubic-bezier(0.16, 1, 0.3, 1)`

**Internal layout:**
- Panel header: fixed height, `flex-shrink: 0`
- Panel body: `flex: 1; overflow-y: auto` — scrolls independently
- Panel footer: fixed height, `flex-shrink: 0`, `border-top: 1px solid #EBEBEB`

---

## 3. Panel Header

The header is always visible (not scrolled away). It contains all the identifying information for the item.

```
┌─────────────────────────────────────────────────────┐
│  [Feature pill]  [↗ VS-142]  [In Progress]  [🔒]   ✕ │
│  GL Reconciliation — AP Module                       │
│                                                      │
│  [S7] → [S10]  8 weeks · 4 sprints    [10d/sprint ▸]│
└─────────────────────────────────────────────────────┘
```

### Type pill
Same pill styles as the rest of the app:

| Type | Background | Text |
|---|---|---|
| Epic | `#E0F2FE` | `#0369A1` |
| Feature | `#EBF2FF` | `#3B70CC` |
| Story | `#F3F2F1` | `#6B6560` |
| UAT | `#F3EEFF` | `#7C3AED` |
| Hypercare | `#ECFDF5` | `#065F46` |

### Jira link
- Format: `↗ VS-142`
- Styled as a clickable badge: `background: #F5F3F0; border: 1px solid #E5E5E3; border-radius: 5px; color: #4B5563; font-size: 11px; font-weight: 600`
- On hover: `background: #EBEBEB`
- Opens the Jira issue in a new tab: `window.open(jiraBaseUrl + item.jiraKey, '_blank')`
- Only rendered if `item.jiraKey` is present

### Status badge
Pill-shaped. Follows the Sana status colour system — **not** the generic blue/grey palette:

| Status | Background | Text |
|---|---|---|
| In Progress | `#FEF3C7` | `#92400E` |
| To Do / Planned | `#F5F3F0` | `#6B7280` |
| Done | `#D1FAE5` | `#065F46` |
| Blocked | `#FEE2E2` | `#991B1B` |

### Lock badge
- `🔒` emoji, `opacity: 0.55`, `font-size: 11px`
- Only rendered if `item.locked === true`

### Title
- `font-size: 15px; font-weight: 800; color: #111827; line-height: 1.3`
- Full item name, wraps to multiple lines if needed

### Sprint range row
Sits below the title. Three elements in a flex row:

1. **Sprint badges** — `[S7] → [S10]`: monospace font, `background: #F3F4F6`, `border-radius: 5px`, `padding: 3px 10px`
2. **Duration label** — muted text: `"8 weeks · 4 sprints"`
3. **Effort pill** — right-aligned: shows total `daysPerSprint` across all assignees. Format: `"10d / sprint"`. Updates live as steppers change. Sits at `margin-left: auto`.

---

## 4. Allocation Impact Section

This section shows the PM how many team-days this specific item consumes per sprint it covers, and flags overload immediately.

### Grid layout
- One cell per sprint the item spans (not the full 6-column quarter grid)
- `display: grid; grid-template-columns: repeat(N, 1fr)` where N = number of sprints the item spans
- Max 6 cells visible; if item spans more than 6 sprints, the grid scrolls horizontally

### Cell content
Each cell contains three lines:
1. **Sprint label** — `S7`, monospace, `10px`, muted
2. **Day total** — total assigned days across all assignees for that sprint, `15px`, `font-weight: 800`
3. **Team percentage** — computed as `totalDays / teamAvailDays * 100`, `10px`, `opacity: 0.7`

### Cell colour tiers
Aligned to `util.*` Tailwind tokens and existing semantic variables:

| Range | Background | Border | Text | Tailwind / token ref |
|---|---|---|---|---|
| 0% | `#F5F8FC` | `#DEDFE3` | `#94A3B8` | `util.bench` / `biz.border` |
| 1–50% | `#F5F8FC` | `#DEDFE3` | `#16A34A` | `util.bench` bg / `util.healthy` text |
| 51–80% | `#fffbeb` | `#fde68a` | `#D97706` | `--whatif-bg` / `util.near` |
| 81–100% | `#fff4e5` | `#fcd34d` | `#D97706` | `--warning-light` / `util.near` |
| >100% | `#fee4e2` | `#fca5a5` | `#DC2626` | `--danger-light` / `util.over` |

> **Implementation note:** The amber-tier background (`#fffbeb`) maps to `--whatif-bg` in `index.css` but has no Tailwind `theme.extend` key. Use `style={{ background: 'var(--whatif-bg)' }}` rather than a Tailwind class, or add `'near-light': '#fffbeb'` under `util` in `tailwind.config.js`.

### Overload warning
Below the grid, conditionally rendered when any sprint cell is `>100%`:

```
⚠  S9, S10: team is overloaded with this assignment
```

- `font-size: 11px; color: #DC2626`
- Lists the affected sprint labels
- Hidden when no sprint exceeds 100%

### Live updates
The allocation grid recalculates whenever:
- A stepper value changes
- An assignee is added or removed

Use a brief opacity pulse (`opacity: 0.5 → 1` over `150ms`) to visually signal the recalculation.

---

## 5. Assignees Section

Displays current IT and BIZ assignees in a two-column track layout, each with an effort stepper and a remove button.

### Track cards

```
┌─ IT Track ──────────────┐  ┌─ BIZ Track ────────────┐
│ [E] Erik V.             │  │ [J] Jan de Witt         │
│     Senior Dev  [−] 4 [+]d ✕│     Controller [−] 3 [+]d ✕│
│ [S] Sophie L.           │  │                         │
│     Frontend  [−] 3 [+]d ✕│  + Add person           │
│ + Add person            │  │                         │
└─────────────────────────┘  └─────────────────────────┘
```

**IT track card:**
- Background: `#CCFBF1` — Sana teal light (`--accent-teal-light`)
- Border: `1px solid #99F6E4`
- Border-radius: `9px`
- Padding: `10px`
- Track label: `"IT Track"`, `font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0D9488`

**BIZ track card:** same structure with:
- Background: `#F0F2F5` (`biz.light`)
- Border: `1px solid #DEDFE3` (`biz.border`)
- Track label colour: `#94A3B8` (`biz.DEFAULT`) — intentionally neutral; BIZ contacts are a different entity type from IT team members

### Assignee row
Each assigned person renders as a row inside their track card:

```
[Avatar 22px] [Name + Role]  [− stepper val +] d  [✕]
```

- Avatar: 22×22px circle, same colour palette as elsewhere
- Name: `11.5px; font-weight: 600`
- Role: `10px; color: #9CA3AF` — sourced from `TeamMember.role` or `BusinessContact.role`
- Stepper: see §5.1
- Remove button: `✕`, appears as a subtle icon; hover turns `#EF4444` with light red background

**Remove animation:**
When ✕ is clicked, the row animates out: `opacity: 0; transform: translateX(8px)` over `200ms`, then is removed from the DOM and state.

### 5.1 Effort stepper

Controls `daysPerSprint` for this assignee on this item.

```
[−]  4  [+]  d
```

- **Minus button:** `−`, `width: 20px; height: 20px`, rounded, bordered
- **Value display:** current `daysPerSprint`, `font-size: 12px; font-weight: 700; min-width: 16px; text-align: center`
- **Plus button:** `+`
- **Unit label:** `"d"`, `font-size: 10px; color: #9CA3AF`
- **Minimum value:** 1
- **Maximum value:** 10 (v1 — a future enhancement caps this at the person's available days)
- Clicking either button updates state immediately, re-renders the value, updates the effort pill in the header, and pulses the allocation grid

---

## 6. Inline Person Picker

Clicking `+ Add person` in either track card expands an inline picker **within that track card**. No floating layer, no second popover.

### Expand behaviour
- The picker area starts at `max-height: 0; opacity: 0; overflow: hidden`
- On open: animates to `max-height: 280px; opacity: 1` over `250ms cubic-bezier(0.16, 1, 0.3, 1)`
- The `+ Add person` button label changes to `"Cancel"` while the picker is open
- Only one picker (IT or BIZ) can be open at a time — opening one closes the other

### Search input
- Full-width inside the picker area
- Placeholder: `"Search…"`
- Filters the list in real time by name and role
- Focus is set automatically when the picker opens (`setTimeout 220ms` to allow the expand animation to start)

### Person list

Each row shows:

```
[Avatar 24px]  [Name]           [Fit badge]
               [Role]           [Xd free]
```

- Sorted: Good fit → Partial → Over capacity
- People already assigned to this item are **excluded** from the list
- People with `avail === 0` are rendered in a separate section below a `"No availability"` divider label, with reduced opacity (`0.5`) and `pointer-events: none`

**Fit badge colours** (sourced from `scoreMember()` in `utils/staffing.ts`):

| Fit | Background | Text |
|---|---|---|
| Good | `#D1FAE5` | `#065F46` |
| Partial | `#FEF3C7` | `#92400E` |
| Over / — | `#F3F4F6` | `#9CA3AF` |

**Available days display:**
- `Xd free` in green/amber/grey depending on amount
- `> 3d`: green `#16A34A`
- `1–3d`: amber `#CA8A04`
- `0d`: grey `#D1D5DB`, displays `—`

### On selecting a person
1. Person is added to the track's assignee list with `daysPerSprint: 2` as default
2. Assignee row renders immediately with the stepper so the PM can adjust effort right away
3. The picker list re-renders to exclude the newly added person
4. The picker **stays open** so the PM can add another person without re-clicking
5. Effort pill and allocation grid update immediately

### Graceful degradation
If `utils/staffing.ts` (and `scoreMember()`) has not shipped yet, the picker falls back to:
- Sorting by available days descending
- No fit badges rendered
- No skill chips

The picker is fully functional without it.

---

## 7. Panel Footer

Sticky at the bottom of the panel, always visible.

```
[🔓 Unlock]   [↩ Backlog]                    [Save changes]
```

### Unlock button
- Only rendered if `item.locked === true`
- Style: `background: #FFFBEB; border: 1px solid #FDE68A; color: #CA8A04`
- Action: calls `unlockPlannerItem(item.id)` — sets `item.unlockedInScenario = true` on the `PlannerItem`
- After clicking: button disappears, item renders with dashed border and `UNLOCKED` badge (per the main scenario planner spec)

### Move to backlog button
- Style: ghost, danger on hover (`color: #DC2626; background: #FEF2F2; border-color: #FCA5A5`)
- Action: calls `removePlannerItem(item.id)` — removes item from `plannerLayout`, returns it to the backlog sidebar
- Panel closes after action

### Save changes button
- Right-aligned, `margin-left: auto`
- Style: `background: #1F2937; color: #fff; font-weight: 700`
- Action: persists the current `PlannerItem` state (assignments + effort values) to the scenario snapshot via `updatePlannerLayout()`
- After clicking: brief `"Saved"` label flash (200ms), then button label returns to `"Save changes"`

---

## 8. Visual Design Tokens

> **Note on colour system:** This panel follows the Sana design language. The key rule is no blue as primary UI chrome — blue is reserved for the existing bar/type-pill colour system (Feature bars, Epic type pills) which predates the Sana guidelines and is treated as functional colour-coding. All new UI chrome — tracks, badges, active states — uses teal, orange, or neutral warm tones.

```css
/* Panel shell */
--panel-width:          440px;
--panel-bg:             #ffffff;
--panel-border:         #E5E3DF;
--panel-shadow:         -12px 0 40px rgba(0, 0, 0, 0.09);

/* Track cards */
--track-it-bg:          #CCFBF1;   /* Sana accent-teal-light */
--track-it-border:      #99F6E4;
--track-it-label:       #0D9488;   /* teal-600, readable on light teal bg */
--track-biz-bg:         #F0F2F5;   /* biz.light */
--track-biz-border:     #DEDFE3;   /* biz.border */
--track-biz-label:      #94A3B8;   /* biz.DEFAULT */

/* Jira link badge — neutral warm, no blue */
--jira-badge-bg:        #F5F3F0;
--jira-badge-border:    #E5E5E3;
--jira-badge-text:      #4B5563;

/* Active bar/row — teal, not blue */
--active-bar-outline:   #0ED3CF;   /* Sana --accent-teal */
--active-row-bg:        rgba(14, 211, 207, 0.06);

/* Status badges — Sana status system */
--status-inprog-bg:     #FEF3C7;
--status-inprog-text:   #92400E;
--status-todo-bg:       #F5F3F0;
--status-todo-text:     #6B7280;
--status-done-bg:       #D1FAE5;
--status-done-text:     #065F46;
--status-blocked-bg:    #FEE2E2;
--status-blocked-text:  #991B1B;
--assignee-row-bg:      rgba(255, 255, 255, 0.8);

/* Stepper */
--stepper-border:       #D1D5DB;
--stepper-hover-bg:     #F3F4F6;

/* Allocation tiers — use util.* Tailwind tokens */
--alloc-free-bg:        #F5F8FC;   /* util.bench — zero or trivial load */
--alloc-free-border:    #DEDFE3;   /* biz.border */
--alloc-free-text:      #16A34A;   /* util.healthy */
--alloc-ok-bg:          #fffbeb;   /* --whatif-bg (same amber light, no Tailwind key — use CSS var) */
--alloc-ok-border:      #fde68a;
--alloc-ok-text:        #D97706;   /* util.near */
--alloc-high-bg:        #fff4e5;   /* --warning-light */
--alloc-high-border:    #fcd34d;
--alloc-high-text:      #D97706;   /* util.near */
--alloc-over-bg:        #fee4e2;   /* --danger-light */
--alloc-over-border:    #fca5a5;
--alloc-over-text:      #DC2626;   /* util.over */

/* Typography */
--font-section-label:   10.5px;
--font-item-title:      15px;
--font-assignee-name:   11.5px;
--font-stepper-val:     12px;
```

---

## 9. Interactions Summary

| Trigger | Result |
|---|---|
| Click bar or row label | Panel slides in; bar gets teal outline; canvas compresses right |
| Click different bar/row | Panel re-renders for new item without closing |
| Press Escape | Panel closes; canvas expands back |
| Click ✕ in header | Panel closes; canvas expands back |
| Click stepper `−` / `+` | `daysPerSprint` updates; effort pill updates; allocation grid pulses |
| Click `✕` on assignee row | Row fades + slides out; person removed from state; effort pill + grid update |
| Click `+ Add person` | Picker expands inline in track card; other picker closes if open |
| Type in picker search | List filters in real time by name and role |
| Click person in picker | Person added at 2d default; assignee row renders; picker stays open |
| Click `Cancel` on picker | Picker collapses; label returns to `+ Add person` |
| Click `🔓 Unlock` | `unlockedInScenario` set to true; item renders dashed; button disappears |
| Click `↩ Backlog` | Item removed from `plannerLayout`; panel closes |
| Click `Save changes` | `updatePlannerLayout()` called; button flashes `"Saved"` |

---

## 10. Component & File Scope

### New file

| File | Purpose |
|---|---|
| `frontend/src/components/planner/AssignPanel.tsx` | The entire slide-out panel — header, allocation grid, assignee tracks, inline picker, footer |

This **replaces** `AssignPopover.tsx` from the original spec. The popover is not built.

### Modified files

| File | Change |
|---|---|
| `frontend/src/components/planner/PlannerTimeline.tsx` | Replace bar `onClick` → `AssignPanel` open handler. Remove drag-person-onto-bar gesture. Add canvas `panel-open` class toggle. Add active bar/row highlight logic. |
| `frontend/src/components/planner/PlannerBacklog.tsx` | Remove person cards from the backlog sidebar. Backlog contains **work items only**. Persons live in the capacity panel and the assignment panel. |
| `frontend/src/stores/actions.ts` | Ensure `updatePlannerLayout()`, `addPlannerAssignment()`, `removePlannerItem()`, and `unlockPlannerItem()` exist (already specified in main scenario planner spec). |

### Unchanged files

| File | Reason |
|---|---|
| `utils/capacity.ts` | Allocation impact computation reuses `calculateCapacity()` as-is |
| `utils/staffing.ts` | `scoreMember()` called as-is for fit badges; panel degrades gracefully if not present |
| `components/planner/PlannerCapacity.tsx` | Capacity panel is unaffected; it continues to show team-level allocation |

---

## 11. What Changes vs Previous Spec

The original `scenario-planner-final-design.md` specified an `AssignPopover` triggered by clicking a bar, with a floating popover anchored to the bar position. That approach is **replaced** by this spec for the following reasons:

1. **No z-index conflict** — the popover required a secondary floating picker for adding people, creating a three-layer z-index stack (gantt → popover → picker). The slide-out has one surface.
2. **Space for richer data** — the allocation impact grid (per-sprint load with overload warnings) does not fit in a 320–340px popover without heavy scrolling. The 440px panel has room.
3. **Canvas remains readable** — the panel compresses the gantt rather than floating over it, so the PM can see bar positions and capacity data while editing assignments.
4. **One interaction model for drag** — removing drag-person-onto-bar eliminates the gesture collision where drag meant both "move bar" and "assign person" in the same canvas.

### Drag-person-onto-bar gesture
This gesture is **removed from Timeline mode**. The backlog sidebar in Timeline mode contains work items only — no person cards. All person assignment happens through the Assignment Panel.

Board mode is unaffected — drag-person-onto-project remains the primary interaction there.

---

## Reference

A working HTML prototype of this panel exists at `assign-slideout-v1.html`. All spacing, colour, animation timing, and interaction details in this spec were validated against that prototype. When in doubt, match the prototype.
