import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  GitBranch,
  Layers,
  Loader2,
  Moon,
  Settings,
  Sun,
  Users,
  WifiOff,
  Calendar,
  FolderKanban,
  LayoutDashboard,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScenarioSelector } from '../ScenarioSelector';
import { useAppStore, useSettings, useSyncStatus } from '../../stores/appStore';
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
  settings:  '/settings',
};

const PATH_TO_VIEW: Record<string, ViewType> = {
  '/':          'dashboard',
  '/timeline':  'timeline',
  '/epics':     'projects',
  '/team':      'team',
  '/scenarios': 'scenarios',
  '/settings':  'settings',
};

const navItems: { view: ViewType; icon: typeof LayoutDashboard; label: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Capacity' },
  { view: 'timeline', icon: Calendar, label: 'Timeline' },
  { view: 'projects', icon: FolderKanban, label: 'Epics' },
  { view: 'team', icon: Users, label: 'Team' },
  { view: 'scenarios', icon: Layers, label: 'Scenarios' },
  { view: 'settings', icon: Settings, label: 'Settings' },
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
      <div className={clsx('flex items-center text-white/60', collapsed ? 'justify-center' : 'gap-2')}>
        <WifiOff size={14} />
        {!collapsed && <span className="text-xs">Local only</span>}
      </div>
    );
  }

  if (status === 'saving') {
    return (
      <div className={clsx('flex items-center text-white/80', collapsed ? 'justify-center' : 'gap-2')}>
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
          'flex items-center text-rose-300 hover:text-rose-200',
          collapsed ? 'justify-center' : 'gap-2'
        )}
      >
        <AlertCircle size={14} />
        {!collapsed && <span className="text-xs">Retry save</span>}
      </button>
    );
  }

  return (
    <div className={clsx('flex items-center text-emerald-300', collapsed ? 'justify-center' : 'gap-2')}>
      <CheckCircle2 size={14} />
      {!collapsed && <span className="text-xs">Saved</span>}
    </div>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const location = useLocation();
  const currentView = PATH_TO_VIEW[location.pathname] ?? 'dashboard';
  const settings = useSettings();
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
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
        'h-screen bg-mw-dark text-white border-r border-white/10 flex flex-col transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      <div className={clsx('border-b border-white/10', collapsed ? 'p-3' : 'p-5')}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-md bg-mw-primary text-white font-bold text-xs flex items-center justify-center mx-auto">
            MW
          </div>
        ) : (
          <>
            <div className="text-lg font-bold tracking-tight">VS Finance</div>
            <div className="text-xs text-white/45">Capacity Planner</div>
            <div className="mt-2 h-[2px] w-8 bg-mw-primary rounded-full" />
          </>
        )}
      </div>

      <nav className="flex-1 py-3">
        {visibleNavItems.map(({ view, icon: Icon, label }) => (
          <Link
            key={view}
            to={VIEW_TO_PATH[view]}
            className={clsx(
              'w-full flex items-center transition-colors border-l-[3px]',
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-4 py-2.5',
              currentView === view
                ? 'border-l-mw-primary bg-mw-primary/10 text-white font-semibold'
                : 'border-l-transparent text-white/60 hover:text-white/90 hover:bg-white/5'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon size={16} />
            {!collapsed && <span className="text-sm">{label}</span>}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-3">
        {!collapsed && (
          <div className="text-xs text-white/40 uppercase tracking-widest px-1">Context</div>
        )}
        {!collapsed && <ScenarioSelector />}
        <SyncIndicator collapsed={collapsed} />
        <button
          onClick={toggleDarkMode}
          className={clsx(
            'w-full flex items-center text-white/70 hover:text-white hover:bg-white/5 rounded-md',
            collapsed ? 'justify-center h-8' : 'gap-2 px-2 py-1.5'
          )}
          title="Toggle dark mode"
        >
          {settings.darkMode ? <Sun size={15} /> : <Moon size={15} />}
          {!collapsed && <span className="text-xs">Theme</span>}
        </button>

        {isSupabaseConfigured() && user && (
          <button
            onClick={() => void supabase.auth.signOut()}
            className={clsx(
              'w-full flex items-center text-white/70 hover:text-white hover:bg-white/5 rounded-md',
              collapsed ? 'justify-center h-8' : 'gap-2 px-2 py-1.5'
            )}
            title="Sign out"
          >
            <GitBranch size={15} />
            {!collapsed && <span className="text-xs">Sign out</span>}
          </button>
        )}
      </div>

      <div className={clsx('border-t border-white/10', collapsed ? 'p-2' : 'p-3')}>
        <div className={clsx('flex items-center', collapsed ? 'justify-center' : 'gap-2')}>
          <div className="w-8 h-8 rounded-full bg-mw-primary/25 border border-mw-primary/40 text-mw-primary text-xs font-semibold flex items-center justify-center">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs text-white/85 truncate">{user?.email ?? 'Local mode'}</div>
              <div className="text-[11px] text-white/45 truncate">
                {role === 'system_admin' ? 'System Administrator'
                  : role === 'project_manager' ? 'Project Manager'
                  : role === 'read_only' ? 'Read Only'
                  : role ?? 'No role'}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapsed}
          className={clsx(
            'mt-2 w-full flex items-center justify-center rounded-md hover:bg-white/5 text-white/70 hover:text-white',
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

