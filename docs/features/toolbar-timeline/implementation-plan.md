# Toolbar & Timeline Redesign — Implementation Plan

**Design doc:** `docs/plans/2026-03-20-toolbar-timeline-redesign.md`  
**Date:** 2026-03-20

---

## Story 1 — Remove "Scenario mode" chip from toolbar

**File:** `frontend/src/components/planner/ScenarioTabs.tsx`

Remove the `<div>` block at lines 57–63 that renders the `⚡ Scenario mode` chip:

```tsx
// DELETE this block:
<div
  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-mileway-bg text-mileway-grey text-xs font-medium select-none flex-shrink-0"
  aria-label="Scenario mode"
>
  <Zap size={12} aria-hidden="true" />
  Scenario mode
</div>
```

Remove the unused `Zap` import if it is no longer referenced elsewhere in the file.

**Acceptance:** Toolbar no longer shows the "Scenario mode" chip. Scenario dropdown and `+` button remain.

---

## Story 2 — Backlog button becomes icon-only

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

Replace the Backlog `<button>` (lines 961–978) with an icon-only variant:

- Use `Inbox` icon from lucide-react (14px) instead of the text "Backlog"
- Keep the same active/inactive colour classes
- Keep the count badge unchanged
- Add `title="Backlog (B)"` for tooltip discoverability
- Keep `flex-shrink-0` on the button

```tsx
// BEFORE (simplified):
<button ...>
  Backlog
  {backlogBadgeCount > 0 && <span>{backlogBadgeCount}</span>}
</button>

// AFTER:
<button ... title={`${plannerUI.backlogOpen ? 'Collapse' : 'Expand'} backlog (B)`} className="... flex-shrink-0">
  <Inbox size={14} aria-hidden="true" />
  {backlogBadgeCount > 0 && <span>{backlogBadgeCount}</span>}
</button>
```

Add `Inbox` to the lucide-react import line.

**Acceptance:** Backlog button shows only the inbox icon and optional count badge. Tooltip confirms function. Click still toggles the backlog drawer.

---

## Story 3 — Pin right-side action buttons

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

Wrap the Backlog button, Team button, and `<SaveButton />` in a `flex-shrink-0` container so they are never pushed off-screen:

```tsx
{/* Right-side actions — always visible */}
<div className="flex items-center gap-2 flex-shrink-0 ml-auto">
  {/* Backlog icon button (Story 2) */}
  {/* Team button */}
  <SaveButton />
</div>
```

Remove the existing `<div className="flex-1" />` spacer — `ml-auto` on the right group achieves the same push-right effect without consuming flex space that could overflow.

**Acceptance:** At 1280px viewport with all timeline filters visible, the Team button and Save button are fully visible.

---

## Story 4 — Remove "+ Add Epic" from toolbar

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

Delete the `{activeScenarioId && <button>Add Epic</button>}` block (lines 872–880) from the timeline-only section of the toolbar.

**Acceptance:** "+ Add Epic" button no longer appears in the toolbar. (The inline Gantt button from Story 6 replaces it.)

---

## Story 5 — Remove quarter navigator from toolbar

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

Delete the quarter navigator block (lines 935–956) from the timeline-only section of the toolbar.

Remove the `currentQuarterIndex` and related props passed to `PlannerTimeline` if they are no longer needed after Story 6.

Remove unused imports (`ChevronLeft`, `ChevronRight`) if no longer referenced.

**Acceptance:** Quarter navigator no longer appears in toolbar.

---

## Story 6 — Dynamic sprint window in PlannerTimeline

**File:** `frontend/src/components/planner/PlannerTimeline.tsx`

### 6a — Replace SPRINT_COUNT constant with dynamic visible window

Add a `MIN_SPRINT_W = 100` constant (minimum column width in pixels).

Remove the `selectedQuarter` / `currentQuarterIndex` props from `PlannerTimelineProps`. Instead derive the visible sprint list directly from the `sprints` prop:

```ts
const visibleSprints = useMemo(() => {
  if (!sprints.length) return sprints;
  const now = new Date();
  // Find the current sprint (started <= now <= ended, or nearest future)
  const currentIdx = sprints.findIndex(s => new Date(s.startDate) <= now && now <= new Date(s.endDate));
  const anchorIdx = currentIdx >= 0 ? currentIdx : sprints.findIndex(s => new Date(s.startDate) > now);
  const startIdx = Math.max(0, anchorIdx - 1); // 1 sprint before current
  return sprints.slice(startIdx);
}, [sprints]);

const visibleSprintCount = Math.max(visibleSprints.length, 1);
const firstSprintNum = visibleSprints[0]?.number ?? 1;
```

### 6b — Update bar fraction denominator

Everywhere `SPRINT_COUNT` is used as a denominator in bar/grid calculations, replace with `visibleSprintCount`:

- `barFracs` function: `lo >= SPRINT_COUNT` → `lo >= visibleSprintCount`, etc.
- Sprint header grid: `repeat(${SPRINT_COUNT}, 1fr)` → `repeat(${visibleSprintCount}, 1fr)`  
- `gridTemplateColumns` for column guides  
- Today-line calculation: `(i + fraction) / SPRINT_COUNT * 100` → `/ visibleSprintCount * 100`

### 6c — Update drag resize width calculation

```ts
// line 781 equivalent
const sprintW = canvasRef.current.getBoundingClientRect().width / visibleSprintCount;
```

### 6d — Apply minimum column width to grid container

On the inner Gantt canvas div, set `minWidth` to `visibleSprintCount * MIN_SPRINT_W`:

```tsx
<div className="relative" style={{ minWidth: visibleSprintCount * MIN_SPRINT_W }}>
```

This ensures columns never shrink below 100px. The `overflow-x-auto` wrapper already in place handles horizontal scroll when needed.

### 6e — Update `quarterSprints` references

Replace `quarterSprints` (filtered by `selectedQuarter`) with `visibleSprints` throughout the component.

**Acceptance:**
- Timeline shows 1 past sprint + current sprint + all future sprints on load with no quarter selector needed.
- Sprint columns are at least 100px wide; on a wide screen they expand to fill available width.
- Bars appear in correct positions relative to the new window.
- Dragging and resizing bars still snaps correctly to sprint boundaries.
- Today line renders at the correct position.

---

## Story 7 — Inline "+ Add Epic" button in Gantt header

**File:** `frontend/src/components/planner/PlannerTimeline.tsx`

Add a `+` button to the sprint header row. It should be:

- Positioned at the far right of the header row (after the last sprint column)
- Always visible when `activeScenarioId` is set (passed via prop or derived from context)
- Styled as a small ghost icon button: `Plus` icon (14px), `hover:bg-mileway-bg`, `text-mileway-grey`
- On click: calls `onCreateItem({ type: 'epic' })` or equivalent callback prop

Implementation approach — append after the sprint header grid:

```tsx
{/* Sprint header row */}
<div className="relative flex">
  <div className="grid ..." style={{ gridTemplateColumns: `repeat(${visibleSprintCount}, 1fr)`, flex: 1 }}>
    {/* sprint columns */}
  </div>
  {canCreateEpic && (
    <button
      onClick={onAddEpic}
      title="Add Epic"
      className="flex items-center justify-center w-8 h-full text-mileway-grey hover:bg-mileway-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue flex-shrink-0"
    >
      <Plus size={14} aria-hidden="true" />
    </button>
  )}
</div>
```

Add `onAddEpic?: () => void` and `canCreateEpic?: boolean` to `PlannerTimelineProps`. Wire from `ScenarioPlanner.tsx`: pass `onAddEpic={() => setCreateModal({ defaultType: 'epic' })}` and `canCreateEpic={!!activeScenarioId}`.

**Acceptance:** A `+` button appears at the top-right of the timeline grid. Clicking it opens the create-epic modal. Button only renders when a scenario is active.

---

## Implementation Order

Stories are mostly independent but should be done in this sequence to keep the app in a working state at each step:

1. Story 1 (chip removal) — pure deletion, zero risk
2. Story 2 + 3 (Backlog icon + pin right group) — visual only, toolbar fix immediately visible
3. Story 4 + 5 (remove Add Epic + quarter nav from toolbar) — do together
4. Story 6 (dynamic sprint window) — largest change, do in one PR
5. Story 7 (inline Add Epic) — depends on Story 4 being done first

Total estimated files changed: 2 (`ScenarioPlanner.tsx`, `PlannerTimeline.tsx`) + 1 (`ScenarioTabs.tsx`).
