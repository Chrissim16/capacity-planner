# Implementation Plan — Executive Report
**Source:** `docs/features/executive-report/spec.md`  
**Date:** 2026-03-23  
**Stories:** 1 feature across 4 phases

---

## No Spikes Required

All unknowns were resolved during the design session:
- `PlannerTimeline` is not reusable as read-only → build `ReportGantt` from scratch
- Overbooked logic already exists in `getWarnings()` → no new capacity logic needed
- Epic staffing gaps need a new `getEpicStaffingRisks()` utility → scoped and spec'd
- PDF via `@react-pdf/renderer` → new npm dependency, no backend changes

---

## Phase Ordering Rationale

```
Phase 1 — Routing + shell (zero risk, unblocks all other phases)
Phase 2 — Data layer (pure utilities, fully testable before any UI)
Phase 3 — On-screen report UI (Gantt + Risks + Team table)
Phase 4 — PDF export (@react-pdf/renderer, ReportPDF component)
```

Each phase produces a shippable diff. Phase 3 can be reviewed in the browser before Phase 4 starts.

---

## Phase 1 — Routing & Page Shell
**Goal:** Wire the report into the app so the page is accessible. No content yet.  
**Files:** `types/index.ts`, `App.tsx`, `Sidebar.tsx`, `pages/Report.tsx`

---

### T1-1 · Add `'report'` to `ViewType`
- **File:** `frontend/src/types/index.ts`
- Find the `ViewType` union (search for `'planner'` — it was added recently). Append `| 'report'`.
- **Verify:** `tsc --noEmit` passes. TypeScript will surface any exhaustive switch/record that needs a new `'report'` case — fix those too.

---

### T1-2 · Wire route in `App.tsx`
- **File:** `frontend/src/App.tsx`
- Add `report` to `PATH_TO_VIEW` (`'/report': 'report'`), `VIEW_TO_PATH` (`report: '/report'`), and `pages` map (`report: <Report />`).
- Import `Report` lazily: `const Report = lazy(() => import('./pages/Report'))`.
- **Verify:** Navigating to `/report` renders the lazy-loaded page without a 404 or blank screen.

---

### T1-3 · Add Report nav item to Sidebar
- **File:** `frontend/src/components/layout/Sidebar.tsx`
- Import `FileBarChart` from `lucide-react`. Add to `navItems` array between `planner` and `settings`:
  ```ts
  { view: 'report', icon: FileBarChart, label: 'Report' }
  ```
- **Verify:** Sidebar renders "Report" item with the correct icon. Active state highlights when on `/report`. Settings still gated to `system_admin` only.

---

### T1-4 · Build `Report.tsx` shell
- **File:** `frontend/src/pages/Report.tsx`
- Page shell with:
  - `variant='fullbleed'` Layout (consistent with Scenario Planner)
  - Header row: title "Executive Report", `ScenarioSelector` (reuse as-is from `Header.tsx`), quarter picker `<select>` (derive options from `state.sprints` via `getAvailableQuarters()`), "Export PDF" button (disabled/loading state placeholder)
  - Three section placeholders: `<ReportGantt />`, `<ReportRisks />`, `<ProcessTeamCapacityTable />`
  - Local state: `selectedQuarter: string` initialised to current quarter
- **Verify:** Page loads, header renders with scenario name and quarter select. No JS errors. Three placeholder sections visible.

---

## Phase 2 — Data Layer (Pure Utilities)
**Goal:** All data logic testable in isolation before any UI is wired.  
**Files:** `utils/reportRisks.ts`

---

### T2-1 · Write unit tests for `getEpicStaffingRisks`
- **File:** `frontend/src/utils/reportRisks.test.ts` (new)
- Test cases:
  - Epic with `assignees: []` → returns `EpicRisk { type: 'no-staff', assignedDays: 0 }`
  - Epic with `assignees` summing to 8 days, `storyPoints: 21` → returns `EpicRisk { type: 'understaffed', assignedDays: 8, storyPoints: 21 }`
  - Epic with sufficient assignments (`assignedDays >= storyPoints`) → not returned
  - Epic with `storyPoints: null` and at least one assignee → not returned (no points = cannot assess understaffing)
  - Empty `plannerItems` → returns `[]`
- **Verify:** All tests fail (RED — function not yet written).

---

### T2-2 · Implement `getEpicStaffingRisks`
- **File:** `frontend/src/utils/reportRisks.ts` (new)
- Types:
  ```ts
  export interface EpicRisk {
    type: 'no-staff' | 'understaffed';
    epicKey: string;
    epicName: string;
    assignedDays: number;
    storyPoints: number | null;
  }
  ```
- Logic:
  1. Filter `plannerItems` to epics only (`item.jiraType === 'epic'` or `item.type === 'epic'` — confirm field name).
  2. For each epic: sum `assignee.daysPerSprint * sprintCount` across all `PlannerAssignment` entries to get `assignedDays`. Use the item's `spanSprints` as `sprintCount`.
  3. Look up `storyPoints` from the matching `JiraWorkItem` by `jiraKey`.
  4. Apply risk rules:
     - `assignees.length === 0` → `'no-staff'`
     - `storyPoints !== null && assignedDays < storyPoints` → `'understaffed'`
- **Verify:** T2-1 tests pass (GREEN).

---

### T2-3 · Write unit tests for overbooked member extraction
- **File:** `frontend/src/utils/reportRisks.test.ts` (extend)
- `getWarnings(state)` already returns `warnings.overallocated`. Write a thin wrapper test that confirms the shape expected by `ReportRisks`:
  - Given a state where member `u1` has `calculateCapacity().status === 'overallocated'`, confirm `getWarnings` returns `overallocated` containing `u1` with a `usedPercent > 100`.
- This is a regression guard — not new logic, but ensures the `ReportRisks` component can safely consume `getWarnings` output.
- **Verify:** Test passes without code changes (confirms existing behaviour).

---

## Phase 3 — On-Screen Report UI
**Goal:** All three report sections visible and data-wired in the browser.  
**Files:** `components/report/ReportGantt.tsx`, `components/report/ReportRisks.tsx`, `pages/Report.tsx`

---

### T3-1 · Write component test for `ReportGantt`
- **File:** `frontend/src/components/report/ReportGantt.test.tsx` (new)
- Test cases:
  - Given 2 epics with known `startSprint`/`spanSprints`, assert 2 bar elements render with correct width % (e.g. `spanSprints / totalSprints * 100`).
  - Epic with `assignees.length === 0` renders an amber `⚠ no staff` badge.
  - Detail table renders one row per epic with correct name, status, and assigned member names.
  - Empty `plannerItems` renders an empty-state message ("No epics in this scenario.").
- **Verify:** All tests fail (RED).

---

### T3-2 · Build `ReportGantt`
- **File:** `frontend/src/components/report/ReportGantt.tsx` (new)
- Props:
  ```ts
  interface ReportGanttProps {
    plannerItems: PlannerItem[];
    jiraItems: JiraWorkItem[];
    quarters: string[];
    teamMembers: TeamMember[];
  }
  ```
- **Gantt section:** CSS grid — label column (200px fixed) + one column per quarter (equal width, `flex-1`). Each epic row: name + status badge on the left; coloured bar div (`background: rgba(168,196,245,0.18)`, `border: 1px solid #6090E0`, `border-radius: 6px`) positioned with `marginLeft` and `width` as percentages of the total quarter span. Amber `⚠` badge overlaid on bar when `assignees.length === 0`.
- **Bar geometry:** `left% = (epicStartQuarterIndex / totalQuarters) * 100`, `width% = (epicSpanQuarters / totalQuarters) * 100`. Map `startSprint` to a quarter index using `state.sprints`.
- **Detail table:** Below the Gantt, standard HTML `<table>` — columns: Epic, Status, Starts, Ends, Assigned members. "Assigned members" = comma-joined display names looked up from `teamMembers` by `memberId`.
- Empty state: `<p className="text-sm text-[#94A3B8] italic">No epics in this scenario.</p>`
- **Verify:** T3-1 tests pass. Manual: open Report page with real data, confirm bars render proportionally, detail table shows correct member names.

---

### T3-3 · Write component test for `ReportRisks`
- **File:** `frontend/src/components/report/ReportRisks.test.tsx` (new)
- Test cases:
  - 1 overbooked member + 1 understaffed epic → renders 2 items, overbooked first.
  - 0 risks → renders green "No capacity risks detected." empty state.
  - `no-staff` epic → description reads "No team members assigned".
  - `understaffed` epic → description includes both assigned days and story points.
- **Verify:** All tests fail (RED).

---

### T3-4 · Build `ReportRisks`
- **File:** `frontend/src/components/report/ReportRisks.tsx` (new)
- Props:
  ```ts
  interface ReportRisksProps {
    epicRisks: EpicRisk[];
    overbookedMembers: { member: TeamMember; usedPercent: number; quarter: string }[];
  }
  ```
- Section header: "Capacity Risks" + `{total} risks flagged` badge (amber) or "No risks" (green).
- Risk rows: grouped — High (overbooked) first, then Medium (epic gaps). Each row: severity dot (`🔴` / `🟠`), plain-text description, muted context label.
  - Overbooked: `"{name} — overbooked {usedPercent}% in {quarter}"`
  - No staff: `"{epicName} — no team members assigned"`
  - Understaffed: `"{epicName} — {assignedDays}d assigned vs {storyPoints} story points"`
- Empty state: green checkmark + "No capacity risks detected for this quarter."
- **Verify:** T3-3 tests pass.

---

### T3-5 · Wire all sections into `Report.tsx`
- **File:** `frontend/src/pages/Report.tsx`
- Pull state via `useCurrentState()`:
  - Active scenario → derive `plannerItems` from `scenario.plannerLayout`
  - `jiraItems` from `state.jiraWorkItems`
  - `teamMembers` from `state.teamMembers`
  - `processTeams` for `useProcessTeamCapacitySummaries(selectedQuarter)`
- Compute:
  - `epicRisks = getEpicStaffingRisks(plannerItems, jiraItems)`
  - `{ overallocated } = getWarnings(state)` — map to `overbookedMembers` shape
  - `quarters` = derive 4-quarter window from `selectedQuarter`
- Render: `<ReportGantt>`, `<ReportRisks>`, `<ProcessTeamCapacityTable>` with live data.
- **Verify:** Report page shows real data. Changing the quarter picker updates all three sections. Switching scenario (via `ScenarioSelector` in header) updates the report.

---

## Phase 4 — PDF Export
**Goal:** "Export PDF" button generates and downloads a matching PDF.  
**Files:** `components/report/ReportPDF.tsx`, `pages/Report.tsx`, `package.json`

---

### T4-1 · Install `@react-pdf/renderer`
- **Command:** `npm install @react-pdf/renderer`
- **Verify:** `tsc --noEmit` passes. No peer-dependency conflicts.

---

### T4-2 · Build `ReportPDF`
- **File:** `frontend/src/components/report/ReportPDF.tsx` (new)
- Pure component — no store access. Props:
  ```ts
  interface ReportPDFProps {
    scenarioName: string;
    quarter: string;
    plannerItems: PlannerItem[];
    jiraItems: JiraWorkItem[];
    teamMembers: TeamMember[];
    epicRisks: EpicRisk[];
    overbookedMembers: { member: TeamMember; usedPercent: number; quarter: string }[];
    processTeamSummaries: { id: string; name: string; data: GroupCapacitySummary }[];
  }
  ```
- Structure: `<Document><Page>` with three sections:
  1. **Header:** Title "Executive Report", scenario name, quarter, generated date.
  2. **Delivery Timeline table:** `<View>` grid — one row per epic. Bar column: coloured `<View>` rectangle with `width: '{n}%'` calculated from `spanSprints / totalSprints * 100`.
  3. **Capacity Risks:** Bulleted `<Text>` list — same descriptions as `ReportRisks`.
  4. **Capacity by Team:** `<View>` table rows — team name, available days, allocated days, utilisation %.
- Use `StyleSheet.create` for all styles. DM Sans is not available in react-pdf — use `Helvetica` for MVP.
- **Verify:** PDF renders without errors. All three sections appear. Bar widths are proportional.

---

### T4-3 · Wire Export PDF button in `Report.tsx`
- **File:** `frontend/src/pages/Report.tsx`
- Import `pdf` from `@react-pdf/renderer`.
- "Export PDF" button `onClick`:
  ```ts
  const handleExport = async () => {
    setExporting(true);
    const blob = await pdf(<ReportPDF {...reportData} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capacity-report-${selectedQuarter}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };
  ```
- Button shows a `Loader` spinner icon while `exporting === true` and is disabled during generation.
- **Verify:** Clicking the button downloads a `.pdf` file. File opens correctly in a PDF viewer. All three sections present. Filename includes the selected quarter (e.g. `capacity-report-2026-Q1.pdf`).

---

## Effort Summary

| Phase | Tasks | Est. Time |
|---|---|---|
| Phase 1 — Routing & shell | T1-1 → T1-4 | 1–2 h |
| Phase 2 — Data layer | T2-1 → T2-3 | 2–3 h |
| Phase 3 — On-screen UI | T3-1 → T3-5 | 4–6 h |
| Phase 4 — PDF export | T4-1 → T4-3 | 3–5 h |
| **Total** | | **10–16 h** |

---

## Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | `@react-pdf/renderer` DM Sans font not available | PDF uses wrong font | Use Helvetica for MVP; embed DM Sans in Phase 4 follow-up if needed |
| R2 | Bar geometry calculation for `ReportGantt` maps sprints → quarters incorrectly | Bars misaligned | Unit-test the geometry function before rendering (T3-1) |
| R3 | `getWarnings()` uses `getCurrentQuarter()` internally (current real-world quarter, not the picker selection) | Risks section shows wrong quarter's data | Pass `selectedQuarter` explicitly; may need to refactor `getWarnings` to accept a quarter param |
| R4 | Active scenario has no `plannerLayout` (blank canvas) | Report renders empty | Show a "No planning data in this scenario" empty state before rendering sections |
| R5 | `storyPoints` is null for most Jira items (not all items have estimates) | Understaffed risks never fire | Filter understaffed check to items with `storyPoints !== null`; document this limitation in the UI |
