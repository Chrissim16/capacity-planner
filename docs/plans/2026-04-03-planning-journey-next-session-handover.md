---
status: In Progress
created: 2026-04-03
author: Codex
branch: feature/ux-costing-rebuild
base: origin/design/brand-pass
related:
  - 2026-04-02-master-plan.md
  - 2026-04-02-planning-journey-ux-handover.md
  - 2026-04-02-ux-coherence-and-costing-handover.md
  - 2026-04-02-costing-module-implementation-spec.md
  - 2026-04-03-ux-costing-rebuild-session-handover.md
---

# Planning Journey + Costing — Next Session Handover

## Purpose

Carry the current branch forward without losing the original product intent.

This document is the next-session handover for the work already completed on:

- planning journey / information architecture
- shared scenario model
- Portfolio Planning costing
- Delivery Planning rebuild direction
- Delivery Tracking cleanup

It lists:

- which original documents still matter
- what is already implemented on the branch
- what remains to ship
- the recommended execution order for the next session

---

## Source Documents To Keep Open

Use all of these together, but not as equal sources of truth.

### 1. Primary product intent

- `docs/plans/2026-04-02-planning-journey-ux-handover.md`
- `docs/plans/2026-04-02-costing-module-implementation-spec.md`

These are the most important product documents for the remaining work.

Use them for:

- the three-lens journey
- canonical naming and routes
- the shared scenario concept
- baseline editability
- Delivery Planning expectations
- Delivery Tracking expectations
- Portfolio-first costing rules

### 2. Historical implementation context

- `docs/plans/2026-04-02-master-plan.md`
- `docs/plans/2026-04-02-ux-coherence-and-costing-handover.md`

These are still useful for:

- file-level context
- old component names
- historical rationale
- migration caveats

But they are not fully aligned with the current product direction anymore.

Important mismatch:

- those docs assume Stage 2 / Capacity Planner became a baseline-only workspace with scenarios removed
- the current branch has intentionally moved back toward the newer planning-journey direction where Delivery Planning participates in the shared scenario model

So:

- use them for implementation context
- do not let them override the newer shared-scenario product direction from `2026-04-02-planning-journey-ux-handover.md`

### 3. Previous session handover

- `docs/plans/2026-04-03-ux-costing-rebuild-session-handover.md`

Use this for:

- branch context
- already-landed costing work
- already-added data structures
- migration numbering notes

This new handover supersedes it as the best starting point for the next session.

---

## Current Branch Status

Branch:

- `feature/ux-costing-rebuild`

Validation already completed:

- `npm run build` passes in `frontend/`

Major progress already implemented on this branch:

### Navigation / routing / labels

- canonical planning routes are in place:
  - `/portfolio-planning`
  - `/delivery-planning`
  - `/delivery-tracking`
- legacy routes redirect through the canonical view mapping:
  - `/planner`
  - `/planning`
  - `/epics`
  - `/scenarios`
- sidebar now reflects the planning journey:
  - Portfolio Planning
  - Delivery Planning
  - Delivery Tracking
  - Report
  - supporting views below
- keyboard shortcut labels and onboarding copy were updated

### Shared scenario model

- `activeScenarioId` is now shared across planning pages
- portfolio scenarios are no longer rejected by `sanitizeActiveScenarioId()`
- legacy `pp.activeScenarioId` is migrated on read
- missing scenario slices are normalized on load
- scenario creation now clones both portfolio and delivery slices
- Delivery Planning capacity state now persists inside `Scenario`

### Portfolio Planning

- Portfolio Planning now uses global scenario activation
- old local portfolio-only active scenario storage is gone
- inline scenario controls were replaced with the shared explicit switcher component
- top-level tabs are now simplified to:
  - `Plan`
  - `People`
  - `Summary`
- the old `Breakdown` view is no longer exposed in the primary tab bar
- Portfolio header copy now matches the handoff:
  - title: `Portfolio Planning`
  - subtitle: `Compare staffing options, phase effort, and cost before detailed delivery breakdown exists.`
  - primary CTA: `Add Epics`
- Plan view staffing controls were consolidated:
  - grouped staffing picker now separates IT people, external partners, business owners, and business teams
  - assignment rows now use a single staffing-actions popover instead of stacked inline replace/remove controls
  - single-row replacement now preserves allocation mode / segment data
- costing UI is already in place:
  - epic cost chip
  - cost drawer
  - cost summary cards
  - initiative cost table
  - scenario delta

### Delivery Planning

- `ScenarioPlanner.tsx` is now user-facing `Delivery Planning`
- Delivery Planning now reads from scenario-aware current state
- scenario-scoped `capacityRequests` and `capacityAssignments` are persisted
- shared planning header shell is now mounted here too
- a first pass of Delivery Planning filters is implemented:
  - On portfolio board
  - In current plan
  - Staffing risk
  - Uses external
  - Has Jira breakdown
  - Missing Jira breakdown
- primary CTA is now consistently `Import Jira Breakdown`
- imported hierarchy is now first-class on the page:
  - Epic -> Feature -> delivery item breakdown panel
  - missing Jira breakdown is surfaced explicitly
  - scheduled vs unscheduled items are visible in the hierarchy
  - missing IT owner vs missing business owner is visible in the hierarchy
- IT and business owner assignment is now editable inline for features and child delivery items
- manual delivery requests are now explicitly framed as scenario-only what-if work:
  - they remain supported
  - they do not imply Jira breakdown coverage
  - backlog copy now distinguishes imported Jira items from scenario what-if requests

### Delivery Tracking

- `Projects.tsx` is reframed as `Delivery Tracking`
- planning-heavy edit affordances were stripped back:
  - no SmartAssignmentPanel launch
  - no bulk edit flow
  - no inline BIZ editing
  - no inline confidence editing
- page is now much closer to read-mostly tracking behavior

### Data / persistence

- costing settings and direct cost persistence exist
- external vendors exist
- scenario-scoped delivery capacity slices were added to sync
- new migration added:
  - `supabase/migrations/050_delivery_planning_scenario_capacity.sql`

---

## Remaining Work

The items below are the remaining steps of the implementation plan, updated to reflect what is already done.

Recommended order matters.

---

## Remaining Step 1 — Finish Shared Planning Header

Status:

- done

Completed:

- `frontend/src/components/planning/PlanningLensHeader.tsx` exists
- both `PortfolioPlanning.tsx` and `ScenarioPlanner.tsx` now use it
- the header now carries:
  - title
  - subtitle
  - shared scenario controls
  - right-side badges / utility actions
  - save state
  - primary CTA

No additional header extraction work should be needed before the remaining cleanup steps.

---

## Remaining Step 2 — Finish Portfolio Planning Cleanup

Status:

- mostly done

What is already done:

- shared global scenario activation
- explicit scenario controls
- costing surface
- top-level tabs simplified to `Plan`, `People`, `Summary`
- copy aligned with the handoff
- primary CTA aligned to `Add Epics`
- row-level staffing controls consolidated into a clearer picker / actions flow

What still remains:

### 2.1 Keep costing behavior aligned with the costing spec

Verify and preserve:

- direct costs editable only in baseline Portfolio view
- direct costs read-only in portfolio scenario view
- labor deltas remain scenario-driven
- no delivery or tracking page becomes a direct-cost editor

Reference:

- `docs/plans/2026-04-02-costing-module-implementation-spec.md`

### 2.2 Decide whether the hidden `BreakdownView` should be kept or retired

Current state:

- the implementation still exists in `PortfolioPlanning.tsx`
- it is exported, but no longer part of the primary UX

Next session can either:

- leave it temporarily as a non-primary/internal surface
- or delete / move it once confidence is high that the simplified three-tab flow is final

---

## Remaining Step 3 — Finish Delivery Planning UX Rebuild

Status:

- substantially advanced, but not fully complete

What is already done:

- shared planning header is now in place
- hierarchy is now legible as Epic -> Feature -> delivery item
- missing Jira breakdown is explicit
- missing IT vs missing business ownership is explicit
- IT / BIZ owner assignment is editable inline
- manual requests are explicitly framed as scenario what-if work
- CTA label is now consistently `Import Jira Breakdown`

What still remains:

### 3.1 Decide whether the current single-canvas model is final

The handoff expected something closer to:

- keep `Timeline`
- keep `Summary`
- remove `Board`
- remove `People`

Current state:

- the page is now a single-canvas hierarchy + backlog + sprint-grid model
- that may be sufficient
- but the next session should make an explicit product call rather than leaving mode expectations half-open

### 3.2 Review whether owner assignment should stay inline or move into a dedicated side editor

Current state:

- inline owner assignment now works
- hierarchy is much clearer
- but there is still a question whether deeper staffing edits belong in-page or in a focused side panel / drawer

### 3.3 Validate the staffing-risk and breakdown summaries against real data

Especially verify:

- hierarchy counts
- owner-gap counts
- backlog counts
- filter counts
- scheduled / unscheduled status

Reference:

- `docs/plans/2026-04-02-planning-journey-ux-handover.md`
- `docs/plans/2026-04-02-costing-module-implementation-spec.md`

---

## Remaining Step 4 — Final Delivery Tracking Cleanup

Status:

- mostly done

What remains:

### 4.1 Audit residual planning language and leftovers

Search for:

- `Epics`
- `Scenario Planner`
- `Capacity Planner`
- `Actuals`

Especially in:

- Jira helper screens
- report copy
- command palette / helper text
- comments / labels visible in UI

### 4.2 Confirm no remaining planning entry points exist in Delivery Tracking

Recheck `Projects.tsx` and related subcomponents to ensure there are no hidden planning affordances left behind.

### 4.3 Consider whether skills belong on the tracking page

`WorkItemSkillsCell` still appears in tracking rows.

This is not necessarily wrong, but the next session should make an explicit choice:

- keep it as read-only tracking context
- or remove it to reduce planning noise

---

## Remaining Step 5 — Route / Page Cleanup

Status:

- partially done

### 5.1 Decide final fate of `Scenarios.tsx`

The planning-journey handoff says:

- no standalone Scenarios hub in the primary journey

Options:

- keep `Scenarios.tsx` as a hidden admin/archive surface
- or redirect it entirely to `Portfolio Planning`

Recommendation:

- keep it only if it still serves archive/admin functions not covered by the inline switcher
- otherwise redirect and de-emphasize it fully

### 5.2 Review `Timeline`

The handoff said Timeline should not remain in the primary planning journey.

Current state:

- it is still accessible as a supporting screen

Next session should decide:

- keep as supporting capacity screen
- or explicitly deprecate

### 5.3 Update report copy

Search in `Report.tsx` and related components for references to:

- Scenario Planner
- old journey assumptions

Update copy so it matches:

- Portfolio Planning
- Delivery Planning
- Delivery Tracking

---

## Remaining Step 6 — Costing Completion / Data Integrity

Status:

- core Portfolio costing is in place
- but there are still important integrity / rollout steps left

### 6.1 Run and verify migrations in an appropriate Supabase environment

Still pending:

- `048_costing_rates_and_external_vendors.sql`
- `049_initiative_costs.sql`
- `050_delivery_planning_scenario_capacity.sql`

Important:

- do not run against a shared environment without confirming branch isolation

### 6.2 Complete TEAM placeholder normalization

Still pending from the costing spec and previous handover:

- legacy `TEAM:<name>` write paths need to move to `TEAM:<id>`
- read compatibility should remain temporarily

Reference:

- `docs/plans/2026-04-02-costing-module-implementation-spec.md`
- `docs/plans/2026-04-03-ux-costing-rebuild-session-handover.md`

### 6.3 Review scenario cost persistence assumptions

Now that Delivery Planning capacity state is scenario-scoped too, verify there is no unintended interaction with:

- `initiative_costs`
- portfolio baseline direct costs
- scenario-local project cost expectations

No known bug is confirmed here, but it needs an intentional check before calling the overall flow complete.

---

## Remaining Step 7 — Cleanup / Deletion

Status:

- still pending

After the above UX work is stable:

- remove or retire dead scenario helpers
- remove stale comments that describe the old Stage 2 baseline-only direction
- delete or deprecate old planner-only components that are no longer part of the shipped product direction

Be careful:

- do not remove compatibility code too early if migrations / rollout are still incomplete

---

## Manual Verification Still Needed

Run this after the remaining work is done:

1. Start with existing baseline data, existing portfolio scenarios, and existing delivery scenarios.
2. Open `Portfolio Planning` and verify the shared scenario switcher works for baseline and named scenarios.
3. Create a scenario in `Portfolio Planning`, then open `Delivery Planning` and confirm the same scenario is available and active.
4. Duplicate and rename a scenario from both planning pages and confirm changes are visible cross-page.
5. Delete the active scenario and confirm both planning pages fall back to baseline.
6. In `Delivery Planning`, verify filter counts and filtered epic chips match actual data.
7. Verify `Missing Jira breakdown` shows epics/items without decomposition clearly.
8. Verify scenario-scoped `capacityRequests` and `capacityAssignments` diverge correctly between baseline and named scenarios.
9. Open `Delivery Tracking` and confirm it remains read-mostly with no planning controls.
10. Verify legacy URLs still land on canonical destinations.
11. Verify Portfolio direct-cost edit rules still match the costing spec.
12. Verify Supabase sync round-trips the new scenario `capacity_requests` and `capacity_assignments` fields once migrations are applied.

---

## Recommended First Move In The Next Session

Start with the text / route cleanup pass across Delivery Tracking, Report, and supporting UI.

Reason:

- the main Portfolio and Delivery Planning UX convergence work is now substantially in place
- the biggest remaining risk is product-language inconsistency across the rest of the app
- this cleanup should clarify what still genuinely needs structural work afterward

Concrete starting files:

- `frontend/src/pages/Projects.tsx`
- `frontend/src/pages/Report.tsx`
- `frontend/src/components/ui/CommandPalette.tsx`
- `frontend/src/components/ui/KeyboardShortcutsModal.tsx`
- `frontend/src/components/layout/Sidebar.tsx`

Search for:

- `Scenario Planner`
- `Capacity Planner`
- `Epics`
- `Actuals`

After that, do a focused verification pass on:

- Portfolio direct-cost edit rules
- Delivery Planning hierarchy / owner-gap counts
- whether `Scenarios.tsx` and `Timeline.tsx` should remain visible supporting screens

---

## Short Summary

The branch has already completed the foundation work:

- navigation and routes
- shared scenario activation
- Portfolio costing
- Delivery Tracking cleanup
- Delivery Planning scenario persistence
- shared scenario controls in both planning pages

What remains is the final UX convergence and the deepest product work:

- finish residual copy / route cleanup outside the two main planning pages
- verify Portfolio costing edit rules and data integrity
- validate Delivery Planning counts / owner workflows with real data
- decide the final fate of supporting surfaces like `Scenarios.tsx`, `Timeline.tsx`, and the hidden `BreakdownView`
- finish migration / data integrity rollout items

If the next session follows the order in this file, it should be able to resume cleanly without rereading the entire branch history.
