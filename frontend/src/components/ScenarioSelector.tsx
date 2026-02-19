import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Copy, Trash2, Database, GitBranch, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../stores/appStore';
import { createScenario, duplicateScenario, deleteScenario, switchScenario } from '../stores/actions';

export function ScenarioSelector() {
  const state = useAppStore((s) => s.data);
  const { scenarios, activeScenarioId } = state;
  
  const [isOpen, setIsOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [duplicateFrom, setDuplicateFrom] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
  const isBaseline = !activeScenarioId;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateScenario = () => {
    if (!newName.trim()) return;
    if (duplicateFrom) {
      duplicateScenario(duplicateFrom, newName.trim());
    } else {
      createScenario(newName.trim());
    }
    setNewName('');
    setDuplicateFrom(null);
    setShowNewModal(false);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, scenarioId: string) => {
    e.stopPropagation();
    if (confirm('Delete this scenario? This cannot be undone.')) {
      deleteScenario(scenarioId);
    }
  };

  const handleDuplicate = (e: React.MouseEvent, scenarioId: string, name: string) => {
    e.stopPropagation();
    setDuplicateFrom(scenarioId);
    setNewName(`${name} (Copy)`);
    setShowNewModal(true);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
          isBaseline
            ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            : 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
        )}
      >
        {isBaseline ? (
          <>
            <Database size={16} />
            <span>Jira Baseline</span>
          </>
        ) : (
          <>
            <GitBranch size={16} />
            <span className="max-w-[150px] truncate">{activeScenario?.name}</span>
          </>
        )}
        <ChevronDown size={14} className={clsx('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
          {/* Baseline Option */}
          <button
            onClick={() => { switchScenario(null); setIsOpen(false); }}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50',
              isBaseline && 'bg-blue-50 dark:bg-blue-900/20'
            )}
          >
            <Database size={16} className="text-blue-600 dark:text-blue-400" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 dark:text-white">Jira Baseline</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Live data from Jira</div>
            </div>
            {isBaseline && <Check size={16} className="text-blue-600 dark:text-blue-400" />}
          </button>

          {/* Divider */}
          {scenarios.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 my-2" />
          )}

          {/* Scenarios */}
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              onClick={() => { switchScenario(scenario.id); setIsOpen(false); }}
              className={clsx(
                'group flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50',
                activeScenarioId === scenario.id && 'bg-purple-50 dark:bg-purple-900/20'
              )}
            >
              <GitBranch size={16} className="text-purple-600 dark:text-purple-400" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 dark:text-white truncate">{scenario.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {scenario.basedOnSyncAt 
                    ? `Based on sync: ${new Date(scenario.basedOnSyncAt).toLocaleDateString()}`
                    : `Created: ${new Date(scenario.createdAt).toLocaleDateString()}`
                  }
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleDuplicate(e, scenario.id, scenario.name)}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                  title="Duplicate"
                >
                  <Copy size={14} className="text-slate-500" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, scenario.id)}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                  title="Delete"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
              </div>
              {activeScenarioId === scenario.id && (
                <Check size={16} className="text-purple-600 dark:text-purple-400" />
              )}
            </div>
          ))}

          {/* Divider */}
          <div className="border-t border-slate-200 dark:border-slate-700 my-2" />

          {/* Create New */}
          <button
            onClick={() => { setDuplicateFrom(null); setNewName(''); setShowNewModal(true); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <Plus size={16} />
            <span className="font-medium">Create New Scenario</span>
          </button>
        </div>
      )}

      {/* New Scenario Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {duplicateFrom ? 'Duplicate Scenario' : 'Create New Scenario'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {duplicateFrom 
                ? 'Create a copy of the selected scenario with a new name.'
                : 'Create a snapshot of the current Jira baseline for what-if planning.'
              }
            </p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Scenario name (e.g., Q3 Plan A)"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateScenario()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowNewModal(false); setDuplicateFrom(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateScenario}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {duplicateFrom ? 'Duplicate' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
