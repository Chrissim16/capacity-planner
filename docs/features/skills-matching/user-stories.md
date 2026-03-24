# F-SP-09 · Skills & Assignment Intelligence — All Revised Stories

**Date:** 2026-03-24
**Status:** Revised — Ready for Development
**Replaces:** US-SP-22 through US-SP-26 in scenario-planner-planning-stories-v2.md
**Relates to:** 2026-03-24-skills-vocabulary-settings-design.md

---

## Decisions Applied

| # | Decision |
|---|---|
| 1 | Admin approval queue for new skills removed. New skills added from the planner are immediately active in the shared vocabulary. Vocabulary governance handled via fuzzy-match nudge at input time and a cleanup surface in Settings. |
| 2 | BIZ contacts do **not** have skills. They are skill-neutral — no skill chips, no skill matching, no mismatch warnings for BIZ assignees. |
| 3 | Persistent ⚠ badges are proximity-gated — only shown when the item falls within the current or next sprint. |
| 4 | Feature rollup badge follows the same rule as Epic rollup — shown only when the Feature row is collapsed. |
| 5 | Tier 3b ("Skill gap" red badge) removed from SP-26. Simplified to 3 tiers: Good fit / Partial fit / Over capacity. |
| 6 | BIZ section in assign popover defaults based on item type: expanded for Phases and Epics, collapsed for Features and Stories. Persisted per session. |
| 7 | Skills matching can be toggled on/off per scenario from the toolbar. Capacity warnings always fire regardless of toggle state. |

## Implementation Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | **Skill references** | Use **skill IDs** (`requiredSkillIds: string[]`) on `PlannerItem` — consistent with `TeamMember.skillIds` and `Project.requiredSkillIds`. Resolve names for display only. Rename-safe. |
| 2 | **Tier 2 definition** | **Simplified** — Tier 2 = has capacity but missing skills; Tier 3 = no capacity left. No 81-110% nuance. Maps directly to current `scoreMember` FitLevel output. |
| 3 | **Board mode warnings** | **Yes** — capacity and skill warnings appear in both Timeline AssignPanel and Board DaysPopover. |
| 4 | **Overload message length** | **Truncate at 3** — show first 3 overloaded sprints, then "...and N more". |
| 5 | **Phases and skills** | **Excluded** — UAT and Hypercare phases cannot have required skills (field hidden for these types). |
| 6 | **Current sprint in bye week** | **Next sprint** — during a bye week, "current sprint" = the next sprint after the bye week. |

---

## US-SP-22 · Define Required Skills on an Epic, Feature, or Story

**As a** Project Manager,
**I want** to define which skills are required on an Epic, Feature, or Story,
**so that** the system can validate assignments and warn me when a gap exists.

**Acceptance Criteria:**

1. A "Required skills" field is available on the item detail panel (in **Scenario Planner → Timeline**, open it via the **→ Open details** control on the label row — hover the row to reveal it; the item **name** opens Assign). It accepts one or more skills as a multi-select tag input.
2. The input is a searchable dropdown showing all skills currently present in the system — both skills defined on `TeamMember` records and skills already used on other `PlannerItem` records across all scenarios. Typing filters the list in real time.
3. **Adding a skill not yet in the list:** If the PM types a term that doesn't match any existing skill and presses Enter, the skill is added immediately and becomes part of the shared skills vocabulary — available to all items and matchable against all team members from that point on. No approval step, no proposed state.
4. **Preventing vocabulary drift at input time:** When the PM types a new skill, the dropdown surfaces close matches before they commit. If the typed term is within edit distance 2 of an existing skill (e.g. typing "SAP-FI" when "SAP FI" exists), a suggestion row appears: *"Did you mean: SAP FI?"* prominently above the "Add new" option. The PM can pick the existing term or consciously choose to add a new one. This is a nudge, not a gate.
5. If no skills are defined on an item, the field shows placeholder text: *"No required skills — anyone can be assigned."* No skill warnings fire for items with an empty skills list.
6. Required skills are stored as `requiredSkillIds: string[]` on the `PlannerItem`, referencing skill IDs from the shared `skills` table. For Jira-sourced items this field starts empty on import. For manually created items it can be set in the creation modal.
7. Required skills are visible as read-only chips on the bar hover tooltip and in the assign popover header.
8. When a scenario is cloned, `requiredSkillIds` values are preserved on all cloned `PlannerItem` records.
9. Required skills are **not** written back to Jira.
10. Required skills field is **not** available on UAT or Hypercare (phase) items.

**Changes from previous version:**
- AC #3: New skills are immediately active — proposed state and admin approval queue removed entirely.
- AC #4: Fuzzy-match "Did you mean?" nudge replaces the approval gate as the vocabulary governance mechanism.
- AC #1: Right-click entry point removed — detail panel entry via **→ Open details** on the label row (not the Assign flow from the name click).
- AC #6: Changed from `requiredSkills: string[]` (names) to `requiredSkillIds: string[]` (IDs) for consistency with existing data model.
- AC #10: UAT/Hypercare phases excluded from required skills (new).

---

## US-SP-23 · Capacity Warning When Assigning a Person

**As a** Project Manager,
**I want** to be warned immediately when assigning a person would exceed their available capacity in one or more covered sprints,
**so that** I can make an informed decision rather than unknowingly creating an overloaded plan.

**Acceptance Criteria:**

1. In the effort slider popup (triggered by click or drag-to-assign), the system calculates the person's total allocated days per sprint across all existing assignments plus the item currently being assigned at the current slider value.
2. If the total exceeds the person's `availableDays` in **any single sprint** covered by the item, an inline warning appears below the slider. The warning lists up to 3 overloaded sprints with allocation and availability inline — never deferred to the capacity panel:
   - Single sprint: "⚠ Overloaded in S7 (Mar 30 – Apr 10) — 12 days allocated, 10 available"
   - Multiple sprints: "⚠ Overloaded in S7 (Mar 30 – Apr 10) — 12/10 days · S8 (Apr 11 – Apr 24) — 11/10 days"
   - More than 3 sprints: "⚠ Overloaded in S7 — 12/10 · S8 — 11/10 · S9 — 13/10 ...and 2 more"
   - Sprint date ranges are always shown alongside sprint labels to aid users unfamiliar with sprint numbering.
3. The slider field border turns orange when any overload condition is active.
4. The warning recalculates live as the slider moves. Reducing the value to a non-overloading amount clears the warning immediately.
5. The Confirm button remains active regardless of overload state — the PM can proceed with an intentional overallocation.
6. No "safe" confirmation is shown when there is no overload — only warn on violation.
7. This warning fires identically on both assignment paths: drag-to-assign (US-SP-10) and click-to-popover (US-SP-11), in both Timeline and Board modes.

**Changes from previous version:**
- Multi-sprint warning no longer says "see capacity panel" — all sprint detail shown inline.
- Sprint labels now always include date ranges.
- Truncation at 3 sprints added for long items.
- Board mode DaysPopover explicitly included.

---

## US-SP-24 · Skill Mismatch Warning When Assigning a Person

**As a** Project Manager,
**I want** to be warned when I assign a person to an item that requires skills they do not have,
**so that** I avoid creating a plan that relies on someone doing work outside their expertise.

**Acceptance Criteria:**

1. In the effort slider popup, if the item has `requiredSkillIds` defined (US-SP-22), the system compares those skills against the assigned person's skill tags on their `TeamMember` record.
2. Skill matching applies to **IT team members only** (`TeamMember` records). BIZ contacts (`BusinessContact` records) are skill-neutral — no skill comparison is performed and no skill chips are shown when assigning a BIZ contact, regardless of whether the item has `requiredSkillIds` defined.
3. **Full match (IT members only):** All required skills are present on the person → green chips shown for each matched skill. No warning text.
4. **Partial or no match (IT members only):** One or more required skills are missing → warning text: "⚠ Missing skills: [skill A], [skill B]". Missing skills shown as red chips; matched skills as green chips below the warning.
5. If the item has no `requiredSkillIds` defined, no skill section is rendered for any assignee type — the popup remains compact.
6. The Confirm button remains active — skill warnings are advisory only.
7. The skill comparison is computed when the popup opens. It does not update dynamically within the popup session.
8. **Combined state — capacity overload AND skill mismatch:** Both warnings are shown simultaneously in the same popup. The capacity warning renders first (immediately below the slider, above the skill chips). The skill chips render second. Neither warning suppresses the other.

**Changes from previous version:**
- AC #1 scoped to IT `TeamMember` records only. BIZ contacts explicitly excluded from skill matching (AC #2, new).
- Combined overload + skill mismatch state now explicitly specified (AC #8, new).

---

## US-SP-25 · Skill Coverage Gap Warning on Work Items

**As a** Project Manager,
**I want** to see a persistent warning on work items where a required skill is not covered by any assigned person,
**so that** I can identify planning gaps across the whole plan at a glance.

**Acceptance Criteria:**

1. A work item is in **skill gap state** when it has `requiredSkillIds` defined and at least one required skill is not covered by any of its current IT assignees. BIZ assignees are not evaluated for skill coverage.
2. Skill gap badges are **proximity-gated** — a badge is only shown when the item's sprint range includes the current sprint or the immediately following sprint. Items further in the future do not show a badge regardless of skill gap state. This prevents the canvas from being flooded with warnings during initial planning passes. When a previously-badged item is rescheduled beyond the next sprint, the badge clears automatically. **Current sprint** = sprint containing today; during a bye week, "current sprint" = the next sprint after the bye week.
3. When proximity-gated and in skill gap state, the item shows: a ⚠ badge on the right edge of the gantt bar, and a ⚠ badge in the label column next to the item name.
   - Tooltip with assignees present: "Skill gap: [skill A] not covered by any assignee."
   - Tooltip with zero assignees: "No one assigned — [skill A], [skill B] required."
4. The ⚠ badge clears automatically when an IT assignee with the missing skill is added.
5. **Feature rollup badge:** A Feature shows a ⚠ badge in its label column **only when its row is collapsed** (children hidden). When expanded, the child-level Story badges are visible directly. The Feature tooltip when collapsed lists affected children: "Skill gaps in [Story name], [Story name]."
6. **Epic rollup badge:** An Epic shows a ⚠ badge in its label column **only when its row is collapsed** (children hidden). When expanded, child-level badges are visible directly. The Epic tooltip when collapsed lists affected children: "Skill gaps in [Feature name], [Feature name]."
7. Items with no `requiredSkillIds` defined never show a skill gap badge.
8. Skill gap information is on bars and label column only. The capacity panel is not involved.
9. UAT and Hypercare items are excluded (they do not support required skills).

**Changes from previous version:**
- AC #1: BIZ assignees explicitly excluded from skill coverage evaluation.
- AC #2: Proximity gate added — badges only shown for current or next sprint items. Badge clears on reschedule beyond the window. Bye week handling specified.
- AC #5: Feature rollup badge added (was Epic-only in previous version).
- AC #9: Phase items excluded (new).

---

## US-SP-26 · Smart Person Suggestions in the Assign Popover

**As a** Project Manager,
**I want** the assign popover to show me a ranked list of team members based on available capacity and skill match,
**so that** I can make a good assignment decision quickly without manually scanning the whole team roster.

**Acceptance Criteria:**

1. The assign popover ranks all IT team members into three tiers based on fit:
   - **Tier 1 — Good fit (green badge):** Has capacity in all covered sprints AND matches all required skills. Also applies when the item has no required skills defined and the person has capacity.
   - **Tier 2 — Partial fit (amber badge):** Has capacity but is missing one or more required skills.
   - **Tier 3 — Over capacity (red badge):** No available capacity (availableDays <= 0) in any covered sprint, regardless of skill match.
   - A person appears in exactly one tier. Tier 3 takes precedence — a person over capacity is never shown as Partial fit even if they also have a skill gap.
2. Within each tier, members are sorted by available days descending.
3. Already-assigned members appear above all tiers with an "Assigned" badge and their current `daysPerSprint`. They are not re-ranked.
4. Tier classification uses `scoreMemberForPlanner()` from `utils/staffing.ts` — its `FitLevel` output maps directly to the three tiers.
5. BIZ contacts appear in a separate section below IT members. BIZ contacts are not skill-ranked — they are sorted by available days only and shown without tier badges. The BIZ section default open/closed state is **context-aware based on item type:**
   - **Phase (UAT, Hypercare, etc.):** Expanded by default — BIZ contacts are the primary assignee pool for these items.
   - **Epic:** Expanded by default — cross-functional items where BIZ involvement is expected.
   - **Feature / Story:** Collapsed by default — primarily IT work.
   - The PM can manually toggle the section; the toggled state persists for the duration of the session.
6. The PM can assign any member regardless of tier. Ranking is a suggestion, not a gate.
7. A search input at the top of the list filters by name or skill. Searching by skill shows IT members who have that skill. BIZ contacts are filtered by name only. Search does not change the ranking order of remaining results.
8. If the item has required skills, a summary line at the top of the IT section reads: "Requires: [skill A], [skill B]."
9. No empty state message is shown when no one qualifies as Good fit — the visible tiers are themselves the signal. An empty popover (no team members at all) shows: "No team members found."

**Changes from previous version:**
- Tier 2 simplified: capacity + skill gap only. No 81-110% capacity nuance.
- Tier 3 simplified: over capacity = availableDays <= 0.
- BIZ section default state is now context-aware by item type (AC #5, revised).
- BIZ contacts explicitly not skill-ranked (AC #5).
- `scoreMemberForPlanner()` replaces `scoreMember()` for planner context (sprint-based, not quarter-based).
- Empty state explicitly specified (AC #9, new).
- Search against BIZ contacts scoped to name-only (AC #7, clarified).

---

## US-SP-27 · Toggle Skills Matching On and Off

**As a** Project Manager,
**I want** to toggle skills matching on and off from the planner toolbar,
**so that** I can do rough capacity planning without skill warnings getting in the way, and switch to full skills validation when I'm ready to refine.

**Acceptance Criteria:**

1. A "Skills" toggle button is available in the scenario planner toolbar. When active (on), the button is visually highlighted. When inactive (off), it appears in its default unselected state. Default is **on**.
2. The toggle state is persisted **per scenario** — turning skills matching off in one scenario does not affect other scenarios. State is restored when the PM returns to the scenario in the same session.
3. **When skills matching is OFF, the following are suppressed:**
   - SP-24: Skill chips and mismatch warning in the effort slider popup. The popup renders in compact form regardless of whether the item has `requiredSkillIds` defined.
   - SP-25: All ⚠ skill gap badges on gantt bars, label column, and rollup badges on Features and Epics. The canvas shows no skill-related indicators.
   - SP-26: Tier 2 (Partial fit) is removed from the assign popover. Members are ranked on capacity only — two states: has capacity (green "Available" badge) or over capacity (red "Over capacity" badge). Members who would be Tier 2 are promoted to "Available" since they have capacity.
4. **When skills matching is OFF, the following are unaffected:**
   - SP-22: Required skills can still be defined, viewed, and edited on items. The data is preserved.
   - SP-23: Capacity overload warnings in the effort slider still fire normally. The toggle only gates skill matching, not capacity checking.
   - The `requiredSkillIds` field on items and `skillIds[]` on team members are untouched — toggling off never modifies data.
5. Turning skills matching back ON restores all skill-related UI immediately, using the current state of `requiredSkillIds` and assignee skills at that moment. No data is lost or recalculated from scratch.
6. A tooltip on the toggle button communicates its effect:
   - When ON: "Skills matching active — assignments are ranked by skill fit."
   - When OFF: "Skills matching off — assignments ranked by capacity only."

**Changes from previous version:**
- New story.

---

## Implementation Notes

### Data Model

```typescript
interface PlannerItem {
  // ... existing fields ...
  isManual: boolean
  labels: string[]
  jiraAssignees: string[]
  jiraStartDate?: string
  jiraEndDate?: string
  requiredSkillIds: string[]  // references Skill.id from the shared `skills` table
                              // not synced to Jira; preserved on clone
                              // empty for UAT/Hypercare items
}

interface Scenario {
  // ... existing fields ...
  skillsMatchingEnabled: boolean  // default: true
                                  // persisted per scenario, not global
}
```

**Skills vocabulary:** Managed via the shared `skills` table. Both `TeamMember.skillIds[]` and `PlannerItem.requiredSkillIds[]` reference `Skill.id`. New skills added from the planner are immediately active in the shared vocabulary.

**BIZ contacts and skills:** `BusinessContact` records do not carry a `skillIds[]` field. Skill matching, skill chips, and skill tier badges do not apply to BIZ contacts anywhere in F-SP-09.

**Skills matching toggle:** The toggle state is stored as `skillsMatchingEnabled: boolean` on the scenario record itself — not on a global store or in `localStorage`. This ensures the setting travels with the scenario: switching between scenarios correctly restores each scenario's own toggle state. Default value on scenario creation: `true`.

### Stories Explicitly Out of Scope (v1)

- Weekly column granularity
- Per-sprint effort variance (slider is flat across all sprints)
- Cross-quarter drag
- Two-way Jira sync from planner
- Undo/redo stack beyond single-action 5-second toasts
- Writing `requiredSkillIds` back to Jira
- Per-sprint skill coverage analysis (skill gaps evaluated at item level only)
- ~~Admin UI for proposed skills review queue~~ — removed; skills vocabulary managed via Settings
