-- Migration 048: costing rates and external vendors
-- Adds rate/currency support to existing people/team tables and creates the
-- external_vendors catalog used by the costing layer.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS worker_type text,
  ADD COLUMN IF NOT EXISTS external_vendor_id text,
  ADD COLUMN IF NOT EXISTS daily_rate_override numeric,
  ADD COLUMN IF NOT EXISTS daily_rate_currency text;

ALTER TABLE public.business_contacts
  ADD COLUMN IF NOT EXISTS daily_rate_override numeric,
  ADD COLUMN IF NOT EXISTS daily_rate_currency text;

ALTER TABLE public.business_teams
  ADD COLUMN IF NOT EXISTS daily_rate_override numeric,
  ADD COLUMN IF NOT EXISTS daily_rate_currency text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'team_members_rate_pair_valid'
  ) THEN
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_rate_pair_valid CHECK (
        (daily_rate_override IS NULL AND daily_rate_currency IS NULL)
        OR (daily_rate_override IS NOT NULL AND daily_rate_override >= 0 AND daily_rate_currency IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_contacts_rate_pair_valid'
  ) THEN
    ALTER TABLE public.business_contacts
      ADD CONSTRAINT business_contacts_rate_pair_valid CHECK (
        (daily_rate_override IS NULL AND daily_rate_currency IS NULL)
        OR (daily_rate_override IS NOT NULL AND daily_rate_override >= 0 AND daily_rate_currency IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_teams_rate_pair_valid'
  ) THEN
    ALTER TABLE public.business_teams
      ADD CONSTRAINT business_teams_rate_pair_valid CHECK (
        (daily_rate_override IS NULL AND daily_rate_currency IS NULL)
        OR (daily_rate_override IS NOT NULL AND daily_rate_override >= 0 AND daily_rate_currency IS NOT NULL)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.external_vendors (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  daily_rate numeric NOT NULL CHECK (daily_rate >= 0),
  currency text NOT NULL CHECK (currency IN ('EUR', 'GBP', 'USD')),
  notes text,
  archived boolean NOT NULL DEFAULT false,
  counts_toward_capacity boolean NOT NULL DEFAULT false,
  working_days_per_week numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_vendors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'external_vendors'
      AND policyname = 'Authenticated users can manage external_vendors'
  ) THEN
    CREATE POLICY "Authenticated users can manage external_vendors"
      ON public.external_vendors FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_vendors TO authenticated;
