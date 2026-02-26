<!--
MISMATCHES: The following divergences between the original spec (Documentation/timeline-view-spec.md)
and the actual implementation were found during the 2026-02-26 audit:

1. BAR COLOURS (Epic/Feature):
   Spec:  Epic fill `rgba(168,196,245,0.15)`, border `#6090E0`. Feature fill `#A8C4F5`, border `#6090E0`.
   Code:  Epic fill `rgba(0,137,221,0.10)`, border `#0089DD`. Feature fill `#BAE0F7`, border `#0089DD`.
   → Mileway brand blue (#0089DD) is used instead of the generic blue in the spec. Intentional.

2. BIZ ASSIGNEE PANEL TINT:
   Spec:  "BIZ track — orange tint"
   Code:  Purple tint (#FAF5FF bg, #7C3AED text).
   → Purple is the consistent BIZ colour used throughout the app. Spec is outdated.

3. SPRINT FRACTION STORAGE:
   Spec:  `sprint_start` and `sprint_end` are stored as 0–1 fractions on each item.
   Code:  Items do NOT store fractions. Bar positions are computed at render time from
          `item.startDate`, `item.dueDate`, `item.sprintStartDate`, `item.sprintEndDate`,
          and sprint name lookups. The fraction formula (sprint_number / 24) is used in
          the spec for documentation purposes only.

4. TOOLBAR ITEMS:
   Spec:  "Filter pill" and "All Teams pill" in the toolbar.
   Code:  Toolbar has a Legend (Feature/Story/UAT/Hypercare colour swatches) + Expand All button.
          No filter or team selector in the current Gantt toolbar.

5. ROW EXPAND ANIMATION:
   Spec:  "Animate open with 150ms fade + slight translateY"
   Code:  No animation. Rows appear/disappear immediately on expand/collapse.

6. AVATAR DISPLAY ON BARS:
   Spec:  Avatar stacks (max 3, +N overflow) rendered inside each bar.
   Code:  Bars are plain coloured rectangles with no content inside them. No avatars on bars.
          Assignees are only visible in the slide-out panel.

7. FEATURES LIST IN SLIDE PANEL (Epics):
   Spec:  "Features list (Epics only): each feature as a row with type pill + name + status badge"
   Code:  The slide panel for Epics does NOT include a features list. It shows:
          assignees (IT + BIZ), status, sprint name, date range, story points.

8. LABEL COLUMN SEPARATOR:
   Spec:  "2px strong right border"
   Code:  Standard 1px `border-slate-200` right border (via the gantt container's own border).
-->

# Timeline View — Spec

**View type:** `timeline`
**Sidebar label:** Timeline
**Status:** ✅ Built

---

## Overview

The Timeline view is a **Gantt-style planning tool** showing Jira Epics and their nested work items (Features, Stories, Tasks, Bugs) across time. It also contains a secondary **Team capacity sub-mode**.

**Primary user:** Project Manager
**Default sub-mode:** Gantt
**Default time granularity:** Single quarter (6 sprint columns)

---

## Sub-Modes

The view has a toggle in the page header:

| Mode | Description |
|---|---|
| **Gantt** | Jira item bars on a time axis — the primary mode |
| **Team** | Team member capacity rows across quarters or sprints |

---

## Gantt Sub-Mode

### Page Header

```
Title: "Timeline"
Subtitle: "Q1–Q4 2026 · VS Finance · Mileway BV"
```

### Toolbar

**Left zone:**
- Bar colour legend: Feature / Story / UAT / Hypercare swatches with labels
- Expand All / Collapse All toggle button

**Right zone:**
- Quarter navigator (hidden in Full Year mode): `‹ Q1 2026 ›` prev/next arrows. Prev disabled at Q1, next disabled at Q4.
- View toggle: `Quarter | Full Year` segmented control

### Layout

```
[Label column — resizable, default 300px] | [Gantt area — flex-1, horizontally scrollable]
```

The label column has a drag-resize handle on its right edge (min 200px, max 600px).

---

## Time Headers

### Quarter Mode (default)

- 6 equal columns, one per sprint in the selected quarter
- Column header (height 64px):
  - Sprint name (e.g. `Sprint 3`) — bold, 12.5px
  - Date range (e.g. `2 Feb – 13 Feb`) — monospace, 10px, muted
- Current sprint column has a subtle blue tint background (`rgba(0,137,221,0.04)`)

Sprint columns are derived from **actual Jira sprint data on the work items** when available (i.e. items have `sprintStartDate`/`sprintEndDate`). Falls back to generated sprints from `Settings`.

### Full Year Mode

- 4 equal columns, one per quarter
- Column header:
  - Quarter label (e.g. `Q1 2026`) — bold
  - Sprint range below (e.g. `Sprint 1–Sprint 4`) — muted

### Grid Lines

- Sprint boundaries: dashed, `border-slate-100`
- Current sprint: light blue background fill behind all rows

### Today Line

- 2px solid `#E63946` vertical line
- Small `TODAY` label at top, `text-[9px] font-bold text-red-500 uppercase tracking-wider`
- Position calculated as `(now - vStart) / (vEnd - vStart)` — percentage of the visible window

---

## Rows

### Epic Row (level 0)

- Height: 44px (`ROW_EPIC = 44`)
- Background: white / dark:slate-900
- Hover: `bg-slate-50` with left blue accent line (via `.gantt-label-row::before`)
- Label contents: expand button + Epic summary (bold, 13px) + Jira key (monospace, 10px, muted) + "+ Phase" button

### Feature Row (level 1)

- Height: 36px (`ROW_SUB = 36`)
- Indent: `paddingLeft: 32`
- Background: `bg-slate-50/80`
- Label contents: expand button + FEATURE type chip + feature summary (12px)

### Story / Task / Bug Row (level 2)

- Height: 36px
- Indent: `paddingLeft: 48`
- Background: `bg-slate-50/80`
- Label contents: type chip (STORY / TASK / BUG) + summary (12px)

### LocalPhase Row (UAT / Hypercare)

- Height: 36px
- Indent: `paddingLeft: 32`
- Background: `bg-slate-50/80`
- Label contents: type chip (UAT or HYPERCARE) + phase name + date range (monospace) + trash icon on hover
- Rendered after all feature rows for the parent Epic

### Add-Phase Form Row

- Opens inline when the "+ Phase" button is clicked on an Epic
- Contains: type selector (uat/hypercare) + name input + start date + end date + Add + Cancel
- Submits via Enter key or Add button

---

## Bar Types

All bars are positioned absolutely within their gantt row using `left` and `width` as percentages.

| Type | Fill | Border | Height | Radius |
|---|---|---|---|---|
| Epic | `rgba(0,137,221,0.10)` | `#0089DD` 2px | 30px | 6px |
| Feature | `#BAE0F7` | `#0089DD` 1px | 22px | 5px |
| Story / Task | `#D0CCC8` | `#A09D97` 1px | 18px | 4px |
| Bug | `#FECACA` | `#EF4444` 1px | 18px | 4px |
| UAT | `#CDB0F5` | `#9B6EE2` 1px | 22px | 4px |
| Hypercare | `#90D9B8` | `#1A7A52` 1px | 22px | 4px |

**Bar hover:** `hover:brightness-90 hover:-translate-y-px`, transition 150ms

**No text labels on bars.** Bars are plain coloured rectangles. Assignee information is only visible in the slide-out panel.

**Ghost row:** Items with no dates at all show a dashed empty rectangle (`border-dashed border-slate-200`) instead of a solid bar.

---

## Bar Positioning Logic

### Date Resolution Order (per item)

1. Explicit Jira `startDate` / `dueDate` fields
2. Sprint object dates: `sprintStartDate` / `sprintEndDate` (from Jira sprint)
3. Sprint name lookup: parse `sprintName` → find matching sprint → use its dates

If neither start nor end can be resolved, the bar is hidden and a ghost placeholder is shown.

### Rollup

- **Features without own dates**: inherit span from their children (min start → max end)
- **Epics without own dates**: inherit span from their features (already rolled up)

### Layout Calculation

```
vStart, vEnd = bounds of the current view (quarter or full year)
total        = vEnd - vStart  (milliseconds)

clipLeft  = item.start < vStart
clipRight = item.end   > vEnd

dStart = clipLeft  ? vStart : item.start
dEnd   = clipRight ? vEnd   : item.end

left  = (dStart - vStart) / total  → applied as ${left * 100}%
width = (dEnd   - dStart) / total  → applied as ${width * 100}%
```

---

## Continuation Arrows

When a bar extends beyond the current viewport boundary:

- **Clip left** (bar starts before Q start): left edge flat, left-pointing triangle inside bar
- **Clip right** (bar ends after Q end): right edge flat, right-pointing triangle inside bar
- **Both**: arrows on both edges

**CSS classes:**

```css
.gantt-bar-clip-left  { border-left: none; border-top-left-radius: 0; border-bottom-left-radius: 0; }
.gantt-bar-clip-left::before  { /* left-pointing triangle */ border-right: 8px solid rgba(0,0,0,.22); }

.gantt-bar-clip-right { border-right: none; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.gantt-bar-clip-right::after  { /* right-pointing triangle */ border-left: 8px solid rgba(0,0,0,.22); }
```

**NEVER set `overflow: hidden` on gantt rows.** The pseudo-elements extend outside the bar's own bounds and will be clipped if the row has `overflow: hidden`.

---

## Slide-Out Panel

Triggered by clicking any Gantt bar or any label row.

- Slides in from right: `width: 420px`
- Backdrop: `bg-black/20 backdrop-blur-[2px]`
- Close: X button, backdrop click, or `Escape`

**Panel content:**

1. **Header**: Type chip + Jira key link + item summary
2. **Assignees**: Two-column grid — IT (blue tint `#F0F9FF`) | Business (purple tint `#FAF5FF`)
3. **Details**: Status badge, sprint name, date range, story points

---

## Expand / Collapse System

- `expandedEpics: Set<string>` — Epic `jiraKey`s currently expanded
- `expandedFeatures: Set<string>` — Feature `jiraKey`s currently expanded
- A flat `rows` array is derived from these sets — label column and gantt area render the same array in parallel

---

## Team Sub-Mode

When the **Team** toggle is selected, the view shows a capacity grid instead of the Gantt.

### Granularity Toggle (Team mode only)

Three options:
- **Quarters** — one column per quarter
- **Sprints** — one column per sprint within the selected date range
- **Dates** — one column per month

### Date Range Filter (Team mode only)

From/To quarter selectors. Defaults to current quarter → current quarter + 3.

### Row Structure

Each row is a `TeamMember`. Each cell shows:
- Progress bar: used days / total workdays, colour-coded by status
- `Xd / Yd` text
- Utilisation percentage
- Time-off indicator if applicable

### Capacity Status Colours

| Status | Colour |
|---|---|
| Normal | Green |
| Warning (>90%) | Amber |
| Overallocated (>100%) | Red |

---

## Interactions Summary

| Action | Result |
|---|---|
| Click expand chevron (Epic) | Reveals Feature rows |
| Click expand chevron (Feature) | Reveals Story/Phase rows |
| Click Expand All | Opens all levels |
| Click any bar | Opens slide-out panel |
| Click any label row | Opens slide-out panel |
| Click "+ Phase" on Epic | Opens inline phase form |
| Click trash on LocalPhase | Removes the phase (with confirmation) |
| Click ‹ or › in quarter nav | Shifts to prev/next quarter |
| Click Quarter / Full Year | Switches time granularity |
| Click Gantt / Team toggle | Switches sub-mode |
| Click backdrop or Escape | Closes slide-out panel |
| Drag label column edge | Resizes label column (200–600px) |

---

## What Is NOT in This View

- Creating or editing Jira items (use Jira directly)
- Drag-to-resize bars (future)
- Drag-to-reorder rows (future)
- BIZ assignee assignment (use Epics view)
- Inline sprint assignment changes
