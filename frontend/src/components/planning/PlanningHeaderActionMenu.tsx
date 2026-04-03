import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface PlanningHeaderActionMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

interface PlanningHeaderActionMenuProps {
  label: string;
  icon?: ReactNode;
  items: PlanningHeaderActionMenuItem[];
  disabled?: boolean;
  className?: string;
}

export function PlanningHeaderActionMenu({
  label,
  icon,
  items,
  disabled = false,
  className,
}: PlanningHeaderActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={clsx(
          'inline-flex h-9 items-center gap-2 rounded-lg border border-[#DEDFE3] bg-white px-3 text-sm font-medium text-[#1E293B] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={16} className={clsx('text-[#94A3B8] transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-[420] mt-2 w-56 overflow-hidden rounded-xl border border-[#DEDFE3] bg-white py-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setIsOpen(false);
              }}
              className={clsx(
                'flex w-full items-center px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                item.tone === 'danger'
                  ? 'text-[#DC2626] hover:bg-[#FEF2F2]'
                  : 'text-[#1E293B] hover:bg-[#F8FAFC]',
              )}
              role="menuitem"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
