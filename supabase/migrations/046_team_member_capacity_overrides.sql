ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS working_days_per_week numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS bau_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bau_reserve_days numeric;
