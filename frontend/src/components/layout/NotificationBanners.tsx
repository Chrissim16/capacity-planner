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
    <div className="border-b border-[#F0EFED] bg-[#FAF9F7] px-6 py-2.5">
      {!activeScenario && isBaselineWithJira ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#92400E] text-sm">
            <ShieldAlert size={16} className="shrink-0" />
            <span>
              <strong>Jira Baseline</strong> — changes here may be overwritten by sync.
            </span>
          </div>
          <button
            onClick={() => createScenario(getSmartScenarioName())}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#F97316] hover:opacity-85 text-white text-xs font-semibold transition-opacity duration-150"
          >
            Create Scenario
          </button>
        </div>
      ) : activeScenario ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#1A1A1A] text-sm">
            <GitBranch size={16} className="shrink-0 text-[#0ED3CF]" />
            <span className="font-medium">{activeScenario.name}</span>
            <span className="text-[#9CA3AF]">· scenario mode</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshScenarioFromJira(activeScenario.id)}
              className="px-3 py-1 rounded-lg bg-[#E8F8F8] hover:bg-[#CCFBF1] text-[#0BB8B5] text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <button
              onClick={() => switchScenario(null)}
              className="px-3 py-1 rounded-lg bg-[#F5F3F0] hover:bg-[#E5E5E3] text-[#6B7280] hover:text-[#1A1A1A] text-xs font-semibold transition-colors duration-150"
            >
              Back to Baseline
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
