# TODO — VS Finance Capacity Planner
> Single source of truth for all work. Update at the start of each session.  
> Each item links to its spec. Bugs link to their bug doc.
 
---
 
## 🔴 Now — Sprint in progress

- [ ] **US-SPT-02** · Verify Feature/Story/UAT/Hypercare bar colours (likely visual QA only)  
  → `features/improvements-v3/spec.md` · Phase 1 · Size: S · No deps  
  ⏸ **Deferred** — resume visual QA when convenient
 
---
 
## 🟠 Blocked
 
- [ ] **US-SPT-04** · Discovery Board items in Scenario Planner backlog  
  → `features/improvements-v3/spec.md` · Phase 5  
  ⛔ **BLOCKED** — awaiting PO input: (1) Jira project key for Discovery Board, (2) exact issue type name  
  When unblocked: 13-file exhaustion checklist documented in `2026-03-20-phase0-spike-findings.md`
 
---
 
## 🟢 Backlog — Next quarter
 
- [ ] **Unify Epic/Timeline actuals with Scenario Planner** · No spec yet  
  Three approaches scoped 2026-03-23: (A) Actuals/Forecast toggle on Timeline, (B) overlay plan-vs-actual bars, (C) merge — retire Timeline page, baseline scenario becomes the actuals tab inside Scenario Planner. Recommended: A first, C long-term. Size: L–XL · No deps.

- [ ] **US-SPT-05** · Monthly granularity toggle for Timeline  
  → `features/improvements-v3/spec.md` · Phase 5 · Size: L · Split into 3 sub-tasks before sprint planning

- [ ] **Executive Report / PDF export**  
  → `features/executive-report/spec.md` · Size: M · No deps · **Recommended starting point.**  
  Scoped 2026-03-23. `/report` page: read-only Gantt (`ReportGantt`), capacity risks (`getEpicStaffingRisks` + `getWarnings`), process team table (reuse `ProcessTeamCapacityTable`). PDF via `@react-pdf/renderer`. AI narrative out of scope for this release.

- [ ] **AI narrative report generation** · No spec yet  
  Scoped 2026-03-23. AI-written 2–3 paragraph capacity narrative injected at the top of the Executive Report. Structured capacity JSON → Supabase Edge Function → Claude/OpenAI. Regenerate button, result in component state only. Size: M · **Requires Executive Report page first.**

- [ ] **Skills system** (F-SP-09: SP-22–SP-26) · No spec yet  
  Scoped 2026-03-23. Three parts: (1) global skill library in Settings + assign skills to team members there, (2) inline skill tags on epics/features/stories in the detail panel, (3) skill-match factor in AssignPanel fit score + coverage gap view. New DB tables: `skills`, `team_member_skills`, `jira_work_item_skills`. Size: L–XL · No deps but touches many surfaces.
 
---
 
## 🐛 Open Bugs

*(none)*
 
---
 
## ✅ Done this sprint

> Move items here when shipped, then add an entry to CHANGELOG.md.

- [x] **US-SP-03** · Capacity Bank: process team quarterly table · 2026-03-23  
  `useProcessTeamCapacitySummaries` hook + `ProcessTeamCapacityTable` component. Rendered inside the Scenario Planner Capacity panel (above per-member heatmap) showing available/allocated/utilisation per process team for the selected quarter.

- [x] **US-SPT-06** · Work item summaries in context slide-out panel · 2026-03-23  
  `PlannerDetailPanel.tsx`: added Summary section between Header and Assignees. Uses `stripJiraMarkup` to strip wiki markup before rendering. Truncates at 200 chars with "Show more" toggle; resets on item navigation. XSS-safe — no `dangerouslySetInnerHTML`.

- [x] **US-SP-04** · Remove standalone "By Squad / Team" tab from Dashboard · 2026-03-23  
  Tab bar, tab content, `squadSummaries` memo, `processTeamSummaries` memo, `activeTab` state, `selectedGroupQuarter` state, and the `calculateCapacityBySquad`/`calculateCapacityByProcessTeam` imports all removed. `SquadTeamTab` and `GroupBar` marked `@deprecated`. All `activeTab === 'overview'` guards simplified.

- [x] **US-TL-01** · Align assignment flow between actuals Timeline and Scenario Planner · 2026-03-23  
  `AssignPanel.tsx`: renamed `onPersistDraft(draft: PlannerItem)` → `onSave(itemId, assignees)`. `ScenarioPlanner.tsx` callback adapted. `actions.ts`: added `updateBaselineAssignment(itemId, assignees, fallbackItem?)` that upserts into the baseline scenario's `plannerLayout`. `JiraGantt.tsx`: added `onBarClick?` prop — bar clicks call it when provided (row-label clicks still open BIZ panel). `Timeline.tsx`: wired bar click state, derived `PlannerItem` from baseline or builds transient, renders `AssignPanel`.

- [x] **US-SPT-01** · Fix Epic → Feature → Story hierarchy copy · 2026-03-23  
  `PlannerTimeline.tsx`: refactored `visibleItems` → `visibleRows` (`TimelineRow` union). Orphan items (placed features/stories whose parent Epic is not on the timeline) now surface under a visible **"Unlinked items"** section header instead of silently falling to the bottom. Guarded all `parentKey === epic.jiraKey` matches against `undefined === undefined` false positives. Updated `hasChildrenSet` with the same guard.

- [x] **US-SPT-03** · Carry over actual assignments into cloned scenario · 2026-03-23  
  `ScenarioPlanner.tsx`: removed `initBaselineScenario()` call from the `startMode === 'clone'` branch. `createScenario()` already deep-copies `plannerLayout` (including all `PlannerAssignment` records) from the active scenario — the baseline init was incorrectly overwriting it with empty assignees.

- [x] **BUG-001** · Fallback avatar for deleted/archived team members · 2026-03-23  
  `PlannerTimeline.tsx` (`buildPlannerBarAvatarSlots`): missing IT members and BIZ contacts now render a neutral grey `?` avatar with tooltip "Removed member / Removed contact" instead of falling back to the raw UUID string as initials.

- [x] **US-SP-01** · Centered landing page layout in Scenario Planner · 2026-03-23  
  `max-w-5xl mx-auto w-full` wrapper on home / scenario list; duplicate `max-w-5xl` removed from inner `<ul>`.

- [x] **US-SP-02** · Remove micro-indicator badges from toolbar · 2026-03-23  
  Unscheduled-epic and people count pills removed from Backlog / Team buttons; counts preserved in `title` tooltips (`backlogBadgeCount`, `teamBadgeCount`).

- [x] **Scenario Planner — Implementation Plan Phases 0–4** · Verified 2026-03-23  
  All phases confirmed implemented. File renames vs plan: `PeopleDrawer` → `PlannerTeamDrawer`, `AssignPopover` → `AssignPanel`, `ManualItemModal` → `CreateItemModal`. SP-13 secondary path (drag-to-removal) implemented as sidebar removal zone rather than canvas bottom zone — acceptable deviation.
  - Phase 0: Data model (`isManual`, `labels`, `jiraAssignees`, `jiraStartDate`, `jiraEndDate`), `migratePlannerItem()`, undo toast replaces `EpicMovePrompt`  
  - Phase 1: Backlog tree view, labels/assignees on cards, `baselinePositionForItem()`, `initBaselineScenario()`, availability days on people cards  
  - Phase 2: Undo toast + Shift modifier, `PlannerTeamDrawer`, `AssignPanel` with effort slider, assignment removal  
  - Phase 3: Capacity rows + process team rollups + live drag updates, `CreateItemModal`, `PlannerContextMenu`  
  - Phase 4: Label filter + Epic filter with AND/OR logic and active chip display

- [x] **Scenario Planner Redesign** · Shipped 2026-03-19  
  Self-contained sandbox, home screen landing, backlog drawer auto-collapse, triage flow, capacity ticker, person filter, localStorage restore.

- [x] **SPIKE-01** · Jira Discovery Board issue type audit · 2026-03-20  
  Partial block — scope documented, 13-file checklist ready. Awaiting PO input.

- [x] **SPIKE-02** · AssignPanel reusability in actuals Timeline · 2026-03-20  
  ✅ Resolved — reusable with 2 targeted changes. US-TL-01 updated to M complexity.