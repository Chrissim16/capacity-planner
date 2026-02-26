ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS excluded_from_capacity boolean NOT NULL DEFAULT false;

ALTER TABLE public.business_contacts
  ADD COLUMN IF NOT EXISTS excluded_from_capacity boolean NOT NULL DEFAULT false;
