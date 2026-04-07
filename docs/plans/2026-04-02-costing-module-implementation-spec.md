---
status: Ready for Dev
created: 2026-04-02
shipped: ~
author: Codex
supersedes: ~
---

# Costing Module v1 — Implementation Spec

## Purpose

Add a reporting-only costing layer to the capacity planner so portfolio and scenario planning can answer "what will this cost?" without changing staffing logic, scheduling rules, or existing capacity calculations.

This spec is intentionally grounded in the current codebase:

- Global config already persists through the `settings` key/value row and `Settings` TS interface.
- Portfolio Planning already has stable initiative IDs via `epicKey` / `ManualEpic.epicKey`.
- Scenario-local what-if work already persists through `Scenario.projects`, `Scenario.assignments`, and `Scenario.plannerLayout`.
- Placeholder assignment patterns already exist in Portfolio Planning via prefixed IDs; v1 will normalize the current legacy business-team form (`TEAM:<businessTeamName>`) to ID-based placeholders (`TEAM:<businessTeamId>`).

The v1 goal is to add costing with the smallest architectural jump that still supports:

- internal IT rates
- external IT named people and vendor/team placeholders
- business rates and business team placeholders
- direct costs per initiative
- live FX conversion
- scenario vs baseline comparison

## Scope

### In scope

- Global costing settings:
  - reporting currency
  - supported currencies (`EUR`, `GBP`, `USD`)
  - manually maintained FX rates
  - global internal IT daily rate
  - global business daily rate
- Per-person rate overrides for:
  - IT team members
  - business contacts
- External vendor/team catalog with:
  - rate
  - currency
  - optional capacity participation flag
- Shared direct costs for portfolio initiatives:
  - Jira epics on the Portfolio board
  - manual portfolio epics
- Scenario-local direct costs for scenario-native projects
- Portfolio Planning cost UX:
  - Summary tab cost cards + initiative table
  - epic-row cost chip
  - right-side cost drawer for breakdown and editing
- Scenario/reporting surfaces:
  - scenario summary totals
  - executive report cost totals and scenario delta
- Shared calculation utilities and tests

### Out of scope / deferred

- Historical FX snapshots or time-versioned rates
- Writing costs back to Jira
- Using cost data to constrain staffing or scheduling
- Dashboard-wide cost widgets
- Cost editing from the Jira hierarchy page
- Cost editing from the Scenario Planner detail panel for non-canonical items like stories/tasks
- Budget approvals, purchase-order workflows, or actuals tracking
- If delivery is phased: Scenario Wizard cost capture and Executive Report/PDF cost export move to v1.1 after the core module lands

## Key Design Decisions

### 1. Reuse existing prefixed placeholder IDs

Do not introduce a new cross-app "actor reference" abstraction in v1.

Instead, extend the existing string-ID convention already used in Portfolio Planning:

- business team placeholder: `TEAM:<businessTeamId>`
- external vendor/team placeholder: `VENDOR:<externalVendorId>`

This keeps changes smaller across:

- `EpicPhaseAssignment.memberId`
- `Assignment.memberId`
- `PlannerAssignment.memberId`

and allows new costing/capacity helper functions to resolve an assignee from a single string ID.

Compatibility rule for rollout:

- read path must support both `TEAM:<businessTeamName>` and `TEAM:<businessTeamId>` for one release
- write path must always emit `TEAM:<businessTeamId>`
- backfill is required for persisted Supabase rows where feasible, but runtime compatibility must remain because local storage and scenario JSON may still contain legacy name-based placeholders

### 2. Keep global costing config in `settings`

Do not add a new relational table for reporting currency, supported currencies, or FX rates.

Reason:

- the app already persists app-wide config in `settings`
- these values are global and singleton by nature
- load/save already exists in `frontend/src/services/supabaseSync.ts`

Add a nested `costing` object under `Settings`.

### 3. Use one new `initiative_costs` table for direct costs

Do not embed direct costs into `Scenario` JSON or add separate tables per screen.

Create one relational table keyed by initiative identity:

- shared portfolio initiative costs: `initiative_kind = 'portfolio_epic'`, `scenario_id = null`
- scenario-native project costs: `initiative_kind = 'scenario_project'`, `scenario_id = <scenario>`

This keeps baseline direct costs shared automatically across portfolio scenarios while still allowing scenario-local project costs.

### 4. Keep named external IT people in `team_members`

Named external people should still be first-class assignees and appear in assignment pickers.

Model them as `TeamMember` rows with:

- `workerType = 'external'`
- optional `externalVendorId`
- optional personal rate override

This preserves existing assignment flows and lets external people participate in capacity when desired.

### 5. Default placeholders to non-capacity

External vendor/team placeholders must be costable without distorting capacity.

Default rule:

- named people: capacity works as it does today
- placeholder IDs (`TEAM:` / `VENDOR:`): excluded from capacity unless explicitly opted in later

Portfolio Planning already behaves this way for business teams; v1 generalizes that behavior.

### 6. Business teams are an existing dependency, not a new concept

This repo already has:

- a `BusinessTeam` TypeScript entity
- a `business_teams` Supabase migration (`036_business_teams.sql`)
- a settings UI for business teams

So v1 costing extends that entity with rates rather than inventing a new table.

Implementation requirement:

- before writing the costing migration in any target environment, verify whether migration `036_business_teams.sql` has already been applied
- if it has not, apply `036` first or fold its table creation into the new migration for that environment

## Data Model Changes

### TypeScript

Add to `frontend/src/types/index.ts`:

```ts
export type CurrencyCode = 'EUR' | 'GBP' | 'USD';

export interface MoneyAmount {
  amount: number;
  currency: CurrencyCode;
}

export interface CostLineItem {
  id: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  note?: string;
}

export interface CostSettings {
  reportingCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  fxToEur: Record<CurrencyCode, number>;
  internalItDailyRate: MoneyAmount;
  businessDailyRate: MoneyAmount;
}

export interface ExternalVendor {
  id: string;
  name: string;
  dailyRate: number;
  currency: CurrencyCode;
  notes?: string;
  archived?: boolean;
  countsTowardCapacity?: boolean;
  workingDaysPerWeek?: number;
}

export interface InitiativeCostRecord {
  id: string;
  initiativeKind: 'portfolio_epic' | 'scenario_project';
  initiativeId: string;
  scenarioId?: string;
  contingencyPct: number;
  hardware?: CostLineItem | null;
  licenses: CostLineItem[];
  updatedAt: string;
}
```

`ExternalVendor.id` generation rule:

- use `crypto.randomUUID()` in the frontend
- treat the ID as opaque and stable
- placeholder references must always use `VENDOR:<externalVendorId>`, never `VENDOR:<externalVendorName>`

`CostLineItem.id` generation rule:

- use `crypto.randomUUID()` in the frontend
- keep IDs stable across edits because these line items are stored in JSONB and need deterministic delete/update behavior

Extend existing types:

```ts
export interface Settings {
  // existing fields...
  costing: CostSettings;
}

export interface TeamMember {
  // existing fields...
  workerType?: 'internal' | 'external';
  externalVendorId?: string;
  dailyRateOverride?: number;
  dailyRateCurrency?: CurrencyCode;
}

export interface BusinessContact {
  // existing fields...
  dailyRateOverride?: number;
  dailyRateCurrency?: CurrencyCode;
}

export interface BusinessTeam {
  id: string;
  name: string;
  dailyRateOverride?: number;
  dailyRateCurrency?: CurrencyCode;
}

export interface Project {
  // unchanged identity fields
  // direct costs resolved via InitiativeCostRecord keyed by project.id + scenarioId
}

export interface AppState {
  // existing fields...
  externalVendors: ExternalVendor[];
  initiativeCosts: InitiativeCostRecord[];
}
```

### Assignment conventions

Do not rename `memberId` in v1.

Interpret assignment IDs as:

- `TeamMember.id` for IT named people
- `BusinessContact.id` for business named people
- `TEAM:<businessTeamId>` for business team placeholders
- `VENDOR:<externalVendorId>` for external vendor/team placeholders

Required helper utilities:

- `isBusinessTeamPlaceholderId(id: string): boolean`
- `isExternalVendorPlaceholderId(id: string): boolean`
- `parsePlaceholderId(id: string): { kind: 'TEAM' | 'VENDOR'; entityId: string } | null`
- `resolveCostActor(...)`

These should live in a new shared utility, not inline inside page components.

## Supabase Schema / Migration Plan

### Migration 047 — External vendors and rate override columns

Add `supabase/migrations/047_costing_rates_and_external_vendors.sql`.

Before creating the file:

- check the current highest migration number in `supabase/migrations`
- renumber `047` / `048` if newer migrations have landed

This spec uses `047` / `048` as placeholders based on the repo state on 2026-04-02.

```sql
create table if not exists public.external_vendors (
  id text primary key,
  name text not null unique,
  daily_rate numeric(12,2) not null check (daily_rate >= 0),
  currency text not null check (currency in ('EUR','GBP','USD')),
  notes text,
  archived boolean not null default false,
  counts_toward_capacity boolean not null default false,
  working_days_per_week numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger external_vendors_updated_at
  before update on public.external_vendors
  for each row execute function update_updated_at_column();

alter table public.external_vendors enable row level security;

create policy "Authenticated users can manage external_vendors"
  on public.external_vendors for all
  using (auth.role() = 'authenticated');

grant select, insert, update, delete on public.external_vendors to authenticated;

alter table public.team_members
  add column if not exists worker_type text not null default 'internal'
    check (worker_type in ('internal','external')),
  add column if not exists external_vendor_id text references public.external_vendors(id) on delete set null,
  add column if not exists daily_rate_override numeric(12,2),
  add column if not exists daily_rate_currency text
    check (daily_rate_currency in ('EUR','GBP','USD'));

alter table public.business_contacts
  add column if not exists daily_rate_override numeric(12,2),
  add column if not exists daily_rate_currency text
    check (daily_rate_currency in ('EUR','GBP','USD'));

alter table public.business_teams
  add column if not exists daily_rate_override numeric(12,2),
  add column if not exists daily_rate_currency text
    check (daily_rate_currency in ('EUR','GBP','USD'));
```

Notes:

- `worker_type` defaults safely to `internal`.
- External named people can optionally link to `external_vendor_id`.
- Business team rates are only for placeholders; business contacts still follow person override then global business rate.
- This migration assumes the `business_teams` table already exists from migration `036`; if not, apply `036` first or merge the create-table step into this migration.

### Required placeholder backfill / compatibility step

The current app emits business-team placeholders as `TEAM:<businessTeamName>`.

Costing must normalize to `TEAM:<businessTeamId>`. That requires both data backfill and runtime compatibility:

- SQL backfill for relational portfolio rows:
  - update `epic_phase_assignments.member_id`
  - any other relational text columns that store business-team placeholder IDs
- application-level normalization for JSON/local data:
  - `Scenario.portfolioPhaseAssignments`
  - persisted localStorage snapshots
  - any in-memory rows loaded from older exports or stale cached state

Required implementation rule:

- add a compatibility resolver that can map legacy `TEAM:<businessTeamName>` to the matching `business_teams.id`
- keep that resolver in place for at least one release after the migration ships

Do not rely on SQL backfill alone; it will not cover local-only and cached scenario data.

### Migration 048 — Direct-cost persistence

Add `supabase/migrations/048_initiative_costs.sql`.

```sql
create table if not exists public.initiative_costs (
  id uuid primary key default gen_random_uuid(),
  initiative_kind text not null
    check (initiative_kind in ('portfolio_epic','scenario_project')),
  initiative_id text not null,
  scenario_id uuid references public.scenarios(id) on delete cascade,
  contingency_pct numeric(5,2) not null default 0
    check (contingency_pct >= 0 and contingency_pct <= 100),
  hardware jsonb,
  licenses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (initiative_kind, initiative_id, scenario_id),
  check (
    (initiative_kind = 'portfolio_epic' and scenario_id is null) or
    (initiative_kind = 'scenario_project' and scenario_id is not null)
  )
);

create trigger initiative_costs_updated_at
  before update on public.initiative_costs
  for each row execute function update_updated_at_column();

create index if not exists initiative_costs_kind_id_idx
  on public.initiative_costs(initiative_kind, initiative_id);

create index if not exists initiative_costs_scenario_idx
  on public.initiative_costs(scenario_id);

alter table public.initiative_costs enable row level security;

create policy "Authenticated users can manage initiative_costs"
  on public.initiative_costs for all
  using (auth.role() = 'authenticated');
```

Notes:

- `portfolio_epic` covers both Jira epics and manual portfolio epics because both already have stable `epicKey`.
- `scenario_project` is keyed by `Project.id` plus `scenario_id`.
- `licenses` stays JSONB because ordering and freeform notes matter more than relational querying in v1.
- The `check` constraint is intentionally a schema-level v1 limitation: portfolio-epic direct costs cannot be scenario-scoped. Supporting per-scenario direct-cost overrides for portfolio epics would require a schema change, not just a UI change.

### No migration needed for global costing settings

`reportingCurrency`, `supportedCurrencies`, `fxToEur`, and global rates are stored inside the existing `settings` JSON row.

## Sync / Store Changes

### `frontend/src/stores/appStore.ts`

- Extend `defaultSettings` with:

```ts
costing: {
  reportingCurrency: 'EUR',
  supportedCurrencies: ['EUR', 'GBP', 'USD'],
  fxToEur: { EUR: 1, GBP: 1.17, USD: 0.92 },
  internalItDailyRate: { amount: 0, currency: 'EUR' },
  businessDailyRate: { amount: 0, currency: 'EUR' },
}
```

- Extend `defaultAppState` with:

```ts
externalVendors: [],
initiativeCosts: [],
```

- Update `migrate()` and `mergeSettingsWithDefaults()` so old local/Supabase data receives a full costing object automatically.

### `frontend/src/services/supabaseSync.ts`

Load:

- include `external_vendors`
- include `initiative_costs`
- map new columns on `team_members`, `business_contacts`, `business_teams`
- map nested `settings.costing`

Save:

- add `syncExternalVendors()`
- add `syncInitiativeCosts()`
- extend:
  - `syncTeamMembers()`
  - `syncBusinessContacts()`
  - `syncBusinessTeams()`
  - `syncSettings()`

Important:

- keep graceful fallback behavior like the rest of this file
- if migration 047 or 048 is missing, log a clear warning and skip only the costing slice instead of failing all sync

### `frontend/src/stores/actions.ts`

Add actions:

- `addExternalVendor`
- `updateExternalVendor`
- `deleteExternalVendor`
- `upsertInitiativeCost`
- `deleteInitiativeCost`

Update scenario lifecycle:

- `duplicateScenario()`
  - clone `initiativeCosts` rows where `scenarioId === sourceScenario.id`
  - rewrite cloned rows to new `scenarioId`
  - explicitly skip shared `portfolio_epic` rows where `scenarioId` is `null`
- `deleteScenario()`
  - remove `initiativeCosts` rows where `scenarioId === scenarioId`
- `createPortfolioScenario()` and `updatePortfolioScenario()`
  - no cloning of portfolio direct costs; shared baseline rows remain referenced by `epicKey`

## Shared Utilities / Hooks

Create these before touching screen code.

### `frontend/src/utils/currency.ts`

Responsibilities:

- convert source money to EUR
- convert EUR to reporting currency
- format currency for chips/cards/tables

Canonical rule:

- `fxToEur[currency]` means `1 unit of currency = X EUR`
- conversion path is always:
  - source currency -> EUR
  - EUR -> reporting currency

This makes reporting currency changes safe without rewriting stored values.

### `frontend/src/utils/costing.ts`

Responsibilities:

- resolve assignee actor from ID
- resolve effective daily rate
- calculate labor cost from assigned days
- calculate contingency
- calculate direct-cost totals
- aggregate by initiative / scenario / portfolio
- return warning flags for missing rate / missing FX / invalid cost record

Suggested exports:

- `resolveEffectiveDailyRate(...)`
- `calculateAssignmentLaborCost(...)`
- `calculateInitiativeCostBreakdown(...)`
- `calculateScenarioCostSummary(...)`
- `calculatePortfolioCostSummary(...)`

### `frontend/src/utils/assignableActors.ts`

Responsibilities:

- placeholder ID helpers
- display names for chips and breakdown rows
- "is capacity-backed" decision for calculations

This avoids duplicating `TEAM:` / `VENDOR:` parsing across:

- Portfolio Planning
- Scenario Planner
- Team/Settings forms
- report surfaces

## Calculation Rules

### Labor

Base formula:

`labor cost = assigned days * effective daily rate`

No phase-specific rates in v1.

### Effective daily rate precedence

#### Internal IT named person

1. `TeamMember.dailyRateOverride + dailyRateCurrency`
2. global `settings.costing.internalItDailyRate`

#### External IT named person

1. `TeamMember.dailyRateOverride + dailyRateCurrency`
2. linked `ExternalVendor.dailyRate + currency`
3. missing-rate warning

#### External vendor/team placeholder

1. `ExternalVendor.dailyRate + currency`
2. missing-rate warning

#### Business contact

1. `BusinessContact.dailyRateOverride + dailyRateCurrency`
2. global `settings.costing.businessDailyRate`

#### Business team placeholder

1. `BusinessTeam.dailyRateOverride + dailyRateCurrency`
2. global `settings.costing.businessDailyRate`

### Direct costs

- licenses: sum of line items
- hardware: one optional line item
- direct costs do not receive contingency

### Contingency

- stored as `contingencyPct`
- applied to total labor only
- not applied to licenses or hardware

Formula:

`contingency = laborTotalInReportingCurrency * (contingencyPct / 100)`

### Currency conversion

All raw values are stored in their entered currency.

All summaries are converted at read time using current FX rates.

This means FX edits in Settings immediately change:

- portfolio totals
- scenario totals
- report totals
- deltas

### Reporting total

`total = labor + contingency + licenses + hardware`

All totals shown in the reporting currency.

## Missing-data / Edge-case Rules

### Missing rate

If a staffing line has no resolvable rate:

- exclude that line from numeric totals
- mark the initiative breakdown as `hasMissingRate = true`
- show a warning badge in row chips/drawers/tables

Do not silently treat missing rate as zero-without-warning.

### Missing FX rate

If a currency is present in a cost line or rate but `fxToEur` is missing/invalid:

- exclude that line from totals
- mark `hasMissingFx = true`
- show a warning banner in the affected summary

### Placeholder capacity

- `TEAM:` and `VENDOR:` placeholders contribute cost
- they do not contribute availability or utilization unless a future release explicitly adds placeholder-capacity support

### Scenario delta vs baseline

For portfolio initiatives:

- compare scenario staffing-driven labor + contingency against baseline staffing-driven labor + contingency
- licenses/hardware stay shared unless edited in baseline

For scenario-native projects:

- delta vs baseline is `null`
- UI should render `—`

### Manual epic deletion

If a manual portfolio epic is deleted:

- remove shared `initiative_costs` row where:
  - `initiative_kind = 'portfolio_epic'`
  - `initiative_id = epicKey`

### Scenario deletion

If a scenario is deleted:

- remove `initiative_costs` rows with matching `scenario_id`
- shared portfolio rows remain untouched

## Screen-by-Screen UI Changes

### 1. Settings

Files:

- `frontend/src/pages/Settings.tsx`
- new `frontend/src/pages/settings/CostingSection.tsx`

Changes:

- Add `CostingSection` to the Planning group, after `GeneralSection`.
- Section contains:
  - reporting currency select
  - supported currency badges (`EUR`, `GBP`, `USD`) as read-only v1 scope
  - FX rate table keyed as "1 GBP = x EUR", "1 USD = x EUR"
  - global internal IT rate input + currency
  - global business rate input + currency
  - external vendor/team management list

Behavior:

- Saving writes only to `settings.costing` and `externalVendors`
- FX edits re-render reports immediately after state update

### 2. Team / IT member setup

Files:

- `frontend/src/components/forms/TeamMemberForm.tsx`
- `frontend/src/pages/Team.tsx`

Changes:

- Add `Worker Type` toggle:
  - `Internal IT`
  - `External IT`
- If `External IT`:
  - show optional `Vendor / Team` select
  - show helper text for rate precedence
- Add optional personal rate override inputs:
  - amount
  - currency
- Add small badges/columns in Team list:
  - internal/external
  - override present

Behavior:

- Internal members default to global internal rate when override blank
- External named people default to linked vendor rate when override blank

### 3. Business contacts and business teams

Files:

- `frontend/src/pages/settings/BusinessContactsSection.tsx`
- `frontend/src/pages/settings/BusinessTeamsSection.tsx`

Changes:

- `BusinessContactsSection`
  - add optional rate override amount + currency in add/edit modal
- `BusinessTeamsSection`
  - change from name-only list to editable list/card
  - add optional team placeholder rate + currency

Behavior:

- Business contact override is per person
- Business team rate is used only for `TEAM:<id>` placeholder assignments

### 4. Portfolio Planning

Files:

- `frontend/src/pages/PortfolioPlanning.tsx`
- `frontend/src/pages/PortfolioPlanning.css`
- `frontend/src/hooks/usePortfolioPlan.ts`

Changes:

- Summary tab:
  - replace/add KPI row with:
    - Labor
    - Contingency
    - Licenses
    - Hardware
    - Total
  - add `Cost by Initiative` table:
    - Epic/Project
    - Labor
    - Contingency
    - Direct Costs
    - Total
    - Delta vs Baseline
- Epic rows:
  - add compact cost chip beside the epic title, e.g. `EUR 113k`
- Cost drawer:
  - right-side drawer, separate from existing "Add Epics" drawer state
  - opens from epic row cost chip
  - shows:
    - total
    - delta vs baseline
    - labor by Internal IT / External IT / Business
    - staffing-line breakdown
    - license lines
    - hardware line
    - contingency %

Editing rules:

- baseline portfolio view:
  - full edit allowed
- portfolio scenario view:
  - staffing-derived labor updates from scenario assignments
  - direct costs are shown as shared baseline values
  - direct-cost fields are read-only
  - show helper text explaining that direct costs are shared from baseline and must be edited there

Final v1 rule:

- baseline only can edit direct costs
- portfolio scenario view is read-only for direct-cost fields

### 5. Scenario creation / scenario-native projects

Files:

- `frontend/src/components/ScenarioWizard.tsx`
- `frontend/src/pages/Scenarios.tsx`
- `frontend/src/stores/actions.ts`

Changes:

- Scenario Wizard:
  - after project definition, add optional cost step or expandable section
  - fields:
    - licenses
    - hardware
    - contingency %
- Scenario cards/list:
  - show total scenario cost chip
  - show delta vs baseline where applicable

Behavior:

- scenario-native project direct costs create `initiative_costs` rows with:
  - `initiative_kind = 'scenario_project'`
  - `initiative_id = project.id`
  - `scenario_id = created scenario id`

Delivery note:

- this is part of the broader design, but if the rollout is split this moves to v1.1 after the core admin + Portfolio Planning costing release

### 6. Scenario Planner summary surfaces

Files:

- `frontend/src/components/planner/PlannerSummaryView.tsx`
- `frontend/src/pages/ScenarioPlanner.tsx`

Changes:

- Add read-only cost KPI cards to the Summary mode:
  - Labor
  - Direct Costs
  - Total
  - Delta vs baseline

Behavior:

- labor is derived from planner assignees in the active scenario
- direct costs only appear for scenario-native projects that have canonical project IDs
- for planner items without supported direct-cost scope, show labor only

Note:

- v1 does not add full direct-cost editing to `PlannerDetailPanel.tsx`
- that page does not consistently map to a single cost-bearing initiative today

### 7. Executive Report

Files:

- `frontend/src/pages/Report.tsx`
- `frontend/src/components/report/ReportPDF.tsx`

Changes:

- Add a `Cost Overview` section to screen + PDF
- Include:
  - labor
  - direct costs
  - contingency
  - total
  - delta vs baseline
- Add a small note when totals exclude missing-rate or missing-FX lines

Implementation note:

- `Report.tsx` screen formatting can reuse the normal currency formatter
- `ReportPDF.tsx` should use a PDF-safe formatter/helper rather than relying on browser-only locale assumptions inside render code

Delivery note:

- if we split rollout, Report/PDF changes are v1.1 rather than the initial v1.0 ship

## Files Affected

### New files

- `frontend/src/pages/settings/CostingSection.tsx`
- `frontend/src/utils/currency.ts`
- `frontend/src/utils/costing.ts`
- `frontend/src/utils/assignableActors.ts`
- `frontend/src/utils/costing.test.ts`
- `supabase/migrations/047_costing_rates_and_external_vendors.sql`
- `supabase/migrations/048_initiative_costs.sql`

### Existing files to edit

- `frontend/src/types/index.ts`
- `frontend/src/stores/appStore.ts`
- `frontend/src/stores/actions.ts`
- `frontend/src/services/supabaseSync.ts`
- `frontend/src/components/forms/TeamMemberForm.tsx`
- `frontend/src/pages/settings/BusinessContactsSection.tsx`
- `frontend/src/pages/settings/BusinessTeamsSection.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/pages/PortfolioPlanning.tsx`
- `frontend/src/pages/PortfolioPlanning.css`
- `frontend/src/hooks/usePortfolioPlan.ts`
- `frontend/src/components/ScenarioWizard.tsx`
- `frontend/src/pages/Scenarios.tsx`
- `frontend/src/components/planner/PlannerSummaryView.tsx`
- `frontend/src/pages/Report.tsx`
- `frontend/src/components/report/ReportPDF.tsx`

## Test Plan

### Utility tests

- rate precedence:
  - internal override beats global internal
  - external person override beats vendor rate
  - external vendor placeholder uses vendor rate
  - business team placeholder uses team rate then global business
- FX conversion:
  - EUR -> EUR
  - GBP -> EUR
  - USD -> EUR
  - EUR -> reporting USD via EUR bridge
- contingency:
  - applies to labor only
  - does not change direct-cost totals
- missing data:
  - missing rate flags breakdown and excludes line from totals
  - missing FX flags breakdown and excludes line from totals

### Integration tests

- cloning a scenario clones only `scenario_project` cost rows
- deleting a scenario removes its `scenario_project` cost rows
- deleting a manual epic removes its shared `portfolio_epic` cost row
- changing FX in Settings changes displayed totals without rewriting stored records
- portfolio scenario delta changes when staffing changes but shared direct costs stay constant

## Delivery Sequence

### Step 1 — Shared model + utilities

- types
- `appStore` defaults/migration
- `currency.ts`
- `assignableActors.ts`
- `costing.ts`
- utility tests

### Step 2 — Persistence

- migrations 047 and 048
- `supabaseSync.ts` load/save support
- CRUD actions for vendors and initiative costs
- scenario clone/delete hooks

### Step 3 — Admin/setup UI

- `CostingSection`
- Team member form updates
- business contact/team rate fields

### Step 4 — Portfolio Planning

- first task: normalize business-team placeholders to `TEAM:<businessTeamId>` on the write path and add legacy `TEAM:<businessTeamName>` read compatibility/backfill support
- portfolio summary cards/table
- epic-row cost chip
- cost drawer
- shared baseline cost editing

### Step 5 — Scenario/report surfaces (v1.1 if phased)

- scenario wizard project cost capture
- scenario summary cards
- executive report/PDF cost section

## Implementation Notes / Risks

- `business_teams` currently use `name` heavily in the UI. For costing, all placeholder IDs should use `TEAM:<businessTeamId>`, not `TEAM:<businessTeamName>`, so renaming a team does not orphan cost references.
- `PortfolioPlanning.tsx` currently constructs team placeholders with `TEAM:${bt.name}`. This must be changed as part of Step 4, otherwise rates and rename safety will break.
- Some older rows may predate new team-rate columns. `supabaseSync.ts` should preserve its current "partial migration tolerance" pattern.
- `PlannerAssignment` and `Assignment` still use the field name `memberId`; that is acceptable in v1, but all new helper code must treat it as a generic assignee ID, not necessarily a literal team-member ID.
- Because direct costs are read-time converted, totals will change when FX changes. This is correct for v1 reporting, but it is not suitable for historical financial close; that remains out of scope.

## Recommended First Build Slice

Contractual v1.0 slice:

1. Step 1
2. Step 2
3. Settings + Team admin UI
4. Portfolio Planning Summary tab + epic cost chip + read-only drawer

Explicitly deferred to v1.1:

- Scenario Wizard cost capture
- Scenario summary/reporting extensions outside Portfolio Planning
- Executive Report / PDF cost export updates

That delivers the core costing module before adding scenario-project editing and report export updates.
