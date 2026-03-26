/**
 * BulkEditWorkItemsModal — bulk update multiple JiraWorkItems at once.
 *
 * Fields supported:
 *   - Required Skills (add to existing | replace)
 *   - Priority (replace)
 *   - Confidence Level (replace)
 *   - Estimates / Story Points (replace)
 *
 * Each field section is collapsed by default — users toggle on only the
 * fields they want to change. Follows the same pattern as bulkUpdateTeamMembers.
 */

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { SkillMultiSelect } from './planner/SkillMultiSelect';
import { bulkUpdateWorkItems } from '../stores/actions';
import type { ConfidenceLevel, JiraWorkItem } from '../types';

interface BulkEditWorkItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  /** Label shown in the confirmation — e.g. "epics" or "items" */
  itemLabel?: string;
}

interface SectionProps {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, enabled, onToggle, children }: SectionProps) {
  return (
    <div className="border border-[#DEDFE3] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${enabled ? 'bg-[#EFF6FF]' : 'bg-white hover:bg-[#F5F8FC]'}`}
      >
        {enabled ? <ChevronDown size={14} className="text-[#0089DD]" /> : <ChevronRight size={14} className="text-[#94A3B8]" />}
        <span className={`text-sm font-medium ${enabled ? 'text-[#0089DD]' : 'text-[#1E293B]'}`}>{title}</span>
        {enabled && <span className="ml-auto text-xs text-[#0089DD] font-medium">Will update</span>}
      </button>
      {enabled && (
        <div className="px-4 pb-4 pt-3 border-t border-[#DEDFE3] bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;
const CONFIDENCE_LEVELS: { value: ConfidenceLevel; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function BulkEditWorkItemsModal({
  isOpen,
  onClose,
  selectedIds,
  itemLabel = 'items',
}: BulkEditWorkItemsModalProps) {
  // Skills
  const [skillsEnabled, setSkillsEnabled] = useState(false);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [skillsMode, setSkillsMode] = useState<'add' | 'replace'>('add');

  // Priority
  const [priorityEnabled, setPriorityEnabled] = useState(false);
  const [priority, setPriority] = useState<string>('Medium');

  // Confidence
  const [confidenceEnabled, setConfidenceEnabled] = useState(false);
  const [confidence, setConfidence] = useState<ConfidenceLevel>('medium');

  // Estimates
  const [estimatesEnabled, setEstimatesEnabled] = useState(false);
  const [storyPoints, setStoryPoints] = useState<string>('');

  const activeFieldCount = [skillsEnabled, priorityEnabled, confidenceEnabled, estimatesEnabled].filter(Boolean).length;

  const handleClose = useCallback(() => {
    // Reset state on close
    setSkillsEnabled(false); setSkillIds([]); setSkillsMode('add');
    setPriorityEnabled(false); setPriority('Medium');
    setConfidenceEnabled(false); setConfidence('medium');
    setEstimatesEnabled(false); setStoryPoints('');
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    if (activeFieldCount === 0 || selectedIds.length === 0) return;

    const updates: Partial<JiraWorkItem> = {};
    let mode: 'replace' | 'add' = 'replace';

    if (skillsEnabled && skillIds.length > 0) {
      updates.requiredSkillIds = skillIds;
      if (skillsMode === 'add') mode = 'add';
    }
    if (priorityEnabled) updates.priority = priority;
    if (confidenceEnabled) updates.confidenceLevel = confidence;
    if (estimatesEnabled && storyPoints !== '') {
      const val = parseFloat(storyPoints);
      if (!isNaN(val)) updates.storyPoints = val;
    }

    bulkUpdateWorkItems(selectedIds, updates, mode);
    handleClose();
  }, [activeFieldCount, selectedIds, skillsEnabled, skillIds, skillsMode, priorityEnabled, priority, confidenceEnabled, confidence, estimatesEnabled, storyPoints, handleClose]);

  const activeFields: string[] = [];
  if (skillsEnabled) activeFields.push('Skills');
  if (priorityEnabled) activeFields.push('Priority');
  if (confidenceEnabled) activeFields.push('Confidence');
  if (estimatesEnabled) activeFields.push('Estimates');

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Bulk Edit — ${selectedIds.length} ${itemLabel}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleApply}
            disabled={activeFieldCount === 0}
          >
            Update {selectedIds.length} {itemLabel}
            {activeFields.length > 0 && (
              <span className="ml-1 text-blue-200 font-normal">
                · {activeFields.join(', ')}
              </span>
            )}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[#94A3B8] mb-4">
        Toggle on the fields you want to change. Only enabled fields will be updated.
      </p>

      <div className="space-y-2">

        {/* Skills */}
        <Section title="Required Skills" enabled={skillsEnabled} onToggle={() => setSkillsEnabled(e => !e)}>
          <div className="mb-3">
            <div className="flex gap-3 mb-2">
              <label className="flex items-center gap-1.5 text-sm text-[#1E293B] cursor-pointer">
                <input
                  type="radio"
                  name="skillsMode"
                  checked={skillsMode === 'add'}
                  onChange={() => setSkillsMode('add')}
                  className="text-[#0089DD]"
                />
                Add to existing
              </label>
              <label className="flex items-center gap-1.5 text-sm text-[#1E293B] cursor-pointer">
                <input
                  type="radio"
                  name="skillsMode"
                  checked={skillsMode === 'replace'}
                  onChange={() => setSkillsMode('replace')}
                  className="text-[#0089DD]"
                />
                Replace all
              </label>
            </div>
            <SkillMultiSelect
              selectedIds={skillIds}
              onChange={setSkillIds}
              placeholder="Select skills to apply…"
            />
          </div>
        </Section>

        {/* Priority */}
        <Section title="Priority" enabled={priorityEnabled} onToggle={() => setPriorityEnabled(e => !e)}>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="w-full text-sm border border-[#DEDFE3] rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0089DD]"
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Section>

        {/* Confidence */}
        <Section title="Confidence Level" enabled={confidenceEnabled} onToggle={() => setConfidenceEnabled(e => !e)}>
          <div className="flex gap-2">
            {CONFIDENCE_LEVELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setConfidence(value)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  confidence === value
                    ? 'bg-[#EFF6FF] border-[#0089DD] text-[#0089DD]'
                    : 'bg-white border-[#DEDFE3] text-[#94A3B8] hover:border-[#0089DD] hover:text-[#0089DD]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        {/* Estimates */}
        <Section title="Estimate (Story Points)" enabled={estimatesEnabled} onToggle={() => setEstimatesEnabled(e => !e)}>
          <input
            type="number"
            min="0"
            step="0.5"
            value={storyPoints}
            onChange={e => setStoryPoints(e.target.value)}
            placeholder="e.g. 5"
            className="w-full text-sm border border-[#DEDFE3] rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0089DD]"
          />
          <p className="mt-1.5 text-[11px] text-[#94A3B8]">
            Sets story points on all selected items. This affects confidence-adjusted day estimates.
          </p>
        </Section>

      </div>
    </Modal>
  );
}
