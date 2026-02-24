import type { ReactNode } from 'react';
import { useCurrentUser, type AppAction } from '../../hooks/useCurrentUser';

interface PermissionGateProps {
  action: AppAction;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ action, fallback = null, children }: PermissionGateProps) {
  const { can, loading } = useCurrentUser();

  if (loading) return null;
  if (!can(action)) return <>{fallback}</>;
  return <>{children}</>;
}

