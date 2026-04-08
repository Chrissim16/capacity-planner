# Delivery Planning - PM Brainstorm & Design Direction

**Date:** 2026-04-05
**Status:** Brainstorm / Not yet scoped for implementation

---

## Context

Pain points identified (all three simultaneously):

1. **No clear starting point** — landing on the page is overwhelming or blank
2. **Capacity is invisible** — can't easily see whether the team can deliver what's planned
3. **Too disconnected from portfolio** — portfolio says one thing; delivery is a separate world

Primary user: IT delivery lead / PM.
Bold UX rethinking is welcome.

---

## What the Current App Does

- Sprint-based Gantt-style timeline with drag-drop
- Jira import: Epic → Feature → Story hierarchy
- Scenario-scoped planner items (manual + Jira-backed)
- IT + BIZ assignment model per sprint
- Capacity tracking components exist but feel secondary
- No clear entry workflow or guided starting point
- Portfolio Planning and Delivery Planning share scenario state but feel visually disconnected

---

## Competitor Research Insights

### The universal failure mode across all tools

The "portfolio-reality gap" — roadmaps get approved without checking actual team capacity. Nobody notices until mid-quarter. Then it's firefighting.

### What the best tools do well

| Pattern | Tool | Why It Works |
|---|---|---|
| Capacity as hero metric | Craft.io, Dragonboat | Forces honesty about what's actually possible |
| Timeline + swimlanes | Roadmunk, Planyway | Makes parallel workstreams and overallocation visible |
| "Ready to schedule" vs "On roadmap" split | Jira Align | Clear funnel from portfolio intent to sprint reality |
| Multi-view architecture | Aha!, Craft.io | Same data, different lenses for different audiences |
| Real-time bidirectional sync | Craft.io | Reduces dual-system maintenance tax |
| OKR → Initiative → Epic cascade | Dragonboat | Connects "why" to "what" and "when" |

### What no tool does well
- Making the jump from portfolio-level approval to sprint-level scheduling feel easy
- Showing the delivery PM what to do *first* when they sit down to plan a quarter

---

## The Core Insight

> The current delivery planning page is a *blank canvas*. Delivery PMs don't want a blank canvas — they want a *starting position*.

A delivery PM starting their quarter wants to answer three questions in sequence:
1. **What am I committed to?** (Portfolio said we'd do X, Y, Z this quarter)
2. **What's actually ready to schedule?** (Does X have Jira breakdown? Is Y estimated?)
3. **Can the team fit it all?** (Do we have enough sprint capacity to absorb it?)

The app doesn't currently guide them through this flow. It dumps them into a Gantt.

---

## Bold Design Directions

### Direction 1: "Quarter Commit" Entry Flow ⭐ (Biggest Impact)

Replace the blank Gantt entry with a structured starting point:

**Step 1 — "Your Portfolio Commitments"**
- On entering Delivery Planning, show a panel: "Portfolio approved these epics for Q2 2026"
- Each epic shows: name, estimated days (from portfolio phase plan), breakdown status (has Jira features? stories?)
- User sees immediately: what they've committed to deliver and what's actually ready

**Step 2 — "Readiness Check"**
- Each epic gets a readiness signal:
  - ✅ Has Jira breakdown + estimates = ready to schedule
  - ⚠️ Has Jira features but no stories = needs breakdown
  - ❌ No Jira items linked yet = not ready
- Clear "what needs attention before scheduling"

**Step 3 — "Schedule it"**
- From the readiness view, user clicks "Schedule" on a ready epic → it drops into the sprint timeline
- Smart default placement: respects capacity, respects dependencies

**Bold shift:** Make the entry point the Portfolio handoff, not the Gantt.

---

### Direction 2: Capacity as Hero Metric (High Value, Lower Risk)

Currently, capacity is a secondary panel. Flip the visual hierarchy:

**Sprint-by-sprint capacity bar always visible at the top of the timeline**

```
Sprint 1 (Apr 7-18)     Sprint 2 (Apr 21-May 2)   Sprint 3 (May 5-16)
[████████░░] 78% used   [█████████░] 90% used      [████░░░░░░] 40% used
```

- Color-coded: green (<75%), amber (75-90%), red (>90%)
- Click a sprint bar → shows breakdown by person and initiative
- Overallocation is visible at a glance, not buried in assignment panels

**Bold shift:** The sprint capacity bar becomes the first thing you see, not the last thing you check.

---

### Direction 3: Two-Pane Split — "Committed" vs "Backlog"

Currently, all items exist in one flat timeline/backlog. The mental model is unclear.

**Replace with explicit two-zone model:**

**Left zone: "This Quarter's Commitment"**
- Epics/features committed to Q2 (pulled from portfolio plan)
- Allocated to specific sprints
- Capacity tracked against team availability
- These are HARD commitments — visible to stakeholders

**Right zone: "Sprint Backlog"**
- Features/stories not yet committed to a sprint
- Sortable by: priority, effort estimate, dependencies
- User drags items LEFT to commit them to a sprint (respects capacity)
- If capacity is full, the sprint bar turns red — visible constraint

**Bold shift:** Committing to a sprint becomes a *deliberate action* with visible consequences, not just moving a Gantt bar.

---

### Direction 4: "Current Sprint Focus" View (Operational Mode)

The current design is optimized for *quarterly planning*. But delivery leads also need a daily operational view.

**Add a "This Sprint" view (separate tab or toggle):**
- Shows only the current sprint
- Shows: what's assigned, to whom, % complete (from Jira status)
- Shows: what's blocked, what's at risk
- Shows: what's coming in next sprint (preview)

This serves the same user in operational mode (daily standup, mid-sprint check) not just planning mode.

**Bold shift:** Same data, operational lens — turns the tool from "quarterly planning artifact" to "weekly delivery tool."

---

### Direction 5: Replace Hierarchy-First with Initiative-First View

Current Gantt shows: Epic → Feature → Story as the primary axis.

This is a Jira hierarchy view, not a delivery plan view.

**Alternative: Initiative (Epic) as the primary row, everything else collapsed by default**

- Top row: Epic name, total effort, % delivered (based on story status), assigned team leads
- Expand epic → shows features with sprint assignments
- Expand feature → shows stories (only when needed)

This is how Roadmunk and Jira Plans organize things. The PM sees epics first, digs into details only when needed.

**Bold shift:** Epic-first, story-last. Reduce cognitive load by hiding detail by default.

---

### Direction 6: Portfolio ↔ Delivery Carryover Signal

When an epic was planned in Portfolio as "Design in Q1, Build in Q2" — and Q2 starts — the delivery plan should show:

- The Portfolio phase plan as a reference timeline at the top
- The current Jira/delivery actuals below
- A gap indicator if delivery is behind the portfolio plan

The "two lenses of one system" idea — but made **visually explicit**, not just philosophically aligned.

**Bold shift:** Portfolio plan becomes a reference anchor visible inside Delivery Planning.

---

## Recommended Priority Order

### Phase 1 — Fix the entry problem (highest impact on "where do I start?")

**Build a "Quarter Setup" panel** that appears when delivery planning has no items scheduled yet, or at the start of each quarter:
- Shows portfolio-committed epics for the active quarter
- Shows readiness check (has breakdown? has estimates?)
- One-click "Pull into delivery plan" action per epic

This directly addresses the "no starting point" pain without rebuilding the entire Gantt.

### Phase 2 — Make capacity visible everywhere

**Sprint capacity bar as persistent header** above the timeline:
- Each sprint shows used/available days as a progress bar
- Color threshold: green/amber/red
- Clicking a sprint shows member-level breakdown

### Phase 3 — Portfolio reference panel in Delivery Planning

**Add a collapsible "Portfolio Commitment" sidebar:**
- Shows the portfolio phase plan for the active quarter's epics
- Shows current delivery progress vs portfolio expectations
- Highlights carryover items (planned for prior quarter but not completed)

### Phase 4 (longer-term) — Consider replacing the Gantt entry point

The boldest move: replace the Gantt as the primary delivery planning UI with a **Sprint Board + Capacity** view.

Reserve this for after Phases 1-3 are validated.

---

## Open Questions to Validate Before Building

1. Does the IT delivery PM actually start from portfolio commitments? Or do they start from the Jira backlog?
2. Is "quarter" the right planning horizon, or do they plan sprint-by-sprint throughout the quarter?
3. Who sees the delivery plan besides the PM — is there a stakeholder audience?
4. Is the current assignment model (IT/BIZ with days-per-sprint) actually used, or is it seen as overhead?

---

## Files That Will Change (Phases 1-3)

- `frontend/src/pages/ScenarioPlanner.tsx` — entry point and layout
- `frontend/src/components/planner/PlannerTimeline.tsx` — capacity bar addition
- `frontend/src/components/planner/PlannerBacklog.tsx` — readiness signals
- `frontend/src/components/planning/PlanningLensHeader.tsx` — portfolio reference
- New: `frontend/src/components/planner/QuarterSetupPanel.tsx` — portfolio handoff entry
- New: `frontend/src/components/planner/SprintCapacityBar.tsx` — capacity header
- New: `frontend/src/components/planner/PortfolioReferencePanel.tsx` — portfolio anchor
