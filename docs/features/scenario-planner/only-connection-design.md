# Design: Scenario Planner Only Jira Connection

**Date:** 2026-03-20  
**Status:** Approved

---

## Problem

The app will gain a second Jira connection pointing at a Discovery board. Items from this board should appear in the Scenario Planner backlog — so planners can drag them onto the timeline — but must not pollute the Dashboard, Timeline, Team, Projects, or Command Palette, which are scoped to delivery work only.

---

## Approach

Add a `scenarioPlannerOnly` boolean flag on the `JiraConnection` model. Items from flagged connections still flow through the normal sync pipeline into `AppState.jiraWorkItems`; a lightweight filter utility excludes them at each non-planner read site.

The existing `jqlFilter` field on `JiraConnection` (already exposed in the connection form) handles filtering *which* items are synced — users write a JQL clause such as `cf[10234] = "In Scope"` to narrow what gets pulled in. The new flag only controls *where* those items are displayed.

---

## Data Model

### TypeScript

`JiraConnection` in `frontend/src/types/index.ts`:

```ts
scenarioPlannerOnly?: boolean;   // default false — items visible in Scenario Planner only
```

### Supabase

New migration (`supabase/migrations/`):

```sql
ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS scenario_planner_only boolean NOT NULL DEFAULT false;
```

Map in `supabaseSync.ts`:
- Load: `scenarioPlannerOnly: c.scenario_planner_only ?? false`
- Upsert: `scenario_planner_only: c.scenarioPlannerOnly ?? false`

---

## Settings UI

Location: `frontend/src/components/forms/JiraConnectionForm.tsx`, below the existing "Additional JQL filter" field.

Render a labelled checkbox:

> **Scenario Planner only**  
> Items from this connection will only appear in the Scenario Planner backlog. They are hidden from Dashboard, Timeline, Team, Projects, and Command Palette.

The checkbox saves via the existing `onSave` callback (no additional plumbing needed).

---

## Filter Helper

New file: `frontend/src/utils/jiraWorkItemScope.ts`

```ts
import type { JiraWorkItem, JiraConnection } from '../types';

export function globalJiraWorkItems(
  items: JiraWorkItem[],
  connections: JiraConnection[],
): JiraWorkItem[] {
  const plannerOnlyIds = new Set(
    connections.filter(c => c.scenarioPlannerOnly).map(c => c.id),
  );
  if (plannerOnlyIds.size === 0) return items;
  return items.filter(i => !plannerOnlyIds.has(i.connectionId));
}
```

---

## Affected Call Sites

### Apply `globalJiraWorkItems` (hide Discovery items)

| File | Where |
|---|---|
| `frontend/src/pages/Dashboard.tsx` | Epic count, setup checklist |
| `frontend/src/pages/Timeline.tsx` | Actuals Gantt items |
| `frontend/src/pages/Team.tsx` | Member workload |
| `frontend/src/pages/Projects.tsx` | Epic list |
| `frontend/src/components/ui/CommandPalette.tsx` | Search results |

Each of these already derives items from `state.jiraWorkItems`. Replace with `globalJiraWorkItems(state.jiraWorkItems, state.jiraConnections)` at the top of the relevant component or `useMemo`.

### Do NOT filter

| File | Reason |
|---|---|
| `frontend/src/pages/Jira.tsx` | Sync dashboard — operators must see all connections |
| `frontend/src/pages/settings/JiraSection.tsx` | Same |
| `frontend/src/stores/actions.ts` | Store is source of truth; visibility is a read concern |
| `frontend/src/pages/ScenarioPlanner.tsx` and children | This is the surface that *should* show Discovery items |

---

## Scenario Snapshots

`createScenario` copies `getCurrentState().jiraWorkItems` (the full baseline catalog). Discovery items are therefore included in every new scenario snapshot automatically — no changes needed.

---

## `refreshScenarioFromJira` Bug Fix

Current code in `actions.ts`:

```ts
jiraWorkItems: JSON.parse(JSON.stringify(currentState.jiraWorkItems)),
```

When a scenario is active, `currentState` is the scenario snapshot — so "Refresh" overwrites the scenario with itself, not with the latest baseline sync. Fix: read from `state.data.jiraWorkItems` (the baseline catalog):

```ts
jiraWorkItems: JSON.parse(JSON.stringify(state.data.jiraWorkItems)),
```

This ensures newly synced Discovery items are picked up when a user hits "Refresh from Jira" while a scenario is open.

---

## Out of Scope

- SPIKE-01 Discovery issue types / project key — that governs which Jira project and issue type to sync; this design is orthogonal and can ship independently.
- Filtering items *within* a connection — the existing `jqlFilter` JQL field handles this at sync time.
