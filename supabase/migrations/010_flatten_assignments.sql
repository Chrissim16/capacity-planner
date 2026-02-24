-- Flatten assignments from nested phase JSON to first-class table.

CREATE TABLE IF NOT EXISTS public.assignments (
  id text PRIMARY KEY,
  project_id text NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id text NULL,
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  quarter text NOT NULL,
  days numeric NOT NULL DEFAULT 0,
  sprint text NULL,
  jira_synced boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_member_quarter_idx
  ON public.assignments(member_id, quarter);

CREATE INDEX IF NOT EXISTS assignments_project_phase_idx
  ON public.assignments(project_id, phase_id);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users only" ON public.assignments;
CREATE POLICY "Authenticated users only"
  ON public.assignments
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

