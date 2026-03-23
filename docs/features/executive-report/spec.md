# Executive Report — Spec
**Date:** 2026-03-23  
**Status:** Approved — ready for implementation planning  
**Audience:** Project Managers generating shareable capacity summaries for steering committees, portfolio boards, and ad-hoc stakeholder requests

---

## Why This Exists

Project Managers need a single, printable artefact that answers three questions for senior stakeholders:
1. What are we delivering and when?
2. Are there capacity risks we should know about?
3. How utilised is each process team?

Currently this requires manually exporting data from multiple views. The Executive Report assembles it automatically from the active scenario.

---

## Scope

- Shows data from the **currently selected scenario** (baseline or any what-if plan)
- Scoped to the **selected quarter range** (quarter picker in the header)
- **AI narrative section is out of scope** for this release — it will be added as a follow-on phase once the report is stable

---

## Navigation

A dedicated **Report** page added to the sidebar between Scenario Planner and Settings:

```
Capacity | Timeline | Epics | Team | Scenario Planner | Report | Settings
```

- Icon: `FileBarChart` from `lucide-react`
- Route: `/report`
- Access: same RBAC as all other pages (no extra gate at MVP)

**Files to update:**
- `frontend/src/components/layout/Sidebar.tsx` — add `report` to `navItems`
- `frontend/src/App.tsx` — add `report` to `ViewType`, `VIEW_TO_PATH`, `PATH_TO_VIEW`, `pages`
- `frontend/src/types/index.ts` — add `'report'` to `ViewType` union

---

## Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Executive Report         [Baseline ▾]  [Q1 2026 ▾]  [Export PDF]│
├──────────────────────────────────────────────────────────────────┤
│  DELIVERY TIMELINE                                               │
│  [ReportGantt — read-only CSS bars per epic across quarters]     │
│                                                                  │
│  Epic name         │ Status  │ Q1    │ Q2    │ Assigned to       │
│  Alpha Launch      │ Active  │ ████  │ ██    │ Alice, Bob        │
│  Portal Redesign   │ At Risk │       │ ████  │ (none) ⚠          │
├──────────────────────────────────────────────────────────────────┤
│  CAPACITY RISKS                        3 risks flagged           │
│  🔴 Bob K. — overbooked 118% in Sprint 7 (Q1)                   │
│  🟠 Portal Redesign — no team members assigned                   │
│  🟠 Alpha Launch — assigned days (8) < story points (21)         │
├──────────────────────────────────────────────────────────────────┤
│  CAPACITY BY PROCESS TEAM                                        │
│  [ProcessTeamCapacityTable — reused as-is]                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Section 1 — Delivery Timeline

### ReportGantt component

A lightweight, **non-interactive** Gantt showing one row per epic. Built with pure CSS/Tailwind — no DnD context, no Zustand subscriptions. Receives all data as props.

**Visual design:**
- Column headers: quarter labels (Q1 2026, Q2 2026, …) matching the selected range
- Each epic row: name on the left, coloured bar spanning its `startSprint` → `startSprint + spanSprints` range
- Bar colours match the existing `BAR.epic` style (`rgba(168,196,245,0.18)` fill, `#6090E0` border)
- Epics with zero assignments render an amber `⚠ no staff` badge on the bar
- Status badge (Active / At Risk / Done) shown in the name column

**Below the Gantt — detail table:**

| Epic | Status | Starts | Ends | Assigned members |
|---|---|---|---|---|
| Alpha Launch | Active | Q1 2026 | Q2 2026 | Alice C., Bob K. |
| Portal Redesign | At Risk | Q2 2026 | Q3 2026 | *(none)* |

**Props interface:**
```ts
interface ReportGanttProps {
  plannerItems: PlannerItem[];
  jiraItems: JiraWorkItem[];
  quarters: string[];          // e.g. ['2026-Q1', '2026-Q2']
  teamMembers: TeamMember[];
}
```

---

## Section 2 — Capacity Risks

### Risk definitions

Three risk types, in priority order:

| Type | Condition | Severity |
|---|---|---|
| Overbooked member | `calculateCapacity(memberId, quarter, state).status === 'overallocated'` | 🔴 High |
| Unstaffed epic | Epic in `plannerLayout` with `assignees.length === 0` | 🟠 Medium |
| Understaffed epic | Assigned days total < epic's `storyPoints` estimate | 🟠 Medium |

### `getEpicStaffingRisks` utility

New pure function in `frontend/src/utils/reportRisks.ts`:

```ts
interface EpicRisk {
  type: 'no-staff' | 'understaffed';
  epicKey: string;
  epicName: string;
  assignedDays: number;
  storyPoints: number | null;
}

function getEpicStaffingRisks(
  plannerItems: PlannerItem[],
  jiraItems: JiraWorkItem[]
): EpicRisk[]
```

Overbooked members come from the existing `getWarnings(state)` — no new logic needed there.

### ReportRisks component

```ts
interface ReportRisksProps {
  epicRisks: EpicRisk[];
  overbookedMembers: { member: TeamMember; usedPercent: number; quarter: string }[];
}
```

Renders a grouped list: High risks first (overbooked), then Medium (epic staffing). Shows a "0 risks" green state when clean. Each risk row has a colour-coded severity dot, a plain-text description, and a muted context label (sprint/quarter).

---

## Section 3 — Capacity by Process Team

Reuses `ProcessTeamCapacityTable` directly with data from the existing `useProcessTeamCapacitySummaries` hook, scoped to the selected quarter. No new logic needed.

---

## Section 4 — PDF Export

### Approach: `@react-pdf/renderer`

A separate `ReportPDF` component built entirely with react-pdf primitives (`Document`, `Page`, `View`, `Text`). It receives all report data as plain props and has no store access.

**Gantt bars in PDF:** Rendered as coloured `View` rectangles with percentage-based widths derived from the same quarter-span calculation used by `ReportGantt`.

**Export flow:**
```ts
import { pdf } from '@react-pdf/renderer';

const blob = await pdf(<ReportPDF data={reportData} />).toBlob();
const url = URL.createObjectURL(blob);
// trigger auto-download via <a download> click
```

**Trade-off:** The PDF and on-screen views are two separate render trees. Layout changes need to be applied in both. Accepted at MVP — the PDF layout is intentionally simpler (no hover states, no interactive elements).

---

## New Files

| File | Purpose |
|---|---|
| `frontend/src/pages/Report.tsx` | Page shell — header, quarter picker, assembles sections |
| `frontend/src/components/report/ReportGantt.tsx` | Read-only CSS Gantt + detail table |
| `frontend/src/components/report/ReportRisks.tsx` | Risk list (overbooked + unstaffed/understaffed epics) |
| `frontend/src/components/report/ReportPDF.tsx` | react-pdf document mirroring the on-screen layout |
| `frontend/src/utils/reportRisks.ts` | `getEpicStaffingRisks()` pure utility |

## Modified Files

| File | Change |
|---|---|
| `frontend/src/types/index.ts` | Add `'report'` to `ViewType` union |
| `frontend/src/App.tsx` | Wire `report` route and page |
| `frontend/src/components/layout/Sidebar.tsx` | Add Report nav item |

---

## Dependencies

- `@react-pdf/renderer` — new npm dependency
- No database migrations required
- No backend changes required

---

## Out of Scope (this release)

- AI narrative summary (follow-on phase — see `docs/Todo.md`)
- Filtering by epic status, label, or squad
- Scenario comparison (baseline vs. what-if side-by-side)
- Story / Feature level detail in the Gantt (epic-level only)
- Real-time collaborative sharing / live link
