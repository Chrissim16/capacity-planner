-- Restrict user_roles SELECT to own row only.
-- Previously any authenticated user could read every user's role assignment.
-- Each user now reads only their own row; system_admins retain full visibility.

DROP POLICY IF EXISTS "Authenticated users can read user_roles" ON public.user_roles;

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

INSERT INTO public.schema_migrations(version)
VALUES ('019_restrict_user_roles_select')
ON CONFLICT (version) DO NOTHING;
