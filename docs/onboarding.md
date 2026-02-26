# Developer Onboarding Guide

## What Is This Project?

The Mileway IT Capacity Planner is an internal web tool built for the VS Finance project team at Mileway BV. The team runs IT projects across ERP and EPM systems, working closely with business stakeholders from Finance and Operations. The challenge is that IT plans their work in Jira (Epics, Features, Stories, sprints), while the business side tracks availability in spreadsheets or not at all.

This app bridges that gap. It pulls the Jira hierarchy into a visual Gantt timeline, lets the Project Manager assign business contacts to each Jira item, and shows both IT and business capacity side by side in a single view. The result is a planning tool that tells you both "who from IT is building this feature" and "who from Finance needs to be available to test and accept it" — at the same time.

---

## Running It Locally

The app is a React + Vite app. There is no server component — just a single-page app that talks to Supabase.

```bash
# Step 1: enter the frontend folder
cd frontend

# Step 2: install packages
npm install

# Step 3: set up environment variables
# Create a file called .env.local in the frontend/ folder:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Step 4: start the dev server
npm run dev
# → opens at http://localhost:5173
```

If you skip step 3 (no Supabase config), the app still runs in **local-only mode** — all data is held in memory and cleared on page refresh. This is fine for UI development.

To build for production: `npm run build` — outputs to `frontend/dist/`.

---

## The Four Views (and What's Coming)

| View | Status | What It Does |
|---|---|---|
| **Capacity** | ✅ Built | Dashboard showing team utilisation at a glance |
| **Timeline** | ✅ Built | Gantt chart of all Jira Epics, plus a Team capacity grid |
| **Epics** | ✅ Built | The full Jira hierarchy (Epic → Feature → Story). Where you assign business contacts. |
| **Team** | ✅ Built | Manage IT team members and Business Contacts (the people, not their assignments) |
| **Team Capacity View** | 🔜 Planned | Sprint-level capacity bars for every person — who is overloaded, who has room |
| **Sprint View** | 🔜 Planned | Sprint-scoped delivery detail |
| **AI Status Report Export** | 🔜 Planned | GPT-generated narrative of current project status |

> The sidebar calls the Epics view "Epics" (the code calls it `projects`). The sidebar calls the Capacity view "Capacity" (the code calls it `dashboard`). This naming inconsistency is known and intentional — the sidebar labels reflect what the PM calls them.

---

## The Dual-Track Concept

This is the most important concept in the app. Every item in the Jira hierarchy — every Epic, Feature, Story, and manually created UAT or Hypercare phase — has **two assignee tracks**:

- **IT track** (blue): the developer, BA, or architect from Jira
- **BIZ track** (purple): the Finance or Operations contact who needs to be available for that item

Both tracks are planned and tracked with equal weight. Both tracks consume days from their respective person's available capacity. Both tracks appear in the Timeline Gantt slide-out panel.

**Never add assignee fields for only one track.** If you build a feature that adds assignees, it must support both.

---

## Key Things NOT To Do

These rules come from hard-won lessons in the codebase. They are enforced in `.cursorrules` and this list is the plain-English version.

**1. Don't add assignees to only one track**
Every hierarchy level has IT + BIZ. Adding an IT-only or BIZ-only assignee field anywhere breaks the dual-track model.

**2. Don't put text labels on Gantt bars**
Bars are plain coloured rectangles. Assignee info lives in the slide-out panel (click the bar). Adding text inside bars breaks the visual design and creates overflow problems.

**3. Don't use CSS grid columns for bar positioning**
Gantt bars use `position: absolute` with percentage-based `left` and `width`. Bar positions come from dates, not from which grid column they happen to land in.

**4. Don't set `overflow: hidden` on Gantt rows**
The continuation arrows (the triangles that appear when a bar extends beyond the visible quarter) are CSS `::before`/`::after` pseudo-elements. If you add `overflow: hidden` to a gantt row, those arrows disappear silently.

**5. Don't hardcode hex values in component styles**
All colours must use Tailwind utility classes or CSS custom properties. No `color: #123456` scattered in JSX inline styles (except in the approved `BAR` constant in `JiraGantt.tsx`).

**6. Don't skip hierarchy levels**
The structure is always: Epic → Feature → Story or Phase. Never allow a Story to be the direct child of an Epic, or a Phase to float without a parent.

**7. Don't create inline edit forms for items**
The slide-out panel is the single detail/edit surface for all item types. Don't build a second edit form that pops up inline in the table or gantt.

**8. Don't think year-first**
Design every new view starting from a single-quarter perspective. A quarter = 6 sprints = the natural planning horizon. Full-year is a secondary toggle.

---

## Where to Find the Specs

| What | Where |
|---|---|
| Project overview | `docs/README.md` |
| All data entities | `docs/data-model.md` |
| Technical architecture | `docs/architecture.md` |
| Epics view spec | `docs/views/epic-view.md` |
| Timeline view spec | `docs/views/timeline-view.md` |
| Team Capacity view (planned) | `docs/views/team-view.md` |
| Original design specs | `Documentation/` folder (older, some diverge from code) |
| AI coding rules | `.cursorrules` |

---

## Jira Integration Context

Stories and Features come from Jira. Epics also come from Jira. The app syncs Jira items on demand (Settings → Jira → Sync). Sync is additive and non-destructive — items that disappear from Jira are marked "stale" but kept if they have local mappings.

**Phases (UAT, Hypercare) are NOT from Jira.** They are created manually by the PM inside the app using the "+ Phase" button on each Epic in the Timeline view. They are stored as `LocalPhase` records in the database.

When you see a Jira key like `ERP-1976` in the app, that refers to a live Jira issue in the ERP project. The Jira base URL is configured per connection in Settings.

---

## Database

The app uses Supabase (PostgreSQL). The schema is in `supabase/schema.sql`. Migrations are numbered `001` through `016` in `supabase/migrations/`. Always add new migrations as incrementing numbered files rather than editing schema.sql directly.

The full application state is stored in Supabase and loaded on login. The local Zustand store is the working copy; changes are written back to Supabase automatically in the background.
