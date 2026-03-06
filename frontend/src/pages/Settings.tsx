import { useState } from 'react';
import { Settings2, BookOpen, Link2, Shield, Lock } from 'lucide-react';
import { GeneralSection } from './settings/GeneralSection';
import { ConfidenceSection } from './settings/ConfidenceSection';
import { RolesSection } from './settings/RolesSection';
import { SkillsSection } from './settings/SkillsSection';
import { SystemsSection } from './settings/SystemsSection';
import { CountriesSection } from './settings/CountriesSection';
import { HolidaysSection } from './settings/HolidaysSection';
import { BusinessContactsSection } from './settings/BusinessContactsSection';
import { ProcessTeamsSection } from './settings/ProcessTeamsSection';
import { SprintsSection } from './settings/SprintsSection';
import { JiraSection } from './settings/JiraSection';
import { DataSection } from './settings/DataSection';
import { UsersSection } from './settings/UsersSection';
import { PageHeader } from '../components/layout/PageHeader';
import { useCurrentUser } from '../hooks/useCurrentUser';

type SettingsGroup = 'planning' | 'reference' | 'jira' | 'users';

const groups: { id: SettingsGroup; label: string; icon: typeof Settings2 }[] = [
  { id: 'planning',  label: 'Planning',        icon: Settings2 },
  { id: 'reference', label: 'Reference Data',  icon: BookOpen },
  { id: 'jira',      label: 'Jira Integration', icon: Link2 },
  { id: 'users',     label: 'Users',            icon: Shield },
];

export function Settings() {
  const { can } = useCurrentUser();
  const [activeGroup, setActiveGroup] = useState<SettingsGroup>('planning');

  if (!can('manage_settings')) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-slate-500 dark:text-slate-400">
        <Lock size={40} className="text-slate-300 dark:text-slate-600" />
        <p className="text-lg font-medium text-slate-700 dark:text-slate-200">Access restricted</p>
        <p className="text-sm">You don't have permission to view Settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Configuration and preferences"
      />

      {/* Horizontal tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <button
              key={group.id}
              onClick={() => setActiveGroup(group.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeGroup === group.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={16} />
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="overflow-y-auto pb-8" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
        {activeGroup === 'planning' && (
          <div className="space-y-6">
            <GeneralSection />
            <ConfidenceSection />
            <SprintsSection />
            <DataSection />
          </div>
        )}

        {activeGroup === 'reference' && (
          <div className="space-y-6">
            <RolesSection />
            <SkillsSection />
            <SystemsSection />
            <CountriesSection />
            <HolidaysSection />
            <ProcessTeamsSection />
            <BusinessContactsSection />
          </div>
        )}

        {activeGroup === 'jira' && <JiraSection />}

        {activeGroup === 'users' && <UsersSection />}
      </div>
    </div>
  );
}
