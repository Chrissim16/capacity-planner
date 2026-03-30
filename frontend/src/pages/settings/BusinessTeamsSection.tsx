import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useCurrentState } from '../../stores/appStore';
import { addBusinessTeam, deleteBusinessTeam } from '../../stores/actions';
import { useToast } from '../../components/ui/Toast';

export function BusinessTeamsSection() {
  const { businessTeams } = useCurrentState();
  const { showToast } = useToast();
  const [newName, setNewName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      showToast('Enter a business team name first.', 'warning');
      return;
    }

    const exists = businessTeams.some((team) => team.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showToast(`"${trimmed}" already exists.`, 'warning');
      return;
    }

    addBusinessTeam(trimmed);
    setNewName('');
    showToast(`Added business team "${trimmed}".`, 'success');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Business Teams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#94A3B8] ">
            Define business teams (e.g. Finance, Procurement, HR) that can be assigned to Business Contacts and used in Portfolio Planning.
          </p>
          <div className="flex gap-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Finance, Procurement, HR, Operations"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={!newName.trim()}>
              <Plus size={16} />
              Add Team
            </Button>
          </div>
          <div className="space-y-2">
            {businessTeams.map((bt) => (
              <div
                key={bt.id}
                className="flex items-center justify-between p-3 bg-[#F0F2F5] /50 rounded-lg"
              >
                <span className="font-medium text-[#1E293B] ">{bt.name}</span>
                <button
                  onClick={() => setDeleteConfirm({ id: bt.id, name: bt.name })}
                  className="p-1.5 text-[#94A3B8] hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {businessTeams.length === 0 && (
              <p className="text-center py-8 text-[#94A3B8]">No business teams defined yet</p>
            )}
          </div>
        </CardContent>
      </Card>

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
