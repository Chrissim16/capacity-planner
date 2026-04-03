import { useState, useMemo } from 'react';
import { FileBarChart, FileText, Loader2 } from 'lucide-react';
import { useCurrentState, useActiveScenario } from '../stores/appStore';
import { ScenarioSelector } from '../components/ScenarioSelector';
import { ReportGantt } from '../components/report/ReportGantt';
import { ReportRisks } from '../components/report/ReportRisks';
import type { OverbookedMember } from '../components/report/ReportRisks';
import { ProcessTeamCapacityTable } from '../components/planner/ProcessTeamCapacityTable';
import { useProcessTeamCapacitySummaries } from '../hooks/useProcessTeamCapacitySummaries';
import { getEpicStaffingRisks } from '../utils/reportRisks';
import { getWarnings } from '../utils/capacity';
import { getCurrentQuarter, generateQuarters, getNextQuarter, getQuartersBetween } from '../utils/calendar';
import { globalJiraWorkItems } from '../utils/jiraWorkItemScope';

export function Report() {
  const state = useCurrentState();
  const activeScenario = useActiveScenario();
  const [exporting, setExporting] = useState(false);
  const jiraWorkItems = useMemo(
    () => globalJiraWorkItems(state.jiraWorkItems ?? [], state.jiraConnections ?? []),
    [state.jiraWorkItems, state.jiraConnections],
  );
  const reportState = useMemo(() => ({ ...state, jiraWorkItems }), [state, jiraWorkItems]);

  // Quarter picker options — derived from sprint definitions or a fallback window
  const quarterOptions = useMemo(() => {
    if (state.sprints.length > 0) {
      const unique = [...new Set(state.sprints.map(s => s.quarter))];
      return unique.sort((a, b) => {
        const parseQ = (q: string) => {
          const m = q.match(/Q([1-4])\s+(\d{4})/);
          return m ? parseInt(m[2]) * 10 + parseInt(m[1]) : 0;
        };
        return parseQ(a) - parseQ(b);
      });
    }
    return generateQuarters(8);
  }, [state.sprints]);

  const [selectedQuarter, setSelectedQuarter] = useState<string>(() => {
    const current = getCurrentQuarter();
    // If current quarter is available in options (derived after mount), prefer it;
    // otherwise fall back to first available.
    return current;
  });

  // 4-quarter Gantt window starting from the selected quarter
  const ganttQuarters = useMemo(() => {
    const end = getNextQuarter(getNextQuarter(getNextQuarter(selectedQuarter)));
    return getQuartersBetween(selectedQuarter, end);
  }, [selectedQuarter]);

  // Planner items from the active scenario's layout
  const plannerItems = useMemo(
    () => activeScenario?.plannerLayout ?? [],
    [activeScenario],
  );

  // Epic staffing risks
  const epicRisks = useMemo(
    () => getEpicStaffingRisks(plannerItems, jiraWorkItems),
    [plannerItems, jiraWorkItems],
  );

  // Overbooked members for the selected quarter
  const overbookedMembers = useMemo(() => {
    const warnings = getWarnings(reportState, selectedQuarter);
    return warnings.overallocated.map(w => ({
      member: w.member,
      usedPercent: w.totalDays > 0 ? Math.round((w.usedDays / w.totalDays) * 100) : 0,
      quarter: w.quarter,
    }));
  }, [reportState, selectedQuarter]);

  // Process team capacity for the selected quarter
  const processTeamSummaries = useProcessTeamCapacitySummaries(selectedQuarter);

  const hasNoPlannerData = plannerItems.length === 0;

  const scenarioName = activeScenario?.name ?? 'Jira Baseline';

  const handleExport = async () => {
    setExporting(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { ReportPDF } = await import('../components/report/ReportPDF');
      const blob = await pdf(
        <ReportPDF
          scenarioName={scenarioName}
          quarter={selectedQuarter}
          plannerItems={plannerItems}
          jiraItems={jiraWorkItems}
          teamMembers={state.teamMembers}
          sprints={state.sprints}
          ganttQuarters={ganttQuarters}
          epicRisks={epicRisks}
          overbookedMembers={overbookedMembers as OverbookedMember[]}
          processTeamSummaries={processTeamSummaries}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capacity-report-${selectedQuarter.replace(/\s+/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto bg-[#F5F8FC]">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-4 bg-white border-b border-[#DEDFE3] shrink-0">
        <div className="flex items-center gap-2">
          <FileBarChart size={18} className="text-[#0089DD]" />
          <h1 className="text-lg font-semibold text-[#1E293B]">Executive Report</h1>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <ScenarioSelector />

          <select
            value={selectedQuarter}
            onChange={e => setSelectedQuarter(e.target.value)}
            className="text-sm border border-[#DEDFE3] rounded-lg px-3 py-2 bg-white text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0089DD] focus:border-transparent"
          >
            {quarterOptions.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>

          <button
            onClick={handleExport}
            disabled={exporting || hasNoPlannerData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#0089DD] text-white transition-opacity duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#0089DD] focus:ring-offset-2"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {exporting ? 'Generating…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* No planning data empty state */}
      {hasNoPlannerData && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8 py-16">
          <FileBarChart size={40} className="text-[#DEDFE3]" />
          <p className="text-base font-medium text-[#1E293B]">No planning data in this scenario</p>
          <p className="text-sm text-[#94A3B8] max-w-sm">
            Open Delivery Planning and schedule delivery work to generate a report.
          </p>
        </div>
      )}

      {/* Report sections */}
      {!hasNoPlannerData && (
        <div className="flex-1 px-8 py-6 space-y-6">
          {/* Delivery Timeline */}
          <section className="bg-white rounded-xl border border-[#DEDFE3] p-6">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-4">
              Delivery Timeline
            </h2>
            <ReportGantt
              plannerItems={plannerItems}
              jiraItems={jiraWorkItems}
              quarters={ganttQuarters}
              teamMembers={state.teamMembers}
              sprints={state.sprints}
            />
          </section>

          {/* Capacity Risks */}
          <section className="bg-white rounded-xl border border-[#DEDFE3] p-6">
            <ReportRisks
              epicRisks={epicRisks}
              overbookedMembers={overbookedMembers}
            />
          </section>

          {/* Capacity by Process Team */}
          <section className="bg-white rounded-xl border border-[#DEDFE3] p-6">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-4">
              Capacity by Process Team
            </h2>
            <ProcessTeamCapacityTable summaries={processTeamSummaries} />
          </section>
        </div>
      )}
    </div>
  );
}
