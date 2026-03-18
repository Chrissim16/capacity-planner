import { ShieldAlert, GitBranch, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, useIsBaselineWithJira } from '../../stores/appStore';
import { createScenario, refreshScenarioFromJira, switchScenario } from '../../stores/actions';
import { getSmartScenarioName } from '../ScenarioSelector';

export function NotificationBanners() {
  const data = useAppStore(useShallow((s) => s.data));
  const isBaselineWithJira = useIsBaselineWithJira();

  const activeScenario = useMemo(
    () => (data.activeScenarioId ? data.scenarios.find((s) => s.id === data.activeScenarioId) : null),
    [data.activeScenarioId, data.scenarios]
  );

  if (!activeScenario && !isBaselineWithJira) return null;

  return (
    <div className="border-b border-[#D97706] bg-[#FEF9C3] border-l-4 px-6 py-2.5">
      {!activeScenario && isBaselineWithJira ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#1E293B] text-sm">
            <ShieldAlert size={16} className="shrink-0 text-[#D97706]" />
            <span>
              <strong>Jira Baseline</strong> — changes here may be overwritten by sync.
            </span>
          </div>
          <button
            onClick={() => createScenario(getSmartScenarioName())}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0089DD] hover:opacity-90 text-white text-xs font-semibold transition-opacity duration-150"
          >
            Create Scenario
          </button>
        </div>
      ) : activeScenario ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#1E293B] text-sm">
            <GitBranch size={16} className="shrink-0 text-[#0089DD]" />
            <span className="font-medium">{activeScenario.name}</span>
            <span className="text-[#94A3B8]">· scenario mode</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshScenarioFromJira(activeScenario.id)}
              className="px-3 py-1 rounded-lg bg-[#E6F2FC] hover:bg-[#E6F2FC] text-[#0077C2] text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <button
              onClick={() => switchScenario(null)}
              className="px-3 py-1 rounded-lg bg-[#F0F2F5] hover:bg-[#DEDFE3] text-[#94A3B8] hover:text-[#1E293B] text-xs font-semibold transition-colors duration-150"
            >
              Back to Baseline
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
