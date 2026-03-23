# Assignment Panel — Implementation Plan

**Date:** 2026-03-20  
**Status:** Ready for breakdown / sprint planning  
**Spec:** `docs/plans/assign-panel-spec.md`  
**Replaces:** `AssignPopover.tsx` (Timeline mode only; Board mode unchanged per spec §11)

---

## Overview

This plan turns the Assignment Panel spec into **sequential, shippable phases**. Each phase leaves the app runnable. The largest behavioural shifts versus today are:

| Area | Today (`AssignPopover` + `ScenarioPlanner`) | Target (spec) |
|------|---------------------------------------------|---------------|
| **Surface** | Floating popover (`@floating-ui`, `anchorEl`) | Fixed 440px right slide-out, no backdrop |
| **Open trigger** | Popover only when dropping a person on a bar (`preSelectedMemberId`); plain bar click opens **detail panel** | **Bar click** and **row label click** both open Assignment Panel |
| **Persistence** | Every assign / stepper change calls `onItemsChange` immediately | **Draft state** in panel; **Save changes** commits (spec §7) |
| **Timeline drag** | Drop team member onto bar → opens popover | **Removed** — drag = reposition bar only |
| **Backlog** | (Verify) people cards / drag sources if present | **Work items only** in Timeline backlog (spec §10) |

**Estimated stories:** 14–18 (depending on how you split tokens and QA)  
**New primary file:** `frontend/src/components/planner/AssignPanel.tsx`  
**Deprecate (Timeline):** `AssignPopover.tsx` usage from `ScenarioPlanner.tsx` (file can remain for Board or be deleted if unused)

---

## Dependency order

```
Phase 0 — Decisions & tokens
    └─> Phase 1 — Panel shell + page state + canvas compression
            ├─> Phase 2 — Header (item chrome)
            ├─> Phase 3 — Allocation impact grid
            ├─> Phase 4 — Assignee tracks + steppers + remove
            ├─> Phase 5 — Inline person picker
            └─> Phase 6 — Footer (unlock, backlog, save)
                    └─> Phase 7 — Timeline wiring + gesture removal
                            └─> Phase 8 — Backlog cleanup + regression pass
```

---

## Phase 0 — Decisions, tokens, and coexistence

**Goal:** Remove ambiguity before UI work.

### AP-00a · Detail panel vs Assignment Panel

**Problem:** Spec assigns **bar + label click** to the Assignment Panel. Today, `handleBarClick` without `preSelectedMemberId` opens `plannerUI.detailItemId` (slide-out detail). Both surfaces are **right-edge** panels.

**Acceptance criteria:**

1. Document the chosen rule, e.g.:
   - **Option A:** Bar/label primary → Assign Panel; detail only via explicit control (e.g. context menu, kebab, or “Details” link inside Assign Panel header — align with Board spec language if reused).
   - **Option B:** Stack z-index and width so both can be open (higher risk, more QA).
2. Update `ScenarioPlanner.tsx` handlers in Phase 7 to match the decision.
3. `Escape` behaviour is defined: spec requires panel close; confirm whether first Escape closes Assign Panel only or also detail.

### AP-00b · Design tokens vs codebase rules

**Spec** references Sana teal, warm neutrals, and some hex literals. **Project rule** (`.cursor/rules/review-frontend.mdc`): prefer `sana-*`, `util-*`, `biz-*`, or `frontend/src/theme/tokens.ts` — avoid raw hex in components.

**Acceptance criteria:**

1. Add or extend **CSS variables** in `frontend/src/index.css` for panel-only tokens that are not yet in Tailwind (mirror spec names where useful: `--panel-width`, `--track-biz-*`, `--active-bar-outline`, etc.), mapping values to approved palette entries.
2. For BIZ track, use **`theme.extend.colors.biz`** (`biz.light`, `biz.border`, `biz.DEFAULT`) — already aligned in spec §5 / §8.
3. For allocation tiers, align with spec §4 table + §8: `util.*`, `biz.border`, and existing semantic vars (`--whatif-bg`, `--warning-light`, `--danger-light` in `index.css` if present; if missing, add once in `index.css` rather than scattering hex).
4. List any **spec colours that have no token**; either add to `tailwind.config.js` / `index.css` in this phase or log a follow-up ticket.

### AP-00c · HTML prototype

**Spec §Reference** cites `assign-slideout-v1.html` — **not in repo**. Either add it under `docs/prototypes/` or drop the reference from the spec in a doc-only follow-up.

---

## Phase 1 — Panel shell, state, and canvas compression

**Goal:** `AssignPanel` mounts, opens/closes, animates; gantt area gains `padding-right: 440px` when open (spec §1–§2).

### AP-01 · `assignPanelItemId` (or equivalent) in page state

**File:** `frontend/src/pages/ScenarioPlanner.tsx`

**Acceptance criteria:**

1. Replace `assignTarget: { item, anchorEl, preSelectedMemberId }` with state sufficient for the slide-out, e.g.  
   `assignPanel: { itemId: string; preSelectMemberId?: string } | null`  
   (no `anchorEl`; no Floating UI).
2. Derive `item` from `plannerItems` by id (same pattern as current `liveAssignTarget` memo).
3. Clicking **another** bar/label while open updates `itemId` **without** close animation flicker (spec §1).
4. `Escape` and header **✕** clear assign panel state.
5. Assign Panel renders **only** when `plannerUI.activeMode === 'timeline'` (and scenario loaded).

### AP-02 · `AssignPanel.tsx` scaffold

**New file:** `frontend/src/components/planner/AssignPanel.tsx`

**Acceptance criteria:**

1. Layout: fixed `right-0 top-0 bottom-0`, width `440px`, `translateX` transition (spec §2).
2. Structure: sticky header / scrollable body / sticky footer regions (empty placeholders OK).
3. Panel background, left border, shadow per spec §2 (via tokens, not inline hex).
4. **No** `createPortal` to floating anchor; optional portal to `document.body` only if needed for `z-index` stacking — document choice.
5. Focus management: focus moves into panel when opened; `Escape` closes (coordinate with AP-00a).

### AP-03 · Canvas compression

**Files:** `ScenarioPlanner.tsx`, `PlannerTimeline.tsx` (and parent wrappers as needed)

**Acceptance criteria:**

1. When assign panel open, the **timeline canvas + capacity panel** share the compressed width (spec §1 “capacity panel below… compresses”).
2. `transition: padding-right 300ms cubic-bezier(0.16, 1, 0.3, 1)` (or Tailwind arbitrary transition) on the compressing container.
3. No horizontal scrollbar on the page at typical desktop widths (1280+).

---

## Phase 2 — Panel header

**Goal:** Full header per spec §3 (type pill, Jira link, status, lock, title, sprint range, effort pill).

### AP-04 · Header content & data wiring

**Acceptance criteria:**

1. **Type pill** — map `PlannerItem.type` to styles; reuse patterns from `AssignPopover` (`TYPE_PILL`) but migrate to token classes.
2. **Jira link** — `window.open(jiraBaseUrl + key)` when `item.jiraKey` set; styling per spec §3 (tokenised).
3. **Status badge** — map Jira/status string to In Progress / To Do / Done / Blocked (define fallback for unknown).
4. **Lock** — show when `item.locked === true`.
5. **Title** — `item.name`, wrapping, typography per spec.
6. **Sprint range** — `[S7] → [S10]` from `startSprint` / `spanSprints`; duration copy (“N weeks · M sprints”) from sprint metadata if available, else computed or simplified.
7. **Effort pill** — sum of assignees’ `daysPerSprint` (draft state in Phase 4–6); updates live with steppers.

---

## Phase 3 — Allocation impact section

**Goal:** Per-sprint grid, tier colours, overload copy, pulse on recalc (spec §4).

### AP-05 · Grid logic

**Acceptance criteria:**

1. Columns = sprints the item spans (cap UI at 6 visible with horizontal scroll if >6).
2. Per cell: sprint label, **day total** for this item across assignees, **team %** using `teamAvailDays` for that sprint (reuse / extend `calculateCapacity` and existing quarter sprint list — same sources as `AssignPopover` quarter sprints).
3. Tier styling matches spec §4 table (tokens only).
4. Overload warning row when any cell **>100%**, listing sprint labels.
5. On stepper or assignee list change: brief opacity pulse (`150ms`).

### AP-06 · Tests / sanity checks

1. Manual matrix: item spanning 1 / 4 / 7 sprints; 0%, 45%, 75%, 95%, 110% team load.
2. Verify numbers match capacity ticker / `PlannerCapacity` semantics for the same scenario (no double-count rules).

---

## Phase 4 — Assignees section (IT + BIZ tracks)

**Goal:** Two-column track cards, rows, steppers, remove animation (spec §5).

### AP-07 · Draft model for assignees

**Acceptance criteria:**

1. Keep **`draftItem: PlannerItem`** (or `draftAssignees` + id) in `AssignPanel` state, initialised from props when `itemId` changes.
2. Steppers clamp **1–10** `daysPerSprint` (spec §5.1 v1).
3. Remove row: animate `opacity` + `translateX` then drop from draft; optional: parity with current popover **Undo** toast — product call (spec silent on undo).

### AP-08 · Track visuals & rows

**Acceptance criteria:**

1. IT track: spec teal tint (`--track-it-*` via tokens).
2. BIZ track: `biz.light` / `biz.border` / `biz.DEFAULT` for label (spec §5).
3. Avatars, name, role, `−` / `+` stepper, `✕` remove per spec.
4. **Dual track** rule: IT and BIZ assignees from `PlannerAssignment.track`.

---

## Phase 5 — Inline person picker

**Goal:** Expand in place, search, ranked list, add at 2d default, picker stays open (spec §6).

### AP-09 · Picker behaviour

**Acceptance criteria:**

1. `+ Add person` toggles expand; label becomes **Cancel**; `max-height` + opacity animation.
2. Only one of IT/BIZ pickers open at a time.
3. Search filters name + role live.
4. Sort: Good → Partial → Over (`scoreMember` / `scoreBusinessContact` + rank helpers from `utils/staffing.ts`); **graceful degradation** if staffing utils unavailable (spec §6).
5. Exclude already-assigned ids; `avail === 0` section with `opacity` + `pointer-events: none`.
6. Fit badge colours: tokenise (spec table); align with `FIT_COLOURS` where possible.
7. On select: add with `daysPerSprint: 2`, keep picker open.

---

## Phase 6 — Footer actions

**Goal:** Unlock, Backlog, Save (spec §7).

### AP-10 · Wire to `actions.ts`

**Acceptance criteria:**

1. **Unlock** — visible if `item.locked`; calls existing `unlockPlannerItem(item.id)`; then refresh draft from store.
2. **Backlog** — `removePlannerItem(item.id)` (or spec’s `removePlannerItem` — verify signature in `actions.ts`); close panel; confirm behaviour matches “returns to backlog sidebar”.
3. **Save changes** — `updatePlannerLayout(activeScenarioId, items)` with planner items where this item is replaced by **draft**; `"Saved"` flash `200ms`.

### AP-11 · Dirty state (recommended)

1. Disable Save when draft deep-equals server item, or always allow Save idempotently — pick one and test.

---

## Phase 7 — Timeline integration & gesture cleanup

**Goal:** Single interaction model on the canvas (spec §1, §10, §11).

### AP-12 · `PlannerTimeline.tsx`

**Acceptance criteria:**

1. **Bar click** → open Assign Panel (set `assignPanel.itemId`); pass element only if still needed for focus, not for positioning.
2. **Label click** → same as bar (spec §1) — **breaking change** vs current `handleLabelClick` → detail only.
3. Remove **drop-to-assign**: delete or disable code path that calls `onBarClick(..., memberId)` from member drag (search `onBarClick` / `memberId` / `useDroppable` in timeline).
4. **Active highlight:** selected bar `outline` + row tint (spec §1); use tokenised `--active-bar-outline` / row bg.

### AP-13 · Remove `AssignPopover` from Timeline

**File:** `ScenarioPlanner.tsx`

**Acceptance criteria:**

1. Render `<AssignPanel ... />` instead of `<AssignPopover ... />` when timeline assign UI open.
2. Remove unused `anchorEl` / `@floating-ui` dependencies from this path.
3. If `AssignPopover` is **only** used here, delete component and imports; if Board still uses it, keep file and restrict imports.

### AP-14 · Team drawer / drag sources

**Acceptance criteria:**

1. Audit `PlannerTeamDrawer`, `ScenarioPlanner`, and timeline DnD: remove any “drop person on bar” affordances for Timeline.
2. Board mode: **unchanged** per spec §11.

---

## Phase 8 — Backlog & QA

### AP-15 · `PlannerBacklog.tsx`

**Acceptance criteria:**

1. Timeline backlog lists **work items only** — no person cards (spec §10).
2. Confirm Board backlog unaffected if shared component — use `activeMode` or prop to branch.

### AP-16 · Regression checklist

- Capacity ticker + `PlannerCapacity` still update after Save.
- Drag bar reposition / resize unchanged.
- Context menu (edit/delete/unlock) still works on items.
- Keyboard: Escape, focus trap basics.
- RBAC: if assignments are permission-gated elsewhere, mirror gates on Save / steppers / picker (reuse `can('edit_assignments')` or project equivalent).

---

## File touch summary

| Action | Path |
|--------|------|
| **New** | `frontend/src/components/planner/AssignPanel.tsx` (consider subcomponents: `AssignPanelHeader`, `AllocationImpactGrid`, `AssigneeTracks`, `AssignPanelFooter`) |
| **Edit** | `frontend/src/pages/ScenarioPlanner.tsx` — state, handlers, render, canvas class |
| **Edit** | `frontend/src/components/planner/PlannerTimeline.tsx` — clicks, highlight, remove drop-assign |
| **Edit** | `frontend/src/components/planner/PlannerBacklog.tsx` — hide people in timeline |
| **Edit** | `frontend/src/index.css` (and optionally `tailwind.config.js`) — panel + allocation tokens |
| **Remove / narrow** | `frontend/src/components/planner/AssignPopover.tsx` — if unused after merge |
| **Reference** | `frontend/src/stores/actions.ts` — `updatePlannerLayout`, `removePlannerItem`, `unlockPlannerItem`, `addPlannerAssignment` (add may be used inside draft Save) |
| **Reference** | `frontend/src/utils/capacity.ts`, `frontend/src/utils/staffing.ts` |

---

## Out of scope (defer explicitly)

- Board mode Smart Assignment Panel (separate spec).
- Mobile / narrow viewport layout (spec assumes wide screen).
- Stepper max >10 or dynamic cap per member availability (spec “future enhancement”).
- Undo toast parity with old popover (unless PM asks).

---

## Reference links

- Product spec: `docs/plans/assign-panel-spec.md`
- Store actions: `frontend/src/stores/actions.ts` (`updatePlannerLayout`, `removePlannerItem`, `unlockPlannerItem`)
- Current UI to retire in Timeline: `frontend/src/components/planner/AssignPopover.tsx`
