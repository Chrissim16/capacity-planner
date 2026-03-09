/**
 * Design tokens — single source of truth for the Mileway Capacity Planner.
 *
 * Rules:
 *  - All colour, radius, shadow, spacing, and duration values live here.
 *  - Tailwind config imports from here where possible.
 *  - JS-side logic (Gantt bar colours, heatmap cells) must reference these
 *    constants instead of embedding literals.
 *  - Never hardcode a hex value in a component or screen file.
 *
 * Design language: Sana Labs "editorial calm" —
 *  warm off-white backgrounds, serif headings, teal/orange accents, no blue primary.
 */

// ── Background palette ────────────────────────────────────────────────────────

export const Background = {
  /** Warm off-white page background */
  primary:     '#FAF9F7',
  /** Slightly deeper warm off-white for secondary surfaces */
  secondary:   '#F5F3F0',
  /** Pure white card / modal surfaces */
  card:        '#FFFFFF',
  /** Teal tint for highlight panels */
  highlight:   '#E8F8F8',
  /** Warm orange tint for alert panels */
  highlightAlt:'#FFF7ED',
} as const

// ── Text palette ──────────────────────────────────────────────────────────────

export const Text = {
  primary:   '#1A1A1A',
  secondary: '#6B7280',
  tertiary:  '#9CA3AF',
  inverse:   '#FFFFFF',
} as const

// ── Accent palette ────────────────────────────────────────────────────────────

export const Accent = {
  teal:         '#0ED3CF',
  tealLight:    '#CCFBF1',
  orange:       '#F97316',
  orangeLight:  '#FED7AA',
  coral:        '#FB7185',
  magenta:      '#D946EF',
  green:        '#22C55E',
  red:          '#EF4444',
} as const

// ── Border palette ────────────────────────────────────────────────────────────

export const Border = {
  subtle: '#E5E5E3',
  light:  '#F0EFED',
} as const

// ── BIZ (business contact) track — kept for dual IT/BIZ data model ────────────

export const Biz = {
  DEFAULT:   '#7C3AED',
  light:     '#F5F3FF',
  mid:       '#EDE9FE',
  border:    '#C4B5FD',
  hover:     '#6D28D9',
} as const

// ── Semantic colours ──────────────────────────────────────────────────────────

export const Semantic = {
  success:       '#22C55E',
  successBg:     '#DCFCE7',
  successBorder: '#A7F3D0',
  warning:       '#F97316',
  warningBg:     '#FFF7ED',
  warningBorder: '#FED7AA',
  danger:        '#EF4444',
  dangerBg:      '#FFF5F5',
  dangerBorder:  '#FECACA',
  info:          '#0ED3CF',
  infoBg:        '#E8F8F8',
  infoBorder:    '#99F6E4',
} as const

// ── Heatmap cell tier colours ─────────────────────────────────────────────────
// Used in Dashboard heatmap and getCellClass() utility.
// These are SEMANTIC — do not restyle to match brand.

export const HeatmapTiers = {
  empty:     { bg: '#FAF9F7',                    text: '#94a3b8' },
  tier1:     { bg: 'rgba(74,181,100,0.15)',       text: '#1A1A1A' },
  tier2:     { bg: 'rgba(74,181,100,0.35)',       text: '#1A1A1A' },
  tier3:     { bg: 'rgba(255,210,60,0.35)',       text: '#1A1A1A' },
  tier4:     { bg: 'rgba(255,175,40,0.45)',       text: '#1A1A1A' },
  tier5:     { bg: 'rgba(255,130,50,0.45)',       text: '#1A1A1A' },
  tier6:     { bg: 'rgba(220,80,50,0.40)',        text: '#1A1A1A' },
  overloaded:{ bg: 'rgba(220,53,69,0.25)',        text: '#8B0000', borderLeft: '#DC3545' },
} as const

// ── Gantt bar colour palette ───────────────────────────────────────────────────
// Consumed by JiraGantt.tsx BAR map — SEMANTIC, do not restyle.

export const GanttBar = {
  epic:     { bg: '#DBEAFE', border: '#60A5FA', borderW: 1.5, radius: '6px' },
  feature:  { bg: '#EDE9FE', border: '#A78BFA', borderW: 1,   radius: '5px' },
  story:    { bg: '#DCFCE7', border: '#4ADE80', borderW: 1,   radius: '4px' },
  task:     { bg: '#FEF9C3', border: '#FACC15', borderW: 1,   radius: '4px' },
  bug:      { bg: '#FFE4E6', border: '#F87171', borderW: 1,   radius: '4px' },
  uat:      { bg: '#EDE9FE', border: Biz.DEFAULT, borderW: 1.5, radius: '5px' },
  hypercare:{ bg: '#F3E8FF', border: '#A855F7', borderW: 1,   radius: '5px' },
  custom:   { bg: '#FFF7ED', border: '#FB923C', borderW: 1,   radius: '5px' },
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
  light: 'rgba(14, 211, 207, 0.06)',
  dark:  'rgba(14, 211, 207, 0.10)',
  teal:  Accent.teal,
} as const

// ── Chart colours ─────────────────────────────────────────────────────────────

export const ChartColors = {
  primary:   '#F97316',  // orange — primary series
  secondary: '#D946EF',  // magenta — secondary series
  tertiary:  '#0ED3CF',  // teal — tertiary series
  muted:     '#D1D5DB',  // grey — empty/placeholder
} as const

// ── Legacy aliases (kept for gradual migration in component files) ─────────────
// Components still referencing Brand.* will continue to work.

/** @deprecated Use Background, Text, Accent, Border directly */
export const Brand = {
  primary:      Accent.teal,
  primaryLight: Accent.tealLight,
  primaryMid:   Accent.teal,
  primaryHover: '#0BB8B5',
  dark:         Text.primary,
  darkHover:    '#111111',
  biz:          Biz.DEFAULT,
  bizLight:     Biz.light,
  bizMid:       Biz.mid,
  bizBorder:    Biz.border,
  bizHover:     Biz.hover,
} as const

/** @deprecated Dark mode is deferred. Remove dark: variants from components. */
export const DarkSurface = {} as const

/** @deprecated Use Semantic directly */
export const Neutral = {
  grey:        Text.secondary,
  greyLight:   Border.subtle,
  greyLighter: Background.secondary,
} as const
