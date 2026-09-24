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
  onSelectTask?: (task: Task) => void;
}

const PRIORITY_DOTS: Record<string, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
};

export function ProjectCalendarView({
  tasks,
  calendar,
  holidays,
  onSelectTask,
}: ProjectCalendarViewProps) {
  const [currentMonthDate, setCurrentMonthDate] = React.useState<Date>(() => {
    if (tasks.length > 0 && tasks[0].start_date) {
      const parsed = parseISODate(tasks[0].start_date);
      return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
    }
    const today = new Date();
    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  });

  const todayStr = React.useMemo(() => formatDateToISO(new Date()), []);

  const prevMonth = () => {
    setCurrentMonthDate(prev => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() - 1, 1)));
  };

  const nextMonth = () => {
    setCurrentMonthDate(prev => new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1)));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonthDate(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
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

  let totalMonthTasks = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(Date.UTC(year, month, d));
    const isoString = formatDateToISO(dateObj);
    const holidayMatch = holidays.find(h => h.date === isoString);
    const working = isWorkingDay(dateObj, calendar, holidays);

    // Filter tasks that intersect this day
    const dayTasks = tasks.filter(t => {
      return isoString >= t.start_date && isoString <= t.end_date;
    });

    if (dayTasks.length > 0) totalMonthTasks += dayTasks.length;

    calendarCells.push({
      day: d,
      dateString: isoString,
      isWorking: working,
      holiday: holidayMatch,
      tasks: dayTasks,
      isToday: isoString === todayStr,
    });
  }

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-[var(--border)] bg-[var(--secondary)]/40">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="text-sm font-bold text-[var(--foreground)]">{monthLabel}</h2>
          <Badge variant="outline" className="text-[10px] font-mono ml-1">
            {tasks.length} total tasks
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={goToToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] text-[var(--foreground)] cursor-pointer transition-colors"
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            aria-label="Previous month"
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] text-[var(--foreground)] cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextMonth}
            aria-label="Next month"
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] text-[var(--foreground)] cursor-pointer transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--secondary)]/70 text-center py-2 text-xs font-semibold text-[var(--muted-foreground)]">
        {daysOfWeek.map((d, i) => (
          <div key={d} className={i === 0 || i === 6 ? 'text-rose-400/80 font-medium' : ''}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-[var(--border)] overflow-y-auto">
        {calendarCells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="bg-[var(--secondary)]/20 p-2 min-h-[90px]" />;
          }

          const hasOverflow = cell.tasks.length > 2;
          const visibleTasks = hasOverflow ? cell.tasks.slice(0, 2) : cell.tasks;

          return (
            <div
              key={cell.dateString}
              className={`p-2 min-h-[105px] flex flex-col justify-between transition-colors ${
                cell.isToday
                  ? 'bg-[var(--primary)]/5 ring-1.5 ring-[var(--primary)] ring-inset'
                  : !cell.isWorking
                  ? 'bg-[var(--secondary)]/35'
                  : 'bg-[var(--card)] hover:bg-[var(--secondary)]/15'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-mono font-bold ${
                      cell.isToday
                        ? 'text-[var(--primary)] bg-[var(--primary)]/15 px-1.5 py-0.2 rounded-full'
                        : cell.holiday
                        ? 'text-rose-500'
                        : 'text-[var(--foreground)]'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {cell.isToday && (
                    <span className="text-[9px] font-semibold text-[var(--primary)]">Today</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {cell.holiday ? (
                    <Badge variant="warning" className="text-[8px] py-0 px-1 truncate max-w-[70px]">
                      {cell.holiday.name}
                    </Badge>
                  ) : !cell.isWorking ? (
                    <span className="text-[8px] text-[var(--muted-foreground)]/60 font-mono">Weekend</span>
                  ) : null}
                </div>
              </div>

              {/* Tasks within this day */}
              <div className="space-y-1 overflow-y-auto flex-1 my-1">
                {visibleTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask?.(task)}
                    className={`px-1.5 py-0.5 rounded text-[10px] truncate font-medium cursor-pointer transition-all hover:scale-[1.02] flex items-center gap-1 ${
                      task.is_critical
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                        : 'bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/25'
                    }`}
                    title={`${task.title} • Priority: ${task.priority} • Status: ${task.status}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        PRIORITY_DOTS[task.priority] || 'bg-blue-400'
                      }`}
                    />
                    {task.is_critical && <Flame className="h-2.5 w-2.5 inline shrink-0 text-rose-500" />}
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}

                {hasOverflow && (
                  <div
                    onClick={() => onSelectTask?.(cell.tasks[2])}
                    className="text-[9px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer text-center font-mono py-0.2 bg-[var(--secondary)]/60 rounded"
                  >
                    +{cell.tasks.length - 2} more tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
