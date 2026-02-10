import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { getCurrentQuarter } from '../utils/calendar';

export function Timeline() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Timeline</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Gantt view of projects and assignments
          </p>
        </div>
        <Badge variant="primary">{getCurrentQuarter()}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent className="py-16 text-center">
          <p className="text-slate-500 dark:text-slate-400">
            Timeline view coming soon...
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
            This will show a Gantt chart with project phases and team allocations
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
