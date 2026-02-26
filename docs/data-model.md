# Data Model Reference

This document describes every data entity in the Mileway IT Capacity Planner, their fields, and how they relate.

---

## The Hierarchy

```
Jira (synced)                   Manually Created
─────────────                   ────────────────
Epic                            LocalPhase (UAT / Hypercare)
  └── Feature                     └── attached to an Epic
        └── Story | Task | Bug
```

- **Epics, Features, Stories, Tasks, Bugs** are synced from Jira into `JiraWorkItem[]`.
- **LocalPhases** (UAT, Hypercare) are created manually inside the app and are attached to a specific Epic via `jiraKey`.
- **No skip levels**: The hierarchy is always Epic → Feature → Story|Phase. Never add items that bypass this chain.

---

## Time Structure

The app uses a **24-sprint full-year model** for 2026:

| Quarter | Sprints | Count |
|---|---|---|
| Q1 2026 | S1 – S6 | 6 |
| Q2 2026 | S7 – S12 | 6 |
| Q3 2026 | S13 – S18 | 6 |
| Q4 2026 | S19 – S24 | 6 |

- Each sprint is **2 weeks** (configurable via `Settings.sprintDurationWeeks`)
- `Settings.sprintsPerYear` defaults to 16 in the legacy model but is reconfigured to 24 for the VS Finance planning cycle
- `Settings.byeWeeksAfter` specifies sprint numbers after which a bye week is inserted

### Sprint Date Reference (2026)

```
Q1:
  S1:  Jan 5  – Jan 16
  S2:  Jan 19 – Jan 30
  S3:  Feb 2  – Feb 13
  S4:  Feb 16 – Feb 27
  S5:  Mar 2  – Mar 13
  S6:  Mar 16 – Mar 27

Q2:
  S7:  Mar 30 – Apr 10
  S8:  Apr 13 – Apr 24
  S9:  Apr 27 – May 8
  S10: May 11 – May 22
  S11: May 25 – Jun 5
  S12: Jun 8  – Jun 19

Q3:
  S13: Jun 22 – Jul 3
  S14: Jul 6  – Jul 17
  S15: Jul 20 – Jul 31
  S16: Aug 3  – Aug 14
  S17: Aug 17 – Aug 28
  S18: Sep 1  – Sep 11

Q4:
  S19: Sep 14 – Sep 25
  S20: Sep 28 – Oct 9
  S21: Oct 12 – Oct 23
  S22: Oct 26 – Nov 6
  S23: Nov 9  – Nov 20
  S24: Nov 23 – Dec 4
```

### Sprint Fraction Formula

For the Gantt bar positioning spec, sprint positions are expressed as **full-year fractions** (0–1):

```
sprint_fraction = sprint_number / 24
```

Examples:
- S1 start = 0/24 = 0.000
- S6 end   = 6/24 = 0.250  (end of Q1)
- S12 end  = 12/24 = 0.500 (end of Q2)
- S24 end  = 24/24 = 1.000 (end of Q4)

In the actual implementation, bar positions are derived from **ISO dates** (Jira `startDate`/`dueDate`, or sprint start/end dates), not stored fractions. The fraction formula is used for the positioning spec but the runtime computes fractions dynamically from dates.

---

## Dual-Track Assignee Model

Every level of the hierarchy carries **both** an IT track assignee and a BIZ track assignee. These have equal weight in the capacity model — both consume days from their respective person's available capacity.

| Track | Color | Source |
|---|---|---|
| IT | Mileway blue `#0089DD` | Jira `assigneeName` / `TeamMember` |
| BIZ | Purple `#7C3AED` | `BusinessContact` via `JiraItemBizAssignment` |

---

## Entity Reference

### `JiraWorkItem`

Core Jira item — synced from the Jira REST API.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Internal app ID |
| `connectionId` | `string` | Parent `JiraConnection.id` |
| `jiraKey` | `string` | Jira issue key, e.g. `"ERP-1976"` |
| `jiraId` | `string` | Jira internal issue ID |
| `summary` | `string` | Issue title |
| `description` | `string?` | Long description |
| `type` | `JiraItemType` | `'epic' \| 'feature' \| 'story' \| 'task' \| 'bug'` |
| `typeName` | `string` | Display name from Jira |
| `status` | `string` | Jira status label, e.g. `"In Progress"` |
| `statusCategory` | `'todo' \| 'in_progress' \| 'done'` | Normalised status category |
| `priority` | `string?` | Jira priority label |
| `storyPoints` | `number?` | SP value used as proxy for effort in days |
| `originalEstimate` | `number?` | Jira time estimate (seconds) |
| `assigneeEmail` | `string?` | IT assignee email — used to match `TeamMember` |
| `assigneeName` | `string?` | IT assignee display name |
| `parentKey` | `string?` | Parent item's `jiraKey` |
| `sprintId` | `string?` | Jira sprint ID |
| `sprintName` | `string?` | Jira sprint name, e.g. `"Sprint 3"` |
| `sprintStartDate` | `string?` | YYYY-MM-DD — from Jira sprint object |
| `sprintEndDate` | `string?` | YYYY-MM-DD — from Jira sprint object |
| `startDate` | `string?` | YYYY-MM-DD — from Jira planned start custom field |
| `dueDate` | `string?` | YYYY-MM-DD — from Jira duedate field |
| `labels` | `string[]` | Jira labels |
| `components` | `string[]` | Jira components |
| `created` | `string` | ISO timestamp |
| `updated` | `string` | ISO timestamp |
| `mappedProjectId` | `string?` | Linked local `Project.id` (if mapped) |
| `mappedPhaseId` | `string?` | Linked local `Phase.id` (if mapped) |
| `mappedMemberId` | `string?` | Linked local `TeamMember.id` (if mapped) |
| `staleFromJira` | `boolean?` | `true` if item was not returned by last sync (kept to preserve local mappings) |
| `confidenceLevel` | `'high' \| 'medium' \| 'low'?` | Per-item override; falls back to `JiraSettings.defaultConfidenceLevel` |

---

### `LocalPhase`

Manually-managed phase (UAT or Hypercare) attached to a Jira Epic.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Internal ID, prefixed `lp-` |
| `jiraKey` | `string` | Parent Epic's `jiraKey`, e.g. `"ERP-1001"` |
| `type` | `'uat' \| 'hypercare'` | Phase type |
| `name` | `string` | Display label, e.g. `"UAT"`, `"Hypercare"` |
| `startDate` | `string` | YYYY-MM-DD |
| `endDate` | `string` | YYYY-MM-DD |

LocalPhases are visible on the Timeline Gantt as coloured bars below their parent Epic's features.

---

### `TeamMember` (IT track)

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Internal ID |
| `name` | `string` | Full name |
| `role` | `string` | Role label, e.g. `"Developer"`, `"BA"` |
| `countryId` | `string` | References `Country.id` — drives public holiday calendar |
| `skillIds` | `string[]` | References `Skill.id` |
| `maxConcurrentProjects` | `number` | Soft limit for concurrent project involvement |
| `squadId` | `string?` | IT squad: `"ERP"` or `"EPM"` |
| `processTeamIds` | `string[]?` | Cross-functional process teams: `R2R`, `L2C`, `P2P`, etc. |
| `email` | `string?` | Used to match Jira assignee email |
| `jiraAccountId` | `string?` | Jira user account ID for direct matching |
| `syncedFromJira` | `boolean?` | `true` if auto-created during Jira sync |
| `needsEnrichment` | `boolean?` | `true` if missing `role` or `countryId` after Jira sync |

---

### `BusinessContact` (BIZ track)

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Internal ID |
| `name` | `string` | Full name |
| `title` | `string?` | Job title, e.g. `"Finance Manager"` |
| `department` | `string?` | Department, e.g. `"Finance"` |
| `email` | `string?` | Email address |
| `countryId` | `string` | References `Country.id` — drives public holiday calendar |
| `workingDaysPerWeek` | `number?` | Default: 5 |
| `workingHoursPerDay` | `number?` | Default: 8 |
| `bauReserveDays` | `number?` | Days/quarter reserved for BAU (non-project operational work). Default: 5 |
| `processTeamIds` | `string[]?` | Cross-functional process teams (same as `TeamMember`) |
| `notes` | `string?` | Free text |
| `archived` | `boolean?` | Soft-deleted — hidden from default views |
| `projectIds` | `string[]?` | Associated projects — used to pre-filter assignment dropdowns |

---

### `JiraItemBizAssignment`

Links a `BusinessContact` to a specific `JiraWorkItem` (any level: Epic, Feature, Story).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Internal ID |
| `jiraKey` | `string` | Must match `JiraWorkItem.jiraKey` |
| `contactId` | `string` | References `BusinessContact.id` |
| `days` | `number?` | Effort in days from this contact for this item |
| `notes` | `string?` | Optional note |

This is the **primary BIZ assignment model** for the Jira-led workflow. Every Jira item can have multiple BIZ contacts assigned via this table.

---

### `Assignment` (IT track, project-based)

Flat assignment record linking a `TeamMember` to a `Project`/`Phase`.

| Field | Type | Description |
|---|---|---|
| `projectId` | `string?` | Top-level project linkage |
| `phaseId` | `string?` | Phase-level linkage |
| `memberId` | `string` | References `TeamMember.id` |
| `quarter` | `string` | `"Q1 2026"` format — always set for aggregation |
| `days` | `number` | Days of effort in this quarter |
| `sprint` | `string?` | `"Sprint 1 2026"` format — optional sprint-level detail |
| `jiraSynced` | `boolean?` | `true` if auto-created from Jira SP data |

---

### `BusinessAssignment`

BIZ contact commitment to a `Project`/`Phase` (non-Jira workflow).

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Internal ID |
| `contactId` | `string` | References `BusinessContact.id` |
| `projectId` | `string` | References `Project.id` |
| `phaseId` | `string?` | References `Phase.id` |
| `quarter` | `string?` | `"Q2 2026"` format — derived from phase start date |
| `days` | `number` | Days of effort |
| `notes` | `string?` | Optional note |

---

### `Sprint`

| Field | Type | Description |
|---|---|---|
| `id` | `string` | `"sprint-1-2026"` |
| `name` | `string` | `"Sprint 1"` |
| `number` | `number` | 1–24 (for a 24-sprint year) |
| `year` | `number` | Calendar year |
| `startDate` | `string` | YYYY-MM-DD |
| `endDate` | `string` | YYYY-MM-DD |
| `quarter` | `string` | `"Q1 2026"` |
| `isByeWeek` | `boolean?` | `true` for bye/holiday sprints |

Sprints are **generated dynamically** from `Settings` by `generateSprints()`. Saved sprints from the store are merged with generated ones to handle Jira sprint name matching.

---

### `Project` and `Phase` (legacy / non-Jira workflow)

These entities support the pre-Jira planning workflow. They are still used for non-Jira-led capacity assignments.

**Project fields:** `id`, `name`, `priority`, `status`, `systemIds`, `devopsLink`, `description`, `startDate`, `endDate`, `phases[]`, `notes`, `archived`, `jiraSourceKey`, `syncedFromJira`

**Phase fields:** `id`, `name`, `startDate`, `endDate`, `confidenceLevel`, `requiredSkillIds`, `predecessorPhaseId`, `assignments[]`, `notes`, `jiraSourceKey`

> **Note:** In the Jira-led workflow, `Project` and `Phase` are often auto-created from Jira Epics/Features. The `JiraWorkItem` is the source of truth; `Project`/`Phase` serve as local planning overrides.

---

### `JiraConnection`

One record per connected Jira project.

Key fields: `id`, `name`, `jiraBaseUrl`, `jiraProjectKey`, `apiToken`, `userEmail`, `isActive`, `lastSyncAt`, `lastSyncStatus`, `hierarchyMode`, `autoCreateProjects`, `autoCreateAssignments`, `defaultDaysPerItem`, `jqlFilter`

---

### `Scenario`

A named what-if planning state. Contains an isolated copy of `projects`, `teamMembers`, `assignments`, `timeOff`, and `jiraWorkItems`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Internal ID |
| `name` | `string` | Display name |
| `color` | `ScenarioColor?` | `'purple' \| 'blue' \| 'green' \| 'orange' \| 'rose' \| 'yellow'` |
| `isBaseline` | `boolean` | `true` for the "Jira Baseline" (read-only when viewing) |

---

### Reference Entities

| Entity | Key Fields |
|---|---|
| `Country` | `id`, `code`, `name`, `flag` (emoji) |
| `PublicHoliday` | `id`, `countryId`, `date` (YYYY-MM-DD), `name` |
| `Role` | `id`, `name` |
| `Skill` | `id`, `name`, `category` (`'System' \| 'Process' \| 'Technical'`) |
| `System` | `id`, `name`, `description` |
| `Squad` | `id`, `name` (e.g. `"ERP"`, `"EPM"`) |
| `ProcessTeam` | `id`, `name` (e.g. `"R2R"`, `"L2C"`, `"P2P"`, `"Planning"`, `"Treasury"`, `"FP&A"`) |
| `TimeOff` | `id`, `memberId`, `startDate`, `endDate`, `note` |
| `BusinessTimeOff` | `id`, `contactId`, `startDate`, `endDate`, `type` (`'holiday' \| 'other'`), `notes` |

---

## Capacity Calculation Model

Capacity is computed per-person per-quarter (or per-sprint):

```
availableDays = totalWorkdays
              - publicHolidays (in that quarter, for that country)
              - timeOff (days that overlap the quarter)
              - bauReserveDays (flat deduction)

usedDays      = sum of all assignments in that quarter

status        = usedDays > availableDays → 'overallocated'
              = usedPercent > 90%        → 'warning'
              = else                     → 'normal'
```

**"Overloaded"** (Team view terminology) = `allocatedDays > availableDays` in a given sprint. The threshold is 100% utilisation — not a configurable percentage.

### Confidence Level Buffers

Each `JiraWorkItem` (or the global `JiraSettings.defaultConfidenceLevel`) applies a buffer on top of raw story points:

| Level | Buffer |
|---|---|
| High | +5% |
| Medium | +15% |
| Low | +25% |

Buffers are applied in `getForecastedDays()` and rolled up in `computeRollup()`.
