import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { PlannerItem, JiraWorkItem, TeamMember, Sprint } from '../../types';
import type { EpicRisk } from '../../utils/reportRisks';
import type { OverbookedMember } from './ReportRisks';
import type { GroupCapacitySummary } from '../../utils/capacity';
import { computeEpicBarGeometry } from './ReportGantt';

export interface ProcessTeamRow {
  id: string;
  name: string;
  data: GroupCapacitySummary;
}

export interface ReportPDFProps {
  scenarioName: string;
  quarter: string;
  plannerItems: PlannerItem[];
  jiraItems: JiraWorkItem[];
  teamMembers: TeamMember[];
  sprints: Sprint[];
  ganttQuarters: string[];
  epicRisks: EpicRisk[];
  overbookedMembers: OverbookedMember[];
  processTeamSummaries: ProcessTeamRow[];
}

// ── Colours (match design tokens) ────────────────────────────────────────────

const C = {
  text:       '#1E293B',
  textMuted:  '#94A3B8',
  blue:       '#0089DD',
  blueBg:     '#E6F2FC',
  border:     '#DEDFE3',
  borderSubtle: '#F0F2F5',
  green:      '#16A34A',
  greenBg:    '#DCFCE7',
  amber:      '#D97706',
  amberBg:    '#FEF3C7',
  red:        '#DC2626',
  barBg:      'rgba(0,137,221,0.10)',
  barBorder:  '#0089DD',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
  },

  // Header
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  reportTitle:  { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.text },
  reportMeta:   { fontSize: 8, color: C.textMuted, marginTop: 3 },
  reportRight:  { alignItems: 'flex-end' },
  pillBlue:     { backgroundColor: C.blueBg, color: C.blue, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 8 },

  // Section
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  divider:      { borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 16 },
  section:      { marginBottom: 24 },

  // Gantt
  ganttRow:     { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.borderSubtle, paddingVertical: 4, minHeight: 22 },
  ganttLabel:   { width: 160, fontSize: 8, color: C.text, paddingRight: 8 },
  ganttTrack:   { flex: 1, height: 14, position: 'relative' },
  ganttBar:     { position: 'absolute', top: 0, bottom: 0, backgroundColor: C.barBg, borderWidth: 1, borderColor: C.barBorder, borderRadius: 3 },
  ganttNoStaff: { fontSize: 7, color: C.amber, paddingHorizontal: 3, paddingTop: 1 },
  quarterHeader:{ flexDirection: 'row', marginBottom: 4 },
  quarterLabel: { flex: 1, fontSize: 7, color: C.textMuted, textAlign: 'center' },

  // Status badge
  badgeActive:  { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: C.greenBg,  color: C.green,  marginRight: 4 },
  badgeAtRisk:  { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: '#FEE2E2',  color: C.red,    marginRight: 4 },
  badgeDone:    { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: C.borderSubtle, color: C.textMuted, marginRight: 4 },
  badgePlanned: { fontSize: 7, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: C.blueBg, color: C.blue,   marginRight: 4 },

  // Risks
  riskRow:      { flexDirection: 'row', gap: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  riskDot:      { width: 8, fontSize: 9 },
  riskText:     { flex: 1, fontSize: 8, color: C.text },
  riskMeta:     { fontSize: 7, color: C.textMuted },
  noRisksText:  { fontSize: 8, color: C.green },

  // Table
  tableRow:     { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderSubtle, paddingVertical: 4 },
  tableHeader:  { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 4 },
  tableHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.textMuted, textTransform: 'uppercase' },
  tableCell:    { fontSize: 8, color: C.text },
  col1:         { flex: 2 },
  col2:         { flex: 1, textAlign: 'right' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function epicStatus(item: PlannerItem, jiraByKey: Map<string, JiraWorkItem>): 'Active' | 'At Risk' | 'Done' | 'Planned' {
  const jira = item.jiraKey ? jiraByKey.get(item.jiraKey) : undefined;
  if (jira?.statusCategory === 'done') return 'Done';
  if (item.assignees.length === 0) return 'At Risk';
  if (jira?.statusCategory === 'in_progress') return 'Active';
  return 'Planned';
}

function StatusBadge({ status }: { status: 'Active' | 'At Risk' | 'Done' | 'Planned' }) {
  const style = status === 'Active' ? s.badgeActive
    : status === 'At Risk' ? s.badgeAtRisk
    : status === 'Done' ? s.badgeDone
    : s.badgePlanned;
  return <Text style={style}>{status}</Text>;
}

// ── Document ─────────────────────────────────────────────────────────────────

export function ReportPDF({
  scenarioName,
  quarter,
  plannerItems,
  jiraItems,
  teamMembers,
  sprints,
  ganttQuarters,
  epicRisks,
  overbookedMembers,
  processTeamSummaries,
}: ReportPDFProps) {
  const jiraByKey = new Map<string, JiraWorkItem>();
  for (const w of jiraItems) jiraByKey.set(w.jiraKey, w);

  const memberById = new Map<string, TeamMember>();
  for (const m of teamMembers) memberById.set(m.id, m);

  const epics = plannerItems.filter(item => item.type === 'epic');
  const totalRisks = overbookedMembers.length + epicRisks.length;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Gantt track width in PDF points (total page width minus label column and margins)
  // Page landscape width = 841.89; margins = 80; label col = 160 → track ≈ 601
  const TRACK_WIDTH = 601;

  return (
    <Document title={`Capacity Report — ${quarter}`}>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ── Report header ── */}
        <View style={s.reportHeader}>
          <View>
            <Text style={s.reportTitle}>Executive Report</Text>
            <Text style={s.reportMeta}>Scenario: {scenarioName}  ·  Quarter: {quarter}  ·  Generated: {today}</Text>
          </View>
          <View style={s.reportRight}>
            <Text style={s.pillBlue}>{quarter}</Text>
          </View>
        </View>

        {/* ── Delivery Timeline ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Delivery Timeline</Text>
          <View style={s.divider} />

          {/* Quarter labels */}
          <View style={{ flexDirection: 'row', marginLeft: 160, marginBottom: 6 }}>
            {ganttQuarters.map(q => (
              <Text key={q} style={{ ...s.quarterLabel }}>{q}</Text>
            ))}
          </View>

          {epics.length === 0 ? (
            <Text style={{ fontSize: 8, color: C.textMuted, fontStyle: 'italic' }}>No epics in this scenario.</Text>
          ) : epics.map(item => {
            const status = epicStatus(item, jiraByKey);
            const geo = computeEpicBarGeometry(item, sprints, ganttQuarters);
            const noStaff = item.assignees.length === 0;

            return (
              <View key={item.id} style={s.ganttRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', width: 160 }}>
                  <StatusBadge status={status} />
                  <Text style={{ fontSize: 8, flex: 1 }} numberOfLines={1}>{item.name}</Text>
                </View>

                <View style={s.ganttTrack}>
                  {geo && (
                    <View
                      style={{
                        ...s.ganttBar,
                        left: (geo.leftPct / 100) * TRACK_WIDTH,
                        width: Math.max(4, (geo.widthPct / 100) * TRACK_WIDTH),
                      }}
                    >
                      {noStaff && <Text style={s.ganttNoStaff}>⚠ no staff</Text>}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Capacity Risks ── */}
        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={s.sectionTitle}>Capacity Risks</Text>
            <Text style={{ fontSize: 8, color: totalRisks > 0 ? C.amber : C.green }}>
              {totalRisks > 0 ? `${totalRisks} risk${totalRisks !== 1 ? 's' : ''} flagged` : 'No risks'}
            </Text>
          </View>
          <View style={s.divider} />

          {totalRisks === 0 ? (
            <Text style={s.noRisksText}>✓ No capacity risks detected for this quarter.</Text>
          ) : (
            <>
              {overbookedMembers.map(({ member, usedPercent, quarter: q }) => (
                <View key={`over-${member.id}`} style={s.riskRow}>
                  <Text style={s.riskDot}>🔴</Text>
                  <Text style={s.riskText}>
                    {member.name} — overbooked {usedPercent}%
                    {'  '}<Text style={s.riskMeta}>in {q}</Text>
                  </Text>
                </View>
              ))}
              {epicRisks.map(risk => (
                <View key={`${risk.type}-${risk.epicKey}`} style={s.riskRow}>
                  <Text style={s.riskDot}>🟠</Text>
                  <Text style={s.riskText}>
                    {risk.type === 'no-staff'
                      ? `${risk.epicName} — no team members assigned`
                      : `${risk.epicName} — ${risk.assignedDays}d assigned vs ${risk.storyPoints} story points`}
                    {'  '}<Text style={s.riskMeta}>{risk.epicKey}</Text>
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── Capacity by Process Team ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Capacity by Process Team</Text>
          <View style={s.divider} />

          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, s.col1]}>Team</Text>
            <Text style={[s.tableHeaderCell, s.col2]}>Available</Text>
            <Text style={[s.tableHeaderCell, s.col2]}>Allocated</Text>
            <Text style={[s.tableHeaderCell, s.col2]}>Utilisation</Text>
          </View>

          {processTeamSummaries.map(({ id, name, data }) => {
            const isNa = data.totalDays === 0;
            const pct = isNa ? null : Math.round(data.utilization * 100);
            return (
              <View key={id} style={s.tableRow}>
                <Text style={[s.tableCell, s.col1]}>{name}</Text>
                <Text style={[s.tableCell, s.col2]}>{isNa ? '—' : `${data.availableDays}d`}</Text>
                <Text style={[s.tableCell, s.col2]}>{isNa ? '—' : `${data.usedDays}d`}</Text>
                <Text style={[s.tableCell, s.col2, { color: isNa ? C.textMuted : pct! >= 100 ? C.red : pct! > 80 ? C.amber : C.text }]}>
                  {isNa ? 'N/A' : `${pct}%`}
                </Text>
              </View>
            );
          })}
        </View>

      </Page>
    </Document>
  );
}
