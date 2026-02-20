import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { useCurrentState } from '../../stores/appStore';
import { addSkill, deleteSkill } from '../../stores/actions';

export function SkillsSection() {
  const { skills } = useCurrentState();
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'System' | 'Process' | 'Technical'>('Technical');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const categoryOptions = [
    { value: 'System', label: 'System' },
    { value: 'Process', label: 'Process' },
    { value: 'Technical', label: 'Technical' },
  ];

  const skillsByCategory = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, typeof skills>);

  const handleAdd = () => {
    if (newSkillName.trim()) {
      addSkill(newSkillName.trim(), newSkillCategory);
      setNewSkillName('');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="Enter skill name"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Select
              value={newSkillCategory}
              onChange={(e) => setNewSkillCategory(e.target.value as typeof newSkillCategory)}
              options={categoryOptions}
            />
            <Button onClick={handleAdd}>
              <Plus size={16} />
              Add
            </Button>
          </div>
          {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
                {category}
              </h3>
              <div className="space-y-2">
                {categorySkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200">{skill.name}</span>
                    <button
                      onClick={() => setDeleteConfirm({ id: skill.id, name: skill.name })}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {skills.length === 0 && (
            <p className="text-center py-8 text-slate-400">No skills defined</p>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Skill"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteSkill(deleteConfirm!.id); setDeleteConfirm(null); }}>
              Delete
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete skill <strong>{deleteConfirm?.name}</strong>?</p>
      </Modal>
    </>
  );
}
