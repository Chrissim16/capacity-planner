# Best Practices Review — Capacity Planner App

**Date:** 2026-03-02  
**Reviewer:** AI Agent (Cursor)  
**Stack:** React 19 + TypeScript + Vite 5 + Zustand 5 + Supabase (PostgreSQL + Auth) + Tailwind CSS 3

---

## Executive Summary

The codebase is well-structured for a single-developer internal tool. Architecture decisions (Zustand store, Supabase sync, dual IT/BIZ track) are intentional and documented. The main risk areas are:

1. **Security** — RLS policies lock all tables to "any authenticated user"; no role-differentiated write guards exist in the DB beyond the `user_roles` table definition.
2. **Jira token exposure** — The API token travels in the browser and is persisted to Supabase. Accepted risk for an internal tool, but undocumented.
3. **Zero test coverage** — All calculation logic (capacity, sprints, confidence) is untested.
4. **Frontend render safety** — Several array/object Zustand selectors in components may lack `useShallow`, risking re-render loops in React 19.
5. **Service timeout gaps** — Jira API calls have no request timeout or `AbortController`.

---

## 1. Database

### 1.1 Schema & Migration Hygiene

| # | Severity | Finding | File |
|---|----------|---------|------|
| DB-1 | 🟡 | `team_members.role` stores the role **name** (e.g. `"Developer"`) not a FK. This is intentional (avoids JOIN complexity) but undocumented. Add a `COMMENT ON COLUMN` so future engineers don't refactor it accidentally. | `migrations/002_individual_tables.sql` |
| DB-2 | 🟡 | `projects.phases` and `scenarios.*` are stored as JSONB. Acceptable for the current single-tenant model, but any future multi-user or reporting feature will require normalisation. Document this explicitly as a known trade-off. | `migrations/002_individual_tables.sql` |
| DB-3 | 🟢 | Most entity tables have `created_at` but not `updated_at`. Adding `updated_at` + a trigger would help debugging sync conflicts. | All entity tables |
| DB-4 | 🟢 | All app PKs are `text` (nanoid-style). This is consistent but prevents DB-level ordering by creation time without a separate `created_at`. Consider `uuid DEFAULT gen_random_uuid()` for future tables. | — |
| DB-5 | 🟢 | `team_members.country_id` has a comment "references countries(id) by convention, no FK". Add a `CHECK` constraint or at least a `COMMENT ON COLUMN` so the intent is clear. | `migrations/002_individual_tables.sql` |

### 1.2 Migration Idempotency

All reviewed migrations use `IF NOT EXISTS` or `DROP … CASCADE` followed by `CREATE`. The `009` migration uses a PL/pgSQL loop with guards. **No issues found.**

---

## 2. Security & Authorization

### 2.1 Row Level Security

| # | Severity | Finding | File |
|---|----------|---------|------|
| SEC-1 | 🔴 | Migration 002 creates `team_members` with `CREATE POLICY "Allow all access (pre-auth)" … USING (true)`. Migration 009 drops this policy and replaces it with an authenticated-only policy. Verify migration 009 has actually been applied to the live Supabase project — the pre-auth policy is a full data exposure if it is still active. | `migrations/002_individual_tables.sql`, `migrations/009_security_auth_rbac.sql` |
| SEC-2 | 🟡 | The replacement policy `"Authenticated users only" FOR ALL USING (auth.role() = 'authenticated')` grants **every** authenticated user full read/write/delete on every table. The four RBAC roles (`system_admin`, `it_manager`, `team_lead`, `stakeholder`) are defined in `user_roles` but never used to differentiate DB-level permissions. At minimum, restrict DELETE to `it_manager` and above. | `migrations/009_security_auth_rbac.sql` |
| SEC-3 | 🟡 | The `user_roles` self-referential admin policy checks `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'system_admin')`. On a fresh database with no rows, this evaluates to `false`, making it impossible to bootstrap the first admin via the UI. Document (or script) the bootstrap process: `INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'system_admin')`. | `migrations/009_security_auth_rbac.sql` |
| SEC-4 | 🟡 | The `anon` role is revoked on the tables listed in migration 009, but **new tables added in migrations 010–017** (`assignments`, `business_contacts`, `business_time_off`, `business_assignments`, `jira_item_biz_assignments`, `local_phases`) are not covered by that loop. Verify `REVOKE ALL ON … FROM anon` and RLS are applied to these newer tables. | `migrations/010` – `017` |
| SEC-5 | 🟢 | Recommended: replace the repeated `EXISTS (SELECT 1 FROM user_roles …)` subquery with a `SECURITY DEFINER` helper function to reduce duplication and prevent recursive policy evaluation issues: `CREATE OR REPLACE FUNCTION is_role(r text) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = r) $$;` | — |

### 2.2 Jira API Token

| # | Severity | Finding | File |
|---|----------|---------|------|
| SEC-6 | 🟡 | The Jira API token is stored in `JiraConnection.apiToken`, persisted to Supabase (`jira_connections` table), and sent as a `Basic` auth header directly from the browser. This is **accepted for an internal tool** but should be explicitly documented. If the project ever becomes multi-tenant or externally accessible, move token usage to a Supabase Edge Function so it never reaches the client. | `frontend/src/services/jira.ts` |
| SEC-7 | 🟡 | Verify the Jira token is not logged anywhere. A search for `console.log` near `apiToken` or `authorization` in `jira.ts` should return zero results. | `frontend/src/services/jira.ts` |

### 2.3 Frontend Auth Gate

| # | Severity | Finding | File |
|---|----------|---------|------|
| SEC-8 | 🟢 | RBAC roles are defined in the DB but not surfaced in the frontend. When adding role-gated UI, read the role via a dedicated `useUserRole` hook (querying `user_roles`) rather than storing it in `AppState` — it should not be writable by client-side mutations. | `frontend/src/hooks/useCurrentUser.ts` |

---

## 3. Services

### 3.1 supabaseSync.ts

| # | Severity | Finding | File |
|---|----------|---------|------|
| SVC-1 | 🟡 | `DEFAULT_SETTINGS` and `DEFAULT_JIRA_SETTINGS` are duplicated between `supabaseSync.ts` and `appStore.ts`. A drift between the two causes silent data loss on hydration. Extract to a shared `defaults.ts` file and import from both. | `frontend/src/services/supabaseSync.ts`, `frontend/src/stores/appStore.ts` |
| SVC-2 | 🟡 | `loadFromSupabase` fetches all rows from `jira_work_items` without a limit: `supabase.from('jira_work_items').select('*')`. For large Jira workspaces this can fetch thousands of rows in one request. Add pagination or a `created_at` cursor for the initial load. | `frontend/src/services/supabaseSync.ts` |
| SVC-3 | 🟢 | The debounce interval is 1500 ms, which is appropriate. Do not reduce below 1000 ms. |  `frontend/src/services/supabaseSync.ts` |
| SVC-4 | 🟢 | Raw Supabase errors are currently logged with `console.warn` but not propagated to the user in a structured way. Map error codes to user-friendly strings and call `setSyncStatus('error', friendlyMessage)`. | `frontend/src/services/supabaseSync.ts` |

### 3.2 jira.ts

| # | Severity | Finding | File |
|---|----------|---------|------|
| SVC-5 | 🟡 | No `fetch` call in `jira.ts` uses an `AbortController` or timeout. A hanging Jira request will stall the sync indefinitely with no user feedback. Add a `fetchWithTimeout` helper (15 s recommended). | `frontend/src/services/jira.ts` |
| SVC-6 | 🟡 | Custom field IDs (`customfield_10014`, `customfield_10016`, `customfield_10008`, `customfield_10015`) are hardcoded. These vary across Jira instances (especially company-managed vs next-gen). Surface them as configurable fields in `JiraConnection` settings. | `frontend/src/services/jira.ts` |
| SVC-7 | 🟢 | The GreenHopper sprint string parser (regex on serialised Java objects) is fragile. Add a unit test with the known string format to prevent silent regressions. | `frontend/src/services/jira.ts` |

### 3.3 nagerHolidays.ts

No critical issues. The service has a try/catch and returns an empty array on failure. **No issues found.**

---

## 4. UX / UI

### 4.1 Interaction Patterns

| # | Severity | Finding |
|---|----------|---------|
| UX-1 | 🟡 | There is no URL-based routing. Bookmarking, sharing a link to a specific view, and browser back/forward do not work. For an internal tool this is an accepted trade-off, but it also means there is no way to deep-link to a specific Epic or Sprint. Document this as a known limitation. |
| UX-2 | 🟡 | Empty states: several pages (e.g. Scenarios, Team with no members) render a blank area when data is absent. Add an empty-state component with a message and a primary action button. |
| UX-3 | 🟡 | Error recovery: the sync error indicator in the sidebar shows "Error" status but it is unclear to the user what happened or what to do. Add a tooltip or modal with the error message and a "Retry" button. |
| UX-4 | 🟢 | Loading state on initial Supabase load shows a full-screen spinner only when there is no cached data. This is the correct behaviour, but the spinner should include the app name/logo so users recognise it as intentional. |

### 4.2 Accessibility

| # | Severity | Finding |
|---|----------|---------|
| ACC-1 | 🟡 | Gantt bars are clickable `div` elements. They should have `role="button"` and `tabIndex={0}` with keyboard (`Enter`/`Space`) handlers to open the slide-out panel. |
| ACC-2 | 🟡 | The slide-out panel should trap focus when open and restore focus to the trigger element on close. Verify the `Modal` primitive does this; if the panel is custom, add it. |
| ACC-3 | 🟡 | All icon-only buttons (collapse/expand, close X, dark mode toggle) must have an `aria-label`. |
| ACC-4 | 🟢 | Colour is used alone to distinguish IT (blue) vs BIZ (purple) tracks. Add a secondary indicator (icon or label) for colour-blind users. |

### 4.3 Styling

| # | Severity | Finding |
|---|----------|---------|
| STY-1 | 🟢 | `App.css` is confirmed unused (legacy). Safe to delete. |
| STY-2 | 🟢 | Several components likely contain inline hex colours that should use Tailwind tokens. Run a search for hardcoded `#0089DD` or `#7C3AED` in `.tsx` files outside of `JiraGantt.tsx`. |

---

## 5. State Management

| # | Severity | Finding |
|---|----------|---------|
| STATE-1 | 🔴 | React 19 changed `useSyncExternalStore` snapshot semantics: any selector returning a new object/array reference on every call triggers an infinite re-render loop (React error #185). All selectors that return arrays or objects **must** use `useShallow`. The exported selectors in `appStore.ts` already do this, but check that no component calls `useAppStore(s => s.data.someArray)` inline without `useShallow`. |
| STATE-2 | 🟡 | `generateId` in `actions.ts` uses `Date.now() + Math.random()`. This is not cryptographically random and can collide under rapid consecutive calls. Use `crypto.randomUUID()` (available in all modern browsers) or `nanoid`. |
| STATE-3 | 🟡 | `flattenAssignmentsFromProjects` is defined identically in `actions.ts`, `appStore.ts`, and `supabaseSync.ts`. Extract to a shared utility function. |
| STATE-4 | 🟢 | `getCurrentState()` is called in `useCurrentState()` selector which uses `useShallow`. Verify it is never called in a `useEffect` dependency array (would re-run on every render). |

---

## 6. TypeScript Quality

| # | Severity | Finding |
|---|----------|---------|
| TS-1 | 🟡 | The migration function in `appStore.ts` uses `Record<string, unknown>` casts: `const d = { ...data } as Partial<AppState> & Record<string, unknown>`. This bypasses type safety. Consider a discriminated union or Zod schema for migration input validation. |
| TS-2 | 🟢 | `types/index.ts` is the single source of truth — well maintained. No local duplicate interfaces found in the reviewed files. |
| TS-3 | 🟢 | `catch (e: unknown)` is used correctly in most places. A few older `catch (e)` blocks remain — these infer `any` in non-strict mode. |

---

## 7. Performance

| # | Severity | Finding |
|---|----------|---------|
| PERF-1 | 🟡 | `JiraGantt.tsx` renders potentially hundreds of rows on every state change. Verify `rows` array derivation and `barLayout()` calls are inside `useMemo` blocks keyed to the relevant state slices. |
| PERF-2 | 🟡 | `loadFromSupabase` fetches all `jira_work_items` rows in one call (see SVC-2). For 500+ items this can be a 1–2 MB payload on every page reload. |
| PERF-3 | 🟢 | `localStorage.setItem(STORAGE_KEY, JSON.stringify(newData))` is called synchronously on every `updateData`. For large AppState objects (many Jira items) this can block the main thread. Consider offloading to a `requestIdleCallback` wrapper. |

---

## 8. Testing

| # | Severity | Finding |
|---|----------|---------|
| TEST-1 | 🟡 | Zero test coverage. The utility functions (`sprints.ts`, `capacity.ts`, `confidence.ts`, `calendar.ts`) are pure and deterministic — ideal starting point for Vitest unit tests. |
| TEST-2 | 🟡 | The Jira GreenHopper sprint string parser and the `itemDates()` three-pass resolver are complex and have no tests. Any silent regression here breaks the entire Gantt. |
| TEST-3 | 🟢 | Recommend E2E tests with Playwright for: login flow, Jira sync diff review, scenario creation, and XLSX export. |

---

## Summary Table

| Area | Critical 🔴 | Improvements 🟡 | Nice to have 🟢 |
|------|------------|----------------|----------------|
| Database | 0 | 1 (DB-1 doc gap) | 4 |
| Security / Auth | 1 (SEC-1 verify live RLS) | 5 | 1 |
| Services | 0 | 4 | 3 |
| UX / UI | 0 | 5 | 3 |
| State Management | 1 (STATE-1 useShallow) | 2 | 1 |
| TypeScript | 0 | 1 | 2 |
| Performance | 0 | 2 | 1 |
| Testing | 0 | 2 | 1 |

---

## Recommended Action Order

1. **Verify SEC-1** — Confirm migration 009 is applied and the `Allow all access (pre-auth)` policy is gone from the live database.
2. **Fix STATE-1** — Audit all `useAppStore` calls in components for missing `useShallow` on object/array selectors.
3. **Add SVC-5** — Add `fetchWithTimeout` to `jira.ts` to prevent hanging sync.
4. **Extract SVC-1** — Move duplicate defaults to `src/services/defaults.ts`.
5. **Add SEC-4 check** — Ensure migrations 010–017 tables have `REVOKE ALL ON … FROM anon`.
6. **Add ACC-1/2/3** — Keyboard and screen-reader support for Gantt bars and panels.
7. **Start TEST-1** — Add Vitest for `sprints.ts`, `capacity.ts`, `confidence.ts`.

---

## No Issues Found In

- `supabase.ts` (Supabase client initialisation)
- `nagerHolidays.ts`
- `useCurrentUser.ts`
- Migration idempotency (all migrations use `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`)
- `loadFromSupabase` parallel fetch structure (`Promise.all`)
- Sync debounce interval (1500 ms — appropriate)
- Zustand store UI state partialisation (only serialisable UI slices persisted)

---

*This report was generated by the `review-backend` and `review-frontend` agents. Re-run at any time by invoking those skills in Cursor.*
