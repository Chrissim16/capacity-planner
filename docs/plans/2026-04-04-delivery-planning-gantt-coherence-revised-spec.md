---
title: Delivery Planning and Portfolio Coherence - Revised Implementation Spec
status: Ready for Dev
created: 2026-04-04
author: Codex
supersedes: /Users/dennissimon/Downloads/delivery-planning-gantt-coherence-spec.md
related:
  - 2026-04-02-planning-journey-ux-handover.md
  - 2026-04-03-planning-journey-next-session-handover.md
  - 2026-04-04-feature-ux-costing-rebuild-role-handover.md
---

# Delivery Planning and Portfolio Coherence - Revised Implementation Spec

## Purpose

Preserve the original product goal behind the Delivery Planning Gantt coherence proposal while aligning the implementation path with the current codebase.

This document keeps the strongest idea from the original spec:

- Portfolio Planning and Delivery Planning should feel like two lenses of one planning system

But it replaces several assumptions that are not aligned with the current implementation:

- Delivery Planning already participates in the shared scenario model
- a shared planning header already exists
- Delivery Planning uses sprint-based planner data, not the same time geometry as Portfolio Planning
- transition into Delivery Planning should not depend on a special quarter approval label alone

This revised spec is intended to be implementation-ready for the next phase of UX coherence work.

## Product Position

The core planning journey remains:

1. Portfolio Planning shapes work at epic and phase level before detailed delivery breakdown exists.
2. Delivery Planning validates delivery feasibility after Jira breakdown exists.
3. Delivery Tracking follows execution reality.

The most important rule is unchanged:

- Portfolio Planning is pre-approval and phase-based.
- Delivery Planning is post-approval and Jira-breakdown-based.

The coherence goal is visual and interactional, not conceptual flattening. The two pages should feel related without pretending they operate on the same data model.

## What We Keep From The Original Spec

- the goal that Portfolio and Delivery should feel like one planning tool with two lenses
- clearer visual coherence between the two pages
- stronger Epic -> Feature -> Story hierarchy in Delivery Planning
- consistent scenario switching behavior across planning lenses
- shared top-level page chrome and action patterns
- carryover visibility as a useful future concept

## What Changes From The Original Spec

### 1. Shared scenarios stay shared

Do not introduce a separate scenario concept for Delivery Planning such as temporary "impact scenarios" that are discarded by default.

Use the existing shared scenario model:

- baseline is editable
- named scenarios are available in both Portfolio Planning and Delivery Planning
- scenario switching behaves consistently across both lenses

Implementation must build on the current shared scenario flow already used in:

- `frontend/src/components/planning/PlanningLensHeader.tsx`
- `frontend/src/components/planning/PlanScenarioSwitcher.tsx`
- `frontend/src/pages/ScenarioPlanner.tsx`

### 2. Delivery entry is driven by Jira breakdown, not by an app-specific approval label

Do not make quarter labels like `26Q2_Approved` the primary gating rule for Delivery Planning.

Instead:

- Delivery Planning shows all relevant imported epics by default
- filtering and breakdown availability determine how actionable an item is
- items without features or stories remain visible, but clearly marked as not yet ready for detailed delivery planning

Quarter labels may still exist in Jira as a business convention, but they should not be the core application workflow.

### 3. UX coherence first, hard Gantt extraction later

Do not start by extracting a universal `PlanningCanvasGantt`.

Current reality:

- Portfolio planning uses portfolio-specific phase planning and date logic
- Delivery Planning uses sprint-based planner items, drag/drop behavior, and hierarchy-specific interactions

These systems can become more visually coherent before they become one shared component.

Implementation should therefore proceed in two layers:

- first align header, shell, row rhythm, spacing, and visual language
- only later evaluate whether a shared timeline primitive is worth extracting

## Current Codebase Constraints

The revised implementation must respect the following:

- Delivery Planning already has a shared planning header and scenario switcher
- Delivery Planning already supports Epic -> Feature -> Story nesting in the planner timeline
- planner items are scenario-scoped and persisted
- the current Delivery Planning value proposition includes planning-only items that remain distinct from Jira-imported items

This means the coherence work should refine and unify, not replace, the current architecture.

## Revised Requirements

## 1. Shared Planning Shell

### Goal

Portfolio Planning and Delivery Planning should share the same top-level planning shell.

### Required behavior

- use the shared planning header in both lenses
- use the same scenario switcher component and interaction pattern
- preserve shared baseline/scenario semantics
- keep titles, subtitles, and utility actions visually aligned

### Notes

- this work is already largely in motion and should be extended, not redesigned
- no new scenario system should be introduced

## 2. Delivery Planning Hierarchy Clarity

### Goal

Make Delivery Planning hierarchy easier to scan and more obviously related to Portfolio Planning density and spacing.

### Required behavior

- Epic rows remain top-level
- Feature rows remain nested beneath Epic rows
- Story, task, and bug rows remain nested beneath Feature rows
- collapse and expand affordances remain explicit
- row density and indentation should feel visually related to Portfolio Planning

### Required visual treatment

- consistent indentation rhythm
- consistent row padding and typography scale
- clearer separation between imported Jira work and planning-only items
- maintain hierarchy-first readability over decorative styling

### Out of scope for this step

- no fundamental change to planner item data model
- no replacement of current hierarchy logic

## 3. Delivery Planning Visual Coherence

### Goal

Bring Delivery Planning visually closer to Portfolio Planning without forcing them into one identical rendering system.

### Required alignment areas

- header spacing and control placement
- container radius, border weight, and card tone
- typography hierarchy
- row heights and label rhythm where feasible
- bar styling family where feasible

### Important rule

Visual coherence does not require literal sameness.

Portfolio and Delivery may still differ where the interaction model requires it:

- Delivery needs stronger drag/drop cues
- Delivery needs more explicit staffing and backlog distinctions
- Portfolio needs stronger phase semantics and cost framing

## 4. Scenario Behavior

### Goal

Scenarios must feel like one shared planning concept across both pages.

### Required behavior

- baseline is editable
- named scenarios are editable
- switching scenario in one planning lens persists when navigating to the other
- manual delivery items remain scenario-scoped
- planner layout remains scenario-scoped

### Explicit non-goal

Do not add a separate "impact scenario" object type just for Delivery Planning.

If product language needs to communicate intent, that can be solved with naming guidance such as:

- `Scenario: Add fraud detection`
- `Scenario: Delay rollout by 1 sprint`

not with a separate persistence model.

## 5. Jira Breakdown and Planning-Only Work

### Goal

Keep the distinction between imported Jira work and scenario-only planning work explicit.

### Required behavior

- imported Jira items stay clearly identified as Jira-backed
- planning-only items remain clearly marked as not yet reflected in Jira
- imported epics without Jira breakdown remain visible and flagged
- manual planning-only items can still be used for what-if modeling

### Product rationale

This already matches the current value of Delivery Planning:

- Jira is the system of record for breakdown and execution status
- the app is the system for cross-initiative capacity orchestration and what-if planning

## 6. Carryover

### Goal

Support carryover as a future planning signal, but do not overfit it before the data contract is clear.

### Implementable now

- Epic-level carryover badge or accent treatment in Delivery Planning
- simple indication that work continues from a prior period

### Not ready yet

- shared cross-lens carryover model that infers completed Portfolio phases from Delivery state
- phase completion rendering inside Delivery Planning
- phase strikethrough logic in Delivery based on Jira child status alone

Carryover should first be introduced as a lightweight Epic-level signal, not as a deep cross-model status system.

## Architecture Guidance

## 1. Do not extract a universal Gantt first

The original proposal to extract `PlanningCanvasGantt` is reasonable as a future possibility, but it should not be the first implementation step.

Reasons:

- the current timeline systems have different geometry rules
- Delivery timeline behavior is tied closely to drag/drop and capacity interactions
- a premature shared component would increase risk in both planning lenses

### Better approach

If reuse is needed, extract smaller primitives first:

- shared timeline header styles
- shared row label tokens
- shared bar color tokens
- shared spacing constants

Only after that should we assess whether a shared rendering primitive is actually cleaner.

## 2. Preserve current scenario and planner persistence

The existing `Scenario` shape already supports the combined planning model and should remain the source of truth.

Do not add:

- a second delivery-only scenario type
- a temporary non-persisted planning scenario model
- special sync-only state that bypasses scenario persistence

## 3. Preserve current Delivery Planning value

Do not regress these existing behaviors:

- imported Jira work can be scheduled into the plan
- planning-only manual items can be added
- both IT and business assignment remain first-class
- missing Jira breakdown remains visible
- scenario-scoped plan differences remain intact

## Implementation Plan

## Phase 1 - UX coherence pass

### Scope

- align Delivery Planning shell more closely with Portfolio Planning
- refine spacing, row rhythm, typography, and card treatment
- tighten scenario/header consistency where needed

### Expected files

- `frontend/src/pages/ScenarioPlanner.tsx`
- `frontend/src/components/planning/PlanningLensHeader.tsx`
- `frontend/src/components/planning/PlanScenarioSwitcher.tsx`
- `frontend/src/components/planner/PlannerTimeline.tsx`

### Acceptance criteria

- Portfolio Planning and Delivery Planning clearly look like sibling planning pages
- scenario switching feels identical across both pages
- Delivery hierarchy is easier to scan

## Phase 2 - Delivery hierarchy and state clarity

### Scope

- improve visual distinction between imported Jira work and planning-only work
- improve hierarchy legibility in timeline and supporting panels
- keep missing-breakdown signals explicit

### Acceptance criteria

- users can easily distinguish imported work from planning-only work
- Epic -> Feature -> Story relationships are legible at a glance
- Delivery Planning remains useful even when some epics are not yet fully decomposed

## Phase 3 - Lightweight carryover

### Scope

- add a simple Epic-level carryover signal if a reliable source-of-truth rule is defined

### Acceptance criteria

- carryover appears as a readable visual cue, not as a complex new status model
- no implication is made that Delivery Planning knows Portfolio phase completion unless that is explicitly modeled

## Phase 4 - Timeline primitive evaluation

### Scope

- review whether enough overlap exists to justify shared timeline primitives or component extraction

### Deliverable

- technical recommendation, not automatic refactor

This phase may conclude:

- extract shared styling primitives only
- extract a small shared timeline subcomponent
- or keep separate timeline components

All three outcomes are acceptable if they reduce complexity.

## Explicitly Out Of Scope

- introducing a new quarter-label approval workflow as the main Delivery Planning entry rule
- replacing shared scenario persistence with temporary impact-scenario objects
- forcing Delivery Planning and Portfolio Planning to use one Gantt component immediately
- deriving Portfolio phase completion from Delivery status without a formal data model
- syncing Delivery Planning edits back to Jira as part of this coherence pass

## Success Criteria

- users perceive Portfolio Planning and Delivery Planning as part of the same planning system
- scenario switching feels unified across both lenses
- Delivery Planning remains clearly post-breakdown and execution-feasibility oriented
- no regression is introduced in planner persistence, assignment behavior, or Jira/planning-only distinctions

## Decision Summary

The original document had the right product instinct but an over-optimistic implementation path.

This revised version keeps the vision and removes the risky assumptions:

- keep shared planning language
- keep shared scenarios
- keep Delivery Planning post-breakdown
- align the UX first
- postpone deep Gantt extraction until the code proves it is worth doing
