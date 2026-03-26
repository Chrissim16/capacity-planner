/**
 * BulkEditPlannerItemsModal — bulk update multiple PlannerItems at once.
 *
 * Fields supported:
 *   - Required Skills (add to existing | replace)
 *
 * Follows the same toggle-to-edit pattern as BulkEditWorkItemsModal.
 */

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SkillMultiSelect } from './SkillMultiSelect';
import { bulkUpdatePlannerItems } from '../../stores/actions';

interface BulkEditPlannerItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
}

function Section({
  title, enabled, onToggle, children,
}: {
  title: string; enabled: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-mileway-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${enabled ? 'bg-mileway-blue-10' : 'bg-white hover:bg-mileway-bg'}`}
      >
        {enabled
          ? <ChevronDown size={14} className="text-mileway-blue" />
          : <ChevronRight size={14} className="text-mileway-grey" />}
        <span className={`text-sm font-medium ${enabled ? 'text-mileway-blue' : 'text-mileway-text'}`}>{title}</span>
        {enabled && <span className="ml-auto text-xs text-mileway-blue font-medium">Will update</span>}
      </button>
      {enabled && (
        <div className="px-4 pb-4 pt-3 border-t border-mileway-border bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

export function BulkEditPlannerItemsModal({ isOpen, onClose, selectedIds }: BulkEditPlannerItemsModalProps) {
  const [skillsEnabled, setSkillsEnabled] = useState(false);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [skillsMode, setSkillsMode] = useState<'add' | 'replace'>('add');

  const handleClose = useCallback(() => {
    setSkillsEnabled(false); setSkillIds([]); setSkillsMode('add');
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    if (!skillsEnabled || selectedIds.length === 0) return;
    if (skillIds.length > 0) {
      bulkUpdatePlannerItems(selectedIds, { requiredSkillIds: skillIds }, skillsMode);
    }
    handleClose();
  }, [skillsEnabled, skillIds, skillsMode, selectedIds, handleClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Bulk Edit — ${selectedIds.length} planner item${selectedIds.length !== 1 ? 's' : ''}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={!skillsEnabled || skillIds.length === 0}>
            Update {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <p className="text-sm text-mileway-grey mb-4">
        Toggle on the fields you want to change. Only enabled fields will be updated.
      </p>

      <div className="space-y-2">
        <Section title="Required Skills" enabled={skillsEnabled} onToggle={() => setSkillsEnabled(e => !e)}>
          <div className="flex gap-3 mb-2">
            <label className="flex items-center gap-1.5 text-sm text-mileway-text cursor-pointer">
              <input type="radio" name="plannerSkillsMode" checked={skillsMode === 'add'} onChange={() => setSkillsMode('add')} className="text-mileway-blue" />
              Add to existing
            </label>
            <label className="flex items-center gap-1.5 text-sm text-mileway-text cursor-pointer">
              <input type="radio" name="plannerSkillsMode" checked={skillsMode === 'replace'} onChange={() => setSkillsMode('replace')} className="text-mileway-blue" />
              Replace all
            </label>
          </div>
          <SkillMultiSelect
            selectedIds={skillIds}
            onChange={setSkillIds}
            placeholder="Select skills to apply…"
          />
        </Section>
      </div>
    </Modal>
  );
}
