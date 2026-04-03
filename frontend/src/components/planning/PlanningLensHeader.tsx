import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import type { Scenario } from '../../types';
import { useAppStore, useSyncStatus } from '../../stores/appStore';
import { PlanScenarioSwitcher } from './PlanScenarioSwitcher';

interface PlanningLensHeaderProps {
  title: string;
  subtitle: string;
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onSwitch: (scenarioId: string | null) => void;
  onCreate: (name: string) => void;
  onDuplicate: (scenarioId: string | null, name: string) => void;
  onRename: (scenarioId: string, name: string) => void;
  onDelete: (scenarioId: string) => void;
  badges?: ReactNode;
  actions?: ReactNode;
  showSaveState?: boolean;
}

function PlanningLensSyncState() {
  const { status, error } = useSyncStatus();
  const retrySyncToSupabase = useAppStore((state) => state.retrySyncToSupabase);

  if (status === 'offline') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-[#DEDFE3] bg-white px-3 py-1 text-xs font-medium text-[#94A3B8]"
        title="Supabase not configured — data is currently stored locally only"
      >
        <WifiOff size={12} />
        Local only
      </span>
    );
  }

  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#1D4ED8]">
        <Loader2 size={12} className="animate-spin" />
        Saving
      </span>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={retrySyncToSupabase}
        className="inline-flex items-center gap-1 rounded-full border border-[#FECACA] bg-[#FEF2F2] px-3 py-1 text-xs font-medium text-[#DC2626] transition-colors hover:bg-[#FEE2E2]"
        title={error ?? 'Save failed — click to retry'}
      >
        <AlertCircle size={12} />
        Not saved
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1 text-xs font-medium text-[#15803D]">
      <CheckCircle2 size={12} />
      Saved
    </span>
  );
}

export function PlanningLensHeader({
  title,
  subtitle,
  scenarios,
  activeScenarioId,
  onSwitch,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
  badges,
  actions,
  showSaveState = true,
}: PlanningLensHeaderProps) {
  return (
    <div className="border-b border-[#DEDFE3] bg-white px-6 py-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight text-[#1E293B]">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#64748B]">{subtitle}</p>
          </div>

          {(badges || actions || showSaveState) ? (
            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[320px] xl:items-end">
              {(badges || showSaveState) ? (
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  {badges}
                  {showSaveState ? <PlanningLensSyncState /> : null}
                </div>
              ) : null}
              {actions ? (
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  {actions}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <PlanScenarioSwitcher
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onSwitch={onSwitch}
          onCreate={onCreate}
          onDuplicate={onDuplicate}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
