import React from 'react';
import { Check, ChevronRight } from 'lucide-react';

export type AppStage = 'portfolio' | 'capacity' | 'actuals';

interface StageProgressBarProps {
  currentStage: AppStage;
  onNavigate: (view: 'portfolio-planning' | 'planner' | 'projects') => void;
}

const STAGES: { id: AppStage; view: 'portfolio-planning' | 'planner' | 'projects'; label: string }[] = [
  { id: 'portfolio', view: 'portfolio-planning', label: 'Portfolio Planning' },
  { id: 'capacity', view: 'planner', label: 'Delivery Planning' },
  { id: 'actuals', view: 'projects', label: 'Delivery Tracking' },
];

export function StageProgressBar({ currentStage, onNavigate }: StageProgressBarProps) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === currentStage);

  return (
    <div className="flex items-center gap-1 border-b border-[#DEDFE3] bg-white px-6 py-2 text-xs">
      {STAGES.map((stage, index) => {
        const isCurrent = stage.id === currentStage;
        const isDone = index < currentIndex;

        return (
          <React.Fragment key={stage.id}>
            {index > 0 ? <ChevronRight size={11} className="shrink-0 text-[#CBD5E1]" /> : null}
            <button
              type="button"
              onClick={() => onNavigate(stage.view)}
              className={[
                'flex items-center gap-1 rounded px-2 py-0.5 transition-colors',
                isCurrent ? 'cursor-default bg-[#F1F5F9] font-medium text-[#1A1A2E]' : '',
                isDone ? 'text-[#0089DD] hover:bg-[#EFF6FF]' : '',
                !isCurrent && !isDone ? 'text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#64748B]' : '',
              ].join(' ')}
            >
              {isDone ? <Check size={10} /> : null}
              {stage.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
