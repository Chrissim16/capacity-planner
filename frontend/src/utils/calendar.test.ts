import { describe, it, expect } from 'vitest';
import {
  parseQuarter,
  getWorkdaysInQuarter,
  getWorkdaysInDateRange,
  getWorkdaysInDateRangeForQuarter,
  getCurrentQuarter,
  prorateDaysToWeek,
  isWeekend,
} from './calendar';
import type { PublicHoliday } from '../types';

// ── parseQuarter ─────────────────────────────────────────────────────────────

// Helper: get local YYYY-MM-DD from a Date (avoids UTC offset issues in toISOString)
function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('parseQuarter', () => {
  it('parses standard format "Q1 2026"', () => {
    const r = parseQuarter('Q1 2026');
    expect(r).not.toBeNull();
    expect(r!.quarter).toBe(1);
    expect(r!.year).toBe(2026);
    expect(localDate(r!.start)).toBe('2026-01-01');
    expect(localDate(r!.end)).toBe('2026-03-31');
  });

  it('parses alt format "2026-Q2"', () => {
    const r = parseQuarter('2026-Q2');
    expect(r).not.toBeNull();
    expect(r!.quarter).toBe(2);
    expect(localDate(r!.start)).toBe('2026-04-01');
  });

  it('returns null for invalid input', () => {
    expect(parseQuarter('')).toBeNull();
    expect(parseQuarter('Q5 2026')).toBeNull();
    expect(parseQuarter('2026')).toBeNull();
  });

  it('handles all four quarters correctly', () => {
    expect(localDate(parseQuarter('Q1 2025')!.end)).toBe('2025-03-31');
    expect(localDate(parseQuarter('Q2 2025')!.start)).toBe('2025-04-01');
    expect(localDate(parseQuarter('Q3 2025')!.start)).toBe('2025-07-01');
    expect(localDate(parseQuarter('Q4 2025')!.end)).toBe('2025-12-31');
  });
});

// ── isWeekend ─────────────────────────────────────────────────────────────────

describe('isWeekend', () => {
  it('identifies Saturday as weekend', () => {
    expect(isWeekend(new Date('2026-01-03'))).toBe(true); // Saturday
  });
  it('identifies Sunday as weekend', () => {
    expect(isWeekend(new Date('2026-01-04'))).toBe(true); // Sunday
  });
  it('identifies weekdays as non-weekend', () => {
    expect(isWeekend(new Date('2026-01-05'))).toBe(false); // Monday
    expect(isWeekend(new Date('2026-01-09'))).toBe(false); // Friday
  });
});

// ── getWorkdaysInDateRange ────────────────────────────────────────────────────

describe('getWorkdaysInDateRange', () => {
  it('counts a Mon–Fri week as 5 workdays', () => {
    expect(getWorkdaysInDateRange('2026-01-05', '2026-01-09')).toBe(5);
  });

  it('excludes weekends in a two-week span', () => {
    expect(getWorkdaysInDateRange('2026-01-05', '2026-01-16')).toBe(10);
  });

  it('returns 0 when start is after end', () => {
    expect(getWorkdaysInDateRange('2026-01-10', '2026-01-05')).toBe(0);
  });

  it('excludes public holidays', () => {
    const holidays: PublicHoliday[] = [
      { id: 'h1', date: '2026-01-07', name: 'Test Holiday', countryId: 'country-nl' },
    ];
    // Wed is a holiday → 4 workdays in Mon–Fri week
    expect(getWorkdaysInDateRange('2026-01-05', '2026-01-09', holidays)).toBe(4);
  });

  it('clamps to provided date boundaries', () => {
    // Full week Mon–Fri, clamped to Wed–Fri
    const clampStart = new Date('2026-01-07T00:00:00');
    const clampEnd   = new Date('2026-01-09T00:00:00');
    expect(getWorkdaysInDateRange('2026-01-05', '2026-01-09', [], clampStart, clampEnd)).toBe(3);
  });
});

// ── getWorkdaysInQuarter ──────────────────────────────────────────────────────

describe('getWorkdaysInQuarter', () => {
  it('Q1 2026 has 64 workdays (no holidays)', () => {
    // Jan 2026: 22 workdays, Feb: 20, Mar: 22 = 64
    expect(getWorkdaysInQuarter('Q1 2026')).toBe(64);
  });

  it('returns 0 for invalid quarter string', () => {
    expect(getWorkdaysInQuarter('invalid')).toBe(0);
  });

  it('subtracts public holidays', () => {
    const holidays: PublicHoliday[] = [
      { id: 'h1', date: '2026-01-01', name: "New Year's Day", countryId: 'nl' },
    ];
    // Jan 1 2026 is a Thursday → 63 workdays
    expect(getWorkdaysInQuarter('Q1 2026', holidays)).toBe(63);
  });
});

// ── getWorkdaysInDateRangeForQuarter ──────────────────────────────────────────

describe('getWorkdaysInDateRangeForQuarter', () => {
  it('counts only workdays within the quarter boundary', () => {
    // Time off spans end-of-Q4-2025 into Q1-2026; only Q1 portion counted
    const days = getWorkdaysInDateRangeForQuarter('2025-12-29', '2026-01-09', 'Q1 2026');
    // Jan 1–9 2026 in Q1: Jan 2, 5, 6, 7, 8, 9 = 6 workdays (Jan 1 is Thur but is start of Q)
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThan(10);
  });

  it('returns 0 when the date range is entirely outside the quarter', () => {
    const days = getWorkdaysInDateRangeForQuarter('2025-01-01', '2025-03-31', 'Q2 2026');
    expect(days).toBe(0);
  });
});

// ── getCurrentQuarter ─────────────────────────────────────────────────────────

describe('getCurrentQuarter', () => {
  it('returns a string matching "Q[1-4] YYYY" format', () => {
    expect(getCurrentQuarter()).toMatch(/^Q[1-4] \d{4}$/);
  });
});

// ── prorateDaysToWeek ─────────────────────────────────────────────────────────

describe('prorateDaysToWeek', () => {
  it('prorates full quarter days down to one week', () => {
    // Q1 2026 = 64 workdays. A Mon–Fri week = 5 days.
    // Expected share ≈ 5 / 64 × 64 = 5 days (if days === total workdays)
    const result = prorateDaysToWeek(64, '2026-01-01', '2026-03-31', '2026-01-05', '2026-01-09');
    expect(result).toBeGreaterThan(4);
    expect(result).toBeLessThan(6);
  });

  it('returns 0 when week is outside the date range', () => {
    const result = prorateDaysToWeek(10, '2026-01-01', '2026-01-31', '2026-04-01', '2026-04-05');
    expect(result).toBe(0);
  });

  it('returns 0 when range has 0 workdays', () => {
    // Saturday–Sunday range
    const result = prorateDaysToWeek(5, '2026-01-03', '2026-01-04', '2026-01-03', '2026-01-04');
    expect(result).toBe(0);
  });
});
