-- Migration 032: Add jql_filter to jira_connections
-- Allows per-connection JQL filter override used during Jira sync.

ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS jql_filter text NULL;
