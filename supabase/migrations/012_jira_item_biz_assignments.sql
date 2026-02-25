-- 012_jira_item_biz_assignments.sql
-- Links a BusinessContact to a specific Jira work item (Epic, Feature, Story, etc.)

CREATE TABLE IF NOT EXISTS public.jira_item_biz_assignments (
  id         text        PRIMARY KEY,
  jira_key   text        NOT NULL,
  contact_id text        NOT NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jira_item_biz_assignments_jira_key_idx
  ON public.jira_item_biz_assignments (jira_key);

CREATE INDEX IF NOT EXISTS jira_item_biz_assignments_contact_id_idx
  ON public.jira_item_biz_assignments (contact_id);

ALTER TABLE public.jira_item_biz_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth" ON public.jira_item_biz_assignments
  FOR ALL USING (auth.role() = 'authenticated');
