/**
 * PlanningGrid — Gantt-style resource grid for the Planning Board v2.
 *
 * Supports two views:
 *  - People view: rows = team members, child rows = their project assignments per quarter
 *  - Projects view: rows = projects, child rows = people assigned per quarter
 *
 * Quarter columns span the full width. The left label panel has a fixed width.
 */
import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useDroppable } from '@dnd-kit/core';
import { clsx } from 'clsx';
import { useAppStore, useCurrentState } from '../../stores/appStore';
import {
  addAssignment,
  removeAssignment,
  addProject,
} from '../../stores/actions';
import { getWorkdaysInQuarter, getHolidaysByCountry } from '../../utils/calendar';
import { FIT_GLOW } from '../../utils/staffing';
import type { FitLevel } from '../../utils/staffing';
import { useToast } from '../ui/Toast';
import { PlanningBar, CapacityBar, StaffingBar } from './PlanningBar';
import { AssignPopover, ITBizBadge } from './AssignPopover';
import type { Assignment, JiraWorkItem, Project } from '../../types';
import { Accent, Background, Border, Text } from '../../theme/tokens';

const LABEL_WIDTH = 240;
const QUARTER_COL_WIDTH = 200;

export type PlanningViewMode = 'people' | 'projects';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a deterministic color from a palette given a project id */
const PROJECT_COLORS = [
  Accent.teal, '#6366F1', '#F59E0B', '#EC4899', '#10B981', '#8B5CF6',
  '#EF4444', '#14B8A6', '#F97316', '#3B82F6',
];

function projectColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) & 0xffffffff;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// People View
// ─────────────────────────────────────────────────────────────────────────────

interface PeopleRowProps {
  memberId: string;
  quarters: string[];
  assignments: Assignment[];
  projects: Project[];
  jiraWorkItems: JiraWorkItem[];
}

function PeopleRow({ memberId, quarters, assignments, projects, jiraWorkItems }: PeopleRowProps) {
  const state = useCurrentState();
  const publicHolidays = useAppStore(useShallow(s => s.data.publicHolidays));
  const member = state.teamMembers.find(m => m.id === memberId);
  const [expanded, setExpanded] = useState(true);
  const [assigningQuarter, setAssigningQuarter] = useState<string | null>(null);
  const { showToast } = useToast();

  if (!member) return null;

  const memberHolidays = getHolidaysByCountry(member.countryId, publicHolidays);

  // Assignments for this member in the plan
  const memberAssignments = assignments.filter(a => a.memberId === memberId);

  // All unique projectIds assigned to this member
  const assignedProjectIds = useMemo(() =>
    new Set(memberAssignments.map(a => a.projectId)),
    [memberAssignments]
  );

  const handleAssign = useCallback((quarter: string, projectId: string, days: number) => {
    addAssignment({ memberId, projectId, quarter, days });
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

  return (
    <>
      {/* Parent row */}
      <div
        className="flex border-b transition-colors hover:bg-[#F5F3F0]"
        style={{ borderColor: Border.subtle }}
      >
        {/* Label cell */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 shrink-0 cursor-pointer select-none"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
          onClick={() => setExpanded(v => !v)}
          role="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${member.name}`}
        >
          <span style={{ color: Text.tertiary }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="text-sm font-medium truncate" style={{ color: Text.primary }}>{member.name}</span>
          <ITBizBadge type="it" />
        </div>

        {/* Quarter cells — capacity bars */}
        {quarters.map(q => {
          const totalDays = getWorkdaysInQuarter(q, memberHolidays);
          const usedDays = memberAssignments
            .filter(a => a.quarter === q)
            .reduce((s, a) => s + a.days, 0);

          return (
            <div
              key={q}
              className="flex items-center px-3"
              style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
            >
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px]" style={{ color: Text.tertiary }}>
                    {usedDays > 0 ? `${usedDays}d / ${totalDays}d` : `${totalDays}d`}
                  </span>
                </div>
                <CapacityBar usedDays={usedDays} totalDays={totalDays} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Child rows — project assignments */}
      {expanded && (
        <>
          {/* One child row per assigned project × quarter (native projects + Jira items) */}
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
                  style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.light}` }}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs truncate" style={{ color: Text.secondary }}>{displayName}</span>
                </div>

                {/* Quarter cells — assignment bars */}
                {quarters.map(q => {
                  const assignment = memberAssignments.find(
                    a => a.projectId === projectId && a.quarter === q
                  );
                  const totalDays = getWorkdaysInQuarter(q, memberHolidays);

                  return (
                    <div
                      key={q}
                      className="flex items-center px-3 py-2"
                      style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.light}` }}
                    >
                      {assignment && (
                        <PlanningBar
                          days={assignment.days}
                          quarter={q}
                          personName={member.name}
                          projectName={displayName}
                          color={color}
                          widthFraction={totalDays > 0 ? assignment.days / totalDays : 0.1}
                          onEdit={(newDays) => handleEditAssignment(assignment, newDays)}
                          onRemove={() => handleRemoveAssignment(assignment)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* "+ Assign project" row */}
          <div
            className="flex border-b"
            style={{ borderColor: Border.light, backgroundColor: Background.secondary }}
          >
            <div
              className="flex items-center pl-8 pr-3 py-1.5 relative"
              style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.light}` }}
            >
              {quarters.map((q) =>
                assigningQuarter === q ? (
                  <AssignPopover
                    key={q}
                    mode="project"
                    quarter={q}
                    memberId={memberId}
                    assignedProjectIds={new Set(memberAssignments.filter(a => a.quarter === q).map(a => a.projectId))}
                    onAssign={(projectId, days) => handleAssign(q, projectId, days)}
                    onClose={() => setAssigningQuarter(null)}
                  />
                ) : null
              )}
              <button
                className="flex items-center gap-1.5 text-xs transition-colors hover:text-sana-teal focus:ring-2 focus:ring-sana-teal rounded"
                style={{ color: Text.tertiary }}
                onClick={() => setAssigningQuarter(quarters[0] ?? null)}
                aria-label="Assign a project"
              >
                <Plus size={12} />
                Assign project
              </button>
            </div>
            {/* Quarter selector cells */}
            {quarters.map(q => (
              <div
                key={q}
                className="flex items-center px-3 py-1.5"
                style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.light}` }}
              >
                <button
                  className="text-[10px] flex items-center gap-1 transition-colors hover:text-sana-teal focus:ring-2 focus:ring-sana-teal rounded relative"
                  style={{ color: Text.tertiary }}
                  onClick={() => setAssigningQuarter(q)}
                  aria-label={`Assign project in ${q}`}
                >
                  <Plus size={10} />
                  {q}
                  {assigningQuarter === q && (
                    <AssignPopover
                      mode="project"
                      quarter={q}
                      memberId={memberId}
                      assignedProjectIds={new Set(memberAssignments.filter(a => a.quarter === q).map(a => a.projectId))}
                      onAssign={(projectId, days) => handleAssign(q, projectId, days)}
                      onClose={() => setAssigningQuarter(null)}
                    />
                  )}
                </button>
              </div>
            ))}
          </div>
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
  quarters: string[];
  assignments: Assignment[];
  dragScore?: FitLevel;
  isSelected?: boolean;
}

function ProjectRow({ project, quarters, assignments, dragScore, isSelected }: ProjectRowProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: project.id });
  const state = useCurrentState();
  const publicHolidays = useAppStore(useShallow(s => s.data.publicHolidays));
  const [expanded, setExpanded] = useState(true);
  const [assigningQuarter, setAssigningQuarter] = useState<string | null>(null);
  const { showToast } = useToast();
  const color = projectColor(project.id);

  const projectAssignments = assignments.filter(a => a.projectId === project.id);
  const assignedMemberIds = useMemo(() =>
    new Set(projectAssignments.map(a => a.memberId)),
    [projectAssignments]
  );

  const totalNeededDays = Object.values(project.daysPerQuarter ?? {}).reduce((s, d) => s + d, 0);
  const totalAssignedDays = projectAssignments.reduce((s, a) => s + a.days, 0);

  const handleAssign = useCallback((quarter: string, memberId: string, days: number) => {
    addAssignment({ memberId, projectId: project.id, quarter, days });
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

  return (
    <>
      {/* Parent row */}
      <div
        ref={setDropRef}
        className={clsx(
          'flex border-b transition-colors hover:bg-[#F5F3F0]',
          dragScore && (isOver ? 'ring-2 ring-inset' : FIT_GLOW[dragScore]),
        )}
        style={{
          borderColor: Border.subtle,
          borderLeftColor: isSelected ? Accent.teal : undefined,
          borderLeftWidth: isSelected ? 3 : undefined,
        }}
      >
        {/* Label cell */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 shrink-0 cursor-pointer select-none"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
          onClick={() => setExpanded(v => !v)}
          role="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${project.name}`}
        >
          <span style={{ color: Text.tertiary }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium truncate" style={{ color: Text.primary }}>{project.name}</span>
          <span className="text-[10px] shrink-0 ml-auto" style={{ color: Text.tertiary }}>
            {totalAssignedDays}/{totalNeededDays > 0 ? totalNeededDays : '?'}d
          </span>
        </div>

        {/* Quarter cells — staffing bars */}
        {quarters.map(q => {
          const neededInQ = project.daysPerQuarter?.[q] ?? 0;
          const assignedInQ = projectAssignments
            .filter(a => a.quarter === q)
            .reduce((s, a) => s + a.days, 0);

          return (
            <div
              key={q}
              className="flex items-center px-3"
              style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
            >
              {neededInQ > 0 || assignedInQ > 0 ? (
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px]" style={{ color: Text.tertiary }}>
                      {assignedInQ}d / {neededInQ > 0 ? neededInQ : '?'}d
                    </span>
                  </div>
                  <StaffingBar assignedDays={assignedInQ} neededDays={neededInQ} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Child rows — person assignments */}
      {expanded && (
        <>
          {Array.from(assignedMemberIds).map(memberId => {
            const member = state.teamMembers.find(m => m.id === memberId);
            if (!member) return null;
            const memberHolidays = getHolidaysByCountry(member.countryId, publicHolidays);

            return (
              <div
                key={memberId}
                className="flex border-b"
                style={{ borderColor: Border.light, backgroundColor: Background.secondary }}
              >
                {/* Label cell */}
                <div
                  className="flex items-center gap-2 pl-8 pr-3 py-2"
                  style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.light}` }}
                >
                  <span className="text-xs truncate" style={{ color: Text.secondary }}>{member.name}</span>
                  <ITBizBadge type="it" />
                </div>

                {/* Quarter cells */}
                {quarters.map(q => {
                  const assignment = projectAssignments.find(
                    a => a.memberId === memberId && a.quarter === q
                  );
                  const totalDays = getWorkdaysInQuarter(q, memberHolidays);

                  return (
                    <div
                      key={q}
                      className="flex items-center px-3 py-2"
                      style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.light}` }}
                    >
                      {assignment && (
                        <PlanningBar
                          days={assignment.days}
                          quarter={q}
                          personName={member.name}
                          projectName={project.name}
                          color={color}
                          widthFraction={totalDays > 0 ? assignment.days / totalDays : 0.1}
                          onEdit={(newDays) => handleEditAssignment(assignment, newDays)}
                          onRemove={() => handleRemoveAssignment(assignment)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* "+ Assign person" row */}
          <div
            className="flex border-b"
            style={{ borderColor: Border.light, backgroundColor: Background.secondary }}
          >
            <div
              className="flex items-center pl-8 pr-3 py-1.5 relative"
              style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.light}` }}
            >
              <button
                className="flex items-center gap-1.5 text-xs transition-colors hover:text-sana-teal focus:ring-2 focus:ring-sana-teal rounded"
                style={{ color: Text.tertiary }}
                onClick={() => setAssigningQuarter(quarters[0] ?? null)}
                aria-label="Assign a person"
              >
                <Plus size={12} />
                Assign person
              </button>
            </div>
            {quarters.map(q => (
              <div
                key={q}
                className="flex items-center px-3 py-1.5 relative"
                style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.light}` }}
              >
                <button
                  className="text-[10px] flex items-center gap-1 transition-colors hover:text-sana-teal focus:ring-2 focus:ring-sana-teal rounded relative"
                  style={{ color: Text.tertiary }}
                  onClick={() => setAssigningQuarter(q)}
                  aria-label={`Assign person in ${q}`}
                >
                  <Plus size={10} />
                  {q}
                  {assigningQuarter === q && (
                    <AssignPopover
                      mode="person"
                      quarter={q}
                      projectId={project.id}
                      assignedMemberIds={new Set(projectAssignments.filter(a => a.quarter === q).map(a => a.memberId))}
                      onAssign={(memberId, days) => handleAssign(q, memberId, days)}
                      onClose={() => setAssigningQuarter(null)}
                    />
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Jira Epic Row (Projects view — Jira-sourced work items)
// ─────────────────────────────────────────────────────────────────────────────

interface JiraEpicRowProps {
  item: JiraWorkItem;
  quarters: string[];
  assignments: Assignment[];
  dragScore?: FitLevel;
  isSelected?: boolean;
}

function JiraEpicRow({ item, quarters, assignments, dragScore, isSelected }: JiraEpicRowProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: item.jiraKey });
  const state = useCurrentState();
  const publicHolidays = useAppStore(useShallow(s => s.data.publicHolidays));
  const [expanded, setExpanded] = useState(true);
  const [assigningQuarter, setAssigningQuarter] = useState<string | null>(null);
  const { showToast } = useToast();
  const color = projectColor(item.jiraKey);

  // Assignments that reference this Jira item via jiraKey as projectId
  const epicAssignments = assignments.filter(a => a.projectId === item.jiraKey);
  const assignedMemberIds = useMemo(() =>
    new Set(epicAssignments.map(a => a.memberId)),
    [epicAssignments]
  );

  const totalAssignedDays = epicAssignments.reduce((s, a) => s + a.days, 0);
  const displayName = `${item.jiraKey}: ${item.summary}`;

  const handleAssign = useCallback((quarter: string, memberId: string, days: number) => {
    addAssignment({ memberId, projectId: item.jiraKey, quarter, days });
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

  return (
    <>
      {/* Parent row */}
      <div
        ref={setDropRef}
        className={clsx(
          'flex border-b transition-colors hover:bg-[#F5F3F0]',
          dragScore && (isOver ? 'ring-2 ring-inset' : FIT_GLOW[dragScore]),
        )}
        style={{
          borderColor: Border.subtle,
          borderLeftColor: isSelected ? Accent.teal : undefined,
          borderLeftWidth: isSelected ? 3 : undefined,
        }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2.5 shrink-0 cursor-pointer select-none"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
          onClick={() => setExpanded(v => !v)}
          role="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${displayName}`}
        >
          <span style={{ color: Text.tertiary }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate" style={{ color: Text.primary }}>{item.summary}</span>
            <span className="text-[10px]" style={{ color: Text.tertiary }}>{item.jiraKey}</span>
          </div>
          <span className="text-[10px] shrink-0 ml-auto" style={{ color: Text.tertiary }}>
            {totalAssignedDays}d
          </span>
        </div>

        {quarters.map(q => {
          const assignedInQ = epicAssignments.filter(a => a.quarter === q).reduce((s, a) => s + a.days, 0);
          return (
            <div
              key={q}
              className="flex items-center px-3"
              style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
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
          {Array.from(assignedMemberIds).map(memberId => {
            const member = state.teamMembers.find(m => m.id === memberId);
            if (!member) return null;
            const memberHolidays = getHolidaysByCountry(member.countryId, publicHolidays);

            return (
              <div
                key={memberId}
                className="flex border-b"
                style={{ borderColor: Border.light, backgroundColor: Background.secondary }}
              >
                <div
                  className="flex items-center gap-2 pl-8 pr-3 py-2"
                  style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.light}` }}
                >
                  <span className="text-xs truncate" style={{ color: Text.secondary }}>{member.name}</span>
                  <ITBizBadge type="it" />
                </div>
                {quarters.map(q => {
                  const assignment = epicAssignments.find(a => a.memberId === memberId && a.quarter === q);
                  const totalDays = getWorkdaysInQuarter(q, memberHolidays);
                  return (
                    <div
                      key={q}
                      className="flex items-center px-3 py-2"
                      style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.light}` }}
                    >
                      {assignment && (
                        <PlanningBar
                          days={assignment.days}
                          quarter={q}
                          personName={member.name}
                          projectName={displayName}
                          color={color}
                          widthFraction={totalDays > 0 ? assignment.days / totalDays : 0.1}
                          onEdit={(newDays) => handleEditAssignment(assignment, newDays)}
                          onRemove={() => handleRemoveAssignment(assignment)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* "+ Assign person" row */}
          <div
            className="flex border-b"
            style={{ borderColor: Border.light, backgroundColor: Background.secondary }}
          >
            <div
              className="flex items-center pl-8 pr-3 py-1.5"
              style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.light}` }}
            >
              <button
                className="flex items-center gap-1.5 text-xs transition-colors hover:text-sana-teal focus:ring-2 focus:ring-sana-teal rounded"
                style={{ color: Text.tertiary }}
                onClick={() => setAssigningQuarter(quarters[0] ?? null)}
              >
                <Plus size={12} />
                Assign person
              </button>
            </div>
            {quarters.map(q => (
              <div
                key={q}
                className="flex items-center px-3 py-1.5 relative"
                style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.light}` }}
              >
                <button
                  className="text-[10px] flex items-center gap-1 transition-colors hover:text-sana-teal focus:ring-2 focus:ring-sana-teal rounded relative"
                  style={{ color: Text.tertiary }}
                  onClick={() => setAssigningQuarter(q)}
                >
                  <Plus size={10} />
                  {q}
                  {assigningQuarter === q && (
                    <AssignPopover
                      mode="person"
                      quarter={q}
                      projectId={item.jiraKey}
                      assignedMemberIds={new Set(epicAssignments.filter(a => a.quarter === q).map(a => a.memberId))}
                      onAssign={(memberId, days) => handleAssign(q, memberId, days)}
                      onClose={() => setAssigningQuarter(null)}
                    />
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Project row (Projects view)
// ─────────────────────────────────────────────────────────────────────────────

function AddProjectRow({ quarters }: { quarters: string[] }) {
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

  if (!adding) {
    return (
      <div
        className="flex border-b"
        style={{ borderColor: Border.subtle }}
      >
        <div
          className="flex items-center px-3 py-2"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
        >
          <button
            className="flex items-center gap-1.5 text-xs transition-colors hover:text-sana-teal focus:ring-2 focus:ring-sana-teal rounded"
            style={{ color: Text.tertiary }}
            onClick={() => setAdding(true)}
          >
            <Plus size={12} />
            Add project
          </button>
        </div>
        {quarters.map(q => (
          <div
            key={q}
            style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
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
          className="flex-1 text-sm outline-none bg-transparent border-b focus:border-sana-teal"
          style={{ borderColor: Border.subtle, color: Text.primary }}
        />
        <button
          className="text-xs font-medium focus:ring-2 focus:ring-sana-teal rounded px-1"
          style={{ color: Accent.teal }}
          onClick={handleAdd}
          disabled={!name.trim()}
        >
          Add
        </button>
      </div>
      {quarters.map(q => (
        <div
          key={q}
          style={{ width: QUARTER_COL_WIDTH, minWidth: QUARTER_COL_WIDTH, borderRight: `1px solid ${Border.subtle}` }}
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
  /** Fit scores keyed by project.id or jiraKey — drives glow rings on droppable rows */
  dragScores?: Record<string, FitLevel>;
  /** Project/jira id to highlight with a teal left border (from left sidebar click) */
  selectedProjectId?: string | null;
}

export function PlanningGrid({ viewMode, dragScores, selectedProjectId }: PlanningGridProps) {
  const state = useCurrentState();
  const quarters = useAppStore(useShallow(s => s.data.quarters));

  const members = useMemo(
    () => state.teamMembers.filter(m => !m.excludedFromCapacity),
    [state.teamMembers]
  );
  const projects = state.projects ?? [];
  const assignments = state.assignments ?? [];
  // Jira epics from the scenario snapshot — shown in Projects view alongside native projects
  const jiraEpics = useMemo(
    () => (state.jiraWorkItems ?? []).filter(w => w.type === 'epic' && w.statusCategory !== 'done'),
    [state.jiraWorkItems]
  );

  const displayedQuarters = quarters.slice(0, 6);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Sticky header row */}
      <div
        className="flex border-b sticky top-0 z-10"
        style={{ borderColor: Border.subtle, backgroundColor: Background.primary }}
      >
        {/* Label column header */}
        <div
          className="flex items-end px-3 py-2 shrink-0 text-xs font-semibold uppercase tracking-wider"
          style={{ width: LABEL_WIDTH, borderRight: `1px solid ${Border.subtle}`, color: Text.tertiary }}
        >
          {viewMode === 'people' ? 'People' : 'Projects'}
        </div>

        {/* Quarter column headers */}
        {displayedQuarters.map(q => (
          <div
            key={q}
            className="flex items-end px-3 py-2 text-xs font-semibold uppercase tracking-wider"
            style={{
              width: QUARTER_COL_WIDTH,
              minWidth: QUARTER_COL_WIDTH,
              borderRight: `1px solid ${Border.subtle}`,
              color: Text.tertiary,
            }}
          >
            {q}
          </div>
        ))}
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
                  quarters={displayedQuarters}
                  assignments={assignments}
                  projects={projects}
                  jiraWorkItems={jiraEpics}
                />
              ))

            )}
          </>
        ) : (
          <>
            {projects.length === 0 && jiraEpics.length === 0 && (
              <div className="flex items-center justify-center h-24">
                <span className="text-sm" style={{ color: Text.tertiary }}>No projects in this plan yet.</span>
              </div>
            )}
            {/* Jira epics section */}
            {jiraEpics.length > 0 && (
              <>
                <div
                  className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-b"
                  style={{ color: Text.tertiary, borderColor: Border.subtle, backgroundColor: Background.secondary }}
                >
                  Jira Epics
                </div>
                {jiraEpics.map(item => (
                  <JiraEpicRow
                    key={item.jiraKey}
                    item={item}
                    quarters={displayedQuarters}
                    assignments={assignments}
                    dragScore={dragScores?.[item.jiraKey]}
                    isSelected={selectedProjectId === item.jiraKey}
                  />
                ))}
              </>
            )}
            {/* Native plan projects section */}
            {projects.length > 0 && (
              <>
                {jiraEpics.length > 0 && (
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
                    quarters={displayedQuarters}
                    assignments={assignments}
                    dragScore={dragScores?.[p.id]}
                    isSelected={selectedProjectId === p.id}
                  />
                ))}
              </>
            )}
            <AddProjectRow quarters={displayedQuarters} />
          </>
        )}
      </div>
    </div>
  );
}
