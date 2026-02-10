import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, User, FolderKanban, Calendar, Zap } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useAppStore } from '../stores/appStore';
import { calculateCapacity } from '../utils/capacity';
import { isQuarterInRange, getCurrentQuarter } from '../utils/calendar';
import { generateSprints, getSprintsForQuarter, formatDateRange } from '../utils/sprints';
import type { Project, TeamMember, Sprint } from '../types';

type TimelineView = 'projects' | 'team';
type TimelineGranularity = 'quarter' | 'sprint';

export function Timeline() {
  const state = useAppStore((s) => s.getCurrentState());
  const { projects, teamMembers, quarters, settings } = state;
  
  const [viewMode, setViewMode] = useState<TimelineView>('projects');
  const [granularity, setGranularity] = useState<TimelineGranularity>('quarter');
  const [startQuarterIndex, setStartQuarterIndex] = useState(0);
  const [quartersToShow, setQuartersToShow] = useState(4);
  const [showCompleted, setShowCompleted] = useState(false);
  
  const currentQuarter = getCurrentQuarter();
  
  // Generate all sprints
  const allSprints = useMemo(() => generateSprints(settings, 2), [settings]);
  
  // Get visible quarters
  const visibleQuarters = quarters.slice(startQuarterIndex, startQuarterIndex + quartersToShow);
  
  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (!showCompleted && p.status === 'Completed') return false;
      return true;
    });
  }, [projects, showCompleted]);

  // Navigation
  const canGoBack = startQuarterIndex > 0;
  const canGoForward = startQuarterIndex + quartersToShow < quarters.length;
  
  const goBack = () => {
    if (canGoBack) setStartQuarterIndex(i => Math.max(0, i - 1));
  };
  
  const goForward = () => {
    if (canGoForward) setStartQuarterIndex(i => i + 1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500';
      case 'Planning': return 'bg-blue-500';
      case 'On Hold': return 'bg-amber-500';
      case 'Completed': return 'bg-slate-400';
      default: return 'bg-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'border-l-red-500';
      case 'Medium': return 'border-l-amber-500';
      case 'Low': return 'border-l-slate-400';
      default: return 'border-l-slate-300';
    }
  };

  const quarterCountOptions = [
    { value: '3', label: '3 quarters' },
    { value: '4', label: '4 quarters' },
    { value: '6', label: '6 quarters' },
    { value: '8', label: '8 quarters' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Timeline</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {viewMode === 'projects' 
              ? `${filteredProjects.length} projects` 
              : `${teamMembers.length} team members`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setViewMode('projects')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'projects'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <FolderKanban size={16} />
              Projects
            </button>
            <button
              onClick={() => setViewMode('team')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'team'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <User size={16} />
              Team
            </button>
          </div>

          {/* Granularity Toggle */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setGranularity('quarter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                granularity === 'quarter'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Calendar size={14} />
              Quarters
            </button>
            <button
              onClick={() => setGranularity('sprint')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                granularity === 'sprint'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Zap size={14} />
              Sprints
            </button>
          </div>
          
          {viewMode === 'projects' && (
            <Button
              variant="secondary"
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? <Eye size={16} /> : <EyeOff size={16} />}
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </Button>
          )}
          
          <Select
            value={String(quartersToShow)}
            onChange={(e) => setQuartersToShow(parseInt(e.target.value))}
            options={quarterCountOptions}
          />
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {/* Quarter Navigation Header */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            {/* Left column - empty header */}
            <div className="w-64 shrink-0 px-4 py-3 flex items-center justify-between border-r border-slate-200 dark:border-slate-700">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {viewMode === 'projects' ? 'Project' : 'Team Member'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={goBack}
                  disabled={!canGoBack}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={goForward}
                  disabled={!canGoForward}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            
            {/* Quarter/Sprint Headers */}
            {granularity === 'quarter' ? (
              // Quarter headers
              visibleQuarters.map(quarter => (
                <div
                  key={quarter}
                  className={`flex-1 min-w-[150px] px-3 py-3 text-center font-medium ${
                    quarter === currentQuarter
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {quarter}
                </div>
              ))
            ) : (
              // Sprint headers - show sprints for visible quarters
              visibleQuarters.flatMap(quarter => {
                const sprintsInQ = getSprintsForQuarter(quarter, allSprints);
                return sprintsInQ.map(sprint => (
                  <div
                    key={sprint.id}
                    className="flex-1 min-w-[120px] px-2 py-2 text-center border-l border-slate-200 dark:border-slate-700"
                  >
                    <div className="font-medium text-xs text-slate-600 dark:text-slate-300">
                      {sprint.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {formatDateRange(sprint.startDate, sprint.endDate)}
                    </div>
                  </div>
                ));
              })
            )}
          </div>

          {/* Rows */}
          {viewMode === 'projects' ? (
            // Project View
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProjects.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  No projects to display
                </div>
              ) : (
                filteredProjects.map(project => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    quarters={visibleQuarters}
                    sprints={allSprints}
                    granularity={granularity}
                    currentQuarter={currentQuarter}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                  />
                ))
              )}
            </div>
          ) : (
            // Team View
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamMembers.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  No team members to display
                </div>
              ) : (
                teamMembers.map(member => (
                  <TeamMemberRow
                    key={member.id}
                    member={member}
                    quarters={visibleQuarters}
                    sprints={allSprints}
                    granularity={granularity}
                    currentQuarter={currentQuarter}
                    state={state}
                  />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600 dark:text-slate-400">Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-600 dark:text-slate-400">Planning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-600 dark:text-slate-400">On Hold</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          <span className="text-slate-600 dark:text-slate-400">Completed</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface ProjectRowProps {
  project: Project;
  quarters: string[];
  sprints: Sprint[];
  granularity: TimelineGranularity;
  currentQuarter: string;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
}

function ProjectRow({ project, quarters, sprints, granularity, currentQuarter, getPriorityColor, getStatusColor }: ProjectRowProps) {
  if (granularity === 'quarter') {
    // Quarter view
    const quarterData = quarters.map(quarter => {
      const activePhases = project.phases.filter(phase => 
        isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter)
      );
      
      const totalDays = activePhases.reduce((sum, phase) => {
        return sum + phase.assignments.reduce((asum, a) => 
          a.quarter === quarter ? asum + a.days : asum, 0
        );
      }, 0);
      
      return { quarter, activePhases, totalDays };
    });

    return (
      <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        {/* Project Info */}
        <div className={`w-64 shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800 border-l-4 ${getPriorityColor(project.priority)}`}>
          <div className="font-medium text-slate-900 dark:text-white truncate" title={project.name}>
            {project.name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`} />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {project.phases.length} phase{project.phases.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        
        {/* Quarter Cells */}
        {quarterData.map(({ quarter, activePhases, totalDays }) => (
          <div
            key={quarter}
            className={`flex-1 min-w-[150px] px-3 py-3 ${
              quarter === currentQuarter 
                ? 'bg-blue-50/50 dark:bg-blue-900/10' 
                : ''
            }`}
          >
            {activePhases.length > 0 && (
              <div className="space-y-1">
                {activePhases.map(phase => (
                  <div
                    key={phase.id}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-xs font-medium text-blue-700 dark:text-blue-300 truncate"
                    title={`${phase.name}`}
                  >
                    {phase.name}
                  </div>
                ))}
                {totalDays > 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {totalDays}d allocated
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Sprint view
  const sprintCells = quarters.flatMap(quarter => {
    const sprintsInQ = getSprintsForQuarter(quarter, sprints);
    return sprintsInQ.map(sprint => {
      const activePhases = project.phases.filter(phase => 
        isQuarterInRange(quarter, phase.startQuarter, phase.endQuarter)
      );
      
      // Get sprint-specific assignments
      const sprintDays = activePhases.reduce((sum, phase) => {
        return sum + phase.assignments.reduce((asum, a) => {
          if (a.sprint === `${sprint.name} ${sprint.year}`) {
            return asum + a.days;
          }
          // Fall back to quarter assignment distributed across sprints
          if (a.quarter === quarter && !a.sprint) {
            const sprintCount = sprintsInQ.length || 1;
            return asum + (a.days / sprintCount);
          }
          return asum;
        }, 0);
      }, 0);
      
      return { sprint, activePhases, sprintDays };
    });
  });

  return (
    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      {/* Project Info */}
      <div className={`w-64 shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800 border-l-4 ${getPriorityColor(project.priority)}`}>
        <div className="font-medium text-slate-900 dark:text-white truncate" title={project.name}>
          {project.name}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`} />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {project.phases.length} phase{project.phases.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {/* Sprint Cells */}
      {sprintCells.map(({ sprint, activePhases, sprintDays }) => (
        <div
          key={sprint.id}
          className={`flex-1 min-w-[120px] px-2 py-3 border-l border-slate-100 dark:border-slate-800 ${
            sprint.quarter === currentQuarter 
              ? 'bg-blue-50/50 dark:bg-blue-900/10' 
              : ''
          }`}
        >
          {activePhases.length > 0 && sprintDays > 0 && (
            <div className="space-y-1">
              <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, (sprintDays / 15) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
                {sprintDays.toFixed(1)}d
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBER ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface TeamMemberRowProps {
  member: TeamMember;
  quarters: string[];
  sprints: Sprint[];
  granularity: TimelineGranularity;
  currentQuarter: string;
  state: ReturnType<typeof useAppStore.getState>['data'];
}

function TeamMemberRow({ member, quarters, sprints, granularity, currentQuarter, state }: TeamMemberRowProps) {
  if (granularity === 'quarter') {
    return (
      <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        {/* Member Info */}
        <div className="w-64 shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800">
          <div className="font-medium text-slate-900 dark:text-white truncate" title={member.name}>
            {member.name}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {member.role}
          </div>
        </div>
        
        {/* Quarter Cells with Capacity */}
        {quarters.map(quarter => {
          const capacity = calculateCapacity(member.id, quarter, state);
          
          return (
            <div
              key={quarter}
              className={`flex-1 min-w-[150px] px-3 py-3 ${
                quarter === currentQuarter 
                  ? 'bg-blue-50/50 dark:bg-blue-900/10' 
                  : ''
              }`}
            >
              <ProgressBar 
                value={capacity.usedDays} 
                max={capacity.totalWorkdays} 
                status={capacity.status}
                size="sm"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {capacity.usedDays.toFixed(0)}d / {capacity.totalWorkdays}d
                </span>
                <span className={`text-xs font-medium ${
                  capacity.status === 'overallocated' ? 'text-red-500' :
                  capacity.status === 'warning' ? 'text-amber-500' :
                  'text-green-500'
                }`}>
                  {capacity.usedPercent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Sprint view - show allocation per sprint
  const sprintCells = quarters.flatMap(quarter => {
    const sprintsInQ = getSprintsForQuarter(quarter, sprints);
    const quarterCapacity = calculateCapacity(member.id, quarter, state);
    const sprintWorkdays = Math.round(quarterCapacity.totalWorkdays / (sprintsInQ.length || 1));
    
    return sprintsInQ.map(sprint => {
      // Calculate sprint-specific allocation from assignments
      let sprintDays = 0;
      state.projects.forEach(project => {
        project.phases.forEach(phase => {
          phase.assignments.forEach(a => {
            if (a.memberId !== member.id) return;
            if (a.sprint === `${sprint.name} ${sprint.year}`) {
              sprintDays += a.days;
            } else if (a.quarter === quarter && !a.sprint) {
              // Distribute quarter assignment across sprints
              sprintDays += a.days / (sprintsInQ.length || 1);
            }
          });
        });
      });
      
      // Add BAU (distributed across sprints)
      const bauPerSprint = (quarterCapacity.breakdown.find(b => b.type === 'bau')?.days || 0) / (sprintsInQ.length || 1);
      sprintDays += bauPerSprint;
      
      const usedPercent = sprintWorkdays > 0 ? Math.round((sprintDays / sprintWorkdays) * 100) : 0;
      const status = usedPercent > 100 ? 'overallocated' : usedPercent > 90 ? 'warning' : 'normal';
      
      return { sprint, sprintDays, sprintWorkdays, usedPercent, status };
    });
  });

  return (
    <div className="flex hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      {/* Member Info */}
      <div className="w-64 shrink-0 px-4 py-3 border-r border-slate-100 dark:border-slate-800">
        <div className="font-medium text-slate-900 dark:text-white truncate" title={member.name}>
          {member.name}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {member.role}
        </div>
      </div>
      
      {/* Sprint Cells with Capacity */}
      {sprintCells.map(({ sprint, sprintDays, sprintWorkdays, usedPercent, status }) => (
        <div
          key={sprint.id}
          className={`flex-1 min-w-[120px] px-2 py-3 border-l border-slate-100 dark:border-slate-800 ${
            sprint.quarter === currentQuarter 
              ? 'bg-blue-50/50 dark:bg-blue-900/10' 
              : ''
          }`}
        >
          <ProgressBar 
            value={sprintDays} 
            max={sprintWorkdays} 
            status={status}
            size="sm"
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {sprintDays.toFixed(0)}d
            </span>
            <span className={`text-[10px] font-medium ${
              status === 'overallocated' ? 'text-red-500' :
              status === 'warning' ? 'text-amber-500' :
              'text-green-500'
            }`}>
              {usedPercent}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
