import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Copy, Trash2, Database, Check, Pencil, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../stores/appStore';
import {
  createScenario, duplicateScenario, deleteScenario, switchScenario, updateScenario,
} from '../stores/actions';
import { ConfirmModal } from './ui/ConfirmModal';
import type { ScenarioColor } from '../types';

// Returns a context-aware default name: "Q1 2026 – Plan A"
export function getSmartScenarioName(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Q${quarter} ${now.getFullYear()} – Plan A`;
}

// Colour palette for scenario chips
export const SCENARIO_COLORS: { id: ScenarioColor; bg: string; ring: string; dot: string }[] = [
  { id: 'purple', bg: 'bg-purple-100 dark:bg-purple-900/40', ring: 'ring-purple-400',  dot: 'bg-purple-500' },
  { id: 'blue',   bg: 'bg-blue-100 dark:bg-blue-900/40',     ring: 'ring-blue-400',    dot: 'bg-blue-500'   },
  { id: 'green',  bg: 'bg-green-100 dark:bg-green-900/40',   ring: 'ring-green-400',   dot: 'bg-green-500'  },
  { id: 'orange', bg: 'bg-orange-100 dark:bg-orange-900/40', ring: 'ring-orange-400',  dot: 'bg-orange-500' },
  { id: 'rose',   bg: 'bg-rose-100 dark:bg-rose-900/40',     ring: 'ring-rose-400',    dot: 'bg-rose-500'   },
  { id: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/40', ring: 'ring-yellow-400',  dot: 'bg-yellow-500' },
];

export function scenarioColorDot(color?: ScenarioColor) {
  return SCENARIO_COLORS.find(c => c.id === color) ?? SCENARIO_COLORS[0];
}

export function ScenarioSelector() {
  const state = useAppStore((s) => s.data);
  const { scenarios, activeScenarioId } = state;

  const [isOpen, setIsOpen]               = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName]             = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor]           = useState<ScenarioColor>('purple');
  const [duplicateFrom, setDuplicateFrom] = useState<string | null>(null);

  // Inline rename state
  const [renamingId, setRenamingId]     = useState<string | null>(null);
  const [renameValue, setRenameValue]   = useState('');
  const renameInputRef                  = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const scenarioToDelete = scenarios.find(s => s.id === deleteConfirmId);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
  const isBaseline     = !activeScenarioId;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setRenamingId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus the rename input when it appears
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openCreate = (fromScenarioId?: string, fromName?: string, fromColor?: ScenarioColor) => {
    setDuplicateFrom(fromScenarioId ?? null);
    setNewName(fromName ? `${fromName} (Copy)` : getSmartScenarioName());
    setNewDescription('');
    setNewColor(fromColor ?? 'purple');
    setShowCreateModal(true);
  };

  const handleCreateScenario = () => {
    if (!newName.trim()) return;
    let created;
    if (duplicateFrom) {
      created = duplicateScenario(duplicateFrom, newName.trim());
    } else {
      created = createScenario(newName.trim(), newDescription.trim() || undefined);
    }
    // Apply chosen colour (default is purple so only update if different)
    if (created && newColor !== 'purple') {
      updateScenario(created.id, { color: newColor });
    }
    setNewName('');
    setNewDescription('');
    setNewColor('purple');
    setDuplicateFrom(null);
    setShowCreateModal(false);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, scenarioId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(scenarioId);
    setIsOpen(false);
  };

  const startRename = (e: React.MouseEvent, scenarioId: string, name: string) => {
    e.stopPropagation();
    setRenamingId(scenarioId);
    setRenameValue(name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      updateScenario(renamingId, { name: renameValue.trim() });
    }
    setRenamingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenamingId(null);
    e.stopPropagation();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => { setIsOpen(!isOpen); setRenamingId(null); }}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
          isBaseline
            ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            : 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
        )}
      >
        {isBaseline ? (
          <><Database size={16} /><span>Jira Baseline</span></>
        ) : (
          <>
            <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', scenarioColorDot(activeScenario?.color).dot)} />
            <span className="max-w-[150px] truncate">{activeScenario?.name}</span>
          </>
        )}
        <ChevronDown size={14} className={clsx('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">

          {/* Baseline */}
          <button
            onClick={() => { switchScenario(null); setIsOpen(false); }}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50',
              isBaseline && 'bg-blue-50 dark:bg-blue-900/20'
            )}
          >
            <Database size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 dark:text-white">Jira Baseline</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Live data — editing here may be overwritten on next sync</div>
            </div>
            {isBaseline && <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />}
          </button>

          <div className="border-t border-slate-200 dark:border-slate-700 my-2" />

          {/* Empty state */}
          {scenarios.length === 0 && (
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No scenarios yet.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Create one below to safely explore "what-if" plans without touching your live data.
              </p>
            </div>
          )}

          {/* Scenario list */}
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              onClick={() => {
                if (renamingId === scenario.id) return;
                switchScenario(scenario.id);
                setIsOpen(false);
              }}
              className={clsx(
                'group flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50',
                activeScenarioId === scenario.id && 'bg-purple-50 dark:bg-purple-900/20'
              )}
            >
              <span className={clsx('w-3 h-3 rounded-full shrink-0 mt-0.5', scenarioColorDot(scenario.color).dot)} />

              <div className="flex-1 min-w-0">
                {/* Inline rename input */}
                {renamingId === scenario.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={handleRenameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-sm font-medium bg-white dark:bg-slate-700 border border-blue-400 rounded px-1.5 py-0.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <div className="font-medium text-slate-900 dark:text-white truncate">{scenario.name}</div>
                )}
                {scenario.description && (
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{scenario.description}</div>
                )}
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  {scenario.updatedAt !== scenario.createdAt
                    ? `Updated ${new Date(scenario.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `Created ${new Date(scenario.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </div>
              </div>

              {/* Action icons — visible on hover or while renaming this row */}
              <div className={clsx(
                'flex items-center gap-1 transition-opacity',
                renamingId === scenario.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}>
                {renamingId === scenario.id ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenamingId(null); }}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                    title="Cancel rename"
                  >
                    <X size={13} className="text-slate-500" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={(e) => startRename(e, scenario.id, scenario.name)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                      title="Rename"
                    >
                      <Pencil size={13} className="text-slate-500" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openCreate(scenario.id, scenario.name, scenario.color); }}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                      title="Duplicate"
                    >
                      <Copy size={13} className="text-slate-500" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, scenario.id)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                      title="Delete"
                    >
                      <Trash2 size={13} className="text-red-500" />
                    </button>
                  </>
                )}
              </div>

              {activeScenarioId === scenario.id && renamingId !== scenario.id && (
                <Check size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
              )}
            </div>
          ))}

          <div className="border-t border-slate-200 dark:border-slate-700 my-2" />

          {/* Create new */}
          <button
            onClick={() => openCreate()}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <Plus size={16} />
            <span className="font-medium">New Scenario</span>
          </button>
        </div>
      )}

      {/* Create / Duplicate modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              {duplicateFrom ? 'Duplicate Scenario' : 'New Scenario'}
            </h3>

            {/* Explanation */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {duplicateFrom
                ? 'Creates an independent copy. Changes to either scenario won\'t affect the other.'
                : 'A scenario is a safe copy of your current data. Edit freely to explore different plans — your Jira baseline is never affected.'
              }
            </p>

            {/* Color picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Colour</label>
              <div className="flex items-center gap-2">
                {SCENARIO_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNewColor(c.id)}
                    className={clsx(
                      'w-7 h-7 rounded-full transition-all',
                      c.dot,
                      newColor === c.id ? `ring-2 ring-offset-2 ${c.ring}` : 'opacity-60 hover:opacity-100'
                    )}
                    title={c.id}
                  />
                ))}
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Scenario name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Q1 2026 – Plan A"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateScenario()}
            />

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g. Exploring a reduced team size for Q1 planning"
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-5"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setDuplicateFrom(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateScenario}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {duplicateFrom ? 'Duplicate' : 'Create Scenario'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) deleteScenario(deleteConfirmId);
        }}
        title="Delete scenario?"
        message={`"${scenarioToDelete?.name ?? 'This scenario'}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
