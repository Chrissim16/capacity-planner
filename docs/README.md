# Mileway IT Capacity Planner — Developer Overview

## What Is This App?

The **Mileway IT Capacity Planner** is an internal planning tool built for the **VS Finance project team at Mileway BV**. The primary user is the **Project Manager** who oversees the full-year delivery of IT initiatives in the Value Stream Finance domain.

The app bridges two worlds:

- **IT Jira tracking** — Epics, Features, and Stories are synced from Jira and visualised on a Gantt timeline with sprint-level precision.
- **Business capacity planning** — Business contacts (Finance, Operations, etc.) are tracked alongside IT team members. Both tracks see their own assignees at every level of the hierarchy, with effort measured in days.

This dual-track model is the central design principle. Every item in the Jira hierarchy — Epic, Feature, Story, and manually created Phase — carries both an **IT assignee** (from Jira) and a **BIZ assignee** (linked from the local business contacts register).

---

## The Problem It Solves

Before this tool, the Project Manager had no unified view across:

1. What Jira work is planned for which sprint and who is doing it (IT side)
2. How much time business stakeholders are committing to testing, UAT, and hypercare (BIZ side)
3. Whether IT or BIZ people are overloaded in any given sprint or quarter

The app makes both capacity problems visible in one place, and allows manual annotation of business-specific phases (UAT, Hypercare) that are invisible in Jira.

---

## Views

| View | Status | Description |
|---|---|---|
| **Capacity** (`dashboard`) | ✅ Built | Team utilization summary across quarters |
| **Timeline** (`timeline`) | ✅ Built | Jira Gantt + Team capacity grid |
| **Epics** (`projects`) | ✅ Built | Jira hierarchy tree (Epic → Feature → Story), BIZ assignee management |
| **Team** (`team`) | ✅ Built | IT member + Business Contact management, card/list view |
| **Scenarios** (`scenarios`) | ✅ Built | What-if planning with isolated data copies |
| **Settings** (`settings`) | ✅ Built | Sprint config, Jira connections, countries, holidays, roles, etc. |
| **Team Capacity View** | 🔜 Planned | Sprint-level capacity bars with overloaded/underutilized indicators per person |
| **Sprint View** | 🔜 Planned | Sprint-scoped delivery detail |
| **AI Status Report Export** | 🔜 Planned | GPT-driven narrative export of project status |

> **Note:** "Epics" in the sidebar corresponds to the `projects` view type in code. "Capacity" in the sidebar corresponds to the `dashboard` view type.

---

## How to Run Locally

### Prerequisites

- Node.js 20.x (see `frontend/.node-version`)
- A Supabase project (for data persistence) — or the app runs in local-only mode without one

### Steps

```bash
# 1. Navigate to the frontend package
cd frontend

# 2. Install dependencies
npm install

# 3. Create your local environment file
# Copy from the example (not committed) or create manually:
echo "VITE_SUPABASE_URL=your-project-url" > .env.local
echo "VITE_SUPABASE_ANON_KEY=your-anon-key" >> .env.local

# 4. Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

If no Supabase credentials are configured, the app runs in **local-only mode** — all state is held in memory and lost on page refresh. This is useful for UI development.

### Build

```bash
cd frontend
npm run build      # outputs to frontend/dist/
npm run preview    # previews the built output locally
```

### Deploy

The app is deployed on **Vercel**. Push to the main branch; Vercel picks it up automatically from `frontend/`. See `frontend/vercel.json` for routing config.

---

## Folder Structure

```
capacity-planner-app/
├── frontend/                    # Main React application (Vite + TypeScript)
│   ├── src/
│   │   ├── App.tsx              # Root component, view routing, keyboard shortcuts
│   │   ├── main.tsx             # React entry point
│   │   ├── index.css            # Global styles, Gantt CSS, design tokens
│   │   ├── App.css              # (legacy / unused)
│   │   ├── components/
│   │   │   ├── JiraGantt.tsx    # Core Gantt chart component
│   │   │   ├── JiraHierarchyTree.tsx  # Collapsible Epic/Feature/Story tree
│   │   │   ├── ScenarioSelector.tsx
│   │   │   ├── ScenarioDiffModal.tsx
│   │   │   ├── layout/          # Header, Sidebar, Layout, PageHeader, NotificationBanner
│   │   │   ├── forms/           # AssignmentModal, TeamMemberForm, etc.
│   │   │   └── ui/              # Shared UI primitives (Button, Card, Modal, Toast, etc.)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx    # Capacity view
│   │   │   ├── Timeline.tsx     # Timeline view (Gantt + Team sub-modes)
│   │   │   ├── Projects.tsx     # Epics view (Jira hierarchy tree)
│   │   │   ├── Team.tsx         # Team management (IT + BIZ)
│   │   │   ├── Scenarios.tsx    # Scenario planner
│   │   │   ├── Settings.tsx     # Settings shell
│   │   │   ├── Login.tsx        # Auth gate
│   │   │   └── settings/        # Tabbed settings sections
│   │   ├── stores/
│   │   │   ├── appStore.ts      # Zustand store — single AppState
│   │   │   └── actions.ts       # All state mutation helpers
│   │   ├── services/
│   │   │   ├── supabase.ts      # Supabase client init
│   │   │   ├── supabaseSync.ts  # Read/write AppState from Supabase
│   │   │   ├── jira.ts          # Jira REST API client
│   │   │   └── nagerHolidays.ts # Public holiday fetch (nager.date)
│   │   ├── application/
│   │   │   ├── jiraSync.ts      # Jira diff + merge logic
│   │   │   ├── jiraProjectBuilder.ts  # Jira → Project/Phase mapping
│   │   │   └── assignmentSuggester.ts
│   │   ├── utils/
│   │   │   ├── sprints.ts       # Sprint generation, quarter lookup, workday calc
│   │   │   ├── capacity.ts      # IT + BIZ capacity calculations
│   │   │   ├── calendar.ts      # Quarter helpers, workday counting
│   │   │   ├── confidence.ts    # Confidence level buffers + rollup
│   │   │   └── importExport.ts  # XLSX export
│   │   ├── types/
│   │   │   └── index.ts         # All TypeScript interfaces and types
│   │   └── hooks/
│   │       └── useCurrentUser.ts
│   ├── public/
│   │   └── mileway-logo.png
│   ├── docs/                    # (older generated docs — superseded by /docs at root)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── docs/                        # ← Project documentation (this folder)
│   ├── README.md                # This file
│   ├── data-model.md            # All data entities and their fields
│   ├── architecture.md          # Technical architecture reference
│   ├── onboarding.md            # Onboarding guide for new developers
│   └── views/
│       ├── epic-view.md         # Epics page spec
│       ├── timeline-view.md     # Timeline page spec (Gantt + Team)
│       └── team-view.md         # Team capacity view spec (PLANNED)
├── supabase/
│   ├── schema.sql               # Full DB schema
│   └── migrations/              # Numbered migration files (001–016)
├── Documentation/               # (older spec documents — kept for reference)
│   ├── timeline-view-spec.md    # Original timeline spec (compare with docs/views/)
│   └── ...
├── .cursorrules                 # AI coding rules for this project
├── .gitignore
└── vercel.json                  # Vercel routing config (root-level, redirects to frontend)
```

---

## Key Design Decisions

- **Dual-track IT/BIZ model**: Every hierarchy level has both IT and BIZ assignees. This is non-negotiable and must be preserved in all new features.
- **Quarter-first design**: The default view is a single quarter (6 sprints). Full-year is a secondary mode.
- **No build required for reference files**: The `reference/` folder contains static HTML prototypes used as design references.
- **Avatars only on Gantt bars**: No text labels. Bars are positioned using percentage-based `left`/`width` CSS, not grid columns.
- **Supabase-backed persistence**: The app syncs to a Supabase PostgreSQL database. See `docs/architecture.md` for the sync model.
