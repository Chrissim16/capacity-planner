# Squad & Process Team Capacity Dashboard — Design

**Date:** 2026-02-20  
**Status:** Approved

---

## Problem

The Dashboard shows capacity at the individual-member and team-wide levels only. There is no way to see utilisation grouped by Squad or by Process Team, which are the two primary organisational lenses used in capacity planning.

---

## Requirements

- Capacity usage (%) and availability by Squad, switchable per quarter
- Capacity usage (%) and availability by Process Team, switchable per quarter
- **Squad** = IT team members only (squads are IT-only)
- **Process Team** = IT team members + Business contacts (both carry `processTeamIds`)
- Members/contacts with `excludedFromCapacity === true` are excluded from all totals
- No drill-down — bars are summary-only
- Default view = current quarter

---

## Approach

Option B — new utility functions in `capacity.ts`, called from Dashboard.

---

## Data Layer

**File:** `frontend/src/utils/capacity.ts`

Two new exported functions following the same pattern as `getTeamUtilizationSummary`:

```typescript
export interface GroupCapacitySummary {
  totalDays:     number;  // gross working-day capacity of all members in group
  usedDays:      number;  // BAU + time-off + project assignments
  availableDays: number;  // totalDays - usedDays
  utilization:   number;  // usedDays / totalDays  (>1.0 = overloaded)
}

// IT members whose squadId matches, excludedFromCapacity skipped
export function calculateCapacityBySquad(
  squadId: string,
  quarter: string,
  state: AppState,
): GroupCapacitySummary

// IT members with processTeamId in their processTeamIds array,
// PLUS business contacts with processTeamId in their processTeamIds array.
// excludedFromCapacity skipped for both.
export function calculateCapacityByProcessTeam(
  processTeamId: string,
  quarter: string,
  state: AppState,
): GroupCapacitySummary
```

Implementation strategy:
- IT members → `calculateCapacity(member.id, quarter, state)` — sum `result.totalDays` and `result.allocatedDays`
- BIZ contacts → `calculateBusinessCapacityForQuarter(contact, quarter, ...)` — sum totals
- Groups with no members return `{ totalDays: 0, usedDays: 0, availableDays: 0, utilization: 0 }`

---

## UI Layer

**File:** `frontend/src/pages/Dashboard.tsx`

### Tab bar

Add a two-tab bar at the top of the Dashboard page:

- **Overview** — existing content, unchanged
- **By Squad / Team** — new content described below

Active tab underlined in `Brand.primary` (`#0089DD`). Local `useState` for active tab.

### Quarter selector

Inside the "By Squad / Team" tab, a row of four pill buttons: Q1 Q2 Q3 Q4.  
Default = `getCurrentQuarter()`. Local `useState`, not persisted.

### Layout

Two `Card` components side by side (`grid grid-cols-2 gap-4`):

| Card | Source data |
|---|---|
| **By Squad** | `state.squads` — one row per squad |
| **By Process Team** | `state.processTeams` — one row per process team |

### Row anatomy (per squad / per process team)

```
ERP         [████████████████████░░░░░░]  84%
             124 d used · 24 d free
```

- Name: left-aligned, `text-slate-800 dark:text-white font-medium text-sm`
- Progress bar: 8 px tall, `rounded-full`, track colour `#E2ECF5`
- Bar fill: coloured by heatmap tier (same thresholds as Team heatmap)
- `%` label: right-aligned on the bar, `text-xs font-medium`
- Sub-line: `{usedDays} d used · {availableDays} d free`, muted slate `text-xs`

### Bar colour tiers (matches existing heatmap)

| Utilisation | Fill colour token |
|---|---|
| 0% | grey track only |
| 1–25% | `HeatmapTiers.tier1.bg` |
| 26–50% | `HeatmapTiers.tier2.bg` |
| 51–75% | `HeatmapTiers.tier3.bg` |
| 76–85% | `HeatmapTiers.tier4.bg` |
| 86–100% | `HeatmapTiers.tier5.bg` |
| >100% | `HeatmapTiers.overloaded.bg` + `2px left border #DC3545` |

---

## Files Changed

- `frontend/src/utils/capacity.ts` — add `GroupCapacitySummary`, `calculateCapacityBySquad`, `calculateCapacityByProcessTeam`
- `frontend/src/pages/Dashboard.tsx` — add tab bar, quarter pill selector, two-panel squad/process-team view

---

## Out of Scope

- Drill-down to individual members within a group
- Business contacts in squad breakdowns (squads are IT-only)
- Persisting selected quarter or tab across navigation
