/**
 * Sprint utilities for capacity planning
 * 
 * Generates sprints based on settings and maps them to quarters.
 */

import type { Sprint, Settings, PublicHoliday } from '../types';

/**
 * Generate sprints for a given year based on settings
 */
export function generateSprintsForYear(
  year: number,
  settings: Settings
): Sprint[] {
  const {
    sprintDurationWeeks = 3,
    sprintStartDate,
    sprintsPerYear = 16,
    byeWeeksAfter = [8, 12],
    // holidayWeeksAtEnd is available for future use
  } = settings;

  const sprints: Sprint[] = [];
  
  // Parse start date or use default (first Monday of year)
  let currentDate: Date;
  if (sprintStartDate) {
    const parsedStart = new Date(sprintStartDate);
    // Adjust to the correct year
    currentDate = new Date(year, parsedStart.getMonth(), parsedStart.getDate());
  } else {
    // Default: first Monday of the year
    currentDate = getFirstMondayOfYear(year);
  }

  let sprintNumber = 1;
  
  while (sprintNumber <= sprintsPerYear) {
    const startDate = new Date(currentDate);
    const endDate = new Date(currentDate);
    endDate.setDate(endDate.getDate() + (sprintDurationWeeks * 7) - 1);
    
    const quarter = getQuarterFromDate(startDate);
    
    sprints.push({
      id: `sprint-${sprintNumber}-${year}`,
      name: `Sprint ${sprintNumber}`,
      number: sprintNumber,
      year,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      quarter: `Q${quarter} ${year}`,
    });
    
    // Move to next sprint start
    currentDate.setDate(currentDate.getDate() + (sprintDurationWeeks * 7));
    
    // Add bye week after specified sprints
    if (byeWeeksAfter.includes(sprintNumber)) {
      currentDate.setDate(currentDate.getDate() + 7); // Skip one week
    }
    
    sprintNumber++;
  }
  
  return sprints;
}

/**
 * Generate sprints for multiple years
 */
export function generateSprints(
  settings: Settings,
  yearsToGenerate: number = 2
): Sprint[] {
  const currentYear = new Date().getFullYear();
  const allSprints: Sprint[] = [];
  
  for (let i = 0; i < yearsToGenerate; i++) {
    const year = currentYear + i;
    allSprints.push(...generateSprintsForYear(year, settings));
  }
  
  return allSprints;
}

/**
 * Get sprints for a specific quarter
 */
export function getSprintsForQuarter(
  quarter: string,
  sprints: Sprint[]
): Sprint[] {
  return sprints.filter(s => s.quarter === quarter);
}

/**
 * Get the quarter a sprint belongs to
 */
export function getQuarterForSprint(sprint: Sprint): string {
  return sprint.quarter;
}

/**
 * Calculate workdays in a sprint (excluding weekends and holidays)
 */
export function getWorkdaysInSprint(
  sprint: Sprint,
  holidays: PublicHoliday[] = []
): number {
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  let workdays = 0;
  
  const holidayDates = new Set(holidays.map(h => h.date));
  
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = formatDate(current);
    
    // Count if weekday and not a holiday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      workdays++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return workdays;
}

/**
 * Convert sprint assignment to quarterly total
 */
export function aggregateSprintAssignmentsToQuarter(
  assignments: { sprint?: string; quarter: string; days: number }[],
  targetQuarter: string
): number {
  return assignments
    .filter(a => a.quarter === targetQuarter)
    .reduce((sum, a) => sum + a.days, 0);
}

/**
 * Get current sprint based on today's date
 */
export function getCurrentSprint(sprints: Sprint[]): Sprint | undefined {
  const today = formatDate(new Date());
  return sprints.find(s => s.startDate <= today && s.endDate >= today);
}

/**
 * Get upcoming sprints from today
 */
export function getUpcomingSprints(sprints: Sprint[], count: number = 6): Sprint[] {
  const today = formatDate(new Date());
  return sprints
    .filter(s => s.startDate >= today)
    .slice(0, count);
}

/**
 * Parse sprint name to get sprint info
 * "Sprint 1" or "Sprint 1 2026" -> { number: 1, year?: 2026 }
 */
export function parseSprint(sprintName: string): { number: number; year?: number } | null {
  const match = sprintName.match(/Sprint\s+(\d+)(?:\s+(\d{4}))?/i);
  if (!match) return null;
  
  return {
    number: parseInt(match[1], 10),
    year: match[2] ? parseInt(match[2], 10) : undefined,
  };
}

/**
 * Format sprint for display
 */
export function formatSprint(sprint: Sprint): string {
  return `${sprint.name} (${formatDateRange(sprint.startDate, sprint.endDate)})`;
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  
  return `${startStr} - ${endStr}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getFirstMondayOfYear(year: number): Date {
  const date = new Date(year, 0, 1); // January 1st
  const day = date.getDay();
  const daysUntilMonday = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
  date.setDate(date.getDate() + daysUntilMonday);
  return date;
}

function getQuarterFromDate(date: Date): number {
  const month = date.getMonth();
  if (month < 3) return 1;
  if (month < 6) return 2;
  if (month < 9) return 3;
  return 4;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
