// ==============================================================================
// tests/unit/task-actions.test.ts
// Unit Tests for Task Creation, Schedule Update, and Status Update Schemas
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  TaskInputSchema,
  UpdateTaskScheduleSchema,
  UpdateTaskStatusSchema,
} from '@/lib/validation/action-schemas';

describe('Task Action Schemas & Boundary Validation', () => {
  const validProjectId = 'd0000000-0000-0000-0000-000000000004';
  const validTenantId = 'a0000000-0000-0000-0000-000000000002';
  const validTaskId = 'e0000000-0000-0000-0000-000000000030';

  describe('TaskInputSchema', () => {
    it('should successfully validate a complete task input', () => {
      const payload = {
        title: 'Gantt Chart Canvas Optimization',
        project_id: validProjectId,
        tenant_id: validTenantId,
        start_date: '2026-10-01',
        end_date: '2026-10-10',
        duration_days: 10,
        priority: 'high' as const,
        status: 'todo',
        task_code: 'PRJ-101',
        is_milestone: false,
      };

      const result = TaskInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe(payload.title);
        expect(result.data.priority).toBe('high');
        expect(result.data.task_code).toBe('PRJ-101');
      }
    });

    it('should reject task input with missing title or invalid UUIDs', () => {
      const invalidPayload = {
        title: '',
        project_id: 'not-a-uuid',
        tenant_id: validTenantId,
        start_date: '2026-10-01',
      };

      const result = TaskInputSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.some((i) => i.path.includes('title'))).toBe(true);
        expect(issues.some((i) => i.path.includes('project_id'))).toBe(true);
      }
    });

    it('should reject invalid date formats per Rule 1.3', () => {
      const invalidDatePayload = {
        title: 'Database Migration',
        project_id: validProjectId,
        tenant_id: validTenantId,
        start_date: '10/01/2026', // Not YYYY-MM-DD
      };

      const result = TaskInputSchema.safeParse(invalidDatePayload);
      expect(result.success).toBe(false);
    });

    it('should default priority to medium and status to todo when omitted', () => {
      const minimalPayload = {
        title: 'Minimal Config Task',
        project_id: validProjectId,
        tenant_id: validTenantId,
        start_date: '2026-10-05',
      };

      const result = TaskInputSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('medium');
        expect(result.data.status).toBe('todo');
        expect(result.data.is_milestone).toBe(false);
      }
    });
  });

  describe('UpdateTaskScheduleSchema', () => {
    it('should validate valid schedule update params', () => {
      const payload = {
        taskId: validTaskId,
        startDate: '2026-10-02',
        endDate: '2026-10-08',
        durationDays: 7,
        projectId: validProjectId,
      };

      const result = UpdateTaskScheduleSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should reject negative duration days', () => {
      const payload = {
        taskId: validTaskId,
        startDate: '2026-10-02',
        endDate: '2026-10-08',
        durationDays: -5,
      };

      const result = UpdateTaskScheduleSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateTaskStatusSchema', () => {
    it('should validate status change payload', () => {
      const payload = {
        taskId: validTaskId,
        status: 'in_progress',
        projectId: validProjectId,
      };

      const result = UpdateTaskStatusSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should reject empty status string', () => {
      const payload = {
        taskId: validTaskId,
        status: '',
      };

      const result = UpdateTaskStatusSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
