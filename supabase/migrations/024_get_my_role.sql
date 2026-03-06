-- Creates a SECURITY DEFINER function that returns the current user's role.
-- This bypasses RLS entirely, making the role lookup immune to any policy issues.
-- Falls back to 'project_manager' when no row exists for the user.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid()),
    'project_manager'
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

INSERT INTO public.schema_migrations(version)
VALUES ('024_get_my_role')
ON CONFLICT (version) DO NOTHING;
