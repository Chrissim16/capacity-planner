import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { withTimeout } from '../utils/withTimeout';

export type AppRole = 'system_admin' | 'project_manager' | 'read_only';

export type AppAction =
  | 'view_all'
  | 'edit_assignments'
  | 'edit_projects'
  | 'edit_team_members'
  | 'manage_scenarios'
  | 'sync_jira'
  | 'manage_settings'
  | 'manage_users'
  | 'view_audit_log';

type PermissionMatrix = Record<AppRole, AppAction[]>;

const PERMISSIONS: PermissionMatrix = {
  system_admin: [
    'view_all',
    'edit_assignments',
    'edit_projects',
    'edit_team_members',
    'manage_scenarios',
    'sync_jira',
    'manage_settings',
    'manage_users',
    'view_audit_log',
  ],
  project_manager: [
    'view_all',
    'edit_assignments',
    'edit_projects',
    'edit_team_members',
    'manage_scenarios',
    'sync_jira',
  ],
  read_only: ['view_all'],
};

interface CurrentUserState {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
}

async function fetchUserRole(userId: string): Promise<AppRole> {
  let data: { role?: AppRole } | null = null;
  let error: { message?: string } | null = null;
  try {
    const res: { data: { role?: AppRole } | null; error: { message?: string } | null } = await withTimeout(
      (async () => supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle())(),
      5000,
      'Role lookup'
    );
    data = res.data;
    error = res.error;
  } catch (err) {
    console.error('[Auth] Role lookup timeout/failure:', err);
    return 'project_manager';
  }

  if (error) {
    console.error('[Auth] Role lookup RLS/query error:', error.message, error);
    return 'project_manager';
  }

  if (!data) {
    console.warn('[Auth] Role lookup returned no row for user', userId, '— RLS may be blocking the read');
    return 'project_manager';
  }

  const role = data.role as AppRole | undefined;
  console.info('[Auth] Role resolved:', role);
  return role ?? 'project_manager';
}

export function useCurrentUser(): CurrentUserState & { can: (action: AppAction) => boolean } {
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    // In local-only mode, grant admin access only during development.
    // In production a missing/misconfigured Supabase setup must deny access (fail closed).
    if (!isSupabaseConfigured()) {
      if (import.meta.env.DEV) {
        setState({ user: null, role: 'system_admin', loading: false });
      } else {
        setState({ user: null, role: null, loading: false });
      }
      return;
    }

    const hydrate = async () => {
      let data: Awaited<ReturnType<typeof supabase.auth.getSession>>['data'] | null = null;
      let error: Awaited<ReturnType<typeof supabase.auth.getSession>>['error'] | null = null;
      try {
        const res = await withTimeout(supabase.auth.getSession(), 8000, 'Auth session check');
        data = res.data;
        error = res.error;
      } catch (err) {
        console.warn('[Auth] Session check timeout/failure:', err);
      }
      if (error) {
        if (!cancelled) {
          setState({ user: null, role: null, loading: false });
        }
        return;
      }

      const sessionUser = data?.session?.user ?? null;
      if (!sessionUser) {
        if (!cancelled) {
          setState({ user: null, role: null, loading: false });
        }
        return;
      }

      if (!cancelled) {
        // Never block signed-in state on role lookup.
        setState({ user: sessionUser, role: 'project_manager', loading: false });
      }
      const role = await fetchUserRole(sessionUser.id);
      if (!cancelled) {
        setState({ user: sessionUser, role, loading: false });
      }
    };

    hydrate();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      if (!sessionUser) {
        if (!cancelled) {
          setState({ user: null, role: null, loading: false });
        }
        return;
      }

      // Set session immediately so UI can proceed.
      if (!cancelled) {
        setState({ user: sessionUser, role: 'project_manager', loading: false });
      }
      const role = await fetchUserRole(sessionUser.id);
      if (!cancelled) {
        setState({ user: sessionUser, role, loading: false });
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const can = useMemo(
    () => (action: AppAction): boolean => {
      if (!state.role) return false;
      return PERMISSIONS[state.role].includes(action);
    },
    [state.role]
  );

  return { ...state, can };
}

