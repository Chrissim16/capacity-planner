import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Database, Check, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../stores/appStore';
import { switchScenario } from '../stores/actions';
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
  const setCurrentView = useAppStore(s => s.setCurrentView);
  const { scenarios, activeScenarioId } = state;

  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
  const isBaseline     = !activeScenarioId;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const goToScenariosPage = () => {
    setIsOpen(false);
    setCurrentView('scenarios');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => { setIsOpen(!isOpen); }}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
          isBaseline
            ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
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

      {/* Dropdown — opens to the right of the sidebar to avoid being clipped */}
      {isOpen && (
        <div className="absolute bottom-0 left-full ml-2 w-72 max-h-[80vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">

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
              <div className="text-xs text-slate-500 dark:text-slate-400">Live data</div>
            </div>
            {isBaseline && <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />}
          </button>

          {scenarios.length > 0 && <div className="border-t border-slate-200 dark:border-slate-700 my-1" />}

          {/* Scenario list (switch only) */}
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => { switchScenario(scenario.id); setIsOpen(false); }}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50',
                activeScenarioId === scenario.id && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              <span className={clsx('w-3 h-3 rounded-full shrink-0', scenarioColorDot(scenario.color).dot)} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 dark:text-white truncate">{scenario.name}</div>
                {scenario.description && (
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{scenario.description}</div>
                )}
              </div>
              {activeScenarioId === scenario.id && <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />}
            </button>
          ))}

          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />

          {/* Link to Scenarios page */}
          <button
            onClick={goToScenariosPage}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <Plus size={16} />
            <span className="font-medium">New scenario</span>
            <ExternalLink size={12} className="ml-auto text-slate-400" />
          </button>
        </div>
      )}
    </div>
  );
}
