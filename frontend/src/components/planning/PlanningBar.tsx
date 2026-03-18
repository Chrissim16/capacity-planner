/**
 * PlanningBar — colored assignment bar for the Planning Board grid.
 *
 * Used in both People view (project assignment bar) and Projects view
 * (person assignment bar). Supports inline-edit on click and remove × button.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { Accent, Semantic, Text } from '../../theme/tokens';

export interface PlanningBarProps {
  /** Days assigned for this bar */
  days: number;
  /** Quarter label, e.g. "Q1 2026" */
  quarter: string;
  /** Person name shown in tooltip */
  personName: string;
  /** Project name shown in tooltip */
  projectName: string;
  /** Background color for the bar (defaults to teal) */
  color?: string;
  /** Width as 0–1 fraction of the quarter column width (capped at 1) */
  widthFraction: number;
  /** Called with the new days value when the user confirms an inline edit */
  onEdit: (newDays: number) => void;
  /** Called when the user clicks × to remove the assignment */
  onRemove: () => void;
  /** Extra className overrides */
  className?: string;
}

const DEFAULT_COLOR = Accent.teal;

export function PlanningBar({
  days,
  quarter,
  personName,
  projectName,
  color = DEFAULT_COLOR,
  widthFraction,
  onEdit,
  onRemove,
  className,
}: PlanningBarProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(days));
  const [hovered, setHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync edit value when days prop changes
  useEffect(() => {
    if (!editing) setEditValue(String(days));
  }, [days, editing]);

  const startEdit = useCallback(() => {
    setEditValue(String(days));
    setEditing(true);
  }, [days]);

  const confirmEdit = useCallback(() => {
    const parsed = parseInt(editValue, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== days) {
      onEdit(parsed);
    }
    setEditing(false);
  }, [editValue, days, onEdit]);

  const cancelEdit = useCallback(() => {
    setEditValue(String(days));
    setEditing(false);
  }, [days]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    tooltipTimer.current = setTimeout(() => setShowTooltip(true), 500);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setShowTooltip(false);
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
  }, []);

  useEffect(() => {
    return () => { if (tooltipTimer.current) clearTimeout(tooltipTimer.current); };
  }, []);

  const barWidthPct = `${Math.min(Math.max(widthFraction * 100, 8), 100)}%`;

  return (
    <div
      className={clsx('relative inline-flex items-center group', className)}
      style={{ width: barWidthPct, minWidth: 40, height: 26 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {editing ? (
        // ── Inline edit mode ──────────────────────────────────────────────────
        <div
          className="absolute inset-0 flex items-center rounded-md overflow-hidden"
          style={{ backgroundColor: color, opacity: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={999}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            onBlur={confirmEdit}
            className="w-full h-full bg-transparent text-white text-xs font-medium text-center outline-none px-1"
            style={{ color: Text.inverse }}
            aria-label={`Edit days for ${personName} on ${projectName} in ${quarter}`}
          />
        </div>
      ) : (
        // ── Display mode ──────────────────────────────────────────────────────
        <button
          className="absolute inset-0 flex items-center justify-between rounded-md px-1.5 transition-opacity duration-100 focus:ring-2 focus:ring-offset-1 focus:ring-mileway-light-blue"
          style={{ backgroundColor: color }}
          onClick={startEdit}
          aria-label={`${days}d — click to edit`}
          title={undefined}
        >
          <span className="text-[11px] font-semibold truncate" style={{ color: Text.inverse }}>
            {days}d
          </span>

          {/* Remove button — only shown on hover */}
          <span
            className={clsx(
              'flex items-center justify-center w-4 h-4 rounded-full transition-opacity duration-100 shrink-0',
              hovered ? 'opacity-100' : 'opacity-0'
            )}
            style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
            role="button"
            aria-label="Remove assignment"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onRemove(); } }}
            tabIndex={hovered ? 0 : -1}
          >
            <X size={9} style={{ color: Text.inverse }} />
          </span>
        </button>
      )}

      {/* Tooltip */}
      {showTooltip && !editing && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none"
          style={{
            backgroundColor: '#003565',
            color: '#FFFFFF',
            border: `1px solid ${Semantic.infoBorder}`,
          }}
          role="tooltip"
        >
          <div className="font-medium">{personName}</div>
          <div style={{ color: '#B5BDC4' }}>{projectName} · {quarter}</div>
          <div className="mt-1 font-semibold" style={{ color: Accent.teal }}>{days} days</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CapacityBar — parent row summary bar (colour-coded utilisation)
// ─────────────────────────────────────────────────────────────────────────────

export interface CapacityBarProps {
  /** Days used (assigned in this plan for this quarter) */
  usedDays: number;
  /** Total available workdays in the quarter */
  totalDays: number;
  /** Show the label inside the bar */
  showLabel?: boolean;
}

function capacityBarColor(pct: number): string {
  if (pct >= 90) return Semantic.danger;
  if (pct >= 70) return Semantic.warning;
  return Semantic.success;
}

export function CapacityBar({ usedDays, totalDays, showLabel = false }: CapacityBarProps) {
  const pct = totalDays > 0 ? Math.round((usedDays / totalDays) * 100) : 0;
  const color = capacityBarColor(pct);
  const widthPct = `${Math.min(pct, 100)}%`;

  return (
    <div
      className="relative h-2 rounded-full overflow-hidden"
      style={{ backgroundColor: 'rgba(0,0,0,0.06)', minWidth: 48 }}
      title={`${usedDays}d / ${totalDays}d (${pct}%)`}
      aria-label={`${pct}% capacity used`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
        style={{ width: widthPct, backgroundColor: color }}
      />
      {showLabel && (
        <span
          className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold"
          style={{ color: pct > 50 ? '#fff' : Text.secondary }}
        >
          {pct}%
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StaffingBar — project row summary bar (assigned vs needed)
// ─────────────────────────────────────────────────────────────────────────────

export interface StaffingBarProps {
  assignedDays: number;
  neededDays: number;
}

function staffingBarColor(pct: number): string {
  if (pct >= 90) return Semantic.success;
  if (pct >= 50) return Semantic.warning;
  return Semantic.danger;
}

export function StaffingBar({ assignedDays, neededDays }: StaffingBarProps) {
  const pct = neededDays > 0 ? Math.round((assignedDays / neededDays) * 100) : 0;
  const color = staffingBarColor(pct);
  const widthPct = `${Math.min(pct, 100)}%`;

  return (
    <div
      className="relative h-2 rounded-full overflow-hidden"
      style={{ backgroundColor: 'rgba(0,0,0,0.06)', minWidth: 48 }}
      title={`${assignedDays}d assigned / ${neededDays}d needed (${pct}%)`}
      aria-label={`${pct}% staffed`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
        style={{ width: widthPct, backgroundColor: color }}
      />
    </div>
  );
}
