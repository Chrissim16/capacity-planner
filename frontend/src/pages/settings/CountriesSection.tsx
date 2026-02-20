import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../stores/appStore';
import { addCountry, deleteCountry } from '../../stores/actions';

const countryFlags: Record<string, string> = {
  NL: '🇳🇱', DE: '🇩🇪', BE: '🇧🇪', FR: '🇫🇷', GB: '🇬🇧', UK: '🇬🇧',
  US: '🇺🇸', ES: '🇪🇸', IT: '🇮🇹', PL: '🇵🇱', PT: '🇵🇹', AT: '🇦🇹',
  CH: '🇨🇭', DK: '🇩🇰', SE: '🇸🇪', NO: '🇳🇴', FI: '🇫🇮', IE: '🇮🇪',
  CZ: '🇨🇿', HU: '🇭🇺', RO: '🇷🇴', BG: '🇧🇬', GR: '🇬🇷', SK: '🇸🇰',
  LU: '🇱🇺',
};

export function CountriesSection() {
  const { countries, publicHolidays } = useAppStore((s) => s.getCurrentState());
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = () => {
    if (code.trim() && name.trim()) {
      const upper = code.trim().toUpperCase();
      addCountry(upper, name.trim(), countryFlags[upper] || '🏳️');
      setCode('');
      setName('');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Countries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Code (e.g. NL)"
              className="w-24"
              maxLength={2}
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Country name"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd}><Plus size={16} />Add</Button>
          </div>
          {code && (
            <p className="text-sm text-slate-500">
              Flag preview: {countryFlags[code.toUpperCase()] || '🏳️'}
              {!countryFlags[code.toUpperCase()] && ' (generic flag — code not recognized)'}
            </p>
          )}
          <div className="space-y-2">
            {countries.map((country) => (
              <div key={country.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{country.flag || '🏳️'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{country.name}</span>
                  <Badge variant="default">{country.code}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">
                    {publicHolidays.filter((h) => h.countryId === country.id).length} holidays
                  </span>
                  <button
                    onClick={() => setDeleteConfirm({ id: country.id, name: country.name })}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete (will also remove all holidays)"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {countries.length === 0 && (
              <p className="text-center py-8 text-slate-400">
                No countries defined. Add a country to manage holidays.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Country"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteCountry(deleteConfirm!.id); setDeleteConfirm(null); }}>Delete</Button>
          </>
        }
      >
        <p>
          Delete <strong>{deleteConfirm?.name}</strong>? This will also remove all public holidays for this country.
        </p>
      </Modal>
    </>
  );
}
