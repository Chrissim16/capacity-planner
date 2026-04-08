import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, PencilLine } from 'lucide-react';
import type { CapacityRequest, JiraWorkItem } from '../../types';

export type CapacityBacklogItem =
  | { kind: 'jira'; item: JiraWorkItem }
  | { kind: 'request'; item: CapacityRequest };

export interface CapacityJiraItemMeta {
  epicKey?: string;
  epicSummary?: string;
  onPortfolioBoard?: boolean;
  staffingRisk?: boolean;
  usesExternal?: boolean;
}

interface CapacityRequestCardProps {
  entry: CapacityBacklogItem;
  onRemoveRequest?: (id: string) => void;
  jiraMeta?: CapacityJiraItemMeta;
}

export function CapacityRequestCard({ entry, onRemoveRequest, jiraMeta }: CapacityRequestCardProps) {
  const draggableId = entry.kind === 'jira' ? `jira:${entry.item.id}` : `request:${entry.item.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: entry,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-[#DEDFE3] bg-white p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {entry.kind === 'request' ? (
              <>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FFF7ED] text-[#C2410C]">
                  <PencilLine size={11} />
                </span>
                <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] font-medium text-[#C2410C]">
                  What-if request
                </span>
              </>
            ) : (
              <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
                {entry.item.jiraKey}
              </span>
            )}
            {entry.kind === 'jira' ? (
              <span className="rounded-full bg-[#F8FAFC] px-2 py-0.5 text-[11px] text-[#475569]">
                {entry.item.typeName}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-medium text-[#1E293B]">
            {entry.kind === 'jira' ? entry.item.summary : entry.item.name}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            {entry.kind === 'jira'
              ? `${entry.item.status} · ${(entry.item.originalEstimate ?? entry.item.storyPoints ?? 1)}d estimate`
              : `${entry.item.estimatedDays}d${entry.item.sprintId ? ` · target ${entry.item.sprintId}` : ''} · scenario only`}
          </p>
          {entry.kind === 'jira' && jiraMeta ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {jiraMeta.epicKey ? (
                <span className="rounded-full bg-[#F8FAFC] px-2 py-0.5 text-[11px] text-[#475569]">
                  Epic {jiraMeta.epicKey}
                </span>
              ) : null}
              {jiraMeta.onPortfolioBoard ? (
                <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] text-[#047857]">
                  On portfolio board
                </span>
              ) : null}
              {jiraMeta.staffingRisk ? (
                <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] text-[#C2410C]">
                  Staffing risk
                </span>
              ) : null}
              {jiraMeta.usesExternal ? (
                <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] text-[#1D4ED8]">
                  Uses external
                </span>
              ) : null}
            </div>
          ) : null}
          {entry.kind === 'request' && entry.item.requiredSkills?.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.item.requiredSkills.map((skill) => (
                <span key={skill} className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] text-[#475569]">
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
          {entry.kind === 'request' ? (
            <p className="mt-2 text-[11px] leading-relaxed text-[#94A3B8]">
              Scenario-only delivery work. This is not imported from Jira and does not change breakdown coverage.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#334155]"
          {...attributes}
          {...listeners}
          aria-label="Drag item"
        >
          <GripVertical size={14} />
        </button>
      </div>
      {entry.kind === 'request' && onRemoveRequest ? (
        <button
          type="button"
          onClick={() => onRemoveRequest(entry.item.id)}
          className="mt-3 text-xs text-[#94A3B8] hover:text-[#DC2626]"
        >
          Remove request
        </button>
      ) : null}
    </div>
  );
}
