---
status: Ready for Dev
created: 2026-04-02
shipped: ~
author: Codex
supersedes: ~
related: 2026-04-02-costing-module-implementation-spec.md
---

# Planning Journey and UX Coherence - Implementation Handover

## Purpose

Realign the product around the intended user journey rather than the order the screens were originally built.

The app should behave as one planning system with three lenses:

- Portfolio Planning
- Delivery Planning
- Delivery Tracking

This handover is implementation-ready and grounded in the current codebase. It defines the target UX, information architecture, scenario model, implementation sequence, and acceptance criteria.

The most important clarification is the planning horizon split:

- Portfolio Planning is pre-approval and phase-based.
- Delivery Planning is post-approval and Jira-breakdown-based.
- Delivery Tracking is execution reality.

## Final Product Decisions

- Discovery ideas already enter the system as Jira epics imported from the Jira Discovery Board.
- Portfolio Planning operates before detailed Jira breakdown exists; work is still modeled at epic and phase level because uncertainty is high.
- Delivery Planning starts after approval and after Jira features and user stories have been created or imported.
- There is no additional in-app approval workflow between Portfolio Planning and Delivery Planning; the transition is triggered by the business process of approval plus Jira breakdown availability.
- The primary what-if questions are staffing mix decisions: outsource, replace person, use vendor placeholders, use business placeholders.
- Scenarios must be switched inline inside planning pages; there is no standalone Scenarios hub in the primary journey.
- Delivery Planning must show all epics by default.
- Baseline can be edited directly; named scenarios are encouraged for what-if comparison but are not mandatory.
- Delivery Tracking is the user-facing replacement for the current Epics page.
- Costing remains Portfolio-first, per `docs/plans/2026-04-02-costing-module-implementation-spec.md`.
- Jira does not cover the full need for capacity planning because the app must add real capacity tracking, cross-initiative staffing visibility, and assignment of business people to Jira features and user stories.

## Problem Summary

The current app reflects build order rather than user journey:

- `frontend/src/pages/PortfolioPlanning.tsx` uses its own scenario system, local active-scenario state, and custom shell.
- `frontend/src/pages/ScenarioPlanner.tsx` uses the global `activeScenarioId`, a different scenario UI, and a different page shell.
- `frontend/src/pages/Projects.tsx` is still framed as `Epics`, but the intended role is actuals and tracking rather than planning.
- `frontend/src/components/layout/Sidebar.tsx` and onboarding still prioritize older supporting screens over the three main planning lenses.
- `frontend/src/stores/appStore.ts` currently rejects portfolio scenarios as active global scenarios via `sanitizeActiveScenarioId()`.
- `frontend/src/stores/actions.ts` still distinguishes `createScenario()` from `createPortfolioScenario()` even though the `Scenario` type already contains both planner and portfolio fields.

Result:

- weak narrative user journey
- inconsistent labels and page chrome
- duplicate scenario concepts
- fragile-feeling interactions
- cost module risk: costing could land on top of a confusing information architecture and amplify the inconsistency

## Target Product Model

Treat the app as one planning system with three lenses on the same canonical Jira epics, but with different planning granularity by stage.

| Lens | Canonical path | Current implementation basis | Purpose | Editability |
|---|---|---|---|---|
| Portfolio Planning | `/portfolio-planning` | `PortfolioPlanning.tsx` | Decide whether to do work, rough phase plan, staffing mix, cost | Editable in baseline and scenarios |
| Delivery Planning | `/delivery-planning` | `ScenarioPlanner.tsx` | Validate delivery feasibility after approval, using imported Jira epics, features, and user stories plus IT and business assignments | Editable in baseline and scenarios |
| Delivery Tracking | `/delivery-tracking` | `Projects.tsx` | Follow real Jira progress and actuals | Mostly read-only |

Supporting pages remain available but are not part of the primary planning journey:

- Capacity Overview
- Team
- Settings
- Report

## User Journey

1. Import discovery epics from Jira Discovery.
2. Put the relevant epics on the Portfolio board.
3. Explore staffing mix scenarios at epic and phase level in Portfolio Planning.
4. Compare cost and capacity impact before commitment.
5. Once approved, break the epic down in Jira into features and user stories.
6. Import that Jira breakdown into Delivery Planning.
7. Assign IT and business people across features and stories, and validate delivery feasibility.
8. Use Delivery Tracking to monitor Jira reality.

Important rules:

- An epic can exist in all three lenses at the same time.
- Entry into Delivery Planning is not controlled by a special in-app approval object.
- In practice, Delivery Planning becomes useful after Jira breakdown exists.
- Filtering, not approval state, determines what is visible in Delivery Planning once Jira breakdown has been imported.

## Information Architecture

### Primary navigation

Planning group:

- Portfolio Planning
- Delivery Planning
- Delivery Tracking
- Report

Supporting group:

- Capacity Overview
- Team
- Settings

Implementation note:

- Remove `Scenarios` from the sidebar.
- Remove `Timeline` from the primary planning journey. Keep it accessible only if it is still needed as a supporting capacity screen, otherwise deprecate it later.

### Navigation labels

- Change sidebar label `Scenario Planner` -> `Delivery Planning`
- Change sidebar label `Epics` -> `Delivery Tracking`
- Keep `Portfolio Planning` as-is
- Keep `Capacity` label for the existing dashboard, but position it below the planning group

### Canonical routes and backward compatibility

Use new canonical routes but preserve existing aliases during rollout:

| User-facing label | Canonical path | Legacy paths to keep temporarily |
|---|---|---|
| Portfolio Planning | `/portfolio-planning` | none |
| Delivery Planning | `/delivery-planning` | `/planner`, `/planning` |
| Delivery Tracking | `/delivery-tracking` | `/epics` |
| Scenarios | none in primary nav | `/scenarios` redirects to `/portfolio-planning` |

Implementation notes:

- Keep internal `ViewType` enum values `planner` and `projects` in the first pass if that reduces churn.
- User-facing labels and canonical URLs should change immediately.
- Legacy URLs should redirect, not render old labels.

### Default landing behavior

Use this rule set:

- If the workspace is effectively empty, keep the existing onboarding path available from the Capacity Overview.
- Otherwise, default the post-auth planning landing page to `Portfolio Planning`.
- The current dashboard remains available but is no longer the default journey entry for users who already have data.

## Scenario Model

### Required decision

Adopt one user-facing scenario concept across Portfolio Planning and Delivery Planning.

A scenario means:

- one alternative version of the plan
- one baseline comparison target
- one set of staffing what-ifs
- one cost comparison context

Scenarios apply differently by lens:

- In Portfolio Planning, the scenario changes phase staffing mix and high-level effort.
- In Delivery Planning, the scenario changes feature/story-level resourcing and capacity allocation after Jira breakdown exists.

### Baseline rules

- Baseline is represented by `activeScenarioId = null`.
- Baseline is editable.
- Scenario switching must work identically in Portfolio Planning and Delivery Planning.
- Switching scenario in one planning lens must persist when navigating to the other.

### Data model rules

Keep `Scenario` as the single persisted entity, but stop treating portfolio scenarios and delivery scenarios as different products.

Rules:

- Any `Scenario` can contain both portfolio fields and planner fields.
- `portfolioBoardEpicKeys`, `portfolioManualEpics`, `portfolioPhasePlans`, and `portfolioPhaseAssignments` remain valid scenario fields.
- `plannerLayout`, `projects`, and `assignments` remain valid scenario fields.
- `isPortfolioScenario` becomes deprecated. It must not drive user-facing filtering or active-scenario validation.
- `pp.activeScenarioId` local storage becomes deprecated. Use global `data.activeScenarioId` only.

### Migration rules

Implement read-time migration instead of a risky destructive data rewrite.

1. Stop filtering scenarios by `isPortfolioScenario`

- In `PortfolioPlanning.tsx`, remove `scenarios.filter(isPortfolioScenario)`.
- In `appStore.ts`, remove the `isPortfolioScenario` rejection from `sanitizeActiveScenarioId()`.
- In selectors that currently exclude portfolio scenarios, return all active scenarios unless explicitly archived.

2. Import legacy portfolio active-scenario state one time

- If global `activeScenarioId` is null
- and `pp.activeScenarioId` exists
- and that scenario still exists
- set `data.activeScenarioId` to that scenario
- then delete `pp.activeScenarioId`

3. Normalize missing slices on read

- If a scenario has no `plannerLayout`, initialize it to `[]`
- If a scenario has no portfolio arrays, initialize them to `[]`
- Preserve all existing data; do not drop planner or portfolio fields during migration

4. Scenario CRUD after migration

- `createScenario()` clones both portfolio and delivery slices from the current context
- `duplicateScenario()` duplicates the entire scenario
- `deleteScenario()` removes the scenario from all planning lenses
- `createPortfolioScenario()` and `updatePortfolioScenario()` should be removed or reduced to internal compatibility wrappers, then fully retired

## Shared Planning Header

Create one shared planning shell for `PortfolioPlanning.tsx` and `ScenarioPlanner.tsx`.

Suggested new components:

- `frontend/src/components/planning/PlanningLensHeader.tsx`
- `frontend/src/components/planning/PlanScenarioSwitcher.tsx`

Do not mount the existing `frontend/src/components/layout/Header.tsx` as-is.

Reasons:

- it is currently unused
- it encodes the old baseline-versus-scenario messaging model
- it does not solve the Portfolio Planning shell problem

### Header contents

Left side:

- page title
- one-line purpose statement
- inline scenario switcher

Right side:

- compare-to-baseline action
- quarter selector if relevant to the lens
- save state
- primary call-to-action

### Inline scenario switcher spec

Required items:

- `Baseline` pill
- current scenario selector or pills
- `+ New Scenario`
- `Duplicate`
- `Rename`
- `Delete`
- optional archived-scenarios access in overflow only

Interaction rules:

- no double-click rename
- rename and delete must use explicit menu actions or modal flows
- creating a scenario from either planning page makes it immediately available in the other page
- if a scenario is deleted while active, fall back to baseline

Implementation note:

- The existing `ScenarioCreateModal` in `frontend/src/components/planner/ScenarioTabs.tsx` can be reused.
- The current `ScenarioTabs` component should either be generalized into `PlanScenarioSwitcher` or replaced.

## Screen-by-Screen Spec

### 1. Portfolio Planning

Current file:

- `frontend/src/pages/PortfolioPlanning.tsx`

Role:

- decision lens for staffing mix and cost

Primary questions this page must answer:

- should we do this epic in this quarter
- who could do it
- should we replace this person
- should we outsource this portion
- what does that change do to cost and capacity
- can we shape the work at phase level before detailed Jira breakdown exists

#### Required UX changes

1. Use the shared planning header

- remove the local topbar, scenario bar, and tab shell that currently define the page frame
- remove local active-scenario storage
- scenario switching uses global `activeScenarioId`

2. Simplify top-level tabs

- keep `Plan` as the existing Epic View
- keep `People`
- keep `Summary`
- remove `Breakdown` from the top-level tab bar in this phase
- keep the underlying implementation only if it reduces churn; it should not be part of the default UX

3. Keep Portfolio board semantics

- this page only shows epics placed on the portfolio board
- manual portfolio epics remain supported
- `Add Epics` remains the primary call-to-action
- do not pull the page toward feature and user-story detail; that belongs to Delivery Planning

4. Make staffing-mix actions clearer

- explicit actions should favor `replace person`, `assign external`, `assign vendor or team placeholder`, and `assign business team`
- reduce inline micro-controls where possible
- prefer one consistent drawer or editor pattern over multiple tiny row actions

5. Make costing first-class here

- implement the cost Summary cards, cost chip, and cost drawer exactly as defined in `docs/plans/2026-04-02-costing-module-implementation-spec.md`
- baseline view can edit direct costs
- scenario view shows shared direct costs as read-only and scenario-driven labor deltas

#### Required content and copy

Title:

- `Portfolio Planning`

Subtitle:

- `Compare staffing options, phase effort, and cost before detailed delivery breakdown exists.`

Primary call-to-action:

- `Add Epics`

### 2. Delivery Planning

Current file:

- `frontend/src/pages/ScenarioPlanner.tsx`

New user-facing name:

- `Delivery Planning`

Role:

- post-approval feasibility lens for sequencing and delivery staffing

Planning granularity:

- imported Jira epics
- imported Jira features
- imported Jira user stories

Core business purpose:

- Jira is the system of record for breakdown and status
- Delivery Planning is the system for capacity orchestration across that breakdown
- this is where the app adds value Jira does not provide well:
  - real capacity tracking
  - business-person assignment on features and stories
  - cross-initiative feasibility and overload visibility

#### Required UX changes

1. Remove the scenario home screen

- baseline must be a valid editable context
- the page must always open the planner canvas
- the old home state that appears when no active scenario must be removed
- if `activeScenarioId` is null, render the baseline planner layout

2. Use the shared planning header

- remove the current custom two-tier topbar and tabbar as the primary shell
- keep quarter selector, save indicator, and actions, but relocate them into the shared header structure

3. Simplify top-level modes

- keep `Timeline`
- keep `Summary`
- remove `Board` from the primary mode toggle for this phase
- remove `People` from the primary mode toggle for this phase
- underlying components may remain in the repo until cleanup, but they should not define the default UX

4. Show all epics by default

- default dataset is all imported epics
- provide strong filters instead of an approval gate
- a delivery item is only fully plannable here once its Jira features and stories exist
- items without Jira breakdown should still be visible, but clearly marked as not yet decomposed

Required filters:

- `On portfolio board`
- `In current plan`
- `Unscheduled`
- `Staffing risk`
- `Uses external or vendor`
- `Has Jira breakdown`
- `Missing Jira breakdown`
- existing label and search filters can remain

5. Make breakdown-level planning explicit

- the primary rows and cards in this screen should represent imported delivery work, not just portfolio epics
- hierarchy should make Epic -> Feature -> Story legible
- users must be able to assign both IT and business people to features and stories
- business assignment is a first-class workflow, not a side-note
- the page should clearly indicate when a feature or story has no IT owner, no business owner, or no remaining capacity

6. Baseline editability

- baseline planner state must be editable without forcing scenario creation
- scenarios remain available for safe comparison, but are not required

7. Cost visibility

- if cost summary cards are added here, they are read-only
- Delivery Planning must not become the primary place for direct-cost editing

#### Required content and copy

Title:

- `Delivery Planning`

Subtitle:

- `Plan feature and story delivery capacity after Jira breakdown and approval.`

Primary call-to-action:

- choose one label and use it consistently: `Import Jira Breakdown` or `Add To Delivery Plan`

### 3. Delivery Tracking

Current file:

- `frontend/src/pages/Projects.tsx`

New user-facing name:

- `Delivery Tracking`

Role:

- Jira reality and actuals lens

#### Required UX changes

1. Rename and reframe the page

- this page is not a third planning surface
- it is a read-mostly tracking page

2. Make the page mostly read-only

- keep Jira sync, Jira links, search, filters, expand and collapse, and hierarchy browsing
- remove or disable bulk planning edits from this page
- remove or disable the SmartAssignmentPanel entry point from this page
- remove or disable inline BIZ assignment editing from this page
- remove or disable inline confidence editing from this page if it is only used as a planning proxy

3. Calm the copy

- do not show scenario controls here
- do not frame it as a safe editing screen
- subtitle should describe tracking and actuals, not planning

#### Required content and copy

Title:

- `Delivery Tracking`

Subtitle:

- `Read Jira status, hierarchy, and actual delivery progress.`

Primary action:

- `Sync Jira` if the user has permission

## Costing Alignment

This UX handover must be implemented in a way that preserves and clarifies the costing roadmap.

Follow these rules:

- `Portfolio Planning` is the primary decision surface for cost.
- `Delivery Planning` can show read-only labor or scenario cost summaries, but it does not own direct-cost editing.
- Delivery cost visibility should be derived from imported Jira delivery scope plus assignments, not from separate direct-cost editing flows.
- `Delivery Tracking` does not become a cost editor.
- Staffing actor vocabulary must match the costing spec across Portfolio and Delivery:
  - internal IT person
  - external named person
  - vendor or team placeholder
  - business contact
  - business team placeholder
- Delivery Planning must support assigning business contacts or business team placeholders to Jira features and user stories because that is a key gap in Jira itself.
- The direct-cost edit rules from the costing spec stay intact:
  - baseline portfolio view can edit direct costs
  - portfolio scenario view shows direct costs as shared baseline values and read-only
- The shared scenario switcher is now the user-facing mechanism that makes scenario-versus-baseline costing understandable.

## Supporting Screen Changes

### Dashboard and Capacity Overview

Current file:

- `frontend/src/pages/Dashboard.tsx`

Required changes:

- update onboarding copy and links to the new labels
- replace references to `Epics` with `Delivery Tracking`
- point the primary journey toward `Portfolio Planning`
- keep this page as a supporting insight and admin page, not the default planning destination for non-empty workspaces

### Sidebar

Current file:

- `frontend/src/components/layout/Sidebar.tsx`

Required changes:

- reorder navigation to reflect the new journey
- remove `Scenarios`
- rename `Scenario Planner` to `Delivery Planning`
- rename `Epics` to `Delivery Tracking`
- optionally visually separate planning lenses from supporting pages

### App routing and shortcuts

Current file:

- `frontend/src/App.tsx`

Required changes:

- add canonical routes `/delivery-planning` and `/delivery-tracking`
- redirect `/scenarios` to `/portfolio-planning`
- update keyboard shortcuts and command-palette labels to the new page names
- default post-auth planning destination should favor `Portfolio Planning` when the workspace is not empty

## File-Level Implementation Plan

### New files

- `frontend/src/components/planning/PlanningLensHeader.tsx`
- `frontend/src/components/planning/PlanScenarioSwitcher.tsx`

Optional:

- `frontend/src/components/planning/PlanningLensFilters.tsx` if shared filter UI is extracted

### Existing files to edit

- `frontend/src/App.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/PortfolioPlanning.tsx`
- `frontend/src/pages/PortfolioPlanning.css`
- `frontend/src/pages/ScenarioPlanner.tsx`
- `frontend/src/pages/Projects.tsx`
- `frontend/src/pages/Scenarios.tsx`
- `frontend/src/components/planner/ScenarioTabs.tsx`
- `frontend/src/stores/appStore.ts`
- `frontend/src/stores/actions.ts`
- `frontend/src/types/index.ts`
- `frontend/src/services/supabaseSync.ts` if any scenario migration logic is centralized there

### Components and functions to retire or deprecate

- `ACTIVE_SCENARIO_KEY` and helper functions in `PortfolioPlanning.tsx`
- `isPortfolioScenario()` filtering in `PortfolioPlanning.tsx`
- `sanitizeActiveScenarioId()` portfolio exclusion in `appStore.ts`
- `createPortfolioScenario()` as a user-facing concept
- `updatePortfolioScenario()` as a user-facing concept
- `Scenarios` page in primary navigation
- `Header.tsx` in its current form if it is not repurposed

## Delivery Sequence

### Phase 1 - Navigation, naming, and routing

- rename user-facing labels
- reorder sidebar
- remove `Scenarios` from nav
- add canonical routes and redirects
- update onboarding, command palette, and keyboard shortcut labels

### Phase 2 - Shared scenario model

- remove portfolio-scenario filtering
- unify active scenario state
- migrate legacy `pp.activeScenarioId`
- allow baseline and all scenarios to load in both Portfolio and Delivery Planning
- adjust scenario create, duplicate, and delete flows to cover both slices

### Phase 3 - Shared planning header

- introduce the shared planning header and inline scenario switcher
- move create, duplicate, rename, and delete actions into explicit menus and modals
- remove page-specific scenario bars and duplicate shell patterns

### Phase 4 - Portfolio Planning cleanup

- adopt shared header
- simplify tabs
- keep Portfolio board semantics
- align staffing actions with cost actor vocabulary
- ensure cost surfaces land cleanly here

### Phase 5 - Delivery Planning cleanup

- remove the no-scenario home screen
- make baseline editable
- simplify modes
- add required filters
- keep all epics visible by default
- make imported Jira features and stories the primary planning detail
- add business-person assignment as a first-class workflow

### Phase 6 - Delivery Tracking cleanup

- rename and reframe page
- strip planning-heavy editing affordances
- keep tracking and Jira sync behaviors

### Phase 7 - Cleanup and deletion

- remove deprecated helpers, dead routes, and unused scenario code
- either delete `Scenarios.tsx` or keep it only as a hidden admin and archive surface if needed

## Acceptance Criteria

### Information architecture

- Sidebar shows `Portfolio Planning`, `Delivery Planning`, and `Delivery Tracking` in that order
- `Scenarios` is not present in primary navigation
- `/delivery-planning` and `/delivery-tracking` are the canonical URLs
- `/planner`, `/planning`, `/epics`, and `/scenarios` redirect safely

### Scenario behavior

- Creating a scenario in Portfolio Planning makes it immediately available in Delivery Planning
- Creating a scenario in Delivery Planning makes it immediately available in Portfolio Planning
- Switching scenarios in one planning lens persists when navigating to the other
- Baseline is editable in both Portfolio Planning and Delivery Planning
- Existing saved portfolio scenarios still load after migration
- Existing saved delivery scenarios still load after migration

### Portfolio Planning

- Page uses the shared planning header
- Top-level tabs are reduced to the agreed set
- `Breakdown` is not a primary tab
- Cost chip and drawer work according to the costing spec
- Direct costs are editable only in baseline portfolio view

### Delivery Planning

- Page always opens the planning canvas
- No separate scenario home screen appears when baseline is active
- All epics are visible by default
- Required filters exist and work
- `Board` and `People` are not primary modes in this phase
- imported Jira features and stories are visible and legible in the planning hierarchy
- the UI clearly distinguishes items with and without Jira breakdown
- IT and business assignments can both be planned at delivery-item level

### Delivery Tracking

- Page title and subtitle use the new name and purpose
- No scenario switching UI is shown
- Bulk planning editing controls are removed or disabled
- SmartAssignmentPanel launch is removed or disabled
- Jira sync continues to work

## Manual Test Matrix

1. Start from a workspace with existing portfolio scenarios and existing planner scenarios.
2. Verify all scenarios appear in the shared switcher after migration.
3. Open `Portfolio Planning` in baseline, edit a baseline item, and confirm the change persists.
4. Create a new scenario in `Portfolio Planning`, navigate to `Delivery Planning`, and confirm the scenario is already selected and editable.
5. Switch back to baseline in `Delivery Planning` and confirm baseline planner layout is editable without a scenario.
6. Verify `Delivery Planning` shows all epics by default and the `On portfolio board` filter narrows the list.
7. Verify imported Jira features and stories appear under the correct epic in Delivery Planning.
8. Verify business people can be assigned to a feature or story in Delivery Planning.
9. Open `Delivery Tracking` and confirm no scenario controls are visible.
10. Verify legacy URLs redirect correctly.
11. Verify baseline-versus-scenario cost rules in Portfolio still match the costing spec.

## Non-Goals

- No approval workflow between Portfolio and Delivery
- No new entity between discovery idea and Jira epic
- No historical cost snapshotting
- No Jira writeback for cost or planning data
- No new design system or dependency introduction
- No requirement to delete advanced components immediately if hiding them first is lower risk

## Recommended Implementation Notes

- Prefer an incremental rollout that changes user-facing information architecture first, then removes dead code.
- Preserve internal view keys temporarily if that avoids unnecessary churn; prioritize user-facing clarity over internal renaming in the first pass.
- Reuse the existing scenario-create modal where practical.
- Do not preserve double-click rename interactions; explicit controls are safer and clearer.
- Align all new staffing labels with the costing spec so outsource and replace workflows do not diverge later.

## Handover Summary

The product should ship as one coherent planning system:

- Portfolio Planning for pre-approval, phase-level decision-making and cost
- Delivery Planning for post-approval, Jira-breakdown capacity planning
- Delivery Tracking for reality

Everything else is supporting infrastructure.

This UX handover should be implemented before or alongside the first visible Portfolio costing work so the cost module lands on top of a coherent journey instead of reinforcing the current split-brain model.
