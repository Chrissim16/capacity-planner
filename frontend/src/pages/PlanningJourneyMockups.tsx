import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  FileChartColumnIncreasing,
  Filter,
  FolderKanban,
  Gauge,
  GitCompareArrows,
  GitFork,
  LayoutPanelTop,
  Layers3,
  PanelRightOpen,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRoundCog,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import './PlanningJourneyMockups.css';

type MockScenario = 'baseline' | 'vendor' | 'replace';

interface ScenarioPillProps {
  label: string;
  active?: boolean;
}

function ScenarioPill({ label, active = false }: ScenarioPillProps) {
  return (
    <button
      type="button"
      className={[
        'pjm-scenario-pill',
        active ? 'active' : '',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  note: string;
  trend?: 'up' | 'down' | 'flat';
}

function MetricCard({ label, value, note, trend = 'flat' }: MetricCardProps) {
  return (
    <div className="pjm-metric-card">
      <div className="pjm-metric-top">
        <span>{label}</span>
        {trend === 'up' && <TrendingUp size={14} />}
        {trend === 'down' && <TrendingDown size={14} />}
        {trend === 'flat' && <CircleDashed size={14} />}
      </div>
      <div className="pjm-metric-value">{value}</div>
      <div className="pjm-metric-note">{note}</div>
    </div>
  );
}

interface MockHeaderProps {
  title: string;
  subtitle: string;
  scenario?: MockScenario;
  primaryAction: string;
  rightBadge?: string;
}

function MockHeader({ title, subtitle, scenario = 'vendor', primaryAction, rightBadge }: MockHeaderProps) {
  return (
    <div className="pjm-header-shell">
      <div className="pjm-header-copy">
        <div className="pjm-eyebrow">Planning Lens</div>
        <div className="pjm-header-title-row">
          <h2>{title}</h2>
          {rightBadge ? <span className="pjm-small-badge">{rightBadge}</span> : null}
        </div>
        <p>{subtitle}</p>
      </div>

      <div className="pjm-header-actions">
        <div className="pjm-scenario-switcher">
          <ScenarioPill label="Baseline" active={scenario === 'baseline'} />
          <ScenarioPill label="Outsource Build" active={scenario === 'vendor'} />
          <ScenarioPill label="Replace Alex" active={scenario === 'replace'} />
          <button type="button" className="pjm-icon-pill">
            <GitFork size={14} />
            New Scenario
          </button>
          <button type="button" className="pjm-icon-pill ghost">
            <GitCompareArrows size={14} />
            Compare
          </button>
        </div>

        <div className="pjm-toolbar-row">
          <div className="pjm-segmented">
            <button type="button" className="active">Q3</button>
            <button type="button">Q4</button>
            <button type="button">Q1</button>
          </div>
          <div className="pjm-save-pill">
            <CheckCircle2 size={14} />
            Saved
          </div>
          <button type="button" className="pjm-primary-btn">
            {primaryAction}
          </button>
        </div>
      </div>
    </div>
  );
}

function BrowserFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="pjm-browser">
      <div className="pjm-browser-bar">
        <div className="pjm-browser-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="pjm-browser-label">{label}</div>
        <div className="pjm-browser-chip">Mockup</div>
      </div>
      <div className="pjm-browser-body">{children}</div>
    </div>
  );
}

function PortfolioMockup() {
  return (
    <BrowserFrame label="Portfolio Planning">
      <MockHeader
        title="Portfolio Planning"
        subtitle="Compare staffing options, phase effort, and cost before committing delivery work."
        primaryAction="Add Epics"
        scenario="vendor"
        rightBadge="Cost-first decision lens"
      />

      <div className="pjm-banner">
        <div className="pjm-banner-copy">
          <Sparkles size={16} />
          <span>Scenario impact: outsourcing the Build phase removes 1 overload and adds EUR 148k total cost.</span>
        </div>
        <button type="button">
          View delta
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="pjm-metrics-grid">
        <MetricCard label="Labor" value="EUR 1.42M" note="+EUR 96k vs baseline" trend="up" />
        <MetricCard label="Direct Costs" value="EUR 214k" note="Shared baseline spend" />
        <MetricCard label="Total" value="EUR 1.63M" note="+10.2% total impact" trend="up" />
        <MetricCard label="Capacity Risk" value="2 hotspots" note="-1 overloaded squad" trend="down" />
      </div>

      <div className="pjm-screen-grid portfolio">
        <div className="pjm-panel">
          <div className="pjm-panel-head">
            <div>
              <h3>Initiatives In Scope</h3>
              <p>Decision-oriented epic plan with phases, staffing mix, and quick cost visibility.</p>
            </div>
            <div className="pjm-pill-row">
              <span className="pjm-filter-pill active">On board</span>
              <span className="pjm-filter-pill">High cost delta</span>
              <span className="pjm-filter-pill">Uses vendor</span>
            </div>
          </div>

          <div className="pjm-epic-stack">
            <div className="pjm-epic-card featured">
              <div className="pjm-epic-row">
                <div>
                  <div className="pjm-epic-title">FIN-241 Treasury Modernisation</div>
                  <div className="pjm-epic-sub">Replace internal build capacity with vendor squad during Build.</div>
                </div>
                <div className="pjm-cost-chip">EUR 412k</div>
              </div>
              <div className="pjm-phase-strip">
                <span className="design">Design</span>
                <span className="build">Build</span>
                <span className="test">Test</span>
                <span className="deploy">Deploy</span>
              </div>
              <div className="pjm-assignee-row">
                <span className="pjm-actor-chip internal">Alex</span>
                <span className="pjm-actor-chip internal">Priya</span>
                <span className="pjm-actor-chip vendor">Vendor: Core Delivery</span>
                <span className="pjm-actor-chip business">BIZ Team: Finance Ops</span>
              </div>
            </div>

            <div className="pjm-epic-card">
              <div className="pjm-epic-row">
                <div>
                  <div className="pjm-epic-title">FIN-255 Cash Forecast Automation</div>
                  <div className="pjm-epic-sub">Scenario compares replacing one senior engineer with an external specialist.</div>
                </div>
                <div className="pjm-cost-chip muted">EUR 268k</div>
              </div>
              <div className="pjm-phase-strip compact">
                <span className="design">Design</span>
                <span className="build">Build</span>
                <span className="test">Test</span>
              </div>
            </div>

            <div className="pjm-epic-card">
              <div className="pjm-epic-row">
                <div>
                  <div className="pjm-epic-title">FIN-263 Invoice Risk Controls</div>
                  <div className="pjm-epic-sub">Lightweight internal delivery, no vendor needed in current scenario.</div>
                </div>
                <div className="pjm-cost-chip muted">EUR 94k</div>
              </div>
              <div className="pjm-phase-strip compact">
                <span className="design">Design</span>
                <span className="build">Build</span>
                <span className="deploy">Deploy</span>
              </div>
            </div>
          </div>

          <div className="pjm-table-card">
            <div className="pjm-table-head">
              <h4>Cost by Initiative</h4>
              <span>Read baseline and scenario delta side-by-side.</span>
            </div>
            <table className="pjm-table">
              <thead>
                <tr>
                  <th>Epic</th>
                  <th>Labor</th>
                  <th>Direct</th>
                  <th>Total</th>
                  <th>Delta</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Treasury Modernisation</td>
                  <td>EUR 338k</td>
                  <td>EUR 74k</td>
                  <td>EUR 412k</td>
                  <td className="up">+EUR 58k</td>
                </tr>
                <tr>
                  <td>Cash Forecast Automation</td>
                  <td>EUR 246k</td>
                  <td>EUR 22k</td>
                  <td>EUR 268k</td>
                  <td className="up">+EUR 14k</td>
                </tr>
                <tr>
                  <td>Invoice Risk Controls</td>
                  <td>EUR 82k</td>
                  <td>EUR 12k</td>
                  <td>EUR 94k</td>
                  <td className="down">-EUR 6k</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <aside className="pjm-drawer">
          <div className="pjm-drawer-head">
            <div>
              <span className="pjm-eyebrow">Cost Drawer</span>
              <h3>Treasury Modernisation</h3>
            </div>
            <div className="pjm-drawer-total">EUR 412k</div>
          </div>

          <div className="pjm-drawer-kpis">
            <div>
              <span>Delta vs baseline</span>
              <strong>+EUR 58k</strong>
            </div>
            <div>
              <span>Contingency</span>
              <strong>12%</strong>
            </div>
          </div>

          <div className="pjm-drawer-block">
            <h4>Labor Breakdown</h4>
            <div className="pjm-line-item">
              <span>Internal IT</span>
              <strong>EUR 144k</strong>
            </div>
            <div className="pjm-line-item">
              <span>External vendor</span>
              <strong>EUR 126k</strong>
            </div>
            <div className="pjm-line-item">
              <span>Business effort</span>
              <strong>EUR 68k</strong>
            </div>
          </div>

          <div className="pjm-drawer-block">
            <h4>Scenario Notes</h4>
            <ul className="pjm-notes-list">
              <li>Vendor placeholder used only during Build to reduce Treasury overload.</li>
              <li>Business team remains shared and read-only in scenario direct cost mode.</li>
              <li>Direct costs stay inherited from baseline for this scenario.</li>
            </ul>
          </div>
        </aside>
      </div>
    </BrowserFrame>
  );
}

function DeliveryPlanningMockup() {
  return (
    <BrowserFrame label="Delivery Planning">
      <MockHeader
        title="Delivery Planning"
        subtitle="Plan feature and story delivery capacity after Jira breakdown and approval."
        primaryAction="Import Jira Breakdown"
        scenario="replace"
        rightBadge="Post-approval capacity lens"
      />

      <div className="pjm-banner">
        <div className="pjm-banner-copy">
          <Sparkles size={16} />
          <span>Jira breakdown imported: 3 epics, 9 features, 26 user stories now available for delivery planning.</span>
        </div>
        <button type="button">
          Review imports
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="pjm-filter-bar">
        <div className="pjm-filter-group">
          <span className="pjm-filter-pill active">All epics</span>
          <span className="pjm-filter-pill">On portfolio board</span>
          <span className="pjm-filter-pill">In current plan</span>
          <span className="pjm-filter-pill">Has Jira breakdown</span>
          <span className="pjm-filter-pill">Missing breakdown</span>
          <span className="pjm-filter-pill">Unscheduled</span>
          <span className="pjm-filter-pill warning">Staffing risk</span>
          <span className="pjm-filter-pill">Uses external or vendor</span>
        </div>
        <div className="pjm-search-pill">
          <Filter size={14} />
          Search epics, features, stories, owners
        </div>
      </div>

      <div className="pjm-screen-grid delivery">
        <div className="pjm-rail">
          <div className="pjm-rail-head">
            <h3>Backlog</h3>
            <span>7 unscheduled</span>
          </div>
          <div className="pjm-backlog-card">
            <div className="pjm-mini-title">FIN-241</div>
            <p>Treasury Modernisation</p>
            <span className="risk">Vendor mix</span>
          </div>
          <div className="pjm-backlog-card">
            <div className="pjm-mini-title">FIN-255</div>
            <p>Cash Forecast Automation</p>
            <span>Needs assignee</span>
          </div>
          <div className="pjm-backlog-card">
            <div className="pjm-mini-title">FIN-263</div>
            <p>Invoice Risk Controls</p>
            <span>Ready to schedule</span>
          </div>
        </div>

        <div className="pjm-panel timeline-panel">
          <div className="pjm-panel-head">
            <div>
              <h3>Imported Delivery Breakdown</h3>
              <p>Capacity planning happens on imported features and stories, with both IT and business assignments.</p>
            </div>
            <div className="pjm-pill-row">
              <span className="pjm-filter-pill active">Timeline</span>
              <span className="pjm-filter-pill">Summary</span>
            </div>
          </div>

          <div className="pjm-timeline">
            <div className="pjm-timeline-header">
              <span>Epic / Feature / Story</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
              <span>Oct</span>
            </div>

            <div className="pjm-timeline-row">
              <div className="pjm-row-label">
                <strong>FIN-241 Treasury Modernisation</strong>
                <span>Approved epic with Jira breakdown imported</span>
              </div>
              <div className="pjm-bar vendor" style={{ gridColumn: '2 / span 2' }}>Epic window</div>
            </div>

            <div className="pjm-timeline-row">
              <div className="pjm-row-label">
                <strong>Feature: Payment routing</strong>
                <span>IT: Vendor squad · BIZ: Finance Ops</span>
              </div>
              <div className="pjm-bar build" style={{ gridColumn: '2 / span 2' }}>Feature delivery</div>
            </div>

            <div className="pjm-timeline-row">
              <div className="pjm-row-label">
                <strong>Story: Validate settlement rules</strong>
                <span>IT owner missing · BIZ owner assigned</span>
              </div>
              <div className="pjm-bar internal" style={{ gridColumn: '3 / span 1' }}>Story slot</div>
            </div>

            <div className="pjm-timeline-row ghost">
              <div className="pjm-row-label">
                <strong>FIN-255 Cash Forecast Automation</strong>
                <span>Visible, but still missing Jira feature/story breakdown</span>
              </div>
            </div>
          </div>

          <div className="pjm-table-card">
            <div className="pjm-table-head">
              <h4>Delivery Assignment Coverage</h4>
              <span>Jira-derived work enriched with business and capacity planning fields.</span>
            </div>
            <table className="pjm-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>IT owner</th>
                  <th>Business owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Payment routing</td>
                  <td>Feature</td>
                  <td>Vendor squad</td>
                  <td>Finance Ops</td>
                  <td>Planned</td>
                </tr>
                <tr>
                  <td>Validate settlement rules</td>
                  <td>Story</td>
                  <td className="up">Missing</td>
                  <td>Maria</td>
                  <td className="up">Needs owner</td>
                </tr>
                <tr>
                  <td>Exception handling updates</td>
                  <td>Story</td>
                  <td>Priya</td>
                  <td className="up">Missing</td>
                  <td className="up">Needs BIZ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pjm-risk-strip">
            <div className="pjm-risk-card">
              <ShieldAlert size={16} />
              <span>2 stories still miss either IT or business ownership after Jira import.</span>
            </div>
            <div className="pjm-risk-card positive">
              <CheckCircle2 size={16} />
              <span>Replacement scenario clears the previous Alex overload at feature level.</span>
            </div>
          </div>
        </div>

        <aside className="pjm-side-summary">
          <div className="pjm-summary-card">
            <span className="pjm-eyebrow">Scenario Summary</span>
            <h3>Replace Alex</h3>
            <div className="pjm-summary-metric">
              <span>Imported features</span>
              <strong>9</strong>
            </div>
            <div className="pjm-summary-metric">
              <span>User stories</span>
              <strong>26</strong>
            </div>
            <div className="pjm-summary-metric">
              <span>Capacity hotspots</span>
              <strong>2</strong>
            </div>
            <div className="pjm-summary-metric">
              <span>Items missing owners</span>
              <strong>4</strong>
            </div>
          </div>

          <div className="pjm-summary-card soft">
            <span className="pjm-eyebrow">Recommended Actions</span>
            <ul className="pjm-notes-list">
              <li>Keep Treasury on vendor-supported build path.</li>
              <li>Assign a business owner to exception-handling stories before sprint planning.</li>
              <li>Request Jira breakdown for Cash Forecast before moving it into active delivery planning.</li>
            </ul>
          </div>
        </aside>
      </div>
    </BrowserFrame>
  );
}

function DeliveryTrackingMockup() {
  return (
    <BrowserFrame label="Delivery Tracking">
      <div className="pjm-header-shell compact">
        <div className="pjm-header-copy">
          <div className="pjm-eyebrow">Reality Lens</div>
          <div className="pjm-header-title-row">
            <h2>Delivery Tracking</h2>
            <span className="pjm-small-badge">Read-mostly</span>
          </div>
          <p>Read Jira status, hierarchy, and actual delivery progress.</p>
        </div>

        <div className="pjm-header-actions">
          <div className="pjm-toolbar-row">
            <div className="pjm-save-pill neutral">
              <Clock3 size={14} />
              Last sync 09:42
            </div>
            <button type="button" className="pjm-icon-pill ghost">
              <RefreshCw size={14} />
              Sync Jira
            </button>
          </div>
        </div>
      </div>

      <div className="pjm-tracking-topline">
        <MetricCard label="In Progress" value="14" note="Across all tracked epics" />
        <MetricCard label="At Risk" value="3" note="Status or date drift detected" trend="up" />
        <MetricCard label="Done This Quarter" value="9" note="Shipped and closed in Jira" trend="down" />
        <MetricCard label="Plan Drift" value="+12d" note="Across tracked work" trend="up" />
      </div>

      <div className="pjm-screen-grid tracking">
        <div className="pjm-panel">
          <div className="pjm-panel-head">
            <div>
              <h3>Jira Hierarchy</h3>
              <p>Clean, calm, and operational. No scenario switching. No planning-heavy controls.</p>
            </div>
            <div className="pjm-pill-row">
              <span className="pjm-filter-pill active">All statuses</span>
              <span className="pjm-filter-pill">At risk</span>
              <span className="pjm-filter-pill">Done</span>
            </div>
          </div>

          <table className="pjm-table tracking-table">
            <thead>
              <tr>
                <th>Epic / Feature</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Plan vs actual</th>
                <th>Jira</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="pjm-hierarchy-title">
                    <FolderKanban size={14} />
                    FIN-241 Treasury Modernisation
                  </div>
                </td>
                <td><span className="pjm-status-chip in-progress">In progress</span></td>
                <td>Alex / Vendor</td>
                <td className="up">+6d drift</td>
                <td className="link">Open</td>
              </tr>
              <tr>
                <td>
                  <div className="pjm-hierarchy-title child">
                    <ChevronRight size={14} />
                    Feature: Payment routing
                  </div>
                </td>
                <td><span className="pjm-status-chip todo">To do</span></td>
                <td>Vendor squad</td>
                <td>On plan</td>
                <td className="link">Open</td>
              </tr>
              <tr>
                <td>
                  <div className="pjm-hierarchy-title">
                    <FolderKanban size={14} />
                    FIN-263 Invoice Risk Controls
                  </div>
                </td>
                <td><span className="pjm-status-chip done">Done</span></td>
                <td>Priya</td>
                <td className="down">-2d gain</td>
                <td className="link">Open</td>
              </tr>
            </tbody>
          </table>
        </div>

        <aside className="pjm-side-summary">
          <div className="pjm-summary-card">
            <span className="pjm-eyebrow">Tracking Focus</span>
            <h3>What changed recently</h3>
            <div className="pjm-activity-item">
              <Gauge size={15} />
              <span>Treasury Modernisation moved from on-plan to at-risk.</span>
            </div>
            <div className="pjm-activity-item">
              <CalendarRange size={15} />
              <span>Cash Forecast test window shifted by 1 sprint.</span>
            </div>
            <div className="pjm-activity-item">
              <FileChartColumnIncreasing size={15} />
              <span>Invoice Risk Controls closed 2 days ahead of plan.</span>
            </div>
          </div>

          <div className="pjm-summary-card soft">
            <span className="pjm-eyebrow">Why this screen is calmer</span>
            <ul className="pjm-notes-list">
              <li>No scenario controls.</li>
              <li>No staffing editing.</li>
              <li>No direct-cost editing.</li>
              <li>Only reality, drift, and Jira hierarchy.</li>
            </ul>
          </div>
        </aside>
      </div>
    </BrowserFrame>
  );
}

export function PlanningJourneyMockups() {
  return (
    <div className="pjm-page">
      <section className="pjm-hero">
        <div className="pjm-hero-copy">
          <div className="pjm-kicker">Future-State Mockups</div>
          <h1>Portfolio, Delivery, and Tracking as one coherent planning journey.</h1>
          <p>
            These screens visualize the new product model: Portfolio Planning as the cost-and-staffing decision
            lens, Delivery Planning as the post-approval Jira-breakdown capacity lens, and Delivery Tracking as the calm Jira reality lens.
          </p>
        </div>

        <div className="pjm-hero-cards">
          <div className="pjm-hero-card">
            <BadgeDollarSign size={18} />
            <strong>Cost-led decisions</strong>
            <span>Outsource and replace-person scenarios are clearest in Portfolio Planning before detailed Jira breakdown exists.</span>
          </div>
          <div className="pjm-hero-card">
            <Layers3 size={18} />
            <strong>Inline scenarios</strong>
            <span>One scenario model, visible the same way across Portfolio and Delivery.</span>
          </div>
          <div className="pjm-hero-card">
            <LayoutPanelTop size={18} />
            <strong>Shared shell</strong>
            <span>Common page structure, clearer purpose, and less fragile UI behavior.</span>
          </div>
        </div>
      </section>

      <nav className="pjm-anchor-nav">
        <a href="#portfolio-mockup">
          <BriefcaseBusiness size={15} />
          Portfolio Planning
        </a>
        <a href="#delivery-mockup">
          <Users size={15} />
          Delivery Planning
        </a>
        <a href="#tracking-mockup">
          <Building2 size={15} />
          Delivery Tracking
        </a>
      </nav>

      <section id="portfolio-mockup" className="pjm-section">
        <div className="pjm-section-copy">
          <div className="pjm-section-title">
            <BriefcaseBusiness size={18} />
            <h2>Portfolio Planning Mockup</h2>
          </div>
          <p>
            The main decision cockpit. Epics on the portfolio board, scenario delta banner, visible staffing mix,
            and cost shown as a first-class consequence of internal vs external choices while the work is still planned by phases.
          </p>
        </div>
        <PortfolioMockup />
      </section>

      <section id="delivery-mockup" className="pjm-section">
        <div className="pjm-section-copy">
          <div className="pjm-section-title">
            <UserRoundCog size={18} />
            <h2>Delivery Planning Mockup</h2>
          </div>
          <p>
            Post-approval planning based on imported Jira features and stories. Portfolio inclusion becomes a filter,
            not a gate, and the screen adds the capacity and business-assignment layer Jira does not handle well.
          </p>
        </div>
        <DeliveryPlanningMockup />
      </section>

      <section id="tracking-mockup" className="pjm-section">
        <div className="pjm-section-copy">
          <div className="pjm-section-title">
            <PanelRightOpen size={18} />
            <h2>Delivery Tracking Mockup</h2>
          </div>
          <p>
            A calmer reality lens for Jira actuals. No scenario mode, no heavy planning controls, just delivery
            hierarchy, drift, sync, and recent change signals.
          </p>
        </div>
        <DeliveryTrackingMockup />
      </section>

      <section className="pjm-footer-note">
        <div className="pjm-footer-grid">
          <div>
            <h3>Mockup goals</h3>
            <p>Clarify hierarchy, naming, and cross-screen consistency before implementation begins.</p>
          </div>
          <div>
            <h3>Not final behavior</h3>
            <p>These are static visual comps. They are meant to guide implementation, not represent finished flows.</p>
          </div>
          <div>
            <h3>Aligned with</h3>
            <p>The planning journey handover and the Portfolio-first costing spec already in `docs/plans`.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
