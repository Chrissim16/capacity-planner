# User Management Page — Design Document

**Date:** 2026-03-06  
**Status:** Approved  

---

## Problem

Roles are assigned by directly editing the `user_roles` table in the Supabase dashboard. There is no in-app UI for listing users, changing roles, inviting new users, or removing access. The `manage_users` permission and `PermissionGate` component already exist as scaffolding but are wired to nothing.

---

## Goals

1. `system_admin` users can list all app users and their roles
2. `system_admin` can change a user's role via a dropdown (immediate save)
3. `system_admin` can invite a new user by email, with a pre-assigned role
4. `system_admin` can remove a user (revokes auth access, cascades role row)
5. Non-admin users can see the tab in read-only mode (who has what role)

---

## Non-Goals

- Bulk role changes
- Audit log of role changes (future work — `view_audit_log` permission exists)
- SSO / OAuth user management

---

## Architecture

```
Browser (UsersSection.tsx)
  │
  ├── supabase.rpc('get_users_with_roles')  ──► Postgres SECURITY DEFINER function
  │                                               └─ JOINs auth.users + user_roles
  │
  ├── supabase.from('user_roles').upsert()  ──► RLS: system_admin only
  │
  └── fetch('/api/admin', { action, ... })  ──► Vercel serverless (api/admin.js)
                                                 └─ Uses SUPABASE_SERVICE_ROLE_KEY
                                                 └─ invite: inviteUserByEmail + insert user_roles
                                                 └─ remove: deleteUser (cascades user_roles)
```

---

## Data Layer

### Migration 020 — `get_users_with_roles()`

A `SECURITY DEFINER` Postgres function owned by `postgres` so it can read `auth.users`. Returns `(id, email, role, created_at, last_sign_in_at)`. GRANT EXECUTE limited to `authenticated` role only.

### `api/admin.js` (Vercel serverless)

- Validates the caller's Bearer JWT via `adminClient.auth.getUser()` and checks the `user_roles` table to confirm `system_admin` before acting
- `action=invite`: calls `adminClient.auth.admin.inviteUserByEmail(email)` then inserts a `user_roles` row for the invited user's ID with the chosen role
- `action=remove`: calls `adminClient.auth.admin.deleteUser(userId)`; the `user_roles` FK cascade handles cleanup
- CORS mirrors `api/jira.js` (single-origin allowlist via `FRONTEND_URL` env var)
- New required env var: `SUPABASE_SERVICE_ROLE_KEY`

### Role upsert (client-side)

Role changes go directly from the browser to `supabase.from('user_roles').upsert()`. The existing RLS policy in migration 009 already restricts this to `system_admin`.

---

## UI Design

Location: new fourth tab in `Settings.tsx`, labelled **Users**, icon `Shield`.

Tab visibility: shown to all authenticated users. Edit controls (role dropdowns, invite row, remove buttons) are rendered only when `can('manage_users')` is true.

### Layout

```
┌─ Users ───────────────────────────────────────────────────────────┐
│ Manage who has access and what they can do.                       │
│                                                                   │
│  [admin only] Email ____________________  Role ▾  [Send invite]  │
│                                                                   │
│  EMAIL                   ROLE            JOINED      ACTIONS     │
│  alice@mileway.com        system_admin ▾  Jan 2025   [Remove]    │
│  bob@mileway.com          it_manager ▾   Feb 2025   [Remove]    │
│  carol@mileway.com        team_lead ▾    Mar 2025   [Remove]    │
│  you@mileway.com          team_lead      Mar 2025   (you)       │
└───────────────────────────────────────────────────────────────────┘
```

### Behaviour Rules

- **Role change** saves immediately on dropdown select; shows success toast
- **Invite** sends a Supabase invitation email with the selected role pre-assigned
- **Remove** opens `ConfirmModal` before calling the API; the current user's own row cannot be removed
- **Loading**: `SkeletonList` while fetching; inline "Retry" button on error
- **Non-admin view**: role shown as a plain badge (no dropdown); no invite row; no remove buttons

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/020_get_users_with_roles.sql` | New migration |
| `api/admin.js` | New Vercel serverless route |
| `frontend/src/pages/settings/UsersSection.tsx` | New component |
| `frontend/src/pages/Settings.tsx` | Add 4th tab |

---

## Environment Variables Required

| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server-side only) | Supabase Admin API access in `api/admin.js` |

The service role key must **never** be exposed to the browser — it is only used inside the Vercel serverless function.
