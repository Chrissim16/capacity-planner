/**
 * ScenarioDiffModal
 * Shows a structured diff between a scenario and the baseline, with an option
 * to promote the scenario's data back to the baseline.
 */

import { useMemo, useState } from 'react';
import { Plus, Minus, Pencil, UploadCloud, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../stores/appStore';
import { promoteScenarioToBaseline } from '../stores/actions';
import type { Scenario, Project, TeamMember } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Diff computation helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectChange {
  type: 'added' | 'removed' | 'modified';
  project: Project;
  baseProject?: Project;
  details: string[];
}

interface MemberChange {
  type: 'added' | 'removed' | 'modified';
  member: TeamMember;
  details: string[];
}

function computeProjectChanges(
  baseProjects: Project[],
  scenProjects: Project[],
): ProjectChange[] {
  const changes: ProjectChange[] = [];
  const baseById = new Map(baseProjects.map(p => [p.id, p]));
  const scenById = new Map(scenProjects.map(p => [p.id, p]));

  // Added
  for (const p of scenProjects) {
    if (!baseById.has(p.id)) {
      changes.push({ type: 'added', project: p, details: [`${p.phases.length} feature(s)`] });
    }
  }

  // Removed
  for (const p of baseProjects) {
    if (!scenById.has(p.id)) {
      changes.push({ type: 'removed', project: p, details: [] });
    }
  }

  // Modified
  for (const p of scenProjects) {
    const base = baseById.get(p.id);
    if (!base) continue;
    const details: string[] = [];

    if (p.name !== base.name)     details.push(`Name: "${base.name}" → "${p.name}"`);
    if (p.status !== base.status) details.push(`Status: ${base.status} → ${p.status}`);
    if (p.priority !== base.priority) details.push(`Priority: ${base.priority} → ${p.priority}`);

    const basePhaseIds = new Set(base.phases.map(ph => ph.id));
    const scenPhaseIds = new Set(p.phases.map(ph => ph.id));
    const phasesAdded   = p.phases.filter(ph => !basePhaseIds.has(ph.id));
    const phasesRemoved = base.phases.filter(ph => !scenPhaseIds.has(ph.id));

    if (phasesAdded.length)   details.push(`+${phasesAdded.length} feature(s): ${phasesAdded.map(ph => ph.name).join(', ')}`);
    if (phasesRemoved.length) details.push(`−${phasesRemoved.length} feature(s): ${phasesRemoved.map(ph => ph.name).join(', ')}`);

    if (details.length) {
      changes.push({ type: 'modified', project: p, baseProject: base, details });
    }
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
  const data = useAppStore(s => s.data);
  const [confirming, setConfirming] = useState(false);

  const { projectChanges, memberChanges, totalChanges } = useMemo(() => {
    const pc = computeProjectChanges(data.projects, scenario.projects);
    const mc = computeMemberChanges(data.teamMembers, scenario.teamMembers);
    return { projectChanges: pc, memberChanges: mc, totalChanges: pc.length + mc.length };
  }, [data.projects, data.teamMembers, scenario]);

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
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Changes in "{scenario.name}"
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {totalChanges === 0
                ? 'No changes from the baseline yet.'
                : `${totalChanges} change${totalChanges !== 1 ? 's' : ''} compared to the Jira Baseline`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {totalChanges === 0 && (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500">
              <p className="text-sm">Start editing epics or team members in this scenario to see changes here.</p>
            </div>
          )}

          {/* Projects */}
          {projectChanges.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
                Epics ({projectChanges.length})
              </h3>
              <div className="space-y-2">
                {projectChanges.map((change, i) => (
                  <DiffRow
                    key={i}
                    type={change.type}
                    label={change.project.name}
                    details={change.details}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Team Members */}
          {memberChanges.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">
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
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
          {/* Promote section */}
          {!confirming ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                <strong>Promote to baseline</strong> copies this scenario's epics and team members into your live data.
                The scenario is kept as an archive.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
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
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                This will overwrite the baseline with {totalChanges} change{totalChanges !== 1 ? 's' : ''}. Are you sure?
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setConfirming(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
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
    added:    { bg: 'bg-green-50 dark:bg-green-900/20',  border: 'border-green-200 dark:border-green-800', icon: <Plus  size={14} className="text-green-600 dark:text-green-400" />, text: 'text-green-800 dark:text-green-300' },
    removed:  { bg: 'bg-red-50 dark:bg-red-900/20',      border: 'border-red-200 dark:border-red-800',     icon: <Minus size={14} className="text-red-600 dark:text-red-400" />,   text: 'text-red-800 dark:text-red-300'   },
    modified: { bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-800', icon: <Pencil size={14} className="text-amber-600 dark:text-amber-400" />, text: 'text-amber-800 dark:text-amber-300' },
  }[type];

  return (
    <div className={clsx('flex items-start gap-3 px-3 py-2.5 rounded-lg border', config.bg, config.border)}>
      <span className="shrink-0 mt-0.5">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <span className={clsx('text-sm font-medium', config.text)}>{label}</span>
        {details.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {details.map((d, i) => (
              <li key={i} className="text-xs text-slate-500 dark:text-slate-400">{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
