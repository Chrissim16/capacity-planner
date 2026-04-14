import { useCallback, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { StructuredBriefingSections } from '../report/StructuredPortfolioReportPDF';

export interface StructuredBriefingPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sections: StructuredBriefingSections) => void;
  isExporting: boolean;
}

const DEFAULT_SECTIONS: StructuredBriefingSections = {
  executive: true,
  costs: true,
  epicEffort: true,
  appendixPerson: false,
  appendixProcessTeam: false,
};

export function StructuredBriefingPdfModal({
  isOpen,
  onClose,
  onConfirm,
  isExporting,
}: StructuredBriefingPdfModalProps) {
  const [sections, setSections] = useState<StructuredBriefingSections>(DEFAULT_SECTIONS);

  const toggle = useCallback((key: keyof StructuredBriefingSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleConfirm = useCallback(() => {
    const anySelected = Object.values(sections).some(Boolean);
    if (!anySelected) return;
    onConfirm(sections);
  }, [onConfirm, sections]);

  const checkRow = (key: keyof StructuredBriefingSections, label: string) => (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#1E293B]">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-[#94A3B8] text-sana-teal accent-sana-teal focus:ring-2 focus:ring-sana-teal"
        checked={sections[key]}
        onChange={() => toggle(key)}
      />
      {label}
    </label>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Structured briefing PDF"
      size="md"
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={isExporting || !Object.values(sections).some(Boolean)}
          >
            {isExporting ? 'Exporting…' : 'Download PDF'}
          </Button>
        </div>
      )}
    >
      <p className="mb-4 text-sm text-[#64748B]">
        Choose sections to include. Appendix tables are capped in the PDF for readability; use the Reports tab for full data.
      </p>
      <div className="flex flex-col gap-2">
        {checkRow(
          'executive',
          'Executive summary (health KPIs + portfolio overview: period days, cost, bucket & cost mix bars)',
        )}
        {checkRow('costs', 'Cost overview and per-epic labor / direct totals')}
        {checkRow('epicEffort', 'Effort by epic (day buckets)')}
        {checkRow('appendixPerson', 'Appendix: person × epic (truncated)')}
        {checkRow('appendixProcessTeam', 'Appendix: process team × epic (truncated)')}
      </div>
    </Modal>
  );
}
