-- ============================================================
-- Migration 003: Jira-led import
-- Adds columns required for tracking Jira-sourced Projects and
-- the new per-connection import behaviour settings.
-- ============================================================

-- ── Projects table ───────────────────────────────────────────
-- jira_source_key: the Jira Epic/Feature key this project was
--   auto-created from (e.g. "ERP-42").  NULL for manual projects.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS jira_source_key   text,
  ADD COLUMN IF NOT EXISTS synced_from_jira  boolean NOT NULL DEFAULT false;

-- Index for fast lookup by Jira key during sync
CREATE INDEX IF NOT EXISTS idx_projects_jira_source_key
  ON projects (jira_source_key)
  WHERE jira_source_key IS NOT NULL;

-- ── Jira connections table ────────────────────────────────────
-- Stores the new per-connection import behaviour settings.
-- These are also persisted in the JSONB settings row but adding
-- explicit columns here makes SQL queries easier if needed.
ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS hierarchy_mode         text    NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS auto_create_projects   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_create_assignments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_days_per_item  numeric NOT NULL DEFAULT 1;

-- ── Constraints ───────────────────────────────────────────────
ALTER TABLE jira_connections
  DROP CONSTRAINT IF EXISTS jira_connections_hierarchy_mode_check;

ALTER TABLE jira_connections
  ADD CONSTRAINT jira_connections_hierarchy_mode_check
    CHECK (hierarchy_mode IN ('auto', 'epic_as_project', 'feature_as_project'));
