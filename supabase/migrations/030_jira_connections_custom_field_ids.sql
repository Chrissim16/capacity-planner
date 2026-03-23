-- Migration 030: Add custom_field_ids to jira_connections
-- Stores per-connection Jira custom field ID overrides (epicLink, epicLinkAlt,
-- startDate, sprint). When NULL the app falls back to Jira Cloud defaults.

ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS custom_field_ids jsonb NULL;
