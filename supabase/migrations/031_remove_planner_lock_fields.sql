-- Remove stale `locked` and `unlockedInScenario` keys from all planner_layout
-- JSONB arrays. These fields were part of the now-removed lock/unlock system.
-- Safe to run multiple times (idempotent: missing keys are ignored by the `-`
-- operator in Postgres).
UPDATE public.scenarios
SET planner_layout = (
  SELECT jsonb_agg(item - 'locked' - 'unlockedInScenario')
  FROM jsonb_array_elements(planner_layout) AS item
)
WHERE planner_layout IS NOT NULL
  AND jsonb_typeof(planner_layout) = 'array';
