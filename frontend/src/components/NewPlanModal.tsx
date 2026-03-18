import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { createPlan } from '../stores/actions';
import { Accent, Background, Border, Text } from '../theme/tokens';

interface NewPlanModalProps {
  onClose: () => void;
  /** Called with the new scenario id after creation */
  onCreated: (id: string) => void;
  currentUserEmail?: string;
}

type PlanBase = 'current' | 'blank';

function defaultPlanName(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const q = Math.floor(month / 3) + 1;
  return `Q${q} ${year} — Plan`;
}

export function NewPlanModal({ onClose, onCreated, currentUserEmail }: NewPlanModalProps) {
  const [base, setBase] = useState<PlanBase>('current');
  const [name, setName] = useState(defaultPlanName());
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCreate = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName || creating) return;
    setCreating(true);

    const scenario = createPlan(
      trimmedName,
      notes.trim() || undefined,
      base,
      currentUserEmail,
    );

    onCreated(scenario.id);
  }, [name, notes, base, creating, currentUserEmail, onCreated]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-plan-title"
      onClick={onClose}
    >
      <div
        className="relative rounded-xl shadow-xl w-full max-w-md mx-4"
        style={{ backgroundColor: Background.card }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: Border.subtle }}>
          <h2
            id="new-plan-title"
            className="text-base font-semibold"
            style={{ color: Text.primary }}
          >
            Start your plan
          </h2>
          <button
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#F0F2F5] focus:ring-2 focus:ring-mileway-light-blue"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} style={{ color: Text.secondary }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Base options */}
          <div className="space-y-2">
            <BaseOption
              id="base-current"
              value="current"
              selected={base === 'current'}
              onSelect={() => setBase('current')}
              title="Based on current data"
              description="Copies your team, time-off, and assignments as they are today."
            />
            <BaseOption
              id="base-blank"
              value="blank"
              selected={base === 'blank'}
              onSelect={() => setBase('blank')}
              title="Blank canvas"
              description="Start fresh. No carry-over."
            />
          </div>

          {/* Plan name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: Text.secondary }} htmlFor="plan-name">
              Plan name
            </label>
            <input
              id="plan-name"
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mileway-light-blue"
              style={{ borderColor: Border.subtle, color: Text.primary }}
              placeholder="e.g. Q2 2026 — Plan B"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: Text.secondary }} htmlFor="plan-notes">
              Notes <span style={{ color: Text.tertiary }}>(optional)</span>
            </label>
            <textarea
              id="plan-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mileway-light-blue resize-none"
              style={{ borderColor: Border.subtle, color: Text.primary }}
              placeholder="Context, assumptions, or goals for this plan…"
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-6 py-4 border-t"
          style={{ borderColor: Border.subtle }}
        >
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F0F2F5] focus:ring-2 focus:ring-mileway-light-blue"
            style={{ color: Text.secondary }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-mileway-light-blue',
              !name.trim() || creating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
            )}
            style={{ backgroundColor: Accent.teal }}
            disabled={!name.trim() || creating}
            onClick={handleCreate}
          >
            {creating ? 'Creating…' : 'Create & Open →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Base option radio button
// ─────────────────────────────────────────────────────────────────────────────

interface BaseOptionProps {
  id: string;
  value: PlanBase;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}

function BaseOption({ selected, onSelect, title, description }: BaseOptionProps) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      className={clsx(
        'w-full flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 focus:ring-2 focus:ring-mileway-light-blue',
        selected
          ? 'border-mileway-light-blue bg-[#E6F2FC]'
          : 'hover:border-mileway-light-blue/50 hover:bg-[#F0F2F5]'
      )}
      style={{ borderColor: selected ? Accent.teal : Border.subtle }}
      onClick={onSelect}
    >
      {/* Radio indicator */}
      <div
        className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
        style={{ borderColor: selected ? Accent.teal : Border.subtle }}
      >
        {selected && (
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: Accent.teal }} />
        )}
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: Text.primary }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: Text.tertiary }}>{description}</p>
      </div>
    </button>
  );
}
