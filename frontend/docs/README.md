# Capacity Planner Documentation

This folder contains all requirements, solution designs, and supporting artifacts for the Mileway IT Capacity Planner application.

## Purpose

These documents serve as the **source of truth** for what we're building and how. They are:
- Written before and maintained alongside the code
- Designed to give AI agents and developers full context when implementing features
- Updated as the system evolves

## Document Structure

```
docs/
├── README.md                    # This file - documentation index
├── OVERVIEW.md                  # Project overview and goals
├── DATA-MODELS.md               # Data structures and relationships
├── architecture/
│   ├── TECH-STACK.md            # Technology choices and rationale
│   ├── STATE-MANAGEMENT.md      # Zustand store architecture
│   └── DEPLOYMENT.md            # Vercel/GitHub deployment
├── features/
│   ├── CAPACITY-CALCULATION.md  # Core capacity calculation logic
│   ├── JIRA-INTEGRATION.md      # Jira sync and mapping
│   ├── SCENARIOS.md             # What-if planning scenarios
│   ├── SPRINTS.md               # Sprint management
│   └── IMPORT-EXPORT.md         # Data import/export functionality
└── ROADMAP.md                   # Future plans and backlog
```

## Quick Links

| Document | Description |
|----------|-------------|
| [Overview](./OVERVIEW.md) | What the app does and who it's for |
| [Data Models](./DATA-MODELS.md) | All TypeScript interfaces and their relationships |
| [Tech Stack](./architecture/TECH-STACK.md) | React, TypeScript, Zustand, Tailwind |
| [Jira Integration](./features/JIRA-INTEGRATION.md) | How we sync with Jira Cloud |
| [Scenarios](./features/SCENARIOS.md) | What-if planning system |
| [Roadmap](./ROADMAP.md) | What's planned next |

## For AI Agents

When implementing a feature:
1. Read the relevant feature doc first
2. Check DATA-MODELS.md for type definitions
3. Review TECH-STACK.md for patterns and conventions
4. Reference existing code for similar implementations

## Versioning

Documentation is versioned alongside the code. When making changes:
- Update relevant docs in the same PR as code changes
- Add dated entries to ROADMAP.md when completing features
- Keep DATA-MODELS.md in sync with `types/index.ts`
