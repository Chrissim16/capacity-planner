import { useState, useEffect, useCallback } from 'react';
import { Plus, MoreHorizontal, Pencil, Copy, ArrowUpCircle, Trash2, X, Map } from 'lucide-react';
import { clsx } from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../stores/appStore';
import {
  openPlan,
  deleteScenario,
  duplicateScenario,
  updateScenario,
  promoteScenarioToBaseline,
} from '../stores/actions';
import { NewPlanModal } from './NewPlanModal';
import { ConfirmModal } from './ui/ConfirmModal';
import { useToast } from './ui/Toast';
import { useCurrentUser } from '../hooks/useCurrentUser';
import type { Scenario } from '../types';
import { Accent, Background, Border, Text, Semantic } from '../theme/tokens';

const LAST_OPENED_KEY = 'cp_last_opened_plan_id';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatAbsoluteTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface PlanStats {
  projectCount: number;
  memberCount: number;
  assignedDays: number;
  neededDays: number;
  staffedPercent: number;
}

function computePlanStats(scenario: Scenario): PlanStats {
  const projects = scenario.projects ?? [];
  const assignments = scenario.assignments ?? [];

  const projectCount = projects.length;
  const memberIds = new Set(assignments.map(a => a.memberId));
  const memberCount = memberIds.size;

  const neededDays = projects.reduce((sum, p) => {
    return sum + Object.values(p.daysPerQuarter ?? {}).reduce((s, d) => s + d, 0);
  }, 0);

  const assignedDays = assignments.reduce((sum, a) => sum + (a.days ?? 0), 0);
  const staffedPercent = neededDays > 0 ? Math.round((assignedDays / neededDays) * 100) : 0;

  return { projectCount, memberCount, assignedDays, neededDays, staffedPercent };
}

function staffingBarColor(pct: number): string {
  if (pct >= 90) return Semantic.success;
  if (pct >= 50) return Semantic.warning;
  return Semantic.danger;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan Card
// ─────────────────────────────────────────────────────────────────────────────

interface PlanCardProps {
  scenario: Scenario;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onPromote: () => void;
  onDelete: () => void;
}

function PlanCard({ scenario, onOpen, onRename, onDuplicate, onPromote, onDelete }: PlanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const stats = computePlanStats(scenario);
  const barColor = staffingBarColor(stats.staffedPercent);

  return (
    <div
      className="relative bg-white rounded-xl border flex flex-col gap-3 p-5 cursor-pointer transition-shadow duration-150 hover:shadow-md group"
      style={{ borderColor: Border.subtle, minHeight: 168 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
      aria-label={`Open plan: ${scenario.name}`}
    >
      {/* Name */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold truncate" style={{ color: Text.primary, maxWidth: '80%' }}>
          {scenario.name}
        </span>
        {/* Dot menu */}
        <button
          className={clsx(
            'shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-opacity duration-150',
            hovered || menuOpen ? 'opacity-100' : 'opacity-0',
            'hover:bg-[#F0F2F5] focus:opacity-100 focus:ring-2 focus:ring-mileway-light-blue'
          )}
          style={{ color: Text.secondary }}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          aria-label="Plan options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={15} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs" style={{ color: Text.tertiary }}>
        <span>{stats.projectCount} project{stats.projectCount !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{stats.memberCount} member{stats.memberCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Staffing progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs" style={{ color: Text.secondary }}>
          <span>Staffing</span>
          <span style={{ color: barColor, fontWeight: 600 }}>{stats.staffedPercent}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: Background.secondary }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(stats.staffedPercent, 100)}%`, backgroundColor: barColor }}
          />
        </div>
        {stats.neededDays > 0 && (
          <div className="text-[11px]" style={{ color: Text.tertiary }}>
            {stats.assignedDays}d assigned / {stats.neededDays}d needed
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-end justify-between mt-auto pt-1">
        <div
          className="text-[11px]"
          style={{ color: Text.tertiary }}
          title={scenario.lastEditedBy
            ? `Last edited by ${scenario.lastEditedBy}, ${formatAbsoluteTime(scenario.updatedAt)}`
            : formatAbsoluteTime(scenario.updatedAt)}
        >
          {scenario.lastEditedBy ? `${scenario.lastEditedBy} · ` : ''}
          {formatRelativeTime(scenario.updatedAt)}
        </div>

        {/* Hover CTA */}
        <span
          className={clsx(
            'text-xs font-medium transition-opacity duration-150',
            hovered ? 'opacity-100' : 'opacity-0'
          )}
          style={{ color: Accent.teal }}
          aria-hidden="true"
        >
          Open →
        </span>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="absolute right-3 top-10 z-20 rounded-xl shadow-lg border overflow-hidden py-1 w-52"
          style={{ backgroundColor: Background.card, borderColor: Border.subtle }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[#F0F2F5] focus:ring-2 focus:ring-mileway-light-blue"
            style={{ color: Text.secondary }}
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(); }}
          >
            <Pencil size={14} />
            Rename
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[#F0F2F5] focus:ring-2 focus:ring-mileway-light-blue"
            style={{ color: Text.secondary }}
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(); }}
          >
            <Copy size={14} />
            Duplicate
          </button>
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[#F0F2F5] focus:ring-2 focus:ring-mileway-light-blue"
            style={{ color: Text.secondary }}
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPromote(); }}
          >
            <ArrowUpCircle size={14} />
            Promote to Baseline
          </button>
          <div className="h-px my-1" style={{ backgroundColor: Border.subtle }} />
          <button
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-red-50 focus:ring-2 focus:ring-mileway-light-blue"
            style={{ color: Semantic.danger }}
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Plan Card
// ─────────────────────────────────────────────────────────────────────────────

function NewPlanCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-5 transition-colors duration-150 hover:border-mileway-light-blue hover:bg-[#E6F2FC] focus:ring-2 focus:ring-mileway-light-blue group"
      style={{ borderColor: Border.subtle, minHeight: 168 }}
      onClick={onClick}
      aria-label="Create new plan"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150 group-hover:bg-mileway-light-blue"
        style={{ backgroundColor: Background.secondary }}
      >
        <Plus size={18} className="transition-colors duration-150 group-hover:text-white" style={{ color: Text.tertiary }} />
      </div>
      <span className="text-sm font-medium" style={{ color: Text.secondary }}>New Plan</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rename inline modal (simple prompt)
// ─────────────────────────────────────────────────────────────────────────────

interface RenameModalProps {
  scenario: Scenario;
  onClose: () => void;
  currentUserEmail?: string;
}

function RenameModal({ scenario, onClose, currentUserEmail }: RenameModalProps) {
  const [name, setName] = useState(scenario.name);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateScenario(scenario.id, { name: trimmed, lastEditedBy: currentUserEmail });
    onClose();
  }, [name, scenario.id, onClose, currentUserEmail]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Rename plan"
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4"
        style={{ backgroundColor: Background.card, borderColor: Border.subtle }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: Text.primary }}>Rename plan</h2>
          <button
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#F0F2F5] focus:ring-2 focus:ring-mileway-light-blue"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} style={{ color: Text.secondary }} />
          </button>
        </div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mileway-light-blue"
          style={{ borderColor: Border.subtle, color: Text.primary }}
          placeholder="Plan name"
        />
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F0F2F5] focus:ring-2 focus:ring-mileway-light-blue"
            style={{ color: Text.secondary }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-mileway-light-blue disabled:opacity-50"
            style={{ backgroundColor: Accent.teal }}
            disabled={!name.trim()}
            onClick={handleSubmit}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Planning Hub
// ─────────────────────────────────────────────────────────────────────────────

export function PlanningHub() {
  const scenarios = useAppStore(useShallow((s) => s.data.scenarios.filter(sc => !sc.isBaseline)));
  const { showToast } = useToast();
  const { user } = useCurrentUser();

  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Scenario | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<Scenario | null>(null);
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(() => {
    try { return localStorage.getItem(LAST_OPENED_KEY); } catch { return null; }
  });
  const [resumeDismissed, setResumeDismissed] = useState(false);

  const lastOpenedPlan = lastOpenedId && !resumeDismissed
    ? scenarios.find(s => s.id === lastOpenedId) ?? null
    : null;

  // Keep LAST_OPENED_KEY in sync when plans are deleted
  useEffect(() => {
    if (lastOpenedId && !scenarios.find(s => s.id === lastOpenedId)) {
      setLastOpenedId(null);
      try { localStorage.removeItem(LAST_OPENED_KEY); } catch { /* ignore */ }
    }
  }, [scenarios, lastOpenedId]);

  const handleOpen = useCallback((id: string) => {
    try { localStorage.setItem(LAST_OPENED_KEY, id); } catch { /* ignore */ }
    setLastOpenedId(id);
    openPlan(id);
  }, []);

  const handleDuplicate = useCallback((scenario: Scenario) => {
    const newName = `${scenario.name} (Copy)`;
    const copy = duplicateScenario(scenario.id, newName);
    if (copy) {
      showToast(`"${newName}" created`, 'success');
    }
  }, [showToast]);

  const handlePromote = useCallback(() => {
    if (!promoteTarget) return;
    promoteScenarioToBaseline(promoteTarget.id);
    showToast(`"${promoteTarget.name}" promoted to baseline`, 'success');
    setPromoteTarget(null);
  }, [promoteTarget, showToast]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteScenario(deleteTarget.id);
    showToast(`"${deleteTarget.name}" deleted`, 'info');
    setDeleteTarget(null);
  }, [deleteTarget, showToast]);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: Background.primary }}>
      {/* Resume banner */}
      {lastOpenedPlan && (
        <div
          className="flex items-center justify-between px-6 py-2.5 text-sm border-b"
          style={{ backgroundColor: Background.highlight, borderColor: Border.subtle, color: Text.secondary }}
        >
          <span>
            You were working on <strong style={{ color: Text.primary }}>{lastOpenedPlan.name}</strong>
          </span>
          <div className="flex items-center gap-3">
            <button
              className="text-sm font-medium hover:underline focus:ring-2 focus:ring-mileway-light-blue rounded"
              style={{ color: Accent.teal }}
              onClick={() => handleOpen(lastOpenedPlan.id)}
            >
              Continue Planning →
            </button>
            <button
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#CCF9F8] focus:ring-2 focus:ring-mileway-light-blue"
              style={{ color: Text.tertiary }}
              onClick={() => setResumeDismissed(true)}
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: "'DM Sans', ui-sans-serif, sans-serif", color: Text.primary }}
          >
            Planning
          </h1>
          <p className="text-sm mt-0.5" style={{ color: Text.tertiary }}>
            {scenarios.length} plan{scenarios.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 pt-16">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: Background.highlight }}
            >
              <Map size={26} style={{ color: Accent.teal }} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-medium" style={{ color: Text.primary }}>No plans yet</p>
              <p className="text-sm" style={{ color: Text.tertiary }}>
                Create a plan to start mapping capacity across quarters.
              </p>
            </div>
            <button
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white focus:ring-2 focus:ring-mileway-light-blue transition-colors"
              style={{ backgroundColor: Accent.teal }}
              onClick={() => setShowNewPlanModal(true)}
            >
              <Plus size={16} />
              New Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scenarios.map(sc => (
              <PlanCard
                key={sc.id}
                scenario={sc}
                onOpen={() => handleOpen(sc.id)}
                onRename={() => setRenameTarget(sc)}
                onDuplicate={() => handleDuplicate(sc)}
                onPromote={() => setPromoteTarget(sc)}
                onDelete={() => setDeleteTarget(sc)}
              />
            ))}
            <NewPlanCard onClick={() => setShowNewPlanModal(true)} />
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewPlanModal && (
        <NewPlanModal
          onClose={() => setShowNewPlanModal(false)}
          onCreated={(id) => handleOpen(id)}
          currentUserEmail={user?.email}
        />
      )}

      {renameTarget && (
        <RenameModal
          scenario={renameTarget}
          onClose={() => setRenameTarget(null)}
          currentUserEmail={user?.email}
        />
      )}

      {promoteTarget && (
        <ConfirmModal
          isOpen={!!promoteTarget}
          title="Promote to Baseline"
          message={`This will overwrite baseline staffing data with the contents of "${promoteTarget.name}". This cannot be undone.`}
          confirmLabel="Promote"
          variant="warning"
          onConfirm={handlePromote}
          onClose={() => setPromoteTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          title="Delete Plan"
          message={`Delete "${deleteTarget.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
