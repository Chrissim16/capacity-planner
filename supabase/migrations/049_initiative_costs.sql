-- Migration 049: initiative_costs
-- Stores direct initiative cost rows for shared portfolio epics and
-- scenario-native projects.

CREATE TABLE IF NOT EXISTS public.initiative_costs (
  id text PRIMARY KEY,
  initiative_kind text NOT NULL CHECK (initiative_kind IN ('portfolio_epic', 'scenario_project')),
  initiative_id text NOT NULL,
  scenario_id text,
  contingency_pct numeric NOT NULL DEFAULT 0 CHECK (contingency_pct >= 0),
  hardware jsonb,
  licenses jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.initiative_costs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'initiative_costs_portfolio_epic_uniq'
  ) THEN
    CREATE UNIQUE INDEX initiative_costs_portfolio_epic_uniq
      ON public.initiative_costs (initiative_kind, initiative_id)
      WHERE scenario_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'initiative_costs_scenario_project_uniq'
  ) THEN
    CREATE UNIQUE INDEX initiative_costs_scenario_project_uniq
      ON public.initiative_costs (initiative_kind, initiative_id, scenario_id)
      WHERE scenario_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'initiative_costs'
      AND policyname = 'Authenticated users can manage initiative_costs'
  ) THEN
    CREATE POLICY "Authenticated users can manage initiative_costs"
      ON public.initiative_costs FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.initiative_costs TO authenticated;
