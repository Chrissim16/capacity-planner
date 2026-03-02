import { describe, it, expect } from 'vitest';
import {
  generateSprintsForYear,
  generateSprints,
  getSprintsForQuarter,
  getWorkdaysInSprint,
  getCurrentSprint,
  parseSprint,
} from './sprints';
import type { Settings, Sprint } from '../types';

const BASE_SETTINGS: Settings = {
  bauReserveDays: 5,
  hoursPerDay: 8,
  defaultView: 'dashboard',
  quartersToShow: 4,
  defaultCountryId: 'country-nl',
  darkMode: false,
  confidenceLevels: { high: 5, medium: 15, low: 25, defaultLevel: 'medium' },
  sprintDurationWeeks: 3,
  sprintStartDate: '2026-01-05',
  sprintsToShow: 6,
  sprintsPerYear: 16,
  byeWeeksAfter: [8, 12],
  holidayWeeksAtEnd: 2,
};

// ── generateSprintsForYear ────────────────────────────────────────────────────

describe('generateSprintsForYear', () => {
  it('generates the configured number of sprints', () => {
    const sprints = generateSprintsForYear(2026, BASE_SETTINGS);
    expect(sprints).toHaveLength(16);
  });

  it('first sprint starts on the configured date', () => {
    const sprints = generateSprintsForYear(2026, BASE_SETTINGS);
    expect(sprints[0].startDate).toBe('2026-01-05');
  });

  it('each sprint spans sprintDurationWeeks × 7 - 1 days', () => {
    const sprints = generateSprintsForYear(2026, BASE_SETTINGS);
    const s = sprints[0];
    const start = new Date(s.startDate);
    const end   = new Date(s.endDate);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    // 3 weeks × 7 days - 1 = 20 days
    expect(diffDays).toBe(20);
  });

  it('assigns correct quarter labels', () => {
    const sprints = generateSprintsForYear(2026, BASE_SETTINGS);
    // Sprint 1 starts Jan 5 → Q1 2026
    expect(sprints[0].quarter).toBe('Q1 2026');
  });

  it('adds a bye week after configured sprints', () => {
    // Sprint 8 ends then a bye week is added before sprint 9 starts
    const sprints = generateSprintsForYear(2026, BASE_SETTINGS);
    const s8End   = new Date(sprints[7].endDate);
    const s9Start = new Date(sprints[8].startDate);
    const gap = (s9Start.getTime() - s8End.getTime()) / (1000 * 60 * 60 * 24);
    // Normal gap (next day) = 1 day; with bye week = 8 days
    expect(gap).toBe(8);
  });
});

// ── generateSprints ───────────────────────────────────────────────────────────

describe('generateSprints', () => {
  it('generates sprints for the requested number of years', () => {
    const sprints = generateSprints(BASE_SETTINGS, 2);
    expect(sprints.length).toBe(32); // 16 sprints × 2 years
  });
});

// ── getSprintsForQuarter ──────────────────────────────────────────────────────

describe('getSprintsForQuarter', () => {
  it('returns only sprints matching the given quarter', () => {
    const sprints = generateSprintsForYear(2026, BASE_SETTINGS);
    const q1 = getSprintsForQuarter('Q1 2026', sprints);
    expect(q1.length).toBeGreaterThan(0);
    q1.forEach(s => expect(s.quarter).toBe('Q1 2026'));
  });

  it('returns empty array for a quarter with no sprints', () => {
    const sprints = generateSprintsForYear(2026, BASE_SETTINGS);
    expect(getSprintsForQuarter('Q1 1999', sprints)).toHaveLength(0);
  });
});

// ── getWorkdaysInSprint ───────────────────────────────────────────────────────

describe('getWorkdaysInSprint', () => {
  it('returns 15 workdays for a standard 3-week sprint (no holidays)', () => {
    // 3 × 5 = 15 workdays in a Mon–Fri sprint
    const sprint: Sprint = {
      id: 'test-sprint',
      name: 'Sprint 1',
      number: 1,
      year: 2026,
      startDate: '2026-01-05',
      endDate:   '2026-01-23',
      quarter:   'Q1 2026',
    };
    expect(getWorkdaysInSprint(sprint)).toBe(15);
  });

  it('excludes public holidays', () => {
    const sprint: Sprint = {
      id: 'test-sprint',
      name: 'Sprint 1',
      number: 1,
      year: 2026,
      startDate: '2026-01-05',
      endDate:   '2026-01-23',
      quarter:   'Q1 2026',
    };
    const holidays = [{ id: 'h1', date: '2026-01-07', name: 'Holiday', countryId: 'nl' }];
    expect(getWorkdaysInSprint(sprint, holidays)).toBe(14);
  });
});

// ── getCurrentSprint ──────────────────────────────────────────────────────────

describe('getCurrentSprint', () => {
  it('returns undefined when sprint list is empty', () => {
    expect(getCurrentSprint([])).toBeUndefined();
  });

  it('returns a sprint whose date range includes today', () => {
    // Create a sprint that starts yesterday and ends tomorrow
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const sprint: Sprint = {
      id: 'current',
      name: 'Sprint X',
      number: 99,
      year: today.getFullYear(),
      startDate: fmt(yesterday),
      endDate:   fmt(tomorrow),
      quarter:   'Q1 2026',
    };
    expect(getCurrentSprint([sprint])).toEqual(sprint);
  });
});

// ── parseSprint ───────────────────────────────────────────────────────────────

describe('parseSprint', () => {
  it('parses "Sprint 1"', () => {
    const r = parseSprint('Sprint 1');
    expect(r).toEqual({ number: 1, year: undefined });
  });

  it('parses "Sprint 12 2026"', () => {
    const r = parseSprint('Sprint 12 2026');
    expect(r).toEqual({ number: 12, year: 2026 });
  });

  it('returns null for unrecognised format', () => {
    expect(parseSprint('S1')).toBeNull();
    expect(parseSprint('')).toBeNull();
  });
});
