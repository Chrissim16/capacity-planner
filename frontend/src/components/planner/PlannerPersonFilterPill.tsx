/**
 * Timeline toolbar — "All Teams" person filter (redesign §7).
 * Dropdown: All Teams + active IT members + non-archived BIZ contacts.
 */
import { useMemo, useState, useCallback } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingFocusManager,
  FloatingPortal,
} from '@floating-ui/react';
import { ChevronDown, Check } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export interface PlannerPersonFilterPillProps {
  selectedMemberId: string | null;
  onSelectMemberId: (id: string | null) => void;
}

type FilterEntry = { id: string; name: string; track: 'IT' | 'BIZ' };

export function PlannerPersonFilterPill({ selectedMemberId, onSelectMemberId }: PlannerPersonFilterPillProps) {
  const state = useCurrentState();
  const [open, setOpen] = useState(false);

  const entries = useMemo((): FilterEntry[] => {
    const it = (state.teamMembers ?? [])
      .filter(m => !m.excludedFromCapacity)
      .map(m => ({ id: m.id, name: m.name, track: 'IT' as const }));
    const biz = (state.businessContacts ?? [])
      .filter(c => !c.archived && !c.excludedFromCapacity)
      .map(c => ({ id: c.id, name: c.name, track: 'BIZ' as const }));
    return [...it, ...biz].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [state.teamMembers, state.businessContacts]);

  const selectedLabel = useMemo(() => {
    if (!selectedMemberId) return 'All Teams';
    const e = entries.find(x => x.id === selectedMemberId);
    return e?.name ?? 'All Teams';
  }, [selectedMemberId, entries]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'listbox' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const pick = useCallback(
    (id: string | null) => {
      onSelectMemberId(id);
      setOpen(false);
    },
    [onSelectMemberId],
  );

  return (
    <>
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'inline-flex items-center gap-1.5 max-w-[200px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-fast',
          'border border-mileway-border bg-white text-mileway-text hover:bg-mileway-bg',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-mileway-blue',
        ].join(' ')}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={14} className="flex-shrink-0 text-mileway-grey" aria-hidden />
      </button>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-[120] min-w-[240px] max-w-[320px] max-h-[min(360px,70vh)] overflow-y-auto rounded-lg border border-mileway-border bg-white py-1 shadow-lg"
              role="listbox"
              aria-label="Filter timeline by person"
            >
              <button
                type="button"
                role="option"
                aria-selected={selectedMemberId === null}
                onClick={() => pick(null)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-mileway-text hover:bg-mileway-bg focus:outline-none focus-visible:bg-mileway-blue-10"
              >
                <span className="flex-1 font-medium">All Teams</span>
                {selectedMemberId === null && <Check size={14} className="flex-shrink-0 text-mileway-blue" aria-hidden />}
              </button>
              <div className="my-1 h-px bg-mileway-divider" role="presentation" />
              {entries.map(e => {
                const selected = e.id === selectedMemberId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(e.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-mileway-bg focus:outline-none focus-visible:bg-mileway-blue-10"
                  >
                    <div
                      className={[
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                        e.track === 'IT' ? 'bg-mileway-blue-10 text-mileway-blue' : 'bg-purple-50 text-purple-600',
                      ].join(' ')}
                      aria-hidden
                    >
                      {initials(e.name)}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-mileway-text">{e.name}</span>
                    <span
                      className={[
                        'flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-bold tracking-wide',
                        e.track === 'IT' ? 'bg-mileway-blue-10 text-mileway-blue' : 'bg-purple-50 text-purple-600',
                      ].join(' ')}
                    >
                      {e.track}
                    </span>
                    {selected && <Check size={14} className="flex-shrink-0 text-mileway-blue" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
