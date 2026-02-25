import React from 'react';
import { clsx } from 'clsx';

export interface AvatarPerson {
  id: string;
  name: string;
  /** Optional initials override; auto-derived from name if absent */
  initials?: string;
}

interface AvatarStackProps {
  people: AvatarPerson[];
  /** 'it' = Mileway blue (#0089DD); 'biz' = purple (#7C3AED) */
  variant: 'it' | 'biz';
  /** Max avatars before "+N" overflow (default: 2) */
  max?: number;
  /** Show label text beside the stack (derived from names when absent) */
  label?: string;
  /** When true, shows an amber dot + "Unassigned" text instead of avatars */
  unassigned?: boolean;
  /** Click handler for the whole stack (used to open assignment panel) */
  onClick?: () => void;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function deriveLabel(people: AvatarPerson[], max: number): string {
  if (people.length === 0) return '';
  const shown = people.slice(0, max);
  const names = shown.map(p => p.name.split(' ')[0]);
  const extra = people.length - shown.length;
  return extra > 0 ? `${names.join(', ')} +${extra}` : names.join(', ');
}

export const AvatarStack: React.FC<AvatarStackProps> = ({
  people,
  variant,
  max = 2,
  label,
  unassigned,
  onClick,
  className,
}) => {
  const isIt = variant === 'it';

  if (unassigned || people.length === 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'flex items-center gap-1.5 text-xs rounded px-2 py-1 transition-colors',
          onClick
            ? 'text-amber-600 hover:bg-amber-50 cursor-pointer border border-dashed border-amber-300'
            : 'text-gray-400 border border-dashed border-gray-200 cursor-default',
          className
        )}
        disabled={!onClick}
      >
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', onClick ? 'bg-amber-400' : 'bg-gray-300')} />
        <span>{onClick ? '+ Assign' : 'Unassigned'}</span>
      </button>
    );
  }

  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;
  const displayLabel = label ?? deriveLabel(people, max);

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 text-xs rounded px-2 py-1 transition-colors',
        onClick ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default',
        className
      )}
      disabled={!onClick}
      title={people.map(p => p.name).join(', ')}
    >
      {/* Avatar stack */}
      <span className="flex items-center">
        {visible.map((person, i) => (
          <span
            key={person.id}
            className={clsx(
              'inline-flex items-center justify-center w-6 h-6 rounded-full text-white font-semibold border-2 border-white',
              isIt ? 'bg-[#0089DD]' : 'bg-[#7C3AED]',
              i > 0 && '-ml-1.5'
            )}
            style={{ fontSize: '9px', lineHeight: 1 }}
            title={person.name}
          >
            {(person.initials ?? getInitials(person.name))}
          </span>
        ))}
        {overflow > 0 && (
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 font-medium border-2 border-white -ml-1.5"
            style={{ fontSize: '9px', lineHeight: 1 }}
          >
            +{overflow}
          </span>
        )}
      </span>
      {/* Name label */}
      {displayLabel && (
        <span className={clsx('truncate max-w-[96px]', isIt ? 'text-[#0089DD]' : 'text-[#7C3AED]')}>
          {displayLabel}
        </span>
      )}
    </button>
  );
};

export default AvatarStack;
