-- Migration 036: Business Teams
-- Adds a separate business_teams table for Portfolio Planning team assignments.
-- Also adds business_team_ids to business_contacts so contacts can be linked
-- to one or more business teams.
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create business_teams table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_teams (
    id    text PRIMARY KEY,
    name  text NOT NULL UNIQUE
);

ALTER TABLE public.business_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage business_teams"
  ON public.business_teams FOR ALL
  USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_teams TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Add business_team_ids to business_contacts
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.business_contacts
    ADD COLUMN IF NOT EXISTS business_team_ids text[] DEFAULT '{}';
