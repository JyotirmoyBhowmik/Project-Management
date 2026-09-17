// ==============================================================================
// src/lib/resource/resource-engine.ts
// Enterprise Resource Allocation, Workload & Capacity Heatmap Engine
// Evaluates real-time user workload across concurrent tenant projects.
// ==============================================================================

import {
  Task,
  TaskAssignee,
  UserProfile,
  WorkingCalendar,
  CalendarHoliday,
} from '@/types/database';
import {
  parseISODate,
  formatDateToISO,
  isWorkingDay,
} from '@/lib/calendar/calendar-engine';

export type ResourceUtilizationStatus = 'under' | 'optimal' | 'over';

export interface TaskWorkloadSlice {
  taskId: string;
  taskTitle: string;
  allocationPercent: number;
  assignedHours: number;
}

export interface DailyUserWorkload {
  date: string; // YYYY-MM-DD
  isWorkingDay: boolean;
  isHoliday: boolean;
  totalAssignedHours: number;
  capacityHours: number;
  utilizationPercent: number;
  status: ResourceUtilizationStatus;
  tasks: TaskWorkloadSlice[];
}

export interface UserWorkloadSummary {
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  dailyWorkloads: DailyUserWorkload[];
  averageUtilization: number;
  totalAssignedHours: number;
  overAllocatedDaysCount: number;
  hasConflicts: boolean;
}

export interface ResourceHeatmapResult {
  startDate: string;
  endDate: string;
  dates: string[];
  users: UserWorkloadSummary[];
  conflictAlerts: Array<{
    userId: string;
    userName: string;
    date: string;
    utilizationPercent: number;
    conflictingTasks: string[];
  }>;
}

/**
 * Computes daily and weekly capacity utilization percentages for all tenant users.
 * Categorizes workload into:
 *  - Under-allocated (< 70%)
 *  - Optimal (70% - 100%)
 *  - Over-allocated (> 100% triggers scheduling conflict alert)
 */
export function computeResourceWorkload(
  startDateStr: string,
  endDateStr: string,
  users: UserProfile[],
  tasks: Task[],
  assignees: TaskAssignee[],
  calendar: WorkingCalendar,
  holidays: (string | CalendarHoliday)[] = [],
  dailyShiftCapacityHours: number = 8
): ResourceHeatmapResult {
  const start = parseISODate(startDateStr);
  const end = parseISODate(endDateStr);

  // Generate date range
  const dateList: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    dateList.push(formatDateToISO(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const conflictAlerts: ResourceHeatmapResult['conflictAlerts'] = [];

  const userSummaries: UserWorkloadSummary[] = users.map((user) => {
    // Find all assignees for this user
    const userAssignments = assignees.filter((a) => a.user_id === user.id);

    let totalHours = 0;
    let totalWorkingDays = 0;
    let overAllocatedCount = 0;

    const dailyWorkloads: DailyUserWorkload[] = dateList.map((dStr) => {
      const d = parseISODate(dStr);
      const isWork = isWorkingDay(d, calendar, holidays);

      // Active tasks for this date
      const activeTasksForDay: TaskWorkloadSlice[] = [];

      for (const assignment of userAssignments) {
        const t = tasks.find((task) => task.id === assignment.task_id);
        if (!t) continue;

        // Check if date falls within task start and end date
        if (dStr >= t.start_date && dStr <= t.end_date) {
          const allocation = assignment.allocation_percent !== undefined
            ? assignment.allocation_percent
            : assignment.allocated_hours_per_day !== undefined
            ? (assignment.allocated_hours_per_day / dailyShiftCapacityHours) * 100
            : 100;
          const assignedHours = isWork
            ? assignment.allocated_hours_per_day !== undefined && assignment.allocation_percent === undefined
              ? assignment.allocated_hours_per_day
              : (dailyShiftCapacityHours * allocation) / 100
            : 0;

          activeTasksForDay.push({
            taskId: t.id,
            taskTitle: t.title,
            allocationPercent: allocation,
            assignedHours,
          });
        }
      }

      const totalAssignedForDay = activeTasksForDay.reduce(
        (sum, item) => sum + item.assignedHours,
        0
      );
      const capacity = isWork ? dailyShiftCapacityHours : 0;

      let utilizationPercent = 0;
      if (capacity > 0) {
        utilizationPercent = Math.round((totalAssignedForDay / capacity) * 100);
      }

      let status: ResourceUtilizationStatus = 'under';
      if (utilizationPercent > 100) {
        status = 'over';
        overAllocatedCount++;
        conflictAlerts.push({
          userId: user.id,
          userName: user.full_name,
          date: dStr,
          utilizationPercent,
          conflictingTasks: activeTasksForDay.map((t) => t.taskTitle),
        });
      } else if (utilizationPercent >= 70) {
        status = 'optimal';
      }

      if (isWork) {
        totalHours += totalAssignedForDay;
        totalWorkingDays++;
      }

      return {
        date: dStr,
        isWorkingDay: isWork,
        isHoliday: !isWork,
        totalAssignedHours: totalAssignedForDay,
        capacityHours: capacity,
        utilizationPercent,
        status,
        tasks: activeTasksForDay,
      };
    });

    const averageUtilization =
      totalWorkingDays > 0
        ? Math.round(
            (totalHours / (totalWorkingDays * dailyShiftCapacityHours)) * 100
          )
        : 0;

    return {
      userId: user.id,
      userName: user.full_name,
      userEmail: user.email,
      avatarUrl: user.avatar_url,
      dailyWorkloads,
      averageUtilization,
      totalAssignedHours: totalHours,
      overAllocatedDaysCount: overAllocatedCount,
      hasConflicts: overAllocatedCount > 0,
    };
  });

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    dates: dateList,
    users: userSummaries,
    conflictAlerts,
  };
}
