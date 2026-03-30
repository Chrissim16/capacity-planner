-- Migration 043: Add Jira connection mode + discovery config

ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'standard';

ALTER TABLE jira_connections
  ADD COLUMN IF NOT EXISTS discovery_config jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jira_connections_mode_check'
  ) THEN
    ALTER TABLE jira_connections
      ADD CONSTRAINT jira_connections_mode_check
      CHECK (mode IN ('standard', 'discovery'));
  END IF;
END $$;
