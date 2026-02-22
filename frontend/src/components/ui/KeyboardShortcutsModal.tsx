import { Modal } from './Modal';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: ['N'], description: 'New item (add team member, epic, etc. on current page)' },
  { keys: ['?'], description: 'Show this keyboard shortcuts reference' },
  { keys: ['Esc'], description: 'Close modal or panel' },
  { keys: ['Ctrl', 'K'], description: 'Global search — epics, members, Jira items' },
  { keys: ['1–6'], description: 'Navigate to view (Dashboard, Timeline, Epics, Team, Jira, Settings)' },
];

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded shadow-sm">
      {label}
    </kbd>
  );
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="sm">
      <div className="space-y-3">
        {SHORTCUTS.map(({ keys, description }) => (
          <div key={keys.join('+')} className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-300">{description}</span>
            <div className="flex items-center gap-1 shrink-0">
              {keys.map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && <span className="text-slate-400 text-xs">+</span>}
                  <Key label={k} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
