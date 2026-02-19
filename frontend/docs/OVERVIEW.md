# Project Overview

## What is Capacity Planner?

The **Mileway IT Capacity Planner** is a web application for managing team capacity across projects and time periods. It helps IT managers and team leads:

- **Visualize** team member allocations across quarters and sprints
- **Plan** project staffing and identify capacity constraints
- **Track** workload distribution and prevent overallocation
- **Integrate** with Jira to sync actual work items
- **Scenario plan** using what-if analysis

## Target Users

- **IT Managers** - Planning team capacity across multiple projects
- **Team Leads** - Assigning team members to phases and sprints
- **Project Managers** - Understanding resource availability
- **Single User** - Currently designed for individual use (Mileway Value Stream Finance)

## Core Concepts

### Team Members
People who can be assigned to projects. Each member has:
- Role (Developer, Analyst, etc.)
- Country (affects public holidays)
- Skills
- Maximum concurrent projects

### Projects & Phases
Work is organized into projects, each with multiple phases:
- **Project**: High-level initiative (e.g., "ERP Migration")
- **Phase**: Discrete work period within a project (e.g., "Discovery", "Build", "UAT")

### Assignments
Team members are assigned to project phases with:
- **Days allocated** per quarter
- **Optional sprint-level** granularity
- **Skill matching** validation

### Capacity Calculation
Available capacity = Total workdays - Public holidays - Time off - BAU reserve

### Jira Integration
Sync work items from Jira Cloud:
- **Epics** → Map to Projects
- **Features** → Map to Phases
- **Stories/Tasks/Bugs** → Track effort and assignees

### Scenarios
Create snapshots of your data for what-if planning:
- "What if we add two developers?"
- "What if Project X is delayed?"
- Compare scenarios against Jira baseline

## Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| Dashboard | ✅ Complete | Overview of team capacity and warnings |
| Timeline | ✅ Complete | Visual timeline of project phases |
| Projects | ✅ Complete | CRUD for projects and phases |
| Team | ✅ Complete | CRUD for team members and time off |
| Settings | ✅ Complete | Configuration and data management |
| Jira Sync | ✅ Complete | Connect and sync from Jira Cloud |
| Jira Mapping | ✅ Complete | Map Jira items to projects/phases |
| Scenarios | ✅ Complete | What-if planning snapshots |
| Sprints | ✅ Complete | Sprint-level assignment tracking |
| Import/Export | ✅ Complete | JSON and Excel data transfer |

## Non-Goals (Current Scope)

- Multi-user collaboration (single user for now)
- Real-time sync (manual sync triggers)
- Write-back to Jira (read-only integration)
- Mobile-first design (desktop-focused)
- Historical reporting (current state focus)

## Success Metrics

1. **Accuracy**: Capacity calculations match reality
2. **Efficiency**: Less time spent in spreadsheets
3. **Visibility**: Clear view of allocation issues
4. **Integration**: Single source of truth with Jira
