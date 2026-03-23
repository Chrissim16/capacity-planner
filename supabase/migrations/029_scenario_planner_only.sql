-- Migration 029: Add scenario_planner_only flag to jira_connections
-- Items from connections with this flag set are only visible in the Scenario Planner backlog.

ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS scenario_planner_only boolean NOT NULL DEFAULT false;
