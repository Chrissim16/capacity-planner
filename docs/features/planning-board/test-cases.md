# Smart Staffing & Planning Board — Test Cases
> Branch: `feature/smart-staffing-planning-board`
> Created: 2026-03-16
> Covers: US-060 (Scenario Wizard), US-061 (Smart Assignment Panel), US-062 (Planning Board)

---

## Part 1 — Automated Unit Tests (run these first)

```bash
# from /frontend
npm run test
# or with coverage
npx vitest run --reporter=verbose
```

**Expected result:** 5 test files, **80 tests**, all green.

| File | Tests | Description |
|---|---|---|
| `utils/capacity.test.ts` | 5 new | Assignment.days deduction in calculateCapacity |
| `utils/staffing.test.ts` | 12 new | scoreMember, scoreBusinessContact, rankMemberFits |
| `utils/capacity.test.ts` (existing) | existing | Business capacity, sprint quarter helpers |
| `components/*.test.ts` | existing | Component snapshot & interaction tests |

---

## Part 2 — Manual Browser Smoke Tests

Start the dev server first:

```bash
cd frontend && npm run dev
```

Open the app in the browser and follow the test cases below.
Check each box as you pass it.

---

### BLOCK A — Data Model Foundation (Phase 0)

Prerequisite: these verify the store is wired correctly via the UI.

| # | Test | Steps | Expected |
|---|---|---|---|
| A-1 | Projects and assignments initialise empty | Open app fresh. Open DevTools → Application → Local Storage → find app store key. Inspect the JSON. | Root state has `projects: []` and `assignments: []`. Active scenario (if any) also has both arrays. |
| A-2 | Scenario inherits empty arrays | Go to **Scenarios** page → create a new blank scenario. Inspect store. | New scenario record contains `projects: []` and `assignments: []`. |

---

### BLOCK B — Dashboard Nudge Banner (US-060 partial)

Requires **2+ team members** to be over ~80% utilisation in the active quarter. If your data doesn't show this, you can temporarily lower a member's capacity or add story-point load in Jira sync mock data.

| # | Test | Steps | Expected |
|---|---|---|---|
| B-1 | Banner appears when ≥2 members over-utilised | Make sure ≥2 IT members are heavily utilised. Navigate to **Dashboard → Overview tab**. | Yellow/amber nudge banner visible below the header. Banner names the highly-utilised members (or a count). |
| B-2 | "Plan it safely" CTA opens the wizard | Click the **"Plan it safely →"** button on the banner. | Scenario Wizard modal opens (Step 1 visible). |
| B-3 | Banner dismissal persists | Close the wizard. Click **×** on the nudge banner. Reload the page. | Banner is gone. Stays gone across reloads (7-day TTL stored in `localStorage` under key `nudge_high_util_dismissed`). |
| B-4 | localStorage reset re-shows banner | In DevTools console: `localStorage.removeItem('nudge_high_util_dismissed')`. Reload. | Banner reappears (member utilisation conditions still met). |
| B-5 | Banner hidden in other tabs | Go to **Dashboard → Capacity tab** or any other sub-tab. | Nudge banner is NOT shown (only shows on Overview tab). |
| B-6 | Read-only user sees different CTA | As a user without `edit_assignments` permission, navigate to Dashboard. | CTA text shows the read-only variant (no "Plan it safely" button, just informational text). |

---

### BLOCK C — Scenario Wizard (US-060)

| # | Test | Steps | Expected |
|---|---|---|---|
| C-1 | Step 1 — Project details | Open wizard. Enter a project name. Select priority. Choose "Start fresh" or "Base on active scenario". | Form fields accept input. "Next" button becomes active once name is non-empty. |
| C-2 | Step 1 — Validation | Try clicking Next with an empty project name. | Error message or button stays disabled. Cannot advance without a name. |
| C-3 | Step 2 — Quarter & days | Advance to Step 2. Select a quarter. Enter days-per-quarter (e.g. 20). Select 1–2 skills. | Inputs accept values. Next enabled when quarter and at least 1 day are set. |
| C-4 | Step 2 — Skills reset tentative assignments | Assign someone in Step 3, come back to Step 2, change the skills. Proceed to Step 3. | Tentative assignments are cleared. Members list re-scored for new skills. |
| C-5 | Step 3 — Smart Assignment Panel (inline) | Reach Step 3. | Inline `SmartAssignmentPanel` visible. IT members listed with mini capacity bars. Members with matching skills shown first (green "good" badge). Missing-skill members show skill gap chips. |
| C-6 | Step 3 — Assign days | Enter a number of days (e.g. 15) next to a member. Click **Assign**. | Member gets an "Assigned X days" badge. Their capacity bar decreases. Assigned entry appears in tentative list. |
| C-7 | Step 3 — Overbook warning | Enter days exceeding a member's remaining capacity. | Red "Overbooked" warning appears. Assignment is still allowed (soft warning). |
| C-8 | Step 3 — BIZ contacts section | Scroll down or expand the BIZ contacts section. | BIZ contacts listed with their own capacity indicators. |
| C-9 | Step 4 — Impact summary | Advance to Step 4. | Before/after capacity progress bars shown for each person assigned. Bar widens to reflect the new committed days. |
| C-10 | Step 5 — Summary & create | Advance to Step 5. Review summary. Click **"Create Scenario"**. | Loading spinner briefly shown. Toast notification "Scenario created". Wizard closes. New scenario becomes active in the store. |
| C-11 | New scenario visible on Scenarios page | After wizard completes, go to **Scenarios** page. | New scenario card appears with the project name as its label (or description). |
| C-12 | Dismiss with tentative assignments | Fill out Step 3 with a tentative assignment. Click the **×** to close. | `ConfirmModal` appears warning "You have unsaved assignments". Confirming dismissal closes the wizard and discards tentative data. |
| C-13 | Enter key advances steps | In Step 1, press **Enter** after filling the project name. | Advances to Step 2 (keyboard navigation). |

---

### BLOCK D — Smart Assignment Panel on Projects page (US-061)

| # | Test | Steps | Expected |
|---|---|---|---|
| D-1 | "Staff this epic" button visible | Go to **Projects** page. Find an epic row. | A `UserPlus` icon button is visible on each epic row in the stats area. |
| D-2 | Panel opens | Click the `UserPlus` button on any epic. | `SmartAssignmentPanel` slides in from the right (`slideOut` variant). Panel header shows the epic name. |
| D-3 | Members scored correctly | With the panel open, note the current quarter and members shown. | IT members sorted: good (green) → partial (yellow) → over (red). Each shows available days and a mini progress bar. |
| D-4 | Skill chip display | For an epic that has required skills (check epic's Jira label/component), open its panel. | Members with matching skills show green chip(s). Members missing skills show red "Missing: X" chips. |
| D-5 | Assign days | Enter days (e.g. 10) next to a member with capacity. Click **Assign**. | Store gains a new `Assignment` record. Member's `availableDays` in the panel decreases immediately. |
| D-6 | Existing assignment shown | Close and re-open the same epic's panel. | The member you just assigned shows an "Already assigned: X days" badge, and the button label changes to "Add more days". |
| D-7 | Close panel | Click **×** in the panel. | Panel slides out / disappears. |
| D-8 | RBAC — read only | As a user without `edit_assignments`, open the panel. | Days input and Assign button are disabled / hidden (wrapped in `PermissionGate`). |
| D-9 | BIZ contacts collapse | Expand the "BIZ contacts" section in the panel. | BIZ contacts listed with capacity. Can assign days to them. |

---

### BLOCK E — Scenarios page & Planning Board (US-062)

#### E.1 — Tab behaviour

| # | Test | Steps | Expected |
|---|---|---|---|
| E-1 | No "Board" tab without active scenario | Go to **Scenarios** page with no active scenario. | Only "Scenarios" tab visible. No "Board" tab. |
| E-2 | "Board" tab appears after activating a scenario | Activate a scenario. | "Board" tab now appears in the tab bar. |
| E-3 | Lazy load spinner | Click "Board" tab for the first time. | Brief loading spinner ("Loading board…") visible before the `PlanningBoard` renders. |

#### E.2 — Planning Board layout

| # | Test | Steps | Expected |
|---|---|---|---|
| E-4 | Three-panel layout | Open the Board tab. | Left sidebar (Projects), center timeline, right sidebar (Members) all visible. |
| E-5 | Collapsible left sidebar | Click the collapse arrow on the left sidebar. | Projects panel collapses. Center timeline expands. Clicking again restores it. |
| E-6 | Collapsible right sidebar | Click the collapse arrow on the right sidebar. | Members panel collapses. Center timeline expands. Clicking again restores it. |
| E-7 | Quarter selector | Use the quarter dropdown in the board's top bar. | Timeline updates to show the selected quarter. Assignment counts update. |
| E-8 | View toggle: By Project / By Person | Click the toggle between "By Project" and "By Person". | Center timeline re-renders to group rows by the chosen dimension. |
| E-9 | Scenario name shown | The board top bar should display the name of the active scenario. | Active scenario name visible. |
| E-10 | "Promote to Baseline" button | Find the "Promote to Baseline" button in the board top bar. | Button exists and is enabled when a scenario is active. |

#### E.3 — Drag & drop assignments

| # | Test | Steps | Expected |
|---|---|---|---|
| E-11 | Drag member to project row | In "By Project" view, drag an IT member from the right sidebar onto a project row. | `DropPopover` appears prompting for days input. Project row briefly shows a fit-colour border glow during drag. |
| E-12 | Fit colours on drag start | Begin dragging a member. Look at project row borders. | Projects with a good fit glow green, partial yellow, over red (using `FIT_GLOW` values). |
| E-13 | Confirm days in popover | In the `DropPopover`, enter 10 days and click **Confirm**. | Assignment created in store. Member avatar appears on the project row. |
| E-14 | Existing assignment warning | Drag the same member to the same project again. | Popover shows "Already assigned: X days" info. |
| E-15 | Cancel drop | Open the `DropPopover` and click **Cancel** or press **Escape**. | No assignment created. Board state unchanged. |
| E-16 | RBAC — no drag for read-only | As a user without `edit_assignments`, look at members in the right sidebar. | Member cards are not draggable (drag handle disabled/hidden). |

#### E.4 — Board views in detail

| # | Test | Steps | Expected |
|---|---|---|---|
| E-17 | "By Project" collapsed rows | In "By Project" view with assignments, note a project row with 2+ members. | Collapsed row shows avatar cluster (stacked avatars) with a "+N" count. |
| E-18 | "By Project" expanded rows | Click a project row to expand. | Individual member assignment rows appear with whisper lines showing allocation. |
| E-19 | "By Person" rows | Switch to "By Person" view. | Each IT member has a row. Their assigned projects shown as colour-coded blocks per row. |
| E-20 | Inline SmartAssignmentPanel on board | Select a project from the left sidebar. | Inline `SmartAssignmentPanel` appears at the bottom of the board, showing fit scores for the selected project. |

---

### BLOCK F — Capacity deduction (Phase 1, D1)

These verify that manual `Assignment` records reduce available capacity everywhere.

| # | Test | Steps | Expected |
|---|---|---|---|
| F-1 | Assignment reduces capacity on Dashboard | Create an assignment (10 days) for a member via the SmartAssignmentPanel. Navigate to **Dashboard**. | That member's capacity bar is lower by 10 days. If they were at 70%, they are now higher (fewer available days). |
| F-2 | Capacity breakdown includes 'assignment' type | In DevTools, inspect the result of `calculateCapacity()` (or add a console.log temporarily). | Breakdown array contains an entry `{ type: 'assignment', days: 10 }`. |
| F-3 | Jira story points and assignments don't double-count | A member has both Jira story-point load AND a manual assignment. | Dashboard capacity bar reflects the combined deduction (Jira + assignment), not double the assignment. |
| F-4 | Scenario isolation | Create an assignment in Scenario A. Switch to Scenario B (or baseline). | The member's capacity in Scenario B / baseline is NOT affected by Scenario A's assignment. |

---

### BLOCK G — Regression tests

Ensure existing features are not broken.

| # | Test | Steps | Expected |
|---|---|---|---|
| G-1 | Dashboard capacity bars render | Navigate to Dashboard. | All existing capacity bars render correctly. No blank/NaN values. |
| G-2 | Scenarios page loads | Navigate to Scenarios page. | Page renders. Existing scenario cards intact. Create / duplicate / delete scenario still works. |
| G-3 | Projects page loads | Navigate to Projects page. | Jira epics and features listed correctly. |
| G-4 | Settings page loads | Navigate to Settings. | No console errors. Settings save/load correctly. |
| G-5 | Holiday/vacation deductions | Check a member's capacity on a quarter containing holidays or vacation. | Holidays and BAU deductions still apply correctly alongside new assignment deduction. |
| G-6 | Scenario switch clears board state | On the board, make tentative drag assignments. Switch to a different scenario. | Board updates to reflect the new scenario's assignments (tentative board state cleared). |

---

## Part 3 — Console Error Check

After completing all manual tests:

1. Open DevTools → Console.
2. Filter to **Errors** only.
3. **Expected:** Zero red errors. Yellow warnings from third-party libraries (e.g. dnd-kit, React dev mode) are acceptable.

---

## Part 4 — Quick Checklist Summary

Copy-paste this to a comment or ticket to track sign-off:

```
[ ] Part 1: 80/80 unit tests pass (npm run test)
[ ] A: Data model — projects/assignments in store
[ ] B: Dashboard nudge banner (show / dismiss / TTL)
[ ] C: Scenario Wizard — all 5 steps, create, dismiss confirm
[ ] D: SmartAssignmentPanel on Projects page
[ ] E: Planning Board — tabs, layout, drag & drop, views
[ ] F: Capacity deductions — Assignment.days reduces available days
[ ] G: Regression — existing pages unaffected
[ ] Zero red console errors
```
