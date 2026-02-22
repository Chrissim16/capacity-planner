# Feature Recommendations & User Stories
# Mileway IT Capacity Planner

**Date:** February 20, 2026  
**Author:** App Review  
**Focus areas:** Data storage reliability · Jira integration safety · User-friendliness

---

## Critical Finding: Data is Stored in Local Cache, Not the Database

> **Before reading the feature list, this needs to be understood:**
>
> The Supabase database is configured but **not used**. All data is currently stored in the browser's `localStorage`. This means:
> - Data is **device-specific** — opening the app on a different computer shows empty data
> - Data is **wiped** when a user clears browser cache or storage
> - Data is **not shared** between team members
> - The storage limit is ~5–10 MB — large datasets (many Jira items, many sprints) will silently fail to save
>
> **This is the single highest-priority issue in the entire application.**

---

## Priority Tiers

| Tier | Label | Description |
|------|-------|-------------|
| 🔴 P0 | Critical | Data loss or corruption risk. Must fix before wider use. |
| 🟠 P1 | High | Major usability or integration safety gaps. Fix soon. |
| 🟡 P2 | Medium | Important improvements that significantly help users. |
| 🟢 P3 | Low | Nice-to-have enhancements for a polished experience. |

---

## 🔴 P0 — Critical (Data Storage & Integrity)

---

### US-001 — Activate Supabase as the Primary Data Store
**Type:** Technical

> **As a** planner,  
> **I want** all my data to be saved to the Supabase database automatically,  
> **so that** I never lose my work when I clear my browser, switch computers, or another team member needs to access the same data.

**Why it's critical:** Right now the Supabase client is built and configured but never called. Every CRUD action only writes to `localStorage`. If a user clears their browser storage, all projects, team members, and assignments are permanently gone. This is the root cause of the "data getting wiped" concern.

**Acceptance criteria:**
- Every create / update / delete action writes to Supabase in addition to (or instead of) localStorage
- On first load, data is read from Supabase, not localStorage
- If Supabase is unavailable, the user sees a clear offline warning rather than silently operating on stale local data
- A one-time migration script moves existing localStorage data to Supabase on first login

---

### US-002 — Data Load Indicator on App Start
**Type:** UX/UI

> **As a** user,  
> **I want** to see a loading state when the app is fetching data from the database on startup,  
> **so that** I know whether the data I see is fresh from the server or potentially out-of-date.

**Acceptance criteria:**
- A full-screen skeleton or spinner is shown while initial data loads from Supabase
- If loading fails (network error), an error message is displayed with a "Retry" button
- The user cannot interact with the app until data has loaded, preventing stale-data edits

---

### US-003 — Unsaved Changes Warning
**Type:** UX/UI

> **As a** user,  
> **I want** to be warned if I try to navigate away or close the browser tab while there are unsaved changes,  
> **so that** I do not accidentally lose work that has not yet been persisted to the database.

**Acceptance criteria:**
- A `beforeunload` browser event warns the user if there is pending unsaved state
- Within the app, navigating between views while a form is open prompts a "Discard changes?" confirmation

---

### US-004 — Visible Data Sync Status
**Type:** UX/UI

> **As a** planner,  
> **I want** to see a clear indicator showing whether my latest changes have been saved to the database,  
> **so that** I always know if my data is safe and not at risk of being lost.

**Acceptance criteria:**
- A small persistent status indicator in the header shows: `Saving…`, `Saved`, or `Save failed — Retry`
- "Save failed" state is shown in red and includes a retry button
- The indicator resets to idle after a period of no activity

---

### US-005 — Prevent Data Overwrite on Import Without Confirmation
**Type:** Functional

> **As a** planner,  
> **I want** the app to require an explicit "I understand this will replace all data" confirmation before a Replace import is executed,  
> **so that** I never accidentally wipe all my existing projects and assignments with a wrong file.

**Acceptance criteria:**
- The Replace import mode shows a prominent red warning: "This will permanently delete all existing data"
- User must type `REPLACE` or check a checkbox to confirm the action
- A preview shows the count of records that will be deleted vs. imported before confirming

---

---

## 🟠 P1 — High (Jira Integration Safety)

---

### US-006 — Read-Only Jira Baseline with Explicit Scenario Requirement
**Type:** Functional

> **As a** planner,  
> **I want** to be prevented from editing projects, assignments, or team members while viewing the Jira Baseline,  
> **so that** I never accidentally modify the source-of-truth data that mirrors Jira.

**Why this matters:** The baseline is meant to be a read-only reflection of Jira. Currently there is no hard enforcement — a user can edit baseline data, which could later be overwritten by the next Jira sync, silently losing their changes.

**Acceptance criteria:**
- While the Jira Baseline is active, all Edit / Delete / Add buttons on Projects, Team, and Timeline are disabled or hidden
- A persistent banner reads: "You are viewing the Jira Baseline (read-only). Create a scenario to make changes."
- The banner includes a one-click "Create Scenario from Baseline" shortcut button

---

### US-007 — Jira Sync Diff Preview Before Applying
**Type:** Functional

> **As a** planner,  
> **I want** to see a summary of what will change before I confirm a Jira sync,  
> **so that** I can verify that the sync will not accidentally remove projects or team members I have set up locally.

**Acceptance criteria:**
- Before applying a sync, a modal shows:
  - Number of new work items to be added
  - Number of existing work items to be updated
  - Number of work items to be removed (with their names listed)
  - Number of new team members to be imported
- User can choose to proceed or cancel
- An "Ignore removed items" option prevents deletions while still adding/updating

---

### US-008 — Protect Local Mappings During Jira Sync
**Type:** Technical

> **As a** planner,  
> **I want** my manual mappings between Jira work items and local projects/phases/team members to survive a Jira re-sync,  
> **so that** hours of mapping work is not lost every time I refresh Jira data.

**Acceptance criteria:**
- On sync, `mappedProjectId`, `mappedPhaseId`, and `mappedMemberId` are preserved on all existing work items
- Only fields that originate from Jira (summary, status, assignee, story points) are overwritten
- A sync result message lists how many mappings were preserved

---

### US-009 — Jira Connection Test Before Save
**Type:** UX/UI

> **As a** planner,  
> **I want** to test my Jira connection credentials before saving them,  
> **so that** I know immediately if my API token or project key is wrong and don't save a broken connection.

**Acceptance criteria:**
- A **Test Connection** button is available in the Jira connection form (not only after saving)
- On success, a green checkmark with "Connected to {project name}" is shown
- On failure, the exact error is shown (invalid token, wrong URL, project not found, etc.)
- The form cannot be saved if the last test failed

---

### US-010 — Jira API Token Security
**Type:** Technical

> **As a** system,  
> **I want** Jira API tokens to not be stored in plain text in the browser's localStorage,  
> **so that** a user's Jira credentials cannot be extracted by anyone who inspects their browser storage.

**Acceptance criteria:**
- API tokens are stored encrypted (using the Web Crypto API or stored server-side via Supabase Edge Functions)
- Once saved, the token is only shown masked (e.g. `••••••••abc1`) in the UI
- A "Replace token" button allows updating without revealing the old one

---

### US-011 — Sync History Log
**Type:** Functional

> **As a** planner,  
> **I want** to see a history of past Jira syncs (timestamp, items added/updated/removed, any errors),  
> **so that** I can understand what changed between syncs and diagnose issues.

**Acceptance criteria:**
- Settings > Jira Integration shows a "Sync History" section with the last 10 syncs
- Each entry shows: date/time, connection name, items synced, items removed, success/error status
- Errors include the specific message from Jira

---

### US-012 — Scenario Refresh from Jira with Change Preview
**Type:** Functional

> **As a** planner,  
> **I want** to refresh a scenario's Jira work items from the latest baseline without losing my manual assignment changes,  
> **so that** my what-if scenarios stay up to date with the latest Jira state.

**Acceptance criteria:**
- A "Refresh from Jira" button is available per scenario
- A diff preview shows: new items added, items removed from Jira, items updated in Jira
- Manual assignments and mappings in the scenario are preserved
- The user can choose which Jira changes to accept or ignore

---

---

## 🟡 P2 — Medium (User-Friendliness)

---

### US-013 — Replace Browser `confirm()` Dialogs with Styled Modals
**Type:** UX/UI

> **As a** user,  
> **I want** all delete and destructive action confirmations to use styled in-app modals,  
> **so that** the experience feels consistent and professional rather than using plain browser pop-ups.

**Acceptance criteria:**
- All `window.confirm()` calls are replaced with a reusable `ConfirmModal` component
- The modal clearly states what will be deleted and that the action cannot be undone
- A red "Delete" button and a "Cancel" button are shown
- This applies to: deleting projects, team members, scenarios, roles, skills, systems, countries, holidays, sprints, Jira connections

---

### US-014 — Undo Last Action
**Type:** Functional

> **As a** planner,  
> **I want** to undo my last data change (delete, edit, add),  
> **so that** if I accidentally delete a project or phase, I can recover it immediately without restoring from a backup.

**Acceptance criteria:**
- An "Undo" toast notification appears for 10 seconds after any destructive action
- Clicking "Undo" reverses the last action
- Undo is available for: delete project, delete team member, delete phase, delete assignment, delete scenario
- The undo history does not need to persist across page refreshes

---

### US-015 — Capacity Bar Tooltips with Full Breakdown
**Type:** UX/UI

> **As a** planner,  
> **I want** to hover over a team member's capacity bar and see a breakdown of how their days are used,  
> **so that** I can quickly understand which projects are consuming their time without drilling into the Projects page.

**Acceptance criteria:**
- Hovering over any capacity bar shows a tooltip with:
  - Total workdays in the quarter
  - BAU reserve days
  - Time off days (with reason if set)
  - Each project/phase allocation (project name, phase name, days)
  - Available remaining days
- The tooltip is styled consistently with the rest of the UI

---

### US-016 — Inline Assignment Editing on Timeline
**Type:** Functional

> **As a** planner,  
> **I want** to click on a project phase bar in the Timeline and edit its assignments without navigating away,  
> **so that** I can quickly adjust allocations while looking at the full team picture.

**Acceptance criteria:**
- Clicking a phase bar in Timeline view opens a side panel or popover showing the phase's current assignments
- Days per member per quarter can be edited inline
- Changes are saved on blur or on an explicit Save button
- The timeline updates immediately after saving

---

### US-017 — Bulk Jira Item Mapping
**Type:** Functional

> **As a** planner,  
> **I want** to select multiple unmapped Jira work items and assign them all to the same project/phase at once,  
> **so that** I can complete the mapping process much faster when syncing a large backlog.

**Acceptance criteria:**
- Checkboxes appear on each Jira work item in the list
- A "Map selected (N)" action button appears when items are selected
- A bulk mapping modal allows choosing a project and optionally a phase
- After confirming, all selected items are mapped and the count updates

---

### US-018 — Assignment Validation Feedback Before Saving
**Type:** UX/UI

> **As a** planner,  
> **I want** the assignment modal to show me a real-time capacity status as I enter days,  
> **so that** I know immediately whether the allocation I'm entering will cause an overallocation before I save.

**Acceptance criteria:**
- The capacity status (normal / warning / overallocated) updates live as the user types days in the assignment modal
- A mini capacity bar is shown per quarter below each days input
- If the allocation would cause overallocation, the "Save" button shows a warning colour (not blocked, but clearly flagged)
- The warning message says: "{Name} will be at X% in {quarter} after this assignment"

---

### US-019 — Empty State Guidance
**Type:** UX/UI

> **As a** new user,  
> **I want** to see helpful guidance and call-to-action buttons when a view has no data,  
> **so that** I know what steps to take next rather than seeing a blank screen.

**Acceptance criteria:**
- Dashboard with no team members shows: "No team members yet. Go to Settings to add your team."
- Projects page with no projects shows: "No projects yet. Click 'Add Project' to get started."
- Team page with no members shows: "No team members yet. Click 'Add Member' to get started."
- Jira page with no connection shows: "Connect Jira in Settings to sync work items."
- Each empty state includes a direct navigation button to the relevant action

---

### US-020 — Keyboard Shortcut to Create New Items
**Type:** UX/UI

> **As a** power user,  
> **I want** to use keyboard shortcuts (e.g. `N` for new project, `Ctrl+Z` for undo) to trigger common actions,  
> **so that** I can work faster without reaching for the mouse constantly.

**Acceptance criteria:**
- `N` opens the "Add" form for the currently active view (project, team member, etc.)
- `Ctrl+Z` / `Cmd+Z` triggers undo (see US-014)
- `Escape` closes any open modal
- A keyboard shortcut reference is accessible from the app (e.g. `?` key opens a help modal)

---

### US-021 — Global Search
**Type:** Functional

> **As a** planner,  
> **I want** to search across all entities (projects, team members, Jira items) from a single search bar,  
> **so that** I can quickly find what I'm looking for without manually switching between views.

**Acceptance criteria:**
- A search bar is accessible via `Ctrl+K` / `Cmd+K` (command palette style)
- Results are grouped by type: Projects, Team Members, Jira Work Items
- Clicking a result navigates to the relevant view and highlights the item
- Search is debounced (300ms) and works on name/summary fields

---

### US-022 — Export to PDF / Print View
**Type:** Functional

> **As a** manager,  
> **I want** to export the capacity plan as a PDF,  
> **so that** I can share a snapshot of the plan in a meeting or attach it to a planning document without requiring others to have app access.

**Acceptance criteria:**
- A "Export PDF" button is available on the Dashboard and Timeline views
- The PDF includes: the quarter overview table, team capacity bars, and (for Timeline) the Gantt chart
- The PDF is formatted for A4 landscape orientation
- A print stylesheet is also available via `Ctrl+P`

---

### US-023 — Dark Mode Persistence Across Devices
**Type:** Technical

> **As a** user,  
> **I want** my dark mode preference to be saved to my account rather than to my browser,  
> **so that** my theme choice is applied automatically when I log in from a different device.

**Acceptance criteria:**
- The `darkMode` setting is stored in Supabase (once US-001 is implemented) rather than only in localStorage
- The theme is applied before the first render (no flash of unstyled content)

---

### US-024 — Capacity Heatmap on Team View
**Type:** UX/UI

> **As a** manager,  
> **I want** to see a colour-coded heatmap of each team member's utilisation across quarters at a glance,  
> **so that** I can immediately spot who is overloaded or underutilised over the coming year without reading individual numbers.

**Acceptance criteria:**
- A heatmap table is shown in the Team view with team members as rows and quarters as columns
- Cells are colour-coded: green (< 70%), yellow (70–85%), amber (85–100%), red (> 100%)
- The utilisation % is shown inside each cell
- Clicking a cell opens the capacity breakdown for that member/quarter

---

### US-025 — Sprint Capacity View with Working Days Count
**Type:** Functional

> **As a** planner,  
> **I want** to see the exact number of working days in each sprint (accounting for public holidays),  
> **so that** I can make accurate sprint-level allocations without manually counting.

**Acceptance criteria:**
- In the sprint granularity Timeline view, each sprint column header shows the working day count
- Public holidays within the sprint are shown as a tooltip (e.g. "Excludes: Good Friday (1 day)")
- The days count adjusts per team member based on their country's holidays

---

---

## 🟢 P3 — Low (Future Enhancements)

---

### US-026 — Scenario Side-by-Side Comparison
**Type:** Functional

> **As a** planner,  
> **I want** to compare two scenarios side by side,  
> **so that** I can present "Option A vs Option B" resourcing plans to stakeholders and quickly explain the differences.

**Acceptance criteria:**
- A "Compare" mode is accessible from the Scenario Selector
- The user selects two scenarios to compare
- The comparison view shows a diff: items added/removed/changed in Scenario B vs. Scenario A
- Differences are highlighted in green (additions) and red (removals)

---

### US-027 — Comments / Notes on Projects and Phases
**Type:** Functional

> **As a** planner,  
> **I want** to add comments or notes to a project or phase,  
> **so that** I can record decisions, blockers, or context that is not captured in the project fields.

**Acceptance criteria:**
- A "Notes" field is available on the Project and Phase forms (plain text, multi-line)
- Notes are visible on the expanded project card and in the phase detail
- Notes are included in JSON and Excel exports

---

### US-028 — Notifications for Overallocation on Save
**Type:** Functional

> **As a** planner,  
> **I want** to receive an in-app notification when saving an assignment that causes a team member to become overallocated,  
> **so that** I am proactively alerted rather than having to check the Dashboard for warnings.

**Acceptance criteria:**
- When saving an assignment that results in overallocation, a toast notification appears: "{Name} is now overallocated in {quarter} ({X}%)"
- The toast includes a "View Dashboard" link
- The notification does not block saving — it is informational only

---

### US-029 — Custom Quarters / Fiscal Year Support
**Type:** Functional

> **As a** planner,  
> **I want** to configure the quarters to align with Mileway's fiscal year rather than the calendar year,  
> **so that** the planner matches the financial planning cycle we use internally.

**Acceptance criteria:**
- Settings allow defining when Q1 starts (e.g. April 1 for an April fiscal year)
- All quarter labels, capacity calculations, and timeline columns update accordingly
- Existing assignments are migrated to the new quarter labels

---

### US-030 — Azure DevOps / ADO Integration
**Type:** Functional

> **As a** planner,  
> **I want** to link projects to Azure DevOps epics and sync their status,  
> **so that** I don't have to manually update project status in the planner when it changes in ADO.

**Acceptance criteria:**
- Settings include an Azure DevOps connection (organisation, project, PAT)
- Projects with a `devopsLink` can be synced to pull the latest status from ADO
- A one-way sync updates: status, description, and linked work items
- Sync is manual (triggered by user) in v1

---

### US-031 — Automated Weekly Capacity Report by Email
**Type:** Functional

> **As a** manager,  
> **I want** to receive a weekly email summarising the team's capacity status and any warnings,  
> **so that** I stay informed without having to log in to the app every week.

**Acceptance criteria:**
- Settings include an email report configuration (recipients, day of week, time)
- The email includes: team utilisation summary per quarter, overallocation warnings, upcoming capacity gaps
- Reports are sent via a Supabase Edge Function on a CRON schedule
- Recipients can be a static list of email addresses (no auth required for v1)

---

### US-032 — Archive / Soft Delete for Completed Projects
**Type:** Functional

> **As a** planner,  
> **I want** to archive completed projects instead of deleting them,  
> **so that** I can hide them from the active view while keeping their history available for reference or reporting.

**Acceptance criteria:**
- Completed or Cancelled projects have an "Archive" option
- Archived projects are hidden by default from the Projects list and Timeline
- A "Show Archived" toggle reveals them
- Archived projects are included in exports and reports

---

### US-033 — Team Member Availability Calendar
**Type:** UX/UI

> **As a** planner,  
> **I want** to see a visual calendar for a team member showing their planned assignments, time off, and public holidays,  
> **so that** I can understand their availability at a glance before assigning them to a new project.

**Acceptance criteria:**
- Accessible from the Team member card (a "View Calendar" button)
- Shows a monthly or quarterly calendar
- Project assignments are shown as colour-coded blocks by project
- Time off and public holidays are shown distinctly
- Available days are clearly indicated

---

### US-034 — Import Public Holidays from External API
**Type:** Functional

> **As an** admin,  
> **I want** to import public holidays for a country automatically from a public holidays API,  
> **so that** I don't have to manually enter every holiday for the Netherlands, UK, Czech Republic, and Luxembourg every year.

**Acceptance criteria:**
- Settings > Holidays includes an "Import from API" button per country
- The app calls a public holidays API (e.g. Nager.Date) to fetch holidays for the selected year
- A preview shows the holidays to be imported before confirming
- Duplicate holidays (already in the system for that date) are skipped

---

### US-035 — Role-Based Access Control
**Type:** Technical

> **As an** admin,  
> **I want** to assign roles (Viewer, Planner, Admin) to each user,  
> **so that** managers can read the plan without risking accidental changes, and junior planners cannot modify reference data.

**Acceptance criteria:**
- Five roles: Viewer, Member, Planner, Admin, Owner (as defined in the Functional Specifications)
- Role assignment is managed in Settings > Users
- Supabase Row Level Security policies enforce permissions at the database level
- Role changes take effect immediately without requiring a re-login

---

# Phase 2 — Advanced Features

---

## Group A: Jira Data Enrichment

---

### US-036 — Display Labels & Components on Jira Work Items
**Type:** UX/UI

> **As a** planner,  
> **I want** to see Jira labels and components as coloured tags on each work item in the Jira Overview page,  
> **so that** I can quickly identify categories, cross-cutting concerns, and filter to specific label sets.

**Acceptance criteria:**
- Labels shown as coloured pill badges on each `JiraItemRow`
- Components shown as secondary pill badges (different colour family)
- New filter dropdowns in the Jira Overview filter bar for labels and components
- Multi-select filtering (show items matching any selected label)

---

### US-037 — Import Start/End Dates from Jira
**Type:** Functional

> **As a** planner,  
> **I want** the start date and due date of Jira issues to be imported automatically during sync,  
> **so that** I can use actual dates for planning instead of relying only on quarters.

**Acceptance criteria:**
- `duedate` and start date custom field added to `JIRA_FIELDS`
- `startDate` and `dueDate` fields added to the `JiraWorkItem` type
- Dates displayed on work item rows where set
- Missing dates shown as blank (not "N/A")

---

### US-038 — Verify & Display Email on Team Member Cards
**Type:** UX/UI

> **As a** planner,  
> **I want** to see team members' email addresses on their profile cards,  
> **so that** I can contact them or verify Jira account matching.

**Acceptance criteria:**
- Email displayed on Team page member cards (the field already exists on `TeamMember`)
- Jira account ID shown as a secondary detail for debugging
- Email imported from Jira assignee data during sync

---

## Group B: Naming Convention Alignment

---

### US-039 — Global Rename: Project to Epic (UI Only)
**Type:** UX/UI

> **As a** user familiar with Jira,  
> **I want** the app to use Jira's own terminology (Epic, Feature, Story),  
> **so that** I don't have to mentally translate between two naming systems.

**Acceptance criteria:**
- "Project" renamed to "Epic" in all page titles, nav labels, form labels, buttons, and tooltips
- Internal code names (`Project` type, `projects` array, `ViewType`) remain unchanged
- All occurrences across Header, Projects page, ProjectForm, Timeline, Dashboard, Jira Overview, and Settings

---

### US-040 — Global Rename: Phase to Feature (UI Only)
**Type:** UX/UI

> **As a** user,  
> **I want** "Phase" to be renamed to "Feature" in the UI,  
> **so that** the app language matches the Jira hierarchy I already know.

**Acceptance criteria:**
- "Phase" renamed to "Feature" in all phase-related forms, timeline cells, assignment dialogs, and Jira overview sub-headers
- Internal code names stay the same

---

## Group C: Jira Hierarchy Display

---

### US-041 — Reusable JiraHierarchyTree Component
**Type:** Functional

> **As a** developer,  
> **I want** a shared tree component that renders the Jira hierarchy (Epic → Feature → Story/Task/Bug),  
> **so that** all pages can display the same consistent collapsible tree.

**Acceptance criteria:**
- Accepts `JiraWorkItem[]` and `Project[]` as input
- Builds a tree grouped by `parentKey` hierarchy
- Each level is collapsible with a chevron toggle
- Each row shows: type badge, Jira key link, summary, status, story points, assignee, labels

---

### US-042 — Hierarchy View on Jira Overview Page
**Type:** UX/UI

> **As a** planner,  
> **I want** the Jira Overview page to show items in their actual Jira hierarchy,  
> **so that** I can see how Stories relate to Features and Epics.

**Acceptance criteria:**
- Current flat-by-project grouping replaced with the `JiraHierarchyTree` component
- Search and filter controls remain above the tree
- Expand/collapse state persisted during the session

---

### US-043 — Hierarchy View on Project Detail Card
**Type:** UX/UI

> **As a** planner,  
> **I want** to see the nested Jira items under each feature when I expand a project card,  
> **so that** I understand the scope of each feature at a glance.

**Acceptance criteria:**
- Expanded project card shows Jira work items nested under each feature/phase
- Uses the `JiraHierarchyTree` component
- Only items mapped to this project are shown

---

### US-044 — Hierarchy View in Timeline
**Type:** UX/UI

> **As a** planner,  
> **I want** to collapse and expand Epics in the Timeline to see or hide their Features,  
> **so that** I can control the level of detail in my timeline view.

**Acceptance criteria:**
- Each Epic row in the Timeline has a collapse/expand chevron
- Expanded: shows Feature sub-rows with their date/quarter ranges
- Collapsed: shows only the Epic row spanning its full range

---

## Group D: Date-Driven Planning

---

### US-045 — Add Date Fields to Phase and Project Types
**Type:** Technical

> **As a** planner,  
> **I want** projects and features to have optional start and end dates,  
> **so that** I can plan with precise dates when available and fall back to quarters otherwise.

**Acceptance criteria:**
- `startDate?: string` and `endDate?: string` (YYYY-MM-DD) added to `Phase` and `Project` types
- Auto-populated from Jira child work item dates (min start / max due) during sync
- Manually overridable in the edit forms
- Dates persisted to Supabase

---

### US-046 — Date View Mode in Timeline
**Type:** Functional

> **As a** planner,  
> **I want** a "Dates" view mode in the Timeline alongside Quarters and Sprints,  
> **so that** I can see exact date ranges for each feature and plan at a finer granularity.

**Acceptance criteria:**
- Third toggle option "Dates" added to Timeline granularity selector
- Horizontal axis shows week or month columns
- Features displayed as bars spanning their start-to-end date range
- Features without dates fall back to quarter range converted to approximate dates

---

### US-047 — Date Display on Project/Phase Cards
**Type:** UX/UI

> **As a** planner,  
> **I want** to see start and end dates on project and feature cards,  
> **so that** I have date context alongside the quarter information.

**Acceptance criteria:**
- Dates displayed as "12 Mar – 15 Jun 2026" on expanded project cards and feature rows
- Only shown when dates are set (no "N/A" clutter)
- Appears alongside the existing quarter range label

---

## Group E: Richer Project Detail

---

### US-048 — Enhanced Expandable Project Card
**Type:** UX/UI

> **As a** planner,  
> **I want** to see a rich summary when I expand a project card,  
> **so that** I can quickly understand the project's status, team, and progress without leaving the page.

**Acceptance criteria:**
- Expanded card shows a summary section at the top with:
  - Description, status, priority, date range, Jira key link
  - Total story points, completion %, assigned team members, feature count
  - Team list: name + total days for each assigned member
  - Jira stats: items by status category (to do / in progress / done)
- Below the summary: existing feature list with nested hierarchy (US-043)

---

## Group F: Jira Write-Back

---

### US-049 — Jira Write API in Proxy
**Type:** Technical

> **As a** developer,  
> **I want** the Jira proxy to support writing data back to Jira,  
> **so that** the app can update issue fields like start date, due date, and assignee.

**Acceptance criteria:**
- `updateJiraIssue(connectionId, issueKey, fields)` function in `jira.ts`
- Calls `PUT /rest/api/3/issue/{issueIdOrKey}` through the existing proxy
- Handles error responses and returns success/failure per item

---

### US-050 — "Push to Jira" Preview & Confirm UI
**Type:** Functional

> **As a** planner,  
> **I want** a manual "Push to Jira" button that shows me what will be updated before it happens,  
> **so that** I can review and approve changes to Jira without accidental writes.

**Acceptance criteria:**
- "Push to Jira" button on each Jira connection card in Settings
- Preview modal listing items to update with field-level diff
- User confirms before any write happens
- Progress indicator and results summary (X updated, Y failed)

---

### US-051 — Track Push State per Work Item
**Type:** Technical

> **As a** planner,  
> **I want** to see which work items have local changes not yet pushed to Jira,  
> **so that** I know what's out of sync.

**Acceptance criteria:**
- `lastPushedAt` and `pushDirty` fields added to `JiraWorkItem`
- Items marked dirty when local fields (dates, assignee) change
- Dirty indicator badge shown on work items needing push
- Cleared when successfully pushed

---

## Group G: Smart Assignment Suggestions

---

### US-052 — Team Member Scoring Algorithm
**Type:** Technical

> **As a** planner,  
> **I want** the system to automatically suggest the best team members for a work item,  
> **so that** I can make faster, data-driven assignment decisions.

**Acceptance criteria:**
- Scoring algorithm in `application/assignmentSuggester.ts`
- Factors: available capacity (40%), skill match (35%), assignment history (25%)
- Returns ranked list with score breakdown per member
- Works in both baseline and scenario mode

---

### US-053 — Suggestion UI in Assignment Flow
**Type:** UX/UI

> **As a** planner,  
> **I want** to see suggested team members when assigning someone to a feature,  
> **so that** I don't have to manually check capacity and skills for every assignment.

**Acceptance criteria:**
- "Suggested" section shown above the full member list in assignment modals
- Top 3 suggestions with match % badge and reason chips (e.g. "89% · Skills match · 12 days free")
- Click a suggestion to assign immediately

---

## Group H: Holiday API Integration

---

### US-054 — Nager.Date Holiday API Integration
**Type:** Technical

> **As a** developer,  
> **I want** a service that fetches public holidays from the Nager.Date API,  
> **so that** users don't have to manually enter every public holiday.

**Acceptance criteria:**
- `fetchPublicHolidays(countryCode, year)` function in `services/holidays.ts`
- Calls `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}`
- Maps response to existing `PublicHoliday` type
- Handles API errors gracefully

---

### US-055 — Holiday Import UI in Settings
**Type:** Functional

> **As a** planner,  
> **I want** an "Import Holidays" button in Settings that lets me pick a country and year,  
> **so that** I can populate public holidays in seconds instead of adding them one by one.

**Acceptance criteria:**
- "Import Holidays" button in the Holidays section of Settings
- Modal with country and year selectors, plus a preview of holidays to import
- Deduplication: existing holidays (same country + date) are skipped
- Manual CRUD still works — imported holidays behave identically to manual ones

---

## Summary Table

| ID | Title | Type | Priority |
|----|-------|------|----------|
| US-001 | Activate Supabase as Primary Data Store | Technical | 🔴 P0 |
| US-002 | Data Load Indicator on App Start | UX/UI | 🔴 P0 |
| US-003 | Unsaved Changes Warning | UX/UI | 🔴 P0 |
| US-004 | Visible Data Sync Status | UX/UI | 🔴 P0 |
| US-005 | Prevent Data Overwrite on Import | Functional | 🔴 P0 |
| US-006 | Read-Only Jira Baseline Enforcement | Functional | 🟠 P1 |
| US-007 | Jira Sync Diff Preview | Functional | 🟠 P1 |
| US-008 | Protect Mappings During Sync | Technical | 🟠 P1 |
| US-009 | Jira Connection Test Before Save | UX/UI | 🟠 P1 |
| US-010 | Jira API Token Security | Technical | 🟠 P1 |
| US-011 | Sync History Log | Functional | 🟠 P1 |
| US-012 | Scenario Refresh with Change Preview | Functional | 🟠 P1 |
| US-013 | Replace `confirm()` with Styled Modals | UX/UI | 🟡 P2 |
| US-014 | Undo Last Action | Functional | 🟡 P2 |
| US-015 | Capacity Bar Tooltips | UX/UI | 🟡 P2 |
| US-016 | Inline Assignment Editing on Timeline | Functional | 🟡 P2 |
| US-017 | Bulk Jira Item Mapping | Functional | 🟡 P2 |
| US-018 | Assignment Validation Feedback | UX/UI | 🟡 P2 |
| US-019 | Empty State Guidance | UX/UI | 🟡 P2 |
| US-020 | Keyboard Shortcuts | UX/UI | 🟡 P2 |
| US-021 | Global Search | Functional | 🟡 P2 |
| US-022 | Export to PDF | Functional | 🟡 P2 |
| US-023 | Dark Mode Persistence Across Devices | Technical | 🟡 P2 |
| US-024 | Capacity Heatmap on Team View | UX/UI | 🟡 P2 |
| US-025 | Sprint Working Days Count | Functional | 🟡 P2 |
| US-026 | Scenario Side-by-Side Comparison | Functional | 🟢 P3 |
| US-027 | Comments / Notes on Projects | Functional | 🟢 P3 |
| US-028 | Notifications on Overallocation Save | Functional | 🟢 P3 |
| US-029 | Fiscal Year / Custom Quarter Support | Functional | 🟢 P3 |
| US-030 | Azure DevOps Integration | Functional | 🟢 P3 |
| US-031 | Automated Weekly Email Report | Functional | 🟢 P3 |
| US-032 | Archive / Soft Delete Projects | Functional | 🟢 P3 |
| US-033 | Team Member Availability Calendar | UX/UI | 🟢 P3 |
| US-034 | Import Holidays from API | Functional | 🟢 P3 |
| US-035 | Role-Based Access Control | Technical | 🟢 P3 |
| US-036 | Display Labels & Components on Jira Work Items | UX/UI | 🔵 Phase 2 |
| US-037 | Import Start/End Dates from Jira | Functional | 🔵 Phase 2 |
| US-038 | Verify & Display Email on Team Member Cards | UX/UI | 🔵 Phase 2 |
| US-039 | Global Rename: Project → Epic (UI only) | UX/UI | 🔵 Phase 2 |
| US-040 | Global Rename: Phase → Feature (UI only) | UX/UI | 🔵 Phase 2 |
| US-041 | Reusable JiraHierarchyTree Component | Functional | 🔵 Phase 2 |
| US-042 | Hierarchy View on Jira Overview Page | UX/UI | 🔵 Phase 2 |
| US-043 | Hierarchy View on Project Detail Card | UX/UI | 🔵 Phase 2 |
| US-044 | Hierarchy View in Timeline | UX/UI | 🔵 Phase 2 |
| US-045 | Add Date Fields to Phase and Project | Technical | 🔵 Phase 2 |
| US-046 | Date View Mode in Timeline | Functional | 🔵 Phase 2 |
| US-047 | Date Display on Project/Phase Cards | UX/UI | 🔵 Phase 2 |
| US-048 | Enhanced Expandable Project Card | UX/UI | 🔵 Phase 2 |
| US-049 | Jira Write API in Proxy | Technical | 🔵 Phase 2 |
| US-050 | "Push to Jira" Preview & Confirm UI | Functional | 🔵 Phase 2 |
| US-051 | Track Push State per Work Item | Technical | 🔵 Phase 2 |
| US-052 | Team Member Scoring Algorithm | Technical | 🔵 Phase 2 |
| US-053 | Suggestion UI in Assignment Flow | UX/UI | 🔵 Phase 2 |
| US-054 | Nager.Date Holiday API Integration | Technical | 🔵 Phase 2 |
| US-055 | Holiday Import UI in Settings | Functional | 🔵 Phase 2 |
