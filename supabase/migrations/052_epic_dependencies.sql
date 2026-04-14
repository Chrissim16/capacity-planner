-- 052_epic_dependencies.sql
-- Finish-to-start dependency links between epics in Portfolio Planning.
-- Baseline dependencies live in this table; scenario-specific overrides
-- are stored as JSONB in the scenarios table (portfolio_epic_dependencies column).

CREATE TABLE IF NOT EXISTS public.epic_dependencies (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_epic_key text        NOT NULL,
  to_epic_key   text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epic_dependencies_unique UNIQUE (from_epic_key, to_epic_key)
);

DROP TRIGGER IF EXISTS epic_dependencies_updated_at ON public.epic_dependencies;
CREATE TRIGGER epic_dependencies_updated_at
  BEFORE UPDATE ON public.epic_dependencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.epic_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users only" ON public.epic_dependencies
  FOR ALL USING (auth.role() = 'authenticated');

-- Add scenario-level dependency overrides alongside other portfolio JSONB blobs
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS portfolio_epic_dependencies jsonb NOT NULL DEFAULT '[]';
