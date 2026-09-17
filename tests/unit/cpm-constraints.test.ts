// ==============================================================================
// tests/unit/cpm-constraints.test.ts
// Unit Tests: CPM Scheduling Engine with Task Constraints & Cascading Propagation
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { calculateCPM, autoScheduleCascading } from '@/lib/cpm/cpm-engine';
import { Task, TaskDependency, WorkingCalendar } from '@/types/database';

describe('CPM Constraints & Auto-Scheduling Engine', () => {
  const calendar: Pick<WorkingCalendar, 'working_days'> = {
    working_days: [1, 2, 3, 4, 5], // Monday - Friday
  };
  const holidays: string[] = [];

  const baseTask = (id: string, start: string, duration: number): Task => ({
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
    end_date: start,
    duration_days: duration,
    progress_percent: 0,
    is_milestone: false,
    early_start: null,
    early_finish: null,
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

  describe('Task Constraint Modes', () => {
    it('should respect ASAP (As Soon As Possible) by default', () => {
      // t1: 2026-10-01 (Thu) to 2026-10-02 (Fri), duration 2
      // t2: FS dependency from t1. ASAP should start on next working day: 2026-10-05 (Mon)
      const t1 = baseTask('t1', '2026-10-01', 2);
      const t2 = {
        ...baseTask('t2', '2026-10-01', 2),
        constraint_type: 'asap' as const,
      };
      const dep: TaskDependency = {
        id: 'dep1',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        predecessor_id: 't1',
        successor_id: 't2',
        type: 'FS',
        lag_days: 0,
      };

      const result = calculateCPM([t1, t2], [dep], calendar, holidays);
      const resT2 = result.tasks.find(t => t.id === 't2')!;
      expect(resT2.early_start).toBe('2026-10-05'); // Monday following Friday finish
    });

    it('should enforce Must Start On (MSO) constraint pinning task start date', () => {
      // t1 ends on Friday 2026-10-02
      // t2 has MSO constraint for Wednesday 2026-10-07
      const t1 = baseTask('t1', '2026-10-01', 2);
      const t2 = {
        ...baseTask('t2', '2026-10-01', 2),
        constraint_type: 'must_start_on' as const,
        constraint_date: '2026-10-07',
      };
      const dep: TaskDependency = {
        id: 'dep1',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        predecessor_id: 't1',
        successor_id: 't2',
        type: 'FS',
        lag_days: 0,
      };

      const result = calculateCPM([t1, t2], [dep], calendar, holidays);
      const resT2 = result.tasks.find(t => t.id === 't2')!;
      expect(resT2.early_start).toBe('2026-10-07');
    });

    it('should enforce Start No Earlier Than (SNET) constraint', () => {
      // t1 finishes on Friday 2026-10-02 (would allow start on 2026-10-05)
      // t2 has SNET on Thursday 2026-10-08
      const t1 = baseTask('t1', '2026-10-01', 2);
      const t2 = {
        ...baseTask('t2', '2026-10-01', 2),
        constraint_type: 'start_no_earlier_than' as const,
        constraint_date: '2026-10-08',
      };
      const dep: TaskDependency = {
        id: 'dep1',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        predecessor_id: 't1',
        successor_id: 't2',
        type: 'FS',
        lag_days: 0,
      };

      const result = calculateCPM([t1, t2], [dep], calendar, holidays);
      const resT2 = result.tasks.find(t => t.id === 't2')!;
      expect(resT2.early_start).toBe('2026-10-08');
    });
  });

  describe('Auto-Scheduling Cascading Propagation', () => {
    it('should automatically cascade downstream task schedules when predecessor is delayed', () => {
      // Chain: t1 -> t2 -> t3
      const t1 = baseTask('t1', '2026-10-01', 2); // 2026-10-01 to 2026-10-02
      const t2 = baseTask('t2', '2026-10-05', 2); // 2026-10-05 to 2026-10-06
      const t3 = baseTask('t3', '2026-10-07', 2); // 2026-10-07 to 2026-10-08

      const deps: TaskDependency[] = [
        { id: 'd1', tenant_id: 'tenant-1', project_id: 'prj-1', predecessor_id: 't1', successor_id: 't2', type: 'FS', lag_days: 0 },
        { id: 'd2', tenant_id: 'tenant-1', project_id: 'prj-1', predecessor_id: 't2', successor_id: 't3', type: 'FS', lag_days: 0 },
      ];

      // Delay t1 to start on 2026-10-06 (Tue) -> finishes 2026-10-07 (Wed)
      const updatedTasks = autoScheduleCascading([t1, t2, t3], deps, 't1', '2026-10-06', calendar, holidays);

      const resT1 = updatedTasks.find(t => t.id === 't1')!;
      const resT2 = updatedTasks.find(t => t.id === 't2')!;
      const resT3 = updatedTasks.find(t => t.id === 't3')!;

      // t1: 2026-10-06 to 2026-10-07
      expect(resT1.early_start).toBe('2026-10-06');
      expect(resT1.early_finish).toBe('2026-10-07');

      // t2: should shift to start on 2026-10-08 (Thu) -> finishes 2026-10-09 (Fri)
      expect(resT2.early_start).toBe('2026-10-08');
      expect(resT2.early_finish).toBe('2026-10-09');

      // t3: should shift to start on 2026-10-12 (Mon, skipping weekend) -> finishes 2026-10-13 (Tue)
      expect(resT3.early_start).toBe('2026-10-12');
      expect(resT3.early_finish).toBe('2026-10-13');
    });
  });
});
