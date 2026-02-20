import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useCurrentState } from '../../stores/appStore';
import { addHoliday, deleteHoliday } from '../../stores/actions';

export function HolidaysSection() {
  const { countries, publicHolidays } = useCurrentState();
  const [countryId, setCountryId] = useState('');
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const countryOptions = [
    { value: '', label: 'Select country' },
    ...countries.map((c) => ({ value: c.id, label: `${c.flag || '🏳️'} ${c.name}` })),
  ];

  const sortedHolidays = [...publicHolidays].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const handleAdd = () => {
    if (countryId && date && name.trim()) {
      addHoliday(countryId, date, name.trim());
      setDate('');
      setName('');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Public Holidays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="w-48">
              <Select label="Country" value={countryId} onChange={(e) => setCountryId(e.target.value)} options={countryOptions} />
            </div>
            <div className="w-40">
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <Input
                label="Holiday Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Christmas Day"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd}><Plus size={16} />Add</Button>
          </div>

          {countries.length === 0 ? (
            <p className="text-center py-8 text-slate-400">
              Add countries first in the Countries section to manage holidays.
            </p>
          ) : (
            countries.map((country) => {
              const countryHolidays = sortedHolidays.filter((h) => h.countryId === country.id);
              return (
                <div key={country.id} className="border-t border-slate-200 dark:border-slate-700 pt-4 first:border-t-0 first:pt-0">
                  <h3 className="flex items-center gap-2 text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">
                    <span>{country.flag || '🏳️'}</span>
                    {country.name}
                    <Badge variant="default">{countryHolidays.length}</Badge>
                  </h3>
                  {countryHolidays.length === 0 ? (
                    <p className="text-sm text-slate-400 ml-8">No holidays defined for this country</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {countryHolidays.map((holiday) => (
                        <div key={holiday.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 w-20">
                              {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">{holiday.name}</span>
                          </div>
                          <button
                            onClick={() => setDeleteConfirm({ id: holiday.id, name: holiday.name })}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Holiday"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteHoliday(deleteConfirm!.id); setDeleteConfirm(null); }}>Delete</Button>
          </>
        }
      >
        <p>Delete holiday <strong>{deleteConfirm?.name}</strong>?</p>
      </Modal>
    </>
  );
}
