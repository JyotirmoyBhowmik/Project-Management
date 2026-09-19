// ==============================================================================
// src/actions/timesheets.ts
// Production Server Actions for Time Tracking, Approvals & Financial EVM
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TaskTimeLog, EVMMetrics, TenantUserRate, ProjectBudget } from '@/types/database';
import { logger } from '@/lib/logger/logger';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  correlation_id?: string;
}

export const LogTimeSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  date_worked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  hours_spent: z.number().positive('Hours spent must be greater than zero').max(24, 'Cannot log more than 24 hours per day'),
  is_billable: z.boolean().default(true),
  description: z.string().max(1000).nullable().optional(),
});

export type LogTimeInput = z.infer<typeof LogTimeSchema>;

export async function logTimeAction(rawInput: LogTimeInput): Promise<ActionResponse<TaskTimeLog>> {
  const correlationId = `act-log-time-${Date.now()}`;
  try {
    const parsed = LogTimeSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
        correlation_id: correlationId,
      };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'User is unauthenticated', correlation_id: correlationId };
    }

    const { data, error } = await supabase
      .from('task_time_logs')
      .insert({
        tenant_id: parsed.data.tenant_id,
        project_id: parsed.data.project_id,
        task_id: parsed.data.task_id,
        user_id: user.id,
        date_worked: parsed.data.date_worked,
        hours_spent: parsed.data.hours_spent,
        is_billable: parsed.data.is_billable,
        description: parsed.data.description || null,
        approval_status: 'pending',
      })
      .select('*, user:profiles(id, full_name, email, avatar_url), task:tasks(id, title, task_code)')
      .single();

    if (error) {
      logger.error('Failed to log time entry', { correlationId, ctx: { error: error.message } });
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    revalidatePath(`/timesheets`);
    revalidatePath(`/projects/${parsed.data.project_id}`);

    return { success: true, data: data as TaskTimeLog, correlation_id: correlationId };
  } catch (err: any) {
    logger.error('Unexpected error in logTimeAction', { correlationId, err });
    return { success: false, error: err?.message || 'Internal server error', correlation_id: correlationId };
  }
}

export async function updateTimesheetApprovalAction(
  logIds: string[],
  status: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<ActionResponse<{ count: number }>> {
  const correlationId = `act-timesheet-approval-${Date.now()}`;
  try {
    if (!logIds || logIds.length === 0) {
      return { success: false, error: 'No time log IDs provided', correlation_id: correlationId };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'User is unauthenticated', correlation_id: correlationId };
    }

    const { data, error } = await supabase
      .from('task_time_logs')
      .update({
        approval_status: status,
        approved_by: user.id,
        rejection_reason: status === 'rejected' ? rejectionReason || 'Hours rejected by manager' : null,
        updated_at: new Date().toISOString(),
      })
      .in('id', logIds)
      .select('id');

    if (error) {
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    revalidatePath(`/timesheets`);
    return { success: true, data: { count: data?.length || 0 }, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update approvals', correlation_id: correlationId };
  }
}

export async function getTimesheetsAction(
  tenantId: string,
  options?: { projectId?: string; userId?: string; startDate?: string; endDate?: string }
): Promise<ActionResponse<TaskTimeLog[]>> {
  const correlationId = `act-get-timesheets-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from('task_time_logs')
      .select('*, user:profiles(id, full_name, email, avatar_url), task:tasks(id, title, task_code, duration_days)')
      .eq('tenant_id', tenantId)
      .order('date_worked', { ascending: false });

    if (options?.projectId) query = query.eq('project_id', options.projectId);
    if (options?.userId) query = query.eq('user_id', options.userId);
    if (options?.startDate) query = query.gte('date_worked', options.startDate);
    if (options?.endDate) query = query.lte('date_worked', options.endDate);

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    return { success: true, data: (data || []) as TaskTimeLog[], correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch timesheets', correlation_id: correlationId };
  }
}

export async function getProjectEVMMetricsAction(
  projectId: string,
  tenantId: string
): Promise<ActionResponse<EVMMetrics>> {
  const correlationId = `act-evm-metrics-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch Project Budget
    const { data: budgetData } = await supabase
      .from('project_budgets')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    const bac = Number(budgetData?.total_planned_budget) || 10000; // Default budget if not specified

    // 2. Fetch Tasks with progress & dates
    const { data: tasksData, error: taskError } = await supabase
      .from('tasks')
      .select('id, duration_days, progress, start_date, end_date')
      .eq('project_id', projectId)
      .is('deleted_at', null);

    if (taskError) {
      return { success: false, error: taskError.message, correlation_id: correlationId };
    }

    const tasks = tasksData || [];
    const totalDuration = tasks.reduce((sum, t) => sum + (Number(t.duration_days) || 1), 0) || 1;

    // Calculate Earned Value (EV)
    let weightedProgress = 0;
    let plannedProgress = 0;
    const nowStr = new Date().toISOString().split('T')[0];

    tasks.forEach((t) => {
      const weight = (Number(t.duration_days) || 1) / totalDuration;
      const progress = (Number(t.progress) || 0) / 100;
      weightedProgress += weight * progress;

      // Planned Value calculation based on schedule
      if (t.end_date && t.end_date <= nowStr) {
        plannedProgress += weight * 1.0;
      } else if (t.start_date && t.start_date <= nowStr && t.end_date) {
        // Linear schedule interpolation
        const start = new Date(t.start_date).getTime();
        const end = new Date(t.end_date).getTime();
        const now = new Date(nowStr).getTime();
        const ratio = Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
        plannedProgress += weight * ratio;
      }
    });

    const ev = Math.round(bac * weightedProgress * 100) / 100;
    const pv = Math.round(bac * Math.min(1, plannedProgress) * 100) / 100;

    // 3. Fetch Time Logs and Rates for Actual Cost (AC)
    const { data: timeLogs } = await supabase
      .from('task_time_logs')
      .select('hours_spent, is_billable, user_id')
      .eq('project_id', projectId);

    const { data: rates } = await supabase
      .from('tenant_user_rates')
      .select('user_id, hourly_cost_rate, hourly_billable_rate')
      .eq('tenant_id', tenantId);

    const rateMap = new Map<string, number>();
    rates?.forEach((r) => rateMap.set(r.user_id, Number(r.hourly_cost_rate) || 50));

    let actualCost = 0;
    let totalHours = 0;
    let billableHours = 0;

    timeLogs?.forEach((log) => {
      const h = Number(log.hours_spent) || 0;
      totalHours += h;
      if (log.is_billable) billableHours += h;
      const rate = rateMap.get(log.user_id) || 65; // standard fallback rate
      actualCost += h * rate;
    });

    actualCost = Math.round(actualCost * 100) / 100;
    if (actualCost === 0 && tasks.length > 0) {
      // If no time logs exist yet, estimate minimal actual cost proportional to progress
      actualCost = Math.round(ev * 0.85 * 100) / 100;
    }

    const cv = Math.round((ev - actualCost) * 100) / 100;
    const sv = Math.round((ev - pv) * 100) / 100;
    const cpi = actualCost > 0 ? Math.round((ev / actualCost) * 100) / 100 : 1.0;
    const spi = pv > 0 ? Math.round((ev / pv) * 100) / 100 : 1.0;
    const eac = cpi > 0 ? Math.round((bac / cpi) * 100) / 100 : bac;
    const etc = Math.max(0, Math.round((eac - actualCost) * 100) / 100);
    const vac = Math.round((bac - eac) * 100) / 100;

    const metrics: EVMMetrics = {
      planned_value: pv,
      earned_value: ev,
      actual_cost: actualCost,
      cost_variance: cv,
      schedule_variance: sv,
      cpi,
      spi,
      budget_at_completion: bac,
      estimate_at_completion: eac,
      estimate_to_complete: etc,
      variance_at_completion: vac,
      total_hours_logged: totalHours,
      billable_hours_logged: billableHours,
    };

    return { success: true, data: metrics, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to compute EVM metrics', correlation_id: correlationId };
  }
}

export async function setTenantRateAction(
  tenantId: string,
  userId: string,
  costRate: number,
  billableRate: number
): Promise<ActionResponse<TenantUserRate>> {
  const correlationId = `act-set-rate-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('tenant_user_rates')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          hourly_cost_rate: costRate,
          hourly_billable_rate: billableRate,
          effective_from: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,user_id,effective_from' }
      )
      .select()
      .single();

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    return { success: true, data: data as TenantUserRate, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}

export async function setProjectBudgetAction(
  tenantId: string,
  projectId: string,
  budget: number,
  currency = 'USD',
  budgetType: 'fixed' | 'time_and_materials' = 'fixed'
): Promise<ActionResponse<ProjectBudget>> {
  const correlationId = `act-set-budget-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('project_budgets')
      .upsert(
        {
          tenant_id: tenantId,
          project_id: projectId,
          total_planned_budget: budget,
          currency,
          budget_type: budgetType,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id' }
      )
      .select()
      .single();

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: data as ProjectBudget, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}
