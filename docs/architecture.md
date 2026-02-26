# Architecture Reference

---

## Overall Stack

The app is a **single-page React application** with a Supabase backend. There is no server-side rendering.

| Layer | Technology |
|---|---|
| UI Framework | React 19 (TypeScript) |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 + custom CSS in `index.css` |
| State Management | Zustand 5 |
| Database / Auth | Supabase (PostgreSQL + Auth) |
| HTTP Client | Supabase JS SDK, native `fetch` (Jira API) |
| Deployment | Vercel (auto-deploy from main branch) |
| Node Version | 20.x |

There is **no build step required** to open reference prototypes in `reference/`. The production app (`frontend/`) requires `npm run dev` (Vite dev server) or `npm run build`.

---

## File and Folder Layout

```
frontend/src/
├── App.tsx                        # Root: view router, keyboard shortcuts, auth gate
├── main.tsx                       # ReactDOM.createRoot entry point
├── index.css                      # Global CSS: Tailwind layers + Gantt CSS + design tokens
├── App.css                        # (unused legacy)
│
├── types/
│   └── index.ts                   # Single source of truth for all TypeScript interfaces
│
├── stores/
│   ├── appStore.ts                # Zustand store — holds AppState, view state, sync status
│   └── actions.ts                 # Pure mutation helpers (no async); called from components
│
├── services/
│   ├── supabase.ts                # Creates the Supabase client; exports isSupabaseConfigured()
│   ├── supabaseSync.ts            # Full read/write of AppState to Supabase tables
│   ├── jira.ts                    # Jira Cloud REST API client (proxy-less, CORS via Jira token)
│   └── nagerHolidays.ts           # Fetches public holidays from nager.date API
│
├── application/
│   ├── jiraSync.ts                # Diff logic: compares fetched items vs stored items
│   ├── jiraProjectBuilder.ts      # Maps Jira hierarchy → local Project/Phase structure
│   └── assignmentSuggester.ts     # Suggests assignments from story points + sprint membership
│
├── utils/
│   ├── sprints.ts                 # Sprint generation, quarter lookup, workday calculation
│   ├── capacity.ts                # IT + BIZ capacity calculations per quarter/sprint
│   ├── calendar.ts                # getWorkdaysInQuarter, getCurrentQuarter, date helpers
│   ├── confidence.ts              # Confidence buffer application + rollup
│   └── importExport.ts            # XLSX import/export via `xlsx` library
│
├── hooks/
│   └── useCurrentUser.ts          # Supabase Auth: returns current user, loading state
│
├── components/
│   ├── JiraGantt.tsx              # Core Gantt: Epic/Feature/Story bars + LocalPhase bars
│   ├── JiraHierarchyTree.tsx      # Collapsible tree (used in Epics page + read-only in Timeline)
│   ├── ScenarioSelector.tsx       # Scenario switcher in sidebar
│   ├── ScenarioDiffModal.tsx      # Diff preview when switching scenarios
│   ├── layout/
│   │   ├── Layout.tsx             # App shell: sidebar + main content area
│   │   ├── Sidebar.tsx            # Nav items, sync indicator, scenario selector, dark mode
│   │   ├── Header.tsx             # Top bar (collapsed sidebar variant)
│   │   ├── PageHeader.tsx         # Per-page title + subtitle + actions slot
│   │   └── NotificationBanner.tsx # Global info/warning banners
│   ├── forms/                     # Modal forms: TeamMemberForm, AssignmentModal, etc.
│   └── ui/                        # Primitive UI components: Button, Card, Modal, Toast,
│                                  # Badge, Select, Input, ProgressBar, AvatarStack, etc.
│
└── pages/
    ├── Dashboard.tsx              # Capacity view: team utilization summary
    ├── Timeline.tsx               # Timeline: Gantt sub-mode + Team capacity sub-mode
    ├── Projects.tsx               # Epics view: JiraHierarchyTree + BIZ assignment management
    ├── Team.tsx                   # Team management: IT members + Business Contacts
    ├── Scenarios.tsx              # Scenario planner
    ├── Settings.tsx               # Settings shell with tabbed sections
    ├── Login.tsx                  # Auth gate (shown when Supabase is configured + user not logged in)
    └── settings/                  # Individual settings section components
```

---

## State Management

All application state lives in a single **Zustand store** (`appStore.ts`). The shape is `AppState` (defined in `types/index.ts`).

### Store Structure

```typescript
AppState {
  // Data
  settings, countries, publicHolidays, roles, skills, systems,
  squads, processTeams, teamMembers, projects, assignments,
  timeOff, quarters, sprints, jiraConnections, jiraWorkItems,
  jiraSettings, scenarios, activeScenarioId,
  businessContacts, businessTimeOff, businessAssignments,
  jiraItemBizAssignments, localPhases,
  
  // UI
  version, lastModified
}
```

### State Mutations

All mutations go through **action helpers** in `actions.ts`. These call `useAppStore.getState().updateData(partial)` directly — no reducers, no async. Side effects (Supabase writes) are triggered reactively via a `useEffect` in `appStore.ts` that watches for state changes.

### Supabase Sync

The sync model is optimistic:
1. User action → `actions.ts` updates local store immediately
2. Store change detected → `supabaseSync.ts` serializes and writes to Supabase in background
3. Sync status indicator in the sidebar shows `idle / saving / saved / error / offline`

On app startup, `initializeFromSupabase()` reads the full state from Supabase tables.

---

## View Routing

There is **no URL-based router**. Views are tracked as a `currentView: ViewType` string in the Zustand store. `App.tsx` renders the matching page component:

```typescript
const pages: Record<ViewType, React.ComponentType> = {
  dashboard: Dashboard,
  timeline: Timeline,
  projects: Projects,    // "Epics" in the sidebar label
  team: Team,
  jira: Projects,        // alias — same component as 'projects'
  scenarios: Scenarios,
  settings: Settings,
};
```

Keyboard shortcuts `1`–`6` navigate between `dashboard`, `timeline`, `projects`, `team`, `scenarios`, `settings`. `Ctrl+K` opens the command palette.

---

## Gantt Bar Positioning Logic

### Core Concept

Bars are positioned with **percentage-based `left` and `width`** within a horizontally scrollable gantt area. No CSS grid is used for bar placement — only the column header grid uses CSS grid.

### Date Resolution

Each `JiraWorkItem` goes through a three-pass date resolution in `itemDates()`:

1. **Pass 1 — Explicit Jira dates**: `item.startDate` / `item.dueDate`
2. **Pass 2 — Sprint object dates**: `item.sprintStartDate` / `item.sprintEndDate` (fetched from the Jira sprint object)
3. **Pass 3 — Sprint name lookup**: parses `item.sprintName` (e.g. `"Sprint 3"`) and looks up in the generated/saved sprints list

### Rollup

After leaf dates are resolved, a second pass rolls up parent dates:
- **Features**: span the min start → max end of their child stories
- **Epics**: span the min start → max end of their features (which are already rolled up)

### Bar Layout Calculation (`barLayout()`)

```typescript
function barLayout(start, end, vStart, vEnd): BarLayout {
  // vStart / vEnd = view window bounds (quarter or full year)
  const total = vEnd - vStart;
  const clipLeft  = start < vStart;   // bar starts before viewport
  const clipRight = end   > vEnd;     // bar ends after viewport
  const dStart = clipLeft  ? vStart : start;
  const dEnd   = clipRight ? vEnd   : end;
  return {
    left:  (dStart - vStart) / total,   // 0.0 – 1.0
    width: (dEnd   - dStart) / total,   // 0.0 – 1.0
    clipLeft, clipRight, hidden: false,
  };
}
```

`left` and `width` are applied as `${value * 100}%` inline styles.

### View Modes

- **Quarter mode** (default): `vStart`/`vEnd` are the bounds of the currently selected quarter (derived from sprint dates)
- **Full Year mode**: `vStart`/`vEnd` span the entire year

The quarter navigator (prev/next arrows) updates `qtrIdx`, which re-derives `vStart`/`vEnd`, causing all bars to recompute their layout.

---

## Continuation Arrows (clip-left / clip-right)

When a bar extends beyond the visible viewport boundary, it is visually "clipped" and shows a triangle arrow indicating the bar continues beyond the edge. This is critical for the PM to know that an Epic spans multiple quarters.

### Classes

```css
.gantt-bar-clip-left  { border-left: none; border-top-left-radius: 0; border-bottom-left-radius: 0; }
.gantt-bar-clip-right { border-right: none; border-top-right-radius: 0; border-bottom-right-radius: 0; }
```

### Pseudo-elements (defined in `index.css`)

```css
.gantt-bar-clip-left::before {
  /* Left-pointing triangle at the left edge of the bar */
  border-right: 8px solid rgba(0,0,0,.22);
  /* ... */
}
.gantt-bar-clip-right::after {
  /* Right-pointing triangle at the right edge of the bar */
  border-left: 8px solid rgba(0,0,0,.22);
  /* ... */
}
```

**Critical rule**: Gantt rows must **never** have `overflow: hidden`. The pseudo-elements render outside the bar's own bounds; clipping the row hides them.

---

## CSS Design Token System

The app uses **Tailwind CSS** with a custom theme, plus custom CSS properties defined in `index.css`. All colours in component styles must use Tailwind utility classes (which map to the Tailwind config) or the CSS custom properties below.

### Mileway Brand Colours (via Tailwind config)

The `tailwind.config.js` extends with Mileway brand colours:

| Token | Value | Usage |
|---|---|---|
| `mw-blue` | `#0089DD` | IT track, primary actions, Gantt bars, hover accents |
| `mw-purple` | `#7C3AED` | BIZ track, scenario labels, LocalPhase form |
| `mw-grey` | (medium grey) | Borders, muted text |
| `mw-grey-light` | (light grey) | Scrollbar thumb |
| `mw-grey-lighter` | (lightest grey) | Scrollbar track, surface-2 background |
| `mw-dark` | (dark bg) | Dark mode background |

### Gantt Bar Colours (hardcoded in `JiraGantt.tsx`)

> **Note:** These are intentionally hardcoded in the BAR constant, not CSS variables. If you need to update bar colours, update the `BAR` constant in `JiraGantt.tsx`.

| Item Type | Fill | Border |
|---|---|---|
| Epic | `rgba(0,137,221,0.10)` | `#0089DD` 2px |
| Feature | `#BAE0F7` | `#0089DD` 1px |
| Story / Task | `#D0CCC8` | `#A09D97` 1px |
| Bug | `#FECACA` | `#EF4444` 1px |
| UAT | `#CDB0F5` | `#9B6EE2` 1px |
| Hypercare | `#90D9B8` | `#1A7A52` 1px |

### Key Global Custom Properties

These are declared in `index.css` or via Tailwind tokens:

| Property | Value | Notes |
|---|---|---|
| `--today-line` | `#E63946` | Today line in Gantt (applied inline) |
| `--current-sprint-bg` | `rgba(0,137,221,0.04)` | Current sprint column tint (applied inline) |

---

## Slide-Out Panel

A single slide-out panel (`SlidePanel` in `JiraGantt.tsx`) is the universal detail view for all Jira items.

### Trigger

- Click any Gantt bar → `setPanelItem(item)`
- Click any label row → `setPanelItem(item)`

### Behaviour

- Slides in from the right: `width: 420px`, `translateX(0)` when open
- Backdrop overlay: `bg-black/20 backdrop-blur-[2px]`
- Close via: X button, clicking backdrop, or pressing `Escape`
- Transition: `cubic-bezier(0.4,0,0.2,1)` 250ms

### Content Layout

1. **Header**: Type chip + Jira key link + item summary
2. **Assignees section**: Two-column grid — IT (blue tint) | BIZ/Business (purple tint)
3. **Details section**: Status badge, sprint name, date range, story points

---

## Expand / Collapse Row System

The Gantt maintains two `Set<string>` states:

- `expandedEpics` — set of Epic `jiraKey`s that are expanded
- `expandedFeatures` — set of Feature `jiraKey`s that are expanded

A flat `rows` array is derived from these sets. Each entry has a `kind` (`'jira' | 'phase' | 'add-phase'`) and a `level` (0 = epic, 1 = feature, 2 = story/task/bug).

The label column and gantt area render the same `rows` array in parallel, ensuring vertical alignment is always maintained.

**Expand All / Collapse All** toggles the `allExpanded` boolean and populates both sets with all keys (or clears them).

---

## Jira Integration

### Sync Flow

1. User triggers sync from Settings → Jira section
2. `jira.ts` fetches all items matching the configured JQL + item type filters
3. `jiraSync.ts` produces a `JiraSyncDiff` (toAdd, toUpdate, toRemove, toKeepStale)
4. User reviews diff in `ScenarioDiffModal` (or auto-applies if configured)
5. `appStore.ts` applies the diff to `jiraWorkItems[]`
6. `supabaseSync.ts` persists changes

### Stale Items

Items that disappear from Jira but have local mappings (project/phase/member) are marked `staleFromJira: true` and kept in the store. They appear slightly muted in the UI with a warning indicator.

### Hierarchy Modes

| Mode | Description |
|---|---|
| `auto` | Jira Epics → local Projects; Jira Features → local Phases |
| `epic_as_project` | Forces Epics as the top-level project |
| `feature_as_project` | Treats Features as standalone projects |

---

## Authentication

When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, Supabase Auth is enabled. The `Login.tsx` page handles sign-in. `useCurrentUser.ts` returns the current auth user.

If Supabase is not configured (`isSupabaseConfigured()` returns `false`), the app runs in **local-only mode** — no auth required, state is ephemeral.

RBAC is enforced at the Supabase level via Row Level Security policies (see `supabase/migrations/009_security_auth_rbac.sql`).
