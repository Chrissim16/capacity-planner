import { useState } from 'react';
import { Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useCurrentState } from '../../stores/appStore';
import { updateSettings } from '../../stores/actions';
import { useToast } from '../../components/ui/Toast';
import type { ConfidenceLevel } from '../../types';

export function GeneralSection() {
  const { settings, countries } = useCurrentState();
  const { showToast } = useToast();

  const [bauDays, setBauDays] = useState(settings.bauReserveDays || 5);
  const [hoursPerDay, setHoursPerDay] = useState(settings.hoursPerDay || 8);
  const [quartersToShow, setQuartersToShow] = useState(settings.quartersToShow || 4);
  const [defaultCountryId, setDefaultCountryId] = useState(settings.defaultCountryId || '');
  const [highBuffer, setHighBuffer] = useState(settings.confidenceLevels?.high ?? 5);
  const [mediumBuffer, setMediumBuffer] = useState(settings.confidenceLevels?.medium ?? 15);
  const [lowBuffer, setLowBuffer] = useState(settings.confidenceLevels?.low ?? 25);
  const [defaultConfidenceLevel, setDefaultConfidenceLevel] = useState<ConfidenceLevel>(
    settings.confidenceLevels?.defaultLevel ?? 'medium'
  );

  const countryOptions = [
    { value: '', label: 'Select default country' },
    ...countries.map((c) => ({ value: c.id, label: c.name })),
  ];

  const confidenceOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const isConfidenceValuesValid = () => {
    const inRange = [highBuffer, mediumBuffer, lowBuffer].every(v => Number.isFinite(v) && v >= 0 && v <= 100);
    if (!inRange) return false;
    return highBuffer <= mediumBuffer && mediumBuffer <= lowBuffer;
  };

  const handleSave = () => {
    if (!isConfidenceValuesValid()) {
      showToast('Confidence buffers must be 0-100 and ordered High <= Medium <= Low', 'error');
      return;
    }

    updateSettings({
      bauReserveDays: bauDays,
      hoursPerDay,
      quartersToShow,
      defaultCountryId,
      confidenceLevels: {
        high: highBuffer,
        medium: mediumBuffer,
        low: lowBuffer,
        defaultLevel: defaultConfidenceLevel,
      },
    });
    showToast('Settings saved', 'success');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="bau-days"
            label="BAU Reserve (days per quarter)"
            type="number"
            min={0}
            max={30}
            value={bauDays}
            onChange={(e) => setBauDays(parseInt(e.target.value) || 0)}
          />
          <Input
            id="hours-per-day"
            label="Hours per Day"
            type="number"
            min={1}
            max={12}
            value={hoursPerDay}
            onChange={(e) => setHoursPerDay(parseInt(e.target.value) || 8)}
          />
          <Input
            id="quarters-to-show"
            label="Quarters to Show"
            type="number"
            min={1}
            max={12}
            value={quartersToShow}
            onChange={(e) => setQuartersToShow(parseInt(e.target.value) || 4)}
          />
          <Select
            id="default-country"
            label="Default Country"
            value={defaultCountryId}
            onChange={(e) => setDefaultCountryId(e.target.value)}
            options={countryOptions}
          />
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Confidence Buffers</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="confidence-high"
              label="High buffer (%)"
              type="number"
              min={0}
              max={100}
              value={highBuffer}
              onChange={(e) => setHighBuffer(parseInt(e.target.value) || 0)}
            />
            <Input
              id="confidence-medium"
              label="Medium buffer (%)"
              type="number"
              min={0}
              max={100}
              value={mediumBuffer}
              onChange={(e) => setMediumBuffer(parseInt(e.target.value) || 0)}
            />
            <Input
              id="confidence-low"
              label="Low buffer (%)"
              type="number"
              min={0}
              max={100}
              value={lowBuffer}
              onChange={(e) => setLowBuffer(parseInt(e.target.value) || 0)}
            />
            <Select
              id="confidence-default"
              label="Default confidence level"
              value={defaultConfidenceLevel}
              onChange={(e) => setDefaultConfidenceLevel(e.target.value as ConfidenceLevel)}
              options={confidenceOptions}
            />
          </div>
          {!isConfidenceValuesValid() && (
            <p className="mt-2 text-xs text-red-500">High must be less than or equal to Medium, and Medium less than or equal to Low.</p>
          )}
        </div>
        <Button onClick={handleSave}>
          <Save size={16} />
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
