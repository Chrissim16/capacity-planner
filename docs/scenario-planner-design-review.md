# Scenario Planner Design — Brand Review
## Against: docs/design-preferences.md + Mileway Brand Palette

**Reviewed:** 2026-03-18
**Source doc:** scenario-planner-final-design.md
**Verdict:** 11 conflicts found — all fixable without changing functionality

---

## Summary

The scenario planner design was written before the brand palette was locked.
It references purple for BIZ track, uses generic "accent colour" language,
and assumes dark mode support. None of those change the feature — only the
visual treatment needs updating.

---

## Conflicts

### 1. BIZ track colour — purple throughout

**Where in the doc:**
> §2 Layout — "Team Member Cards: IT blue / BIZ orange"
> §8 Capacity Panel — "role badge (IT blue / BIZ orange)"
> §12 Design System — "sana-teal for IT track, biz-purple for BIZ track"

**Problem:** Purple (biz-purple) is explicitly named as the BIZ track colour.
Orange is also mentioned in one place. Neither exists in our palette.

**Fix:**
- IT track: Light Blue `#0089DD` — unchanged
- BIZ track: Cool Grey `#6C7A89` — replaces all purple/orange references
- BIZ backgrounds: Cool Grey 10% tint `#EEEEF1`
- IT backgrounds: Light Blue 10% tint `#E6F2FC`
- The label "BIZ" in small Cool Grey semibold text is the distinguisher — not colour

---

### 2. Capacity panel allocation colour tiers — hardcoded values

**Where in the doc:**
> §8 Capacity Panel allocation colour tiers:
> 0%: #FAFAFA / #D1D5DB
> 1–50%: #F0FDF4 / #16A34A
> 51–80%: #FEFCE8 / #CA8A04
> 81–100%: #FFF7ED / #EA580C
> >100%: #FEF2F2 / #DC2626

**Problem:** The 0–80% range uses generic greens and yellows that don't come
from the brand palette. The backgrounds (#FAFAFA, #F0FDF4, #FEFCE8, #FFF7ED)
are all off-palette.

**Fix:** Keep the traffic light logic (green → amber → red) — that's meaningful
status communication. Update the backgrounds to use brand-adjacent tints:

| Range | Cell background | Text colour | Notes |
|---|---|---|---|
| 0% | `#EEEEF1` (cool-grey-10) | `#6C7A89` | Inactive |
| 1–50% | `#E6F2FC` (light-blue-10) | `#0089DD` | Healthy |
| 51–80% | `#FEF9C3` | `#CA8A04` | Warning — amber kept, it's a status colour |
| 81–100% | `#FFEDD5` | `#EA580C` | High — orange kept, it's a status colour |
| >100% | `#FEE2E2` | `#DC2626` | Over — red kept, it's a status colour |

The 0% and 1–50% tiers are updated to brand colours.
The warning/danger tiers stay — they are legitimate status colours used sparingly.

---

### 3. Dark mode referenced throughout

**Where in the doc:**
> §2 Layout — responsive rules imply theme support
> §12 Design System — "Colours: Mileway brand tokens (mw-primary / sana-teal...)"

**Problem:** We have removed dark mode entirely.

**Fix:** Remove all dark mode considerations from the implementation.
When building this feature, do not add any `dark:` Tailwind variants.
The design system section in the spec no longer applies — use
`docs/design-preferences.md` instead.

---

### 4. Bar colours reference old timeline spec

**Where in the doc:**
> §12 Design System — "Bar colours: Same palette as the Timeline view
> (see docs/views/timeline-view.md §Bar Types)"

**Problem:** The timeline view bar colours are being updated in the design pass
(see design-pass-spec.md Phase 7). The scenario planner inherits those bars,
so it must use the updated values — not the old spec.

**Fix:** The scenario planner bars must use the updated BAR constant from
`JiraGantt.tsx` after the design pass is complete. Do not implement the
scenario planner until the design pass is done and the BAR constant is updated.

---

### 5. "Cards: White background, #EBEBEB border"

**Where in the doc:**
> §12 Design System — "Cards: White background, #EBEBEB border, 12px radius"

**Problem:** Two issues:
- Border `#EBEBEB` is not from our palette — correct value is Cool Grey 30% `#CFCFD5`
- Border radius 12px conflicts with our standard 10px (`rounded-card`)

**Fix:**
- Border: `#CFCFD5` (cool-grey-30)
- Border radius: 10px
- Everything else in the card spec is correct

---

### 6. "Buttons: Dark #1F2937 for primary"

**Where in the doc:**
> §12 Design System — "Buttons: Dark #1F2937 for primary, accent colour for CTAs"

**Problem:** `#1F2937` is a dark slate — not our primary button colour.
Primary buttons must be Light Blue `#0089DD`.

**Fix:**
- Primary button: `bg-[#0089DD] text-white`
- CTA button: same — `bg-[#0089DD] text-white`
- Secondary/ghost: `border border-[#CFCFD5] bg-white text-[#003565]`

---

### 7. Typography: "Plus Jakarta Sans" — correct, but no size guidance

**Where in the doc:**
> §12 Design System — "Typography: Plus Jakarta Sans (as configured in tailwind.config.js)"

**Status:** Font is correct. No conflicts.

**Gap:** The spec doesn't define weights or sizes for the planner UI.
When implementing, follow `docs/design-preferences.md` typography section exactly.

---

### 8. Scenario tabs — colour not specified

**Where in the doc:**
> §3 Scenarios — "Scenario tabs use pill-style navigation in the page header"

**Gap:** No colour specified for active/inactive pill tabs.

**Fill in:**
- Active tab: `bg-[#0089DD] text-white` (Light Blue pill)
- Inactive tab: `bg-[#EEEEF1] text-[#6C7A89]` (Cool Grey 10% tint)
- Max 5 tabs per the spec — this is fine at these colours

---

### 9. Fit colours (SmartAssignmentPanel / Board drag)

**Where in the doc:**
> §4 Timeline — "fit badges (good/partial/over)"
> §5 Board — "fit-colour border (green/amber/red) based on scoreMember()"
> §9 Reused Utilities — "FIT_COLOURS from utils/staffing.ts"

**Status:** Green/amber/red for fit badges is correct — these are genuine
status colours used sparingly on small badges.

**No change needed** — this is exactly the right use of status colours.
Just confirm the badge style matches our standard:
`px-2 py-1 rounded-full text-xs font-semibold` — not large fills.

---

### 10. Dashboard nudge banner

**Where in the doc:**
> §11 Out of Scope — Dashboard nudge banner:
> "⚠ 3 team members are at high utilisation this quarter."

**Gap:** No colour specified for the banner.

**Fill in:** Use the amber status colour — this is a genuine warning:
- Background: `#FEF9C3` (amber 10% tint)
- Border: `#D97706` left accent border-l-4
- Text: `#003565` (Dark Blue)
- Icon: `#D97706`

---

### 11. "Minimum viewport: 1200px — show notice below"

**Where in the doc:**
> §2 Layout — "Minimum viewport: 1200px. Below that, show a 'best viewed on a wider display' notice."

**Status:** No colour conflict — just make sure the notice uses brand styling:
- Background: `#E6EAF0` (dark-blue-10)
- Text: `#003565`
- No heavy warning colours — it's informational, not an error

---

## What Does NOT Need Changing

These parts of the design doc are fully compatible as written:

- ✅ All feature descriptions, interactions, and behaviour
- ✅ The two-mode structure (Board + Timeline)
- ✅ Data model (PlannerItem, PlannerAssignment)
- ✅ Drag and drop library choices (@dnd-kit)
- ✅ Capacity panel structure and live-update behaviour
- ✅ Scenario snapshot model
- ✅ Lock/unlock mechanics
- ✅ All file paths and component names
- ✅ Sprint column layout (mirrors Timeline view)
- ✅ Backlog sidebar structure
- ✅ Popover/floating UI approach

---

## Recommended Action

**Before building the scenario planner:**
1. Complete `design-pass-spec.md` — this updates the shared components the planner reuses
2. Update this design doc with the fixes above (or treat this review as the override)

**When building the scenario planner:**
- Use `docs/design-preferences.md` as the visual reference, not §12 of the original spec
- The functional spec (everything except §12) remains valid and complete
- Reference this review for the 11 specific overrides listed above
