-- Migration 020 was skipped in production, so the get_users_with_roles()
-- function was never created. This migration creates it unconditionally.
-- Safe to run even if the function already exists (CREATE OR REPLACE).

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
    COALESCE(ur.role, 'project_manager') AS role,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  ORDER BY u.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_users_with_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;

INSERT INTO public.schema_migrations(version)
VALUES ('022_ensure_get_users_with_roles')
ON CONFLICT (version) DO NOTHING;
