import type { DependencyArrow } from '../../utils/portfolioGeometry';

interface DependencyArrowPathProps extends DependencyArrow {
  onDelete: (id: string) => void;
  linkModeActive: boolean;
}

/**
 * Renders a single finish-to-start dependency arrow as an SVG cubic bezier path.
 * The arrow is grey when satisfied and red when violated (dependent starts before predecessor ends).
 * Clicking the arrow (when not in link mode) triggers deletion.
 */
export function DependencyArrowPath({
  id, x1, y1, x2, y2, violated, onDelete, linkModeActive,
}: DependencyArrowPathProps) {
  const dx = Math.abs(x2 - x1);
  const cp = Math.max(40, dx * 0.45);
  const d = `M${x1} ${y1} C${x1 + cp} ${y1},${x2 - cp} ${y2},${x2} ${y2}`;
  const markerId = violated ? 'dep-arrow-red' : 'dep-arrow-gray';
  const strokeColor = violated ? '#EF4444' : '#94A3B8';

  return (
    <g pointerEvents={linkModeActive ? 'none' : 'visibleStroke'}>
      {/* Wide transparent hit area for easy clicking */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={10}
        style={{ cursor: 'pointer' }}
        onClick={() => onDelete(id)}
        aria-label="Remove dependency link"
        role="button"
      />
      {/* Visible bezier arrow */}
      <path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        markerEnd={`url(#${markerId})`}
        strokeDasharray={violated ? '4 3' : undefined}
      />
    </g>
  );
}
