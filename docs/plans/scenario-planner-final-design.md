# Scenario Planner — Design Document

**Date:** 2026-03-17  
**Status:** Approved  
**Supersedes:** US-060 (Narrative Scenario Wizard), US-061 (Smart Assignment Panel integration), US-062 (Scenario-Native Planning Board)  
**Author:** Dennis Simon / AI-assisted design session

---

## Table of Contents

1. [Problem & Purpose](#1-problem--purpose)
2. [Layout & Responsive Behaviour](#2-layout--responsive-behaviour)
3. [Scenarios](#3-scenarios)
4. [Timeline Mode Interactions](#4-timeline-mode-interactions)
5. [Board Mode Interactions](#5-board-mode-interactions)
6. [Data Model](#6-data-model)
7. [Drop Zones & Drag Behaviour](#7-drop-zones--drag-behaviour)
8. [Capacity Panel](#8-capacity-panel-timeline-mode)
9. [Reused Utilities & Dependencies](#9-reused-utilities--dependencies)
10. [Files Affected & Implementation Scope](#10-files-affected--implementation-scope)
11. [Out of Scope & Deferred Items](#11-out-of-scope--deferred-items)

---

## 1. Problem & Purpose

### What this is

The Scenario Planner is a **single page** in the application with **two modes** — Board and Timeline — that together provide the full planning experience for what-if capacity modeling. It is accessible from the sidebar, replacing the existing "Scenarios" navigation entry.

### Three questions it answers

1. **"What if we shift this work to different sprints?"** — requires moving bars on a time axis, not reassigning cards in a form
2. **"Where does new work fit without overloading the team?"** — requires seeing per-person sprint-level capacity while placing items
3. **"What if committed work slips?"** — requires unlocking locked items in a safe scenario sandbox

### How the two modes relate

| Mode | Interaction model | Best for |
|---|---|---|
| **Board** | Project cards + team member cards. Drag a person onto a project → assign days. No time axis. | "Who works on what this quarter?" — bulk quarterly staffing |
| **Timeline** | Gantt bars across sprint columns. Drag bars to reposition, resize to change duration. Capacity heatmap below. | "When exactly does this happen, and which sprints are overloaded?" — temporal precision |

Switching between modes preserves all state. Assignments made in Board mode appear as bar positions in Timeline mode and vice versa. The natural workflow: rough-staff in Board mode, then switch to Timeline mode to fine-tune sprint placement and spot crunch points.

### Relationship to previous feature specs

This feature **absorbs and replaces** three previously planned features:

| Previous spec | What happened |
|---|---|
| US-060 (Narrative Scenario Wizard) | **Dropped.** The wizard's 5-step flow is replaced by direct interaction in the planner. Scenario creation uses a simple modal (clone/blank). The Dashboard nudge banner is preserved as an entry point. |
| US-061 (Smart Assignment Panel) | **Absorbed.** The `scoreMember()` engine from `utils/staffing.ts` powers the assign popover's fit scoring (capacity + skill match + concurrent projects). The panel itself becomes the assign popover and the Board mode's bottom panel. |
| US-062 (Scenario-Native Planning Board) | **Absorbed.** Board mode IS the planning board — same drag-person-onto-project interaction, same fit-colour borders, same `@dnd-kit/core` dependency. |

### Primary user

The Project Manager doing quarterly planning or responding to change requests.

---

## 2. Layout & Responsive Behaviour

### Timeline mode layout

```
┌─ Backlog Sidebar (268px, collapsible) ─┐  ┌─ Canvas (flex: 1) ────────────────┐
│ Unscheduled (N)                        │  │ Toolbar: [Board|Timeline] [Save]   │
│ [Search/filter]                        │  │                                    │
│ [Draggable item card]                  │  │ Sprint headers: S7 S8 S9 ...       │
│ [Draggable item card]                  │  │ Gantt rows (label + bar per item)  │
│ [Draggable item card]                  │  │                                    │
│                                        │  │ ─── Capacity Panel (toggleable) ── │
│                                        │  │ Team total: 72% 68% 91% ...       │
│                                        │  │ Erik V. IT: 80% 65% 110% ...      │
└────────────────────────────────────────┘  └────────────────────────────────────┘
```

### Board mode layout

```
┌─ Project Cards ────────────────────────┐  ┌─ Team Member Cards ────────────────┐
│ [Epic card: GL Reconciliation]         │  │ [Erik Visser · IT · ████░░ 14d]   │
│ [Epic card: AP Automation]             │  │ [Sophie Lam · IT · ██████░ 8d]    │
│ [Epic card: Vendor Portal]             │  │ [Jan de Witt · BIZ · ███░░ 12d]  │
│                                        │  │ ← drag onto project card          │
├─ SmartAssignmentPanel (when project selected) ────────────────────────────────┤
│ Ranked team members with fit badges, skill match, effort input               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Responsive rules

- **Backlog sidebar:** Collapsible to a thin "N unscheduled" pill strip to maximize gantt space. Resizable via drag handle on its right edge.
- **Canvas / gantt area:** Always `flex: 1` — takes all remaining space. Never shrinks below usable minimum.
- **Capacity panel:** Toggleable via toolbar button. Max-height 260px with internal scroll. Never pushes the gantt off-screen.
- **Label column in gantt:** Resizable drag handle (200–600px), same pattern as the existing Timeline view.
- **Minimum viewport:** 1200px. Below that, show a "best viewed on a wider display" notice.
- **Mode toggle, scenario tabs, and save/create controls** are shared toolbar elements visible in both modes.

---

## 3. Scenarios

### Snapshots

Each scenario is a **full snapshot** — a complete deep copy of all item positions, assignments, effort values, and lock states. This aligns with the existing `Scenario` entity which already stores deep copies of `jiraWorkItems`, `jiraItemBizAssignments`, `teamMembers`, and `timeOff`. The planner extends this with an optional `plannerLayout` field.

### Creation

A simple modal with two inputs:

| Field | Control |
|---|---|
| Scenario name | Text input, required |
| Starting point | Two radio card options (see below) |

**Clone current plan:** Deep-copies the active scenario (or baseline if none active). All placed items, assignments, and lock states are preserved.

**Blank canvas:** Creates an empty `plannerLayout`. The timeline starts empty. The backlog sidebar is pre-populated with **all** active Epics/Features/Stories from the Jira dataset (`statusCategory !== 'done'`). The team panel (Board mode) and capacity panel (Timeline mode) are pre-populated with **all** active `TeamMember` records and non-archived `BusinessContact` records. No manual adding required — the full dataset is available to drag from.

### Constraints

- Maximum **5 scenarios.** The "+" button is disabled at the limit with a tooltip.
- Scenario tabs use pill-style navigation in the page header.

### Lock / Unlock

Items with `statusCategory: 'in_progress'` or manually marked as committed are `locked: true` by default.

**Locked items:**
- Show a 🔒 badge in the label column
- Cannot be dragged or resized
- Can be **unlocked** in any scenario via a context action ("Unlock in this scenario")

**Unlocked-in-scenario items:**
- `unlockedInScenario: true` on the `PlannerItem`
- Become draggable and resizable
- Render with a **dashed border** and an "UNLOCKED" badge
- The PM always knows this is committed work being explored

Lock status in other scenarios is unaffected (full snapshot isolation).

### Saving

"Save scenario" persists the current `plannerLayout` and all assignment data to the scenario's snapshot. No two-way Jira sync — scenarios are purely a planning tool. Persistence flows through the existing `scheduleSyncToSupabase()` mechanism.

---

## 4. Timeline Mode Interactions

### Hierarchy & expand/collapse

- Default view: Epics only (collapsed)
- Click chevron on Epic → reveals Feature rows beneath it
- Click chevron on Feature → reveals Story/Task/Bug rows
- "Expand All / Collapse All" toggle in the toolbar
- Same model as the existing Timeline view

### Drag to reposition

- Grab any unlocked bar and drag it horizontally to a new sprint position
- Bars snap to sprint boundaries (2-week increments) with a visual snap indicator
- **During the drag, the capacity panel updates in real time** — the PM sees person allocations change as the bar moves across sprints
- Dropping updates the item's `startSprint` position

### Resize to change duration

- Hover a bar → resize handles appear at left and right edges (small vertical lines, visible on hover)
- Drag an edge to extend or shrink the bar
- Minimum span: 1 sprint
- The capacity panel updates live during resize

### Moving Epics with children

- When an Epic bar is dragged, a small confirmation asks: "Move children too?"
- Yes → all Features and Stories shift by the same delta
- No → only the Epic-level bar moves

### Drag from backlog

- Drag an item from the backlog sidebar onto any sprint column
- The **entire sprint column** highlights as a drop zone (full height, not just individual rows)
- On drop: a new row appears and the assign popover opens automatically
- Dragging a bar **back onto the backlog sidebar** removes it from the timeline (the "unschedule" gesture)

### Assignment at all hierarchy levels

- Click any bar (Epic, Feature, or Story) → opens the assign popover
- **Epic-level assignment:** effort spread across all sprints the epic covers
- **Feature-level:** most common, effort within the feature's sprint range
- **Story-level:** sprint-precise assignments

The assign popover shows all team members with:
- **Fit badges** (good/partial/over) from `scoreMember()` — capacity + skill match + concurrent projects
- **Effort slider** — per-person `daysPerSprint` value (1–10), flat across all sprints the item covers
- **Skill match indicators** — matched skills as green chips, missing skills as gaps

### Popovers

- Rendered via **portal to `document.body`** — never clipped by parent containers
- **Auto-position:** Uses `@floating-ui/react` to flip up/down/left/right based on available viewport space
- Closes on scroll or click-outside

### Granularity

Sprint columns only (6 per quarter) for v1. Weekly granularity is deferred.

---

## 5. Board Mode Interactions

Board mode is the simpler, faster view for bulk staffing at the quarterly level.

### Left panel — Project cards

- All Epics from the active scenario, grouped by the selected quarter
- Each card shows: name, priority badge, Jira key, total assigned days vs estimated days, feature count
- Clicking a card **selects it** — opens the SmartAssignmentPanel at the bottom
- Cards are not draggable in Board mode (that's what Timeline mode is for)

### Right panel — Team member cards

- All active IT team members + non-archived BIZ contacts
- Each card shows: avatar, name, role (IT/BIZ badge), mini capacity bar, remaining days for the selected quarter
- **Drag a person card onto a project card** → days popover appears → enter days → assignment created
- During drag, project cards show a **fit-colour border** (green/amber/red) based on `scoreMember()` — precomputed on drag start for performance

### Bottom panel — SmartAssignmentPanel (inline)

- Appears when a project card is selected
- Shows all team members ranked by fit (capacity + skill match + concurrent projects)
- Each row: avatar, name, fit badge, available days, skill match/gap chips, effort input, assign button
- BIZ contacts in a collapsible section below IT members

### Quarter selector

Dropdown at the top of Board mode to pick which quarter you're staffing for. Defaults to current quarter.

---

## 6. Data Model

### Extending the Scenario entity

The existing `Scenario` entity already stores deep copies of `jiraWorkItems`, `jiraItemBizAssignments`, `teamMembers`, and `timeOff`. One optional field is added:

```typescript
// Extension to existing Scenario interface in types/index.ts
plannerLayout?: PlannerItem[]
```

This is only populated for scenarios created or edited in the Scenario Planner. Existing scenarios continue to work — they just don't have planner layout data.

### PlannerItem

Represents one item placed on the planner timeline.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique planner item ID |
| `sourceId` | `string` | References `JiraWorkItem.id` |
| `name` | `string` | Display name |
| `type` | `enum` | `epic / feature / story / task / bug / uat / hypercare` |
| `jiraKey` | `string?` | Jira key if sourced from Jira |
| `parentKey` | `string?` | Parent's jiraKey — preserves hierarchy for expand/collapse |
| `startSprint` | `number` | 1–24 sprint number |
| `spanSprints` | `number` | Duration in sprints |
| `assignees` | `PlannerAssignment[]` | People assigned to this item |
| `locked` | `boolean` | Committed work — immovable by default |
| `unlockedInScenario` | `boolean` | PM explicitly unlocked for exploration in this scenario |

### PlannerAssignment

One person's effort on one item.

| Field | Type | Description |
|---|---|---|
| `memberId` | `string` | `TeamMember.id` or `BusinessContact.id` |
| `track` | `'IT' \| 'BIZ'` | Which track |
| `daysPerSprint` | `number` | Flat effort value across all sprints the item covers (1–10) |

### Capacity computation

The planner does not implement its own capacity engine. It feeds `PlannerAssignment` data into the existing `calculateCapacity()` and `scoreMember()` functions. Available days per sprint already account for holidays, time-off, and BAU because those functions handle that.

### Board mode assignments

Board mode assignments flow through the existing `addAssignment()` action in `stores/actions.ts` — same as today. No new store actions needed for Board mode.

### Backlog source

All `JiraWorkItem` records with `statusCategory !== 'done'` that don't have a corresponding `PlannerItem` in the current scenario. The backlog is a **derived view** (filtered, not copied). Supports search and filtering by Epic, label, and status category.

---

## 7. Drop Zones & Drag Behaviour

### Timeline mode drop zones

- **Sprint columns are full-height drop zones.** When dragging, the entire sprint column highlights — not just the row the cursor is over. A tinted overlay (subtle accent colour wash) tracks the cursor horizontally.
- **Backlog sidebar is a single drop zone.** Dragging any timeline bar onto the backlog sidebar removes it from the timeline and returns it to the backlog. Shows a "Drop to unschedule" label when a bar is dragged over it.

### Board mode drop zones

- **Project cards are drop targets.** When dragging a team member card, project cards show fit-colour borders (green/amber/red) precomputed on drag start via `scoreMember()`.
- **The entire project card area is the target** — not a small icon within the card.

### Drag sources and outcomes

| Source → Target | Mode | What happens |
|---|---|---|
| Backlog item → sprint column | Timeline | New bar appears at that sprint; assign popover opens automatically |
| Timeline bar → different sprint | Timeline | Bar repositions; capacity panel updates live during drag |
| Timeline bar → backlog sidebar | Timeline | Item removed from timeline, returned to backlog |
| Team member card → project card | Board | Days popover appears; assignment created on confirm |

### Drag feedback

- A bottom toast shows "Placing [item name] — drop on a sprint" during any drag
- The dragged element gets a subtle shadow and slight opacity reduction
- Invalid drop targets (locked items) show no highlight
- **Capacity panel updates in real time during Timeline drags** — the PM sees allocation percentages change as they move the bar across columns

### Libraries

`@dnd-kit/core` + `@dnd-kit/utilities` for both modes.

---

## 8. Capacity Panel (Timeline Mode)

The capacity panel is docked at the bottom of the canvas in Timeline mode. Toggleable via a toolbar button.

### Structure

A grid that mirrors the sprint columns exactly: `220px label column | repeat(6, 1fr) sprint cells`. Cells align vertically with the gantt sprint columns above.

### Team summary row

Always visible when the panel is open.

- Label: "Team total" (bold)
- Per-sprint cell: overall team allocation percentage + `load/avail` days
- Cell background colour follows the allocation tier

### Individual person rows

Expandable section below the summary (expanded by default).

- One row per active `TeamMember` (IT) and non-archived `BusinessContact` (BIZ)
- Label: avatar + name + role badge (IT blue / BIZ orange)
- "OVERLOADED" badge when any sprint exceeds 100%
- Row gets a subtle red left border when overloaded

### Per-sprint cell content

- Allocation percentage (bold, coloured by tier)
- `load / avail` days in small muted text — `avail` = workdays in sprint minus public holidays, time-off, and BAU (computed by `calculateCapacity()`)
- 3px mini progress bar: fills to 100% in tier colour, red overflow segment beyond 100%
- Progress bar animates with `transition: width 300ms ease` when values change (live drag feedback)

### Live updates

When the PM drags a bar, resizes a bar, or adjusts an effort slider, the capacity panel recalculates and re-renders immediately. This is the core feedback loop.

### Constraints

Max-height 260px with internal scroll. The gantt area above never gets pushed off-screen.

### Allocation colour tiers

| Range | Cell background | Text colour |
|---|---|---|
| 0% | `#FAFAFA` | `#D1D5DB` |
| 1–50% | `#F0FDF4` | `#16A34A` |
| 51–80% | `#FEFCE8` | `#CA8A04` |
| 81–100% | `#FFF7ED` | `#EA580C` |
| >100% | `#FEF2F2` | `#DC2626` |

---

## 9. Reused Utilities & Dependencies

### Reused as-is (no changes needed)

| Utility | File | Planner usage |
|---|---|---|
| `calculateCapacity()` | `utils/capacity.ts` | Per-member per-quarter available days — source of truth for capacity panel |
| `calculateBusinessCapacityForQuarter()` | `utils/capacity.ts` | Same for BIZ contacts |
| `getWarnings()` | `utils/capacity.ts` | Overload detection for sprint column badges; Dashboard nudge banner |
| `getWorkdaysInSprint()` | `utils/sprints.ts` | Available days per sprint per country |
| `generateQuarters()` | `utils/calendar.ts` | Quarter navigation |
| `createScenario()` / `duplicateScenario()` | `stores/actions.ts` | Scenario creation (clone mode) |
| `addAssignment()` | `stores/actions.ts` | Board mode IT assignments |
| `addBusinessAssignment()` | `stores/actions.ts` | Board mode BIZ assignments |

### Reused from US-061 (depends on `staffing.ts` shipping)

| Utility | File | Planner usage |
|---|---|---|
| `scoreMember()` | `utils/staffing.ts` | Fit scoring in assign popover — capacity + skill match + concurrent projects |
| `scoreBusinessContact()` | `utils/staffing.ts` | BIZ fit scoring |
| `rankMemberFits()` | `utils/staffing.ts` | Sorting assign popover: good → partial → over |
| `FIT_COLOURS` | `utils/staffing.ts` | Green/amber/red badge and border colours |

**Graceful degradation:** If `staffing.ts` doesn't exist yet (US-061 hasn't shipped), the assign popover falls back to showing members sorted by available days only — no skill matching, no fit badges. The planner is fully functional without it. Once US-061 ships, skill matching lights up automatically.

### New dependencies

| Package | Purpose | Notes |
|---|---|---|
| `@dnd-kit/core` | Drag and drop engine | Originally spec'd for US-062, same dependency |
| `@dnd-kit/utilities` | CSS transform helpers for smooth drag | Companion to dnd-kit core |
| `@floating-ui/react` | Viewport-aware popover positioning (portal-based) | Benefits all future popovers app-wide |

---

## 10. Files Affected & Implementation Scope

### New files

| File | Purpose |
|---|---|
| `frontend/src/pages/ScenarioPlanner.tsx` | Page shell — mode toggle (Board/Timeline), scenario tabs, toolbar, layout orchestration |
| `frontend/src/components/planner/PlannerTimeline.tsx` | Timeline mode — gantt rows, bars, sprint headers, expand/collapse, drag-to-reposition, resize |
| `frontend/src/components/planner/PlannerBoard.tsx` | Board mode — project cards, team member cards, drag person→project |
| `frontend/src/components/planner/PlannerBacklog.tsx` | Sidebar — unscheduled items list, search/filter, drop zone for unschedule gesture |
| `frontend/src/components/planner/PlannerCapacity.tsx` | Capacity panel — team summary + individual person rows, live-updating allocation |
| `frontend/src/components/planner/AssignPopover.tsx` | Click-bar popover — team list with fit badges, effort slider, skill chips |
| `frontend/src/components/planner/ScenarioTabs.tsx` | Scenario pill tabs + creation modal (clone/blank) |
| `frontend/src/components/planner/DaysPopover.tsx` | Board mode — lightweight "how many days?" popover on drag-drop |

### Modified files

| File | Change |
|---|---|
| `frontend/src/types/index.ts` | Add `PlannerItem`, `PlannerAssignment` interfaces; extend `Scenario` with optional `plannerLayout` |
| `frontend/src/stores/actions.ts` | Add planner-specific actions: `updatePlannerLayout()`, `addPlannerAssignment()`, `removePlannerItem()`, `unlockPlannerItem()` |
| `frontend/src/services/supabaseSync.ts` | Extend scenario serialization to include `plannerLayout` in the JSONB snapshot |
| `frontend/src/App.tsx` | Add route for `/planner`; redirect `/scenarios` → `/planner` |
| `frontend/src/components/layout/Sidebar.tsx` | Replace "Scenarios" nav item with "Scenario Planner" pointing to `/planner` |
| `frontend/package.json` | Add `@dnd-kit/core`, `@dnd-kit/utilities`, `@floating-ui/react` |

### Not modified

| File | Reason |
|---|---|
| `utils/capacity.ts` | Used as-is — no changes to the capacity engine |
| `utils/staffing.ts` | Used as-is when available (US-061) |
| `utils/sprints.ts` | Used as-is |
| `supabase/migrations/` | No new tables — `plannerLayout` lives inside the existing `scenarios` JSONB column |
| `components/JiraGantt.tsx` | The existing Timeline view is untouched — the planner has its own gantt implementation |

### Navigation change

The existing `pages/Scenarios.tsx` is retired. The sidebar "Scenarios" entry becomes **"Scenario Planner"** pointing to `/planner`. The old `/scenarios` route redirects to `/planner` for bookmarked URLs.

---

## 11. Out of Scope & Deferred Items

### Deferred to v2

| Item | Reason |
|---|---|
| Weekly column granularity | Sprint columns (6 per quarter) are sufficient for v1. Weekly view is a capacity panel enhancement for later. |
| Per-sprint effort variance | `daysPerSprint` is flat across all sprints an item covers. Varying effort per sprint adds UI complexity for an edge case. |
| Cross-quarter drag | Dragging a bar from Q2 into Q3 requires multi-quarter view and complex repositioning. Tracked in TODO-001. |
| BIZ contact drag in Board mode | BIZ assignment via SmartAssignmentPanel inline only for v1. IT drag only. Tracked in TODO-002. |
| Scenario comparison (side-by-side diff) | Existing `ScenarioDiffModal` can be extended later. |
| Time-off highlighting on capacity rows | Available days already account for time-off in the number; visual highlighting is polish. |
| Baseline vs scenario assignment split | Showing where days come from adds cognitive load without clear v1 value. |

### Not planned

| Item | Reason |
|---|---|
| Two-way Jira sync from planner | Scenarios are a planning sandbox. Pushing to Jira is a separate feature (US-049/050). |
| Mobile / touch support | Wide-screen planning tool. Touch drag is unreliable for sprint placement. |
| AI-generated scenario suggestions | Premature. Need usage data first. |
| Undo/redo stack | Ctrl+Z for drag ops is significant infrastructure. PM can drag things back manually in v1. |
| Export / print of planner view | Deferred until demand. The planner is a working tool, not a reporting surface. |
| Scenario Wizard (US-060) | Dropped. The planner's direct interactions replace the wizard's 5-step flow entirely. |

### Dashboard nudge banner (preserved from US-060)

When `getWarnings()` returns ≥2 members at high utilisation (>85%) or over capacity, the Dashboard shows:

```
⚠  3 team members are at high utilisation this quarter.
   Plan ahead safely before committing.  [Open Scenario Planner →]
```

- CTA navigates to `/planner`
- 7-day `localStorage` dismiss TTL
- Re-triggers when a *new* member (not in stored dismissed set) tips over 85%
- CTA gated behind `can('editAssignments')` — read-only users see "Contact your IT manager" instead
- Not shown during `isInitializing`

---

## Design System

Follows the established application design language:

- **Typography:** Plus Jakarta Sans (as configured in `tailwind.config.js`)
- **Colours:** Mileway brand tokens (`mw-primary` / `sana-teal` for IT track, `biz-purple` for BIZ track)
- **Bar colours:** Same palette as the Timeline view (see `docs/views/timeline-view.md` §Bar Types)
- **Cards:** White background, `#EBEBEB` border, 12px radius
- **Buttons:** Dark `#1F2937` for primary, accent colour for CTAs, ghost for secondary
- **Status badges:** Pill-shaped, coloured by fit level or allocation tier

---

## Decisions Log

All decisions made during the design session (2026-03-17):

| # | Decision | Context |
|---|---|---|
| D1 | Full snapshot model for scenarios | Each scenario is a complete copy, no deltas |
| D2 | Maximum 5 scenarios | Prevents tab sprawl |
| D3 | Locked items unlockable per-scenario | Enables "what if committed work slips" modeling |
| D4 | Merge US-060 + US-061 + US-062 into one feature | One page, two modes (Board + Timeline), shared scenario data |
| D5 | Drop the Scenario Wizard (US-060) | The planner's direct interactions replace the wizard entirely |
| D6 | Keep skill matching from `scoreMember()` | Surfaces in the assign popover; gracefully degrades if US-061 hasn't shipped |
| D7 | Sprint granularity only for v1 | Weekly columns deferred — sprint is already 6x improvement over current quarter-level |
| D8 | Capacity panel shows avail days after holidays/time-off/BAU | Single number, computed by existing `calculateCapacity()` |
| D9 | Team members in capacity panel (Timeline) and right panel (Board) | Mode-dependent placement |
| D10 | Blank canvas pre-populates both panels | All Jira items in backlog, all team members in team panel — no manual adding |
| D11 | Full-height sprint column drop zones | Fixes the "target too small" UX issue |
| D12 | Drag bar onto backlog = unschedule gesture | Faster than popover → "Remove" click |
| D13 | Popovers via `@floating-ui/react` portal | Never clipped, viewport-aware positioning |
| D14 | Assignment at Epic, Feature, and Story level | Matches the real data model hierarchy |
| D15 | Live capacity update during drag | The core feedback loop that makes the tool valuable |
| D16 | Replace "Scenarios" sidebar entry with "Scenario Planner" | Clean navigation, no parallel entries |
| D17 | Dashboard nudge banner preserved | Entry point: "N members at high utilisation → Open Scenario Planner" |
