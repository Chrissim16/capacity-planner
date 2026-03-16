# Planning Board v2 — Design Document

**Date:** 2026-03-16  
**Status:** Approved — supersedes `2026-03-16-planning-board-ux-design.md` and replaces the UX direction from `2026-03-13-smart-staffing-planning-board-design.md` (US-062)  
**Scope:** Information architecture, navigation, Planning Hub, New Plan flow, and the Planning Board surface  
**Primary audience:** Portfolio managers checking capacity across all projects and people

---

## North Star

The Planning Board exists to answer one question: **"Can we staff this, and what breaks if we do?"**

Demand comes in — from the IT Idea Board (Jira Discovery) or manually — and the board makes it immediately visible whether the team can absorb it, in which quarter, and who would do the work.

The previous design failed because:
- "Scenarios" is a technical concept users don't think in. They think in "plans."
- The board was hidden two clicks deep behind a tab nobody noticed.
- The interaction model (drag from sidebar onto card rows) was unintuitive and slow.
- The center panel wasn't a real timeline — it was a list of cards with no time axis.
- Three entry points to create the same thing ("What if…", "New Scenario", "Create Scenario") confused rather than helped.

---

## 1. Information Architecture

### Navigation change

`Scenarios` is removed from the top-level nav. `Planning` replaces it.

```
Before: Dashboard | Jira | Projects | Team | Scenarios
After:  Dashboard | Jira | Projects | Team | Planning
```

The word "scenario" is retired from user-facing vocabulary. Users work with **Plans** — named, saveable planning workspaces. Internally, Plans are still Scenarios in the data model; the rename is UI-only.

### Page hierarchy

```
/planning                    → Planning Hub (list of plans)
/planning/:planId            → Planning Board (the active plan)
```

The board is no longer a tab inside another page. It is the destination.

---

## 2. Planning Hub

**Entry point:** clicking "Planning" in the nav.

### Layout

A clean card grid of saved plans. No info boxes explaining what a scenario is. No color pickers upfront.

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────┐
│ Q1 2026 · Plan A     │  │ Q2 2026 · Lean Team  │  │      +       │
│                      │  │                      │  │  New Plan    │
│ 6 projects           │  │ 4 projects           │  │              │
│ 24 team members      │  │ 18 team members      │  │              │
│ ████░░ 72% staffed   │  │ ██░░░░ 41% staffed   │  │              │
│                      │  │                      │  │              │
│ Dennis · 2h ago      │  │ Sarah · Mar 12       │  │              │
└──────────────────────┘  └──────────────────────┘  └──────────────┘
```

### Plan card contents

- Plan name (editable)
- Project count + member count
- Staffing progress bar (assigned days / total needed days across all projects)
- Creator name + last-edited timestamp
- Hover: "Open" CTA + "···" menu (rename, duplicate, delete, promote to baseline)

### "···" menu

- *Created by [Name]* — non-interactive label at top
- Rename
- Duplicate
- Promote to Baseline
- Delete

### Last-edited semantics

"Edited 2h ago" reflects the last edit by **any** user. Hover tooltip shows: *"Last edited by Sarah, Mar 16 at 14:32."*

### "Resume" banner

If a user has a recently-opened plan, a thin top banner persists:
> *"You were working on Q1 2026 · Plan A — [Continue Planning →]"*
Dismissable. Disappears once clicked.

---

## 3. New Plan Flow

A single-screen modal — not a multi-step wizard.

```
Start your plan
──────────────────────────────────────────────
○ Based on current data          ← default
  Copies your team, time-off, and 
  assignments as they are today.

○ Blank canvas
  Start fresh. No carry-over.

Plan name  [Q2 2026 — Plan B              ]

Notes (optional)
[                                          ]

              [Cancel]  [Create & Open →]
──────────────────────────────────────────────
```

**"Create & Open →"** creates the plan and immediately navigates to the Planning Board for that plan. No intermediate summary screen — the board itself shows what's in the plan.

**Color** is auto-assigned from the palette. Users can change it later via "···" on the plan card.

---

## 4. The Planning Board

### Top bar

```
Q1 2026 · Plan A  ✎     People | Projects     [Promote to Baseline]  [···]
```

- **Plan name** — inline editable (click to edit)
- **View toggle** — `People` | `Projects` (pill, left-aligned)
- **Promote to Baseline** — top-level action, not buried
- **···** — rename, duplicate, delete

There is no quarter selector in the top bar. Quarters are the **columns** of the grid — all visible at once.

---

### Left panel — Idea Backlog (collapsible, ~220px)

The demand queue. Ideas pulled from the **Jira IT Discovery Board** that are not yet committed to this plan.

```
IDEA BACKLOG                 ⟨ collapse
─────────────────────────
🔵 Portal Redesign
🔵 Data Warehouse Ph.2
🔵 Mobile App MVP
🔵 Pricing Engine
─────────────────────────
+ Add idea manually
```

- Ideas sync from Jira Discovery on load (same Jira API integration already in the app)
- Ideas already committed to the plan are hidden from the backlog
- Drag an idea onto a person row (People view) or it becomes a new project row (Projects view)
- "+ Add idea manually" creates a local idea not linked to Jira

---

### Center — Timeline Grid

The hero surface. A Gantt-style resource view at **quarter granularity**, inspired by hellotime's resource scheduling model.

Quarter columns span the full width. Each column represents one planning quarter. Rows are expandable — the parent row is the summary; child rows are the individual assignments.

---

#### People View — *"Is Alice overloaded?"*

Rows = team members. Child rows = their project assignments per quarter.

```
People  Projects         │  Q1 2026        │  Q2 2026        │  Q3 2026
─────────────────────────┼─────────────────┼─────────────────┼──────────────
∨ Alice C.    IT  38/45d │ ████████░░░░░░  │ ████░░░░░░░░░░  │ ░░░░░░░░░░░░
    Alpha Launch          │ ████████ 18d    │                 │
    Portal Redesign       │                 │ ████ 12d        │
    Time off              │ ░░ 4d           │                 │
    + Assign project      │                 │                 │
─────────────────────────┼─────────────────┼─────────────────┼──────────────
∨ Bob K.      IT  22/40d │ ███░░░░░░░░░░░  │ ██████░░░░░░░░  │ ░░░░░░░░░░░░
    Beta Rollout          │ ████ 10d        │ ██████ 14d      │
    + Assign project      │                 │                 │
─────────────────────────┼─────────────────┼─────────────────┼──────────────
> Sarah M.    BIZ  3/22d │ ░░░░░░░░░░░░░░  │ █░░░░░░░░░░░░░  │             
─────────────────────────┴─────────────────┴─────────────────┴──────────────
```

**Parent row (person):**
- Name + IT/BIZ badge
- Capacity bar showing used / available days for the **selected quarter** (hover shows the number)
- Click to expand/collapse

**Child rows (project assignments):**
- Project name
- Colored bar spanning the relevant quarter column, proportional to days assigned
- Bar label: days (e.g., "18d")
- Time off appears as a muted gray bar

**"+ Assign project"** — opens a search popover to find a project and enter days

---

#### Projects View — *"Is Alpha fully staffed?"*

Rows = projects in the plan. Child rows = people assigned per quarter.

```
People  Projects          │  Q1 2026        │  Q2 2026        │  Q3 2026
──────────────────────────┼─────────────────┼─────────────────┼──────────────
∨ Alpha Launch   23/30d   │                 │                 │
    Alice C.   IT         │ ████████ 18d    │                 │
    Bob K.     IT         │ █████ 12d       │                 │
    + Assign person       │                 │                 │
──────────────────────────┼─────────────────┼─────────────────┼──────────────
∨ Portal Redesign  8/25d  │                 │                 │
    Alice C.   IT         │                 │ ████ 12d        │
    + Assign person       │                 │                 │
──────────────────────────┼─────────────────┼─────────────────┼──────────────
> Beta Rollout   15/20d   │ (collapsed)     │                 │
──────────────────────────┴─────────────────┴─────────────────┴──────────────
```

**Parent row (project):**
- Project name
- Staffing bar: assigned / needed days
- Teal accent if sourced from an active Idea Board item; plain otherwise

**Child rows (person assignments):**
- Person name + IT/BIZ badge
- Colored bar in the relevant quarter column

**"+ Assign person"** — opens a search popover ranked by available days (reuses `scoreMember` logic)

---

### Bar interactions

| Action | Result |
|---|---|
| Click a bar | Inline edit for days — a small input appears on the bar. Enter to confirm, Escape to cancel. |
| Drag bar horizontally | Move assignment to a different quarter |
| Hover a bar | Tooltip: person name + project + days + quarter |
| Click bar × | Remove assignment (with undo toast) |

---

### Capacity signal — color system

Parent row capacity bars shift color as utilisation increases:

| Range | Color | Meaning |
|---|---|---|
| 0–69% | Green (`#22C55E`) | Healthy — has room |
| 70–89% | Amber (`#F97316`) | Near capacity |
| 90%+ | Red (`#EF4444`) | Overloaded |

Project staffing bars:

| Range | Color | Meaning |
|---|---|---|
| 0–49% | Red | Under-staffed |
| 50–89% | Amber | Partially staffed |
| 90–100% | Green | Fully staffed |

---

### Adding ideas from the backlog

Dragging an idea from the left panel:
- **In People view:** drop onto a person row → creates a new child assignment for that person. A popover asks: which quarter + how many days?
- **In Projects view:** drop anywhere in the grid → creates a new project row. Expands immediately with "+ Assign person" prompt.

---

## 5. What This Replaces

| Old | New |
|---|---|
| "Scenarios" nav item | "Planning" nav item |
| Scenarios page with Board tab | Planning Hub → Board as destination |
| "What if…" + "New Scenario" + "Create Scenario" (3 entry points) | Single "New Plan" entry point |
| Three-panel layout (Projects \| List of cards \| Team) | Gantt-style grid with expandable rows + timeline columns |
| Drag-from-sidebar-to-card-row interaction | Click-to-edit bars + drag-from-idea-backlog |
| No real time axis | Quarters as columns across the full width |
| SmartAssignmentPanel as bottom drawer | "+ Assign person/project" inline per row (uses same scoring logic) |
| Color picker during scenario creation | Auto-assigned color, changeable later |
| IT/BIZ as separate sections | IT/BIZ badge on person name; single flat list |

---

## 6. Out of Scope (this design)

- Week-level granularity (quarters are sufficient for portfolio planning)
- Mobile/touch mode
- Real-time collaborative editing (optimistic updates, last-write-wins is acceptable)
- PDF/export from the board (covered by separate executive report feature)
- AI-assisted staffing suggestions (future)

---

## 7. Open Questions

- What fields are available on Jira Discovery board items? (Status, estimated effort, quarter target?) — needs a spike against the Jira Product Discovery API before the backlog panel can be built.
- Should manually-created ideas sync back to Jira Discovery as new items, or stay local-only?
- When a plan is promoted to baseline, should it also push staffing assignments back into Jira (as custom fields or comments), or is baseline promotion app-internal only?
