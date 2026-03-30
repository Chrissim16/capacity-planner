/**
 * AddManualEpicModal — form for creating a manually-managed Portfolio epic.
 *
 * The code (MAN-XXXX) is auto-generated and shown as read-only.
 * Summary is required; description, start date, and end date are optional.
 */

import { useState } from 'react';

interface Props {
  nextCode: string;
  onSave: (input: { summary: string; description?: string; startDate?: string; endDate?: string }) => void;
  onClose: () => void;
}

export function AddManualEpicModal({ nextCode, onSave, onClose }: Props) {
  const [summary, setSummary]         = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
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
    onSave({
      summary:     trimmedSummary,
      description: description.trim() || undefined,
      startDate:   startDate || undefined,
      endDate:     endDate || undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="pp-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pp-modal" onKeyDown={handleKeyDown}>
        <div className="pp-modal-head">
          <span className="pp-modal-title">Create Manual Epic</span>
          <button className="pp-dr-close" onClick={onClose}>×</button>
        </div>

        <div className="pp-modal-body">
          {/* Auto-generated code */}
          <div className="pp-modal-field">
            <label className="pp-modal-label">Code</label>
            <span className="pp-jkey pp-modal-code">{nextCode}</span>
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
          <button className="pp-btn secondary" onClick={onClose}>Cancel</button>
          <button className="pp-btn primary" onClick={handleSave}>Create Epic</button>
        </div>
      </div>
    </div>
  );
}
