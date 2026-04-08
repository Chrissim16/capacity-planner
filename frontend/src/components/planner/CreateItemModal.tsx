/**
 * CreateItemModal — Modal for manually creating Epics, Features, and Stories.
 *
 * Shared by:
 *   SP-17 — "+ Add Epic" toolbar button
 *   SP-18 — "+" hover button on gantt label rows
 *   SP-19 — "Edit" action on manual items
 *
 * Items are created with `isManual: true` and placed in the backlog.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { PlannerItem, PlannerItemType } from '../../types';
import { useCurrentState } from '../../stores/appStore';
import { SkillMultiSelect } from './SkillMultiSelect';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateItemModalProps {
  /** If provided, the modal is in edit mode pre-filled with the item's data. */
  editItem?: PlannerItem;
  /** Default type for new items. */
  defaultType?: PlannerItemType;
  /** Default parent key (pre-filled when creating a child from a row's "+" button). */
  defaultParentKey?: string;
  /** Optional live parent candidates from the current planner canvas. */
  parentCandidates?: Array<{ key: string; label: string; type: PlannerItemType }>;
  onSave: (data: CreateItemData) => void;
  onClose: () => void;
}

export interface CreateItemData {
  name: string;
  type: PlannerItemType;
  parentKey: string | undefined;
  labels: string[];
  requiredSkillIds: string[];
}

const TYPE_OPTIONS: { value: PlannerItemType; label: string }[] = [
  { value: 'epic', label: 'Epic' },
  { value: 'feature', label: 'Feature' },
  { value: 'story', label: 'Story' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'uat', label: 'UAT' },
  { value: 'hypercare', label: 'Hypercare' },
];

// ── CreateItemModal ───────────────────────────────────────────────────────────

export function CreateItemModal({
  editItem,
  defaultType = 'epic',
  defaultParentKey,
  parentCandidates,
  onSave,
  onClose,
}: CreateItemModalProps) {
  const state = useCurrentState();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName]           = useState(editItem?.name ?? '');
  const [type, setType]           = useState<PlannerItemType>(editItem?.type ?? defaultType);
  const [parentKey, setParentKey] = useState<string>(editItem?.parentKey ?? defaultParentKey ?? '');
  const [labelInput, setLabelInput] = useState('');
  const [labels, setLabels]       = useState<string[]>(editItem?.labels ?? []);
  const [requiredSkillIds, setRequiredSkillIds] = useState<string[]>(editItem?.requiredSkillIds ?? []);

  const isEdit = !!editItem;

  // Focus name field on mount
  useEffect(() => { nameRef.current?.focus(); }, []);

  // All unique labels in the system
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    for (const item of state.jiraWorkItems ?? []) {
      for (const l of item.labels ?? []) set.add(l);
    }
    return Array.from(set).sort();
  }, [state.jiraWorkItems]);

  // Available parent items (Epics for Features, Features for Stories, etc.)
  const parentOptions = useMemo(() => {
    if (parentCandidates && parentCandidates.length > 0) {
      if (type === 'feature' || type === 'uat' || type === 'hypercare') {
        return parentCandidates.filter((candidate) => candidate.type === 'epic');
      }
      if (type === 'story' || type === 'task' || type === 'bug') {
        return parentCandidates.filter((candidate) => candidate.type === 'feature' || candidate.type === 'epic');
      }
      return [];
    }

    const items = state.jiraWorkItems ?? [];
    if (type === 'feature') return items.filter(i => i.type === 'epic').map(i => ({ key: i.jiraKey, label: `${i.jiraKey}: ${i.summary}`, type: 'epic' as PlannerItemType }));
    if (type === 'uat' || type === 'hypercare') {
      return items.filter(i => i.type === 'epic').map(i => ({ key: i.jiraKey, label: `${i.jiraKey}: ${i.summary}`, type: 'epic' as PlannerItemType }));
    }
    if (type === 'story' || type === 'task' || type === 'bug') {
      return items
        .filter(i => i.type === 'feature' || i.type === 'epic')
        .map(i => ({ key: i.jiraKey, label: `${i.jiraKey}: ${i.summary}`, type: i.type as PlannerItemType }));
    }
    return [];
  }, [parentCandidates, state.jiraWorkItems, type]);

  // Label autocomplete suggestions
  const labelSuggestions = useMemo(() => {
    if (!labelInput.trim()) return [];
    const q = labelInput.toLowerCase();
    return allLabels.filter(l => l.toLowerCase().includes(q) && !labels.includes(l)).slice(0, 6);
  }, [labelInput, allLabels, labels]);

  function addLabel(label: string) {
    const trimmed = label.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels(prev => [...prev, trimmed]);
    }
    setLabelInput('');
  }

  function removeLabel(label: string) {
    setLabels(prev => prev.filter(l => l !== label));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      type,
      parentKey: parentKey || undefined,
      labels,
      requiredSkillIds: (type === 'uat' || type === 'hypercare') ? [] : requiredSkillIds,
    });
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.2)] w-full max-w-md mx-4"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit item' : 'Create item'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-mileway-text">
            {isEdit ? 'Edit Item' : 'Create Manual Item'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-mileway-bg text-mileway-grey hover:text-mileway-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-mileway-grey mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. UAT Sprint 1"
              required
              className="w-full px-3 py-2 text-sm border border-mileway-border rounded-lg text-mileway-text placeholder:text-mileway-grey/50 focus:outline-none focus:border-mileway-blue transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-mileway-grey mb-1">Type</label>
            <select
              value={type}
              onChange={e => {
                const newType = e.target.value as PlannerItemType;
                setType(newType);
                if (newType === 'uat' || newType === 'hypercare') {
                  // Preserve the context parent key (set when the user clicked "+" on a row);
                  // fall back to no parent so the user can pick the correct epic manually.
                  setParentKey(defaultParentKey ?? '');
                } else {
                  setParentKey('');
                }
              }}
              className="w-full px-3 py-2 text-sm border border-mileway-border rounded-lg text-mileway-text bg-white focus:outline-none focus:border-mileway-blue transition-colors"
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Parent (only for non-epic types) */}
          {type !== 'epic' && parentOptions.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-mileway-grey mb-1">
                Parent item
              </label>
              <select
                value={parentKey}
                onChange={e => setParentKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-mileway-border rounded-lg text-mileway-text bg-white focus:outline-none focus:border-mileway-blue transition-colors"
              >
                <option value="">— No parent —</option>
                {parentOptions.map(o => (
                  <option key={o.key} value={o.key}>
                    {o.label.length > 50 ? o.label.slice(0, 50) + '…' : o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Labels */}
          <div>
            <label className="block text-xs font-semibold text-mileway-grey mb-1">Labels</label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {labels.map(l => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-mileway-grey bg-mileway-bg px-2 py-0.5 rounded border border-mileway-border"
                >
                  {l}
                  <button
                    type="button"
                    onClick={() => removeLabel(l)}
                    className="text-mileway-grey hover:text-red-500 focus:outline-none"
                    aria-label={`Remove label ${l}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && labelInput.trim()) {
                    e.preventDefault();
                    addLabel(labelInput);
                  }
                }}
                placeholder="Type to add labels…"
                className="w-full px-3 py-1.5 text-sm border border-mileway-border rounded-lg text-mileway-text placeholder:text-mileway-grey/50 focus:outline-none focus:border-mileway-blue transition-colors"
              />
              {labelSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-mileway-border rounded-lg shadow-lg z-10 py-1 max-h-36 overflow-y-auto">
                  {labelSuggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addLabel(s)}
                      className="w-full text-left px-3 py-1.5 text-sm text-mileway-text hover:bg-mileway-bg transition-colors focus:outline-none focus:bg-mileway-bg"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Required Skills — hidden for UAT/Hypercare */}
          {type !== 'uat' && type !== 'hypercare' && (
            <div>
              <label className="block text-xs font-semibold text-mileway-grey mb-1">Required Skills</label>
              <SkillMultiSelect
                selectedIds={requiredSkillIds}
                onChange={setRequiredSkillIds}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={!name.trim()}
              className={[
                'flex-1 text-sm font-medium rounded-lg px-4 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
                name.trim()
                  ? 'bg-mileway-blue text-white hover:bg-mileway-blue/90'
                  : 'bg-mileway-border text-mileway-grey cursor-not-allowed',
              ].join(' ')}
            >
              {isEdit ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm font-medium text-mileway-grey border border-mileway-border rounded-lg px-4 py-2 hover:bg-mileway-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
