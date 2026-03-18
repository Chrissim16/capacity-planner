# Design Preferences
> Read this before touching any UI. These are the developer's visual preferences.
> Translate them into code — do not ask for clarification on things covered here.

---

## Brand Palette

These are the official Mileway brand colours. Use nothing outside this system.

### Primary Colours

| Name | Hex | Usage |
|---|---|---|
| Mileway Light Blue | #0089DD | Primary actions, links, active states, interactive elements |
| Mileway Dark Blue | #003565 | Sidebar, page headers, strong emphasis, nav active background |
| Mileway Cool Grey | #6C7A89 | Secondary text, labels, borders, structural elements |

### Tints (opacity over white)

Each primary colour has five tints. Use these for backgrounds, hover states, and
subtle fills — never the full saturated colour on large background areas.

| Tint | Light Blue | Dark Blue | Cool Grey |
|---|---|---|---|
| 50% | #80C4EE | #809AB2 | #B5BDC4 |
| 30% | #B3D9F5 | #B3C2CF | #CFCFD5 |
| 20% | #CCE4F9 | #CCD3DC | #DEDFE3 |
| 10% | #E6F2FC | #E6EAF0 | #EEEEF1 |

**Rule of thumb:**
- Full colour → buttons, icons, active nav items, key data points
- 10–20% tint → row hover, selected states, subtle section fills
- 30–50% tint → disabled states, secondary badges, chart fills

### White and Near-White

| Name | Hex | Usage |
|---|---|---|
| White | #FFFFFF | Card backgrounds, input backgrounds, open space |
| Off-white | #F5F8FC | Page background — very slightly blue-tinted grey |

---

## Status Colours

Use these **sparingly** — only on actual status indicators (a badge, a dot, a text label).
Never as background fills on cards, rows, or sections.

| Status | Colour | Hex |
|---|---|---|
| Success / Approved | Green | #16A34A |
| Warning / Pending | Amber | #D97706 |
| Error / Cancelled | Red | #DC2626 |
| In Progress / Active | Light Blue | #0089DD (same as primary) |

When in doubt, ask: "Is this communicating a real status?" If not, don't use a status colour.

---

## IT Track vs BIZ Track

Both tracks use the same brand palette — no purple, no competing accents.
Distinguish them with labels and subtle tints only:

- **IT** — Light Blue 10% tint (#E6F2FC) as row/section background + "IT" label in Cool Grey
- **BIZ** — Cool Grey 10% tint (#EEEEF1) as row/section background + "BIZ" label in Cool Grey

They are siblings. They should feel like they belong to the same family.

---

## The Overall Feel

Clean and calm. The UI should feel like it has room to breathe.
When something looks busy: remove something or add space.
Never add visual elements to organise existing ones — use space instead.

---

## Spacing — Concrete Rules

These are not suggestions. Use these exact Tailwind classes.
When in doubt, go one step larger — never one step smaller.

### Page layout
```
Page outer padding:        px-8 py-8        (32px sides, 32px top/bottom)
Max content width:         max-w-7xl mx-auto
Between page sections:     space-y-8        (32px)
```

### Cards
```
Card padding:              p-6              (24px all sides)
Card padding — large:      p-8              (32px — for hero/primary cards)
Gap between cards:         gap-6            (24px)
Card title to content:     mb-6             (24px)
```

### Forms
```
Form field vertical gap:   space-y-5        (20px between fields)
Label to input gap:        mb-1.5           (6px)
Input padding:             px-3 py-2.5      (12px / 10px)
Form section gap:          space-y-8        (32px between groups)
Submit button top margin:  mt-8             (32px)
```

### Tables and lists
```
Table cell padding:        px-4 py-3        (16px / 12px)
Table header padding:      px-4 py-3
Row height minimum:        h-12             (48px)
Between list items:        space-y-3        (12px)
Between major list groups: space-y-6        (24px)
```

### Sidebars and panels
```
Sidebar nav item padding:  px-4 py-2.5      (16px / 10px)
Sidebar section gap:       space-y-1        (4px between nav items)
Sidebar section divider:   my-4             (16px above/below)
Slide-out panel padding:   p-6              (24px)
Panel section gap:         space-y-6        (24px between sections)
```

### Inline elements
```
Badge padding:             px-2.5 py-1      (10px / 4px)
Button padding — default:  px-4 py-2        (16px / 8px)
Button padding — large:    px-6 py-2.5      (24px / 10px)
Icon to label gap:         gap-2            (8px)
Avatar stack overlap:      -ml-1            (4px)
```

### The golden rule
If you are choosing between two spacing options, pick the larger one.
This app handles complex data. Space is what makes it feel manageable.

---

## Cards

- Background: white (#FFFFFF)
- Border: 1px solid — Cool Grey 30% tint (#CFCFD5)
- Border radius: 10px
- Padding: 24px
- No shadow — border only
- Primary / featured cards: left accent border-l-4 in Light Blue (#0089DD)

---

## Typography

Font: **Plus Jakarta Sans**. Do not change it.
Build hierarchy through weight, not size:

| Level | Size | Weight | Colour |
|---|---|---|---|
| Page title | 24–28px | 700 | Dark Blue #003565 |
| Section header | 16px | 600 | Dark Blue #003565 |
| Body | 14px | 400 | Cool Grey #6C7A89 (dark) |
| Labels / meta | 12px | 600 | Cool Grey #6C7A89 |
| Captions | 11px min | 400 | Cool Grey 50% tint |

Never go below 11px. Never use 400 weight at 12px or smaller — it looks unfinished.

---

## Navigation Sidebar

- Background: Dark Blue (#003565)
- Active item: Light Blue (#0089DD) background tint + white text
- Inactive items: white at 70% opacity text, no background
- Logo/brand area: white text on Dark Blue

---

## Buttons

- Primary: `bg-[#0089DD] text-white rounded-lg hover:bg-[#0077C2]`
- Secondary: `border border-[#CFCFD5] bg-white text-[#003565] rounded-lg`
- Destructive: `bg-red-600 text-white rounded-lg`
- No gradients. No shadows. Flat and clean.

---

## Forms and Inputs

- Border: 1px solid Cool Grey 30% tint (#CFCFD5)
- Label: 12px, 600 weight, Cool Grey (#6C7A89), above the field
- Value text: Dark Blue (#003565)
- Focus: Light Blue border (#0089DD), no background fill change
- Placeholder: Cool Grey 50% tint

---

## Tables and Lists

- Column headers: 12px, 600 weight, Cool Grey (#6C7A89), no background
- Rows: white background, 1px bottom border in Cool Grey 20% tint (#DEDFE3)
- Row hover: Light Blue 10% tint (#E6F2FC)
- Status text: use status colours above — text only, no badge backgrounds on tables
- Row height: minimum 48px

---

## Dark Mode

Follow the same brand logic, inverted. Dark Blue becomes the surface:

- Page background: #001E3C (darker than Dark Blue)
- Card background: #003565 (Dark Blue)
- Borders: Cool Grey 50% tint at low opacity
- Primary text: #F0F6FF
- Secondary text: Cool Grey 30% tint
- Light Blue stays: #0089DD

---

## What to Avoid

- Any colour outside the brand palette on structural elements
- Purple on anything (was used for BIZ track — now removed)
- Coloured section backgrounds (use white + border)
- Heavy shadows
- Gradients anywhere
- Status colours on anything that is not an actual status
- Introducing a "new" accent colour to solve a layout problem — use spacing instead
