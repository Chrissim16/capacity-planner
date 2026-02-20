# Feature Tracker

# Mileway IT Capacity Planner

**Last updated:** February 20, 2026  
**Total features:** 35  
**Completed:** 12 / 35

---

## Progress Overview


| Priority         | Total  | Done   | In Progress | Not Started |
| ---------------- | ------ | ------ | ----------- | ----------- |
| 🔴 P0 — Critical | 5      | 5      | 0           | 0           |
| 🟠 P1 — High     | 7      | 7      | 0           | 0           |
| 🟡 P2 — Medium   | 13     | 0      | 0           | 13          |
| 🟢 P3 — Low      | 10     | 0      | 0           | 10          |
| **Total**        | **35** | **12** | **0**       | **23**      |


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
| US-013 | Replace `confirm()` Dialogs with Styled Modals | UX/UI      | ⬜      |         |           | All browser confirm() calls replaced with in-app ConfirmModal component.   |
| US-014 | Undo Last Action                               | Functional | ⬜      |         |           | Undo toast for 10 seconds after any delete/destructive action.             |
| US-015 | Capacity Bar Tooltips with Full Breakdown      | UX/UI      | ⬜      |         |           | Hover shows BAU + time off + per-project breakdown.                        |
| US-016 | Inline Assignment Editing on Timeline          | Functional | ⬜      |         |           | Click a phase bar to edit assignments without leaving the Timeline.        |
| US-017 | Bulk Jira Item Mapping                         | Functional | ⬜      |         |           | Select multiple unmapped items and assign them to a project/phase at once. |
| US-018 | Assignment Validation Feedback Before Saving   | UX/UI      | ⬜      |         |           | Real-time capacity status updates as days are entered in assignment modal. |
| US-019 | Empty State Guidance                           | UX/UI      | ⬜      |         |           | Helpful prompts and CTA buttons when views have no data.                   |
| US-020 | Keyboard Shortcuts                             | UX/UI      | ⬜      |         |           | N for new, Ctrl+Z for undo, Escape to close, ? for help.                   |
| US-021 | Global Search (Command Palette)                | Functional | ⬜      |         |           | Ctrl+K search across projects, team members, Jira items.                   |
| US-022 | Export to PDF / Print View                     | Functional | ⬜      |         |           | Export Dashboard or Timeline as a formatted PDF.                           |
| US-023 | Dark Mode Persistence Across Devices           | Technical  | ⬜      |         |           | Store dark mode preference in Supabase, not just localStorage.             |
| US-024 | Capacity Heatmap on Team View                  | UX/UI      | ⬜      |         |           | Colour-coded grid: members × quarters showing utilisation %.               |
| US-025 | Sprint Working Days Count per Column           | Functional | ⬜      |         |           | Show exact working days per sprint column, accounting for public holidays. |


---

## 🟢 P3 — Low (Future Enhancements)


| ID     | Feature                                      | Type       | Status | Started | Completed | Notes                                                               |
| ------ | -------------------------------------------- | ---------- | ------ | ------- | --------- | ------------------------------------------------------------------- |
| US-026 | Scenario Side-by-Side Comparison             | Functional | ⬜      |         |           | Compare two scenarios with a diff view.                             |
| US-027 | Comments / Notes on Projects and Phases      | Functional | ⬜      |         |           | Free-text notes field on project and phase forms.                   |
| US-028 | Notifications for Overallocation on Save     | Functional | ⬜      |         |           | Toast notification when an assignment causes overallocation.        |
| US-029 | Custom Quarters / Fiscal Year Support        | Functional | ⬜      |         |           | Allow Q1 to start in April to match Mileway's fiscal year.          |
| US-030 | Azure DevOps Integration                     | Functional | ⬜      |         |           | Sync project status from Azure DevOps / ADO.                        |
| US-031 | Automated Weekly Capacity Report by Email    | Functional | ⬜      |         |           | Send weekly email summary via Supabase Edge Function CRON.          |
| US-032 | Archive / Soft Delete for Completed Projects | Functional | ⬜      |         |           | Hide completed projects without permanently deleting them.          |
| US-033 | Team Member Availability Calendar            | UX/UI      | ⬜      |         |           | Visual calendar per member showing assignments, time off, holidays. |
| US-034 | Import Public Holidays from External API     | Functional | ⬜      |         |           | Auto-import holidays from Nager.Date or similar API.                |
| US-035 | Role-Based Access Control (RBAC)             | Technical  | ⬜      |         |           | Viewer / Planner / Admin / Owner roles with Supabase RLS.           |


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

---

## Changelog

| Date | ID | Change |
|------|----|--------|
| 2026-02-20 | US-006–012 | All P1 High items completed. Jira baseline warning banner, sync diff preview modal, mapping protection, token masking, sync history log, scenario refresh preview. |
| 2026-02-20 | US-001–005 | All P0 Critical items completed. Supabase wired as primary data store, loading screen added, sync status indicator live in header, import overwrite safeguard added. |
| 2026-02-20 | — | Tracker created. All 35 features added with status ⬜ Not started. |


