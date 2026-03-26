/**
 * WorkItemSkillsCell — compact inline skill display + popover editor for JiraWorkItems.
 *
 * Shows skill chips on the Epics page at Epic / Feature / Story level.
 * Inherited skills (from parent epic) render in a dimmed style.
 * Clicking opens a popover with SkillMultiSelect.
 *
 * Setting skills back to null (via "Inherit" button) reverts the item
 * to inheriting from its nearest ancestor.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, CornerDownLeft } from 'lucide-react';
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
  const ref = useRef<HTMLDivElement>(null);

  const inherited = isSkillInherited(item);
  const effectiveIds = getEffectiveSkills(item, allItems);
  const effectiveSkills = effectiveIds.map(id => skills.find(s => s.id === id)).filter(Boolean);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = useCallback((ids: string[]) => {
    updateJiraWorkItemSkills(item.id, ids);
  }, [item.id]);

  const handleInherit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateJiraWorkItemSkills(item.id, null);
    setOpen(false);
  }, [item.id]);

  const currentIds = item.requiredSkillIds ?? [];

  return (
    <div ref={ref} className="relative shrink-0">
      {/* Trigger button */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#F0F2F5] transition-colors text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0089DD]"
        title={inherited ? 'Skills inherited from parent — click to override' : 'Required skills — click to edit'}
      >
        {effectiveSkills.length === 0 ? (
          <span className="flex items-center gap-1 text-[#DEDFE3] hover:text-[#94A3B8]">
            <Sparkles size={11} />
            <span>Skills</span>
          </span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap max-w-40">
            {effectiveSkills.slice(0, 2).map(s => s && (
              <SkillChip
                key={s.id}
                name={s.name}
                readOnly
                variant={inherited ? 'default' : 'default'}
              />
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

      {/* Popover */}
      {open && (
        <div
          className="absolute z-50 right-0 top-full mt-1 w-72 bg-white border border-[#DEDFE3] rounded-lg shadow-xl p-3 space-y-2"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Required Skills</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[#94A3B8] hover:text-[#1E293B] focus:outline-none"
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
            selectedIds={currentIds}
            onChange={handleChange}
            placeholder="No required skills set…"
          />

          {!inherited && currentIds.length > 0 && (
            <button
              type="button"
              onClick={handleInherit}
              className="flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#1E293B] transition-colors"
            >
              <CornerDownLeft size={11} />
              Clear and inherit from parent
            </button>
          )}
        </div>
      )}
    </div>
  );
}
