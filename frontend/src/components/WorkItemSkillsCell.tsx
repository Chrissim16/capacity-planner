/**
 * WorkItemSkillsCell — compact inline skill display + popover editor for JiraWorkItems.
 *
 * Shows skill chips on the Epics page at Epic / Feature / Story level.
 * Inherited skills (from parent epic) render in a dimmed style.
 * Clicking opens a popover with SkillMultiSelect.
 *
 * Skills are edited in a local draft and only committed to the store
 * when the user clicks Save, avoiding the portal click-conflict that
 * would otherwise close the popover on every skill selection.
 */

import { useState, useCallback } from 'react';
import { Sparkles, X, CornerDownLeft, Check } from 'lucide-react';
import { SkillMultiSelect, SkillChip } from './planner/SkillMultiSelect';
import { updateJiraWorkItemSkills } from '../stores/actions';
import { getEffectiveSkills, isSkillInherited } from '../utils/workItemSkills';
import { useCurrentState } from '../stores/appStore';
import type { JiraWorkItem } from '../types';

interface WorkItemSkillsCellProps {
  item: JiraWorkItem;
  allItems: JiraWorkItem[];
}

export function WorkItemSkillsCell({ item, allItems }: WorkItemSkillsCellProps) {
  const state = useCurrentState();
  const skills = state.skills ?? [];

  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);

  const inherited = isSkillInherited(item);
  const effectiveIds = getEffectiveSkills(item, allItems);
  const effectiveSkills = effectiveIds.map(id => skills.find(s => s.id === id)).filter(Boolean);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Seed the draft with the item's current explicit skills (not inherited)
    setDraftIds(item.requiredSkillIds ?? []);
    setOpen(o => !o);
  }, [item.requiredSkillIds]);

  const handleSave = useCallback(() => {
    updateJiraWorkItemSkills(item.id, draftIds);
    setOpen(false);
  }, [item.id, draftIds]);

  const handleClose = useCallback(() => setOpen(false), []);

  const handleInherit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateJiraWorkItemSkills(item.id, null);
    setOpen(false);
  }, [item.id]);

  return (
    <div className="relative shrink-0">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#F0F2F5] transition-colors text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD]"
        title={inherited ? 'Skills inherited from parent — click to override' : 'Required skills — click to edit'}
      >
        {effectiveSkills.length === 0 ? (
          <span className="flex items-center gap-1 text-[#94A3B8] hover:text-[#1E293B]">
            <Sparkles size={11} />
            <span>Skills</span>
          </span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap max-w-40">
            {effectiveSkills.slice(0, 2).map(s => s && (
              <SkillChip key={s.id} name={s.name} readOnly />
            ))}
            {effectiveSkills.length > 2 && (
              <span className="text-[10px] text-[#94A3B8]">+{effectiveSkills.length - 2}</span>
            )}
            {inherited && (
              <span className="text-[10px] text-[#94A3B8] italic ml-0.5">inherited</span>
            )}
          </div>
        )}
      </button>

      {/* Popover — no outside-click auto-dismiss to avoid portal conflict with SkillMultiSelect dropdown */}
      {open && (
        <div
          className="absolute z-50 right-0 top-full mt-1 w-72 bg-white border border-[#DEDFE3] rounded-lg shadow-xl p-3 space-y-2"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Required Skills</p>
            <button
              type="button"
              onClick={handleClose}
              className="text-[#94A3B8] hover:text-[#1E293B] focus:outline-none"
              aria-label="Close"
            >
              <X size={13} />
            </button>
          </div>

          {inherited && effectiveSkills.length > 0 && (
            <p className="text-[11px] text-[#94A3B8] italic">
              Inheriting from parent. Set skills below to override.
            </p>
          )}

          <SkillMultiSelect
            selectedIds={draftIds}
            onChange={setDraftIds}
            placeholder="No required skills set…"
          />

          <div className="flex items-center justify-between pt-1">
            {!inherited && (item.requiredSkillIds?.length ?? 0) > 0 ? (
              <button
                type="button"
                onClick={handleInherit}
                className="flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#1E293B] transition-colors"
              >
                <CornerDownLeft size={11} />
                Clear and inherit
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[#0089DD] hover:bg-[#0077C2] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD]"
            >
              <Check size={12} />
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
