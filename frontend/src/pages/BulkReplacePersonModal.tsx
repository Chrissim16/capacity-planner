/**
 * BulkReplacePersonModal — replace one person's assignments with another across
 * all (or a selected subset of) epic/phase assignments. Each row is independently
 * checkable and has an editable days override.
 */

import { useState, useEffect, useMemo } from 'react';
import type {
  EpicPhaseAssignment,
  JiraWorkItem,
  TeamMember,
  BusinessContact,
  BusinessTeam,
} from '../types';
import { PH_LBL } from '../utils/portfolioGeometry';
import { makeBusinessTeamPlaceholderId } from '../utils/businessTeamPlaceholders';

// ── Helpers (mirrored from PortfolioPlanning module scope) ────────────────────
const AV_PALETTE = [
  '#0089DD', '#7C3AED', '#D97706', '#16A34A', '#DB2777',
  '#1D6FE8', '#059669', '#D97706', '#7C3AED', '#DB2777', '#64748B',
];
function avColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF;
  return AV_PALETTE[Math.abs(h) % AV_PALETTE.length];
}
function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface PreviewRow {
  assignment: EpicPhaseAssignment;
  epicSummary: string;
  phaseLabel: string;
  conflict: boolean;
  checked: boolean;
  overrideDays: number;
}

interface PickerEntry {
  id: string;
  name: string;
  sub: string;
  track: 'IT' | 'BIZ';
  isTeam: boolean;
}

interface Props {
  fromMemberId: string;
  fromName: string;
  activePhaseAssignments: EpicPhaseAssignment[];
  boardEpics: JiraWorkItem[];
  memberMap: Map<string, TeamMember>;
  contactMap: Map<string, BusinessContact>;
  businessTeams: BusinessTeam[];
  onConfirm: (
    toMemberId: string,
    toTrack: 'IT' | 'BIZ',
    selectedRows: Array<{ assignment: EpicPhaseAssignment; overrideDays: number }>
  ) => void;
  onClose: () => void;
}

export function BulkReplacePersonModal({
  fromMemberId,
  fromName,
  activePhaseAssignments,
  boardEpics,
  memberMap,
  contactMap,
  businessTeams,
  onConfirm,
  onClose,
}: Props) {
  const [toMemberId, setToMemberId] = useState<string | null>(null);
  const [toTrack, setToTrack]       = useState<'IT' | 'BIZ'>('IT');
  const [query, setQuery]           = useState('');
  const [previewRows, setPreviewRows]         = useState<PreviewRow[]>([]);
  const [editingDaysKey, setEditingDaysKey]   = useState<string | null>(null);
  const [daysInputValue, setDaysInputValue]   = useState('');

  // ── Epic summary lookup ───────────────────────────────────────────────────
  const epicMap = useMemo(
    () => new Map(boardEpics.map(e => [e.jiraKey, e.summary])),
    [boardEpics],
  );

  // ── Picker entries, excluding fromMemberId ────────────────────────────────
  const pickerEntries = useMemo((): PickerEntry[] => {
    const it = [...memberMap.values()]
      .filter(m => !m.excludedFromCapacity && m.id !== fromMemberId)
      .map(m => ({ id: m.id, name: m.name, sub: m.role ?? '', track: 'IT' as const, isTeam: false }));
    const biz = [...contactMap.values()]
      .filter(c => !c.excludedFromCapacity && c.id !== fromMemberId)
      .map(c => ({ id: c.id, name: c.name, sub: c.title ?? '', track: 'BIZ' as const, isTeam: false }));
    const teams = businessTeams.map(bt => ({
      id: makeBusinessTeamPlaceholderId(bt.id),
      name: bt.name,
      sub: 'Business team',
      track: 'BIZ' as const,
      isTeam: true,
    }));
    return [...it, ...biz, ...teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [memberMap, contactMap, businessTeams, fromMemberId]);

  const filteredEntries = useMemo(() => {
    if (!query.trim()) return pickerEntries;
    const q = query.toLowerCase();
    return pickerEntries.filter(e =>
      e.name.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q),
    );
  }, [pickerEntries, query]);

  // ── Recompute preview rows whenever target person changes ─────────────────
  useEffect(() => {
    if (!toMemberId) {
      setPreviewRows([]);
      return;
    }
    const assignedToTarget = new Set(
      activePhaseAssignments
        .filter(a => a.memberId === toMemberId)
        .map(a => a.phaseInstanceId),
    );
    const rows = activePhaseAssignments
      .filter(a => a.memberId === fromMemberId)
      .map(a => ({
        assignment: a,
        epicSummary: epicMap.get(a.epicKey) ?? a.epicKey,
        phaseLabel: PH_LBL[a.phase] ?? a.phase,
        conflict: assignedToTarget.has(a.phaseInstanceId),
        checked: !assignedToTarget.has(a.phaseInstanceId),
        overrideDays: a.days,
      }));
    setPreviewRows(rows);
    setEditingDaysKey(null);
  }, [toMemberId, fromMemberId, activePhaseAssignments, epicMap]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const checkedCount   = previewRows.filter(r => r.checked && !r.conflict).length;
  const skippedCount   = previewRows.filter(r => r.conflict).length;
  const totalFromCount = activePhaseAssignments.filter(a => a.memberId === fromMemberId).length;

  // ── Target person display name ────────────────────────────────────────────
  const toName = useMemo(() => {
    if (!toMemberId) return '';
    return pickerEntries.find(e => e.id === toMemberId)?.name ?? '';
  }, [toMemberId, pickerEntries]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSelectPerson(entry: PickerEntry) {
    setToMemberId(entry.id);
    setToTrack(entry.track);
    setQuery('');
  }

  function handleToggleRow(idx: number) {
    setPreviewRows(rows =>
      rows.map((r, i) => (i === idx && !r.conflict ? { ...r, checked: !r.checked } : r)),
    );
  }

  function handleStartEditDays(row: PreviewRow) {
    if (row.conflict || !row.checked) return;
    setEditingDaysKey(row.assignment.id);
    setDaysInputValue(String(row.overrideDays));
  }

  function handleCommitDays(idx: number) {
    const parsed = parseInt(daysInputValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setPreviewRows(rows =>
        rows.map((r, i) => (i === idx ? { ...r, overrideDays: parsed } : r)),
      );
    }
    setEditingDaysKey(null);
  }

  function handleConfirm() {
    if (!toMemberId || checkedCount === 0) return;
    const selected = previewRows
      .filter(r => r.checked && !r.conflict)
      .map(r => ({ assignment: r.assignment, overrideDays: r.overrideDays }));
    onConfirm(toMemberId, toTrack, selected);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div
      className="pp-modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="pp-modal pp-replace-modal" onKeyDown={handleKeyDown}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="pp-modal-head">
          <span className="pp-modal-title">Replace Person in Assignments</span>
          <button className="pp-dr-close" onClick={onClose}>×</button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="pp-modal-body">

          {/* From */}
          <div className="pp-modal-field">
            <label className="pp-modal-label">Replace</label>
            <div className="pp-replace-chip">
              <div className="pp-picker-av" style={{ background: avColor(fromMemberId) }}>
                {initials(fromName)}
              </div>
              <span className="pp-replace-chip-name">{fromName}</span>
            </div>
          </div>

          {/* To — picker or selected chip */}
          <div className="pp-modal-field">
            <label className="pp-modal-label">With</label>
            {toMemberId ? (
              <div className="pp-replace-chip">
                <div className="pp-picker-av" style={{ background: avColor(toMemberId) }}>
                  {initials(toName)}
                </div>
                <span className="pp-replace-chip-name">{toName}</span>
                <button
                  className="pp-replace-change-btn"
                  onClick={() => { setToMemberId(null); setQuery(''); }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="pp-replace-picker-wrap">
                <input
                  className="pp-replace-to-input"
                  placeholder="Search people or teams…"
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <div className="pp-replace-to-list">
                  {filteredEntries.length === 0
                    ? <div className="pp-picker-empty">No results</div>
                    : filteredEntries.map(e => (
                        <div
                          key={e.id}
                          className="pp-picker-item"
                          onMouseDown={ev => { ev.preventDefault(); handleSelectPerson(e); }}
                        >
                          {e.isTeam
                            ? <div className="pp-picker-av team">
                                {e.name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()}
                              </div>
                            : <div className="pp-picker-av" style={{ background: avColor(e.id) }}>
                                {initials(e.name)}
                              </div>
                          }
                          <div className="pp-picker-info">
                            <div className="pp-picker-name">{e.name}{e.isTeam ? ' Team' : ''}</div>
                            <div className="pp-picker-sub">{e.sub}</div>
                          </div>
                          <span className={`pp-picker-badge ${e.isTeam ? 'team' : e.track.toLowerCase()}`}>
                            {e.isTeam ? 'Team' : e.track}
                          </span>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* Preview list */}
          {toMemberId && (
            <div className="pp-modal-field">
              <label className="pp-modal-label">
                Assignments ({totalFromCount} found
                {skippedCount > 0 ? ` · ${skippedCount} conflict${skippedCount > 1 ? 's' : ''} will be skipped` : ''})
              </label>
              {previewRows.length === 0 ? (
                <div className="pp-replace-empty">No assignments found for this person.</div>
              ) : (
                <div className="pp-replace-preview-list">
                  {previewRows.map((row, idx) => (
                    <div
                      key={row.assignment.id}
                      className={`pp-replace-preview-row${row.conflict ? ' conflict' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="pp-replace-checkbox"
                        checked={row.checked}
                        disabled={row.conflict}
                        onChange={() => handleToggleRow(idx)}
                      />
                      <span className="pp-replace-preview-epic" title={row.epicSummary}>
                        {row.epicSummary}
                      </span>
                      <span className="pp-replace-preview-phase">{row.phaseLabel}</span>
                      {/* Editable days */}
                      {!row.conflict && editingDaysKey === row.assignment.id ? (
                        <input
                          type="number"
                          className="pp-replace-days-input"
                          value={daysInputValue}
                          min={0}
                          autoFocus
                          onChange={e => setDaysInputValue(e.target.value)}
                          onBlur={() => handleCommitDays(idx)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleCommitDays(idx); }
                            if (e.key === 'Escape') setEditingDaysKey(null);
                          }}
                        />
                      ) : (
                        <span
                          className={`pp-replace-preview-days${!row.conflict && row.checked ? ' editable' : ''}`}
                          onClick={() => handleStartEditDays(row)}
                          title={!row.conflict && row.checked ? 'Click to edit days' : undefined}
                        >
                          {row.overrideDays}d
                        </span>
                      )}
                      {row.conflict
                        ? <span className="pp-replace-skip-badge">Skip</span>
                        : <span className={`pp-replace-status-badge${row.checked ? ' ok' : ' off'}`}>
                            {row.checked ? 'Replace' : '–'}
                          </span>
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="pp-modal-footer">
          <button className="pp-btn secondary" onClick={onClose}>Cancel</button>
          <button
            className="pp-btn primary"
            disabled={!toMemberId || checkedCount === 0}
            onClick={handleConfirm}
          >
            Replace {checkedCount > 0 ? checkedCount : ''} assignment{checkedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
