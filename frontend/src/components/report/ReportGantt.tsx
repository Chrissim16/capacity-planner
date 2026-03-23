import { useMemo } from 'react';
import type { PlannerItem, JiraWorkItem, TeamMember, Sprint } from '../../types';
import { GanttBar } from '../../theme/tokens';

export interface ReportGanttProps {
  plannerItems: PlannerItem[];
  jiraItems: JiraWorkItem[];
  quarters: string[];
  teamMembers: TeamMember[];
  sprints: Sprint[];
}

// ── Pure geometry helper (exported for testing) ───────────────────────────────

export interface EpicBarGeometry {
  leftPct: number;
  widthPct: number;
  /** Index of the quarter the epic starts in (−1 when outside the displayed range) */
  startIdx: number;
  /** Index of the quarter the epic ends in (−1 when outside the displayed range) */
  endIdx: number;
}

/**
 * Maps a PlannerItem's startSprint/spanSprints to percentage-based bar
 * coordinates over the displayed `quarters` range.
 * Returns null when the epic has no overlap with any displayed quarter.
 */
export function computeEpicBarGeometry(
  item: PlannerItem,
  sprints: Sprint[],
  quarters: string[],
): EpicBarGeometry | null {
  if (quarters.length === 0) return null;

  const sprintMap = new Map<number, Sprint>();
  for (const s of sprints) sprintMap.set(s.number, s);

  const firstSprint = sprintMap.get(item.startSprint);
  const lastSprint = sprintMap.get(item.startSprint + item.spanSprints - 1)
    ?? sprintMap.get(item.startSprint); // fallback: single sprint

  const startQ = firstSprint?.quarter ?? null;
  const endQ = lastSprint?.quarter ?? null;

  const startIdx = startQ ? quarters.indexOf(startQ) : -1;
  let endIdx = endQ ? quarters.indexOf(endQ) : -1;

  // Both out of range → nothing to render
  if (startIdx === -1 && endIdx === -1) return null;

  // Clamp to displayed range
  const clampedStart = Math.max(0, startIdx === -1 ? 0 : startIdx);
  const clampedEnd = Math.min(quarters.length - 1, endIdx === -1 ? quarters.length - 1 : endIdx);

  const leftPct = (clampedStart / quarters.length) * 100;
  const widthPct = ((clampedEnd - clampedStart + 1) / quarters.length) * 100;

  return { leftPct, widthPct, startIdx, endIdx };
}

// ── Status helpers ────────────────────────────────────────────────────────────

type EpicStatus = 'Active' | 'At Risk' | 'Done' | 'Planned';

function deriveStatus(item: PlannerItem, jiraItem: JiraWorkItem | undefined): EpicStatus {
  if (jiraItem?.statusCategory === 'done') return 'Done';
  if (item.assignees.length === 0) return 'At Risk';
  if (jiraItem?.statusCategory === 'in_progress') return 'Active';
  return 'Planned';
}

const STATUS_STYLES: Record<EpicStatus, string> = {
  Active:   'bg-[#DCFCE7] text-[#16A34A]',
  'At Risk':'bg-[#FEE2E2] text-[#DC2626]',
  Done:     'bg-[#F0F2F5] text-[#94A3B8]',
  Planned:  'bg-[#E6F2FC] text-[#0089DD]',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ReportGantt({ plannerItems, jiraItems, quarters, teamMembers, sprints }: ReportGanttProps) {
  const jiraByKey = useMemo(() => {
    const m = new Map<string, JiraWorkItem>();
    for (const w of jiraItems) m.set(w.jiraKey, w);
    return m;
  }, [jiraItems]);

  const memberById = useMemo(() => {
    const m = new Map<string, TeamMember>();
    for (const tm of teamMembers) m.set(tm.id, tm);
    return m;
  }, [teamMembers]);

  const epics = useMemo(
    () => plannerItems.filter(item => item.type === 'epic'),
    [plannerItems],
  );

  if (epics.length === 0) {
    return (
      <p className="text-sm text-[#94A3B8] italic">No epics in this scenario.</p>
    );
  }

  const barStyle = GanttBar.epic;

  return (
    <div className="space-y-4">
      {/* Gantt grid */}
      <div className="w-full overflow-x-auto">
        {/* Quarter header */}
        <div className="flex" style={{ minWidth: `${quarters.length * 120}px` }}>
          <div className="shrink-0 w-[220px]" />
          {quarters.map(q => (
            <div
              key={q}
              className="flex-1 text-center text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider pb-2 border-b border-[#DEDFE3]"
            >
              {q}
            </div>
          ))}
        </div>

        {/* Epic rows */}
        {epics.map(item => {
          const jiraItem = item.jiraKey ? jiraByKey.get(item.jiraKey) : undefined;
          const status = deriveStatus(item, jiraItem);
          const geo = computeEpicBarGeometry(item, sprints, quarters);
          const noStaff = item.assignees.length === 0;

          return (
            <div
              key={item.id}
              className="flex items-center border-b border-[#F0F2F5] py-2"
              style={{ minWidth: `${quarters.length * 120}px` }}
            >
              {/* Label column */}
              <div className="shrink-0 w-[220px] flex items-center gap-2 pr-3">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[status]}`}>
                  {status}
                </span>
                <span className="text-sm text-[#1E293B] truncate" title={item.name}>
                  {item.name}
                </span>
              </div>

              {/* Bar track */}
              <div className="flex-1 relative h-7">
                {geo && (
                  <div
                    className="absolute inset-y-1 flex items-center"
                    style={{
                      left: `${geo.leftPct}%`,
                      width: `${geo.widthPct}%`,
                    }}
                  >
                    <div
                      className="h-full w-full flex items-center px-2 gap-1.5"
                      style={{
                        background: barStyle.bg,
                        border: `${barStyle.borderW}px solid ${barStyle.border}`,
                        borderRadius: barStyle.radius,
                      }}
                    >
                      {noStaff && (
                        <span className="text-[10px] font-medium text-[#D97706] whitespace-nowrap">
                          ⚠ no staff
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail table */}
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #DEDFE3' }}>
            {['Epic', 'Status', 'Starts', 'Ends', 'Assigned members'].map(h => (
              <th
                key={h}
                className="text-left py-2 pr-4 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {epics.map(item => {
            const jiraItem = item.jiraKey ? jiraByKey.get(item.jiraKey) : undefined;
            const status = deriveStatus(item, jiraItem);
            const geo = computeEpicBarGeometry(item, sprints, quarters);

            const startLabel = geo && geo.startIdx >= 0 ? quarters[geo.startIdx] : '—';
            const endLabel = geo && geo.endIdx >= 0 ? quarters[geo.endIdx] : '—';

            const assignedNames = item.assignees
              .map(a => memberById.get(a.memberId)?.name)
              .filter(Boolean)
              .join(', ') || '(none)';

            return (
              <tr key={item.id} style={{ borderBottom: '1px solid #F0F2F5' }}>
                <td className="py-2 pr-4 font-medium text-[#1E293B] max-w-[200px] truncate">{item.name}</td>
                <td className="py-2 pr-4">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-[#94A3B8]">{startLabel}</td>
                <td className="py-2 pr-4 text-[#94A3B8]">{endLabel}</td>
                <td className="py-2 text-[#1E293B]">
                  {assignedNames}
                  {item.assignees.length === 0 && (
                    <span className="ml-1 text-[#D97706]">⚠</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
