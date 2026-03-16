/**
 * PlanLeftSidebar — collapsible 260px left panel listing plan projects and Jira epics.
 *
 * v2.1 improvements:
 *  - Expanded to 260px with card-style items (border-radius, padding, gap)
 *  - Items show Jira key + status badge on second line
 *  - Items are draggable in People view (type: sidebar-project) to assign to a person row
 *  - Shows an amber removal drop zone when a canvas-project drag is in flight
 */
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, FolderKanban, GripVertical } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { useCurrentState } from '../../stores/appStore';
import { Accent, Background, Border, Text, Semantic } from '../../theme/tokens';
import type { JiraWorkItem, Project } from '../../types';

const SIDEBAR_WIDTH = 260;

// Drop zone id used by the DnD context to identify the "remove from plan" zone
export const LEFT_SIDEBAR_REMOVE_ZONE_ID = '__left-sidebar-remove-zone__';

export type ActiveDragType = 'member' | 'sidebar-project' | 'canvas-project' | 'canvas-member' | null;

export interface PlanLeftSidebarProps {
  selectedProjectId: string | null;
  onProjectSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Current drag type from the DnD context — controls visibility of the removal zone */
  activeDragType?: ActiveDragType;
  /** 'projects' view shows project rows; 'people' view enables left-sidebar drag */
  viewMode?: 'people' | 'projects';
}

export function PlanLeftSidebar({
  selectedProjectId,
  onProjectSelect,
  collapsed,
  onToggleCollapse,
  activeDragType = null,
  viewMode = 'projects',
}: PlanLeftSidebarProps) {
  const state = useCurrentState();
  const projects = state.projects ?? [];
  const jiraEpics = useMemo(
    () => (state.jiraWorkItems ?? []).filter(w => w.type === 'epic' && w.statusCategory !== 'done'),
    [state.jiraWorkItems]
  );
  const hasContent = projects.length > 0 || jiraEpics.length > 0;
  const showSections = projects.length > 0 && jiraEpics.length > 0;

  // Removal drop zone: only visible when a canvas-project drag is active
  const showRemoveZone = activeDragType === 'canvas-project';
  const { setNodeRef: setRemoveRef, isOver: isOverRemove } = useDroppable({
    id: LEFT_SIDEBAR_REMOVE_ZONE_ID,
    disabled: !showRemoveZone,
  });

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 gap-3 border-r shrink-0"
        style={{ width: 40, borderColor: Border.subtle, backgroundColor: Background.card }}
      >
        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F5F3F0] transition-colors focus:ring-2 focus:ring-sana-teal"
          style={{ color: Text.tertiary }}
          onClick={onToggleCollapse}
          aria-label="Expand projects sidebar"
        >
          <ChevronRight size={14} />
        </button>
        <FolderKanban size={14} style={{ color: Text.tertiary }} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col border-r shrink-0 overflow-hidden"
      style={{ width: SIDEBAR_WIDTH, borderColor: Border.subtle, backgroundColor: Background.card }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: Border.subtle }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: Text.tertiary }}
        >
          Projects
        </span>
        <button
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#F5F3F0] transition-colors focus:ring-2 focus:ring-sana-teal"
          style={{ color: Text.tertiary }}
          onClick={onToggleCollapse}
          aria-label="Collapse projects sidebar"
        >
          <ChevronLeft size={13} />
        </button>
      </div>

      {/* Removal drop zone — amber, only visible during canvas-project drag */}
      {showRemoveZone && (
        <div
          ref={setRemoveRef}
          className={clsx(
            'mx-2 my-2 rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-colors shrink-0',
            isOverRemove
              ? 'bg-amber-100 border-2 border-amber-400'
              : 'border-2 border-dashed border-amber-300 bg-amber-50'
          )}
          style={{ height: 40, color: '#92400E' }}
          aria-label="Remove project from plan"
        >
          <span>↩</span>
          <span>Remove from plan</span>
        </div>
      )}

      {/* Item list */}
      <div className="flex-1 overflow-y-auto py-1.5 px-2 flex flex-col gap-1.5">
        {!hasContent ? (
          <div className="px-3 py-4 text-center">
            <span className="text-xs" style={{ color: Text.tertiary }}>No projects yet</span>
          </div>
        ) : (
          <>
            {/* Jira Epics */}
            {jiraEpics.length > 0 && (
              <>
                {showSections && (
                  <div
                    className="px-1 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: Text.tertiary }}
                  >
                    Jira Epics
                  </div>
                )}
                {jiraEpics.map(epic => (
                  <SidebarProjectCard
                    key={epic.jiraKey}
                    id={epic.jiraKey}
                    name={epic.summary}
                    subtitle={`${epic.jiraKey} · ${epic.status}`}
                    isSelected={selectedProjectId === epic.jiraKey}
                    isDraggable={viewMode === 'people'}
                    onSelect={() => onProjectSelect(epic.jiraKey)}
                  />
                ))}
              </>
            )}

            {/* Plan Projects */}
            {projects.length > 0 && (
              <>
                {showSections && (
                  <div
                    className="px-1 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: Text.tertiary }}
                  >
                    Plan Projects
                  </div>
                )}
                {projects.map(project => (
                  <SidebarProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    subtitle={project.priority}
                    isSelected={selectedProjectId === project.id}
                    isDraggable={viewMode === 'people'}
                    onSelect={() => onProjectSelect(project.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Drag hint — only in People view */}
      {viewMode === 'people' && hasContent && (
        <div
          className="px-3 py-2 text-[10px] text-center border-t"
          style={{ color: Text.tertiary, borderColor: Border.subtle }}
        >
          Drag onto a person row
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar project card — optionally draggable (People view)
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProjectCardProps {
  id: string;
  name: string;
  subtitle?: string;
  isSelected: boolean;
  isDraggable: boolean;
  onSelect: () => void;
}

function SidebarProjectCard({ id, name, subtitle, isSelected, isDraggable, onSelect }: SidebarProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `sidebar-project-${id}`,
    data: { type: 'sidebar-project', projectId: id, projectName: name },
    disabled: !isDraggable,
  });

  const style = transform ? { transform: CSS.Transform.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderRadius: 8,
        boxShadow: isSelected ? `0 0 0 2px ${Accent.teal}` : undefined,
        borderLeft: `3px solid ${isSelected ? Accent.teal : Border.subtle}`,
        backgroundColor: isSelected ? Background.highlight : Background.primary,
        opacity: isDragging ? 0 : 1,
      }}
      className={clsx(
        'flex items-start gap-1 px-3 py-2.5 transition-all select-none group',
        'hover:shadow-sm',
        isDraggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      {/* Drag handle — visible on hover when draggable */}
      {isDraggable && (
        <div
          {...listeners}
          {...attributes}
          className="mt-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity shrink-0 cursor-grab"
          style={{ color: Text.tertiary }}
          aria-label="Drag to assign"
        >
          <GripVertical size={13} />
        </div>
      )}

      {/* Content — clicking selects */}
      <button
        className="flex flex-col min-w-0 flex-1 text-left focus:outline-none"
        onClick={onSelect}
        aria-pressed={isSelected}
      >
        <span
          className="block text-[13px] font-medium truncate leading-snug"
          style={{ color: isSelected ? Text.primary : Text.secondary }}
        >
          {name}
        </span>
        {subtitle && (
          <span
            className="block text-[10px] mt-0.5 truncate"
            style={{ color: Text.tertiary }}
          >
            {subtitle}
          </span>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status color helper
// ─────────────────────────────────────────────────────────────────────────────

export function statusBadgeColor(statusCategory: JiraWorkItem['statusCategory'] | undefined): string {
  switch (statusCategory) {
    case 'done': return Semantic.success;
    case 'in_progress': return '#F59E0B';
    default: return Text.tertiary;
  }
}

// Re-export Project type for callers that import from this module
export type { Project, JiraWorkItem };
