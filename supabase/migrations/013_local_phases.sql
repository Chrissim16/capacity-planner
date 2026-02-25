-- Migration 013: Local phases (UAT / Hypercare) attached to Jira Epics
-- These are manually-managed phases that sit outside Jira but are positioned
-- on the Gantt timeline alongside Jira work items.

CREATE TABLE IF NOT EXISTS public.local_phases (
  id         text PRIMARY KEY,
  jira_key   text NOT NULL,
  type       text NOT NULL CHECK (type IN ('uat', 'hypercare')),
  name       text NOT NULL,
  start_date text NOT NULL,
  end_date   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_phases_jira_key ON public.local_phases (jira_key);

ALTER TABLE public.local_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users" ON public.local_phases FOR ALL
  USING (auth.role() = 'authenticated');
