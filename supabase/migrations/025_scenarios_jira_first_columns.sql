-- 025_scenarios_jira_first_columns.sql
-- Add columns required by the Jira-First Epic Hierarchy refactor.
-- The scenarios table previously stored project/assignment snapshots; it now
-- stores jira_item_biz_assignments (BIZ effort per Jira item) alongside
-- jira_work_items (already present). Also adds the UI 'color' label column.

ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS jira_item_biz_assignments jsonb NOT NULL DEFAULT '[]';
