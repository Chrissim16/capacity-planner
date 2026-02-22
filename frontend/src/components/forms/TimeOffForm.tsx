import { useState, useEffect } from 'react';
import { Trash2, Plus, CalendarOff } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCurrentState } from '../../stores/appStore';
import { addTimeOff, removeTimeOff } from '../../stores/actions';
import { formatDisplayDate } from '../../utils/calendar';

interface TimeOffFormProps {
  isOpen: boolean;
  onClose: () => void;
  memberId?: string;
}

export function TimeOffForm({ isOpen, onClose, memberId }: TimeOffFormProps) {
  const state = useCurrentState();

  const today = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate]     = useState(today);
  const [note, setNote]           = useState('');
  const [errors, setErrors]       = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setStartDate(today);
      setEndDate(today);
      setNote('');
      setErrors({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const existingEntries = memberId
    ? state.timeOff
        .filter(t => t.memberId === memberId)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];

  const member = state.teamMembers.find(m => m.id === memberId);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!startDate) errs.startDate = 'Required';
    if (!endDate)   errs.endDate   = 'Required';
    if (startDate && endDate && endDate < startDate) {
      errs.endDate = 'End date must be on or after start date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAdd = () => {
    if (!memberId || !validate()) return;
    addTimeOff(memberId, startDate, endDate, note.trim() || undefined);
    setStartDate(today);
    setEndDate(today);
    setNote('');
    setErrors({});
  };

  const formatDateRange = (start: string, end: string) => {
    const fmt = formatDisplayDate;
    return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Time Off — ${member?.name ?? 'Team Member'}`}
      size="sm"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Add new entry */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Add absence
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="timeoff-start"
              label="Start date"
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                if (errors.startDate) setErrors(p => ({ ...p, startDate: '' }));
              }}
              error={errors.startDate}
            />
            <Input
              id="timeoff-end"
              label="End date"
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => {
                setEndDate(e.target.value);
                if (errors.endDate) setErrors(p => ({ ...p, endDate: '' }));
              }}
              error={errors.endDate}
            />
          </div>

          <Input
            id="timeoff-note"
            label="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Vacation, personal, etc."
          />

          <Button onClick={handleAdd} className="w-full">
            <Plus size={14} className="inline-block mr-1.5 -mt-0.5" />
            Add
          </Button>
        </div>

        {/* Existing entries */}
        {existingEntries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Recorded absences
            </p>
            <div className="space-y-1.5">
              {existingEntries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarOff size={13} className="shrink-0 text-orange-500" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                        {formatDateRange(entry.startDate, entry.endDate)}
                      </p>
                      {entry.note && (
                        <p className="text-xs text-slate-400 truncate">{entry.note}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeTimeOff(entry.id)}
                    className="ml-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {existingEntries.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
            No absences recorded yet.
          </p>
        )}
      </div>
    </Modal>
  );
}
