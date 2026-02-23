import {
  LayoutDashboard,
  Calendar,
  FolderKanban,
  Users,
  Settings,
  Layers,
  Moon,
  Sun,
  GitBranch,
  RefreshCw,
  Loader2,
  CheckCircle2,
  WifiOff,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { ScenarioDiffModal } from '../ScenarioDiffModal';
import { clsx } from 'clsx';
import { useAppStore, useCurrentView, useSettings, useSyncStatus, useIsBaselineWithJira } from '../../stores/appStore';
import type { ViewType } from '../../types';
import { ScenarioSelector, getSmartScenarioName } from '../ScenarioSelector';
import { switchScenario, refreshScenarioFromJira, createScenario } from '../../stores/actions';

/**
 * Counts structural differences between a scenario and the baseline:
 * projects added/removed/renamed, phases added/removed, team members added/removed.
 * Returns { total, breakdown } for display.
 */
function useScenarioDiff(scenarioId: string | null) {
  const data = useAppStore(s => s.data);

  return useMemo(() => {
    if (!scenarioId) return null;
    const scenario = data.scenarios.find(s => s.id === scenarioId);
    if (!scenario) return null;

    const baseProjectIds  = new Set(data.projects.map(p => p.id));
    const scenProjectIds  = new Set(scenario.projects.map(p => p.id));
    const baseMemberIds   = new Set(data.teamMembers.map(m => m.id));
    const scenMemberIds   = new Set(scenario.teamMembers.map(m => m.id));

    const projectsAdded   = scenario.projects.filter(p => !baseProjectIds.has(p.id)).length;
    const projectsRemoved = data.projects.filter(p => !scenProjectIds.has(p.id)).length;
    const projectsEdited  = scenario.projects.filter(p => {
      const base = data.projects.find(b => b.id === p.id);
      if (!base) return false;
      // Consider a project changed if name, status, or phase count differs
      return p.name !== base.name || p.status !== base.status || p.phases.length !== base.phases.length;
    }).length;

    const membersAdded    = scenario.teamMembers.filter(m => !baseMemberIds.has(m.id)).length;
    const membersRemoved  = data.teamMembers.filter(m => !scenMemberIds.has(m.id)).length;

    const total = projectsAdded + projectsRemoved + projectsEdited + membersAdded + membersRemoved;
    return { total, projectsAdded, projectsRemoved, projectsEdited, membersAdded, membersRemoved };
  }, [scenarioId, data.scenarios, data.projects, data.teamMembers]);
}

const navItems: { view: ViewType; icon: typeof LayoutDashboard; label: string; shortcut: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', shortcut: '1' },
  { view: 'timeline', icon: Calendar, label: 'Timeline', shortcut: '2' },
  { view: 'projects', icon: FolderKanban, label: 'Epics', shortcut: '3' },
  { view: 'team', icon: Users, label: 'Team', shortcut: '4' },
  { view: 'scenarios', icon: Layers, label: 'Scenarios', shortcut: '5' },
  { view: 'settings', icon: Settings, label: 'Settings', shortcut: '6' },
];

function SyncIndicator() {
  const { status, error } = useSyncStatus();
  const retrySyncToSupabase = useAppStore((s) => s.retrySyncToSupabase);

  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500" title="Supabase not configured — data saved to browser only">
        <WifiOff size={13} />
        <span>Local only</span>
      </div>
    );
  }

  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400">
        <Loader2 size={13} className="animate-spin" />
        <span>Saving…</span>
      </div>
    );
  }

  if (status === 'error') {
    // Show first table:error segment so the user knows which table failed
    const shortError = error ? error.split(';')[0].trim() : null;
    return (
      <div className="flex flex-col items-end gap-0.5">
        <button
          onClick={retrySyncToSupabase}
          className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          title={error ?? 'Save failed — click to retry'}
        >
          <AlertCircle size={13} />
          <span>Not saved — Retry</span>
        </button>
        {shortError && (
          <span className="text-xs text-red-400 dark:text-red-500 max-w-[220px] truncate leading-tight" title={error ?? ''}>
            {shortError}
          </span>
        )}
      </div>
    );
  }

  if (status === 'saved') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 size={13} />
        <span>Saved</span>
      </div>
    );
  }

  // idle
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
      <CheckCircle2 size={13} />
      <span>Saved</span>
    </div>
  );
}

/**
 * US-012: Shows a quick change summary before refreshing a scenario from Jira.
 * Counts new/updated/removed items and asks for confirmation.
 */
function RefreshFromJiraButton({ scenarioId, scenarioName: _scenarioName }: { scenarioId: string; scenarioName: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const jiraWorkItems = useAppStore(s => s.data.jiraWorkItems);
  const scenarios = useAppStore(s => s.data.scenarios);

  const scenario = scenarios.find(s => s.id === scenarioId);
  const baselineItemIds = new Set(jiraWorkItems.map(i => i.jiraId));
  const scenarioItemIds = new Set((scenario?.jiraWorkItems || []).map(i => i.jiraId));

  const toAdd = jiraWorkItems.filter(i => !scenarioItemIds.has(i.jiraId)).length;
  const toRemove = (scenario?.jiraWorkItems || []).filter(i => !baselineItemIds.has(i.jiraId)).length;
  const toUpdate = jiraWorkItems.filter(i => scenarioItemIds.has(i.jiraId)).length;
  const hasChanges = toAdd > 0 || toRemove > 0;

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <span className="text-blue-700 dark:text-blue-300 text-xs">
          {hasChanges
            ? `${toAdd} new · ${toUpdate} updated · ${toRemove} removed — apply?`
            : `${toUpdate} items will be updated — apply?`}
        </span>
        <button
          onClick={() => { refreshScenarioFromJira(scenarioId); setShowConfirm(false); }}
          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
        >
          Yes
        </button>
        <button onClick={() => setShowConfirm(false)} className="text-slate-500 hover:text-slate-700 text-xs">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700"
    >
      <RefreshCw size={14} />
      Refresh from Jira
    </button>
  );
}

export function Header() {
  const currentView = useCurrentView();
  const settings = useSettings();
  const activeScenarioId = useAppStore((s) => s.data.activeScenarioId);
  const scenarios = useAppStore((s) => s.data.scenarios);
  const isBaselineWithJira = useIsBaselineWithJira();
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  // Inline create-scenario prompt triggered from the amber banner
  const [showBannerCreate, setShowBannerCreate] = useState(false);
  const [bannerScenarioName, setBannerScenarioName] = useState('');

  const openBannerCreate = () => {
    setBannerScenarioName(getSmartScenarioName());
    setShowBannerCreate(true);
  };

  const confirmBannerCreate = () => {
    if (!bannerScenarioName.trim()) return;
    createScenario(bannerScenarioName.trim());
    setShowBannerCreate(false);
  };

  const activeScenario    = scenarios.find((s) => s.id === activeScenarioId);
  const isViewingScenario = !!activeScenarioId;
  const scenarioDiff      = useScenarioDiff(activeScenarioId ?? null);
  const [showDiff, setShowDiff] = useState(false);

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
              {navItems.map(({ view, icon: Icon, label }) => (
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
                </button>
              ))}
            </nav>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            <SyncIndicator />
            <ScenarioSelector />
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              title="Toggle Dark Mode"
            >
              {settings.darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Baseline warning banner */}
      {!isViewingScenario && isBaselineWithJira && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
          {!showBannerCreate ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
                <ShieldAlert size={16} className="shrink-0" />
                <span>
                  <strong>Jira Baseline</strong> — Changes you make here will be overwritten on the next Jira sync.
                </span>
              </div>
              <button
                onClick={openBannerCreate}
                className="ml-4 shrink-0 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg"
              >
                Create Scenario to Edit Safely
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ShieldAlert size={16} className="text-amber-600 shrink-0" />
              <span className="text-sm text-amber-800 dark:text-amber-200 font-medium shrink-0">Name your scenario:</span>
              <input
                autoFocus
                type="text"
                value={bannerScenarioName}
                onChange={(e) => setBannerScenarioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmBannerCreate();
                  if (e.key === 'Escape') setShowBannerCreate(false);
                }}
                className="flex-1 max-w-xs px-2.5 py-1 text-sm border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={confirmBannerCreate}
                disabled={!bannerScenarioName.trim()}
                className="shrink-0 px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
              >
                Create
              </button>
              <button
                onClick={() => setShowBannerCreate(false)}
                className="shrink-0 text-amber-700 dark:text-amber-300 text-xs hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scenario diff modal */}
      {showDiff && activeScenario && (
        <ScenarioDiffModal scenario={activeScenario} onClose={() => setShowDiff(false)} />
      )}

      {/* Scenario Banner */}
      {isViewingScenario && activeScenario && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-blue-800 dark:text-blue-200 flex-wrap">
              <GitBranch size={18} className="shrink-0" />
              <span className="font-medium">{activeScenario.name}</span>

              {/* Changes-from-baseline badge — clickable to open diff modal */}
              {scenarioDiff !== null && (
                scenarioDiff.total === 0 ? (
                  <button
                    onClick={() => setShowDiff(true)}
                    className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-700/60 transition-colors"
                  >
                    No changes yet
                  </button>
                ) : (
                  <button
                    onClick={() => setShowDiff(true)}
                    className="text-xs px-2 py-0.5 bg-blue-200 dark:bg-blue-700/60 text-blue-800 dark:text-blue-200 rounded-full font-medium hover:bg-blue-300 dark:hover:bg-blue-600/60 transition-colors"
                    title="Click to view full diff and promote to baseline"
                  >
                    {scenarioDiff.total} change{scenarioDiff.total !== 1 ? 's' : ''} · View →
                  </button>
                )
              )}

              <span className="text-blue-500 dark:text-blue-400 text-sm hidden sm:inline">
                · edits here don't affect the baseline
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <RefreshFromJiraButton scenarioId={activeScenarioId!} scenarioName={activeScenario.name} />
              <button
                onClick={() => switchScenario(null)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
              >
                Back to Baseline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
