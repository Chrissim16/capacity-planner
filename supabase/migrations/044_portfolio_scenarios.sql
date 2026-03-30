-- Persist Portfolio Planning scenario copies alongside the existing scenarios table.
ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS is_portfolio_scenario boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS portfolio_board_epic_keys jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS portfolio_manual_epics jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS portfolio_phase_plans jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS portfolio_phase_assignments jsonb NOT NULL DEFAULT '[]';
