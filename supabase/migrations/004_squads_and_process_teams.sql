-- Migration 004: Squads and Process Teams
-- Adds organisational structure fields to the data model.
--
-- New tables:
--   squads        → IT teams within Value Stream Finance (ERP, EPM)
--   process_teams → Cross-functional process teams (R2R, L2C, P2P, Planning, Treasury, FP&A)
--
-- Changes to team_members:
--   squad_id          text  → which IT team the member belongs to
--   process_team_ids  jsonb → array of process team IDs (cross-functional)
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create squads table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS squads (
    id    text PRIMARY KEY,
    name  text NOT NULL UNIQUE
);

ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON squads FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON squads TO anon, authenticated;

-- Seed default squads
INSERT INTO squads (id, name) VALUES
    ('squad-erp', 'ERP'),
    ('squad-epm', 'EPM')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Create process_teams table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS process_teams (
    id    text PRIMARY KEY,
    name  text NOT NULL UNIQUE
);

ALTER TABLE process_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON process_teams FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON process_teams TO anon, authenticated;

-- Seed default process teams
INSERT INTO process_teams (id, name) VALUES
    ('pt-r2r',      'R2R'),
    ('pt-l2c',      'L2C'),
    ('pt-p2p',      'P2P'),
    ('pt-planning', 'Planning'),
    ('pt-treasury', 'Treasury'),
    ('pt-fpa',      'FP&A')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Add columns to team_members
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS squad_id         text,
    ADD COLUMN IF NOT EXISTS process_team_ids jsonb NOT NULL DEFAULT '[]';
