---
status: Ready for Dev
created: 2026-04-02
supersedes: 2026-04-02-planning-journey-ux-handover.md
related:
  - 2026-04-02-ux-coherence-and-costing-handover.md
  - 2026-04-02-costing-module-implementation-spec.md
---

# Master Plan — UX Coherence + Costing Module

## How to use these docs

| Doc | Purpose |
|---|---|
| **This file** | Master plan. Start here. Execution order, all known issues, verification. |
| `2026-04-02-ux-coherence-and-costing-handover.md` | Full implementation detail — component code, file paths, store changes |
| `2026-04-02-costing-module-implementation-spec.md` | Costing domain spec — SQL migrations, calculation rules, v1.1 items |
| ~~`2026-04-02-planning-journey-ux-handover.md`~~ | **Superseded by this plan. Do not use.** |

---

## Context

Three screens (Portfolio Planning, Scenario Planner, Epics) were built in reverse order, producing incoherent journeys, duplicate patterns, and fragile interactions. After design review the architecture is rethought around the actual workflow.

---

## Intended workflow

```
Portfolio Planning     →   [Jira]               →   Capacity Planner     →   Actuals
──────────────────         ──────                   ────────────────         ───────
Epics + phases only        Build Epic/Feature/       Sprint grid              Epic→Feature→Story
Management approval        Story structure           Drag backlog item         Delivery health (RAG)
Phase staffing             After approval            → see capacity impact     People / stakeholders
Costing                    Backlog appears in        Assign person             Scope validation
                           Stage 2 backlog           Overallocation alert
```

---

## Key decisions

- Stage 2 kept but **radically simplified** — unique value is "drag one item → see if it fits"
- Stage 2 has **no** scenario tabs, board view, 4 modes, or bulk edit
- Jira backlog items + manual what-if cards both appear in the Stage 2 backlog
- Stage 2 is a **single baseline workspace** backed by root-level `capacityRequests` + `capacityAssignments`
- Stage 2 does **not** read or write `Scenario.plannerLayout`; removing scenario selection also removes the need for `plannerSessionStorage`
- Story hierarchy only appears in Actuals (stories don't exist during Portfolio Planning)
- Scenarios removed from Stage 2; Portfolio Planning keeps its own scenario system
- **Costing lives entirely in Portfolio Planning** — not in Capacity Planner or Actuals
- Scenario Planner cost summary and Executive Report/PDF cost are **confirmed v1.1** — do not build in v1.0

---

## Known issues — fix before shipping

### P1 — initiative_costs NULL uniqueness (fix in migration 048)

Postgres `UNIQUE (initiative_kind, initiative_id, scenario_id)` allows multiple NULLs, so two baseline portfolio_epic rows can coexist for the same initiative.

**Fix:** Remove the inline `UNIQUE` constraint from the table definition. Replace with two partial indexes:

```sql
CREATE UNIQUE INDEX initiative_costs_portfolio_epic_uniq
  ON public.initiative_costs (initiative_kind, initiative_id)
  WHERE scenario_id IS NULL;

CREATE UNIQUE INDEX initiative_costs_scenario_project_uniq
  ON public.initiative_costs (initiative_kind, initiative_id, scenario_id)
  WHERE scenario_id IS NOT NULL;
```

Apply in migration 048 and remove the `unique (initiative_kind, initiative_id, scenario_id)` line from the table DDL.

---

### P1 — Capacity Planner source of truth must be explicit (new type + action required)

`handleDrop` computes the overallocation warning but never defines what is written when the user confirms an assignment.

**Fix:** Make Stage 2 baseline-only and back it with app-root store data only.

Do **not** reuse `Scenario.plannerLayout` in the rebuilt Capacity Planner. The new screen has no scenario switching, no session persistence, and no planner-mode carryover.

Source of truth for v1.0 Stage 2:

- `capacityRequests` — unscheduled manual what-if cards
- `capacityAssignments` — confirmed person × sprint placements
- shared root data already in the app store: `jiraWorkItems`, `teamMembers`, `sprints`

Legacy `Scenario.plannerLayout` may remain on disk for older scenarios, but the rebuilt Stage 2 ignores it.

Add to `frontend/src/types/index.ts`:

```typescript
export interface CapacityAssignment {
  id: string;                    // crypto.randomUUID()
  memberId: string;
  sprintId: string;
  jiraItemId?: string;           // set if source is a Jira backlog item
  capacityRequestId?: string;    // set if source is a manual CapacityRequest
  estimatedDays: number;
  assignedAt: string;
}
```

Add to `AppState`: `capacityAssignments: CapacityAssignment[]`
Add to `defaultAppState`: `capacityAssignments: []`

Add actions to `frontend/src/stores/actions.ts`:

```typescript
addCapacityAssignment(a: Omit<CapacityAssignment, 'id' | 'assignedAt'>): void
removeCapacityAssignment(id: string): void
```

Update `handleDrop` confirm path in `CapacitySprintGrid.tsx`:

```typescript
function handleConfirmAssign(item, memberId, sprintId, days) {
  addCapacityAssignment({
    memberId,
    sprintId,
    jiraItemId:        isJiraItem(item)        ? item.id : undefined,
    capacityRequestId: isCapacityRequest(item) ? item.id : undefined,
    estimatedDays: days,
  });
}
```

`CapacitySprintGrid` allocated-days calculation must read from `capacityAssignments` only.

Backlog filtering rule:

- exclude Jira items already represented by a `CapacityAssignment`
- exclude manual what-if requests once they have been assigned, or render them as "scheduled" if keeping them visible is preferred

---

### P2 — TEAM migration under-scoped

The handover only mentions `PortfolioPlanning.tsx`. Three files write `TEAM:<name>` and all must be updated in the same pass:

| File | Line |
|---|---|
| `frontend/src/pages/PortfolioPlanning.tsx` | ~3371 |
| `frontend/src/pages/BulkReplacePersonModal.tsx` | ~97 |
| `frontend/src/utils/portfolioPlanExport.ts` | ~129 |

All three must switch the write path to `TEAM:<id>`. Read-path normalization via `normalizeLegacyTeamPlaceholder` handles backward compatibility.

---

### P2 — Rate override pair validation (fix in migration 047)

`daily_rate_override` and `daily_rate_currency` can be half-filled, creating ambiguous runtime state.

**Fix:** Add CHECK constraints to migration 047 for all three tables:

```sql
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_rate_pair_valid CHECK (
    (daily_rate_override IS NULL AND daily_rate_currency IS NULL)
    OR (daily_rate_override IS NOT NULL AND daily_rate_override >= 0 AND daily_rate_currency IS NOT NULL)
  );

ALTER TABLE public.business_contacts
  ADD CONSTRAINT business_contacts_rate_pair_valid CHECK (
    (daily_rate_override IS NULL AND daily_rate_currency IS NULL)
    OR (daily_rate_override IS NOT NULL AND daily_rate_override >= 0 AND daily_rate_currency IS NOT NULL)
  );

ALTER TABLE public.business_teams
  ADD CONSTRAINT business_teams_rate_pair_valid CHECK (
    (daily_rate_override IS NULL AND daily_rate_currency IS NULL)
    OR (daily_rate_override IS NOT NULL AND daily_rate_override >= 0 AND daily_rate_currency IS NOT NULL)
  );
```

---

### P2 — normalizeLegacyTeamPlaceholder too loose

The `includes('-')` heuristic fails for business-team names that contain hyphens.

**Fix:** Match against known IDs first, then fall back to name matching:

```typescript
export function normalizeLegacyTeamPlaceholder(
  id: string,
  businessTeams: Array<{ id: string; name: string }>
): string {
  if (!id.startsWith('TEAM:')) return id;
  const entityId = id.slice(5);
  // Already a known ID — no normalization needed
  if (businessTeams.some(bt => bt.id === entityId)) return id;
  // Try to match by name
  const match = businessTeams.find(bt => bt.name === entityId);
  return match ? `TEAM:${match.id}` : id;
}
```

Replace the version in the handover doc and in `frontend/src/utils/assignableActors.ts`.

---

## Execution order

| # | Track | Work | Detail |
|---|---|---|---|
| 1 | A | Sidebar reorder + rename labels | Handover Step 1 |
| 2 | A | StageProgressBar | Handover Step 2 |
| 3 | A | Rebuild Capacity Planner (Stage 2) | Handover Step 3 + P1 persistence fix above |
| 4 | A | Actuals screen — 4 tabs | Handover Step 4 |
| 5 | B | Costing types + utilities | Handover B1 |
| 6 | B | Migrations + sync + actions | Handover B2 + P1 uniqueness fix + P2 rate validation fix |
| 7 | B | Admin UI | Handover B3 |
| 8 | B | Portfolio Planning cost UX + TEAM normalization | Handover B4 + P2 TEAM scope fix + P2 helper fix |
| 9 | A | Visual alignment pass | Handover Step 5 |

---

## New files

```
frontend/src/
├── components/
│   ├── layout/
│   │   └── StageProgressBar.tsx
│   ├── capacity/
│   │   ├── CapacityBacklog.tsx
│   │   ├── CapacitySprintGrid.tsx
│   │   └── CapacityRequestCard.tsx
│   ├── actuals/
│   │   ├── ActualsScope.tsx
│   │   ├── ActualsDeliveryHealth.tsx
│   │   ├── ActualsPeopleView.tsx
│   │   └── ActualsStakeholders.tsx
│   ├── portfolio/
│   │   └── CostDrawer.tsx
│   └── shared/
│       └── UtilizationBar.tsx
├── pages/settings/
│   └── CostingSection.tsx
└── utils/
    ├── assignableActors.ts
    ├── currency.ts
    ├── costing.ts
    └── costing.test.ts

supabase/migrations/
├── 047_costing_rates_and_external_vendors.sql
└── 048_initiative_costs.sql
```

## Files to delete

```
frontend/src/components/planner/PlannerBoard.tsx
frontend/src/components/planner/PlannerPeopleView.tsx
frontend/src/components/planner/PlannerSummaryView.tsx
frontend/src/components/planner/PlannerDetailPanel.tsx
frontend/src/components/planner/PlannerTeamDrawer.tsx
frontend/src/components/planner/PlannerContextMenu.tsx
frontend/src/components/planner/ScenarioTabs.tsx
frontend/src/utils/plannerSessionStorage.ts
```

Grep for imports before deleting.

---

## Verification checklist

### Navigation
- [ ] Sidebar order: Portfolio Planning → Capacity Planner → Actuals → Timeline → Team → Report → Settings
- [ ] Labels: "Capacity Planner" (not Scenario Planner), "Actuals" (not Epics)
- [ ] StageProgressBar on all three screens; completed stages show ✓; current stage highlighted
- [ ] Clicking a stage in the bar navigates to it

### Capacity Planner (Stage 2)
- [ ] No scenario tabs, no mode toggle (Timeline / Board / People / Summary)
- [ ] Left panel: Jira backlog items (not Done) + what-if request cards
- [ ] "+ Add request" inline form: name, days, sprint, skills
- [ ] Drag item onto person × sprint → overallocation warning or green confirm
- [ ] Confirming an assignment writes a `CapacityAssignment` record to the store
- [ ] Sprint grid allocation bars are derived from `capacityAssignments` only
- [ ] Overallocation: red cell highlight + message. Available: green confirm with days remaining

### Actuals (Stage 3)
- [ ] Page title "Actuals"
- [ ] Scope tab: Epic → Feature → Story tree; status badge on every row; collapsed by default; search filters tree
- [ ] Delivery Health tab: KPI cards (On Track / At Risk / Delayed / Completed) + sortable table with RAG
- [ ] People tab: phase-level allocation chips for both IT and business, plus quarterly totals/utilization
- [ ] Stakeholders tab: owner + Jira status per epic; read-only
- [ ] No SmartAssignmentPanel, no bulk edit, no confidence controls
- [ ] Jira sync is a small header indicator, not a primary button

### Costing
- [ ] Settings → Costing section: FX rates, global rates, external vendors all save correctly
- [ ] Team member form: Internal/External toggle; vendor select; rate override
- [ ] Business contact and business team: rate override fields present and save
- [ ] Portfolio epic rows: cost chip (shows amount; orange ⚠ if rates missing)
- [ ] Cost drawer: opens from chip; editable in baseline; direct costs read-only in scenario with info note
- [ ] Portfolio Summary tab: 5 cost KPI cards + Cost by Initiative table with delta column
- [ ] Missing rate: warning shown; line excluded from totals (not zero)
- [ ] FX rate change in Settings: totals update immediately without page reload
- [ ] TEAM: write path uses `TEAM:<id>` in all three files; legacy `TEAM:<name>` still resolves on read
- [ ] initiative_costs: two rows for the same portfolio_epic with scenario_id = NULL are **rejected** by the DB
- [ ] Rate override columns: half-filled pairs (e.g. amount set but no currency) are **rejected** by the DB
- [ ] Scenario clone: scenario_project cost rows cloned; portfolio_epic rows not cloned
- [ ] Scenario delete: scenario_project cost rows removed; portfolio_epic rows remain
