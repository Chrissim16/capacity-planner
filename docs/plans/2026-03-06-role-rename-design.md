# Role Rename & Simplification — Design Document

**Date:** 2026-03-06  
**Status:** Approved  

---

## Problem

The current 4-role system (`system_admin`, `it_manager`, `team_lead`, `stakeholder`) does not reflect how the app is actually used. The two middle roles (`it_manager`, `team_lead`) overlap significantly and confuse administrators who need to assign roles.

---

## New Role Model (3 roles)

| DB value | Display name | Description |
|---|---|---|
| `system_admin` | System Administrator | Full access — settings, users, audit log |
| `project_manager` | Project Manager | Day-to-day planning work + Jira sync |
| `read_only` | Read Only | View everything, change nothing |

---

## Permission Matrix

| Action | System Administrator | Project Manager | Read Only |
|---|:---:|:---:|:---:|
| `view_all` | ✅ | ✅ | ✅ |
| `edit_assignments` | ✅ | ✅ | — |
| `edit_projects` | ✅ | ✅ | — |
| `edit_team_members` | ✅ | ✅ | — |
| `manage_scenarios` | ✅ | ✅ | — |
| `sync_jira` | ✅ | ✅ | — |
| `manage_settings` | ✅ | — | — |
| `manage_users` (write) | ✅ | — | — |
| `view_audit_log` | ✅ | — | — |

Notes:
- The Users tab is visible to all roles (read-only). Only `manage_users` gates write actions.
- `manage_scenarios` is a new action added to the permission system.
- `sync_jira` is a new action. Since the Jira sync button currently lives in Settings > Jira tab (inaccessible to PM), a sync shortcut will be surfaced in the Epics/Projects page header for users with `sync_jira` but without `manage_settings`.

---

## Data Migration

Existing `user_roles` rows are migrated as follows:

| Old role | → New role |
|---|---|
| `system_admin` | `system_admin` (unchanged) |
| `it_manager` | `project_manager` |
| `team_lead` | `project_manager` |
| `stakeholder` | `read_only` |

The column CHECK constraint and default value are updated in the same migration.  
Default for new users: `project_manager` (was `team_lead`).

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/021_rename_roles.sql` | New migration: migrate data + update CHECK constraint + update default |
| `frontend/src/hooks/useCurrentUser.ts` | New `AppRole` type, new `AppAction` values, updated `PERMISSIONS` matrix, updated fallback default |
| `frontend/src/pages/settings/UsersSection.tsx` | Update `ALL_ROLES` array and `ROLE_LABELS` map |
| `frontend/src/pages/Scenarios.tsx` | Gate create/duplicate/delete behind `can('manage_scenarios')` |
| `frontend/src/pages/Projects.tsx` | Surface Jira sync shortcut for `can('sync_jira')` users |

---

## Jira Sync for Project Manager

Since the full Jira tab in Settings is restricted to `system_admin`, a minimal "Sync Jira" button is added to the **Epics/Projects page** header. It is visible only when:
1. At least one active Jira connection exists, and
2. The user has `can('sync_jira')`

It triggers the same `handleSync` / `handleSyncAll` logic already used in `JiraSection.tsx`, extracted into the shared `jiraSync` application layer (`frontend/src/application/jiraSync.ts`).

---

## Fallback Behaviour

When role lookup fails at login time, the safe default is `project_manager` (was `team_lead`). This gives the user the standard working set of permissions rather than read-only access.
