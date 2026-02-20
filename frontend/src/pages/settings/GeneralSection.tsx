import { useState } from 'react';
import { Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useCurrentState } from '../../stores/appStore';
import { updateSettings } from '../../stores/actions';
import { useToast } from '../../components/ui/Toast';

export function GeneralSection() {
  const { settings, countries } = useCurrentState();
  const { showToast } = useToast();

  const [bauDays, setBauDays] = useState(settings.bauReserveDays || 5);
  const [hoursPerDay, setHoursPerDay] = useState(settings.hoursPerDay || 8);
  const [quartersToShow, setQuartersToShow] = useState(settings.quartersToShow || 4);
  const [defaultCountryId, setDefaultCountryId] = useState(settings.defaultCountryId || '');

  const countryOptions = [
    { value: '', label: 'Select default country' },
    ...countries.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleSave = () => {
    updateSettings({ bauReserveDays: bauDays, hoursPerDay, quartersToShow, defaultCountryId });
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
        <Button onClick={handleSave}>
          <Save size={16} />
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
