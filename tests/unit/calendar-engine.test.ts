// ==============================================================================
// tests/unit/calendar-engine.test.ts
// Unit Tests: Working Calendar Engine, Weekend Exclusions, and Holiday Calculations
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  isWorkingDay,
  addWorkingDays,
  calculateWorkingDays,
  parseISODate,
  formatDateToISO,
} from '@/lib/calendar/calendar-engine';

describe('Working Calendar & Holiday Engine', () => {
  const usCalendar = { working_days: [1, 2, 3, 4, 5] }; // Mon - Fri
  const meCalendar = { working_days: [0, 1, 2, 3, 4] }; // Sun - Thu

  it('should correctly identify weekends for different regional calendars', () => {
    // 2026-10-02 is Friday, 2026-10-03 is Saturday, 2026-10-04 is Sunday
    const friday = parseISODate('2026-10-02');
    const saturday = parseISODate('2026-10-03');
    const sunday = parseISODate('2026-10-04');

    // US Calendar: Fri is working, Sat & Sun are not
    expect(isWorkingDay(friday, usCalendar, [])).toBe(true);
    expect(isWorkingDay(saturday, usCalendar, [])).toBe(false);
    expect(isWorkingDay(sunday, usCalendar, [])).toBe(false);

    // Middle East Calendar: Fri & Sat are weekends; Sun is working
    expect(isWorkingDay(friday, meCalendar, [])).toBe(false);
    expect(isWorkingDay(saturday, meCalendar, [])).toBe(false);
    expect(isWorkingDay(sunday, meCalendar, [])).toBe(true);
  });

  it('should skip weekends when adding working days', () => {
    // Start on Friday Oct 02, add 2 working days (Day 1: Fri Oct 02, Day 2: Mon Oct 05)
    const friday = parseISODate('2026-10-02');
    const result = addWorkingDays(friday, 2, usCalendar, []);

    expect(formatDateToISO(result)).toBe('2026-10-05');
  });

  it('should skip holidays when adding working days', () => {
    // Start on Friday Oct 02. Monday Oct 05 is a holiday.
    // Day 1: Fri Oct 02, Mon Oct 05 (holiday - skipped), Day 2: Tue Oct 06.
    const friday = parseISODate('2026-10-02');
    const holidays = [{ id: 'h1', tenant_id: 't1', calendar_id: 'c1', name: 'Special Holiday', date: '2026-10-05', is_recurring: false, created_at: '' }];

    const result = addWorkingDays(friday, 2, usCalendar, holidays);
    expect(formatDateToISO(result)).toBe('2026-10-06');
  });

  it('should accurately calculate working days between two dates', () => {
    // Monday Oct 05 to Friday Oct 09 is 5 working days
    const start = parseISODate('2026-10-05');
    const end = parseISODate('2026-10-09');

    expect(calculateWorkingDays(start, end, usCalendar, [])).toBe(5);

    // Monday Oct 05 to Monday Oct 12 spans a weekend (Oct 10-11) => 6 working days
    const nextMon = parseISODate('2026-10-12');
    expect(calculateWorkingDays(start, nextMon, usCalendar, [])).toBe(6);
  });
});
