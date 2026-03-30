-- Migration: Replace start_day (relative int) with start_date (absolute date)
--
-- start_day was stored as a working-day offset from the first Monday of
-- whichever quarter was selected at save time — making values non-portable
-- across quarter switches. start_date stores the absolute calendar date so
-- phase bar positions remain stable regardless of the active quarter.
--
-- Assumption for data migration: existing start_day values were set while
-- viewing Q1 2026 (tStart = 2026-01-05, the first Monday of that quarter).

ALTER TABLE epic_phase_plans ADD COLUMN start_date date;

UPDATE epic_phase_plans
SET start_date = ('2026-01-05'::date + INTERVAL '1 day' * ROUND(start_day::numeric * 7.0 / 5.0))::date
WHERE start_day IS NOT NULL;

ALTER TABLE epic_phase_plans DROP COLUMN start_day;
