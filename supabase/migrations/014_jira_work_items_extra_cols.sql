-- Migration 014: Add missing columns to jira_work_items
-- These fields were defined in the TypeScript type but never added to the table,
-- causing them to be silently dropped on every Supabase save/load cycle.

ALTER TABLE public.jira_work_items
  ADD COLUMN IF NOT EXISTS sprint_start_date text,
  ADD COLUMN IF NOT EXISTS sprint_end_date   text,
  ADD COLUMN IF NOT EXISTS start_date        text,
  ADD COLUMN IF NOT EXISTS due_date          text,
  ADD COLUMN IF NOT EXISTS stale_from_jira   boolean,
  ADD COLUMN IF NOT EXISTS confidence_level  text;
