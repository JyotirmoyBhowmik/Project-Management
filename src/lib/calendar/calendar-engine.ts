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

export function formatDateToISO(d: Date | string | null | undefined): string {
  if (!d) {
    return new Date().toISOString().split('T')[0];
  }
  if (typeof d === 'string') {
    const clean = d.split('T')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  }
  if (isNaN(d.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(dateStr: string | null | undefined): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date();
  }
  const clean = dateStr.split('T')[0].trim();
  const parts = clean.split('-').map(Number);
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0));
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

export function normalizeHolidays(holidays?: (string | CalendarHoliday)[] | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!holidays || !Array.isArray(holidays)) return map;

  for (const h of holidays) {
    if (!h) continue;
    if (typeof h === 'string') {
      map.set(h, 'Holiday');
    } else {
      const d = h.holiday_date || h.date;
      if (d) map.set(d, h.name || 'Holiday');
    }
  }
  return map;
}

/**
 * Checks if a specific date is a working day based on configured weekend_days or working_days.
 */
export function isWorkingDay(
  date: Date,
  calendarOrConfig?: { working_days?: number[]; weekend_days?: number[] } | number[] | null,
  holidays?: (string | CalendarHoliday)[] | null
): boolean {
  if (!date || isNaN(date.getTime())) return false;
  const dayOfWeek = date.getUTCDay();

  let isWeekend = false;
  if (Array.isArray(calendarOrConfig)) {
    isWeekend = calendarOrConfig.includes(dayOfWeek);
  } else if (calendarOrConfig && calendarOrConfig.weekend_days) {
    isWeekend = calendarOrConfig.weekend_days.includes(dayOfWeek);
  } else if (calendarOrConfig && calendarOrConfig.working_days) {
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
  calendarOrConfig?: { working_days?: number[]; weekend_days?: number[] } | number[] | null,
  holidays?: (string | CalendarHoliday)[] | null
): Date {
  const cursor = date && !isNaN(date.getTime()) ? new Date(date.getTime()) : new Date();
  let loopCount = 0;
  while (!isWorkingDay(cursor, calendarOrConfig, holidays) && loopCount < 366) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    loopCount++;
  }
  return cursor;
}

/**
 * TypeScript implementation matching PL/pgSQL calculate_working_end_date(tenant_id, start_date, duration_days)
 */
export function calculate_working_end_date(
  tenantId: string,
  startDate: Date | string | null | undefined,
  durationDays: number,
  weekendDays: number[] = [0, 6],
  holidays: (string | CalendarHoliday)[] = []
): string {
  const start = typeof startDate === 'string' ? parseISODate(startDate) : startDate || new Date();
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
  startDate: Date | string | null | undefined,
  durationDays: number,
  calendarOrConfig?: { working_days?: number[]; weekend_days?: number[] } | number[] | null,
  holidays?: (string | CalendarHoliday)[] | null
): Date {
  const start = typeof startDate === 'string' ? parseISODate(startDate) : startDate || new Date();
  if (durationDays <= 0) {
    return new Date(start.getTime());
  }

  let cursor = getNextWorkingDay(start, calendarOrConfig, holidays);
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
