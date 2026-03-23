# TODO — VS Finance Capacity Planner
> Single source of truth for all work. Update at the start of each session.  
> Each item links to its spec. Bugs link to their bug doc.
 
---
 
## 🔴 Now — Sprint in progress
 
- [ ] **US-SP-01** · Centered landing page layout in Scenario Planner  
  → `features/improvements-v3/spec.md` · Phase 1 · Size: S · No deps
 
- [ ] **US-SP-02** · Remove micro-indicator badges from Capacity Overview header  
  → `features/improvements-v3/spec.md` · Phase 1 · Size: S · No deps
 
- [ ] **US-SPT-02** · Verify Feature/Story/UAT/Hypercare bar colours (likely visual QA only)  
  → `features/improvements-v3/spec.md` · Phase 1 · Size: S · No deps
 
---
 
## 🟡 Next — Phase 2 & 3
 
- [ ] **US-SPT-01** · Fix Epic → Feature → Story hierarchy copy in Scenario Planner  
  → `features/improvements-v3/spec.md` · Phase 2 · Size: M · Needs investigation first
 
- [ ] **US-SPT-03** · Carry over actual assignments into cloned scenario  
  → `features/improvements-v3/spec.md` · Phase 2 · Size: S · Likely regression test only
 
- [ ] **US-SP-03** · Capacity Bank: show capacity by process team for current quarter  
  → `features/improvements-v3/spec.md` · Phase 3 · Size: M · Needs SHARED-A + SHARED-B first
 
- [ ] **US-SPT-06** · Work item summaries in context slide-out panel  
  → `features/improvements-v3/spec.md` · Phase 3 · Size: M · Needs SHARED-C first
 
- [ ] **US-SP-04** · Remove standalone "Capacity by Squad/Team" page  
  → `features/improvements-v3/spec.md` · Phase 3 · Size: S · **Precondition: US-SP-03 done**
 
- [ ] **US-TL-01** · Align assignment flow between actuals Timeline and Scenario Planner  
  → `features/improvements-v3/spec.md` · Phase 4 · Size: M · SPIKE-02 ✅ resolved — ready to start
 
---
 
## 🟠 Blocked
 
- [ ] **US-SPT-04** · Discovery Board items in Scenario Planner backlog  
  → `features/improvements-v3/spec.md` · Phase 5  
  ⛔ **BLOCKED** — awaiting PO input: (1) Jira project key for Discovery Board, (2) exact issue type name  
  When unblocked: 13-file exhaustion checklist documented in `2026-03-20-phase0-spike-findings.md`
 
---
 
## 🟢 Backlog — Next quarter
 
- [ ] **Unify Epic/Timeline actuals with Scenario Planner** · No spec yet  
  Next design session: explore shared design language vs. single tool with actuals/forecast toggle
 
- [ ] **US-SPT-05** · Monthly granularity toggle for Timeline  
  → `features/improvements-v3/spec.md` · Phase 5 · Size: L · Split into 3 sub-tasks before sprint planning
 
- [ ] **Executive Report / PDF export**  
  No spec yet. Target audience: steering committees, portfolio boards. See ideation notes.
 
- [ ] **AI narrative report generation**  
  No spec yet. Strongest near-term AI use case. Requires report view to exist first.
 
- [ ] **Skills system** (F-SP-09: SP-22–SP-26)  
  Deferred from Scenario Planner v1 release. Requirable skills on items, mismatch warnings, coverage gaps.
 
---
 
## 🐛 Open Bugs
 
- [ ] **BUG-001** · Fallback avatar not rendered for deleted/archived team members  
  → `bugs/BUG-001-avatar-fallback.md` · Severity: Medium  
  Affects: `PlannerTimeline.tsx`, `AssignPanel.tsx` · Fix in Phase 2 as part of US-SPT-03-T2
 
---
 
## ✅ Done this sprint
 
> Move items here when shipped, then add an entry to CHANGELOG.md.
 
- [x] **Scenario Planner Redesign** · Shipped 2026-03-19  
  Self-contained sandbox, home screen landing, backlog drawer auto-collapse, triage flow, capacity ticker, person filter, localStorage restore.
 
- [x] **SPIKE-01** · Jira Discovery Board issue type audit · 2026-03-20  
  Partial block — scope documented, 13-file checklist ready. Awaiting PO input.
 
- [x] **SPIKE-02** · AssignPanel reusability in actuals Timeline · 2026-03-20  
  ✅ Resolved — reusable with 2 targeted changes. US-TL-01 updated to M complexity.