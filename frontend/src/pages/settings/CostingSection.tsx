import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useCurrentState } from '../../stores/appStore';
import { removeExternalVendor, updateSettings, upsertExternalVendor } from '../../stores/actions';
import { useToast } from '../../components/ui/Toast';
import { CURRENCY_OPTIONS, formatCurrency } from '../../utils/currency';
import type { CurrencyCode, ExternalVendor } from '../../types';

const blankVendor = (): Omit<ExternalVendor, 'id'> => ({
  name: '',
  dailyRate: 0,
  currency: 'EUR',
  notes: '',
  archived: false,
  countsTowardCapacity: false,
  workingDaysPerWeek: 5,
});

export function CostingSection() {
  const { settings, externalVendors } = useCurrentState();
  const { showToast } = useToast();
  const [reportingCurrency, setReportingCurrency] = useState<CurrencyCode>(settings.costing.reportingCurrency);
  const [internalRate, setInternalRate] = useState(String(settings.costing.internalItDailyRate.amount));
  const [internalCurrency, setInternalCurrency] = useState<CurrencyCode>(settings.costing.internalItDailyRate.currency);
  const [businessRate, setBusinessRate] = useState(String(settings.costing.businessDailyRate.amount));
  const [businessCurrency, setBusinessCurrency] = useState<CurrencyCode>(settings.costing.businessDailyRate.currency);
  const [eurRate, setEurRate] = useState(String(settings.costing.fxToEur.EUR));
  const [gbpRate, setGbpRate] = useState(String(settings.costing.fxToEur.GBP));
  const [usdRate, setUsdRate] = useState(String(settings.costing.fxToEur.USD));
  const [vendorDraft, setVendorDraft] = useState(blankVendor());
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);

  const handleSaveSettings = () => {
    updateSettings({
      costing: {
        ...settings.costing,
        reportingCurrency,
        supportedCurrencies: ['EUR', 'GBP', 'USD'],
        fxToEur: {
          EUR: Math.max(0.0001, parseFloat(eurRate) || 1),
          GBP: Math.max(0.0001, parseFloat(gbpRate) || 1),
          USD: Math.max(0.0001, parseFloat(usdRate) || 1),
        },
        internalItDailyRate: {
          amount: Math.max(0, parseFloat(internalRate) || 0),
          currency: internalCurrency,
        },
        businessDailyRate: {
          amount: Math.max(0, parseFloat(businessRate) || 0),
          currency: businessCurrency,
        },
      },
    });
    showToast('Costing settings saved', 'success');
  };

  const handleSaveVendor = () => {
    if (!vendorDraft.name.trim()) {
      showToast('Vendor name is required.', 'warning');
      return;
    }

    upsertExternalVendor({
      ...vendorDraft,
      id: editingVendorId ?? undefined,
      name: vendorDraft.name.trim(),
      dailyRate: Math.max(0, vendorDraft.dailyRate || 0),
    });
    setVendorDraft(blankVendor());
    setEditingVendorId(null);
    showToast(editingVendorId ? 'Vendor updated' : 'Vendor added', 'success');
  };

  const startEditingVendor = (vendor: ExternalVendor) => {
    setEditingVendorId(vendor.id);
    setVendorDraft({
      name: vendor.name,
      dailyRate: vendor.dailyRate,
      currency: vendor.currency,
      notes: vendor.notes ?? '',
      archived: vendor.archived ?? false,
      countsTowardCapacity: vendor.countsTowardCapacity ?? false,
      workingDaysPerWeek: vendor.workingDaysPerWeek ?? 5,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Costing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-[#94A3B8]">
          Configure reporting currency, FX inputs, default rates, and external vendor pricing for portfolio costing.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Reporting Currency"
            value={reportingCurrency}
            onChange={(event) => setReportingCurrency(event.target.value as CurrencyCode)}
            options={CURRENCY_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Global Internal IT Daily Rate"
            type="number"
            min={0}
            step={10}
            value={internalRate}
            onChange={(event) => setInternalRate(event.target.value)}
          />
          <Select
            label="Internal IT Currency"
            value={internalCurrency}
            onChange={(event) => setInternalCurrency(event.target.value as CurrencyCode)}
            options={CURRENCY_OPTIONS}
          />
          <Input
            label="Global Business Daily Rate"
            type="number"
            min={0}
            step={10}
            value={businessRate}
            onChange={(event) => setBusinessRate(event.target.value)}
          />
          <Select
            label="Business Currency"
            value={businessCurrency}
            onChange={(event) => setBusinessCurrency(event.target.value as CurrencyCode)}
            options={CURRENCY_OPTIONS}
          />
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-[#1E293B]">FX to EUR</h4>
            <p className="text-xs text-[#94A3B8]">Enter the value of one unit of currency in EUR.</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="EUR → EUR" type="number" min={0} step={0.0001} value={eurRate} onChange={(event) => setEurRate(event.target.value)} />
            <Input label="GBP → EUR" type="number" min={0} step={0.0001} value={gbpRate} onChange={(event) => setGbpRate(event.target.value)} />
            <Input label="USD → EUR" type="number" min={0} step={0.0001} value={usdRate} onChange={(event) => setUsdRate(event.target.value)} />
          </div>
        </div>

        <Button onClick={handleSaveSettings}>
          <Save size={16} />
          Save Costing Settings
        </Button>

        <div className="border-t border-[#DEDFE3] pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[#1E293B]">External Vendors</h4>
              <p className="text-xs text-[#94A3B8]">Catalog teams and partners that can be costed with or without capacity impact.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-[#DEDFE3] bg-[#F8FAFC] p-4">
            <Input
              label="Vendor Name"
              value={vendorDraft.name}
              onChange={(event) => setVendorDraft((draft) => ({ ...draft, name: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Daily Rate"
                type="number"
                min={0}
                step={10}
                value={String(vendorDraft.dailyRate)}
                onChange={(event) => setVendorDraft((draft) => ({ ...draft, dailyRate: parseFloat(event.target.value) || 0 }))}
              />
              <Select
                label="Currency"
                value={vendorDraft.currency}
                onChange={(event) => setVendorDraft((draft) => ({ ...draft, currency: event.target.value as CurrencyCode }))}
                options={CURRENCY_OPTIONS}
              />
            </div>
            <Input
              label="Working Days / Week"
              type="number"
              min={0.5}
              max={7}
              step={0.5}
              value={String(vendorDraft.workingDaysPerWeek ?? 5)}
              onChange={(event) => setVendorDraft((draft) => ({ ...draft, workingDaysPerWeek: parseFloat(event.target.value) || 5 }))}
            />
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#94A3B8]">Capacity Participation</label>
              <label className="flex items-center gap-2 rounded-lg border border-[#DEDFE3] bg-white px-3 py-2.5 text-sm text-[#1E293B]">
                <input
                  type="checkbox"
                  checked={vendorDraft.countsTowardCapacity ?? false}
                  onChange={(event) => setVendorDraft((draft) => ({ ...draft, countsTowardCapacity: event.target.checked }))}
                />
                Count toward capacity planning
              </label>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-[#94A3B8]">Notes</label>
              <textarea
                value={vendorDraft.notes ?? ''}
                onChange={(event) => setVendorDraft((draft) => ({ ...draft, notes: event.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-[#DEDFE3] bg-white px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0089DD]"
              />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              {editingVendorId ? (
                <Button variant="secondary" onClick={() => { setVendorDraft(blankVendor()); setEditingVendorId(null); }}>
                  Cancel Edit
                </Button>
              ) : null}
              <Button onClick={handleSaveVendor}>
                <Plus size={16} />
                {editingVendorId ? 'Save Vendor' : 'Add Vendor'}
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {externalVendors.map((vendor) => (
              <div key={vendor.id} className="flex items-center justify-between rounded-lg border border-[#DEDFE3] bg-white px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1E293B]">{vendor.name}</span>
                    <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] text-[#475569]">
                      {formatCurrency(vendor.dailyRate, vendor.currency)}
                    </span>
                    {vendor.countsTowardCapacity ? (
                      <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] text-[#047857]">Counts toward capacity</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-[#94A3B8]">{vendor.notes || 'No notes'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEditingVendor(vendor)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeExternalVendor(vendor.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
            {externalVendors.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#DEDFE3] px-4 py-6 text-center text-sm text-[#94A3B8]">
                No external vendors defined yet.
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
