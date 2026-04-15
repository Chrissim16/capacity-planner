---
title: Portfolio Planning Gantt Production Spec
status: Draft
created: 2026-04-15
author: Codex
references:
  - /Users/dennissimon/Downloads/portfolio-gantt-color-redesign.html
  - /Users/dennissimon/capacity-planner/docs/plans/2026-04-04-delivery-planning-gantt-coherence-revised-spec.md
  - /Users/dennissimon/capacity-planner/frontend/src/pages/PortfolioPlanning.tsx
  - /Users/dennissimon/capacity-planner/frontend/src/pages/PortfolioPlanning.css
---

# Portfolio Planning Gantt Production Spec

## Purpose

Turn the three-level portfolio planning Gantt prototype into a production-ready specification that design and engineering can implement consistently.

The prototype establishes the intended visual hierarchy:

- Epic is the dominant planning object
- Phase is the primary planning segment within an epic
- Person allocation is subordinate supporting detail within a phase

This document adds the missing product and engineering rules:

- timeline behavior
- date-to-bar geometry
- responsive layout
- accessibility requirements
- state handling
- edge-case behavior
- implementation acceptance criteria

## Scope

This spec covers the Portfolio Planning Gantt in the portfolio planning experience.

It applies to:

- epic rows
- phase rows
- person allocation rows
- time-axis rendering
- phase color semantics
- expand and collapse behavior
- hover, selection, and focus treatment
- empty, loading, and overflow states

It does not define:

- scenario persistence rules outside this surface
- cost calculations
- Jira sync behavior
- staffing recommendation logic

## Product Intent

The Gantt should help a PM answer three questions quickly:

1. What epics are planned in the current portfolio window?
2. Which phases happen when?
3. Who is expected to contribute, and roughly how much?

The view is a planning and communication tool first. It must support scanability before detailed editing.

## Canonical Hierarchy

The rendered hierarchy is:

1. Epic
2. Phase
3. Person allocation

Hierarchy rules:

- Every phase belongs to exactly one epic.
- Every person allocation belongs to exactly one phase.
- Epics may be collapsed or expanded.
- Phases may be shown without person allocations.
- Person rows never appear without a parent phase.
- The Gantt may show multiple expanded epics at once.

Visual emphasis rules:

- Epic rows carry the strongest background contrast and typographic weight.
- Phase rows carry the strongest schedule signal through color-coded bars.
- Person rows use a more subdued treatment than phase rows.

## Timeline Model

The production component must not use hard-coded `left` and `width` percentages.

Bar geometry must be derived from timeline data:

- visible timeline start date
- visible timeline end date
- column unit
- phase or allocation start date
- phase or allocation end date

### Supported timeline units

The default portfolio view is quarter-oriented, but the rendering model must support a finer internal unit than the header labels.

Required approach:

- top header labels may show quarters
- bar placement should be derived from week-level or day-level geometry
- bars must render continuously across quarter boundaries

This avoids fake-looking quarter blocks and keeps durations accurate when a phase starts or ends mid-quarter.

### Geometry rules

- Bars are positioned relative to the visible timeline window.
- If an item starts before the visible window, render the bar clipped to the left edge.
- If an item ends after the visible window, render the bar clipped to the right edge.
- Bars shorter than the minimum visible width must still render with a minimum width token.
- Labels inside bars should only render when they fit without truncating into unreadability.

Recommended implementation rule:

- use a week-based internal column grid
- derive quarter headers from grouped weeks

## Data Contract

The UI spec assumes a normalized view model with explicit dates and hierarchy.

```ts
type PortfolioGanttEpic = {
  id: string
  key: string
  name: string
  expanded: boolean
  phases: PortfolioGanttPhase[]
}

type PortfolioGanttPhaseType =
  | 'design'
  | 'build'
  | 'test'
  | 'deploy'
  | 'handover'

type PortfolioGanttPhase = {
  id: string
  epicId: string
  type: PortfolioGanttPhaseType
  label: string
  startDate: string
  endDate: string
  durationWeeks?: number
  allocations: PortfolioGanttAllocation[]
}

type PortfolioGanttAllocation = {
  id: string
  phaseId: string
  personType: 'person' | 'business-team'
  personId?: string
  displayName: string
  avatarLabel?: string
  allocatedDays?: number
  startDate: string
  endDate: string
}
```

Required data rules:

- `startDate` and `endDate` are canonical for rendering.
- `durationWeeks` is optional display metadata, not the source of geometry.
- `allocatedDays` is supporting metadata, not a substitute for allocation dates.
- Business teams and named individuals must both render as allocation rows.

## Visual System

The prototype direction is valid:

- cool neutral canvas
- strong epic background
- flatter phase row
- understated person row
- compact enterprise density

Production should preserve that direction, but replace one-off values with tokens.

### Required design tokens

At minimum, define:

```css
--portfolio-gantt-bg
--portfolio-gantt-surface
--portfolio-gantt-border
--portfolio-gantt-border-soft
--portfolio-gantt-text-strong
--portfolio-gantt-text-muted
--portfolio-gantt-epic-bg
--portfolio-gantt-today
--portfolio-gantt-focus
--portfolio-gantt-row-epic
--portfolio-gantt-row-phase
--portfolio-gantt-row-person
--portfolio-gantt-label-col-width
--portfolio-gantt-column-min-width
```

### Phase color tokens

Phase color must represent phase type only.

Do not overload the same color system to also mean health or status.

Required token set:

```css
--phase-design-strong
--phase-design-muted
--phase-design-border
--phase-build-strong
--phase-build-muted
--phase-build-border
--phase-test-strong
--phase-test-muted
--phase-test-border
--phase-deploy-strong
--phase-deploy-muted
--phase-deploy-border
--phase-handover-strong
--phase-handover-muted
--phase-handover-border
```

### Phase distinction rule

Color alone is not enough.

Each phase must also expose a secondary distinguishing cue:

- short text label
- phase badge
- left-edge marker
- pattern or icon if needed

This is required for:

- color-blind users
- low-contrast screens
- small or unlabeled bars

## Row Layout Rules

### Epic row

Epic row content:

- expand or collapse affordance
- epic name
- epic key
- optional aggregate summary

Epic row behavior:

- clicking the main row toggles expand or collapse
- row hover is allowed
- row must expose an explicit keyboard-focus state

Epic row styling:

- strongest row background in the stack
- strongest text weight in the stack
- clear separation from the first phase row

### Phase row

Phase row content:

- phase label
- optional date range text
- optional duration summary
- main phase bar in the timeline area

Phase row behavior:

- phase label remains visible even when the bar is clipped
- if the phase is editable, the row may expose edit affordances on hover or selection
- if the phase has no dates, it renders as an empty phase state rather than a fake zero-width bar

### Person row

Person row content:

- avatar or team icon
- display name
- optional role or entity type
- allocated day summary
- subordinate allocation bar

Person row behavior:

- allocation bars should feel linked to the parent phase
- person rows should remain visually subordinate to the phase row
- business-team rows and person rows should share structure but may differ in avatar treatment

### Indentation

Required indentation rhythm:

- Epic baseline column
- Phase indented one hierarchy step from epic
- Person indented one hierarchy step from phase

Indentation must remain consistent across all rows, including empty states and add-row affordances.

## Expand and Collapse

Required behavior:

- Each epic can be expanded and collapsed independently.
- Collapsed epics show epic row plus visible phase summary if product chooses, but not person rows.
- Expanded state must persist during local navigation within the page.
- Expand and collapse affordances must be keyboard accessible.

Recommended follow-up behavior:

- support "expand all" and "collapse all" controls if portfolio density is high

## Header and Axis

The header must define time clearly without overwhelming the hierarchy.

Required header behavior:

- sticky timeline header during vertical scroll
- visible current-period marker
- visible today treatment when today falls within the visible window
- consistent alignment with timeline columns below

Required axis behavior:

- quarter labels show the high-level portfolio horizon
- internal geometry maintains accurate placement at a finer unit
- month or week subdivisions may appear below the quarter row if density allows

## Responsive Behavior

The prototype is not production-ready without breakpoint rules.

### Desktop

For widths `>= 1280px`:

- show full three-level hierarchy
- keep left hierarchy column sticky
- allow horizontal scroll in timeline region
- show person day totals inline

### Narrow desktop and tablet

For widths from `768px` to `1279px`:

- reduce left column width within a defined min and max range
- allow some metadata to truncate before names do
- wrap or relocate the legend if a legend remains in-product
- preserve sticky hierarchy column if feasible

### Mobile

For widths `< 768px`:

- do not force the full desktop Gantt unchanged
- use a condensed representation, stacked epic cards, or drill-down flow
- keep timeline readable without requiring both-axis precision scrolling as the primary interaction

Mobile fallback is a product requirement, not an implementation afterthought.

## Accessibility

The Gantt must be accessible to keyboard and assistive-technology users.

Required accessibility rules:

- interactive rows and controls must be reachable by keyboard
- expand and collapse controls must expose accessible names and state
- bars must expose accessible labels including name, type, and date range
- color must not be the only indicator of phase identity
- focus rings must meet contrast expectations and be intentionally designed
- truncation must not hide the accessible full label

If the surface behaves like an interactive planning table, engineering should evaluate `treegrid` semantics or an equivalent accessible structure.

Example accessible labels:

- `Epic AP Control Framework, expanded`
- `Design phase, January 12 2026 through February 2 2026, 3 weeks`
- `Melvin Campbell allocation, 3 days, January 12 2026 through January 26 2026`

## Interaction States

The production spec must define these states explicitly:

- default
- hover
- focus-visible
- selected
- expanded
- collapsed
- loading
- empty
- truncated
- clipped-left
- clipped-right
- disabled if editing is unavailable

At minimum, design should provide a small state board covering these combinations:

- default and hover for epic, phase, and person rows
- focused expand toggle
- selected phase
- empty phase
- clipped bar crossing viewport edge

## Empty and Edge States

The component must handle real planning data without visual collapse.

Required cases:

- epic with no phases
- phase with no allocations
- phase missing dates
- allocation missing avatar
- very long epic or person names
- multiple allocations under one phase
- multiple expanded epics in sequence
- bar starting before the visible window
- bar ending after the visible window
- tiny duration bar
- empty timeline segment with no planned work

Specific rules:

- long labels truncate with ellipsis visually but keep full value in tooltip or accessible name
- empty phases should show explicit placeholder messaging when editing is enabled
- missing avatars fall back to initials or a neutral team icon

## Performance and Rendering Constraints

Production behavior should assume that some portfolios may contain dozens of epics and hundreds of allocation rows.

Implementation guidance:

- avoid layout strategies that require measuring every bar repeatedly during scroll
- derive geometry once per viewport or data change when possible
- keep row heights fixed by level
- consider virtualization if row volume becomes large

This is especially important if sticky columns and sticky headers are both used.

## Recommended Component Decomposition

Suggested implementation split:

- `PortfolioGantt`
- `PortfolioGanttHeader`
- `PortfolioGanttEpicRow`
- `PortfolioGanttPhaseRow`
- `PortfolioGanttAllocationRow`
- `PortfolioGanttBar`
- `PortfolioGanttLegend` if a legend is retained

Supporting utilities:

- timeline geometry helpers
- date range clipping helpers
- accessible label formatters
- phase token mapping

## Legend Guidance

The prototype includes a palette footer. Production should treat this as optional.

Use a visible legend only if:

- phase meanings are not already obvious from row labels
- the legend supports onboarding or interpretation in-product

If included:

- it must wrap responsively
- it must not force the main Gantt into awkward overflow
- it should use the same tokens as the bars

If not included:

- the palette footer should remain a design artifact only

## Acceptance Criteria

The Gantt is ready for implementation review when all of the following are true:

- Epic, phase, and person rows render with stable hierarchy and fixed density.
- Bars are rendered from dates rather than hand-authored percentages.
- Bars span across timeline boundaries accurately.
- Collapsed and expanded epic states are supported.
- Phase identity is recognizable without relying only on hue.
- The timeline header remains aligned while vertically scrolling.
- The left hierarchy column remains readable during horizontal scrolling.
- Long names truncate safely without overlapping metadata.
- Empty and missing-data states render intentionally.
- Keyboard users can operate all interactive controls.
- Accessible labels describe bars and hierarchy meaningfully.
- The component remains usable at desktop, narrow desktop, tablet, and mobile breakpoints.

## Design Review Notes On The Prototype

The prototype is a strong visual direction and should be preserved in spirit.

What should carry forward:

- strong epic to phase to person hierarchy
- restrained enterprise styling
- compact row rhythm
- person rows as subordinate planning detail

What must change for production:

- replace hard-coded bar percentages with date-derived geometry
- add explicit responsive behavior
- strengthen phase differentiation beyond hue alone
- replace fragile CSS-only assumptions with documented behavior rules

## Next Step

The next artifact after this spec should be either:

1. a design-state board showing hover, focus, empty, clipped, and narrow-screen variants
2. an implementation plan mapping this spec to `PortfolioPlanning.tsx`, `PortfolioPlanning.css`, and supporting geometry utilities

