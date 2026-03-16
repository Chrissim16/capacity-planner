/**
 * PlanningGrid — Gantt-style resource grid for the Planning Board v2.1.
 *
 * Supports two views:
 *  - People view: rows = team members, child rows = their project assignments per quarter
 *  - Projects view: rows = projects/Jira epics, child rows = people assigned per quarter
 *
 * v2.1 improvements:
 *  - Inline "+ Assign" rows removed; hover `+` button on label cells instead
 *  - Project row headers are draggable (canvas-project) for drag-to-remove
 *  - Person child-rows within project rows are draggable (canvas-member) for drag-to-remove
 *  - Person rows in People view are droppable for sidebar-project drags
 *  - Granularity toggle: Quarter / Month / Week column headers
 */
import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus, GripVertical } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { useAppStore, useCurrentState } from '../../stores/appStore';
import {
  addAssignment,
  removeAssignment,
  addProject,
} from '../../stores/actions';
import { getWorkdaysInQuarter, getWorkdaysInDateRange, getHolidaysByCountry } from '../../utils/calendar';
import type { PublicHoliday } from '../../types';
import { FIT_GLOW } from '../../utils/staffing';
import type { FitLevel } from '../../utils/staffing';
import { useToast } from '../ui/Toast';
import { PlanningBar, CapacityBar, StaffingBar } from './PlanningBar';
import { AssignPopover, ITBizBadge } from './AssignPopover';
import type { Assignment, JiraWorkItem, Project } from '../../types';
import { Accent, Background, Border, Text } from '../../theme/tokens';

const LABEL_WIDTH = 240;
const QUARTER_COL_WIDTH = 200;
const MONTH_COL_WIDTH = 120;
const WEEK_COL_WIDTH = 80;

export type PlanningViewMode = 'people' | 'projects';
export type PlanningGranularity = 'quarter' | 'month' | 'week';

// ─────────────────────────────────────────────────────────────────────────────
// Timeline column helpers
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineColumn {
  key: string;
  label: string;
  /** Which quarter this column belongs to — used to map assignments */
  quarter: string;
  /** Group label shown above a run of columns (e.g. "Q1 2026" over month columns) */
  groupLabel?: string;
  /** Whether this column is the first in its group — triggers group label rendering */
  isGroupStart?: boolean;
  /** True for the first column that belongs to each quarter — used to render quarter-level assignments once in sub-quarter views */
  isQuarterStart?: boolean;
  width: number;
}

/** Maps a quarter string like "Q1 2026" → array of "Jan 26" / "Feb 26" / "Mar 26" */
function quarterToMonthLabels(quarter: string): string[] {
  const match = quarter.match(/Q(\d) (\d{4})/);
  if (!match) return [];
  const q = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  const yearStr = String(year).slice(2);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const start = (q - 1) * 3;
  return monthNames.slice(start, start + 3).map(m => `${m} ${yearStr}`);
}

function buildMonthColumns(quarters: string[]): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  for (const q of quarters) {
    const months = quarterToMonthLabels(q);
    months.forEach((label, i) => {
      cols.push({
        key: `${q}::${label}`,
        label,
        quarter: q,
        groupLabel: q,
        isGroupStart: i === 0,
        isQuarterStart: i === 0,
        width: MONTH_COL_WIDTH,
      });
    });
  }
  return cols;
}

/** Generates 16 consecutive week columns starting from the Monday of the current week */
function buildWeekColumns(): TimelineColumn[] {
  const today = new Date();
  // Find the Monday of the current week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const cols: TimelineColumn[] = [];
  let prevMonth = -1;
  let prevQuarter = '';

  for (let i = 0; i < 16; i++) {
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() + i * 7);
    const m = weekStart.getMonth();
    const yr = weekStart.getFullYear();

    // Week number within the month (1-based)
    const firstDayOfMonth = new Date(yr, m, 1);
    const weekOfMonth = Math.ceil((weekStart.getDate() + ((firstDayOfMonth.getDay() + 6) % 7)) / 7);

    const label = `W${weekOfMonth} ${monthNames[m]}`;
    const monthStr = `${monthNames[m]} ${String(yr).slice(2)}`;

    // Derive quarter
    const q = Math.floor(m / 3) + 1;
    const quarter = `Q${q} ${yr}`;

    cols.push({
      key: `week-${yr}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`,
      label,
      quarter,
      groupLabel: monthStr,
      isGroupStart: m !== prevMonth,
      isQuarterStart: quarter !== prevQuarter,
      width: WEEK_COL_WIDTH,
    });
    prevMonth = m;
    prevQuarter = quarter;
  }
  return cols;
}

function buildQuarterColumns(quarters: string[]): TimelineColumn[] {
  return quarters.slice(0, 6).map(q => ({
    key: q,
    label: q,
    quarter: q,
    isQuarterStart: true,
    width: QUARTER_COL_WIDTH,
  }));
}

function buildColumns(granularity: PlanningGranularity, quarters: string[]): TimelineColumn[] {
  if (granularity === 'month') return buildMonthColumns(quarters.slice(0, 4));
  if (granularity === 'week') return buildWeekColumns();
  return buildQuarterColumns(quarters);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  Accent.teal, '#6366F1', '#F59E0B', '#EC4899', '#10B981', '#8B5CF6',
  '#DC2626', '#14B8A6', '#D97706', '#3B82F6',
];

function projectColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) & 0xffffffff;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-quarter bar helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns the ISO start/end dates for a given timeline column, or null for quarter view. */
function getColumnDateRange(col: TimelineColumn, granularity: PlanningGranularity): { start: string; end: string } | null {
  if (granularity === 'week') {
    const match = col.key.match(/^week-(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const yr = parseInt(match[1], 10);
    const mo = parseInt(match[2], 10) - 1; // 0-indexed
    const dy = parseInt(match[3], 10);
    const start = new Date(yr, mo, dy);
    const end = new Date(yr, mo, dy + 6); // Sunday of the week
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }
  if (granularity === 'month') {
    // key = "Q1 2026::Jan 26"
    const parts = col.key.split('::');
    if (parts.length < 2) return null;
    const label = parts[1]; // "Jan 26"
    const labelParts = label.split(' ');
    if (labelParts.length < 2) return null;
    const monthIdx = MONTH_NAMES_SHORT.indexOf(labelParts[0]);
    const year = 2000 + parseInt(labelParts[1], 10);
    if (monthIdx < 0 || isNaN(year)) return null;
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();
    return {
      start: `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Jira hierarchy helpers
// ─────────────────────────────────────────────────────────────────────────────

interface JiraTreeNode {
  item: JiraWorkItem;
  children: JiraTreeNode[];
}

function buildJiraTree(items: JiraWorkItem[]): JiraTreeNode[] {
  const byKey = new Map<string, JiraTreeNode>();
  for (const item of items) {
    if (item.statusCategory === 'done') continue;
    byKey.set(item.jiraKey, { item, children: [] });
  }
  const roots: JiraTreeNode[] = [];
  for (const node of byKey.values()) {
    const parentKey = node.item.parentKey;
    if (parentKey && byKey.has(parentKey)) {
      byKey.get(parentKey)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ─────────────────────────────────────────────────────────────────────────────
// People View
// ─────────────────────────────────────────────────────────────────────────────

interface PeopleRowProps {
  memberId: string;
  columns: TimelineColumn[];
  granularity: PlanningGranularity;
  assignments: Assignment[];
  projects: Project[];
  jiraWorkItems: JiraWorkItem[];
  /** Fit level for glow when a sidebar-project is being dragged onto this row */
  dragScore?: FitLevel;
}

function PeopleRow({ memberId, columns, granularity, assignments, projects, jiraWorkItems, dragScore }: PeopleRowProps) {
  const state = useCurrentState();
  const publicHolidays = useAppStore(useShallow(s => s.data.publicHolidays));
  const member = state.teamMembers.find(m => m.id === memberId);
  const [expanded, setExpanded] = useState(true);
  const [assigningQuarter, setAssigningQuarter] = useState<string | null>(null);
  const { showToast } = useToast();

  // Droppable for sidebar-project drags
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `person-row-${memberId}`,
    data: { type: 'person-row', memberId },
  });

  if (!member) return null;

  const memberHolidays = getHolidaysByCountry(member.countryId, publicHolidays);
  const memberAssignments = assignments.filter(a => a.memberId === memberId);
  const assignedProjectIds = useMemo(() =>
    new Set(memberAssignments.map(a => a.projectId)),
    [memberAssignments]
  );

  // Unique quarters for this member (used for the AssignPopover)
  const uniqueQuarters = useMemo(
    () => [...new Set(columns.map(c => c.quarter))],
    [columns]
  );

  const handleAssign = useCallback((quarter: string, projectId: string, days: number, startDate?: string, endDate?: string) => {
    addAssignment({ memberId, projectId, quarter, days, startDate, endDate });
    setAssigningQuarter(null);
  }, [memberId]);

  const resolveProjectName = useCallback((projectId: string): string => {
    const native = projects.find(p => p.id === projectId);
    if (native) return native.name;
    const jira = jiraWorkItems.find(w => w.jiraKey === projectId);
    return jira ? `${jira.jiraKey}: ${jira.summary}` : projectId;
  }, [projects, jiraWorkItems]);

  const handleRemoveAssignment = useCallback((assignment: Assignment) => {
    removeAssignment(assignment.id);
    showToast(
      `Removed ${assignment.days}d from ${resolveProjectName(assignment.projectId)}`,
      {
        type: 'info',
        action: { label: 'Undo', onClick: () => addAssignment({ ...assignment }) },
      }
    );
  }, [resolveProjectName, showToast]);

  const handleEditAssignment = useCallback((assignment: Assignment, newDays: number) => {
    removeAssignment(assignment.id);
    addAssignment({ ...assignment, days: newDays });
  }, []);

  const firstQuarter = uniqueQuarters[0] ?? '';

  return (
    <>
      {/* Parent row */}
      <div
        ref={setDropRef}
        className={clsx(
          'flex border-b transition-colors hover:bg-[#F0F2F5] group',
          dragScore && (isOver ? 'ring-2 ring-inset ring-mileway-light-blue' : FIT_GLOW[dragScore]),
          isOver && !dragScore && 'ring-2 ring-inset ring-mileway-light-blue',
        )}
        style={{ borderColor: Border.subtle }}
      >
        {/* Label cell */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 shrink-0 cursor-pointer select-none relative"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
          onClick={() => setExpanded(v => !v)}
          role="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${member.name}`}
        >
          <span style={{ color: Text.tertiary }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="text-sm font-medium truncate flex-1" style={{ color: Text.primary }}>{member.name}</span>
          <ITBizBadge type="it" />
          {/* Hover + button */}
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:bg-[#E6F2FC] focus:ring-2 focus:ring-mileway-light-blue shrink-0"
            style={{ color: Accent.teal }}
            onClick={(e) => { e.stopPropagation(); setAssigningQuarter(firstQuarter); }}
            aria-label="Assign a project"
            title="Assign a project"
          >
            <Plus size={12} />
          </button>
          {/* Popover for hover + button */}
          {assigningQuarter && (
            <AssignPopover
              mode="project"
              quarter={assigningQuarter}
              memberId={memberId}
              assignedProjectIds={new Set(memberAssignments.filter(a => a.quarter === assigningQuarter).map(a => a.projectId))}
              onAssign={(projectId, days, startDate, endDate) => handleAssign(assigningQuarter, projectId, days, startDate, endDate)}
              onClose={() => setAssigningQuarter(null)}
            />
          )}
        </div>

        {/* Quarter/month/week cells — capacity bars */}
        {columns.map(col => {
          const totalDays = getWorkdaysInQuarter(col.quarter, memberHolidays);
          const usedDays = memberAssignments
            .filter(a => a.quarter === col.quarter)
            .reduce((s, a) => s + a.days, 0);

          return (
            <div
              key={col.key}
              className="flex items-center px-3"
              style={{ width: col.width, minWidth: col.width, borderRight: `1px solid ${Border.subtle}` }}
            >
              {granularity === 'quarter' ? (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px]" style={{ color: Text.tertiary }}>
                      {usedDays > 0 ? `${usedDays}d / ${totalDays}d` : `${totalDays}d`}
                    </span>
                  </div>
                  <CapacityBar usedDays={usedDays} totalDays={totalDays} />
                </div>
              ) : (
                usedDays > 0 ? (
                  <span className="text-[10px]" style={{ color: Text.tertiary }}>{usedDays}d</span>
                ) : null
              )}
            </div>
          );
        })}
      </div>

      {/* Child rows — project assignments */}
      {expanded && (
        <>
          {Array.from(assignedProjectIds).map(projectId => {
            const nativeProject = projects.find(p => p.id === projectId);
            const jiraItem = !nativeProject ? jiraWorkItems.find(w => w.jiraKey === projectId) : null;
            if (!nativeProject && !jiraItem) return null;
            const displayName = nativeProject?.name ?? `${jiraItem!.jiraKey}: ${jiraItem!.summary}`;
            const color = projectColor(projectId);

            return (
              <div
                key={projectId}
                className="flex border-b"
                style={{ borderColor: Border.light, backgroundColor: Background.secondary }}
              >
                {/* Label cell */}
                <div
                  className="flex items-center gap-2 pl-8 pr-3 py-2"
                  style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.light}`, borderLeft: `3px solid ${color}` }}
                >
                  <span className="text-xs truncate" style={{ color: Text.secondary }}>{displayName}</span>
                </div>

                {/* Column cells — assignment bars */}
                {columns.map(col => {
                  const assignment = memberAssignments.find(
                    a => a.projectId === projectId && a.quarter === col.quarter
                  );
                  const totalDays = getWorkdaysInQuarter(col.quarter, memberHolidays);

                  let barNode: ReactNode = null;
                  if (assignment) {
                    if (granularity === 'quarter') {
                      barNode = (
                        <PlanningBar
                          days={assignment.days}
                          quarter={col.quarter}
                          personName={member.name}
                          projectName={displayName}
                          color={color}
                          widthFraction={totalDays > 0 ? assignment.days / totalDays : 0.1}
                          onEdit={(newDays) => handleEditAssignment(assignment, newDays)}
                          onRemove={() => handleRemoveAssignment(assignment)}
                        />
                      );
                    } else if (assignment.startDate && assignment.endDate) {
                      const colRange = getColumnDateRange(col, granularity);
                      if (colRange) {
                        const oStart = colRange.start > assignment.startDate ? colRange.start : assignment.startDate;
                        const oEnd = colRange.end < assignment.endDate ? colRange.end : assignment.endDate;
                        if (oStart <= oEnd) {
                          const colWd = getWorkdaysInDateRange(colRange.start, colRange.end, memberHolidays);
                          const oWd = getWorkdaysInDateRange(oStart, oEnd, memberHolidays);
                          barNode = (
                            <PlanningBar
                              days={assignment.days}
                              quarter={col.quarter}
                              personName={member.name}
                              projectName={displayName}
                              color={color}
                              widthFraction={colWd > 0 ? oWd / colWd : 0.1}
                              onEdit={(newDays) => handleEditAssignment(assignment, newDays)}
                              onRemove={() => handleRemoveAssignment(assignment)}
                            />
                          );
                        }
                      }
                    } else if (col.isQuarterStart) {
                      barNode = (
                        <PlanningBar
                          days={assignment.days}
                          quarter={col.quarter}
                          personName={member.name}
                          projectName={displayName}
                          color={color}
                          widthFraction={totalDays > 0 ? assignment.days / totalDays : 0.1}
                          onEdit={(newDays) => handleEditAssignment(assignment, newDays)}
                          onRemove={() => handleRemoveAssignment(assignment)}
                        />
                      );
                    }
                  }

                  return (
                    <div
                      key={col.key}
                      className="flex items-center px-3 py-2"
                      style={{ width: col.width, minWidth: col.width, borderRight: `1px solid ${Border.light}` }}
                    >
                      {barNode}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects View
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project: Project;
  columns: TimelineColumn[];
  granularity: PlanningGranularity;
  assignments: Assignment[];
  dragScore?: FitLevel;
  isSelected?: boolean;
  onCanvasProjectDragStart?: (projectId: string, projectName: string) => void;
}

function ProjectRow({ project, columns, granularity, assignments, dragScore, isSelected }: ProjectRowProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: project.id });
  const state = useCurrentState();
  const publicHolidays = useAppStore(useShallow(s => s.data.publicHolidays));
  const [expanded, setExpanded] = useState(true);
  const [assigningQuarter, setAssigningQuarter] = useState<string | null>(null);
  const { showToast } = useToast();
  const color = projectColor(project.id);

  // Canvas-project drag handle
  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `canvas-project-${project.id}`,
    data: { type: 'canvas-project', projectId: project.id, projectName: project.name },
  });

  const projectAssignments = assignments.filter(a => a.projectId === project.id);
  const assignedMemberIds = useMemo(() =>
    new Set(projectAssignments.map(a => a.memberId)),
    [projectAssignments]
  );

  const totalNeededDays = Object.values(project.daysPerQuarter ?? {}).reduce((s, d) => s + d, 0);
  const totalAssignedDays = projectAssignments.reduce((s, a) => s + a.days, 0);
  const uniqueQuarters = useMemo(() => [...new Set(columns.map(c => c.quarter))], [columns]);

  const handleAssign = useCallback((quarter: string, memberId: string, days: number, startDate?: string, endDate?: string) => {
    addAssignment({ memberId, projectId: project.id, quarter, days, startDate, endDate });
    setAssigningQuarter(null);
  }, [project.id]);

  const handleRemoveAssignment = useCallback((assignment: Assignment) => {
    const member = state.teamMembers.find(m => m.id === assignment.memberId);
    removeAssignment(assignment.id);
    showToast(
      `Removed ${assignment.days}d from ${member?.name ?? 'member'}`,
      {
        type: 'info',
        action: { label: 'Undo', onClick: () => addAssignment({ ...assignment }) },
      }
    );
  }, [state.teamMembers, showToast]);

  const handleEditAssignment = useCallback((assignment: Assignment, newDays: number) => {
    removeAssignment(assignment.id);
    addAssignment({ ...assignment, days: newDays });
  }, []);

  const firstQuarter = uniqueQuarters[0] ?? '';

  return (
    <>
      {/* Parent row */}
      <div
        ref={setDropRef}
        className={clsx(
          'flex border-b transition-colors hover:bg-[#F0F2F5] group',
          dragScore && (isOver ? 'ring-2 ring-inset' : FIT_GLOW[dragScore]),
        )}
        style={{
          borderColor: Border.subtle,
          borderLeftColor: isSelected ? Accent.teal : undefined,
          borderLeftWidth: isSelected ? 3 : undefined,
          opacity: isDragging ? 0.4 : 1,
        }}
      >
        {/* Label cell */}
        <div
          ref={setDragRef}
          className="flex items-center gap-2 px-3 py-2.5 shrink-0 select-none relative group/label"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
        >
          {/* Canvas drag handle */}
          <div
            {...dragListeners}
            {...dragAttrs}
            className="opacity-0 group-hover/label:opacity-40 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0"
            style={{ color: Text.tertiary }}
            aria-label="Drag to remove project"
            title="Drag to left sidebar to remove"
          >
            <GripVertical size={13} />
          </div>

          <button
            className="flex items-center gap-2 min-w-0 flex-1 text-left focus:outline-none"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${project.name}`}
          >
            <span style={{ color: Text.tertiary }}>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="text-sm font-medium truncate" style={{ color: Text.primary }}>{project.name}</span>
          </button>

          <span className="text-[10px] shrink-0" style={{ color: Text.tertiary }}>
            {totalAssignedDays}/{totalNeededDays > 0 ? totalNeededDays : '?'}d
          </span>

          {/* Hover + button */}
          <button
            className="opacity-0 group-hover/label:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:bg-[#E6F2FC] focus:ring-2 focus:ring-mileway-light-blue shrink-0"
            style={{ color: Accent.teal }}
            onClick={(e) => { e.stopPropagation(); setAssigningQuarter(firstQuarter); }}
            aria-label="Assign a person"
            title="Assign a person"
          >
            <Plus size={12} />
          </button>

          {/* Popover */}
          {assigningQuarter && (
            <AssignPopover
              mode="person"
              quarter={assigningQuarter}
              projectId={project.id}
              assignedMemberIds={new Set(projectAssignments.filter(a => a.quarter === assigningQuarter).map(a => a.memberId))}
              onAssign={(memberId, days, startDate, endDate) => handleAssign(assigningQuarter, memberId, days, startDate, endDate)}
              onClose={() => setAssigningQuarter(null)}
            />
          )}
        </div>

        {/* Column cells — staffing bars */}
        {columns.map(col => {
          const neededInQ = project.daysPerQuarter?.[col.quarter] ?? 0;
          const assignedInQ = projectAssignments
            .filter(a => a.quarter === col.quarter)
            .reduce((s, a) => s + a.days, 0);

          return (
            <div
              key={col.key}
              className="flex items-center px-3"
              style={{ width: col.width, minWidth: col.width, borderRight: `1px solid ${Border.subtle}` }}
            >
              {granularity === 'quarter' && (neededInQ > 0 || assignedInQ > 0) ? (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px]" style={{ color: Text.tertiary }}>
                      {assignedInQ}d / {neededInQ > 0 ? neededInQ : '?'}d
                    </span>
                  </div>
                  <StaffingBar assignedDays={assignedInQ} neededDays={neededInQ} />
                </div>
              ) : assignedInQ > 0 ? (
                <span className="text-[10px]" style={{ color: Text.tertiary }}>{assignedInQ}d</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Child rows — person assignments */}
      {expanded && (
        Array.from(assignedMemberIds).map(memberId => {
          const member = state.teamMembers.find(m => m.id === memberId);
          if (!member) return null;
          const memberHolidays = getHolidaysByCountry(member.countryId, publicHolidays);

          return (
            <PersonChildRow
              key={memberId}
              memberId={memberId}
              memberName={member.name}
              memberHolidays={memberHolidays}
              projectId={project.id}
              projectName={project.name}
              columns={columns}
              granularity={granularity}
              color={color}
              assignments={projectAssignments}
              onEdit={handleEditAssignment}
              onRemove={handleRemoveAssignment}
            />
          );
        })
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Person child-row — draggable (canvas-member) for drag-to-remove
// ─────────────────────────────────────────────────────────────────────────────

interface PersonChildRowProps {
  memberId: string;
  memberName: string;
  memberHolidays: PublicHoliday[];
  projectId: string;
  projectName: string;
  columns: TimelineColumn[];
  granularity: PlanningGranularity;
  color: string;
  assignments: Assignment[];
  onEdit: (assignment: Assignment, newDays: number) => void;
  onRemove: (assignment: Assignment) => void;
}

function PersonChildRow({
  memberId, memberName, memberHolidays, projectId, projectName,
  columns, granularity, color, assignments, onEdit, onRemove,
}: PersonChildRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas-member-${memberId}-${projectId}`,
    data: { type: 'canvas-member', memberId, memberName, fromProjectId: projectId },
  });
  const style = transform ? { transform: CSS.Transform.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        opacity: isDragging ? 0.3 : 1,
        borderColor: Border.light,
        backgroundColor: Background.secondary,
      }}
      className="flex border-b group/person"
    >
      {/* Label cell */}
      <div
        className="flex items-center gap-2 pl-5 pr-3 py-2"
        style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.light}` }}
      >
        {/* Canvas drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="opacity-0 group-hover/person:opacity-40 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0"
          style={{ color: Text.tertiary }}
          aria-label="Drag to remove from project"
          title="Drag to right sidebar to remove"
        >
          <GripVertical size={12} />
        </div>
        <span className="text-xs truncate" style={{ color: Text.secondary }}>{memberName}</span>
        <ITBizBadge type="it" />
      </div>

      {/* Column cells */}
      {columns.map(col => {
        const assignment = assignments.find(
          a => a.memberId === memberId && a.quarter === col.quarter
        );
        const totalDays = getWorkdaysInQuarter(col.quarter, memberHolidays);

        let barNode: ReactNode = null;
        if (assignment) {
          if (granularity === 'quarter') {
            barNode = (
              <PlanningBar
                days={assignment.days}
                quarter={col.quarter}
                personName={memberName}
                projectName={projectName}
                color={color}
                widthFraction={totalDays > 0 ? assignment.days / totalDays : 0.1}
                onEdit={(newDays) => onEdit(assignment, newDays)}
                onRemove={() => onRemove(assignment)}
              />
            );
          } else if (assignment.startDate && assignment.endDate) {
            const colRange = getColumnDateRange(col, granularity);
            if (colRange) {
              const oStart = colRange.start > assignment.startDate ? colRange.start : assignment.startDate;
              const oEnd = colRange.end < assignment.endDate ? colRange.end : assignment.endDate;
              if (oStart <= oEnd) {
                const colWd = getWorkdaysInDateRange(colRange.start, colRange.end, memberHolidays);
                const oWd = getWorkdaysInDateRange(oStart, oEnd, memberHolidays);
                barNode = (
                  <PlanningBar
                    days={assignment.days}
                    quarter={col.quarter}
                    personName={memberName}
                    projectName={projectName}
                    color={color}
                    widthFraction={colWd > 0 ? oWd / colWd : 0.1}
                    onEdit={(newDays) => onEdit(assignment, newDays)}
                    onRemove={() => onRemove(assignment)}
                  />
                );
              }
            }
          } else if (col.isQuarterStart) {
            barNode = (
              <PlanningBar
                days={assignment.days}
                quarter={col.quarter}
                personName={memberName}
                projectName={projectName}
                color={color}
                widthFraction={totalDays > 0 ? assignment.days / totalDays : 0.1}
                onEdit={(newDays) => onEdit(assignment, newDays)}
                onRemove={() => onRemove(assignment)}
              />
            );
          }
        }

        return (
          <div
            key={col.key}
            className="flex items-center px-3 py-2"
            style={{ width: col.width, minWidth: col.width, borderRight: `1px solid ${Border.light}` }}
          >
            {barNode}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Jira Epic Row (Projects view — Jira-sourced work items)
// ─────────────────────────────────────────────────────────────────────────────

interface JiraEpicRowProps {
  item: JiraWorkItem;
  /** Child Jira items (features, stories) to render when this row is expanded */
  childNodes?: JiraTreeNode[];
  columns: TimelineColumn[];
  granularity: PlanningGranularity;
  assignments: Assignment[];
  dragScore?: FitLevel;
  isSelected?: boolean;
  /** Left indent in px — 0 for epics, 24 for features, 48 for stories */
  indentPx?: number;
}

function JiraEpicRow({ item, childNodes = [], columns, granularity, assignments, dragScore, isSelected, indentPx = 0 }: JiraEpicRowProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: item.jiraKey });
  const state = useCurrentState();
  const publicHolidays = useAppStore(useShallow(s => s.data.publicHolidays));
  // Epics (indentPx=0) start expanded; features/stories start collapsed
  const [expanded, setExpanded] = useState(indentPx === 0);
  const [assigningQuarter, setAssigningQuarter] = useState<string | null>(null);
  const { showToast } = useToast();
  const color = projectColor(item.jiraKey);

  // Canvas-project drag handle
  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `canvas-project-${item.jiraKey}`,
    data: { type: 'canvas-project', projectId: item.jiraKey, projectName: `${item.jiraKey}: ${item.summary}` },
  });

  const epicAssignments = assignments.filter(a => a.projectId === item.jiraKey);
  const assignedMemberIds = useMemo(() =>
    new Set(epicAssignments.map(a => a.memberId)),
    [epicAssignments]
  );

  const totalAssignedDays = epicAssignments.reduce((s, a) => s + a.days, 0);
  const displayName = `${item.jiraKey}: ${item.summary}`;
  const uniqueQuarters = useMemo(() => [...new Set(columns.map(c => c.quarter))], [columns]);

  const handleAssign = useCallback((quarter: string, memberId: string, days: number, startDate?: string, endDate?: string) => {
    addAssignment({ memberId, projectId: item.jiraKey, quarter, days, startDate, endDate });
    setAssigningQuarter(null);
  }, [item.jiraKey]);

  const handleRemoveAssignment = useCallback((assignment: Assignment) => {
    const member = state.teamMembers.find(m => m.id === assignment.memberId);
    removeAssignment(assignment.id);
    showToast(
      `Removed ${assignment.days}d from ${member?.name ?? 'member'}`,
      {
        type: 'info',
        action: { label: 'Undo', onClick: () => addAssignment({ ...assignment }) },
      }
    );
  }, [state.teamMembers, showToast]);

  const handleEditAssignment = useCallback((assignment: Assignment, newDays: number) => {
    removeAssignment(assignment.id);
    addAssignment({ ...assignment, days: newDays });
  }, []);

  const firstQuarter = uniqueQuarters[0] ?? '';

  return (
    <>
      {/* Parent row */}
      <div
        ref={setDropRef}
        className={clsx(
          'flex border-b transition-colors hover:bg-[#F0F2F5] group',
          dragScore && (isOver ? 'ring-2 ring-inset' : FIT_GLOW[dragScore]),
        )}
        style={{
          borderColor: Border.subtle,
          borderLeftColor: isSelected ? Accent.teal : undefined,
          borderLeftWidth: isSelected ? 3 : undefined,
          opacity: isDragging ? 0.4 : 1,
        }}
      >
        <div
          ref={setDragRef}
          className="flex items-center gap-2 px-3 py-2.5 shrink-0 select-none group/label relative"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}`, paddingLeft: indentPx > 0 ? indentPx + 8 : undefined }}
        >
          {/* Canvas drag handle */}
          <div
            {...dragListeners}
            {...dragAttrs}
            className="opacity-0 group-hover/label:opacity-40 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0"
            style={{ color: Text.tertiary }}
            aria-label="Drag to remove epic"
            title="Drag to left sidebar to remove"
          >
            <GripVertical size={13} />
          </div>

          <button
            className="flex items-center gap-2 min-w-0 flex-1 text-left focus:outline-none"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${displayName}`}
          >
            <span style={{ color: Text.tertiary }}>
              {(childNodes.length > 0 || assignedMemberIds.size > 0)
                ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                : <span style={{ display: 'inline-block', width: 14 }} />}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate" style={{ color: Text.primary }}>{item.summary}</span>
              <span className="text-[10px]" style={{ color: Text.tertiary }}>{item.jiraKey}</span>
            </div>
          </button>

          <span className="text-[10px] shrink-0" style={{ color: Text.tertiary }}>
            {totalAssignedDays}d
          </span>

          {/* Hover + button */}
          <button
            className="opacity-0 group-hover/label:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded hover:bg-[#E6F2FC] focus:ring-2 focus:ring-mileway-light-blue shrink-0"
            style={{ color: Accent.teal }}
            onClick={(e) => { e.stopPropagation(); setAssigningQuarter(firstQuarter); }}
            aria-label="Assign a person"
            title="Assign a person"
          >
            <Plus size={12} />
          </button>

          {assigningQuarter && (
            <AssignPopover
              mode="person"
              quarter={assigningQuarter}
              projectId={item.jiraKey}
              assignedMemberIds={new Set(epicAssignments.filter(a => a.quarter === assigningQuarter).map(a => a.memberId))}
              onAssign={(memberId, days, startDate, endDate) => handleAssign(assigningQuarter, memberId, days, startDate, endDate)}
              onClose={() => setAssigningQuarter(null)}
            />
          )}
        </div>

        {columns.map(col => {
          const assignedInQ = epicAssignments.filter(a => a.quarter === col.quarter).reduce((s, a) => s + a.days, 0);
          return (
            <div
              key={col.key}
              className="flex items-center px-3"
              style={{ width: col.width, minWidth: col.width, borderRight: `1px solid ${Border.subtle}` }}
            >
              {assignedInQ > 0 && (
                <span className="text-[10px]" style={{ color: Text.tertiary }}>{assignedInQ}d assigned</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Child rows */}
      {expanded && (
        <>
          {/* Jira sub-items (features → stories) rendered recursively */}
          {childNodes.map(child => (
            <JiraEpicRow
              key={child.item.jiraKey}
              item={child.item}
              childNodes={child.children}
              columns={columns}
              granularity={granularity}
              assignments={assignments}
              indentPx={indentPx + 24}
            />
          ))}
          {/* People assigned directly to this item */}
          {Array.from(assignedMemberIds).map(memberId => {
            const member = state.teamMembers.find(m => m.id === memberId);
            if (!member) return null;
            const memberHolidays = getHolidaysByCountry(member.countryId, publicHolidays);

            return (
              <PersonChildRow
                key={memberId}
                memberId={memberId}
                memberName={member.name}
                memberHolidays={memberHolidays}
                projectId={item.jiraKey}
                projectName={displayName}
                columns={columns}
                granularity={granularity}
                color={color}
                assignments={epicAssignments}
                onEdit={handleEditAssignment}
                onRemove={handleRemoveAssignment}
              />
            );
          })}
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Project row (Projects view)
// ─────────────────────────────────────────────────────────────────────────────

function AddProjectRow({ columns, isBaseline }: { columns: TimelineColumn[]; isBaseline: boolean }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addProject({
      name: trimmed,
      priority: 'medium',
      requiredSkillIds: [],
      daysPerQuarter: {},
    });
    setName('');
    setAdding(false);
  }, [name]);

  if (isBaseline) {
    return (
      <div className="flex border-b" style={{ borderColor: Border.subtle }}>
        <div
          className="flex items-center px-3 py-2"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
        >
          <span className="text-xs" style={{ color: Text.tertiary }}>
            This plan is the active baseline and cannot be edited. Duplicate it to make changes.
          </span>
        </div>
        {columns.map(col => (
          <div
            key={col.key}
            style={{ width: col.width, minWidth: col.width, borderRight: `1px solid ${Border.subtle}` }}
          />
        ))}
      </div>
    );
  }

  if (!adding) {
    return (
      <div className="flex border-b" style={{ borderColor: Border.subtle }}>
        <div
          className="flex items-center px-3 py-2"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
        >
          <button
            className="flex items-center gap-1.5 text-xs transition-colors hover:text-mileway-light-blue focus:ring-2 focus:ring-mileway-light-blue rounded"
            style={{ color: Text.tertiary }}
            onClick={() => setAdding(true)}
          >
            <Plus size={12} />
            Add project
          </button>
        </div>
        {columns.map(col => (
          <div
            key={col.key}
            style={{ width: col.width, minWidth: col.width, borderRight: `1px solid ${Border.subtle}` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex border-b"
      style={{ borderColor: Border.subtle, backgroundColor: Background.highlight }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
      >
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') setAdding(false);
          }}
          onBlur={() => { if (!name.trim()) setAdding(false); }}
          placeholder="Project name…"
          className="flex-1 text-sm outline-none bg-transparent border-b focus:border-mileway-light-blue"
          style={{ borderColor: Border.subtle, color: Text.primary }}
        />
        <button
          className="text-xs font-medium focus:ring-2 focus:ring-mileway-light-blue rounded px-1"
          style={{ color: Accent.teal }}
          onClick={handleAdd}
          disabled={!name.trim()}
        >
          Add
        </button>
      </div>
      {columns.map(col => (
        <div
          key={col.key}
          style={{ width: col.width, minWidth: col.width, borderRight: `1px solid ${Border.subtle}` }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanningGrid
// ─────────────────────────────────────────────────────────────────────────────

interface PlanningGridProps {
  viewMode: PlanningViewMode;
  granularity: PlanningGranularity;
  /** Fit scores keyed by project.id or jiraKey — drives glow rings on droppable rows */
  dragScores?: Record<string, FitLevel>;
  /** Fit scores keyed by member.id — drives glow rings on person rows (People view) */
  memberDragScores?: Record<string, FitLevel>;
  /** Project/jira id to highlight with a teal left border (from left sidebar click) */
  selectedProjectId?: string | null;
  /** Whether the active scenario is a true baseline (disables addProject) */
  isBaseline?: boolean;
}

export function PlanningGrid({
  viewMode,
  granularity,
  dragScores,
  memberDragScores,
  selectedProjectId,
  isBaseline = false,
}: PlanningGridProps) {
  const state = useCurrentState();
  const quarters = useAppStore(useShallow(s => s.data.quarters));

  const members = useMemo(
    () => state.teamMembers.filter(m => !m.excludedFromCapacity),
    [state.teamMembers]
  );
  const projects = state.projects ?? [];
  const assignments = state.assignments ?? [];
  // All non-done Jira items (epics + features + stories if synced)
  const jiraItems = useMemo(
    () => (state.jiraWorkItems ?? []).filter(w => w.statusCategory !== 'done'),
    [state.jiraWorkItems]
  );
  // Hierarchical tree — roots are epics (or any item without a parent in the set)
  const jiraTree = useMemo(() => buildJiraTree(jiraItems), [jiraItems]);

  const columns = useMemo(
    () => buildColumns(granularity, quarters),
    [granularity, quarters]
  );

  // Build group header row for month/week views
  const hasGroupHeaders = granularity !== 'quarter';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Sticky header */}
      <div
        className="flex border-b sticky top-0 z-10 flex-col"
        style={{ borderColor: Border.subtle, backgroundColor: Background.primary }}
      >
        {/* Group label row (month/week view only) */}
        {hasGroupHeaders && (
          <div className="flex" style={{ borderBottom: `1px solid ${Border.subtle}` }}>
            <div style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }} />
            {columns.map(col =>
              col.isGroupStart ? (
                <div
                  key={`grp-${col.key}`}
                  className="px-3 py-1 text-[10px] font-semibold"
                  style={{
                    width: granularity === 'month'
                      ? col.width * 3
                      : col.width,
                    borderRight: `1px solid ${Border.subtle}`,
                    color: Text.tertiary,
                    backgroundColor: Background.secondary,
                  }}
                >
                  {col.groupLabel}
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Column header row */}
        <div className="flex">
          <div
            className="flex items-end px-3 py-2 shrink-0 text-xs font-semibold uppercase tracking-wider"
            style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}`, color: Text.tertiary }}
          >
            {viewMode === 'people' ? 'People' : 'Projects'}
          </div>
          {columns.map(col => (
            <div
              key={col.key}
              className="flex items-end px-3 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{
                width: col.width,
                minWidth: col.width,
                borderRight: `1px solid ${Border.subtle}`,
                color: Text.tertiary,
              }}
            >
              {col.label}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'people' ? (
          <>
            {members.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <span className="text-sm" style={{ color: Text.tertiary }}>No team members. Add members in the Team page.</span>
              </div>
            ) : (
              members.map(m => (
                <PeopleRow
                  key={m.id}
                  memberId={m.id}
                  columns={columns}
                  granularity={granularity}
                  assignments={assignments}
                  projects={projects}
                  jiraWorkItems={jiraItems}
                  dragScore={memberDragScores?.[m.id]}
                />
              ))
            )}
          </>
        ) : (
          <>
            {projects.length === 0 && jiraTree.length === 0 && (
              <div className="flex items-center justify-center h-24">
                <span className="text-sm" style={{ color: Text.tertiary }}>No projects in this plan yet.</span>
              </div>
            )}
            {jiraTree.length > 0 && (
              <>
                <div
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b"
                  style={{ color: Text.tertiary, borderColor: Border.subtle, backgroundColor: Background.secondary }}
                >
                  Jira Epics
                </div>
                {jiraTree.map(node => (
                  <JiraEpicRow
                    key={node.item.jiraKey}
                    item={node.item}
                    childNodes={node.children}
                    columns={columns}
                    granularity={granularity}
                    assignments={assignments}
                    dragScore={dragScores?.[node.item.jiraKey]}
                    isSelected={selectedProjectId === node.item.jiraKey}
                  />
                ))}
              </>
            )}
            {projects.length > 0 && (
              <>
                {jiraTree.length > 0 && (
                  <div
                    className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b"
                    style={{ color: Text.tertiary, borderColor: Border.subtle, backgroundColor: Background.secondary }}
                  >
                    Plan Projects
                  </div>
                )}
                {projects.map(p => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    columns={columns}
                    granularity={granularity}
                    assignments={assignments}
                    dragScore={dragScores?.[p.id]}
                    isSelected={selectedProjectId === p.id}
                  />
                ))}
              </>
            )}
            <AddProjectRow columns={columns} isBaseline={isBaseline} />
          </>
        )}
      </div>
    </div>
  );
}
