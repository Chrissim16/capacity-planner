import { useState } from 'react';
import { Plus, Trash2, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useCurrentState } from '../../stores/appStore';
import { addHoliday, addHolidaysBatch, deleteHoliday } from '../../stores/actions';
import { fetchNagerHolidays } from '../../services/nagerHolidays';
import type { NagerHoliday } from '../../services/nagerHolidays';

export function HolidaysSection() {
  const { countries, publicHolidays } = useCurrentState();
  const [countryId, setCountryId] = useState('');
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // US-054 / US-055: API import state
  const currentYear = new Date().getFullYear();
  const [importCountryId, setImportCountryId] = useState('');
  const [importYear, setImportYear] = useState(String(currentYear));
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<NagerHoliday[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<number | null>(null);

  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear + i - 1).map(y => ({
    value: String(y), label: String(y),
  }));

  const handleFetchPreview = async () => {
    const country = countries.find(c => c.id === importCountryId);
    if (!country || !importYear) return;
    setImportLoading(true);
    setImportError(null);
    setImportPreview(null);
    setImportSuccess(null);
    try {
      const holidays = await fetchNagerHolidays(country.code, Number(importYear));
      setImportPreview(holidays);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to fetch holidays');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportAll = () => {
    if (!importPreview || !importCountryId) return;
    const existingDates = new Set(
      publicHolidays
        .filter(h => h.countryId === importCountryId)
        .map(h => h.date)
    );
    const newEntries = importPreview
      .filter(h => !existingDates.has(h.date))
      .map(h => ({ countryId: importCountryId, date: h.date, name: h.name }));

    // Single batch update — avoids multiple updateData calls in a loop
    addHolidaysBatch(newEntries);

    setImportSuccess(newEntries.length);
    setImportPreview(null);
  };

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
      {/* US-054/055: Import from Nager.Date API */}
      <Card>
        <CardHeader>
          <CardTitle>Import from Nager.Date API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automatically import official public holidays for any country and year using the free{' '}
            <a href="https://date.nager.at" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Nager.Date</a> API.
            Duplicates are skipped automatically.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-52">
              <Select
                label="Country"
                value={importCountryId}
                onChange={e => { setImportCountryId(e.target.value); setImportPreview(null); setImportError(null); setImportSuccess(null); }}
                options={[{ value: '', label: 'Select country' }, ...countries.map(c => ({ value: c.id, label: `${c.flag || '🏳️'} ${c.name}` }))]}
              />
            </div>
            <div className="w-28">
              <Select
                label="Year"
                value={importYear}
                onChange={e => { setImportYear(e.target.value); setImportPreview(null); setImportError(null); setImportSuccess(null); }}
                options={yearOptions}
              />
            </div>
            <Button
              onClick={handleFetchPreview}
              disabled={!importCountryId || importLoading}
              variant="secondary"
            >
              {importLoading ? 'Fetching…' : <><Download size={14} /> Preview</>}
            </Button>
          </div>

          {importError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={16} /> {importError}
            </div>
          )}

          {importSuccess !== null && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle size={16} /> {importSuccess} holiday{importSuccess !== 1 ? 's' : ''} imported successfully.
            </div>
          )}

          {importPreview && importPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {importPreview.length} holidays found — {
                    (() => {
                      const existing = new Set(publicHolidays.filter(h => h.countryId === importCountryId).map(h => h.date));
                      const newCount = importPreview.filter(h => !existing.has(h.date)).length;
                      return newCount > 0 ? `${newCount} new` : 'all already imported';
                    })()
                  }
                </p>
                <Button size="sm" onClick={handleImportAll}>
                  <Download size={14} /> Import all
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {importPreview.map(h => {
                  const alreadyExists = publicHolidays.some(
                    ph => ph.countryId === importCountryId && ph.date === h.date
                  );
                  return (
                    <div
                      key={h.date}
                      className={`flex items-center justify-between px-3 py-2 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 ${alreadyExists ? 'opacity-40' : ''}`}
                    >
                      <span className="text-slate-600 dark:text-slate-300">{h.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs">{h.date}</span>
                        {alreadyExists && <span className="text-xs text-slate-400 italic">already added</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {importPreview && importPreview.length === 0 && (
            <p className="text-sm text-slate-400 italic">No public holidays found for this selection.</p>
          )}
        </CardContent>
      </Card>

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
