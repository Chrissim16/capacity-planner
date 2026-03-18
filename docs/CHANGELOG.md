# Changelog

All notable changes to the Mileway IT Capacity Planner are recorded here.
Newest entry at the top. Format: `[YYYY-MM-DD] — Short title`.

---

## [2026-03-18] — UI fix — scenario banner blue, content area background #FAFAFA

### Changed
- `NotificationBanners.tsx` — scenario-active banner replaced yellow/amber styling with light blue (`bg-[#EFF6FF]`, `border-l-[3px] border-[#0089DD]`); banners now separated into individual early-return branches; Refresh button corrected from off-spec `#0077C2` to `#0089DD`
- `Layout.tsx` — content column wrapper set to `bg-[#FAFAFA]` to remove the blue tint caused by `#F5F8FC` bleeding through from the page root

---

## [2026-03-18] — Design pass — DM Sans font, brand palette refresh, dark mode removed

### Changed
- **Font** — replaced Plus Jakarta Sans with DM Sans across `index.html`, `tailwind.config.js`, `index.css`, and all inline `style={{ fontFamily }}` references
- **Colour palette** — updated to simplified 3-colour system: `#1E293B` primary text, `#94A3B8` secondary text/grey, `#0089DD` blue, `#DEDFE3` borders, `#F5F8FC` page background; removed `#003565`, `#6C7A89`, `#CFCFD5`, `#EEEEF1` across all 60+ files
- **`tailwind.config.js`** — rebuilt `mileway` token namespace with new values; updated `mw` and `biz` legacy aliases; removed `sana` aliases; `darkMode: false`
- **`index.css`** — updated all CSS custom properties to new palette; `--color-primary-dark`, `--color-grey`, `--color-text`, `--color-text-muted`, `--bg-secondary`, `--text-primary/secondary` all updated; heatmap cell colours updated
- **`theme/tokens.ts`** — full rewrite: all colour tokens updated to new palette; `Biz`, `GanttBar`, `ChartColors`, `HeatmapTiers`, `Border`, `Neutral` all updated
- **Sidebar** — updated to use `#DEDFE3` borders, `#1E293B` text, `#94A3B8` muted text; removed remaining old Mileway dark-blue colour values
- **Dark mode** — removed all `dark:` class variants from 19 files; `App.tsx` already clean
- **Gantt BAR** — updated `story`/`task` border to `#DEDFE3`, `uat` fill to `#E6F2FC` per spec
- **Jira Baseline banner** — updated to amber warning style (`bg-[#FEF9C3] border-[#D97706]`); "Create Scenario" button changed from orange to `bg-[#0089DD]` in both `Header.tsx` and `NotificationBanners.tsx`
- **Heatmap header** — changed from dark background (`bg-[#1E293B]`) to light (`bg-[#F5F8FC] text-[#94A3B8]`); current quarter accent updated to `bg-[#E6F2FC] text-[#0089DD]`
- **Orange → amber** — replaced all `#F97316`, `bg-orange-*` with `#D97706` / `bg-[#FEF9C3]` across badge, toast, progress bar, confirm modal, avatar stack components
- **Spacing** — Team.tsx card grids updated from `gap-3 p-4` to `gap-6 p-6`; section labels `mb-3` → `mb-6`; Dashboard alerts grid `gap-3` → `gap-6`

---

## [2026-03-18] — Sidebar redesign — white background, light blue active state

### Changed
- `Sidebar.tsx` — background changed from Dark Blue (#003565) to white with right border (#CFCFD5); active nav item now uses Light Blue 10% tint (#E6F2FC) background + Light Blue text (#0089DD) + 3px left accent line; inactive items use Cool Grey (#6C7A89) with off-white hover (#F5F8FC); logo area uses Dark Blue text on white; all dividers updated to #CFCFD5; avatar uses light blue tint; collapse toggle, sync indicator, and sign-out button adapted to light background
- `ScenarioSelector.tsx` — trigger button colours updated from dark-background white opacity to light-background brand colours (#CFCFD5 border, #6C7A89 text for baseline; #E6F2FC bg, #0089DD text for active scenario)

---

## [2026-03-18] — Design pass — Mileway brand palette, removed dark mode, removed BIZ purple

### Changed
- `tailwind.config.js` — replaced Sana Labs token palette with Mileway brand tokens (`mileway-*`); updated `mw-*` legacy aliases to point to correct brand values; mapped `sana-*` aliases to brand equivalents; set `darkMode: false`; updated border-radius scale to match spec (card = 10px)
- `frontend/src/index.css` — replaced all Sana Labs CSS custom properties with Mileway brand variables (`--color-primary`, `--color-bg`, etc.); updated `--row-hover`, `--blue`, accent references to brand blue
- `Sidebar.tsx` — background changed from off-white to Dark Blue (#003565); nav active state uses Light Blue (#0089DD); inactive items use white/70; all dividers use white/10 opacity; logo/profile area updated to white text
- `theme/tokens.ts` — full rewrite: `Background`, `Text`, `Accent`, `Border`, `Biz`, `Semantic`, `GanttBar`, `RowHover`, `ChartColors` all updated to Mileway brand palette; purple removed from `Biz` (now cool grey family)
- `JiraGantt.tsx` — `BAR` constant updated to brand palette per spec; `TYPE_CHIP_STYLE` updated; BIZ slide-out panel section updated from purple to cool grey
- `components/ui/Button.tsx` — primary button now Light Blue (#0089DD); secondary updated; danger/warning updated to brand status colours
- `components/ui/Input.tsx` — label colour updated to Cool Grey; input padding updated to py-2.5; error colour updated to brand red
- `components/ui/Card.tsx` — default border updated to Cool Grey 30% (#CFCFD5); border-radius updated to 10px
- `components/layout/PageHeader.tsx` — title updated to 24px / font-bold per spec
- `ScenarioSelector.tsx` — scenario colour map updated (purple ID kept, visual replaced with dark-blue tint); all Sana teal references replaced with brand blue; styled for dark sidebar context
- **All pages and components** — 59+ files updated via batch replacement: `slate-*` → brand greys, `#FAF9F7/#F5F3F0/#E8F8F8/#0ED3CF/#1A1A1A` → brand equivalents, `sana-*` Tailwind classes replaced, `mw-blue/mw-purple` replaced
- **Purple (BIZ track)** — removed from all component files: `AvatarStack`, `PlanningBoard`, `SmartAssignmentPanel`, `Dashboard`, `Projects`, `Team`, `Timeline`, `BusinessContactsSection`, `JiraGantt`; replaced with Cool Grey family
- `App.tsx` — removed dark mode `useEffect` (classList.add/remove 'dark')
- `ScenarioSelector.tsx` — scenario dropdown colours updated to brand palette

---

## [2026-03-16] — Smart Staffing & Planning Board — plan review + docs

### Docs updated
- `docs/plans/2026-03-13-smart-staffing-planning-board-design.md` — full rewrite following a Mega Plan Review (EXPANSION mode). Incorporates 14 decisions: `calculateCapacity` fix to deduct `Assignment.days` (D1), dual-track BIZ section in SmartAssignmentPanel (D2), `tentativeAssignments` param for live wizard re-scoring (D3), "Base on" toggle in wizard Step 1 (D4), 7-day localStorage dismiss TTL for Dashboard nudge (D5), lazy-load PlanningBoard + @dnd-kit (D6), already-assigned badge (D7), mini capacity bar (D8), animated capacity bar on drop (D9), RBAC gate on Board (D10), `useReducer` for wizard state (D11), `createScenarioWithPlan()` atomic helper (D12), `getWarnings()` reuse for nudge (D13), architecture.md updated in same PR (D14). Full error handling map, test specs, observability logging, and state machine diagram included.
- `docs/TODOS.md` — new file. Five deferred items with full What/Why/Pros/Cons/Context/Effort/Priority: cross-quarter drag (P2), BIZ board drag (P2), quarterly capacity risk report (P2), skill gap analysis view (P3), contextual wizard entry from existing project (P3).
- `docs/architecture.md` — three targeted updates: Scenarios page Board sub-mode added to §4.3, `staffing.ts` added to §14 Utilities, brand token table in §13.2 updated to show `sana-*` names alongside legacy `mw-*` names.

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
