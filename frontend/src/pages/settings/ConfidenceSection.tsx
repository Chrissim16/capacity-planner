import { useState } from 'react';
import { Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCurrentState } from '../../stores/appStore';
import { updateSettings } from '../../stores/actions';
import { useToast } from '../../components/ui/Toast';
import type { ConfidenceLevel } from '../../types';

const LEVELS: { id: ConfidenceLevel; label: string; description: string; color: string; bg: string; border: string }[] = [
  {
    id: 'high',
    label: 'High',
    description: 'Well-understood work with few unknowns',
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-700/50',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Some uncertainty; scope mostly defined',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700/50',
  },
  {
    id: 'low',
    label: 'Low',
    description: 'High uncertainty; rough estimates only',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700/50',
  },
];

export function ConfidenceSection() {
  const { settings } = useCurrentState();
  const { showToast } = useToast();

  const cl = settings.confidenceLevels;
  const [high,   setHigh]   = useState(cl?.high   ?? 5);
  const [medium, setMedium] = useState(cl?.medium  ?? 15);
  const [low,    setLow]    = useState(cl?.low     ?? 25);
  const [defaultLevel, setDefaultLevel] = useState<ConfidenceLevel>(cl?.defaultLevel ?? 'medium');

  const values: Record<ConfidenceLevel, number> = { high, medium, low };
  const setters: Record<ConfidenceLevel, (v: number) => void> = { high: setHigh, medium: setMedium, low: setLow };

  const isValid = () => {
    const allInRange = [high, medium, low].every(v => Number.isFinite(v) && v >= 0 && v <= 100);
    return allInRange && high <= medium && medium <= low;
  };

  const handleSave = () => {
    if (!isValid()) {
      showToast('Buffers must be 0–100% and ordered High ≤ Medium ≤ Low', 'error');
      return;
    }
    updateSettings({
      confidenceLevels: { high, medium, low, defaultLevel },
    });
    showToast('Confidence levels saved', 'success');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confidence Levels</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Each confidence level adds a buffer on top of the raw estimated days.
          Forecasted days = estimated days × (1 + buffer%).
        </p>

        {/* Level rows */}
        <div className="space-y-3">
          {LEVELS.map(level => (
            <div
              key={level.id}
              className={`flex items-center gap-4 rounded-lg border p-4 ${level.bg} ${level.border}`}
            >
              {/* Badge */}
              <div className={`w-20 shrink-0`}>
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${level.color}`}>
                  {level.label}
                  {defaultLevel === level.id && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-white/60 dark:bg-black/20">
                      default
                    </span>
                  )}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  {level.description}
                </p>
              </div>

              {/* Buffer input */}
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Buffer
                </label>
                <div className="relative w-24">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={values[level.id]}
                    onChange={e => setters[level.id](Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                    className="w-full pr-7 pl-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0089DD] text-right"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">%</span>
                </div>

                {/* Set as default button */}
                <button
                  onClick={() => setDefaultLevel(level.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                    defaultLevel === level.id
                      ? 'bg-[#0089DD] text-white border-[#0089DD]'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-[#0089DD] hover:text-[#0089DD]'
                  }`}
                >
                  {defaultLevel === level.id ? 'Default ✓' : 'Set default'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Validation hint */}
        {!isValid() && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            Buffers must be between 0–100% and in order: High ≤ Medium ≤ Low.
          </p>
        )}

        {/* Example calculation */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-600 dark:text-slate-300">Example</p>
          <p>10 estimated days with <strong>High</strong> confidence → {(10 * (1 + high / 100)).toFixed(1)}d forecasted ({high}% buffer)</p>
          <p>10 estimated days with <strong>Medium</strong> confidence → {(10 * (1 + medium / 100)).toFixed(1)}d forecasted ({medium}% buffer)</p>
          <p>10 estimated days with <strong>Low</strong> confidence → {(10 * (1 + low / 100)).toFixed(1)}d forecasted ({low}% buffer)</p>
        </div>

        <Button onClick={handleSave} disabled={!isValid()}>
          <Save size={16} />
          Save Confidence Levels
        </Button>
      </CardContent>
    </Card>
  );
}
