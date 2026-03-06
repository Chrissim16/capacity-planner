-- Rename and simplify roles: 4 roles → 3.
--
-- Old → New:
--   system_admin  → system_admin   (unchanged)
--   it_manager    → project_manager
--   team_lead     → project_manager
--   stakeholder   → read_only
--
-- Also updates get_users_with_roles() to use the new default.

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RAISE NOTICE 'user_roles does not exist — skipping role rename migration';
  ELSE

    -- 1. Temporarily drop the CHECK constraint so we can insert transition values
    ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

    -- 2. Migrate existing rows
    UPDATE public.user_roles SET role = 'project_manager'
      WHERE role IN ('it_manager', 'team_lead');
    UPDATE public.user_roles SET role = 'read_only'
      WHERE role = 'stakeholder';

    -- 3. Re-add CHECK constraint with new allowed values
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_role_check
      CHECK (role IN ('system_admin', 'project_manager', 'read_only'));

    -- 4. Update the column default
    ALTER TABLE public.user_roles
      ALTER COLUMN role SET DEFAULT 'project_manager';

  END IF;
END $$;

-- 5. Update get_users_with_roles() to use the new default fallback.
--    Only re-create if the function already exists (i.e. migration 020 was applied).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_users_with_roles'
  ) THEN
    CREATE OR REPLACE FUNCTION public.get_users_with_roles()
    RETURNS TABLE (
      id             uuid,
      email          text,
      role           text,
      created_at     timestamptz,
      last_sign_in_at timestamptz
    )
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $fn$
      SELECT
        u.id,
        u.email,
        COALESCE(ur.role, 'project_manager') AS role,
        u.created_at,
        u.last_sign_in_at
      FROM auth.users u
      LEFT JOIN public.user_roles ur ON ur.user_id = u.id
      ORDER BY u.created_at;
    $fn$;

    REVOKE ALL ON FUNCTION public.get_users_with_roles() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;
  END IF;
END $$;

INSERT INTO public.schema_migrations(version)
VALUES ('021_rename_roles')
ON CONFLICT (version) DO NOTHING;
