# VS Finance Capacity Planner — Dashboard Requirements & Design System

**Document type:** Requirements + Design System  
**Audience:** Dennis (PM), Cursor (implementation)  
**Status:** Draft v1.0  
**Date:** April 2026

---

## 1. Overview

### 1.1 Purpose
A dedicated **Reporting Dashboard** view inside the VS Finance Capacity Planner. It surfaces planned capacity, team allocation, epic assignment, phase breakdown, and cost data in a dense, BI-tool-style interface — readable by PMs in detail and by C-Suite at a glance from the same view.

### 1.2 Primary Use Cases
| User | Goal |
|---|---|
| VS Finance PM | Answer granular questions: who is overloaded, which phases are heavy, what does each epic cost |
| IT Management | Understand team-level capacity utilisation across the portfolio |
| C-Suite | Read top-level KPIs and allocation health without touching the planner |

### 1.3 Scope
- **Data:** Forecast/planned only (no actuals comparison in v1)
- **Time horizons:** Quarter view and Full Year view (toggle in global toolbar)
- **Tracks:** IT and BIZ are shown as **separate sections** throughout every tab
- **Costs:** Included in v1 using the specced `initiative_costs` / `external_vendors` data model
- **Interaction:** View-only, two-level drill-through (Epic → Phase → Person)
- **Export:** Screenshot-optimised layout; no PDF export required in v1

---

## 2. Navigation & Global Structure

### 2.1 Layout Pattern
**Tabbed only** — no persistent summary header. The tab bar is the primary navigation. There is no "home" tab.

```
┌─────────────────────────────────────────────────────────────────────┐
│  GLOBAL TOOLBAR                                                     │
│  [Q2 2026 ▾] [Full Year ▾]   Filter: [Team ▾] [Person ▾] [Epic ▾] │
├──────────┬────────────┬────────────┬────────────┬───────────────────┤
│  PEOPLE  │   TEAMS    │   EPICS    │   COSTS    │                   │
├──────────┴────────────┴────────────┴────────────┴───────────────────┤
│                                                                     │
│  TAB CONTENT AREA                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Global Toolbar
Always visible above the tabs. Contains:

| Control | Type | Behaviour |
|---|---|---|
| Time period | Segmented toggle | Q1 / Q2 / Q3 / Q4 / Full Year. Drives all charts and tables simultaneously |
| Team filter | Multi-select dropdown | Filters all tabs to selected process teams |
| Person filter | Multi-select dropdown | Filters all tabs to selected individuals (IT + BIZ contacts) |
| Epic filter | Multi-select dropdown | Filters all tabs to selected epics |

**Filter behaviour:** All three filters are **additive AND** — selecting Team A + Person B shows data for that intersection. A clear button resets all filters. Active filters show as dismissible chips below the toolbar.

### 2.3 Tabs
Four tabs in order: **People · Teams · Epics · Costs**

Each tab has two sub-sections clearly divided: **IT track** and **BIZ track**. The divider is a labelled section header, not a separate tab.

---

## 3. Functional Requirements by Tab

---

### 3.1 Tab: People

**Purpose:** Answer "who is assigned to what, how heavily, and across which phases?"

#### 3.1.1 IT Sub-section

**IT People Capacity Table**

A dense data table. One row per IT team member. Columns:

| Column | Description |
|---|---|
| Name | Team member name + role badge |
| Process Team | Which team they belong to |
| Available Days | Configured availability for selected period |
| Estimated Days | Sum of all assigned days across epics |
| Utilisation % | Est ÷ Available, shown as % + inline bar |
| Status | Badge: `Over` / `Near` / `Healthy` / `Bench` |
| Epic Count | Number of distinct epics assigned to |
| Drill | Expand chevron → Level 1 detail |

**Utilisation bar** is inline within the cell, coloured by tier (see Design System §6.3).

**Sorting:** Default sort = Utilisation % descending. Clickable column headers re-sort.

**Level 1 Drill — Epic Breakdown (expand row)**

Expanding a person row reveals a sub-table of their epic assignments:

| Column | Description |
|---|---|
| Epic Key | Jira key (e.g. VS-142) |
| Epic Name | Truncated with tooltip |
| Total Days | Total days assigned to this epic |
| Phase Breakdown | Inline stacked bar: Design / Build / Test / Deploy / Hypercare days |

**Level 2 Drill — Phase Detail (click epic row)**

Clicking an epic row within the person drill opens a **side panel** (right-side drawer, 420px). Contains:

- Epic name + key header
- Person's allocation per phase (D / B / T / P / H) as a horizontal bar chart
- Comparison: this person's days vs total epic days per phase
- Other people assigned to same epic (compact list)

---

**IT People Distribution Charts** (below the table, 2-column grid)

- **Chart 1 — Utilisation Distribution:** Horizontal bar chart. X = days estimated. Y = each person. Colour-coded by utilisation tier. Sorted by utilisation desc.
- **Chart 2 — Workload by Epic:** Stacked bar chart per person. Each stack segment = one epic. Helps spot people spread too thin.
- **Chart 3 — Phase Concentration:** Heatmap. Rows = people, columns = phases (D/B/T/P/H). Cell value = days. Useful for spotting testers or architects being bottlenecked in specific phases.

---

#### 3.1.2 BIZ Sub-section

Same structure as IT sub-section, but sourced from `BusinessContact` records and `TEAM:`-prefixed business team assignments.

Differences:
- "Process Team" column replaced by "Business Area"
- Business teams (TEAM: prefixed) appear as aggregate rows — no individual person drill-through (by design — TEAM: entries have no named individuals)
- Phase labels may differ (BIZ uses business-track phase names if different)

---

### 3.2 Tab: Teams

**Purpose:** Answer "which teams are overloaded, what are they working on, and what is the internal vs external vs business split?"

#### 3.2.1 IT Sub-section

**Team KPI Cards Row**

One card per IT process team. Each card contains:
- Team name
- Available days (sum of members)
- Estimated days
- Utilisation % + status badge
- Member count
- Mini donut chart: internal vs external breakdown of estimated days

**Team Capacity Table**

One row per team. Columns:

| Column | Description |
|---|---|
| Team Name | — |
| Members | Count of active members |
| Available Days | — |
| Estimated Days | — |
| Internal Days | Days assigned to internal (permanent/contractor) members |
| External Days | Days assigned to external vendor members |
| Utilisation % | Bar + % |
| Epic Count | Number of epics touching this team |
| Drill | Expand |

**Level 1 Drill — Epic Breakdown per Team**

Expand row reveals:

| Column | Description |
|---|---|
| Epic Key + Name | — |
| Total Days | Team's total days on this epic |
| Phase Breakdown | Stacked inline bar (D/B/T/P/H) |
| Internal Split | Days from internal members |
| External Split | Days from external members |

**Level 2 Drill — Person Detail (side panel)**

Clicking an epic row within team drill opens side panel showing each team member's days on that epic, per phase.

---

**IT Team Charts** (below table)

- **Chart 1 — Team Utilisation Comparison:** Grouped bar chart. Side-by-side: Available days vs Estimated days per team. Shows over/under at a glance.
- **Chart 2 — Internal vs External vs Business Split:** Stacked bar per team. Three segments per bar.
- **Chart 3 — Team × Epic Allocation Matrix:** Heatmap. Rows = teams, columns = epics. Cell = days. Useful for spotting cross-team dependencies.

---

#### 3.2.2 BIZ Sub-section

Same structure. BIZ teams sourced from `TEAM:`-prefixed entries. No individual member drill (aggregate only). No internal/external split — replaced by "Business Unit" grouping.

---

### 3.3 Tab: Epics

**Purpose:** Answer "for each epic: who is on it, which teams, how many days per phase, what is the IT/BIZ split?"

#### 3.3.1 IT Sub-section

**Epic Capacity Table**

One row per epic. Columns:

| Column | Description |
|---|---|
| Epic Key | Jira key |
| Epic Name | — |
| Status | Badge (from Jira or planner) |
| IT Days Total | Sum of all IT member days |
| Phase Split | Inline stacked bar (D/B/T/P/H) |
| Teams Involved | Count + avatar-style team chips |
| People Count | Number of IT members assigned |
| Drill | Expand |

**Level 1 Drill — Phase + People Breakdown**

Expand row reveals two columns:
- Left: Phase breakdown table (D/B/T/P/H rows → days, % of total)
- Right: People list with days per person + phase bars

**Level 2 Drill — Side Panel**

Clicking a person row opens side panel:
- Person's total days on this epic
- Per-phase day breakdown
- Other epics this person is assigned to (with days) — context for over-allocation risk

---

**IT Epic Charts**

- **Chart 1 — Epic Size Comparison:** Horizontal bar chart. One bar per epic = total IT days. Sorted descending. Colour by status.
- **Chart 2 — Phase Distribution per Epic:** Stacked bar. Each bar = one epic, segments = phases. Reveals if portfolio is front-loaded in Design or back-loaded in Test.
- **Chart 3 — Team Coverage per Epic:** Heatmap. Rows = epics, columns = teams. Cell = days. Highlights which epics require cross-team coordination.

---

#### 3.3.2 BIZ Sub-section

Same structure. BIZ days sourced from BIZ assignments. Shows business team aggregate rows where `TEAM:` entries are used. No per-person drill for TEAM: entries.

---

### 3.4 Tab: Costs

**Purpose:** Answer "what does each epic cost, what is the total portfolio cost, and how is it split across cost types?"

Uses the specced data model: `initiative_costs`, `external_vendors`, `CostLineItem`, with EUR as the reporting currency (FX bridge applied).

#### 3.4.1 Cost KPI Cards Row

| Card | Metric |
|---|---|
| Total Portfolio Cost | Sum of all cost line items, all epics, in EUR |
| Internal Cost | Sum of internal resource costs |
| External Vendor Cost | Sum of external vendor line items |
| Business Cost | Sum of BIZ-side cost line items |
| Largest Epic | Epic with highest total cost + amount |

#### 3.4.2 Cost by Epic Table

One row per epic. Columns:

| Column | Description |
|---|---|
| Epic Key + Name | — |
| Total Cost (EUR) | All line items summed |
| Internal Cost | — |
| External Cost | — |
| Business Cost | — |
| Cost per Day | Total cost ÷ total estimated days (efficiency metric) |
| Vendors | Count of external vendors involved |
| Drill | Expand |

**Level 1 Drill — Cost Line Items**

Expand row reveals full `CostLineItem` list:

| Column | Description |
|---|---|
| Description | Line item label |
| Type | Internal / External / Business |
| Vendor | Vendor name if external |
| Original Amount | In original currency |
| EUR Amount | FX-converted |
| Notes | — |

**No Level 2 drill for costs** — line item is the atomic unit.

---

**Cost Charts**

- **Chart 1 — Cost by Epic:** Horizontal bar chart. One bar per epic = total cost EUR. Colour segments = Internal / External / Business.
- **Chart 2 — Cost Type Distribution:** Donut chart. Three segments: Internal / External / Business as % of total portfolio cost.
- **Chart 3 — Cost per Day by Epic:** Bar chart. Identifies expensive-per-day epics — a proxy for vendor-heavy or inefficient allocation.
- **Chart 4 — Vendor Spend Breakdown:** Bar chart. One bar per external vendor = total EUR across all epics. Only shown when external vendor data exists.

---

## 4. Drill-Through Behaviour

### Rules
- **Level 1:** Expand-in-place (accordion row). Only one row expanded at a time per table.
- **Level 2:** Side panel (right drawer, 420px wide). Closes on Escape or clicking outside.
- **No navigation:** Drill-through does not change the URL or tab. It is contextual overlay only.
- **Breadcrumb:** Side panel shows a breadcrumb: e.g. `Teams › Logistics › VS-142`

---

## 5. Filter Behaviour

### Rules
- All three global filters (Team, Person, Epic) apply to **all four tabs simultaneously**
- Filter state persists when switching between tabs
- Empty state: if filters return no data, show a clear empty state message with a "Clear filters" CTA
- Active filters shown as dismissible chips below the global toolbar
- Filter dropdowns are searchable (type-to-filter)
- Person filter includes both IT members and BIZ contacts in the same list, with a track indicator

---

## 6. Design System

### 6.1 Design Philosophy
**"Precision BI"** — the aesthetic of a premium financial intelligence tool. Dense, data-forward, unapologetically information-rich. Inspired by Bloomberg Terminal discipline with modern SaaS refinement. Every pixel serves the data. No decoration that doesn't carry information.

This is a fresh design system that **extends** the Mileway base (font, brand blue) but adds a full dashboard-grade token set.

---

### 6.2 Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Base UI | DM Sans | 400 | 13px |
| Table data | DM Mono | 400 | 12px (numbers only) |
| KPI numbers | DM Sans | 600 | 28–36px |
| Section headers | DM Sans | 600 | 13px |
| Tab labels | DM Sans | 500 | 13px |
| Chart axis labels | DM Sans | 400 | 11px |
| Badges | DM Sans | 600 | 10px, uppercase, tracked |
| Side panel headers | DM Sans | 600 | 15px |

**Key rule:** All numeric data in tables uses `DM Mono` for alignment. All labels and UI text use `DM Sans`.

---

### 6.3 Colour Palette

#### Base Surface
```
--surface-0:    #0F1117   /* App background — near black */
--surface-1:    #171B24   /* Card / panel background */
--surface-2:    #1E2330   /* Elevated surface (side panel, dropdowns) */
--surface-3:    #252B3B   /* Table row hover, sub-rows */
--border:       #2A3147   /* Default border */
--border-light: #323A52   /* Subtle dividers */
```

#### Text
```
--text-primary:   #E8EBF0   /* Main text */
--text-secondary: #8892A4   /* Labels, captions */
--text-muted:     #525D75   /* Placeholders, disabled */
--text-inverse:   #0F1117   /* Text on coloured backgrounds */
```

#### Brand
```
--brand:          #0089DD   /* Mileway blue — CTAs, active states */
--brand-dim:      #0089DD1A /* Brand tint backgrounds */
```

#### Utilisation Tiers
```
--util-over:    #EF4444   /* >100% — Red */
--util-over-bg: #EF44441A
--util-near:    #F59E0B   /* 85–100% — Amber */
--util-near-bg: #F59E0B1A
--util-ok:      #10B981   /* 1–84% — Green */
--util-ok-bg:   #10B9811A
--util-bench:   #525D75   /* 0% — Muted grey */
--util-bench-bg:#525D751A
```

#### Chart Colour Sequence (categorical)
For multi-series charts (epics, teams, etc.):
```
--chart-1: #0089DD   /* Mileway blue */
--chart-2: #10B981   /* Emerald */
--chart-3: #F59E0B   /* Amber */
--chart-4: #8B5CF6   /* Violet */
--chart-5: #EC4899   /* Pink */
--chart-6: #14B8A6   /* Teal */
--chart-7: #F97316   /* Orange */
--chart-8: #6366F1   /* Indigo */
```

#### Track Colours
```
--track-it:     #0089DD   /* IT track — Mileway blue */
--track-it-dim: #0089DD26
--track-biz:    #8B5CF6   /* BIZ track — Violet (distinct, not grey) */
--track-biz-dim:#8B5CF626
```

#### Phase Colours
```
--phase-d: #0089DD   /* Design */
--phase-b: #10B981   /* Build */
--phase-t: #F59E0B   /* Test */
--phase-p: #EC4899   /* Deploy */
--phase-h: #8B5CF6   /* Hypercare */
```

#### Cost Type Colours
```
--cost-internal: #0089DD   /* Internal */
--cost-external: #F59E0B   /* External vendor */
--cost-biz:      #8B5CF6   /* Business */
```

---

### 6.4 Spacing Scale
```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
```

---

### 6.5 Component Specifications

#### Global Toolbar
- Height: 52px
- Background: `--surface-1`
- Bottom border: 1px `--border`
- Time period toggle: segmented control, active segment has `--brand` background
- Filter dropdowns: 36px height, `--surface-2` background, `--border` border, 6px radius

#### Tab Bar
- Height: 44px
- Background: `--surface-1`
- Bottom border: 1px `--border`
- Active tab: `--text-primary`, 2px `--brand` bottom underline
- Inactive tab: `--text-secondary`
- Tab padding: 0 20px

#### Filter Chips (active filters)
- Height: 24px
- Background: `--brand-dim`
- Text: `--brand`, 11px, DM Sans 500
- Dismiss icon: × at 10px
- Radius: 12px (pill)

#### KPI Cards
- Background: `--surface-1`
- Border: 1px `--border`
- Radius: 10px
- Padding: 20px
- KPI number: 32px, DM Sans 600, `--text-primary`
- Label: 11px, DM Sans 500, `--text-secondary`, uppercase, letter-spacing 0.06em
- Status badge in top-right corner

#### Data Tables
- Background: `--surface-1`
- Header row: `--surface-2`, 11px uppercase, `--text-secondary`, letter-spacing 0.06em
- Row height: 40px (default), 48px (with inline chart)
- Row border-bottom: 1px `--border`
- Row hover: `--surface-3`
- Expanded row background: `--surface-2`
- Sub-row (drill level 1): `--surface-3`, left indent 24px, left border 2px `--border-light`

#### Inline Utilisation Bar
- Height: 4px
- Background track: `--border`
- Fill: utilisation tier colour
- Shown inline with % value — bar left, number right, 8px gap
- Bar width: 80px fixed

#### Inline Stacked Phase Bar
- Height: 8px
- Total width: 120px
- Segments coloured by phase token
- Tooltip on hover shows phase label + days

#### Status Badges
```
Over:    bg --util-over-bg,  text --util-over,  label "Over"
Near:    bg --util-near-bg,  text --util-near,  label "Near"
Healthy: bg --util-ok-bg,    text --util-ok,    label "Healthy"
Bench:   bg --util-bench-bg, text --util-bench, label "Bench"
```
Badge: 10px, DM Sans 600, uppercase, 3px 8px padding, 4px radius.

#### Section Dividers (IT / BIZ split)
- Full-width bar: 36px height, `--surface-2` background
- Left border: 3px solid (IT: `--track-it`, BIZ: `--track-biz`)
- Label: 11px, DM Sans 600, uppercase, track colour

#### Side Panel (Level 2 Drill)
- Width: 420px
- Background: `--surface-2`
- Left border: 1px `--border`
- Header height: 56px, contains breadcrumb + close button
- Content padding: 24px
- Slide in from right, 200ms ease-out

#### Charts (general)
- Background: `--surface-1`
- Border: 1px `--border`
- Radius: 10px
- Padding: 20px
- Grid lines: `--border`, 1px, dashed
- Axis labels: 11px, DM Sans, `--text-secondary`
- Tooltips: `--surface-2` bg, `--border` border, 8px radius, 12px DM Sans

#### Heatmap Cells
- Empty: `--surface-3`
- Low (1–30%): brand/phase colour at 20% opacity
- Mid (31–70%): 50% opacity
- High (71–100%): 80% opacity
- Over (>100%): `--util-over` at 90% opacity
- Cell border: 1px `--surface-1` (creates grid gap effect)

---

### 6.6 Empty States

Every table and chart section must handle empty state gracefully:
- Icon: relevant outline icon, `--text-muted`, 32px
- Heading: `--text-secondary`, 14px, DM Sans 500
- Body: `--text-muted`, 13px, max-width 280px
- CTA: "Clear filters" button if caused by filtering

---

### 6.7 Screenshot Optimisation Rules

The dashboard must render cleanly as a screenshot for C-Suite communication:

1. No content clipped at viewport edges — all sections fully visible within their scroll containers
2. Section headers clearly label what each section is
3. All legend items are labelled inline or with a visible legend (no reliance on hover)
4. Colour alone is never the only differentiator — all status badges also carry text labels
5. KPI cards and charts render at full resolution at 1440px wide minimum
6. Font sizes no smaller than 11px (legible in screenshots)
7. High-contrast text: all body text meets WCAG AA contrast on dark surfaces

---

## 7. Chart Library Recommendation

Use **Recharts** (already available in the stack) for all charts. Specific components:

| Chart Type | Recharts Component |
|---|---|
| Horizontal bar | `BarChart` with `layout="vertical"` |
| Stacked bar | `BarChart` with multiple `<Bar>` stacked |
| Grouped bar | `BarChart` with multiple `<Bar>` not stacked |
| Donut | `PieChart` with `<Pie>` + `innerRadius` |
| Heatmap | Custom — CSS grid with computed opacity values |
| Inline stacked bar | Custom — pure CSS flex, no Recharts |
| Inline utilisation bar | Custom — pure CSS, no Recharts |

All Recharts charts: `background="transparent"`, custom `Tooltip` styled to design system tokens, custom `Legend` positioned below chart.

---

## 8. Data Requirements Summary

| Data Entity | Source | Used In |
|---|---|---|
| `TeamMember` | Planner store | People tab IT, Teams tab IT |
| `BusinessContact` | Planner store | People tab BIZ |
| `PlannerItem` (Epic) | Supabase / Jira | Epics tab, all tabs |
| `PlannerAssignment` | Planner store | All tabs — days per person per epic |
| `EpicPhaseEstimate` | Programme planning | Phase breakdown in all tabs |
| `processTeam` | Planner store | Teams tab |
| `initiative_costs` | Supabase (costing spec) | Costs tab |
| `external_vendors` | Supabase (costing spec) | Costs tab |
| `CostLineItem` | Supabase (costing spec) | Costs tab drill |
| `TEAM:` prefixed IDs | Planner store | BIZ sections — aggregate rows |

All data filtered by selected time period (quarter/year) and active global filters before rendering.

---

## 9. Implementation Notes for Cursor

### Component Architecture
```
Dashboard.tsx                    ← top-level, owns global filter state
├── DashboardToolbar.tsx         ← time period + global filters
├── DashboardTabs.tsx            ← tab routing
├── tabs/
│   ├── PeopleTab.tsx
│   ├── TeamsTab.tsx
│   ├── EpicsTab.tsx
│   └── CostsTab.tsx
├── components/
│   ├── TrackSection.tsx         ← IT / BIZ section divider + wrapper
│   ├── KPICard.tsx
│   ├── CapacityTable.tsx        ← shared drill-capable table
│   ├── DrillPanel.tsx           ← Level 2 side panel
│   ├── InlineBar.tsx            ← utilisation bar
│   ├── PhaseStackBar.tsx        ← stacked phase bar
│   ├── StatusBadge.tsx
│   ├── FilterChips.tsx
│   └── charts/
│       ├── UtilisationBar.tsx
│       ├── StackedBar.tsx
│       ├── GroupedBar.tsx
│       ├── Donut.tsx
│       └── Heatmap.tsx
```

### State Management
- Global filter state: Zustand store (`useDashboardStore`)
- Drill state (which row is expanded, which panel is open): local component state
- Time period: Zustand, shared with rest of app

### Read-Before-Write Requirement
Before writing any component, Cursor must:
1. Read `Dashboard.tsx` to understand existing structure
2. Read `PlannerTimeline.tsx` for existing colour token usage
3. Read `supabase/migrations/` to confirm costing table names before using them
4. Report findings before writing any new files

---

## 10. Open Questions (Resolve Before Build)

| # | Question | Impact |
|---|---|---|
| 1 | Does `EpicPhaseEstimate` already store days per person per phase, or only per phase total? | Determines if person-level phase drill is queryable or requires computation |
| 2 | Is there a `status` field on epics from Jira sync? | Epics tab status badge |
| 3 | What is the FX conversion mechanism — live rate or stored rate? | Costs tab EUR display |
| 4 | Should BIZ track show cost data, or only IT costs in Costs tab? | Costs tab BIZ section scope |
| 5 | Is `availDays` per person already quarter-aware, or always full-year? | All utilisation % calculations |
