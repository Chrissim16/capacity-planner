/**
 * PlanningBoardV2 — Three-panel Gantt-style Planning Board.
 *
 * Left panel:  PlanLeftSidebar  — collapsible project list (draggable in People view)
 * Center:      PlanningGrid     — Gantt grid (hero surface)
 * Right panel: PlanRightSidebar — collapsible draggable team list
 *
 * Top bar: plan name (inline editable), quarter selector, People/Projects toggle,
 * Quarter|Month|Week granularity toggle, Promote to Baseline, dot menu.
 *
 * Drag-and-drop (via @dnd-kit/core):
 *  - type 'member':         right sidebar → project row → DropDaysModal → addAssignment
 *  - type 'sidebar-project': left sidebar → person row → DropDaysModal → addAssignment
 *  - type 'canvas-project': project row header → left sidebar remove zone → deleteProject (+ cascade assignments)
 *  - type 'canvas-member':  person child-row → right sidebar remove zone → remove all assignments for member on that project
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, MoreHorizontal, Pencil, Copy, Trash2, ArrowUpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, useCurrentState } from '../stores/appStore';
import {
  updateScenario,
  duplicateScenario,
  deleteScenario,
  addProject,
  deleteProject,
  removeJiraWorkItemFromPlan,
  restoreJiraWorkItemToPlan,
  promoteScenarioToBaseline,
  openPlan,
  addAssignment,
  removeAssignment,
} from '../stores/actions';
import { scoreMember } from '../utils/staffing';
import type { FitLevel } from '../utils/staffing';
import { calculateCapacity } from '../utils/capacity';
import { ConfirmModal } from './ui/ConfirmModal';
import { useToast } from './ui/Toast';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { PlanningGrid } from './planning/PlanningGrid';
import type { PlanningViewMode, PlanningGranularity } from './planning/PlanningGrid';
import { PlanLeftSidebar, LEFT_SIDEBAR_REMOVE_ZONE_ID } from './planning/PlanLeftSidebar';
import type { ActiveDragType } from './planning/PlanLeftSidebar';
import { PlanRightSidebar, RIGHT_SIDEBAR_REMOVE_ZONE_ID } from './planning/PlanRightSidebar';
import { Accent, Background, Border, Text, Semantic } from '../theme/tokens';

const GRANULARITY_KEY = 'planningBoard.granularity';

function loadGranularity(): PlanningGranularity {
  try {
    const stored = localStorage.getItem(GRANULARITY_KEY);
    if (stored === 'month' || stored === 'week' || stored === 'quarter') return stored;
  } catch { /* ignore */ }
  return 'quarter';
}

interface PlanningBoardV2Props {
  onBack: () => void;
}

interface DropTarget {
  projectId: string;
  projectName: string;
  memberId: string;
  memberName: string;
  defaultDays: number;
  /** When set, the target is a person row (sidebar-project drag) */
  targetType: 'project-row' | 'person-row';
}

export default function PlanningBoardV2({ onBack }: PlanningBoardV2Props) {
  const activeScenario = useAppStore(useShallow(s => {
    const { activeScenarioId, scenarios } = s.data;
    if (!activeScenarioId) return null;
    return scenarios.find(sc => sc.id === activeScenarioId) ?? null;
  }));
  const quarters = useAppStore(useShallow(s => s.data.quarters));
  const state = useCurrentState();

  const { showToast } = useToast();
  const { user } = useCurrentUser();

  // ── View state ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<PlanningViewMode>('projects');
  const [granularity, setGranularity] = useState<PlanningGranularity>(loadGranularity);
  const [boardQuarter, setBoardQuarter] = useState<string>(() => quarters[0] ?? '');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // ── Panel collapse state ──────────────────────────────────────────────────
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // ── Drag-and-drop state ───────────────────────────────────────────────────
  const [activeDragMemberId, setActiveDragMemberId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<ActiveDragType>(null);
  const [dragScores, setDragScores] = useState<Record<string, FitLevel>>({});
  const [memberDragScores, setMemberDragScores] = useState<Record<string, FitLevel>>({});
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // ── Top bar edit state ────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(activeScenario?.name ?? '');
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep name value in sync when scenario changes externally
  useEffect(() => {
    if (!editingName) setNameValue(activeScenario?.name ?? '');
  }, [activeScenario?.name, editingName]);

  // Sync boardQuarter when quarters list changes
  useEffect(() => {
    if (boardQuarter === '' && quarters.length > 0) {
      setBoardQuarter(quarters[0]);
    }
  }, [quarters, boardQuarter]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Persist granularity to localStorage
  const handleGranularityChange = useCallback((g: PlanningGranularity) => {
    setGranularity(g);
    try { localStorage.setItem(GRANULARITY_KEY, g); } catch { /* ignore */ }
  }, []);

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as Record<string, unknown> | undefined;
    const type = data?.type as ActiveDragType | undefined;

    setActiveDragType(type ?? null);

    if (type === 'member') {
      // Right-sidebar member being dragged → score projects
      const memberId = event.active.id as string;
      const member = state.teamMembers.find(m => m.id === memberId);
      if (!member) return;

      setActiveDragMemberId(memberId);
      const scores: Record<string, FitLevel> = {};
      for (const project of state.projects ?? []) {
        const fit = scoreMember(member, boardQuarter, project.requiredSkillIds ?? [], project.id, state);
        scores[project.id] = fit.fitLevel;
      }
      for (const epic of (state.jiraWorkItems ?? []).filter(w => w.type === 'epic' && w.statusCategory !== 'done')) {
        const fit = scoreMember(member, boardQuarter, [], epic.jiraKey, state);
        scores[epic.jiraKey] = fit.fitLevel;
      }
      setDragScores(scores);
    } else if (type === 'sidebar-project') {
      // Left-sidebar project being dragged (People view) → score members
      const scores: Record<string, FitLevel> = {};
      for (const member of (state.teamMembers ?? []).filter(m => !m.excludedFromCapacity)) {
        const fit = scoreMember(member, boardQuarter, [], '', state, []);
        scores[member.id] = fit.fitLevel;
      }
      setMemberDragScores(scores);
    }
  }, [state, boardQuarter]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const data = event.active.data.current as Record<string, unknown> | undefined;
    const type = data?.type as string | undefined;
    const overId = event.over?.id as string | undefined;

    // Reset all drag state
    setActiveDragMemberId(null);
    setActiveDragType(null);
    setDragScores({});
    setMemberDragScores({});

    if (!overId) return;

    if (type === 'member') {
      // Member dropped on a project row
      const memberId = event.active.id as string;
      const projectId = overId;
      if (!projectId || projectId === LEFT_SIDEBAR_REMOVE_ZONE_ID || projectId === RIGHT_SIDEBAR_REMOVE_ZONE_ID) return;

      const member = state.teamMembers.find(m => m.id === memberId);
      if (!member) return;

      const cap = calculateCapacity(memberId, boardQuarter, state);
      const defaultDays = Math.min(5, Math.max(1, Math.round(cap.availableDays)));

      const project = (state.projects ?? []).find(p => p.id === projectId);
      const jiraEpic = !project ? (state.jiraWorkItems ?? []).find(w => w.jiraKey === projectId) : null;
      const projectName = project?.name ?? (jiraEpic ? `${jiraEpic.jiraKey}: ${jiraEpic.summary}` : projectId);

      setDropTarget({ projectId, projectName, memberId, memberName: member.name, defaultDays, targetType: 'project-row' });

    } else if (type === 'sidebar-project') {
      // Project dragged from left sidebar → dropped on a person row
      if (!overId.startsWith('person-row-')) return;
      const memberId = overId.replace('person-row-', '');
      const projectId = data?.projectId as string | undefined;
      const projectName = (data?.projectName as string | undefined) ?? projectId ?? '';
      if (!memberId || !projectId) return;

      const member = state.teamMembers.find(m => m.id === memberId);
      if (!member) return;

      const cap = calculateCapacity(memberId, boardQuarter, state);
      const defaultDays = Math.min(5, Math.max(1, Math.round(cap.availableDays)));

      setDropTarget({ projectId, projectName, memberId, memberName: member.name, defaultDays, targetType: 'person-row' });

    } else if (type === 'canvas-project') {
      // Project row dragged to left sidebar removal zone
      if (overId !== LEFT_SIDEBAR_REMOVE_ZONE_ID) return;
      const projectId = data?.projectId as string | undefined;
      const projectName = (data?.projectName as string | undefined) ?? projectId ?? 'project';
      if (!projectId) return;

      // Determine whether this is a native project or a Jira epic
      const isNativeProject = (state.projects ?? []).some(p => p.id === projectId);
      const affectedAssignments = (state.assignments ?? []).filter(a => a.projectId === projectId);

      if (isNativeProject) {
        const affectedProject = (state.projects ?? []).find(p => p.id === projectId)!;
        deleteProject(projectId);
        showToast(
          `"${projectName}" removed from plan`,
          {
            type: 'info',
            action: {
              label: 'Undo',
              onClick: () => {
                const { id: _id, createdAt: _c, ...projectData } = affectedProject;
                const restored = addProject(projectData);
                for (const a of affectedAssignments) {
                  addAssignment({ ...a, projectId: restored.id });
                }
              },
            },
          }
        );
      } else {
        // Jira epic — remove from jiraWorkItems in this scenario + cascade assignments
        const affectedEpic = (state.jiraWorkItems ?? []).find(w => w.jiraKey === projectId);
        removeJiraWorkItemFromPlan(projectId);
        showToast(
          `"${projectName}" removed from plan`,
          {
            type: 'info',
            action: {
              label: 'Undo',
              onClick: () => {
                if (affectedEpic) {
                  restoreJiraWorkItemToPlan(affectedEpic);
                  for (const a of affectedAssignments) {
                    addAssignment({ ...a });
                  }
                }
              },
            },
          }
        );
      }

    } else if (type === 'canvas-member') {
      // Person child-row dragged to right sidebar removal zone
      if (overId !== RIGHT_SIDEBAR_REMOVE_ZONE_ID) return;
      const memberId = data?.memberId as string | undefined;
      const memberName = (data?.memberName as string | undefined) ?? 'member';
      const fromProjectId = data?.fromProjectId as string | undefined;
      if (!memberId || !fromProjectId) return;

      const toRemove = (state.assignments ?? []).filter(
        a => a.memberId === memberId && a.projectId === fromProjectId
      );
      const projectDisplay = (state.projects ?? []).find(p => p.id === fromProjectId)?.name
        ?? (state.jiraWorkItems ?? []).find(w => w.jiraKey === fromProjectId)?.summary
        ?? fromProjectId;

      for (const a of toRemove) {
        removeAssignment(a.id);
      }

      showToast(
        `${memberName} removed from ${projectDisplay}`,
        {
          type: 'info',
          action: {
            label: 'Undo',
            onClick: () => {
              for (const a of toRemove) {
                addAssignment({ ...a });
              }
            },
          },
        }
      );
    }
  }, [state, boardQuarter, showToast]);

  // ── Top bar actions ───────────────────────────────────────────────────────
  const handleSaveName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && activeScenario && trimmed !== activeScenario.name) {
      updateScenario(activeScenario.id, { name: trimmed, lastEditedBy: user?.email });
    }
    setEditingName(false);
  }, [nameValue, activeScenario, user?.email]);

  const handleDuplicate = useCallback(() => {
    if (!activeScenario) return;
    const newName = `${activeScenario.name} (Copy)`;
    const copy = duplicateScenario(activeScenario.id, newName);
    if (copy) {
      showToast(`"${newName}" created`, 'success');
      openPlan(copy.id);
    }
    setMenuOpen(false);
  }, [activeScenario, showToast]);

  const handlePromote = useCallback(() => {
    if (!activeScenario) return;
    promoteScenarioToBaseline(activeScenario.id);
    showToast(`"${activeScenario.name}" promoted to baseline`, 'success');
    setConfirmPromote(false);
    onBack();
  }, [activeScenario, showToast, onBack]);

  const handleDelete = useCallback(() => {
    if (!activeScenario) return;
    const name = activeScenario.name;
    deleteScenario(activeScenario.id);
    showToast(`"${name}" deleted`, 'info');
    setConfirmDelete(false);
    onBack();
  }, [activeScenario, showToast, onBack]);

  if (!activeScenario) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-sm" style={{ color: Text.tertiary }}>No plan selected.</p>
          <button
            className="text-sm font-medium focus:ring-2 focus:ring-sana-teal rounded"
            style={{ color: Accent.teal }}
            onClick={onBack}
          >
            Back to Planning Hub
          </button>
        </div>
      </div>
    );
  }

  const activeDragMember = activeDragMemberId
    ? state.teamMembers.find(m => m.id === activeDragMemberId)
    : null;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: Background.primary }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b shrink-0 flex-wrap"
        style={{ borderColor: Border.subtle, backgroundColor: Background.card }}
      >
        {/* Back button */}
        <button
          className="flex items-center gap-1.5 text-sm transition-colors hover:text-sana-teal focus:ring-2 focus:ring-sana-teal rounded px-1 py-0.5"
          style={{ color: Text.tertiary }}
          onClick={onBack}
          aria-label="Back to Planning Hub"
        >
          <ArrowLeft size={15} />
          <span className="hidden sm:inline">Plans</span>
        </button>

        <div className="h-4 w-px" style={{ backgroundColor: Border.subtle }} />

        {/* Plan name — inline editable */}
        {editingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') { setNameValue(activeScenario.name); setEditingName(false); }
            }}
            onBlur={handleSaveName}
            className="text-sm font-semibold outline-none border-b-2 bg-transparent px-0.5"
            style={{ borderColor: Accent.teal, color: Text.primary, minWidth: 160 }}
            aria-label="Edit plan name"
          />
        ) : (
          <button
            className="flex items-center gap-1.5 text-sm font-semibold transition-colors group focus:ring-2 focus:ring-sana-teal rounded px-0.5"
            style={{ color: Text.primary }}
            onClick={() => setEditingName(true)}
            aria-label="Click to rename plan"
          >
            {activeScenario.name}
            <Pencil
              size={12}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: Text.tertiary }}
            />
          </button>
        )}

        {/* Quarter selector */}
        <select
          value={boardQuarter}
          onChange={(e) => setBoardQuarter(e.target.value)}
          className="text-xs border rounded px-2 py-1 focus:ring-2 focus:ring-sana-teal outline-none"
          style={{
            borderColor: Border.subtle,
            color: Text.secondary,
            backgroundColor: Background.card,
          }}
          aria-label="Select quarter for capacity and assignment"
        >
          {quarters.slice(0, 6).map(q => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>

        {/* View toggle (People / Projects) */}
        <div
          className="flex rounded-lg overflow-hidden border"
          style={{ borderColor: Border.subtle }}
          role="group"
          aria-label="View toggle"
        >
          <ViewToggleButton
            label="People"
            active={viewMode === 'people'}
            onClick={() => setViewMode('people')}
          />
          <ViewToggleButton
            label="Projects"
            active={viewMode === 'projects'}
            onClick={() => setViewMode('projects')}
          />
        </div>

        {/* Granularity toggle (Quarter / Month / Week) */}
        <div
          className="flex rounded-lg overflow-hidden border ml-auto"
          style={{ borderColor: Border.subtle }}
          role="group"
          aria-label="Timeline granularity"
        >
          <ViewToggleButton
            label="Quarter"
            active={granularity === 'quarter'}
            onClick={() => handleGranularityChange('quarter')}
          />
          <ViewToggleButton
            label="Month"
            active={granularity === 'month'}
            onClick={() => handleGranularityChange('month')}
          />
          <ViewToggleButton
            label="Week"
            active={granularity === 'week'}
            onClick={() => handleGranularityChange('week')}
          />
        </div>

        {/* Promote to Baseline */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[#F5F3F0] focus:ring-2 focus:ring-sana-teal"
          style={{ borderColor: Border.subtle, color: Text.secondary }}
          onClick={() => setConfirmPromote(true)}
          aria-label="Promote this plan to baseline"
        >
          <ArrowUpCircle size={14} />
          <span className="hidden md:inline">Promote to Baseline</span>
        </button>

        {/* Dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg border transition-colors hover:bg-[#F5F3F0] focus:ring-2 focus:ring-sana-teal"
            style={{ borderColor: Border.subtle, color: Text.secondary }}
            onClick={() => setMenuOpen(v => !v)}
            aria-label="More plan options"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={15} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 rounded-xl shadow-lg border overflow-hidden py-1 w-44 z-20"
              style={{ backgroundColor: Background.card, borderColor: Border.subtle }}
              role="menu"
            >
              <MenuItem
                icon={<Pencil size={14} />}
                label="Rename"
                onClick={() => { setMenuOpen(false); setEditingName(true); }}
              />
              <MenuItem
                icon={<Copy size={14} />}
                label="Duplicate"
                onClick={handleDuplicate}
              />
              <div className="h-px my-1" style={{ backgroundColor: Border.subtle }} />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Delete"
                danger
                onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Three-panel body ──────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar — Projects */}
          <PlanLeftSidebar
            selectedProjectId={selectedProjectId}
            onProjectSelect={setSelectedProjectId}
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed(v => !v)}
            activeDragType={activeDragType}
            viewMode={viewMode}
          />

          {/* Center — Gantt grid (hero) */}
          <div className="flex-1 overflow-hidden">
            <PlanningGrid
              viewMode={viewMode}
              granularity={granularity}
              dragScores={dragScores}
              memberDragScores={memberDragScores}
              selectedProjectId={selectedProjectId}
              isBaseline={activeScenario.isBaseline}
            />
          </div>

          {/* Right sidebar — Team */}
          <PlanRightSidebar
            selectedQuarter={boardQuarter}
            activeDragMemberId={activeDragMemberId}
            collapsed={rightCollapsed}
            onToggleCollapse={() => setRightCollapsed(v => !v)}
            activeDragType={activeDragType}
          />
        </div>

        {/* Floating drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeDragMember ? (
            <MemberDragOverlay member={activeDragMember} />
          ) : activeDragType === 'sidebar-project' ? (
            <ProjectDragOverlay />
          ) : activeDragType === 'canvas-project' ? (
            <CanvasDragOverlay label="Remove from plan" />
          ) : activeDragType === 'canvas-member' ? (
            <CanvasDragOverlay label="Remove from project" />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Drop days modal ───────────────────────────────────────────────────── */}
      {dropTarget && (
        <DropDaysModal
          target={dropTarget}
          quarter={boardQuarter}
          onConfirm={(days, startDate, endDate) => {
            const effectiveQuarter = startDate
              ? deriveQuarter(startDate)
              : boardQuarter;
            addAssignment({
              memberId: dropTarget.memberId,
              projectId: dropTarget.projectId,
              quarter: effectiveQuarter,
              days,
              startDate,
              endDate,
            });
            showToast(
              `Assigned ${days}d to ${dropTarget.memberName} on ${dropTarget.projectName}`,
              'success'
            );
            setDropTarget(null);
          }}
          onClose={() => setDropTarget(null)}
        />
      )}

      {/* ── Confirm modals ────────────────────────────────────────────────────── */}
      {confirmPromote && (
        <ConfirmModal
          isOpen
          title="Promote to Baseline"
          message={`This will overwrite baseline staffing data with the contents of "${activeScenario.name}". This cannot be undone.`}
          confirmLabel="Promote"
          variant="warning"
          onConfirm={handlePromote}
          onClose={() => setConfirmPromote(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen
          title="Delete Plan"
          message={`Delete "${activeScenario.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deriveQuarter(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DropDaysModal — shown after dropping a member/project
// ─────────────────────────────────────────────────────────────────────────────

interface DropDaysModalProps {
  target: DropTarget;
  quarter: string;
  onConfirm: (days: number, startDate?: string, endDate?: string) => void;
  onClose: () => void;
}

function DropDaysModal({ target, quarter, onConfirm, onClose }: DropDaysModalProps) {
  const [days, setDays] = useState(target.defaultDays);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (days > 0) onConfirm(days);
  }, [days, onConfirm]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        className="rounded-2xl border shadow-xl w-80 overflow-hidden"
        style={{ backgroundColor: Background.card, borderColor: Border.subtle }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drop-days-title"
      >
        <div className="px-5 pt-5 pb-4">
          <h3
            id="drop-days-title"
            className="text-sm font-semibold mb-0.5"
            style={{ color: Text.primary }}
          >
            Assign {target.memberName}
          </h3>
          <p className="text-xs" style={{ color: Text.tertiary }}>
            {target.projectName} · {quarter}
          </p>
        </div>

        <div className="px-5 pb-5">
          <label
            htmlFor="drop-days-input"
            className="block text-xs font-medium mb-1.5"
            style={{ color: Text.secondary }}
          >
            How many days?
          </label>
          <input
            id="drop-days-input"
            type="number"
            min={1}
            max={999}
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            autoFocus
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sana-teal"
            style={{
              borderColor: Border.subtle,
              color: Text.primary,
              backgroundColor: Background.primary,
            }}
          />
        </div>

        <div
          className="flex justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: Border.subtle, backgroundColor: Background.secondary }}
        >
          <button
            className="px-4 py-1.5 text-sm rounded-lg border transition-colors hover:bg-[#F5F3F0] focus:ring-2 focus:ring-sana-teal"
            style={{ borderColor: Border.subtle, color: Text.secondary }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors focus:ring-2 focus:ring-sana-teal"
            style={{ backgroundColor: Accent.teal, color: '#fff' }}
            onClick={handleConfirm}
            disabled={days < 1}
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag overlay sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MemberDragOverlay({ member }: { member: { name: string } }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg select-none"
      style={{
        backgroundColor: Background.card,
        borderColor: Accent.teal,
        transform: CSS.Transform.toString({ x: 0, y: 0, scaleX: 1.02, scaleY: 1.02 }),
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
        style={{ backgroundColor: Accent.teal }}
      >
        {member.name.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium" style={{ color: Text.primary }}>{member.name}</span>
          <span className="text-[9px] font-semibold" style={{ color: Accent.teal }}>IT</span>
        </div>
        <span className="text-[10px]" style={{ color: Text.tertiary }}>Drop on a project to assign</span>
      </div>
    </div>
  );
}

function ProjectDragOverlay() {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg select-none"
      style={{ backgroundColor: Background.card, borderColor: Accent.teal }}
    >
      <span className="text-xs font-medium" style={{ color: Text.primary }}>Drop on a person row to assign</span>
    </div>
  );
}

function CanvasDragOverlay({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg select-none"
      style={{ backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }}
    >
      <span className="text-xs font-medium" style={{ color: '#92400E' }}>↩ {label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ViewToggleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={clsx(
        'px-3 py-1.5 text-sm font-medium transition-colors focus:ring-2 focus:ring-inset focus:ring-sana-teal',
        active ? 'text-white' : 'hover:bg-[#F5F3F0]'
      )}
      style={active ? { backgroundColor: Accent.teal, color: '#fff' } : { color: Text.secondary }}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onClick, danger = false }: MenuItemProps) {
  return (
    <button
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors focus:ring-2 focus:ring-sana-teal hover:bg-[#F5F3F0]"
      style={{ color: danger ? Semantic.danger : Text.secondary }}
      onClick={onClick}
      role="menuitem"
    >
      {icon}
      {label}
    </button>
  );
}
