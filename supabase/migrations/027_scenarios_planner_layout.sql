-- Scenario planner timeline + hub metadata (synced via supabaseSync.ts)
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS planner_layout jsonb,
  ADD COLUMN IF NOT EXISTS last_edited_by text;
