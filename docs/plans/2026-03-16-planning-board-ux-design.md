# US-062 Planning Board — UX Design Addendum

**Date:** 2026-03-16  
**Status:** Approved — supplements the layout and interaction spec in `2026-03-13-smart-staffing-planning-board-design.md`  
**Scope:** Visual design, layout, interaction model, and aesthetic direction for the Scenario-Native Planning Board

---

## Design Philosophy

The Planning Board is a **thinking tool**, not a data entry form. Users come here to explore scenarios — "What happens if another initiative starts?" and "Which people should go on which projects?" — not to fill out a spreadsheet.

Every design decision follows from three principles:

1. **Serene by default, informative on demand.** The resting state is calm and minimal. Detail surfaces through interaction (hover, click, drag), not through always-visible density.
2. **One focal point at a time.** The user's eye should know where to go. No competing panels of equal visual weight.
3. **If it doesn't need to be there, it shouldn't be.** Every element must earn its pixels.

---

## Layout — Three-Panel, Timeline-Centric

The board uses a three-panel layout, but the center timeline is the **hero**. The sidebars are quiet supporting surfaces.

```
┌──────────┐  ┌─────────────────────────────────────┐  ┌──────────┐
│ PROJECTS │  │                                     │  │   TEAM   │
│  ~180px  │  │        TIMELINE  (hero)             │  │  ~180px  │
│  quiet   │  │        takes remaining width        │  │  quiet   │
│          │  │                                     │  │          │
└──────────┘  └─────────────────────────────────────┘  └──────────┘
```

### Panel separation

No hard borders between panels. Separation is achieved through **whitespace gaps** (16–20px) only. No vertical divider lines, no background color differences between panels.

### Sidebars

- Visually recessive: lighter text weight, smaller type, no card borders on items
- Collapsible via a small chevron — collapsing a sidebar gives the timeline more room
- Content is minimal (see below)

### Top bar

Minimal horizontal strip:
- Left: "Planning Board" in serif heading font (Source Serif 4)
- Center: view toggle pill — "By Person" | "By Project"
- Right: quarter selector dropdown, scenario name in muted text

---

## View Toggle — "By Person" and "By Project"

A small pill toggle in the top bar switches the timeline's row axis. Both views share the same aesthetic and interaction model.

| View | Rows | Use case |
|---|---|---|
| By Project | Each row is a project. Assigned people shown as blocks within. | "Is Alpha fully staffed?" — project-first thinking |
| By Person | Each row is a team member. Assigned projects shown as blocks within. | "Is Alice overloaded?" — people-first thinking |

The toggle is unobtrusive — two text labels in a soft pill. The active option has a teal underline. No loud button styling.

---

## "By Project" View — Detail

### Expanded vs collapsed rows

- **One project is expanded at a time** (the selected project). Clicking a project in the left sidebar or clicking its row in the timeline expands it.
- **Expanded row:** Shows each assigned person as an individual row with an assignment block spanning the relevant quarters. Takes more vertical space. The project name is prominent. A staffing summary sits right-aligned: "23 / 30d staffed."
- **Collapsed rows:** Show a compact summary — clustered small avatars in the relevant quarter columns with a count whisper: "4 assigned." A small chevron indicates expandability.

This creates a natural focal hierarchy — the expanded project draws the eye, collapsed projects are scannable context.

### Assignment blocks

All assignment blocks are the **same neutral color** — a soft warm gray (`sana-bg-secondary` / `#F5F3F0`) with a slightly darker border. The timeline is monochromatic at rest.

- No color-coding by project, priority, or track (IT/BIZ)
- Blocks are rounded rectangles (12px radius), generously padded
- Each block shows the assigned days as a small centered label: "10d"
- Generous row spacing between people within an expanded project (20px gaps)

### Capacity whisper lines

Hair-thin (2px) horizontal lines below each assignment block showing utilisation. Colored green (healthy), amber (near capacity), or red (over). These are **barely visible** — the user notices them peripherally but they don't dominate.

Open question for implementation: consider making these visible only on hover for maximum serenity. Test both approaches.

---

## IT / Business Distinction

The IT vs Business distinction is **not** a structural division of the layout. There are no "IT Team" / "Business Contacts" section headers. There is no color-coding of assignment blocks by track.

The distinction lives **solely on the person's badge**:

- A tiny text label next to the person's name: `IT` in muted teal (#0ED3CF, ~10px) or `BIZ` in muted purple (#A78BFA, ~10px)
- The same badge appears in the right sidebar team list
- People are listed in a single flat list per project, sorted by available days (not grouped by track)

This keeps the timeline visually unified and reduces color noise.

---

## Left Sidebar — Projects

Minimal floating cards, one per project in the active scenario for the selected quarter:

- White background, very subtle shadow, 16px rounded corners
- Thin 3px left accent line (teal for the selected project, warm gray for others)
- Content: project name only. No priority badges, no metadata, no progress bars.
- Selected state: faint teal background tint (`sana-bg-highlight`)
- Click to expand that project's row in the center timeline

---

## Right Sidebar — Team

A single mixed list of all active team members (IT and Business together, not grouped):

- Small avatar circle (28px), name, tiny IT/BIZ badge, available days in muted gray ("14d free")
- No capacity bars, no skill badges, no fit scores at rest
- Sorted by available days descending (most available at top)
- Generous vertical spacing between entries
- Draggable — each entry can be dragged onto a project row in the timeline

---

## Drag & Drop Interaction

### Resting state

The board is calm. No fit colors, no drag handles visible. The sidebars are quiet.

### On drag start (picking up a person from the right sidebar)

- The dragged person becomes a floating card with subtle elevation shadow, slightly rotated (2°), showing avatar + name + available days
- The original position shows a ghost placeholder (dashed outline, faint)
- In the timeline, project rows receive **soft glow borders** indicating fit:
  - Good fit: soft teal glow (`sana-teal` at low opacity)
  - Partial fit: soft amber glow
  - Over capacity: soft red glow
- These glow borders are computed once on drag start (precomputed `dragScores` per the existing spec). Not recomputed on every drag-over event.
- Non-relevant rows dim slightly (95% opacity) to focus attention

### On hover over a project row

- The glow border intensifies slightly on the hovered row
- A small tooltip floats near the cursor: "Alice Chen → Alpha Launch · Q2"

### On drop

- Glow borders clear
- A lightweight popover appears anchored to the project row: "How many days?" with a pre-filled number input (min 1, default `Math.min(5, availableDays)`)
- Confirm → assignment created, capacity bar animates (CSS `transition: width 300ms ease`)
- Escape / click-away → cancel, no mutation

### Key principle

**Fit colors are transient.** They appear during drag to guide the decision, then disappear. The resting board stays monochromatic and serene.

---

## Color Palette (Board-Specific)

| Element | Color | Token |
|---|---|---|
| Page background | `#FAF9F7` | `sana-bg` |
| Assignment blocks (all) | `#F5F3F0` | `sana-bg-secondary` |
| Assignment block border | `#E5E5E3` | `sana-border` |
| Selected project accent | `#0ED3CF` | `sana-teal` |
| IT badge text | `#0ED3CF` | `sana-teal` |
| BIZ badge text | `#A78BFA` | — (add as `sana-purple` or use Tailwind `violet-400`) |
| Capacity line — healthy | `#22C55E` | `util-healthy` |
| Capacity line — near | `#F97316` | `util-near` |
| Capacity line — over | `#EF4444` | `util-over` |
| Drag fit glow — good | `#0ED3CF` at 20% opacity | — |
| Drag fit glow — partial | `#F97316` at 20% opacity | — |
| Drag fit glow — over | `#EF4444` at 20% opacity | — |
| Muted text | `#9CA3AF` | `sana-text-faint` |
| Primary text | `#1A1A1A` | `sana-text` |

No other colors on the board. Four accent tones total: teal, purple (badge only), amber, red. Everything else is grayscale on warm white.

---

## Spacing & Sizing

| Element | Value |
|---|---|
| Sidebar width | 180px (collapsible) |
| Gap between panels | 16–20px (whitespace, no borders) |
| Project row height (collapsed) | 48px |
| Project row height (expanded, per person) | 56px per person row + 20px gaps |
| Assignment block height | 32px |
| Assignment block border-radius | 12px |
| Avatar size (timeline) | 28px |
| Avatar size (sidebar) | 28px |
| IT/BIZ badge font size | 10px, font-semibold, tracking-wide |
| Quarter column headers | 14px, muted gray |

---

## Typography

| Element | Style |
|---|---|
| "Planning Board" heading | Source Serif 4, 28px, font-bold |
| View toggle labels | DM Sans, 14px, font-medium |
| Project name (expanded row) | DM Sans, 16px, font-semibold |
| Project name (collapsed row) | DM Sans, 14px, font-medium |
| Person name (timeline) | DM Sans, 13px, font-medium |
| Days label on block | DM Sans, 12px, font-normal |
| Staffing summary | DM Sans, 12px, font-normal, muted gray |
| Sidebar section header | DM Sans, 11px, font-semibold, uppercase, tracking-widest, muted gray |

---

## What This Addendum Changes from the Original Spec

| Original spec (2026-03-13) | This addendum |
|---|---|
| Three-panel: projects left, team right, SmartAssignmentPanel bottom | Three-panel: projects left, **timeline center (hero)**, team right. SmartAssignmentPanel triggered on demand, not always visible. |
| Projects and team panels have equal visual weight | Sidebars are visually recessive; timeline dominates |
| IT Team and Business Contacts as separate collapsible sections | Single flat list; IT/BIZ distinction via tiny badge on person only |
| Fit badges (green/amber/red) always visible on member rows | Fit colors appear **only during drag**; resting state is neutral |
| Mini capacity bars on member rows | Hair-thin capacity whisper lines; bars removed from sidebar |
| Single view (projects left, team right) | Toggle: "By Person" / "By Project" row axis |
| No expanded/collapsed row concept | Expanded row for selected project; collapsed rows show avatar clusters |
| Dense information display | Progressive disclosure — detail on interaction, not by default |

The functional requirements (drag-and-drop, `@dnd-kit/core`, RBAC gating, mutation path via `addAssignment()`, precomputed `dragScores`, days popover) remain unchanged from the original spec. This addendum addresses only the visual and interaction design.

---

## Mockups

Reference mockups generated during this brainstorm session (stored in `/assets/`):

- `planning-board-overview-resting-state.png` — early exploration: floating cards concept
- `planning-board-three-panel-serene.png` — "By Person" view, three-panel resting state
- `planning-board-drag-interaction.png` — drag interaction with fit glow borders
- `planning-board-by-project-view.png` — "By Project" view with IT/BIZ sections (superseded)
- `planning-board-project-detail-expanded.png` — expanded project detail (superseded)
- `planning-board-by-project-unified.png` — **final direction**: unified list, IT/BIZ badge only, monochromatic blocks
