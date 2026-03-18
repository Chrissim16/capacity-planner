/**
 * Design tokens — single source of truth for the Mileway Capacity Planner.
 *
 * Design language: three colours — #0089DD (blue), #1E293B (text), #94A3B8 (grey).
 */

// ── Background palette ────────────────────────────────────────────────────────

export const Background = {
  /** Off-white page background */
  primary:     '#F5F8FC',
  /** Grey 10% tint for secondary surfaces and BIZ sections */
  secondary:   '#F0F2F5',
  /** Pure white card / modal surfaces */
  card:        '#FFFFFF',
  /** Blue 10% tint for highlight panels and IT sections */
  highlight:   '#E6F2FC',
  /** Grey 10% tint for alternate panels */
  highlightAlt:'#F0F2F5',
} as const

// ── Text palette ──────────────────────────────────────────────────────────────

export const Text = {
  primary:   '#1E293B',
  secondary: '#94A3B8',
  tertiary:  '#94A3B8',
  inverse:   '#FFFFFF',
} as const

// ── Accent palette ────────────────────────────────────────────────────────────

export const Accent = {
  blue:        '#0089DD',
  blueLight:   '#E6F2FC',
  blueMid:     '#CCE4F9',
  orange:      '#D97706',
  orangeLight: '#FEF9C3',
  green:       '#16A34A',
  red:         '#DC2626',
  // legacy aliases — kept for files that still import Accent.teal
  teal:        '#0089DD',
  tealLight:   '#E6F2FC',
  coral:       '#DC2626',
} as const

// ── Border palette ────────────────────────────────────────────────────────────

export const Border = {
  default: '#DEDFE3',
  subtle:  '#F0F2F5',
  // legacy alias
  light:   '#DEDFE3',
} as const

// ── BIZ (business contact) track — grey tint family ──────────────────────────

export const Biz = {
  DEFAULT:   '#94A3B8',
  light:     '#F0F2F5',
  mid:       '#DEDFE3',
  border:    '#DEDFE3',
  hover:     '#94A3B8',
} as const

// ── Semantic colours ──────────────────────────────────────────────────────────

export const Semantic = {
  success:       '#16A34A',
  successBg:     '#DCFCE7',
  successBorder: '#A7F3D0',
  warning:       '#D97706',
  warningBg:     '#FEF9C3',
  warningBorder: '#FDE68A',
  danger:        '#DC2626',
  dangerBg:      '#FEE2E2',
  dangerBorder:  '#FECACA',
  info:          '#0089DD',
  infoBg:        '#E6F2FC',
  infoBorder:    '#CCE4F9',
} as const

// ── Heatmap cell tier colours ─────────────────────────────────────────────────

export const HeatmapTiers = {
  empty:     { bg: '#F5F8FC',                    text: '#94A3B8' },
  tier1:     { bg: 'rgba(74,181,100,0.15)',       text: '#1E293B' },
  tier2:     { bg: 'rgba(74,181,100,0.35)',       text: '#1E293B' },
  tier3:     { bg: 'rgba(255,210,60,0.35)',       text: '#1E293B' },
  tier4:     { bg: 'rgba(255,175,40,0.45)',       text: '#1E293B' },
  tier5:     { bg: 'rgba(255,130,50,0.45)',       text: '#1E293B' },
  tier6:     { bg: 'rgba(220,80,50,0.40)',        text: '#1E293B' },
  overloaded:{ bg: 'rgba(220,53,69,0.25)',        text: '#8B0000', borderLeft: '#DC2626' },
} as const

// ── Gantt bar colour palette ───────────────────────────────────────────────────

export const GanttBar = {
  epic:     { bg: 'rgba(0,137,221,0.10)', border: '#0089DD', borderW: 2, radius: '6px' },
  feature:  { bg: '#CCE4F9',             border: '#0089DD', borderW: 1, radius: '5px' },
  story:    { bg: '#F0F2F5',             border: '#DEDFE3', borderW: 1, radius: '4px' },
  task:     { bg: '#F0F2F5',             border: '#DEDFE3', borderW: 1, radius: '4px' },
  bug:      { bg: '#FEE2E2',             border: '#DC2626', borderW: 1, radius: '4px' },
  uat:      { bg: '#E6F2FC',             border: '#94A3B8', borderW: 1, radius: '4px' },
  hypercare:{ bg: '#CCE4F9',             border: '#0089DD', borderW: 1, radius: '5px' },
  custom:   { bg: '#F0F2F5',             border: '#DEDFE3', borderW: 1, radius: '5px' },
} as const

// ── Border radius ─────────────────────────────────────────────────────────────

export const Radius = {
  sm:   '6px',
  md:   '8px',
  lg:   '10px',
  xl:   '12px',
  card: '10px',
  full: '9999px',
} as const

// ── Animation durations ───────────────────────────────────────────────────────

export const Duration = {
  micro:    0,
  fast:     150,
  standard: 250,
  slow:     400,
  shimmer:  1500,
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
  teal:  Accent.blue,
} as const

// ── Chart colours ─────────────────────────────────────────────────────────────

export const ChartColors = {
  primary:   '#0089DD',
  secondary: '#1E293B',
  tertiary:  '#94A3B8',
  muted:     '#DEDFE3',
} as const

// ── Legacy aliases ────────────────────────────────────────────────────────────

/** @deprecated Use Background, Text, Accent, Border directly */
export const Brand = {
  primary:      Accent.blue,
  primaryLight: Accent.blueLight,
  primaryMid:   Accent.blue,
  primaryHover: '#0077C2',
  dark:         Text.primary,
  darkHover:    '#0F172A',
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
  greyLight:   Border.default,
  greyLighter: Background.secondary,
} as const
