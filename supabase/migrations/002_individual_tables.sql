-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 002: Switch from app_sync blob to individual tables
-- Purpose: Replace the single JSON blob with proper relational tables that match
--          the TypeScript AppState types exactly. This gives full visibility into
--          the data in the Supabase dashboard and enables future multi-user support.
--
-- IMPORTANT: Run this in Supabase Dashboard → SQL Editor → New Query → Run
--
-- What this migration does:
--   1. Adds missing columns to existing tables (countries.flag, etc.)
--   2. Drops and recreates team_members, projects, time_off with the correct
--      schema (they are empty so no data is lost)
--   3. Creates new tables: sprints, jira_connections, jira_work_items, scenarios
--   4. Migrates existing data from app_sync blob into the new tables
--   5. Sets up RLS + GRANTs for every table
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Patch existing reference tables
-- ─────────────────────────────────────────────────────────────────────────────

-- countries: add flag emoji column if it doesn't exist
ALTER TABLE countries ADD COLUMN IF NOT EXISTS flag text;

-- public_holidays: ensure country_id is text (not UUID) to match our string IDs
-- (no change needed if already correct)


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Rebuild team_members to match TypeScript TeamMember interface
--
-- Old schema had: role_id (UUID FK) — doesn't match TypeScript which uses
-- role (string name). Rebuilding since the table is empty.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS team_members CASCADE;

CREATE TABLE team_members (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    role        text NOT NULL DEFAULT '',        -- stores role NAME (e.g. "Developer"), not a UUID FK
    country_id  text,                            -- references countries(id) by convention, no FK to allow parallel saves
    skill_ids   jsonb NOT NULL DEFAULT '[]',     -- array of skill ID strings
    max_concurrent_projects integer NOT NULL DEFAULT 2,
    email               text,
    jira_account_id     text,
    synced_from_jira    boolean NOT NULL DEFAULT false,
    needs_enrichment    boolean NOT NULL DEFAULT false,
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON team_members FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON team_members TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Rebuild projects to match TypeScript Project interface
--
-- Old schema had separate project_phases + phase_assignments tables.
-- New schema stores phases (with nested assignments) as JSONB for simplicity.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS phase_assignments CASCADE;
DROP TABLE IF EXISTS phase_required_skills CASCADE;
DROP TABLE IF EXISTS project_phases CASCADE;
DROP TABLE IF EXISTS project_systems CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

CREATE TABLE projects (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    priority    text NOT NULL DEFAULT 'Medium',
    status      text NOT NULL DEFAULT 'Planning',
    system_ids  jsonb NOT NULL DEFAULT '[]',     -- array of system ID strings
    phases      jsonb NOT NULL DEFAULT '[]',     -- array of Phase objects (with nested assignments)
    devops_link text,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON projects FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Rebuild time_off to match TypeScript TimeOff interface
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS time_off CASCADE;

CREATE TABLE time_off (
    id          text PRIMARY KEY,
    member_id   text NOT NULL,
    quarter     text NOT NULL,
    days        numeric NOT NULL DEFAULT 0,
    reason      text,
    UNIQUE (member_id, quarter)
);

ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON time_off FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON time_off TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Create sprints table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sprints (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    number      integer NOT NULL,
    year        integer NOT NULL,
    start_date  text NOT NULL,
    end_date    text NOT NULL,
    quarter     text NOT NULL,
    is_bye_week boolean NOT NULL DEFAULT false
);

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON sprints FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON sprints TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Create jira_connections table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jira_connections (
    id                  text PRIMARY KEY,
    name                text NOT NULL,
    jira_base_url       text NOT NULL,
    jira_project_key    text NOT NULL,
    jira_project_id     text,
    jira_project_name   text,
    api_token           text NOT NULL,
    api_token_masked    text,
    user_email          text NOT NULL,
    is_active           boolean NOT NULL DEFAULT true,
    last_sync_at        text,
    last_sync_status    text NOT NULL DEFAULT 'idle',
    last_sync_error     text,
    sync_history        jsonb NOT NULL DEFAULT '[]',
    created_at          text NOT NULL,
    updated_at          text NOT NULL
);

ALTER TABLE jira_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON jira_connections FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON jira_connections TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Create jira_work_items table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jira_work_items (
    id                  text PRIMARY KEY,
    connection_id       text NOT NULL,
    jira_key            text NOT NULL,
    jira_id             text NOT NULL,
    summary             text NOT NULL,
    description         text,
    type                text NOT NULL,
    type_name           text NOT NULL,
    status              text NOT NULL,
    status_category     text NOT NULL,
    priority            text,
    story_points        numeric,
    original_estimate   numeric,
    time_spent          numeric,
    remaining_estimate  numeric,
    assignee_email      text,
    assignee_name       text,
    reporter_email      text,
    reporter_name       text,
    parent_key          text,
    parent_id           text,
    sprint_id           text,
    sprint_name         text,
    labels              jsonb NOT NULL DEFAULT '[]',
    components          jsonb NOT NULL DEFAULT '[]',
    created             text NOT NULL,
    updated             text NOT NULL,
    mapped_project_id   text,
    mapped_phase_id     text,
    mapped_member_id    text
);

ALTER TABLE jira_work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON jira_work_items FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON jira_work_items TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: Create scenarios table
-- Scenario data (projects, teamMembers, etc.) stored as JSONB because scenarios
-- are deep copies of baseline data — normalising them would duplicate the entire
-- schema for no practical benefit in a single-user app.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scenarios (
    id              text PRIMARY KEY,
    name            text NOT NULL,
    description     text,
    created_at      text NOT NULL,
    updated_at      text NOT NULL,
    based_on_sync_at text,
    is_baseline     boolean NOT NULL DEFAULT false,
    projects        jsonb NOT NULL DEFAULT '[]',
    team_members    jsonb NOT NULL DEFAULT '[]',
    assignments     jsonb NOT NULL DEFAULT '[]',
    time_off        jsonb NOT NULL DEFAULT '[]',
    jira_work_items jsonb NOT NULL DEFAULT '[]'
);

ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access (pre-auth)" ON scenarios FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON scenarios TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9: Ensure existing reference tables have correct RLS + GRANTs
-- (in case these were created without them)
-- ─────────────────────────────────────────────────────────────────────────────

-- roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'roles' AND policyname = 'Allow all access (pre-auth)'
  ) THEN
    CREATE POLICY "Allow all access (pre-auth)" ON roles FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON roles TO anon, authenticated;

-- countries
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'countries' AND policyname = 'Allow all access (pre-auth)'
  ) THEN
    CREATE POLICY "Allow all access (pre-auth)" ON countries FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON countries TO anon, authenticated;

-- public_holidays
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'public_holidays' AND policyname = 'Allow all access (pre-auth)'
  ) THEN
    CREATE POLICY "Allow all access (pre-auth)" ON public_holidays FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public_holidays TO anon, authenticated;

-- skills
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'skills' AND policyname = 'Allow all access (pre-auth)'
  ) THEN
    CREATE POLICY "Allow all access (pre-auth)" ON skills FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON skills TO anon, authenticated;

-- systems
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'systems' AND policyname = 'Allow all access (pre-auth)'
  ) THEN
    CREATE POLICY "Allow all access (pre-auth)" ON systems FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON systems TO anon, authenticated;

-- settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'Allow all access (pre-auth)'
  ) THEN
    CREATE POLICY "Allow all access (pre-auth)" ON settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON settings TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10: Migrate data from app_sync blob into new individual tables
-- This copies your existing roles, countries, skills, systems, and holidays
-- from the JSON blob into the proper individual tables.
-- Safe to run even if app_sync is empty — it will just do nothing.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    blob jsonb;
BEGIN
    SELECT data INTO blob FROM app_sync WHERE id = 'main';

    IF blob IS NULL OR blob = '{}'::jsonb THEN
        RAISE NOTICE 'app_sync is empty — nothing to migrate.';
        RETURN;
    END IF;

    -- Migrate roles (insert only, skip if already present)
    IF blob->'roles' IS NOT NULL THEN
        INSERT INTO roles (id, name)
        SELECT
            (r->>'id')::text,
            (r->>'name')::text
        FROM jsonb_array_elements(blob->'roles') r
        WHERE (r->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated roles from app_sync.';
    END IF;

    -- Migrate countries
    IF blob->'countries' IS NOT NULL THEN
        INSERT INTO countries (id, code, name, flag)
        SELECT
            (c->>'id')::text,
            (c->>'code')::text,
            (c->>'name')::text,
            (c->>'flag')::text
        FROM jsonb_array_elements(blob->'countries') c
        WHERE (c->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated countries from app_sync.';
    END IF;

    -- Migrate public_holidays
    IF blob->'publicHolidays' IS NOT NULL THEN
        INSERT INTO public_holidays (id, country_id, date, name)
        SELECT
            (h->>'id')::text,
            (h->>'countryId')::text,
            (h->>'date')::text,
            (h->>'name')::text
        FROM jsonb_array_elements(blob->'publicHolidays') h
        WHERE (h->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated public_holidays from app_sync.';
    END IF;

    -- Migrate skills
    IF blob->'skills' IS NOT NULL THEN
        INSERT INTO skills (id, name, category)
        SELECT
            (s->>'id')::text,
            (s->>'name')::text,
            (s->>'category')::text
        FROM jsonb_array_elements(blob->'skills') s
        WHERE (s->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated skills from app_sync.';
    END IF;

    -- Migrate systems
    IF blob->'systems' IS NOT NULL THEN
        INSERT INTO systems (id, name, description)
        SELECT
            (s->>'id')::text,
            (s->>'name')::text,
            (s->>'description')::text
        FROM jsonb_array_elements(blob->'systems') s
        WHERE (s->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated systems from app_sync.';
    END IF;

    -- Migrate team_members
    IF blob->'teamMembers' IS NOT NULL THEN
        INSERT INTO team_members (id, name, role, country_id, skill_ids, max_concurrent_projects,
                                  email, jira_account_id, synced_from_jira, needs_enrichment)
        SELECT
            (m->>'id')::text,
            (m->>'name')::text,
            COALESCE((m->>'role')::text, ''),
            (m->>'countryId')::text,
            COALESCE(m->'skillIds', '[]'::jsonb),
            COALESCE((m->>'maxConcurrentProjects')::integer, 2),
            (m->>'email')::text,
            (m->>'jiraAccountId')::text,
            COALESCE((m->>'syncedFromJira')::boolean, false),
            COALESCE((m->>'needsEnrichment')::boolean, false)
        FROM jsonb_array_elements(blob->'teamMembers') m
        WHERE (m->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated team_members from app_sync.';
    END IF;

    -- Migrate projects
    IF blob->'projects' IS NOT NULL THEN
        INSERT INTO projects (id, name, priority, status, system_ids, phases, devops_link, description)
        SELECT
            (p->>'id')::text,
            (p->>'name')::text,
            COALESCE((p->>'priority')::text, 'Medium'),
            COALESCE((p->>'status')::text, 'Planning'),
            COALESCE(p->'systemIds', '[]'::jsonb),
            COALESCE(p->'phases', '[]'::jsonb),
            (p->>'devopsLink')::text,
            (p->>'description')::text
        FROM jsonb_array_elements(blob->'projects') p
        WHERE (p->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated projects from app_sync.';
    END IF;

    -- Migrate time_off
    IF blob->'timeOff' IS NOT NULL THEN
        INSERT INTO time_off (id, member_id, quarter, days, reason)
        SELECT
            COALESCE((t->>'id')::text, gen_random_uuid()::text),
            (t->>'memberId')::text,
            (t->>'quarter')::text,
            COALESCE((t->>'days')::numeric, 0),
            (t->>'reason')::text
        FROM jsonb_array_elements(blob->'timeOff') t
        WHERE (t->>'memberId') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated time_off from app_sync.';
    END IF;

    -- Migrate sprints
    IF blob->'sprints' IS NOT NULL THEN
        INSERT INTO sprints (id, name, number, year, start_date, end_date, quarter, is_bye_week)
        SELECT
            (s->>'id')::text,
            (s->>'name')::text,
            (s->>'number')::integer,
            (s->>'year')::integer,
            (s->>'startDate')::text,
            (s->>'endDate')::text,
            (s->>'quarter')::text,
            COALESCE((s->>'isByeWeek')::boolean, false)
        FROM jsonb_array_elements(blob->'sprints') s
        WHERE (s->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated sprints from app_sync.';
    END IF;

    -- Migrate jira_connections
    IF blob->'jiraConnections' IS NOT NULL THEN
        INSERT INTO jira_connections (id, name, jira_base_url, jira_project_key, jira_project_id,
                                      jira_project_name, api_token, api_token_masked, user_email,
                                      is_active, last_sync_at, last_sync_status, last_sync_error,
                                      sync_history, created_at, updated_at)
        SELECT
            (c->>'id')::text,
            (c->>'name')::text,
            (c->>'jiraBaseUrl')::text,
            (c->>'jiraProjectKey')::text,
            (c->>'jiraProjectId')::text,
            (c->>'jiraProjectName')::text,
            (c->>'apiToken')::text,
            (c->>'apiTokenMasked')::text,
            (c->>'userEmail')::text,
            COALESCE((c->>'isActive')::boolean, true),
            (c->>'lastSyncAt')::text,
            COALESCE((c->>'lastSyncStatus')::text, 'idle'),
            (c->>'lastSyncError')::text,
            COALESCE(c->'syncHistory', '[]'::jsonb),
            COALESCE((c->>'createdAt')::text, now()::text),
            COALESCE((c->>'updatedAt')::text, now()::text)
        FROM jsonb_array_elements(blob->'jiraConnections') c
        WHERE (c->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated jira_connections from app_sync.';
    END IF;

    -- Migrate jira_work_items
    IF blob->'jiraWorkItems' IS NOT NULL THEN
        INSERT INTO jira_work_items (id, connection_id, jira_key, jira_id, summary, description,
                                     type, type_name, status, status_category, priority,
                                     story_points, original_estimate, time_spent, remaining_estimate,
                                     assignee_email, assignee_name, reporter_email, reporter_name,
                                     parent_key, parent_id, sprint_id, sprint_name,
                                     labels, components, created, updated,
                                     mapped_project_id, mapped_phase_id, mapped_member_id)
        SELECT
            (w->>'id')::text,
            (w->>'connectionId')::text,
            (w->>'jiraKey')::text,
            (w->>'jiraId')::text,
            (w->>'summary')::text,
            (w->>'description')::text,
            (w->>'type')::text,
            (w->>'typeName')::text,
            (w->>'status')::text,
            (w->>'statusCategory')::text,
            (w->>'priority')::text,
            (w->>'storyPoints')::numeric,
            (w->>'originalEstimate')::numeric,
            (w->>'timeSpent')::numeric,
            (w->>'remainingEstimate')::numeric,
            (w->>'assigneeEmail')::text,
            (w->>'assigneeName')::text,
            (w->>'reporterEmail')::text,
            (w->>'reporterName')::text,
            (w->>'parentKey')::text,
            (w->>'parentId')::text,
            (w->>'sprintId')::text,
            (w->>'sprintName')::text,
            COALESCE(w->'labels', '[]'::jsonb),
            COALESCE(w->'components', '[]'::jsonb),
            (w->>'created')::text,
            (w->>'updated')::text,
            (w->>'mappedProjectId')::text,
            (w->>'mappedPhaseId')::text,
            (w->>'mappedMemberId')::text
        FROM jsonb_array_elements(blob->'jiraWorkItems') w
        WHERE (w->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated jira_work_items from app_sync.';
    END IF;

    -- Migrate scenarios
    IF blob->'scenarios' IS NOT NULL THEN
        INSERT INTO scenarios (id, name, description, created_at, updated_at,
                               based_on_sync_at, is_baseline, projects, team_members,
                               assignments, time_off, jira_work_items)
        SELECT
            (s->>'id')::text,
            (s->>'name')::text,
            (s->>'description')::text,
            COALESCE((s->>'createdAt')::text, now()::text),
            COALESCE((s->>'updatedAt')::text, now()::text),
            (s->>'basedOnSyncAt')::text,
            COALESCE((s->>'isBaseline')::boolean, false),
            COALESCE(s->'projects', '[]'::jsonb),
            COALESCE(s->'teamMembers', '[]'::jsonb),
            COALESCE(s->'assignments', '[]'::jsonb),
            COALESCE(s->'timeOff', '[]'::jsonb),
            COALESCE(s->'jiraWorkItems', '[]'::jsonb)
        FROM jsonb_array_elements(blob->'scenarios') s
        WHERE (s->>'id') IS NOT NULL
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE 'Migrated scenarios from app_sync.';
    END IF;

    -- Migrate settings into the settings key-value table
    IF blob->'settings' IS NOT NULL THEN
        INSERT INTO settings (key, value)
        VALUES ('settings', blob->'settings')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        RAISE NOTICE 'Migrated settings from app_sync.';
    END IF;

    IF blob->'jiraSettings' IS NOT NULL THEN
        INSERT INTO settings (key, value)
        VALUES ('jiraSettings', blob->'jiraSettings')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    IF blob->'activeScenarioId' IS NOT NULL THEN
        INSERT INTO settings (key, value)
        VALUES ('activeScenarioId', blob->'activeScenarioId')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    RAISE NOTICE 'Migration 002 complete.';
END $$;
