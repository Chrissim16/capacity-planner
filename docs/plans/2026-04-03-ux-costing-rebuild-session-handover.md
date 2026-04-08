---
status: In Progress
created: 2026-04-03
branch: feature/ux-costing-rebuild
base: origin/design/brand-pass
related:
  - 2026-04-02-master-plan.md
  - 2026-04-02-ux-coherence-and-costing-handover.md
  - 2026-04-02-costing-module-implementation-spec.md
---

# Session Handover — UX + Costing Rebuild

## Current branch

- Working branch: `feature/ux-costing-rebuild`
- Branch base is `origin/design/brand-pass`
- The unrelated local `design/brand-pass` admin/env commit is **not** included on this branch

## What is already implemented

### Journey shell / navigation

- Sidebar reordered to:
  - Portfolio Planning
  - Capacity Planner
  - Actuals
  - Timeline
  - Team
  - Report
  - Settings
- `StageProgressBar` added and wired into:
  - Portfolio Planning
  - Capacity Planner
  - Actuals
- `Projects.tsx` title changed from `Epics` to `Actuals`
- `ScenarioPlanner.tsx` replaced with a thinner baseline-only Stage 2 shell

### Stage 2 foundations

- Added root-level state:
  - `capacityRequests`
  - `capacityAssignments`
- Added actions for:
  - add / update / remove capacity requests
  - add / remove capacity assignments
  - external vendors
  - initiative cost records
- Rebuilt Stage 2 around:
  - `frontend/src/components/capacity/CapacityBacklog.tsx`
  - `frontend/src/components/capacity/CapacityRequestCard.tsx`
  - `frontend/src/components/capacity/CapacitySprintGrid.tsx`
  - `frontend/src/pages/ScenarioPlanner.tsx`
- Stage 2 now:
  - uses root-level baseline state
  - ignores `Scenario.plannerLayout`
  - ignores planner session persistence
  - supports manual requests
  - supports drag/drop confirmation into person × sprint cells
  - derives grid allocations from `capacityAssignments`

### Costing foundations

- Added shared costing types to `frontend/src/types/index.ts`
- Extended `Settings` with `settings.costing`
- Added root-level state:
  - `externalVendors`
  - `initiativeCosts`
- Added sync support in `frontend/src/services/supabaseSync.ts`
- Added migrations:
  - `supabase/migrations/048_costing_rates_and_external_vendors.sql`
  - `supabase/migrations/049_initiative_costs.sql`

Important note:

- The original plan referenced migrations `047` and `048`
- This repo already had a real `047`
- To avoid migration-order conflicts, the costing work was added as `048` and `049`

### Costing settings / data entry UI

- Added `frontend/src/pages/settings/CostingSection.tsx`
- Added editable business team rate overrides in `frontend/src/pages/settings/BusinessTeamsSection.tsx`
- Added editable business contact rate overrides in `frontend/src/pages/settings/BusinessContactsSection.tsx`
- Extended IT member form in `frontend/src/components/forms/TeamMemberForm.tsx` with:
  - `workerType`
  - `externalVendorId`
  - `dailyRateOverride`
  - `dailyRateCurrency`
- Added shared currency helper in `frontend/src/utils/currency.ts`

### Portfolio Planning costing UI

- Added shared cost calculation utility:
  - `frontend/src/utils/costing.ts`
- Added cost drawer:
  - `frontend/src/components/portfolio/CostDrawer.tsx`
- Portfolio Planning now includes:
  - cost chip on epic rows
  - cost drawer for initiative direct costs + contingency
  - summary tab cost KPI cards
  - summary tab “Cost by Initiative” table
  - scenario delta column for costs
- Direct costs are editable in baseline and read-only in portfolio scenarios

## Validation completed

- `npm run build` passed in `/Users/dennissimon/capacity-planner/frontend`

## Important caveats

### Database migrations have not been run yet

- No SQL was applied in this session
- Running the migration against a shared Supabase project will affect all branches that use that database, including `main` / `brand-pass`
- If isolation is needed, point this branch at a dedicated dev Supabase project first

### TEAM placeholder migration is still pending

The app still has legacy `TEAM:<name>` write paths. These need to move to `TEAM:<id>` before calling the costing layer complete.

Confirmed remaining write-path locations:

- `frontend/src/pages/PortfolioPlanning.tsx`
- `frontend/src/pages/BulkReplacePersonModal.tsx`

Read-path handling is also still loose in a few places, so this should be treated as the next cleanup pass, not as an optional polish item.

### Costing v1 is not complete yet

The current state is “foundations + first working UI”, not the full master plan. Missing work still includes:

- TEAM placeholder normalization pass
- stronger missing-rate UX in Portfolio Planning rows/drawer
- full executive/report export cost integration if desired later
- Actuals 4-tab rebuild
- visual alignment pass

## Recommended next step

### 1. TEAM placeholder normalization

Do this next before more costing work:

- add a helper like `normalizeLegacyTeamPlaceholder(id, businessTeams)`
- switch all TEAM writes to `TEAM:<id>`
- keep read compatibility for legacy `TEAM:<name>`
- update at least:
  - `frontend/src/pages/PortfolioPlanning.tsx`
  - `frontend/src/pages/BulkReplacePersonModal.tsx`
  - `frontend/src/utils/portfolioPlanExport.ts`

### 2. Then continue with Actuals rebuild

After TEAM normalization:

- rebuild `Projects.tsx` into the 4-tab Actuals screen from the master plan
- keep the new stage shell intact
- do not reintroduce Scenario Planner concepts into Stage 2

## Files added this session

- `frontend/src/components/capacity/CapacityBacklog.tsx`
- `frontend/src/components/capacity/CapacityRequestCard.tsx`
- `frontend/src/components/capacity/CapacitySprintGrid.tsx`
- `frontend/src/components/layout/StageProgressBar.tsx`
- `frontend/src/components/portfolio/CostDrawer.tsx`
- `frontend/src/pages/settings/CostingSection.tsx`
- `frontend/src/utils/costing.ts`
- `frontend/src/utils/currency.ts`
- `supabase/migrations/048_costing_rates_and_external_vendors.sql`
- `supabase/migrations/049_initiative_costs.sql`

## Core files modified this session

- `frontend/src/components/forms/TeamMemberForm.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/PortfolioPlanning.tsx`
- `frontend/src/pages/Projects.tsx`
- `frontend/src/pages/ScenarioPlanner.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/pages/settings/BusinessContactsSection.tsx`
- `frontend/src/pages/settings/BusinessTeamsSection.tsx`
- `frontend/src/services/supabaseSync.ts`
- `frontend/src/stores/actions.ts`
- `frontend/src/stores/appStore.ts`
- `frontend/src/types/index.ts`

## Suggested opening checklist for the next session

1. Confirm which Supabase project this branch should target
2. Run migrations only if using an isolated dev database
3. Finish TEAM placeholder normalization
4. Re-run `npm run build`
5. Smoke-test:
   - Settings → Costing
   - Team member external/rate fields
   - Business team/contact rate overrides
   - Portfolio Planning cost chip + drawer
   - Summary tab cost cards/table
