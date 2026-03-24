/**
 * SkillMultiSelect — shared tag input for required skills on PlannerItems.
 *
 * Features:
 *   - Searchable dropdown of all skills in the system
 *   - Fuzzy "Did you mean?" nudge for near-matches (US-SP-22 AC#4)
 *   - Inline "Add new" to create skills on the fly (AC#3)
 *   - Read-only chip mode for tooltips / headers
 */

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Lightbulb } from 'lucide-react';
import { useCurrentState, useAppStore } from '../../stores/appStore';
import { addSkill } from '../../stores/actions';
import { fuzzySkillMatch } from '../../utils/fuzzyMatch';
import type { Skill } from '../../types';

export interface SkillMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  readOnly?: boolean;
  placeholder?: string;
}

function SkillChip({
  name,
  onRemove,
  readOnly,
  variant = 'default',
}: {
  name: string;
  onRemove?: () => void;
  readOnly?: boolean;
  variant?: 'default' | 'green' | 'red';
}) {
  const variantStyles = {
    default: 'bg-mileway-bg text-mileway-text border-mileway-border',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${variantStyles[variant]}`}>
      {name}
      {!readOnly && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-mileway-grey hover:text-red-500 focus:outline-none"
          aria-label={`Remove skill ${name}`}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

export { SkillChip };

export function SkillMultiSelect({
  selectedIds,
  onChange,
  readOnly = false,
  placeholder = 'No required skills — anyone can be assigned.',
}: SkillMultiSelectProps) {
  const state = useCurrentState();
  const skills: Skill[] = state.skills ?? [];

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSkills = useMemo(
    () => selectedIds.map(id => skills.find(s => s.id === id)).filter(Boolean) as Skill[],
    [selectedIds, skills],
  );

  const unselected = useMemo(
    () => skills.filter(s => !selectedIds.includes(s.id)),
    [skills, selectedIds],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return unselected;
    const q = query.toLowerCase();
    return unselected.filter(s => s.name.toLowerCase().includes(q));
  }, [query, unselected]);

  const fuzzyMatches = useMemo(() => {
    if (!query.trim() || filtered.length > 0) return [];
    return fuzzySkillMatch(query, unselected);
  }, [query, filtered, unselected]);

  const exactExists = useMemo(
    () => skills.some(s => s.name.toLowerCase() === query.trim().toLowerCase()),
    [query, skills],
  );

  const showAddNew = query.trim().length > 0 && !exactExists;

  const showDropdown = isOpen && (query.trim().length > 0 || unselected.length > 0);

  useLayoutEffect(() => {
    if (!showDropdown) {
      setMenuRect(null);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showDropdown]);

  const handleSelect = useCallback((skillId: string) => {
    onChange([...selectedIds, skillId]);
    setQuery('');
    inputRef.current?.focus();
  }, [selectedIds, onChange]);

  const handleRemove = useCallback((skillId: string) => {
    onChange(selectedIds.filter(id => id !== skillId));
  }, [selectedIds, onChange]);

  const handleAddNew = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    addSkill(trimmed, 'Technical');
    // addSkill is synchronous — the store updates immediately
    const latest: Skill[] = useAppStore.getState().getCurrentState().skills;
    const created = latest.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
    if (created) onChange([...selectedIds, created.id]);
    setQuery('');
    inputRef.current?.focus();
  }, [query, selectedIds, onChange]);

  // Close dropdown on outside click (menu is portaled to document.body)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (menuPortalRef.current?.contains(t)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (readOnly) {
    if (selectedSkills.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {selectedSkills.map(s => (
          <SkillChip key={s.id} name={s.name} readOnly />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips + input */}
      <div
        className="flex flex-wrap items-center gap-1 min-h-[36px] px-2 py-1.5 border border-mileway-border rounded-lg cursor-text transition-colors focus-within:border-mileway-blue"
        onClick={() => { inputRef.current?.focus(); setIsOpen(true); }}
      >
        {selectedSkills.map(s => (
          <SkillChip
            key={s.id}
            name={s.name}
            onRemove={() => handleRemove(s.id)}
          />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !query && selectedIds.length > 0) {
              handleRemove(selectedIds[selectedIds.length - 1]);
            }
            if (e.key === 'Enter' && showAddNew && filtered.length === 0 && fuzzyMatches.length === 0) {
              e.preventDefault();
              handleAddNew();
            }
          }}
          placeholder={selectedSkills.length === 0 ? placeholder : 'Add skill…'}
          className="flex-1 min-w-[80px] text-sm text-mileway-text placeholder:text-mileway-grey/50 outline-none bg-transparent"
        />
      </div>

      {/* Dropdown — portaled so scrollable parents (e.g. detail panel) do not clip it */}
      {showDropdown && menuRect != null && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuPortalRef}
          className="fixed z-[200] bg-white border border-mileway-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto"
          style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width, minWidth: 200 }}
        >
          {fuzzyMatches.length > 0 && (
            <div className="px-3 py-2 border-b border-mileway-border bg-amber-50/60">
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium mb-1">
                <Lightbulb size={12} />
                Did you mean?
              </div>
              {fuzzyMatches.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m.id)}
                  className="w-full text-left px-2 py-1 text-sm text-amber-900 hover:bg-amber-100 rounded transition-colors"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {filtered.slice(0, 20).map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelect(s.id)}
              className="w-full text-left px-3 py-1.5 text-sm text-mileway-text hover:bg-mileway-bg transition-colors focus:outline-none focus:bg-mileway-bg"
            >
              <span>{s.name}</span>
              <span className="text-[10px] text-mileway-grey ml-2">{s.category}</span>
            </button>
          ))}

          {showAddNew && (
            <button
              type="button"
              onClick={handleAddNew}
              className="w-full text-left px-3 py-1.5 text-sm text-mileway-blue hover:bg-mileway-blue-10 transition-colors focus:outline-none flex items-center gap-1.5 border-t border-mileway-border mt-1 pt-2"
            >
              <Plus size={12} />
              Add "{query.trim()}" as new skill
            </button>
          )}

          {filtered.length === 0 && fuzzyMatches.length === 0 && !showAddNew && (
            <p className="px-3 py-2 text-sm text-mileway-grey italic">No skills found.</p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
