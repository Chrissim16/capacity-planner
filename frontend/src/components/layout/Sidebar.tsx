import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Settings,
  Users,
  WifiOff,
  Calendar,
  FolderKanban,
  LayoutDashboard,
  AlertCircle,
  LogOut,
  Layers,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScenarioSelector } from '../ScenarioSelector';
import { useAppStore, useSyncStatus } from '../../stores/appStore';
import type { ViewType } from '../../types';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { supabase, isSupabaseConfigured } from '../../services/supabase';

const VIEW_TO_PATH: Record<ViewType, string> = {
  dashboard: '/',
  timeline:  '/timeline',
  projects:  '/epics',
  jira:      '/epics',
  team:      '/team',
  scenarios: '/scenarios',
  planner:   '/planner',
  settings:  '/settings',
};

const PATH_TO_VIEW: Record<string, ViewType> = {
  '/':          'dashboard',
  '/timeline':  'timeline',
  '/epics':     'projects',
  '/team':      'team',
  '/scenarios': 'scenarios',
  '/planner':   'planner',
  '/settings':  'settings',
};

const navItems: { view: ViewType; icon: typeof LayoutDashboard; label: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Capacity' },
  { view: 'timeline',  icon: Calendar,        label: 'Timeline' },
  { view: 'projects',  icon: FolderKanban,    label: 'Epics' },
  { view: 'team',      icon: Users,           label: 'Team' },
  { view: 'planner',   icon: Layers,          label: 'Scenario Planner' },
  { view: 'settings',  icon: Settings,        label: 'Settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function SyncIndicator({ collapsed }: { collapsed: boolean }) {
  const { status, error } = useSyncStatus();
  const retrySyncToSupabase = useAppStore((s) => s.retrySyncToSupabase);

  if (status === 'offline') {
    return (
        <div className={clsx('flex items-center text-[#94A3B8]', collapsed ? 'justify-center' : 'gap-2')}>
        <WifiOff size={14} />
        {!collapsed && <span className="text-xs">Local only</span>}
      </div>
    );
  }

  if (status === 'saving') {
    return (
      <div className={clsx('flex items-center text-[#94A3B8]', collapsed ? 'justify-center' : 'gap-2')}>
        <Loader2 size={14} className="animate-spin" />
        {!collapsed && <span className="text-xs">Saving…</span>}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <button
        onClick={retrySyncToSupabase}
        title={error ?? 'Not saved. Click to retry'}
        className={clsx(
            'flex items-center text-[#DC2626] hover:text-[#B91C1C]',
          collapsed ? 'justify-center' : 'gap-2'
        )}
      >
        <AlertCircle size={14} />
        {!collapsed && <span className="text-xs">Retry save</span>}
      </button>
    );
  }

  return (
    <div className={clsx('flex items-center text-[#16A34A]', collapsed ? 'justify-center' : 'gap-2')}>
      <CheckCircle2 size={14} />
      {!collapsed && <span className="text-xs">Saved</span>}
    </div>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const location = useLocation();
  const currentView = PATH_TO_VIEW[location.pathname] ?? 'dashboard';
  const { user, role, can } = useCurrentUser();
  const visibleNavItems = navItems.filter(
    (item) => item.view !== 'settings' || can('manage_settings')
  );

  const initials = useMemo(() => {
    const source = user?.email ?? 'User';
    return source.slice(0, 2).toUpperCase();
  }, [user?.email]);

  return (
    <aside
      className={clsx(
        'h-screen bg-white border-r border-[#DEDFE3] flex flex-col transition-[width] duration-250 ease-in-out',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Logo area */}
      <div className={clsx('border-b border-[#DEDFE3]', collapsed ? 'p-3' : 'p-5')}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-md bg-[#E6F2FC] text-[#0089DD] font-bold text-xs flex items-center justify-center mx-auto">
            VS
          </div>
        ) : (
          <>
            <div className="text-lg font-semibold tracking-tight text-[#1E293B]">
              VS Finance
            </div>
            <div className="text-xs text-[#94A3B8] mt-0.5">Capacity Planner</div>
            <div className="mt-2 h-[2px] w-8 bg-[#0089DD] rounded-full" />
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3">
        {visibleNavItems.map(({ view, icon: Icon, label }) => (
          <Link
            key={view}
            to={VIEW_TO_PATH[view]}
            className={clsx(
              'w-full flex items-center transition-colors duration-150 border-l-[3px]',
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-2.5',
              currentView === view
                ? 'border-l-[#0089DD] bg-[#E6F2FC] text-[#0089DD]'
                : 'border-l-transparent text-[#94A3B8] hover:bg-[#F5F8FC] hover:text-[#1E293B]'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} />
            {!collapsed && <span className="text-sm font-medium">{label}</span>}
          </Link>
        ))}
      </nav>

      {/* Bottom area */}
      <div className="border-t border-[#DEDFE3] p-3 space-y-3">
        {!collapsed && (
          <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-widest px-1">
            Context
          </div>
        )}
        {!collapsed && <ScenarioSelector />}
        <SyncIndicator collapsed={collapsed} />

        {isSupabaseConfigured() && user && (
          <button
            onClick={() => void supabase.auth.signOut()}
            className={clsx(
              'w-full flex items-center text-[#94A3B8] hover:text-[#1E293B] hover:bg-[#F5F8FC] rounded-md transition-colors duration-150',
              collapsed ? 'justify-center h-8' : 'gap-2 px-2 py-1.5'
            )}
            title="Sign out"
          >
            <LogOut size={15} />
            {!collapsed && <span className="text-xs">Sign out</span>}
          </button>
        )}
      </div>

      {/* User profile + collapse toggle */}
      <div className={clsx('border-t border-[#DEDFE3]', collapsed ? 'p-2' : 'p-3')}>
        <div className={clsx('flex items-center', collapsed ? 'justify-center' : 'gap-2')}>
          <div className="w-8 h-8 rounded-full bg-[#E6F2FC] border border-[#CCE4F9] text-[#0089DD] text-xs font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#1E293B] truncate">{user?.email ?? 'Local mode'}</div>
              <div className="text-[11px] text-[#94A3B8] truncate">
                {role === 'system_admin'    ? 'System Administrator'
                  : role === 'project_manager' ? 'Project Manager'
                  : role === 'read_only'       ? 'Read Only'
                  : role ?? 'No role'}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapsed}
          className={clsx(
            'mt-2 w-full flex items-center justify-center rounded-md hover:bg-[#F5F8FC] text-[#94A3B8] hover:text-[#1E293B] transition-colors duration-150',
            collapsed ? 'h-7' : 'h-8'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
