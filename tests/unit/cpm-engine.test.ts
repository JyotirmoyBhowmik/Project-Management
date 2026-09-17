// ==============================================================================
// tests/unit/cpm-engine.test.ts
// Unit Tests: Critical Path Method (CPM), Precedence Types, and Cycle Detection
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { calculateCPM, topologicalSort } from '@/lib/cpm/cpm-engine';
import { Task, TaskDependency, WorkingCalendar } from '@/types/database';
import { DependencyCycleException } from '@/lib/error/domain-errors';

describe('CPM & Scheduling Engine', () => {
  const calendar: Pick<WorkingCalendar, 'working_days'> = {
    working_days: [1, 2, 3, 4, 5], // Monday - Friday
  };
  const holidays: string[] = [];

  it('should correctly calculate forward and backward passes on a simple sequential chain (FS)', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        phase_id: null,
        parent_id: null,
        title: 'Task 1',
        description: null,
        status: 'todo',
        priority: 'medium',
        start_date: '2026-10-01', // Thursday
        end_date: '2026-10-02',   // Friday (duration 2)
        duration_days: 2,
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
      },
      {
        id: 't2',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        phase_id: null,
        parent_id: null,
        title: 'Task 2',
        description: null,
        status: 'todo',
        priority: 'medium',
        start_date: '2026-10-01',
        end_date: '2026-10-05',
        duration_days: 2,
        progress_percent: 0,
        is_milestone: false,
        early_start: null,
        early_finish: null,
        late_start: null,
        late_finish: null,
        total_float: 0,
        free_float: 0,
        is_critical: false,
        order_index: 2,
        created_by: null,
        created_at: '',
        updated_at: '',
      },
    ];

    const dependencies: TaskDependency[] = [
      {
        id: 'dep1',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        predecessor_id: 't1',
        successor_id: 't2',
        type: 'FS',
        lag_days: 0,
        created_at: '',
      },
    ];

    const result = calculateCPM(tasks, dependencies, calendar, holidays);

    // t1 runs 2 days: Thu Oct 01 and Fri Oct 02
    const t1 = result.tasks.find(t => t.id === 't1')!;
    expect(t1.early_start).toBe('2026-10-01');
    expect(t1.early_finish).toBe('2026-10-02');

    // t2 starts next working day after t1 finishes: Monday Oct 05, runs 2 days: Oct 05 and Oct 06
    const t2 = result.tasks.find(t => t.id === 't2')!;
    expect(t2.early_start).toBe('2026-10-05');
    expect(t2.early_finish).toBe('2026-10-06');

    // In a single chain, both tasks have float = 0 and are critical
    expect(t1.total_float).toBe(0);
    expect(t1.is_critical).toBe(true);
    expect(t2.total_float).toBe(0);
    expect(t2.is_critical).toBe(true);
    expect(result.criticalPathTaskIds).toContain('t1');
    expect(result.criticalPathTaskIds).toContain('t2');
  });

  it('should identify parallel paths and calculate positive float for non-critical tasks', () => {
    // Path A: t1 (5 days) -> t3 (5 days) = 10 days
    // Path B: t2 (2 days) -> t3 = parallel, shorter path with slack
    const tasks: Task[] = [
      {
        id: 't1',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        phase_id: null,
        parent_id: null,
        title: 'Long Task',
        description: null,
        status: 'todo',
        priority: 'high',
        start_date: '2026-10-01',
        end_date: '2026-10-07',
        duration_days: 5,
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
      },
      {
        id: 't2',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        phase_id: null,
        parent_id: null,
        title: 'Short Parallel Task',
        description: null,
        status: 'todo',
        priority: 'low',
        start_date: '2026-10-01',
        end_date: '2026-10-02',
        duration_days: 2,
        progress_percent: 0,
        is_milestone: false,
        early_start: null,
        early_finish: null,
        late_start: null,
        late_finish: null,
        total_float: 0,
        free_float: 0,
        is_critical: false,
        order_index: 2,
        created_by: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: 't3',
        tenant_id: 'tenant-1',
        project_id: 'prj-1',
        phase_id: null,
        parent_id: null,
        title: 'Merge Task',
        description: null,
        status: 'todo',
        priority: 'medium',
        start_date: '2026-10-08',
        end_date: '2026-10-14',
        duration_days: 5,
        progress_percent: 0,
        is_milestone: false,
        early_start: null,
        early_finish: null,
        late_start: null,
        late_finish: null,
        total_float: 0,
        free_float: 0,
        is_critical: false,
        order_index: 3,
        created_by: null,
        created_at: '',
        updated_at: '',
      },
    ];

    const dependencies: TaskDependency[] = [
      { id: 'd1', tenant_id: 'tenant-1', project_id: 'prj-1', predecessor_id: 't1', successor_id: 't3', type: 'FS', lag_days: 0, created_at: '' },
      { id: 'd2', tenant_id: 'tenant-1', project_id: 'prj-1', predecessor_id: 't2', successor_id: 't3', type: 'FS', lag_days: 0, created_at: '' },
    ];

    const result = calculateCPM(tasks, dependencies, calendar, holidays);

    const t1 = result.tasks.find(t => t.id === 't1')!;
    const t2 = result.tasks.find(t => t.id === 't2')!;
    const t3 = result.tasks.find(t => t.id === 't3')!;

    // t1 and t3 are critical
    expect(t1.is_critical).toBe(true);
    expect(t3.is_critical).toBe(true);

    // t2 is parallel and shorter, so it has positive float and is not critical
    expect(t2.is_critical).toBe(false);
    expect(t2.total_float).toBeGreaterThan(0);
  });

  it('should detect cyclic dependencies and throw DependencyCycleException', () => {
    const tasks: Task[] = [
      { id: 'tA', tenant_id: 'tenant-1', project_id: 'p1', phase_id: null, parent_id: null, title: 'A', description: null, status: 'todo', priority: 'medium', start_date: '2026-10-01', end_date: '2026-10-02', duration_days: 2, progress_percent: 0, is_milestone: false, early_start: null, early_finish: null, late_start: null, late_finish: null, total_float: 0, free_float: 0, is_critical: false, order_index: 1, created_by: null, created_at: '', updated_at: '' },
      { id: 'tB', tenant_id: 'tenant-1', project_id: 'p1', phase_id: null, parent_id: null, title: 'B', description: null, status: 'todo', priority: 'medium', start_date: '2026-10-01', end_date: '2026-10-02', duration_days: 2, progress_percent: 0, is_milestone: false, early_start: null, early_finish: null, late_start: null, late_finish: null, total_float: 0, free_float: 0, is_critical: false, order_index: 2, created_by: null, created_at: '', updated_at: '' },
    ];

    // Cyclic dependency: A -> B and B -> A
    const dependencies: TaskDependency[] = [
      { id: 'd1', tenant_id: 'tenant-1', project_id: 'p1', predecessor_id: 'tA', successor_id: 'tB', type: 'FS', lag_days: 0, created_at: '' },
      { id: 'd2', tenant_id: 'tenant-1', project_id: 'p1', predecessor_id: 'tB', successor_id: 'tA', type: 'FS', lag_days: 0, created_at: '' },
    ];

    expect(() => calculateCPM(tasks, dependencies, calendar, holidays)).toThrow(DependencyCycleException);
  });
});
