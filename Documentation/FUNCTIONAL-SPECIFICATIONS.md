# Functional Specifications
# Mileway IT Capacity Planner

**Version:** 1.2  
**Last Updated:** February 20, 2026  
**Owner:** Mileway IT Value Stream Finance  
**Status:** Living Document

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-20 | Initial draft |
| 1.1 | 2026-02-20 | P0 features: Supabase persistence, loading screen, sync indicator, import safeguard |
| 1.2 | 2026-02-20 | P1 features: Baseline warning banner, sync diff preview, token masking, sync history, scenario refresh preview |

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [User Roles & Stakeholders](#2-user-roles--stakeholders)
3. [System Overview](#3-system-overview)
4. [Core Data Model](#4-core-data-model)
5. [Feature Specifications](#5-feature-specifications)
   - 5.1 [Dashboard](#51-dashboard)
   - 5.2 [Timeline](#52-timeline)
   - 5.3 [Projects](#53-projects)
   - 5.4 [Team](#54-team)
   - 5.5 [Jira Integration](#55-jira-integration)
   - 5.6 [Scenario Planning](#56-scenario-planning)
   - 5.7 [Settings](#57-settings)
6. [Data Sync & Safety](#6-data-sync--safety)
7. [Capacity Calculation Engine](#7-capacity-calculation-engine)
8. [Warning System](#8-warning-system)
9. [Import & Export](#9-import--export)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Glossary](#11-glossary)

---

## 1. Purpose & Scope

### 1.1 Purpose

The Mileway IT Capacity Planner is an internal web application for the Mileway IT Value Stream Finance team to plan, visualise, and manage the capacity of IT specialists across projects and quarters. It allows planners to match available team capacity against planned project demand, identify overallocations, and model what-if scenarios.

### 1.2 Scope

**In scope:**
- Team member capacity management per quarter and per sprint
- Project and project phase planning with resource assignments
- Capacity utilisation calculations and overallocation warnings
- Gantt-style timeline visualisation
- Jira work item synchronisation and mapping
- What-if scenario modelling
- Data import and export (JSON and Excel)
- Public holiday management per country

**Out of scope:**
- Time tracking or timesheets
- Financial / cost calculations
- Task-level work management (use Jira for this)
- External stakeholder access

---

## 2. User Roles & Stakeholders

### 2.1 Current User Model

The application currently operates as a **single-tenant, authenticated** application. All authenticated users have full read/write access to all data.

| Actor | Description |
|-------|-------------|
| **Planner** | Primary user. Creates and manages projects, assigns team members, monitors capacity. |
| **Manager** | Reads capacity data to inform resourcing decisions. |
| **Admin** | Manages reference data (roles, skills, systems, countries, holidays, settings). |

> **Note:** Role-based access control (RBAC) is planned for a future release. See the Scaling Roadmap.

### 2.2 Future Roles (Planned)

| Role | Permissions |
|------|-------------|
| Viewer | Read-only access to all views |
| Member | View + manage own time off |
| Manager | View + create/edit projects and assignments |
| Admin | All of the above + reference data management |
| Owner | Full access including settings and user management |

---

## 3. System Overview

### 3.1 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    User Browser                          │
│  React 18 + TypeScript + Vite + Tailwind CSS + Zustand   │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼───────────────────────────────────┐
│              Vercel (Static Hosting + CDN)                │
└──────────────────────┬───────────────────────────────────┘
                       │ REST / Realtime
┌──────────────────────▼───────────────────────────────────┐
│         Supabase (PostgreSQL + Auth + REST API)           │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Navigation Structure

The application uses a persistent left sidebar for navigation with the following top-level views:

| View | Icon | Description |
|------|------|-------------|
| Dashboard | Chart | Capacity overview for the current quarter |
| Timeline | Calendar | Gantt-style view of projects and team capacity |
| Projects | Folder | Full project and phase management |
| Team | Users | Team member management |
| Jira | Link | Jira work item sync and mapping |
| Settings | Gear | All configuration and reference data |

A **Scenario Selector** is always visible in the top navigation bar, allowing users to switch between planning scenarios without leaving their current view.

### 3.3 Persistence

All data is persisted in **Supabase (PostgreSQL)** as the primary store. The application uses Row Level Security (RLS). The frontend state is managed with **Zustand** and keeps a local in-memory copy for fast rendering.

#### Write path
Changes are written to the `app_sync` table in Supabase using a **1.5-second debounced write**. Every mutation in the Zustand store schedules a sync; if more mutations occur within the window, the timer resets — batching rapid changes into a single write.

`localStorage` is kept as an **offline cache** and fallback. On startup the app loads from Supabase first; if Supabase is unavailable, it falls back to the cached local copy.

#### Sync status
A persistent **sync indicator** in the header shows the current state:

| Status | Indicator | Description |
|--------|-----------|-------------|
| Idle | — | No pending changes |
| Saving | Animated spinner + "Saving…" | Debounce window open, write pending |
| Saved | Green check + "Saved" | Last write succeeded |
| Error | Red warning + "Not saved — Retry" | Last write failed; retry button visible |
| Offline | Cloud-off icon + "Local only" | Supabase not configured or unreachable |

#### Unsaved-changes guard
If the user attempts to close or reload the browser tab while a save is in flight (`syncStatus === 'saving'`), a native browser confirmation dialog appears to prevent accidental data loss.

#### Initial loading screen
On first load, a full-screen loading indicator is shown while the application hydrates from Supabase. The screen is dismissed once data is ready (or after a timeout fallback to local cache).

---

## 4. Core Data Model

### 4.1 Reference Entities

These entities define the vocabulary of the system and are managed in Settings.

#### Country
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | string (2-10 chars) | ISO country code (e.g. `NL`, `UK`) |
| name | string | Display name |
| flag | string (optional) | Emoji flag |

#### Public Holiday
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| countryId | UUID → Country | Which country this holiday belongs to |
| date | date (YYYY-MM-DD) | Date of the holiday |
| name | string | Name of the holiday |

Holidays are used in capacity calculations to reduce the number of available workdays for each team member based on their country.

#### Role
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Role name (e.g. `SAP Specialist`, `Service Manager`) |

#### Skill
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Skill name (e.g. `SAP S/4HANA`, `Data Migration`) |
| category | enum | `System`, `Process`, or `Technical` |

#### System
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | System name (e.g. `ERP`, `TMS`) |
| description | string (optional) | Brief description |

### 4.2 Core Entities

#### Team Member
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Full name |
| role | string | Role name (denormalised from Roles) |
| countryId | UUID → Country | Determines which public holidays apply |
| skillIds | UUID[] → Skill | Skills the member possesses |
| maxConcurrentProjects | integer | Maximum number of projects allowed at once (default: 2) |
| email | string (optional) | Email address, used for Jira matching |
| jiraAccountId | string (optional) | Jira user account ID |
| syncedFromJira | boolean | True if auto-created from a Jira sync |
| needsEnrichment | boolean | True if the member is missing mandatory local fields after Jira sync |

#### Time Off
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| memberId | UUID → TeamMember | The team member |
| quarter | string | Format: `Q1 2026` |
| days | decimal | Number of days off in that quarter |
| reason | string (optional) | Reason (e.g. `Annual leave`, `Training`) |

Constraint: one record per member per quarter.

#### Project
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Project name |
| priority | enum | `High`, `Medium`, `Low` |
| status | enum | `Planning`, `Active`, `On Hold`, `Completed`, `Cancelled` |
| systemIds | UUID[] → System | Associated IT systems |
| devopsLink | string (optional) | URL to Azure DevOps or equivalent |
| description | string (optional) | Free-text description |
| phases | Phase[] | Ordered list of project phases |

#### Phase
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| projectId | UUID → Project | Parent project |
| name | string | Phase name (e.g. `Analysis`, `Build`, `UAT`) |
| startQuarter | string | Format: `Q1 2026` |
| endQuarter | string | Format: `Q3 2026` |
| requiredSkillIds | UUID[] → Skill | Skills required to work on this phase |
| predecessorPhaseId | UUID (optional) | Phase that must precede this one |
| sortOrder | integer | Display order within the project |
| assignments | Assignment[] | Resource allocations for this phase |

#### Assignment
| Field | Type | Description |
|-------|------|-------------|
| memberId | UUID → TeamMember | Assigned team member |
| quarter | string | Format: `Q1 2026` — always set |
| days | decimal | Days allocated in that quarter |
| sprint | string (optional) | Format: `Sprint 1 2026` — for sprint-level granularity |

Constraint: one record per phase + member + quarter combination.

#### Sprint
| Field | Type | Description |
|-------|------|-------------|
| id | string | e.g. `sprint-1-2026` |
| name | string | e.g. `Sprint 1` |
| number | integer | Sprint number within the year (1–16) |
| year | integer | Calendar year |
| startDate | date | Start date |
| endDate | date | End date |
| quarter | string | Parent quarter (`Q1 2026`) |
| isByeWeek | boolean | True if this sprint slot is a bye week |

### 4.3 Settings

Global application settings stored as a key-value record.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| bauReserveDays | integer | 5 | Days reserved per quarter per member for Business-As-Usual activities |
| hoursPerDay | integer | 8 | Working hours per day (used for display only) |
| defaultView | string | `dashboard` | Landing page view |
| quartersToShow | integer | 4 | Number of quarters visible in the timeline |
| defaultCountryId | UUID | NL | Default country for new team members |
| darkMode | boolean | false | UI theme preference |
| sprintDurationWeeks | integer | 3 | Duration of a sprint in weeks |
| sprintStartDate | date | 2026-01-05 | The start date of Sprint 1 |
| sprintsToShow | integer | 6 | Number of sprints visible in sprint timeline view |
| sprintsPerYear | integer | 16 | Total sprints per year |
| byeWeeksAfter | integer[] | [8, 12] | Sprint numbers after which a bye week is inserted |
| holidayWeeksAtEnd | integer | 2 | Holiday weeks reserved at end of year |

---

## 5. Feature Specifications

### 5.1 Dashboard

**Purpose:** Provide a quick, at-a-glance overview of team capacity for the current quarter.

#### 5.1.1 Summary Stats Bar

Four stat cards are displayed at the top of the Dashboard:

| Card | Metric | Calculation |
|------|--------|-------------|
| Team Members | Count of all team members | `teamMembers.length` |
| Active Projects | Count of projects with status `Active` or `Planning` | Filtered count |
| Avg Utilisation | Average utilisation % across all members | Sum of `usedPercent` / member count |
| Warnings | Total number of active warnings | Sum of all warning types |

The Warnings card uses a red background when there are warnings, and grey when none.

#### 5.1.2 Team Capacity Panel

Displays a capacity progress bar per team member for the **current quarter**.

Per member row:
- Member name and role
- Progress bar showing `usedDays / totalWorkdays`
  - Green: status = `normal` (< 85% utilised)
  - Amber: status = `warning` (85–100% utilised)
  - Red: status = `overallocated` (> 100% utilised)
- Status badge: `OK`, `High`, or `Over`

If no team members exist, a prompt to add members in Settings is shown.

#### 5.1.3 Warnings Panel

Lists all current warnings for the **current quarter**:

- **Overallocation** (red): `{Name} is overallocated — X days used / Y total days in {quarter}`
- **High Utilisation** (amber): `{Name} at X% — High utilisation in {quarter}`
- **Too Many Projects** (orange): `{Name}: N projects — Max concurrent: M`

If no warnings exist, a success message is shown.

#### 5.1.4 Quarter Overview

A 2×2 (or 1×4 on wide screens) grid showing a summary for each of the next **N** quarters (configurable via `quartersToShow` setting):

Per quarter tile:
- Quarter label (e.g. `Q1 2026`)
- Average utilisation %
- Count of overallocated members (shown in red if > 0)

---

### 5.2 Timeline

**Purpose:** Visualise project phases and team allocation across time on a Gantt-style chart.

#### 5.2.1 View Modes

Two view modes are available via toggle buttons:

| Mode | Description |
|------|-------------|
| **Projects** | Each row represents a project. Phases are shown as coloured bars spanning their quarter range. |
| **Team** | Each row represents a team member. A capacity bar is shown for each visible time period. |

#### 5.2.2 Granularity

Two granularity options are available:

| Granularity | Columns | Best For |
|-------------|---------|----------|
| **Quarter** | One column per quarter (e.g. `Q1 2026`) | Long-range planning |
| **Sprint** | One column per sprint (e.g. `Sprint 1`, `Sprint 2`) | Short-term detailed planning |

Bye weeks are visually indicated in sprint view.

#### 5.2.3 Navigation Controls

- **Left / Right arrows**: Shift the visible time window by one period (quarter or sprint group).
- **Quarters to show** dropdown: Configure how many quarters are visible at once.
- **Show Completed** toggle: Include / exclude projects with status `Completed`.
- The current quarter is visually highlighted.

#### 5.2.4 Projects View Details

Each project row shows:
- Project name and status badge
- Phase bars spanning their start–end quarter range, colour-coded by status:
  - Active → green
  - Planning → blue
  - On Hold → amber
  - Completed → grey
- Phase name label displayed inside the bar (truncated)

#### 5.2.5 Team View Details

Each team member row shows:
- Member name and role
- Per-period capacity bar: `usedDays / totalWorkdays`
- Utilisation percentage label
- Status colour (normal / warning / overallocated)

---

### 5.3 Projects

**Purpose:** Full CRUD management of projects and their phases, with direct assignment of team members to phases.

#### 5.3.1 Project List

Projects are displayed as expandable cards. The list supports:

- **Search** by project name (text input)
- **Filter by Status**: Planning / Active / On Hold / Completed / Cancelled
- **Filter by Priority**: High / Medium / Low
- **Filter by System**: Any system from the reference list

Each project card shows:
- Project name
- Priority badge (colour-coded)
- Status badge (colour-coded)
- Associated systems as tags
- DevOps link icon (if set)
- Action buttons: Edit, Duplicate, Delete, Expand phases

#### 5.3.2 Creating / Editing a Project

A modal form with the following fields:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| Name | text | Yes | Min 1 character |
| Priority | select | Yes | High / Medium / Low |
| Status | select | Yes | Planning / Active / On Hold / Completed / Cancelled |
| Systems | multi-select | No | From reference list |
| DevOps Link | URL | No | Valid URL format |
| Description | textarea | No | Free text |

On save, the project is persisted and the list is updated.

#### 5.3.3 Duplicating a Project

Copying a project creates a new project with:
- Name: `Copy of {original name}`
- All phases and their required skills are duplicated
- All assignments are **not** copied (new project starts with empty allocations)

#### 5.3.4 Deleting a Project

A confirmation dialog is shown before deletion. Deleting a project cascades and removes all its phases and associated assignments.

#### 5.3.5 Phase Management

Expanding a project card reveals its phases. Each phase shows:
- Phase name
- Quarter range (start → end)
- Required skills as tags
- Assigned team members with their allocated days per quarter

**Adding/Editing a Phase:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | text | Yes | |
| Start Quarter | select | Yes | From configured quarters list |
| End Quarter | select | Yes | Must be ≥ Start Quarter |
| Required Skills | multi-select | No | From reference list |
| Predecessor Phase | select | No | Another phase in the same project |
| Sort Order | integer | No | Controls display order |

#### 5.3.6 Resource Assignment

Clicking the **Assign Member** button on a phase opens the Assignment Modal.

The Assignment Modal allows:
- Selecting a team member from the team list
- Entering days allocated per quarter (for each quarter the phase spans)
- Sprint-level detail: optionally breaking down days by sprint within a quarter

When assigning, the modal shows the member's current capacity status per quarter to warn of overallocation before saving.

**Skill match indicator:** If the member lacks any of the phase's required skills, a warning icon is shown.

---

### 5.4 Team

**Purpose:** Manage team members and their time off.

#### 5.4.1 Team Member List

Displayed as a card grid. Supports:
- **Search** by name
- **Filter by Role**
- **Filter by Country**

Each member card shows:
- Member name
- Role badge
- Country flag + name
- Skills tags (System / Process / Technical, colour-coded by category)
- Max concurrent projects indicator
- Time off entries (if any)
- Jira sync indicator (if member was synced from Jira)
- Action buttons: Edit, Manage Time Off, Delete

#### 5.4.2 Creating / Editing a Team Member

A modal form with the following fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | text | Yes | |
| Role | select | Yes | From reference list |
| Country | select | Yes | Determines public holidays |
| Skills | multi-select | No | From reference list (grouped by category) |
| Max Concurrent Projects | integer | Yes | Default: 2 |
| Email | email | No | Used for Jira matching |

#### 5.4.3 Time Off Management

Each team member can have one time off record per quarter.

Time Off form fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Quarter | select | Yes | Format: `Q1 2026` |
| Days | decimal | Yes | Number of days off |
| Reason | text | No | Free text (e.g. `Annual leave`) |

Time off is deducted from the member's available capacity in that quarter.

#### 5.4.4 Deleting a Team Member

A confirmation dialog is shown. Deleting a team member removes all their assignments and time off records.

#### 5.4.5 Needs Enrichment Indicator

If a team member was created via Jira sync and is missing key fields (country, role), they are flagged with a `Needs Enrichment` warning badge. Clicking edit allows completing their profile.

---

### 5.5 Jira Integration

**Purpose:** Synchronise Jira work items into the planner and map them to local projects, phases, and team members. The integration is designed to be **non-destructive**: local mappings are always preserved, and every sync requires user review before data changes are applied.

#### 5.5.1 Jira Connection Management

Connections are managed in **Settings > Jira Integration**. Multiple connections are supported (one active at a time).

**Connection fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Connection Name | text | Yes | Display label |
| Jira Base URL | URL | Yes | e.g. `https://mileway.atlassian.net` |
| Project Key | text | Yes | Selected from live project list after a successful test |
| User Email | email | Yes | Jira account email |
| API Token | password | Yes | Jira API token — masked after save (US-010) |

**Actions:**
- **Test Connection** (US-009): Validates credentials and connectivity before the form can be saved. The form submit button is disabled until the test passes. When editing an existing connection, the previously saved credentials are used for the test by default (no need to re-enter the token).
- **Sync**: Opens the sync diff preview (see §5.5.6) — data is not changed until the user confirms.
- **Toggle Active**: Enables or disables a connection.
- **Delete**: Removes the connection and all its synced work items (after confirmation).

#### 5.5.1a API Token Security (US-010)

Jira API tokens are never displayed in plain text after being saved.

- When **creating** a connection: the token field is a standard password input with a show/hide toggle.
- When **editing** a saved connection: the token is shown as `••••••••abcd` (last 4 characters only). A **"Change Token"** button is required to enter a new token; otherwise the existing stored token is reused automatically.
- A "← Keep existing token" escape hatch returns to the masked view if the user clicked "Change Token" by mistake.

#### 5.5.1b Sync History Log (US-011)

Each completed sync (success or error) appends an entry to the connection's sync history (last 10 entries kept).

Each history entry contains:
- Timestamp
- Outcome (success / error)
- Items synced / created / updated / removed
- Number of local mappings preserved
- Error message (if applicable)

A **"History (N)"** toggle button appears on each connection card and expands an inline history panel.

#### 5.5.2 Jira Work Items View

The **Jira** page displays all synced work items with the following capabilities:

**Filters:**
- Search by summary or Jira key
- Filter by mapping status: All / Mapped / Unmapped
- Filter by issue type: All / Epic / Feature / Story / Task / Bug

**Group By:**
- Type (default)
- Status
- None (flat list)

**Work Item Card Fields:**
- Jira key (e.g. `MIT-123`) with external link
- Summary
- Type badge (colour-coded: Epic=purple, Feature=blue, Story=green, Task=cyan, Bug=red)
- Status badge (colour-coded by category: todo=grey, in_progress=blue, done=green)
- Assignee name (if set)
- Story points / estimate
- Sprint name (if set)
- Mapping status: which local project / phase / member it is mapped to

#### 5.5.3 Mapping Work Items

Each work item can be mapped to:
- A local **Project**
- A local **Phase** (within the mapped project)
- A local **Team Member**

Mapping is done inline from the work item card. Auto-mapping by name is available as a setting.

#### 5.5.4 Sync Team Members from Jira

A special sync action imports Jira users (based on assignees in work items) as team members. Members are created with:
- Name: Jira display name
- Email: Jira email
- `syncedFromJira = true`
- `needsEnrichment = true` (pending country, role assignment)

#### 5.5.5 Jira Sync Settings

Configurable in **Settings > Jira Integration**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Story Points to Days | decimal | 1.0 | Conversion ratio |
| Default Velocity | integer | 10 | Default sprint velocity |
| Sync Frequency | enum | `manual` | manual / hourly / daily |
| Auto-Map by Name | boolean | true | Auto-match Jira items to local projects by name |
| Sync Epics | boolean | true | |
| Sync Features | boolean | true | |
| Sync Stories | boolean | true | |
| Sync Tasks | boolean | true | |
| Sync Bugs | boolean | true | |
| Include Subtasks | boolean | false | |

#### 5.5.6 Sync Diff Preview (US-007)

Clicking **Sync** on a connection never immediately modifies stored data. Instead, the sync runs as a two-step process:

**Step 1 — Fetch & Diff:** The app fetches all matching issues from Jira and computes the diff against what is currently stored. No data is written.

**Step 2 — Preview Modal:** A modal displays colour-coded summary chips:

| Chip | Colour | Meaning |
|------|--------|---------|
| N new items to add | Green | Items in Jira not yet in the planner |
| N existing items to update | Blue | Items that already exist and will be refreshed |
| N items no longer in Jira | Red | Items that exist locally but have been deleted in Jira |
| N local mappings will be kept | Purple | Count of items with local project/phase/member mappings that are safe |

Items about to be **removed** are listed explicitly by Jira key and summary (with a "⚠ mapped" warning if a local mapping would also be lost).

The user must click **Apply Sync** to commit the changes, or **Cancel** to abort without any changes.

#### 5.5.7 Local Mapping Protection (US-008)

During a sync, the **smart merge** algorithm always preserves any local data the planner has set on a work item:

| Field | Behaviour |
|-------|-----------|
| `mappedProjectId` | Preserved — not overwritten by Jira data |
| `mappedPhaseId` | Preserved — not overwritten by Jira data |
| `mappedMemberId` | Preserved — not overwritten by Jira data |
| Jira-sourced fields (status, summary, assignee, etc.) | Updated from Jira |

The internal item `id` is also preserved, ensuring all downstream references remain stable. The count of preserved mappings is reported in the diff preview and in the post-sync success toast.

---

### 5.6 Scenario Planning

**Purpose:** Allow planners to create and compare alternative resource allocation scenarios (what-if analysis) without modifying the baseline Jira-synced data.

#### 5.6.1 Concepts

| Term | Definition |
|------|------------|
| **Baseline** | The primary data state. When Jira is connected, the baseline is refreshed on every sync and should be treated as the "source of truth from Jira". |
| **Scenario** | An editable copy of the baseline (or another scenario) where planners can freely modify projects, assignments, and team members. |
| **Active Scenario** | The scenario currently being viewed and edited. All views (Dashboard, Timeline, Projects, Team) reflect the active scenario's data. |

#### 5.6.2 Jira Baseline Warning Banner (US-006)

When the user is viewing the **Jira Baseline** (i.e. no scenario is active) **and** at least one Jira connection is configured, an **amber warning banner** is displayed below the navigation bar:

> **Jira Baseline** — Changes you make here will be overwritten on the next Jira sync.

The banner includes a **"Create Scenario to Edit Safely"** button that immediately creates a new scenario (pre-filled as a copy of the baseline) and switches to it.

The banner is hidden when:
- A scenario is already active (the user is editing safely)
- No Jira connections are configured (standalone usage without Jira)

#### 5.6.3 Scenario Selector

A dropdown in the top navigation bar always shows the **active scenario**. Clicking it opens:
- The name of the active scenario (or "Jira Baseline" if no scenario is active)
- A list of all saved scenarios
- Button: **New Scenario**

#### 5.6.4 Creating a Scenario

A modal prompts for:
- **Name** (required)
- **Based on**: Baseline data or duplicate from an existing scenario

The new scenario receives a full copy of the source data (projects, team members, assignments, time off, work items).

#### 5.6.5 Switching Scenarios

Clicking any scenario in the dropdown immediately switches all views to reflect that scenario's data. No page reload required.

#### 5.6.6 Editing a Scenario

Once a scenario is active, all Create/Edit/Delete operations apply only to that scenario's data. The baseline is never modified.

#### 5.6.7 Deleting a Scenario

A confirmation dialog is shown. Deleting a scenario is permanent and removes all its data. The baseline cannot be deleted.

#### 5.6.8 Duplicating a Scenario

Creates a new scenario as a copy of the selected one.

#### 5.6.9 Refresh from Jira with Change Preview (US-012)

When a scenario is active, a **"Refresh from Jira"** button is shown in the scenario banner. Because the scenario may contain manual changes, the refresh is guarded by an **inline confirmation widget** that shows a change summary before applying:

> `3 new · 18 updated · 1 removed — apply?`  → **Yes** / **Cancel**

Clicking **Yes** pulls the latest Jira work items from the baseline into the scenario (replacing its `jiraWorkItems` list) while preserving all manual project/assignment edits. Clicking **Cancel** leaves the scenario untouched.

---

### 5.7 Settings

**Purpose:** Manage all configuration and reference data for the application. Accessed via the sidebar.

Settings are organised into the following sections:

#### 5.7.1 General

| Setting | Type | Description |
|---------|------|-------------|
| BAU Reserve Days | integer | Days reserved per member per quarter for BAU activities |
| Hours Per Day | integer | Standard working hours per day |
| Quarters to Show | integer | Number of quarters visible in timeline |
| Default Country | select | Default country for new team members |

Changes are saved on clicking **Save**.

#### 5.7.2 Roles

List of roles available for team members.

- **Add**: Input name + click Add
- **Delete**: Click delete icon (with confirmation if members are using the role)
- **Constraint**: Role names must be unique

Default roles: Service Manager, ERP Specialist, Manager ERP, TMS Specialist, iWMS Specialist, EPM Specialist.

#### 5.7.3 Skills

List of skills grouped by category (System / Process / Technical).

- **Add**: Input name + select category + click Add
- **Delete**: Click delete icon
- **Constraint**: Skill name + category combination must be unique

Default skills include: SAP ECC, SAP S/4HANA, Yardi Voyager, FIS Integrity, Planon, OneStream, Basware, Treasury Management, Financial Close, P2P Process, Integration/API, Data Migration, Testing.

#### 5.7.4 Systems

List of IT systems that can be associated with projects.

- **Add**: Input name + description + click Add
- **Edit**: Inline edit of name and description
- **Delete**: Click delete icon

Default systems: ERP, TMS, iWMS, EPM.

#### 5.7.5 Countries

List of countries used for team member location and holiday calculation.

- **Add**: Input ISO code + name + click Add
- **Delete**: Click delete icon
- **Flag**: Auto-resolved from country code emoji mapping

Default countries: Netherlands (NL), United Kingdom (UK), Czech Republic (CZ), Luxembourg (LU).

#### 5.7.6 Public Holidays

Holidays are managed per country.

- **Select Country**: Dropdown to choose the country
- **Add Holiday**: Input date + name + click Add
- **Delete**: Click delete icon per holiday
- **Constraint**: One holiday per country per date

#### 5.7.7 Sprints

Sprint calendar management.

- **Generate Sprints for Year**: Auto-generates all sprints for a selected year based on the sprint settings (duration, start date, bye weeks, holiday weeks at end).
- **Manual Add**: Use the Sprint Form to add individual sprints.
- **Edit**: Edit start date, end date, bye week flag.
- **Delete**: Remove a sprint.

Sprint generation rules:
- Each sprint lasts `sprintDurationWeeks` weeks
- Bye weeks are inserted after sprint numbers defined in `byeWeeksAfter`
- `holidayWeeksAtEnd` weeks at end of year are reserved as holiday (no sprints)
- Total sprints per year is limited to `sprintsPerYear`

#### 5.7.8 Jira Integration

See [Section 5.5.1](#551-jira-connection-management) and [5.5.5](#555-jira-sync-settings).

#### 5.7.9 Import / Export

See [Section 8](#8-import--export).

---

## 6. Data Sync & Safety

This section consolidates all behaviours relating to data persistence, sync status feedback, and safeguards against accidental data loss or corruption.

### 6.1 Cloud Persistence (US-001)

All application state is stored in a single `app_sync` row in Supabase (JSONB). Writes are debounced at 1.5 seconds so that rapid edits are batched into a single database write. `localStorage` is kept as a fast-load offline cache.

### 6.2 Initial Load Indicator (US-002)

On startup the app shows a full-screen loading indicator while it hydrates from Supabase. If Supabase is unreachable, it falls back to the localStorage cache and shows an "offline" indicator. The loading screen is never shown on subsequent navigations within the same session.

### 6.3 Unsaved-Changes Guard (US-003)

If the browser tab is closed or refreshed while a Supabase write is pending, a native browser confirmation dialog fires:

> *"Changes are being saved — are you sure you want to leave?"*

This prevents data loss due to accidental tab closure between a local edit and its successful cloud write.

### 6.4 Sync Status Indicator (US-004)

A persistent indicator in the top-right of the header reflects the current sync state. See §3.3 for the full status table.

The **"Not saved — Retry"** state includes a clickable retry button that immediately attempts to re-push the current state to Supabase.

### 6.5 Import Overwrite Safeguard (US-005)

When importing data in **Replace** mode, the user must type `REPLACE` into a confirmation field before the import can proceed. The modal also shows a count of records that will be permanently deleted (e.g. "This will delete 12 team members, 8 projects, and 34 assignments").

The **Merge** mode does not require this confirmation, as it cannot delete existing records.

### 6.6 Jira Sync Safeguards (US-006 – US-012)

For a full description of Jira-specific safety features, see §5.5 and §5.6:

| Safeguard | Where documented |
|-----------|-----------------|
| Baseline warning banner | §5.6.2 |
| Sync diff preview before applying | §5.5.6 |
| Local mapping protection | §5.5.7 |
| Connection test before save | §5.5.1 |
| API token masking | §5.5.1a |
| Sync history log | §5.5.1b |
| Scenario refresh preview | §5.6.9 |

---

## 7. Capacity Calculation Engine

The capacity engine calculates a `CapacityResult` for each team member for each quarter.

### 7.1 Inputs

| Input | Source |
|-------|--------|
| Member's country | `teamMember.countryId` → `country` |
| Public holidays | `publicHolidays` filtered by country and quarter date range |
| BAU reserve days | `settings.bauReserveDays` |
| Time off days | `timeOff` for member + quarter |
| Project assignments | All `assignments` for member + quarter across all phases |

### 7.2 Calculation Formula

```
Total Workdays     = Business days in quarter - Public holidays (member's country)
Total Used Days    = BAU Reserve Days + Time Off Days + Sum(project assignment days)
Available Days     = Total Workdays - Total Used Days
Utilisation %      = (Total Used Days / Total Workdays) × 100
```

### 7.3 Capacity Status

| Status | Condition |
|--------|-----------|
| `normal` | Utilisation < 85% |
| `warning` | 85% ≤ Utilisation ≤ 100% |
| `overallocated` | Utilisation > 100% |

### 7.4 Capacity Breakdown

The `CapacityResult` includes a `breakdown` array itemising how used days are composed:

| Type | Description |
|------|-------------|
| `bau` | BAU reserve days |
| `timeoff` | Time off days (with reason) |
| `project` | Days allocated to a project phase (with project name and phase name) |

### 7.5 Business Day Calculation

Business days in a quarter are calculated as:
- All calendar days between the quarter's start and end date
- Minus Saturdays and Sundays
- Minus public holidays for the member's country that fall on weekdays within the quarter

Quarters follow the standard calendar year definition:
- Q1: January 1 – March 31
- Q2: April 1 – June 30
- Q3: July 1 – September 30
- Q4: October 1 – December 31

---

## 8. Warning System

Warnings are computed across all team members and all future quarters (not just the current quarter).

### 8.1 Warning Types


#### Overallocation Warning
**Triggered when:** `usedDays > totalWorkdays` (utilisation > 100%)

| Field | Value |
|-------|-------|
| member | TeamMember |
| usedDays | Total used days |
| totalDays | Total workdays |
| quarter | Affected quarter |

#### High Utilisation Warning
**Triggered when:** 85% ≤ utilisation ≤ 100%

| Field | Value |
|-------|-------|
| member | TeamMember |
| usedDays | Total used days |
| totalDays | Total workdays |
| usedPercent | Utilisation % |
| quarter | Affected quarter |

#### Too Many Projects Warning
**Triggered when:** A member is assigned to more concurrent projects than their `maxConcurrentProjects` limit in any quarter.

| Field | Value |
|-------|-------|
| member | TeamMember |
| count | Number of concurrent projects |
| max | Member's `maxConcurrentProjects` limit |

#### Skill Mismatch Warning
**Triggered when:** A member assigned to a phase lacks one or more of the phase's `requiredSkillIds`.

| Field | Value |
|-------|-------|
| member | TeamMember |
| project | Project |
| phase | Phase |
| missingSkills | List of skill names the member lacks |

### 8.2 Warning Display

- Dashboard warnings panel shows overallocation, high utilisation, and too-many-projects warnings for the **current quarter**.
- The `Warnings` stat card on the Dashboard shows the total count.
- Skill mismatch warnings are shown inline in the Assignment Modal when assigning a member.

---

## 9. Import & Export

### 9.1 JSON Export

Exports the entire application state as a single `.json` file.

- Includes: settings, countries, public holidays, roles, skills, systems, team members, projects (with phases and assignments), time off, sprints, Jira connections metadata (excluding API tokens — see §5.5.1a), Jira work items.
- File name: `capacity-planner-{date}.json`
- Use case: Backup, sharing, migration.

### 9.2 JSON Import

Imports a previously exported `.json` file.

**Import modes:**

| Mode | Behaviour | Confirmation Required |
|------|-----------|-----------------------|
| **Merge** | Adds imported records on top of existing data; conflicts resolved by ID (imported wins) | None |
| **Replace** | Deletes **all** existing data before importing | Must type `REPLACE` in a confirmation field |

Before confirming in Replace mode, a count of records to be deleted is shown (e.g. "This will delete 12 team members, 8 projects, and 34 assignments"). See §6.5 for full safeguard description.

A **preview** is shown before confirming any import, including any warnings (e.g. version mismatch, missing fields).

### 9.3 Excel Export

Exports data to an `.xlsx` file with multiple sheets:

| Sheet | Content |
|-------|---------|
| Team Members | All team members with role and country |
| Projects | All projects with status and priority |
| Assignments | All phase assignments (member, project, phase, quarter, days) |
| Time Off | All time off records |
| Capacity Summary | Calculated capacity per member per quarter |

File name: `capacity-planner-{date}.xlsx`

### 9.4 Excel Import

Imports data from a structured `.xlsx` file matching the template format.

- A **Download Template** button provides an empty template for the user to fill in.
- Validation errors are shown per row before import is confirmed.
- Import follows the same Replace / Merge logic as JSON import.

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Metric | Target |
|--------|--------|
| Initial page load | < 2 seconds |
| Navigation between views | < 500ms |
| Capacity recalculation (full team, 4 quarters) | < 200ms |
| Jira sync (up to 500 items) | < 30 seconds |

### 10.2 Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 110+ |
| Edge | 110+ |
| Firefox | 110+ |
| Safari | 16+ |

Mobile browsers are not explicitly supported in v1.0, but the layout should be functional on tablets (≥ 768px wide).

### 10.3 Availability

- Hosted on Vercel with global CDN; target uptime ≥ 99.5%.
- Supabase free tier: 99.9% uptime SLA on Pro plan.

### 10.4 Security

- All API calls use HTTPS.
- Authentication via Supabase Auth (email/password or SSO).
- Row Level Security (RLS) enforced on all database tables.
- Jira API tokens are stored encrypted in the database and are never exposed in the frontend after initial save (masked).

### 10.5 Accessibility

- Keyboard navigation supported throughout.
- Colour is not the only indicator of status (badges with labels are used alongside colour).
- Minimum contrast ratio of 4.5:1 for text (WCAG AA).

### 10.6 Dark Mode

The application supports a dark mode toggle (persisted in settings). All views and components adapt to the selected theme.

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **BAU** | Business As Usual. Non-project operational work. Reserved days are deducted from capacity. |
| **Baseline** | The primary data state of the planner. When Jira is connected, the baseline reflects the latest sync and should not be edited directly (see Jira Baseline Warning). |
| **Capacity** | The total number of available working days for a team member in a given quarter. |
| **Debounced write** | A technique where multiple rapid state changes are batched into a single database write that fires only after a quiet period (1.5 seconds in this app). |
| **Diff preview** | A modal shown before a Jira sync is applied, listing items to be added, updated, and removed so the user can review and confirm before data changes. |
| **Local mapping** | A link created by the planner between a Jira work item and a local project, phase, or team member. Preserved across syncs. |
| **Overallocation** | When a team member's assigned days exceed their available capacity. |
| **Phase** | A discrete stage of a project (e.g. Analysis, Build, UAT) with a defined time range. |
| **Quarter** | A three-month period (Q1 = Jan–Mar, Q2 = Apr–Jun, Q3 = Jul–Sep, Q4 = Oct–Dec). |
| **Scenario** | An editable what-if copy of the baseline used for planning without affecting live data. |
| **Sprint** | A time-boxed development cycle (default 3 weeks) used for sprint-level capacity breakdown. |
| **Sync history** | A log of the last 10 Jira sync attempts per connection, stored on the connection record. |
| **Token masking** | Displaying only the last 4 characters of an API token (e.g. `••••••••abcd`) so the full value is never visible in the UI after save. |
| **Utilisation** | The percentage of a member's available workdays that are allocated (BAU + time off + projects). |
| **Work Item** | A Jira issue (epic, feature, story, task, or bug) synced into the planner. |
