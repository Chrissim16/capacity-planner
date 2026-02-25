# Timeline View — VS Finance / Mileway BV
## Product Specification for Implementation

---

## Overview

The Timeline view is a Gantt-style planning tool showing Epics and their nested work items across time. It is the second primary view in the app, alongside the Epic view. The primary user is a **Project Manager** who needs to understand at a glance what is happening this quarter, whether work is on track, and who is assigned.

The default view is a single quarter showing 6 sprint columns. A Full Year toggle reveals all 4 quarters. The PM can navigate between quarters without leaving the quarter view.

---

## Data Model

All items share the same data model as the Epic view. For the timeline, the key additional fields are:

| Field | Type | Description |
|---|---|---|
| sprint_start | number (0–1) | Full-year fraction where the item starts (0 = start of S1, 1 = end of S24) |
| sprint_end | number (0–1) | Full-year fraction where the item ends |

### Time Structure
- 4 quarters per year, 6 sprints per quarter = 24 sprints total
- Sprints are 2 weeks each
- Sprint numbers: S1–S6 (Q1), S7–S12 (Q2), S13–S18 (Q3), S19–S24 (Q4)
- Full-year fraction formula: `sprint_number / 24`

### Sprint Date Reference (2026)
```
Q1: S1 Jan 5–16  · S2 Jan 19–30  · S3 Feb 2–13  · S4 Feb 16–27  · S5 Mar 2–13   · S6 Mar 16–27
Q2: S7 Mar 30–Apr 10 · S8 Apr 13–24 · S9 Apr 27–May 8 · S10 May 11–22 · S11 May 25–Jun 5 · S12 Jun 8–19
Q3: S13 Jun 22–Jul 3 · S14 Jul 6–17 · S15 Jul 20–31  · S16 Aug 3–14 · S17 Aug 17–28 · S18 Sep 1–11
Q4: S19 Sep 14–25 · S20 Sep 28–Oct 9 · S21 Oct 12–23 · S22 Oct 26–Nov 6 · S23 Nov 9–20 · S24 Nov 23–Dec 4
```

---

## Layout & Structure

### Page Header
Identical to Epic view — sticky, same navigation tabs, same logo/breadcrumb.

### Toolbar
Two zones:

**Left zone:**
- Filter pill
- All Teams pill
- Expand All / Collapse All toggle button (label switches on click)

**Right zone:**
- Quarter navigator (hidden in Full Year mode): `‹ Q1 2026 ›` with prev/next arrow buttons. Prev disabled at Q1, Next disabled at Q4.
- View toggle: `Quarter | Full Year` segmented control

### Timeline Body
Two-column layout:

```
[Label column 300px fixed] | [Gantt area flex-1, horizontally scrollable]
```

Label column has a 2px strong right border separating it from the Gantt.

---

## Time Headers

### Quarter Mode (default)
- 6 equal columns, one per sprint
- Each column header shows:
  - Sprint label (e.g. `S3`) — bold, 12.5px
  - Date range below (e.g. `Feb 2–13`) — monospace, 10px, muted
- Current sprint column has a subtle blue tint background
- Header height: 64px

### Full Year Mode
- 4 equal columns, one per quarter
- Each column header shows:
  - Quarter label (e.g. `Q1 2026`) — bold
  - Sprint range below (e.g. `S1–S6`) — muted
- Current quarter (Q1) has subtle blue tint background

### Grid Lines
- Sprint boundaries: 1px dashed, very subtle (`rgba(0,0,0,0.06)`)
- Quarter boundaries in Full Year mode: 1px solid border color
- Current sprint/quarter: light blue background fill behind rows

### Today Line
- 2px solid red vertical line
- Small "TODAY" label at top
- Visible only when current quarter is in view (Q1 in this case)
- Position calculated from current date within the sprint

---

## Rows

### Structure
Rows in the label column and gantt area are always rendered in parallel — every label row has a corresponding gantt row at the same height. They must stay perfectly vertically aligned.

### Epic Row
- Height: 44px
- Full-width clickable (opens slide-out panel)
- Label: expand/collapse chevron + Epic name + Jira ID (muted monospace)
- Gantt: Epic bar (see Bar Types)

### Feature Row (sub-row, level 1)
- Height: 36px
- Indented 32px in label column
- Background: `surface-2`
- Label: expand/collapse chevron + FEATURE type pill + feature name
- Gantt: Feature bar

### Child Row (level 2 — Stories and Phases)
- Height: 36px
- Indented 48px in label column
- Background: `surface-2`
- Label: type pill (STORY / UAT / HYPERCARE) + item name
- Gantt: corresponding bar type

### Sub-rows visibility
- Feature rows hidden by default, revealed when Epic is expanded
- Child rows hidden by default, revealed when Feature is expanded
- Expand All button opens all levels simultaneously
- Animate open with 150ms fade + slight translateY

---

## Bar Types

All bars are positioned absolutely within their gantt row using `left` and `width` as percentages of the gantt width.

| Type | Background | Border |
|---|---|---|
| Epic | `rgba(168,196,245,0.15)` — transparent fill | `#6090E0` — 2px solid outline |
| Feature | `#A8C4F5` | `#6090E0` — 1px |
| Story | `#D0CCC8` | `#A09D97` — 1px |
| UAT | `#CDB0F5` | `#9B6EE2` — 1px |
| Hypercare | `#90D9B8` | `#1A7A52` — 1px |

**Bar heights:**
- Epic: 30px, border-radius 6px
- Feature/Story/Phase in epic row: 26px, border-radius 5px
- Feature/Story/Phase in sub-rows: 20px, border-radius 4px

**Bar contents:**
- Avatars only — no text labels on bars
- Avatar stack (max 3 visible, +N overflow): 16×16px circles
- IT avatars: semi-transparent white bg
- BIZ avatars: same treatment
- Avatars overlap by 4px (margin-left: -4px)

**Bar hover:**
- `filter: brightness(0.92)` + `translateY(-1px)`
- Transition: 150ms

---

## Continuation Arrows (critical feature)

When a bar is clipped by the current quarter boundary, it must show a visual arrow indicator so the PM knows the work continues beyond what is visible.

### Rules
- **Clip left** (bar starts before current quarter): flat left edge, arrow at leading edge
- **Clip right** (bar ends after current quarter): flat right edge, arrow at trailing edge
- **Both** (bar spans across entire current quarter): arrows on both edges
- **Fully outside** current quarter: bar hidden (`display: none`)
- Not applicable in Full Year mode — bars always show their full extent

### Implementation
Apply CSS classes to the bar element:
- `.clip-left` — removes left border, removes left border-radius
- `.clip-right` — removes right border, removes right border-radius

Arrow indicators are CSS `::before` (left) and `::after` (right) pseudo-elements:
- Rendered as CSS triangles (border trick) **inside** the bar
- Position: 3px from the clipped edge, vertically centred
- Size: 6px top/bottom, 8px pointing direction
- Colour: `rgba(0,0,0,0.22)` — works across all bar colours without needing per-type colour rules
- `pointer-events: none` — does not interfere with click

**Critical:** Do NOT set `overflow: hidden` on gantt rows — this will clip pseudo-elements. Rows must allow overflow.

```css
.bar.clip-left::before {
  content: '';
  position: absolute;
  left: 3px; top: 50%;
  transform: translateY(-50%);
  width: 0; height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 8px solid rgba(0,0,0,.22);
  pointer-events: none;
  z-index: 7;
}

.bar.clip-right::after {
  content: '';
  position: absolute;
  right: 3px; top: 50%;
  transform: translateY(-50%);
  width: 0; height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 8px solid rgba(0,0,0,.22);
  pointer-events: none;
  z-index: 7;
}
```

---

## Bar Positioning Logic

### Full Year Mode
```
left  = item.sprint_start          (as percentage of gantt width)
width = item.sprint_end - item.sprint_start
```

### Quarter Mode
Quarter bounds in full-year fractions:
```
qStart = currentQuarterIndex / 4
qEnd   = (currentQuarterIndex + 1) / 4
```

Bar layout:
```
if (item.sprint_end <= qStart || item.sprint_start >= qEnd) → hidden

clipLeft  = item.sprint_start < qStart
clipRight = item.sprint_end   > qEnd

displayStart = max(item.sprint_start, qStart)
displayEnd   = min(item.sprint_end,   qEnd)

left  = (displayStart - qStart) / (qEnd - qStart)
width = (displayEnd   - qStart) / (qEnd - qStart) - left
```

When switching quarters or views, update bar `left`, `width`, and `clip-left`/`clip-right` classes without re-rendering the DOM — update styles and classes in place.

---

## Slide-Out Panel

Triggered by clicking any bar or any label row. Same panel used for all item types.

### Behaviour
- Slides in from the right, 420px wide
- Backdrop overlay with `backdrop-filter: blur(2px)`
- Close via: X button, clicking overlay, or pressing Escape

### Panel Content

**Header:**
- Type pill + Jira ID (if applicable)
- Item name

**Assignees section:**
- Two-column grid: IT track (blue tint) | BIZ track (orange tint)
- Each track shows avatar + name + role for each assignee
- Unassigned shown as muted text

**Details section:**
- 2-column meta grid
- Status badge
- Sprint range (e.g. S1 – S4)
- Date range (e.g. Jan 5 – Mar 27) — spans full width
- Duration (phases only)
- Jira ID (Jira items only)

**Features list (Epics only):**
- Each feature as a row: type pill + name + status badge

---

## Visual Design Tokens

Same tokens as Epic view spec. Key additions for timeline:

```
/* Bar colors */
--bar-feature:         #A8C4F5
--bar-feature-border:  #6090E0
--bar-story:           #D0CCC8
--bar-story-border:    #A09D97
--bar-uat:             #CDB0F5
--bar-uat-border:      #9B6EE2
--bar-hypercare:       #90D9B8
--bar-hypercare-border:#1A7A52
--bar-epic-fill:       rgba(168,196,245,0.15)
--bar-epic-border:     #6090E0

/* Today line */
--today-line: #E63946

/* Current sprint highlight */
--current-sprint-bg: rgba(37,88,201,0.04)
```

---

## Grid Architecture

Use the same CSS variable approach as the Epic view for the time column grid:

```css
/* Quarter mode */
.time-headers.qtr-s { grid-template-columns: repeat(6, 1fr); }
.time-grid.qtr-s    { grid-template-columns: repeat(6, 1fr); }

/* Year mode */
.time-headers.year-q { grid-template-columns: repeat(4, 1fr); }
.time-grid.year-q    { grid-template-columns: repeat(4, 1fr); }
```

The gantt row bars use `position: absolute` with percentage-based `left` and `width`, not CSS grid — this allows arbitrary bar positioning that isn't constrained to column boundaries.

---

## Interactions Summary

| Action | Result |
|---|---|
| Click expand chevron on Epic | Reveals Feature rows below |
| Click expand chevron on Feature | Reveals Story/Phase rows below |
| Click Expand All | Opens all levels, button label → Collapse All |
| Click Collapse All | Closes all levels, button label → Expand All |
| Click any bar | Opens slide-out panel |
| Click any label row | Opens slide-out panel |
| Click ‹ or › in quarter nav | Shifts to prev/next quarter, bars reposition |
| Click Quarter / Full Year toggle | Switches time granularity, bars reposition |
| Click overlay or press Escape | Closes slide-out panel |

---

## What Is NOT in Scope for This View

- Drag-to-resize bars (future)
- Drag-to-reorder rows (future)
- Creating or editing items from this view (use Epic view)
- Jira sync / webhook logic (backend concern)
- Authentication

---

## Reference Prototype

A working HTML prototype of this view exists and should be used as the visual reference for all spacing, colour, and interaction decisions. All design decisions in this spec were validated against that prototype.

**To verify continuation arrows:** expand all rows, navigate to Q2 — epics spanning Q1–Q2 show a left-pointing arrow. Navigate to Q3 for epics spanning multiple quarters showing arrows on both edges.
