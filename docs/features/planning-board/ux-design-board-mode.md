# Planning Board — UX/UI Design Brainstorm

> **Date:** March 14, 2026
> **Status:** Brainstorm / Pre-implementation
> **Related backlog item:** US-062 (Scenario-Native Planning Board)
> **Implementation plan:** `~/.claude/plans/refactored-sparking-sundae.md`

---

## The Core Idea

A visual, drag-and-drop staffing canvas that lives inside the Scenario system. The planner sees all projects on one side, all people on the other, and a timeline in the middle — like a coach's formation board. Everything is scenario-scoped and non-destructive to the baseline.

---

## Options Explored

Five design philosophies were evaluated before landing on the recommended approach.

### Option A — "The Pitch" (sports formation board)
- Left bench: project cards
- Right bench: people
- Center: Gantt timeline
- Drag project from bench → places bar on timeline
- Drag person → drops onto bar → avatar appears
- **Feel:** Familiar, coach-like, low learning curve
- **Risk:** Could feel like just another Gantt tool

### Option B — "The Canvas" (Figma-inspired)
- Infinite 2D whiteboard with zoom/pan
- Projects are cards placed freely on canvas
- Timeline is a subtle grid overlay
- Minimap in corner
- **Feel:** Creative, open, designer-friendly
- **Risk:** Too freeform for enterprise planning; overwhelming

### Option C — "The War Room" (command center)
- Left: initiative list with health indicators (red/amber/green)
- Right: heat map grid — person × month cells, click to assign
- Dense, data-rich, executive-friendly
- **Feel:** Bloomberg terminal, analytical
- **Risk:** Feels like a spreadsheet

### Option D — "The Casting Board" (Hollywood metaphor)
- Projects are "roles" with required skills listed
- People are "talent cards" with skills as tags
- Drag talent onto roles — fit score appears instantly
- Auto-cast button with reasoning
- **Feel:** Fresh, fun, completely different
- **Risk:** Too playful for a serious planning context

### Option E — "The Swimlane Board" (Notion/Linear-inspired)
- People are rows
- Projects are colored blocks spanning time
- Drag blocks to reassign timing or person
- Toggle: view by person | view by project
- **Feel:** Clean, modern, fast
- **Risk:** Less spatial freedom

---

## Recommended Approach: A + E ("The Planning Field")

Combine Option A's bench metaphor with Option E's swimlane structure.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Scenario: Q2 Accelerated  [vs Baseline ▾]          [Auto-Assign] [Promote →] │
├───────────────┬─────────────────────────────────────┬───────────────┤
│  PROJECT BENCH│         S W I M L A N E S           │  TEAM BENCH   │
│               │                                     │               │
│  ┌──────────┐ │  Alice  ░░░[██Alpha██]░░[██Gamma█]  │  👤 Alice  82%│
│  │ Alpha    │ │  Bob    [████ Beta ████████]░░░░░░  │  👤 Bob    95%│
│  │ Beta     │ │  Carol  ░░░░░░░░░░░░░░░░░░░░░░░░░  │  👤 Carol  40%│
│  │ Gamma    │ │  Dana   [██Alpha██]░░░[████Beta███]  │  👤 Dana   78%│
│  │          │ │                                     │               │
│  │ + Import │ │  Jan  Feb  Mar  Apr  May  Jun  Jul  │  + Add Member │
│  │ + New    │ │                                     │               │
└───────────────┴─────────────────────────────────────┴───────────────┘
```

Three resizable panels. Canvas is the center of gravity.

---

## The Three Zones

### Left Panel — Project Bench

**What lives here:** All initiatives in the scenario. Unscheduled projects sit here until placed.

**Each card shows:**
```
┌────────────────────────┐
│ ● Alpha          🔴    │  ← health indicator
│ Required: React, UX    │
│ 3 of 5 roles filled    │
│ Q1 → Q3                │
└────────────────────────┘
```

**Interactions:**
- Drag card → drops onto canvas as a time block (snaps to month or sprint boundary)
- Click card → highlights all people assigned to it across swimlanes
- Right-click → duplicate, archive, edit details
- Import button pulls projects from baseline with one click

---

### Center Panel — Swimlane Canvas

**Structure:**
- One row per person (IT members first, business contacts below a divider)
- Time axis across the top — toggle: months / sprints / quarters
- Each assigned block = colored project bar

**The blocks:**
```
  [████████ Alpha ████████]
      ↑               ↑
   drag edge       drag edge
   to resize       to resize
```

- Drag left/right edge to resize duration
- Drag the whole block to move it in time
- Drag block off the row → unassigns (returns to bench if no one else on it)
- Click block → opens detail drawer on the right

**Empty rows:**
- Empty row is a drop target — drag project block onto it to assign that person
- Drag a person from right bench → creates a new row with that project pre-populated

**Visual states:**

| State | Appearance |
|---|---|
| Assigned, healthy | Solid color, project name |
| Over capacity | Red striped overlay |
| Skill mismatch | Yellow dashed border |
| Unconfirmed/draft | Lighter fill, italic name |
| Promoted to baseline | Checkmark badge |

---

### Right Panel — Team Bench

**What lives here:** Every team member with a live capacity indicator. Updates as assignments change.

**Each card:**
```
┌──────────────────────┐
│ 👤 Alice        82%  │  ← capacity bar (green/amber/red)
│ React · UX · PM      │  ← skills as tags
│ 34 days free in Q2   │  ← contextual to selected project
└──────────────────────┘
```

**Capacity color thresholds:** green < 80%, amber 80–95%, red > 95%

**Interactions:**
- Drag person → drop onto a project block → assigns them
- Drag person → drop onto an empty row → creates swimlane for them
- Click person → highlights all their blocks across canvas
- When a project is selected, bench **re-sorts by fit**: best match → worst match, with fit score badge

---

## Drag & Drop Mechanics

### Placing a project
1. Drag from left bench
2. Canvas highlights valid drop zones (rows with headroom)
3. Drop on row → block appears, snaps to time boundary
4. Quick popover: set start/end date or sprint range
5. Capacity bars update instantly

### Assigning a person
1. Click project block → becomes selected (glows)
2. Right bench re-ranks people by fit
3. Drag person → drop onto selected block
4. Skill match → green flash, capacity bar updates
5. Skill mismatch → yellow warning badge, tooltip explains gap
6. Over capacity → red flash, warning persists but doesn't block

### Reassigning
- Drag block from one row to another → moves the assignment
- Original person's capacity frees, new person's capacity consumed — both update live

---

## Warning System

**Non-blocking. Always visible, never modal.**

**Warning tray** — thin bar above canvas:
```
⚠ 2 capacity conflicts  ·  🟡 1 skill mismatch  ·  🔴 Beta has unfilled roles   [Review ▾]
```

Clicking "Review" opens a side panel listing each conflict with one-click resolution suggestion.

**Inline warnings on blocks:**
- Small icon on block corner, tooltip on hover
- No popups, no interruptions during drag

---

## Auto-Assign

### Per-project
1. Click project block → "Auto-staff this" button in toolbar
2. System ranks available people: capacity headroom + skill match + fewest concurrent projects
3. **Ghost preview overlay** — suggested assignments shown before commit
4. Before/after capacity bars shown side by side
5. Accept all / pick individually / dismiss

### Global
1. Click "Auto-Assign" in top bar
2. Runs across all unassigned roles in scenario
3. Review panel: suggestions grouped by project
4. Bulk accept or review one by one

---

## Fit Scoring Algorithm (for auto-assign and bench re-ranking)

```
fit_score = (capacity_score × 0.5) + (skill_score × 0.35) + (availability_score × 0.15)

capacity_score    = 1 - (current_utilisation / 100)   // higher = more headroom
skill_score       = matching_skills / required_skills  // 0.0 → 1.0
availability_score = 1 / (concurrent_project_count + 1) // penalise overcommitted people
```

Badge thresholds: 🟢 ≥ 0.7 · 🟡 0.4–0.69 · 🔴 < 0.4

---

## Time Axis Modes

| Mode | Granularity | Best for |
|---|---|---|
| Month | Monthly blocks | High-level planning |
| Sprint | 2-week blocks | Detailed assignment |
| Quarter | Q1/Q2/Q3/Q4 | Executive view |

Switching mode doesn't change assignments — zoom level only.

---

## Seeding a Scenario

Two entry modes when opening Planning Board:

| Mode | Description |
|---|---|
| **Copy from baseline** | Pre-populates canvas with all current projects + assignments |
| **Blank canvas** | Start from scratch, pull individual projects from left bench |

---

## "vs Baseline" Toggle

Splits each swimlane row into two thin rows:
- Top row: baseline state (greyed out)
- Bottom row: scenario state (colored)

Instantly shows what changed at a glance.

---

## Promote to Baseline

- Button top-right
- **Disabled** until scenario has no critical (red) conflicts
- Confirmation dialog: diff summary of what will change (reuses existing `ScenarioDiffModal`)
- Can promote partially (selected projects only) — future enhancement

---

## What Makes This Feel Fresh

1. **No modals** — everything happens inline or in slide-out drawers
2. **Live feedback** — capacity bars animate as you drag
3. **The bench metaphor** — feels like managing a sports roster, not filling a spreadsheet
4. **Fit scoring on context** — right panel re-ranks when you select a project, not alphabetically
5. **Warning tray** — conflicts visible but never blocking flow
6. **Ghost preview** on auto-assign — see the plan before committing

---

## Open Questions

- Should people in the right bench show their **baseline utilisation** as a secondary indicator (so you can see what you're changing from)?
- Can one person appear in **multiple scenarios simultaneously** — and if so, should cross-scenario load be visible?
- What defines "required skills" for a project — manual tagging, or inferred from Jira story assignees?
- Does auto-assign optimize for **balance** (spread load evenly) or **speed** (fill roles fastest)?
- Should scenarios have an **expiry/archive** state once promoted?
- Does this need to work on **iPad/tablet**?
