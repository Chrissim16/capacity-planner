# Smart Staffing & Planning Board — Design Document

**Date:** 2026-03-13  
**Reviewed:** 2026-03-16 (Mega Plan Review — EXPANSION mode)  
**Status:** Approved — ready to implement  
**Covers:** US-060 (Narrative Scenario Wizard), US-061 (Smart Assignment Panel), US-062 (Scenario-Native Planning Board)

---

## Review Decisions Log

The following decisions were made during the 2026-03-16 plan review and are incorporated throughout this document. An implementing agent must apply all of them.

| # | Decision | Impact |
|---|---|---|
| D1 | Fix `calculateCapacity()` to also deduct `Assignment.days` | Amend `utils/capacity.ts` before building staffing.ts |
| D2 | Add collapsible BIZ contacts section to `SmartAssignmentPanel` | Dual-track rule; adds `scoreBusinessContact()` to staffing.ts |
| D3 | Add optional `tentativeAssignments` param to `scoreMember` | Wizard re-scores live as members are tentatively assigned in Step 3 |
| D4 | Add "Base on" toggle in Wizard Step 1 | Calls `duplicateScenario()` instead of `createScenario()` when active scenario is chosen |
| D5 | Dashboard nudge: 7-day localStorage dismiss TTL | Re-triggers only when a *new* member tips over 85% since last dismiss |
| D6 | Lazy-load `PlanningBoard` component | `React.lazy()` + `<Suspense>` so @dnd-kit/core is not in the main bundle |
| D7 | "Already assigned" badge on member rows | Show existing assignment days; Assign button becomes "Add more days" |
| D8 | Mini capacity bar on member rows | Reuse `ProgressBar` primitive; pass `usedPercent` from `calculateCapacity` |
| D9 | Animate capacity bar on drop | CSS `transition: width 300ms ease` on bar fill div in Planning Board |
| D10 | RBAC gate on Board Assign interactions | `can('editAssignments')` hides drag interaction and Assign buttons for read-only users |
| D11 | `useReducer` for wizard state | 5-step wizard with accumulating state is too complex for scattered `useState` |
| D12 | `createScenarioWithPlan()` helper | Extract wizard Step 5 logic from the component into a named helper in actions.ts |
| D13 | Dashboard nudge reuses `getWarnings()` | Do not re-implement utilisation threshold logic; call existing `getWarnings()` |
| D14 | Architecture.md updated in same PR | See files-affected table |

---

## Problem

Three related pain points drive this feature set:

1. **The assignment form is too slow.** `AssignmentModal` requires filling in project, phase, member, quarter, and days — with no visibility into whether the person has capacity or the right skills. Users have to check the Dashboard separately.
2. **No answer to "who can take this on?"** When a new project lands, there is no surface that ranks team members by fit (capacity + skills). Users mentally cross-reference the Dashboard and Team pages.
3. **No visual bulk-planning surface.** Quarterly planning (filling out the whole team's assignments for a quarter) requires repeated modal interactions with no overview.

---

## Architecture

The three user stories form a dependency chain. `utils/staffing.ts` is the shared foundation:

```
utils/staffing.ts  (fit scoring engine)
       │
       ├──▶  US-061  SmartAssignmentPanel
       │          │
       │          ├──▶  US-060  ScenarioWizard  (inline variant in Step 3)
       │          └──▶  US-062  PlanningBoard   (inline variant in bottom sidebar)
       │
       └──▶  US-062  PlanningBoard  (hover fit-colour border during drag)
```

**Implementation order is fixed:**

1. Amend `utils/capacity.ts` — fix `calculateCapacity()` (Decision D1)
2. `utils/staffing.ts` — fit scoring engine (no UI, shared by all three)
3. US-061 — `SmartAssignmentPanel` (standalone component, integrated into Projects page)
4. US-060 — `ScenarioWizard` (integrates SmartAssignmentPanel as Step 3)
5. US-062 — `PlanningBoard` (integrates SmartAssignmentPanel in bottom sidebar + drag & drop)

---

## Step 0 — Amend `calculateCapacity()` (Decision D1)

**File:** `frontend/src/utils/capacity.ts`

The existing `calculateCapacity(memberId, quarter, state)` deducts BAU reserve, time-off days, and Jira story-point days. It does **not** deduct `Assignment.days` from `projects.phases.assignments`. This means any member with manually-entered project assignments will show an inflated "available days" figure across all capacity surfaces.

**Change required:** After the Jira items loop and before computing `availableDays`, add:

```typescript
// Manual project assignments (not Jira-derived)
const assignmentDays = (state.assignments ?? [])
  .filter(a => a.memberId === memberId && a.quarter === quarter)
  .reduce((sum, a) => sum + (a.days ?? 0), 0);
if (assignmentDays > 0) {
  usedDays += assignmentDays;
  breakdown.push({ type: 'assignment', days: assignmentDays });
}
```

Guard `state.assignments ?? []` because scenario edge cases may have an undefined assignments array.

**Tests to add in `utils/capacity.test.ts`:**

```typescript
describe('calculateCapacity — Assignment.days deduction', () => {
  it('deducts assignment days for the given member and quarter')
  it('ignores assignments for other members')
  it('ignores assignments in other quarters')
  it('handles state.assignments = undefined gracefully (treats as 0)')
  it('does not double-count: manual assignment days and Jira story points are separate')
})
```

---

## US-061 — Smart Assignment Panel

### Purpose

A smart "Staff this project" slide-out panel (and embeddable inline variant) that replaces the main assignment flow. Given a project and a quarter, it ranks all active team members by fit and allows one-click assignment.

### Fit Scoring — `utils/staffing.ts`

New file. The core engine shared by US-061, US-060, and US-062.

```typescript
import type { AppState, TeamMember, BusinessContact } from '../types';
import { calculateCapacity } from './capacity';
import { calculateBusinessCapacityForQuarter } from './capacity';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FitLevel = 'good' | 'partial' | 'over';

export interface TentativeAssignment {
  memberId: string;
  days: number;
}

export interface MemberFit {
  member: TeamMember;
  fitLevel: FitLevel;
  availableDays: number;       // after BAU, time-off, Jira items, manual assignments, tentative
  usedPercent: number;         // from calculateCapacity — for mini capacity bar (D8)
  skillMatch: string[];        // skill names that match requiredSkillIds
  skillGap: string[];          // required skill names the member lacks
  atMaxProjects: boolean;      // member.maxConcurrentProjects reached for this quarter
  existingDays: number;        // days already assigned to THIS project in THIS quarter (D7)
}

export interface BizFit {
  contact: BusinessContact;
  fitLevel: FitLevel;
  availableDays: number;
  usedPercent: number;
  atMaxProjects: boolean;
  existingDays: number;        // days already assigned to THIS project in THIS quarter (D7)
}

// ─── Fit colour helper (shared across Panel, Board, Impact bars) ──────────────
// Do NOT inline this mapping in components — always import from here.

export const FIT_COLOURS: Record<FitLevel, { badge: string; border: string; text: string }> = {
  good:    { badge: 'bg-green-100 text-green-700',  border: 'border-green-500', text: 'text-green-700'  },
  partial: { badge: 'bg-amber-100 text-amber-700',  border: 'border-amber-500', text: 'text-amber-700'  },
  over:    { badge: 'bg-red-100   text-red-700',    border: 'border-red-500',   text: 'text-red-700'    },
};
```

#### `scoreMember()` — signature and rules

```typescript
export function scoreMember(
  member: TeamMember,
  quarter: string,
  requiredSkillIds: string[],
  projectId: string,           // for existingDays lookup (D7)
  state: AppState,             // MUST be getCurrentState() output, NOT store.data directly
  tentativeAssignments: TentativeAssignment[] = []
): MemberFit
```

**Scoring rules:**

| Condition | FitLevel |
|---|---|
| `adjustedAvailableDays > 0` AND all required skills matched AND not at max projects | `'good'` |
| `adjustedAvailableDays > 0` AND (partial skill match OR at max projects) | `'partial'` |
| `adjustedAvailableDays <= 0` | `'over'` |

**Implementation notes:**

- Call `calculateCapacity(member.id, quarter, state)` to get `availableDays` and `usedPercent`.
- Subtract this member's sum from `tentativeAssignments` to get `adjustedAvailableDays`. Do not modify other members' scores.
- If `requiredSkillIds.length === 0`: skill matching is vacuously satisfied. All members are scored on capacity + `atMaxProjects` alone. `skillMatch = []`, `skillGap = []`. Document this with a comment.
- `atMaxProjects`: count `(state.assignments ?? []).filter(a => a.memberId === member.id && a.quarter === quarter)` distinct `projectId`s and compare to `member.maxConcurrentProjects` (default 3).
- `existingDays` (D7): sum of `state.assignments` where `memberId === member.id && projectId === projectId && quarter === quarter`.
- Members with `excludedFromCapacity: true` must be filtered out **by the caller** before passing to `scoreMember`. Do not filter inside the function — callers may have different filtering needs.
- Wrap the entire function body in try/catch. On error: `console.error('[staffing] scoreMember failed', { memberId: member.id, quarter, error })` and return `{ ...member defaults, fitLevel: 'over', availableDays: 0 }`.
- The `state` parameter **must** be `getCurrentState()` output. Add a JSDoc comment making this explicit.

#### `scoreBusinessContact()` — BIZ fit (Decision D2)

```typescript
export function scoreBusinessContact(
  contact: BusinessContact,
  quarter: string,
  projectId: string,
  state: AppState,             // must be getCurrentState() output
  tentativeAssignments: TentativeAssignment[] = []
): BizFit
```

BIZ scoring is simpler — no skill matching. Use `calculateBusinessCapacityForQuarter` for `availableDays`. Apply same `atMaxProjects` logic against `state.businessAssignments`. `fitLevel` follows the same capacity-based rules (`'good'`/`'partial'`/`'over'`) with `'partial'` only triggered by `atMaxProjects`.

#### Ranking

Expose a helper used by the panel and the board:

```typescript
export function rankMemberFits(fits: MemberFit[]): MemberFit[] {
  const order: Record<FitLevel, number> = { good: 0, partial: 1, over: 2 };
  return [...fits].sort((a, b) =>
    order[a.fitLevel] - order[b.fitLevel] ||
    b.availableDays - a.availableDays
  );
}
```

**Tests — `utils/staffing.test.ts` (new file, required):**

```typescript
describe('scoreMember', () => {
  it('returns good: capacity > 0, all skills match, not at max projects')
  it('returns partial: capacity > 0 but missing required skills')
  it('returns partial: capacity > 0, skills match, but at max concurrent projects')
  it('returns over: adjustedAvailableDays <= 0')
  it('vacuous skill match: requiredSkillIds=[] → scores on capacity alone')
  it('subtracts tentativeAssignments days for this member only')
  it('does not subtract tentativeAssignments for other members')
  it('tentativeAssignments can push available below 0 → fitLevel over')
  it('existingDays: returns current assignment days to this project')
  it('wraps in try/catch → returns fitLevel:over on error, logs error')
})
describe('scoreBusinessContact', () => {
  it('returns fit based on available BIZ days')
  it('returns partial when at max concurrent BIZ projects')
})
describe('rankMemberFits', () => {
  it('sorts good → partial → over, then by availableDays descending within tier')
})
```

### Panel Layout

```
┌────────────────────────────────────────┐
│  Staff: [Project Name]          [✕]   │  ← slide-out only; hidden in inline
│  Quarter: [Q2 2025 ▾]                 │
├── IT Team ─────────────────────────────┤
│  [●] Alice Chen · Senior Dev  [good]  │
│      ████████░░░░  14d available      │  ← mini ProgressBar (D8)
│      Skills: ✓ React  ✓ Node          │
│      [ 5 days ] [Assign]              │
├────────────────────────────────────────┤
│  [●] Bob Kumar · PM         [partial] │
│      ██████░░░░░░   8d available      │
│      Skills: ✓ PM  ✗ React (missing)  │
│      [ 5 days ] [Assign]              │  ← "Add more" if existingDays > 0 (D7)
├────────────────────────────────────────┤
│  [●] Carol Lee · Dev          [over]  │
│       0d available                    │
│       [ — ]                           │
├── Business Contacts ▾ ─────────────────┤  ← collapsible, collapsed by default (D2)
│  [●] Dave Smith · PMO         [good]  │
│       ████░░░░░░  12d available       │
│      [ 5 days ] [Assign]              │
└────────────────────────────────────────┘
```

- **Fit badge colours:** green (`good`), amber (`partial`), red (`over`) — from `FIT_COLOURS` in `staffing.ts`
- **Mini capacity bar (D8):** reuse `ProgressBar` primitive with `usedPercent` from `calculateCapacity`. Width represents used capacity; colour matches fit badge.
- **Already assigned badge (D7):** when `existingDays > 0`, show a small inline note: `Already assigned: {existingDays}d`. The Assign button label becomes **"Add more days"**.
- **Days input:** number input, min=1, max=999. Defaults to `Math.min(5, availableDays)`, minimum 1. Disable Assign button when `days <= 0` or `isNaN(days)`. Show amber warning border + label "Overbooked" when `days > availableDays` — allow submission (intentional overbooking is valid).
- **Assign button:** calls existing `addAssignment()` from `stores/actions.ts`. Disable on first click until the store write completes to prevent double-submission (D7 guard).
- **RBAC (D10):** wrap Assign buttons in `can('editAssignments')` check. Read-only users see the panel in read-only mode (fit badges + days visible, no Assign buttons).
- **Quarter selector:** defaults to the current quarter; changing it re-runs scoring live. Uses `generateQuarters()` from `utils/calendar.ts` and the existing `Select` primitive.
- **BIZ section (D2):** collapsible (`<details>` or toggled `useState`). Collapsed by default. BIZ members scored with `scoreBusinessContact()`. Assigning BIZ calls `addBusinessAssignment()` (existing action). Purple (`biz.*`) colour scheme.

### SmartAssignmentPanel Props

```typescript
interface SmartAssignmentPanelProps {
  projectId: string;
  projectName: string;
  defaultQuarter?: string;
  variant: 'slideOut' | 'inline';   // 'slideOut' shows header + close button
  requiredSkillIds?: string[];       // from project or wizard Step 2
  tentativeAssignments?: TentativeAssignment[];   // D3 — wizard passes these
  onTentativeAssign?: (memberId: string, days: number) => void;  // inline only
  onTentativeRemove?: (memberId: string) => void;
  onClose?: () => void;             // slideOut only
}
```

### `useMemo` for score computation

```typescript
// Inside SmartAssignmentPanel — memoize the ranked list
const { itFits, bizFits } = useMemo(() => {
  const state = useCurrentState();    // scenario-aware
  const itFits = rankMemberFits(
    teamMembers
      .filter(m => m.isActive && !m.excludedFromCapacity)
      .map(m => scoreMember(m, quarter, requiredSkillIds ?? [], projectId, state, tentativeAssignments))
  );
  const bizFits = rankMemberFits(
    businessContacts
      .filter(c => !c.excludedFromCapacity && !c.archived)
      .map(c => scoreBusinessContact(c, quarter, projectId, state, tentativeAssignments))
  );
  return { itFits, bizFits };
}, [teamMembers, businessContacts, quarter, requiredSkillIds, projectId, currentState, tentativeAssignments]);
```

Do not call `useCurrentState()` inside `useMemo` — call it before and pass the result in as a dependency.

### Variants

| Variant | Used in | Behaviour |
|---|---|---|
| `slideOut` | Projects page | Right slide-out overlay, shows close button + project name header |
| `inline` | US-060 Wizard Step 3, US-062 Board bottom | Embedded in parent; no close button; fires `onTentativeAssign` instead of `addAssignment` |

### Projects page integration

Replace the existing "Assign" button trigger on `Projects.tsx` with `<SmartAssignmentPanel variant="slideOut" projectId={...} />`. The panel opens via `useState` local to the Projects page. The existing `AssignmentModal` can be kept as a fallback or removed — decide at implementation time based on usage.

---

## US-060 — Narrative Scenario Wizard

### Entry Points

- **Primary:** "New Scenario" / "What if…" CTA on the Scenarios page
- **Contextual nudge:** Banner on the Dashboard when ≥2 team members are at high utilisation (>85%) or over capacity — see Dashboard Nudge section below

### Wizard State (Decision D11)

Use `useReducer` for all wizard state. A single `wizardState` object with a `dispatch` function avoids stale closure bugs across 5 steps.

```typescript
type WizardAction =
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_PRIORITY'; payload: string }
  | { type: 'SET_BASE_ON'; payload: 'baseline' | 'active' }
  | { type: 'SET_QUARTERS'; payload: string[] }
  | { type: 'SET_DAYS_PER_QUARTER'; payload: Record<string, number> }
  | { type: 'SET_SKILL_IDS'; payload: string[] }
  | { type: 'ADD_TENTATIVE'; payload: TentativeAssignment }
  | { type: 'REMOVE_TENTATIVE'; payload: { memberId: string } }
  | { type: 'RESET_TENTATIVE' }   // fired when Step 2 skills change
  | { type: 'SET_STEP'; payload: number };

interface WizardState {
  step: number;                           // 1–5
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  baseOn: 'baseline' | 'active';          // D4
  quarters: string[];
  daysPerQuarter: Record<string, number>;
  skillIds: string[];
  tentativeAssignments: TentativeAssignment[];
}
```

**Skills change → reset tentative assignments (Section 4 edge case):**

When `SET_SKILL_IDS` is dispatched (Step 2 skill selection changes), the reducer must also reset `tentativeAssignments: []`. Add this to the reducer and document it with a comment: "Skill changes invalidate Step 3 selections because fit scores change."

### Flow

A Typeform-style full-screen step wizard (5 steps). Each step occupies the full modal viewport. Navigation: Back / Next / keyboard `Enter`. Uses the `Modal` primitive from `components/ui/`.

| Step | Title | Content |
|---|---|---|
| 1 | Name the project | Single text input: project name (Next disabled if empty). Optional: priority selector. **"Base on" toggle** (D4): "Baseline" vs "Current scenario: [name]" — only shown when `activeScenarioId != null`. |
| 2 | Define the need | Quarter selector (multi), rough days required per quarter (one number input per selected quarter), skills needed (multi-select from Skills reference data). |
| 3 | Who can staff it? | Renders `<SmartAssignmentPanel variant="inline" tentativeAssignments={...} onTentativeAssign={...} onTentativeRemove={...} />`. Already-selected members shown with their day allocations and a "Remove" button. |
| 4 | Impact summary | Before/after capacity bar per selected member, per quarter. Before = `calculateCapacity` current result. After = current result minus tentative days. Uses the same `ProgressBar` primitive. |
| 5 | Create scenario | Summary card (project name, assigned members, quarters). "Create Scenario" button. On confirm: calls `createScenarioWithPlan(wizardState)` helper. Shows success toast and switches to new scenario. |

### Dismiss confirmation

When the user closes the wizard (X button, Escape, backdrop click) AND `tentativeAssignments.length > 0`, show a `ConfirmModal`: "You have unsaved staffing selections. Discard and close?" If no tentative assignments: close immediately.

### `createScenarioWithPlan()` helper (Decision D12)

Extract all Step 5 logic into a named helper in `stores/actions.ts`:

```typescript
export function createScenarioWithPlan(plan: {
  name: string;
  description?: string;
  baseOn: 'baseline' | 'active';
  activeScenarioId: string | null;
  project: Omit<Project, 'id' | 'phases'>;
  assignments: TentativeAssignment[];
  quarter: string;
}): { scenarioId: string } | { error: string }
```

**Atomicity (Section 2 error gap):** If any `addAssignment()` call fails after the scenario has been created, call `deleteScenario(scenarioId)` to roll back. Return `{ error: 'Failed to create scenario. Please try again.' }`. Show this message in a toast. Re-enable the "Create Scenario" button so the user can retry.

**Base on logic (D4):**
- `baseOn === 'baseline'` → call `createScenario(name, description)`
- `baseOn === 'active'` → call `duplicateScenario(activeScenarioId, name, description)`. Guard: only reachable if `activeScenarioId != null`.

### Dashboard Nudge Banner (Decision D5 + D13)

**File:** `pages/Dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠  3 team members are at high utilisation this quarter.           │
│     Plan ahead safely before committing.  [Plan it safely →] [✕]  │
└─────────────────────────────────────────────────────────────────────┘
```

**Logic:**
1. Call `getWarnings(state)` (already exists in `utils/capacity.ts`) — filter for `type === 'high' || type === 'overallocated'`. Count distinct affected `memberId`s.
2. If count ≥ 2: show the banner.
3. **Dismiss TTL (D5):** On dismiss, write `{ dismissedAt: Date.now(), memberIds: string[] }` to `localStorage` key `'nudge_high_util_dismissed'`. On mount, check: if `dismissedAt` is within 7 days AND the set of currently high-util member IDs is a subset of the stored `memberIds`, suppress the banner. If a *new* member (not in stored set) tips over 85%, show the banner again even within the 7-day window.
4. **RBAC:** The "Plan it safely →" CTA calls `can('editAssignments')` — if false, render "Contact your IT manager" text instead of the CTA button.
5. Do not show the banner during `isInitializing`.

---

## US-062 — Scenario-Native Planning Board

### Access

- New **"Board"** tab/sub-mode on the Scenarios page, shown only when a scenario is active (`activeScenarioId != null`)
- Tab is **hidden** (not disabled) when no scenario is active
- When no scenario is active: the Board tab is absent; the existing Scenarios page shows an empty-state CTA prompting "Start a planning session" with a button to activate or create a scenario

### Lazy Loading (Decision D6)

The board component and `@dnd-kit/core` must be lazy-loaded:

```typescript
// In Scenarios.tsx
const PlanningBoard = React.lazy(() => import('../components/PlanningBoard'));

// Render:
<Suspense fallback={<div className="flex items-center justify-center h-64"><ProgressBar /></div>}>
  <PlanningBoard />
</Suspense>
```

This keeps `@dnd-kit/core` (~50 KB gz) out of the main bundle.

**Dependencies to add:**

```json
"@dnd-kit/core": "^6.x",
"@dnd-kit/utilities": "^3.x"
```

Add `@dnd-kit/utilities` alongside core — it provides the `CSS.Transform.toString()` helper needed for smooth drag transforms.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Scenario: [My Scenario ▾]    [Promote to Baseline]      │
│  (Promote disabled during syncStatus === 'saving')       │
│  ┌──────── Board ──────────────────────────────────────┐ │
│  │  Quarter: [Q2 2025 ▾]                               │ │
│  │                                                      │ │
│  │  ┌─── Projects ──────────┐  ┌─── Team ────────────┐ │ │
│  │  │ ● Project Alpha       │  │ Alice Chen ████░░ 14d │ │ │
│  │  │   High · 20d needed   │  │ Bob Kumar  ██████  0d │ │ │
│  │  │                       │  │ Carol Lee  ███░░░  8d │ │ │
│  │  │ ● Project Beta        │  │                      │ │ │
│  │  │   Med · 10d needed    │  │ ← drag onto project  │ │ │
│  │  └───────────────────────┘  └──────────────────────┘ │ │
│  │                                                      │ │
│  │  [Select a project to see staffing suggestions]     │ │
│  │  (SmartAssignmentPanel inline when project selected) │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

- **Left panel:** Project cards grouped by the selected quarter. Each card shows name, priority badge, total assigned days vs. days needed. Quarter filter at top using `generateQuarters()`.
- **Right panel:** IT team member rows. Each shows avatar, name, role, mini capacity bar, remaining days. BIZ contacts are intentionally not in the right panel drag area (IT track only for drag — BIZ assignment via SmartAssignmentPanel inline panel).
- **Bottom sidebar:** `<SmartAssignmentPanel variant="inline" />` shown when a project card is selected. The board passes `tentativeAssignments` from a local board state so the panel reflects assignments made during this board session.
- **"Promote to Baseline" button:** Disabled during `syncStatus === 'saving'` to prevent promoting while a write is in flight.

### Drag & Drop

Library: `@dnd-kit/core` + `@dnd-kit/utilities`.

```
BOARD STATE
───────────────────────────────────────────────────────
draggedMemberId: string | null
dragScores: Map<projectId: string, FitLevel>  ← precomputed on dragStart (D6 perf fix)
dropTarget: { projectId: string } | null
popover: { projectId: string; memberId: string; defaultDays: number } | null
selectedProjectId: string | null
tentativeBoardAssignments: TentativeAssignment[]  ← for inline panel re-scoring
```

**Interaction flow:**

1. User drags a member card (right panel) — `onDragStart`:
   - Precompute `scoreMember(member, quarter, p.requiredSkillIds, p.id, state)` for **all** project cards in the current quarter. Store results in `dragScores: Map<projectId, FitLevel>`.
   - Do NOT compute on every `dragOver` event — this is the performance fix.
2. While dragging over a project card — `onDragOver`:
   - Look up `dragScores.get(projectId)` → apply fit border class from `FIT_COLOURS[fitLevel].border`.
3. On drop — `onDrop`:
   - Clear all active borders.
   - Open a lightweight popover anchored to the project card: "How many days?" pre-filled with `Math.max(1, Math.min(5, availableDays))`.
   - Validate: days must be ≥ 1. Disable confirm at 0.
   - Show warning if member is already assigned to this project: "Alice is already assigned to this project in Q2: 5d. Add more days?"
   - On "Assign": call `addAssignment()` → Zustand store updates → capacity bars re-render (reactive).
   - Animate capacity bar update with CSS transition (D9): ensure `ProgressBar`'s fill div has `transition: width 300ms ease`.
   - On Escape / click-away: cancel with no mutation. Clear `dragScores`.
4. `onDragEnd` (whether drop or cancel): clear `dragScores`, clear active borders.

**Keyboard drag:** dnd-kit supports keyboard drag natively (Tab to focus draggable, Space to start drag, arrow keys to navigate, Space/Enter to drop). Ensure `DndContext` is given an `accessibility` prop with a descriptive screen-reader announcement. This is not optional.

**RBAC (D10):** If `can('editAssignments')` is false, member cards in the right panel are non-draggable (`disabled` prop on `useDraggable`). Assign buttons in the inline bottom panel are hidden. The board is read-only for stakeholders.

### Mutations

All assignments go through the existing path:

```
addAssignment() in stores/actions.ts
  → updateData({ assignments: [...] })
  → writes to activeScenarioId's deep copy (never baseline)
  → scheduleSyncToSupabase() debounced 1500ms
```

No new store actions are needed.

### Animated Capacity Bars (Decision D9)

In the right panel member rows and in `ProgressBar` usage within the board, the fill element must have:

```css
transition: width 300ms ease;
```

This is a CSS-only change. If `ProgressBar` does not already support this, add it as a prop `animated?: boolean` defaulting to `false` for backward compatibility, `true` for board usage.

---

## Error Handling Requirements

The following must be implemented explicitly — not left as "todo" items.

| Guard | Location | Implementation |
|---|---|---|
| `state.assignments ?? []` | `calculateCapacity()` | Guard before `.filter()` |
| Days input ≤ 0 | `SmartAssignmentPanel` | Disable Assign button when `days <= 0 \|\| isNaN(days)` |
| Days input > availableDays | `SmartAssignmentPanel` | Amber border + "Overbooked" label; allow submission |
| Double-click Assign | `SmartAssignmentPanel` | Disable button on click; re-enable after store settles |
| `scoreMember` throws | `staffing.ts` | try/catch → `{ fitLevel: 'over', availableDays: 0 }`; `console.error` with `memberId`, `quarter`, `error` |
| Wizard empty name | `ScenarioWizard` Step 1 | Disable Next button |
| Wizard Step 5 partial failure | `createScenarioWithPlan()` | Collect all assignment results; if any fail, call `deleteScenario()` then return `{ error }` |
| Wizard double-submit | `ScenarioWizard` Step 5 | Disable "Create Scenario" on first click; re-enable on error |
| `duplicateScenario(null)` | `createScenarioWithPlan()` | Guard: `baseOn === 'active'` path only reachable when `activeScenarioId != null`; assert this |
| Board drop 0 days | `PlanningBoard` popover | Pre-fill minimum 1; disable confirm at 0 |
| Board promote during sync | `PlanningBoard` | Disable "Promote to Baseline" when `syncStatus === 'saving'` |
| Dashboard nudge during init | `Dashboard.tsx` | Do not render nudge when `isInitializing === true` |
| Dashboard nudge for read-only | `Dashboard.tsx` | `can('editAssignments')` gate on CTA |

---

## Observability

Add the following structured log lines. These are first-class deliverables, not afterthoughts.

```typescript
// staffing.ts — per scoring call (debug only, not info)
console.debug('[staffing] scoreMember', { memberId, quarter, fitLevel, availableDays });

// ScenarioWizard — Step 5
console.info('[wizard] creating scenario', { name, baseOn, tentativeCount: assignments.length });
console.info('[wizard] scenario created', { scenarioId });
console.error('[wizard] scenario creation failed', { error });

// PlanningBoard — each drag assignment
console.info('[board] assignment via drag', { memberId, projectId, quarter, days });
```

---

## Files Affected

| File | Change |
|---|---|
| `frontend/src/utils/capacity.ts` | **Edit** — add `Assignment.days` deduction; guard `state.assignments ?? []` |
| `frontend/src/utils/staffing.ts` | **New** — `scoreMember()`, `scoreBusinessContact()`, `rankMemberFits()`, `FIT_COLOURS`, types |
| `frontend/src/components/SmartAssignmentPanel.tsx` | **New** — IT + BIZ sections; `slideOut` + `inline` variants; already-assigned badge; mini capacity bar; days validation; RBAC gate |
| `frontend/src/components/ScenarioWizard.tsx` | **New** — 5-step wizard; `useReducer` state; "Base on" toggle; dismiss confirm; skill-change resets Step 3 |
| `frontend/src/components/PlanningBoard.tsx` | **New** — 3-panel board; dnd-kit drag & drop; precomputed fit scores; days popover; animated capacity bars; RBAC gate |
| `frontend/src/pages/Scenarios.tsx` | **Edit** — add "Board" tab (hidden when no active scenario); lazy-load `PlanningBoard` with `React.lazy` + `Suspense` |
| `frontend/src/pages/Dashboard.tsx` | **Edit** — contextual nudge banner; reuses `getWarnings()`; 7-day localStorage dismiss TTL |
| `frontend/src/pages/Projects.tsx` | **Edit** — replace "Assign" button trigger with `<SmartAssignmentPanel variant="slideOut" />` |
| `frontend/src/stores/actions.ts` | **Edit** — add `createScenarioWithPlan()` helper (atomic wizard Step 5 with rollback) |
| `frontend/package.json` | **Edit** — add `@dnd-kit/core`, `@dnd-kit/utilities` |
| `frontend/src/utils/capacity.test.ts` | **Edit** — add `Assignment.days` deduction tests |
| `frontend/src/utils/staffing.test.ts` | **New** — full test suite (see specs above) |
| `docs/architecture.md` | **Edit** — update §4.3 Pages (Board sub-mode), §14 Utilities (staffing.ts), §13.2 (token naming note) |

---

## Mockups

Visual mockups must be generated **before coding begins** for each user story. When starting implementation of any feature, use the `GenerateImage` tool to produce the mockups listed below. Mockups should reflect the existing design system: Plus Jakarta Sans typography, `sana-teal` for IT-track elements, navy sidebar, card-based surfaces.

### US-061 — Smart Assignment Panel

- Full panel showing all three fit states (good / partial / over), mini capacity bars, BIZ section collapsed — light mode
- Same panel — dark mode
- Inline variant as embedded inside the US-060 Wizard Step 3 viewport

### US-060 — Narrative Scenario Wizard

- Step 1 — Typeform-style full-screen modal: project name input, priority selector, "Base on" toggle (active scenario present)
- Step 2 — quarter selector + days per quarter + skills multi-select
- Step 3 — inline SmartAssignmentPanel, one member tentatively assigned (showing reduced available days)
- Step 4 — impact summary: before/after capacity bars per member per quarter
- Step 5 — confirm/summary card with "Create Scenario" CTA
- Dashboard contextual nudge banner (above the heatmap)

### US-062 — Planning Board

- Full three-panel board: idle state, no project selected
- Board with a project card selected and the SmartAssignmentPanel sidebar open at the bottom
- A member card mid-drag over a project card, showing the fit-colour border highlight
- The days-input popover anchored to the project card on drop
- Read-only view (stakeholder role): no drag handles, no Assign buttons

---

## Out of Scope

| Item | Rationale |
|---|---|
| Drag & drop between quarters | Too complex for v1; tracked in TODOS.md |
| BIZ contact assignment via Planning Board drag | IT drag only for v1; BIZ via SmartAssignmentPanel inline panel; tracked in TODOS.md |
| Mobile/touch drag & drop | Desktop-first; dnd-kit handles touch scrolling but drag is desktop only |
| E2E tests (Playwright) | Beyond current testing standard; manual smoke tests cover this |
| Feature flags | Not warranted for frontend-only; rely on tests + git revert |
| AI-assisted staffing suggestions | Phase 3 — tracked in TODOS.md (capacity risk report) |
