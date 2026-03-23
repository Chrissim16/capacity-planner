# Feature Ideation Notes

**Date:** 2026-03-16  
**Status:** Raw ideation — not scoped, not committed  
**Purpose:** Capture and structure feature thinking for the Capacity Planner

---

## 1. The "Why" — North Star

Every feature must be judged against the core problem this app exists to solve.

### Why am I building this?

The app creates **shared understanding between business and IT about capacity** — making the invisible visible.

### The pain it addresses


| Pain                                                                    | How the app helps                                                                                                                              |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| People work on too many things simultaneously, but **it's not visible** | The app surfaces overallocation in real time — dashboard heatmaps, capacity bars, per-person utilisation                                       |
| Business never has time for testing                                     | When capacity is visible, teams can plan testing time as a first-class allocation — not an afterthought squeezed into gaps                     |
| Teams take on too many tasks at the same time                           | The staffing engine (`scoreMember`, `atMaxProjects`) makes concurrent load explicit and warns before it happens                                |
| People are afraid to say no because everything is a priority            | The app gives an objective, data-backed answer: "We can't — here's the capacity picture." It turns a political conversation into a factual one |


### The filter for every new feature

> "Does this feature make overallocation more visible, or make it easier to plan around it?"
>
> If the answer is no, park it.

---

## 2. What makes this app unique?

Not a generic project management tool. Not a timesheet. The unique proposition:

- **Jira-native capacity** — pulls real work from Jira and maps it against real people with real availability (time-off, BAU, concurrent project limits)
- **Dual-track IT + BIZ** — capacity planning for both IT delivery and business stakeholders in one surface
- **Scenario-based what-if planning** — isolated sandboxes to answer "what happens if…" without touching live data
- **The bridge between business and IT** — not built for developers, not built for PMO alone — built for the conversation between them

---

## 3. Feature Ideas

### 3.1 Scenario Creation — Narrative Wizard

**Core idea:** Ask the app "What happens if we have another project coming in?" and it triggers a guided, narrative-driven flow that determines scope.

**UX vision:**

- Typeform / Sana-style — one question per screen, warm and friendly
- Scandinavian minimalism — soft backgrounds, generous whitespace, warm tones
- Each screen is a question → the user answers → the output flows into the next question
- The wizard feels like a conversation, not a form

**Two flavours of scenario creation:**


| Flavour            | Trigger question                    | Output                                                                                          |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| New project intake | "What if we have a new project?"    | Creates a scenario with a new project, staffing suggestions, and an impact summary              |
| Resource matching  | "Who can I assign to this project?" | Given capacity + skills + level, surfaces the best-fit team members and shows the ripple effect |


**Open question:** What is the final output of the wizard? A scenario? A shareable summary? A PDF? A decision-ready artefact for a steering committee?

**Status:** Design document exists — see `2026-03-13-smart-staffing-planning-board-design.md` (US-060). The narrative wizard with 5 steps, `useReducer` state, and "Base on" toggle is designed and approved. The resource-matching flavour is covered by the SmartAssignmentPanel (US-061).

---

### 3.2 Drag & Drop Planning Board

**Core idea:** A visual planning surface where you drag a person onto a project card and instantly see the capacity impact — like fitting puzzle pieces together.

**How it works:**

- Project cards show capacity needed + skills required
- Team member cards show available capacity + skills
- Drag a person onto a project → the app checks for a match (capacity, skills, level) and shows the result
- Capacity bars animate in real time as you move people around
- Intentional overbooking is allowed but flagged visually

**The puzzle metaphor:** Each project is a slot with a shape (skills + days). Each person is a piece with a shape (skills + availability). The board shows whether the pieces fit — and what breaks if you force them.

**Status:** Designed — see `2026-03-13-smart-staffing-planning-board-design.md` (US-062). Uses `@dnd-kit/core`, precomputed fit scores on drag start, days-input popover on drop. RBAC-gated for read-only users.

---

### 3.3 Report Generation — PDF / Executive Summary

**Core idea:** Senior management needs a single artefact that answers: **What** is being delivered, **who** is delivering it, and **when** can we do it?

**Target audience:** Senior management, steering committees, portfolio boards.

**What they need to see:**

- Overview of all active projects and their delivery timeline
- Who is assigned where — and whether the staffing is realistic
- Capacity risks: who is overbooked, which projects are under-staffed
- A clear, honest answer to "can we deliver all of this?"

**Possible formats:**

- In-app report view (filterable, interactive)
- PDF export (for email distribution, steering committee packs)
- Slide-ready summary (one-page overview)

**Open questions:**

- What level of detail? Epic-level? Feature-level? Person-level?
- Should the report be scenario-aware (show baseline vs. what-if)?
- How often is it generated — on demand, weekly, per planning cycle?

**Related TODOs:** TODO-003 (Quarterly Capacity Risk Report) covers the data layer. This feature idea extends it with a polished, exportable presentation layer.

---

### 3.4 AI Integration

**Core question:** Is AI needed? What's the actual use case?

**Possible use cases (to be validated):**


| Use case                    | What AI does                                                                                             | Value                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Narrative report generation | Given capacity data, generate a human-readable status summary for management                             | Saves 30 min of manual writing per report cycle      |
| Staffing recommendations    | "Based on past projects with similar skill profiles, here's who tends to work well on this type of work" | Requires historical data the app doesn't yet have    |
| Risk prediction             | "Based on current allocation trends, Q3 is going to be a problem for the backend team"                   | Could be done with simple rules — AI may be overkill |
| Natural language queries    | "Show me everyone who is overbooked in Q2"                                                               | Nice UX but search/filter already covers this        |


**Honest assessment:** The strongest near-term AI use case is **narrative report generation** — turning structured capacity data into a readable management summary. The other use cases either need more data (recommendations) or can be done with simpler logic (risk, queries).

**Status:** Listed as "AI Status Report Export — Planned" in the changelog. No design document yet.

---

### 3.5 Radical UX Exploration

**Provocation:** How would a radically different capacity planner look?


| Concept                | Description                                                                                                        | Would it work?                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Tinder-style swipe** | Swipe right to assign a person to a project, swipe left to skip. Cards show fit score, skills, availability.       | Fun for quick assignment decisions. Falls apart for bulk planning. Could work as a mobile "triage" mode for a single project. |
| **Puzzle board**       | Visual jigsaw where project slots and people are literal puzzle pieces with matching shapes.                       | Strong metaphor for the "fit" concept. Could be a playful onboarding/demo mode. Too gimmicky for daily use.                   |
| **Timeline-first**     | Instead of project cards, everything is a timeline. Drag people onto time slots. Like a calendar app for capacity. | Already partially built (Timeline view). Could be extended into the primary planning interface.                               |
| **Chat-based**         | "Hey app, who can take on Project X?" — conversational interface that surfaces data through dialogue.              | Elegant for simple queries. Terrible for complex planning that needs spatial overview.                                        |
| **Heat map grid**      | People × Quarters grid. Each cell is coloured by utilisation. Click a cell to assign.                              | Dense but scannable. Good for the "big picture" view. Already partially exists in the Dashboard.                              |


**Takeaway:** The Sana-style warm minimalism + narrative wizard + visual drag board is already a strong, differentiated UX. Radical departures are worth exploring as secondary modes (mobile triage swipe, chat query) but the core planning experience benefits from spatial overview and direct manipulation.

---

## 4. UX Philosophy

> **User experience is the key.**

### Design principles for this app

1. **Warm, not corporate** — Sana-style Scandinavian minimalism. Soft backgrounds, generous spacing, friendly tone. The app should feel like a helpful colleague, not an enterprise tool.
2. **One thing per screen** — For wizard flows, each question gets its own screen. Don't overwhelm. Let the user focus.
3. **Show, don't tell** — Capacity bars, colour-coded fit badges, animated transitions. The app should make the answer visible before the user has to read a number.
4. **Honest about constraints** — When the team is overbooked, say so clearly. The app's value is truth-telling, not hiding problems.
5. **Fast feedback loops** — Drag a person → see the impact instantly. Change a scenario → see the difference immediately. No save-and-refresh cycles.

---

## 5. Priority Map

Based on the "why" filter and current app state:


| Priority            | Feature                          | Reason                                                   |
| ------------------- | -------------------------------- | -------------------------------------------------------- |
| **Now** (in design) | Scenario Wizard (US-060)         | Directly answers "what if?" — core value prop            |
| **Now** (in design) | Smart Assignment Panel (US-061)  | Makes "who can take this on?" answerable                 |
| **Now** (in design) | Planning Board (US-062)          | Visual bulk planning — the puzzle metaphor               |
| **Next**            | Executive Report / PDF           | Makes capacity truth shareable with decision-makers      |
| **Next**            | Quarterly Risk Report (TODO-003) | Data layer for the executive report                      |
| **Later**           | AI narrative generation          | Enhances report creation but needs the report view first |
| **Explore**         | Radical UX modes                 | Fun to prototype, not core value                         |


---

## 6. Open Questions

- What is the final output of the Scenario Wizard — a scenario only, or a shareable artefact?
- What does the executive PDF report contain at minimum viable level?
- Is AI report generation worth building before the manual report view exists?
- Should the drag & drop board support a mobile/tablet touch mode?
- How do we measure whether the app is actually reducing overallocation in practice?

