# Implementation Plan — VS Finance Capacity Planner Improvements v3
**Source:** `docs/plans/2026-03-20-improvements-v3.md`
**Date:** 2026-03-20
**Stories:** 10 (US-SP-01 through US-SPT-06, US-TL-01)

---

## Spikes / Unknowns — Resolve Before Sprint Planning

### SPIKE-01 · US-SPT-04: Jira Discovery Board issue type
**Block on:** US-SPT-04 cannot be sized or started until this is resolved.

Questions to answer:
1. What is the exact Jira project key for the Discovery Board (e.g. `DISC`, `IDEAS`)?
2. What is the Jira issue type name for discovery items (e.g. `Initiative`, `Discovery`, `Idea`)?
3. Does the existing Jira sync API call include that project/type, or does the query need to be extended?
4. Is `JiraItemType` the only discriminant used downstream, or are there switch statements in rendering/calculations that would also need extending?

Output: a one-page spike note confirming (a) exact type string to add to `JiraItemType`, (b) whether the sync query needs a second project key, and (c) a list of all files containing `JiraItemType` switch/record exhaustion that must be updated.

Files to audit during spike:
- `/Users/dennissimon/capacity-planner/frontend/src/types/index.ts` (line 298 — `JiraItemType` union)
- `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerTimeline.tsx` (BAR record, INDENT record)
- `/Users/dennissimon/capacity-planner/frontend/src/components/planner/AssignPanel.tsx` (`typePillClass` switch)
- `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerDetailPanel.tsx` (`TYPE_PILL` record, `STATUS_BADGE` record)
- `/Users/dennissimon/capacity-planner/frontend/src/services/supabaseSync.ts` (sync query filters)

---

### SPIKE-02 · US-TL-01: AssignPanel reusability in actuals Timeline
**Block on:** US-TL-01 cannot be sized until this is resolved.

Questions to answer:
1. What assignment UI currently exists in the actuals `Timeline.tsx`? Is there a panel, an inline form, or nothing?
2. `AssignPanel.onPersistDraft` calls back with a mutated `PlannerItem`. In the actuals path, assignments are stored differently (direct `jiraItemBizAssignments` or member allocation records). Can `onPersistDraft` be replaced with a generic `onAssign(assignment: PlannerAssignment): void`, or does the entire draft model need adapting?
3. `useSprintCells` inside `AssignPanel` calls `calculateCapacity` using `state.teamMembers` from `useCurrentState` — this is the same state in both views. Confirm this is not scenario-scoped.
4. Fit scoring in `staffing.ts` (`scoreMember`, `scoreBusinessContact`) — do these already use baseline allocation, or scenario allocation?

Output: a written answer to each question above, plus a decision on whether `AssignPanel` can be reused as-is with a changed callback, or needs a props-level refactor.

Files to audit during spike:
- `/Users/dennissimon/capacity-planner/frontend/src/pages/Timeline.tsx` (full file — look for any existing assignment interaction)
- `/Users/dennissimon/capacity-planner/frontend/src/components/planner/AssignPanel.tsx` (lines 167–175 — `AssignPanelProps` interface, `onPersistDraft` callback contract)
- `/Users/dennissimon/capacity-planner/frontend/src/utils/staffing.ts` (fit scoring inputs)

---

## Shared Utilities / Components to Extract Once

These should be built or refactored as early as possible so multiple stories can consume them without duplicating logic.

### SHARED-A · `useProcessTeamCapacitySummaries` hook
**Consumed by:** US-SP-03, and potentially a future "capacity by team" widget anywhere in the app.

Extract the pattern already present in `Dashboard.tsx` (~lines 224–229) into a reusable hook. The hook takes `(quarter: string, state: AppState)` and returns `{ id, name, data: GroupCapacitySummary }[]` by mapping over `state.processTeams` and calling `calculateCapacityByProcessTeam` for each. Extracting this prevents the same `useMemo` from being copy-pasted into `ScenarioPlanner.tsx`.

**Target file:** `/Users/dennissimon/capacity-planner/frontend/src/hooks/useProcessTeamCapacitySummaries.ts` (new file)

---

### SHARED-B · `allocationTierClass(utilization: number): string` utility
**Consumed by:** US-SP-03 (Capacity Bank rows), already used in Dashboard capacity cards.

Extract the tier-colour logic (green / yellow / orange / red) from wherever it currently lives in `Dashboard.tsx` into a standalone pure function in `/Users/dennissimon/capacity-planner/frontend/src/utils/allocationTier.ts`. This avoids duplicating threshold constants in `ScenarioPlanner.tsx`.

---

### SHARED-C · `stripJiraMarkup(text: string): string` utility
**Consumed by:** US-SPT-06 (detail panel summary).

A pure function that strips Jira wiki markup (`*bold*`, `_italic_`, `{code}`, `h1.`, `[link|url]`, etc.) and returns plain text. Placed in `/Users/dennissimon/capacity-planner/frontend/src/utils/markup.ts`. Must not use `dangerouslySetInnerHTML`. Tests are straightforward — representative markup strings in, expected plain text out.

---

### SHARED-D · Generic `AssignPanel` callback interface (if SPIKE-02 confirms reuse)
**Consumed by:** US-TL-01.

If SPIKE-02 confirms `AssignPanel` can be generalised, replace the `onPersistDraft: (draft: PlannerItem) => void` prop with:
```
onSave: (itemId: string, assignees: PlannerAssignment[]) => void
```
This keeps the panel ignorant of whether the caller writes to a scenario or to the baseline. The existing Scenario Planner caller adapts by reading `draft.id` and `draft.assignees`. This refactor happens once, in Phase 2, before wiring the actuals Timeline in Phase 4.

---

## Phase Ordering Rationale

```
Phase 1 — Quick wins (zero dependencies, low risk, immediately shippable)
Phase 2 — Scenario Planner data correctness (hierarchy + assignments, medium risk)
Phase 3 — Scenario Planner UI additions (capacity bank, bar colours, detail panel)
Phase 4 — Timeline view alignment (depends on SPIKE-02, SHARED-D)
Phase 5 — Advanced features (monthly granularity, Discovery Board — highest complexity)
```

Each phase produces a shippable diff; earlier phases do not depend on later ones.

---

## Phase 1 — Quick UI Wins
**Goal:** Ship cosmetic and structural fixes with no data-model changes.
**Stories:** US-SP-01, US-SP-02, US-SPT-02

---

### US-SP-01 · Centered Landing Page Layout
**Complexity:** S — Single wrapper div change, no logic.

**Sub-tasks:**

- [ ] **SP-01-T1** Wrap landing content in centered container
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/ScenarioPlanner.tsx`
  - The outer `<div className="flex flex-col flex-1 min-h-0 overflow-auto px-8 py-8">` (line 1032) is the scroll container and must remain. Inside it, wrap the content (the header bar at line 1033 through the closing of the `!activeScenarioId` branch) in a new `<div className="max-w-5xl mx-auto w-full">`. The scenario list `<ul>` at line 1085 already has `max-w-5xl`; the outer wrapper makes the header row and empty states consistent with it.
  - Tool: Claude Code / Edit
  - Verify: At 1440px+ viewport width, the scenario list and "Create Scenario" button are centered with equal left/right margins. No horizontal scroll. The full-bleed background of the page is unchanged.

- [ ] **SP-01-T2** Visual QA against Dashboard scenario list
  - Open Dashboard and Scenario Planner side-by-side (or in sequence). Confirm `max-w-5xl` centering is visually identical on the scenario cards.
  - Tool: Browser
  - Verify: Margins match; no content is cut off at narrow viewports (1024px).

**TDD approach:** This is purely presentational. Write a Playwright snapshot test that asserts the landing container's computed max-width is `≤ 896px` (5xl = 56rem × 16 = 896px) at a 1440px viewport before making the change (it will fail), then after (it passes).

**Dependencies:** None.

---

### US-SP-02 · Remove Micro-Indicator Badges
**Complexity:** S — JSX deletion only; no state change.

**Sub-tasks:**

- [ ] **SP-02-T1** Remove backlog badge span from toolbar
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/ScenarioPlanner.tsx`
  - Delete lines 1286–1290 (the `{backlogBadgeCount > 0 && <span>...</span>}` block inside the backlog toggle button). Leave the button itself and the `backlogBadgeCount` memo untouched.
  - Tool: Claude Code / Edit
  - Verify: The backlog toggle button renders with only the `Inbox` icon. No badge appears regardless of backlog item count.

- [ ] **SP-02-T2** Remove team badge span from toolbar
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/ScenarioPlanner.tsx`
  - Delete lines 1307–1311 (the `{teamBadgeCount > 0 && <span>...</span>}` block inside the Team button). Leave "Team" label text and the `teamBadgeCount` memo.
  - Tool: Claude Code / Edit
  - Verify: The Team button renders as "Team" with the `Users` icon, no numeric badge. `teamBadgeCount` variable still exists in scope (confirm no TypeScript error).

- [ ] **SP-02-T3** Audit surrounding gap/padding for dead space
  - Inspect the flex container wrapping both buttons (the `div` at line 1272). Confirm `gap-2` between buttons remains correct with the badges removed. No empty whitespace strip should appear.
  - Tool: Browser devtools
  - Verify: Button row height is unchanged; no extra gap or empty inline element visible in the DOM.

**TDD approach:** Unit test for the rendered toolbar: assert that no element with `rounded-full bg-mileway-blue text-white` (badge class) exists inside the backlog or team buttons when `backlogBadgeCount > 0` and `teamBadgeCount > 0`. Write the test first against the current code (it will pass, confirming the badge exists), then invert the assertion after deletion (confirms removal).

**Dependencies:** None.

---

### US-SPT-02 · Update Feature and Story Bar Colours
**Complexity:** S — Likely a no-op; requires visual QA only.

**Sub-tasks:**

- [ ] **SPT-02-T1** Verify BAR record values against spec
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerTimeline.tsx` (lines 51–60)
  - Current values already in the codebase:
    - `feature`: bg `#A8C4F5`, border `#6090E0`, borderW 1 ✓
    - `story`: bg `#D0CCC8`, border `#A09D97`, borderW 1 ✓
    - `uat`: bg `#CDB0F5`, border `#9B6EE2`, borderW 1 ✓
    - `hypercare`: bg `#90D9B8`, border `#1A7A52`, borderW 1 ✓
  - All values match the acceptance criteria. **No code change expected.**
  - Tool: Read + visual comparison
  - Verify: A code diff shows zero changes. Document the verification outcome in the PR description.

- [ ] **SPT-02-T2** Check `TYPE_PILL` in `PlannerDetailPanel.tsx` for consistency
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerDetailPanel.tsx` (lines 45–54)
  - `TYPE_PILL` uses the same hex values for `feature` and `story` backgrounds. Confirm these match the BAR spec (they do, based on the read above). No change needed.
  - Tool: Read
  - Verify: No discrepancy between BAR and TYPE_PILL for the same type.

- [ ] **SPT-02-T3** Scan for any separate legend component
  - Search `PlannerTimeline.tsx` and `ScenarioPlanner.tsx` for any legend/key rendering that lists bar colour swatches. If found, confirm it uses the BAR record rather than hardcoded values.
  - Tool: Grep
  - Verify: Either no legend exists (document this) or the legend derives its colours from the BAR constant (no inline hex).

**TDD approach:** Snapshot test on `PlannerTimeline` that asserts the BAR constant exported or accessible via a test hook matches the spec values for `feature`, `story`, `uat`, `hypercare`. Write before and after — if already matching, both pass with zero code change, which is acceptable evidence.

**Dependencies:** None.

---

## Phase 2 — Scenario Data Correctness
**Goal:** Ensure hierarchy and assignments are faithfully carried into scenarios.
**Stories:** US-SPT-01, US-SPT-03

---

### US-SPT-01 · Fix Epic → Feature → Story Hierarchy Copy
**Complexity:** M — Investigation-first; fix scope depends on what the investigation finds.

**Sub-tasks:**

- [ ] **SPT-01-T1** Audit `buildBaselineLayout` for hierarchy completeness
  - File: `/Users/dennissimon/capacity-planner/frontend/src/utils/plannerInit.ts` (lines 116–151)
  - `buildBaselineLayout` iterates `jiraItems.filter(i => i.statusCategory !== 'done')` and calls `baselinePositionForItem`. Items without a resolvable position are silently skipped (`unscheduledCount++`). Features and Stories may be dropped here if they have no Jira start/due date. Confirm: (a) does `jiraItems` passed in include Features and Stories, or only Epics? (b) does `baselinePositionForItem` handle non-Epic types?
  - Tool: Read `plannerInit.ts` fully; trace call site in `actions.ts` to confirm what `jiraItems` argument is passed
  - Verify: Written findings documented as a code comment or separate note before any fix is written.

- [ ] **SPT-01-T2** Write failing test: clone scenario preserves full hierarchy
  - File: `/Users/dennissimon/capacity-planner/frontend/src/utils/plannerInit.test.ts` (new or existing test file)
  - Test: Given a `jiraItems` array with 1 Epic, 2 Features (each `parentKey` pointing to the Epic), and 3 Stories (each `parentKey` pointing to a Feature), and valid sprint data, `buildBaselineLayout` must return all 6 items with `parentKey` values intact.
  - Tool: Vitest
  - Verify: Test fails before fix (RED).

- [ ] **SPT-01-T3** Fix hierarchy inclusion in `buildBaselineLayout` (if T1 finds a gap)
  - If T1 confirms Features/Stories are being dropped due to missing dates, implement fallback positioning: Features inherit parent Epic's `startSprint`/`spanSprints`; Stories inherit parent Feature's position. Fallback only when `baselinePositionForItem` returns null and a parent item exists in the layout.
  - File: `/Users/dennissimon/capacity-planner/frontend/src/utils/plannerInit.ts`
  - Tool: Claude Code / Edit
  - Verify: T2 test now passes (GREEN).

- [ ] **SPT-01-T4** Add "Unparented" section rendering to `PlannerTimeline`
  - Items whose `parentKey` does not resolve to any `jiraKey` in the current `plannerLayout` must be surfaced rather than hidden.
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerTimeline.tsx`
  - Before row rendering, partition items into `rooted` (parentKey resolves or is absent at Epic level) and `orphaned` (parentKey set but does not resolve). Render `orphaned` items under a collapsible "Unparented" section header at the bottom of the row list.
  - Verify: A PlannerItem with `parentKey: 'MISSING-001'` appears in the Unparented section, not silently absent.

- [ ] **SPT-01-T5** Verify `duplicateScenario` carries hierarchy through
  - File: `/Users/dennissimon/capacity-planner/frontend/src/stores/actions.ts` (lines 604–622)
  - `duplicateScenario` uses `JSON.parse(JSON.stringify(sourceScenario))` — this deep-copies `plannerLayout` including `parentKey`. This should already work. Write an integration-level test that clones a scenario and asserts the clone's `plannerLayout` item count and all `parentKey` values match the source.
  - Verify: Test passes without any code change (confirms the deep-copy path is not the bug source).

**TDD approach:** T2 and T5 are written before any fix (T2 RED, T5 GREEN to confirm clone is correct). T3 and T4 follow only if T2 fails.

**Dependencies:** None (investigation may reveal this is simpler than expected).

---

### US-SPT-03 · Carry Over Actual Assignments into Cloned Scenario
**Complexity:** S — Likely already working via deep copy; main task is adding a regression test.

**Sub-tasks:**

- [ ] **SPT-03-T1** Write test: clone scenario preserves assignees
  - File: test file alongside `actions.ts` or in `frontend/src/stores/actions.test.ts`
  - Test: Create a scenario with 2 `PlannerItem` entries, each having `assignees: [{ memberId: 'u1', track: 'IT', daysPerSprint: 3 }]`. Call `duplicateScenario`. Assert the cloned scenario's `plannerLayout[0].assignees` and `plannerLayout[1].assignees` match in length, `memberId`, `track`, and `daysPerSprint`.
  - Tool: Vitest
  - Verify: Test should pass immediately (confirming deep-copy works). If it fails, proceed to T2.

- [ ] **SPT-03-T2** Add defensive avatar rendering for archived members (always required)
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerTimeline.tsx` and `AssignPanel.tsx`
  - In any location that renders an avatar for a `memberId`, add a lookup: if `teamMembers.find(m => m.id === memberId)` returns `undefined`, render a fallback avatar using initials from `memberId` (or a generic "?" avatar) with a muted/grey style rather than crashing or showing broken UI.
  - Verify: A `PlannerItem` with `assignees: [{ memberId: 'deleted-user', track: 'IT', daysPerSprint: 2 }]` renders a grey fallback avatar, no JS error.

- [ ] **SPT-03-T3** Verify "re-clone replaces, not merges" behaviour
  - The acceptance criteria state that re-cloning into a destination replaces existing assignments. `duplicateScenario` creates a new scenario object each time; it does not write into an existing scenario. Confirm the "re-clone" flow in the UI: does the "Clone current plan" action in the scenario creation dialog always call `duplicateScenario` (which creates a new ID), or does it ever write into an existing scenario? If the latter, that write path needs an explicit replace-not-merge guard.
  - Tool: Read `ScenarioPlanner.tsx` creation dialog code
  - Verify: Written confirmation that the re-clone path always produces a new scenario ID.

**TDD approach:** T1 is written first. If it passes immediately (confirming deep copy), US-SPT-03 is largely documentation + T2's defensive rendering.

**Dependencies:** None.

---

## Phase 3 — Scenario Planner UI Additions
**Goal:** Add the Capacity Bank team breakdown, the detail panel summary, and clean up the navigation.
**Stories:** US-SP-03, US-SP-04, US-SPT-06
**Shared prerequisites:** SHARED-A, SHARED-B, SHARED-C must be extracted before these stories start.

---

### SHARED-A + SHARED-B (extract first, ~1 hour total)

- [ ] **SHARED-A-T1** Create `useProcessTeamCapacitySummaries` hook
  - File: `/Users/dennissimon/capacity-planner/frontend/src/hooks/useProcessTeamCapacitySummaries.ts` (new)
  - Signature: `function useProcessTeamCapacitySummaries(quarter: string): { id: string; name: string; data: GroupCapacitySummary }[]`
  - Internally calls `useCurrentState()`, maps `state.processTeams` through `calculateCapacityByProcessTeam(pt.id, quarter, state)`.
  - Wrap in `useMemo` with `[quarter, state.processTeams, state.teamMembers, state.businessContacts]` deps.
  - Verify: Unit test — given a mocked state with 2 process teams and known member allocations, hook returns correct `totalDays` and `utilization` for each team.

- [ ] **SHARED-B-T1** Extract `allocationTierClass` utility
  - File: `/Users/dennissimon/capacity-planner/frontend/src/utils/allocationTier.ts` (new)
  - Pure function: `function allocationTierClass(utilization: number): string` returning a Tailwind class string (e.g. `text-green-600 bg-green-50`) based on thresholds copied from Dashboard. Constants `TIER_THRESHOLDS` defined at the top of the file.
  - Verify: Unit tests covering `0`, `0.49`, `0.50`, `0.74`, `0.75`, `0.89`, `0.90`, `1.0` return correct class strings.

- [ ] **SHARED-C-T1** Create `stripJiraMarkup` utility
  - File: `/Users/dennissimon/capacity-planner/frontend/src/utils/markup.ts` (new)
  - Pure function: strips `h1.` through `h6.`, `*text*`, `_text_`, `+text+`, `??text??`, `{code}...{code}`, `{noformat}...{noformat}`, `[label|url]` → `label`, `[url]` → `url`, and leading/trailing whitespace.
  - Does not use `DOMParser`, `innerHTML`, or any browser API — pure string/regex operations for test portability.
  - Verify: Unit tests with at least 8 representative markup strings covering each pattern. XSS probe: `<script>alert(1)</script>` must be returned as the plain literal string (no execution risk since it is never passed to `innerHTML`).

---

### US-SP-03 · Capacity Bank: Process Team Breakdown
**Complexity:** M — New UI section; uses extracted shared utilities.

**Sub-tasks:**

- [ ] **SP-03-T1** Write component test for `ProcessTeamCapacityTable`
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/ProcessTeamCapacityTable.test.tsx` (new)
  - Given mock `summaries: [{ id, name, data: GroupCapacitySummary }]`, assert: one row per team, correct `totalDays` / `availableDays` / `utilization %` displayed, zero-capacity teams show `0 / 0 days — N/A%`, colour tier class applied.
  - Tool: Vitest + React Testing Library
  - Verify: Test fails (component not yet written).

- [ ] **SP-03-T2** Build `ProcessTeamCapacityTable` component
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/ProcessTeamCapacityTable.tsx` (new)
  - Props: `summaries: { id: string; name: string; data: GroupCapacitySummary }[]`
  - Render as `<table>` with columns: Team Name | Available Days | Allocated Days | Utilisation %. Use `allocationTierClass(data.utilization)` on the utilisation cell. Edge case: `data.totalDays === 0` → display `0 / 0 — N/A%`, do not divide by zero.
  - Tool: Claude Code / Write
  - Verify: T1 test passes.

- [ ] **SP-03-T3** Integrate into Scenario Planner Capacity Overview
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/ScenarioPlanner.tsx`
  - Use `useProcessTeamCapacitySummaries(currentQuarter)` (SHARED-A hook) to derive summaries. Render `<ProcessTeamCapacityTable>` inside the Capacity Overview section of the Scenario Planner. "Current quarter" = the quarter implied by `plannerUI.currentQuarterIndex` (derive from the same quarter generation logic already used in the page).
  - Verify: With real data, Capacity Overview section shows one row per process team. Teams with zero allocation appear (not filtered out). Changing the quarter navigator updates the table.

- [ ] **SP-03-T4** Edge case: no process teams configured
  - If `state.processTeams` is empty, render a muted "No process teams configured." placeholder inside the table area rather than an empty table.
  - Verify: With `processTeams: []`, no JS error and a helpful empty-state message is shown.

**TDD approach:** T1 before T2 (RED → GREEN). T3 is integration (verified in browser). T4 is a unit test variant of T1 with empty input.

**Dependencies:** SHARED-A, SHARED-B.

---

### US-SP-04 · Remove Standalone Capacity by Squad/Team Page
**Complexity:** S — Route redirect and sidebar link removal.
**Precondition:** US-SP-03 accepted.

**Sub-tasks:**

- [ ] **SP-04-T1** Redirect former route
  - File: `/Users/dennissimon/capacity-planner/frontend/src/App.tsx`
  - Investigation: `PATH_TO_VIEW` (line 23) and `pages` (line 47) do not contain a `/capacity-squad` entry — there is no separate route for a standalone squad page. The squad breakdown lives as a tab inside `Dashboard.tsx`. Confirm this by searching for any route or navigation link pointing to a standalone squad page.
  - If no standalone route exists, this sub-task becomes: "hide the By Squad / Team tab in `Dashboard.tsx`" rather than a route redirect.
  - Tool: Grep for `capacity-squad`, `squad` in `App.tsx`, `Sidebar.tsx`
  - Verify: Written confirmation of the actual current state.

- [ ] **SP-04-T2** Remove or hide the "By Squad / Team" tab in `Dashboard.tsx`
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/Dashboard.tsx`
  - The tab array at lines 276–281 contains `{ id: 'squad', label: 'By Squad / Team' }`. Remove this entry. Remove the `{activeTab === 'squad' && <SquadTeamTab .../>}` render block at lines 890–899. If `SquadTeamTab` is only used here, the component can be left in place (do not delete it yet — mark with a `@deprecated` comment for a future cleanup pass).
  - Remove the `squadSummaries` useMemo (~line 215) if it is no longer referenced after the tab removal.
  - Verify: Dashboard renders only the "Overview" tab. No empty tab bar remains. No JS error from removed state.

- [ ] **SP-04-T3** Confirm no sidebar link exists for the squad page
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/layout/Sidebar.tsx`
  - The NAV_ITEMS array (line 49–53) does not include a squad/capacity entry — confirmed during codebase read. This sub-task is a verification step only.
  - Verify: No sidebar link removal needed (document this).

**TDD approach:** Write a test that asserts `Dashboard` does not render any element with text "By Squad / Team" after the change. Write it first (it will fail because the tab is present), then pass after removal.

**Dependencies:** US-SP-03 accepted.

---

### US-SPT-06 · Work Item Summaries in Detail Panel
**Complexity:** M — New UI section in existing panel; XSS handling required.

**Sub-tasks:**

- [ ] **SPT-06-T1** Write unit tests for `stripJiraMarkup`
  - Covered by SHARED-C-T1 above. This is a prerequisite; the story cannot proceed until SHARED-C is complete.

- [ ] **SPT-06-T2** Write component test for the summary section
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerDetailPanel.test.tsx` (new or extend existing)
  - Test cases: (a) `description: "Hello *world*"` → renders "Hello world" (markup stripped); (b) `description: undefined` → renders "No summary available"; (c) `description` > 200 chars → renders truncated text + "Show more" button; (d) clicking "Show more" expands to full text; (e) `description: "<script>alert(1)</script>"` → renders literal `<script>alert(1)</script>` as text, no DOM injection.
  - Verify: All tests fail before implementation.

- [ ] **SPT-06-T3** Implement summary section in `PlannerDetailPanel`
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerDetailPanel.tsx`
  - Data lookup: the panel already receives `jiraItems: JiraWorkItem[]` and `detailItemId`. Match `detailItemId` against `jiraItems` by `jiraKey` or `id` to get the `JiraWorkItem`. Read its `description` field.
  - Add local state: `const [expanded, setExpanded] = useState(false)`.
  - Render a "Summary" section between the Header and Assignees sections. Apply `stripJiraMarkup(description)` before any rendering. Display first 200 chars when `!expanded`; full text when `expanded`. "Show more" / "Show less" toggle button.
  - Empty state: if `!description || description.trim() === ''`, render `<p className="text-sm text-mileway-grey italic">No summary available.</p>`.
  - Do not use `dangerouslySetInnerHTML` anywhere in this section.
  - Verify: T2 tests pass. Manual test: open detail panel for an item with a long Jira description and confirm truncation + expansion work.

- [ ] **SPT-06-T4** Reset `expanded` state when `detailItemId` changes
  - Add a `useEffect(() => { setExpanded(false); }, [detailItemId])` so switching between items in the panel starts each item collapsed.
  - Verify: Open panel for item A (expand summary), click a child item to navigate within the panel, confirm the new item's summary is collapsed.

**TDD approach:** T2 before T3 (RED → GREEN). T4 is verified by manual test.

**Dependencies:** SHARED-C (stripJiraMarkup).

---

## Phase 4 — Timeline View Alignment (Actuals)
**Goal:** Bring the actuals Timeline assignment flow in line with the Scenario Planner.
**Stories:** US-TL-01
**Prerequisite:** SPIKE-02 resolved, SHARED-D refactored.

---

### US-TL-01 · Align Resource Assignment Flow
**Complexity:** L — Depends on spike findings; involves cross-cutting callback refactor and state wiring.

**Sub-tasks:**

- [ ] **TL-01-T1** Refactor `AssignPanel` to accept generic `onSave` callback (SHARED-D)
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/AssignPanel.tsx`
  - Replace `onPersistDraft: (draft: PlannerItem) => void` in `AssignPanelProps` (line 174) with `onSave: (itemId: string, assignees: PlannerAssignment[]) => void`.
  - Update the internal "Save" button handler to call `onSave(draft.id, draft.assignees)` instead of `onPersistDraft(draft)`.
  - Update the existing Scenario Planner caller in `ScenarioPlanner.tsx` to adapt: the caller already has `draft.id` available through the `item` prop, so the adaptation is: `onSave={(itemId, assignees) => onPersistDraft({ ...item, assignees })}` — or refactor the planner's handler directly.
  - Verify: Existing Scenario Planner assignment flow still works end-to-end after the callback rename. All existing assignment tests pass.

- [ ] **TL-01-T2** Write test: actuals assignment writes to baseline, not scenario
  - Test: calling the `onSave` callback from `AssignPanel` when wired to the actuals Timeline calls a `updateBaselineAssignment(itemId, assignees)` action (to be written in `actions.ts`), not `addPlannerAssignment`. Assert that no scenario in state is mutated.
  - Verify: Test fails before implementation.

- [ ] **TL-01-T3** Write `updateBaselineAssignment` action
  - File: `/Users/dennissimon/capacity-planner/frontend/src/stores/actions.ts`
  - Signature: `function updateBaselineAssignment(itemId: string, assignees: PlannerAssignment[]): void`
  - Finds the baseline scenario (`s.isBaseline === true`) in `state.scenarios`, replaces `plannerLayout[item].assignees` immutably (new array, new item, new scenario object). No mutation of the original.
  - Verify: T2 test passes.

- [ ] **TL-01-T4** Identify and remove old assignment UI in `Timeline.tsx`
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/Timeline.tsx`
  - Based on SPIKE-02 findings, locate the existing bar-click assignment interaction. Document what it is before removing it. Remove it only after T5 is verified working.
  - Verify: No remnant of the old interaction remains in the DOM (devtools confirms no old panel or form opens on bar click).

- [ ] **TL-01-T5** Wire `AssignPanel` into `Timeline.tsx`
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/Timeline.tsx`
  - Add state: `const [assignPanelItem, setAssignPanelItem] = useState<PlannerItem | null>(null)`.
  - On bar click in the Gantt view, set `assignPanelItem` to the clicked item.
  - Render `<AssignPanel>` conditionally when `assignPanelItem !== null`, passing `onSave={(itemId, assignees) => { updateBaselineAssignment(itemId, assignees); setAssignPanelItem(null); }}`.
  - `selectedQuarter`: derive from the currently visible quarter in the Timeline granularity state.
  - Verify: Clicking a bar in the actuals Timeline opens the AssignPanel. Saving persists to the baseline scenario. The panel closes after save. Opening another bar item shows a fresh draft.

- [ ] **TL-01-T6** Verify capacity panel updates live (if capacity panel exists in actuals Timeline)
  - If the actuals Timeline has a Capacity Panel, confirm it re-reads from the baseline scenario's `plannerLayout` after `updateBaselineAssignment` and reflects the new allocation without a page refresh.
  - Verify: Assign 3 days to a member on an item; capacity panel shows 3 days allocated for that member in the relevant sprint.

**TDD approach:** T2 and T3 follow TDD strictly (test first, then action). T1 is a refactor (ensure all existing tests pass before and after). T5 and T6 are integration tests verified in the browser.

**Dependencies:** SPIKE-02 resolved, SHARED-D (T1 above), T3 before T5.

---

## Phase 5 — Advanced Features
**Goal:** Monthly granularity and Discovery Board integration.
**Stories:** US-SPT-05, US-SPT-04
**Notes:** US-SPT-04 cannot start until SPIKE-01 is resolved. US-SPT-05 is large and self-contained.

---

### US-SPT-05 · Monthly Granularity Option
**Complexity:** XL — Three distinct sub-systems to change (UI toggle, bar geometry, capacity aggregation); affects both `Timeline.tsx` and `ScenarioPlanner.tsx` / `PlannerTimeline.tsx`.

**Pre-work decision:** Confirm which timeline(s) this story targets. The acceptance criteria say "Scenario Planner Timeline"; the technical note flags that `PlannerTimeline` (used in ScenarioPlanner) and `Timeline.tsx` (actuals) are separate. This plan assumes Scenario Planner only, matching the area heading.

**Sub-task A — UI toggle + column headers**

- [ ] **SPT-05-A1** Extend `PlannerItemType` granularity type in ScenarioPlanner
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/ScenarioPlanner.tsx` (or wherever planner granularity state is held)
  - Identify the planner's granularity state (likely a local `useState` in ScenarioPlanner or PlannerUIState). Add `'month'` as a valid value alongside the existing options.
  - Verify: TypeScript is satisfied; no type errors.

- [ ] **SPT-05-A2** Add `Sprint | Month` segmented control to planner toolbar
  - File: `/Users/dennissimon/capacity-planner/frontend/src/pages/ScenarioPlanner.tsx` (toolbar section)
  - Render a segmented control (two buttons, active style matches existing `Quarter | Full Year` toggle pattern). Toggling sets granularity state. The existing `Quarter | Full Year` controls the number of columns; the new `Sprint | Month` controls column unit.
  - Verify: Both controls render; clicking each updates granularity state (confirm via React DevTools).

- [ ] **SPT-05-A3** Generate month column headers in `PlannerTimeline`
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerTimeline.tsx`
  - When `granularity === 'month'`, replace sprint column headers with month labels (`Jan`, `Feb`, …). The existing `visibleMonths` computation in `Timeline.tsx` (lines 69–79) can be ported or referenced. In Quarter mode: 3 month columns; in Full Year: 12 month columns.
  - Verify: Month headers appear when toggled; sprint headers appear when not.

**Sub-task B — Bar position recalculation**

- [ ] **SPT-05-B1** Write unit tests for month-boundary bar geometry
  - File: new test file alongside `PlannerTimeline` or in `frontend/src/utils/plannerGeometry.test.ts`
  - Test: a `PlannerItem` with `startSprint: 1, spanSprints: 4` (spanning late January through February) produces correct `left` and `width` percentages for a given column width in month granularity.
  - Verify: Tests fail (function not yet written).

- [ ] **SPT-05-B2** Extract bar geometry into a pure utility function
  - File: `/Users/dennissimon/capacity-planner/frontend/src/utils/plannerGeometry.ts` (new)
  - Signature: `function computeBarGeometry(item: PlannerItem, sprints: Sprint[], granularity: 'sprint' | 'month', columnWidth: number): { left: number; width: number }`
  - For `'sprint'` granularity: existing logic (straightforward sprint index × columnWidth).
  - For `'month'` granularity: map each sprint to its calendar month, compute `left` from the month index, compute `width` proportionally: `(daysInItem that fall within this month) / (total days in month) * columnWidth`, summed across all months the item spans.
  - Verify: T1 tests pass.

- [ ] **SPT-05-B3** Wire geometry utility into `PlannerTimeline` bar rendering
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerTimeline.tsx`
  - Replace inline `left`/`width` calculations with `computeBarGeometry(item, sprints, granularity, columnWidth)`.
  - Verify: Bars render correctly in both sprint and month granularity. Partial-month bars show proportional width.

- [ ] **SPT-05-B4** Month-boundary drag snap
  - When `granularity === 'month'`, the drag-and-drop snap grid switches from sprint boundaries to month boundaries. Snap point = first sprint of each calendar month.
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerTimeline.tsx` (drag handler)
  - Verify: Dragging a bar in Month view snaps to month starts, not mid-month sprint boundaries.

**Sub-task C — Capacity panel aggregation**

- [ ] **SPT-05-C1** Write test for monthly capacity aggregation
  - Given a `PlannerItem` with `assignees: [{ daysPerSprint: 3 }]` spanning 3 sprints in January (2 sprints) and February (1 sprint), the monthly aggregation must return `January: 6 days`, `February: 3 days`.
  - Verify: Test fails before implementation.

- [ ] **SPT-05-C2** Implement monthly aggregation in capacity panel
  - File: the capacity panel component used in `ScenarioPlanner.tsx` (locate via `capacityOpen` state and the component it renders)
  - When `granularity === 'month'`, aggregate `daysPerSprint` values for each assignee across all sprints that fall within each calendar month. Column headers switch to month labels.
  - Verify: T1 test passes. Capacity panel shows monthly totals in Month view and sprint totals in Sprint view.

- [ ] **SPT-05-C3** Highlight current month column
  - Apply the same CSS class used for "current sprint" highlight to the current calendar month column.
  - Verify: Current month column has a subtle blue tint; past and future months do not.

**TDD approach:** B1 and C1 before any geometry or aggregation code. A-tasks are UI-first but should have snapshot tests for the toggle component.

**Dependencies:** None beyond existing planner infrastructure. B2 should be extracted before B3 is wired.

---

### US-SPT-04 · Jira Discovery Board Items in Backlog
**Complexity:** L — Requires SPIKE-01; touches type system, sync query, backlog rendering, and bar colours.
**Block:** Do not start until SPIKE-01 is resolved and the exact issue type string is confirmed.

**Sub-tasks:**

- [ ] **SPT-04-T1** Extend `JiraItemType` and `PlannerItemType`
  - File: `/Users/dennissimon/capacity-planner/frontend/src/types/index.ts`
  - Add `'idea'` (or the confirmed type string from SPIKE-01) to both `JiraItemType` and `PlannerItemType` unions.
  - Audit all switch statements and Record types that key on these unions (see SPIKE-01 file list) and add a case/entry for the new type everywhere. TypeScript exhaustiveness will surface any missed locations if the union is used with `never` checking.
  - Verify: `tsc --noEmit` passes with zero errors after the extension.

- [ ] **SPT-04-T2** Extend Jira sync query to include Discovery items
  - File: `/Users/dennissimon/capacity-planner/frontend/src/services/supabaseSync.ts`
  - Based on SPIKE-01 findings, update the JQL or project-key filter to include the Discovery Board project/type. Confirm the sync response maps the new type to the `'idea'` (or confirmed) `JiraItemType` value.
  - Verify: After a Jira sync, Discovery items appear in `state.jiraWorkItems` with the correct `type` value.

- [ ] **SPT-04-T3** Add `BAR` colour entry for `'idea'` type
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerTimeline.tsx`
  - Add: `idea: { bg: '#FFD9B0', border: '#E07A20', borderW: 1, radius: 4 }` (soft orange, distinct from all existing types).
  - Add the same to `TYPE_PILL` in `PlannerDetailPanel.tsx` and `typePillClass` in `AssignPanel.tsx`.
  - Verify: An `'idea'` type PlannerItem renders with the orange bar in the timeline and the correct pill in the detail panel.

- [ ] **SPT-04-T4** Exclude Discovery items from baseline capacity calculations
  - File: `/Users/dennissimon/capacity-planner/frontend/src/utils/capacity.ts` (or wherever items are filtered before actuals calculation)
  - Add a filter: items with `type === 'idea'` are excluded from `calculateCapacityByProcessTeam` and any baseline allocation sum. They only affect capacity once placed in a scenario's `plannerLayout`.
  - Verify: Unit test — a `JiraWorkItem` with `type: 'idea'` does not contribute to `usedDays` in `calculateCapacityByProcessTeam`.

- [ ] **SPT-04-T5** Add `showDiscoveryItems` toggle to `PlannerBacklog`
  - File: `/Users/dennissimon/capacity-planner/frontend/src/components/planner/PlannerBacklog.tsx`
  - Add local state: `const [showDiscovery, setShowDiscovery] = useState(() => localStorage.getItem('backlog-show-discovery') !== 'false')`.
  - Persist on change: `useEffect(() => { localStorage.setItem('backlog-show-discovery', String(showDiscovery)); }, [showDiscovery])`.
  - In `buildSections`, when `showDiscovery === false`, filter out `jiraItems` where `item.type === 'idea'` before processing.
  - Render a toggle button or checkbox in the backlog header: "Show discovery items".
  - Verify: Toggling hides/shows `'idea'` type items. Preference persists across page refresh.

- [ ] **SPT-04-T6** Render `'idea'` type with `IDEA` pill in backlog
  - The backlog tree renders item type pills. Ensure the `'idea'` type renders an "IDEA" pill (distinct styling — soft orange background). Update `typePillClass` in `AssignPanel.tsx` with an `'idea'` case.
  - Verify: Discovery items in backlog show an orange "IDEA" pill, not a default/empty style.

**TDD approach:** T1 triggers TypeScript exhaustiveness — failing build is the "RED" phase. T4 has an explicit unit test before implementation. T5 has a unit test for the filter logic in `buildSections`.

**Dependencies:** SPIKE-01 resolved before any sub-task begins.

---

## Risks & Decisions

| # | Risk / Decision | Owner | Impact if unresolved |
|---|---|---|---|
| R1 | SPIKE-01: Jira Discovery issue type unknown | PO / Backend | US-SPT-04 cannot be started or sized |
| R2 | SPIKE-02: AssignPanel reusability in actuals path | Frontend lead | US-TL-01 estimate could be S or XL depending on how different the state shapes are |
| R3 | `buildBaselineLayout` may silently drop Features/Stories with no Jira dates | Frontend | US-SPT-01 fix scope is unknown until T1 investigation is done |
| R4 | `calculateCapacity` in AssignPanel's `useSprintCells` reads global state, not scenario state | Frontend | If the planner expects scenario-scoped capacity, the fit scoring in AssignPanel may show wrong numbers |
| R5 | Dark mode support for new bar colours (US-SPT-02) | Design | The BAR hex values are hardcoded; if dark mode theming via CSS variables is added in future, these will need revisiting |
| R6 | `processTeams` may not exist in all app states (legacy data) | Frontend | US-SP-03 must guard against `state.processTeams` being undefined or empty |
| R7 | `duplicateScenario` deep-copy relies on JSON serialisability | Frontend | Any non-serialisable value added to `Scenario` in future would silently break assignment carry-over; consider replacing with a typed clone utility |
| R8 | US-SPT-05 targets Scenario Planner only — confirm with PM | PM | If actuals Timeline also needs monthly view, complexity doubles |

---

## Effort Summary

| Story | Phase | Complexity | Est. Dev Time |
|---|---|---|---|
| US-SP-01 | 1 | S | 1–2 h |
| US-SP-02 | 1 | S | 1 h |
| US-SPT-02 | 1 | S | 0.5 h (likely QA only) |
| US-SPT-01 | 2 | M | 4–6 h (investigation-dependent) |
| US-SPT-03 | 2 | S | 2–3 h |
| US-SP-03 | 3 | M | 4–5 h |
| US-SP-04 | 3 | S | 1–2 h |
| US-SPT-06 | 3 | M | 3–4 h |
| US-TL-01 | 4 | L | 6–10 h (spike-dependent) |
| US-SPT-05 | 5 | XL | 10–16 h |
| US-SPT-04 | 5 | L | 6–8 h (spike-dependent) |
| SPIKE-01 | pre | — | 2 h |
| SPIKE-02 | pre | — | 2 h |
| SHARED-A/B/C/D | pre / ph3 | — | 3–4 h total |

**Total estimated range (excluding spikes and shared utilities):** 38–57 developer hours

---

## Suggested Sprint Allocation

**Sprint 1:** SPIKE-01 + SPIKE-02 + Phase 1 (SP-01, SP-02, SPT-02) + SHARED-A/B/C
**Sprint 2:** Phase 2 (SPT-01, SPT-03) + Phase 3 start (SP-03)
**Sprint 3:** Phase 3 complete (SP-04, SPT-06) + Phase 4 (TL-01, post-spike)
**Sprint 4:** Phase 5 (SPT-05, SPT-04 post-spike)
