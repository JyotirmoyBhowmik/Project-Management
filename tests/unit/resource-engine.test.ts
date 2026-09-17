// ==============================================================================
// tests/unit/resource-engine.test.ts
// Unit Tests: Resource Allocation, Workload & Capacity Utilization Engine
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { computeResourceWorkload } from '@/lib/resource/resource-engine';
import { Task, TaskAssignee, UserProfile, WorkingCalendar } from '@/types/database';

describe('Resource Workload & Capacity Engine', () => {
  const calendar: WorkingCalendar = {
    id: 'cal-1',
    tenant_id: 'tenant-1',
    name: 'Standard Western Calendar',
    week_start_day: 1, // Monday
    working_days: [1, 2, 3, 4, 5], // Mon-Fri
    daily_working_hours: 8,
    is_default: true,
    created_at: '',
    updated_at: '',
  };
  const holidays: any[] = [];

  const user1: UserProfile = {
    id: 'u1',
    email: 'engineer@acme.com',
    full_name: 'Lead Engineer',
    avatar_url: null,
    is_superadmin: false,
    created_at: '',
    updated_at: '',
  };

  const user2: UserProfile = {
    id: 'u2',
    email: 'developer@acme.com',
    full_name: 'Junior Developer',
    avatar_url: null,
    is_superadmin: false,
    created_at: '',
    updated_at: '',
  };

  const baseTask = (id: string, start: string, end: string, duration: number): Task => ({
    id,
    tenant_id: 'tenant-1',
    project_id: 'prj-1',
    phase_id: null,
    parent_id: null,
    title: `Task ${id}`,
    description: null,
    status: 'todo',
    priority: 'medium',
    start_date: start,
    end_date: end,
    duration_days: duration,
    progress_percent: 0,
    is_milestone: false,
    early_start: start,
    early_finish: end,
    late_start: null,
    late_finish: null,
    total_float: 0,
    free_float: 0,
    is_critical: false,
    order_index: 1,
    created_by: null,
    created_at: '',
    updated_at: '',
  });

  it('should compute optimal (70-100%) utilization for standard single-task workload', () => {
    // 2026-10-05 (Monday) to 2026-10-09 (Friday) = 5 working days (40 available hours)
    const task = baseTask('t1', '2026-10-05', '2026-10-09', 5);
    const assignees: TaskAssignee[] = [
      { id: 'as1', task_id: 't1', user_id: 'u1', role: 'lead', allocated_hours_per_day: 8 },
    ];

    const result = computeResourceWorkload(
      '2026-10-05',
      '2026-10-09',
      [user1],
      [task],
      assignees,
      calendar,
      holidays
    );

    const userSummary = result.users.find(u => u.userId === 'u1')!;
    expect(userSummary.totalAssignedHours).toBe(40);
    expect(userSummary.averageUtilization).toBe(100);
    expect(userSummary.hasConflicts).toBe(false);
    expect(result.conflictAlerts).toHaveLength(0);
  });

  it('should detect over-allocation (>100%) and flag conflicts when concurrent tasks exceed 8h/day', () => {
    // User 1 assigned to 2 concurrent tasks on Monday 2026-10-05: each 8 hours = 16 hours/day (200% utilization)
    const taskA = baseTask('tA', '2026-10-05', '2026-10-06', 2);
    const taskB = baseTask('tB', '2026-10-05', '2026-10-06', 2);

    const assignees: TaskAssignee[] = [
      { id: 'as1', task_id: 'tA', user_id: 'u1', role: 'lead', allocated_hours_per_day: 8 },
      { id: 'as2', task_id: 'tB', user_id: 'u1', role: 'contributor', allocated_hours_per_day: 8 },
    ];

    const result = computeResourceWorkload(
      '2026-10-05',
      '2026-10-06',
      [user1],
      [taskA, taskB],
      assignees,
      calendar,
      holidays
    );

    const userSummary = result.users.find(u => u.userId === 'u1')!;
    expect(userSummary.averageUtilization).toBe(200);
    expect(userSummary.hasConflicts).toBe(true);
    expect(userSummary.overAllocatedDaysCount).toBe(2);

    // Confirms conflict alerts generated
    expect(result.conflictAlerts.length).toBeGreaterThanOrEqual(1);
    expect(result.conflictAlerts[0].userId).toBe('u1');
    expect(result.conflictAlerts[0].utilizationPercent).toBe(200);
  });

  it('should detect under-allocated (<70%) capacity for lightweight assignments', () => {
    // 5 working days (40 hours capacity), but task only demands 2 hours/day (10 hours total = 25% utilization)
    const task = baseTask('t1', '2026-10-05', '2026-10-09', 5);
    const assignees: TaskAssignee[] = [
      { id: 'as1', task_id: 't1', user_id: 'u2', role: 'reviewer', allocated_hours_per_day: 2 },
    ];

    const result = computeResourceWorkload(
      '2026-10-05',
      '2026-10-09',
      [user2],
      [task],
      assignees,
      calendar,
      holidays
    );

    const userSummary = result.users.find(u => u.userId === 'u2')!;
    expect(userSummary.averageUtilization).toBe(25);
    expect(userSummary.hasConflicts).toBe(false);
    expect(userSummary.dailyWorkloads[0].status).toBe('under');
  });

  it('should exclude weekend non-working days from capacity allocations', () => {
    // Range includes 2026-10-03 (Saturday) and 2026-10-04 (Sunday)
    const task = baseTask('t1', '2026-10-01', '2026-10-07', 5);
    const assignees: TaskAssignee[] = [
      { id: 'as1', task_id: 't1', user_id: 'u1', role: 'lead', allocated_hours_per_day: 8 },
    ];

    const result = computeResourceWorkload(
      '2026-10-01',
      '2026-10-04',
      [user1],
      [task],
      assignees,
      calendar,
      holidays
    );

    const userSummary = result.users.find(u => u.userId === 'u1')!;
    const satSlot = userSummary.dailyWorkloads.find(d => d.date === '2026-10-03')!;
    const sunSlot = userSummary.dailyWorkloads.find(d => d.date === '2026-10-04')!;

    expect(satSlot.isWorkingDay).toBe(false);
    expect(satSlot.capacityHours).toBe(0);
    expect(satSlot.totalAssignedHours).toBe(0);

    expect(sunSlot.isWorkingDay).toBe(false);
    expect(sunSlot.capacityHours).toBe(0);
    expect(sunSlot.totalAssignedHours).toBe(0);
  });
});
