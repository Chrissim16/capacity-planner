# Planning Board v2.1 — Improvements Design

**Date:** 2026-03-16  
**Status:** Approved — extends `2026-03-16-planning-board-v2-design.md`  
**Scope:** Ten targeted improvements to the Planning Board surface: drag-to-remove, clean canvas, roomier sidebars, full Jira hierarchy, sub-quarter timeline, date-range assignments, baseline project creation fix  
**Supersedes:** Nothing — this is additive to v2

---

## Context

The v2 design (approved 2026-03-16) established the core Planning Board: three-panel layout, People/Projects view toggle, Gantt-style quarter columns, drag-and-drop assignment from sidebars. This document specifies ten follow-on improvements discovered during the first working build.

---

## Improvement Areas

| # | Item | Cluster |
|---|------|---------|
| 1 | Remove project by dragging canvas row → left sidebar | A |
| 2 | Remove person by dragging canvas row → right sidebar | A |
| 3 | Remove "Add person/project" inline rows from canvas | B |
| 9 | Drag a project from left sidebar onto a person row (People view) | B |
| 5 | Roomier sidebar cards — 260px, card style | C |
| 4 | Full Epic → Feature → User Story hierarchy in canvas | D |
| 6 | Fix: cannot add project when plan is based on baseline | F |
| 7 | Timeline granularity toggle: Quarter / Month / Week | E |
| 8 | Assignments accept start + end date, not just days | E |

---

## Cluster A — Drag-to-Remove

### Motivation

The current interaction model is one-directional: drag from sidebar → drop onto canvas to assign. There is no drag-based removal path. Users must click the `×` on each individual bar to remove an assignment. Removing a project or person entirely requires multiple clicks.

### Design

Both sidebars become **bidirectional drop zones**. On drag start, a removal target appears at the top of the relevant sidebar.

#### Removing a project (canvas → left sidebar)

- The user grabs a **project parent row** by its label cell drag handle.
- A "↩ Remove from plan" drop zone appears at the top of the left sidebar, styled with a soft amber glow border.
- On drop: the project is removed from the active plan grid and sent back to the Idea Backlog (left panel list). All assignments belonging to that project in this plan are deleted.
- An undo toast fires: *"Alpha Launch removed from plan — Undo"*. Undo restores the project row and all its assignments.

```
Left sidebar on drag-start (project grabbed)
┌────────────────────────────┐
│ ↩ Remove from plan         │  ← amber drop zone
├────────────────────────────┤
│  ● Alpha Launch            │
│  ● Portal Redesign         │
│  + Add idea manually       │
└────────────────────────────┘
```

#### Removing a person from a project (canvas → right sidebar)

- The user grabs a **person child-row** within an expanded project row (Projects view) or an **assignment bar** in a project's row (People view).
- A "↩ Remove from project" drop zone appears at the top of the right sidebar.
- On drop: that person's assignments for that specific project are deleted. Assignments on other projects are untouched.
- Undo toast: *"Alice removed from Alpha Launch — Undo"*.

```
Right sidebar on drag-start (person-from-canvas grabbed)
┌────────────────────────────┐
│ ↩ Remove from project      │  ← amber drop zone
├────────────────────────────┤
│  ○ Alice Chen   IT  14d    │
│  ○ Bob K.       IT   8d    │
└────────────────────────────┘
```

### DnD data types

Two new drag data types, distinct from the existing `member` (sidebar → canvas) type:

| Type | `data.type` | Required fields |
|------|-------------|----------------|
| Canvas project drag | `canvas-project` | `projectId`, `projectName` |
| Canvas person drag | `canvas-member` | `memberId`, `memberName`, `fromProjectId` |

The `fromProjectId` field on `canvas-member` scopes the deletion to the correct project.

### Drop zone visibility

The removal drop zones appear **only during a matching drag** — the left sidebar zone appears only when a `canvas-project` is being dragged; the right sidebar zone only when a `canvas-member` is being dragged. They do not appear during normal sidebar-to-canvas drags.

---

## Cluster B — Clean Canvas + Bidirectional Sidebar Drag

### Motivation

The permanent "+ Assign person" and "+ Assign project" rows beneath every expanded row add visual noise. At the same time, the left sidebar items are not draggable — users can only drag people from the right sidebar, but not projects from the left. This asymmetry is confusing.

### Design

#### Remove inline assign rows

The "**+ Assign person**" (Projects view) and "**+ Assign project**" (People view) permanent child rows are removed from the canvas.

**Discoverability fallback — hover `+` button:** A small `+` icon appears at the right edge of the label cell on row hover. Clicking it opens the existing `AssignPopover` in the appropriate mode. This preserves keyboard-accessible assignment without cluttering the resting state.

```
Projects view — resting                 On row hover
┌────────────────────────┐              ┌──────────────────────────────┐
│ ∨ Alpha Launch  38/30d │              │ ∨ Alpha Launch  38/30d    +  │ ← hover reveals
│   Alice C.   IT        │              │   Alice C.   IT              │
│   Bob K.     IT        │              │   Bob K.     IT              │
└────────────────────────┘              └──────────────────────────────┘
```

The `+` button tooltip reads *"Assign a person"* (Projects view) or *"Assign a project"* (People view).

#### Left sidebar items become draggable (People view assignment)

In **People view**, project cards in the left sidebar become draggable with the same `@dnd-kit` pattern as the right sidebar member cards.

- Drag data type: `sidebar-project` with `projectId` and `projectName`.
- Person rows in People view become `useDroppable` targets that accept `sidebar-project` drags.
- On drop: a popover appears anchored to the person row — *"Assign [project name] to [person name] — how many days? In which quarter?"*
- On confirm: `addAssignment({ memberId, projectId, quarter, days })` is called.

During a `sidebar-project` drag, person rows receive the same fit-glow treatment as project rows receive during a `member` drag: teal (available capacity), amber (near capacity), red (over).

```
People view — dragging "Alpha Launch" from left sidebar
┌──────────────────────────────────────────────────────┐
│ ∨ Alice C.   IT  38/45d  ████████████░░░░  Q1 2026   │ ← teal glow (room)
│ ∨ Bob K.     IT  22/40d  ████████░░░░░░░░  Q1 2026   │ ← teal glow
│ > Sarah M.   BIZ  3/22d  ░░░░░░░░░░░░░░░░  Q1 2026   │ ← teal glow
└──────────────────────────────────────────────────────┘
```

### Complete drag interaction matrix (post v2.1)

| Drag source | Drop target | Result |
|-------------|-------------|--------|
| Right sidebar member card | Project row (Projects view) | Assign member to project |
| Left sidebar project card | Person row (People view) | Assign project to person |
| Canvas project row header | Left sidebar remove zone | Remove project from plan |
| Canvas person child-row | Right sidebar remove zone | Remove person from project |
| Canvas bar (horizontal) | Different quarter column | Move assignment to new quarter (TODO-001) |

---

## Cluster C — Roomier Sidebar Cards

### Motivation

At 180px width with 6px vertical padding, sidebar items truncate at ~20 characters and show almost no metadata. Users cannot distinguish items at a glance without hovering.

### Design

Both sidebars expand to **260px** (expanded state). The collapsed state remains 40px. Items become cards with more breathing room.

#### Left sidebar — project cards

```
┌────────────────────────────────────────────┐
│ ● Alpha Launch                             │
│   CP-12 · In Progress                      │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ ● Portal Redesign                          │
│   CP-15 · Backlog                          │
└────────────────────────────────────────────┘
```

- White background card, `border-radius: 8px`, subtle `box-shadow` on hover
- 3px left accent line: teal if selected, warm-gray otherwise
- Line 1: project name — `DM Sans 13px font-medium`
- Line 2: Jira key (if applicable) + status badge — `10px muted gray`
- Vertical padding: 10px per card, 6px gap between cards
- Horizontal padding: 12px

#### Right sidebar — member cards

```
┌────────────────────────────────────────────┐
│ ○  Alice Chen              IT              │
│    14d free · Q1 2026                      │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│ ○  Bob K.                  IT              │
│    8d free · Q1 2026                       │
└────────────────────────────────────────────┘
```

- Avatar circle 32px (up from 28px)
- Line 1: name + IT/BIZ badge right-aligned — `DM Sans 13px font-medium`
- Line 2: available days + quarter context — `10px muted gray`
- Same card border style as left sidebar
- Drag handle affordance: `cursor-grab` cursor on hover, subtle `≡` icon appears at left edge on hover

#### Updated spacing tokens

| Element | v2 | v2.1 |
|---------|-----|------|
| Sidebar width (expanded) | 180px | 260px |
| Card vertical padding | 6px | 10px |
| Card gap | 0 (flat list) | 6px |
| Avatar size (sidebar) | 28px | 32px |
| Card border-radius | 0 | 8px |

---

## Cluster D — Epic → Feature → User Story Hierarchy

### Motivation

The canvas currently shows Jira Epics as flat rows. Portfolio-level planning requires visibility of what is *inside* an epic — which features are in scope, which stories are estimated — before committing to a staffing level. Assignments can meaningfully live at any level: some teams staff at Epic level, others decompose to Story.

### Design

The Projects view canvas gains three-level expandable rows:

```
∨ CP-12: Alpha Launch                   │  ████████ 38d  ·  50/60d staffed
    ∨ CP-45: User Auth Feature          │  ██████   20d  ·  18/20d staffed
        ∨ CP-67: Login page             │  ███       8d
              Alice C.  IT              │  ████ 8d
        > CP-68: 2FA setup              │  (collapsed — 5d assigned)
    ∨ CP-46: Dashboard Feature          │  ████     18d  ·  12/18d staffed
        + Story rows …
```

**Expand/collapse behavior:**
- Each level has its own independent expand/collapse state.
- By default, Epics are expanded; Features and Stories are collapsed.
- Clicking the chevron on any row toggles that level independently.

**Assignment at any level:**
- A person can be assigned directly to a Story, a Feature, or an Epic.
- The `Assignment.projectId` field already accepts any Jira item key — no data model change required for assignment storage.
- Staffing bars **roll up**: a Feature's staffing bar = sum of all assignments directly on that Feature + all assignments on its child Stories. An Epic's staffing bar = sum across all Features and direct-Epic assignments.

**Indentation:**

| Level | Left indent |
|-------|-------------|
| Epic | 0 (same as native projects) |
| Feature | 24px |
| Story | 48px |
| Person assignment | 72px |

**Hover `+` button** at each level opens `AssignPopover` scoped to that item's key.

### Jira API requirements

The current `jiraWorkItems` store only contains Epics fetched via the existing Jira sync. Features and Stories require a deeper hierarchy fetch.

**Spike required before implementation:** Confirm the correct Jira API call to retrieve children of an Epic (Software board vs Product Discovery board have different hierarchy models). The spike should:
1. Identify whether the Jira project uses `Epic → Story` (classic) or `Epic → Feature → Story` (next-gen / Jira Advanced Roadmaps).
2. Confirm the API endpoints and pagination strategy.
3. Assess whether fetching is eager (on board load) or lazy (on Epic expand).

**Recommendation:** Lazy fetch on Epic expand — fetch child items when the user first expands an Epic row, cache in local component state, show a loading skeleton while fetching.

### Data shape additions

New entries in `jiraWorkItems` (already uses `JiraWorkItem[]`):

```typescript
interface JiraWorkItem {
  // existing fields …
  parentKey?: string;       // key of parent Epic or Feature
  hierarchyLevel: 'epic' | 'feature' | 'story' | 'subtask';
}
```

A `parentKey` field enables building the tree client-side from the flat `jiraWorkItems` array without a separate recursive data structure.

---

## Cluster E — Timeline Granularity + Date-Range Assignments

### Timeline granularity toggle

A **"Quarter | Month | Week"** segmented control is added to the top bar, replacing the static quarter-only column display.

```
Q1 2026 · Plan A  ✎     People | Projects     Quarter | Month | Week     [···]
```

**Quarter view** (existing): Up to 6 quarter columns, 200px wide each. No change.

**Month view**: 12 month columns (current + next 11 months), 120px wide each. Column headers: `Jan 26`, `Feb 26`, etc. Quarter label appears as a group header above the month columns:

```
│     Q1 2026               │     Q2 2026               │
│ Jan 26 │ Feb 26 │ Mar 26  │ Apr 26 │ May 26 │ Jun 26  │
```

**Week view**: 16 week columns (current + next 15 weeks), 80px wide each. Column headers: `W1 Jan`, `W2 Jan`, etc. Month label appears as a group header above week columns. Horizontal scroll is enabled — the label column remains sticky.

**Granularity state** lives in component UI state (not the Zustand store — it's a view preference, not plan data). It persists in `localStorage` under `planningBoard.granularity`.

### Bar rendering across granularity levels

| Assignment type | Quarter view | Month view | Week view |
|-----------------|-------------|------------|-----------|
| Quarter + days only (no dates) | Bar spans the full quarter column | Bar spans all months in that quarter | Bar spans all weeks in that quarter |
| With `startDate` + `endDate` | Bar spans the full quarter | Bar starts/ends at correct months | Bar starts/ends at correct weeks |

This ensures existing assignments render correctly at all granularity levels, while new date-precise assignments render accurately when zoomed in.

### Date-range assignments

The `Assignment` type gains two optional fields:

```typescript
interface Assignment {
  id: string;
  memberId: string;
  projectId: string;
  quarter: string;       // existing — retained for backward compat
  days: number;          // existing — retained; derived from date range when dates are set
  startDate?: string;    // ISO 8601 — e.g. "2026-01-06"
  endDate?: string;      // ISO 8601 — e.g. "2026-03-14"
}
```

**When `startDate` and `endDate` are set:**
- `quarter` is derived from `startDate` (the quarter that `startDate` falls in).
- `days` is recomputed from the date range using `getWorkdaysInRange(startDate, endDate, holidays)` — same holiday-aware logic as `getWorkdaysInQuarter`.

**Assign popover changes:**

The `AssignPopover` gains a mode toggle: **"By days"** | **"By dates"**.

```
By days  ·  By dates
─────────────────────
Quarter:    [Q1 2026 ▾]       (by days mode)
Days:       [  18    ]

─────────────────────
Start:      [2026-01-06]      (by dates mode)
End:        [2026-03-14]
Days:       18d (computed, read-only)
```

The computed days label updates live as start/end dates change, providing immediate feedback. The `quarter` field auto-populates from `startDate` and is shown read-only in by-dates mode.

**Backward compatibility:** Assignments without `startDate`/`endDate` render as today. No migration needed. New assignments created in "by days" mode also have no dates set.

---

## Cluster F — Baseline Plan: Project Creation Fix

### Symptom

When a plan is created "Based on current data" (i.e., seeded from the baseline), the "Add project" action fails silently or is blocked by a read-only guard.

### Root cause (to be confirmed)

The `addProject()` action in `stores/actions.ts` likely checks whether the active scenario is the baseline scenario and returns early. Plans created from the baseline are *copies* — they are not the baseline itself. The guard may be incorrectly matching on the seed type rather than whether the plan is the live baseline.

### Fix

1. Audit the `addProject()` action and any RBAC/guard wrappers in the planning board parent component.
2. If the guard fires on plans seeded from baseline: remove it. These plans are mutable by design — only the actual baseline scenario should be read-only.
3. If the plan is legitimately read-only (the user opened the baseline itself): surface a clear message in the `AddProjectRow` area instead of silent failure: *"This plan is the active baseline and cannot be edited. Duplicate it to make changes."* with a "Duplicate →" CTA.

---

## What This Extends (delta from v2)

| v2 | v2.1 addition |
|----|---------------|
| Right sidebar members draggable → canvas projects | Left sidebar projects also draggable → canvas people (People view) |
| Canvas assignment via drag-and-drop + inline "+ Assign" row | Inline "+ Assign" rows removed; hover `+` button as fallback |
| No drag removal path | Drag canvas rows to sidebar to remove |
| Sidebars 180px, flat list | Sidebars 260px, card style |
| Jira Epics only in canvas | Epic → Feature → Story hierarchy, lazy-fetched |
| Quarter-only timeline columns | Quarter / Month / Week toggle |
| Assignments: quarter + days only | Assignments: optional startDate + endDate for sub-quarter precision |
| Cannot add project to baseline-seeded plan | Fixed — with clear error if truly read-only |

---

## Out of Scope (this design)

- Week-level granularity on mobile/touch (deferred)
- Dragging assignments between granularity levels (e.g., drag a week-level bar to a month column)
- BIZ contact drag-and-drop (tracked separately as TODO-002)
- Real-time collaborative editing
- Bulk assignment (assign multiple people to a project at once)

---

## Open Questions

1. **Jira hierarchy API spike** — must be completed before Cluster D can be built. Which board type do the connected Jira projects use? Classic (Epic → Story) or Next-gen (Epic → Feature → Story)?
2. **Lazy vs eager hierarchy fetch** — lazy (on Epic expand) recommended to avoid large payloads, but needs confirmation based on average Epic count per plan.
3. **Week view column count** — 16 weeks shown was chosen arbitrarily. Should this be configurable, or match a fixed planning horizon (e.g., current quarter + next two quarters in week view)?
4. **Date-range validation** — if `startDate` is in Q1 but `endDate` is in Q2, should the assignment be split across both quarters or treated as a single cross-quarter block? Proposed default: treat as a single block anchored to the quarter of `startDate`, with a warning if the date range spans more than one quarter.
