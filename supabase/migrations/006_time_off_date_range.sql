-- ============================================================
-- Migration 006: Replace time_off quarter/days/reason columns
--                with date-range based start_date/end_date/note
--
-- The old schema stored time off as a number of days per quarter
-- (quarter text, days numeric, reason text).  The new schema uses
-- exact date ranges (start_date text, end_date text, note text),
-- which enables per-date capacity calculations, timeline display,
-- and better overlap detection.
--
-- All existing rows are discarded (user-confirmed).
-- ============================================================

-- Clear stale rows before altering the schema
TRUNCATE TABLE time_off;

-- Drop old columns
ALTER TABLE time_off
  DROP COLUMN IF EXISTS quarter,
  DROP COLUMN IF EXISTS days,
  DROP COLUMN IF EXISTS reason;

-- Add new columns
ALTER TABLE time_off
  ADD COLUMN IF NOT EXISTS start_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS end_date   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS note       text;

-- Remove defaults (app always supplies values)
ALTER TABLE time_off
  ALTER COLUMN start_date DROP DEFAULT,
  ALTER COLUMN end_date   DROP DEFAULT;
