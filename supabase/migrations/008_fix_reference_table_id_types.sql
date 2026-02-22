-- ============================================================
-- Migration 008: Fix id column types on reference tables
--
-- Problem: roles, countries, skills, and systems were originally
--          created with id uuid. The app's generateId() produces
--          strings like "sys-<timestamp>-<random>", "role-...",
--          "skill-...", "country-..." which are not valid UUIDs.
--          Upserts therefore fail with:
--            "invalid input syntax for type uuid: sys-177..."
--
-- Fix: change id (and FK columns that reference them) from uuid
--      to text. Existing UUID-format values are preserved as their
--      text equivalent (uuid::text is always valid text).
--
-- Safe to run multiple times — ALTER COLUMN TYPE to text is a no-op
-- if the column is already text.
-- ============================================================

-- systems
ALTER TABLE systems
  ALTER COLUMN id TYPE text USING id::text;

-- roles
ALTER TABLE roles
  ALTER COLUMN id TYPE text USING id::text;

-- skills
ALTER TABLE skills
  ALTER COLUMN id TYPE text USING id::text;

-- countries — must drop FK from public_holidays first, then fix both columns
ALTER TABLE public_holidays
  DROP CONSTRAINT IF EXISTS public_holidays_country_id_fkey;

ALTER TABLE countries
  ALTER COLUMN id TYPE text USING id::text;

-- Also fix public_holidays.country_id in case it is still uuid
ALTER TABLE public_holidays
  ALTER COLUMN country_id TYPE text USING country_id::text;
