/**
 * Design tokens — single source of truth for the Mileway Capacity Planner.
 *
 * Rules:
 *  - All colour, radius, shadow, spacing, and duration values live here.
 *  - Tailwind config imports from here where possible.
 *  - JS-side logic (Gantt bar colours, heatmap cells) must reference these
 *    constants instead of embedding literals.
 *  - Never hardcode a hex value in a component or screen file.
 */

// ── Brand palette ────────────────────────────────────────────────────────────

export const Brand = {
  /** Mileway primary blue */
  primary:        '#0089DD',
  primaryLight:   '#E8F4FB',
  primaryMid:     '#4AADEA',
  primaryHover:   '#0078C4',
  /** Mileway deep navy — sidebar background */
  dark:           '#003E65',
  darkHover:      '#002D4A',
  /** BIZ (business contact) purple */
  biz:            '#7C3AED',
  bizLight:       '#F5F3FF',
  bizMid:         '#EDE9FE',
  bizBorder:      '#C4B5FD',
  bizHover:       '#6D28D9',
} as const

// ── Neutral greys ────────────────────────────────────────────────────────────

export const Neutral = {
  grey:         '#6C7A89',
  greyLight:    '#E2ECF5',
  greyLighter:  '#F5F8FC',
} as const

// ── Dark-mode surface tokens ─────────────────────────────────────────────────
// These are the exact hex values used for elevated surfaces in dark mode.
// Added to tailwind.config.js so components can use Tailwind classes instead
// of inline hex literals.

export const DarkSurface = {
  card:           '#132133',   // Card background
  cardBorder:     '#1E3550',   // Card / CardHeader border
  muted:          '#1A2D45',   // Badge / muted surface
  mutedBorder:    '#2A4A6B',   // Badge / muted border
  mutedText:      '#8BA8BF',   // Muted text on dark
  primaryText:    '#8DD0F5',   // Primary-tinted text on dark
  scrollbarHover: '#3A5B7B',   // Scrollbar thumb hover
} as const

// ── Semantic colours ─────────────────────────────────────────────────────────

export const Semantic = {
  success:        '#059669',
  successBg:      '#ECFDF5',
  successBorder:  '#A7F3D0',
  warning:        '#D97706',
  warningBg:      '#FFFBEB',
  warningBorder:  '#FDE68A',
  danger:         '#DC2626',
  dangerBg:       '#FFF5F5',
  dangerBorder:   '#FECACA',
  info:           '#0089DD',
  infoBg:         '#E8F4FB',
  infoBorder:     '#BAE0F7',
} as const

// ── Heatmap cell tier colours ────────────────────────────────────────────────
// Used in Dashboard heatmap and getCellClass() utility.

export const HeatmapTiers = {
  empty:     { bg: '#FFFFFF',                    text: '#94a3b8', darkText: '#555555' },
  tier1:     { bg: 'rgba(74,181,100,0.15)',       text: '#1A1A1A', darkText: '#E8E8E8' },
  tier2:     { bg: 'rgba(74,181,100,0.35)',       text: '#1A1A1A', darkText: '#E8E8E8' },
  tier3:     { bg: 'rgba(255,210,60,0.35)',       text: '#1A1A1A', darkText: '#E8E8E8' },
  tier4:     { bg: 'rgba(255,175,40,0.45)',       text: '#1A1A1A', darkText: '#E8E8E8' },
  tier5:     { bg: 'rgba(255,130,50,0.45)',       text: '#1A1A1A', darkText: '#E8E8E8' },
  tier6:     { bg: 'rgba(220,80,50,0.40)',        text: '#1A1A1A', darkText: '#E8E8E8' },
  overloaded:{ bg: 'rgba(220,53,69,0.25)',        text: '#8B0000', darkText: '#FF6B6B', borderLeft: '#DC3545' },
} as const

// ── Gantt bar colour palette ──────────────────────────────────────────────────
// Consumed by JiraGantt.tsx BAR map instead of inline literals.

export const GanttBar = {
  epic:     { bg: '#DBEAFE', border: '#60A5FA', borderW: 1.5, radius: '6px' },
  feature:  { bg: '#EDE9FE', border: '#A78BFA', borderW: 1,   radius: '5px' },
  story:    { bg: '#DCFCE7', border: '#4ADE80', borderW: 1,   radius: '4px' },
  task:     { bg: '#FEF9C3', border: '#FACC15', borderW: 1,   radius: '4px' },
  bug:      { bg: '#FFE4E6', border: '#F87171', borderW: 1,   radius: '4px' },
  uat:      { bg: '#EDE9FE', border: Brand.biz, borderW: 1.5, radius: '5px' },
  hypercare:{ bg: '#F3E8FF', border: '#A855F7', borderW: 1,   radius: '5px' },
  custom:   { bg: '#FFF7ED', border: '#FB923C', borderW: 1,   radius: '5px' },
} as const

// ── Border radius ─────────────────────────────────────────────────────────────

export const Radius = {
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  card: '10px',
  full: '9999px',
} as const

// ── Animation durations ───────────────────────────────────────────────────────

export const Duration = {
  micro:    0,    // instant
  fast:     150,  // colour / icon swap
  standard: 200,  // panel slide, modal
  slow:     300,  // drawer, bottom sheet
  shimmer:  1500, // skeleton loop
} as const

// ── Shadows (CSS box-shadow strings) ─────────────────────────────────────────

export const Shadow = {
  sm:  '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
  md:  '0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
  lg:  '0 12px 40px rgba(0,0,0,0.14), 0 4px 8px rgba(0,0,0,0.08)',
  xl:  '0 24px 64px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.08)',
} as const

// ── Minimum tap / click target ────────────────────────────────────────────────

export const MIN_TAP_TARGET = 44 // px

// ── Row hover (wide-screen readability) ───────────────────────────────────────

export const RowHover = {
  light: `rgba(0,137,221,0.055)`,
  dark:  `rgba(0,137,221,0.08)`,
  blue:  Brand.primary,
  blueDark: '#38b6f5',
} as const
