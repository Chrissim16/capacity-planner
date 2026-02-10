import { Plus } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useAppStore } from '../stores/appStore';
import { calculateCapacity } from '../utils/capacity';
import { getCurrentQuarter } from '../utils/calendar';

export function Team() {
  const state = useAppStore((s) => s.getCurrentState());
  const teamMembers = state.teamMembers;
  const currentQuarter = getCurrentQuarter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Team members and their capacity
          </p>
        </div>
        <Button>
          <Plus size={16} />
          Add Member
        </Button>
      </div>

      {teamMembers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              No team members yet. Add team members in Settings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teamMembers.map(member => {
            const capacity = calculateCapacity(member.id, currentQuarter, state);
            const country = state.countries.find(c => c.id === member.countryId);
            
            return (
              <Card key={member.id} className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <CardContent>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {member.name}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {member.role}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {country?.code || 'NL'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500 dark:text-slate-400">
                          {currentQuarter} Capacity
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {capacity.usedPercent}%
                        </span>
                      </div>
                      <ProgressBar
                        value={capacity.usedDays}
                        max={capacity.totalWorkdays}
                        status={capacity.status}
                        size="sm"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Available
                      </span>
                      <span className={`font-medium ${capacity.availableDaysRaw < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {capacity.availableDaysRaw}d
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Max Projects
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        {member.maxConcurrentProjects}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
