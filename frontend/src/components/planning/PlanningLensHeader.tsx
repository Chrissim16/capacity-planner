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
  context?: ReactNode;
  controls?: ReactNode;
  primaryAction?: ReactNode;
  showSaveState?: boolean;
}

function PlanningLensSyncState() {
  const { status, error } = useSyncStatus();
  const retrySyncToSupabase = useAppStore((state) => state.retrySyncToSupabase);

  if (status === 'offline') {
    return (
      <span
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DEDFE3] bg-white px-2.5 text-xs font-medium text-[#94A3B8]"
        title="Supabase not configured — data is currently stored locally only"
      >
        <WifiOff size={13} />
        Local only
      </span>
    );
  }

  if (status === 'saving') {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-xs font-medium text-[#1D4ED8]">
        <Loader2 size={13} className="animate-spin" />
        Saving
      </span>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={retrySyncToSupabase}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 text-xs font-medium text-[#DC2626] transition-colors hover:bg-[#FEE2E2]"
        title={error ?? 'Save failed — click to retry'}
      >
        <AlertCircle size={13} />
        Not saved
      </button>
    );
  }

  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 text-xs font-medium text-[#15803D]">
      <CheckCircle2 size={13} />
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
  context,
  controls,
  primaryAction,
  showSaveState = true,
}: PlanningLensHeaderProps) {
  return (
    <div className="relative z-[320] border-b border-[#DEDFE3] bg-white px-6 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Planning Lens</div>
          <h1 className="mt-1.5 text-xl font-bold leading-tight text-[#1E293B]">{title}</h1>
          {subtitle.trim() ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#64748B]">{subtitle}</p>
          ) : null}
          {context ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-[#94A3B8]">
              {context}
            </div>
          ) : null}
        </div>

        <div className="flex w-full flex-wrap items-center gap-1.5 xl:w-auto xl:flex-nowrap xl:justify-end">
          {showSaveState ? <PlanningLensSyncState /> : null}
          <PlanScenarioSwitcher
            scenarios={scenarios}
            activeScenarioId={activeScenarioId}
            onSwitch={onSwitch}
            onCreate={onCreate}
            onDuplicate={onDuplicate}
            onRename={onRename}
            onDelete={onDelete}
          />
          {controls}
          {primaryAction}
        </div>
      </div>
    </div>
  );
}
