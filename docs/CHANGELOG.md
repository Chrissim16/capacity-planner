# Changelog

All notable changes to the Mileway IT Capacity Planner are recorded here.
Newest entry at the top. Format: `[YYYY-MM-DD] — Short title`.

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
