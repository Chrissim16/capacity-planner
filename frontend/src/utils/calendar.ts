/**
 * Calendar utilities for workday calculations
 * Pure functions - no side effects, fully testable
 */

import { QuarterRange, PublicHoliday } from '../types';

/**
 * Parse a quarter string (e.g., "Q1 2026") to a date range
 */
export function parseQuarter(quarterStr: string): QuarterRange | null {
  const match = quarterStr.match(/Q(\d)\s+(\d{4})/);
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
 * Get workdays for a specific member in a quarter
 */
export function getWorkdaysForMember(
  memberId: string,
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
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
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
