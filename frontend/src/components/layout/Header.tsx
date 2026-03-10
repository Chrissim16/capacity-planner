import {
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
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, useSyncStatus, useIsBaselineWithJira } from '../../stores/appStore';
import { ScenarioSelector, getSmartScenarioName } from '../ScenarioSelector';
import { switchScenario, refreshScenarioFromJira, createScenario } from '../../stores/actions';

function useScenarioDiff(scenarioId: string | null) {
  const data = useAppStore(useShallow(s => s.data));

  return useMemo(() => {
    if (!scenarioId) return null;
    const scenario = data.scenarios.find(s => s.id === scenarioId);
    if (!scenario) return null;

    const baseEpicKeys  = new Set(data.jiraWorkItems.filter(w => w.type === 'epic').map(w => w.jiraKey));
    const scenEpicKeys  = new Set((scenario.jiraWorkItems ?? []).filter(w => w.type === 'epic').map(w => w.jiraKey));
    const baseMemberIds = new Set(data.teamMembers.map(m => m.id));
    const scenMemberIds = new Set(scenario.teamMembers.map(m => m.id));

    const epicsAdded    = (scenario.jiraWorkItems ?? []).filter(w => w.type === 'epic' && !baseEpicKeys.has(w.jiraKey)).length;
    const epicsRemoved  = data.jiraWorkItems.filter(w => w.type === 'epic' && !scenEpicKeys.has(w.jiraKey)).length;
    const membersAdded  = scenario.teamMembers.filter(m => !baseMemberIds.has(m.id)).length;
    const membersRemoved = data.teamMembers.filter(m => !scenMemberIds.has(m.id)).length;

    const total = epicsAdded + epicsRemoved + membersAdded + membersRemoved;
    return { total, epicsAdded, epicsRemoved, membersAdded, membersRemoved };
  }, [scenarioId, data.scenarios, data.jiraWorkItems, data.teamMembers]);
}

function SyncIndicator() {
  const { status, error } = useSyncStatus();
  const retrySyncToSupabase = useAppStore((s) => s.retrySyncToSupabase);

  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]" title="Supabase not configured — data saved to browser only">
        <WifiOff size={13} />
        <span>Local only</span>
      </div>
    );
  }

  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#0ED3CF]">
        <Loader2 size={13} className="animate-spin" />
        <span>Saving…</span>
      </div>
    );
  }

  if (status === 'error') {
    const shortError = error ? error.split(';')[0].trim() : null;
    return (
      <div className="flex flex-col items-end gap-0.5">
        <button
          onClick={retrySyncToSupabase}
          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
          title={error ?? 'Save failed — click to retry'}
        >
          <AlertCircle size={13} />
          <span>Not saved — Retry</span>
        </button>
        {shortError && (
          <span className="text-xs text-red-400 max-w-[220px] truncate leading-tight" title={error ?? ''}>
            {shortError}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-[#22C55E]">
      <CheckCircle2 size={13} />
      <span>Saved</span>
    </div>
  );
}

function RefreshFromJiraButton({ scenarioId, scenarioName: _scenarioName }: { scenarioId: string; scenarioName: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const jiraWorkItems = useAppStore(useShallow(s => s.data.jiraWorkItems));
  const scenarios = useAppStore(useShallow(s => s.data.scenarios));

  const scenario = scenarios.find(s => s.id === scenarioId);
  const baselineItemIds = new Set(jiraWorkItems.map(i => i.jiraId));
  const scenarioItemIds = new Set((scenario?.jiraWorkItems || []).map(i => i.jiraId));

  const toAdd    = jiraWorkItems.filter(i => !scenarioItemIds.has(i.jiraId)).length;
  const toRemove = (scenario?.jiraWorkItems || []).filter(i => !baselineItemIds.has(i.jiraId)).length;
  const toUpdate = jiraWorkItems.filter(i => scenarioItemIds.has(i.jiraId)).length;
  const hasChanges = toAdd > 0 || toRemove > 0;

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E8F8F8] border border-[#99F6E4] rounded-lg text-sm">
        <span className="text-[#1A1A1A] text-xs">
          {hasChanges
            ? `${toAdd} new · ${toUpdate} updated · ${toRemove} removed — apply?`
            : `${toUpdate} items will be updated — apply?`}
        </span>
        <button
          onClick={() => { refreshScenarioFromJira(scenarioId); setShowConfirm(false); }}
          className="px-2 py-0.5 bg-[#1A1A1A] hover:opacity-80 text-white text-xs rounded-md"
        >
          Yes
        </button>
        <button onClick={() => setShowConfirm(false)} className="text-[#9CA3AF] hover:text-[#6B7280] text-xs">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-2 px-3 py-1.5 bg-[#E8F8F8] text-[#0BB8B5] text-sm font-medium rounded-lg hover:bg-[#CCFBF1] transition-colors duration-150"
    >
      <RefreshCw size={14} />
      Refresh from Jira
    </button>
  );
}

export function Header() {
  const activeScenarioId = useAppStore((s) => s.data.activeScenarioId);
  const scenarios = useAppStore(useShallow((s) => s.data.scenarios));
  const isBaselineWithJira = useIsBaselineWithJira();

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
      {/* Jira baseline warning */}
      {!isViewingScenario && isBaselineWithJira && (
        <div className="bg-[#FFF7ED] border-b border-[#FED7AA] px-6 py-2.5">
          {!showBannerCreate ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#92400E] text-sm">
                <ShieldAlert size={16} className="shrink-0" />
                <span>
                  <strong>Jira Baseline</strong> — Changes here will be overwritten on the next Jira sync.
                </span>
              </div>
              <button
                onClick={openBannerCreate}
                className="ml-4 shrink-0 px-3 py-1.5 bg-[#F97316] hover:opacity-85 text-white text-xs font-medium rounded-lg transition-opacity duration-150"
              >
                Create Scenario to Edit Safely
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ShieldAlert size={16} className="text-[#F97316] shrink-0" />
              <span className="text-sm text-[#92400E] font-medium shrink-0">Name your scenario:</span>
              <input
                autoFocus
                type="text"
                value={bannerScenarioName}
                onChange={(e) => setBannerScenarioName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmBannerCreate();
                  if (e.key === 'Escape') setShowBannerCreate(false);
                }}
                className="flex-1 max-w-xs px-2.5 py-1 text-sm border border-[#FED7AA] rounded-lg bg-white text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
              <button
                onClick={confirmBannerCreate}
                disabled={!bannerScenarioName.trim()}
                className="shrink-0 px-3 py-1.5 bg-[#F97316] hover:opacity-85 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
              >
                Create
              </button>
              <button
                onClick={() => setShowBannerCreate(false)}
                className="shrink-0 text-[#92400E] text-xs hover:underline"
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

      {/* Scenario active banner */}
      {isViewingScenario && activeScenario && (
        <div className="bg-[#E8F8F8] border-b border-[#99F6E4] px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[#0BB8B5] flex-wrap">
              <GitBranch size={18} className="shrink-0" />
              <span className="font-medium text-[#1A1A1A]">{activeScenario.name}</span>

              {scenarioDiff !== null && (
                scenarioDiff.total === 0 ? (
                  <button
                    onClick={() => setShowDiff(true)}
                    className="text-xs px-2 py-0.5 bg-[#CCFBF1] text-[#0BB8B5] rounded-full hover:bg-[#99F6E4] transition-colors"
                  >
                    No changes yet
                  </button>
                ) : (
                  <button
                    onClick={() => setShowDiff(true)}
                    className="text-xs px-2 py-0.5 bg-[#0ED3CF]/15 text-[#0BB8B5] rounded-full font-medium hover:bg-[#0ED3CF]/25 transition-colors"
                    title="Click to view full diff and promote to baseline"
                  >
                    {scenarioDiff.total} change{scenarioDiff.total !== 1 ? 's' : ''} · View →
                  </button>
                )
              )}

              <span className="text-[#9CA3AF] text-sm hidden sm:inline">
                · edits here don't affect the baseline
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <RefreshFromJiraButton scenarioId={activeScenarioId!} scenarioName={activeScenario.name} />
              <button
                onClick={() => switchScenario(null)}
                className={clsx(
                  'px-3 py-1.5 bg-[#F5F3F0] text-[#6B7280] text-sm font-medium rounded-lg',
                  'hover:bg-[#E5E5E3] hover:text-[#1A1A1A] transition-colors duration-150'
                )}
              >
                Back to Baseline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top sync bar — shown only when there's something to display */}
      <div className="border-b border-[#F0EFED] bg-[#FAF9F7] px-6 py-2 flex items-center justify-end gap-4">
        <SyncIndicator />
        <ScenarioSelector />
      </div>
    </>
  );
}
