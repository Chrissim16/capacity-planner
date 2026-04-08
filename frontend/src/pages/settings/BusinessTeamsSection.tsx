import { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { useCurrentState } from '../../stores/appStore';
import { addBusinessTeam, deleteBusinessTeam, updateBusinessTeam } from '../../stores/actions';
import { useToast } from '../../components/ui/Toast';
import { CURRENCY_OPTIONS, formatCurrency } from '../../utils/currency';
import type { BusinessTeam, CurrencyCode, PlanningGroupCategory } from '../../types';
import {
  filterPlanningGroupsByCategory,
  getPlanningGroupCategory,
  getPlanningGroupCategoryLabel,
  getPlanningGroupCategoryPluralLabel,
} from '../../utils/planningGroups';

function emptyTeamForm(): {
  category: PlanningGroupCategory;
  name: string;
  externalVendorId: string;
  dailyRateOverride: string;
  dailyRateCurrency: CurrencyCode | '';
} {
  return {
    category: 'business_team',
    name: '',
    externalVendorId: '',
    dailyRateOverride: '',
    dailyRateCurrency: '',
  };
}

const PLANNING_GROUP_CATEGORIES: PlanningGroupCategory[] = ['business_team', 'external_partner', 'internal_it_team'];

export function BusinessTeamsSection() {
  const { businessTeams, externalVendors } = useCurrentState();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyTeamForm());
  const [editingTeam, setEditingTeam] = useState<BusinessTeam | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const groupSections = useMemo(() => PLANNING_GROUP_CATEGORIES.map((category) => ({
    category,
    title: getPlanningGroupCategoryPluralLabel(category),
    description:
      category === 'business_team'
        ? 'Placeholder business-side teams used when a named business owner is not assigned.'
        : category === 'external_partner'
          ? 'External implementation partners that can be planned at team level.'
          : 'Internal non-core IT teams that should be tracked separately from named IT team members.',
    entries: filterPlanningGroupsByCategory(businessTeams, category).sort((a, b) => a.name.localeCompare(b.name)),
  })), [businessTeams]);

  const categoryOptions = PLANNING_GROUP_CATEGORIES.map((category) => ({
    value: category,
    label: getPlanningGroupCategoryLabel(category),
  }));
  const vendorOptions = [{ value: '', label: 'No linked vendor' }, ...externalVendors.map((vendor) => ({
    value: vendor.id,
    label: vendor.name,
  }))];

  const openAdd = (category: PlanningGroupCategory) => {
    setEditingTeam(null);
    setForm({ ...emptyTeamForm(), category });
    setIsEditorOpen(true);
  };

  const openEdit = (team: BusinessTeam) => {
    setEditingTeam(team);
    setForm({
      category: getPlanningGroupCategory(team),
      name: team.name,
      externalVendorId: team.externalVendorId ?? '',
      dailyRateOverride: team.dailyRateOverride != null ? String(team.dailyRateOverride) : '',
      dailyRateCurrency: team.dailyRateCurrency ?? '',
    });
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    const trimmed = form.name.trim();
    if (!trimmed) {
      showToast('Enter a business team name first.', 'warning');
      return;
    }

    const exists = businessTeams.some((team) =>
      team.id !== editingTeam?.id && team.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      showToast(`"${trimmed}" already exists.`, 'warning');
      return;
    }

    const hasRate = form.dailyRateOverride.trim() !== '';
    const hasCurrency = form.dailyRateCurrency !== '';
    if (hasRate !== hasCurrency) {
      showToast('Rate override and currency must be filled together.', 'warning');
      return;
    }

    const updates = {
      category: form.category,
      name: trimmed,
      externalVendorId: form.category === 'external_partner' && form.externalVendorId ? form.externalVendorId : undefined,
      dailyRateOverride: hasRate ? Math.max(0, parseFloat(form.dailyRateOverride) || 0) : undefined,
      dailyRateCurrency: hasCurrency ? form.dailyRateCurrency as CurrencyCode : undefined,
    };

    if (editingTeam) {
      updateBusinessTeam(editingTeam.id, updates);
      showToast(`Updated business team "${trimmed}".`, 'success');
    } else {
      addBusinessTeam(trimmed, updates);
      showToast(`Added ${getPlanningGroupCategoryLabel(form.category).toLowerCase()} "${trimmed}".`, 'success');
    }

    setIsEditorOpen(false);
    setEditingTeam(null);
    setForm(emptyTeamForm());
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Planning Groups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#94A3B8]">
            Manage placeholder groups separately for business teams, external partners, and internal IT teams. These groups are used in staffing pickers, reporting, and costing fallbacks.
          </p>

          <div className="space-y-4">
            {groupSections.map((section) => (
              <div key={section.category} className="rounded-xl border border-[#DEDFE3] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] px-4 py-3">
                  <div>
                    <div className="font-medium text-[#1E293B]">{section.title}</div>
                    <p className="text-xs text-[#94A3B8]">{section.description}</p>
                  </div>
                  <Button onClick={() => openAdd(section.category)}>
                    <Plus size={16} />
                    Add
                  </Button>
                </div>
                <div className="space-y-2 p-3">
                  {section.entries.map((team) => (
                    <div key={team.id} className="flex items-center justify-between rounded-lg border border-[#DEDFE3] bg-[#F8FAFC] px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#1E293B]">{team.name}</span>
                          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] text-[#64748B]">
                            {getPlanningGroupCategoryLabel(getPlanningGroupCategory(team))}
                          </span>
                          {team.dailyRateOverride != null && team.dailyRateCurrency ? (
                            <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] text-[#C2410C]">
                              {formatCurrency(team.dailyRateOverride, team.dailyRateCurrency)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] text-[#64748B]">
                              {section.category === 'business_team' ? 'Uses global business rate' : 'Uses IT/vendor fallback'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(team)}
                          className="p-1.5 text-[#94A3B8] hover:text-[#0089DD] transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ id: team.id, name: team.name })}
                          className="p-1.5 text-[#94A3B8] hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {section.entries.length === 0 ? (
                    <p className="py-6 text-center text-[#94A3B8]">No {section.title.toLowerCase()} defined yet</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingTeam ? 'Edit Planning Group' : 'Add Planning Group'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingTeam ? 'Save Changes' : 'Add Group'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Category"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as PlanningGroupCategory, externalVendorId: event.target.value === 'external_partner' ? current.externalVendorId : '' }))}
            options={categoryOptions}
          />
          <Input
            label="Group Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Finance, Accenture, Integration Hub"
          />
          {form.category === 'external_partner' ? (
            <Select
              label="Linked External Vendor"
              value={form.externalVendorId}
              onChange={(event) => setForm((current) => ({ ...current, externalVendorId: event.target.value }))}
              options={vendorOptions}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Daily Rate Override"
              type="number"
              min={0}
              step={10}
              value={form.dailyRateOverride}
              onChange={(event) => setForm((current) => ({ ...current, dailyRateOverride: event.target.value }))}
              hint={form.category === 'business_team' ? 'Leave blank to use the global business rate.' : 'Leave blank to use the linked vendor or global IT rate fallback.'}
            />
            <Select
              label="Override Currency"
              value={form.dailyRateCurrency}
              onChange={(event) => setForm((current) => ({ ...current, dailyRateCurrency: event.target.value as CurrencyCode | '' }))}
              options={[{ value: '', label: 'No override currency' }, ...CURRENCY_OPTIONS]}
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Planning Group"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteBusinessTeam(deleteConfirm!.id);
                showToast(`Deleted planning group "${deleteConfirm!.name}".`, 'success');
                setDeleteConfirm(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete planning group <strong>{deleteConfirm?.name}</strong>? Existing placeholder assignments will lose their mapping once the group is removed.</p>
      </Modal>
    </>
  );
}
