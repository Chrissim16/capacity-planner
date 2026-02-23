import { useMemo, useState } from 'react';
import { Users, FolderKanban, AlertTriangle, TrendingUp, CalendarOff } from 'lucide-react';
import { Select } from '../components/ui/Select';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppStore } from '../stores/appStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { CapacityTooltip } from '../components/ui/CapacityTooltip';
import { useCurrentState } from '../stores/appStore';
import { calculateCapacity, getWarnings, getTeamUtilizationSummary } from '../utils/capacity';
import { getCurrentQuarter, generateQuarters } from '../utils/calendar';

export function Dashboard() {
  const state = useCurrentState();
  const setCurrentView = useAppStore(s => s.setCurrentView);
  const currentQuarter = getCurrentQuarter();
  const quarters = useMemo(() => generateQuarters(8), []);
  const currentQuarterIndex = quarters.indexOf(currentQuarter);
  const [selectedQuarterIndex, setSelectedQuarterIndex] = useState(
    currentQuarterIndex >= 0 ? currentQuarterIndex : 0
  );
  const selectedQuarter = quarters[selectedQuarterIndex] ?? currentQuarter;

  // Calculate team utilization summary
  const utilizationSummary = useMemo(
    () => getTeamUtilizationSummary(selectedQuarter, state),
    [selectedQuarter, state]
  );

  // Get warnings
  const warnings = useMemo(() => getWarnings(state), [state]);
  const totalWarnings = 
    warnings.overallocated.length + 
    warnings.highUtilization.length + 
    warnings.tooManyProjects.length;

  // Active projects count
  const activeProjects = state.projects.filter(
    p => p.status === 'Active' || p.status === 'Planning'
  ).length;

  // Calculate capacity for each team member
  const memberCapacities = useMemo(() => {
    return state.teamMembers.map(member => ({
      member,
      capacity: calculateCapacity(member.id, selectedQuarter, state),
    }));
  }, [state, selectedQuarter]);

  const isEmpty = state.teamMembers.length === 0 && state.projects.length === 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Capacity Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {selectedQuarter}
            {selectedQuarter !== currentQuarter && (
              <span className="ml-2 text-blue-500">(current: {currentQuarter})</span>
            )}
          </p>
        </div>
        <Select
          value={String(selectedQuarterIndex)}
          onChange={e => setSelectedQuarterIndex(parseInt(e.target.value))}
          options={quarters.map((q, i) => ({
            value: String(i),
            label: q === currentQuarter ? `${q} (current)` : q,
          }))}
        />
      </div>

      {/* Getting Started — shown only when the app has no data yet */}
      {isEmpty && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <EmptyState
            icon={TrendingUp}
            title="Welcome to the Capacity Planner"
            description="Get started by adding your team members and epics. Once you have data, capacity charts and warnings will appear here."
            action={{ label: 'Add team members', onClick: () => setCurrentView('team') }}
            secondaryAction={{ label: 'Add an epic', onClick: () => setCurrentView('projects') }}
          />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Team Members</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {state.teamMembers.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
              <FolderKanban className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Active Epics</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {activeProjects}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Utilization</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {utilizationSummary.averageUtilization}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${totalWarnings > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <AlertTriangle className={`w-6 h-6 ${totalWarnings > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Warnings</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {totalWarnings}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Capacity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Team Capacity — {selectedQuarter}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {memberCapacities.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No team members yet"
                description="Add your team to see capacity bars and utilisation data here."
                action={{ label: 'Add team members', onClick: () => setCurrentView('team') }}
              />
            ) : (
              memberCapacities.map(({ member, capacity }) => {
                const timeOffDays = capacity.breakdown.find(b => b.type === 'timeoff')?.days ?? 0;
                return (
                <div key={member.id} className="flex items-center gap-4">
                  <div className="w-40 truncate">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {member.name}
                      </p>
                      {timeOffDays > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded shrink-0"
                          title={`${timeOffDays}d of PTO in ${selectedQuarter}`}
                        >
                          <CalendarOff size={9} />
                          {timeOffDays}d
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {member.role}
                    </p>
                  </div>
                  <div className="flex-1">
                    <CapacityTooltip capacity={capacity}>
                      <ProgressBar
                        value={capacity.usedDays}
                        max={capacity.totalWorkdays}
                        status={capacity.status}
                        showLabel
                      />
                    </CapacityTooltip>
                  </div>
                  <Badge
                    variant={
                      capacity.status === 'overallocated' ? 'danger' :
                      capacity.status === 'warning' ? 'warning' : 'success'
                    }
                  >
                    {capacity.status === 'overallocated' ? 'Over' :
                     capacity.status === 'warning' ? 'High' : 'OK'}
                  </Badge>
                </div>
              );})
            )}
          </CardContent>
        </Card>

        {/* Warnings Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalWarnings === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                No warnings - all good! ✓
              </p>
            ) : (
              <div className="space-y-3">
                {warnings.overallocated.map((w, i) => (
                  <div key={`over-${i}`} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {w.member.name} is overallocated
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {w.usedDays}d / {w.totalDays}d in {selectedQuarter}
                    </p>
                  </div>
                ))}
                {warnings.highUtilization.map((w, i) => (
                  <div key={`high-${i}`} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {w.member.name} at {w.usedPercent}%
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      High utilization in {selectedQuarter}
                    </p>
                  </div>
                ))}
                {warnings.tooManyProjects.map((w, i) => (
                  <div key={`proj-${i}`} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {w.member.name}: {w.count} projects
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Max concurrent: {w.max}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quarter Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Quarter Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {quarters.map(quarter => {
              const summary = getTeamUtilizationSummary(quarter, state);
              return (
                <div
                  key={quarter}
                  className="p-5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{quarter}</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Avg Utilization</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {summary.averageUtilization}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Overallocated</span>
                      <span className={`font-semibold ${summary.overallocated > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {summary.overallocated}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
