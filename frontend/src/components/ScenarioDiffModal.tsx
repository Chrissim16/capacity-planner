/**
 * ScenarioDiffModal
 * Shows a structured diff between a scenario and the baseline, with an option
 * to promote the scenario's data back to the baseline.
 */

import { useMemo, useState } from 'react';
import { Plus, Minus, Pencil, UploadCloud, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../stores/appStore';
import { promoteScenarioToBaseline } from '../stores/actions';
import type { Scenario, JiraWorkItem, TeamMember } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Diff computation helpers
// ─────────────────────────────────────────────────────────────────────────────

interface EpicChange {
  type: 'added' | 'removed' | 'modified';
  epic: JiraWorkItem;
  details: string[];
}

interface MemberChange {
  type: 'added' | 'removed' | 'modified';
  member: TeamMember;
  details: string[];
}

function computeEpicChanges(
  baseItems: JiraWorkItem[],
  scenItems: JiraWorkItem[],
): EpicChange[] {
  const changes: EpicChange[] = [];
  const baseEpics = baseItems.filter(w => w.type === 'epic');
  const scenEpics = scenItems.filter(w => w.type === 'epic');
  const baseById = new Map(baseEpics.map(e => [e.jiraKey, e]));
  const scenById = new Map(scenEpics.map(e => [e.jiraKey, e]));

  for (const e of scenEpics) {
    if (!baseById.has(e.jiraKey)) {
      changes.push({ type: 'added', epic: e, details: [`Status: ${e.status}`] });
    }
  }

  for (const e of baseEpics) {
    if (!scenById.has(e.jiraKey)) {
      changes.push({ type: 'removed', epic: e, details: [] });
    }
  }

  for (const e of scenEpics) {
    const base = baseById.get(e.jiraKey);
    if (!base) continue;
    const details: string[] = [];
    if (e.status !== base.status) details.push(`Status: ${base.status} → ${e.status}`);
    if (e.storyPoints !== base.storyPoints) details.push(`Story Points: ${base.storyPoints ?? '—'} → ${e.storyPoints ?? '—'}`);
    if (details.length) changes.push({ type: 'modified', epic: e, details });
  }

  return changes;
}

function computeMemberChanges(
  baseMembers: TeamMember[],
  scenMembers: TeamMember[],
): MemberChange[] {
  const changes: MemberChange[] = [];
  const baseById = new Map(baseMembers.map(m => [m.id, m]));
  const scenById = new Map(scenMembers.map(m => [m.id, m]));

  for (const m of scenMembers) {
    if (!baseById.has(m.id)) {
      changes.push({ type: 'added', member: m, details: [m.role || 'No role'] });
    }
  }

  for (const m of baseMembers) {
    if (!scenById.has(m.id)) {
      changes.push({ type: 'removed', member: m, details: [] });
    }
  }

  for (const m of scenMembers) {
    const base = baseById.get(m.id);
    if (!base) continue;
    const details: string[] = [];
    if (m.role !== base.role) details.push(`Role: ${base.role || '—'} → ${m.role || '—'}`);
    if (details.length) changes.push({ type: 'modified', member: m, details });
  }

  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ScenarioDiffModalProps {
  scenario: Scenario;
  onClose: () => void;
}

export function ScenarioDiffModal({ scenario, onClose }: ScenarioDiffModalProps) {
  const data = useAppStore(useShallow(s => s.data));
  const [confirming, setConfirming] = useState(false);

  const { epicChanges, memberChanges, totalChanges } = useMemo(() => {
    const ec = computeEpicChanges(data.jiraWorkItems, scenario.jiraWorkItems);
    const mc = computeMemberChanges(data.teamMembers, scenario.teamMembers);
    return { epicChanges: ec, memberChanges: mc, totalChanges: ec.length + mc.length };
  }, [data.jiraWorkItems, data.teamMembers, scenario]);

  const handlePromote = () => {
    promoteScenarioToBaseline(scenario.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DEDFE3] ">
          <div>
            <h2 className="text-lg font-semibold text-[#1E293B] ">
              Changes in "{scenario.name}"
            </h2>
            <p className="text-sm text-[#94A3B8] mt-0.5">
              {totalChanges === 0
                ? 'No changes from the baseline yet.'
                : `${totalChanges} change${totalChanges !== 1 ? 's' : ''} compared to the Jira Baseline`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#94A3B8] hover:text-[#94A3B8] hover:bg-[#F0F2F5] "
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {totalChanges === 0 && (
            <div className="text-center py-8 text-[#94A3B8]">
              <p className="text-sm">Start editing Jira items or team members in this scenario to see changes here.</p>
            </div>
          )}

          {/* Epics */}
          {epicChanges.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[#1E293B] uppercase tracking-wide mb-3">
                Epics ({epicChanges.length})
              </h3>
              <div className="space-y-2">
                {epicChanges.map((change, i) => (
                  <DiffRow
                    key={i}
                    type={change.type}
                    label={`${change.epic.jiraKey}: ${change.epic.summary}`}
                    details={change.details}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Team Members */}
          {memberChanges.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-[#1E293B] uppercase tracking-wide mb-3">
                Team Members ({memberChanges.length})
              </h3>
              <div className="space-y-2">
                {memberChanges.map((change, i) => (
                  <DiffRow
                    key={i}
                    type={change.type}
                    label={change.member.name}
                    details={change.details}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#DEDFE3] flex items-center justify-between gap-4">
          {!confirming ? (
            <>
              <p className="text-xs text-[#94A3B8] max-w-sm">
                <strong>Promote to baseline</strong> copies this scenario's Jira items and team members into your live data.
                The scenario is kept as an archive.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-[#94A3B8] hover:bg-[#F0F2F5] rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  disabled={totalChanges === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UploadCloud size={15} />
                  Promote to Baseline
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full gap-4">
              <p className="text-sm text-amber-700 font-medium">
                This will overwrite the baseline with {totalChanges} change{totalChanges !== 1 ? 's' : ''}. Are you sure?
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 text-sm text-[#94A3B8] hover:bg-[#F0F2F5] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePromote}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
                >
                  <UploadCloud size={15} />
                  Yes, Promote
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DiffRow — one change item
// ─────────────────────────────────────────────────────────────────────────────

function DiffRow({ type, label, details }: {
  type: 'added' | 'removed' | 'modified';
  label: string;
  details: string[];
}) {
  const config = {
    added: { bg: 'bg-green-50', border: 'border-green-200', icon: <Plus size={14} className="text-[#16A34A]" />, text: 'text-green-800' },
    removed: { bg: 'bg-red-50', border: 'border-red-200', icon: <Minus size={14} className="text-red-600" />, text: 'text-red-800' },
    modified: { bg: 'bg-amber-50', border: 'border-amber-200', icon: <Pencil size={14} className="text-amber-600" />, text: 'text-amber-800' },
  }[type];

  return (
    <div className={clsx('flex items-start gap-3 px-3 py-2.5 rounded-lg border', config.bg, config.border)}>
      <span className="shrink-0 mt-0.5">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <span className={clsx('text-sm font-medium', config.text)}>{label}</span>
        {details.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {details.map((d, i) => (
              <li key={i} className="text-xs text-[#94A3B8] ">{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
