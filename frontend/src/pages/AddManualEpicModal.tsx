/**
 * AddManualEpicModal — create or edit a manually-managed Portfolio epic.
 *
 * In CREATE mode: auto-generated code (read-only), blank form, "Create Epic" CTA.
 * In EDIT mode:   existing code shown (read-only), pre-filled form, "Save Changes" CTA.
 */

import { useState } from 'react';
import type { ManualEpic } from '../types';

interface CreateProps {
  mode: 'create';
  nextCode: string;
  onSave: (input: { summary: string; description?: string; startDate?: string; endDate?: string }) => void;
  onClose: () => void;
}

interface EditProps {
  mode: 'edit';
  epic: ManualEpic;
  onSave: (changes: { summary: string; description?: string; startDate?: string; endDate?: string }) => void;
  onClose: () => void;
}

type Props = CreateProps | EditProps;

export function AddManualEpicModal(props: Props) {
  const isEdit     = props.mode === 'edit';
  const initial    = isEdit ? props.epic : null;
  const displayCode = isEdit ? props.epic.epicKey : (props as CreateProps).nextCode;

  const [summary, setSummary]         = useState(initial?.summary ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [startDate, setStartDate]     = useState(initial?.startDate ?? '');
  const [endDate, setEndDate]         = useState(initial?.endDate ?? '');
  const [error, setError]             = useState<string | null>(null);

  function handleSave() {
    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      setError('Summary is required.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End date must be on or after the start date.');
      return;
    }
    props.onSave({
      summary:     trimmedSummary,
      description: description.trim() || undefined,
      startDate:   startDate || undefined,
      endDate:     endDate || undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') props.onClose();
  }

  return (
    <div className="pp-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="pp-modal" onKeyDown={handleKeyDown}>
        <div className="pp-modal-head">
          <span className="pp-modal-title">{isEdit ? 'Edit Epic' : 'Create Manual Epic'}</span>
          <button className="pp-dr-close" onClick={props.onClose}>×</button>
        </div>

        <div className="pp-modal-body">
          {/* Code (always read-only) */}
          <div className="pp-modal-field">
            <label className="pp-modal-label">Code</label>
            <span className="pp-jkey pp-modal-code">{displayCode}</span>
          </div>

          {/* Summary */}
          <div className="pp-modal-field">
            <label className="pp-modal-label" htmlFor="man-summary">
              Summary <span className="pp-modal-required">*</span>
            </label>
            <input
              id="man-summary"
              className="pp-modal-input"
              placeholder="Short name for this epic…"
              value={summary}
              onChange={e => { setSummary(e.target.value); setError(null); }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="pp-modal-field">
            <label className="pp-modal-label" htmlFor="man-description">Description</label>
            <textarea
              id="man-description"
              className="pp-modal-textarea"
              placeholder="Optional longer description…"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Dates */}
          <div className="pp-modal-date-row">
            <div className="pp-modal-field">
              <label className="pp-modal-label" htmlFor="man-start">Start Date</label>
              <input
                id="man-start"
                type="date"
                className="pp-modal-input"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setError(null); }}
              />
            </div>
            <div className="pp-modal-field">
              <label className="pp-modal-label" htmlFor="man-end">End Date</label>
              <input
                id="man-end"
                type="date"
                className="pp-modal-input"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setError(null); }}
              />
            </div>
          </div>

          {error && <div className="pp-modal-error">{error}</div>}
        </div>

        <div className="pp-modal-footer">
          <button className="pp-btn secondary" onClick={props.onClose}>Cancel</button>
          <button className="pp-btn primary" onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Create Epic'}
          </button>
        </div>
      </div>
    </div>
  );
}
