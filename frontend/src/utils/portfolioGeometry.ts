/**
 * Portfolio Planning — geometry and calendar utilities.
 *
 * Week generation follows the HTML prototype's logic but is built on top of
 * the app's existing parseQuarter / calendar.ts so we don't duplicate quarter math.
 */

import { parseQuarter } from './calendar';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseIsoDateLocal(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

export function formatIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function addWorkingDays(startDate: Date, workingDays: number): Date {
  const date = new Date(startDate);
  if (workingDays === 0) return date;

  const direction = workingDays > 0 ? 1 : -1;
  let remaining = Math.abs(workingDays);

  while (remaining > 0) {
    date.setDate(date.getDate() + direction);
    if (isWorkingDay(date)) remaining -= 1;
  }

  return date;
}

function getWorkingDayOffset(targetDate: Date, startDate: Date): number {
  const target = new Date(targetDate);
  const start = new Date(startDate);
  if (target.getTime() === start.getTime()) return 0;

  const direction = target > start ? 1 : -1;
  let offset = 0;
  const cursor = new Date(start);

  while ((direction > 0 && cursor < target) || (direction < 0 && cursor > target)) {
    cursor.setDate(cursor.getDate() + direction);
    if (isWorkingDay(cursor)) offset += direction;
  }

  return offset;
}

export interface PortfolioWeek {
  idx:          number;
  num:          number;       // ISO week number
  startDate:    Date;
  label:        string;       // e.g. "27 Mar"
  month:        string;       // e.g. "Mar"
  monthIdx:     number;
  isMonthStart: boolean;
  isTodayWeek:  boolean;
}

export interface QOpt {
  label: string;
  /** 0-indexed quarter (0=Q1…3=Q4), or -1 for Full Year */
  q:     number;
  year:  number;
}

// ── Quarter options ────────────────────────────────────────────────────────────

/** Returns current quarter + next 2 + Full Year (4 items total). */
export function getPortfolioQuarterOpts(): QOpt[] {
  const now   = new Date();
  const curQ  = Math.floor(now.getMonth() / 3); // 0-indexed
  const curY  = now.getFullYear();
  const opts: QOpt[] = [];
  for (let i = 0; i < 3; i++) {
    let q = curQ + i;
    let y = curY;
    if (q > 3) { q -= 4; y++; }
    opts.push({ label: `Q${q + 1} ${y}`, q, year: y });
  }
  opts.push({ label: `Full Year ${curY}`, q: -1, year: curY });
  return opts;
}

export function shiftPortfolioQuarter(qOpt: QOpt, delta: number): QOpt {
  if (qOpt.q === -1) {
    return { label: `Full Year ${qOpt.year + delta}`, q: -1, year: qOpt.year + delta };
  }

  const absoluteQuarter = qOpt.year * 4 + qOpt.q + delta;
  const year = Math.floor(absoluteQuarter / 4);
  const q = ((absoluteQuarter % 4) + 4) % 4;
  return { label: `Q${q + 1} ${year}`, q, year };
}

/** Returns a rolling strip of quarters around the current quarter for horizontal timeline scrolling. */
export function getRollingPortfolioQuarterOpts(before = 1, after = 2): QOpt[] {
  const now = new Date();
  const current: QOpt = {
    label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
    q: Math.floor(now.getMonth() / 3),
    year: now.getFullYear(),
  };

  const opts: QOpt[] = [];
  for (let i = -before; i <= after; i++) opts.push(shiftPortfolioQuarter(current, i));
  return opts;
}

// ── Week generation ────────────────────────────────────────────────────────────

function firstMonday(date: Date): Date {
  const d   = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function isoWeekNumber(d: Date): number {
  const jan4  = new Date(d.getFullYear(), 0, 4);
  return Math.ceil(((d.getTime() - jan4.getTime()) / 86_400_000 + jan4.getDay() + 1) / 7);
}

export function genWeeksForQOpt(qOpt: QOpt): PortfolioWeek[] {
  const today  = new Date();
  let rangeStart: Date;
  let rangeEnd: Date;

  if (qOpt.q === -1) {
    rangeStart = new Date(qOpt.year, 0, 1);
    rangeEnd   = new Date(qOpt.year, 11, 31);
  } else {
    const r = parseQuarter(`Q${qOpt.q + 1} ${qOpt.year}`);
    if (!r) return [];
    rangeStart = r.start;
    rangeEnd   = r.end;
  }

  const start = firstMonday(rangeStart);
  const r: PortfolioWeek[] = [];
  const d = new Date(start);

  while (d <= rangeEnd || r.length < 4) {
    const prev      = r.length > 0 ? r[r.length - 1].monthIdx : -1;
    const mi        = d.getMonth();
    const wkEnd     = new Date(d.getTime() + 6 * 86_400_000);
    const isToday   = d <= today && wkEnd >= today;
    r.push({
      idx:          r.length,
      num:          isoWeekNumber(d),
      startDate:    new Date(d),
      label:        `${d.getDate()} ${MONTHS[mi]}`,
      month:        MONTHS[mi],
      monthIdx:     mi,
      isMonthStart: mi !== prev,
      isTodayWeek:  isToday,
    });
    d.setDate(d.getDate() + 7);
    if (d > rangeEnd && r.length >= 8) break;
  }
  return r;
}

// ── Week-width calculation ─────────────────────────────────────────────────────

/** Left panel width in px (matches --left-w in CSS). */
const LEFT_W  = 460;
/** Drawer width in px (matches --drawer-w in CSS). */
const DRAWER_W = 420;
/** Minimum column width in px. */
const MIN_WEEK_W = 52;

export function calcWeekW(nWeeks: number, drawerOpen: boolean, leftW = LEFT_W): number {
  if (nWeeks === 0) return MIN_WEEK_W;
  const avail = window.innerWidth - leftW - (drawerOpen ? DRAWER_W : 0) - 2;
  return Math.max(MIN_WEEK_W, Math.floor(avail / nWeeks));
}

// ── Pixel ↔ day helpers ────────────────────────────────────────────────────────

export const dToX = (days: number, dayW: number): number => days * dayW;
export const dToW = (days: number, dayW: number): number => Math.max(dayW, days * dayW);
export const xToD = (x: number, dayW: number): number => Math.max(0, Math.round(x / dayW));

// ── Absolute date ↔ working-day offset helpers ─────────────────────────────────

/**
 * Convert an absolute ISO date string to a working-day offset from tStart.
 * Used at render time so phase bars stay at the correct calendar position
 * regardless of which quarter is selected.
 */
export function dateToDay(isoDate: string, tStart: Date): number {
  const d = parseIsoDateLocal(isoDate);
  const dayOffset = getWorkingDayOffset(d, tStart);
  return Object.is(dayOffset, -0) ? 0 : dayOffset;
}

/**
 * Convert a working-day offset from tStart to an absolute ISO date string.
 * Used when saving a drag position so the stored value is quarter-independent.
 */
export function dayToIsoDate(day: number, tStart: Date): string {
  return formatIsoDateLocal(addWorkingDays(tStart, day));
}

/** Convert a working-day offset from T_START to a human-readable date label. */
export function dayToDateStr(day: number, tStart: Date): string {
  const d = addWorkingDays(tStart, day);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Working-day offset of today from the first week's Monday. */
export function todayDayOffset(tStart: Date): number {
  return Math.max(0, dateToDay(formatIsoDateLocal(new Date()), tStart));
}

// ── Bar width ──────────────────────────────────────────────────────────────────

import type { EpicPhaseAssignment, EpicPhasePlan, PlanningPhase } from '../types';

/**
 * Width in working days for a phase bar derived from explicit start/end dates.
 * Returns null if either date is missing (caller should fall back to legacy calc).
 */
export function phaseBarWidthDays(plan: EpicPhasePlan, tStart: Date): number | null {
  if (!plan.startDate || !plan.endDate) return null;
  const start = dateToDay(plan.startDate, tStart);
  const end   = dateToDay(plan.endDate,   tStart);
  return Math.max(1, end - start);
}

/**
 * Legacy fallback: width in working days for a phase bar.
 * Uses the person with the most assigned days as the anchor and adds their
 * absence days so the bar spans calendar duration (not just work duration).
 * Used only when a phase has no explicit endDate.
 */
export function calcBarWidthDays(
  assignments: EpicPhaseAssignment[],
  absenceLookup: Record<string, number>,
): number {
  if (!assignments.length) return 0;
  const max = assignments.reduce((a, b) => (a.days >= b.days ? a : b));
  return max.days + (absenceLookup[max.memberId] ?? 0);
}

/**
 * Returns the number of calendar weeks between two ISO date strings.
 * Uses calendar weeks (not working weeks) to match user mental model.
 */
export function weeksBetween(startIso: string, endIso: string): number {
  const diffMs = parseIsoDateLocal(endIso).getTime() - parseIsoDateLocal(startIso).getTime();
  return Math.max(1, Math.round(diffMs / (7 * 86_400_000)));
}

/**
 * Computes total days for an assignment based on its allocationMode:
 *   flat     → assignment.days
 *   rate     → assignment.daysPerWeek × weeks in phase
 *   segments → sum of segment.days
 */
export function totalDaysFromAssignment(
  a: EpicPhaseAssignment,
  phaseStartDate: string | null,
  phaseEndDate: string | null,
): number {
  if (a.allocationMode === 'rate') {
    if (!a.daysPerWeek || !phaseStartDate || !phaseEndDate) return a.days;
    return Math.round(a.daysPerWeek * weeksBetween(phaseStartDate, phaseEndDate) * 10) / 10;
  }
  if (a.allocationMode === 'segments') {
    return (a.segments ?? []).reduce((sum, s) => sum + s.days, 0);
  }
  return a.days;
}

// ── Phase metadata ─────────────────────────────────────────────────────────────

export const PHASES: PlanningPhase[] = ['design', 'build', 'test', 'deploy', 'hypercare'];
export const PH_KEY: Record<PlanningPhase, string> = {
  design:    'd',
  build:     'b',
  test:      't',
  deploy:    'p',
  hypercare: 'h',
};
export const PH_LBL: Record<PlanningPhase, string> = {
  design:    'Design',
  build:     'Build',
  test:      'Test',
  deploy:    'Deploy',
  hypercare: 'Hypercare',
};
export const PH_SHORT: Record<PlanningPhase, string> = {
  design:    'Des',
  build:     'Bld',
  test:      'Tst',
  deploy:    'Dep',
  hypercare: 'Hyp',
};
