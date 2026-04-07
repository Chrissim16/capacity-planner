import { useState } from 'react';
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
import type { BusinessTeam, CurrencyCode } from '../../types';

function emptyTeamForm(): {
  name: string;
  dailyRateOverride: string;
  dailyRateCurrency: CurrencyCode | '';
} {
  return {
    name: '',
    dailyRateOverride: '',
    dailyRateCurrency: '',
  };
}

export function BusinessTeamsSection() {
  const { businessTeams } = useCurrentState();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyTeamForm());
  const [editingTeam, setEditingTeam] = useState<BusinessTeam | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const openAdd = () => {
    setEditingTeam(null);
    setForm(emptyTeamForm());
    setIsEditorOpen(true);
  };

  const openEdit = (team: BusinessTeam) => {
    setEditingTeam(team);
    setForm({
      name: team.name,
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
      name: trimmed,
      dailyRateOverride: hasRate ? Math.max(0, parseFloat(form.dailyRateOverride) || 0) : undefined,
      dailyRateCurrency: hasCurrency ? form.dailyRateCurrency as CurrencyCode : undefined,
    };

    if (editingTeam) {
      updateBusinessTeam(editingTeam.id, updates);
      showToast(`Updated business team "${trimmed}".`, 'success');
    } else {
      const created = addBusinessTeam(trimmed);
      if (created && (updates.dailyRateOverride != null || updates.dailyRateCurrency != null)) {
        updateBusinessTeam(created.id, updates);
      }
      showToast(`Added business team "${trimmed}".`, 'success');
    }

    setIsEditorOpen(false);
    setEditingTeam(null);
    setForm(emptyTeamForm());
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Business Teams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#94A3B8]">
              Define business teams and optional team-level rate overrides used for costing fallbacks.
            </p>
            <Button onClick={openAdd}>
              <Plus size={16} />
              Add Team
            </Button>
          </div>

          <div className="space-y-2">
            {businessTeams.map((team) => (
              <div key={team.id} className="flex items-center justify-between rounded-lg border border-[#DEDFE3] bg-[#F8FAFC] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1E293B]">{team.name}</span>
                    {team.dailyRateOverride != null && team.dailyRateCurrency ? (
                      <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] text-[#C2410C]">
                        {formatCurrency(team.dailyRateOverride, team.dailyRateCurrency)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] text-[#64748B]">
                        Uses global business rate
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
            {businessTeams.length === 0 ? (
              <p className="py-8 text-center text-[#94A3B8]">No business teams defined yet</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingTeam ? 'Edit Business Team' : 'Add Business Team'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingTeam ? 'Save Changes' : 'Add Team'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Team Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Finance"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Daily Rate Override"
              type="number"
              min={0}
              step={10}
              value={form.dailyRateOverride}
              onChange={(event) => setForm((current) => ({ ...current, dailyRateOverride: event.target.value }))}
              hint="Leave blank to use the global business rate."
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
        title="Delete Business Team"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteBusinessTeam(deleteConfirm!.id);
                showToast(`Deleted business team "${deleteConfirm!.name}".`, 'success');
                setDeleteConfirm(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete business team <strong>{deleteConfirm?.name}</strong>? Contacts assigned to this team will lose the association.</p>
      </Modal>
    </>
  );
}
