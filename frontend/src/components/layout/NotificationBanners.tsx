import { ShieldAlert, GitBranch, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useAppStore, useIsBaselineWithJira } from '../../stores/appStore';
import { createScenario, refreshScenarioFromJira, switchScenario } from '../../stores/actions';
import { getSmartScenarioName } from '../ScenarioSelector';

export function NotificationBanners() {
  const data = useAppStore((s) => s.data);
  const isBaselineWithJira = useIsBaselineWithJira();

  const activeScenario = useMemo(
    () => (data.activeScenarioId ? data.scenarios.find((s) => s.id === data.activeScenarioId) : null),
    [data.activeScenarioId, data.scenarios]
  );

  if (!activeScenario && !isBaselineWithJira) return null;

  return (
    <div className="border-b border-mw-grey-light bg-white dark:bg-[#132133] px-6 py-2.5">
      {!activeScenario && isBaselineWithJira ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm">
            <ShieldAlert size={16} className="shrink-0" />
            <span>
              <strong>Jira Baseline</strong> — changes here may be overwritten by sync.
            </span>
          </div>
          <button
            onClick={() => createScenario(getSmartScenarioName())}
            className="shrink-0 px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
          >
            Create Scenario
          </button>
        </div>
      ) : activeScenario ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
            <GitBranch size={16} className="shrink-0" />
            <span className="font-medium">{activeScenario.name}</span>
            <span className="text-blue-500 dark:text-blue-400">· scenario mode</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshScenarioFromJira(activeScenario.id)}
              className="px-3 py-1 rounded-md bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <button
              onClick={() => switchScenario(null)}
              className="px-3 py-1 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold"
            >
              Back to Baseline
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

