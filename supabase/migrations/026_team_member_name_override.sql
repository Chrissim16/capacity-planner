ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS name_manually_edited boolean NOT NULL DEFAULT false;
