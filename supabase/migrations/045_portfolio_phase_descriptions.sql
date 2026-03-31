-- 045: Add optional descriptions to portfolio planning phase instances.

ALTER TABLE epic_phase_plans
  ADD COLUMN IF NOT EXISTS description text;
