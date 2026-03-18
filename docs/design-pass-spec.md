# Design Pass — Mileway Brand + Remove Dark Mode
## Implementation Spec for Claude Code

---

## Context

Read `docs/design-preferences.md` before starting. That file is the source of truth
for all colour and font decisions in this pass.

This is a **visual-only pass**. You are not changing any logic, data, or behaviour.
If a change would touch a utility function, store, or service — stop and flag it instead.

---

## Your Constraints

- Do not change any logic, state, or data fetching
- Do not rename any CSS classes referenced in TypeScript files as strings
- Do not remove any Tailwind classes that control layout, spacing, or sizing
- When removing a `dark:` class, remove only the `dark:` variant — keep the base class
- After every file, confirm no TypeScript errors were introduced

---

## Phase 1 — Font (do this first)

### 1.1 — `frontend/index.html`

Replace the Google Fonts link:
```html
<!-- Remove this -->
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans...">

<!-- Add this -->
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### 1.2 — `frontend/tailwind.config.js`

Update font family and colour tokens. Remove `darkMode: 'class'`, replace with `darkMode: false`.

```js
fontFamily: {
  sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
},
colors: {
  // Mileway brand
  mileway: {
    blue:        '#0089DD',
    'blue-20':   '#CCE4F9',
    'blue-10':   '#E6F2FC',
    grey:        '#94A3B8',
    'grey-10':   '#F0F2F5',
    text:        '#1E293B',
    border:      '#DEDFE3',
    divider:     '#F0F2F5',
    bg:          '#F5F8FC',
  },
  // Keep legacy keys pointing to new values so existing classes still resolve
  mw: {
    primary:         '#0089DD',
    'primary-light': '#E6F2FC',
    dark:            '#1E293B',
    grey:            '#94A3B8',
    'grey-light':    '#DEDFE3',
    'grey-lighter':  '#F5F8FC',
  },
}
```

---

## Phase 2 — Sidebar

### `frontend/src/components/layout/Sidebar.tsx`

The sidebar must be white and light — not dark.

- Root element background: `bg-white`
- Right border: `border-r border-[#DEDFE3]`
- Active nav item: `bg-[#E6F2FC] text-[#0089DD] border-l-[3px] border-[#0089DD]`
- Inactive nav item: `text-[#94A3B8] hover:bg-[#F5F8FC]`
- Logo/brand text: `text-[#1E293B] font-semibold`
- Internal dividers: `border-[#DEDFE3]`
- Remove all `dark:` variants from this file

---

## Phase 3 — Remove Purple Everywhere

Search across `frontend/src/`:
```
grep -rn "purple\|#7C3AED\|#9B6EE2\|#FAF5FF\|biz-purple" frontend/src/
```

Replace all matches:

| Was | Replace with |
|---|---|
| bg-purple-* | bg-[#F0F2F5] |
| text-purple-* | text-[#94A3B8] |
| border-purple-* | border-[#DEDFE3] |
| bg-[#7C3AED] | bg-[#F0F2F5] |
| text-[#7C3AED] | text-[#94A3B8] |
| bg-[#FAF5FF] | bg-[#F0F2F5] |
| bg-[#9B6EE2] | bg-[#94A3B8] |

---

## Phase 4 — Remove Dark Mode Classes

Search: `grep -rn "dark:" frontend/src/`

For every `dark:` class found: remove the `dark:` variant, keep the base class.

Priority files:
1. `frontend/src/pages/Dashboard.tsx`
2. `frontend/src/pages/Timeline.tsx`
3. `frontend/src/pages/Projects.tsx`
4. `frontend/src/components/JiraGantt.tsx`
5. `frontend/src/components/JiraHierarchyTree.tsx`
6. `frontend/src/components/ui/` — all files
7. `frontend/src/components/layout/` — all files

### `frontend/src/App.tsx`

Remove the dark mode toggle logic:
- Remove `classList.add('dark')` / `classList.remove('dark')` calls
- Remove any `useEffect` watching a `darkMode` setting
- Do not touch the `darkMode` field in the data model

---

## Phase 5 — Update Legacy Colour Classes

Replace throughout `frontend/src/`:

| Legacy | Replace with |
|---|---|
| bg-slate-50 | bg-[#F5F8FC] |
| bg-slate-100 | bg-[#F0F2F5] |
| bg-slate-200 | bg-[#DEDFE3] |
| border-slate-200 | border-[#DEDFE3] |
| border-slate-300 | border-[#DEDFE3] |
| text-slate-400 | text-[#94A3B8] |
| text-slate-500 | text-[#94A3B8] |
| text-slate-600 | text-[#94A3B8] |
| text-slate-700 | text-[#1E293B] |
| text-slate-800 | text-[#1E293B] |
| text-slate-900 | text-[#1E293B] |
| bg-slate-800 | bg-[#1E293B] |
| bg-slate-900 | bg-[#1E293B] |
| text-[#003565] | text-[#1E293B] |
| bg-[#003565] | bg-[#1E293B] |
| border-[#003565] | border-[#DEDFE3] |

---

## Phase 6 — Gantt Bar Colours

In `frontend/src/components/JiraGantt.tsx`, update the `BAR` constant only:

```typescript
const BAR = {
  epic:      { fill: 'rgba(0,137,221,0.10)', border: '#0089DD', borderWidth: 2 },
  feature:   { fill: '#CCE4F9',              border: '#0089DD', borderWidth: 1 },
  story:     { fill: '#F0F2F5',              border: '#DEDFE3', borderWidth: 1 },
  task:      { fill: '#F0F2F5',              border: '#DEDFE3', borderWidth: 1 },
  bug:       { fill: '#FEE2E2',              border: '#DC2626', borderWidth: 1 },
  uat:       { fill: '#E6F2FC',              border: '#94A3B8', borderWidth: 1 },
  hypercare: { fill: '#CCE4F9',              border: '#0089DD', borderWidth: 1 },
}
```

Do not change anything else in this file.

---

## Phase 7 — Dashboard Specific Fixes

### Jira Baseline banner
Find the banner that shows "Jira Baseline — changes may be overwritten by sync."
- Remove any red colour classes
- Apply: `bg-[#FEF9C3] border-l-4 border-[#D97706] text-[#1E293B]`

### Create Scenario button / any orange buttons
Find any button using orange classes (`bg-orange-*`, `bg-[#F97316]`, or similar).
- Replace with: `bg-[#0089DD] text-white`

### Heatmap table header row
Find the dark header row in the capacity heatmap table.
- Remove dark background classes
- Apply: `bg-[#F5F8FC] text-[#94A3B8]`
- Headers: 11px, weight 600, uppercase

### Heatmap borders
Find any thick or dark borders on the heatmap grid.
- Replace with: `border border-[#DEDFE3]`
- Never use border-2 or darker colours on the heatmap

### Alerts section
Find the alerts/warnings section on the dashboard.
- Icon: use `text-[#D97706]` for warning icon — not red, not orange-600
- Pill/badge: `bg-[#FEF9C3] text-[#D97706]` for warning badges
- Make sure text inside badges is readable — minimum 11px weight 600

### Capacity bank pills
Find the pills/badges showing BAU, Leave, Epics in the capacity cards.
- Simplify: show as plain text labels with a small coloured dot instead of pills
- Format: `● BAU  ● Leave  ● Epics` in 12px #94A3B8
- Dots: 6px circles in the appropriate colour

---

## Phase 8 — Spacing Audit

After colours are done, audit every page for cramped spacing.

| If you see | Replace with |
|---|---|
| p-3 or p-4 on a card | p-6 |
| p-2 or p-3 on a page section | px-8 py-8 |
| gap-3 or gap-4 between cards | gap-6 |
| mb-2 or mb-3 after a section title | mb-6 |
| space-y-2 or space-y-3 in a form | space-y-5 |
| py-1 or py-1.5 on table rows | py-3 |

Pages to audit:
1. Dashboard.tsx
2. Projects.tsx
3. Timeline.tsx
4. Team.tsx
5. Scenarios.tsx
6. Settings.tsx

---

## Verification Checklist

- [ ] npx tsc --noEmit — zero errors
- [ ] grep -rn "dark:" frontend/src/ — zero results
- [ ] grep -rn "purple\|#7C3AED" frontend/src/ — zero results
- [ ] grep -rn "#003565\|#6C7A89" frontend/src/ — zero results
- [ ] grep -rn "Plus Jakarta" frontend/ — zero results
- [ ] grep -rn "DM Sans" frontend/index.html — found
- [ ] Sidebar is white with blue active state
- [ ] Primary buttons are #0089DD
- [ ] Page backgrounds are #F5F8FC
- [ ] Cards are white with #DEDFE3 border
- [ ] Heatmap headers are light grey, not dark
- [ ] Heatmap borders are thin and subtle
- [ ] Jira Baseline banner is amber, not red
- [ ] Create Scenario button is blue, not orange
- [ ] No orange anywhere except status indicators
- [ ] App runs without console errors: npm run dev

---

## End of Session

1. Add entry to docs/CHANGELOG.md:
   "Design pass — DM Sans font, Mileway brand palette, removed dark mode, removed purple"
2. Run: git add -A && git commit -m "design(global): DM Sans, brand palette, remove dark mode"