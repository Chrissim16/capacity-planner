---
status: Draft
created: 2026-04-04
branch: feature/ux-costing-rebuild
base: origin/design/brand-pass
audience:
  - Functional Analyst
  - Product Owner
  - Developer
  - UI/UX Specialist
related:
  - 2026-04-02-master-plan.md
  - 2026-04-02-ux-coherence-and-costing-handover.md
  - 2026-04-03-ux-costing-rebuild-session-handover.md
---

# Feature Branch Handover — `feature/ux-costing-rebuild`

## Why this branch exists

This branch restructures the product around a clearer planning journey and adds the first working costing layer.

The main product shift is:

1. **Portfolio Planning** is where pre-approval planning happens.
2. **Delivery Planning** is where approved work is broken down and scheduled.
3. **Actuals** is where delivery reality is tracked.

The original application had overlapping concepts across Portfolio Planning, Scenario Planner, and Epics. This branch makes those screens feel more like one connected workflow and less like separate tools.

## Executive summary

The most important changes in this branch are:

- Reframed the application navigation around the planning journey.
- Renamed and reshaped the old Scenario Planner into **Delivery Planning**.
- Renamed the old Epics area into **Actuals**.
- Added a shared planning header and more consistent planning UX patterns.
- Added a first end-to-end **costing model** in Portfolio Planning.
- Added **costing settings**, **external vendors**, and **rate overrides** for business teams, business contacts, and IT people.
- Added **initiative direct costs**, **contingency**, **cost chips**, and **cost summary views** in Portfolio Planning.
- Reworked **Settings** into grouped sections with sidebar-style navigation.
- Restored and preserved **phase descriptions** in portfolio scenarios.
- Added a regression test to prevent **Delivery Planning render/snapshot loops**.

## Scope at a glance

### Product areas touched

- Navigation and page naming
- Portfolio Planning
- Delivery Planning
- Actuals naming and journey positioning
- Settings and reference data maintenance
- Costing data model and calculations
- Export/report foundations
- Supabase schema and sync layer

### Major files and modules

- `frontend/src/pages/PortfolioPlanning.tsx`
- `frontend/src/pages/ScenarioPlanner.tsx`
- `frontend/src/pages/Projects.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/components/planning/PlanningLensHeader.tsx`
- `frontend/src/components/planning/PlanScenarioSwitcher.tsx`
- `frontend/src/components/portfolio/CostDrawer.tsx`
- `frontend/src/pages/settings/CostingSection.tsx`
- `frontend/src/utils/costing.ts`
- `frontend/src/utils/portfolioPlanExport.ts`
- `frontend/src/services/supabaseSync.ts`
- `frontend/src/stores/actions.ts`
- `frontend/src/stores/appStore.ts`
- `supabase/migrations/048_costing_rates_and_external_vendors.sql`
- `supabase/migrations/049_initiative_costs.sql`

## What changed functionally

### 1. Planning journey and navigation

- The sidebar now prioritizes the planning journey instead of older build-order screens.
- The old **Scenario Planner** is presented as **Delivery Planning**.
- The old **Epics** screen is presented as **Actuals**.
- Planning pages share more consistent chrome and scenario controls.

### 2. Portfolio Planning gained costing

Portfolio Planning is now the main place to reason about cost before commitment.

Users can now:

- define costing defaults in Settings
- maintain external vendors
- override rates on business teams, business contacts, and IT people
- add initiative-level direct costs
- add contingency
- view cost chips on initiative rows
- compare cost deltas between baseline and scenarios
- review cost summary tables in the summary area

Important rule: in this branch, costing is intentionally **Portfolio-first**. It is not meant to be the primary concern of Delivery Planning or Actuals.

### 3. Delivery Planning was rebuilt around a planner canvas

Delivery Planning now centers on:

- a backlog of imported Jira work
- a timeline/canvas for scheduling work
- planning-only manual items where Jira detail does not exist yet
- assignment flows for IT and business ownership
- status indicators for unscheduled work, staffing gaps, and missing Jira breakdown

This is no longer positioned as a generic scenario playground. It is meant to support planning after approval and after Jira structure exists.

### 4. Settings became easier to navigate

Settings was redesigned into grouped areas:

- Planning
- Reference Data
- Jira Integration
- Users

This makes the new costing configuration and reference-data maintenance much easier to find and manage.

### 5. Data model and persistence changed

The branch introduces and syncs new kinds of data:

- external vendors
- initiative costs
- costing settings and rates
- richer person-level rate metadata
- updated scenario/planning persistence behavior

## Role-based handover

## For the Functional Analyst

### What to understand first

The business workflow is now clearer:

- **Portfolio Planning** = shape and evaluate work before approval
- **Delivery Planning** = validate breakdown, staffing, and schedule after approval
- **Actuals** = monitor execution reality

The biggest functional addition is the costing layer in Portfolio Planning.

### Business capabilities added or changed

- Cost assumptions can be maintained centrally in Settings.
- Delivery resources can carry richer cost metadata.
- Business-side placeholders and named contacts can influence planning and costing.
- Portfolio initiatives can include direct costs and contingency, not just effort-based staffing costs.
- Scenario comparisons now include cost-oriented signals, not only timeline or staffing views.
- Delivery Planning is more explicitly driven by Jira breakdown and staffing readiness.

### Areas to review in a walkthrough

- Settings → Costing
- Settings → Business Teams
- Settings → Business Contacts
- Team member form fields for worker type, vendor, and rate overrides
- Portfolio Planning row-level cost indicators
- Portfolio Planning cost drawer
- Portfolio Planning summary cost tables/cards
- Delivery Planning backlog vs scheduled work behavior

### Functional questions worth validating

- Are the costing rules and rate precedence aligned with the intended business rules?
- Are baseline vs scenario editing rules correct for direct costs?
- Is the line between Portfolio Planning and Delivery Planning now clear enough for end users?
- Do business team placeholders and named contacts behave consistently in planning and export flows?

## For the Product Owner

### Product outcome of this branch

This branch is a UX and domain-clarity move more than a single isolated feature. It reduces confusion in the planning journey and makes cost discussion part of early decision-making.

### What improves for users

- The app tells a clearer story from idea to delivery.
- Important planning screens are easier to find.
- Cost becomes visible earlier, where prioritization decisions are actually made.
- Settings is less intimidating and more task-oriented.
- Delivery Planning feels closer to real delivery preparation instead of a second portfolio board.

### What is likely demo-worthy

- The new planning journey labels and structure
- Costing setup in Settings
- Portfolio Planning cost drawer and cost summaries
- Scenario comparison including cost impacts
- Delivery Planning canvas with imported Jira work and manual planning-only items
- The redesigned Settings landing and section navigation

### What is still not the final word

- This is a strong functional foundation, not the end-state of every planning/reporting workflow.
- Database migrations still need careful rollout coordination.
- Some historical placeholder patterns needed cleanup during the branch and should still be watched in future changes.
- Executive/reporting experiences may still need a later polish pass depending on stakeholder expectations.

## For the Developer

### Architectural themes

- Product language was normalized around planning lenses.
- Planning headers and scenario switching were componentized.
- Costing was added as a shared domain capability rather than page-local math.
- Settings shifted from a long single page to grouped section composition.
- Delivery Planning was simplified conceptually, but the page is still a central orchestration point.

### Key implementation areas

#### Shared planning UX

- `frontend/src/components/planning/PlanningLensHeader.tsx`
- `frontend/src/components/planning/PlanScenarioSwitcher.tsx`
- `frontend/src/components/planning/PlanningHeaderActionMenu.tsx`

#### Portfolio Planning and costing

- `frontend/src/pages/PortfolioPlanning.tsx`
- `frontend/src/components/portfolio/CostDrawer.tsx`
- `frontend/src/utils/costing.ts`
- `frontend/src/utils/currency.ts`
- `frontend/src/utils/portfolioPlanExport.ts`

#### Delivery Planning

- `frontend/src/pages/ScenarioPlanner.tsx`
- `frontend/src/components/planning/DeliveryBreakdownPanel.tsx`
- `frontend/src/components/planner/*`

#### Settings and admin/reference data

- `frontend/src/pages/Settings.tsx`
- `frontend/src/pages/settings/CostingSection.tsx`
- `frontend/src/pages/settings/BusinessTeamsSection.tsx`
- `frontend/src/pages/settings/BusinessContactsSection.tsx`
- `frontend/src/components/forms/TeamMemberForm.tsx`

#### Store and sync

- `frontend/src/stores/actions.ts`
- `frontend/src/stores/appStore.ts`
- `frontend/src/services/supabaseSync.ts`
- `frontend/src/types/index.ts`

#### Database

- `supabase/migrations/047_harden_get_my_role.sql`
- `supabase/migrations/048_costing_rates_and_external_vendors.sql`
- `supabase/migrations/049_initiative_costs.sql`

### Recent branch-specific finishing changes

- Delivery Planning was rebuilt again around the planner canvas in commit `528c63e`.
- Phase descriptions in scenario portfolio plans were restored in commit `357fcaf`.
- Settings got grouped sidebar-style navigation in commit `e219ba7`.
- A render-loop regression in Delivery Planning was fixed and covered by `frontend/src/pages/ScenarioPlanner.render.test.tsx` in commit `f29aed8`.

### Developer watchouts

- This branch is based on `origin/design/brand-pass`, not directly on `origin/main`.
- There are significant changes in `PortfolioPlanning.tsx` and `ScenarioPlanner.tsx`; merge conflicts are likely if parallel work touched those files.
- Costing introduces new persistence and migration concerns; test both local-only and Supabase-backed flows.
- Scenario behavior and planning behavior are intertwined across shared actions and selectors, so regression testing should include baseline and named scenarios.

### Suggested smoke test list

1. Open Settings and verify each section group renders correctly.
2. Create or edit vendors and rate overrides.
3. Edit an initiative in Portfolio Planning and verify cost drawer behavior.
4. Compare baseline vs scenario cost signals.
5. Open Delivery Planning and confirm backlog, scheduling, and assignment flows still render correctly.
6. Verify scenario switching does not cause rerender loops.
7. If using Supabase, validate new costing entities sync correctly.

## For the UI/UX Specialist

### UX intent behind the branch

The branch is trying to fix coherence more than visual polish alone.

The design goal is:

- fewer disconnected mental models
- more obvious stage progression
- clearer separation between strategic planning and delivery planning
- stronger information scent in Settings
- cost visibility at the moment decisions are made

### UX changes that matter most

- Navigation labels now better reflect the user journey.
- Planning pages use a more unified header language and scenario control pattern.
- Delivery Planning is visually and functionally anchored around a planning canvas instead of multiple competing sub-modes.
- Settings uses a grouped structure with descriptions, making the page more explorable.
- Portfolio Planning surfaces cost context inline rather than hiding it in secondary workflows.

### UX details to review

- Whether the distinction between baseline and scenario is obvious enough
- Whether “planning-only” items in Delivery Planning are clearly differentiated from Jira-backed work
- Whether cost chips and the cost drawer are discoverable without training
- Whether the grouped Settings navigation scales as more sections are added
- Whether the status chips, staffing alerts, and missing-breakdown indicators create the right level of urgency without noise

### Likely next UX refinement areas

- More explicit empty states and guardrails around missing rate data
- Additional visual consistency between Portfolio Planning and Delivery Planning
- Review of density, hierarchy, and scanability in large planning views
- Further refinement of reporting/export presentation if stakeholder-facing outputs become more prominent

## Known caveats and rollout notes

- The branch includes database migrations and should be rolled out carefully if environments are shared.
- The branch has a broad surface area: UX, state, sync, settings, and schema all changed together.
- Some prior handover docs describe the earlier implementation intent; this file reflects the branch as it exists after later follow-up commits.
- Build validation was previously completed during the branch work, but environment-specific verification should still be repeated before release.

## Recommended way to onboard someone quickly

If someone only has 20-30 minutes, use this order:

1. Explain the new planning journey: Portfolio Planning → Delivery Planning → Actuals.
2. Demo Settings → Costing and the new rate/vendor model.
3. Demo Portfolio Planning cost visibility and scenario comparison.
4. Demo Delivery Planning backlog-to-plan flow.
5. Call out migration/sync implications for implementation and rollout.

## Suggested follow-up artifacts

Depending on the audience, the next useful documents would be:

- a PO/demo script with screenshots
- a developer migration checklist
- a functional test script for costing rules
- a UX review checklist for the new planning journey
