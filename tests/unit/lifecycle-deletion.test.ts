// ==============================================================================
// tests/unit/lifecycle-deletion.test.ts
// Unit Tests for Cascading Lifecycle Deletion & Dependency Bridging Engine
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  DeleteTaskSchema,
  DeleteProjectSchema,
  PurgeTenantSchema,
} from '@/lib/validation/action-schemas';

describe('Lifecycle Deletion Schemas & Validation', () => {
  const validUuid1 = 'a0000000-0000-0000-0000-000000000001';
  const validUuid2 = 'b0000000-0000-0000-0000-000000000002';
  const validUuid3 = 'c0000000-0000-0000-0000-000000000003';

  it('validates DeleteTaskSchema with default bridging strategy', () => {
    const payload = {
      task_id: validUuid1,
      tenant_id: validUuid2,
      project_id: validUuid3,
    };

    const parsed = DeleteTaskSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dependency_strategy).toBe('bridge');
      expect(parsed.data.is_hard_delete).toBe(false);
    }
  });

  it('validates DeleteTaskSchema with explicit severing strategy and hard delete', () => {
    const payload = {
      task_id: validUuid1,
      tenant_id: validUuid2,
      project_id: validUuid3,
      dependency_strategy: 'sever',
      is_hard_delete: true,
    };

    const parsed = DeleteTaskSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dependency_strategy).toBe('sever');
      expect(parsed.data.is_hard_delete).toBe(true);
    }
  });

  it('rejects DeleteTaskSchema with invalid UUID or unrecognized strategy', () => {
    const invalidStrategy = {
      task_id: validUuid1,
      tenant_id: validUuid2,
      project_id: validUuid3,
      dependency_strategy: 'unknown-strategy',
    };

    const parsed = DeleteTaskSchema.safeParse(invalidStrategy);
    expect(parsed.success).toBe(false);

    const invalidUuid = {
      task_id: 'not-a-uuid',
      tenant_id: validUuid2,
      project_id: validUuid3,
    };
    expect(DeleteTaskSchema.safeParse(invalidUuid).success).toBe(false);
  });

  it('validates DeleteProjectSchema with confirmation code', () => {
    const payload = {
      project_id: validUuid1,
      tenant_id: validUuid2,
      confirm_project_code: 'PRJ-CORE',
      is_hard_delete: false,
    };

    const parsed = DeleteProjectSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects DeleteProjectSchema without confirmation code', () => {
    const invalid = {
      project_id: validUuid1,
      tenant_id: validUuid2,
      confirm_project_code: '',
    };

    const parsed = DeleteProjectSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates PurgeTenantSchema with confirmation slug', () => {
    const payload = {
      tenant_id: validUuid1,
      confirm_slug: 'acme-corp',
    };

    const parsed = PurgeTenantSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects PurgeTenantSchema with empty confirmation slug', () => {
    const invalid = {
      tenant_id: validUuid1,
      confirm_slug: '   ',
    };

    const parsed = PurgeTenantSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe('Intelligent Dependency Bridging Algorithm', () => {
  interface Dependency {
    predecessor_id: string;
    successor_id: string;
    dep_type: 'FS' | 'SS' | 'FF' | 'SF';
    lag_days: number;
  }

  // Pure function representing the bridging engine in deleteTaskAction
  function computeBridgedDependencies(
    deletedTaskId: string,
    allDependencies: Dependency[],
    strategy: 'bridge' | 'sever'
  ): Dependency[] {
    if (strategy === 'sever') {
      return allDependencies.filter(
        (d) => d.predecessor_id !== deletedTaskId && d.successor_id !== deletedTaskId
      );
    }

    const incoming = allDependencies.filter((d) => d.successor_id === deletedTaskId);
    const outgoing = allDependencies.filter((d) => d.predecessor_id === deletedTaskId);
    const remaining = allDependencies.filter(
      (d) => d.predecessor_id !== deletedTaskId && d.successor_id !== deletedTaskId
    );

    const bridged: Dependency[] = [];

    for (const inc of incoming) {
      for (const out of outgoing) {
        // Prevent self-loop if P == S
        if (inc.predecessor_id !== out.successor_id) {
          const maxLag = Math.max(inc.lag_days || 0, out.lag_days || 0);
          const alreadyExists = remaining.some(
            (r) => r.predecessor_id === inc.predecessor_id && r.successor_id === out.successor_id
          ) || bridged.some(
            (b) => b.predecessor_id === inc.predecessor_id && b.successor_id === out.successor_id
          );

          if (!alreadyExists) {
            bridged.push({
              predecessor_id: inc.predecessor_id,
              successor_id: out.successor_id,
              dep_type: 'FS',
              lag_days: maxLag,
            });
          }
        }
      }
    }

    return [...remaining, ...bridged];
  }

  it('bridges single predecessor to single successor when middle task is deleted', () => {
    // Chain: TaskA -> TaskB -> TaskC
    const deps: Dependency[] = [
      { predecessor_id: 'TaskA', successor_id: 'TaskB', dep_type: 'FS', lag_days: 2 },
      { predecessor_id: 'TaskB', successor_id: 'TaskC', dep_type: 'FS', lag_days: 3 },
    ];

    const result = computeBridgedDependencies('TaskB', deps, 'bridge');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      predecessor_id: 'TaskA',
      successor_id: 'TaskC',
      dep_type: 'FS',
      lag_days: 3, // max(2, 3)
    });
  });

  it('bridges multiple predecessors to multiple successors (cartesian product bridge)', () => {
    // Inputs: P1 -> B, P2 -> B
    // Outputs: B -> S1, B -> S2
    const deps: Dependency[] = [
      { predecessor_id: 'P1', successor_id: 'B', dep_type: 'FS', lag_days: 1 },
      { predecessor_id: 'P2', successor_id: 'B', dep_type: 'FS', lag_days: 4 },
      { predecessor_id: 'B', successor_id: 'S1', dep_type: 'FS', lag_days: 2 },
      { predecessor_id: 'B', successor_id: 'S2', dep_type: 'FS', lag_days: 0 },
    ];

    const result = computeBridgedDependencies('B', deps, 'bridge');

    // Expected 4 bridged links: (P1->S1, P1->S2, P2->S1, P2->S2)
    expect(result).toHaveLength(4);
    expect(result.find((d) => d.predecessor_id === 'P1' && d.successor_id === 'S1')?.lag_days).toBe(2);
    expect(result.find((d) => d.predecessor_id === 'P2' && d.successor_id === 'S1')?.lag_days).toBe(4);
    expect(result.find((d) => d.predecessor_id === 'P2' && d.successor_id === 'S2')?.lag_days).toBe(4);
  });

  it('prevents self-referential loops during bridge calculation', () => {
    // If P1 was also S1 through a cycle, do not create P1 -> P1
    const deps: Dependency[] = [
      { predecessor_id: 'Task1', successor_id: 'TaskB', dep_type: 'FS', lag_days: 0 },
      { predecessor_id: 'TaskB', successor_id: 'Task1', dep_type: 'FS', lag_days: 0 },
    ];

    const result = computeBridgedDependencies('TaskB', deps, 'bridge');
    expect(result).toHaveLength(0);
  });

  it('severs all incoming and outgoing connections when strategy is sever', () => {
    const deps: Dependency[] = [
      { predecessor_id: 'TaskA', successor_id: 'TaskB', dep_type: 'FS', lag_days: 2 },
      { predecessor_id: 'TaskB', successor_id: 'TaskC', dep_type: 'FS', lag_days: 3 },
      { predecessor_id: 'Other1', successor_id: 'Other2', dep_type: 'FS', lag_days: 0 },
    ];

    const result = computeBridgedDependencies('TaskB', deps, 'sever');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      predecessor_id: 'Other1',
      successor_id: 'Other2',
      dep_type: 'FS',
      lag_days: 0,
    });
  });
});
