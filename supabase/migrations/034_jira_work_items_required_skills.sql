-- F-SK-01: Required skills on Jira work items
--
-- Adds an app-only required_skill_ids column to jira_work_items.
-- This field is never read from or written to Jira — it is managed
-- exclusively within the capacity planner (inline edit on Jira/Epics page
-- and via bulk edit). Skills propagate to PlannerItem.requiredSkillIds
-- when a work item is scheduled into the Scenario Planner.

ALTER TABLE jira_work_items
  ADD COLUMN IF NOT EXISTS required_skill_ids JSONB DEFAULT NULL;
