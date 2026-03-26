# Timeline Quarter / Sprint View — Design

**Date:** 2026-03-26  
**Feature:** Add a Quarter view to the Scenario Planner timeline, with a two-row header in Sprint view (Quarter above, Sprint below) and a toggle to switch between modes.

---

## Problem

The Scenario Planner timeline currently shows only sprint-level columns. There is no way to zoom out to see work items at a quarter granularity, making it hard to reason about delivery across Q1/Q2/Q3 at a glance.

---

## Goals

- **Sprint view (enhanced):** Two-row header — a Quarter row on top (Q1 2026 spanning its sprints), the existing Sprint row below.
- **Quarter view:** A single row of quarter columns. Bars are proportionally positioned using the same `startSprint`/`spanSprints` data, scaled to quarter column widths.
- A `Sprint | Quarter` toggle to switch between modes.

---

## Approach

Extend `PlannerTimeline.tsx` with a `timelineViewMode` state and a unified `TimelineHeader` component. No new files required.

**Key insight:** `barFracs` already returns percentage-of-total-width values. Since quarter columns are also proportional widths, bar geometry works identically in both views — no new geometry logic is needed.

---

## State & Data Model

### New Zustand store field (`plannerStore.ts`)

```ts
timelineViewMode: 'sprint' | 'quarter'   // default: 'sprint'
setTimelineViewMode: (mode: 'sprint' | 'quarter') => void
```

State persists across Board ↔ Timeline tab switches (same store).

### Derived: `visibleQuarters`

Computed from `visibleSprints` (the existing rolling window). Group consecutive sprints by `sprint.quarter`:

```ts
type VisibleQuarter = {
  label: string;        // e.g. "Q1 2026"
  startIdx: number;     // index into visibleSprints
  sprintCount: number;  // how many sprints this quarter spans in the visible window
};
```

Width of each quarter column = `(sprintCount / totalVisibleSprints) * 100%`.

No new database fields or API calls required.

---

## Header Component: `TimelineHeader`

Replaces the existing `SprintHeaders` function.

### Sprint view (two rows)

```
┌──────────────────────────────────────────────────────────────┐
│  Q1 2026 (spans 3 cols)         │  Q2 2026 (spans 4 cols)   │  ← 24px row, bg-mileway-50
├────────────┬────────────┬────────────┬────────────┬──────────┤
│  Sprint 11 │  Sprint 12 │  Sprint 13 │  Sprint 14 │  ...     │  ← unchanged sprint row
│  Feb 3–14  │  Feb 17–28 │  Mar 3–14  │  Mar 17–28 │          │
└────────────┴────────────┴────────────┴────────────┴──────────┘
```

- Quarter row height: `QUARTER_ROW_H = 24px`.
- Sprint row: unchanged (same height, "Current" pill, date range).
- Total header height in sprint view: `SPRINT_HEADER_H + QUARTER_ROW_H`.

### Quarter view (one row)

```
┌────────────────────┬────────────────────┬────────────────────┐
│      Q1 2026       │      Q2 2026       │      Q3 2026       │
│    (6 sprints)     │    (6 sprints)     │    (6 sprints)     │
└────────────────────┴────────────────────┴────────────────────┘
```

- One row. Each column = one quarter.
- Sub-label: `(N sprints)`.
- Current quarter gets a thin mileway-blue top-border accent (same visual language as the "Current" sprint pill).
- `MIN_QUARTER_W = 160px`.

---

## Bar Geometry in Quarter View

`barFracs` is unchanged — it already returns `left` and `width` as fractions of total timeline width. Since quarter columns are proportional to sprint count, bars overlay the quarter grid correctly with no geometry changes.

**Example:**

```
item: startSprint=12, spanSprints=4
visibleSprints: [S11, S12, S13, S14, S15, S16]  → 6 total

left  = (12 - 11) / 6 = 16.7%
right = (12 - 11 + 4) / 6 = 83.3%
```

Same formula, same result, regardless of whether Q or Sprint headers are rendered.

### Drag-and-drop in quarter view

Drop targeting stays sprint-based. `dragOverNum` highlights the quarter column that contains the hovered sprint, not an individual sprint column.

---

## Toggle UI & Placement

**Component:** Small segmented pill — same visual pattern as the Board | Timeline mode toggle.  
**Segments:** `Sprint` | `Quarter`  
**Placement:** Right-aligned inside the label column header (top-left fixed cell of the timeline), next to the existing Expand all / Collapse all controls.

```
┌──────────────────────────────────┬──────────────────────────────────────────┐
│  ▶ Expand all   [Sprint|Quarter] │  Q1 2026       │  Q2 2026       │  ...   │
```

Reads/writes `timelineViewMode` from Zustand — no prop drilling.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/store/plannerStore.ts` | Add `timelineViewMode` + `setTimelineViewMode` |
| `frontend/src/components/planner/PlannerTimeline.tsx` | Replace `SprintHeaders` → `TimelineHeader`; add `visibleQuarters` memo; update header height constant; wire toggle to store |

---

## Out of Scope

- Editing (drag to resize/move) items while in Quarter view — drag-and-drop snaps to sprints in both views.
- Persisting view mode to the database.
- Quarter view on the Capacity panel (still driven by `selectedQuarter` dropdown, unchanged).
