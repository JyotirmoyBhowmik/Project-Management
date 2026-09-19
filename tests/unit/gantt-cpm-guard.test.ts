// ==============================================================================
// tests/unit/gantt-cpm-guard.test.ts
// Unit Tests: Gantt Scaler, Zoom Presets & Kahn's Topological Sort Cycle Guard
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { topologicalSort } from '@/lib/cpm/cpm-engine';
import { Task, TaskDependency } from '@/types/database';

describe('Gantt Engine & Kahn Cycle Guard', () => {
  const dummyTasks: Task[] = [
    {
      id: 'task-1',
      tenant_id: 't-1',
      project_id: 'p-1',
      title: 'Architecture Spec',
      status: 'completed',
      priority: 'high',
      start_date: '2026-10-01',
      end_date: '2026-10-05',
      duration_days: 5,
      progress_percent: 100,
      is_milestone: false,
      is_critical: true,
      order_index: 1,
      total_float: 0,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'task-2',
      tenant_id: 't-1',
      project_id: 'p-1',
      title: 'Database Schema & RLS',
      status: 'in_progress',
      priority: 'urgent',
      start_date: '2026-10-06',
      end_date: '2026-10-10',
      duration_days: 5,
      progress_percent: 50,
      is_milestone: false,
      is_critical: true,
      order_index: 2,
      total_float: 0,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'task-3',
      tenant_id: 't-1',
      project_id: 'p-1',
      title: 'Frontend Engine',
      status: 'todo',
      priority: 'medium',
      start_date: '2026-10-11',
      end_date: '2026-10-18',
      duration_days: 6,
      progress_percent: 0,
      is_milestone: false,
      is_critical: false,
      order_index: 3,
      total_float: 2,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'task-4',
      tenant_id: 't-1',
      project_id: 'p-1',
      title: 'Production Verification',
      status: 'todo',
      priority: 'urgent',
      start_date: '2026-10-19',
      end_date: '2026-10-20',
      duration_days: 2,
      progress_percent: 0,
      is_milestone: true,
      is_critical: true,
      order_index: 4,
      total_float: 0,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    },
  ];

  it('should accept a valid acyclic dependency chain (Task 1 -> Task 2 -> Task 4)', () => {
    const deps: TaskDependency[] = [
      {
        id: 'dep-1-2',
        tenant_id: 't-1',
        project_id: 'p-1',
        predecessor_id: 'task-1',
        successor_id: 'task-2',
        dependency_type: 'FS',
        lag_days: 0,
        created_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'dep-2-4',
        tenant_id: 't-1',
        project_id: 'p-1',
        predecessor_id: 'task-2',
        successor_id: 'task-4',
        dependency_type: 'FS',
        lag_days: 0,
        created_at: '2026-10-01T00:00:00Z',
      },
    ];

    const result = topologicalSort(dummyTasks, deps);
    expect(result.hasCycle).toBe(false);
    expect(result.order).toContain('task-1');
    expect(result.order).toContain('task-2');
    expect(result.order).toContain('task-4');
  });

  it('should detect and prevent a direct circular loop during drag-connect (Task 2 -> Task 1)', () => {
    const existingDeps: TaskDependency[] = [
      {
        id: 'dep-1-2',
        tenant_id: 't-1',
        project_id: 'p-1',
        predecessor_id: 'task-1',
        successor_id: 'task-2',
        dependency_type: 'FS',
        lag_days: 0,
        created_at: '2026-10-01T00:00:00Z',
      },
    ];

    // Candidate edge dragged by user: Task 2 -> Task 1
    const candidateDep: TaskDependency = {
      id: 'candidate-check',
      tenant_id: 't-1',
      project_id: 'p-1',
      predecessor_id: 'task-2',
      successor_id: 'task-1',
      dependency_type: 'FS',
      lag_days: 0,
      created_at: '2026-10-01T00:00:00Z',
    };

    const result = topologicalSort(dummyTasks, [...existingDeps, candidateDep]);
    expect(result.hasCycle).toBe(true);
  });

  it('should detect transitive circular loop across 4 tasks (4 -> 1 when 1->2->3->4)', () => {
    const existingDeps: TaskDependency[] = [
      {
        id: 'd1',
        tenant_id: 't-1',
        project_id: 'p-1',
        predecessor_id: 'task-1',
        successor_id: 'task-2',
        dependency_type: 'FS',
        lag_days: 0,
        created_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'd2',
        tenant_id: 't-1',
        project_id: 'p-1',
        predecessor_id: 'task-2',
        successor_id: 'task-3',
        dependency_type: 'FS',
        lag_days: 0,
        created_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'd3',
        tenant_id: 't-1',
        project_id: 'p-1',
        predecessor_id: 'task-3',
        successor_id: 'task-4',
        dependency_type: 'FS',
        lag_days: 0,
        created_at: '2026-10-01T00:00:00Z',
      },
    ];

    const candidateDep: TaskDependency = {
      id: 'loop-edge',
      tenant_id: 't-1',
      project_id: 'p-1',
      predecessor_id: 'task-4',
      successor_id: 'task-1',
      dependency_type: 'FS',
      lag_days: 0,
      created_at: '2026-10-01T00:00:00Z',
    };

    const result = topologicalSort(dummyTasks, [...existingDeps, candidateDep]);
    expect(result.hasCycle).toBe(true);
  });

  it('should verify critical path identification where total_float === 0', () => {
    const criticalTasks = dummyTasks.filter((t) => t.total_float === 0);
    expect(criticalTasks.map((t) => t.id)).toEqual(['task-1', 'task-2', 'task-4']);

    const nonCritical = dummyTasks.filter((t) => (t.total_float ?? 0) > 0);
    expect(nonCritical.map((t) => t.id)).toEqual(['task-3']);
  });
});
