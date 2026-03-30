-- Migration 045: Add label_filter to jira_connections
-- Stores a multi-select Jira label filter per connection.

ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS label_filter jsonb NOT NULL DEFAULT '[]'::jsonb;
