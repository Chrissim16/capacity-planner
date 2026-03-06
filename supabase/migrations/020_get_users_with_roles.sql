-- Expose a safe, admin-queryable view of all users with their assigned roles.
-- Uses SECURITY DEFINER so the function runs as its owner (postgres) and can
-- read auth.users, which is not accessible to the authenticated role directly.
-- GRANT EXECUTE is limited to authenticated users only; anon cannot call this.

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
AS $$
  SELECT
    u.id,
    u.email,
    COALESCE(ur.role, 'team_lead') AS role,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  ORDER BY u.created_at;
$$;

-- Remove any previously granted permissions, then grant only to authenticated.
REVOKE ALL ON FUNCTION public.get_users_with_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;

INSERT INTO public.schema_migrations(version)
VALUES ('020_get_users_with_roles')
ON CONFLICT (version) DO NOTHING;
