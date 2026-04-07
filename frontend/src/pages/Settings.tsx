import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  BookOpen,
  Briefcase,
  Building2,
  CalendarRange,
  Database,
  Gauge,
  Globe2,
  Link2,
  Settings2,
  Shield,
  Sparkles,
  TrendingUp,
  Users2,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
import { CostingSection } from './settings/CostingSection';
import { JiraSection } from './settings/JiraSection';
import { DataSection } from './settings/DataSection';
import { UsersSection } from './settings/UsersSection';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { useCurrentUser } from '../hooks/useCurrentUser';

type SettingsGroup = 'planning' | 'reference' | 'jira' | 'users';
type SettingsSectionId =
  | 'general'
  | 'costing'
  | 'confidence'
  | 'sprints'
  | 'data'
  | 'roles'
  | 'skills'
  | 'systems'
  | 'countries'
  | 'holidays'
  | 'process-teams'
  | 'business-teams'
  | 'business-contacts'
  | 'jira'
  | 'users';

interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  component: ComponentType;
}

interface SettingsGroupConfig {
  id: SettingsGroup;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  sections: SettingsSection[];
}

const settingsGroups: SettingsGroupConfig[] = [
  {
    id: 'planning',
    label: 'Planning',
    description: 'Control planning assumptions, costing inputs, confidence defaults, sprint setup, and import/export utilities.',
    icon: Settings2,
    accent: 'from-[#EEF6FF] via-white to-[#F8FAFC]',
    sections: [
      {
        id: 'general',
        label: 'General',
        description: 'Workspace defaults like BAU reserve, hours per day, and default country.',
        icon: Settings2,
        component: GeneralSection,
      },
      {
        id: 'costing',
        label: 'Costing',
        description: 'Reporting currency, FX rates, benchmark daily rates, and external vendors.',
        icon: TrendingUp,
        component: CostingSection,
      },
      {
        id: 'confidence',
        label: 'Confidence',
        description: 'Tune the confidence model and forecasting buffers used throughout planning.',
        icon: Gauge,
        component: ConfidenceSection,
      },
      {
        id: 'sprints',
        label: 'Sprints',
        description: 'Define sprint cadence and maintain the sprint calendar used across scenarios.',
        icon: CalendarRange,
        component: SprintsSection,
      },
      {
        id: 'data',
        label: 'Data',
        description: 'Export current workspace data, import changes, or review what is stored.',
        icon: Database,
        component: DataSection,
      },
    ],
  },
  {
    id: 'reference',
    label: 'Reference Data',
    description: 'Maintain the lookup lists and operational catalogs that keep planning data clean and reusable.',
    icon: BookOpen,
    accent: 'from-[#F3F8F4] via-white to-[#F8FAFC]',
    sections: [
      {
        id: 'roles',
        label: 'Roles',
        description: 'Manage the role taxonomy used for team capacity and staffing.',
        icon: Shield,
        component: RolesSection,
      },
      {
        id: 'skills',
        label: 'Skills',
        description: 'Keep the common skill library aligned with how teams are staffed and tracked.',
        icon: Sparkles,
        component: SkillsSection,
      },
      {
        id: 'systems',
        label: 'Systems',
        description: 'Catalog the systems and products referenced in roadmaps and delivery work.',
        icon: Wrench,
        component: SystemsSection,
      },
      {
        id: 'countries',
        label: 'Countries',
        description: 'Manage regional defaults and country options used across the workspace.',
        icon: Globe2,
        component: CountriesSection,
      },
      {
        id: 'holidays',
        label: 'Holidays',
        description: 'Review public holiday calendars and keep country-specific non-working days up to date.',
        icon: CalendarRange,
        component: HolidaysSection,
      },
      {
        id: 'process-teams',
        label: 'Process Teams',
        description: 'Organize delivery and operations teams for planning and reporting.',
        icon: Users2,
        component: ProcessTeamsSection,
      },
      {
        id: 'business-teams',
        label: 'Business Teams',
        description: 'Track the business-side teams that partner with delivery and demand planning.',
        icon: Building2,
        component: BusinessTeamsSection,
      },
      {
        id: 'business-contacts',
        label: 'Business Contacts',
        description: 'Maintain the stakeholder directory used for assignments, ownership, and planning context.',
        icon: Briefcase,
        component: BusinessContactsSection,
      },
    ],
  },
  {
    id: 'jira',
    label: 'Jira Integration',
    description: 'Configure connections, sync defaults, diagnostics, and the rules that shape imported Jira data.',
    icon: Link2,
    accent: 'from-[#F2F7FF] via-white to-[#F8FAFC]',
    sections: [
      {
        id: 'jira',
        label: 'Connections & Sync',
        description: 'Manage Jira connectivity, sync settings, and import troubleshooting in one place.',
        icon: Link2,
        component: JiraSection,
      },
    ],
  },
  {
    id: 'users',
    label: 'Users',
    description: 'Review workspace access, roles, and invitations for the people using this environment.',
    icon: Shield,
    accent: 'from-[#F6F4FF] via-white to-[#F8FAFC]',
    sections: [
      {
        id: 'users',
        label: 'People & Access',
        description: 'Invite users, adjust roles, and understand current workspace access.',
        icon: Shield,
        component: UsersSection,
      },
    ],
  },
];

export function Settings() {
  const { can } = useCurrentUser();
  const canManageSettings = can('manage_settings');

  const availableGroups = useMemo(
    () => (canManageSettings ? settingsGroups : settingsGroups.filter((group) => group.id === 'users')),
    [canManageSettings]
  );

  const [activeGroup, setActiveGroup] = useState<SettingsGroup>(canManageSettings ? 'planning' : 'users');
  const [activeSectionId, setActiveSectionId] = useState<SettingsSectionId>(canManageSettings ? 'general' : 'users');

  const visibleGroup = availableGroups.some((group) => group.id === activeGroup)
    ? availableGroups.find((group) => group.id === activeGroup) ?? availableGroups[0]
    : availableGroups[0];

  useEffect(() => {
    if (!visibleGroup) return;

    const sectionStillVisible = visibleGroup.sections.some((section) => section.id === activeSectionId);
    if (!sectionStillVisible) {
      setActiveSectionId(visibleGroup.sections[0]?.id ?? 'users');
    }
  }, [activeSectionId, visibleGroup]);

  if (!visibleGroup) {
    return null;
  }

  const activeSection = visibleGroup.sections.find((section) => section.id === activeSectionId) ?? visibleGroup.sections[0];
  const ActiveSectionComponent = activeSection.component;
  const GroupIcon = visibleGroup.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle={canManageSettings ? 'Configuration and preferences' : 'Workspace access and roles'}
      />

      <section className={`rounded-[28px] border border-[#DEDFE3] bg-gradient-to-br ${visibleGroup.accent} p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B] shadow-sm">
              <GroupIcon size={14} />
              Workspace Administration
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-[#0F172A]">{visibleGroup.label}</h2>
              <p className="max-w-2xl text-sm leading-6 text-[#475569]">{visibleGroup.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {availableGroups.map((group) => {
              const Icon = group.icon;
              const isActive = group.id === visibleGroup.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroup(group.id)}
                  className={`min-w-[11rem] rounded-2xl border px-4 py-3 text-left transition-all duration-150 ${
                    isActive
                      ? 'border-[#0F172A] bg-[#0F172A] text-white shadow-lg'
                      : 'border-white/80 bg-white/75 text-[#334155] hover:border-[#CBD5E1] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon size={16} />
                    {group.label}
                  </div>
                  <div className={`mt-2 text-xs ${isActive ? 'text-white/75' : 'text-[#64748B]'}`}>
                    {group.sections.length} section{group.sections.length === 1 ? '' : 's'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden rounded-[24px] border-[#D7DEE7] shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Sections</p>
              <h3 className="mt-2 text-lg font-semibold text-[#0F172A]">{visibleGroup.label}</h3>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">Pick a section to focus the workspace and avoid long-form scrolling.</p>
            </div>

            <div className="p-3">
              <nav className="space-y-1.5" aria-label={`${visibleGroup.label} settings sections`}>
                {visibleGroup.sections.map((section, index) => {
                  const Icon = section.icon;
                  const isActive = section.id === activeSection.id;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSectionId(section.id)}
                      className={`w-full rounded-2xl px-4 py-3 text-left transition-all duration-150 ${
                        isActive
                          ? 'bg-[#0F172A] text-white shadow-md'
                          : 'text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-xl p-2 ${isActive ? 'bg-white/15 text-white' : 'bg-[#E2E8F0] text-[#475569]'}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{section.label}</span>
                            <span className={`text-[11px] ${isActive ? 'text-white/55' : 'text-[#94A3B8]'}`}>
                              {String(index + 1).padStart(2, '0')}
                            </span>
                          </div>
                          <p className={`mt-1 text-xs leading-5 ${isActive ? 'text-white/75' : 'text-[#64748B]'}`}>
                            {section.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="rounded-[24px] border border-[#D7DEE7] bg-white px-6 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                  <GroupIcon size={14} />
                  {visibleGroup.label}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A]">{activeSection.label}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">{activeSection.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[18rem]">
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Category</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F172A]">{visibleGroup.label}</p>
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Focus</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                    {visibleGroup.sections.findIndex((section) => section.id === activeSection.id) + 1} of {visibleGroup.sections.length}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="min-w-0">
            <ActiveSectionComponent />
          </div>
        </div>
      </div>
    </div>
  );
}
