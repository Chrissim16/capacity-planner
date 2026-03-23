/**
 * PlannerContextMenu — Right-click menu for timeline bars.
 *
 * SP-19:
 *   Manual items  → Edit, Delete (with undo toast)
 *   Jira-sourced  → View in Jira (opens Jira URL)
 */

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useCurrentState } from '../../stores/appStore';
import type { PlannerItem } from '../../types';

export interface ContextMenuTarget {
  item: PlannerItem;
  x: number;
  y: number;
}

export interface PlannerContextMenuProps {
  target: ContextMenuTarget;
  onEdit: (item: PlannerItem) => void;
  onDelete: (item: PlannerItem) => void;
  onClose: () => void;
}

export function PlannerContextMenu({ target, onEdit, onDelete, onClose }: PlannerContextMenuProps) {
  const { item, x, y } = target;
  const isManual = item.isManual;
  const { jiraConnections } = useCurrentState();
  const jiraBaseUrl = useMemo(
    () => jiraConnections.find(c => c.isActive)?.jiraBaseUrl.replace(/\/+$/, '') ?? '',
    [jiraConnections]
  );

  const showJiraLink = !isManual && !!item.jiraKey && !!jiraBaseUrl;

  const rowCount = isManual
    ? 2
    : [showJiraLink].filter(Boolean).length;

  useEffect(() => {
    const close = () => onClose();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // Keep menu within viewport
  const menuW = 200;
  const menuH = rowCount * 40 + 8;
  const posX = Math.min(x, window.innerWidth - menuW - 8);
  const posY = Math.min(y, window.innerHeight - menuH - 8);

  const menu = (
    <div
      role="menu"
      style={{ position: 'fixed', left: posX, top: posY, width: menuW, zIndex: 99999 }}
      className="bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-mileway-border py-1"
      onClick={e => e.stopPropagation()}
    >
      {isManual ? (
        <>
          <button
            role="menuitem"
            onClick={() => { onEdit(item); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-mileway-text hover:bg-mileway-bg transition-colors focus:outline-none focus:bg-mileway-bg"
          >
            <Pencil size={13} className="text-mileway-grey" />
            Edit
          </button>
          <button
            role="menuitem"
            onClick={() => { onDelete(item); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:bg-red-50"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </>
      ) : (
        <>
          {showJiraLink && (
            <button
              role="menuitem"
              onClick={() => {
                window.open(`${jiraBaseUrl}/browse/${item.jiraKey}`, '_blank');
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-mileway-text hover:bg-mileway-bg transition-colors focus:outline-none focus:bg-mileway-bg"
            >
              <ExternalLink size={13} className="text-mileway-grey" />
              View in Jira
            </button>
          )}
        </>
      )}
    </div>
  );

  return createPortal(menu, document.body);
}
