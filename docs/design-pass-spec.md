# Design Pass — Mileway Brand + Remove Dark Mode
## Implementation Spec for Claude Code

---

## Context

Read `docs/design-preferences.md` before starting. That file is the source of truth
for all colour decisions in this pass.

This is a **visual-only pass**. You are not changing any logic, data, or behaviour.
If a change would touch a utility function, store, or service — stop and flag it instead.

---

## Your Constraints

- Do not change any logic, state, or data fetching
- Do not rename any CSS classes that are referenced in TypeScript files as strings
- Do not remove any Tailwind classes that control layout, spacing, or sizing
- When removing a `dark:` class, remove only the `dark:` variant — keep the base class
- After every file, run `npx tsc --noEmit` to confirm no type errors were introduced

---

## Phase 1 — Foundation (do this first, everything else depends on it)

### 1.1 — `frontend/tailwind.config.js`

Replace the existing colour theme with the official Mileway brand tokens.
Keep all existing keys that other files reference — just update the values.

Add these colours under `theme.extend.colors`:

```js
mileway: {
  'light-blue':    '#0089DD',
  'light-blue-50': '#80C4EE',
  'light-blue-30': '#B3D9F5',
  'light-blue-20': '#CCE4F9',
  'light-blue-10': '#E6F2FC',
  'dark-blue':     '#003565',
  'dark-blue-50':  '#809AB2',
  'dark-blue-30':  '#B3C2CF',
  'dark-blue-20':  '#CCD3DC',
  'dark-blue-10':  '#E6EAF0',
  'cool-grey':     '#6C7A89',
  'cool-grey-50':  '#B5BDC4',
  'cool-grey-30':  '#CFCFD5',
  'cool-grey-20':  '#DEDFE3',
  'cool-grey-10':  '#EEEEF1',
  'off-white':     '#F5F8FC',
},
```

Also update the legacy `mw` and `sana` colour keys to point to the new values
so existing classes still resolve:

```js
// Map legacy tokens to new brand values
mw: {
  primary:         '#0089DD',  // was already correct
  dark:            '#003565',  // update
  grey:            '#6C7A89',  // update
  'grey-light':    '#CFCFD5',  // update to cool-grey-30
  'grey-lighter':  '#EEEEF1',  // update to cool-grey-10
  'primary-light': '#E6F2FC',  // update to light-blue-10
},
```

Remove `darkMode: 'class'` from the config root. Replace with `darkMode: false`.

### 1.2 — `frontend/src/index.css`

Remove all CSS custom properties that are dark-mode-only (any variable defined
inside a `.dark` selector or `[data-theme="dark"]` block).

Remove the `.dark` class toggle logic if it exists here.

Update these CSS custom properties to use the brand values:

```css
:root {
  --color-primary:      #0089DD;
  --color-primary-dark: #003565;
  --color-grey:         #6C7A89;
  --color-border:       #CFCFD5;
  --color-bg:           #F5F8FC;
  --color-surface:      #FFFFFF;
  --color-text:         #003565;
  --color-text-muted:   #6C7A89;
  --today-line:         #DC2626;
  --current-sprint-bg:  #E6F2FC;
}
```

Remove any remaining `.dark` CSS blocks entirely.

---

## Phase 2 — Sidebar

### 2.1 — `frontend/src/components/layout/Sidebar.tsx`

The sidebar must be light — white background with subtle grey inactive text,
matching the reference screenshot style.

**Background:** `bg-white`

**Right border:** `border-r border-[#CFCFD5]` — separates sidebar from main content

**Nav items — inactive:** Cool Grey text, no background, subtle hover.
Replace current classes with `text-[#6C7A89] hover:bg-[#F5F8FC]`.

**Nav items — active:** Light Blue tint background + Light Blue text + left accent line.
Replace current active classes with:
`bg-[#E6F2FC] text-[#0089DD] border-l-[3px] border-[#0089DD]`

**Remove all `dark:` variants** from this file — they are no longer needed.

**Logo/brand area:** Dark Blue text on white — `text-[#003565]`.

**Borders and dividers inside the sidebar:** `border-[#CFCFD5]`.

---

## Phase 3 — Remove All Purple (BIZ Track)

Purple was previously used for the BIZ track. Find and replace in these files:

### 3.1 — Files to search

Run this search across the entire `frontend/src/` directory:
```
grep -rn "purple\|#7C3AED\|#9B6EE2\|violet\|biz-purple" frontend/src/
```

### 3.2 — Replacement rules

| Was | Replace with | Reason |
|---|---|---|
| `bg-purple-*` | `bg-[#EEEEF1]` (cool-grey-10) | BIZ section background |
| `text-purple-*` | `text-[#6C7A89]` (cool-grey) | BIZ labels |
| `border-purple-*` | `border-[#CFCFD5]` (cool-grey-30) | BIZ borders |
| `bg-[#7C3AED]` | `bg-[#EEEEF1]` | BIZ background |
| `text-[#7C3AED]` | `text-[#6C7A89]` | BIZ text |
| `border-[#7C3AED]` | `border-[#CFCFD5]` | BIZ border |
| `bg-[#FAF5FF]` | `bg-[#EEEEF1]` | BIZ panel tint |
| `bg-[#9B6EE2]` | `bg-[#6C7A89]` | UAT bar colour (keep as grey) |

### 3.3 — BIZ vs IT visual distinction

In any component showing both IT and BIZ sections side by side (slide-out panel,
assignment rows), apply:
- IT section: `bg-[#E6F2FC]` (light-blue-10) with a small "IT" label in `text-[#6C7A89]`
- BIZ section: `bg-[#EEEEF1]` (cool-grey-10) with a small "BIZ" label in `text-[#6C7A89]`

---

## Phase 4 — Remove Dark Mode Classes Everywhere

Run this search to find all remaining dark mode classes:
```
grep -rn "dark:" frontend/src/
```

For every `dark:` class found:
- Remove the `dark:` variant entirely
- Keep the base (light mode) class unchanged
- Do not change any logic — only remove the `dark:` prefixed classes

Priority files (highest dark mode usage):
1. `frontend/src/pages/Dashboard.tsx`
2. `frontend/src/pages/Timeline.tsx`
3. `frontend/src/pages/Projects.tsx`
4. `frontend/src/components/JiraGantt.tsx`
5. `frontend/src/components/JiraHierarchyTree.tsx`
6. `frontend/src/components/ui/` — all files
7. `frontend/src/components/layout/` — all files (except Sidebar, already done)

---

## Phase 5 — Update Backgrounds and Borders

Once dark mode is removed, audit every page and component for these common
legacy patterns and update them to brand values:

| Legacy class | Replace with | Notes |
|---|---|---|
| `bg-slate-50` | `bg-[#F5F8FC]` | Page / section background |
| `bg-slate-100` | `bg-[#EEEEF1]` | Subtle fills |
| `bg-slate-200` | `bg-[#DEDFE3]` | Stronger fills |
| `bg-slate-800` | `bg-[#003565]` | Strong dark surfaces |
| `bg-slate-900` | `bg-[#001E3C]` | Deepest dark (rare) |
| `border-slate-200` | `border-[#CFCFD5]` | Default borders |
| `border-slate-300` | `border-[#B5BDC4]` | Stronger borders |
| `text-slate-400` | `text-[#6C7A89]` | Muted text |
| `text-slate-500` | `text-[#6C7A89]` | Secondary text |
| `text-slate-600` | `text-[#6C7A89]` | Labels |
| `text-slate-700` | `text-[#003565]` | Body text |
| `text-slate-800` | `text-[#003565]` | Strong text |
| `text-slate-900` | `text-[#003565]` | Headings |

---

## Phase 6 — App.tsx Dark Mode Toggle

Find the dark mode toggle logic in `frontend/src/App.tsx` (and wherever `darkMode`
setting is read from the store).

- Remove the `classList.add('dark')` / `classList.remove('dark')` calls
- Remove any `useEffect` that watches a `darkMode` setting and applies it
- Leave the `darkMode` field in Settings data model untouched (do not run migrations)
  — just stop reading and applying it in the UI

---

## Phase 7 — Gantt Bar Colours

The Gantt bar colours in `frontend/src/components/JiraGantt.tsx` are defined in a
`BAR` constant. Update them to fit the brand palette:

```typescript
const BAR = {
  epic:      { fill: 'rgba(0,137,221,0.10)', border: '#0089DD', borderWidth: 2 },
  feature:   { fill: '#CCE4F9',             border: '#0089DD', borderWidth: 1 },
  story:     { fill: '#DEDFE3',             border: '#B5BDC4', borderWidth: 1 },
  task:      { fill: '#DEDFE3',             border: '#B5BDC4', borderWidth: 1 },
  bug:       { fill: '#FEE2E2',             border: '#DC2626', borderWidth: 1 },
  uat:       { fill: '#CCD3DC',             border: '#6C7A89', borderWidth: 1 },
  hypercare: { fill: '#B3D9F5',             border: '#0089DD', borderWidth: 1 },
}
```

Do not change anything else in this file. Bar positioning logic, clip arrows,
slide-out panel — leave all of that untouched.

---

## Phase 8 — Spacing Audit

Now that colours are cleaned up, do a pass for cramped spacing.
This is not a find-and-replace — read each screen and judge it visually.

**Specific things to fix:**

| If you see this | Replace with | Location |
|---|---|---|
| `p-3` or `p-4` on a card | `p-6` | All card wrappers |
| `p-2` or `p-3` on a page section | `px-8 py-8` | Page outer containers |
| `gap-3` or `gap-4` between cards | `gap-6` | Card grids |
| `mb-2` or `mb-3` after a section title | `mb-6` | Section headers |
| `space-y-2` or `space-y-3` in a form | `space-y-5` | Form field groups |
| `py-1` or `py-1.5` on table rows | `py-3` | Table cells |
| `px-2 py-1` on a primary button | `px-4 py-2` | Buttons |

**Pages to audit in order:**
1. `Dashboard.tsx` — the most visited screen
2. `Projects.tsx` — dense hierarchy tree
3. `Timeline.tsx` — Gantt + team grid
4. `Team.tsx` — member cards
5. `Scenarios.tsx` — scenario cards
6. `Settings.tsx` — forms and tables

For each page: open it in the browser, look at it, and ask
"does this feel roomy?" If not, find the padding and increase it.

---

## Verification Checklist

After all phases are complete, work through this list:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] Search `grep -rn "dark:" frontend/src/` — zero results
- [ ] Search `grep -rn "purple" frontend/src/` — zero results (except status colours)
- [ ] Search `grep -rn "#7C3AED\|#9B6EE2\|#FAF5FF" frontend/src/` — zero results
- [ ] Sidebar is Dark Blue (#003565) with white text
- [ ] Primary buttons are Light Blue (#0089DD)
- [ ] Page backgrounds are off-white (#F5F8FC)
- [ ] Cards are white with Cool Grey border
- [ ] BIZ sections use Cool Grey 10% tint, not purple
- [ ] Gantt bars use updated BAR constant colours
- [ ] App runs without console errors: `npm run dev`

---

## What to Do If Something Looks Wrong

If a component looks broken after removing its dark mode classes, the base
(light mode) class was probably too dark to begin with. Update the base class
to the correct brand value from Phase 5 above.

Do not re-add dark mode classes to fix visual issues.

---

## End of Session

After completing this pass:
1. Add an entry to `docs/CHANGELOG.md`: "Design pass — Mileway brand palette, removed dark mode, removed BIZ purple"
2. Run `git add -A && git commit -m "design(global): apply Mileway brand palette, remove dark mode"`