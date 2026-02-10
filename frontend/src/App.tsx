import { useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Timeline } from './pages/Timeline';
import { Projects } from './pages/Projects';
import { Team } from './pages/Team';
import { Settings } from './pages/Settings';
import { ToastProvider } from './components/ui/Toast';
import { useAppStore, useCurrentView, useSettings } from './stores/appStore';
import type { ViewType } from './types';

// Page components map
const pages: Record<ViewType, React.ComponentType> = {
  dashboard: Dashboard,
  timeline: Timeline,
  projects: Projects,
  team: Team,
  settings: Settings,
};

function App() {
  const currentView = useCurrentView();
  const settings = useSettings();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  // Apply dark mode
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Number keys for navigation
      if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        const views: ViewType[] = ['dashboard', 'timeline', 'projects', 'team', 'settings'];
        const index = parseInt(e.key) - 1;
        if (views[index]) {
          setCurrentView(views[index]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCurrentView]);

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
