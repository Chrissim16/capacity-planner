# Search All Work Item Types — Design

**Date:** 2026-03-24
**Status:** Approved

## Problem

Search in the Epics page, Timeline, and Scenario Planner (timeline and board) only operates on epics. Features, stories, tasks, and bugs are invisible to search. This makes it hard to find specific work items without knowing which epic they belong to.

## Goal

Extend search across all work item types (`epic | feature | story | task | bug`) in:

1. **Epics page** — existing search box
2. **Timeline** — rename the existing assignee search to a generic search covering both item names and assignee names
3. **Scenario Planner (timeline + board)** — add a new generic search box covering both item names and assignee names

The Scenario Planner backlog sidebar already supports full-tree search and is out of scope.

## Work Item Types

`JiraItemType = 'epic' | 'feature' | 'story' | 'task' | 'bug'`
`PlannerItemType = JiraItemType | 'uat' | 'hypercare'`

## Approach: Shared utility + local state per page

Each page keeps its own local search state. A shared utility function provides consistent match logic across all three surfaces.

---

## Section 1: Shared utility — `src/utils/searchUtils.ts`

```ts
matchesSearch(query: string, item: JiraWorkItem | PlannerItem, memberName?: string): boolean
```

- Returns `true` if `query` is empty (no filter)
- Lowercases and trims `query`
- Matches `item.summary` (case-insensitive substring)
- Matches `item.jiraKey` (case-insensitive substring)
- If `memberName` provided, also matches against it

---

## Section 2: Epics page (`Projects.tsx`)

**State:** existing `search` string, plus new `expandedEpics: Set<string>` (keyed by epic `jiraKey`).

**`filteredEpics` memo — two-pass logic:**

1. **Direct match:** epic's own `summary` or `jiraKey` matches query → include, no forced expansion.
2. **Child match:** if no direct match, check all features under the epic, and all stories/tasks/bugs under those features via `matchesSearch`. If any descendant matches → include the epic and force-expand it.

**Expansion behaviour:**
- When `search` is non-empty, all child-matched epics are force-expanded (overrides user preference).
- When `search` is cleared, `expandedEpics` resets to default state.

**Highlighting (when `showStories` is on):**
- Matching children: subtle highlight (coloured left border or bold summary).
- Non-matching children under a force-expanded epic: visually dimmed.

---

## Section 3: Timeline (`Timeline.tsx`)

**State:** rename `memberSearch` → `search`.

**UI:** rename the input placeholder to `"Search..."`.

**`filteredJiraItems` memo — additional search pass:**

When `search` is non-empty, an item passes if **any** of:
- `matchesSearch(search, item)` — item's own summary or jiraKey
- Resolved assignee name for the item matches `search` (existing behaviour)
- Any ancestor of the item matches (so matched stories/tasks keep their parent chain visible in the Gantt)

**`filteredTeamMembers`:** continues filtering by member name as before (no logic change, just variable rename).

---

## Section 4: Scenario Planner (`ScenarioPlanner.tsx`)

**State:** new `search: string` local state, default `''`.

**UI:** generic search input added to the toolbar (consistent styling with existing filter pills) — visible in both timeline and board modes.

**`filteredPlannerItems` memo — additional search pass** (applied after existing process-team / epic / label filters):

When `search` is non-empty, a `PlannerItem` passes if **any** of:
- `matchesSearch(search, item)` — item's own summary or jiraKey
- Any assignee's resolved member name matches `search`
- Any ancestor in the planner tree matches (parent chain walk, mirrors existing label ancestor-bubbling logic)

**Child components (`PlannerTimeline`, `PlannerBoard`):** no changes required — both already consume `filteredPlannerItems`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/searchUtils.ts` | New — shared `matchesSearch` utility |
| `src/pages/Projects.tsx` | Extend `filteredEpics` to include child matches; add `expandedEpics` state; add highlighting |
| `src/pages/Timeline.tsx` | Rename `memberSearch` → `search`; extend filter to match item summary/key + ancestors |
| `src/pages/ScenarioPlanner.tsx` | Add `search` state; add search input to toolbar; extend `filteredPlannerItems` with search + ancestor pass |

## Out of Scope

- Scenario Planner backlog (already supports full-tree search)
- Command palette (already searches all item types)
- Persisting search state across view switches (Zustand)
- Backend / Supabase changes
