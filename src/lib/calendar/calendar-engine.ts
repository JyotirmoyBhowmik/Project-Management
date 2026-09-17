// ==============================================================================
// src/lib/calendar/calendar-engine.ts
// Enterprise Working Calendar Engine & calculate_working_end_date Implementation
// ==============================================================================

import { CalendarHoliday, Tenant } from '@/types/database';

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
      const d = h.holiday_date || h.date;
      if (d) map.set(d, h.name);
    }
  }
  return map;
}

/**
 * Checks if a specific date is a working day based on configured weekend_days or working_days.
 */
export function isWorkingDay(
  date: Date,
  calendarOrConfig: { working_days?: number[]; weekend_days?: number[] } | number[],
  holidays: (string | CalendarHoliday)[] = []
): boolean {
  const dayOfWeek = date.getUTCDay();

  let isWeekend = false;
  if (Array.isArray(calendarOrConfig)) {
    // Array of weekend days
    isWeekend = calendarOrConfig.includes(dayOfWeek);
  } else if (calendarOrConfig.weekend_days) {
    isWeekend = calendarOrConfig.weekend_days.includes(dayOfWeek);
  } else if (calendarOrConfig.working_days) {
    isWeekend = !calendarOrConfig.working_days.includes(dayOfWeek);
  } else {
    isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // default Sat/Sun
  }

  if (isWeekend) return false;

  const iso = formatDateToISO(date);
  const holidayMap = normalizeHolidays(holidays);
  return !holidayMap.has(iso);
}

/**
 * Returns the same date if it's already a working day, or the very next working day.
 */
export function getNextWorkingDay(
  date: Date,
  calendarOrConfig: { working_days?: number[]; weekend_days?: number[] } | number[],
  holidays: (string | CalendarHoliday)[] = []
): Date {
  const cursor = new Date(date.getTime());
  while (!isWorkingDay(cursor, calendarOrConfig, holidays)) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cursor;
}

/**
 * TypeScript implementation matching PL/pgSQL calculate_working_end_date(tenant_id, start_date, duration_days)
 */
export function calculate_working_end_date(
  tenantId: string,
  startDate: Date | string,
  durationDays: number,
  weekendDays: number[] = [0, 6],
  holidays: (string | CalendarHoliday)[] = []
): string {
  const start = typeof startDate === 'string' ? parseISODate(startDate) : startDate;
  if (durationDays <= 0) {
    return formatDateToISO(start);
  }

  let cursor = getNextWorkingDay(start, weekendDays, holidays);
  let daysRemaining = durationDays - 1; // Start day counts as Day 1

  while (daysRemaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, weekendDays, holidays)) {
      daysRemaining--;
    }
  }

  return formatDateToISO(cursor);
}

/**
 * Adds working days to a start date, skipping non-working days and holidays.
 */
export function addWorkingDays(
  startDate: Date,
  durationDays: number,
  calendarOrConfig: { working_days?: number[]; weekend_days?: number[] } | number[],
  holidays: (string | CalendarHoliday)[] = []
): Date {
  if (durationDays <= 0) {
    return new Date(startDate.getTime());
  }

  let cursor = getNextWorkingDay(startDate, calendarOrConfig, holidays);
  let daysRemaining = durationDays - 1;

  while (daysRemaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, calendarOrConfig, holidays)) {
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
  calendarOrConfig: { working_days?: number[]; weekend_days?: number[] } | number[],
  holidays: (string | CalendarHoliday)[] = []
): number {
  if (startDate > endDate) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(startDate.getTime());

  while (cursor <= endDate) {
    if (isWorkingDay(cursor, calendarOrConfig, holidays)) {
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
  calendarOrConfig: { working_days?: number[]; weekend_days?: number[] } | number[],
  holidays: (string | CalendarHoliday)[] = []
): CalendarDayInfo[] {
  const grid: CalendarDayInfo[] = [];
  const holidayMap = normalizeHolidays(holidays);
  const cursor = new Date(startDate.getTime());

  while (cursor <= endDate) {
    const dayOfWeek = cursor.getUTCDay();
    const working = isWorkingDay(cursor, calendarOrConfig, holidays);
    const iso = formatDateToISO(cursor);
    const isHoliday = holidayMap.has(iso);
    const holidayName = holidayMap.get(iso);

    let isWeekend = false;
    if (Array.isArray(calendarOrConfig)) {
      isWeekend = calendarOrConfig.includes(dayOfWeek);
    } else if (calendarOrConfig.weekend_days) {
      isWeekend = calendarOrConfig.weekend_days.includes(dayOfWeek);
    } else if (calendarOrConfig.working_days) {
      isWeekend = !calendarOrConfig.working_days.includes(dayOfWeek);
    } else {
      isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    }

    grid.push({
      date: new Date(cursor.getTime()),
      dateString: iso,
      dayOfWeek,
      isWeekend,
      isHoliday,
      isWorkingDay: working,
      holidayName,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return grid;
}
