# Mileway IT Capacity Planner — Architecture

> **Last updated:** March 2026  
> This document is the single authoritative architectural reference for the Capacity Planner application. It covers the full stack: frontend, state, database, security, integrations, and deployment.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Layout](#2-repository-layout)
3. [Technology Stack](#3-technology-stack)
4. [Frontend Architecture](#4-frontend-architecture)
   - 4.1 [Entry Point & Routing](#41-entry-point--routing)
   - 4.2 [Component Hierarchy](#42-component-hierarchy)
   - 4.3 [Pages](#43-pages)
   - 4.4 [UI Primitives](#44-ui-primitives)
5. [State Management](#5-state-management)
   - 5.1 [Zustand Store Shape](#51-zustand-store-shape)
   - 5.2 [Mutation Flow](#52-mutation-flow)
   - 5.3 [Scenario System](#53-scenario-system)
   - 5.4 [Local vs Supabase Mode](#54-local-vs-supabase-mode)
6. [Data Model](#6-data-model)
   - 6.1 [TypeScript Interfaces](#61-typescript-interfaces)
   - 6.2 [Dual-Track Model (IT vs BIZ)](#62-dual-track-model-it-vs-biz)
7. [Database](#7-database)
   - 7.1 [Table Overview](#71-table-overview)
   - 7.2 [Migration History](#72-migration-history)
   - 7.3 [Row Level Security (RLS)](#73-row-level-security-rls)
   - 7.4 [RBAC](#74-rbac)
8. [Supabase Sync Layer](#8-supabase-sync-layer)
9. [Jira Integration](#9-jira-integration)
   - 9.1 [Connection Configuration](#91-connection-configuration)
   - 9.2 [Sync Flow](#92-sync-flow)
   - 9.3 [Hierarchy Modes](#93-hierarchy-modes)
   - 9.4 [Stale Items](#94-stale-items)
   - 9.5 [CORS Proxy](#95-cors-proxy)
10. [Capacity Calculation Engine](#10-capacity-calculation-engine)
    - 10.1 [IT Capacity](#101-it-capacity)
    - 10.2 [Business Capacity](#102-business-capacity)
    - 10.3 [Confidence Buffers](#103-confidence-buffers)
11. [Gantt Engine](#11-gantt-engine)
    - 11.1 [Bar Positioning](#111-bar-positioning)
    - 11.2 [Date Resolution](#112-date-resolution)
    - 11.3 [Rollup](#113-rollup)
    - 11.4 [Clip Arrows](#114-clip-arrows)
    - 11.5 [Expand / Collapse](#115-expand--collapse)
    - 11.6 [Slide-Out Detail Panel](#116-slide-out-detail-panel)
12. [Authentication](#12-authentication)
13. [CSS & Design System](#13-css--design-system)
    - 13.1 [Tailwind Configuration](#131-tailwind-configuration)
    - 13.2 [Brand Tokens](#132-brand-tokens)
    - 13.3 [Gantt Bar Colours](#133-gantt-bar-colours)
14. [Utilities](#14-utilities)
15. [Testing](#15-testing)
16. [Deployment](#16-deployment)
17. [Local Development](#17-local-development)

---

## 1. Project Overview

The Mileway IT Capacity Planner is a **single-page React application** that helps the Mileway IT organisation plan and track team capacity across projects, sprints, and quarters. It supports:

- **IT team capacity tracking** — sprint/quarter availability, time-off, assignments
- **Business stakeholder tracking** — business contacts, their capacity, and project involvement
- **Jira integration** — live two-way sync with Jira Cloud, auto-creating projects/phases/assignments from epics, features, and stories
- **Scenario planning** — what-if analysis with deep data copies that can be promoted to baseline
- **Gantt visualisation** — percentage-based Gantt chart with quarter/year view modes and continuation arrows

There is **no server-side rendering**. The backend is fully managed by Supabase (PostgreSQL + Auth). A thin Vercel serverless function proxies Jira API calls to avoid CORS issues.

---

## 2. Repository Layout

```
capacity-planner-app/
├── frontend/           # Production React/Vite SPA — the live application
│   ├── src/            # All TypeScript/React source code
│   ├── public/         # Static assets
│   ├── package.json    # npm dependencies (React 19, Zustand 5, Supabase, etc.)
│   ├── vite.config.ts  # Vite build config (port 5173, @ alias)
│   ├── tailwind.config.js  # Tailwind theme (brand tokens, dark mode)
│   ├── tsconfig.json   # TypeScript config (strict mode)
│   ├── vitest.config.ts    # Unit test config (happy-dom)
│   └── vercel.json     # Vercel SPA rewrites + Jira proxy route
│
├── supabase/
│   ├── schema.sql      # Original baseline schema
│   └── migrations/     # 18 incremental SQL migrations (001–018)
│
├── api/
│   └── jira.js         # Vercel serverless function — Jira CORS proxy
│
├── docs/               # Documentation
├── reference/          # Static HTML prototypes (legacy, no build needed)
├── js/                 # Vanilla JS prototype (legacy)
├── css/                # Legacy CSS
├── .cursor/            # Cursor AI rules, skills, settings
├── vercel.json         # Root-level Vercel config
└── index.html          # Legacy HTML entry (prototype only)
```

The **only production artifact** is `frontend/`. Everything else is legacy, reference, or tooling.

---

## 3. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 19.2 |
| Language | TypeScript | 5.9 |
| Build Tool | Vite | 5.4 |
| Styling | Tailwind CSS | 3.4 |
| State Management | Zustand | 5.0 |
| Database | Supabase (PostgreSQL) | hosted |
| Auth | Supabase Auth (GoTrue) | hosted |
| Router | React Router DOM | 7.13 |
| Date Utilities | date-fns | 4.1 |
| Icons | lucide-react | 0.563 |
| XLSX Import/Export | xlsx | 0.18.5 |
| Async State (minimal) | TanStack Query | 5.90 |
| Testing | Vitest + happy-dom | 4.0 |
| Deployment | Vercel | — |
| Node | LTS | 20.x |

---

## 4. Frontend Architecture

### 4.1 Entry Point & Routing

**`main.tsx`** is the React entry point (`ReactDOM.createRoot`). It mounts `<App />`.

**`App.tsx`** orchestrates:
- Supabase initialisation on first mount (`initializeFromSupabase()`)
- Auth gate — shows `<Login />` if Supabase is configured and no session exists
- View routing — URL path is synced **two-ways** with the Zustand `currentView` store value
- Keyboard shortcut registration (`1`–`6` for views, `Ctrl+K` for command palette, `Escape` for modals)

**URL routing** uses React Router DOM v7. The path map is:

| URL Path | View | Component |
|---|---|---|
| `/` | `dashboard` | `Dashboard` |
| `/timeline` | `timeline` | `Timeline` |
| `/epics` | `projects` | `Projects` |
| `/team` | `team` | `Team` |
| `/scenarios` | `scenarios` | `Scenarios` |
| `/settings` | `settings` | `Settings` |

### 4.2 Component Hierarchy

```
App.tsx
└── Layout.tsx                    # App shell (sidebar + main area)
    ├── Sidebar.tsx               # Navigation, sync indicator, scenario chip, dark mode
    │   └── ScenarioSelector.tsx  # Active scenario switcher
    ├── Header.tsx                # Top bar (collapsed sidebar variant)
    └── <Page />                  # One of the pages below
        └── PageHeader.tsx        # Per-page title + actions slot
```

Top-level modals and banners rendered outside the layout tree:
- `NotificationBanners.tsx` — global info/warning banners
- `CommandPalette.tsx` — Ctrl+K overlay
- `KeyboardShortcutsModal.tsx` — `?` help overlay
- `ScenarioDiffModal.tsx` — diff review before applying a scenario
- `Toast.tsx` — ephemeral feedback toasts
- `ConfirmModal.tsx` — destructive action confirmations

### 4.3 Pages

| Page | File | Sub-modes |
|---|---|---|
| Dashboard | `Dashboard.tsx` | Capacity heatmap + utilization summary |
| Timeline | `Timeline.tsx` | Gantt sub-mode / Team capacity sub-mode |
| Projects (Epics) | `Projects.tsx` | JiraHierarchyTree + BIZ assignment management |
| Team | `Team.tsx` | IT members tab / Business Contacts tab |
| Scenarios | `Scenarios.tsx` | Scenario cards + create/diff/promote |
| Settings | `Settings.tsx` | Tabbed sections (see below) |
| Login | `Login.tsx` | Supabase email sign-in |

Settings sub-sections (`pages/settings/`):

| Section | File | Purpose |
|---|---|---|
| General | `GeneralSection.tsx` | App name, fiscal year, BAU reserve |
| Jira | `JiraSection.tsx` | Connection form + sync trigger |
| Holidays | `HolidaysSection.tsx` | Country-level public holiday management |
| Sprints | `SprintsSection.tsx` | Sprint definitions + generation |
| Roles | `RolesSection.tsx` | Role reference data |
| Countries | `CountriesSection.tsx` | Country list + flags |
| Systems | `SystemsSection.tsx` | System/product reference data |
| Business Contacts | `BusinessContactsSection.tsx` | BIZ contact management |
| Data | `DataSection.tsx` | Export/import XLSX, reset data |

### 4.4 UI Primitives

Located in `components/ui/`:

`Button`, `Card`, `Modal`, `Select`, `Toast`, `Skeleton`, `ProgressBar`, `AvatarStack`, `EmptyState`, `ErrorBoundary`, `CapacityTooltip`, `ChartTooltip`, `CommandPalette`, `KeyboardShortcutsModal`, `ConfirmModal`, `MemberCalendarModal`, `LoadingScreen`

All primitives are hand-written (no external component library). They use Tailwind utility classes exclusively and respect the `dark:` variant.

**Forms** (`components/forms/`):

`AssignmentModal`, `TeamMemberForm`, `TimeOffForm`, `SprintForm`, `ProjectForm`, `JiraConnectionForm`

---

## 5. State Management

All application state lives in a **single Zustand store** defined in `stores/appStore.ts`.

### 5.1 Zustand Store Shape

```typescript
// Data (AppState)
settings, countries, publicHolidays, roles, skills, systems,
squads, processTeams, teamMembers, projects, assignments,
timeOff, quarters, sprints, jiraConnections, jiraWorkItems,
jiraSettings, scenarios, activeScenarioId,
businessContacts, businessTimeOff, businessAssignments,
jiraItemBizAssignments, localPhases,
version, lastModified

// UI state (not persisted to Supabase)
isLoading, isInitializing, syncStatus, syncError,
currentView, teamViewMode, projectViewMode, timelineViewMode,
filters, sortConfigs, dashboardPeopleFilter
```

The store uses Zustand's `persist` middleware with a custom `localStorage` serialiser for backward compatibility. The storage key is `STORAGE_KEY` (defined in `appStore.ts`).

### 5.2 Mutation Flow

```
User action (click, form submit)
  ↓
actions.ts helper (synchronous, pure)
  ↓
useAppStore.getState().updateData(partialAppState)
  ↓ if activeScenarioId + scenario-tracked field
    → update scenario data inside scenarios[]
  ↓ else
    → update baseline AppState
  ↓
localStorage.setItem(STORAGE_KEY, newState)   ← immediate, synchronous
  ↓
scheduleSyncToSupabase(newState)              ← 1 500 ms debounce
  ↓
supabaseSync.saveToSupabase()
  → 21 parallel upserts via Promise.allSettled
  → syncStatus: 'saving' → 'saved' | 'error'
```

`actions.ts` (~1 200 lines) is organised into sections: Project, Phase, Assignment, TeamMember, TimeOff, Settings, Sprint, Jira, Scenario, BusinessContact. Every exported function calls `useAppStore.getState().updateData(...)` directly — no async, no reducers.

**`getCurrentState()`** is the primary data access selector used by all components. It merges the active scenario's data fields over the baseline:

```typescript
function getCurrentState(): AppState {
  if (!activeScenarioId) return data;
  const scenario = data.scenarios.find(s => s.id === activeScenarioId);
  return { ...data, ...scenario?.data };  // scenario fields override baseline
}
```

Non-scenario-tracked fields (`settings`, `countries`, `roles`, `skills`, `systems`, `squads`, `processTeams`, `publicHolidays`, `sprints`) always come from the baseline regardless of which scenario is active.

**Exported selectors**: `useCurrentView`, `useSettings`, `useTeamMembers`, `useProjects`, `useCurrentState`, `useSyncStatus`, `useActiveScenario`, `useScenarios`, `useJiraWorkItems`, `useBusinessContacts`

### 5.3 Scenario System

A `Scenario` is a deep copy of five data arrays: `projects`, `teamMembers`, `assignments`, `timeOff`, `jiraWorkItems`. When a scenario is active, `getCurrentState()` returns the scenario's copies of those arrays instead of the baseline.

Key scenario actions:

| Action | Behaviour |
|---|---|
| `createScenario` | Deep-clones current baseline into a new scenario |
| `duplicateScenario` | Deep-clones an existing scenario |
| `switchScenario` | Sets `activeScenarioId`; `null` = back to baseline |
| `promoteScenarioToBaseline` | Overwrites baseline with scenario's data, clears scenario |
| `refreshScenarioFromJira` | Re-runs Jira sync within the scenario only |

`ScenarioDiffModal` provides a side-by-side visual diff (added/changed/removed) before the user applies a scenario.

### 5.4 Local vs Supabase Mode

The app detects mode via `isSupabaseConfigured()` (checks `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`):

| Mode | Auth | Persistence | RBAC |
|---|---|---|---|
| **Local** | None | `localStorage` only | `system_admin` (full access) |
| **Supabase** | Supabase Auth (email/password) | Supabase PostgreSQL + `localStorage` cache | `user_roles` table |

On first load with Supabase configured, `initializeFromSupabase()` runs with a 15 s timeout. On success, the store is populated from Supabase. On failure/timeout, the store falls back to the `localStorage` cache.

---

## 6. Data Model

### 6.1 TypeScript Interfaces

All interfaces live in `types/index.ts` — the single source of truth. Key types:

**`AppState`** — the complete application state (all entities).

**`TeamMember`**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `name` | `string` | |
| `role` | `string` | Role name (text, not FK) |
| `countryId` | `string` | FK → Country |
| `skillIds` | `string[]` | FK[] → Skill |
| `maxConcurrentProjects` | `number` | Default 3 |
| `email` | `string \| null` | Used for Jira auto-match |
| `jiraAccountId` | `string \| null` | Jira identity |
| `squadId` | `string \| null` | FK → Squad |
| `processTeamIds` | `string[]` | FK[] → ProcessTeam |
| `excludedFromCapacity` | `boolean` | Hides from all capacity calculations |
| `syncedFromJira` | `boolean` | Created by Jira sync |

**`Project`**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `name` | `string` | |
| `priority` | `'critical' \| 'high' \| 'medium' \| 'low'` | |
| `status` | `'planning' \| 'active' \| 'on_hold' \| 'completed'` | |
| `systemIds` | `string[]` | FK[] → System |
| `phases` | `Phase[]` | Embedded (not normalised in TS) |
| `archived` | `boolean` | |
| `jiraSourceKey` | `string \| null` | Epic/Feature key from Jira |
| `syncedFromJira` | `boolean` | |

**`Phase`**

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `name` | `string` | |
| `startDate` | `string \| null` | ISO 8601 |
| `endDate` | `string \| null` | ISO 8601 |
| `assignments` | `Assignment[]` | Embedded |
| `confidenceLevel` | `ConfidenceLevel` | `high \| medium \| low` |
| `jiraSourceKey` | `string \| null` | Feature key from Jira |

**`Assignment`**

| Field | Type | Notes |
|---|---|---|
| `projectId` | `string` | |
| `phaseId` | `string` | |
| `memberId` | `string` | |
| `quarter` | `string` | e.g. `"Q1 2025"` |
| `days` | `number` | Working days allocated |
| `sprint` | `string \| null` | Sprint name for sprint-level resolution |
| `jiraSynced` | `boolean` | Created by Jira story-point mapping |

**`JiraWorkItem`** — Full Jira issue model including sprint dates, confidence level, stale flag, and local mapping fields (`mappedProjectId`, `mappedPhaseId`, `mappedMemberId`).

**`JiraConnection`** — Full config: URL, email, API token, project key, hierarchy mode, JQL filter, custom field IDs for story points and sprints, auto-create flags, default days per item, sync history.

**`Scenario`** — Shallow wrapper + deep copies of `projects`, `teamMembers`, `assignments`, `timeOff`, `jiraWorkItems`.

**`BusinessContact`** — Mirrors `TeamMember` structure adapted for business-side users: `title`, `department`, `workingDaysPerWeek`, `workingHoursPerDay`, `bauReserveDays`, `processTeamIds`, `projectIds`.

**`LocalPhase`** — Manually managed phase (UAT/Hypercare/Custom) attached to a Jira Epic key: `jiraKey`, `type`, `name`, `startDate`, `endDate`.

**`Settings`** — `bauReserveDays`, sprint config, confidence level buffers (`high: 5%, medium: 15%, low: 25%`), dark mode, fiscal year.

**Enums**: `ConfidenceLevel`, `JiraStatusFilter`, `JiraHierarchyMode`, `ScenarioColor`

### 6.2 Dual-Track Model (IT vs BIZ)

The application has a fundamental dual-track model:

```
IT Track                             BIZ Track
────────────────────────────         ─────────────────────────────────
TeamMember                           BusinessContact
  └── Assignment (project/phase)       └── BusinessAssignment (project/phase)
  └── TimeOff                          └── BusinessTimeOff
  └── JiraWorkItem mapping             └── JiraItemBizAssignment (jira key)
```

Both tracks are rendered side-by-side in every capacity view and the Gantt slide-out panel. The IT track uses **blue** (`#0089DD`) and the BIZ track uses **purple** (`#7C3AED`) throughout the UI.

---

## 7. Database

The database is hosted on Supabase (PostgreSQL 15). All tables live in the `public` schema.

### 7.1 Table Overview

**Reference / lookup tables** (populated via Settings):

| Table | Key columns |
|---|---|
| `countries` | `id` (text PK), `code`, `name`, `flag` |
| `public_holidays` | `id`, `country_id`, `date`, `name` |
| `roles` | `id` (text PK), `name` |
| `skills` | `id`, `name`, `category` |
| `systems` | `id`, `name`, `description` |
| `squads` | `id`, `name` |
| `process_teams` | `id`, `name` |

**Core tables**:

| Table | Key columns |
|---|---|
| `team_members` | id, name, role, country_id, skill_ids (jsonb), max_concurrent_projects, email, jira_account_id, synced_from_jira, needs_enrichment, is_active, squad_id, process_team_ids (jsonb), excluded_from_capacity |
| `projects` | id, name, priority, status, system_ids (jsonb), phases (jsonb — nested phases with embedded assignments), devops_link, description, notes, start_date, end_date, archived, jira_source_key, synced_from_jira |
| `assignments` | id, project_id, phase_id, member_id, quarter, days, sprint, jira_synced — *denormalised flat copy mirroring embedded phase.assignments* |
| `time_off` | id, member_id, start_date, end_date, note |
| `sprints` | id, name, number, year, start_date, end_date, quarter, is_bye_week |
| `settings` | key (PK), value (jsonb) — rows: `settings`, `jiraSettings`, `activeScenarioId` |

**Jira tables**:

| Table | Key columns |
|---|---|
| `jira_connections` | Full connection config including api_token (stored as-is), hierarchy_mode, auto_create_projects, auto_create_assignments, default_days_per_item, sync_history (jsonb), jql_filter |
| `jira_work_items` | All Jira issue fields + sprint dates, confidence_level, stale_from_jira, mapped_project_id, mapped_phase_id, mapped_member_id |
| `scenarios` | id, name, description, is_baseline + jsonb arrays: projects, team_members, assignments, time_off, jira_work_items |

**Business tables**:

| Table | Key columns |
|---|---|
| `business_contacts` | id, name, title, department, email, country_id, working_days_per_week, working_hours_per_day, bau_reserve_days, process_team_ids, project_ids, notes, archived, excluded_from_capacity |
| `business_time_off` | id, contact_id, start_date, end_date, type, notes |
| `business_assignments` | id, contact_id, project_id, phase_id, quarter, days, notes |
| `jira_item_biz_assignments` | id, jira_key, contact_id, days, notes |
| `local_phases` | id, jira_key, type (uat/hypercare/custom), name, start_date, end_date |

**Auth/Security**:

| Table | Key columns |
|---|---|
| `user_roles` | user_id (FK → auth.users), role (`system_admin \| it_manager \| team_lead \| stakeholder`) |
| `schema_migrations` | version, applied_at |

> **Note on `projects.phases`**: The `phases` column is JSONB and stores the full nested `Phase[]` array (with embedded `Assignment[]`). The flat `assignments` table is a **denormalised mirror** maintained by `supabaseSync.ts` for potential query use. The canonical source is `projects.phases`.

### 7.2 Migration History

| # | File | Purpose |
|---|---|---|
| 001 | `001_add_app_sync.sql` | Initial v1: single JSONB blob store |
| 002 | `002_individual_tables.sql` | Switch to relational tables; add `team_members`, `projects`, `time_off`, `sprints`, `jira_connections`, `jira_work_items`, `scenarios` |
| 003 | `003_jira_led_import.sql` | Jira import behaviour columns on `jira_connections` |
| 004 | `004_squads_and_process_teams.sql` | Add `squads`, `process_teams` tables; `squad_id` + `process_team_ids` on `team_members` |
| 005 | `005_fix_public_holidays_id_type.sql` | Fix ID type inconsistencies in reference tables |
| 006 | `006_time_off_date_range.sql` | Replace quarter+days in `time_off` with `start_date`/`end_date` |
| 007 | `007_project_extended_fields.sql` | Add `notes`, `start_date`, `end_date`, `archived`, `jira_source_key`, `synced_from_jira` to `projects` |
| 008 | `008_fix_reference_table_id_types.sql` | Normalise text PKs across reference tables |
| 009 | `009_security_auth_rbac.sql` | Add `user_roles`; lock all tables to authenticated users; revoke anon access |
| 010 | `010_flatten_assignments.sql` | Add flat `assignments` table |
| 011 | `011_business_contacts.sql` | Add `business_contacts`, `business_time_off`, `business_assignments` |
| 012 | `012_jira_item_biz_assignments.sql` | Add `jira_item_biz_assignments` |
| 013 | `013_local_phases.sql` | Add `local_phases` |
| 014 | `014_jira_work_items_extra_cols.sql` | Add sprint dates, start/due dates, confidence level, stale flag to `jira_work_items` |
| 015 | `015_jira_item_biz_assign_days.sql` | Add `days` to `jira_item_biz_assignments` |
| 016 | `016_biz_contacts_extra_cols.sql` | Add `bau_reserve_days`, `process_team_ids` to `business_contacts` |
| 017 | `017_excluded_from_capacity.sql` | Add `excluded_from_capacity` to `team_members` and `business_contacts` |
| 018 | `018_verify_rls.sql` | Verification script to audit RLS policies |

### 7.3 Row Level Security (RLS)

RLS is **enabled on every table**. The policy for all app tables is:

```sql
FOR ALL USING (auth.role() = 'authenticated')
```

The `anon` role has had all privileges revoked. No data is accessible without a valid Supabase session.

### 7.4 RBAC

Roles are stored in the `user_roles` table (one row per user). The `useCurrentUser.ts` hook reads this after login.

| Role | Permissions |
|---|---|
| `system_admin` | Full access — create/edit/delete everything, manage users |
| `it_manager` | Manage team, projects, assignments; cannot manage users |
| `team_lead` | View and edit own team's assignments; no admin functions |
| `stakeholder` | Read-only access to capacity views |

In **local mode** (no Supabase), `useCurrentUser.ts` returns `role: 'system_admin'` unconditionally.

---

## 8. Supabase Sync Layer

**`services/supabaseSync.ts`** (~1 165 lines) handles all database I/O.

### Read — `loadFromSupabase()`

Runs a `Promise.all` across all 21 tables in parallel. Maps DB rows (snake_case) to TypeScript (camelCase). On partial failure (e.g. a missing column from an unapplied migration), the affected table is skipped and the rest of the state is still loaded.

### Write — `saveToSupabase()`

Runs a `Promise.allSettled` across all 21 tables in parallel. Collects per-table failures without aborting the others.

### Upsert Strategy — `upsertAndPrune()`

For each table:
1. Select all existing IDs for the current user
2. Compute the set of IDs to delete (existing − current)
3. Delete removed rows
4. Upsert all current rows (insert or update on conflict)

### Sync Scheduling

`scheduleSyncToSupabase()` is called by `updateData()` after every state change. It uses a 1 500 ms debounce — rapid sequential changes are coalesced into a single write.

### Migration-Aware Fallbacks

`syncTeamMembers` and `syncBusinessContacts` try up to three progressively simpler row shapes when an upsert fails. This handles databases where later migrations have not yet been applied (e.g. a local dev environment).

---

## 9. Jira Integration

### 9.1 Connection Configuration

Each `JiraConnection` stores:
- `baseUrl` — Jira Cloud instance URL
- `email` — Atlassian account email
- `apiToken` — Atlassian API token (stored in `jira_connections.api_token`)
- `projectKey` — Jira project key filter
- `jqlFilter` — optional raw JQL appended to the auto-built query
- `hierarchyMode` — `auto | epic_as_project | feature_as_project`
- `autoCreateProjects`, `autoCreateAssignments` — auto-build flags
- `defaultDaysPerItem` — fallback days when story points are absent
- Custom field IDs for story points, sprints (auto-discovered if not provided)
- `syncHistory` — JSONB array of past sync runs

### 9.2 Sync Flow

```
1. User triggers sync (Settings → Jira)
         ↓
2. jira.ts: fetchJiraIssues()
   - Builds JQL from enabled item types + status filters
   - Paginates (100 items/page, cursor-based)
   - Enriches with Agile Board API sprint data
   - Resolves custom field IDs (2-phase: metadata API → empirical probe)
   - Back-fills parent Epic keys for Features/Stories
         ↓
3. jiraSync.ts: fetchSyncPreview()
   - Computes JiraSyncDiff: toAdd / toUpdate / toRemove / toKeepStale
   - Refreshes stale items
         ↓
4. User reviews diff (ScenarioDiffModal) — or auto-applied
         ↓
5. jiraSync.ts: applySync()
   - Calls syncJiraWorkItems() → updates jiraWorkItems[] in store
   - Calls syncTeamMembersFromJira() → creates/updates TeamMembers
   - Calls buildProjectsFromJira() → creates/updates Projects + Phases
   - Calls buildAssignmentsFromJira() → creates sprint-level Assignments
         ↓
6. supabaseSync.ts persists all changes
```

### 9.3 Hierarchy Modes

| Mode | Jira Epic → | Jira Feature → |
|---|---|---|
| `auto` | Detected from item types in the response | Detected automatically |
| `epic_as_project` | Local Project | Local Phase |
| `feature_as_project` | Grouped under parent Epic | Local Project |

`detectHierarchyMode()` in `jiraProjectBuilder.ts` resolves `auto` at sync time by examining which item types are present in the response.

### 9.4 Stale Items

Items that disappear from Jira (deleted, moved project, filtered out) but have local mappings are marked `staleFromJira: true`. They are kept in the store and rendered with a visual warning. The user can manually unlink or delete them.

### 9.5 CORS Proxy

All Jira API calls in production go through a **Vercel serverless function** at `/api/jira` (`api/jira.js`). This avoids CORS issues since the Jira CORS policy only allows requests from Atlassian domains.

In development (`localhost`), `jira.ts` calls Jira directly via the Vite dev server proxy (configured in `vite.config.ts`).

---

## 10. Capacity Calculation Engine

All capacity logic lives in `utils/capacity.ts`.

### 10.1 IT Capacity

`calculateCapacity(member, quarter, state)`:

```
Available days
  = workdays in quarter (for member's country, excluding public holidays)
  − BAU reserve days (from settings)
  − time-off days (from TimeOff records overlapping the quarter)
  − project assignment days (sum of Assignment.days for this quarter)
  − Jira story-point-based days (getForecastedDays applied to mapped items)
```

`calculateCapacityBySquad()` and `calculateCapacityByProcessTeam()` aggregate individual member capacities by group.

`getWarnings()` scans all members and returns structured warnings for:
- Overallocation (> 100% utilization)
- High utilization (> 85%)
- Too many concurrent projects (> `maxConcurrentProjects`)
- Skill mismatches on assigned phases

### 10.2 Business Capacity

`calculateBusinessCapacity(contact, state)` and `calculateBusinessCapacityForQuarter(contact, quarter, state)`:

```
Available days
  = (workingDaysPerWeek / 5) × workdays in quarter
  − BAU reserve days (contact-level setting)
  − business time-off days
  − business assignment days (from BusinessAssignment records)
  − Jira item days (from JiraItemBizAssignment, forecasted by confidence)
```

### 10.3 Confidence Buffers

`utils/confidence.ts` — `getForecastedDays(rawDays, level)`:

| Level | Buffer | Forecasted = rawDays × (1 + buffer) |
|---|---|---|
| `high` | 5% | rawDays × 1.05 |
| `medium` | 15% | rawDays × 1.15 |
| `low` | 25% | rawDays × 1.25 |

`computeRollup()` recursively aggregates story-point forecasts from leaves up to Features and Epics.

---

## 11. Gantt Engine

The Gantt chart is implemented in `components/JiraGantt.tsx`. No third-party Gantt library is used.

### 11.1 Bar Positioning

Bars use **percentage-based `left` and `width`** (0.0–1.0 fractions converted to inline `%` styles) within a horizontally scrollable container. CSS grid is only used for column headers, never for bar placement.

```typescript
function barLayout(start: number, end: number, vStart: number, vEnd: number): BarLayout {
  const total = vEnd - vStart;
  const clipLeft  = start < vStart;
  const clipRight = end   > vEnd;
  const dStart = clipLeft  ? vStart : start;
  const dEnd   = clipRight ? vEnd   : end;
  return {
    left:  (dStart - vStart) / total,
    width: (dEnd   - dStart) / total,
    clipLeft,
    clipRight,
    hidden: end < vStart || start > vEnd,
  };
}
```

View modes:
- **Quarter mode** (default): `vStart`/`vEnd` = bounds of the currently selected quarter
- **Full year mode**: `vStart`/`vEnd` = full calendar year bounds

### 11.2 Date Resolution

Each `JiraWorkItem` goes through a **three-pass date resolution** in `itemDates()`:

1. **Pass 1 — Explicit Jira dates**: `item.startDate` / `item.dueDate`
2. **Pass 2 — Sprint object dates**: `item.sprintStartDate` / `item.sprintEndDate` (from Jira Agile Board API)
3. **Pass 3 — Sprint name lookup**: parses `item.sprintName` (e.g. `"Sprint 3"`) and looks up in the generated/saved sprints list

`LocalPhase` items use their explicit `startDate`/`endDate`.

### 11.3 Rollup

After leaf dates are resolved, a second pass rolls up parent dates:

- **Features**: `min(child.startDate)` → `max(child.endDate)`
- **Epics**: `min(feature.startDate)` → `max(feature.endDate)` (after features are already rolled up)

### 11.4 Clip Arrows

When a bar extends beyond the visible viewport, it is visually clipped and a **triangle arrow** is rendered using CSS pseudo-elements, indicating the bar continues beyond the edge.

```css
/* Applied when clipLeft = true */
.gantt-bar-clip-left {
  border-left: none;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.gantt-bar-clip-left::before {
  /* Left-pointing triangle at the left edge */
  border-right: 8px solid rgba(0,0,0,.22);
}

/* Applied when clipRight = true */
.gantt-bar-clip-right {
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.gantt-bar-clip-right::after {
  /* Right-pointing triangle at the right edge */
  border-left: 8px solid rgba(0,0,0,.22);
}
```

> **Critical rule**: Gantt rows must **never** have `overflow: hidden`. The pseudo-element triangles render outside the bar's own bounds and will be hidden if the row clips.

### 11.5 Expand / Collapse

The Gantt maintains two `Set<string>` states:
- `expandedEpics` — Epic `jiraKey`s currently expanded
- `expandedFeatures` — Feature `jiraKey`s currently expanded

A flat `rows` array is derived from these sets on each render. Each row has a `kind` (`'jira' | 'phase' | 'add-phase'`) and a `level` (0 = Epic, 1 = Feature, 2 = Story/Task/Bug). The label column and Gantt area render the same `rows` array in parallel to maintain vertical alignment.

**Expand All / Collapse All** populates both sets with all keys (or clears them).

### 11.6 Slide-Out Detail Panel

A single `SlidePanel` component is the universal detail view for all Jira items.

- **Trigger**: click any Gantt bar or any label row → `setPanelItem(item)`
- **Behaviour**: slides in from the right (`width: 420px`), backdrop overlay (`bg-black/20 backdrop-blur-[2px]`), closes via X / backdrop click / `Escape`
- **Transition**: `cubic-bezier(0.4,0,0.2,1)` 250 ms

**Content layout**:
1. Header: type chip + Jira key link + item summary
2. Assignees: two-column grid — IT (blue tint) | BIZ (purple tint)
3. Details: status badge, sprint name, date range, story points

---

## 12. Authentication

Authentication is provided by Supabase Auth (GoTrue). The guard is `isSupabaseConfigured()` which checks for the presence of `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**`hooks/useCurrentUser.ts`**:
- Subscribes to the Supabase `onAuthStateChange` event
- On login, queries `user_roles` for the user's RBAC role
- Exports a `can(action)` helper used by components to gate UI elements
- Returns `role: 'system_admin'` in local mode (no Supabase)

**`Login.tsx`**: Standard email/password form using `supabase.auth.signInWithPassword()`.

**RBAC enforcement**: The `can()` helper is checked in components before rendering write actions. Database-level enforcement is via RLS (all tables require `auth.role() = 'authenticated'`). There is currently no row-level role-based filtering in RLS beyond authentication.

---

## 13. CSS & Design System

### 13.1 Tailwind Configuration

`frontend/tailwind.config.js`:
- Font family: `Plus Jakarta Sans` (loaded from Google Fonts)
- Dark mode: `class`-based (toggled by adding `dark` class to `<html>`)
- Custom animations: `shimmer`, `slide-in-right`, `slide-in-up`, `fade-in`
- Custom surface tokens for dark mode: `mw.surface-dark`, `mw.card-border-dark`

### 13.2 Brand Tokens

| Token | Value | Usage |
|---|---|---|
| `mw-blue` / `mw.primary` | `#0089DD` | IT track, primary actions, Gantt bars, active states |
| `mw-purple` / `biz.DEFAULT` | `#7C3AED` | BIZ track, scenario labels, LocalPhase form |
| `mw-grey` | medium grey | Borders, muted text |
| `mw-grey-light` | light grey | Scrollbar thumb |
| `mw-grey-lighter` | lightest grey | Scrollbar track, surface-2 background |
| `mw-dark` | dark bg | Dark mode background |

### 13.3 Gantt Bar Colours

These are **hardcoded** in the `BAR` constant in `JiraGantt.tsx` (not CSS variables):

| Item Type | Fill | Border |
|---|---|---|
| Epic | `rgba(0,137,221,0.10)` | `#0089DD` 2 px |
| Feature | `#BAE0F7` | `#0089DD` 1 px |
| Story / Task | `#D0CCC8` | `#A09D97` 1 px |
| Bug | `#FECACA` | `#EF4444` 1 px |
| UAT (LocalPhase) | `#CDB0F5` | `#9B6EE2` 1 px |
| Hypercare (LocalPhase) | `#90D9B8` | `#1A7A52` 1 px |

Key global CSS custom properties (declared in `index.css`):

| Property | Value | Notes |
|---|---|---|
| `--today-line` | `#E63946` | Today vertical line in Gantt |
| `--current-sprint-bg` | `rgba(0,137,221,0.04)` | Current sprint column tint |

---

## 14. Utilities

| File | Purpose |
|---|---|
| `utils/capacity.ts` | IT + BIZ capacity calculations per quarter/sprint, overallocation warnings |
| `utils/calendar.ts` | `getWorkdaysInQuarter()`, `getWorkdaysInDateRange()`, `getCurrentQuarter()`, `generateQuarters()`, `parseQuarter()`, `prorateDaysToWeek()`, `getPhaseRange()`, `formatDisplayDate()` |
| `utils/confidence.ts` | `getForecastedDays(rawDays, level)`, `computeRollup()` |
| `utils/sprints.ts` | Sprint generation, `getWorkdaysInSprint()`, quarter → sprint lookup |
| `utils/projects.ts` | `flattenAssignmentsFromProjects()` — flattens nested phases.assignments to a flat array |

---

## 15. Testing

Tests use **Vitest** with **happy-dom** as the browser environment. Coverage is provided by `@vitest/coverage-v8`.

Test files are co-located with their utility modules:

| Test file | Covers |
|---|---|
| `utils/capacity.test.ts` | IT capacity calculations, overallocation detection |
| `utils/calendar.test.ts` | Working day math, quarter date bounds |
| `utils/confidence.test.ts` | Confidence buffer application and rollup |
| `utils/sprints.test.ts` | Sprint generation, quarter lookups |

Run tests:

```bash
cd frontend
npm run test          # watch mode
npm run test:run      # single run (CI)
npm run coverage      # coverage report
```

---

## 16. Deployment

The app is deployed on **Vercel**, auto-deploying from the `main` branch.

**`frontend/vercel.json`**:
- All unknown paths → `index.html` (SPA routing rewrite)
- `/api/jira` → Vercel serverless function (`api/jira.js`) — Jira CORS proxy

**Environment variables** (set in Vercel project settings):

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (for multi-user) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (for multi-user) | Supabase anon public key |

When these are absent, the app runs in local-only mode with no auth or persistence beyond `localStorage`.

---

## 17. Local Development

```bash
# Install dependencies
cd frontend
npm install

# Start dev server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

For Supabase connectivity, create `frontend/.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Without these variables the app runs fully offline using `localStorage`.

The `reference/` HTML prototypes can be opened directly in a browser with no build step.
