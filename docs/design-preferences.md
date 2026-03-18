# Design Preferences
> Read this before touching any UI. These are the developer's visual preferences.
> Translate them into code — do not ask for clarification on things covered here.

---

## Font

**DM Sans** — use this exclusively. Do not use Plus Jakarta Sans, Inter, or any other font.

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

```js
// tailwind.config.js
fontFamily: { sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
```

Build hierarchy through weight, not size:

| Level | Size | Weight | Colour |
|---|---|---|---|
| Page title | 24–26px | 600 | #1E293B |
| Section header | 15px | 600 | #1E293B |
| Body | 14px | 400 | #1E293B |
| Labels / meta | 12px | 500 | #94A3B8 |
| Captions / uppercase labels | 11px | 600 | #94A3B8 |

Minimum text size: 11px. Never go below this.
Never use weight 400 at 12px or smaller — it disappears.

---

## Colour Palette

Three colours only. Do not introduce anything outside this system.

### Core

| Role | Value | Usage |
|---|---|---|
| White | #FFFFFF | Card backgrounds, inputs, open space |
| Off-white | #F5F8FC | Page background |
| Primary text | #1E293B | Headings, body, strong labels |
| Secondary text | #94A3B8 | Meta, roles, captions, secondary labels |
| Blue | #0089DD | All interactive elements — buttons, links, active states, icons |

### Borders and dividers

| Role | Value |
|---|---|
| Default border | #DEDFE3 |
| Subtle divider | #F0F2F5 |

### Tints (for backgrounds and hover states only)

| Tint | Value | Usage |
|---|---|---|
| Blue 10% | #E6F2FC | Row hover, active nav background, IT section tint |
| Blue 20% | #CCE4F9 | Selected states, badges |
| Grey 10% | #F0F2F5 | BIZ section tint, subtle fills |

### What is gone — do not use

- ~~#003565 (Dark Blue)~~ — removed entirely
- ~~#6C7A89 (old grey)~~ — replaced by #94A3B8
- ~~#7C3AED (purple)~~ — removed entirely
- ~~Any dark sidebar~~ — sidebar is white

---

## Status Colours

Use sparingly — only on actual status indicators (text, dot, small badge).
Never as background fills on cards, rows, or large areas.

| Status | Colour |
|---|---|
| Success / On track | #16A34A |
| Warning / High utilisation | #D97706 |
| Error / Overloaded / Cancelled | #DC2626 |
| Active / In progress | #0089DD (same as primary blue) |

When in doubt: is this communicating a real status? If not, don't use a status colour.

---

## IT Track vs BIZ Track

Both tracks use the same palette. Never use purple or orange for BIZ.
Distinguish them with labels and subtle tints only:

- **IT** — Blue 10% tint (#E6F2FC) background + small "IT" label in #94A3B8
- **BIZ** — Grey 10% tint (#F0F2F5) background + small "BIZ" label in #94A3B8

They are siblings. They should feel like they belong to the same family.

---

## The Overall Feel

Clean, calm, and airy. Generous space throughout.
When something looks busy: remove something or add space.
Never add visual elements to organise existing ones — use space instead.

---

## Spacing — Exact Tailwind Classes

Use these exactly. When in doubt, go one step larger — never smaller.

### Page layout
```
Page outer padding:        px-8 py-8
Max content width:         max-w-7xl mx-auto
Between page sections:     space-y-8
```

### Cards
```
Card padding:              p-6
Card padding — large:      p-8
Gap between cards:         gap-6
Card title to content:     mb-6
```

### Forms
```
Form field vertical gap:   space-y-5
Label to input gap:        mb-1.5
Input padding:             px-3 py-2.5
Form section gap:          space-y-8
Submit button top margin:  mt-8
```

### Tables and lists
```
Table cell padding:        px-4 py-3
Row height minimum:        h-12
Between list items:        space-y-3
Between major list groups: space-y-6
```

### Sidebars and panels
```
Sidebar nav item padding:  px-4 py-2.5
Sidebar section gap:       space-y-1
Sidebar section divider:   my-4
Slide-out panel padding:   p-6
Panel section gap:         space-y-6
```

### Inline elements
```
Badge padding:             px-2.5 py-1
Button padding — default:  px-4 py-2
Button padding — large:    px-6 py-2.5
Icon to label gap:         gap-2
```

The golden rule: if choosing between two spacing options, pick the larger one.

---

## Cards

- Background: #FFFFFF
- Border: 1px solid #DEDFE3
- Border radius: 10px (rounded-[10px])
- Padding: p-6
- No shadow — border only
- Primary / featured cards: border-l-4 border-[#0089DD]

---

## Navigation Sidebar

- Background: #FFFFFF
- Right border: 1px solid #DEDFE3
- Active item: bg-[#E6F2FC] text-[#0089DD] border-l-[3px] border-[#0089DD]
- Inactive items: text-[#94A3B8] hover:bg-[#F5F8FC]
- Logo/brand area: text-[#1E293B] font-weight 600
- Nav labels: 14px, weight 500

---

## Buttons

- Primary: bg-[#0089DD] text-white rounded-lg px-4 py-2 font-medium
- Secondary: border border-[#DEDFE3] bg-white text-[#1E293B] rounded-lg px-4 py-2
- Destructive: bg-[#DC2626] text-white rounded-lg px-4 py-2
- No gradients. No shadows. Flat and clean.

---

## Forms and Inputs

- Border: 1px solid #DEDFE3
- Border radius: rounded-lg
- Label: 12px, weight 500, colour #94A3B8, above the field
- Value text: #1E293B
- Focus: border-[#0089DD], no background change
- Placeholder: #94A3B8

---

## Tables and Lists

- Column headers: 11px, weight 600, uppercase, colour #94A3B8, no background
- Rows: white background, 1px bottom border #DEDFE3
- Row hover: bg-[#E6F2FC]
- Status: coloured text only — no badge backgrounds in tables
- Row height: minimum h-12 (48px)

---

## Heatmap / Capacity Grid

- Header row: bg-[#F5F8FC] text-[#94A3B8] — light, not dark
- Borders: 1px solid #DEDFE3 — thin and subtle, never thick or dark
- Cell text: #1E293B for values, #94A3B8 for sub-labels
- Capacity tiers follow status colours (green/amber/red) as text only
- Cell backgrounds use very light tints only — never saturated fills

---

## Banners and Alerts

- Warning banner (e.g. Jira Baseline): bg-[#FEF9C3] border-l-4 border-[#D97706] text-[#1E293B]
- Info banner: bg-[#E6F2FC] border-l-4 border-[#0089DD] text-[#1E293B]
- Never use red for an informational banner — red is for errors only

---

## Avatars

- Default: bg-[#E6F2FC] text-[#0089DD] — light blue tint with blue initials
- Warning state: bg-[#FEF9C3] text-[#D97706]
- Overloaded state: bg-[#FEE2E2] text-[#DC2626]
- Shape: rounded-full
- Size default: w-8 h-8 (32px)

---

## What to Avoid

- #003565, #6C7A89, #7C3AED — all removed, do not reintroduce
- Dark backgrounds on the sidebar or any structural element
- Thick borders or dark borders on the heatmap
- Orange or red on buttons or interactive elements
- Coloured section backgrounds (use white + border)
- Gradients anywhere
- Status colours on anything that is not a real status
- Any colour not in this palette used for organisation