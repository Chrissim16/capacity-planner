/**
 * PlanningBoard — US-062
 *
 * Scenario-native planning board with a timeline-centric three-panel layout.
 * Per UX addendum (2026-03-16): sidebars are visually recessive, timeline is the hero.
 * Supports "By Project" and "By Person" views, monochromatic resting state,
 * and fit-colour glow borders that appear only during drag.
 *
 * Lazy-loaded in Scenarios.tsx via React.lazy() — @dnd-kit/core stays out of the main bundle.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, X, Check, Users, FolderKanban } from 'lucide-react';
import { clsx } from 'clsx';
import { useCurrentState, useActiveScenarioId, useSyncStatus } from '../stores/appStore';
import { addAssignment, promoteScenarioToBaseline } from '../stores/actions';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { scoreMember, FIT_COLOURS, FIT_GLOW, rankMemberFits } from '../utils/staffing';
import type { FitLevel, TentativeAssignment } from '../utils/staffing';
import { calculateCapacity } from '../utils/capacity';
import { ProgressBar } from './ui/ProgressBar';
import { Button } from './ui/Button';
import { SmartAssignmentPanel } from './SmartAssignmentPanel';
import type { Project, Assignment, TeamMember, BusinessContact } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type BoardView = 'byProject' | 'byPerson';

interface DragScores {
  scores: Map<string, FitLevel>;
  memberId: string;
}

interface DropPopover {
  projectId: string;
  projectName: string;
  memberId: string;
  defaultDays: number;
  memberName: string;
  existingDays: number;
}

// ─── Draggable member card ────────────────────────────────────────────────────

interface DraggableMemberProps {
  id: string;
  name: string;
  badge: 'IT' | 'BIZ';
  availableDays: number;
  disabled?: boolean;
}

function DraggableMember({ id, name, badge, availableDays, disabled }: DraggableMemberProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });
  const style = transform ? { transform: CSS.Transform.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'flex items-center gap-2 py-2 px-1 rounded-lg select-none transition-opacity',
        isDragging ? 'opacity-0' : 'opacity-100',
        !disabled && 'cursor-grab active:cursor-grabbing hover:bg-[#F5F3F0]'
      )}
    >
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0',
        badge === 'IT' ? 'bg-[#0ED3CF]' : 'bg-violet-400'
      )}>
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-[#1A1A1A] truncate">{name}</span>
          <span className={clsx(
            'text-[10px] font-semibold tracking-wide',
            badge === 'IT' ? 'text-[#0ED3CF]' : 'text-violet-400'
          )}>{badge}</span>
        </div>
        <span className="text-xs text-[#9CA3AF]">{availableDays}d free</span>
      </div>
    </div>
  );
}

// ─── Droppable project row ─────────────────────────────────────────────────────

interface DroppableProjectRowProps {
  project: Project;
  quarter: string;
  assignments: Assignment[];
  fitLevel?: FitLevel;
  isOver: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  teamMembers: TeamMember[];
  bizContacts: BusinessContact[];
}

function DroppableProjectRow({
  project, quarter, assignments, fitLevel, isOver, isExpanded, onSelect, teamMembers, bizContacts
}: DroppableProjectRowProps) {
  const { setNodeRef } = useDroppable({ id: project.id });

  const quarterAssignments = assignments.filter(a => a.quarter === quarter);
  const assignedDays = quarterAssignments.reduce((s, a) => s + a.days, 0);
  const targetDays = project.daysPerQuarter[quarter] ?? 0;

  const fitClass = fitLevel ? FIT_GLOW[fitLevel] : '';

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={clsx(
        'rounded-xl border border-[#E5E5E3] bg-white transition-all duration-150 cursor-pointer',
        isOver || fitLevel ? fitClass : '',
        isExpanded ? 'ring-2 ring-[#0ED3CF]/30' : 'hover:border-[#0ED3CF]/40'
      )}
    >
      {/* Collapsed row (48px) */}
      {!isExpanded && (
        <div className="flex items-center gap-3 px-3 h-12">
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-[#1A1A1A] truncate block">{project.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {quarterAssignments.slice(0, 4).map(a => {
              const m = teamMembers.find(tm => tm.id === a.memberId) ?? bizContacts.find(c => c.id === a.memberId);
              return (
                <div
                  key={a.id}
                  className="w-5 h-5 rounded-full bg-[#0ED3CF] text-white text-[9px] font-semibold flex items-center justify-center"
                  title={m?.name}
                >
                  {m?.name.slice(0, 1) ?? '?'}
                </div>
              );
            })}
            {quarterAssignments.length > 4 && (
              <span className="text-xs text-[#9CA3AF]">+{quarterAssignments.length - 4}</span>
            )}
          </div>
          <span className="text-xs text-[#9CA3AF] shrink-0">
            {assignedDays}/{targetDays}d
          </span>
        </div>
      )}

      {/* Expanded rows (56px per person) */}
      {isExpanded && (
        <div>
          <div className="flex items-center gap-3 px-3 h-12 border-b border-[#F0EFED]">
            <div className="flex-1 min-w-0">
              <span className="text-base font-semibold text-[#1A1A1A] truncate block">{project.name}</span>
            </div>
            <span className="text-xs text-[#9CA3AF] shrink-0">{assignedDays} / {targetDays}d staffed</span>
          </div>
          {quarterAssignments.length === 0 && (
            <div className="px-4 py-3 text-xs text-[#9CA3AF] italic">No assignments yet. Drag a team member here.</div>
          )}
          {quarterAssignments.map(a => {
            const m = teamMembers.find(tm => tm.id === a.memberId) ?? bizContacts.find(c => c.id === a.memberId);
            const isBiz = !!bizContacts.find(c => c.id === a.memberId);
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 h-14">
                <div className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0',
                  isBiz ? 'bg-violet-400' : 'bg-[#0ED3CF]'
                )}>
                  {m?.name.slice(0, 1) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-[#1A1A1A] truncate">{m?.name ?? a.memberId}</span>
                    <span className={clsx('text-[10px] font-semibold tracking-wide', isBiz ? 'text-violet-400' : 'text-[#0ED3CF]')}>
                      {isBiz ? 'BIZ' : 'IT'}
                    </span>
                  </div>
                  {/* Capacity whisper line */}
                  <div className="w-full h-0.5 bg-[#F0EFED] rounded-full mt-1">
                    <div
                      className="h-full rounded-full bg-green-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((a.days / (targetDays || 20)) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="bg-[#F5F3F0] border border-[#E5E5E3] rounded-xl px-2.5 py-1 text-xs font-normal text-[#1A1A1A] shrink-0">
                  {a.days}d
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PlanningBoard ────────────────────────────────────────────────────────────

export default function PlanningBoard() {
  const currentState = useCurrentState();
  const activeScenarioId = useActiveScenarioId();
  const { status: syncStatus } = useSyncStatus();
  const { can } = useCurrentUser();
  const canAssign = can('edit_assignments');

  const [view, setView] = useState<BoardView>('byProject');
  const [quarter, setQuarter] = useState(currentState.quarters[0] ?? 'Q1 2026');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  // Drag state
  const [dragScores, setDragScores] = useState<DragScores | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropPopover, setDropPopover] = useState<DropPopover | null>(null);
  const [popoverDays, setPopoverDays] = useState(5);
  const [tentativeBoardAssignments, setTentativeBoardAssignments] = useState<TentativeAssignment[]>([]);

  const projects = currentState.projects ?? [];
  const assignments = currentState.assignments ?? [];
  const teamMembers = currentState.teamMembers.filter(m => !m.excludedFromCapacity);
  const bizContacts = currentState.businessContacts.filter(c => !c.excludedFromCapacity && !c.archived);

  // Quarter members sorted by available days descending
  const memberList = useMemo(() => {
    const itRows = rankMemberFits(
      teamMembers.map(m => scoreMember(m, quarter, [], '', currentState))
    ).map(f => ({ id: f.member.id, name: f.member.name, badge: 'IT' as const, availableDays: f.availableDays }));

    const bizRows = bizContacts.map(c => {
      // Available days for BIZ — rough approximation via capacity util
      const cap = scoreMember(
        { id: c.id, name: c.name, role: '', countryId: c.countryId, skillIds: [], maxConcurrentProjects: 3 },
        quarter, [], '', currentState
      );
      return { id: c.id, name: c.name, badge: 'BIZ' as const, availableDays: cap.availableDays };
    });

    return [...itRows, ...bizRows];
  }, [teamMembers, bizContacts, quarter, currentState]);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const memberId = String(event.active.id);
    setActiveId(memberId);
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;

    // Precompute fit scores for all projects in current quarter (D6 perf fix — not on every dragOver)
    const scores = new Map<string, FitLevel>();
    for (const project of projects) {
      const fit = scoreMember(member, quarter, project.requiredSkillIds, project.id, currentState);
      scores.set(project.id, fit.fitLevel);
    }
    setDragScores({ scores, memberId });
  }, [teamMembers, projects, quarter, currentState]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setDragOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const memberId = String(event.active.id);
    const projectId = event.over ? String(event.over.id) : null;

    setActiveId(null);
    setDragScores(null);
    setDragOverId(null);

    if (!projectId || !canAssign) return;

    const project = projects.find(p => p.id === projectId);
    const member = memberList.find(m => m.id === memberId);
    if (!project || !member) return;

    const memberFit = teamMembers.find(m => m.id === memberId)
      ? scoreMember(teamMembers.find(m => m.id === memberId)!, quarter, project.requiredSkillIds, projectId, currentState)
      : null;

    const availableDays = memberFit?.availableDays ?? member.availableDays;
    const existingDays = (assignments ?? [])
      .filter(a => a.memberId === memberId && a.projectId === projectId && a.quarter === quarter)
      .reduce((s, a) => s + a.days, 0);

    const defaultDays = Math.max(1, Math.min(5, availableDays));
    setPopoverDays(defaultDays);
    setDropPopover({
      projectId,
      projectName: project.name,
      memberId,
      memberName: member.name,
      defaultDays,
      existingDays,
    });
  }, [projects, memberList, teamMembers, quarter, currentState, assignments, canAssign]);

  const handlePopoverConfirm = useCallback(() => {
    if (!dropPopover || popoverDays < 1) return;
    console.info('[board] assignment via drag', {
      memberId: dropPopover.memberId,
      projectId: dropPopover.projectId,
      quarter,
      days: popoverDays,
    });
    const isBiz = !!bizContacts.find(c => c.id === dropPopover.memberId);
    addAssignment({ memberId: dropPopover.memberId, projectId: dropPopover.projectId, quarter, days: popoverDays, isBizContact: isBiz });
    setTentativeBoardAssignments(prev => [...prev.filter(t => t.memberId !== dropPopover.memberId), { memberId: dropPopover.memberId, days: popoverDays }]);
    setDropPopover(null);
  }, [dropPopover, popoverDays, quarter, bizContacts]);

  const activeScenario = currentState.scenarios?.find(s => s.id === activeScenarioId);
  const availableQuarters = currentState.quarters;

  const activeDragMember = activeId ? memberList.find(m => m.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${memberList.find(m => m.id === active.id)?.name ?? 'member'}. Use arrow keys to navigate, space to drop.`,
          onDragOver: ({ active, over }) => over
            ? `${memberList.find(m => m.id === active.id)?.name ?? 'member'} is over ${projects.find(p => p.id === over.id)?.name ?? 'project'}.`
            : '',
          onDragEnd: ({ active, over }) => over
            ? `${memberList.find(m => m.id === active.id)?.name ?? 'member'} dropped on ${projects.find(p => p.id === over.id)?.name ?? 'project'}.`
            : `${memberList.find(m => m.id === active.id)?.name ?? 'member'} drag cancelled.`,
          onDragCancel: () => 'Drag cancelled.',
        },
      }}
    >
      <div className="flex flex-col h-full bg-[#FAF9F7]">
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFED] bg-white">
          <h1 className="text-2xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Planning Board
          </h1>

          {/* View toggle pill */}
          <div className="flex items-center gap-1 bg-[#F5F3F0] rounded-full px-1 py-1">
            {([['byProject', 'By Project'], ['byPerson', 'By Person']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={clsx(
                  'px-3 py-1 rounded-full text-sm transition-all',
                  view === v
                    ? 'text-[#0ED3CF] font-medium underline decoration-[#0ED3CF] decoration-2 underline-offset-4'
                    : 'text-[#6B7280] hover:text-[#1A1A1A]'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={quarter}
              onChange={e => setQuarter(e.target.value)}
              className="text-sm border border-[#E5E5E3] rounded-lg px-2 py-1 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ED3CF] text-[#1A1A1A]"
              aria-label="Select quarter"
            >
              {availableQuarters.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            {activeScenario && (
              <span className="text-xs text-[#9CA3AF]">{activeScenario.name}</span>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={syncStatus === 'saving'}
              onClick={() => { if (activeScenarioId) promoteScenarioToBaseline(activeScenarioId); }}
              title={syncStatus === 'saving' ? 'Saving…' : 'Promote to baseline'}
            >
              {syncStatus === 'saving' ? 'Saving…' : 'Promote to Baseline'}
            </Button>
          </div>
        </div>

        {/* ── Three-panel body ────────────────────────────────────────────── */}
        <div className="flex-1 flex gap-4 overflow-hidden px-6 py-4">

          {/* Left sidebar — Projects */}
          {!sidebarCollapsed.left && (
            <div className="w-44 shrink-0 flex flex-col gap-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Projects</span>
                <button onClick={() => setSidebarCollapsed(s => ({ ...s, left: true }))} className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label="Collapse projects sidebar">
                  <ChevronLeft size={14} />
                </button>
              </div>
              {projects.length === 0 && (
                <p className="text-xs text-[#9CA3AF] italic">No projects yet. Use "What if…" to create one.</p>
              )}
              {projects.map(p => {
                const isSelected = selectedProjectId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProjectId(prev => prev === p.id ? null : p.id); setExpandedProjectId(prev => prev === p.id ? null : p.id); }}
                    className={clsx(
                      'text-left w-full px-3 py-2 rounded-lg text-sm border-l-[3px] transition-all',
                      isSelected
                        ? 'border-[#0ED3CF] bg-[#F0FFFE] text-[#1A1A1A] font-medium'
                        : 'border-[#E5E5E3] text-[#6B7280] hover:text-[#1A1A1A] hover:border-[#9CA3AF]'
                    )}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
          {sidebarCollapsed.left && (
            <button onClick={() => setSidebarCollapsed(s => ({ ...s, left: false }))} className="self-start text-[#9CA3AF] hover:text-[#6B7280] pt-1" aria-label="Expand projects sidebar">
              <ChevronRight size={14} />
            </button>
          )}

          {/* Center timeline — hero */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {view === 'byProject' && (
              <>
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-[#9CA3AF]">
                    <FolderKanban size={32} className="opacity-40" />
                    <p className="text-sm">No projects in this scenario yet.</p>
                    <p className="text-xs">Use "What if…" on the Scenarios page to create a project.</p>
                  </div>
                ) : (
                  projects.map(p => (
                    <DroppableProjectRow
                      key={p.id}
                      project={p}
                      quarter={quarter}
                      assignments={assignments.filter(a => a.projectId === p.id)}
                      fitLevel={dragScores?.scores.get(p.id)}
                      isOver={dragOverId === p.id}
                      isExpanded={expandedProjectId === p.id}
                      onSelect={() => {
                        setExpandedProjectId(prev => prev === p.id ? null : p.id);
                        setSelectedProjectId(prev => prev === p.id ? null : p.id);
                      }}
                      teamMembers={currentState.teamMembers}
                      bizContacts={currentState.businessContacts}
                    />
                  ))
                )}
              </>
            )}

            {view === 'byPerson' && (
              <div className="space-y-2">
                {memberList.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-[#9CA3AF]">
                    <Users size={32} className="opacity-40" />
                    <p className="text-sm">No team members configured.</p>
                  </div>
                )}
                {memberList.map(m => {
                  const memberAssignments = assignments.filter(a => a.memberId === m.id && a.quarter === quarter);
                  const cap = calculateCapacity(m.id, quarter, currentState);
                  return (
                    <div key={m.id} className="rounded-xl border border-[#E5E5E3] bg-white">
                      <div className="flex items-center gap-3 px-3 h-14">
                        <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0', m.badge === 'IT' ? 'bg-[#0ED3CF]' : 'bg-violet-400')}>
                          {m.name.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-[#1A1A1A] truncate">{m.name}</span>
                            <span className={clsx('text-[10px] font-semibold tracking-wide', m.badge === 'IT' ? 'text-[#0ED3CF]' : 'text-violet-400')}>{m.badge}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-0.5">
                            {memberAssignments.length === 0 ? (
                              <span className="text-xs text-[#9CA3AF]">No assignments</span>
                            ) : (
                              memberAssignments.map(a => {
                                const proj = projects.find(p => p.id === a.projectId);
                                return (
                                  <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-[#F5F3F0] border border-[#E5E5E3] rounded-full px-2 py-0.5">
                                    {proj?.name ?? a.projectId} · {a.days}d
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-xs text-[#9CA3AF]">{m.availableDays}d free</span>
                          <div className="w-16 mt-0.5">
                            <ProgressBar value={cap.usedPercent} max={100} size="sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right sidebar — Team (drag source) */}
          {!sidebarCollapsed.right && (
            <div className="w-44 shrink-0 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Team</span>
                <button onClick={() => setSidebarCollapsed(s => ({ ...s, right: true }))} className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label="Collapse team sidebar">
                  <ChevronRight size={14} />
                </button>
              </div>
              {memberList.map(m => (
                <DraggableMember
                  key={m.id}
                  id={m.id}
                  name={m.name}
                  badge={m.badge}
                  availableDays={m.availableDays}
                  disabled={!canAssign}
                />
              ))}
            </div>
          )}
          {sidebarCollapsed.right && (
            <button onClick={() => setSidebarCollapsed(s => ({ ...s, right: false }))} className="self-start text-[#9CA3AF] hover:text-[#6B7280] pt-1" aria-label="Expand team sidebar">
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* ── Bottom inline SmartAssignmentPanel ───────────────────────────── */}
        {selectedProjectId && (
          <div className="h-72 border-t border-[#F0EFED] overflow-y-auto bg-white">
            <SmartAssignmentPanel
              variant="inline"
              projectId={selectedProjectId}
              projectName={projects.find(p => p.id === selectedProjectId)?.name ?? ''}
              defaultQuarter={quarter}
              requiredSkillIds={projects.find(p => p.id === selectedProjectId)?.requiredSkillIds}
              tentativeAssignments={tentativeBoardAssignments}
              onTentativeAssign={(memberId, days) => {
                addAssignment({ memberId, projectId: selectedProjectId, quarter, days });
                setTentativeBoardAssignments(prev => [...prev.filter(t => t.memberId !== memberId), { memberId, days }]);
              }}
              onTentativeRemove={memberId => setTentativeBoardAssignments(prev => prev.filter(t => t.memberId !== memberId))}
            />
          </div>
        )}
      </div>

      {/* ── Drag overlay (floating card) ───────────────────────────────────── */}
      <DragOverlay>
        {activeDragMember && (
          <div className="flex items-center gap-2 bg-white shadow-lg border border-[#E5E5E3] rounded-xl px-3 py-2 rotate-2 w-40">
            <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0', activeDragMember.badge === 'IT' ? 'bg-[#0ED3CF]' : 'bg-violet-400')}>
              {activeDragMember.name.slice(0, 1)}
            </div>
            <div>
              <p className="text-sm font-medium text-[#1A1A1A] truncate">{activeDragMember.name}</p>
              <p className="text-xs text-[#9CA3AF]">{activeDragMember.availableDays}d free</p>
            </div>
          </div>
        )}
      </DragOverlay>

      {/* ── Drop popover ────────────────────────────────────────────────────── */}
      {dropPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0" onClick={() => setDropPopover(null)} aria-hidden="true" />
          <div className="relative bg-white rounded-xl border border-[#E5E5E3] shadow-xl p-5 w-72">
            <button onClick={() => setDropPopover(null)} className="absolute top-3 right-3 text-[#9CA3AF] hover:text-[#6B7280]" aria-label="Cancel">
              <X size={16} />
            </button>
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1">Assign to {dropPopover.projectName}</h3>
            <p className="text-xs text-[#9CA3AF] mb-4">{dropPopover.memberName}</p>

            {dropPopover.existingDays > 0 && (
              <p className="text-xs text-amber-600 mb-3 bg-amber-50 rounded-lg px-2 py-1.5">
                Already assigned {dropPopover.existingDays}d to this project in {quarter}. Add more days?
              </p>
            )}

            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-[#6B7280]">Days</label>
              <input
                type="number"
                min={1}
                max={999}
                value={popoverDays}
                onChange={e => setPopoverDays(parseInt(e.target.value, 10) || 0)}
                autoFocus
                className="w-20 h-9 text-center text-sm rounded-lg border border-[#E5E5E3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ED3CF]"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDropPopover(null)} className="flex-1">Cancel</Button>
              <Button
                size="sm"
                onClick={handlePopoverConfirm}
                disabled={popoverDays < 1}
                className="flex-1"
              >
                <Check size={14} />
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
