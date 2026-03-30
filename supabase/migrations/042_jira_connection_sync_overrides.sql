-- Migration 042: Add per-connection Jira sync overrides
-- Allows individual Jira connections to override the global issue-type and
-- status-filter sync settings.

ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS sync_settings_override jsonb NULL;
