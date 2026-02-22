-- Migration 007: Add extended fields to projects table
--
-- Adds columns that were added to the TypeScript Project type but were never
-- persisted to Supabase, causing data loss on every page reload:
--   notes          – optional freetext notes on the project
--   start_date     – optional explicit start date (YYYY-MM-DD)
--   end_date       – optional explicit end date (YYYY-MM-DD)
--   archived       – soft-delete flag (hidden from normal views)
--
-- jira_source_key and synced_from_jira were already added in migration 003.
-- This migration is idempotent (uses ADD COLUMN IF NOT EXISTS).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS notes       text,
  ADD COLUMN IF NOT EXISTS start_date  text,
  ADD COLUMN IF NOT EXISTS end_date    text,
  ADD COLUMN IF NOT EXISTS archived    boolean NOT NULL DEFAULT false;

-- Index for efficient filtering of archived projects
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects (archived);
