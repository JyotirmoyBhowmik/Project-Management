// ==============================================================================
// src/lib/calendar/calendar-engine.ts
// Enterprise Working Calendar & Non-Working Day Exclusion Engine
// ==============================================================================

import { WorkingCalendar, CalendarHoliday } from '@/types/database';

export interface CalendarDayInfo {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  isWorkingDay: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

export function formatDateToISO(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function normalizeHolidays(holidays: (string | CalendarHoliday)[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const h of holidays) {
    if (typeof h === 'string') {
      map.set(h, 'Holiday');
    } else {
      map.set(h.date, h.name);
    }
  }
  return map;
}

/**
 * Checks if a specific date is a working day based on calendar working_days and holiday set.
 */
export function isWorkingDay(
  date: Date,
  calendar: Pick<WorkingCalendar, 'working_days'>,
  holidays: (string | CalendarHoliday)[] = []
): boolean {
  const dayOfWeek = date.getUTCDay();
  const isCalendarWorking = calendar.working_days.includes(dayOfWeek);
  if (!isCalendarWorking) return false;

  const iso = formatDateToISO(date);
  const holidayMap = normalizeHolidays(holidays);
  return !holidayMap.has(iso);
}

/**
 * Returns the same date if it's already a working day, or the very next working day.
 */
export function getNextWorkingDay(
  date: Date,
  calendar: Pick<WorkingCalendar, 'working_days'>,
  holidays: (string | CalendarHoliday)[] = []
): Date {
  const cursor = new Date(date.getTime());
  while (!isWorkingDay(cursor, calendar, holidays)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cursor;
}

/**
 * Adds working days to a start date, skipping non-working days and holidays.
 * If durationDays is 0 or 1, end date is the start date (or next working day if start was non-working).
 */
export function addWorkingDays(
  startDate: Date,
  durationDays: number,
  calendar: Pick<WorkingCalendar, 'working_days'>,
  holidays: (string | CalendarHoliday)[] = []
): Date {
  if (durationDays <= 0) {
    return new Date(startDate.getTime());
  }

  // Ensure start date is on a working day
  let cursor = getNextWorkingDay(startDate, calendar, holidays);
  let daysRemaining = durationDays - 1; // Day 1 is the starting day itself

  while (daysRemaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, calendar, holidays)) {
      daysRemaining--;
    }
  }

  return cursor;
}

/**
 * Calculates the exact count of working days inclusive between startDate and endDate.
 */
export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  calendar: Pick<WorkingCalendar, 'working_days'>,
  holidays: (string | CalendarHoliday)[] = []
): number {
  if (startDate > endDate) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(startDate.getTime());

  while (cursor <= endDate) {
    if (isWorkingDay(cursor, calendar, holidays)) {
      count++;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/**
 * Generates day metadata grid for rendering Gantt timeline columns.
 */
export function generateDayGrid(
  startDate: Date,
  endDate: Date,
  calendar: Pick<WorkingCalendar, 'working_days'>,
  holidays: (string | CalendarHoliday)[] = []
): CalendarDayInfo[] {
  const grid: CalendarDayInfo[] = [];
  const holidayMap = normalizeHolidays(holidays);
  const cursor = new Date(startDate.getTime());

  while (cursor <= endDate) {
    const dayOfWeek = cursor.getUTCDay();
    const isWeekend = !calendar.working_days.includes(dayOfWeek);
    const iso = formatDateToISO(cursor);
    const isHoliday = holidayMap.has(iso);
    const holidayName = holidayMap.get(iso);

    grid.push({
      date: new Date(cursor.getTime()),
      dateString: iso,
      dayOfWeek,
      isWeekend,
      isHoliday,
      isWorkingDay: !isWeekend && !isHoliday,
      holidayName,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return grid;
}
