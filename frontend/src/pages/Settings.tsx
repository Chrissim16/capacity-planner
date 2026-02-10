import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAppStore } from '../stores/appStore';

export function Settings() {
  const settings = useAppStore((s) => s.data.settings);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Configure application settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">BAU Reserve</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Default days reserved for BAU work per quarter
                </p>
              </div>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {settings.bauReserveDays} days
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Hours per Day</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Working hours in a standard day
                </p>
              </div>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {settings.hoursPerDay}h
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Dark Mode</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Use dark theme
                </p>
              </div>
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                {settings.darkMode ? 'On' : 'Off'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
          </CardHeader>
          <CardContent className="py-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              Full settings management coming soon...
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
              Manage team members, skills, systems, and more
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
