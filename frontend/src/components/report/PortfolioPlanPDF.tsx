import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type {
  ExportEpicDetail,
  ExportRiskRow,
  ExportTeamCapacityRow,
  PortfolioHealthSummary,
} from '../../utils/portfolioPlanExport';

export interface PortfolioPlanPDFProps {
  planName: string;
  quarterLabel: string;
  exportedAt: string;
  health: PortfolioHealthSummary;
  epics: ExportEpicDetail[];
  risks: ExportRiskRow[];
  teamCapacityRows: ExportTeamCapacityRow[];
}

const C = {
  text: '#1E293B',
  muted: '#64748B',
  border: '#DEDFE3',
  borderSubtle: '#F0F2F5',
  blue: '#0089DD',
  blueBg: '#E6F2FC',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  amber: '#B45309',
  amberBg: '#FEF3C7',
  red: '#DC2626',
  redBg: '#FEE2E2',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  meta: {
    fontSize: 9,
    color: C.muted,
    marginTop: 4,
  },
  pill: {
    backgroundColor: C.blueBg,
    color: C.blue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    fontSize: 8,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 10,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  kpiCard: {
    width: '24%',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  kpiLabel: {
    fontSize: 8,
    color: C.muted,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  kpiNote: {
    fontSize: 8,
    color: C.muted,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 5,
    marginBottom: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    paddingVertical: 5,
  },
  th: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 8,
    color: C.text,
  },
  colEpic: { flex: 2.4, paddingRight: 8 },
  colPhase: { flex: 1.1, paddingRight: 8 },
  colDate: { flex: 1.4, paddingRight: 8 },
  colDays: { flex: 0.8, textAlign: 'right' },
  colStatus: { flex: 1.5, paddingLeft: 8 },
  colTeam: { flex: 1.8, paddingRight: 8 },
  colUtil: { flex: 0.9, textAlign: 'right' },
  riskRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  riskBadge: {
    width: 44,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskTextWrap: {
    flex: 1,
  },
  riskTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  riskDetail: {
    fontSize: 8,
    color: C.muted,
  },
  epicBlock: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  epicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  epicTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
  },
  epicMeta: {
    fontSize: 8,
    color: C.muted,
    marginBottom: 6,
  },
  phaseBlock: {
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
    paddingTop: 6,
    marginTop: 6,
  },
  phaseTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  phaseMeta: {
    fontSize: 8,
    color: C.muted,
    marginBottom: 3,
  },
  assignmentText: {
    fontSize: 8,
    color: C.text,
    marginBottom: 2,
  },
});

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${Math.round(value * 100)}%`;
}

function riskBadgeStyle(severity: 'High' | 'Medium') {
  return severity === 'High'
    ? { ...s.riskBadge, backgroundColor: C.redBg, color: C.red }
    : { ...s.riskBadge, backgroundColor: C.amberBg, color: C.amber };
}

export function PortfolioPlanPDF({
  planName,
  quarterLabel,
  exportedAt,
  health,
  epics,
  risks,
  teamCapacityRows,
}: PortfolioPlanPDFProps) {
  const topEpics = [...epics]
    .sort((left, right) => right.totalDays - left.totalDays || left.epic.jiraKey.localeCompare(right.epic.jiraKey))
    .slice(0, 12);

  return (
    <Document title={`Portfolio Plan - ${planName} - ${quarterLabel}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Portfolio Plan Summary</Text>
            <Text style={s.meta}>Plan: {planName}</Text>
            <Text style={s.meta}>Period: {quarterLabel}</Text>
            <Text style={s.meta}>Generated: {exportedAt}</Text>
          </View>
          <Text style={s.pill}>{quarterLabel}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Portfolio Health</Text>
          <View style={s.divider} />
          <View style={s.kpiGrid}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Planned vs available</Text>
              <Text style={s.kpiValue}>{health.totalPlannedDays} / {health.totalAvailableDays}d</Text>
              <Text style={s.kpiNote}>{formatPercent(health.portfolioUtilization)} utilized</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>People at risk</Text>
              <Text style={s.kpiValue}>{health.peopleAtRiskCount}</Text>
              <Text style={s.kpiNote}>{health.overCapacityPeopleCount} over, {health.nearCapacityPeopleCount} near</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Unstaffed epics</Text>
              <Text style={s.kpiValue}>{health.unstaffedEpicCount}</Text>
              <Text style={s.kpiNote}>{health.epicCount} epics on the board</Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Missing phase dates</Text>
              <Text style={s.kpiValue}>{health.missingPhaseDateCount}</Text>
              <Text style={s.kpiNote}>Assigned phases without dates</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Top Epic Plan</Text>
          <View style={s.divider} />
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colEpic]}>Epic</Text>
            <Text style={[s.th, s.colPhase]}>Phases</Text>
            <Text style={[s.th, s.colDays]}>Days</Text>
            <Text style={[s.th, s.colDays]}>Visible</Text>
            <Text style={[s.th, s.colStatus]}>Status</Text>
          </View>
          {topEpics.map((epic) => (
            <View key={epic.epic.jiraKey} style={s.tableRow}>
              <Text style={[s.td, s.colEpic]}>{epic.epic.jiraKey} - {epic.epic.summary}</Text>
              <Text style={[s.td, s.colPhase]}>{epic.phaseCount}</Text>
              <Text style={[s.td, s.colDays]}>{epic.totalDays}</Text>
              <Text style={[s.td, s.colDays]}>{epic.visibleDays}</Text>
              <Text style={[s.td, s.colStatus]}>{epic.statusNotes.join('; ') || 'On track'}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Risks</Text>
          <View style={s.divider} />
          {risks.length === 0 ? (
            <Text style={s.td}>No active portfolio risks found for this period.</Text>
          ) : risks.slice(0, 10).map((risk) => (
            <View key={`${risk.type}-${risk.item}-${risk.issue}`} style={s.riskRow}>
              <Text style={riskBadgeStyle(risk.severity)}>{risk.severity}</Text>
              <View style={s.riskTextWrap}>
                <Text style={s.riskTitle}>{risk.type}: {risk.item} - {risk.issue}</Text>
                <Text style={s.riskDetail}>{risk.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Capacity by Team</Text>
          <View style={s.divider} />
          <View style={s.tableHeader}>
            <Text style={[s.th, s.colTeam]}>Team</Text>
            <Text style={[s.th, s.colDays]}>Planned</Text>
            <Text style={[s.th, s.colDays]}>Available</Text>
            <Text style={[s.th, s.colUtil]}>Util</Text>
          </View>
          {teamCapacityRows.map((row) => (
            <View key={row.name} style={s.tableRow}>
              <Text style={[s.td, s.colTeam]}>{row.name}</Text>
              <Text style={[s.td, s.colDays]}>{row.plannedDays}</Text>
              <Text style={[s.td, s.colDays]}>{row.availableDays}</Text>
              <Text style={[s.td, s.colUtil]}>{formatPercent(row.utilization)}</Text>
            </View>
          ))}
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Epic Detail</Text>
          <View style={s.divider} />
          {topEpics.map((epic) => (
            <View key={epic.epic.jiraKey} style={s.epicBlock} wrap={false}>
              <View style={s.epicHeader}>
                <Text style={s.epicTitle}>{epic.epic.jiraKey} - {epic.epic.summary}</Text>
                <Text style={s.td}>{epic.totalDays}d total</Text>
              </View>
              {epic.description && <Text style={s.epicMeta}>{epic.description}</Text>}
              <Text style={s.epicMeta}>IT {epic.itDays}d / BIZ {epic.bizDays}d{epic.statusNotes.length ? ` - ${epic.statusNotes.join('; ')}` : ''}</Text>
              {epic.phases.map((phase) => (
                <View key={`${epic.epic.jiraKey}-${phase.phaseLabel}`} style={s.phaseBlock}>
                  <Text style={s.phaseTitle}>{phase.phaseLabel}</Text>
                  <Text style={s.phaseMeta}>
                    {phase.dateLabel || 'No dates set'} - {phase.totalDays}d total / {phase.visibleDays}d in period
                  </Text>
                  {phase.description && <Text style={s.phaseMeta}>{phase.description}</Text>}
                  {phase.assignments.length === 0 ? (
                    <Text style={s.assignmentText}>No staffing assigned.</Text>
                  ) : phase.assignments.map((assignment) => (
                    <Text key={`${phase.phaseLabel}-${assignment.actor.id}-${assignment.track}`} style={s.assignmentText}>
                      {assignment.actor.name} ({assignment.track}) - {assignment.allocation} - {assignment.totalDays}d total / {assignment.visibleDays}d in period
                      {assignment.statusNotes.length ? ` - ${assignment.statusNotes.join('; ')}` : ''}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
