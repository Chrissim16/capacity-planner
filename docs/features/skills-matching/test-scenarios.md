# F-SP-09 · Skills & Assignment Intelligence — Test Scenarios

**Purpose:** Structured scenarios for manual QA, UAT, and regression. Align with [user-stories.md](./user-stories.md).

**Conventions:**

- **Preconditions** list minimum data/setup unless stated otherwise.
- **Steps** are ordered; **Expected** is the pass criterion.
- **ID** format: `TS-<story>-<nn>` (e.g. `TS-22-01`).

---

## Where to run tests

| Term | Meaning |
|------|--------|
| **Scenario Planner — Timeline** | Routes: **Scenarios** → open a plan → toolbar **Timeline** (sprint Gantt, backlog, Assign panel). This is the primary surface for F-SP-09. |
| **Timeline (actuals)** | Route: **Timeline** (`/timeline`) — Jira Gantt + baseline Assign panel. **Planner detail panel and “Required skills” editing are not in scope for TS-22-xx** unless we add them there later. |

## Global Preconditions (typical)

| Item | Notes |
|------|--------|
| Active non-baseline scenario | **Scenario Planner → Timeline mode** unless a scenario row explicitly says otherwise |
| Skills in Settings | At least two skills, e.g. `SAP FI`, `React` |
| IT members | At least two: one with overlapping skills, one without a required skill |
| BIZ contact | At least one, for BIZ assignment paths |
| Planner layout | At least one Epic/Feature/Story on the timeline with sprint span ≥ 1 |
| Sprints | Calendar covers “today” so proximity-gated badges can be validated |

---

## US-SP-22 — Required skills on items

**Surface:** **Scenario Planner — Timeline** (not the standalone Timeline actuals page).

| ID | Title | Preconditions | Steps | Expected |
|----|--------|---------------|-------|----------|
| TS-22-01 | Detail panel shows Required Skills | Item is Epic, Feature, or Story on **scenario** layout | In **Scenario Planner → Timeline**, **hover** the label row and click the **→ (Open details)** control next to the name (the **name** itself opens Assign, not skills) | “Required Skills” section visible with multi-select / placeholder |
| TS-22-02 | Placeholder when empty | Item has no `requiredSkillIds` | Open detail panel | Placeholder: “No required skills — anyone can be assigned.” (or equivalent empty state) |
| TS-22-03 | Search existing skills | Skills exist in Settings | Type partial name in Required Skills input | Dropdown filters in real time |
| TS-22-04 | Add skill from list | — | Select skill from dropdown | Chip appears; save persists (reload scenario / re-open panel) |
| TS-22-05 | Add new skill (no approval) | Name not in vocabulary | Type new name → Add new / Enter | Skill created globally; appears in Settings; selectable on other items |
| TS-22-06 | Fuzzy “Did you mean?” | Existing `SAP FI` | Type `SAP-FI` (edit distance ≤ 2) | “Did you mean?” shows `SAP FI`; choosing it adds existing skill, not duplicate |
| TS-22-07 | Bar tooltip chips | Item has required skills | Hover gantt bar | Tooltip shows required skills (when Skills matching ON for tooltip gating if implemented) |
| TS-22-08 | Assign panel header chips | Item has required skills | Open Assign panel | Read-only skill chips under title |
| TS-22-09 | UAT/Hypercare hidden | Manual phase item | Open detail for UAT or Hypercare | No Required Skills section |
| TS-22-10 | Create modal | Open Create Manual Item | Choose Epic/Feature/Story | Required Skills visible; save creates item with IDs |
| TS-22-11 | Create modal phases | Create UAT/Hypercare | — | Required Skills not shown |
| TS-22-12 | Clone scenario | Source has items with skills | Duplicate scenario | Cloned `plannerLayout` retains same required skill IDs |
| TS-22-13 | Jira not updated | Jira-sourced item | Set skills; sync Jira elsewhere | Jira issue unchanged (no custom field write) |

---

## US-SP-23 — Capacity warning when assigning

| ID | Title | Preconditions | Steps | Expected |
|----|--------|---------------|-------|----------|
| TS-23-01 | No warning under capacity | Member lightly loaded on item sprints | Open Assign panel → IT row → move slider | No overload text; border not orange |
| TS-23-02 | Warning when overloaded | Member at/near capacity on ≥1 covered sprint | Increase days/sprint until overload | Inline warning under slider; orange border on slider row |
| TS-23-03 | Live recalc | Overload state | Move slider down | Warning clears when no longer overloaded |
| TS-23-04 | Multi-sprint copy | Item spans ≥2 sprints; overload in both | — | Message lists sprints with dates; format readable (e.g. S7 + date range) |
| TS-23-05 | Truncate >3 sprints | Item spans many sprints; many overloaded | — | First three detailed; “…and N more” (or equivalent) |
| TS-23-06 | Confirm still enabled | Overloaded | Click Save/Confirm | Assignment saves (no blocking modal) |
| TS-23-07 | Timeline vs Board | Same member/item | Assign via Assign panel (Timeline) and DaysPopover (Board) | Both surfaces show capacity warning when overloaded |
| TS-23-08 | Toggle OFF does not hide capacity | Skills matching OFF | Overload assignee | Capacity warning still visible |

---

## US-SP-24 — Skill mismatch in assign UI

| ID | Title | Preconditions | Steps | Expected |
|----|--------|---------------|-------|----------|
| TS-24-01 | No skills on item | `requiredSkillIds` empty | Open Assign panel with IT assignee | No skill match section |
| TS-24-02 | Full match IT | Required skills ⊆ member `skillIds` | Open panel | Green chips only; no “Missing skills” line |
| TS-24-03 | Partial match IT | Member missing one required skill | Open panel | “Missing skills: …”; red chips for missing, green for matched |
| TS-24-04 | BIZ neutral | Item has required skills | Add/view BIZ assignee row | No skill chips / comparison on BIZ row |
| TS-24-05 | Combined warnings | Overload + skill gap | Configure both | Capacity block above skill block; both visible |
| TS-24-06 | Toggle OFF hides skill row | Skills matching OFF | IT assignee, item has skills | No mismatch chips (capacity still on per TS-23-08) |
| TS-24-07 | Save still allowed | Skill mismatch | Save with mismatch | Persists (advisory only) |

---

## US-SP-25 — Skill gap badges on canvas

| ID | Title | Preconditions | Steps | Expected |
|----|--------|---------------|-------|----------|
| TS-25-01 | No badge without skills | No `requiredSkillIds` | Scan item in proximity | No skill-gap badge |
| TS-25-02 | Badge when gap + proximity | Required skill; no IT assignee covers it; item in current/next sprint window | View timeline | ⚠ on bar (right) and label column; tooltip matches story |
| TS-25-03 | No badge far future | Same gap but item outside current/next sprint | Scroll/date so item out of window | Badges hidden |
| TS-25-04 | Clears when covered | Add IT member with skill | Assign member | Badges clear |
| TS-25-05 | Zero assignees tooltip | Required skills; no assignees | Hover badge | “No one assigned — … required.” |
| TS-25-06 | Feature rollup collapsed | Stories under feature have gaps; feature collapsed | Collapse feature row | ⚠ on feature label; tooltip lists child names |
| TS-25-07 | Feature expanded | Same | Expand feature | Parent rollup badge gone; child badges visible if in proximity |
| TS-25-08 | Epic rollup | Features/stories with gaps under epic | Collapse epic | Same rollup behaviour for epic |
| TS-25-09 | Phases excluded | UAT with empty skills only | — | N/A; phases don’t use required skills |
| TS-25-10 | Toggle OFF | Skills matching OFF | Gap state | No skill-gap badges on canvas |
| TS-25-11 | Bye week (optional) | Today in bye week | Compare “current sprint” behaviour | Proximity uses next sprint after bye (per design decision) |

---

## US-SP-26 — Smart suggestions in assign popover

| ID | Title | Preconditions | Steps | Expected |
|----|--------|---------------|-------|----------|
| TS-26-01 | Assigned section | Member already on item | Open add-person picker | “Assigned” (or equivalent) above tiers with days |
| TS-26-02 | Good fit tier | Member has capacity + all skills | Open picker | Green / Good fit grouping |
| TS-26-03 | Partial fit tier | Member has capacity, missing skill | Open picker | Amber / Partial fit |
| TS-26-04 | Over tier | Member overloaded on covered sprint | Open picker | Red / Over capacity; takes precedence over partial |
| TS-26-05 | Sort within tier | Multiple in same tier | Observe order | Higher available days first |
| TS-26-06 | Requires line | Item has required skills | Open IT picker | “Requires: …” at top |
| TS-26-07 | Search by skill IT | Member has skill X | Search `X` | Member appears in filtered list |
| TS-26-08 | BIZ search name only | BIZ contact | Search skill name that isn’t in name | BIZ not matched by skill keyword |
| TS-26-09 | BIZ default expanded | Item type Epic or UAT/Hypercare | Open panel | BIZ section starts expanded |
| TS-26-10 | BIZ default collapsed | Item type Feature/Story | Open panel | BIZ section starts collapsed |
| TS-26-11 | BIZ toggle session | Toggle BIZ section | Close/reopen same item | Preference remembered until session ends (or per implementation) |
| TS-26-12 | Empty search | Typing nonsense | — | “No team members found.” when no rows |
| TS-26-13 | Toggle OFF simplified | Skills matching OFF | Open picker | Only Available vs Over capacity; no partial tier for skills |

---

## US-SP-27 — Skills matching toggle

| ID | Title | Preconditions | Steps | Expected |
|----|--------|---------------|-------|----------|
| TS-27-01 | Default ON | New scenario | Open planner | Toggle appears active; skill UI visible |
| TS-27-02 | Per scenario | Two scenarios | Turn OFF in A; open B | B still ON |
| TS-27-03 | Persist in session | Toggle OFF | Navigate away and back to same scenario | State restored from scenario record |
| TS-27-04 | Tooltips | Hover toggle | ON/OFF | Text matches spec |
| TS-27-05 | Edit skills while OFF | Toggle OFF | Detail panel | Required skills still editable |
| TS-27-06 | Turn ON restores | Was OFF | Toggle ON | Badges, tiers, mismatch chips return |

---

## Cross-cutting / regression

| ID | Title | Steps | Expected |
|----|--------|-------|----------|
| TS-X-01 | Baseline vs scenario | Same flows on baseline actuals timeline if Assign panel used | No crash; skills fields behave per wiring |
| TS-X-02 | Performance | Large layout (50+ items) | Panel open/scroll remains usable |
| TS-X-03 | Supabase sync | Toggle + layout with skills | After debounced save, reload app | `skills_matching_enabled` and `requiredSkillIds` in JSON persist |

---

## Automated test mapping (suggested)

Pure functions are strong candidates for unit tests (already partially covered elsewhere):

| Area | Functions / modules | Suggested cases |
|------|---------------------|-----------------|
| Fuzzy match | `fuzzySkillMatch` | distance 0 excluded; distance 1–2; case insensitivity; sorting |
| Skill gaps | `computeSkillGaps`, `getCurrentSprintNumber` | proximity; IT coverage; BIZ ignored; phases excluded; bye-week branch |
| Sprint capacity | `calculateSprintCapacity` | BAU proration; time-off overlap; planner allocation sum; `extraDaysPerSprint` |
| Planner scoring | `scoreMemberForPlanner`, `rankPlannerFits` | good/partial/over; empty required skills; overloaded sprint precedence |

---

## Test run checklist (smoke)

Run in order for a quick release check:

1. TS-22-01, TS-22-09, TS-22-10  
2. TS-23-02, TS-23-08  
3. TS-24-03, TS-24-04, TS-24-06  
4. TS-25-02, TS-25-10  
5. TS-26-02, TS-26-13  
6. TS-27-02, TS-27-05  

**Sign-off:** _________________ **Date:** _________________ **Build / commit:** _________________
