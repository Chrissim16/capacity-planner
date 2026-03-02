-- 018_verify_rls.sql
-- Defensive cleanup: ensures the open "Allow all access (pre-auth)" policy
-- (created in migration 002) is gone from every table, regardless of whether
-- migration 009 was applied to this instance.
-- Also re-enables RLS and revokes anon access on tables added in migrations
-- 010–017, which were not covered by the loop in migration 009.
-- Skips any table that does not exist in this instance (safe to re-run).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'team_members',
    'projects',
    'time_off',
    'settings',
    'scenarios',
    'jira_connections',
    'jira_work_items',
    'sprints',
    'systems',
    'squads',
    'public_holidays',
    'countries',
    'process_teams',
    'user_roles',
    'assignments',
    'business_contacts',
    'business_time_off',
    'business_assignments',
    'jira_item_biz_assignments',
    'local_phases'
  ]
  LOOP
    -- Skip tables that don't exist in this instance
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "Allow all access (pre-auth)" ON public.%I', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;
