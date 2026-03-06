-- Restrict user_roles SELECT to own row only.
-- Previously any authenticated user could read every user's role assignment.
-- Each user now reads only their own row; system_admins retain full visibility.
-- Wrapped in a DO block so the migration is a no-op when user_roles does not
-- exist yet (e.g. migration 009 has not been applied to this environment).

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NULL THEN
    RAISE NOTICE 'user_roles does not exist — skipping policy update';
  ELSE
    DROP POLICY IF EXISTS "Authenticated users can read user_roles" ON public.user_roles;

    -- idempotent: drop before re-create so re-running is safe
    DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;

    CREATE POLICY "Users can read own role"
      ON public.user_roles
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = 'system_admin'
        )
      );
  END IF;
END $$;

INSERT INTO public.schema_migrations(version)
VALUES ('019_restrict_user_roles_select')
ON CONFLICT (version) DO NOTHING;
