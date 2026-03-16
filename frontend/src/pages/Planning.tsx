import { lazy, Suspense } from 'react';
import { useAppStore, usePlanningSubView } from '../stores/appStore';
import { PlanningHub } from '../components/PlanningHub';
import { LoadingScreen } from '../components/ui/LoadingScreen';

const PlanningBoardV2 = lazy(() => import('../components/PlanningBoardV2'));

export function Planning() {
  const subView = usePlanningSubView();
  const setPlanningSubView = useAppStore((s) => s.setPlanningSubView);

  if (subView === 'board') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <PlanningBoardV2 onBack={() => setPlanningSubView('hub')} />
      </Suspense>
    );
  }

  return <PlanningHub />;
}
