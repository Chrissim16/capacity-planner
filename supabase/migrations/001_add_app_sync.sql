-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 001: Add app_sync table
-- Purpose: Store the full application state as a JSON blob for cloud persistence.
--          This is the P0 data safety fix — moves data out of localStorage and
--          into the database so it survives browser clears and works cross-device.
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop existing table if re-running this migration
DROP TABLE IF EXISTS app_sync;

-- Create the app_sync table
CREATE TABLE app_sync (
    id TEXT PRIMARY KEY DEFAULT 'main',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on every write
CREATE OR REPLACE FUNCTION update_app_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_sync_updated_at
    BEFORE UPDATE ON app_sync
    FOR EACH ROW EXECUTE FUNCTION update_app_sync_updated_at();

-- Enable RLS
ALTER TABLE app_sync ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- POLICY: Allow anyone to read/write (no auth yet).
-- TODO (P3/US-035): Tighten this to authenticated users only once auth is
-- implemented. Change to: USING (auth.role() = 'authenticated')
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "Allow all access (pre-auth)" ON app_sync
    FOR ALL USING (true) WITH CHECK (true);

-- Explicitly grant read/write to the anon and authenticated roles.
-- RLS policies alone are not enough — table-level grants must also allow it.
GRANT SELECT, INSERT, UPDATE, DELETE ON app_sync TO anon, authenticated;

-- Insert a placeholder row so the first upsert is always an UPDATE, not INSERT
-- (avoids a race condition on first-ever save)
INSERT INTO app_sync (id, data) VALUES ('main', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
