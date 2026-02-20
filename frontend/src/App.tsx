import { useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Timeline } from './pages/Timeline';
import { Projects } from './pages/Projects';
import { Team } from './pages/Team';
import { Jira } from './pages/Jira';
import { Settings } from './pages/Settings';
import { ToastProvider } from './components/ui/Toast';
import { LoadingScreen } from './components/ui/LoadingScreen';
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
  const { setCurrentView, initializeFromSupabase } = useAppStore();

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        const views: ViewType[] = ['dashboard', 'timeline', 'projects', 'team', 'jira', 'settings'];
        const index = parseInt(e.key) - 1;
        if (views[index]) setCurrentView(views[index]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentView]);

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
    </ToastProvider>
  );
}

export default App;
