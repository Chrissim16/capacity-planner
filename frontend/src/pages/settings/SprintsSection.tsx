import { useState } from 'react';
import { Plus, Trash2, Edit2, RefreshCw, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { SprintForm } from '../../components/forms/SprintForm';
import { useCurrentState } from '../../stores/appStore';
import { addSprint, updateSprint, deleteSprint, generateSprintsForYear } from '../../stores/actions';
import { useToast } from '../../components/ui/Toast';
import type { Sprint } from '../../types';

export function SprintsSection() {
  const { sprints, settings } = useCurrentState();
  const { showToast } = useToast();

  const [sprintModalOpen, setSprintModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | undefined>();
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const sprintsByYear = sprints.reduce((acc, s) => {
    if (!acc[s.year]) acc[s.year] = [];
    acc[s.year].push(s);
    return acc;
  }, {} as Record<number, Sprint[]>);

  const yearsWithSprints = Object.keys(sprintsByYear).map(Number);

  const handleSave = (data: Omit<Sprint, 'id'>) => {
    if (editingSprint) {
      updateSprint(editingSprint.id, data);
      showToast('Sprint updated', 'success');
    } else {
      addSprint(data);
      showToast('Sprint added', 'success');
    }
    setSprintModalOpen(false);
    setEditingSprint(undefined);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      const generated = generateSprintsForYear(generateYear);
      showToast(`Generated ${generated.length} sprints for ${generateYear}`, 'success');
    } catch {
      showToast('Failed to generate sprints', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sprints</span>
            <Button size="sm" onClick={() => { setEditingSprint(undefined); setSprintModalOpen(true); }}>
              <Plus size={16} />Add Sprint
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-generate */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
              <RefreshCw size={16} />Auto-Generate Sprints
            </h4>
            <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
              Automatically generate all sprints for a year based on your settings ({settings.sprintsPerYear} sprints/year, {settings.sprintDurationWeeks} weeks each).
            </p>
            <div className="flex items-center gap-3">
              <Input
                type="number" min={2020} max={2100}
                value={generateYear}
                onChange={(e) => setGenerateYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-28"
              />
              <Button onClick={handleGenerate} isLoading={isGenerating}>
                <Zap size={16} />Generate {generateYear} Sprints
              </Button>
            </div>
            {yearsWithSprints.includes(generateYear) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ This will replace all existing sprints for {generateYear}
              </p>
            )}
          </div>

          {/* Sprint list */}
          {Object.keys(sprintsByYear).length === 0 ? (
            <div className="text-center py-12">
              <Zap size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 mb-2">No sprints defined</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">Use auto-generate above or add sprints manually</p>
            </div>
          ) : (
            Object.entries(sprintsByYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, yearSprints]) => (
                <div key={year} className="border-t border-slate-200 dark:border-slate-700 pt-4 first:border-t-0 first:pt-0">
                  <h3 className="flex items-center gap-2 text-lg font-medium text-slate-700 dark:text-slate-200 mb-3">
                    {year}
                    <Badge variant="default">{yearSprints.length} sprints</Badge>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {yearSprints
                      .sort((a, b) => a.number - b.number)
                      .map((sprint) => (
                        <div
                          key={sprint.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            sprint.isByeWeek
                              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                              : 'bg-slate-50 dark:bg-slate-800/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{sprint.name}</span>
                              {sprint.isByeWeek && <Badge variant="warning" className="text-xs">Bye</Badge>}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(sprint.startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} –{' '}
                              {new Date(sprint.endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {sprint.quarter}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => { setEditingSprint(sprint); setSprintModalOpen(true); }}
                              className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ id: sprint.id, name: sprint.name })}
                              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={sprintModalOpen}
        onClose={() => { setSprintModalOpen(false); setEditingSprint(undefined); }}
        title={editingSprint ? 'Edit Sprint' : 'Add Sprint'}
      >
        <SprintForm sprint={editingSprint} onSave={handleSave} onCancel={() => { setSprintModalOpen(false); setEditingSprint(undefined); }} />
      </Modal>

      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Sprint"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteSprint(deleteConfirm!.id); setDeleteConfirm(null); }}>Delete</Button>
          </>
        }
      >
        <p>Delete sprint <strong>{deleteConfirm?.name}</strong>?</p>
      </Modal>
    </>
  );
}
