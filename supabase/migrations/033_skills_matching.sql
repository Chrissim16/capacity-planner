-- F-SP-09: Skills & Assignment Intelligence
--
-- 1. Add skills_matching_enabled column to scenarios table (per-scenario toggle).
-- 2. requiredSkillIds on PlannerItem lives inside the planner_layout JSONB column
--    and is handled by the migration utility in plannerMigration.ts — no DDL needed.

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS skills_matching_enabled BOOLEAN DEFAULT true;
