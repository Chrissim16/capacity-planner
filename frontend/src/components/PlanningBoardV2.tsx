/**
 * PlanningBoardV2 — Gantt-style Planning Board.
 *
 * Top bar: plan name (inline editable), People/Projects view toggle,
 * Promote to Baseline, dot menu (Rename, Duplicate, Delete).
 * Center: PlanningGrid with quarter columns.
 * Left panel (Idea Backlog) is out of scope for this release.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, MoreHorizontal, Pencil, Copy, Trash2, ArrowUpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../stores/appStore';
import {
  updateScenario,
  duplicateScenario,
  deleteScenario,
  promoteScenarioToBaseline,
  openPlan,
} from '../stores/actions';
import { ConfirmModal } from './ui/ConfirmModal';
import { useToast } from './ui/Toast';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { PlanningGrid } from './planning/PlanningGrid';
import type { PlanningViewMode } from './planning/PlanningGrid';
import { Accent, Background, Border, Text, Semantic } from '../theme/tokens';

interface PlanningBoardV2Props {
  onBack: () => void;
}

export default function PlanningBoardV2({ onBack }: PlanningBoardV2Props) {
  const activeScenario = useAppStore(useShallow(s => {
    const { activeScenarioId, scenarios } = s.data;
    if (!activeScenarioId) return null;
    return scenarios.find(sc => sc.id === activeScenarioId) ?? null;
  }));

  const { showToast } = useToast();
  const { user } = useCurrentUser();

  const [viewMode, setViewMode] = useState<PlanningViewMode>('people');
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

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: Background.primary }}>
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
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

        {/* View toggle */}
        <div
          className="flex rounded-lg overflow-hidden border ml-auto"
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

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <PlanningGrid viewMode={viewMode} />
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
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
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors focus:ring-2 focus:ring-sana-teal"
      style={{ color: danger ? Semantic.danger : Text.secondary }}
      onClick={onClick}
      role="menuitem"
    >
      {icon}
      {label}
    </button>
  );
}
