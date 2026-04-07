import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CURRENCY_OPTIONS, formatCurrency } from '../../utils/currency';
import type { CostLineItem, CurrencyCode, InitiativeCostRecord, JiraWorkItem } from '../../types';
import type { InitiativeCostSummary } from '../../utils/costing';

interface CostDrawerProps {
  isOpen: boolean;
  epic: JiraWorkItem | null;
  summary: InitiativeCostSummary | null;
  reportingCurrency: CurrencyCode;
  readOnly: boolean;
  onClose: () => void;
  onSave: (record: Omit<InitiativeCostRecord, 'id' | 'updatedAt'> & { id?: string }) => void;
}

function makeLine(): CostLineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    amount: 0,
    currency: 'EUR',
  };
}

export function CostDrawer({
  isOpen,
  epic,
  summary,
  reportingCurrency,
  readOnly,
  onClose,
  onSave,
}: CostDrawerProps) {
  const [contingencyPct, setContingencyPct] = useState('0');
  const [hardwareDescription, setHardwareDescription] = useState('');
  const [hardwareAmount, setHardwareAmount] = useState('');
  const [hardwareCurrency, setHardwareCurrency] = useState<CurrencyCode>('EUR');
  const [licenses, setLicenses] = useState<CostLineItem[]>([]);

  useEffect(() => {
    if (!epic) return;
    const record = summary?.directCostRecord;
    setContingencyPct(String(record?.contingencyPct ?? 0));
    setHardwareDescription(record?.hardware?.description ?? '');
    setHardwareAmount(record?.hardware?.amount != null ? String(record.hardware.amount) : '');
    setHardwareCurrency(record?.hardware?.currency ?? 'EUR');
    setLicenses(record?.licenses?.length ? record.licenses : []);
  }, [epic, summary]);

  if (!isOpen || !epic || !summary) return null;

  const handleSave = () => {
    if (readOnly) return;

    const hardware = hardwareAmount.trim() === '' && hardwareDescription.trim() === ''
      ? null
      : {
        id: summary.directCostRecord?.hardware?.id ?? crypto.randomUUID(),
        description: hardwareDescription.trim() || 'Hardware',
        amount: Math.max(0, parseFloat(hardwareAmount) || 0),
        currency: hardwareCurrency,
      };

    onSave({
      id: summary.directCostRecord?.id,
      initiativeKind: 'portfolio_epic',
      initiativeId: epic.jiraKey,
      contingencyPct: Math.max(0, parseFloat(contingencyPct) || 0),
      hardware,
      licenses: licenses.filter((line) => line.description.trim() !== '' || line.amount > 0),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1300] flex justify-end">
      <div className="absolute inset-0 bg-[#1E293B]/25" onClick={onClose} />
      <aside className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-l border-[#DEDFE3] bg-white shadow-xl" role="dialog" aria-modal="true" aria-label="Initiative Cost">
        <div className="flex items-center justify-between border-b border-[#DEDFE3] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1E293B]">Initiative Cost</h2>
            <p className="text-sm text-[#94A3B8]">{epic.jiraKey} · {epic.summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#334155]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {readOnly ? (
            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1D4ED8]">
              Direct costs are shared from the baseline plan and are read-only in portfolio scenarios.
            </div>
          ) : null}

          {summary.missingRateCount > 0 ? (
            <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3">
              <p className="text-sm font-medium text-[#C2410C]">Missing rate inputs</p>
              <p className="mt-1 text-sm text-[#9A3412]">
                Excluded from totals: {summary.missingRateLabels.join(', ')}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#DEDFE3] bg-[#F8FAFC] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Labor</p>
              <p className="mt-1 text-lg font-semibold text-[#1E293B]">{formatCurrency(summary.laborCost, reportingCurrency)}</p>
            </div>
            <div className="rounded-xl border border-[#DEDFE3] bg-[#F8FAFC] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Current Total</p>
              <p className="mt-1 text-lg font-semibold text-[#1E293B]">{formatCurrency(summary.totalCost, reportingCurrency)}</p>
            </div>
          </div>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#1E293B]">Direct Costs</h3>
              <p className="text-xs text-[#94A3B8]">Add shared initiative costs such as hardware, licenses, or procurement items.</p>
            </div>

            <div className="rounded-xl border border-[#DEDFE3] p-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Hardware / Capex Description"
                  value={hardwareDescription}
                  onChange={(event) => setHardwareDescription(event.target.value)}
                  disabled={readOnly}
                />
                <div className="grid grid-cols-[1fr,120px] gap-3">
                  <Input
                    label="Hardware Amount"
                    type="number"
                    min={0}
                    step={10}
                    value={hardwareAmount}
                    onChange={(event) => setHardwareAmount(event.target.value)}
                    disabled={readOnly}
                  />
                  <Select
                    label="Currency"
                    value={hardwareCurrency}
                    onChange={(event) => setHardwareCurrency(event.target.value as CurrencyCode)}
                    options={CURRENCY_OPTIONS}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-[#DEDFE3] p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1E293B]">License / Other Lines</h4>
                {!readOnly ? (
                  <Button size="sm" variant="secondary" onClick={() => setLicenses((current) => [...current, makeLine()])}>
                    <Plus size={14} />
                    Add Line
                  </Button>
                ) : null}
              </div>

              {licenses.map((line) => (
                <div key={line.id} className="grid grid-cols-[1fr,120px,110px,32px] gap-3">
                  <Input
                    label="Description"
                    value={line.description}
                    onChange={(event) => setLicenses((current) => current.map((item) => item.id === line.id ? { ...item, description: event.target.value } : item))}
                    disabled={readOnly}
                  />
                  <Input
                    label="Amount"
                    type="number"
                    min={0}
                    step={10}
                    value={String(line.amount)}
                    onChange={(event) => setLicenses((current) => current.map((item) => item.id === line.id ? { ...item, amount: Math.max(0, parseFloat(event.target.value) || 0) } : item))}
                    disabled={readOnly}
                  />
                  <Select
                    label="Currency"
                    value={line.currency}
                    onChange={(event) => setLicenses((current) => current.map((item) => item.id === line.id ? { ...item, currency: event.target.value as CurrencyCode } : item))}
                    options={CURRENCY_OPTIONS}
                    disabled={readOnly}
                  />
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => setLicenses((current) => current.filter((item) => item.id !== line.id))}
                      className="mt-7 rounded-lg p-2 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#DC2626]"
                    >
                      <X size={16} />
                    </button>
                  ) : <div />}
                </div>
              ))}

              {licenses.length === 0 ? (
                <p className="text-sm text-[#94A3B8]">No additional direct cost lines yet.</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-[#1E293B]">Contingency</h3>
            <Input
              label="Contingency (%)"
              type="number"
              min={0}
              step={1}
              value={contingencyPct}
              onChange={(event) => setContingencyPct(event.target.value)}
              disabled={readOnly}
            />
          </section>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#DEDFE3] px-6 py-4">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {!readOnly ? (
            <Button onClick={handleSave}>Save Direct Costs</Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
