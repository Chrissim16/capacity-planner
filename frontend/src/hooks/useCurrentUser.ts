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

async function fetchUserRole(_userId: string): Promise<AppRole | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_my_role')),
      5000,
      'Role lookup'
    );
    if (error) {
      console.error('[Auth] get_my_role RPC error:', (error as { message?: string }).message);
      return null;
    }
    // data is null only when the RPC itself returned NULL (should not happen given COALESCE in DB)
    if (data == null) return null;
    return data as AppRole;
  } catch (err) {
    console.error('[Auth] Role lookup timeout/failure:', err);
    return null;
  }
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
        if (!cancelled) setState({ user: null, role: null, loading: false });
        return;
      }

      const sessionUser = data?.session?.user ?? null;
      if (!sessionUser) {
        if (!cancelled) setState({ user: null, role: null, loading: false });
        return;
      }

      // Fetch role before releasing the loading state so the UI never renders
      // with the wrong permissions (avoids "Access restricted" flash for admins).
      // Retry once on transient failure before giving up.
      let role = await fetchUserRole(sessionUser.id);
      if (role == null) {
        await new Promise(r => setTimeout(r, 1000));
        role = await fetchUserRole(sessionUser.id);
      }
      if (!cancelled) setState({ user: sessionUser, role, loading: false });
    };

    hydrate();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sessionUser = session?.user ?? null;
      if (!sessionUser) {
        if (!cancelled) setState({ user: null, role: null, loading: false });
        return;
      }

      // Token refreshes never change the role — skip the RPC entirely.
      if (event === 'TOKEN_REFRESHED') {
        if (!cancelled) setState(prev => ({ ...prev, user: sessionUser }));
        return;
      }

      // For all other events (SIGNED_IN, INITIAL_SESSION, USER_UPDATED) re-fetch
      // the role so genuine role changes propagate. If the RPC fails transiently,
      // preserve the existing role rather than falling back to a hardcoded default.
      const role = await fetchUserRole(sessionUser.id);
      if (!cancelled) {
        if (role != null) {
          setState({ user: sessionUser, role, loading: false });
        } else {
          setState(prev => ({ ...prev, user: sessionUser }));
        }
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

