import { useState } from 'react';
import { Settings2, Shield, Code, Globe, Calendar, Database, Zap, Link2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { GeneralSection } from './settings/GeneralSection';
import { RolesSection } from './settings/RolesSection';
import { SkillsSection } from './settings/SkillsSection';
import { SystemsSection } from './settings/SystemsSection';
import { CountriesSection } from './settings/CountriesSection';
import { HolidaysSection } from './settings/HolidaysSection';
import { SprintsSection } from './settings/SprintsSection';
import { JiraSection } from './settings/JiraSection';
import { DataSection } from './settings/DataSection';

type SettingsSection = 'general' | 'roles' | 'skills' | 'systems' | 'countries' | 'holidays' | 'sprints' | 'jira' | 'data';

const sections: { id: SettingsSection; label: string; icon: typeof Settings2 }[] = [
  { id: 'general',   label: 'General',         icon: Settings2 },
  { id: 'roles',     label: 'Roles',            icon: Shield },
  { id: 'skills',    label: 'Skills',           icon: Code },
  { id: 'systems',   label: 'Systems',          icon: Globe },
  { id: 'countries', label: 'Countries',        icon: Globe },
  { id: 'holidays',  label: 'Holidays',         icon: Calendar },
  { id: 'sprints',   label: 'Sprints',          icon: Zap },
  { id: 'jira',      label: 'Jira Integration', icon: Link2 },
  { id: 'data',      label: 'Import / Export',  icon: Database },
];

export function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <Card className="w-64 shrink-0">
        <CardContent className="p-2">
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon size={18} />
                  {section.label}
                  {activeSection === section.id && <ChevronRight size={16} className="ml-auto" />}
                </button>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === 'general'   && <GeneralSection />}
        {activeSection === 'roles'     && <RolesSection />}
        {activeSection === 'skills'    && <SkillsSection />}
        {activeSection === 'systems'   && <SystemsSection />}
        {activeSection === 'countries' && <CountriesSection />}
        {activeSection === 'holidays'  && <HolidaysSection />}
        {activeSection === 'sprints'   && <SprintsSection />}
        {activeSection === 'jira'      && <JiraSection />}
        {activeSection === 'data'      && <DataSection />}
      </div>
    </div>
  );
}
