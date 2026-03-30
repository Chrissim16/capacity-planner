-- ─────────────────────────────────────────────────────────────────────────────
-- 040: Phase end dates + allocation modes (flat / rate / segments)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add explicit end date to phases
ALTER TABLE epic_phase_plans
  ADD COLUMN IF NOT EXISTS end_date text;

-- 2. Add allocation mode and rate field to assignments
ALTER TABLE epic_phase_assignments
  ADD COLUMN IF NOT EXISTS allocation_mode text NOT NULL DEFAULT 'flat'
    CHECK (allocation_mode IN ('flat', 'rate', 'segments')),
  ADD COLUMN IF NOT EXISTS days_per_week numeric(4,1);

-- 3. Allocation segments table (for 'segments' mode)
CREATE TABLE IF NOT EXISTS epic_phase_allocation_segments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid        NOT NULL REFERENCES epic_phase_assignments(id) ON DELETE CASCADE,
  start_date    text        NOT NULL,
  end_date      text        NOT NULL,
  days          numeric(4,1) NOT NULL CHECK (days > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE epic_phase_allocation_segments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (matches pattern from migration 035)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'epic_phase_allocation_segments'
      AND policyname = 'Allow authenticated access to allocation segments'
  ) THEN
    CREATE POLICY "Allow authenticated access to allocation segments"
      ON epic_phase_allocation_segments
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
