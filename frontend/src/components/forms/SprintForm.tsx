/**
 * Form for creating/editing a sprint
 */

import { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Sprint } from '../../types';

interface SprintFormProps {
  sprint?: Sprint;
  onSave: (data: Omit<Sprint, 'id'>) => void;
  onCancel: () => void;
}

export function SprintForm({ sprint, onSave, onCancel }: SprintFormProps) {
  const [name, setName] = useState(sprint?.name || '');
  const [number, setNumber] = useState(sprint?.number || 1);
  const [year, setYear] = useState(sprint?.year || new Date().getFullYear());
  const [startDate, setStartDate] = useState(sprint?.startDate || '');
  const [endDate, setEndDate] = useState(sprint?.endDate || '');
  const [isByeWeek, setIsByeWeek] = useState(sprint?.isByeWeek || false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculate quarter from start date
  const calculateQuarter = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.getMonth();
    const yr = date.getFullYear();
    let q: number;
    if (month <= 2) q = 1;
    else if (month <= 5) q = 2;
    else if (month <= 8) q = 3;
    else q = 4;
    return `Q${q} ${yr}`;
  };

  // Auto-calculate end date when start date changes (3 weeks by default)
  useEffect(() => {
    if (startDate && !sprint?.endDate) {
      const start = new Date(startDate);
      start.setDate(start.getDate() + 20); // 3 weeks - 1 day
      setEndDate(start.toISOString().split('T')[0]);
    }
    // Update year from startDate
    if (startDate) {
      setYear(new Date(startDate).getFullYear());
    }
  }, [startDate, sprint?.endDate]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Sprint name is required';
    if (!startDate) newErrors.startDate = 'Start date is required';
    if (!endDate) newErrors.endDate = 'End date is required';
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (number < 1) newErrors.number = 'Sprint number must be positive';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      name: name.trim(),
      number,
      year,
      startDate,
      endDate,
      quarter: calculateQuarter(startDate),
      isByeWeek,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="sprint-name"
          label="Sprint Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Sprint 1"
          error={errors.name}
        />
        <Input
          id="sprint-number"
          label="Sprint Number *"
          type="number"
          min={1}
          value={number}
          onChange={(e) => setNumber(parseInt(e.target.value) || 1)}
          error={errors.number}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="sprint-start"
          label="Start Date *"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          error={errors.startDate}
        />
        <Input
          id="sprint-end"
          label="End Date *"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          error={errors.endDate}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Quarter (auto-calculated)
          </label>
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
            {calculateQuarter(startDate) || '—'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Year
          </label>
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
            {year}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is-bye-week"
          checked={isByeWeek}
          onChange={(e) => setIsByeWeek(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="is-bye-week" className="text-sm text-slate-700 dark:text-slate-300">
          Mark as Bye Week (no work scheduled)
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {sprint ? 'Update Sprint' : 'Add Sprint'}
        </Button>
      </div>
    </form>
  );
}
