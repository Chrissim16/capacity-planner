import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useCurrentState } from '../../stores/appStore';
import { addSystem, updateSystem, deleteSystem } from '../../stores/actions';
import { useToast } from '../../components/ui/Toast';

export function SystemsSection() {
  const { systems } = useCurrentState();
  const { showToast } = useToast();

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleAdd = () => {
    if (newName.trim()) {
      addSystem(newName.trim(), newDesc.trim() || undefined);
      setNewName('');
      setNewDesc('');
      showToast('System added', 'success');
    }
  };

  const startEdit = (id: string) => {
    const s = systems.find((x) => x.id === id);
    if (s) { setEditingId(id); setEditName(s.name); setEditDesc(s.description || ''); }
  };

  const saveEdit = () => {
    if (editingId && editName.trim()) {
      updateSystem(editingId, { name: editName.trim(), description: editDesc.trim() || undefined });
      setEditingId(null);
      showToast('System updated', 'success');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="System name" className="flex-1" />
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" className="flex-1" />
            <Button onClick={handleAdd}><Plus size={16} />Add</Button>
          </div>
          <div className="space-y-2">
            {systems.map((system) => (
              <div key={system.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                {editingId === system.id ? (
                  <div className="flex-1 flex items-center gap-3">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="System name" className="flex-1" />
                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="flex-1" />
                    <button onClick={saveEdit} className="p-1.5 text-green-500 hover:text-green-600"><Check size={16} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={16} /></button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{system.name}</span>
                      {system.description && <p className="text-sm text-slate-500">{system.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(system.id)} className="p-1.5 text-slate-400 hover:text-blue-500"><Edit2 size={16} /></button>
                      <button onClick={() => setDeleteConfirm({ id: system.id, name: system.name })} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {systems.length === 0 && <p className="text-center py-8 text-slate-400">No systems defined</p>}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete System"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteSystem(deleteConfirm!.id); setDeleteConfirm(null); }}>Delete</Button>
          </>
        }
      >
        <p>Are you sure you want to delete system <strong>{deleteConfirm?.name}</strong>?</p>
      </Modal>
    </>
  );
}
