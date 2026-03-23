# User Stories — VS Finance Capacity Planner
**Source:** Notebook review session (page 20–21 + Timeline notes)
**Date:** 2026-03-20

---

## Area 1 — Scenario Planner: General

### US-SP-01 · Centered Landing Page Layout
**As a** Project Manager
**I want** the Scenario Planner landing/home screen to use a centered (mid-width) layout
**So that** it feels consistent with the rest of the app and doesn't feel overwhelming on wide screens

**Acceptance Criteria**
- The landing page content is constrained to a centered container (max-width matching the rest of the app's standard page layout)
- Full-width layout is removed
- Layout is visually consistent with other pages in the app (Epic view, Timeline view)
- No horizontal scroll on standard widescreen monitors (1440px+)

**Technical Notes**
- File: `frontend/src/pages/ScenarioPlanner.tsx` (landing section ~lines 1031–1182)
- The landing page currently uses `px-8 py-8` with no max-width constraint
- Add `max-w-5xl mx-auto w-full` wrapper div around the landing content to match the Dashboard scenario list (line ~1085)
- The `Layout.tsx` default variant uses `max-w-[1440px]`; ScenarioPlanner uses `variant='fullbleed'` and manages its own inner layout — do not change the variant, only add inner max-width
- Precedents: `max-w-4xl` (Dashboard capacity bank cards), `max-w-5xl` (Dashboard scenario list)

---

### US-SP-02 · Remove Micro-Indicators from Capacity Overview Header
**As a** Project Manager
**I want** the micro-indicator chips ("Team", "Active Epics", etc.) removed from the Capacity Overview header area
**So that** the overview is clean and only shows the information that matters

**Acceptance Criteria**
- Micro-indicator chips for "Team" and "Active Epics" are no longer rendered in or below the Capacity Overview section
- Removing them does not break the layout of the remaining overview content
- No empty whitespace artifact is left behind where the chips were

**Technical Notes**
- File: `frontend/src/pages/ScenarioPlanner.tsx`
- **Backlog badge** (Active Epics count): remove conditional render at ~lines 1286–1290
  - `backlogBadgeCount` is computed at ~lines 927–930 — leave the variable in place (used elsewhere) but remove the JSX rendering
- **Team badge** (member count): remove conditional render at ~lines 1307–1311
  - `teamBadgeCount` computed at ~lines 933–937 — same: keep variable, remove JSX
- Verify surrounding flex/gap containers don't leave dead space after removal — remove any `gap-*` or padding that becomes orphaned
- No state management changes needed; badge count variables can remain for potential future use

---

### US-SP-03 · Capacity Bank: Show Capacity by Process Team for Current Quarter
**As a** Project Manager
**I want** the Capacity Bank to display available capacity broken down by process team for the current quarter
**So that** I can quickly see where slack or overload exists at the team level without navigating away

**Acceptance Criteria**
- The Capacity Bank shows one row per process team (not per individual)
- Each row displays: team name, total available days, total allocated days, and utilisation % for the current quarter
- "Current quarter" means the app's active quarter (respects existing quarter navigation state), not the real-world calendar date
- Teams with zero allocation still appear (to surface idle capacity)
- Colour coding follows the existing allocation tier system (green / yellow / orange / red)
- Data is computed using the existing `calculateCapacityByProcessTeam()` function

**Technical Notes**
- `calculateCapacityByProcessTeam(processTeamId, quarter, state)` in `frontend/src/utils/capacity.ts` (~lines 435–476)
  - Returns `GroupCapacitySummary { totalDays, usedDays, availableDays, utilization }`
  - Combines IT members (`processTeamIds`) and BIZ contacts (`processTeamIds`)
- `processTeamSummaries` is already computed in `Dashboard.tsx` (~lines 224–229) — reuse this pattern in ScenarioPlanner
- `ProcessTeam` type: `frontend/src/types/index.ts` (~lines 45–48): `{ id: string; name: string }`
- Render as a table/list in the Scenario Planner's Capacity Overview section; one row per process team
- Colour tier thresholds: reuse existing allocation tier logic already used in the Dashboard capacity cards
- **Edge case:** Teams with zero members or zero capacity should show `0 / 0 days — N/A%` rather than crashing

---

### US-SP-04 · Remove Separate "Capacity by Squad/Team" Page
**As a** Project Manager
**I want** the standalone "Capacity by Squad/Team" page removed from the navigation
**So that** there is a single source of truth for capacity information (the Capacity Bank in the Scenario Planner)

**Precondition:** US-SP-03 is implemented and accepted
**Acceptance Criteria**
- The separate Capacity by Squad/Team page is no longer accessible via the sidebar or any navigation link
- Navigating to its former route redirects to the Scenario Planner's capacity section (client-side `<Navigate>` is sufficient)
- No orphaned sidebar navigation entry remains

**Technical Notes**
- Router file: `frontend/src/App.tsx` (~lines 23–55)
- The Dashboard currently renders "By Squad" / "By Process Teams" tabs (~lines 256–280) — if US-SP-03 moves this into ScenarioPlanner, remove or hide those Dashboard tabs too
- For the redirect: replace the route definition with `<Route path="/capacity-squad" element={<Navigate to="/scenario-planner" replace />} />` (verify exact path in App.tsx)
- Remove sidebar link from the navigation component (find via `grep -r "squad"` in `src/components/layout/`)
- No data deletion needed — the capacity data itself remains; only the UI surface is removed

---

## Area 2 — Scenario Planner → Timeline Mode

### US-SPT-01 · Fix Epic → Feature → Story Hierarchy Copy
**As a** Project Manager
**I want** the full Epic → Feature → Story hierarchy to copy correctly into the Scenario Planner Timeline
**So that** I can plan at any level of detail without missing items

**Acceptance Criteria**
- All Features belonging to a copied Epic appear as child rows under that Epic in the Timeline
- All Stories/Tasks belonging to a Feature appear as child rows under that Feature
- Expand/collapse chevrons work correctly at both Epic and Feature level
- No items are silently dropped during the copy — if the source has 3 Features with 8 Stories total, all 11 items appear in the Timeline
- Items without a parent (orphaned stories) surface in a visible "Unparented" section rather than disappearing
- If the copy operation partially fails (e.g. network error), no partial state is written — the operation is atomic or fully rolled back

**Technical Notes**
- `PlannerItem.parentKey?: string` — `frontend/src/types/index.ts` (~lines 481–510)
- Hierarchy is preserved via `jiraKey` / `parentKey` links on each `PlannerItem`
- Baseline initialisation: `buildBaselineLayout()` in `frontend/src/utils/plannerInit.ts` (~lines 116–150); preserves `parentKey` at ~line 136
- Scenario duplicate: `duplicateScenario(scenarioId, newName)` in `frontend/src/stores/actions.ts` (~lines 604–622) — uses `JSON.parse(JSON.stringify(sourceScenario))` which deep-copies `plannerLayout` including all `parentKey` references
- **Likely bug location:** Investigate whether `buildBaselineLayout()` (or whatever function copies Jira items into a new scenario's `plannerLayout`) correctly includes Features and Stories, not just Epics
- Check that `parentKey` values after copy still resolve to items present in the same scenario's `jiraWorkItems` — a missing parent item would cause orphan rendering
- Orphaned items: render in a collapsible "Unparented" section at the bottom of the timeline (do not silently drop)

---

### US-SPT-02 · Update Feature and Story Bar Colours
**As a** Project Manager
**I want** Feature and Story bars in the Scenario Planner Timeline to use updated colours
**So that** bar types are immediately distinguishable and consistent with the agreed visual design

**Acceptance Criteria**
- Feature bars use: fill `#A8C4F5`, border `#6090E0` (1px)
- Story bars use: fill `#D0CCC8`, border `#A09D97` (1px)
- UAT bars: fill `#CDB0F5`, border `#9B6EE2`
- Hypercare bars: fill `#90D9B8`, border `#1A7A52`
- Colours apply in both light and dark mode without contrast issues
- The bar colour legend (if present) is updated to match

**Technical Notes**
- File: `frontend/src/components/planner/PlannerTimeline.tsx` (~lines 51–60)
- The `BAR` record already contains the correct target values — **verify the current values match the spec before making changes**:
  ```ts
  const BAR: Record<string, { bg: string; border: string; borderW: number; radius: number }> = {
    epic:      { bg: 'rgba(168,196,245,0.18)', border: '#6090E0', borderW: 2, radius: 6 },
    feature:   { bg: '#A8C4F5',               border: '#6090E0', borderW: 1, radius: 5 },
    story:     { bg: '#D0CCC8',               border: '#A09D97', borderW: 1, radius: 4 },
    task:      { bg: '#D0CCC8',               border: '#A09D97', borderW: 1, radius: 4 },
    uat:       { bg: '#CDB0F5',               border: '#9B6EE2', borderW: 1, radius: 4 },
    hypercare: { bg: '#90D9B8',               border: '#1A7A52', borderW: 1, radius: 4 },
  };
  ```
- If values already match, this story may be a no-op — confirm with a visual QA pass
- Dark mode: add explicit dark-mode hex overrides if the app supports dark mode theming; otherwise mark as out-of-scope for this story
- Legend: search `PlannerTimeline.tsx` and `ScenarioPlanner.tsx` for any legend rendering and update to match

---

### US-SPT-03 · Carry Over Actual Assignments into Scenario Planner
**As a** Project Manager
**I want** existing team member assignments (from the actuals / baseline) to be pre-populated in the Scenario Planner when I create a cloned scenario
**So that** I start from a realistic picture rather than an empty canvas

**Acceptance Criteria**
- When "Clone current plan" is selected at scenario creation, all existing `PlannerAssignment` records (member + days) are copied into the new scenario's `plannerLayout`
- Assignments are visible on bars immediately — avatars render on the bar and the Capacity Panel reflects the copied load
- The number of assigned days per person per item matches the source
- Assignments are editable within the scenario without affecting the source
- If a work item has no assignment in actuals, it appears in the timeline with no assignees (not blocked)
- Re-cloning a scenario that already has assignments: existing assignments in the destination are replaced (not merged)

**Technical Notes**
- `PlannerAssignment` type: `frontend/src/types/index.ts` (~lines 474–479):
  ```ts
  interface PlannerAssignment {
    memberId: string;
    track: 'IT' | 'BIZ';
    daysPerSprint: number; // 1–10 flat across all sprints
  }
  ```
- `PlannerItem.assignees: PlannerAssignment[]` (~line 495 in types/index.ts)
- `duplicateScenario()` in `frontend/src/stores/actions.ts` (~lines 604–622) already deep-copies via `JSON.parse(JSON.stringify(...))` — assignments **should** be carried over automatically
- **Verify:** Add a test that clones a scenario with assignments and asserts the cloned scenario's `plannerLayout[n].assignees` length and values match the source
- **Risk:** If `memberId` references a team member who has since been archived or deleted, the avatar will render broken — add a defensive check when rendering avatars (fall back to initials + muted style)

---

### US-SPT-04 · Bring in Jira Discovery Board Items for Planning
**As a** Project Manager
**I want** Jira Discovery Board items (ideas/initiatives) to be available in the Scenario Planner backlog
**So that** I can plan speculative or upcoming work alongside committed items

**Acceptance Criteria**
- Items from the Jira Discovery Board appear in the backlog sidebar when their `statusCategory` is not `done`
- They are visually distinguished from standard Epics/Features (e.g. a distinct `IDEA` type pill)
- They can be dragged onto the Timeline and assigned like any other item
- They are excluded from actuals/baseline capacity calculations until explicitly placed in a scenario
- A toggle or filter in the backlog sidebar allows hiding/showing Discovery items

**Technical Notes**
- **Pre-implementation spike required:** Confirm the exact Jira project key and issue type name for "Discovery Board" items before building — `JiraItemType` in `frontend/src/types/index.ts` (~line 298) currently only includes `'epic' | 'feature' | 'story' | 'task' | 'bug'`; a new `'idea'` or `'discovery'` type will need to be added
- `PlannerItemType = JiraItemType | 'uat' | 'hypercare'` (~line 471) — extend similarly
- Backlog component: `frontend/src/components/planner/PlannerBacklog.tsx`
  - Items flow in via `jiraItems: JiraWorkItem[]` prop
  - Unscheduled filter: `!scheduledSourceIds.has(item.id)` (~line 98)
  - Tree node type: `{ item: JiraWorkItem; children: TreeNode[] }` (~lines 69–73)
- Discovery items should be fetched via the existing Jira sync mechanism — confirm the sync query includes the relevant project/issue type
- Backlog toggle state: add `showDiscoveryItems: boolean` to local sidebar state; default `true`; persist in `localStorage` so preference survives page refresh
- `BAR` colour for `'idea'` type: define a distinct colour (e.g. soft orange) in `PlannerTimeline.tsx`

---

### US-SPT-05 · Monthly Granularity Option for Timeline
**As a** Project Manager
**I want** the ability to switch the Scenario Planner Timeline between Sprint view and Month view
**So that** I can plan at a higher level when sprint-level precision isn't needed

**Acceptance Criteria**
- A segmented control in the toolbar offers: `Sprint | Month` granularity options (alongside the existing `Quarter | Full Year` toggle)
- In Month view, each column represents one calendar month; 3 columns in Quarter mode, 12 in Full Year mode
- Bar positions are recalculated to align to month boundaries (bars spanning partial months show proportional widths)
- Sprint snap is replaced by month snap when dragging in Month view
- Capacity panel updates column headers to show month labels (Jan, Feb, …) and aggregates sprint-level capacity into monthly totals
- The current month is highlighted with the same subtle blue tint used for the current sprint

**Technical Notes — Recommended split into 3 sub-tasks:**

**Sub-task A — UI toggle + column headers**
- File: `frontend/src/pages/Timeline.tsx`
- `TimelineGranularity = 'quarter' | 'sprint' | 'dates'` (~line 22); add `'month'` as a valid value
- `granularity` state at ~line 31; add segmented control to toolbar
- Monthly column generation: `visibleMonths` is already computed (~lines 69–79) from `quartersToShow * 3`; reuse this for Month view

**Sub-task B — Bar position recalculation**
- When granularity is `'month'`, bar `left` and `width` must be calculated against month boundaries instead of sprint boundaries
- Proportional width for partial-month bars: `(daysInBar that fall within month) / (total days in month) * columnWidth`
- Snap-on-drag: replace sprint snap grid with month boundary snap when in Month view

**Sub-task C — Capacity panel aggregation**
- Column headers: render `Jan`, `Feb`, … instead of sprint labels
- Aggregate `daysPerSprint` values across all sprints within each calendar month
- Highlight current month column with same CSS class used for current sprint highlight

> Note: The Scenario Planner's `PlannerTimeline` is separate from the actuals `Timeline.tsx` — confirm which (or both) this story targets.

---

### US-SPT-06 · Work Item Summaries in Context Card (Slide-Out Panel)
**As a** Project Manager
**I want** the context card (slide-out panel) for any work item to include a summary of the item
**So that** I can understand what the work is without leaving the planner

**Acceptance Criteria**
- The slide-out panel for any item (Epic, Feature, Story) includes a "Summary" section showing the item's description text
- If the description is longer than ~200 characters, it is truncated with a "Show more" expand control
- If no description exists, the section shows a muted "No summary available" placeholder
- Summary text is read-only in the planner (editing happens in Jira or the Epic view)
- The summary section sits between the header and the Assignees section in the panel layout
- If the description contains Jira markdown/wiki markup, render as plain text (strip markup); do not render raw HTML to avoid XSS

**Technical Notes**
- Panel component: `frontend/src/components/planner/PlannerDetailPanel.tsx`
- Panel is opened via `detailItemId: string | null` state (~line 87 of `PlannerUIState` in ScenarioPlanner.tsx)
- Data lookup: match `detailItemId` against `PlannerItem.jiraKey` then look up the corresponding `JiraWorkItem` for its `description` field
- `JiraWorkItem` available fields: `summary`, `description`, `status`, `priority`, `storyPoints`, `assigneeName`, `labels`
- Truncation: implement with a `useState<boolean>(false)` `expanded` flag; show first 200 chars + "…Show more" button; toggle to full text
- **XSS risk:** Jira descriptions can contain wiki markup or HTML — sanitize before rendering; use a plain-text strip utility or a safe subset renderer (no `dangerouslySetInnerHTML` without sanitization)

---

## Area 3 — Timeline View (Actuals)

### US-TL-01 · Align Resource Assignment Flow with Scenario Planner
**As a** Project Manager
**I want** the resource assignment interaction in the Timeline (actuals) view to match the assignment flow used in the Scenario Planner Timeline
**So that** I only need to learn one interaction pattern across both views

**Acceptance Criteria**
- Clicking a bar in the Timeline (actuals) view opens the same `AssignPanel` component used in the Scenario Planner
- The panel shows team members with available capacity and allows setting `daysPerSprint`
- Assignments made in the Timeline view are saved to the baseline (not to a scenario)
- The Capacity Panel (if visible in the actuals Timeline) updates live when assignments are changed
- Visual design (panel layout, fit badges, effort slider) is identical between the two views
- The old assignment interaction (if different) is fully removed — one flow everywhere

**Technical Notes — Pre-implementation spike recommended**

- `AssignPanel` component: `frontend/src/components/planner/AssignPanel.tsx`
  - `AssigneeRowPanel` sub-component (~lines 88–150): renders member row with 1–10 day slider
  - Fit scoring: `scoreMember()`, `rankMemberFits()`, `scoreBusinessContact()`, `rankBizFits()` in `frontend/src/utils/staffing.ts`
  - Fit colours: `FIT_COLOURS[fitLevel]` (green/amber/red)
- Assignment action: `addPlannerAssignment(itemId, assignment)` in `frontend/src/stores/actions.ts` (~lines 913–931) — appends to `plannerLayout[item].assignees[]`
- **Key risk:** `AssignPanel` was likely built against Scenario Planner state shape. Before wiring it to the actuals Timeline, verify:
  1. The panel's `onSave` callback can accept a different store path (baseline vs. scenario)
  2. The capacity availability calculations used for fit scoring reflect baseline (not scenario) allocation
- Proposed refactor: extract `AssignPanel` props interface to accept a generic `onAssign(assignment: PlannerAssignment): void` callback, letting the caller decide whether to write to baseline or scenario
- Remove the old assignment UI from `Timeline.tsx` / `PlannerTimeline.tsx` actuals path only after the new flow is verified working

---

*Total: 10 user stories across 3 areas*
*Priority order: US-SPT-01 → US-SPT-03 → US-SP-02 → US-SPT-02 → US-TL-01 → US-SP-03 → US-SP-01 → US-SPT-05 → US-SPT-06 → US-SP-04*

**Dependency notes:**
- US-SP-04 requires US-SP-03 to be done first
- US-SPT-04 requires a pre-implementation spike to confirm Jira issue type before sizing
- US-SPT-05 should be split into 3 sub-tasks before sprint planning
- US-TL-01 requires a spike to confirm AssignPanel reusability before committing to estimate
