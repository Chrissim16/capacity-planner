import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Timeline } from './pages/Timeline';
import { Projects } from './pages/Projects';
import { Team } from './pages/Team';
import { Scenarios } from './pages/Scenarios';
import { Settings } from './pages/Settings';
import { ToastProvider } from './components/ui/Toast';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal';
import { CommandPalette } from './components/ui/CommandPalette';
import type { CommandPayload } from './components/ui/CommandPalette';
import { useAppStore, useCurrentView, useSettings, useIsInitializing, useSyncStatus } from './stores/appStore';
import type { ViewType } from './types';
import { Login } from './pages/Login';
import { useCurrentUser } from './hooks/useCurrentUser';
import { isSupabaseConfigured } from './services/supabase';

// Page components map
const pages: Record<ViewType, React.ComponentType> = {
  dashboard: Dashboard,
  timeline: Timeline,
  projects: Projects,
  team: Team,
  jira: Projects,
  scenarios: Scenarios,
  settings: Settings,
};

function App() {
  const currentView = useCurrentView();
  const settings = useSettings();
  const isInitializing = useIsInitializing();
  const { status: syncStatus } = useSyncStatus();
  // Use targeted selectors (not the full store) so App only re-renders when
  // these specific stable action references are first read — not on every
  // state change. React 19's useSyncExternalStore is strict about this.
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const initializeFromSupabase = useAppStore((s) => s.initializeFromSupabase);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { user, loading: authLoading } = useCurrentUser();

  // US-001 / US-002: Load data from Supabase on first mount
  useEffect(() => {
    if (isSupabaseConfigured() && !user) return;
    initializeFromSupabase();
  }, [initializeFromSupabase, user]);

  // Apply dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [settings.darkMode]);

  // US-003: Warn before closing the tab when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (syncStatus === 'saving') {
        e.preventDefault();
        // Modern browsers show a generic message; this text may not display but is required
        e.returnValue = 'Your changes are still being saved. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncStatus]);

  // US-020: Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Number keys 1-6: navigate views
      if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping) {
        const views: ViewType[] = ['dashboard', 'timeline', 'projects', 'team', 'scenarios', 'settings'];
        const index = parseInt(e.key) - 1;
        if (views[index]) setCurrentView(views[index]);
      }

      // ? — show keyboard shortcuts modal
      if (e.key === '?' && !isTyping) {
        setShowShortcuts(prev => !prev);
      }

      // Ctrl+K / Cmd+K — command palette
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }

      // N — trigger "new" action for current view
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !isTyping) {
        const newItemEvent = new CustomEvent('keyboard:new', { detail: { view: currentView } });
        window.dispatchEvent(newItemEvent);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentView, currentView]);

  // Wait only for auth check first.
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Enforce authentication when Supabase is enabled.
  if (isSupabaseConfigured() && !user) {
    return <Login />;
  }

  // US-002: Show full-screen loading screen while fetching from Supabase
  if (isInitializing) {
    return <LoadingScreen />;
  }

  const CurrentPage = pages[currentView] || Dashboard;

  return (
    <ToastProvider>
      <Layout>
        <CurrentPage />
      </Layout>
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(view: ViewType, payload?: CommandPayload) => {
          setCurrentView(view);
          if (payload?.highlightId) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('search:highlight', { detail: { id: payload.highlightId, view } }));
            }, 100);
          }
        }}
      />
    </ToastProvider>
  );
}

export default App;
