// ==============================================================================
// src/lib/cpm/cpm-engine.ts
// Critical Path Method (CPM) & Precedence Diagramming Scheduling Engine
// Supports FS, SS, FF, SF relationships, lag days, cycle detection, and float calculation.
// ==============================================================================

import { Task, TaskDependency, WorkingCalendar, CalendarHoliday } from '@/types/database';
import {
  parseISODate,
  formatDateToISO,
  addWorkingDays,
  calculateWorkingDays,
  getNextWorkingDay,
  isWorkingDay,
} from '../calendar/calendar-engine';
import { DependencyCycleException } from '../error/domain-errors';

export interface CPMResult {
  tasks: Task[];
  criticalPathTaskIds: string[];
  projectEarlyFinish: string;
  hasCycle: boolean;
}

/**
 * Subtracts working days from an end date (moving backwards in time).
 */
export function subtractWorkingDays(
  endDate: Date,
  durationDays: number,
  calendar: Pick<WorkingCalendar, 'working_days'>,
  holidays: (string | CalendarHoliday)[] = []
): Date {
  if (durationDays <= 0) {
    return new Date(endDate.getTime());
  }

  // Ensure end date is on a working day
  let cursor = new Date(endDate.getTime());
  while (!isWorkingDay(cursor, calendar, holidays)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let daysRemaining = durationDays - 1;

  while (daysRemaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (isWorkingDay(cursor, calendar, holidays)) {
      daysRemaining--;
    }
  }

  return cursor;
}

/**
 * Topological Sort with Cycle Detection (Kahn's Algorithm)
 */
export function topologicalSort(
  tasks: Task[],
  dependencies: TaskDependency[]
): { order: string[]; hasCycle: boolean } {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const dep of dependencies) {
    if (taskMap.has(dep.predecessor_id) && taskMap.has(dep.successor_id)) {
      adj.get(dep.predecessor_id)!.push(dep.successor_id);
      inDegree.set(dep.successor_id, (inDegree.get(dep.successor_id) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);

    for (const v of adj.get(u) || []) {
      const newDeg = inDegree.get(v)! - 1;
      inDegree.set(v, newDeg);
      if (newDeg === 0) queue.push(v);
    }
  }

  const hasCycle = order.length !== tasks.length;
  return { order, hasCycle };
}

/**
 * Executes Full CPM Forward Pass, Backward Pass, Float, and Critical Path Calculations.
 */
export function calculateCPM(
  rawTasks: Task[],
  dependencies: TaskDependency[],
  calendar: Pick<WorkingCalendar, 'working_days'>,
  holidays: (string | CalendarHoliday)[] = [],
  projectTargetDeadline?: string | null
): CPMResult {
  if (rawTasks.length === 0) {
    return { tasks: [], criticalPathTaskIds: [], projectEarlyFinish: '', hasCycle: false };
  }

  // Clone tasks into working mutable map
  const taskMap = new Map<string, Task>(
    rawTasks.map(t => [
      t.id,
      {
        ...t,
        duration_days: t.duration_days ?? 1,
        early_start: null,
        early_finish: null,
        late_start: null,
        late_finish: null,
        total_float: 0,
        free_float: 0,
        is_critical: false,
      },
    ])
  );

  // Group dependencies by successor and predecessor
  const predecessorsByTask = new Map<string, TaskDependency[]>();
  const successorsByTask = new Map<string, TaskDependency[]>();

  for (const t of rawTasks) {
    predecessorsByTask.set(t.id, []);
    successorsByTask.set(t.id, []);
  }

  for (const dep of dependencies) {
    if (taskMap.has(dep.predecessor_id) && taskMap.has(dep.successor_id)) {
      predecessorsByTask.get(dep.successor_id)?.push(dep);
      successorsByTask.get(dep.predecessor_id)?.push(dep);
    }
  }

  // Topological sorting and cycle verification
  const { order, hasCycle } = topologicalSort(rawTasks, dependencies);
  if (hasCycle) {
    // Locate cycle participants
    throw new DependencyCycleException('Cyclic Dependency', 'Task Graph Loop');
  }

  // ----------------------------------------------------------------------------
  // 1. FORWARD PASS: Calculate Early Start (ES) and Early Finish (EF)
  // ----------------------------------------------------------------------------
  for (const taskId of order) {
    const task = taskMap.get(taskId)!;
    const preds = predecessorsByTask.get(taskId) || [];

    let computedEarliestStart = parseISODate(task.start_date);

    for (const dep of preds) {
      const predTask = taskMap.get(dep.predecessor_id)!;
      const predES = parseISODate(predTask.early_start || predTask.start_date);
      const predEF = parseISODate(predTask.early_finish || predTask.end_date);
      const lag = dep.lag_days || 0;

      let candidateStart: Date = new Date(predEF.getTime());

      const depType = dep.dep_type || dep.type;
      switch (depType) {
        case 'FS': {
          // Finish-to-Start: successor starts after predecessor finishes + 1 day + lag
          const nextDay = new Date(predEF.getTime());
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          candidateStart = addWorkingDays(nextDay, lag, calendar, holidays);
          break;
        }
        case 'SS': {
          // Start-to-Start: successor starts lag days after predecessor starts
          candidateStart = addWorkingDays(predES, lag, calendar, holidays);
          break;
        }
        case 'FF': {
          // Finish-to-Finish: successor finish >= predEF + lag => start = finish - duration
          const targetFinish = addWorkingDays(predEF, lag, calendar, holidays);
          candidateStart = subtractWorkingDays(targetFinish, task.duration_days, calendar, holidays);
          break;
        }
        case 'SF': {
          // Start-to-Finish: successor finish >= predES + lag => start = finish - duration
          const targetFinish = addWorkingDays(predES, lag, calendar, holidays);
          candidateStart = subtractWorkingDays(targetFinish, task.duration_days, calendar, holidays);
          break;
        }
      }

      candidateStart = getNextWorkingDay(candidateStart, calendar, holidays);
      if (candidateStart > computedEarliestStart) {
        computedEarliestStart = candidateStart;
      }
    }

    // Constraint Modes: ASAP, Must Start On, Start No Earlier Than, Must Finish On
    if (task.constraint_type === 'must_start_on' && task.constraint_date) {
      computedEarliestStart = parseISODate(task.constraint_date);
    } else if (task.constraint_type === 'start_no_earlier_than' && task.constraint_date) {
      const constraintDate = parseISODate(task.constraint_date);
      if (constraintDate > computedEarliestStart) {
        computedEarliestStart = constraintDate;
      }
    }

    computedEarliestStart = getNextWorkingDay(computedEarliestStart, calendar, holidays);

    let computedEarliestFinish: Date;
    if (task.constraint_type === 'must_finish_on' && task.constraint_date) {
      computedEarliestFinish = parseISODate(task.constraint_date);
      computedEarliestStart = subtractWorkingDays(computedEarliestFinish, task.duration_days, calendar, holidays);
    } else {
      computedEarliestFinish = addWorkingDays(
        computedEarliestStart,
        task.duration_days,
        calendar,
        holidays
      );
    }

    task.early_start = formatDateToISO(computedEarliestStart);
    task.early_finish = formatDateToISO(computedEarliestFinish);
    task.start_date = task.early_start;
    task.end_date = task.early_finish;
  }

  // ----------------------------------------------------------------------------
  // 2. Determine Project Deadline
  // ----------------------------------------------------------------------------
  let maxProjectFinish = new Date(0);
  for (const task of taskMap.values()) {
    const ef = parseISODate(task.early_finish!);
    if (ef > maxProjectFinish) {
      maxProjectFinish = ef;
    }
  }

  const projectDeadline = projectTargetDeadline
    ? parseISODate(projectTargetDeadline) > maxProjectFinish
      ? parseISODate(projectTargetDeadline)
      : maxProjectFinish
    : maxProjectFinish;

  // ----------------------------------------------------------------------------
  // 3. BACKWARD PASS: Calculate Late Finish (LF) and Late Start (LS)
  // ----------------------------------------------------------------------------
  const reverseOrder = [...order].reverse();

  for (const taskId of reverseOrder) {
    const task = taskMap.get(taskId)!;
    const succs = successorsByTask.get(taskId) || [];

    let computedLateFinish: Date;

    if (succs.length === 0) {
      // Terminal tasks default to project finish
      computedLateFinish = projectDeadline;
    } else {
      computedLateFinish = new Date(Date.UTC(2099, 11, 31));

      for (const dep of succs) {
        const succTask = taskMap.get(dep.successor_id)!;
        const succLS = parseISODate(succTask.late_start || succTask.early_start!);
        const succLF = parseISODate(succTask.late_finish || succTask.early_finish!);
        const lag = dep.lag_days || 0;

        let candidateLateFinish: Date = new Date(succLS.getTime());

        const depType = dep.dep_type || dep.type;
        switch (depType) {
          case 'FS': {
            // Pred LF <= succ LS - 1 day - lag
            const prevDay = new Date(succLS.getTime());
            prevDay.setUTCDate(prevDay.getUTCDate() - 1);
            candidateLateFinish = subtractWorkingDays(prevDay, lag, calendar, holidays);
            break;
          }
          case 'SS': {
            // Pred LS <= succ LS - lag => Pred LF = LS + duration
            const candidateLS = subtractWorkingDays(succLS, lag, calendar, holidays);
            candidateLateFinish = addWorkingDays(candidateLS, task.duration_days, calendar, holidays);
            break;
          }
          case 'FF': {
            // Pred LF <= succ LF - lag
            candidateLateFinish = subtractWorkingDays(succLF, lag, calendar, holidays);
            break;
          }
          case 'SF': {
            // Pred LS <= succ LF - lag => Pred LF = LS + duration
            const candidateLS = subtractWorkingDays(succLF, lag, calendar, holidays);
            candidateLateFinish = addWorkingDays(candidateLS, task.duration_days, calendar, holidays);
            break;
          }
        }

        if (candidateLateFinish < computedLateFinish) {
          computedLateFinish = candidateLateFinish;
        }
      }
    }

    const computedLateStart = subtractWorkingDays(
      computedLateFinish,
      task.duration_days,
      calendar,
      holidays
    );

    task.late_finish = formatDateToISO(computedLateFinish);
    task.late_start = formatDateToISO(computedLateStart);

    // --------------------------------------------------------------------------
    // 4. FLOAT & CRITICAL PATH
    // Total Float = Late Start - Early Start (in working days)
    // --------------------------------------------------------------------------
    const es = parseISODate(task.early_start!);
    const ls = parseISODate(task.late_start!);

    let totalFloat = 0;
    if (ls > es) {
      totalFloat = calculateWorkingDays(es, ls, calendar, holidays) - 1;
    } else if (ls < es) {
      // Negative float implies schedule compression or constraint breach
      totalFloat = -(calculateWorkingDays(ls, es, calendar, holidays) - 1);
    }

    task.total_float = totalFloat;
    task.is_critical = totalFloat <= 0;
  }

  const updatedTasks = Array.from(taskMap.values());
  const criticalPathTaskIds = updatedTasks.filter(t => t.is_critical).map(t => t.id);

  return {
    tasks: updatedTasks,
    criticalPathTaskIds,
    projectEarlyFinish: formatDateToISO(maxProjectFinish),
    hasCycle: false,
  };
}

/**
 * Auto-Schedules downstream tasks when a task's start date or duration shifts.
 * Cascades forward adjustments through the dependency DAG respecting non-working days and holidays.
 */
export function autoScheduleCascading(
  tasks: Task[],
  dependencies: TaskDependency[],
  changedTaskId: string,
  newStartDate: string,
  calendarOrConfig: { working_days?: number[]; weekend_days?: number[] } | number[],
  holidays: (string | CalendarHoliday)[] = []
): Task[] {
  const clonedTasks = tasks.map(t => ({ ...t }));
  const target = clonedTasks.find(t => t.id === changedTaskId);
  if (!target) return tasks;

  target.start_date = newStartDate;
  const workingDays = Array.isArray(calendarOrConfig)
    ? calendarOrConfig
    : (calendarOrConfig.working_days || [1, 2, 3, 4, 5]);
  const cal: Pick<WorkingCalendar, 'working_days'> = { working_days: workingDays };
  const cpmResult = calculateCPM(clonedTasks, dependencies, cal, holidays);
  return cpmResult.tasks;
}

