'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Flame } from 'lucide-react';
import { Task, WorkingCalendar, CalendarHoliday } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { formatDateToISO, parseISODate, isWorkingDay } from '@/lib/calendar/calendar-engine';

interface ProjectCalendarViewProps {
  tasks: Task[];
  calendar: WorkingCalendar;
  holidays: CalendarHoliday[];
}

export function ProjectCalendarView({ tasks, calendar, holidays }: ProjectCalendarViewProps) {
  const [currentMonthDate, setCurrentMonthDate] = React.useState<Date>(() => {
    if (tasks.length > 0 && tasks[0].start_date) {
      const parsed = parseISODate(tasks[0].start_date);
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
    }
    const today = new Date();
    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  });

  const prevMonth = () => {
    setCurrentMonthDate(prev => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() - 1, 1)));
  };

  const nextMonth = () => {
    setCurrentMonthDate(prev => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1)));
  };

  const year = currentMonthDate.getUTCFullYear();
  const month = currentMonthDate.getUTCMonth();

  const monthLabel = currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Compute month days grid
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDayOfWeek = new Date(Date.UTC(year, month, 1)).getUTCDay();

  // Pre-fill days before first day of month
  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month, d));
    const isoString = formatDateToISO(dateObj);
    const holidayMatch = holidays.find(h => h.date === isoString);
    const working = isWorkingDay(dateObj, calendar, holidays);

    // Filter tasks that intersect this day
    const dayTasks = tasks.filter(t => {
      return isoString >= t.start_date && isoString <= t.end_date;
    });

    calendarCells.push({
      day: d,
      dateString: isoString,
      isWorking: working,
      holiday: holidayMatch,
      tasks: dayTasks,
    });
  }

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--secondary)]/40">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="text-sm font-bold text-[var(--foreground)]">{monthLabel}</h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] text-[var(--foreground)] cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] text-[var(--foreground)] cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--secondary)]/70 text-center py-2 text-xs font-semibold text-[var(--muted-foreground)]">
        {daysOfWeek.map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-[var(--border)] overflow-y-auto">
        {calendarCells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="bg-[var(--secondary)]/20 p-2 min-h-[90px]" />;
          }

          return (
            <div
              key={cell.dateString}
              className={`p-2 min-h-[95px] flex flex-col justify-between transition-colors ${
                !cell.isWorking
                  ? 'bg-[var(--secondary)]/30'
                  : 'bg-[var(--card)] hover:bg-[var(--secondary)]/15'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-mono font-semibold ${
                    cell.holiday ? 'text-rose-500' : 'text-[var(--foreground)]'
                  }`}
                >
                  {cell.day}
                </span>

                {cell.holiday && (
                  <Badge variant="warning" className="text-[9px] py-0 px-1 truncate max-w-[80px]">
                    {cell.holiday.name}
                  </Badge>
                )}
              </div>

              {/* Tasks within this day */}
              <div className="space-y-1 overflow-y-auto max-h-16">
                {cell.tasks.map(task => (
                  <div
                    key={task.id}
                    className={`px-1.5 py-0.5 rounded text-[10px] truncate font-medium ${
                      task.is_critical
                        ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
                        : 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30'
                    }`}
                    title={`${task.title} (${task.status})`}
                  >
                    {task.is_critical && <Flame className="h-2.5 w-2.5 inline mr-1" />}
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
