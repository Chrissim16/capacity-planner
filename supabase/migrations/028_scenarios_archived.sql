-- Scenario archive flag (Scenario Planner home screen)
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
