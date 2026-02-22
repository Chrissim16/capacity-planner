import { useState, useMemo } from 'react';
import {
  Plus, Database, GitBranch, Layers, Check, Copy, Trash2, Pencil,
  Users, FolderKanban, CalendarOff, Link2, Info, ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ScenarioDiffModal } from '../components/ScenarioDiffModal';
import { useAppStore, useCurrentState as useCurrentStateForCreate } from '../stores/appStore';
import {
  createScenario, duplicateScenario, deleteScenario, switchScenario, updateScenario,
} from '../stores/actions';
import { SCENARIO_COLORS, scenarioColorDot } from '../components/ScenarioSelector';
import type { Scenario, ScenarioColor } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function scenarioStats(scenario: Scenario) {
  const projects = scenario.projects.length;
  const members = scenario.teamMembers.length;
  const timeOff = scenario.timeOff.length;
  const assignments = scenario.projects.reduce(
    (sum, p) => sum + p.phases.reduce((ps, ph) => ps + ph.assignments.length, 0),
    0
  );
  return { projects, members, timeOff, assignments };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE / DUPLICATE MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface CreateModalProps {
  duplicateFrom: Scenario | null;
  onClose: () => void;
}

function CreateModal({ duplicateFrom, onClose }: CreateModalProps) {
  const state = useCurrentStateForCreate();
  const data = useAppStore(s => s.data);
  const [name, setName] = useState(
    duplicateFrom ? `${duplicateFrom.name} (Copy)` : `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()} – Plan A`
  );
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<ScenarioColor>(duplicateFrom?.color ?? 'purple');

  // "What will be copied" stats from current state (or source scenario)
  const source = duplicateFrom ?? null;
  const stats = source
    ? scenarioStats(source)
    : {
        projects: state.projects.length,
        members: state.teamMembers.length,
        timeOff: state.timeOff.length,
        assignments: state.projects.reduce(
          (sum, p) => sum + p.phases.reduce((ps, ph) => ps + ph.assignments.length, 0),
          0
        ),
      };

  const handleCreate = () => {
    if (!name.trim()) return;
    let created: Scenario | null = null;
    if (duplicateFrom) {
      created = duplicateScenario(duplicateFrom.id, name.trim());
      if (created) updateScenario(created.id, { description: description.trim() || undefined, color });
    } else {
      created = createScenario(name.trim(), description.trim() || undefined);
      if (created && color !== 'purple') updateScenario(created.id, { color });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          {duplicateFrom ? 'Duplicate Scenario' : 'New Scenario'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {duplicateFrom
            ? 'Creates an independent copy. Changes to either scenario won\'t affect the other.'
            : 'A scenario is a safe copy of your current data. Edit freely without affecting your Jira baseline.'}
        </p>

        {/* What will be copied */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <div className="flex items-center gap-1.5 font-medium text-blue-800 dark:text-blue-200 mb-2">
            <Info size={14} />
            <span>This scenario will include a snapshot of:</span>
          </div>
          <ul className="space-y-1 text-blue-700 dark:text-blue-300 text-xs">
            <li className="flex items-center gap-2">
              <Check size={12} className="text-blue-500 shrink-0" />
              <FolderKanban size={12} className="shrink-0" />
              <span><strong>{stats.projects}</strong> epic{stats.projects !== 1 ? 's' : ''} (with features &amp; {stats.assignments} assignment{stats.assignments !== 1 ? 's' : ''})</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={12} className="text-blue-500 shrink-0" />
              <Users size={12} className="shrink-0" />
              <span><strong>{stats.members}</strong> team member{stats.members !== 1 ? 's' : ''}</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={12} className="text-blue-500 shrink-0" />
              <CalendarOff size={12} className="shrink-0" />
              <span><strong>{stats.timeOff}</strong> time-off entr{stats.timeOff !== 1 ? 'ies' : 'y'}</span>
            </li>
            <li className="flex items-center gap-2">
              <Check size={12} className="text-blue-500 shrink-0" />
              <Link2 size={12} className="shrink-0" />
              <span><strong>{source ? source.jiraWorkItems.length : data.jiraWorkItems.length}</strong> Jira work items</span>
            </li>
          </ul>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 border-t border-blue-200 dark:border-blue-700 pt-2">
            Settings, Public Holidays and Sprints are shared across all scenarios.
          </p>
        </div>

        {/* Color */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Colour</label>
          <div className="flex items-center gap-2">
            {SCENARIO_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                className={clsx('w-7 h-7 rounded-full transition-all', c.dot, color === c.id ? `ring-2 ring-offset-2 ${c.ring}` : 'opacity-60 hover:opacity-100')}
                title={c.id}
              />
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q1 2026 – Plan A"
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Exploring a reduced team size for Q1 planning"
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-5"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {duplicateFrom ? 'Duplicate' : 'Create Scenario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function Scenarios() {
  const data = useAppStore(s => s.data);
  const setCurrentView = useAppStore(s => s.setCurrentView);
  const { scenarios, activeScenarioId } = data;

  const [showCreate, setShowCreate] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<Scenario | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Scenario | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [diffScenario, setDiffScenario] = useState<Scenario | null>(null);

  // Baseline stats
  const baselineStats = useMemo(() => ({
    projects: data.projects.length,
    members: data.teamMembers.length,
    timeOff: data.timeOff.length,
    lastSync: data.jiraConnections.reduce<string | undefined>((latest, c) => {
      if (!c.lastSyncAt) return latest;
      return !latest || c.lastSyncAt > latest ? c.lastSyncAt : latest;
    }, undefined),
  }), [data]);

  const handleSwitch = (id: string | null) => {
    switchScenario(id);
    setCurrentView('dashboard');
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) updateScenario(renamingId, { name: renameValue.trim() });
    setRenamingId(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={24} className="text-purple-600" />
            Scenarios
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Create what-if plans without affecting your Jira baseline.
          </p>
        </div>
        <Button onClick={() => { setDuplicateSource(null); setShowCreate(true); }}>
          <Plus size={16} className="mr-1" />
          New Scenario
        </Button>
      </div>

      {/* What is isolated info box */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <span>
          Each scenario independently snapshots <strong className="text-slate-800 dark:text-slate-200">Epics, Features, Assignments, Team Members and Time Off</strong>.
          &nbsp;Settings, Public Holidays and Sprints are shared across all scenarios.
        </span>
      </div>

      {/* Baseline card */}
      <Card className={clsx('border-2 transition-colors', !activeScenarioId ? 'border-blue-400 dark:border-blue-600' : 'border-slate-200 dark:border-slate-700')}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Database size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Jira Baseline</CardTitle>
                  <Badge variant="primary">Read-only source</Badge>
                  {!activeScenarioId && <Badge variant="success">Active</Badge>}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Live data — changes here may be overwritten on next Jira sync.
                  {baselineStats.lastSync && ` Last synced ${new Date(baselineStats.lastSync).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeScenarioId && (
                <Button variant="secondary" size="sm" onClick={() => handleSwitch(null)}>
                  <Check size={14} className="mr-1" />
                  Switch to Baseline
                </Button>
              )}
              <Button size="sm" onClick={() => { setDuplicateSource(null); setShowCreate(true); }}>
                <GitBranch size={14} className="mr-1" />
                Create Scenario
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <FolderKanban size={14} className="text-slate-400" />
              <strong className="text-slate-800 dark:text-slate-200">{baselineStats.projects}</strong> epics
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-slate-400" />
              <strong className="text-slate-800 dark:text-slate-200">{baselineStats.members}</strong> members
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarOff size={14} className="text-slate-400" />
              <strong className="text-slate-800 dark:text-slate-200">{baselineStats.timeOff}</strong> time-off entries
            </span>
          </div>
          {!activeScenarioId && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <Info size={13} className="shrink-0" />
              <span>You are editing the baseline. Create a scenario to safely explore changes without risk.</span>
              <button
                onClick={() => { setDuplicateSource(null); setShowCreate(true); }}
                className="ml-1 font-medium underline decoration-dotted hover:no-underline"
              >
                Create one now
                <ArrowRight size={11} className="inline ml-0.5" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty state */}
      {scenarios.length === 0 && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <Layers size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No scenarios yet</p>
          <p className="text-sm mt-1">
            Create a scenario to safely plan "what-if" changes without affecting your Jira baseline.
          </p>
          <Button className="mt-4" onClick={() => { setDuplicateSource(null); setShowCreate(true); }}>
            <Plus size={16} className="mr-1" />
            Create your first scenario
          </Button>
        </div>
      )}

      {/* Scenario cards */}
      {scenarios.map((scenario) => {
        const stats = scenarioStats(scenario);
        const colorSet = scenarioColorDot(scenario.color);
        const isActive = activeScenarioId === scenario.id;

        return (
          <Card
            key={scenario.id}
            className={clsx('border-2 transition-colors', isActive ? 'border-purple-400 dark:border-purple-600' : 'border-slate-200 dark:border-slate-700')}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', colorSet.bg)}>
                    <GitBranch size={20} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renamingId === scenario.id ? (
                        <input
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                          className="text-base font-semibold bg-white dark:bg-slate-700 border border-blue-400 rounded px-1.5 py-0.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <h3 className="font-semibold text-slate-900 dark:text-white">{scenario.name}</h3>
                      )}
                      {isActive && <Badge variant="success">Active</Badge>}
                    </div>
                    {scenario.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{scenario.description}</p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {scenario.updatedAt !== scenario.createdAt
                        ? `Updated ${new Date(scenario.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : `Created ${new Date(scenario.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!isActive && (
                    <Button variant="primary" size="sm" onClick={() => handleSwitch(scenario.id)}>
                      <Check size={14} className="mr-1" />
                      Switch
                    </Button>
                  )}
                  {isActive && (
                    <Button variant="secondary" size="sm" onClick={() => handleSwitch(null)}>
                      Back to Baseline
                    </Button>
                  )}
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => setDiffScenario(scenario)}
                    title="Compare with baseline"
                  >
                    Compare
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setRenamingId(scenario.id); setRenameValue(scenario.name); }}
                    title="Rename"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setDuplicateSource(scenario); setShowCreate(true); }}
                    title="Duplicate"
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteConfirm(scenario)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <FolderKanban size={14} className="text-slate-400" />
                  <strong className="text-slate-800 dark:text-slate-200">{stats.projects}</strong> epics
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  <strong className="text-slate-800 dark:text-slate-200">{stats.members}</strong> members
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarOff size={14} className="text-slate-400" />
                  <strong className="text-slate-800 dark:text-slate-200">{stats.timeOff}</strong> time-off entries
                </span>
                <span className="flex items-center gap-1.5">
                  <strong className="text-slate-800 dark:text-slate-200">{stats.assignments}</strong> assignments
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Create / Duplicate modal */}
      {showCreate && (
        <CreateModal
          duplicateFrom={duplicateSource}
          onClose={() => { setShowCreate(false); setDuplicateSource(null); }}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) deleteScenario(deleteConfirm.id); }}
        title="Delete scenario?"
        message={`"${deleteConfirm?.name ?? 'This scenario'}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Diff modal */}
      {diffScenario && (
        <ScenarioDiffModal scenario={diffScenario} onClose={() => setDiffScenario(null)} />
      )}
    </div>
  );
}
