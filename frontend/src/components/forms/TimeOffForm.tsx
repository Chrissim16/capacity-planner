import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useCurrentState } from '../../stores/appStore';
import { setTimeOff } from '../../stores/actions';
import { getCurrentQuarter } from '../../utils/calendar';

interface TimeOffFormProps {
  isOpen: boolean;
  onClose: () => void;
  memberId?: string;
  quarter?: string;
  existingDays?: number;
  existingReason?: string;
}

export function TimeOffForm({ 
  isOpen, 
  onClose, 
  memberId: initialMemberId,
  quarter: initialQuarter,
  existingDays,
  existingReason 
}: TimeOffFormProps) {
  const state = useCurrentState();
  const teamMembers = state.teamMembers;
  const quarters = state.quarters;
  
  const [memberId, setMemberId] = useState('');
  const [quarter, setQuarter] = useState('');
  const [days, setDays] = useState(0);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentQuarter = getCurrentQuarter();

  // teamMembers excluded from deps intentionally — background syncs create new array
  // references which would reset the user's selection mid-edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setMemberId(initialMemberId || teamMembers[0]?.id || '');
    setQuarter(initialQuarter || currentQuarter);
    setDays(existingDays || 0);
    setReason(existingReason || '');
    setErrors({});
  }, [isOpen, initialMemberId, initialQuarter, existingDays, existingReason, currentQuarter]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!memberId) newErrors.memberId = 'This field is mandatory';
    if (!quarter) newErrors.quarter = 'This field is mandatory';
    if (days < 0) newErrors.days = 'Days cannot be negative';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setTimeOff(memberId, quarter, days, reason.trim() || undefined);
    onClose();
  };

  const memberOptions = teamMembers.map(m => ({ value: m.id, label: m.name }));
  const quarterOptions = quarters.map(q => ({ value: q, label: q }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Time Off"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          id="timeoff-member"
          label="Team Member"
          required
          value={memberId}
          onChange={(e) => {
            setMemberId(e.target.value);
            if (errors.memberId) setErrors(prev => ({ ...prev, memberId: '' }));
          }}
          options={memberOptions}
          error={errors.memberId}
        />

        <Select
          id="timeoff-quarter"
          label="Quarter"
          required
          value={quarter}
          onChange={(e) => {
            setQuarter(e.target.value);
            if (errors.quarter) setErrors(prev => ({ ...prev, quarter: '' }));
          }}
          options={quarterOptions}
          error={errors.quarter}
        />

        <Input
          id="timeoff-days"
          label="Days Off"
          type="number"
          min={0}
          max={100}
          value={days}
          onChange={(e) => {
            setDays(parseFloat(e.target.value) || 0);
            if (errors.days) setErrors(prev => ({ ...prev, days: '' }));
          }}
          error={errors.days}
        />

        <Input
          id="timeoff-reason"
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Vacation, sick leave, etc."
        />
      </div>
    </Modal>
  );
}
