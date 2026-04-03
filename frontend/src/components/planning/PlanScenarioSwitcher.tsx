import { useMemo, useState } from 'react';
import { Copy, Database, Pencil, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Scenario } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { scenarioColorDot } from '../ScenarioSelector';

interface PlanScenarioSwitcherProps {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  onSwitch: (scenarioId: string | null) => void;
  onCreate: (name: string) => void;
  onDuplicate: (scenarioId: string | null, name: string) => void;
  onRename: (scenarioId: string, name: string) => void;
  onDelete: (scenarioId: string) => void;
}

type ModalState = 'create' | 'duplicate' | 'rename' | 'delete' | null;

export function PlanScenarioSwitcher({
  scenarios,
  activeScenarioId,
  onSwitch,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
}: PlanScenarioSwitcherProps) {
  const [modalState, setModalState] = useState<ModalState>(null);
  const [draftName, setDraftName] = useState('');
  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? null,
    [activeScenarioId, scenarios],
  );

  const openModal = (nextModalState: Exclude<ModalState, 'delete' | null> | 'delete') => {
    if (nextModalState === 'create') {
      setDraftName(`Scenario ${scenarios.length + 1}`);
    } else if (nextModalState === 'duplicate') {
      setDraftName(`${activeScenario?.name ?? 'Baseline'} Copy`);
    } else if (nextModalState === 'rename') {
      setDraftName(activeScenario?.name ?? '');
    } else {
      setDraftName('');
    }
    setModalState(nextModalState);
  };

  const closeModal = () => {
    setModalState(null);
    setDraftName('');
  };

  const submit = () => {
    const name = draftName.trim();
    if (modalState === 'create' && name) onCreate(name);
    if (modalState === 'duplicate') onDuplicate(activeScenarioId, name || `${activeScenario?.name ?? 'Baseline'} Copy`);
    if (modalState === 'rename' && activeScenario && name) onRename(activeScenario.id, name);
    if (modalState === 'delete' && activeScenario) onDelete(activeScenario.id);
    closeModal();
  };

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Scenarios</span>
              <button
                type="button"
                onClick={() => onSwitch(null)}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                  activeScenarioId === null
                    ? 'border-[#0089DD] bg-[#E6F2FC] text-[#0089DD]'
                    : 'border-[#DEDFE3] bg-white text-[#64748B] hover:border-[#BFDBFE] hover:text-[#1E293B]',
                )}
              >
                <Database size={14} />
                Baseline
              </button>
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => onSwitch(scenario.id)}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                    activeScenarioId === scenario.id
                      ? 'border-[#0089DD] bg-[#E6F2FC] text-[#0089DD]'
                      : 'border-[#DEDFE3] bg-white text-[#64748B] hover:border-[#BFDBFE] hover:text-[#1E293B]',
                  )}
                >
                  <span className={clsx('h-3.5 w-3.5 rounded-full', scenarioColorDot(scenario.color).dot)} />
                  <span className="max-w-[200px] truncate">{scenario.name}</span>
                </button>
              ))}
            </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => openModal('create')}>
              <Plus size={14} />
              New Scenario
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openModal('duplicate')}>
              <Copy size={14} />
              Duplicate
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openModal('rename')} disabled={!activeScenario}>
              <Pencil size={14} />
              Rename
            </Button>
            <Button variant="danger" size="sm" onClick={() => openModal('delete')} disabled={!activeScenario}>
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={modalState === 'create' || modalState === 'duplicate' || modalState === 'rename'}
        onClose={closeModal}
        title={
          modalState === 'create'
            ? 'New Scenario'
            : modalState === 'duplicate'
              ? 'Duplicate Scenario'
              : 'Rename Scenario'
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={submit} disabled={!draftName.trim()}>
              {modalState === 'rename' ? 'Save' : 'Continue'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#64748B]">
            {modalState === 'create'
              ? 'Create a named planning scenario from the current baseline or active scenario.'
              : modalState === 'duplicate'
                ? 'Make a copy of the current planning context so you can compare staffing choices safely.'
                : 'Update the scenario name used across the planning pages.'}
          </p>
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Scenario name"
            className="w-full rounded-lg border border-[#DEDFE3] px-3 py-2 text-sm text-[#1E293B] outline-none focus:border-[#0089DD]"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter' && draftName.trim()) submit();
            }}
          />
        </div>
      </Modal>

      <Modal
        isOpen={modalState === 'delete'}
        onClose={closeModal}
        title="Delete Scenario"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={submit}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-[#64748B]">
          Delete <span className="font-semibold text-[#1E293B]">{activeScenario?.name}</span>? If it is active, planning will fall back to the baseline.
        </p>
      </Modal>
    </>
  );
}
