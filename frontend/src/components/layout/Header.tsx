import { 
  LayoutDashboard, 
  Calendar, 
  FolderKanban, 
  Users, 
  Settings,
  Moon,
  Sun,
  Undo2,
  Redo2,
  HelpCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore, useCurrentView, useIsWhatIfMode, useSettings } from '../../stores/appStore';
import type { ViewType } from '../../types';

const navItems: { view: ViewType; icon: typeof LayoutDashboard; label: string; shortcut: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', shortcut: '1' },
  { view: 'timeline', icon: Calendar, label: 'Timeline', shortcut: '2' },
  { view: 'projects', icon: FolderKanban, label: 'Projects', shortcut: '3' },
  { view: 'team', icon: Users, label: 'Team', shortcut: '4' },
  { view: 'settings', icon: Settings, label: 'Settings', shortcut: '5' },
];

export function Header() {
  const currentView = useCurrentView();
  const isWhatIfMode = useIsWhatIfMode();
  const settings = useSettings();
  const { setCurrentView, toggleDarkMode, enterWhatIfMode, exitWhatIfMode } = useAppStore();

  return (
    <>
      <header className="sticky top-0 z-50 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="h-full px-4 flex items-center justify-between">
          {/* Logo & Nav */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/25">
                MW
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  Mileway IT Capacity Planner
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Value Stream Finance
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map(({ view, icon: Icon, label, shortcut }) => (
                <button
                  key={view}
                  onClick={() => setCurrentView(view)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    currentView === view
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon size={16} />
                  {label}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">
                    {shortcut}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-700 pr-3">
              <button
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                title="Undo (Ctrl+Z)"
                disabled
              >
                <Undo2 size={16} />
              </button>
              <button
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                title="Redo (Ctrl+Y)"
                disabled
              >
                <Redo2 size={16} />
              </button>
            </div>

            {/* Sync Status */}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Saved
            </div>

            {/* What-If Mode */}
            <button
              onClick={() => isWhatIfMode ? exitWhatIfMode(false) : enterWhatIfMode()}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isWhatIfMode
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              )}
            >
              <HelpCircle size={16} />
              What-If
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              title="Toggle Dark Mode"
            >
              {settings.darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* What-If Banner */}
      {isWhatIfMode && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
              <HelpCircle size={20} />
              <span className="font-medium">What-If Mode Active</span>
              <span className="text-amber-600 dark:text-amber-400">— Changes are not saved</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exitWhatIfMode(true)}
                className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => exitWhatIfMode(false)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
