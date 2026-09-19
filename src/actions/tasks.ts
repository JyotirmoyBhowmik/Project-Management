// ==============================================================================
// src/actions/tasks.ts
// Production Enterprise Server Actions for Tasks, Schedules & Status Synchronization
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Task, TaskPriority } from '@/types/database';
import { logger } from '@/lib/logger/logger';
import {
  TaskInputSchema,
  UpdateTaskScheduleSchema,
  UpdateTaskStatusSchema,
  type TaskInput,
  type UpdateTaskScheduleInput,
  type UpdateTaskStatusInput,
  type ActionResponse as ServerActionResponse,
} from '@/lib/validation/action-schemas';

// ------------------------------------------------------------------------------
// 1. Create Task Server Action
// ------------------------------------------------------------------------------

export async function createTaskAction(
  rawInput: TaskInput
): Promise<ServerActionResponse<Task>> {
  const correlationId = `act-create-task-${Date.now()}`;

  try {
    // 1. Validate Input
    const validated = TaskInputSchema.safeParse(rawInput);
    if (!validated.success) {
      const errorMsg = validated.error.issues.map((i) => i.message).join(', ');
      logger.warn('Validation error in createTaskAction', {
        fn: 'createTaskAction',
        ctx: { issues: validated.error.issues },
      });
      return {
        success: false,
        error: errorMsg,
        details: validated.error.format(),
        correlation_id: correlationId,
      };
    }

    const input = validated.data;

    // 2. Authenticate Session
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('Unauthorized attempt in createTaskAction', {
        fn: 'createTaskAction',
        ctx: { authError: authError?.message },
      });
      return {
        success: false,
        error: 'Unauthorized: Please log in again to create tasks',
        correlation_id: correlationId,
      };
    }

    // 3. Compute duration or end date if missing
    let duration = input.duration_days ?? 1;
    let computedEndDate = input.end_date;

    if (!computedEndDate) {
      if (duration <= 1) {
        computedEndDate = input.start_date;
      } else {
        const start = new Date(input.start_date);
        start.setUTCDate(start.getUTCDate() + (duration - 1));
        computedEndDate = start.toISOString().split('T')[0];
      }
    } else if (input.duration_days === undefined) {
      const start = new Date(input.start_date);
      const end = new Date(computedEndDate);
      const diffTime = Math.max(0, end.getTime() - start.getTime());
      duration = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }

    // 4. Build sanitized insert payload
    const payload: any = {
      project_id: input.project_id,
      tenant_id: input.tenant_id,
      title: input.title.trim(),
      start_date: input.start_date,
      end_date: computedEndDate,
      duration_days: duration,
      priority: input.priority,
      status: input.status,
      description: input.description?.trim() || null,
      is_milestone: input.is_milestone || duration === 0,
      progress: 0,
      progress_percent: 0,
      order_index: 0,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (input.task_code && input.task_code.trim()) {
      payload.task_code = input.task_code.trim().toUpperCase();
    }

    // 5. Execute Supabase Insert
    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select('*, assignees:task_assignees(*, user:profiles(*))')
      .single();

    if (error) {
      logger.error('Database error in createTaskAction', {
        fn: 'createTaskAction',
        ctx: { code: error.code, message: error.message, details: error.details },
      });
      return {
        success: false,
        error: error.message || 'Database rejected task creation',
        details: error.details || error.hint || error.code,
        correlation_id: correlationId,
      };
    }

    // 6. Handle optional initial assignees
    if (input.assignee_ids && input.assignee_ids.length > 0 && data?.id) {
      const assigneeRows = input.assignee_ids.map((uid) => ({
        task_id: data.id,
        user_id: uid,
        allocated_hours_per_day: 8,
        allocation_percent: 100,
        role: 'Assignee',
      }));
      await supabase.from('task_assignees').insert(assigneeRows);
    }

    // 7. Format return task (ensure code is mapped from task_code)
    const formattedTask: Task = {
      ...data,
      code: data.task_code || data.code,
      task_code: data.task_code || data.code,
    };

    // 8. Revalidate routes
    try {
      revalidatePath(`/projects/${input.project_id}`);
      revalidatePath('/');
    } catch {
      // Ignored outside Next.js request cycle
    }

    return {
      success: true,
      task: formattedTask,
      data: formattedTask,
      correlation_id: correlationId,
    };
  } catch (err: any) {
    logger.error('Unhandled exception in createTaskAction', {
      fn: 'createTaskAction',
      err,
    });
    return {
      success: false,
      error: err?.message || 'Internal server error while creating task',
      details: err?.stack,
      correlation_id: correlationId,
    };
  }
}

// ------------------------------------------------------------------------------
// 2. Update Task Schedule Action (For Gantt Drag & Resize)
// ------------------------------------------------------------------------------

export async function updateTaskScheduleAction(params: {
  taskId: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  projectId?: string;
}): Promise<ServerActionResponse<Task>> {
  const correlationId = `act-update-sched-${Date.now()}`;

  try {
    const validated = UpdateTaskScheduleSchema.safeParse(params);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(', '),
        correlation_id: correlationId,
      };
    }

    const { taskId, startDate, endDate, durationDays, projectId } = validated.data;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'Unauthorized: Please log in again',
        correlation_id: correlationId,
      };
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({
        start_date: startDate,
        end_date: endDate,
        duration_days: durationDays,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update task schedule', {
        fn: 'updateTaskScheduleAction',
        ctx: { taskId, error: error.message },
      });
      return {
        success: false,
        error: error.message,
        details: error.details,
        correlation_id: correlationId,
      };
    }

    if (projectId) {
      try {
        revalidatePath(`/projects/${projectId}`);
      } catch {}
    }

    return {
      success: true,
      task: {
        ...data,
        code: data.task_code || data.code,
        task_code: data.task_code || data.code,
      },
      correlation_id: correlationId,
    };
  } catch (err: any) {
    logger.error('Exception in updateTaskScheduleAction', {
      fn: 'updateTaskScheduleAction',
      err,
    });
    return {
      success: false,
      error: err?.message || 'Failed to update task schedule',
      correlation_id: correlationId,
    };
  }
}

// ------------------------------------------------------------------------------
// 3. Update Task Status Action (For Kanban Drag-and-Drop)
// ------------------------------------------------------------------------------

export async function updateTaskStatusAction(params: {
  taskId: string;
  status: string;
  projectId?: string;
}): Promise<ServerActionResponse<Task>> {
  const correlationId = `act-update-status-${Date.now()}`;

  try {
    const validated = UpdateTaskStatusSchema.safeParse(params);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(', '),
        correlation_id: correlationId,
      };
    }

    const { taskId, status, projectId } = validated.data;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'Unauthorized: Please log in again',
        correlation_id: correlationId,
      };
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update task status in database', {
        fn: 'updateTaskStatusAction',
        ctx: { taskId, status, error: error.message },
      });
      return {
        success: false,
        error: error.message,
        details: error.details,
        correlation_id: correlationId,
      };
    }

    if (projectId) {
      try {
        revalidatePath(`/projects/${projectId}`);
      } catch {}
    }

    return {
      success: true,
      task: {
        ...data,
        code: data.task_code || data.code,
        task_code: data.task_code || data.code,
      },
      correlation_id: correlationId,
    };
  } catch (err: any) {
    logger.error('Exception in updateTaskStatusAction', {
      fn: 'updateTaskStatusAction',
      err,
    });
    return {
      success: false,
      error: err?.message || 'Failed to update task status',
      correlation_id: correlationId,
    };
  }
}

// ------------------------------------------------------------------------------
// 4. Get Tenant Members Action (Security Definer RPC)
// ------------------------------------------------------------------------------

export async function getTenantMembersAction(tenantId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('get_tenant_members', {
      p_tenant_id: tenantId,
    });

    if (error) {
      logger.warn('Failed get_tenant_members RPC, falling back to query', {
        fn: 'getTenantMembersAction',
        ctx: { error: error.message },
      });
      const { data: fallbackData } = await supabase
        .from('tenant_memberships')
        .select('id, user_id, role, profile:profiles(id, email, full_name, avatar_url)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      return (fallbackData || []).map((m: any) => ({
        id: m.profile?.id || m.user_id,
        email: m.profile?.email || '',
        full_name: m.profile?.full_name || 'Member',
        avatar_url: m.profile?.avatar_url || '',
        role: m.role || 'member',
      }));
    }

    return data || [];
  } catch (err) {
    logger.error('Exception in getTenantMembersAction', {
      fn: 'getTenantMembersAction',
      err,
    });
    return [];
  }
}
