---
name: review-frontend
description: Runs a focused best-practices review on the frontend layer of the Capacity Planner app — React components, Zustand state management, UX/UI patterns, accessibility, TypeScript quality, and performance. Use when asked to review the frontend, UI, UX, components, store, or general code quality.
---

# Frontend Review Agent

## Scope

This review covers:
1. **UX / UI** — interaction patterns, accessibility, error states, loading states
2. **React / Components** — component size, hook usage, render performance
3. **State management** — Zustand store discipline, selector usage
4. **TypeScript** — type safety, `types/index.ts` discipline
5. **General** — code quality, naming, dead code, testing gaps

## How to run this review

Work through each section. Rate each finding:
- 🔴 **Critical** — user-facing bug, security leak, or re-render loop
- 🟡 **Improvement** — best-practice gap; fix before next release
- 🟢 **Nice to have** — optional quality improvement

---

## 1. State management review

Read: `frontend/src/stores/appStore.ts`, `frontend/src/stores/actions.ts`

Check for:
- [ ] Components use typed selectors (`useSettings`, `useTeamMembers`, etc.) — not inline `useAppStore(s => s.data.X)` for object/array slices
- [ ] Object/array selectors are wrapped with `useShallow` (required for React 19 / `useSyncExternalStore`)
- [ ] No component calls `useAppStore.getState().updateData()` directly — all mutations go through `actions.ts`
- [ ] UI-only state (modal open, form values) stays in component `useState`, not in the Zustand store
- [ ] `getCurrentState()` is not called in render hot-paths — use `useCurrentState()` selector instead
- [ ] Scenario-aware fields (`projects`, `teamMembers`, `assignments`, `timeOff`, `jiraWorkItems`) are only mutated through `updateData` (which handles scenario routing)

---

## 2. Component quality review

Scan: `frontend/src/components/`, `frontend/src/pages/`

Check for:
- [ ] No component exceeds ~200 lines without a clear reason; extract sub-components or hooks where applicable
- [ ] Reusable logic (used in 2+ components) is in `hooks/`
- [ ] Event handlers on frequently-re-rendering elements (Gantt rows, list items) use `useCallback`
- [ ] Expensive derived values use `useMemo`
- [ ] The dual IT/BIZ track model is preserved — every feature showing assignments must render both tracks

Gantt-specific:
- [ ] No Gantt row has `overflow: hidden` (breaks clip-arrow pseudo-elements)
- [ ] Bar colours are read from `BAR` constant in `JiraGantt.tsx`, not CSS variables
- [ ] `barLayout()` output applied as `${value * 100}%` (not pixels)

---

## 3. UX / Accessibility review

Check across all pages:
- [ ] Every interactive element has a visible focus ring (`focus:ring-2 focus:ring-mw-blue` or equivalent)
- [ ] Modal dialogs trap focus and close on `Escape` — use `Modal` primitive from `components/ui/`
- [ ] Loading states show a skeleton or spinner, never a blank space
- [ ] Error states offer a recovery action (retry / dismiss); no raw Supabase/Jira errors shown to users
- [ ] Empty states have a helpful message and a call-to-action (e.g. "No team members yet — Add one")
- [ ] Keyboard shortcuts `1`–`6` (view navigation) and `Ctrl+K` (command palette) are not shadowed by new components
- [ ] Dark mode (`settings.darkMode`) respected with Tailwind `dark:` variant — no `document.body.classList` manipulation in components

---

## 4. Styling review

Check: `frontend/src/index.css`, `frontend/tailwind.config.js`, component files

- [ ] No hardcoded hex colours in component code — use Tailwind tokens (`mw-blue`, `mw-purple`, `mw-grey`, etc.)
- [ ] Custom CSS in `index.css` only for things Tailwind cannot express
- [ ] No duplicate utility class strings that should be a shared component
- [ ] `App.css` is confirmed unused (legacy file) — can be deleted

---

## 5. TypeScript quality review

Check: `frontend/src/types/index.ts` and all `.tsx`/`.ts` files

- [ ] No local interface definitions that duplicate or partially mirror `types/index.ts`
- [ ] No `as unknown as X` casts without an explanatory comment
- [ ] `type` used for unions/intersections; `interface` for extensible object shapes
- [ ] No `any` unless unavoidable (e.g. `catch (e: unknown)` is correct; `const x: any` is not)
- [ ] All async functions that can fail have `try/catch` with typed error handling

---

## 6. General / Code quality review

- [ ] No `console.log` or `console.error` in production-shipped code paths (use a logger wrapper or remove)
- [ ] No commented-out code blocks older than the current sprint
- [ ] `App.css` (legacy, unused) — flag for deletion
- [ ] No `TODO` comments without a linked issue or ticket reference
- [ ] View routing uses `ViewType` string enum — no magic strings in new code
- [ ] `js/app.js` at repo root is the old monolith prototype — should not be imported by any frontend source

Testing gaps (flag all):
- [ ] Zero test coverage currently — recommend Vitest for utils, Playwright for E2E
- [ ] `sprints.ts`, `capacity.ts`, `confidence.ts` are pure functions — ideal candidates for unit tests
- [ ] `supabaseSync.ts` has complex serialisation logic — integration test against local Supabase

---

## Output format

```markdown
# Frontend Review — [date]

## Summary
[1–3 sentences: overall health, top concern]

## Critical findings
[list with file + line reference]

## Improvements
[list with file + line reference]

## Nice to have
[list]

## No issues found in
[list of areas that passed]
```

## Additional reference
- See `.cursor/rules/review-frontend.mdc` for the persistent guardrails that enforce these standards on every edit.
