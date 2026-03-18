import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Database, Check, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../stores/appStore';
import { switchScenario } from '../stores/actions';
import type { ScenarioColor } from '../types';

export function getSmartScenarioName(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Q${quarter} ${now.getFullYear()} – Plan A`;
}

export const SCENARIO_COLORS: { id: ScenarioColor; bg: string; ring: string; dot: string }[] = [
  { id: 'purple', bg: 'bg-[#F0F2F5]', ring: 'ring-[#DEDFE3]',  dot: 'bg-[#1E293B]' },
  { id: 'blue',   bg: 'bg-[#E6F2FC]', ring: 'ring-[#0089DD]', dot: 'bg-[#0089DD]' },
  { id: 'green',  bg: 'bg-[#DCFCE7]', ring: 'ring-[#16A34A]', dot: 'bg-[#16A34A]' },
  { id: 'orange', bg: 'bg-[#FEF3C7]', ring: 'ring-[#D97706]', dot: 'bg-[#D97706]' },
  { id: 'rose',   bg: 'bg-[#FEE2E2]', ring: 'ring-[#DC2626]', dot: 'bg-[#DC2626]' },
  { id: 'yellow', bg: 'bg-[#FEF9C3]', ring: 'ring-[#CA8A04]', dot: 'bg-[#CA8A04]' },
];

export function scenarioColorDot(color?: ScenarioColor) {
  return SCENARIO_COLORS.find(c => c.id === color) ?? SCENARIO_COLORS[0];
}

export function ScenarioSelector() {
  const state = useAppStore(useShallow((s) => s.data));
  const setCurrentView = useAppStore(s => s.setCurrentView);
  const { scenarios, activeScenarioId } = state;

  const [isOpen, setIsOpen] = useState(false);
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

  const goToScenariosPage = () => {
    setIsOpen(false);
    setCurrentView('scenarios');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); }}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 border',
          isBaseline
            ? 'border-[#DEDFE3] text-[#94A3B8] hover:bg-[#F5F8FC]'
            : 'border-[#CCE4F9] bg-[#E6F2FC] text-[#0089DD]'
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
        <ChevronDown size={14} className={clsx('transition-transform duration-150', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute bottom-0 left-full ml-2 w-72 max-h-[80vh] overflow-y-auto bg-white rounded-lg shadow-md border border-[#DEDFE3] py-2 z-50">

          <button
            onClick={() => { switchScenario(null); setIsOpen(false); }}
            className={clsx(
              'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F8FC] transition-colors duration-100',
              isBaseline && 'bg-[#E6F2FC]'
            )}
          >
            <Database size={16} className="text-[#0089DD] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[#1E293B]">Jira Baseline</div>
              <div className="text-xs text-[#94A3B8]">Live data</div>
            </div>
            {isBaseline && <Check size={16} className="text-[#0089DD] shrink-0" />}
          </button>

          {scenarios.length > 0 && <div className="border-t border-[#DEDFE3] my-1" />}

          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => { switchScenario(scenario.id); setIsOpen(false); }}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F8FC] transition-colors duration-100',
                activeScenarioId === scenario.id && 'bg-[#E6F2FC]'
              )}
            >
              <span className={clsx('w-3 h-3 rounded-full shrink-0', scenarioColorDot(scenario.color).dot)} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[#1E293B] truncate">{scenario.name}</div>
                {scenario.description && (
                  <div className="text-xs text-[#94A3B8] truncate">{scenario.description}</div>
                )}
              </div>
              {activeScenarioId === scenario.id && <Check size={16} className="text-[#0089DD] shrink-0" />}
            </button>
          ))}

          <div className="border-t border-[#DEDFE3] my-1" />

          <button
            onClick={goToScenariosPage}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[#0089DD] hover:bg-[#F5F8FC] transition-colors duration-100"
          >
            <Plus size={16} />
            <span className="font-medium">New scenario</span>
            <ExternalLink size={12} className="ml-auto text-[#94A3B8]" />
          </button>
        </div>
      )}
    </div>
  );
}
