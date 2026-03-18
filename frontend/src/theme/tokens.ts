/**
 * Design tokens — single source of truth for the Mileway Capacity Planner.
 *
 * Design language: Mileway brand palette —
 *  Light Blue (#0089DD) primary, Dark Blue (#003565) surfaces, Cool Grey (#6C7A89) neutral.
 */

// ── Background palette ────────────────────────────────────────────────────────

export const Background = {
  /** Off-white page background */
  primary:     '#F5F8FC',
  /** Cool grey 10% tint for secondary surfaces */
  secondary:   '#EEEEF1',
  /** Pure white card / modal surfaces */
  card:        '#FFFFFF',
  /** Light blue 10% tint for highlight panels */
  highlight:   '#E6F2FC',
  /** Dark blue 10% tint for alternate panels */
  highlightAlt:'#E6EAF0',
} as const

// ── Text palette ──────────────────────────────────────────────────────────────

export const Text = {
  primary:   '#003565',
  secondary: '#6C7A89',
  tertiary:  '#B5BDC4',
  inverse:   '#FFFFFF',
} as const

// ── Accent palette ────────────────────────────────────────────────────────────

export const Accent = {
  blue:        '#0089DD',
  blueLight:   '#E6F2FC',
  orange:      '#D97706',
  orangeLight: '#FEF3C7',
  coral:       '#DC2626',
  green:       '#16A34A',
  red:         '#DC2626',
  // legacy aliases — kept for files that still import Accent.teal
  teal:        '#0089DD',
  tealLight:   '#E6F2FC',
} as const

// ── Border palette ────────────────────────────────────────────────────────────

export const Border = {
  subtle: '#CFCFD5',
  light:  '#DEDFE3',
} as const

// ── BIZ (business contact) track — cool grey family (no purple) ───────────────

export const Biz = {
  DEFAULT:   '#6C7A89',
  light:     '#EEEEF1',
  mid:       '#DEDFE3',
  border:    '#CFCFD5',
  hover:     '#B5BDC4',
} as const

// ── Semantic colours ──────────────────────────────────────────────────────────

export const Semantic = {
  success:       '#16A34A',
  successBg:     '#DCFCE7',
  successBorder: '#A7F3D0',
  warning:       '#D97706',
  warningBg:     '#FEF3C7',
  warningBorder: '#FDE68A',
  danger:        '#DC2626',
  dangerBg:      '#FEE2E2',
  dangerBorder:  '#FECACA',
  info:          '#0089DD',
  infoBg:        '#E6F2FC',
  infoBorder:    '#B3D9F5',
} as const

// ── Heatmap cell tier colours ─────────────────────────────────────────────────
// Used in Dashboard heatmap and getCellClass() utility.
// These are SEMANTIC — do not restyle to match brand.

export const HeatmapTiers = {
  empty:     { bg: '#F5F8FC',                    text: '#B5BDC4' },
  tier1:     { bg: 'rgba(74,181,100,0.15)',       text: '#003565' },
  tier2:     { bg: 'rgba(74,181,100,0.35)',       text: '#003565' },
  tier3:     { bg: 'rgba(255,210,60,0.35)',       text: '#003565' },
  tier4:     { bg: 'rgba(255,175,40,0.45)',       text: '#003565' },
  tier5:     { bg: 'rgba(255,130,50,0.45)',       text: '#003565' },
  tier6:     { bg: 'rgba(220,80,50,0.40)',        text: '#003565' },
  overloaded:{ bg: 'rgba(220,53,69,0.25)',        text: '#8B0000', borderLeft: '#DC2626' },
} as const

// ── Gantt bar colour palette ───────────────────────────────────────────────────
// Consumed by JiraGantt.tsx BAR map.

export const GanttBar = {
  epic:     { bg: 'rgba(0,137,221,0.10)', border: '#0089DD', borderW: 2,   radius: '6px' },
  feature:  { bg: '#CCE4F9',             border: '#0089DD', borderW: 1,   radius: '5px' },
  story:    { bg: '#DEDFE3',             border: '#B5BDC4', borderW: 1,   radius: '4px' },
  task:     { bg: '#DEDFE3',             border: '#B5BDC4', borderW: 1,   radius: '4px' },
  bug:      { bg: '#FEE2E2',             border: '#DC2626', borderW: 1,   radius: '4px' },
  uat:      { bg: '#CCD3DC',             border: '#6C7A89', borderW: 1,   radius: '4px' },
  hypercare:{ bg: '#B3D9F5',             border: '#0089DD', borderW: 1,   radius: '5px' },
  custom:   { bg: '#EEEEF1',             border: '#CFCFD5', borderW: 1,   radius: '5px' },
} as const

// ── Border radius ─────────────────────────────────────────────────────────────

export const Radius = {
  sm:   '8px',
  md:   '12px',
  lg:   '16px',
  xl:   '20px',
  card: '16px',
  full: '9999px',
} as const

// ── Animation durations ───────────────────────────────────────────────────────

export const Duration = {
  micro:    0,    // instant
  fast:     150,  // colour / icon swap
  standard: 250,  // panel slide, modal
  slow:     400,  // drawer, bottom sheet
  shimmer:  1500, // skeleton loop
} as const

// ── Shadows (CSS box-shadow strings) ─────────────────────────────────────────

export const Shadow = {
  sm:  '0 1px 3px rgba(0, 0, 0, 0.04)',
  md:  '0 4px 12px rgba(0, 0, 0, 0.06)',
  lg:  '0 8px 24px rgba(0, 0, 0, 0.08)',
  xl:  '0 16px 48px rgba(0, 0, 0, 0.10)',
} as const

// ── Minimum tap / click target ────────────────────────────────────────────────

export const MIN_TAP_TARGET = 44 // px

// ── Row hover ────────────────────────────────────────────────────────────────

export const RowHover = {
  light: 'rgba(0, 137, 221, 0.06)',
  dark:  'rgba(0, 137, 221, 0.10)',
  blue:  Accent.blue,
  // legacy alias
  teal:  Accent.blue,
} as const

// ── Chart colours ─────────────────────────────────────────────────────────────

export const ChartColors = {
  primary:   '#0089DD',  // light blue — primary series
  secondary: '#003565',  // dark blue — secondary series
  tertiary:  '#6C7A89',  // cool grey — tertiary series
  muted:     '#CFCFD5',  // cool grey 30% — empty/placeholder
} as const

// ── Legacy aliases (kept for gradual migration in component files) ─────────────

/** @deprecated Use Background, Text, Accent, Border directly */
export const Brand = {
  primary:      Accent.blue,
  primaryLight: Accent.blueLight,
  primaryMid:   Accent.blue,
  primaryHover: '#0077C2',
  dark:         Text.primary,
  darkHover:    '#002550',
  biz:          Biz.DEFAULT,
  bizLight:     Biz.light,
  bizMid:       Biz.mid,
  bizBorder:    Biz.border,
  bizHover:     Biz.hover,
} as const

/** @deprecated No longer used — dark mode removed */
export const DarkSurface = {} as const

/** @deprecated Use Semantic directly */
export const Neutral = {
  grey:        Text.secondary,
  greyLight:   Border.subtle,
  greyLighter: Background.secondary,
} as const
