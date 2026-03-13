# Changelog

All notable changes to the Mileway IT Capacity Planner are recorded here.
Newest entry at the top. Format: `[YYYY-MM-DD] — Short title`.

---

## [2026-03-13] — BizPopover Save button always visible

### Fixed
- `BizPopover` Save button was invisible until hover — `bg-mw-purple` is an unregistered Tailwind token producing no background; replaced with `bg-purple-600`

---

## [2026-03-13] — BizPopover overflow fix

### Fixed
- `BizPopover` dropdown no longer clipped by the epic card border — removed `overflow-hidden` from the epic card container so the absolutely-positioned popover menu is fully visible

---

## [2026-03-13] — Team member name protection + BizPopover UX fix

### Added
- `name_manually_edited` boolean column on `team_members` table (migration `026_team_member_name_override.sql`) — flags names that have been manually edited so Jira sync cannot overwrite them

### Fixed
- `BizPopover` — explicit Save button replaces auto-save; field order corrected

### Docs updated
- `docs/CHANGELOG.md` — backfilled all entries since 2026-02-26 (this session)

---

## [2026-03-10] — Jira-First Epic Hierarchy refactor

### Changed
- **Breaking refactor (Phases 1–10):** removed the `Project` / `Phase` / `Assignment` / `BusinessAssignment` / `LocalPhase` model entirely. `JiraWorkItem` (with `parentKey`) is now the sole hierarchy entity — Epic → Feature → Story/Task/Bug
- IT effort is now derived directly from Jira story points + assignee; no manual IT assignment layer
- `Scenario` snapshot updated to store `jiraWorkItems`, `jiraItemBizAssignments`, `teamMembers`, `timeOff`
- Added missing scenario columns for the Jira-First model (migration)
- "Projects" renamed to "Epics" and "Phases" to "Features" throughout the entire app (nav, titles, filters, toasts)

### Added
- Label filter on Timeline Gantt view
- Confidence level badge on story rows in the Epics page

### Fixed
- TypeScript build errors from Jira-First refactor resolved
- Capacity calculation falls back to sprint dates when name matching fails
- Confidence level description column widened in Settings

### Docs updated
- `docs/plans/2026-03-09-jira-first-epic-hierarchy-design.md` — approved design document

---

## [2026-03-09] — Sana Labs UI redesign

### Changed
- Full design system overhaul: warm off-white backgrounds (`sana-bg`), Source Serif 4 editorial headings, teal/orange accent palette, sidebar-beside-content layout, collapsible sidebar, `PageHeader` component, recharts styling rules, dark-mode deferred

### Fixed
- Null-safe role preservation prevents mid-session role downgrade

---

## [2026-03-06] — User management, RBAC simplification, and auth security

### Added
- In-app User Management page (invite, assign roles, revoke)
- Migration `022` — `get_users_with_roles` RPC function

### Changed
- User roles simplified to three: `system_admin` / `project_manager` / `read_only` (was four roles)
- Settings page and nav gated to `system_admin` only
- Role lookup moved to `SECURITY DEFINER` RPC (`get_user_role`) to prevent silent empty reads from RLS
- Auth quick-wins from security audit applied (anon role hardening, RLS policy tightening)

### Fixed
- Migration `019` made idempotent when `user_roles` table does not exist
- Stale old role strings removed (broke build and invite flow)
- `user_roles` RLS SELECT policy simplified to prevent silent empty reads
- TypeScript cast error on `supabase.rpc()` in `fetchUserRole`
- Role flicker and mid-session revert to `project_manager` eliminated

### Docs updated
- `docs/plans/` — user management page design doc + role rename design doc

---

## [2026-03-04] — Dashboard squad/team capacity tab

### Added
- "By Squad / Team" capacity tab on the Dashboard — shows sprint-level utilisation grouped by squad and process team

### Fixed
- Removed stray "New Epic" button from Dashboard header

---

## [2026-03-03] — Epics and Timeline UX enhancements

### Added
- Sort dropdown on Epics view (name, status, priority, start date)
- Description header always visible in slide panel with empty-state fallback
- Jira link button + description field in Timeline slide panel
- Hide completed Jira items from Timeline by default (toggle to show)

### Fixed
- Person filters wired into epic cards; silent exclusion from email mismatch resolved
- Duplicate sort dropdown removed; overflow clipping on epic card menu fixed

---

## [2026-03-02] — App quality sprint

### Added
- Unit tests (vitest) for core utilities
- Empty states across Epics, Timeline, and Team views
- Jira custom field support (`customfield_10014`, `customfield_10016`)
- URL routing — views bookmarkable
- `fetchWithTimeout` helper with `AbortController`
- `crypto.randomUUID()` replacing `nanoid` for ID generation
- RLS verification migration (`018`) with table-existence guard

### Changed
- `useShallow` selectors on all Zustand subscriptions to prevent unnecessary re-renders
- `flattenAssignments` extracted to shared utility
- `App.css` deleted — styling fully in Tailwind
- Design tokens consolidated; skeleton loading states added; dark-mode token cleanup
- Vitest config separated from Vite build config (fixes production build)

---

## [2026-02-27] — Filter and UX fixes

### Fixed
- Filter control heights normalised using plain `<select>` with `py-1.5`
- Scenario dropdown fix, custom phase types, IT/BIZ phase assignees in layout pass
- BIZ days editing, panel alignment, Timeline/Epics filter sizing
- `DashboardPeopleFilter` type exported and used correctly
- Dashboard people filter persisted so BIZ contacts survive navigation

---

## [2026-02-26] — Documentation audit and consolidation

### Added
- `docs/README.md` — developer-facing project overview, folder structure, run instructions
- `docs/data-model.md` — all data entities, dual-track model, sprint date reference, capacity formula
- `docs/architecture.md` — tech stack, state management, Gantt positioning logic, CSS tokens, Supabase sync
- `docs/onboarding.md` — non-technical intro, run guide, view status table, dual-track explanation, key rules
- `docs/views/epic-view.md` — full spec for the Epics (Projects) view, derived from code
- `docs/views/timeline-view.md` — updated Timeline spec with 8 spec-vs-code mismatch annotations
- `docs/views/team-view.md` — placeholder spec for the planned Team Capacity view
- `.cursorrules` — 14 enforced coding rules (dual-track, bar positioning, overflow, colour tokens, hierarchy)

### Changed
- `Documentation/` → `docs/legacy/` — all original specs moved, preserved as historical reference
- `frontend/docs/` — deleted (superseded by root `docs/`)

### Docs updated
- All docs were created in this session; this entry is the baseline.

---

## [2026-02-26] — BIZ contact extra columns (migration 016)

### Changed
- Added extra columns to the `business_contacts` table in Supabase (migration `016_biz_contacts_extra_cols.sql`)

### Docs updated
- `docs/data-model.md` — `BusinessContact` entity reflects all current fields

---

## [2026-02-26] — JiraItemBizAssignment days field (migration 015)

### Added
- `days` column added to `jira_item_biz_assignments` table (migration `015_jira_item_biz_assign_days.sql`)
- `JiraItemBizAssignment.days` field now stores effort in days per contact per Jira item

### Docs updated
- `docs/data-model.md` — `JiraItemBizAssignment` entity updated with `days` field description

---

## Current Feature Status

| View | Status | Notes |
|---|---|---|
| Capacity (Dashboard) | Built | Team utilisation summary |
| Timeline — Gantt | Built | Jira bars, LocalPhases, continuation arrows, quarter/year modes |
| Timeline — Team grid | Built | Quarter/sprint/month granularity for IT members |
| Epics (Projects) | Built | Jira hierarchy tree, BIZ assignment, confidence levels |
| Team — IT members | Built | Card + list view, enrichment flow, bulk edit |
| Team — Business Contacts | Built | Card + list view, capacity badge, archive/convert |
| Scenarios | Built | What-if planning with isolated data copies |
| Settings | Built | Sprints, Jira, countries, holidays, roles, skills, systems |
| Team Capacity View | Planned | Sprint-level overload/underload per person — see `docs/views/team-view.md` |
| Sprint View | Planned | Sprint-scoped delivery detail |
| AI Status Report Export | Planned | GPT-generated narrative of current project status |
