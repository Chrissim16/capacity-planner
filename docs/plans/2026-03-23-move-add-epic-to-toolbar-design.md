# Design: Move "Add Epic" to Toolbar

**Date:** 2026-03-23  
**Status:** Approved

## Problem

The "+ Add Epic" button is currently rendered as an `absolute`-positioned element inside `PlannerTimeline.tsx`, sitting on top of the sprint date header bar. This causes it to visually hover over the sprint dates, creating an overlap that obscures sprint labels.

## Solution

Lift the button out of `PlannerTimeline` and place it in the top toolbar in `ScenarioPlanner.tsx`, on the right side just before the Backlog button. This is where the toolbar comment already anticipated it: `[(timeline) Add Epic] [(timeline) Filters] [(timeline) ‹ Q ›]`.

## Approach: Full Lift (Option A)

Remove the button and its prop from `PlannerTimeline` entirely. Wire the callback directly from the toolbar.

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/planner/PlannerTimeline.tsx` | Remove `onAddEpic` from `PlannerTimelineProps` interface, remove from destructuring, delete button block from sprint header overlay |
| `frontend/src/pages/ScenarioPlanner.tsx` | Remove `onAddEpic` prop from `<PlannerTimeline>` call-site; add `+ Add Epic` button in the right-side actions div, before the Backlog button, shown only when `activeMode === 'timeline'` and `activeScenarioId` is truthy |

## Button Spec

- **Styling:** `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium` — matches Team / Backlog weight
- **Colour:** mileway-blue tint at rest, fill on hover (same as existing Add Epic button)
- **Icon:** `<Plus size={14} />` + "Add Epic" label
- **Visibility:** `activeMode === 'timeline' && !!activeScenarioId`
- **On click:** `() => setCreateModal({ defaultType: 'epic' })` — unchanged

## Non-Goals

- No changes to the `CreateItemModal` logic
- No changes to the create flow or data model
- No new keyboard shortcut
