import { useState } from 'react';
import { Settings2, BookOpen, Link2, Shield } from 'lucide-react';
import { GeneralSection } from './settings/GeneralSection';
import { ConfidenceSection } from './settings/ConfidenceSection';
import { RolesSection } from './settings/RolesSection';
import { SkillsSection } from './settings/SkillsSection';
import { SystemsSection } from './settings/SystemsSection';
import { CountriesSection } from './settings/CountriesSection';
import { HolidaysSection } from './settings/HolidaysSection';
import { BusinessContactsSection } from './settings/BusinessContactsSection';
import { ProcessTeamsSection } from './settings/ProcessTeamsSection';
import { BusinessTeamsSection } from './settings/BusinessTeamsSection';
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
  const canManageSettings = can('manage_settings');
  const availableGroups = canManageSettings ? groups : groups.filter((group) => group.id === 'users');
  const [activeGroup, setActiveGroup] = useState<SettingsGroup>(canManageSettings ? 'planning' : 'users');
  const visibleGroup = availableGroups.some((group) => group.id === activeGroup)
    ? activeGroup
    : (availableGroups[0]?.id ?? 'users');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle={canManageSettings ? 'Configuration and preferences' : 'Workspace access and roles'}
      />

      {/* Horizontal tab bar */}
      <div className="flex items-center gap-1 border-b border-[#DEDFE3]">
        {availableGroups.map((group) => {
          const Icon = group.icon;
          return (
            <button
              key={group.id}
              onClick={() => setActiveGroup(group.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
                visibleGroup === group.id
                  ? 'border-[#0089DD] text-[#1E293B]'
                  : 'border-transparent text-[#94A3B8] hover:text-[#94A3B8]'
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
        {visibleGroup === 'planning' && (
          <div className="space-y-6">
            <GeneralSection />
            <ConfidenceSection />
            <SprintsSection />
            <DataSection />
          </div>
        )}

        {visibleGroup === 'reference' && (
          <div className="space-y-6">
            <RolesSection />
            <SkillsSection />
            <SystemsSection />
            <CountriesSection />
            <HolidaysSection />
            <ProcessTeamsSection />
            <BusinessTeamsSection />
            <BusinessContactsSection />
          </div>
        )}

        {visibleGroup === 'jira' && <JiraSection />}

        {visibleGroup === 'users' && <UsersSection />}
      </div>
    </div>
  );
}
