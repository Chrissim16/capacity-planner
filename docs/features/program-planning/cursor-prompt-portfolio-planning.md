# Cursor Prompt — Portfolio Planning Feature

## ⚠️ BEFORE WRITING ANY CODE — MANDATORY CONFLICT CHECK

Before implementing anything, audit the existing codebase for conflicts and ask Dennis explicitly about each one. Do not proceed past this step until Dennis has confirmed every item.

### Files to audit and questions to answer:

**1. Nav / routing**
- Open the main router file (likely `frontend/src/App.tsx`). Does a `/portfolio-planning` or `/portfolio` route already exist? List all current routes.
- Open the sidebar component (likely `frontend/src/components/layout/Sidebar.tsx`). List all current nav items and their order. Where should Portfolio Planning sit?

**2. Types**
- Open `frontend/src/types/index.ts`. Search for any existing type named `EpicPhaseEstimate`, `EpicPhasePlan`, `EpicPhaseAssignment`, `PortfolioPlan`, `PlanningPhase`, or `ProgrammePlanning`. Report exactly what you find.
- Check whether `JiraWorkItem` has any `phase`, `programmePhase`, or portfolio-related fields already.
- Check the exact shape of `ProcessTeam` in the types file — the new feature groups people and Epics by process team.

**3. Existing hooks and utilities**
- Search for any hook matching `usePortfolioPlan`, `useEpicPhaseEstimates`, or `useProcessTeamCapacitySummaries`. The implementation plan at `docs/plans/2026-03-20-implementation-plan.md` references `SHARED-A` (`useProcessTeamCapacitySummaries`) — check if it was built.
- Find `calculateCapacity` and `calculateBusinessCapacityForQuarter` in `frontend/src/utils/`. Confirm they exist and report their exact function signatures.
- Search for any existing absence/leave lookup utility.

**4. Supabase migrations**
- List the highest-numbered migration file in `supabase/migrations/`. The new migration must be the next number.
- Search all migration files for any table named `epic_phase_estimates`, `epic_phase_plans`, `epic_phase_assignments`, or `portfolio_epics`.

**5. Existing portfolio/programme files**
- Search the entire `frontend/src/` directory for any file containing "programme", "portfolio", "portfolioplanning", or "programmeplanning" (case-insensitive). Report every match.

**After completing the audit, write a numbered list of every conflict, collision, or ambiguity found and ask Dennis to confirm how to proceed for each one. Do not write any implementation code until Dennis has responded.**

---

## Feature Overview

Build a new **Portfolio Planning** view for the VS Finance Capacity Planner. A PM selects Jira Epics, enters phase-level estimates (Design / Build / Test / Deploy / Hypercare) per person per phase, sets a start date for each phase, and can see overcommitment before any sprint scheduling happens.

The **visual and structural reference is `portfolio-planning-v12.html`** (attached). When this spec and the HTML file conflict on visual details, the HTML file wins. The only deliberate exception is phase colors — see the Phase Colors section below.

---

## Design System — Exact CSS from v12

Copy these CSS variables into the component's stylesheet. Do not invent alternatives.

### CSS custom properties
```css
--white:#FFFFFF; --bg:#FAFAFA; --offwh:#F5F8FC;
--border:#E2E8F0; --bord-lt:#F1F5F9;
--txt1:#1E293B; --txt2:#64748B; --txt3:#94A3B8;
--blue:#0089DD; --blue-lt:#EBF5FC;
--util-over:#EF4444; --util-near:#F59E0B; --util-ok:#22C55E; --util-bench:#94A3B8;

/* Row heights */
--row-epic:40px; --row-phase:38px; --row-person:34px; --row-add:28px;
--row-p-hd:40px; --row-p-cap:26px;

/* Layout */
--week-w:52px;   /* overridden dynamically at runtime */
--left-w:460px; --topbar-h:52px; --tabbar-h:40px; --drawer-w:420px;
```

### Phase colors — ⚠️ DELIBERATELY CHANGED from v12

The v12 prototype uses vivid phase colors. Per Dennis's instruction, replace them with these muted versions in the production build:

```css
/* DO NOT use the v12 originals. Use these instead: */
--d-c:#6D4FC2; --d-bg:#F0EBFF; --d-bd:#D4C5F9;  /* Design */
--b-c:#2563EB; --b-bg:#EFF6FF; --b-bd:#BFDBFE;  /* Build */
--t-c:#B45309; --t-bg:#FFFBEB; --t-bd:#FDE68A;  /* Test */
--p-c:#15803D; --p-bg:#F0FDF4; --p-bd:#BBF7D0;  /* Deploy */
--h-c:#BE185D; --h-bg:#FDF2F8; --h-bd:#FBCFE8;  /* Hypercare */
```

Apply everywhere phase classes are used: `.ph-label`, `.pbar`, `.abar`, `.pv-pp`, `.cg-bar`.

---

## Exact Component CSS

The following is extracted verbatim from `portfolio-planning-v12.html`. Implement exactly as shown.

### Global
```css
body { font-family:'DM Sans',sans-serif; background:var(--bg); color:var(--txt1); font-size:13px; overflow:hidden; height:100vh; }
::-webkit-scrollbar { width:6px; height:6px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
```

### Topbar
```css
.topbar { height:var(--topbar-h); background:var(--white); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; padding:0 20px; position:fixed; top:0; left:0; right:0; z-index:300; transition:right 300ms ease; }
.topbar.drawer-open { right:var(--drawer-w); }
.tb-title { font-size:15px; font-weight:600; flex:1; display:flex; align-items:center; gap:8px; }
.tb-badge { font-size:11px; color:var(--txt3); background:var(--offwh); border:1px solid var(--border); padding:2px 8px; border-radius:4px; }
.seg { display:flex; background:var(--offwh); border:1px solid var(--border); border-radius:6px; overflow:hidden; }
.seg-btn { padding:5px 12px; font-size:12px; font-weight:500; border:none; background:transparent; color:var(--txt2); cursor:pointer; font-family:inherit; transition:all 100ms; white-space:nowrap; }
.seg-btn.on { background:var(--white); color:var(--txt1); box-shadow:0 1px 3px rgba(0,0,0,.08); }
.btn { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:6px; border:1px solid var(--border); background:var(--white); color:var(--txt1); font-size:12px; font-weight:500; font-family:inherit; cursor:pointer; transition:all 100ms; white-space:nowrap; flex-shrink:0; }
.btn:hover { background:var(--offwh); }
.btn.active { background:#FFF7ED; border-color:#FED7AA; color:#C2410C; }
.btn.primary { background:var(--blue); border-color:var(--blue); color:#fff; }
.btn.primary:hover { background:#0078C4; }
.divider { width:1px; height:22px; background:var(--border); }
```

### Tab bar
```css
.tabbar { height:var(--tabbar-h); background:var(--white); border-bottom:1px solid var(--border); display:flex; align-items:stretch; padding:0 20px; position:fixed; top:var(--topbar-h); left:0; right:0; z-index:299; transition:right 300ms ease; }
.tabbar.drawer-open { right:var(--drawer-w); }
.tab { padding:0 16px; font-size:13px; font-weight:500; color:var(--txt2); cursor:pointer; display:flex; align-items:center; gap:6px; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 120ms; user-select:none; }
.tab.on { color:var(--blue); border-bottom-color:var(--blue); }
```

### App layout
```css
.app { margin-top:calc(var(--topbar-h) + var(--tabbar-h)); height:calc(100vh - var(--topbar-h) - var(--tabbar-h)); display:flex; overflow:hidden; transition:margin-right 300ms ease; }
.app.drawer-open { margin-right:var(--drawer-w); }
.view { display:none; width:100%; height:100%; }
.view.on { display:flex; }
```

### Left panel
```css
.lp { width:var(--left-w); flex-shrink:0; background:var(--white); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; z-index:10; }
.lp-hd { height:52px; flex-shrink:0; border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 14px; gap:8px; background:var(--white); }
.lp-hd-label { font-size:10px; font-weight:600; color:var(--txt3); text-transform:uppercase; letter-spacing:.06em; }
.lp-body { flex:1; overflow-y:auto; overflow-x:hidden; }
.rp { flex:1; overflow:hidden; display:flex; flex-direction:column; }
.rp-scroll { flex:1; overflow:auto; }
.collapse-btn { font-size:11px; font-weight:500; color:var(--txt2); background:transparent; border:1px solid var(--border); border-radius:4px; padding:3px 8px; cursor:pointer; font-family:inherit; transition:all 100ms; white-space:nowrap; }
.collapse-btn:hover { background:var(--offwh); color:var(--txt1); }
.hint-bar { padding:0 16px; height:28px; background:#FFF7ED; border-bottom:1px solid #FED7AA; display:none; align-items:center; gap:6px; font-size:11px; color:#92400E; flex-shrink:0; }
.hint-bar.on { display:flex; }
```

### Epic rows
```css
.ev-epic { height:var(--row-epic); display:flex; align-items:center; background:var(--offwh); border-bottom:1px solid var(--border); padding:0 12px; gap:8px; cursor:pointer; user-select:none; transition:background 100ms; }
.ev-epic:hover { background:#EEF2F8; }
.chev { width:16px; height:16px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:var(--txt3); font-size:9px; transition:transform 150ms; }
.chev.open { transform:rotate(90deg); }
.jkey { font-size:10px; font-weight:600; color:var(--blue); background:var(--blue-lt); padding:2px 6px; border-radius:4px; flex-shrink:0; }
.ev-epic-name { font-size:13px; font-weight:600; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ev-epic-total { font-size:11px; color:var(--txt2); flex-shrink:0; }
.ev-epic-remove { width:20px; height:20px; display:flex; align-items:center; justify-content:center; border-radius:4px; cursor:pointer; color:var(--txt3); font-size:16px; flex-shrink:0; opacity:0; transition:all 100ms; border:none; background:transparent; }
.ev-epic:hover .ev-epic-remove { opacity:1; }
.ev-epic-remove:hover { background:#FEE2E2; color:var(--util-over); }
```

### Phase rows
```css
.ev-phase { height:var(--row-phase); display:flex; align-items:center; padding:0 12px 0 32px; gap:8px; border-bottom:1px solid var(--bord-lt); user-select:none; transition:background 100ms; }
.ev-phase:hover { background:var(--offwh); }
.ph-label { font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; flex-shrink:0; }
.ph-dates { font-size:11px; color:var(--txt3); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ph-dates.set { color:var(--txt2); }
.ph-dur { font-size:11px; font-weight:600; color:var(--txt1); flex-shrink:0; }
.ph-total { font-size:11px; color:var(--txt2); flex-shrink:0; min-width:44px; text-align:right; }
.ph-expand { cursor:pointer; flex-shrink:0; }
.ph-remove { width:18px; height:18px; display:flex; align-items:center; justify-content:center; border-radius:3px; cursor:pointer; color:var(--txt3); font-size:14px; flex-shrink:0; opacity:0; transition:all 100ms; border:none; background:transparent; }
.ev-phase:hover .ph-remove { opacity:1; }
.ph-remove:hover { color:var(--util-over); background:#FEE2E2; }
```

### Person rows
```css
.ev-person { height:var(--row-person); display:flex; align-items:center; padding:0 12px 0 48px; gap:8px; border-bottom:1px solid var(--bord-lt); background:var(--white); transition:background 100ms; }
.ev-person:hover { background:#F8FAFD; }
.av { width:22px; height:22px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:600; color:#fff; }
.ev-pname { font-size:12px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ev-prole { font-size:10px; color:var(--txt3); flex-shrink:0; }
.ev-days { font-size:12px; font-weight:600; min-width:36px; text-align:right; flex-shrink:0; }
.ev-days-inp { width:52px; border:1px solid var(--border); border-radius:4px; padding:3px 6px; font-size:12px; font-family:inherit; text-align:center; display:none; background:var(--white); }
.ev-days-inp:focus { outline:none; border-color:var(--blue); box-shadow:0 0 0 2px rgba(0,137,221,.12); }
.edit-on .ev-days { display:none; }
.edit-on .ev-days-inp { display:block; }
.ev-person-remove { width:16px; height:16px; display:flex; align-items:center; justify-content:center; border-radius:3px; cursor:pointer; color:var(--txt3); font-size:13px; opacity:0; transition:all 100ms; border:none; background:transparent; flex-shrink:0; }
.ev-person:hover .ev-person-remove { opacity:1; }
.ev-person-remove:hover { color:var(--util-over); }
.ev-add-person { height:var(--row-add); display:flex; align-items:center; gap:5px; padding:0 12px 0 48px; color:var(--txt3); font-size:11px; cursor:pointer; border-bottom:1px solid var(--bord-lt); transition:all 100ms; user-select:none; }
.ev-add-person:hover { color:var(--blue); background:var(--blue-lt); }
```

### Gantt
```css
.g-head { position:sticky; top:0; z-index:20; background:var(--white); border-bottom:1px solid var(--border); }
.g-months { height:24px; display:flex; border-bottom:1px solid var(--bord-lt); }
.g-month { font-size:11px; font-weight:600; color:var(--txt2); display:flex; align-items:center; padding:0 8px; border-right:1px solid var(--bord-lt); flex-shrink:0; }
.g-weeks { height:28px; display:flex; }
.g-week { width:var(--week-w); flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; border-right:1px solid var(--bord-lt); }
.g-week.ms { border-left:2px solid var(--border); }
.g-week.today-week { background:var(--blue-lt); }
.g-wnum { font-size:10px; font-weight:600; color:var(--txt3); }
.g-wdate { font-size:10px; color:var(--txt3); }
.g-epic   { height:var(--row-epic);   border-bottom:1px solid var(--border); position:relative; background:var(--offwh); overflow:visible; }
.g-phase  { height:var(--row-phase);  border-bottom:1px solid var(--bord-lt); position:relative; background:var(--white); }
.g-person { height:var(--row-person); border-bottom:1px solid var(--bord-lt); position:relative; background:var(--white); }
.g-add    { height:var(--row-add);    border-bottom:1px solid var(--bord-lt); background:var(--white); }
.g-grid { position:absolute; inset:0; display:flex; pointer-events:none; }
.g-col  { width:var(--week-w); flex-shrink:0; height:100%; border-right:1px solid var(--bord-lt); }
.g-col.ms { border-left:2px solid var(--border); }
.g-col.today-col { background:rgba(0,137,221,.04); }
.g-phase.empty-phase.edit-on { cursor:pointer; }
.g-phase.empty-phase.edit-on:hover { background:#F0F7FF; }
.g-click-cols { position:absolute; inset:0; display:flex; z-index:2; }
.g-click-col  { width:var(--week-w); flex-shrink:0; height:100%; border-right:1px solid transparent; transition:background 100ms; }
.g-click-col:hover { background:rgba(0,137,221,.12); }
.set-start-hint { position:absolute; inset:0; display:none; align-items:center; justify-content:center; font-size:11px; color:var(--txt3); pointer-events:none; gap:5px; z-index:1; }
.edit-on .g-phase.empty-phase .set-start-hint { display:flex; }
.today-line { position:absolute; top:0; bottom:0; width:2px; background:var(--blue); z-index:10; pointer-events:none; opacity:.7; }
.pbar { position:absolute; top:7px; height:24px; border-radius:4px; border:1.5px solid transparent; display:flex; align-items:center; padding:0 10px; font-size:11px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; z-index:3; user-select:none; transition:box-shadow 100ms; cursor:default; min-width:10px; }
.edit-on .pbar { cursor:grab; }
.edit-on .pbar:hover { box-shadow:0 2px 10px rgba(0,0,0,.14); }
.pbar.dragging { cursor:grabbing!important; box-shadow:0 4px 18px rgba(0,0,0,.18)!important; z-index:100; opacity:.9; transition:none; }
/* Apply muted phase colors to .pbar.d .pbar.b .pbar.t .pbar.p .pbar.h */
```

### People View
```css
.pv-person-hd { height:var(--row-p-hd); display:flex; align-items:center; padding:0 12px; gap:10px; background:var(--white); border-bottom:1px solid var(--border); cursor:pointer; user-select:none; }
.pv-person-hd:hover { background:#F8FAFD; }
.av-lg { width:28px; height:28px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:#fff; }
.pv-pinfo { flex:1; min-width:0; }
.pv-pname { font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pv-prole { font-size:11px; color:var(--txt3); }
.pv-util-pill { font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; flex-shrink:0; }
.pv-util-pill.over{background:#FEE2E2;color:var(--util-over);}
.pv-util-pill.near{background:#FEF3C7;color:var(--util-near);}
.pv-util-pill.ok{background:#DCFCE7;color:#16A34A;}
.pv-util-pill.bench{background:var(--offwh);color:var(--txt3);}
.pv-cap-row { height:var(--row-p-cap); display:flex; align-items:center; padding:0 12px 0 50px; gap:8px; border-bottom:1px solid var(--border); background:var(--offwh); }
.pv-cap-bar { flex:1; height:5px; border-radius:3px; background:var(--bord-lt); overflow:hidden; }
.pv-cap-fill { height:100%; border-radius:3px; }
.pv-cap-fill.over{background:var(--util-over);}
.pv-cap-fill.near{background:var(--util-near);}
.pv-cap-fill.ok{background:var(--util-ok);}
.pv-cap-fill.bench{background:var(--util-bench);}
.pv-cap-label { font-size:11px; color:var(--txt2); white-space:nowrap; flex-shrink:0; }
.pv-assign { height:var(--row-person); display:flex; align-items:center; padding:0 12px 0 50px; gap:8px; border-bottom:1px solid var(--bord-lt); background:var(--white); }
.pv-assign:hover { background:#F8FAFD; }
.pv-assign-key { font-size:10px; font-weight:600; color:var(--blue); background:var(--blue-lt); padding:2px 6px; border-radius:4px; flex-shrink:0; }
.pv-assign-name { font-size:12px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pv-assign-days { font-size:12px; font-weight:600; flex-shrink:0; }
.pv-pp { font-size:10px; font-weight:600; padding:1px 5px; border-radius:3px; }
/* Apply muted phase colors to .pv-pp.d/.b/.t/.p/.h */
.g-pv-phd  { height:var(--row-p-hd);  border-bottom:1px solid var(--border); position:relative; background:var(--offwh); }
.g-pv-cap  { height:var(--row-p-cap); border-bottom:1px solid var(--border); position:relative; background:var(--offwh); }
.g-pv-asgn { height:var(--row-person); border-bottom:1px solid var(--bord-lt); position:relative; background:var(--white); }
.abar { position:absolute; top:7px; height:20px; border-radius:4px; display:flex; align-items:center; padding:0 7px; font-size:11px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; z-index:3; user-select:none; }
.abar:hover { box-shadow:0 2px 8px rgba(0,0,0,.12); z-index:4; }
/* Apply muted phase colors to .abar.d/.b/.t/.p/.h with border:1.5px solid [phase border color] */
.heat-row { position:absolute; inset:0; display:flex; pointer-events:none; }
.heat-cell { width:var(--week-w); flex-shrink:0; height:100%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:600; border-right:1px solid var(--bord-lt); }
.heat-cell.over{background:rgba(239,68,68,.12);color:var(--util-over);}
.heat-cell.near{background:rgba(245,158,11,.10);color:var(--util-near);}
.heat-cell.ok{background:rgba(34,197,94,.08);color:#16A34A;}
.heat-cell.bench{background:transparent;color:var(--txt3);}
```

### Summary tab
```css
.sv { flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:24px; background:var(--bg); }
.sec-hd { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.sec-title { font-size:13px; font-weight:600; color:var(--txt1); }
.sec-sub { font-size:12px; color:var(--txt3); }
.kpi-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
.kpi-card { background:var(--white); border:1px solid var(--border); border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:10px; }
.kpi-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
.kpi-team { font-size:12px; font-weight:600; color:var(--txt1); }
.kpi-badge { font-size:10px; font-weight:600; padding:2px 7px; border-radius:4px; flex-shrink:0; }
.kpi-badge.over { background:#FEE2E2; color:var(--util-over); }
.kpi-nums { display:flex; align-items:baseline; gap:4px; }
.kpi-est   { font-size:22px; font-weight:600; color:var(--txt1); line-height:1; }
.kpi-avail { font-size:12px; color:var(--txt3); }
.kpi-bar   { height:6px; border-radius:3px; background:var(--bord-lt); overflow:hidden; }
.kpi-bar-fill { height:100%; border-radius:3px; transition:width 400ms; }
.kpi-bar-fill.over{background:var(--util-over);}
.kpi-bar-fill.near{background:var(--util-near);}
.kpi-bar-fill.ok{background:var(--util-ok);}
.kpi-bar-fill.bench{background:var(--util-bench);}
.cg-wrap { background:var(--white); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
.cg-head { display:flex; border-bottom:1px solid var(--border); background:var(--offwh); }
.cg-label-col { width:280px; flex-shrink:0; border-right:1px solid var(--border); display:flex; align-items:center; padding:0 14px; height:36px; }
.cg-label-hd { font-size:10px; font-weight:600; color:var(--txt3); text-transform:uppercase; letter-spacing:.06em; }
.cg-weeks-hd { flex:1; display:flex; overflow:hidden; }
.cg-week-hd { flex:1; display:flex; align-items:center; justify-content:center; font-size:10px; color:var(--txt3); border-right:1px solid var(--bord-lt); height:36px; white-space:nowrap; font-weight:500; }
.cg-week-hd.ms { border-left:2px solid var(--border); }
.cg-week-hd.today-w { background:var(--blue-lt); color:var(--blue); font-weight:600; }
.cg-team-row { display:flex; border-bottom:1px solid var(--border); background:var(--offwh); }
.cg-team-label { width:280px; flex-shrink:0; border-right:1px solid var(--border); display:flex; align-items:center; padding:0 14px; height:30px; gap:8px; }
.cg-team-name { font-size:11px; font-weight:600; color:var(--txt2); }
.cg-team-gantt { flex:1; height:30px; position:relative; }
.cg-epic-row { display:flex; border-bottom:1px solid var(--bord-lt); }
.cg-epic-row:last-child { border-bottom:none; }
.cg-epic-label { width:280px; flex-shrink:0; border-right:1px solid var(--border); display:flex; align-items:center; padding:0 14px 0 22px; height:32px; gap:7px; overflow:hidden; }
.cg-epic-key { font-size:10px; font-weight:600; color:var(--blue); background:var(--blue-lt); padding:1px 5px; border-radius:3px; flex-shrink:0; }
.cg-epic-name { font-size:11px; color:var(--txt1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cg-epic-gantt { flex:1; height:32px; position:relative; overflow:visible; }
.cg-grid { position:absolute; inset:0; display:flex; pointer-events:none; }
.cg-col { flex:1; height:100%; border-right:1px solid var(--bord-lt); }
.cg-col.ms { border-left:2px solid var(--border); }
.cg-col.today-c { background:rgba(0,137,221,.04); }
.cg-bar { position:absolute; top:5px; height:22px; border-radius:3px; border:1.5px solid transparent; font-size:10px; font-weight:500; display:flex; align-items:center; padding:0 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; user-select:none; z-index:2; }
/* Apply muted phase colors to .cg-bar.d/.b/.t/.p/.h */
.cg-today-line { position:absolute; top:0; bottom:0; width:2px; background:var(--blue); opacity:.6; z-index:5; pointer-events:none; }
.pct-wrap { background:var(--white); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
.pct-hd { display:grid; grid-template-columns:200px 80px 80px 1fr 60px; gap:0; border-bottom:1px solid var(--border); background:var(--offwh); height:34px; }
.pct-hd-cell { display:flex; align-items:center; padding:0 14px; font-size:10px; font-weight:600; color:var(--txt3); text-transform:uppercase; letter-spacing:.06em; border-right:1px solid var(--bord-lt); }
.pct-hd-cell:last-child { border-right:none; }
.pct-row { display:grid; grid-template-columns:200px 80px 80px 1fr 60px; border-bottom:1px solid var(--bord-lt); min-height:42px; }
.pct-row:last-child { border-bottom:none; }
.pct-cell { display:flex; align-items:center; padding:0 14px; border-right:1px solid var(--bord-lt); font-size:12px; }
.pct-cell:last-child { border-right:none; }
.pct-person { gap:8px; }
.pct-bar-cell { flex-direction:column; justify-content:center; gap:4px; padding:8px 14px; }
.pct-bar { width:100%; height:6px; border-radius:3px; background:var(--bord-lt); overflow:hidden; }
.pct-bar-fill { height:100%; border-radius:3px; }
.pct-bar-fill.over{background:var(--util-over);}
.pct-bar-fill.near{background:var(--util-near);}
.pct-bar-label { font-size:10px; color:var(--txt3); }
.pct-delta { font-size:12px; font-weight:600; }
.pct-delta.over{color:var(--util-over);}
.pct-delta.near{color:var(--util-near);}
.pct-delta.ok{color:#16A34A;}
.pct-empty { padding:32px; text-align:center; color:var(--txt3); font-size:13px; }
```

### Drawer
```css
.drawer { position:fixed; top:0; right:0; bottom:0; width:var(--drawer-w); background:var(--white); border-left:1px solid var(--border); display:flex; flex-direction:column; transform:translateX(100%); transition:transform 300ms ease; z-index:400; box-shadow:-4px 0 24px rgba(0,0,0,.08); }
.drawer.open { transform:translateX(0); }
.dr-head { height:var(--topbar-h); flex-shrink:0; border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 16px; gap:10px; }
.dr-title { font-size:14px; font-weight:600; flex:1; }
.dr-close { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:6px; cursor:pointer; color:var(--txt2); font-size:18px; border:none; background:transparent; }
.dr-close:hover { background:var(--offwh); }
.dr-filters { padding:12px 16px; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:8px; }
.dr-search { display:flex; align-items:center; gap:8px; border:1px solid var(--border); border-radius:6px; padding:6px 10px; background:var(--offwh); }
.dr-search input { border:none; background:transparent; font-family:inherit; font-size:13px; color:var(--txt1); flex:1; outline:none; }
.dr-search input::placeholder { color:var(--txt3); }
.dr-filter-row { display:flex; gap:6px; flex-wrap:wrap; position:relative; }
.flt-btn { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:500; border:1px solid var(--border); background:var(--white); color:var(--txt2); cursor:pointer; font-family:inherit; transition:all 100ms; user-select:none; white-space:nowrap; }
.flt-btn:hover { background:var(--offwh); }
.flt-btn.active { background:var(--blue-lt); border-color:var(--blue); color:var(--blue); }
.flt-count { background:var(--blue); color:#fff; font-size:10px; font-weight:700; padding:0 5px; border-radius:10px; min-width:16px; text-align:center; }
.flt-chevron { font-size:8px; color:var(--txt3); transition:transform 120ms; }
.flt-btn.open .flt-chevron { transform:rotate(180deg); }
.flt-dropdown { position:absolute; top:calc(100% + 6px); left:0; width:240px; background:var(--white); border:1px solid var(--border); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.12); z-index:500; display:none; flex-direction:column; overflow:hidden; }
.flt-dropdown.open { display:flex; }
.flt-dd-search { display:flex; align-items:center; gap:6px; padding:8px 10px; border-bottom:1px solid var(--bord-lt); }
.flt-dd-search input { border:none; font-family:inherit; font-size:12px; color:var(--txt1); flex:1; outline:none; background:transparent; }
.flt-dd-search input::placeholder { color:var(--txt3); }
.flt-dd-list { max-height:200px; overflow-y:auto; }
.flt-dd-item { display:flex; align-items:center; gap:8px; padding:7px 10px; cursor:pointer; transition:background 80ms; font-size:12px; color:var(--txt1); user-select:none; }
.flt-dd-item:hover { background:var(--offwh); }
.flt-dd-item.checked { background:var(--blue-lt); }
.flt-dd-empty { padding:12px 10px; font-size:12px; color:var(--txt3); text-align:center; }
.flt-dd-footer { border-top:1px solid var(--bord-lt); padding:6px 10px; display:flex; justify-content:space-between; }
.flt-dd-clear { font-size:11px; color:var(--txt2); cursor:pointer; padding:2px 4px; border-radius:3px; }
.flt-dd-clear:hover { color:var(--util-over); background:#FEE2E2; }
.dr-list-head { padding:8px 16px; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--bord-lt); }
.dr-select-all { display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px; font-weight:500; color:var(--txt2); user-select:none; }
.dr-count { font-size:11px; color:var(--txt3); margin-left:auto; }
.dr-list { flex:1; overflow-y:auto; }
.dr-epic-item { display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid var(--bord-lt); cursor:pointer; transition:background 100ms; user-select:none; }
.dr-epic-item:hover { background:var(--offwh); }
.dr-epic-item.checked { background:var(--blue-lt); }
.cb { width:16px; height:16px; border-radius:4px; flex-shrink:0; border:1.5px solid var(--border); background:var(--white); display:flex; align-items:center; justify-content:center; transition:all 100ms; }
.cb.on { background:var(--blue); border-color:var(--blue); }
.cb.on::after { content:'✓'; color:#fff; font-size:10px; font-weight:700; }
.dr-epic-info { flex:1; min-width:0; }
.dr-epic-key { font-size:10px; font-weight:600; color:var(--blue); background:var(--blue-lt); padding:2px 6px; border-radius:4px; display:inline-block; margin-bottom:2px; }
.dr-epic-name { font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dr-epic-meta { font-size:11px; color:var(--txt3); margin-top:1px; }
.dr-epic-status { font-size:10px; font-weight:600; padding:1px 6px; border-radius:3px; flex-shrink:0; }
.dr-epic-status.active{background:#DCFCE7;color:#16A34A;}
.dr-epic-status.planned{background:var(--b-bg);color:var(--b-c);}
.dr-epic-status.backlog{background:var(--offwh);color:var(--txt3);}
.dr-epic-status.in-progress{background:#FEF3C7;color:var(--util-near);}
.dr-footer { padding:12px 16px; border-top:1px solid var(--border); display:flex; gap:8px; align-items:center; }
.dr-sel-count { font-size:12px; color:var(--txt2); flex:1; }
```

### Empty states and tooltip
```css
.empty-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:40px; text-align:center; }
.empty-icon { font-size:36px; opacity:.3; }
.empty-title { font-size:15px; font-weight:600; color:var(--txt2); }
.empty-sub { font-size:13px; color:var(--txt3); max-width:280px; line-height:1.6; }
.tip { position:fixed; background:var(--txt1); color:#fff; padding:9px 12px; border-radius:7px; font-size:12px; line-height:1.65; z-index:9999; pointer-events:none; display:none; box-shadow:0 4px 20px rgba(0,0,0,.25); max-width:260px; }
.tip strong { font-weight:600; display:block; margin-bottom:2px; font-size:11px; color:rgba(255,255,255,.6); }
.tip-name { display:block; margin-bottom:4px; }
.tip-row { display:flex; justify-content:space-between; gap:12px; margin-top:2px; }
.tip-row span:last-child { font-weight:600; }
.tip-note { font-size:11px; color:#FCD34D; margin-top:4px; }
```

---

## Week Width — Dynamic

Calculate and apply on mount and on `window.resize`:

```ts
function calcAndApplyWeekWidth(drawerOpen: boolean): number {
  const avail  = window.innerWidth - 460 - (drawerOpen ? 420 : 0) - 2;
  const nWeeks = weeks.length;
  const weekW  = nWeeks > 0 ? Math.max(52, Math.floor(avail / nWeeks)) : 52;
  document.documentElement.style.setProperty('--week-w', weekW + 'px');
  return weekW; // store in state; DAY_W = weekW / 5
}
```

---

## Data Model

### Supabase migration — `[next_number]_portfolio_planning.sql`

```sql
create table if not exists portfolio_epics (
  id         uuid primary key default gen_random_uuid(),
  epic_key   text not null,
  created_by uuid references auth.users(id),
  updated_at timestamptz default now()
);

create table if not exists epic_phase_plans (
  id         uuid primary key default gen_random_uuid(),
  epic_key   text not null,
  phase      text not null check (phase in ('design','build','test','deploy','hypercare')),
  start_day  integer,
  updated_at timestamptz default now(),
  unique (epic_key, phase)
);

create table if not exists epic_phase_assignments (
  id         uuid primary key default gen_random_uuid(),
  epic_key   text not null,
  phase      text not null check (phase in ('design','build','test','deploy','hypercare')),
  member_id  text not null,
  track      text not null check (track in ('IT','BIZ')),
  days       numeric(6,1) not null check (days >= 0),
  updated_at timestamptz default now(),
  unique (epic_key, phase, member_id)
);
```

### TypeScript types — add to `frontend/src/types/index.ts`

```ts
export type PlanningPhase = 'design' | 'build' | 'test' | 'deploy' | 'hypercare';

export interface EpicPhasePlan {
  epicKey:  string;
  phase:    PlanningPhase;
  startDay: number | null;
}

export interface EpicPhaseAssignment {
  id:       string;
  epicKey:  string;
  phase:    PlanningPhase;
  memberId: string;
  track:    'IT' | 'BIZ';
  days:     number;
}
```

### Bar width calculation

```ts
function calcBarWidth(
  assignments: EpicPhaseAssignment[],
  absenceLookup: Record<string, number>
): number {
  if (!assignments.length) return 0;
  const maxAssign = assignments.reduce((a, b) => a.days >= b.days ? a : b);
  return maxAssign.days + (absenceLookup[maxAssign.memberId] ?? 0);
}
// DAY_W = weekW / 5
// bar left px  = startDay * DAY_W
// bar width px = Math.max(DAY_W, barWidthDays * DAY_W)
```

---

## Hook — `usePortfolioPlan`

Create `frontend/src/hooks/usePortfolioPlan.ts`:

```ts
interface UsePortfolioPlanReturn {
  boardEpicKeys:      string[];
  phasePlans:         EpicPhasePlan[];
  phaseAssignments:   EpicPhaseAssignment[];
  addEpicToBoard:     (epicKey: string) => void;
  removeEpicFromBoard:(epicKey: string) => void;
  setPhaseStartDay:   (epicKey: string, phase: PlanningPhase, startDay: number) => Promise<void>;
  clearPhase:         (epicKey: string, phase: PlanningPhase) => Promise<void>;
  upsertAssignment:   (epicKey: string, phase: PlanningPhase, memberId: string, days: number, track: 'IT'|'BIZ') => Promise<void>;
  removeAssignment:   (epicKey: string, phase: PlanningPhase, memberId: string) => Promise<void>;
  loading:            boolean;
}
```

- `boardEpicKeys`: localStorage in v1
- All other state: Supabase, optimistically updated

---

## Behaviour — Epic View

### Phase row click
Clicking the phase row (`.ev-phase`) toggles the person sub-section — it does NOT open a detail panel or navigate anywhere.

### Empty Gantt phase row
- Edit mode only: render clickable week columns
- Click week column → `setPhaseStartDay(epicKey, phase, weekIndex * 5)`
- Hint: `"Click a week to set start date"` (only visible in edit mode, `pointer-events:none`)

### Phase bar
- No resize handle — width is computed, never user-draggable
- Edit mode: `cursor:grab`, drag horizontally to change `startDay` (snaps to nearest working day)
- Bar label format: `"Des 8d"` (3-char phase name + days) when bar ≥ 4 days wide, else `"8d"`

### Edit mode `.edit-on` class
Add `.edit-on` to the parent container (not individual rows) to toggle all edit-mode states via CSS.

---

## Behaviour — People View

- People header and capacity bar always visible
- Assignment rows only visible when expanded
- Heatmap: each cell = planned working days in that week ÷ 5 available → tier color
- If phase has no start date: show `"No start date set"` text instead of a bar

---

## Behaviour — Summary Tab

### KPI cards
- One card per `processTeam` from `state.processTeams`
- Badge: **only render when `estimatedDays > availDays`** — no badge for under/on-capacity

### Compact Gantt week columns
- Use `flex:1` (not `var(--week-w)`) so columns fill available width in the summary section
- Only show Epics that have ≥1 person from that team assigned

### Capacity alerts table
- Columns: Person (200px) | Est. (80px) | Available (80px) | Utilization (flex:1) | Delta (60px)
- Show only `over` and `near` people, sorted descending by utilization %
- Empty state: `"No over-allocated or near-capacity team members — looking good!"`

---

## Drawer — Filter behaviour

Three filter buttons: **Labels**, **Assignee**, **Status**
- All three use identical `.flt-btn` / `.flt-dropdown` UI
- Only one dropdown open at a time
- Active count shown as blue pill (`.flt-count`) on button when filters selected
- AND logic across all three filters
- Labels sourced from `JiraWorkItem.labels` (can be 100+, must be searchable)
- Drawer push: main content `margin-right` transitions to `420px`, topbar/tabbar `right` also transitions

---

## Reuse from existing codebase

| Need | Existing source |
|---|---|
| `availableDays` per IT member | `calculateCapacity()` |
| `availableDays` per BIZ contact | `calculateBusinessCapacityForQuarter()` |
| Process team grouping | `state.processTeams` |
| Jira Epic list | `state.jiraWorkItems.filter(i => i.type === 'epic')` |
| Absence / leave data | Same source as existing capacity engine |
| Avatar component | Reuse existing pattern |

---

## Nav / Route

- Route: `/portfolio-planning`
- Sidebar: below Scenario Planner, icon `LayoutGrid` or `Layers` from `lucide-react`
- Label: `"Portfolio Planning"`

---

## Build order

1. **Conflict check** — mandatory first, see top
2. Supabase migration
3. TypeScript types
4. `usePortfolioPlan` hook
5. Page shell + route + nav item
6. Drawer with filter dropdowns
7. Epic View — left panel read mode
8. Epic View — Gantt read mode
9. Edit mode (start date, drag, day inputs, add/remove)
10. People View — left panel + heatmap
11. People View — Gantt
12. Summary — KPI cards
13. Summary — compact Gantt
14. Summary — capacity alerts table
15. Wire hook to Supabase

---

## Out of scope for v1

PDF/slide export · role placeholder estimates · confidence levels · estimate versioning · scenario snapshotting · editing from Summary tab · week/sprint granularity toggle
