/**
 * PlanLeftSidebar — collapsible ~180px left panel listing plan projects and Jira epics.
 * Clicking an item calls onProjectSelect, which highlights the row in the center grid.
 */
import { ChevronLeft, ChevronRight, FolderKanban } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import { Accent, Background, Border, Text } from '../../theme/tokens';

const SIDEBAR_WIDTH = 180;

export interface PlanLeftSidebarProps {
  selectedProjectId: string | null;
  onProjectSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function PlanLeftSidebar({
  selectedProjectId,
  onProjectSelect,
  collapsed,
  onToggleCollapse,
}: PlanLeftSidebarProps) {
  const state = useCurrentState();
  const projects = state.projects ?? [];
  const jiraEpics = (state.jiraWorkItems ?? []).filter(
    w => w.type === 'epic' && w.statusCategory !== 'done'
  );
  const hasContent = projects.length > 0 || jiraEpics.length > 0;
  const showSections = projects.length > 0 && jiraEpics.length > 0;

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

      {/* Item list */}
      <div className="flex-1 overflow-y-auto py-1">
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
                    className="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: Text.tertiary }}
                  >
                    Jira Epics
                  </div>
                )}
                {jiraEpics.map(epic => {
                  const isSelected = selectedProjectId === epic.jiraKey;
                  return (
                    <button
                      key={epic.jiraKey}
                      className="w-full text-left px-3 py-1.5 text-xs transition-colors border-l-[2px] hover:bg-[#F5F3F0] focus:ring-2 focus:ring-sana-teal focus:ring-inset"
                      style={{
                        borderLeftColor: isSelected ? Accent.teal : 'transparent',
                        backgroundColor: isSelected ? Background.highlight : undefined,
                        color: isSelected ? Text.primary : Text.secondary,
                      }}
                      onClick={() => onProjectSelect(epic.jiraKey)}
                      aria-pressed={isSelected}
                    >
                      <span className="block truncate font-medium">{epic.summary}</span>
                      <span
                        className="block text-[10px] mt-0.5"
                        style={{ color: Text.tertiary }}
                      >
                        {epic.jiraKey}
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Plan Projects */}
            {projects.length > 0 && (
              <>
                {showSections && (
                  <div
                    className="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: Text.tertiary }}
                  >
                    Plan Projects
                  </div>
                )}
                {projects.map(project => {
                  const isSelected = selectedProjectId === project.id;
                  return (
                    <button
                      key={project.id}
                      className="w-full text-left px-3 py-1.5 text-xs transition-colors border-l-[2px] hover:bg-[#F5F3F0] focus:ring-2 focus:ring-sana-teal focus:ring-inset"
                      style={{
                        borderLeftColor: isSelected ? Accent.teal : 'transparent',
                        backgroundColor: isSelected ? Background.highlight : undefined,
                        color: isSelected ? Text.primary : Text.secondary,
                      }}
                      onClick={() => onProjectSelect(project.id)}
                      aria-pressed={isSelected}
                    >
                      <span className="block truncate font-medium">{project.name}</span>
                    </button>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
