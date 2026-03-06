-- The migration 019 policy used a self-referencing EXISTS subquery which causes
-- Postgres to apply RLS recursively, silently returning 0 rows.
--
-- Fix: each user may only read their own role row.
-- Admins reading ALL users is handled exclusively by get_users_with_roles()
-- which is SECURITY DEFINER and bypasses RLS entirely.

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RAISE NOTICE 'user_roles does not exist — skipping RLS fix';
  ELSE
    -- Drop all existing SELECT policies so we start clean
    DROP POLICY IF EXISTS "Authenticated users can read user_roles" ON public.user_roles;
    DROP POLICY IF EXISTS "Users can read own role"                  ON public.user_roles;

    -- Simple, unambiguous policy: each user reads only their own row
    CREATE POLICY "Users can read own role"
      ON public.user_roles
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

INSERT INTO public.schema_migrations(version)
VALUES ('023_fix_user_roles_rls')
ON CONFLICT (version) DO NOTHING;
