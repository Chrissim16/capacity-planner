# Feature Tracker

# Mileway IT Capacity Planner

**Last updated:** February 22, 2026  
**Total features:** 56  
**Completed:** 28 / 56

---

## Progress Overview


| Priority         | Total  | Done   | In Progress | Not Started |
| ---------------- | ------ | ------ | ----------- | ----------- |
| 🔴 P0 — Critical | 5      | 5      | 0           | 0           |
| 🟠 P1 — High     | 7      | 7      | 0           | 0           |
| 🟡 P2 — Medium   | 13     | 9      | 0           | 4           |
| 🟢 P3 — Low      | 11     | 1      | 0           | 10          |
| 🔵 Phase 2       | 20     | 7      | 0           | 13          |
| **Total**        | **56** | **28** | **0**       | **28**      |


---

## Status Legend


| Symbol | Status                   |
| ------ | ------------------------ |
| ⬜      | Not started              |
| 🔵     | In progress              |
| ✅      | Completed                |
| 🚫     | Cancelled / out of scope |


---

## 🔴 P0 — Critical (Data Storage & Integrity)


| ID     | Feature                                               | Type       | Status | Started | Completed | Notes                                                                    |
| ------ | ----------------------------------------------------- | ---------- | ------ | ------- | --------- | ------------------------------------------------------------------------ |
| US-001 | Activate Supabase as the Primary Data Store           | Technical  | ✅ | 2026-02-20 | 2026-02-20 | New `supabaseSync.ts` + `app_sync` Supabase table. 1.5s debounced writes. localStorage kept as offline cache. **Action required:** run `supabase/migrations/001_add_app_sync.sql` in Supabase SQL Editor. |
| US-002 | Data Load Indicator on App Start                      | UX/UI      | ✅ | 2026-02-20 | 2026-02-20 | New `LoadingScreen.tsx` shown while `isInitializing`. Falls back to localStorage if Supabase offline. |
| US-003 | Unsaved Changes Warning                               | UX/UI      | ✅ | 2026-02-20 | 2026-02-20 | `beforeunload` listener in `App.tsx` fires when `syncStatus === 'saving'`. |
| US-004 | Visible Data Sync Status                              | UX/UI      | ✅ | 2026-02-20 | 2026-02-20 | `SyncIndicator` in `Header.tsx`. Shows Saving… / Saved / Not saved — Retry / Local only. |
| US-005 | Prevent Data Overwrite on Import Without Confirmation | Functional | ✅ | 2026-02-20 | 2026-02-20 | Replace mode requires typing `REPLACE` to unlock confirm. Shows count of records that will be deleted. |


---

## 🟠 P1 — High (Jira Integration Safety)


| ID     | Feature                                        | Type       | Status | Started    | Completed  | Notes                                                                                                                                                                  |
| ------ | ---------------------------------------------- | ---------- | ------ | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-006 | Read-Only Jira Baseline Enforcement            | Functional | ✅      | 2026-02-20 | 2026-02-20 | Amber warning banner in Header when viewing baseline with Jira connected. CTA button to "Create Scenario to Edit Safely". Banner hidden when no Jira connection.       |
| US-007 | Jira Sync Diff Preview Before Applying        | Functional | ✅      | 2026-02-20 | 2026-02-20 | Sync now fetches → computes diff → shows modal (new / updated / removed with item keys & names) → user clicks Apply. Cancel aborts without touching data.             |
| US-008 | Protect Local Mappings During Jira Sync        | Technical  | ✅      | 2026-02-20 | 2026-02-20 | `syncJiraWorkItems` preserves `mappedProjectId/Phase/MemberId` on every merge. Count of preserved mappings shown in diff preview and toast.                           |
| US-009 | Jira Connection Test Before Save               | UX/UI      | ✅      | 2026-02-20 | 2026-02-20 | Already implemented: form requires `connectionStatus === 'success'` before submit. When editing, status pre-filled as success (existing connection assumed working).   |
| US-010 | Jira API Token Security                        | Technical  | ✅      | 2026-02-20 | 2026-02-20 | Token field masked to `••••••••abcd` when editing. "Change Token" button required to replace. Stored token never exposed in UI. `apiTokenMasked` field added to type. |
| US-011 | Sync History Log                               | Functional | ✅      | 2026-02-20 | 2026-02-20 | Last 10 sync entries (timestamp, counts, mappings preserved, errors) stored on `JiraConnection.syncHistory`. Expandable "History (N)" button in Settings > Jira.      |
| US-012 | Scenario Refresh from Jira with Change Preview | Functional | ✅      | 2026-02-20 | 2026-02-20 | "Refresh from Jira" button shows inline summary (N new · N updated · N removed) and requires Yes/Cancel confirmation before applying.                                 |


---

## 🟡 P2 — Medium (User-Friendliness)


| ID     | Feature                                        | Type       | Status | Started | Completed | Notes                                                                      |
| ------ | ---------------------------------------------- | ---------- | ------ | ------- | --------- | -------------------------------------------------------------------------- |
| US-013 | Replace `confirm()` Dialogs with Styled Modals | UX/UI      | ✅ | 2026-02-22 | 2026-02-22 | New `ConfirmModal` component. Replaced last browser `confirm()` in `ScenarioSelector`. All delete flows use styled modals. |
| US-014 | Undo Last Action                               | Functional | ⬜      |         |           | Undo toast for 10 seconds after any delete/destructive action.             |
| US-015 | Capacity Bar Tooltips with Full Breakdown      | UX/UI      | ✅ | 2026-02-22 | 2026-02-22 | `CapacityTooltip` wrapper component. Shows BAU, time off, per-project breakdown and available days on hover. Used on Dashboard capacity bars and Team heatmap. |
| US-016 | Inline Assignment Editing on Timeline          | Functional | ⬜      |         |           | Click a phase bar to edit assignments without leaving the Timeline.        |
| US-017 | Bulk Jira Item Mapping                         | Functional | ⬜      |         |           | Select multiple unmapped items and assign them to a project/phase at once. |
| US-018 | Assignment Validation Feedback Before Saving   | UX/UI      | ✅ | 2026-02-22 | 2026-02-22 | Available capacity shown on each member card immediately. Capacity preview section always visible when member selected. "X days remaining" shown after entering days. |
| US-019 | Empty State Guidance                           | UX/UI      | ✅ | 2026-02-22 | 2026-02-22 | New reusable `EmptyState` component. "Getting started" banner on Dashboard. CTA buttons on Team, Epics, Timeline pages linking to relevant pages. |
| US-020 | Keyboard Shortcuts                             | UX/UI      | ✅ | 2026-02-22 | 2026-02-22 | N → open "add" form on Team/Projects. ? → toggle `KeyboardShortcutsModal`. `?` button added to header. Custom event bus (`keyboard:new`) used for page-specific actions. |
| US-021 | Global Search (Command Palette)                | Functional | ⬜      |         |           | Ctrl+K search across projects, team members, Jira items.                   |
| US-022 | Export to PDF / Print View                     | Functional | ⬜      |         |           | Export Dashboard or Timeline as a formatted PDF.                           |
| US-023 | Dark Mode Persistence Across Devices           | Technical  | ✅ | —          | 2026-02-22 | Already implemented: darkMode lives inside `settings` which is persisted to Supabase on every change. |
| US-024 | Capacity Heatmap on Team View                  | UX/UI      | ✅ | 2026-02-22 | 2026-02-22 | Toggle button (List/Grid icons) on Team page. Heatmap: members × next 5 quarters, cells colour-coded green/amber/red. `CapacityTooltip` on every cell. Legend included. |
| US-025 | Sprint Working Days Count per Column           | Functional | ✅ | 2026-02-22 | 2026-02-22 | Working day count shown under each sprint column header. Quarter headers also show working day count. Bye-week sprints labelled clearly. |


---

## 🟢 P3 — Low (Future Enhancements)


| ID     | Feature                                      | Type       | Status | Started | Completed | Notes                                                               |
| ------ | -------------------------------------------- | ---------- | ------ | ------- | --------- | ------------------------------------------------------------------- |
| US-026 | Scenario Side-by-Side Comparison             | Functional | ⬜      |         |           | Compare two scenarios with a diff view.                             |
| US-027 | Comments / Notes on Projects and Phases      | Functional | ⬜      |         |           | Free-text notes field on project and phase forms.                   |
| US-028 | Notifications for Overallocation on Save     | Functional | ✅ | 2026-02-22 | 2026-02-22 | Warning toast fired in `AssignmentModal` after save when one or more members exceed 100% utilisation in the selected quarter. |
| US-029 | Custom Quarters / Fiscal Year Support        | Functional | ⬜      |         |           | Allow Q1 to start in April to match Mileway's fiscal year.          |
| US-030 | Azure DevOps Integration                     | Functional | ⬜      |         |           | Sync project status from Azure DevOps / ADO.                        |
| US-031 | Automated Weekly Capacity Report by Email    | Functional | ⬜      |         |           | Send weekly email summary via Supabase Edge Function CRON.          |
| US-032 | Archive / Soft Delete for Completed Projects | Functional | ⬜      |         |           | Hide completed projects without permanently deleting them.          |
| US-033 | Team Member Availability Calendar            | UX/UI      | ⬜      |         |           | Visual calendar per member showing assignments, time off, holidays. |
| US-034 | Import Public Holidays from External API     | Functional | ✅ | 2026-02-22 | 2026-02-22 | See US-054/US-055 — implemented as Nager.Date service + Settings import UI. |
| US-035 | Role-Based Access Control (RBAC)             | Technical  | ⬜      |         |           | Viewer / Planner / Admin / Owner roles with Supabase RLS.           |
| US-056 | Staging / Pre-Production Environment         | Technical  | ⬜      |         |           | `develop` branch → Vercel Preview URL → separate Supabase staging project. Branch protection on `main`. |


---

## 🔵 Phase 2 — Group A: Jira Data Enrichment


| ID     | Feature                                              | Type       | Status | Started | Completed | Notes                                                                                |
| ------ | ---------------------------------------------------- | ---------- | ------ | ------- | --------- | ------------------------------------------------------------------------------------ |
| US-036 | Display Labels & Components on Jira Work Items       | UX/UI      | ✅ | 2026-02-22 | 2026-02-22 | Labels shown as indigo tag pills, components as teal pills on each Jira item row. Label and Component filter dropdowns added to Jira Overview filter bar. |
| US-037 | Import Start/End Dates from Jira                     | Functional | ✅ | 2026-02-22 | 2026-02-22 | `duedate` + `customfield_10015` (start date) added to JIRA_FIELDS. Mapped to `startDate`/`dueDate` on `JiraWorkItem`. Dates displayed inline on Jira item rows. |
| US-038 | Verify & Display Email on Team Member Cards          | UX/UI      | ✅ | 2026-02-22 | 2026-02-22 | Email shown on Team page member cards with mail icon. Email field added to TeamMemberForm for manual entry. Input component enhanced with `hint` prop. |


---

## 🔵 Phase 2 — Group B: Naming Convention Alignment


| ID     | Feature                                   | Type  | Status | Started | Completed | Notes                                                                                |
| ------ | ----------------------------------------- | ----- | ------ | ------- | --------- | ------------------------------------------------------------------------------------ |
| US-039 | Global Rename: Project → Epic (UI only)   | UX/UI | ✅ | 2026-02-22 | 2026-02-22 | Nav label, page title, buttons, empty states, toasts, modals, Jira overview, ScenarioDiffModal, Jira settings. Internal code names unchanged. |
| US-040 | Global Rename: Phase → Feature (UI only)  | UX/UI | ✅ | 2026-02-22 | 2026-02-22 | ProjectForm (label, button, default name), AssignmentModal (label, placeholder, info text), ScenarioDiffModal diff details, Jira auto-import explainer. |


---

## 🔵 Phase 2 — Group C: Jira Hierarchy Display


| ID     | Feature                                            | Type       | Status | Started | Completed | Notes                                                                                       |
| ------ | -------------------------------------------------- | ---------- | ------ | ------- | --------- | ------------------------------------------------------------------------------------------- |
| US-041 | Reusable JiraHierarchyTree Component               | Functional | ⬜      |         |           | Tree grouped by parent: Epic → Feature → Story/Task/Bug. Collapsible with chevron toggle.   |
| US-042 | Hierarchy View on Jira Overview Page               | UX/UI      | ⬜      |         |           | Replace flat grouping with nested tree. Keep search/filter controls.                         |
| US-043 | Hierarchy View on Project Detail (Expandable Card) | UX/UI      | ⬜      |         |           | Nested Jira items shown under each feature when project card is expanded.                    |
| US-044 | Hierarchy View in Timeline                         | UX/UI      | ⬜      |         |           | Collapsible sub-rows under each Epic row to show Feature rows.                               |


---

## 🔵 Phase 2 — Group D: Date-Driven Planning


| ID     | Feature                                          | Type       | Status | Started | Completed | Notes                                                                                          |
| ------ | ------------------------------------------------ | ---------- | ------ | ------- | --------- | ---------------------------------------------------------------------------------------------- |
| US-045 | Add Date Fields to Phase and Project Types       | Technical  | ⬜      |         |           | `startDate` + `endDate` on Phase/Project. Auto-populate from Jira child dates. Manual override. |
| US-046 | Date View Mode in Timeline                       | Functional | ⬜      |         |           | Third granularity option: week/month columns with date-range bars per phase.                    |
| US-047 | Date Display on Project/Phase Cards              | UX/UI      | ⬜      |         |           | Show "12 Mar – 15 Jun 2026" alongside quarter label when dates are set.                         |


---

## 🔵 Phase 2 — Group E: Richer Project Detail


| ID     | Feature                              | Type  | Status | Started | Completed | Notes                                                                                         |
| ------ | ------------------------------------ | ----- | ------ | ------- | --------- | --------------------------------------------------------------------------------------------- |
| US-048 | Enhanced Expandable Project Card     | UX/UI | ⬜      |         |           | Summary section: description, stats, team list, Jira stats. Below: phases + hierarchy (US-043). |


---

## 🔵 Phase 2 — Group F: Jira Write-Back


| ID     | Feature                                  | Type       | Status | Started | Completed | Notes                                                                                               |
| ------ | ---------------------------------------- | ---------- | ------ | ------- | --------- | --------------------------------------------------------------------------------------------------- |
| US-049 | Jira Write API in Proxy                  | Technical  | ⬜      |         |           | `updateJiraIssue()` calling PUT /rest/api/3/issue/{key}. Proxy already allows PUT.                   |
| US-050 | "Push to Jira" Preview & Confirm UI      | Functional | ⬜      |         |           | Button per connection. Preview modal showing fields to push. User confirms. Progress + results.       |
| US-051 | Track Push State per Work Item           | Technical  | ⬜      |         |           | `lastPushedAt` + `pushDirty` flags on JiraWorkItem. Dirty indicator on items needing push.            |


---

## 🔵 Phase 2 — Group G: Smart Assignment Suggestions


| ID     | Feature                                      | Type       | Status | Started | Completed | Notes                                                                                                         |
| ------ | -------------------------------------------- | ---------- | ------ | ------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| US-052 | Team Member Scoring Algorithm                | Technical  | ⬜      |         |           | Score by: capacity (40%), skill match (35%), assignment history (25%). Ranked suggestions with score breakdown. |
| US-053 | Suggestion UI in Assignment Flow             | UX/UI      | ⬜      |         |           | Top 3 suggestions with match % badge and reason chips above the full member list.                              |


---

## 🔵 Phase 2 — Group H: Holiday API Integration


| ID     | Feature                                     | Type       | Status | Started | Completed | Notes                                                                                          |
| ------ | ------------------------------------------- | ---------- | ------ | ------- | --------- | ---------------------------------------------------------------------------------------------- |
| US-054 | Nager.Date API Integration                  | Technical  | ✅ | 2026-02-22 | 2026-02-22 | `nagerHolidays.ts` service. `fetchNagerHolidays(countryCode, year)` returns Public/Bank holidays only. No auth required. |
| US-055 | Holiday Import UI in Settings               | Functional | ✅ | 2026-02-22 | 2026-02-22 | New card in Settings > Holidays: country + year selectors, "Preview" fetches from API, list shows which are new vs. already added, "Import all" skips duplicates. Manual CRUD preserved. |


---

## Completed Features

| ID | Feature | Completed | Summary |
|----|---------|-----------|---------|
| US-001 | Activate Supabase as Primary Data Store | 2026-02-20 | Cloud persistence via new `app_sync` table. 1.5s debounced writes, localStorage kept as offline cache. Requires running `supabase/migrations/001_add_app_sync.sql`. |
| US-002 | Data Load Indicator on App Start | 2026-02-20 | Full-screen `LoadingScreen.tsx` shown during Supabase hydration on startup. |
| US-003 | Unsaved Changes Warning | 2026-02-20 | `beforeunload` browser event blocks tab close when a save is in flight. |
| US-004 | Visible Data Sync Status | 2026-02-20 | Live `SyncIndicator` component in header: Saving… / ✓ Saved / Not saved — Retry / Local only. |
| US-005 | Prevent Data Overwrite on Import | 2026-02-20 | Replace mode now requires typing `REPLACE` to unlock confirm button, and shows exact count of records to be deleted. |
| US-006 | Read-Only Jira Baseline Enforcement | 2026-02-20 | Amber warning banner shown when viewing baseline with active Jira connection. CTA to create a safe scenario. |
| US-007 | Jira Sync Diff Preview | 2026-02-20 | Full diff modal (new / updated / removed items with keys) before any sync is applied. Cancel aborts cleanly. |
| US-008 | Protect Local Mappings During Sync | 2026-02-20 | `syncJiraWorkItems` preserves all three mapping fields. Count shown in preview and toast. |
| US-009 | Connection Test Before Save | 2026-02-20 | Form enforces successful test. Edit form pre-fills status as "success" for saved connections. |
| US-010 | API Token Masking | 2026-02-20 | Tokens masked in UI as `••••••••abcd`. "Change Token" flow prevents accidental exposure. |
| US-011 | Sync History Log | 2026-02-20 | Last 10 syncs stored per connection; expandable history panel in Settings > Jira. |
| US-012 | Scenario Refresh Preview | 2026-02-20 | Inline change summary + Yes/Cancel confirmation before refreshing scenario Jira data. |
| US-036 | Display Labels & Components on Jira Work Items | 2026-02-22 | Indigo label pills + teal component pills on each item row. Label/Component filter dropdowns in Jira Overview. |
| US-037 | Import Start/End Dates from Jira | 2026-02-22 | `duedate` + `customfield_10015` mapped to `startDate`/`dueDate`. Dates shown inline on Jira items. |
| US-038 | Verify & Display Email on Team Member Cards | 2026-02-22 | Email visible on member cards. Email input added to TeamMemberForm. Input `hint` prop added. |
| US-039 | Global Rename: Project → Epic (UI only) | 2026-02-22 | All UI labels updated. Internal code names (variables, props, types) unchanged. |
| US-040 | Global Rename: Phase → Feature (UI only) | 2026-02-22 | ProjectForm, AssignmentModal, ScenarioDiffModal, Jira pages, settings all updated. |
| US-013 | Replace `confirm()` Dialogs with Styled Modals | 2026-02-22 | New `ConfirmModal` component with danger/warning variants. Scenario delete now uses styled modal. |
| US-018 | Assignment Validation Feedback | 2026-02-22 | Available capacity shown per member card immediately. Capacity preview always visible once member selected. |
| US-019 | Empty State Guidance | 2026-02-22 | `EmptyState` component with icon + CTA. Dashboard "getting started" banner. CTA links on Team/Epics/Timeline. |
| US-023 | Dark Mode Persistence | 2026-02-22 | Already implemented via `settings` Supabase persistence. No code change required. |
| US-025 | Sprint Working Days Count | 2026-02-22 | Working days shown under each sprint + quarter column header. Bye-weeks labelled with beach emoji. |
| US-015 | Capacity Bar Tooltips | 2026-02-22 | `CapacityTooltip` wrapper on Dashboard capacity bars and Team heatmap cells. Shows full BAU + time off + per-project breakdown on hover. |
| US-020 | Keyboard Shortcuts | 2026-02-22 | N → new form, ? → shortcuts help modal. `?` hint button in header. Custom event bus for page-aware N action. |
| US-024 | Capacity Heatmap | 2026-02-22 | Members × quarters heatmap on Team page behind List/Grid toggle. Green/amber/red cells, tooltips, legend. |
| US-028 | Overallocation Toast | 2026-02-22 | Warning toast after saving assignment when one or more selected members exceed 100% utilisation. |
| US-034 | Holiday API Import | 2026-02-22 | Duplicate of US-054/055 — Nager.Date API service + Settings import UI with preview and deduplication. |
| US-054 | Nager.Date Service | 2026-02-22 | `nagerHolidays.ts` — `fetchNagerHolidays(code, year)` returns filtered Public/Bank holidays. |
| US-055 | Holiday Import UI | 2026-02-22 | Settings > Holidays: country + year selectors, preview list, one-click "Import all" with duplicate skip. |

---

## Changelog

| Date | ID | Change |
|------|----|--------|
| 2026-02-22 | US-015, US-020, US-024, US-028, US-054, US-055 | P2+P3+Group H batch: capacity tooltips, keyboard shortcuts, capacity heatmap, overallocation toast, Nager.Date holiday API + import UI. |
| 2026-02-22 | US-013, US-018, US-019, US-023, US-025 | P2 batch completed: ConfirmModal, assignment validation feedback, empty state guidance, dark mode (already done), sprint working days. |
| 2026-02-22 | US-056     | Added to P3 backlog: Staging / Pre-Production Environment setup (develop branch + Vercel Preview + Supabase staging project). |
| 2026-02-22 | US-039–040 | Group B (Naming Convention) completed: Project → Epic, Phase → Feature across all UI text. Internal code unchanged. |
| 2026-02-22 | US-036–038 | Group A (Jira Data Enrichment) completed: labels/components display + filters, start/end date import, email on team member cards. |
| 2026-02-22 | US-036–055 | Phase 2 backlog added: 20 new user stories across 8 groups (Jira data enrichment, naming alignment, hierarchy display, date planning, project detail, write-back, smart suggestions, holiday API). |
| 2026-02-20 | US-006–012 | All P1 High items completed. Jira baseline warning banner, sync diff preview modal, mapping protection, token masking, sync history log, scenario refresh preview. |
| 2026-02-20 | US-001–005 | All P0 Critical items completed. Supabase wired as primary data store, loading screen added, sync status indicator live in header, import overwrite safeguard added. |
| 2026-02-20 | — | Tracker created. All 35 features added with status ⬜ Not started. |


