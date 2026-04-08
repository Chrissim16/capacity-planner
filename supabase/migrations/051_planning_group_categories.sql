-- Migration 051: planning group categories
-- Extends business_teams into a generalized planning-group store and adds
-- team-level reporting categories for internal IT vs external partners.

ALTER TABLE public.business_teams
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS track text,
  ADD COLUMN IF NOT EXISTS external_vendor_id text,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

UPDATE public.business_teams
SET
  category = COALESCE(category, 'business_team'),
  track = COALESCE(track, 'BIZ')
WHERE category IS NULL OR track IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_teams_category_valid'
  ) THEN
    ALTER TABLE public.business_teams
      ADD CONSTRAINT business_teams_category_valid CHECK (
        category IN ('business_team', 'external_partner', 'internal_it_team')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_teams_track_valid'
  ) THEN
    ALTER TABLE public.business_teams
      ADD CONSTRAINT business_teams_track_valid CHECK (
        track IN ('IT', 'BIZ')
      );
  END IF;
END $$;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS assignment_category text;

UPDATE public.team_members
SET assignment_category = CASE
  WHEN worker_type = 'external' THEN 'external_partner'
  ELSE COALESCE(assignment_category, 'it_team_member')
END
WHERE assignment_category IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_members_assignment_category_valid'
  ) THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_assignment_category_valid CHECK (
        assignment_category IN ('it_team_member', 'other_internal_it', 'external_partner')
      );
  END IF;
END $$;
