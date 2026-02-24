/**
 * Calendar utilities for workday calculations
 * Pure functions - no side effects, fully testable
 */

import type { QuarterRange, PublicHoliday, Phase } from '../types';

/**
 * Parse a quarter string (e.g., "Q1 2026") to a date range
 */
export function parseQuarter(quarterStr: string): QuarterRange | null {
  // Accept both "Q1 2026" and "2026-Q1"
  const normalized = quarterStr.trim();
  let match = normalized.match(/^Q([1-4])\s+(\d{4})$/);
  if (!match) {
    const alt = normalized.match(/^(\d{4})-Q([1-4])$/);
    if (alt) match = [normalized, alt[2], alt[1]];
  }
  if (!match) return null;
  
  const q = parseInt(match[1]);
  const year = parseInt(match[2]);
  const startMonth = (q - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, startMonth + 3, 0); // Last day of quarter
  
  return { start: startDate, end: endDate, quarter: q, year };
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date is a public holiday
 */
export function isPublicHoliday(date: Date, holidays: PublicHoliday[]): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return holidays.some(h => h.date === dateStr);
}

/**
 * Get holidays for a specific country
 */
export function getHolidaysByCountry(
  countryId: string, 
  publicHolidays: PublicHoliday[]
): PublicHoliday[] {
  return publicHolidays.filter(h => h.countryId === countryId);
}

/**
 * Count workdays in a quarter (excluding weekends and holidays)
 */
export function getWorkdaysInQuarter(
  quarterStr: string, 
  holidays: PublicHoliday[] = []
): number {
  const range = parseQuarter(quarterStr);
  if (!range) return 0;
  
  let workdays = 0;
  const current = new Date(range.start);
  
  while (current <= range.end) {
    if (!isWeekend(current) && !isPublicHoliday(current, holidays)) {
      workdays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workdays;
}

/**
 * Count working days within an ISO date range (start–end inclusive),
 * optionally clamped to a quarter's boundaries.
 * Excludes weekends and the supplied holidays.
 */
export function getWorkdaysInDateRange(
  startDateStr: string,
  endDateStr: string,
  holidays: PublicHoliday[] = [],
  clampStart?: Date,
  clampEnd?: Date
): number {
  let from = new Date(startDateStr + 'T00:00:00');
  let to   = new Date(endDateStr   + 'T00:00:00');

  if (clampStart && from < clampStart) from = new Date(clampStart);
  if (clampEnd   && to   > clampEnd)   to   = new Date(clampEnd);

  if (from > to) return 0;

  let workdays = 0;
  const cur = new Date(from);
  while (cur <= to) {
    if (!isWeekend(cur) && !isPublicHoliday(cur, holidays)) workdays++;
    cur.setDate(cur.getDate() + 1);
  }
  return workdays;
}

/**
 * Count working days of a time-off date range that fall within a specific quarter.
 */
export function getWorkdaysInDateRangeForQuarter(
  startDateStr: string,
  endDateStr: string,
  quarterStr: string,
  holidays: PublicHoliday[] = []
): number {
  const range = parseQuarter(quarterStr);
  if (!range) return 0;
  return getWorkdaysInDateRange(startDateStr, endDateStr, holidays, range.start, range.end);
}

/**
 * Get workdays for a specific member in a quarter
 */
export function getWorkdaysForMember(
  _memberId: string,
  quarterStr: string,
  memberCountryId: string,
  publicHolidays: PublicHoliday[]
): number {
  const holidays = getHolidaysByCountry(memberCountryId, publicHolidays);
  return getWorkdaysInQuarter(quarterStr, holidays);
}

/**
 * Get holidays in a specific quarter for a country
 */
export function getHolidaysInQuarter(
  quarterStr: string,
  countryId: string,
  publicHolidays: PublicHoliday[]
): PublicHoliday[] {
  const range = parseQuarter(quarterStr);
  if (!range) return [];
  
  const countryHolidays = getHolidaysByCountry(countryId, publicHolidays);
  
  return countryHolidays.filter(holiday => {
    const holidayDate = new Date(holiday.date);
    return holidayDate >= range.start && holidayDate <= range.end;
  });
}

/**
 * Get the current quarter string (e.g., "Q1 2026")
 */
export function getCurrentQuarter(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `Q${quarter} ${now.getFullYear()}`;
}

/**
 * Generate an array of quarter strings
 */
export function generateQuarters(count: number = 8): string[] {
  const quarters: string[] = [];
  const now = new Date();
  let year = now.getFullYear();
  let quarter = Math.floor(now.getMonth() / 3) + 1;
  
  for (let i = 0; i < count; i++) {
    quarters.push(`Q${quarter} ${year}`);
    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
  }
  
  return quarters;
}

/**
 * Compare two quarters (-1 if a < b, 0 if equal, 1 if a > b)
 */
export function compareQuarters(a: string, b: string): number {
  const aRange = parseQuarter(a);
  const bRange = parseQuarter(b);
  
  if (!aRange || !bRange) return 0;
  
  if (aRange.year !== bRange.year) {
    return aRange.year - bRange.year;
  }
  return aRange.quarter - bRange.quarter;
}

/**
 * Check if a quarter is within a range (inclusive)
 */
export function isQuarterInRange(
  quarter: string,
  startQuarter: string,
  endQuarter: string
): boolean {
  return (
    compareQuarters(quarter, startQuarter) >= 0 &&
    compareQuarters(quarter, endQuarter) <= 0
  );
}

/**
 * Get all quarters between start and end (inclusive)
 */
export function getQuartersBetween(
  startQuarter: string,
  endQuarter: string
): string[] {
  const quarters: string[] = [];
  const startRange = parseQuarter(startQuarter);
  const endRange = parseQuarter(endQuarter);
  
  if (!startRange || !endRange) return quarters;
  
  let year = startRange.year;
  let quarter = startRange.quarter;
  
  while (
    year < endRange.year ||
    (year === endRange.year && quarter <= endRange.quarter)
  ) {
    quarters.push(`Q${quarter} ${year}`);
    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
  }
  
  return quarters;
}

/**
 * Get the next quarter after a given quarter
 */
export function getNextQuarter(quarterStr: string): string {
  const range = parseQuarter(quarterStr);
  if (!range) return quarterStr;
  
  let { quarter, year } = range;
  quarter++;
  if (quarter > 4) {
    quarter = 1;
    year++;
  }
  
  return `Q${quarter} ${year}`;
}

/**
 * Get the previous quarter before a given quarter
 */
export function getPreviousQuarter(quarterStr: string): string {
  const range = parseQuarter(quarterStr);
  if (!range) return quarterStr;
  
  let { quarter, year } = range;
  quarter--;
  if (quarter < 1) {
    quarter = 4;
    year--;
  }
  
  return `Q${quarter} ${year}`;
}

/**
 * Format a date as YYYY-MM-DD (ISO, used internally / for DB)
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format an ISO date string (YYYY-MM-DD) as dd/mm/yyyy for display.
 * Pass `omitYear: true` for compact labels like sprint headers.
 */
export function formatDisplayDate(isoDate: string, omitYear = false): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return omitYear ? `${day}/${month}` : `${day}/${month}/${year}`;
}

/**
 * Format two ISO date strings as a display range "dd/mm/yyyy – dd/mm/yyyy".
 * If both dates share the same year, the first date omits the year.
 */
export function formatDisplayDateRange(
  start?: string,
  end?: string
): string | null {
  if (!start && !end) return null;
  if (start && end) {
    const sYear = start.split('-')[0];
    const eYear = end.split('-')[0];
    const sameYear = sYear === eYear;
    return `${formatDisplayDate(start, sameYear)} – ${formatDisplayDate(end)}`;
  }
  if (start) return `From ${formatDisplayDate(start)}`;
  return `Until ${formatDisplayDate(end!)}`;
}

/**
 * Calculate work weeks in a quarter (workdays / 5)
 */
export function getWorkWeeksInQuarter(
  quarterStr: string,
  holidays: PublicHoliday[] = []
): number {
  const workdays = getWorkdaysInQuarter(quarterStr, holidays);
  return workdays / 5;
}

/**
 * Resolve the ISO date range for a phase.
 * Prefers explicit startDate/endDate; falls back to startQuarter/endQuarter boundaries.
 */
export function getPhaseRange(phase: Phase): { start: string; end: string } | null {
  if (phase.startDate && phase.endDate) {
    return { start: phase.startDate, end: phase.endDate };
  }
  if (phase.startQuarter && phase.endQuarter) {
    const s = parseQuarter(phase.startQuarter);
    const e = parseQuarter(phase.endQuarter);
    if (s && e) {
      return {
        start: s.start.toISOString().slice(0, 10),
        end:   e.end.toISOString().slice(0, 10),
      };
    }
  }
  return null;
}

/**
 * Prorates committed days into a specific week window using workday-proportional distribution.
 *
 * fraction = workdays(weekStart..weekEnd ∩ rangeStart..rangeEnd)
 *            / workdays(rangeStart..rangeEnd)
 * result   = days × fraction
 *
 * Returns 0 when the week does not overlap the range or the range has zero workdays.
 */
export function prorateDaysToWeek(
  days: number,
  rangeStart: string,
  rangeEnd: string,
  weekStart: string,
  weekEnd: string,
  holidays: PublicHoliday[] = []
): number {
  const totalWorkdays = getWorkdaysInDateRange(rangeStart, rangeEnd, holidays);
  if (totalWorkdays === 0) return 0;

  const overlap = getWorkdaysInDateRange(
    rangeStart,
    rangeEnd,
    holidays,
    new Date(weekStart + 'T00:00:00'),
    new Date(weekEnd   + 'T00:00:00')
  );

  return days * (overlap / totalWorkdays);
}
