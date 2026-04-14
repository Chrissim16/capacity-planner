import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PortfolioHealthSummary } from '../../utils/portfolioPlanExport';
import { getPlannedDaysBucketLabel } from '../../utils/planningGroups';
import type {
  CostReportRow,
  EpicEffortReportRow,
  PersonEpicReportRow,
  TeamEpicReportRow,
} from '../../utils/portfolioReportAggregators';
import { normalizeSegmentsForPdf } from '../../utils/portfolioReportChartModels';

const C = {
  text: '#1E293B',
  muted: '#64748B',
  border: '#DEDFE3',
  borderSubtle: '#F0F2F5',
  blue: '#0089DD',
  blueBg: '#E6F2FC',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.text,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
  },
  meta: {
    fontSize: 8,
    color: C.muted,
    marginTop: 3,
  },
  pill: {
    backgroundColor: C.blueBg,
    color: C.blue,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 7,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 6,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kpi: {
    width: '23%',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    padding: 6,
  },
  kpiLabel: { fontSize: 6, color: C.muted, marginBottom: 2 },
  kpiValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  thRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 3,
    marginBottom: 3,
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    paddingVertical: 3,
  },
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase' },
  td: { fontSize: 7, color: C.text },
  col1: { flex: 2.2, paddingRight: 6 },
  colN: { flex: 0.85, textAlign: 'right' as const },
  note: { fontSize: 7, color: C.muted, marginTop: 6, fontStyle: 'italic' },
  mixTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  mixBar: {
    flexDirection: 'row' as const,
    height: 12,
    borderRadius: 3,
    overflow: 'hidden' as const,
    marginBottom: 2,
  },
  mixSeg: { height: '100%' as const },
  mixKeyRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginTop: 4 },
  mixKey: { fontSize: 6, color: C.muted },
});

export interface StructuredBriefingSections {
  executive: boolean;
  costs: boolean;
  epicEffort: boolean;
  appendixPerson: boolean;
  appendixProcessTeam: boolean;
}

/** Mirrors in-app Portfolio Overview dashboard KPIs + two mix bars (static, for executive page). */
export interface ExecutiveDashboardSnapshot {
  totalPeriodDays: number;
  epicsWithEffortCount: number;
  totalPortfolioCost: number;
  missingRateSlots: number;
  bucketSegments: { name: string; value: number }[];
  costComposition: { name: string; value: number }[];
}

export interface StructuredPortfolioReportPDFProps {
  planName: string;
  quarterLabel: string;
  exportedAt: string;
  currency: string;
  health: PortfolioHealthSummary;
  sections: StructuredBriefingSections;
  costTotals: {
    totalLabor: number;
    totalDirect: number;
    totalContingency: number;
    totalCost: number;
    missingRateSlots: number;
  };
  costRows: CostReportRow[];
  epicEffortRows: EpicEffortReportRow[];
  personRows: PersonEpicReportRow[];
  processTeamRows: TeamEpicReportRow[];
  /** When set and executive section is on, renders overview-style mix bars below health KPIs. */
  executiveDashboard?: ExecutiveDashboardSnapshot | null;
}

const MAX_APPENDIX = 55;

const MIX_DAY_COLORS = [C.blue, '#16A34A', C.muted, '#D97706'];
const MIX_COST_COLORS = [C.blue, C.muted, '#16A34A', '#D97706'];

function fmtMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

function fmtDays(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${Math.round(value * 100)}%`;
}

function MixBarPdf({
  title,
  segments,
  colors,
  formatValue,
}: {
  title: string;
  segments: { name: string; value: number }[];
  colors: string[];
  formatValue: (v: number) => string;
}) {
  const norm = normalizeSegmentsForPdf(segments);
  if (norm.length === 0) {
    return (
      <View>
        <Text style={s.mixTitle}>{title}</Text>
        <Text style={s.note}>No data</Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={s.mixTitle}>{title}</Text>
      <View style={s.mixBar}>
        {norm.map((seg, i) => (
          <View
            key={`${seg.name}-${i}`}
            style={[
              s.mixSeg,
              {
                width: `${Math.max(0.5, seg.pct * 100)}%`,
                backgroundColor: colors[i % colors.length],
              },
            ]}
          />
        ))}
      </View>
      <View style={s.mixKeyRow}>
        {norm.map((seg, i) => (
          <Text key={`${seg.name}-k-${i}`} style={s.mixKey}>
            {seg.name}: {formatValue(seg.value)}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function StructuredPortfolioReportPDF({
  planName,
  quarterLabel,
  exportedAt,
  currency,
  health,
  sections,
  costTotals,
  costRows,
  epicEffortRows,
  personRows,
  processTeamRows,
  executiveDashboard,
}: StructuredPortfolioReportPDFProps) {
  return (
    <Document title={`Portfolio briefing - ${planName} - ${quarterLabel}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Structured portfolio briefing</Text>
            <Text style={s.meta}>Plan: {planName}</Text>
            <Text style={s.meta}>Period: {quarterLabel}</Text>
            <Text style={s.meta}>Generated: {exportedAt}</Text>
          </View>
          <Text style={s.pill}>{quarterLabel}</Text>
        </View>

        {sections.executive ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Executive summary</Text>
            <View style={s.divider} />
            <View style={s.kpiRow}>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Planned / available days</Text>
                <Text style={s.kpiValue}>
                  {health.totalPlannedDays} / {health.totalAvailableDays}
                </Text>
                <Text style={s.kpiLabel}>{formatPercent(health.portfolioUtilization)} utilized</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Epics on board</Text>
                <Text style={s.kpiValue}>{health.epicCount}</Text>
                <Text style={s.kpiLabel}>{health.unstaffedEpicCount} unstaffed</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>People at risk</Text>
                <Text style={s.kpiValue}>{health.peopleAtRiskCount}</Text>
                <Text style={s.kpiLabel}>{health.overCapacityPeopleCount} over cap.</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Missing phase dates</Text>
                <Text style={s.kpiValue}>{health.missingPhaseDateCount}</Text>
                <Text style={s.kpiLabel}>Assigned phases</Text>
              </View>
            </View>

            {executiveDashboard ? (
              <View style={{ marginTop: 10 }}>
                <View style={s.kpiRow}>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Period planned days</Text>
                    <Text style={s.kpiValue}>{fmtDays(executiveDashboard.totalPeriodDays)}</Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Epics with effort</Text>
                    <Text style={s.kpiValue}>{String(executiveDashboard.epicsWithEffortCount)}</Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Portfolio cost</Text>
                    <Text style={s.kpiValue}>{fmtMoney(executiveDashboard.totalPortfolioCost, currency)}</Text>
                  </View>
                  <View style={s.kpi}>
                    <Text style={s.kpiLabel}>Missing rate slots</Text>
                    <Text style={s.kpiValue}>{String(executiveDashboard.missingRateSlots)}</Text>
                  </View>
                </View>
                <MixBarPdf
                  title="Planned days mix (by staffing bucket)"
                  segments={executiveDashboard.bucketSegments}
                  colors={MIX_DAY_COLORS}
                  formatValue={(v) =>
                    `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })} d`
                  }
                />
                <MixBarPdf
                  title="Cost mix (portfolio)"
                  segments={executiveDashboard.costComposition}
                  colors={MIX_COST_COLORS}
                  formatValue={(v) => fmtMoney(v, currency)}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {sections.costs ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Cost overview ({currency})</Text>
            <View style={s.divider} />
            <View style={s.kpiRow}>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Total portfolio</Text>
                <Text style={s.kpiValue}>{fmtMoney(costTotals.totalCost, currency)}</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Labor</Text>
                <Text style={s.kpiValue}>{fmtMoney(costTotals.totalLabor, currency)}</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Direct (HW + licenses)</Text>
                <Text style={s.kpiValue}>{fmtMoney(costTotals.totalDirect, currency)}</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Contingency</Text>
                <Text style={s.kpiValue}>{fmtMoney(costTotals.totalContingency, currency)}</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiLabel}>Rate gaps (slots)</Text>
                <Text style={s.kpiValue}>{String(costTotals.missingRateSlots)}</Text>
              </View>
            </View>
            <View style={s.thRow}>
              <Text style={[s.th, s.col1]}>Epic</Text>
              <Text style={[s.th, s.colN]}>IT</Text>
              <Text style={[s.th, s.colN]}>BIZ</Text>
              <Text style={[s.th, s.colN]}>Direct</Text>
              <Text style={[s.th, s.colN]}>Total</Text>
            </View>
            {costRows.slice(0, 18).map((r) => (
              <View key={r.initiativeId} style={s.tr} wrap={false}>
                <Text style={[s.td, s.col1]}>{r.initiativeId}</Text>
                <Text style={[s.td, s.colN]}>{fmtMoney(r.itLaborCost, currency)}</Text>
                <Text style={[s.td, s.colN]}>{fmtMoney(r.bizLaborCost, currency)}</Text>
                <Text style={[s.td, s.colN]}>{fmtMoney(r.directCost, currency)}</Text>
                <Text style={[s.td, s.colN]}>{fmtMoney(r.totalCost, currency)}</Text>
              </View>
            ))}
            {costRows.length > 18 ? (
              <Text style={s.note}>Epic cost table truncated ({costRows.length} epics). Open the app for the full Costs lens.</Text>
            ) : null}
          </View>
        ) : null}

        {sections.epicEffort ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Effort by epic (period days × bucket)</Text>
            <View style={s.divider} />
            <View style={s.thRow}>
              <Text style={[s.th, s.col1]}>Epic</Text>
              <Text style={[s.th, s.colN]}>Σ</Text>
              <Text style={[s.th, s.colN]}>IT</Text>
              <Text style={[s.th, s.colN]}>Biz</Text>
              <Text style={[s.th, s.colN]}>Oth IT</Text>
              <Text style={[s.th, s.colN]}>Ext</Text>
            </View>
            {epicEffortRows.slice(0, 16).map((r) => (
              <View key={r.epicKey} style={s.tr} wrap={false}>
                <Text style={[s.td, s.col1]}>{r.epicKey}</Text>
                <Text style={[s.td, s.colN]}>{fmtDays(r.totalVisibleDays)}</Text>
                <Text style={[s.td, s.colN]}>{fmtDays(r.bucketDays.it_team_members)}</Text>
                <Text style={[s.td, s.colN]}>{fmtDays(r.bucketDays.business_owners_and_teams)}</Text>
                <Text style={[s.td, s.colN]}>{fmtDays(r.bucketDays.other_it_teams)}</Text>
                <Text style={[s.td, s.colN]}>{fmtDays(r.bucketDays.external_partners)}</Text>
              </View>
            ))}
            <Text style={s.note}>
              IT = {getPlannedDaysBucketLabel('it_team_members')}; Biz = {getPlannedDaysBucketLabel('business_owners_and_teams')}; Oth IT = {getPlannedDaysBucketLabel('other_it_teams')}; Ext = {getPlannedDaysBucketLabel('external_partners')}.
            </Text>
          </View>
        ) : null}
      </Page>

      {(sections.appendixPerson || sections.appendixProcessTeam) ? (
        <Page size="A4" style={s.page}>
          <Text style={s.title}>Appendix</Text>
          <Text style={s.meta}>Detailed tables (truncated when long)</Text>

          {sections.appendixPerson ? (
            <View style={[s.section, { marginTop: 12 }]}>
              <Text style={s.sectionTitle}>By person × epic</Text>
              <View style={s.divider} />
              <View style={s.thRow}>
                <Text style={[s.th, { flex: 1.1, paddingRight: 4 }]}>Person</Text>
                <Text style={[s.th, { flex: 1.3, paddingRight: 4 }]}>Epic</Text>
                <Text style={[s.th, s.colN]}>Days</Text>
                <Text style={[s.th, s.colN]}>IT</Text>
                <Text style={[s.th, s.colN]}>BIZ</Text>
              </View>
              {personRows.slice(0, MAX_APPENDIX).map((r) => (
                <View key={`${r.actorId}-${r.epicKey}`} style={s.tr} wrap={false}>
                  <Text style={[s.td, { flex: 1.1, paddingRight: 4 }]}>{r.actorName}</Text>
                  <Text style={[s.td, { flex: 1.3, paddingRight: 4 }]}>{r.epicKey}</Text>
                  <Text style={[s.td, s.colN]}>{fmtDays(r.totalVisibleDays)}</Text>
                  <Text style={[s.td, s.colN]}>{fmtDays(r.itDays)}</Text>
                  <Text style={[s.td, s.colN]}>{fmtDays(r.bizDays)}</Text>
                </View>
              ))}
              {personRows.length > MAX_APPENDIX ? (
                <Text style={s.note}>Showing first {MAX_APPENDIX} of {personRows.length} rows.</Text>
              ) : null}
            </View>
          ) : null}

          {sections.appendixProcessTeam ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>By process team × epic</Text>
              <View style={s.divider} />
              <View style={s.thRow}>
                <Text style={[s.th, { flex: 1.1, paddingRight: 4 }]}>Team</Text>
                <Text style={[s.th, { flex: 1.3, paddingRight: 4 }]}>Epic</Text>
                <Text style={[s.th, s.colN]}>Days</Text>
                <Text style={[s.th, s.colN]}>IT</Text>
                <Text style={[s.th, s.colN]}>BIZ</Text>
              </View>
              {processTeamRows.slice(0, MAX_APPENDIX).map((r) => (
                <View key={`${r.teamId}-${r.epicKey}`} style={s.tr} wrap={false}>
                  <Text style={[s.td, { flex: 1.1, paddingRight: 4 }]}>{r.teamLabel}</Text>
                  <Text style={[s.td, { flex: 1.3, paddingRight: 4 }]}>{r.epicKey}</Text>
                  <Text style={[s.td, s.colN]}>{fmtDays(r.totalVisibleDays)}</Text>
                  <Text style={[s.td, s.colN]}>{fmtDays(r.itDays)}</Text>
                  <Text style={[s.td, s.colN]}>{fmtDays(r.bizDays)}</Text>
                </View>
              ))}
              {processTeamRows.length > MAX_APPENDIX ? (
                <Text style={s.note}>Showing first {MAX_APPENDIX} of {processTeamRows.length} rows.</Text>
              ) : null}
            </View>
          ) : null}
        </Page>
      ) : null}
    </Document>
  );
}
