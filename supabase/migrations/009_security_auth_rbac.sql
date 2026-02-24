-- Phase 0 security/auth hardening
-- 1) Introduce basic role model
-- 2) Lock all app tables to authenticated users
-- 3) Remove anonymous data access

-- Track applied migration versions
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Simple RBAC table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'team_lead'
    CHECK (role IN ('system_admin', 'it_manager', 'team_lead', 'stakeholder')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read user_roles" ON public.user_roles;
CREATE POLICY "Authenticated users can read user_roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "System admins can manage user_roles" ON public.user_roles;
CREATE POLICY "System admins can manage user_roles"
  ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'system_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'system_admin'
    )
  );

-- Lock app tables down to authenticated users only
DO $$
DECLARE
  t text;
  app_tables text[] := ARRAY[
    'team_members',
    'projects',
    'time_off',
    'settings',
    'scenarios',
    'sprints',
    'jira_connections',
    'jira_work_items',
    'public_holidays',
    'capacity_configs',
    'roles',
    'countries',
    'skills',
    'systems',
    'squads',
    'process_teams'
  ];
BEGIN
  FOREACH t IN ARRAY app_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Remove legacy permissive policies if present
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access (pre-auth)" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users only" ON public.%I', t);

    EXECUTE format(
      'CREATE POLICY "Authenticated users only" ON public.%I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')',
      t
    );

    -- Ensure anon has no direct table access
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

INSERT INTO public.schema_migrations(version)
VALUES ('009_security_auth_rbac')
ON CONFLICT (version) DO NOTHING;

