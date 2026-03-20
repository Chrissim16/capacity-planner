/**
 * ScenarioTabs — Toolbar left-side scenario controls.
 *
 * Renders:
 *   [⚡ Scenario mode chip] [Active scenario ▾] [+ new] [| divider |]
 *
 * The tab strip is replaced by a single active-scenario pill that opens a
 * dropdown to switch between scenarios. The creation modal is kept intact.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, ChevronDown, Check } from 'lucide-react';
import type { Scenario } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

const MAX_SCENARIOS = 5;

export interface ScenarioTabsProps {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onSelect: (id: string) => void;
  /** Parent creates the scenario and updates the store; tabs are a controlled component. */
  onCreate: (name: string, startMode: 'clone' | 'blank') => void;
}

type StartMode = 'clone' | 'blank';

export function ScenarioTabs({ scenarios, activeScenarioId, onSelect, onCreate }: ScenarioTabsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeScenario = scenarios.find(s => s.id === activeScenarioId);
  const activeCount = scenarios.filter(s => !s.archived).length;
  const atLimit = activeCount >= MAX_SCENARIOS;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [dropdownOpen]);

  const openCreateModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  return (
    <>
      {/* ── Active scenario pill + dropdown ────────────────────────── */}
      <div className="relative flex-shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-label={`Active scenario: ${activeScenario?.name ?? 'none'}. Click to switch.`}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
            'bg-mileway-blue-10 text-mileway-blue hover:bg-mileway-blue/15',
          ].join(' ')}
        >
          <span className="max-w-[160px] truncate">
            {activeScenario?.name ?? 'No scenario'}
          </span>
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={`transition-transform duration-fast flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {dropdownOpen && (
          <div
            className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-mileway-border z-50 py-1"
            role="listbox"
            aria-label="Switch scenario"
          >
            {scenarios.map(scenario => (
              <button
                key={scenario.id}
                role="option"
                aria-selected={scenario.id === activeScenarioId}
                onClick={() => { onSelect(scenario.id); setDropdownOpen(false); }}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-fast',
                  scenario.id === activeScenarioId
                    ? 'text-mileway-blue bg-mileway-blue-10'
                    : 'text-mileway-text hover:bg-mileway-bg',
                ].join(' ')}
              >
                <span className="flex-1 truncate">{scenario.name}</span>
                {scenario.id === activeScenarioId && (
                  <Check size={13} className="flex-shrink-0" aria-hidden="true" />
                )}
              </button>
            ))}
            {scenarios.length === 0 && (
              <p className="px-3 py-2 text-xs text-mileway-grey italic">No scenarios yet</p>
            )}
          </div>
        )}
      </div>

      {/* ── New scenario button ─────────────────────────────────────── */}
      <button
        onClick={atLimit ? undefined : openCreateModal}
        disabled={atLimit}
        aria-label={atLimit ? 'Maximum 5 scenarios' : 'New scenario'}
        title={
          atLimit
            ? 'Maximum 5 active scenarios. Archive or delete one to create a new scenario.'
            : 'New scenario'
        }
        className="flex items-center justify-center w-7 h-7 rounded-lg text-mileway-grey hover:bg-mileway-bg transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
      >
        <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
      </button>

      {/* ── Toolbar divider ─────────────────────────────────────────── */}
      <div className="h-6 w-px bg-mileway-border flex-shrink-0" aria-hidden="true" />

      <ScenarioCreateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={onCreate}
      />
    </>
  );
}

// ── ScenarioCreateModal (shared with ScenarioPlanner home screen) ─────────────

export interface ScenarioCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, startMode: 'clone' | 'blank') => void;
}

export function ScenarioCreateModal({ isOpen, onClose, onCreate }: ScenarioCreateModalProps) {
  const [name, setName] = useState('');
  const [startMode, setStartMode] = useState<StartMode>('clone');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setStartMode('clone');
      const id = requestAnimationFrame(() => nameInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen]);

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, startMode);
    onClose();
  }, [name, startMode, onCreate, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Scenario"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="scenario-name-modal" className="block text-xs font-medium text-mileway-grey mb-1.5">
            Scenario name
          </label>
          <input
            ref={nameInputRef}
            id="scenario-name-modal"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && name.trim()) handleCreate();
            }}
            placeholder="e.g. Q2 Optimistic"
            maxLength={60}
            className="w-full border border-mileway-border rounded-lg px-3 py-2.5 text-sm text-mileway-text placeholder:text-mileway-grey focus:outline-none focus:border-mileway-blue transition-colors duration-fast"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-mileway-grey mb-2">Starting point</p>
          <div className="space-y-2" role="radiogroup" aria-label="Starting point">
            <RadioCard
              id="clone"
              selected={startMode === 'clone'}
              onSelect={() => setStartMode('clone')}
              title="Clone current plan"
              description="Pre-places all active Jira items on the timeline using their current Jira sprint and date positions. In-progress items are locked."
            />
            <RadioCard
              id="blank"
              selected={startMode === 'blank'}
              onSelect={() => setStartMode('blank')}
              title="Blank canvas"
              description="Starts empty — all active Jira items are pre-loaded in the backlog, ready to place."
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── RadioCard ─────────────────────────────────────────────────────────────────

interface RadioCardProps {
  id: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}

function RadioCard({ id, selected, onSelect, title, description }: RadioCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      id={`start-mode-${id}`}
      onClick={onSelect}
      className={[
        'w-full text-left rounded-lg border p-4 transition-colors duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
        selected
          ? 'border-mileway-blue bg-mileway-blue-10'
          : 'border-mileway-border bg-white hover:bg-mileway-bg',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className={[
            'mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-fast',
            selected ? 'border-mileway-blue' : 'border-mileway-grey',
          ].join(' ')}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-mileway-blue" />}
        </div>
        <div>
          <p className="text-sm font-medium text-mileway-text leading-snug">{title}</p>
          <p className="text-xs text-mileway-grey mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}
