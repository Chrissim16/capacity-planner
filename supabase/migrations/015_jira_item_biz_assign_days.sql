-- Add days column to jira_item_biz_assignments
-- This allows tracking effort required from a business contact per Jira item.

ALTER TABLE public.jira_item_biz_assignments
  ADD COLUMN IF NOT EXISTS days numeric;
