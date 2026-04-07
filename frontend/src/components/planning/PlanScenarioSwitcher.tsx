import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Database, Pencil, Plus, Trash2 } from 'lucide-react';
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [draftName, setDraftName] = useState('');

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? null,
    [activeScenarioId, scenarios],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const openModal = (nextModalState: Exclude<ModalState, null>) => {
    if (nextModalState === 'create') {
      setDraftName(`Scenario ${scenarios.length + 1}`);
    } else if (nextModalState === 'duplicate') {
      setDraftName(`${activeScenario?.name ?? 'Baseline'} Copy`);
    } else if (nextModalState === 'rename') {
      setDraftName(activeScenario?.name ?? '');
    } else {
      setDraftName('');
    }
    setIsOpen(false);
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
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex h-8 min-w-[168px] max-w-full items-center gap-2 rounded-md border border-[#DEDFE3] bg-white px-2.5 text-left text-xs font-medium text-[#1E293B] transition-colors hover:bg-[#F8FAFC]"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Scenario</span>
          <span className="h-4 w-px shrink-0 bg-[#E2E8F0]" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {activeScenario ? (
              <>
                <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', scenarioColorDot(activeScenario.color).dot)} />
                <span className="truncate">{activeScenario.name}</span>
              </>
            ) : (
              <>
                <Database size={14} className="shrink-0 text-[#64748B]" />
                <span className="truncate">Baseline</span>
              </>
            )}
          </span>
          <ChevronDown size={16} className={clsx('shrink-0 text-[#94A3B8] transition-transform', isOpen && 'rotate-180')} />
        </button>

        {isOpen ? (
          <div className="absolute right-0 top-full z-[420] mt-2 w-[320px] overflow-hidden rounded-xl border border-[#DEDFE3] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.14)]">
            <div className="border-b border-[#EEF2F6] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Available Scenarios</p>
            </div>

            <div className="max-h-[280px] overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => {
                  onSwitch(null);
                  setIsOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  activeScenarioId === null ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]',
                )}
              >
                <Database size={15} className="shrink-0 text-[#64748B]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#1E293B]">Baseline</div>
                  <div className="text-xs text-[#94A3B8]">Live shared plan</div>
                </div>
                {activeScenarioId === null ? <Check size={15} className="shrink-0 text-[#0089DD]" /> : null}
              </button>

              {scenarios.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {scenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => {
                        onSwitch(scenario.id);
                        setIsOpen(false);
                      }}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                        activeScenarioId === scenario.id ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]',
                      )}
                    >
                      <span className={clsx('h-3 w-3 shrink-0 rounded-full', scenarioColorDot(scenario.color).dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[#1E293B]">{scenario.name}</div>
                        <div className="text-xs text-[#94A3B8]">
                          {scenario.updatedAt ? `Updated ${new Date(scenario.updatedAt).toLocaleDateString()}` : 'Scenario'}
                        </div>
                      </div>
                      {activeScenarioId === scenario.id ? <Check size={15} className="shrink-0 text-[#0089DD]" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="border-t border-[#EEF2F6] p-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openModal('create')}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#DEDFE3] bg-white px-3 text-sm font-medium text-[#1E293B] transition-colors hover:bg-[#F8FAFC]"
                >
                  <Plus size={14} />
                  New
                </button>
                <button
                  type="button"
                  onClick={() => openModal('duplicate')}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#DEDFE3] bg-white px-3 text-sm font-medium text-[#1E293B] transition-colors hover:bg-[#F8FAFC]"
                >
                  <Copy size={14} />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => openModal('rename')}
                  disabled={!activeScenario}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#DEDFE3] bg-white px-3 text-sm font-medium text-[#1E293B] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Pencil size={14} />
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => openModal('delete')}
                  disabled={!activeScenario}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#FEE2E2] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
