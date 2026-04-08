-- Stop granting an implicit planner role to authenticated accounts that do not
-- have a row in public.user_roles yet. Unassigned accounts should be blocked
-- until an administrator provisions access explicitly.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

INSERT INTO public.schema_migrations(version)
VALUES ('047_harden_get_my_role')
ON CONFLICT (version) DO NOTHING;
