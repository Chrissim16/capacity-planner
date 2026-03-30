-- Add metadata columns to portfolio_epics to support manually-created epics.
-- Manually created epics have is_manual = true and use auto-generated codes (MAN-XXXX).
-- Jira-sourced epics keep their existing rows unchanged (is_manual = false by default).

ALTER TABLE portfolio_epics
  ADD COLUMN IF NOT EXISTS summary     text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_manual   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_date  date,
  ADD COLUMN IF NOT EXISTS end_date    date;
