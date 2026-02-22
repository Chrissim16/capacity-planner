-- ============================================================
-- Migration 005: Fix public_holidays.id column type
--
-- Problem: public_holidays was originally created with id uuid.
--          All other tables use id text to match the app's
--          generateId() function (e.g. "holiday-<timestamp>-<random>").
--          Saving imported holidays from the Nager.Date API therefore
--          failed with:
--            "invalid input syntax for type uuid: holiday-177..."
--
-- Fix: change the id column (and any FK references) from uuid to text.
--      Existing UUID-format values are preserved as their text equivalent.
-- ============================================================

ALTER TABLE public_holidays
  ALTER COLUMN id TYPE text USING id::text;
