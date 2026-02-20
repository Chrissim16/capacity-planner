import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useAppStore } from '../../stores/appStore';
import { addRole, deleteRole } from '../../stores/actions';

export function RolesSection() {
  const roles = useAppStore((s) => s.getCurrentState().roles);
  const [newRoleName, setNewRoleName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = () => {
    if (newRoleName.trim()) {
      addRole(newRoleName.trim());
      setNewRoleName('');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Team Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Enter role name"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd}>
              <Plus size={16} />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">{role.name}</span>
                <button
                  onClick={() => setDeleteConfirm({ id: role.id, name: role.name })}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {roles.length === 0 && (
              <p className="text-center py-8 text-slate-400">No roles defined</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Role"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteRole(deleteConfirm!.id); setDeleteConfirm(null); }}>
              Delete
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete role <strong>{deleteConfirm?.name}</strong>?</p>
      </Modal>
    </>
  );
}
