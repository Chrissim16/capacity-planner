# Mileway IT Capacity Planner — Release Backlog

> **Last updated:** March 2026  
> This document tracks the release history and forward-looking backlog for the Capacity Planner. It is forward-facing — completed feature detail lives in [`docs/legacy/FEATURE-TRACKER.md`](legacy/FEATURE-TRACKER.md). Implementation plans live in [`docs/plans/`](plans/).

---

## Release 1 — Foundation & Feature Buildout *(shipped)*

All core functionality: Supabase persistence, Jira two-way sync, capacity calculation engine, scenario system, Gantt visualisation, dual-track IT/BIZ model, smart assignment suggestions, holiday API, and 53 user stories across P0–P3 and Phase 2 feature groups.

See [`docs/legacy/FEATURE-TRACKER.md`](legacy/FEATURE-TRACKER.md) for the complete record of all US-001–US-058 items.

---

## Release 2 — UI Redesign *(shipped)*

Full design system overhaul: collapsible navy sidebar, Mileway brand tokens (`mw-blue`, `mw-purple`, surface tokens), Plus Jakarta Sans typography, updated card/badge/chart components, and a navy-based dark mode palette across all views.

---

## Release 3 — Scenario Intelligence & Reporting *(in progress)*

Focused on making capacity constraints more visible, more actionable, and easier to communicate — to both the IT team and senior management.

| ID | Feature | Type | Status | Notes |
|---|---|---|---|---|
| US-060 | Narrative Scenario Wizard | UX/UI | Planned | Typeform-style 5-step wizard ("What if we add a project?"). Entry point on Scenarios page + contextual nudge on Dashboard when 2+ members are at high utilisation or over capacity. Creates a real scenario on Step 5 with an impact summary before exit. Design: [`docs/plans/2026-03-13-narrative-scenario-wizard-design.md`](plans/) |
| US-061 | Smart Assignment Panel (Resource Matching) | UX/UI | Backlog | Replace the assignment modal with a smart "Staff this project" slide-out panel. Ranks team members by fit score: available capacity for the project's quarter(s) + skill match + concurrent project count. Each member gets a green/amber/red fit badge with remaining capacity displayed. One-click assign with inline days input. Also surfaced as a step inside the US-060 Scenario Wizard ("who can staff this?"). No new libraries required. |

---

## Release 4 — Planning Board *(planned)*

Focused on making bulk assignment planning fast and visual — drag-and-drop staffing with live capacity feedback, always inside the safety of a scenario.

| ID | Feature | Type | Status | Notes |
|---|---|---|---|---|
| US-062 | Scenario-Native Planning Board | UX/UI | Backlog | "Board" sub-mode tab on the Scenarios page, active when a scenario is open. Left panel: project cards grouped by quarter. Right panel: team members with live capacity bars. Drag a person onto a project card → lightweight popover asks for days → assignment created instantly with capacity bars updating live. Skill match badge shown on each member card when a project is selected. Resource Matching sidebar (from US-061) persistent on project selection. Requires `@dnd-kit/core`. All changes are scenario-scoped; promote to baseline when done. |
