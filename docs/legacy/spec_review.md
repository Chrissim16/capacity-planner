# Functional & Technical Spec — Review & MoSCoW Assessment

**Reviewer:** AI Assistant (based on deep knowledge of the current codebase)
**Date:** 20 Feb 2026
**Source:** `functional_technical_spec.md` v1.0

---

## How to read this review

Each proposal is listed with:
- **MoSCoW rating** (Must / Should / Could / Won't) — my recommendation based on current app state, effort, and impact
- **Spec status** — what the spec claims vs what actually exists today
- **Review** — agreement, disagreement, risks, or simplification opportunities

---

## Part 0 — Architecture & Security Foundation

### 0.1 SSRF Vulnerability in Jira Proxy
| MoSCoW | **Must Have** |
|---|---|
| Spec status | Correctly identified |
| Review | **Agree — critical.** The current `api/jira-proxy.js` does not validate `X-Jira-Base-Url`. The fix is straightforward (URL parse + hostname allowlist). Should be done before any other work. Low effort, high impact. |

### 0.2 Open CORS on Jira Proxy
| MoSCoW | **Must Have** |
|---|---|
| Spec status | Correctly identified |
| Review | **Agree.** `Access-Control-Allow-Origin: *` is a real risk. Note: the spec references `capacity-planner-five.vercel.app` but the actual production URL is `capacity-planner-mw.vercel.app`. The `FRONTEND_URL` env var approach is correct. |

### 0.3 Jira API Tokens in Plain Text
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Correctly identified |
| Review | **Agree on the problem, but downgrade priority.** The Supabase Vault + Edge Function approach is architecturally sound but is a significant effort (new Edge Functions, migration, client changes). Given the small user base (2-3 people) and that the Supabase dashboard is already access-controlled, this is important but not blocking. Recommend doing it in Release 1, not Release 0. |

### 0.4 Open RLS Policies
| MoSCoW | **Must Have** |
|---|---|
| Spec status | Correctly identified |
| Review | **Agree — critical.** The `USING (true)` policies with the anon key mean anyone who intercepts the Supabase URL+key from the browser can read/write all data. However, this is tightly coupled with AD-8.1 (RBAC) and AD-8.2 (SSO) — you can't enforce `auth.role() = 'authenticated'` without an auth layer. **Recommendation:** Implement a simple Supabase email/password auth first (for the 2-3 users), then layer SSO on top later. |

### 0.5 Flatten Assignment Structure
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Correctly identified as nested today |
| Review | **Agree on the goal, but the effort is large.** Moving assignments from `Project.phases[].assignments[]` to a top-level flat array touches every file that reads or writes assignments: capacity calculation, Jira sync, project builder, supabase sync, all UI components. The spec claims "highest-value refactor" — I agree, but it's also the highest-risk refactor. **Recommendation:** Do this early in Release 1, not Release 0. Pair with comprehensive testing. Note: the "direct Jira capacity link" I just implemented reads from `jiraWorkItems` directly and bypasses the assignment chain, which partially reduces the urgency. |

### 0.6 Quarter String Format
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Problem is real but overstated |
| Review | **Partially agree.** The cross-year sort issue (`"Q4 2025" > "Q1 2026"`) is real but narrow — it only affects sorted lists. The current app doesn't sort quarters alphabetically; it uses `generateQuarters()` which produces them in chronological order. The fix is correct but the migration (converting all stored quarter strings) is risky for low payoff. **Recommendation:** Fix the sort utility without changing the stored format. Add a `compareQuarters()` function that parses and compares numerically. |

### 0.7 Assignment Index for Performance
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Correct analysis |
| Review | **Agree in principle, but premature optimization.** With 10 team members and ~75 projects, the current nested loop in `calculateCapacity` takes <1ms per call. The Timeline does 80 calls = ~80ms total, which is fine. The index becomes valuable at 50+ team members or 200+ projects. **Recommendation:** Defer until performance is actually measured as a problem. |

### 0.8 Phase Date System
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Correctly identified dual system |
| Review | **Agree.** Having both `startQuarter`/`endQuarter` and `startDate`/`endDate` is confusing. ISO dates as primary with derived quarters is the right direction. However, this is a prerequisite for CP-2.1 (drag-and-drop), so time it accordingly. |

### 0.9 Concurrent Save Race Condition
| MoSCoW | **Must Have** |
|---|---|
| Spec status | Correctly identified |
| Review | **Agree.** The `isSaving` guard is a simple, low-risk fix. Should be in Release 0. |

### 0.10 Schema Migration Logic
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Correctly identified |
| Review | **Agree.** The current `{ ...defaultAppState, ...parsed }` approach silently drops or corrupts data on schema changes. The `migrate()` function pattern is standard and low-risk. |

### 0.11 Remove Conflicting What-If Mechanism
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Need to verify if `whatIfData` is actually used |
| Review | **Agree if it exists.** I haven't encountered `whatIfData` or `enterWhatIfMode` in recent work. If it's dead code, removing it is trivial cleanup. If it's live, it needs careful removal. Low effort either way. |

---

## Part 1 — Epic 1: Resource Visibility

### RV-1.1 Team Availability Dashboard
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" — the current Dashboard (Capacity Overview) already shows a quarterly heatmap with RAG per member |
| Review | **Partially done.** The week/month/rolling-12-week granularity toggle is new scope. The Supabase Realtime subscription (10-second auto-refresh) is significant new infrastructure. The quarterly heatmap already serves the primary use case well. **Recommendation:** The weekly view adds complexity without proportional value for a 10-person team. Keep the quarterly heatmap as-is; add monthly as a stretch goal. |

### RV-1.2 Workload Heatmap
| MoSCoW | **Won't Have (already exists)** |
|---|---|
| Spec status | Claims "Missing — build from scratch" |
| Review | **This already exists.** The Dashboard page IS the heatmap — it was redesigned in Phase 2 to be heatmap-centric. It shows team members × quarters with RAG colour coding and drill-down. The spec appears to have been written against an older version of the app. The weekly granularity and PNG export are genuinely new, but the core heatmap is done. |

### RV-1.3 Change Project Portfolio Overview
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" — Gantt view and FTE totals are new |
| Review | **Partially agree.** The Epics page already shows all projects with status, Jira link, and per-phase detail. The Gantt/timeline bar view is genuinely valuable for steering committee presentations. FTE calculation is a nice addition. **Recommendation:** Add a simple horizontal bar view to the existing Epics page rather than building a separate component. |

### RV-1.4 Individual Team Member Profile
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Partial" — schedule+leave overlay, self-view are new |
| Review | **The MemberCalendarModal already covers much of this.** It shows project assignments, time off, and holidays on a calendar. The "self-view" requires auth (AD-8.1/8.2) which is a separate workstream. **Recommendation:** Enhance the existing modal rather than building a full page. Self-view depends on auth being implemented first. |

---

## Part 2 — Epic 2: Capacity Planning

### CP-2.1 Drag-and-Drop Visual Planner
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing — highest-impact feature" |
| Review | **Disagree on priority.** This is a complex feature (8 SP in the spec, but realistically 13-21 SP given pointer event handling, snap logic, live capacity recalculation, ghost preview, and skill checking during drag). For a 10-person team with 2-3 active planners, the current form-based assignment is adequate. The ROI of drag-and-drop is high for large teams but modest here. **Recommendation:** Defer to Release 2. The form-based workflow works. |

### CP-2.2 Split Allocation Across Concurrent Changes
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" |
| Review | **Already partially working.** Members can already be assigned to multiple projects in the same quarter. The stacked visual blocks in cells would be a nice UI improvement. |

### CP-2.3 Sprint Capacity Calculator (Bug Fixes)
| MoSCoW | **Must Have** (for the bug fixes) |
|---|---|
| Spec status | 4 bugs correctly identified |
| Review | **Agree on the bugs.** BAU across bye weeks, averaged sprint workdays, hardcoded progress bar max, and holiday-ignoring header are all real issues. The story point comparison bar and sprint health indicator are nice additions but lower priority. |

### CP-2.4 Rolling 12-Week Capacity Forecast
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Valuable for executive communication.** The recharts-based area chart would be a strong addition to the Dashboard. However, it requires weekly capacity calculation (currently only quarterly), which is new infrastructure. **Recommendation:** Build this after the quarterly system is stable. |

### CP-2.5 Overallocation Detection and Alert
| MoSCoW | **Should Have** (in-app), **Could Have** (email) |
|---|---|
| Spec status | Claims "Partial" |
| Review | **In-app alerts already exist** in the Dashboard warnings section. The email alerting requires Supabase Edge Functions and SMTP configuration — significant infrastructure for a 10-person team where everyone is in the same office. **Recommendation:** Improve the in-app alerts first; email can come later. |

### CP-2.6 Tentative Bookings
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Agree this is valuable.** Being able to distinguish "confirmed" vs "pipeline" demand is core to capacity planning. The `tentative: boolean` on Assignment is simple to add. The visual treatment (dashed border, 60% opacity) is straightforward. |

### CP-2.7 Placeholder Resources
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Nice to have for headcount planning.** Simple to implement (`isPlaceholder` flag on TeamMember). Low effort, moderate value. |

---

## Part 3 — Epic 3: Scenario Planning

### SP-3.1 New Change Intake Impact Modeller
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Ambitious feature.** The feasibility assessment algorithm is non-trivial (role matching, capacity checking, first-available-date calculation). For a 10-person team, the IT Manager likely already knows who's available. **Recommendation:** Defer to Release 2-3. The current scenario system can approximate this workflow manually. |

### SP-3.2 Sandbox Scenario Workspace
| MoSCoW | **Must Have** (gap fixes only) |
|---|---|
| Spec status | Claims "Essentially complete" |
| Review | **Agree — mostly done.** The scenario system works. The gap fixes (atomic creation, rename on blur) are minor. |

### SP-3.3 Side-by-Side Scenario Comparison
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" |
| Review | **The ScenarioDiffModal already exists.** Adding delta indicators and metric cards is a reasonable enhancement. PDF export is nice but not critical. |

### SP-3.4 Publish Scenario to Live Plan
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" |
| Review | **The promote-to-baseline flow exists.** Adding a confirmation dialog with change summary is a good UX improvement. Email notification and auto-archiving are lower priority. |

---

## Part 4 — Epic 4: Skill Management

### SK-4.1 Centralised Team Skills Inventory
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" — proficiency levels are new |
| Review | **Skills already exist** as `skillIds: string[]` on TeamMember and a skills taxonomy in Settings. Adding proficiency levels (4-tier) is a meaningful enhancement. CSV import is useful for initial setup. |

### SK-4.2 Skill Matrix View
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Nice visualization** but for 10 people with ~15 skills, the current skill badges on the Team page are sufficient. A full matrix grid becomes valuable at 20+ people. |

### SK-4.3 Required Skills on Change Projects
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" — minimum proficiency is new |
| Review | **`requiredSkillIds` already exists on Phase.** Adding proficiency requirement and mismatch warnings is a logical extension. |

### SK-4.4 Skill-Filtered Resource Search
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **The CommandPalette (Ctrl+K) already exists** with search across people, projects, and Jira items. Adding skill-based filtering is an extension, not a new feature. For a 10-person team, you already know who has what skills. |

### SK-4.5 Auto-Assign Based on Skills and Capacity
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **The `assignmentSuggester.ts` already exists** with a scoring algorithm (40% capacity, 35% skill match, 25% history). The spec proposes a similar system. The existing one should be surfaced better in the UI rather than rebuilding. |

---

## Part 5 — Epic 5: Reporting & Stakeholder Output

### RS-5.1 Team Utilisation Report
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" |
| Review | **The Dashboard already shows utilisation.** Adding Excel/PDF export and configurable period is a reasonable enhancement. The target utilisation % per role is a useful addition to Settings. |

### RS-5.2 Capacity vs. Demand Gap Report
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Overlaps heavily with CP-2.4** (Rolling 12-Week Forecast). The spec acknowledges they share a data model. Build one, not both. |

### RS-5.3 Planned vs. Actual Effort per Project
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing — requires JI-6.4" |
| Review | **Depends on Jira worklog sync** which is a separate significant feature. The burn-down chart is valuable but requires complete Jira time-tracking data. Most teams don't log time consistently in Jira. **Recommendation:** Only build if the team actually logs time in Jira. |

### RS-5.4 Bench Report — Unallocated Capacity
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **The heatmap already shows under-utilized members** (green/grey cells). A dedicated bench report adds marginal value for a small team. |

### RS-5.5 Stakeholder-Ready PDF Export with AI Highlights
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Interesting but over-engineered for v1.** The AI highlights via Claude Haiku is a nice touch but adds API cost and complexity. A well-formatted PDF export without AI would be more practical. **Recommendation:** Start with a simple branded PDF export; add AI highlights later if there's demand. |

---

## Part 6 — Epic 6: Jira Integration

### JI-6.1 Jira Project and Epic Import
| MoSCoW | **Must Have** (gap fix only) |
|---|---|
| Spec status | Claims "Essentially complete" |
| Review | **Agree — already working.** The Jira sync with hierarchy (Epic → Feature → Story) is fully functional. The gap fix (archived projects → inactive, not deleted) is minor. |

### JI-6.2 Sprint and Story Point Import
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" |
| Review | **Story points are now working** (fixed today with dynamic field discovery). Sprint import exists. Velocity calculation from last 6 sprints is a reasonable addition. Individual story assignment workload indicators are already shown via the direct Jira-to-capacity link just implemented. |

### JI-6.3 Capacity Signals Pushed Back to Jira
| MoSCoW | **Won't Have (for now)** |
|---|---|
| Spec status | Claims "Missing — critical two-way sync" |
| Review | **Disagree on priority.** Writing capacity data BACK to Jira via custom fields requires: Jira admin to create custom fields, an Edge Function, and ongoing maintenance. The capacity planner is the system of record for capacity — Jira doesn't need this data to function. Sprint planners can check the capacity planner directly. **Recommendation:** Defer indefinitely. Pull from Jira is essential; push to Jira is optional. |

### JI-6.4 Time-Logged Actuals from Jira
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Only valuable if the team consistently logs time in Jira.** If they do, this enables RS-5.3 (planned vs actual). If they don't, it's dead infrastructure. **Recommendation:** Validate team time-logging habits before building. |

---

## Part 7 — Epic 7: UX & Notifications

### UX-7.1 Inline Editing Across Views
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" |
| Review | **Tab navigation and Escape-to-cancel are good UX improvements.** The concurrent editing lock (Supabase Realtime presence) is over-engineered for 2-3 concurrent users. **Recommendation:** Do the keyboard navigation; skip the locking. |

### UX-7.2 Undo/Redo for Scheduling Changes
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing — critical companion to drag-and-drop" |
| Review | **Only needed if CP-2.1 (drag-and-drop) is built.** Without drag-and-drop, the form-based workflow doesn't need undo (you can just edit the value back). **Recommendation:** Bundle with CP-2.1 if/when it's built. |

### UX-7.3 Saved Filter Views
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Low value for a 10-person team.** The app has few enough views that bookmarking isn't necessary. |

### UX-7.4 Email Notifications for Schedule Changes
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Requires Supabase Edge Functions + email provider.** For a co-located team of 10, verbal communication or Teams messages are faster. **Recommendation:** Defer unless the team actively requests it. |

### UX-7.5 Ctrl+K Global Search
| MoSCoW | **Won't Have (already exists)** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Already implemented.** The `CommandPalette` component is bound to Ctrl+K and searches across people, projects, and Jira items. The spec was written against an older version. |

---

## Part 8 — Epic 8: Administration

### AD-8.1 Role-Based Access Control (RBAC)
| MoSCoW | **Must Have** |
|---|---|
| Spec status | Correctly identified as missing |
| Review | **Agree.** Currently there is no auth layer at all. The 4-role model (System Admin / IT Manager / Team Lead / Stakeholder) is appropriate. This is a prerequisite for 0.4 (RLS policies). |

### AD-8.2 SSO via Azure AD
| MoSCoW | **Must Have** |
|---|---|
| Spec status | Correctly identified as missing |
| Review | **Agree for enterprise deployment.** Supabase supports Azure AD as an OAuth provider. The spec is well-detailed. However, start with Supabase email/password auth first (for immediate security), then add SSO. |

### AD-8.3 Working Hours and Holiday Calendar Configuration
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Partial" |
| Review | **Country holidays already work.** Part-time overrides and company closure days are reasonable additions. The data model changes are small. |

### AD-8.4 Leave and Time-Off Request Workflow
| MoSCoW | **Could Have** |
|---|---|
| Spec status | Claims "Partial" |
| Review | **Self-service leave requests with approval workflow is useful** but adds significant complexity (new table, new UI, email notifications). For a 10-person team, the current approach (IT Manager enters time off directly) works fine. **Recommendation:** Only build if the team actively requests self-service. |

### AD-8.5 Full Audit Trail
| MoSCoW | **Should Have** |
|---|---|
| Spec status | Claims "Missing" |
| Review | **Agree for compliance.** The Supabase `audit_log` table with fire-and-forget writes is the right approach. The admin UI can be simple — a filtered table view. |

---

## Part 9 — New Features

### NEW-A Milestone Markers on Timeline
| MoSCoW | **Should Have** |
|---|---|
| Spec status | New feature |
| Review | **Low effort, high visibility.** Vertical lines on the Timeline for go-live dates, cutover dates, etc. is a common planning pattern. Simple data model (`Milestone` entity) and straightforward rendering. |

### NEW-B Hypercare Phase Type
| MoSCoW | **Could Have** |
|---|---|
| Spec status | New feature |
| Review | **Nice distinction** between delivery and post-go-live phases. The visual treatment (diagonal stripes) is a small CSS addition. The `phaseType` field is easy to add. |

### NEW-C Capacity Bank Summary Card
| MoSCoW | **Should Have** |
|---|---|
| Spec status | New feature |
| Review | **Directly answers "can we take this on?"** The four-segment breakdown (available, committed, BAU, buffer) with a large "X days remaining" number is exactly what leadership needs. Simple to compute from existing data. |

---

## Part 10 — Performance & Code Quality Fixes

| MoSCoW | **Must Have** (critical security), **Should Have** (correctness), **Could Have** (conveniences) |
|---|---|
| Review | The 58 code review items are grouped sensibly. The 8 critical security items (0.1-0.4 above) must be done first. The 9 correctness bugs (BAU bye weeks, sprint workdays, etc.) should follow. The 17 conveniences can be done opportunistically. |

---

## Summary — Recommended Priority Order

### Release 0 — Security (2 weeks)
1. **0.1** SSRF fix
2. **0.2** CORS lock
3. **0.4** RLS policies (with simple email/password auth)
4. **0.9** Concurrent save race condition
5. **AD-8.1** Basic RBAC (4 roles)

### Release 1 — Core Improvements (6-8 weeks)
1. **CP-2.3** Sprint calculator bug fixes
2. **0.5** Flatten assignment structure
3. **0.8** Phase date system (ISO dates primary)
4. **0.10** Schema migration logic
5. **CP-2.6** Tentative bookings
6. **NEW-C** Capacity Bank summary card
7. **NEW-A** Milestone markers
8. **SK-4.1** Skill proficiency levels
9. **AD-8.2** Azure AD SSO
10. **AD-8.5** Audit trail

### Release 2 — Enhanced Planning (6-8 weeks)
1. **CP-2.4** Rolling 12-week forecast
2. **RS-5.1** Utilisation report with export
3. **SP-3.3** Scenario comparison improvements
4. **AD-8.3** Part-time and company closure days
5. **RV-1.3** Gantt view on Epics page
6. **SK-4.3** Skill proficiency requirements on phases

### Release 3 — Advanced Features (as needed)
1. **CP-2.1** Drag-and-drop (if demand exists)
2. **RS-5.5** PDF export (without AI initially)
3. **SP-3.1** Intake modeller
4. **JI-6.4** Jira time-logged actuals (if team logs time)

---

## Items where the spec is outdated or incorrect

| Spec Item | Issue |
|---|---|
| RV-1.2 (Workload Heatmap) | Claims "Missing — build from scratch" but the Dashboard heatmap was built in Phase 2 |
| UX-7.5 (Ctrl+K Global Search) | Claims "Missing" but CommandPalette already exists and is bound to Ctrl+K |
| SK-4.5 (Auto-Assign) | Claims "Missing" but `assignmentSuggester.ts` already implements this |
| JI-6.1 (Jira Epic Import) | Claims to check `archiveProject()` but the sync already handles status correctly |
| System Context | Lists Vercel URL as `capacity-planner-five.vercel.app` but actual URL is `capacity-planner-mw.vercel.app` |
| Story Points | Spec references "story_points" field discovery — this was resolved today with dynamic field discovery |
| Direct Jira-to-Capacity | The spec doesn't mention the direct Jira→Capacity link implemented today, which bypasses the assignment chain for story-point-based capacity |
