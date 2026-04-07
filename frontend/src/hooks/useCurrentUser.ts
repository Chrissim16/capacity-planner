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
type AccountAccessIssue = 'missing_role' | 'invalid_role' | 'role_lookup_failed';

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

const VALID_ROLES: AppRole[] = ['system_admin', 'project_manager', 'read_only'];

interface CurrentUserState {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  accessIssue: AccountAccessIssue | null;
}

function getInitialCurrentUserState(): CurrentUserState {
  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) {
      return { user: null, role: 'system_admin', loading: false, accessIssue: null };
    }
    return { user: null, role: null, loading: false, accessIssue: null };
  }

  return { user: null, role: null, loading: true, accessIssue: null };
}

async function fetchUserRole(userId: string): Promise<{
  role: AppRole | null;
  accessIssue: AccountAccessIssue | null;
}> {
  try {
    const roleResponse = await withTimeout(
      Promise.resolve(
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle()
      ),
      5000,
      'Role lookup'
    );
    const { data: roleRow, error: roleError } = roleResponse;

    if (!roleError) {
      const rawRole = roleRow?.role;
      if (rawRole == null) {
        return { role: null, accessIssue: 'missing_role' };
      }
      if (!VALID_ROLES.includes(rawRole as AppRole)) {
        console.error('[Auth] Invalid role value:', rawRole);
        return { role: null, accessIssue: 'invalid_role' };
      }
      return { role: rawRole as AppRole, accessIssue: null };
    }

    console.error('[Auth] Direct role lookup error:', roleError.message);

    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_my_role')),
      5000,
      'Role lookup fallback'
    );
    if (error) {
      console.error('[Auth] get_my_role RPC error:', (error as { message?: string }).message);
      return { role: null, accessIssue: 'role_lookup_failed' };
    }
    if (data == null) {
      return { role: null, accessIssue: 'missing_role' };
    }
    if (!VALID_ROLES.includes(data as AppRole)) {
      console.error('[Auth] Invalid role value from RPC:', data);
      return { role: null, accessIssue: 'invalid_role' };
    }
    return { role: data as AppRole, accessIssue: null };
  } catch (err) {
    console.error('[Auth] Role lookup timeout/failure:', err);
    return { role: null, accessIssue: 'role_lookup_failed' };
  }
}

export function useCurrentUser(): CurrentUserState & { can: (action: AppAction) => boolean } {
  const [state, setState] = useState<CurrentUserState>(getInitialCurrentUserState);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured()) {
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
        if (!cancelled) setState({ user: null, role: null, loading: false, accessIssue: null });
        return;
      }

      const sessionUser = data?.session?.user ?? null;
      if (!sessionUser) {
        if (!cancelled) setState({ user: null, role: null, loading: false, accessIssue: null });
        return;
      }

      // Fetch role before releasing the loading state so the UI never renders
      // with the wrong permissions (avoids "Access restricted" flash for admins).
      // Retry once on transient lookup failures before giving up.
      let roleResult = await fetchUserRole(sessionUser.id);
      if (roleResult.accessIssue === 'role_lookup_failed') {
        await new Promise(r => setTimeout(r, 1000));
        roleResult = await fetchUserRole(sessionUser.id);
      }
      if (!cancelled) {
        setState({
          user: sessionUser,
          role: roleResult.role,
          loading: false,
          accessIssue: roleResult.accessIssue,
        });
      }
    };

    hydrate();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sessionUser = session?.user ?? null;
      if (!sessionUser) {
        if (!cancelled) setState({ user: null, role: null, loading: false, accessIssue: null });
        return;
      }

      // Token refreshes never change the role — skip the RPC entirely.
      if (event === 'TOKEN_REFRESHED') {
        if (!cancelled) setState(prev => ({ ...prev, user: sessionUser }));
        return;
      }

      // For all other events (SIGNED_IN, INITIAL_SESSION, USER_UPDATED) re-fetch
      // the role so genuine role changes propagate.
      const roleResult = await fetchUserRole(sessionUser.id);
      if (!cancelled) {
        setState({
          user: sessionUser,
          role: roleResult.role,
          loading: false,
          accessIssue: roleResult.accessIssue,
        });
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
