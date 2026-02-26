import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useCurrentState } from '../../stores/appStore';
import { addProcessTeam, deleteProcessTeam } from '../../stores/actions';

export function ProcessTeamsSection() {
  const { processTeams } = useCurrentState();
  const [newName, setNewName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = () => {
    if (newName.trim()) {
      addProcessTeam(newName.trim());
      setNewName('');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Process Teams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define process teams (e.g. R2R, P2P, Treasury) that can be assigned to both IT members and Business Contacts.
          </p>
          <div className="flex gap-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. R2R, P2P, Treasury, FP&A"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd}>
              <Plus size={16} />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {processTeams.map((pt) => (
              <div
                key={pt.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">{pt.name}</span>
                <button
                  onClick={() => setDeleteConfirm({ id: pt.id, name: pt.name })}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {processTeams.length === 0 && (
              <p className="text-center py-8 text-slate-400">No process teams defined yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Process Team"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteProcessTeam(deleteConfirm!.id); setDeleteConfirm(null); }}>
              Delete
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete process team <strong>{deleteConfirm?.name}</strong>? Members and contacts assigned to this team will lose the association.</p>
      </Modal>
    </>
  );
}
