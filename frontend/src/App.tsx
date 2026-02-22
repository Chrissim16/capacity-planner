import { useEffect, useState } from 'react';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Timeline } from './pages/Timeline';
import { Projects } from './pages/Projects';
import { Team } from './pages/Team';
import { Jira } from './pages/Jira';
import { Settings } from './pages/Settings';
import { ToastProvider } from './components/ui/Toast';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal';
import { useAppStore, useCurrentView, useSettings, useIsInitializing, useSyncStatus } from './stores/appStore';
import type { ViewType } from './types';

// Page components map
const pages: Record<ViewType, React.ComponentType> = {
  dashboard: Dashboard,
  timeline: Timeline,
  projects: Projects,
  team: Team,
  jira: Jira,
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

  // US-001 / US-002: Load data from Supabase on first mount
  useEffect(() => {
    initializeFromSupabase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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

      // Number keys 1-6: navigate views (existing)
      if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping) {
        const views: ViewType[] = ['dashboard', 'timeline', 'projects', 'team', 'jira', 'settings'];
        const index = parseInt(e.key) - 1;
        if (views[index]) setCurrentView(views[index]);
      }

      // ? — show keyboard shortcuts modal
      if (e.key === '?' && !isTyping) {
        setShowShortcuts(prev => !prev);
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
    </ToastProvider>
  );
}

export default App;
