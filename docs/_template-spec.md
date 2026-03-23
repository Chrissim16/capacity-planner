---
status: Draft
# Draft | Ready for Dev | In Dev | In Review | Shipped
created: YYYY-MM-DD
shipped: ~
author: Dennis Simon
supersedes: ~
---

# [Feature Name] — Implementation Spec

> **What this doc is:** The dev handover document. By the time status is "Ready for Dev", every section below is filled in and a developer (or Cursor) can work from this doc alone.  
> **What it is not:** A design doc. Design thinking and UX decisions live in `design.md`.

---

## Problem & Purpose

_One paragraph. What user pain does this solve? Why does it belong in the app?_

---

## Scope

### In scope
- _Bullet list of what this spec commits to shipping._

### Out of scope / deferred
- _Explicit list of things you decided NOT to build now — prevents scope creep._

---

## User Stories

### US-XXX · [Story title]

**As a** [role],  
**I want** [capability],  
**so that** [outcome].

**Acceptance Criteria**
1. [Measurable, testable criterion]
2. [...]
3. [Edge case covered]

**Technical Notes**
- File: `frontend/src/[path]/Component.tsx` (~line N)
- Approach: [specific implementation note]
- Risk: [anything that could go wrong]

---

_(repeat for each story)_

---

## Data Model Changes

_Only fill this in if the spec changes types, Supabase tables, or store shape. Otherwise delete this section._

```ts
// New or changed types
interface ExampleType {
  field: string;
}
```

---

## Files Affected

| File | Change type | Notes |
|---|---|---|
| `frontend/src/pages/X.tsx` | Edit | [what changes] |
| `frontend/src/components/Y.tsx` | New | [what it does] |
| `frontend/src/utils/Z.ts` | Edit | [what changes] |

---

## Shared Utilities / Hooks to Extract

_List any logic that should be extracted into a reusable hook or utility before or alongside this spec. Mark each as "new file" or "extract from [source file]"._

- [ ] `useXxx()` — new file `frontend/src/hooks/useXxx.ts`
- [ ] `xxxUtil()` — extract from `Component.tsx` into `frontend/src/utils/xxx.ts`

---

## Test Cases

_One test case per story or risk area. Write these before implementation starts (TDD)._

| ID | Story | Test | Expected |
|---|---|---|---|
| T1 | US-XXX | [Scenario description] | [Expected outcome] |
| T2 | US-XXX | [Edge case] | [Expected outcome] |

---

## Delivery Sequence

_In what order should stories / sub-tasks be implemented? Note any hard dependencies._

```
Step 1 — Extract shared utilities (SHARED-A, SHARED-B)
Step 2 — US-XXX (depends on Step 1)
Step 3 — US-YYY (depends on US-XXX)
```

---

## Cursor Prompt (copy-paste to start implementation)

> Paste this at the start of a Cursor session to give the agent full context.

```
You are implementing [Feature Name] in the VS Finance Capacity Planner.
Stack: React + TypeScript + Tailwind CSS + Zustand. Design system: Sana-style, Plus Jakarta Sans.

Spec: [link to this file]
Start with: [first story or shared utility]

Rules:
- Follow the file list in the "Files Affected" table. Do not create files not listed there.
- Write the test case (T1) before writing implementation code.
- After each story, confirm it satisfies all Acceptance Criteria before moving to the next.
- If you encounter something not covered by the spec, stop and ask rather than assuming.
```

---

## Open Questions

_Unresolved questions that must be answered before or during development. Remove when resolved._

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | [Question] | Dennis / Dev | Open |
