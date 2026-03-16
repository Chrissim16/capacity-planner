# Capacity Planner — TODOS

> Deferred work items. Each item was explicitly considered and deferred — not forgotten.
> Format: What / Why / Pros / Cons / Context / Effort / Priority / Depends on

---

## TODO-001 — Cross-Quarter Drag on Planning Board

**What:** Allow users to drag a project card from one quarter column to another on the Planning Board, reassigning all its assignments to the new quarter in one gesture.

**Why:** Users doing annual capacity planning need to shift a project's timing without leaving the board. Currently they must edit assignments individually.

**Pros:**
- Removes the biggest friction point in annual planning sessions.
- Natural extension of the existing board interaction model — the mental model is already established.

**Cons:**
- Requires a multi-column board layout (all quarters visible simultaneously), which is a significant layout change from the current single-quarter-filter design.
- Needs a new `moveAssignmentsToQuarter(projectId, fromQuarter, toQuarter)` action in `stores/actions.ts`.
- Edge case complexity: what happens when the target quarter already has assignments for this project?

**Context:** Explicitly deferred in the US-062 design review (2026-03-16) as "too complex for v1." The single-quarter filter board ships first. This is the natural follow-on once that is stable. The board layout will need to shift from a single quarter view to a multi-column scrollable view (similar to a Kanban board by quarter).

**Effort:** L  
**Priority:** P2  
**Depends on:** US-062 (Planning Board) shipped and stable

---

## TODO-002 — BIZ Contact Assignment via Planning Board Drag

**What:** Add business contacts as draggable cards in the Planning Board's right panel, allowing BIZ stakeholders to be assigned to projects by drag-and-drop with the same UX as IT members.

**Why:** BIZ contacts currently have to be assigned via the Epics page inline form — the same UX problem the Planning Board solves for IT. Power users doing quarterly planning for both IT and BIZ tracks need a unified surface.

**Pros:**
- Completes the dual-track experience for the Planning Board.
- `scoreBusinessContact()` is already being built in this release (US-061) — it can directly power BIZ drag scoring.
- Follows the existing IT/BIZ visual split (blue / purple) already established across the app.

**Cons:**
- BIZ assignments use a different data model (`BusinessAssignment` vs `Assignment`) and different actions (`addBusinessAssignment`).
- The right panel will need a tab or toggle to switch between IT and BIZ member views to avoid visual overload.
- BIZ fit scoring is simpler (no skill matching) but the board UX needs to make this distinction clear.

**Context:** The US-062 design explicitly defers BIZ drag to keep v1 focused on the IT track. The `scoreBusinessContact()` function being built in US-061 is the foundation — once that's stable, this TODO is mostly a board UI change. The SmartAssignmentPanel's inline BIZ section already covers basic BIZ assignment from the board (without drag).

**Effort:** M  
**Priority:** P2  
**Depends on:** US-061 (SmartAssignmentPanel with BIZ section) + US-062 (Planning Board) both shipped

---

## TODO-003 — Quarterly Capacity Risk Report

**What:** A structured report (new page section or exportable view) that answers: "Which team members are overbooked next quarter? Which projects are under-staffed? What skill gaps exist across open work?"

**Why:** After the staffing engine (US-061) ships, the data to answer these questions exists — it just isn't surfaced in an aggregated, management-readable format. This is the highest-ROI output of the `staffing.ts` engine.

**Pros:**
- High value for IT managers and senior management: answers the quarterly "are we ok?" question in one view.
- Purely a presentation layer on top of data that already exists — `scoreMember()` across all projects × members × quarters produces the full picture.
- Exportable to XLSX (infrastructure already exists in `utils/importExport.ts`).

**Cons:**
- Requires a new layout/view, probably a sub-section of the Dashboard or a new Scenarios page section.
- Aggregating `scoreMember()` across all projects × all members × 4 quarters is O(projects × members × quarters) — memoization strategy needed.
- Needs UX design for the report layout.

**Context:** The staffing engine (us-061, shipping in Release 3) computes `MemberFit` per member per project per quarter. A reduce over all open projects and all active members produces: (a) overbooked members (fitLevel='over' on 1+ projects), (b) under-staffed projects (total assigned days < days needed), (c) skill gaps (aggregate `skillGap[]` per skill across all projects). This is Phase 2 of the "Scenario Intelligence & Reporting" release theme.

**Effort:** M  
**Priority:** P2  
**Depends on:** `utils/staffing.ts` engine from US-061

---

## TODO-004 — Skill Gap Analysis View

**What:** A compact view (Team page or Settings) showing which skills are most in demand across open projects but least available in the team — a prioritised list of hiring or training needs.

**Why:** `scoreMember()` already returns `skillGap[]` per member per project. Aggregating this across all open projects gives a frequency map: "React is missing on 6 projects, AWS on 4, PM on 2." This is a strategic HR planning artifact that currently exists nowhere.

**Pros:**
- Very small implementation effort — one `reduce()` over all `scoreMember()` results.
- High strategic value for headcount planning and L&D budgets.
- Could live as a small card on the Team page or as an export from the capacity risk report (TODO-003).

**Cons:**
- Only meaningful when the team has been fully tagged with `skillIds` (data quality dependency).
- May surface uncomfortable truths about team composition — requires thoughtful presentation.

**Context:** `scoreMember()` returns `skillGap: string[]` for each member-project pair (skill names that are required by the project but not present on the member). A frequency map across all `good`+`partial` members on all open projects gives a sorted list of skill bottlenecks. This is a natural companion to TODO-003.

**Effort:** S  
**Priority:** P3  
**Depends on:** `utils/staffing.ts` engine from US-061; benefits from TODO-003 infrastructure

---

## TODO-005 — Contextual Wizard Entry from Existing Project

**What:** Add a "What if I add more people to this project?" entry point on the Projects page (or Epics page) that launches the ScenarioWizard pre-populated with the selected project's name, skills, and existing quarter allocations.

**Why:** The current wizard is designed for new projects only. A common planning question is: "My existing project is under-staffed — what if I add Alice?" Pre-populating the wizard from an existing project removes the friction of re-entering all the details.

**Pros:**
- Delightful UX: "It pulled in my project's skills automatically."
- Reuses the existing wizard with only a `defaultValues` prop addition.
- Skill IDs can be inferred from existing phase assignments or from `project.requiredSkillIds` if that field exists.

**Cons:**
- Requires an optional `projectId` prop on `ScenarioWizard` plus logic to pre-populate `name`, `skillIds`, and `quarters` from the project data.
- The wizard creates a *new* project entity in the scenario — it doesn't modify the existing project. This semantic needs to be clearly explained to the user in Step 1: "This creates a new what-if project based on [Project Name]."

**Context:** Identified as a delight opportunity during the 2026-03-16 plan review. The wizard as shipped (US-060) does not accept a `projectId` prop. This would be added as a follow-on. The wizard's Step 1 "Base on" toggle (baseline vs active scenario) is already being built — this TODO adds a complementary "Project template" concept.

**Effort:** S  
**Priority:** P3  
**Depends on:** US-060 (ScenarioWizard) shipped
