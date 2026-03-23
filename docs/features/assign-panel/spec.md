# Assignment Panel — Scenario Planner / Timeline Mode
## Product Specification for Implementation

**Date:** 2026-03-20
**Version:** 2.0 — supersedes all previous AssignPanel / AssignPopover specs
**Status:** Approved
**Author:** Dennis Simon / AI-assisted design session
**Reference prototype:** `assign-panel-v2.html`

---

## Overview

The **Assignment Panel** is a 440px fixed slide-out drawer on the right side of the Scenario Planner's Timeline view. It opens when the PM clicks any bar or row label, and is the single place for viewing and editing who is assigned to a work item and how much effort they are spending per sprint.

**What this is not:**
- Not a popover anchored to the bar
- Not a modal — the gantt stays readable while the panel is open
- Not a place to move items to the backlog (removed — too easily confused with a back button)
- Not a place to lock or unlock items (removed — adds mental model overhead with no clear value in a scenario sandbox)

---

## Table of Contents

1. [Trigger & Dismissal](#1-trigger--dismissal)
2. [Layout & Sizing](#2-layout--sizing)
3. [Panel Header](#3-panel-header)
4. [Allocation Impact Section](#4-allocation-impact-section)
5. [Assignees Section](#5-assignees-section)
6. [Inline Person Picker](#6-inline-person-picker)
7. [Panel Footer](#7-panel-footer)
8. [Color Tokens](#8-color-tokens)
9. [Interactions Summary](#9-interactions-summary)
10. [Component & File Scope](#10-component--file-scope)
11. [What Changed vs v1](#11-what-changed-vs-v1)

---

## 1. Trigger & Dismissal

### Opening

The panel opens when the PM clicks:
- Any **bar** in the gantt (Epic, Feature, Story, UAT, Hypercare)
- Any **row label** in the label column

Single left-click only. No right-click menu, no hover required.

Clicking a bar or label while the panel is already open for a **different item** re-renders the panel for the new item immediately — no close-then-open animation, no flicker.

### Active state on the gantt

While the panel is open for an item:
- The bar gets `outline: 2px solid #0089DD; outline-offset: 2px` (Mileway primary blue — `var(--color-primary)`)
- The row background becomes `var(--primary-subtle)` = `#f3f9fd`
- Both reset when the panel closes

### Canvas compression

When the panel opens the gantt canvas shifts left so bars stay readable:

```css
.planner-canvas {
  transition: padding-right 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.planner-canvas.assign-panel-open {
  padding-right: 440px;
}
```

The capacity heatmap below the gantt compresses with the canvas. The panel does **not** overlap the canvas or the heatmap.

### Dismissal

Panel closes on:
- Clicking the **✕** button in the panel header
- Pressing **Escape**
- Scenario or mode change (e.g. switching Board ↔ Timeline)
- The item disappearing (e.g. moved to backlog via a gantt context action)

No backdrop overlay. The PM should be able to read the gantt and heatmap while the panel is open.

---

## 2. Layout & Sizing

```
┌─ Canvas (compresses when panel open) ───┐  ┌─ Assignment Panel (440px) ──────┐
│  Sprint headers                          │  │  Header — sticky                │
│  Gantt rows (bars + labels)              │  │  ───────────────────────────    │
│                                          │  │  Body — scrolls:                │
│  ──── Capacity heatmap ────────────────  │  │    Allocation impact             │
│  Erik V.  80%  65%  112%  40%  ...      │  │    Assignees (IT then BIZ)      │
└──────────────────────────────────────────┘  │  ───────────────────────────    │
                                              │  Footer — sticky                │
                                              └─────────────────────────────────┘
```

**Panel shell:**

| Property | Value |
|---|---|
| Width | `440px` fixed |
| Position | `fixed; top: 0; right: 0; bottom: 0` |
| Background | `var(--color-surface)` = `#FFFFFF` |
| Left border | `1px solid var(--color-border)` = `#DEDFE3` |
| Box shadow | `-12px 0 40px rgba(0, 0, 0, 0.09)` |
| z-index | `55` (above gantt `z-50`, below modals `z-60`) |
| Closed transform | `translateX(100%)` |
| Open transform | `translateX(0)` |
| Transition | `transform 300ms cubic-bezier(0.16, 1, 0.3, 1)` |

**Internal layout:**
- Header: `flex-shrink: 0`, not scrolled away
- Body: `flex: 1; overflow-y: auto`
- Footer: `flex-shrink: 0`, not scrolled away

---

## 3. Panel Header

Always visible at the top.

```
┌───────────────────────────────────────────────┐
│ [Feature]  [↗ VS-142]  [In Progress]        ✕ │
│ GL Reconciliation — AP Module                  │
│                                                │
│ [S7] → [S10]  8 weeks · 4 sprints    [11d/sp] │
└───────────────────────────────────────────────┘
```

Padding: `16px 20px 14px`. Border-bottom: `1px solid var(--color-border)`.

### Type pill

Use the existing app-wide type pill styles. Do not introduce new colours here:

| Type | Background | Text colour |
|---|---|---|
| Epic | `var(--primary-light)` `#e6f4fc` | `var(--color-primary)` `#0089DD` |
| Feature | `var(--primary-light)` `#e6f4fc` | `var(--color-primary)` `#0089DD` |
| Story | `#F0F2F5` (`biz.light`) | `#94A3B8` (`biz.DEFAULT`) |
| UAT | `#F3EEFF` | `#7C3AED` |
| Hypercare | `var(--success-light)` `#d8f2e7` | `var(--success)` `#1b8f5a` |

Font: `10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em`. Border-radius: `4px`. Padding: `2px 8px`.

### Jira link badge

Only rendered if `item.jiraKey` is present.

- Label: `↗ VS-142`
- Background: `var(--primary-light)` = `#e6f4fc`
- Border: `1px solid #b3dcf5`
- Text: `var(--color-primary)` = `#0089DD`
- Font: `11px; font-weight: 600`
- Border-radius: `5px`; padding: `2px 8px`
- Hover: `background: var(--primary-subtle)` = `#f3f9fd`
- On click: `window.open(jiraBaseUrl + item.jiraKey, '_blank')`

### Status badge

Pill-shaped. Use the existing semantic colour system — **not** generic Tailwind colours:

| Status | Background | Text |
|---|---|---|
| In Progress | `var(--warning-light)` `#fff4e5` | `var(--warning)` `#ff8a00` |
| To Do / Planned | `var(--color-bg)` `#F5F8FC` | `var(--color-grey)` `#94A3B8` |
| Done | `var(--success-light)` `#d8f2e7` | `var(--success)` `#1b8f5a` |
| Blocked | `var(--danger-light)` `#fee4e2` | `var(--danger)` `#d92d20` |

Font: `10.5px; font-weight: 700`. Border-radius: `9999px`. Padding: `2px 8px`.

### Item title

- Font: `15px; font-weight: 800; color: var(--color-text)` = `#1E293B`
- Line-height: `1.3`. Wraps to multiple lines if needed.
- Margin-bottom: `10px`

### Sprint range row

Flex row, `align-items: center; gap: 8px`. Sits below the title.

1. **Sprint badge** (e.g. `S7`) — `font-family: monospace; font-size: 12px; font-weight: 700; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 5px; padding: 3px 10px; color: var(--color-text)`
2. **Arrow** `→` — `color: var(--color-grey)` = `#94A3B8`
3. **Sprint badge** (e.g. `S10`) — same as above
4. **Duration label** — `"8 weeks · 4 sprints"` — `font-size: 11.5px; color: var(--color-grey)`
5. **Effort pill** — `margin-left: auto`. Format: `"11d / sprint"`. Updates live as sliders change. Style: `background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 9999px; padding: 3px 10px; font-size: 11.5px; font-weight: 700; color: var(--color-text)`. The `/ sprint` suffix uses `color: var(--color-grey); font-weight: 400`.

---

## 4. Allocation Impact Section

Shows the PM exactly how much team capacity this item is consuming per sprint, and flags overload before they commit.

Padding: `14px 20px`. Border-bottom: `1px solid #F0F2F5`.

Section label: `"ALLOCATION IMPACT"` — `font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--color-grey); margin-bottom: 10px`.

### Grid

```css
display: grid;
grid-template-columns: repeat(N, 1fr); /* N = sprints the item spans */
gap: 6px;
```

One cell per sprint the item covers. Max 6 visible — if the item spans more than 6 sprints, the grid scrolls horizontally with `overflow-x: auto`.

### Cell content

Each cell has three lines:
1. Sprint label — `S7` — `font-family: monospace; font-size: 10px; font-weight: 700; color: var(--color-grey); margin-bottom: 2px`
2. Day total — sum of `daysPerSprint` across all assignees — `font-size: 14px; font-weight: 800; line-height: 1`
3. Team percentage — `totalDays / teamAvailDays * 100` — `font-size: 10px; font-weight: 500; opacity: 0.75`

Cell style: `border-radius: 8px; padding: 8px 6px; text-align: center; border: 1px solid transparent`.

### Cell colour tiers

All colours come from existing tokens — no new hex values:

| Range | Background | Border | Text | Token refs |
|---|---|---|---|---|
| 0% | `var(--color-bg)` `#F5F8FC` | `var(--color-border)` `#DEDFE3` | `var(--color-grey)` `#94A3B8` | `util.bench` |
| 1–50% | `var(--color-bg)` `#F5F8FC` | `var(--color-border)` `#DEDFE3` | `var(--accent-green)` `#16A34A` | `util.bench` / `util.healthy` |
| 51–80% | `var(--whatif-bg)` `#fffbeb` | `#fde68a` | `var(--accent-orange)` `#D97706` | `--whatif-bg` / `util.near` |
| 81–100% | `var(--warning-light)` `#fff4e5` | `#fcd34d` | `var(--accent-orange)` `#D97706` | `--warning-light` / `util.near` |
| >100% | `var(--danger-light)` `#fee4e2` | `#fca5a5` | `var(--accent-red)` `#DC2626` | `--danger-light` / `util.over` |

> **Implementation note:** `--whatif-bg` and `--accent-orange` / `--accent-green` / `--accent-red` are defined in `frontend/src/index.css`. The amber tier background (`#fffbeb`) has no Tailwind token — use `style={{ background: 'var(--whatif-bg)' }}` or add `'near-light': '#fffbeb'` to `util` in `tailwind.config.js`.

### Overload warning

Rendered below the grid only when any cell is >100%:

```
⚠  S9: team is overloaded with this assignment
```

- `font-size: 11px; color: var(--accent-red)` = `#DC2626`
- Lists only the affected sprint labels
- Hidden completely when no sprint exceeds 100%

### Live recalculation

The grid recalculates whenever a slider value changes or an assignee is added or removed. Signal the update with a brief opacity pulse: `opacity: 0.5 → 1` over `150ms`.

---

## 5. Assignees Section

**Single-column layout.** IT assignees are listed first, BIZ assignees below, separated by a labelled divider. There are no side-by-side track cards. This ensures full name visibility regardless of name length.

Padding: `14px 20px`. Border-bottom: `1px solid #F0F2F5`.

Section label: `"ASSIGNEES"` — same style as other section labels.

### Track divider

A flex row that introduces each track group:

```
IT  ──────────────────────────────
```

- Track label: `font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em`
- IT label colour: `var(--color-primary)` = `#0089DD`
- BIZ label colour: `var(--color-grey)` = `#94A3B8`
- Line: `flex: 1; height: 1px; background: var(--color-border)` = `#DEDFE3`; `margin-left: 8px`

BIZ section gets `margin-top: 10px` to breathe from the IT group.

### Assignee row

One row per person, stacked vertically.

```
[Avatar 28px]  [Name / Role]  [──── slider 130px ────]  [✕]
```

Row style: `display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; border: 1px solid #F0F2F5; background: var(--color-bg)` = `#F5F8FC`. Margin-bottom: `6px`. On hover: `border-color: var(--color-border)` = `#DEDFE3`.

**Avatar:** 28×28px circle, `font-size: 11px; font-weight: 700; color: #fff`. Use the same per-person colour as elsewhere in the app (sourced from `TeamMember` or `BusinessContact` colour assignment).

**Name block:** `flex: 1; min-width: 0; overflow: hidden`
- Name: `font-size: 12.5px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
- Role: `font-size: 10.5px; color: var(--color-grey); margin-top: 1px`

**Slider block:** `width: 130px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px`

**Remove button:** `width: 22px; height: 22px; border-radius: 5px; border: none; background: none; color: var(--color-border); font-size: 12px; cursor: pointer`. On hover: `background: var(--danger-light)` = `#fee4e2`; `color: var(--danger)` = `#d92d20`.

**Remove animation:** `opacity: 0; transform: translateX(8px)` over `180ms`, then remove from DOM. Effort pill and allocation grid update immediately after.

### 5.1 Days-per-sprint slider

Replaces the previous `+` / `−` stepper. A horizontal range input is more natural for "how many days out of 10" than tapping a button repeatedly.

```
Days / sprint          4d
[●────────────────────]
```

- **Label row** (above the track): `font-size: 10.5px; color: var(--color-grey)` on the left; current value `"4d"` on the right in `font-size: 12px; font-weight: 700; color: var(--color-text)`. The `d` suffix is `color: var(--color-grey); font-weight: 400`.
- **Range input:** `min="1" max="10"`, `width: 100%; height: 4px; border-radius: 2px`
- **Track fill:** gradient from `var(--color-primary)` `#0089DD` (0 → current %) to `var(--color-border)` `#DEDFE3` (current % → 100%). Update via CSS custom property `--pct` on the element: `background: linear-gradient(to right, var(--color-primary) var(--pct), var(--color-border) var(--pct))`
- **Thumb:** `width: 14px; height: 14px; border-radius: 50%; background: var(--color-primary); border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,137,221,0.35)`. Scale to `1.2` on hover.
- **Default value for new assignees:** `2` (days)
- **Minimum:** `1`. **Maximum:** `10`. (Future: cap at person's available days per sprint.)
- **On input:** update the value display, recompute effort pill total, pulse allocation grid.

```css
/* Custom slider — apply to input[type=range] inside .assignee-row */
input[type=range] {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    var(--color-primary) var(--pct, 11%),
    var(--color-border) var(--pct, 11%)
  );
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 137, 221, 0.35);
  cursor: pointer;
  transition: transform 100ms;
}
input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
```

---

## 6. Inline Person Picker

Clicking `+ Add IT person` or `+ Add BIZ person` expands a picker **inline below the button** within the same panel body. No floating layer, no second z-index surface.

### Add person button

```
+ Add IT person        (dashed border, blue)
+ Add BIZ person       (dashed border, grey)
```

IT button:
- `border: 1px dashed #b3dcf5; color: var(--color-primary); background: none; border-radius: 8px; padding: 7px 10px; width: 100%; font-size: 12px; font-weight: 600`
- Hover: `background: var(--primary-light)` = `#e6f4fc`; `border-style: solid`

BIZ button:
- Same dimensions. `border-color: var(--color-border)` = `#DEDFE3`; `color: var(--color-grey)` = `#94A3B8`
- Hover: `background: var(--color-bg)` = `#F5F8FC`; `border-color: var(--color-grey)`

While picker is open the button label changes to **"Cancel"**. Clicking it again collapses the picker.

Only one picker (IT or BIZ) can be open at a time. Opening one closes the other.

### Expand animation

```css
.inline-picker {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms;
}
.inline-picker.open {
  max-height: 260px;
  opacity: 1;
}
```

Focus the search input automatically after the animation starts (`setTimeout 220ms`).

### Search input

- `width: 100%; padding: 7px 10px 7px 30px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 12px; background: var(--color-bg)` with a 13px search icon SVG at `9px center`
- Focus: `border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(0,137,221,0.10); background: #fff`
- Filters in real time by `name` and `role`

### Person list

`max-height: 180px; overflow-y: auto`. Each row:

```
[Avatar 26px]  [Name]          [Fit badge]
               [Role]          [Xd free]
```

Row: `display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: 8px; border: 1px solid transparent; cursor: pointer`. Hover: `background: var(--color-bg); border-color: var(--color-border)`.

**Sort order:** Good fit → Partial → no availability (dimmed, `pointer-events: none`, `opacity: 0.5`). People already assigned to this item are excluded entirely.

**"No availability" divider:** `font-size: 9.5px; font-weight: 700; color: var(--color-border); text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 10px 3px`.

**Fit badges** (from `scoreMember()` in `utils/staffing.ts`):

| Fit | Background | Text |
|---|---|---|
| Good | `var(--success-light)` `#d8f2e7` | `var(--success)` `#1b8f5a` |
| Partial | `var(--warning-light)` `#fff4e5` | `#92400E` |
| Over / — | `var(--color-bg)` `#F5F8FC` | `var(--color-grey)` `#94A3B8` |

Font: `9px; font-weight: 700`. Padding: `2px 7px`. Border-radius: `4px`.

**Available days:**

| Amount | Colour |
|---|---|
| > 3d | `var(--accent-green)` `#16A34A` |
| 1–3d | `var(--accent-orange)` `#D97706` |
| 0d (shows `—`) | `var(--color-border)` `#DEDFE3` |

Font: `10.5px; font-weight: 600`.

### On selecting a person

1. Person added to assignee list at `daysPerSprint: 2` (slider default)
2. New assignee row animates in: `opacity: 0; transform: translateY(-4px)` → `opacity: 1; transform: translateY(0)` over `160ms`
3. Picker list re-renders excluding the added person
4. **Picker stays open** — PM can add another person without re-clicking
5. Effort pill and allocation grid update immediately

### Graceful degradation

If `utils/staffing.ts` is not present: sort by available days descending, no fit badges. Picker is fully functional.

---

## 7. Panel Footer

Sticky at the bottom. One button only.

```
[        Save changes        ]
```

Padding: `14px 20px`. Border-top: `1px solid var(--color-border)`. Background: `var(--color-surface)`.

### Save changes button

- Full width: `width: 100%`
- Background: `var(--color-primary)` = `#0089DD`
- Hover: `var(--primary-hover)` = `#006BB5`
- Text: `#fff; font-size: 12px; font-weight: 700`
- Border-radius: `7px`; padding: `8px 18px`; border: none
- **Disabled state** (no changes from last save): `opacity: 0.45; cursor: not-allowed`
- **On click:** calls `updatePlannerLayout()` via parent callback → brief label change to `"Saved ✓"` for `1200ms` → reverts to `"Save changes"` → button returns to disabled until next change

---

## 8. Color Tokens

All values come from existing variables in `frontend/src/index.css` or tokens in `frontend/tailwind.config.js`. **No new hex values are introduced.**

```css
/* ── Panel shell ──────────────────────────────────── */
--panel-width:            440px;
/* background */          var(--color-surface)       /* #FFFFFF */
/* left border */         var(--color-border)        /* #DEDFE3 */
/* shadow */              -12px 0 40px rgba(0,0,0,0.09)

/* ── Active bar / row ─────────────────────────────── */
/* bar outline */         var(--color-primary)       /* #0089DD */
/* row background */      var(--primary-subtle)      /* #f3f9fd */

/* ── IT track label ───────────────────────────────── */
/* label text */          var(--color-primary)       /* #0089DD */
/* no background card — rows use var(--color-bg) */

/* ── BIZ track label ──────────────────────────────── */
/* label text */          biz.DEFAULT                /* #94A3B8 */
/* no background card — rows use var(--color-bg) */

/* ── Assignee row ─────────────────────────────────── */
/* background */          var(--color-bg)            /* #F5F8FC  (= util.bench) */
/* border */              #F0F2F5                    /* biz.light — subtler than color-border */
/* hover border */        var(--color-border)        /* #DEDFE3 */

/* ── Slider ───────────────────────────────────────── */
/* fill / thumb */        var(--color-primary)       /* #0089DD */
/* empty track */         var(--color-border)        /* #DEDFE3 */

/* ── Add person button (IT) ───────────────────────── */
/* border */              #b3dcf5                    /* primary-light darkened */
/* text */                var(--color-primary)       /* #0089DD */
/* hover bg */            var(--primary-light)       /* #e6f4fc */

/* ── Add person button (BIZ) ──────────────────────── */
/* border */              var(--color-border)        /* #DEDFE3 */
/* text */                biz.DEFAULT                /* #94A3B8 */
/* hover bg */            var(--color-bg)            /* #F5F8FC */

/* ── Picker search focus ──────────────────────────── */
/* border */              var(--color-primary)       /* #0089DD */
/* glow */                rgba(0, 137, 221, 0.10)

/* ── Jira link badge ──────────────────────────────── */
/* background */          var(--primary-light)       /* #e6f4fc */
/* border */              #b3dcf5
/* text */                var(--color-primary)       /* #0089DD */
/* hover bg */            var(--primary-subtle)      /* #f3f9fd */

/* ── Status badges ────────────────────────────────── */
/* In Progress bg */      var(--warning-light)       /* #fff4e5 */
/* In Progress text */    var(--warning)             /* #ff8a00 */
/* To Do bg */            var(--color-bg)            /* #F5F8FC */
/* To Do text */          var(--color-grey)          /* #94A3B8 */
/* Done bg */             var(--success-light)       /* #d8f2e7 */
/* Done text */           var(--success)             /* #1b8f5a */
/* Blocked bg */          var(--danger-light)        /* #fee4e2 */
/* Blocked text */        var(--danger)              /* #d92d20 */

/* ── Allocation tiers ─────────────────────────────── */
/* 0% bg */               var(--color-bg)            /* #F5F8FC  util.bench */
/* 0% text */             var(--color-grey)          /* #94A3B8 */
/* 1–50% bg */            var(--color-bg)            /* #F5F8FC */
/* 1–50% text */          var(--accent-green)        /* #16A34A  util.healthy */
/* 51–80% bg */           var(--whatif-bg)           /* #fffbeb  ⚠ no Tailwind key, use CSS var */
/* 51–80% text */         var(--accent-orange)       /* #D97706  util.near */
/* 81–100% bg */          var(--warning-light)       /* #fff4e5 */
/* 81–100% text */        var(--accent-orange)       /* #D97706  util.near */
/* >100% bg */            var(--danger-light)        /* #fee4e2 */
/* >100% text */          var(--accent-red)          /* #DC2626  util.over */
/* overload warn text */  var(--accent-red)          /* #DC2626 */

/* ── Typography ───────────────────────────────────── */
/* primary text */        var(--color-text)          /* #1E293B */
/* secondary text */      var(--color-grey)          /* #94A3B8 */
/* section labels */      var(--color-grey)          /* #94A3B8 */

/* ── Save button ──────────────────────────────────── */
/* background */          var(--color-primary)       /* #0089DD */
/* hover */               var(--primary-hover)       /* #006BB5 */
/* text */                #FFFFFF

/* ── Remove button hover ──────────────────────────── */
/* background */          var(--danger-light)        /* #fee4e2 */
/* icon */                var(--danger)              /* #d92d20 */
```

---

## 9. Interactions Summary

| Trigger | Result |
|---|---|
| Click bar or row label | Panel slides in; bar gets `--color-primary` outline; row gets `--primary-subtle` bg; canvas compresses |
| Click different bar/row | Panel re-renders for new item; no close animation |
| Press Escape | Panel closes; canvas expands; active states clear |
| Click ✕ in header | Panel closes; canvas expands; active states clear |
| Drag slider | `daysPerSprint` updates live; slider fill updates; effort pill updates; allocation grid pulses |
| Click ✕ on assignee | Row fades + slides right over 180ms; person removed; effort pill + grid update |
| Click `+ Add IT/BIZ person` | Picker expands inline; other picker closes if open; button label → "Cancel" |
| Type in picker search | List filters in real time by name and role |
| Click person in picker | Person added at 2d; row animates in; picker stays open; effort pill + grid update |
| Click "Cancel" on picker | Picker collapses; label returns to "Add IT/BIZ person" |
| Click `Save changes` | `updatePlannerLayout()` called; button → "Saved ✓" for 1200ms; button disabled until next change |
| Scenario or mode change | Panel closes silently |

---

## 10. Component & File Scope

### Modified file (primary)

`frontend/src/components/planner/AssignPanel.tsx`

This file already exists from v1. The changes required:

| Area | Change |
|---|---|
| Track layout | Two-column grid → single column with IT/BIZ section dividers |
| Effort control | `+` / `−` stepper buttons → `<input type="range">` slider with live label |
| Footer | Remove "Unlock" button entirely. Remove "↩ Backlog" button entirely. Save is the only footer action, full width. |
| Lock badge | Remove `🔒` badge from header. Remove all `item.locked` / `unlockedInScenario` references. |
| Active bar colour | Update from previous teal outline to `var(--color-primary)` `#0089DD` |
| Active row colour | Update from previous teal tint to `var(--primary-subtle)` `#f3f9fd` |
| IT track card | Remove coloured card background. IT section is a plain divider label, not a coloured card. |
| BIZ track card | Same — remove coloured card. BIZ section is a plain divider label. |
| All colour values | Audit every hardcoded hex; replace with the appropriate CSS variable from `index.css` or Tailwind token. See §8. |

### Other files — no structural changes needed

| File | Note |
|---|---|
| `PlannerTimeline.tsx` | Update active bar `outline` colour to `var(--color-primary)` and active row bg to `var(--primary-subtle)` to match |
| `index.css` | Confirm `--whatif-bg`, `--accent-orange`, `--accent-green`, `--accent-red` are present (they should be from v1 implementation). Add `--primary-subtle: #f3f9fd` if not already there. |
| `stores/actions.ts` | No changes — `updatePlannerLayout()` already exists |
| `utils/capacity.ts` | No changes |
| `utils/staffing.ts` | Strip `console.debug` noise while in this file |

---

## 11. What Changed vs v1

| Area | v1 | v2 |
|---|---|---|
| Track layout | Two-column IT \| BIZ card grid | Single column, IT then BIZ with divider |
| Effort control | `−` / `+` stepper buttons | Horizontal range slider with live value |
| Unlock | Button in footer + lock badge in header | **Removed entirely** |
| Backlog button | Button in footer | **Removed entirely** |
| IT track background | Teal card (`#CCFBF1`) | No card — plain section divider |
| BIZ track background | Grey card (`#F0F2F5`) | No card — plain section divider |
| Active bar outline | Teal `#0ED3CF` | Mileway primary `var(--color-primary)` `#0089DD` |
| Active row background | Teal tint | `var(--primary-subtle)` `#f3f9fd` |
| Footer | Three buttons (Unlock, Backlog, Save) | One button (Save), full width |
| Save button colour | Dark `#1F2937` | `var(--color-primary)` `#0089DD` |

---

## Reference

The approved prototype is `assign-panel-v2.html`. Match it for spacing, animation timing, slider appearance, and section structure. When the spec and prototype conflict, the prototype wins on visual details; the spec wins on behaviour and token names.
