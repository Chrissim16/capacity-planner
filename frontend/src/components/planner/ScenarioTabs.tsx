import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
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
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [startMode, setStartMode] = useState<StartMode>('clone');

  const atLimit = scenarios.length >= MAX_SCENARIOS;
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the name field once the modal is open
  useEffect(() => {
    if (modalOpen) {
      // The Modal renders with animate-fade-in; wait one frame before focusing
      const id = requestAnimationFrame(() => nameInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [modalOpen]);

  const handleOpen = useCallback(() => {
    setName('');
    setStartMode('clone');
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, startMode);
    setModalOpen(false);
  }, [name, startMode, onCreate]);

  return (
    <>
      {/* ── Tab strip ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1" role="tablist" aria-label="Scenarios">
        {scenarios.map(scenario => {
          const isActive = scenario.id === activeScenarioId;
          return (
            <button
              key={scenario.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(scenario.id)}
              className={[
                'rounded-pill px-4 py-1.5 text-sm font-medium transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                isActive
                  ? 'bg-mileway-blue-10 text-mileway-blue'
                  : 'text-mileway-grey hover:bg-mileway-bg',
              ].join(' ')}
            >
              {scenario.name}
            </button>
          );
        })}

        {/* ── Add button ───────────────────────────────────────────── */}
        <button
          onClick={atLimit ? undefined : handleOpen}
          disabled={atLimit}
          aria-label={atLimit ? 'Maximum 5 scenarios reached' : 'New scenario'}
          title={atLimit ? 'Maximum 5 scenarios reached' : 'New scenario'}
          className="flex items-center justify-center w-7 h-7 rounded-pill text-mileway-grey hover:bg-mileway-bg transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={15} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Creation modal ───────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={handleClose}
        title="New Scenario"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label
              htmlFor="scenario-name"
              className="block text-xs font-medium text-mileway-grey mb-1.5"
            >
              Scenario name
            </label>
            <input
              ref={nameInputRef}
              id="scenario-name"
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

          {/* Starting point */}
          <div>
            <p className="text-xs font-medium text-mileway-grey mb-2">Starting point</p>
            <div className="space-y-2" role="radiogroup" aria-label="Starting point">
              <RadioCard
                id="clone"
                selected={startMode === 'clone'}
                onSelect={() => setStartMode('clone')}
                title="Clone current"
                description="Copies all placed items, assignments, and lock states from the active scenario."
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
    </>
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
        {/* Custom radio dot */}
        <div
          aria-hidden="true"
          className={[
            'mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-fast',
            selected ? 'border-mileway-blue' : 'border-mileway-grey',
          ].join(' ')}
        >
          {selected && (
            <div className="w-2 h-2 rounded-full bg-mileway-blue" />
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-mileway-text leading-snug">{title}</p>
          <p className="text-xs text-mileway-grey mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}
