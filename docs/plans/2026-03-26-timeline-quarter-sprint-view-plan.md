# Timeline Quarter / Sprint View — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Quarter/Sprint toggle to the Scenario Planner timeline: Sprint view shows a two-row header (Quarter row above, Sprint row below); Quarter view shows one quarter-per-column with proportionally accurate bars.

**Architecture:** Extend `PlannerTimeline.tsx` with a `TimelineHeader` component (replaces `SprintHeaders`), derive `visibleQuarters` from the existing `visibleSprints`, and add `plannerTimelineViewMode: 'sprint' | 'quarter'` to the Zustand UI state. Bar geometry is unchanged — `barFracs` already returns percentage-of-total-width values that work identically over both column grids.

**Tech Stack:** React 18, Zustand (appStore), Tailwind CSS (mileway tokens), TypeScript — no new dependencies.

---

## Context

### Key files
- `frontend/src/types/index.ts` — add `PlannerTimelineViewMode` type (line ~228 near existing `TimelineViewMode`)
- `frontend/src/stores/appStore.ts` — add field + action + selector (UIState at line 130, actions at line 430+, selectors at line 515+)
- `frontend/src/components/planner/PlannerTimeline.tsx` — all header + toggle changes

### Key constants in `PlannerTimeline.tsx`
```
SPRINT_HEADER_H = 64   (line 48) — height of the sprint row; label column mirrors this
MIN_SPRINT_W = 100      (line 51) — minimum column width for horizontal scroll calc
```

### Key structures
- `visibleSprints: Sprint[]` — rolling window of sprints (line 928–942)
- `SprintHeaders` component — lines 318–372 (to be replaced by `TimelineHeader`)
- `SprintHeaders` usage — lines 1523–1528
- Label header div — lines 1419–1436 (Expand all / Collapse all buttons; toggle goes here)
- `Sprint` type has `.quarter: string` field (e.g. `"Q1 2026"`)

### Important rule (from cursor rules)
Bar colours must use Tailwind token names or named exports from `theme/tokens.ts`. Do NOT hardcode hex values in component files. All new inline colour styles must use CSS variables or the existing `mileway-*` token pattern.

---

## Task 1: Add `PlannerTimelineViewMode` type and store field

**Files:**
- Modify: `frontend/src/types/index.ts` (near line 228)
- Modify: `frontend/src/stores/appStore.ts` (UIState ~line 134, defaultUIState ~line 145, actions ~line 436, selectors ~line 515)

**Step 1: Add the type to `types/index.ts`**

Find the existing `TimelineViewMode` line (~228):
```typescript
export type TimelineViewMode = 'week' | 'month' | 'quarter' | 'year';
```
Add directly below it:
```typescript
export type PlannerTimelineViewMode = 'sprint' | 'quarter';
```

**Step 2: Import the new type in `appStore.ts`**

Find the import block at the top of `appStore.ts` (line ~8–17):
```typescript
import type {
  AppState,
  ViewType,
  Filters,
  EpicFilters,
  SortConfig,
  TeamViewMode,
  TimelineViewMode,
  Settings,
} from '../types';
```
Add `PlannerTimelineViewMode` to the import list.

**Step 3: Add to `UIState` interface (~line 134)**

Add after `timelineViewMode: TimelineViewMode;`:
```typescript
plannerTimelineViewMode: PlannerTimelineViewMode;
```

**Step 4: Add to `defaultUIState` (~line 145)**

Add after `timelineViewMode: 'quarter',`:
```typescript
plannerTimelineViewMode: 'sprint',
```

**Step 5: Add the action (~line 436)**

Find the existing `setTimelineViewMode` action:
```typescript
setTimelineViewMode: (mode) =>
  set((state) => ({ ui: { ...state.ui, timelineViewMode: mode } })),
```
Add directly after it:
```typescript
setPlannerTimelineViewMode: (mode) =>
  set((state) => ({ ui: { ...state.ui, plannerTimelineViewMode: mode } })),
```

**Step 6: Declare action in `AppStore` interface (~line 250)**

Add after `setTimelineViewMode: (mode: TimelineViewMode) => void;`:
```typescript
setPlannerTimelineViewMode: (mode: PlannerTimelineViewMode) => void;
```

**Step 7: Add selector at the bottom of `appStore.ts` (~line 515)**

```typescript
export const usePlannerTimelineViewMode = () => useAppStore((state) => state.ui.plannerTimelineViewMode);
```

**Step 8: Check for linter errors**

Run: check `frontend/src/stores/appStore.ts` and `frontend/src/types/index.ts` with ReadLints.
Expected: no errors.

**Step 9: Commit**

```
git add frontend/src/types/index.ts frontend/src/stores/appStore.ts
git commit -m "feat: add PlannerTimelineViewMode type and store field"
```

---

## Task 2: Add constants and `visibleQuarters` derivation to `PlannerTimeline.tsx`

**Files:**
- Modify: `frontend/src/components/planner/PlannerTimeline.tsx`

**Step 1: Import the new type and store selector**

At the top of `PlannerTimeline.tsx`, find the existing store import:
```typescript
import { useCurrentState } from '../../stores/appStore';
```
Replace with:
```typescript
import { useCurrentState, usePlannerTimelineViewMode, useAppStore } from '../../stores/appStore';
```

**Step 2: Add `QUARTER_ROW_H` constant (~line 51, after `MIN_SPRINT_W`)**

```typescript
const QUARTER_ROW_H = 24;
const MIN_QUARTER_W = 160;
```

**Step 3: Define the `VisibleQuarter` type (after the constants block, before `BAR`)**

```typescript
interface VisibleQuarter {
  label: string;
  startIdx: number;
  sprintCount: number;
}
```

**Step 4: Add `visibleQuarters` memo inside the `PlannerTimeline` component**

Find the existing `visibleSprintCount` line (~line 944):
```typescript
const visibleSprintCount = Math.max(visibleSprints.length, 1);
const firstSprintNum = visibleSprints[0]?.number ?? 1;
```
Add directly after those two lines:
```typescript
const plannerTimelineViewMode = usePlannerTimelineViewMode();

const visibleQuarters = useMemo((): VisibleQuarter[] => {
  const result: VisibleQuarter[] = [];
  for (let i = 0; i < visibleSprints.length; i++) {
    const label = visibleSprints[i].quarter ?? '';
    const last = result[result.length - 1];
    if (last && last.label === label) {
      last.sprintCount++;
    } else {
      result.push({ label, startIdx: i, sprintCount: 1 });
    }
  }
  return result;
}, [visibleSprints]);
```

**Step 5: Check for linter errors**

Run ReadLints on `PlannerTimeline.tsx`.
Expected: no errors (new const and memo only).

**Step 6: Commit**

```
git add frontend/src/components/planner/PlannerTimeline.tsx
git commit -m "feat: derive visibleQuarters from visibleSprints in PlannerTimeline"
```

---

## Task 3: Build `TimelineHeader` component (replaces `SprintHeaders`)

**Files:**
- Modify: `frontend/src/components/planner/PlannerTimeline.tsx`

**Step 1: Replace the `SprintHeaders` function (lines 318–372)**

Delete the entire `SprintHeaders` function and replace with:

```typescript
// ── TimelineHeader ────────────────────────────────────────────────────────────

function QuarterRow({
  quarters,
  totalSprints,
  dragOverQuarterLabel,
}: {
  quarters: VisibleQuarter[];
  totalSprints: number;
  dragOverQuarterLabel: string | null;
}) {
  return (
    <div className="flex border-b border-mileway-border" style={{ height: QUARTER_ROW_H, background: 'var(--color-mileway-bg, #F8FAFC)' }}>
      {quarters.map(q => {
        const isOver = dragOverQuarterLabel === q.label;
        const widthPct = (q.sprintCount / totalSprints) * 100;
        return (
          <div
            key={q.label}
            style={{ width: `${widthPct}%` }}
            className={[
              'flex-shrink-0 flex items-center px-3 border-r border-mileway-border last:border-r-0',
              isOver ? 'text-mileway-blue' : 'text-mileway-grey',
            ].join(' ')}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {q.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function QuarterHeaders({
  quarters,
  totalSprints,
  dragOverQuarterLabel,
  currentQuarterLabel,
}: {
  quarters: VisibleQuarter[];
  totalSprints: number;
  dragOverQuarterLabel: string | null;
  currentQuarterLabel: string | null;
}) {
  return (
    <div className="flex border-b border-mileway-border bg-white" style={{ height: SPRINT_HEADER_H }}>
      {quarters.map(q => {
        const isCurrent = q.label === currentQuarterLabel;
        const isOver = dragOverQuarterLabel === q.label;
        const widthPct = (q.sprintCount / totalSprints) * 100;
        return (
          <div
            key={q.label}
            style={{
              width: `${widthPct}%`,
              borderTop: isCurrent ? '3px solid var(--color-mileway-blue, #2558C9)' : '3px solid transparent',
            }}
            className={[
              'flex-shrink-0 relative px-3 border-r border-mileway-border last:border-r-0 transition-colors duration-fast',
              'flex flex-col justify-center gap-1',
              isOver ? 'bg-mileway-blue-10' : '',
            ].join(' ')}
          >
            <span
              style={{ fontSize: 14 }}
              className={['font-bold leading-none', isOver ? 'text-mileway-blue' : 'text-mileway-text'].join(' ')}
            >
              {q.label}
            </span>
            <span style={{ fontSize: 10 }} className="text-mileway-grey leading-none">
              {q.sprintCount} sprint{q.sprintCount !== 1 ? 's' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SprintHeaders({
  sprints,
  sprintCount,
  dragOverNum,
  currentSprintNum,
}: {
  sprints: Sprint[];
  sprintCount: number;
  dragOverNum: number | null;
  currentSprintNum: number | null;
}) {
  return (
    <div className="flex border-b border-mileway-border bg-white" style={{ height: SPRINT_HEADER_H }}>
      {sprints.map(s => {
        const isCurrent = s.number === currentSprintNum;
        return (
          <div
            key={s.id}
            style={{ width: `${100 / sprintCount}%` }}
            className={[
              'flex-shrink-0 relative px-3 border-r border-mileway-border last:border-r-0 transition-colors duration-fast',
              'flex flex-col justify-center gap-0.5',
              dragOverNum === s.number ? 'bg-mileway-blue-10' : '',
            ].join(' ')}
          >
            {isCurrent && (
              <span
                style={{ fontSize: 9, letterSpacing: '0.06em' }}
                className="absolute top-1.5 left-2 uppercase font-bold bg-mileway-blue text-white px-1 py-0.5 rounded leading-none"
              >
                Current
              </span>
            )}
            <span
              style={{ fontSize: 12.5, marginTop: isCurrent ? 14 : 0 }}
              className={['font-bold leading-none', dragOverNum === s.number ? 'text-mileway-blue' : 'text-mileway-text'].join(' ')}
            >
              {s.name}
            </span>
            {s.startDate && s.endDate && (
              <span
                style={{ fontSize: 10, fontFamily: 'monospace' }}
                className="text-mileway-grey truncate leading-none"
              >
                {formatSprintRange(s.startDate, s.endDate)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineHeader({
  viewMode,
  sprints,
  sprintCount,
  quarters,
  dragOverNum,
  currentSprintNum,
  currentQuarterLabel,
}: {
  viewMode: 'sprint' | 'quarter';
  sprints: Sprint[];
  sprintCount: number;
  quarters: VisibleQuarter[];
  dragOverNum: number | null;
  currentSprintNum: number | null;
  currentQuarterLabel: string | null;
}) {
  const dragOverQuarterLabel = dragOverNum !== null
    ? (sprints.find(s => s.number === dragOverNum)?.quarter ?? null)
    : null;

  if (viewMode === 'quarter') {
    return (
      <QuarterHeaders
        quarters={quarters}
        totalSprints={sprintCount}
        dragOverQuarterLabel={dragOverQuarterLabel}
        currentQuarterLabel={currentQuarterLabel}
      />
    );
  }

  return (
    <>
      <QuarterRow
        quarters={quarters}
        totalSprints={sprintCount}
        dragOverQuarterLabel={dragOverQuarterLabel}
      />
      <SprintHeaders
        sprints={sprints}
        sprintCount={sprintCount}
        dragOverNum={dragOverNum}
        currentSprintNum={currentSprintNum}
      />
    </>
  );
}
```

**Step 2: Check for linter errors**

Run ReadLints on `PlannerTimeline.tsx`.
Expected: no errors.

**Step 3: Commit**

```
git add frontend/src/components/planner/PlannerTimeline.tsx
git commit -m "feat: add TimelineHeader with quarter row for sprint view and quarter columns for quarter view"
```

---

## Task 4: Wire `TimelineHeader` into the render + update label header height

**Files:**
- Modify: `frontend/src/components/planner/PlannerTimeline.tsx`

**Step 1: Compute `currentQuarterLabel` inside the component**

Find the `currentSprintNum` / `todayLinePercent` useMemo (~line 975). Add directly after it (after the closing `}, [visibleSprints, visibleSprintCount]);` line):

```typescript
const currentQuarterLabel = useMemo(() => {
  if (currentSprintNum === null) return null;
  return visibleSprints.find(s => s.number === currentSprintNum)?.quarter ?? null;
}, [currentSprintNum, visibleSprints]);
```

**Step 2: Compute effective header height**

After the `currentQuarterLabel` memo, add:
```typescript
const headerH = plannerTimelineViewMode === 'sprint'
  ? SPRINT_HEADER_H + QUARTER_ROW_H
  : SPRINT_HEADER_H;
```

**Step 3: Replace `<SprintHeaders …/>` usage with `<TimelineHeader …/>` (~line 1523)**

Find:
```tsx
<SprintHeaders
  sprints={visibleSprints}
  sprintCount={visibleSprintCount}
  dragOverNum={dragOverNum}
  currentSprintNum={currentSprintNum}
/>
```
Replace with:
```tsx
<TimelineHeader
  viewMode={plannerTimelineViewMode}
  sprints={visibleSprints}
  sprintCount={visibleSprintCount}
  quarters={visibleQuarters}
  dragOverNum={dragOverNum}
  currentSprintNum={currentSprintNum}
  currentQuarterLabel={currentQuarterLabel}
/>
```

**Step 4: Update the label header height to match**

Find the label header div (~line 1420):
```tsx
style={{ height: SPRINT_HEADER_H }}
```
Replace with:
```tsx
style={{ height: headerH }}
```

**Step 5: Update the canvas `minWidth` calculation (~line 1519)**

Find:
```tsx
<div style={{ minWidth: visibleSprintCount * MIN_SPRINT_W }}>
```
Replace with:
```tsx
<div style={{ minWidth: plannerTimelineViewMode === 'quarter'
  ? visibleQuarters.length * MIN_QUARTER_W
  : visibleSprintCount * MIN_SPRINT_W }}>
```

**Step 6: Check for linter errors**

Run ReadLints on `PlannerTimeline.tsx`.
Expected: no errors.

**Step 7: Commit**

```
git add frontend/src/components/planner/PlannerTimeline.tsx
git commit -m "feat: wire TimelineHeader into PlannerTimeline render, update label and canvas heights"
```

---

## Task 5: Add the Sprint | Quarter toggle in the label header

**Files:**
- Modify: `frontend/src/components/planner/PlannerTimeline.tsx`

**Step 1: Read the `setPlannerTimelineViewMode` action inside the component**

Find where `usePlannerTimelineViewMode()` is already called (~Task 2 Step 4). Directly after it, add:
```typescript
const setPlannerTimelineViewMode = useAppStore(s => s.setPlannerTimelineViewMode);
```

**Step 2: Add the toggle button group to the label header**

Find the label header section (~line 1420):
```tsx
<div
  className="flex-shrink-0 flex items-end gap-1 px-2 pb-1.5 border-b border-mileway-border bg-mileway-bg"
  style={{ height: SPRINT_HEADER_H }}
>
  <button
    onClick={() => { setExpandAll(true); setExpandedIds(new Set()); }}
    ...
  >
    Expand all
  </button>
  <button
    onClick={() => { setExpandAll(false); setExpandedIds(new Set()); }}
    ...
  >
    Collapse all
  </button>
</div>
```

Update the outer `div` height to use `headerH` (already done in Task 4), then add the toggle after the two existing buttons:
```tsx
{/* Sprint | Quarter view toggle */}
<div className="ml-auto flex rounded border border-mileway-border overflow-hidden" style={{ fontSize: 11 }}>
  {(['sprint', 'quarter'] as const).map(mode => (
    <button
      key={mode}
      onClick={() => setPlannerTimelineViewMode(mode)}
      className={[
        'px-2 py-0.5 font-medium capitalize transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
        plannerTimelineViewMode === mode
          ? 'bg-mileway-blue text-white'
          : 'text-mileway-grey hover:text-mileway-text hover:bg-white',
      ].join(' ')}
    >
      {mode}
    </button>
  ))}
</div>
```

**Step 3: Check for linter errors**

Run ReadLints on `PlannerTimeline.tsx`.
Expected: no errors.

**Step 4: Manual smoke test**

1. Open the app, navigate to Scenario Planner → Timeline view.
2. Verify Sprint view default: two-row header — Quarter row on top (compact, uppercase label), Sprint row below with sprint names and date ranges.
3. Click "Quarter" toggle → header collapses to single quarter columns; bars stay proportionally positioned.
4. Click "Sprint" toggle → returns to two-row sprint header.
5. Drag an item — drag-over highlight works in both modes.
6. Reload the page — the selected mode should persist (stored in Zustand UI state).

**Step 5: Commit**

```
git add frontend/src/components/planner/PlannerTimeline.tsx
git commit -m "feat: add Sprint/Quarter toggle to PlannerTimeline label header"
```

---

## Done

The feature is complete when all 5 tasks are committed. Summary of changes:
- **`types/index.ts`**: +1 type (`PlannerTimelineViewMode`)
- **`appStore.ts`**: +1 UIState field, +1 action, +1 selector
- **`PlannerTimeline.tsx`**: +3 sub-components (`QuarterRow`, `QuarterHeaders`, `TimelineHeader`), `SprintHeaders` retained as internal helper, toggle button in label header, `visibleQuarters` memo, `headerH` derived value, `minWidth` updated
