# Toolbar & Timeline Redesign

**Date:** 2026-03-20  
**Status:** Approved  
**Scope:** `ScenarioPlanner.tsx`, `ScenarioTabs.tsx`, `PlannerTimeline.tsx`

---

## Problem

In Timeline mode the scenario planner toolbar is overcrowded. With "Scenario mode", scenario dropdown, Board/Timeline tabs, Add Epic, All Teams, Labels, Epics, Quarter nav, Backlog, Team, and Save all on one row, the "Team" button falls off the right edge at common laptop widths (1280–1440px). The root cause is too many items competing for a single flex row with no overflow strategy.

---

## Goals

1. Remove redundant or low-value toolbar items so the row fits comfortably at 1280px.
2. Eliminate the quarter navigator by making the timeline auto-size to show all relevant sprints at once.
3. Move "+ Add Epic" into the timeline itself where it is more contextually appropriate.
4. Make Backlog visually lighter so action buttons (Team, Save) are the dominant affordances.

---

## Design Decisions

### 1. Toolbar Slim-Down

Remove the following items from the toolbar:

| Item | Reason |
|------|--------|
| **"⚡ Scenario mode" chip** | Redundant — users already know they are in scenario mode |
| **"+ Add Epic" button** | Moves to the Gantt header (see §3) |
| **Quarter navigator (‹ Q1 2026 ›)** | No longer needed — timeline shows all relevant sprints at once |

Simplify:

| Item | Change |
|------|--------|
| **Backlog button** | Icon-only: inbox icon (`Inbox` from lucide) + count badge, no "Backlog" text |

**Resulting toolbar layout:**

| Mode | Items |
|------|-------|
| Board | `← Back \| [Scenario ▾] + \| Board/Timeline \| [📥 n] \| [Team n] \| Save` |
| Timeline | `← Back \| [Scenario ▾] + \| Board/Timeline \| All Teams \| Labels \| Epics \| [📥 n] \| [Team n] \| Save` |

The right-side actions (Backlog icon, Team, Save) are wrapped in a `flex-shrink-0` group so they are never pushed off-screen regardless of viewport width.

---

### 2. Timeline Auto-Sizing

**Current behaviour:** `SPRINT_COUNT = 6` is hardcoded. The timeline always shows exactly 6 sprints for the selected quarter. Users navigate between quarters using the toolbar quarter navigator.

**New behaviour:**

- `SPRINT_COUNT` becomes dynamic, derived from the visible sprint window (see below).
- Sprint columns use `minWidth: MIN_SPRINT_W` (100px) and expand equally to fill available container width via `1fr` CSS grid.
- If the total sprint count × 100px exceeds the container width, the Gantt area scrolls horizontally — same `overflow-x-auto` wrapper already in place.
- The quarter navigator prop is removed from `PlannerTimeline` and the toolbar.

**Default sprint window:** 1 sprint before the current sprint + current sprint + all future sprints.

```
Visible = [currentSprintIndex - 1 ... last sprint in sprints array]
```

If the current sprint is the first sprint (index 0), the window starts at index 0.

**Bar positioning:** Bar fractions currently use `SPRINT_COUNT` as the denominator (e.g. `left / SPRINT_COUNT`, `width / SPRINT_COUNT`). This changes to `visibleSprintCount` derived from the filtered window. The `firstSprintNum` anchor (already computed from `quarterSprints[0]`) shifts to `visibleSprints[0]`. All existing percentage-based bar layout logic is preserved; only the denominator and anchor change.

**Drag resize:** `canvasRef.current.getBoundingClientRect().width / SPRINT_COUNT` at line 781 updates to use `visibleSprintCount`.

---

### 3. "+ Add Epic" Inline in Gantt Header

A persistent `+` button is placed at the **right end of the sprint header row** in `PlannerTimeline`. It is always visible (not hover-only) so it is discoverable.

- Clicking it triggers the same `onCreateEpic` callback that the toolbar button used.
- Styled as a small ghost icon button (`Plus` icon, 14px) with `hover:bg-mileway-bg` — matches the existing "edit" pencil button style in the Gantt.
- Positioned absolutely at `top-right` of the header row, or appended as the last item in the header flex row.
- Only rendered when `activeScenarioId` is set (same guard as the old toolbar button).

---

## Out of Scope

- The "All Teams" person filter, Labels select, and Epics select remain in the toolbar unchanged.
- The Board mode view is unchanged structurally; only the toolbar items above are removed.
- No changes to the Backlog drawer or Team drawer internals.
- Dark mode is deferred (no new `dark:` classes).

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/planner/ScenarioTabs.tsx` | Remove the "Scenario mode" chip (`div` with `Zap` icon, lines 57–63) |
| `frontend/src/pages/ScenarioPlanner.tsx` | Remove "+ Add Epic" button; remove quarter navigator block; change Backlog button to icon-only; wrap right-side buttons in `flex-shrink-0` group; remove `currentQuarterIndex` prop pass to `PlannerTimeline` |
| `frontend/src/components/planner/PlannerTimeline.tsx` | Replace `SPRINT_COUNT = 6` constant with dynamic `visibleSprintCount`; derive visible sprint window (1 past + current + future); add `MIN_SPRINT_W = 100` constant; update bar fraction denominator; update drag resize width calculation; add inline "+ Add Epic" button to sprint header row; remove `selectedQuarter` / `currentQuarterIndex` props |
