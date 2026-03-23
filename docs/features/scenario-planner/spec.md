# Scenario Planner — Planning Requirements
## Features & User Stories with Acceptance Criteria — v2

**Date:** 2026-03-19
**Status:** Revised — Ready for Development
**Author:** Based on PM requirements session + PM review pass
**Relates to:** scenario-planner-final-design.md, scenario-planner-timeline-spec.md


| Requirement | Existing spec | Gap |
|---|---|---|
| Blank slate scenario | ✓ Covered | None |
| Baseline scenario (clone) | Partially — clone exists but Jira dates → sprint position not specified | **Gap: date-to-sprint mapping for baseline mode** |
| Team members + BIZ contacts in panels | ✓ Covered | None |
| Full Jira tree (Epic > Feature > Story) | ✓ Covered | None |
| Labels on work items for filtering | Mentioned, not detailed | **Gap: label filter spec** |
| Assignees from Jira pre-populated | Not specified | **Gap: Jira assignees visible in planner** |
| Sprint / date from Jira pre-populated | Not specified for blank slate | **Gap: Jira position data used in backlog cards** |
| Drag Epic → children follow onto timeline | Not specified — only individual item drag | **Gap: hierarchical drag from backlog** |
| Drag person directly onto bar | Not specified — click-to-popover only | **Gap: drag-to-assign in Timeline mode** |
| Removal drop zone (un-assign person) | Not specified — only unschedule gesture exists | **Gap: assignment removal interaction** |
| Capacity per process team (not just individual) | Individual rows only | **Gap: process team rollup row** |
| Actual availability on team member cards | In capacity panel only | **Gap: availability visible on people cards** |
| Manual item creation | Mentioned but undetailed | **Gap: full manual creation spec** |
| Skills definition on work items | Not in data model | **Gap: requiredSkills field on PlannerItem** |
| Capacity overload warning on assignment | Not specified for the slider popup | **Gap: inline warning at point of assignment** |
| Skill mismatch warning on assignment | scoreMember() matches member skills to project but item-level skills not definable | **Gap: item-level skill requirements + mismatch warnings** |
| Skill coverage gap warning | Not specified | **Gap: warn when a required skill has no assigned person covering it** |
| Smart person suggestions based on capacity + skill | scoreMember() exists but only fires if US-061 shipped; not wired to item-level skill requirements | **Gap: suggestions driven by item-defined required skills** |

---

## Feature Index

| ID | Feature | Stories |
|---|---|---|
| F-SP-01 | Jira Data Availability in Planner | SP-01 – SP-03 |
| F-SP-02 | Scenario Initialization Modes | SP-04 – SP-06 |
| F-SP-03 | Hierarchical Timeline Placement | SP-07 – SP-09 |
| F-SP-04 | People Assignment | SP-10 – SP-12 |
| F-SP-05 | Assignment Removal | SP-13 |
| F-SP-06 | Capacity Overview — Teams & Individuals | SP-14 – SP-16 |
| F-SP-07 | Manual Item Creation | SP-17 – SP-19 |
| F-SP-08 | Filtering | SP-20 – SP-21 |
| F-SP-09 | Skills & Assignment Intelligence | SP-22 – SP-26 |

---

## F-SP-01 · Jira Data Availability in Planner

**Purpose:** The planner is only as useful as the data it starts with. All Jira-sourced planning context — assignees, sprint positions, labels — must be visible in the planner from the moment it opens, without the PM having to re-enter anything.

---

### US-SP-01 · View Full Jira Hierarchy in Backlog

**As a** Project Manager,
**I want** to see all Jira work items in the backlog sidebar with their full parent-child hierarchy (Epic → Feature → Story),
**so that** I can understand the work structure before placing items on the timeline.

**Acceptance Criteria:**

1. The backlog sidebar displays all Jira items with `statusCategory !== 'done'` in a collapsed tree: Epics at root level, Features indented beneath their parent Epic, Stories indented beneath their parent Feature.
2. Each item card shows: item type pill (EPIC / FEATURE / STORY), Jira key, item name, and status badge.
3. A chevron on each Epic and Feature card expands/collapses its children inline within the sidebar list.
4. Items without a parent (orphaned Features or Stories) are grouped under an "Unlinked items" section at the bottom of the backlog.
5. The unscheduled count in the sidebar header counts **Epics only** (not all items at all levels). The tooltip on the count reads: "N epics unscheduled — expand to see features and stories."
6. An Epic is removed from the backlog when it is placed on the timeline. Features and Stories are removed individually when they are placed. If an Epic is on the timeline but some of its Features are not yet placed, those Features remain in the backlog under their parent Epic.

---

### US-SP-02 · See Jira Labels on Backlog Items

**As a** Project Manager,
**I want** to see the labels attached to Jira work items in the backlog,
**so that** I can understand which team, process area, or release a work item belongs to at a glance.

**Acceptance Criteria:**

1. Each backlog item card displays all Jira labels as small pill chips below the item name (max 3 visible, "+N more" overflow).
2. Labels are read from the Jira `labels` field on import. If no labels exist, no label area is rendered — no empty placeholder.
3. Label chips use a consistent neutral style. No custom colouring per label in v1.
4. Labels are present on Epic, Feature, and Story cards.
5. Labels are included in the `PlannerItem` data when the item is placed on the timeline, so they remain visible in the assign popover, slide-out panel, and are available for the label filter (US-SP-20).

---

### US-SP-03 · See Jira Assignees and Sprint Position on Backlog Items

**As a** Project Manager,
**I want** to see who is currently assigned to a Jira item and what sprint or date range it is scheduled for in Jira,
**so that** I have full planning context before deciding where to place it in a scenario.

**Acceptance Criteria:**

1. Each backlog item card displays existing Jira assignees as small avatar chips (max 3, "+N" overflow). Avatars from Jira user profile; initials fallback if no avatar URL.
2. If the Jira item has a sprint assignment, the sprint label is shown (e.g. "S7"). If it has start and end dates but no sprint, the date range is shown (e.g. "Mar 30 – Apr 10"). If neither exists, no date field is rendered.
3. These values are **display-only** on the backlog card. They do not automatically pre-position the item on the timeline — that is handled by the Baseline initialization mode (US-SP-05).
4. **Blank Slate mode:** When a backlog item is dragged onto the timeline, existing Jira assignees appear in the assign popover as suggestions with a "From Jira" indicator. They are **not** automatically assigned — the PM must confirm each one.
5. **Baseline mode:** Jira assignees are pre-loaded as real `PlannerAssignment` records from the moment the scenario opens. See US-SP-05 AC #5 for the authoritative behaviour. The backlog card still shows the avatar chips but they are already active assignments, not suggestions.

> **Design note:** The distinction between suggestion (Blank Slate) and pre-loaded assignment (Baseline) is intentional. Baseline represents "the current reality"; Blank Slate is a clean-room exercise. Do not apply the Baseline pre-load logic in Blank Slate mode.

---

## F-SP-02 · Scenario Initialization Modes

**Purpose:** The starting condition of a planning scenario determines the entire workflow. A blank slate suits greenfield planning; a baseline suits re-planning or change-request scenarios. Both must feel intentional and complete from the first moment.

---

### US-SP-04 · Start from Blank Slate

**As a** Project Manager,
**I want** to create a scenario starting from an empty timeline with all work items available in the backlog,
**so that** I can build a plan from scratch without being constrained by any existing schedule.

**Acceptance Criteria:**

1. When "Blank canvas" is selected in the scenario creation modal, the timeline canvas opens with no rows — only the sprint header and an empty state message: "Drag items from the backlog to start planning."
2. The backlog sidebar is pre-populated with all Jira items with `statusCategory !== 'done'`, organized in the full hierarchy (per US-SP-01).
3. The capacity panel (if visible) shows all team members with 0% allocation across all sprints — no items are consuming capacity yet.
4. The team member panel shows all active `TeamMember` and non-archived `BusinessContact` records with their full availability for the selected quarter (per US-SP-06).
5. No items are locked in Blank Slate mode. Items with `statusCategory: 'in_progress'` in Jira are included in the backlog but shown with an "Active in Jira" indicator chip — a visual reminder that this is live work, even though it is not locked in this scenario.

---

### US-SP-05 · Start from Existing Baseline (Jira Dates)

**As a** Project Manager,
**I want** to create a scenario where all Jira work items are pre-placed on the timeline based on their current Jira schedule,
**so that** I can re-plan from the current state rather than starting empty.

**Acceptance Criteria:**

1. When "Clone current plan" is selected in the scenario creation modal, all Jira items with `statusCategory !== 'done'` that have a sprint assignment or a start date appear as bars on the timeline. Positioning priority:
   - If `sprint` is set on the Jira item → map directly to the sprint number (1–24). Duration: if `sprint_end` is also set, `spanSprints = sprint_end - sprint_start + 1`. If only start sprint is set, default span is applied (Epic: 6, Feature: 2, Story: 1 — same as US-SP-07).
   - If `startDate` and `endDate` are set but no sprint → map start date to nearest sprint start boundary using the sprint date reference table. Calculate `spanSprints` from the date range: `ceil((endDate - startDate) / 14 days)`, minimum 1.
   - If neither sprint nor dates are set → item remains in the backlog sidebar, not placed on the timeline.
2. Items with `statusCategory: 'in_progress'` are automatically set to `locked: true` and display the 🔒 badge.
3. Items with `statusCategory: 'done'` are excluded entirely.
4. The backlog sidebar contains only items that could not be positioned (no sprint, no dates).
5. Jira assignees from `jiraItemBizAssignments` and the Jira `assignee` field are pre-loaded as `PlannerAssignment` records and are reflected immediately in the capacity panel. These are real assignments, not suggestions. See US-SP-03 AC #5.
6. A dismissible banner at the top of the canvas reads: "Loaded from Jira — [N] items placed, [M] unscheduled in backlog." The banner has an X button to dismiss manually. It does not auto-dismiss.

---

### US-SP-06 · See Actual Team Member Availability

**As a** Project Manager,
**I want** to see each team member's actual available days on their people card,
**so that** I know their real capacity before I start assigning work.

**Acceptance Criteria:**

1. Each team member card (in the people panel, Board mode right panel, and capacity panel label column) shows:
   - Total available days for the **currently selected quarter** (working days − public holidays − approved PTO)
   - A mini capacity bar showing used days vs available days, updating in real time as assignments are made
2. "Currently selected quarter" means: the quarter visible in the gantt canvas. When the quarter changes (via the quarter navigator), all availability figures update to reflect the new quarter's data.
3. Available days are computed by the existing `calculateCapacity()` utility. No new calculation logic.
4. If a team member has zero available days (fully on leave), their card shows a "No availability" state in muted text. The capacity bar is shown as full.
5. BIZ contacts show the same availability treatment, computed via `calculateBusinessCapacityForQuarter()`.
6. Hovering the available days figure shows a breakdown tooltip: "X working days · Y days PTO · Z public holidays."

---

## F-SP-03 · Hierarchical Timeline Placement

**Purpose:** When a PM places an Epic on the timeline, they want the whole structure to move with it — not just the Epic header. This is the fundamental unit of planning: placing a body of work, not an administrative container.

---

### US-SP-07 · Drag an Epic from Backlog — Children Follow

**As a** Project Manager,
**I want** dragging an Epic from the backlog onto the timeline to automatically place all its Features and Stories on the timeline too,
**so that** I don't have to drag each child item individually.

**Acceptance Criteria:**

1. When an Epic is dragged from the backlog and dropped onto a sprint column, the Epic bar appears on the timeline starting at the target sprint.
2. All Features belonging to that Epic are placed immediately below the Epic row, starting at the same sprint as the Epic.
3. All Stories belonging to each Feature are placed below their parent Feature row, starting at the same sprint.
4. **Default spans** are tiered, not uniform: Epic → 6 sprints (1 full quarter), Feature → 2 sprints, Story → 1 sprint. This gives the PM a workable starting shape rather than a collapsed stack requiring immediate mass-resize.
5. Features and Stories placed via this interaction appear in the gantt as collapsed by default. The Epic row shows a chevron to expand.
6. **Edge case — partial placement:** If one or more of the Epic's Features are already on the timeline (placed individually earlier), those Features are not moved and not duplicated. They remain where they are. The drop places only the Epic bar and any Features/Stories that were still in the backlog. A toast reads: "Placed [Epic name] with [N] features — [M] already scheduled, left in place."
7. The assign popover does **not** open automatically when an Epic is dropped. The PM places the structure first, then assigns.
8. All newly placed child items are removed from the backlog sidebar on drop.
9. Confirmation toast: "Placed [Epic name] with [N] features and [M] stories."

---

### US-SP-08 · Drag Individual Feature or Story from Backlog

**As a** Project Manager,
**I want** to drag a single Feature or Story from the backlog onto the timeline independently,
**so that** I can place a specific piece of work without committing its siblings.

**Acceptance Criteria:**

1. A Feature can be dragged from the backlog and dropped onto a sprint column. It creates a row at that sprint with default span of 2 sprints.
2. If the Feature's parent Epic is already on the timeline, the Feature row appears nested beneath it.
3. If the Feature's parent Epic is **not** yet on the timeline, the Feature is placed as a standalone row with a ⚠ icon in the label column. Tooltip: "Parent epic not yet scheduled." This warning clears automatically when the parent Epic is subsequently placed on the timeline.
4. A Story can be dragged from the backlog and placed independently. Default span: 1 sprint. Same parent-linking logic applies.
5. **Assign popover on drop:** The popover opens automatically **only if** the item has no Jira assignees. If the item already has Jira assignees (visible on the backlog card), the popover does not open automatically — a toast reads "[Item name] placed — click bar to review assignments." This prevents disruptive popover interruptions on pre-assigned work.
6. The dragged item is removed from the backlog sidebar on successful drop.

---

### US-SP-09 · Drag Bars to Reposition on Timeline

**As a** Project Manager,
**I want** to drag any unlocked bar horizontally to a new sprint position,
**so that** I can reschedule work without leaving the timeline.

**Acceptance Criteria:**

1. Any unlocked bar can be grabbed and dragged horizontally. The bar snaps to sprint boundaries (2-week increments). A visual snap indicator shows the target sprint during drag.
2. The capacity panel updates live as the bar moves across sprint columns.
3. **Moving Epics:** When an Epic bar is dragged, all its child Feature and Story bars shift by the same delta by default. No confirmation modal is shown. Immediately after the drop, an undo toast appears: "Moved [Epic name] and [N] items — Undo" with a 5-second window. Clicking "Undo" reverts the Epic and all children to their previous positions.
4. **Epic-only move (Shift modifier):** Holding Shift while dragging an Epic moves only the Epic bar, leaving children in their current positions. During the drag, a label appears beneath the dragged bar reading "Shift held — Epic only." The modifier is discoverable via a keyboard shortcut tooltip shown on the Epic bar on hover: "Drag to move all · Shift+drag to move Epic only."
5. Locked items cannot be dragged. No visual drag handles appear on locked bars.
6. Dropping a bar outside the valid sprint grid (e.g. beyond Q4) snaps it back to the nearest valid sprint with no state change.

> **Note:** This story supersedes the "Move children too?" confirmation modal described in the original spec. The modal is removed.

---

## F-SP-04 · People Assignment

**Purpose:** Assignment must be fast enough to feel like planning, not data entry. Two complementary paths exist: drag-to-assign (fast, single person) and click-to-popover (multi-person management). Both paths lead to the same effort slider, creating a consistent mental model regardless of entry point.

---

### US-SP-10 · Drag Team Member onto a Timeline Bar to Assign

**As a** Project Manager,
**I want** to drag a team member from the people panel and drop them directly onto a bar,
**so that** I can assign someone in a single gesture without opening a separate popover first.

**Acceptance Criteria:**

1. In Timeline mode, a **right-side collapsible people drawer** is accessible via a "People" button in the toolbar. It shows all active `TeamMember` and `BusinessContact` records with their current availability (per US-SP-06). The drawer width is 240px. It can be toggled open or closed without affecting the gantt layout (the gantt canvas shrinks to accommodate when open).
2. Dragging a person card from the people drawer over the gantt area highlights all valid drop targets: unlocked bars receive a subtle blue glow outline. Locked bars show no highlight and cannot receive drops.
3. Dropping a person onto a bar opens the effort slider popup with that person pre-selected and the slider focused. The popup is the same component used by the click-to-popover path.
4. The popup shows: person avatar + name, role badge, fit tier badge (from US-SP-26 if skills are defined), available days for the sprint range, effort slider (1–10 days per sprint, see US-SP-12), and a skill match section (if `requiredSkills` are defined on the item, per US-SP-24).
5. Confirming the popup creates the `PlannerAssignment` record. The capacity panel updates immediately.
6. If the person is **already assigned** to the item, the popup opens in edit mode showing their current `daysPerSprint`. A "Remove assignment" link is shown at the bottom of the popup.
7. Cancelling the popup or clicking outside discards the drop with no state change.

---

### US-SP-11 · Assign Multiple People via the Assign Popover

**As a** Project Manager,
**I want** to click any bar to open an assignment popover that shows all team members,
**so that** I can review and manage all assignments on a single item from one place.

**Acceptance Criteria:**

1. Clicking any bar opens the assign popover for that item. The popover is rendered via portal to `document.body` and auto-positioned using `@floating-ui/react` to avoid clipping.
2. The popover header shows: item type pill, item name, sprint range (e.g. "S7 – S9"), and required skills chips (if defined — see US-SP-22).
3. The team member list is ranked by fit tier (per US-SP-26): Good fit → Partial fit → Poor fit. Within each tier, members are sorted by available days descending.
4. Already-assigned members appear at the top of the list above all tiers, with their current `daysPerSprint` value and an "Assigned" badge.
5. Clicking any unassigned member row opens the effort slider inline within that row (not a new popup — the row expands). Clicking an already-assigned member row opens their slider in edit mode.
6. Multiple people can be assigned in a single popover session without closing and reopening.
7. The popover closes on click-outside, scroll, or pressing Escape.
8. The capacity panel updates live as assignments are added or modified within the popover.

---

### US-SP-12 · Set Effort with the Days-Per-Sprint Slider

**As a** Project Manager,
**I want** a slider to set how many days per sprint a person is assigned to an item,
**so that** effort allocation feels like a quick decision rather than a form-filling exercise.

**Acceptance Criteria:**

1. The slider supports values 1 to 10 days per sprint in **1-day increments**. The minimum is 1 day (not 0 — use "Remove assignment" for zero). Half-day precision is not supported in v1.
2. The current value is shown numerically next to the slider (e.g. "3 days / sprint").
3. Below the slider, a calculated total is shown: "= [N] days total across [X] sprints." This updates live as the slider moves.
4. As the slider moves, the capacity panel (if visible) updates in real time.
5. If the assignment would exceed the person's available days in any covered sprint, a capacity warning fires (per US-SP-23). The warning updates live as the slider moves.
6. If the item has `requiredSkills` defined, skill match chips are shown below the slider (per US-SP-24). These are static — they do not change as the slider moves.
7. "Confirm" saves the assignment. "Cancel" or click-outside discards with no state change.

> **Note on 1-day minimum:** The original spec proposed 0.5-day increments. This was revised to 1-day increments because (a) planning at 0.5-day granularity is not consistent with sprint-level planning, and (b) it doubles the number of slider positions with limited practical value. If 0.5-day precision is required in future, it should be driven by a specific use case.

---

## F-SP-05 · Assignment Removal

**Purpose:** Removing a person from a work item should be as fast as adding them. Two paths exist: the primary path (via the assign popover, discoverable) and a secondary drag gesture (for power users who want a faster shortcut).

---

### US-SP-13 · Remove a Person from an Assignment

**As a** Project Manager,
**I want** to remove a person from a work item assignment quickly,
**so that** I can correct over-assignments without navigating through multiple screens.

**Acceptance Criteria:**

**Primary path — via the assign popover:**
1. In the assign popover (US-SP-11), each already-assigned member row shows a "Remove" link (or trash icon) on the right. Clicking it removes the `PlannerAssignment` record immediately.
2. An undo toast appears: "Removed [Person name] from [Item name] — Undo" with a 5-second window.
3. The capacity panel updates immediately on removal.

**Secondary path — drag-to-removal zone:**
4. When hovering over a bar that has assignees, small avatar chips appear at the left edge of the bar. These chips are draggable.
5. Dragging an avatar chip away from the bar reveals a **Removal drop zone** — a fixed-position strip docked to the bottom of the canvas (above the capacity panel if open), labelled "Drop to remove assignment" with a remove icon.
6. The removal zone highlights with a red tint only when an assignment chip is being dragged. It does not appear during bar reposition drags, backlog-to-timeline drags, or person-panel-to-bar drags.
7. Dropping the chip on the removal zone removes the `PlannerAssignment`. The same undo toast (AC #2) appears.
8. Dropping the chip anywhere other than the removal zone, or back onto its original bar, cancels the action with no state change.

---

## F-SP-06 · Capacity Overview — Teams & Individuals

**Purpose:** Capacity is visible at two levels: individual (who specifically is overloaded?) and process team (which team as a whole is a bottleneck?). Both update live during planning. The team view answers the first question a PM asks; the individual view answers the follow-up.

---

### US-SP-14 · View Per-Sprint Capacity for Each Individual

**As a** Project Manager,
**I want** to see per-sprint allocation percentages and available days for each individual team member in the capacity panel,
**so that** I can immediately identify who is overloaded and in which specific sprint.

**Acceptance Criteria:**

1. The capacity panel shows one row per active `TeamMember` (IT) and non-archived `BusinessContact` (BIZ). Rows are grouped within their process team section (see US-SP-15).
2. Each row shows: avatar, name, role badge (IT: `#0089DD` / BIZ: `#6C7A89`), and one cell per sprint in the current quarter.
3. Each sprint cell shows: allocation percentage (bold, coloured by tier), `load / avail` days in muted text below it, and a 3px mini progress bar filling to 100% in tier colour with a red overflow segment beyond 100%.
4. Sprint cell background colour and text colour follow the allocation tier table (0% / 1–50% / 51–80% / 81–100% / >100%).
5. If any sprint for a person exceeds 100%, an "OVERLOADED" badge appears on their row label, and the row receives a subtle red left border.
6. All values update live during bar drag, bar resize, and effort slider adjustment. The mini progress bar animates with `transition: width 300ms ease`.
7. When the capacity panel is opened after having been hidden during a drag or resize, it recalculates from the current item positions before rendering. No stale values are shown. No loading spinner is needed — the recalculation is synchronous.

---

### US-SP-15 · View Capacity Rolled Up by Process Team

**As a** Project Manager,
**I want** to see a rolled-up capacity row per process team in the capacity panel,
**so that** I can identify team-level overload without reading every individual row.

**Acceptance Criteria:**

1. Process team summary rows appear in the capacity panel above the individual member rows they represent. One summary row per unique `processTeam` value across all active team members.
2. **Sort order:** Process team rows are sorted by their highest per-sprint allocation percentage, descending. The most stressed team appears first. This means the PM always sees the biggest problem at the top without scanning.
3. Each process team summary row shows: process team name (bold), and per-sprint: total allocated days / total available days for that team as a percentage.
4. The sprint cell background for a process team row is coloured by the **highest allocation tier of any individual member in that team for that sprint** — the worst-case signal, not the average.
5. Process team rows are collapsible. Clicking the row header toggles visibility of the individual member rows within that team.
6. The "Team total" row (all members combined) remains pinned at the very top, above all process team rows.
7. Members with no `processTeam` value are grouped into an "Unassigned team" section at the bottom. If more than 20% of active `TeamMember` records have no `processTeam`, a persistent notice appears in the capacity panel: "Some members have no process team assigned — update in team settings." This is a data quality signal, not a planning problem.
8. Process team rollup rows update live at the same cadence as individual rows (per US-SP-14 AC #6).

---

### US-SP-16 · Capacity Panel Live Update During All Planning Actions

**As a** Project Manager,
**I want** the capacity panel to update in real time whenever I take any planning action,
**so that** the panel always reflects the current state of the plan without requiring a save or refresh.

**Acceptance Criteria:**

1. The capacity panel recalculates and re-renders on: bar drag (during and on drop), bar resize (during and on release), person-drop assignment (US-SP-10 confirm), effort slider adjustment (US-SP-12, live during slider movement), and assignment removal (US-SP-13).
2. Both individual rows (US-SP-14) and process team rollup rows (US-SP-15) update in the same render cycle — no staggered refresh.
3. Mini progress bar animations (`transition: width 300ms ease`) apply to both individual and process team rows.
4. If the capacity panel is hidden when an action occurs, it does not maintain live state while hidden. On next open, it recalculates from the current item positions before rendering (per US-SP-14 AC #7).

---

## F-SP-07 · Manual Item Creation

**Purpose:** Jira does not always contain everything that needs to be planned — business workshops, UAT periods, dependency items from other teams, or work that simply hasn't been entered into Jira yet. Manually created items are first-class citizens on the timeline, visually distinguishable from Jira-sourced items but functionally identical in every other respect.

---

### US-SP-17 · Create an Epic Manually

**As a** Project Manager,
**I want** to create a new Epic directly in the Scenario Planner,
**so that** I can plan work that does not yet exist in Jira.

**Acceptance Criteria:**

1. A "+ Add Epic" button is available in the **toolbar** (not at the bottom of the gantt column — the toolbar is always visible and accessible without scrolling).
2. Clicking it opens a creation modal with: required field: Epic name. Optional fields: description, labels (tag input from the master labels list), estimated days, required skills (from the master skills list — per US-SP-22).
3. On save, a new `PlannerItem` is created with `type: 'epic'`, `sourceId: null`, and `isManual: true`. The Epic is placed in the **backlog sidebar**, not directly onto the timeline. The PM drags it onto the timeline when ready, consistent with all other item placement patterns.
4. Manually created Epics are visually distinguished by a ✏️ badge in the label column. The bar style is identical to Jira-sourced Epics — no diagonal patterns or additional visual noise.
5. A tooltip on the ✏️ badge reads: "Manually created — not in Jira."
6. Manually created items are **not** synced back to Jira. No sync action is triggered on create, save, or delete.

---

### US-SP-18 · Create a Feature or Story Manually, Linked to a Parent

**As a** Project Manager,
**I want** to create a Feature or Story manually and link it to an existing Epic or Feature,
**so that** I can add detail to the plan at the right level of the hierarchy.

**Acceptance Criteria:**

1. A **"+" button appears on hover** at the right end of each Epic or Feature row in the gantt label column. Clicking it opens the creation modal pre-set to create a child at the next level down (Epic row → create Feature; Feature row → create Story).
2. The creation modal includes: name (required), parent item (pre-filled with the hovered row's item, editable via dropdown), labels, estimated days, required skills.
3. On save, the new item is placed in the backlog sidebar under its parent, following the same drag-to-place pattern as US-SP-17.
4. `isManual: true` is set. The ✏️ badge visual treatment from US-SP-17 applies.
5. If the parent is already on the timeline, the new child appears in the backlog nested under its parent. The PM drags it onto the timeline to position it — it does not auto-inherit the parent's position.

> **Note:** The "+" hover button pattern replaces the right-click context menu approach from v1. Right-click is not discoverable; the hover button matches the established pattern in Jira, Linear, and Asana and is immediately obvious to PMs familiar with those tools.

---

### US-SP-19 · Edit and Delete Manually Created Items

**As a** Project Manager,
**I want** to edit or delete items I've created manually in the planner,
**so that** I can correct mistakes or remove work I've decided not to plan.

**Acceptance Criteria:**

1. A right-click context menu on any manually created item in the gantt shows: "Edit", "Delete".
2. "Edit" opens the same creation modal (pre-filled) from US-SP-17 / US-SP-18. Saving updates the `PlannerItem` in place.
3. **"Delete" uses the undo toast pattern** — no confirmation modal. The item (and its children if any) is removed immediately, and a toast appears: "Deleted [item name] — Undo" with a 5-second window. Clicking "Undo" restores the item and all its children. After 5 seconds, deletion is permanent.
4. Deleting a manually created item does not affect Jira. No sync action is triggered.
5. **Jira-sourced items** do not show "Edit" or "Delete" in their context menu. Their context menu shows only: "Edit required skills", "Edit labels (planner only)", and "View in Jira." The "planner only" qualifier is shown inline next to the label edit option so the PM understands it does not update Jira.

> **Note:** v1 used a confirmation modal for delete. This was replaced with the undo toast pattern to be consistent with US-SP-09 and US-SP-13, and to reduce friction when a PM is cleaning up multiple manually created items in quick succession. The 5-second undo window provides the safety net the modal was providing.

---

## F-SP-08 · Filtering

**Purpose:** A planner with 30+ Epics is overwhelming. Filtering is how the PM creates a focused working context without discarding data or switching tools.

---

### US-SP-20 · Filter Backlog and Timeline by Label

**As a** Project Manager,
**I want** to filter the backlog sidebar and the timeline rows by Jira label,
**so that** I can focus on a specific process area, team, or release train without seeing unrelated work.

**Acceptance Criteria:**

1. The toolbar contains a label filter: a multi-select dropdown showing all unique labels across all active items (Jira-sourced and manually created).
2. Filter match logic: an item matches if it carries **at least one** of the selected labels. The filter applies at any level of the hierarchy using the following bubble rules:
   - If a Story matches → its parent Feature and parent Epic are also shown (as structural context), even if they don't carry the label.
   - If a Feature matches → its parent Epic is shown. Its child Stories are shown only if they are already expanded.
   - If an Epic matches → it and all its children are shown regardless of their labels.
   - In all cases: items that neither match nor are ancestors/descendants of a match are hidden.
3. An active filter count badge appears on the filter control when active (e.g. "Labels: 2"). A "Clear" button appears inline with the filter when any selection is active.
4. The capacity panel is **not** filtered — it always shows full team allocation. Hiding bars from view does not remove the capacity they consume.
5. Filtering does not affect the gantt's expand/collapse state — expanded rows remain expanded, collapsed rows remain collapsed.

---

### US-SP-21 · Filter by Epic

**As a** Project Manager,
**I want** to filter the timeline to show only the Features and Stories belonging to a specific Epic,
**so that** I can do a focused planning review for one initiative at a time.

**Acceptance Criteria:**

1. An Epic filter control (multi-select dropdown, showing all Epic names and keys) is available in the toolbar alongside the label filter. The two filters share a unified "Filters" toolbar group — they are not separate isolated controls.
2. Selecting one or more Epics shows only those Epics and their descendant Features and Stories. All other Epic rows are hidden.
3. The backlog sidebar filters correspondingly to show only unscheduled items from the selected Epics.
4. The capacity panel continues to reflect full team allocation (not filtered).
5. **Combined filter logic:** When both an Epic filter and a label filter are active simultaneously, the result shows items that **match the Epic filter AND carry one of the selected labels** (AND logic between dimensions, OR logic within each dimension). If the combined filter produces zero results, an empty state message reads: "No items match the current filters — try adjusting your selection."
6. The "Clear" button in the toolbar clears both filters simultaneously. Individual dimension filters can also be cleared independently.

---

## F-SP-09 · Skills & Assignment Intelligence

**Purpose:** Assigning people without knowing whether they have the right skills — or whether the team collectively covers all required skills — leads to plans that look complete but aren't executable. This feature makes skill requirements explicit on work items and surfaces mismatches at the exact moment the PM is making assignment decisions, not after.

---

### US-SP-22 · Define Required Skills on an Epic, Feature, or Story

**As a** Project Manager,
**I want** to define which skills are required on an Epic, Feature, or Story,
**so that** the system can validate assignments and warn me when a gap exists.

**Acceptance Criteria:**

1. A "Required skills" field is available on the item detail panel (accessible by clicking the item name in the label column, or via right-click → "Edit required skills"). It accepts one or more skills as a multi-select tag input.
2. Skills are drawn from the same master skills list used on `TeamMember` records — a shared vocabulary enabling exact-match comparison. The input is a searchable dropdown of existing skill tags.
3. **Adding a new skill from the planner:** If the PM types a skill not in the master list and presses Enter, a "Proposed" skill tag is created **locally** (flagged as `status: 'proposed'`). It is usable for matching within the current scenario immediately. A notice appears: "This skill isn't in the master list yet — it won't match any team member profiles until an admin approves it." Proposed skills are visually distinguished (dashed border on the chip). An admin review queue exists separately; the planner does not silently add to the global master list.
4. If no skills are defined on an item, the field shows placeholder text: "No required skills — anyone can be assigned." No skill warnings fire for items with an empty skills list.
5. Required skills are stored as `requiredSkills: string[]` on the `PlannerItem`. For Jira-sourced items this field starts empty on import. For manually created items it can be set in the creation modal.
6. Required skills are visible as read-only chips on the bar hover tooltip and in the assign popover header.
7. When a scenario is cloned, `requiredSkills` values are preserved on all cloned `PlannerItem` records. Skills defined in one scenario are not visible in other scenarios unless they were set before cloning.
8. Required skills are **not** written back to Jira.

---

### US-SP-23 · Capacity Warning When Assigning a Person

**As a** Project Manager,
**I want** to be warned immediately when assigning a person would exceed their available capacity in one or more covered sprints,
**so that** I can make an informed decision rather than unknowingly creating an overloaded plan.

**Acceptance Criteria:**

1. In the effort slider popup (triggered by click or drag-to-assign), the system calculates the person's total allocated days per sprint across all existing assignments plus the item currently being assigned at the current slider value.
2. If the total exceeds the person's `availableDays` in **any single sprint** covered by the item, an inline warning appears below the slider:
   - Single sprint overloaded: "⚠ Overloaded in S[N] — [X] days allocated, [Y] available"
   - Multiple sprints: "⚠ Overloaded in S[N], S[M] — see capacity panel"
3. The slider field border turns orange when any overload condition is active.
4. The warning recalculates live as the slider moves. Reducing the value to a non-overloading amount clears the warning immediately.
5. The Confirm button remains active regardless of overload state — the PM can proceed with an intentional overallocation.
6. No "safe" confirmation is shown when there is no overload — only warn on violation.
7. This warning fires identically on both assignment paths: drag-to-assign (US-SP-10) and click-to-popover (US-SP-11).

---

### US-SP-24 · Skill Mismatch Warning When Assigning a Person

**As a** Project Manager,
**I want** to be warned when I assign a person to an item that requires skills they do not have,
**so that** I avoid creating a plan that relies on someone doing work outside their expertise.

**Acceptance Criteria:**

1. In the effort slider popup, if the item has `requiredSkills` defined (US-SP-22), the system compares those skills against the assigned person's skill tags on their `TeamMember` or `BusinessContact` record.
2. **Full match:** All required skills are present on the person → green chips shown for each matched skill. No warning text.
3. **Partial or no match:** One or more required skills are missing → warning text: "⚠ Missing skills: [skill A], [skill B]". Missing skills shown as red chips; matched skills as green chips below the warning.
4. If the item has no `requiredSkills` defined, no skill section is rendered — the popup remains compact.
5. The Confirm button remains active — skill warnings are advisory only.
6. The skill comparison is computed when the popup opens. It does not update dynamically within the popup session (skills are not edited here).

---

### US-SP-25 · Skill Coverage Gap Warning on Work Items

**As a** Project Manager,
**I want** to see a persistent warning on work items where a required skill is not covered by any assigned person,
**so that** I can identify planning gaps across the whole plan at a glance.

**Acceptance Criteria:**

1. A work item is in **skill gap state** when it has `requiredSkills` defined and at least one required skill is not covered by any of its current `assignees`.
2. Skill gap state is shown by a ⚠ badge on the right edge of the gantt bar and a ⚠ badge in the label column next to the item name. Tooltip: "Skill gap: [skill A] not covered by any assignee."
3. If the item has required skills but zero assignees: "No one assigned — [skill A], [skill B] required."
4. The ⚠ badge clears automatically when an assignee with the missing skill is added.
5. **Epic rollup badge:** An Epic shows a ⚠ badge in its label column **only when its row is collapsed** (children hidden). When expanded, the child-level badges are visible directly — showing the rollup badge simultaneously would create redundant visual noise. The Epic tooltip when collapsed lists the affected children: "Skill gaps in [Feature name], [Feature name]."
6. Items with no `requiredSkills` defined never show a skill gap badge.
7. Skill gap information is on bars and label column only. The capacity panel is not involved.

---

### US-SP-26 · Smart Person Suggestions in the Assign Popover

**As a** Project Manager,
**I want** the assign popover to show me a ranked list of team members based on available capacity and skill match,
**so that** I can make a good assignment decision quickly without manually scanning the whole team roster.

**Acceptance Criteria:**

1. The assign popover ranks all team members into three tiers based on fit. **Tier conditions are evaluated independently and result in distinct badge labels:**
   - **Tier 1 — Good fit (green "Good fit" badge):** Has capacity in all covered sprints AND matches all required skills. Also applies when the item has no required skills defined and the person has capacity.
   - **Tier 2 — Partial fit (amber "Partial fit" badge):** Has capacity but is missing one or more required skills. OR has all required skills but is at 81–110% capacity in one or more sprints.
   - **Tier 3a — Over capacity (red "Over capacity" badge):** Exceeds 110% in one or more covered sprints, regardless of skill match.
   - **Tier 3b — Skill gap (red "Skill gap" badge):** Has capacity but is missing required skills AND is already at >80% capacity (i.e. both problems present).
   - A person can only appear in one tier. If they qualify for both Tier 3a and Tier 3b conditions, Tier 3a (capacity) takes precedence.
2. Within each tier, members are sorted by available days descending.
3. Already-assigned members appear above all tiers with an "Assigned" badge and their current `daysPerSprint`. They are not re-ranked.
4. If `utils/staffing.ts` (`scoreMember()`) is available, its score is the primary ranking input. If unavailable, tiers are computed locally from capacity and `requiredSkills` vs `TeamMember.skills` — the popover is fully functional either way.
5. BIZ contacts appear in a collapsible section below IT members, with the same ranking logic applied independently.
6. The PM can assign any member regardless of tier. Ranking is a suggestion, not a gate.
7. A search input at the top of the list filters by name or skill. Search filters the displayed list; it does not change the ranking order of remaining results.
8. If the item has required skills, a summary line at the top of the popover reads: "Requires: [skill A], [skill B]."

---

## Implementation Notes

### Data Model Changes Required

The following fields need to be added to `PlannerItem`:

```typescript
interface PlannerItem {
  // ... existing fields ...
  isManual: boolean           // true for items created in the planner, not from Jira
  labels: string[]            // copied from Jira on import; editable for manual items
  jiraAssignees: string[]     // Jira assignee IDs — display only in Blank Slate; pre-loaded assignments in Baseline
  jiraStartDate?: string      // ISO date — used for Baseline sprint position mapping
  jiraEndDate?: string        // ISO date — used for Baseline sprint span calculation
  requiredSkills: string[]    // planner-only; not synced to Jira; preserved on clone
}
```

**Master skills list:** Both `TeamMember.skills[]` and `PlannerItem.requiredSkills[]` must reference the same vocabulary for matching to work. If a shared `skills` collection does not yet exist, create it as a flat list of skill name strings. Proposed skills (added in planner, pending admin approval) carry `status: 'proposed'` and are visible within their originating scenario only until approved.

**`processTeam` on BusinessContact:** Confirmed present on `TeamMember`. Verify presence on `BusinessContact` — required for US-SP-15 process team rollup.

### Interaction Conflicts Resolved

| Conflict | Resolution |
|---|---|
| "Move children too?" modal (original spec) vs undo toast (US-SP-09) | **Modal removed.** Move all children by default; undo toast provides safety net. |
| Assign popover via click (US-SP-11) vs drag-to-assign (US-SP-10) | **Both coexist.** Click = multi-assign management path. Drag = single-person shortcut. Same effort slider popup either way. |
| Auto-open popover on drop (original spec) vs no-popup on Epic drop | **Individual Feature/Story: open popover only if no Jira assignees exist.** Epic drop: never auto-open. |
| Undo toast vs confirmation modal for delete (US-SP-19) | **Undo toast throughout.** Consistent with all other destructive actions. |
| scoreMember() skill matching vs item-level requiredSkills | **Both apply.** requiredSkills adds item-specific constraints. scoreMember() contributes its score as input to tier ranking. If US-061 hasn't shipped, local capacity + skill comparison runs instead. No dependency block. |

### Stories Explicitly Out of Scope (v1)

- Weekly column granularity
- Per-sprint effort variance (slider is flat across all sprints)
- Cross-quarter drag
- Two-way Jira sync from planner
- Undo/redo stack beyond single-action 5-second toasts
- Writing `requiredSkills` back to Jira
- Per-sprint skill coverage analysis (skill gaps evaluated at item level only)
- Admin UI for proposed skills review queue (queue must exist; UI for managing it is separate)
