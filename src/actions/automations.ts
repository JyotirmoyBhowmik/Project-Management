// ==============================================================================
// src/actions/automations.ts
// Production Server Actions for No-Code Workflow Automations & Webhooks
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { TenantAutomation, AutomationExecutionLog, TenantWebhook } from '@/types/database';
import { logger } from '@/lib/logger/logger';
import {
  CreateAutomationSchema,
  type CreateAutomationInput,
  type ActionResponse,
} from '@/lib/validation/action-schemas';
import { evaluateAutomationCondition } from '@/lib/automations/condition-evaluator';

export async function createAutomationAction(rawInput: CreateAutomationInput): Promise<ActionResponse<TenantAutomation>> {
  const correlationId = `act-create-auto-${Date.now()}`;
  try {
    const parsed = CreateAutomationSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues.map((i) => i.message).join(', '), correlation_id: correlationId };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('tenant_automations')
      .insert({
        tenant_id: parsed.data.tenant_id,
        project_id: parsed.data.project_id || null,
        name: parsed.data.name,
        is_active: true,
        trigger_type: parsed.data.trigger_type,
        trigger_config: parsed.data.trigger_config,
        conditions: parsed.data.conditions,
        actions: parsed.data.actions,
        created_by: user?.id || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    revalidatePath(`/settings/automations`);
    return { success: true, data: data as TenantAutomation, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create automation', correlation_id: correlationId };
  }
}

export async function toggleAutomationAction(automationId: string, isActive: boolean): Promise<ActionResponse<void>> {
  const correlationId = `act-toggle-auto-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('tenant_automations')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', automationId);

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    revalidatePath(`/settings/automations`);
    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}

export async function deleteAutomationAction(automationId: string): Promise<ActionResponse<void>> {
  const correlationId = `act-del-auto-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('tenant_automations')
      .delete()
      .eq('id', automationId);

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    revalidatePath(`/settings/automations`);
    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}

export async function getTenantAutomationsAction(tenantId: string): Promise<ActionResponse<{ automations: TenantAutomation[]; logs: AutomationExecutionLog[] }>> {
  const correlationId = `act-get-autos-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();

    const { data: automations, error: autoError } = await supabase
      .from('tenant_automations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (autoError) return { success: false, error: autoError.message, correlation_id: correlationId };

    const { data: logs } = await supabase
      .from('automation_execution_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('triggered_at', { ascending: false })
      .limit(30);

    return {
      success: true,
      data: {
        automations: (automations || []) as TenantAutomation[],
        logs: (logs || []) as AutomationExecutionLog[],
      },
      correlation_id: correlationId,
    };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}


export async function dispatchAutomationTriggerAction(
  tenantId: string,
  triggerType: string,
  eventPayload: { taskId: string; projectId: string; [key: string]: any }
): Promise<ActionResponse<{ executedCount: number }>> {
  const correlationId = `act-dispatch-auto-${Date.now()}`;
  try {
    // 0. Automation loop & cascading recursion guard
    const currentDepth = Number(eventPayload._depth || 0);
    if (currentDepth > 3) {
      logger.warn('Automation recursion loop guard triggered: max depth exceeded', {
        correlationId,
        ctx: {
          currentDepth,
          taskId: eventPayload.taskId,
        },
      });
      return { success: true, data: { executedCount: 0 }, correlation_id: correlationId };
    }

    const supabase = await createServerSupabaseClient();

    // 1. Fetch matching active automations
    const { data: automations } = await supabase
      .from('tenant_automations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('trigger_type', triggerType)
      .eq('is_active', true);

    if (!automations || automations.length === 0) {
      return { success: true, data: { executedCount: 0 }, correlation_id: correlationId };
    }

    let executedCount = 0;

    for (const rule of automations) {
      // 2. Evaluate conditions
      let conditionsMet = true;
      if (Array.isArray(rule.conditions)) {
        for (const cond of rule.conditions) {
          if (!evaluateAutomationCondition(cond, eventPayload)) {
            conditionsMet = false;
            break;
          }
        }
      }

      if (!conditionsMet) {
        await supabase.from('automation_execution_logs').insert({
          tenant_id: tenantId,
          automation_id: rule.id,
          status: 'skipped',
          log_details: { reason: 'Conditions not met', eventPayload },
        });
        continue;
      }

      // 3. Execute actions
      const actionResults = [];
      for (const act of rule.actions || []) {
        if (act.action_type === 'update_field' && eventPayload.taskId) {
          const { error } = await supabase
            .from('tasks')
            .update(act.payload)
            .eq('id', eventPayload.taskId);
          actionResults.push({ action: 'update_field', success: !error });
        } else if (act.action_type === 'assign_user' && eventPayload.taskId && act.payload.user_id) {
          const { error: assignErr } = await supabase.from('task_assignees').upsert({
            tenant_id: tenantId,
            task_id: eventPayload.taskId,
            user_id: act.payload.user_id,
            allocation_percent: 100,
            allocated_hours_per_day: 8,
            role: 'Assignee',
          });
          actionResults.push({ action: 'assign_user', success: !assignErr });
        }
      }

      await supabase.from('automation_execution_logs').insert({
        tenant_id: tenantId,
        automation_id: rule.id,
        status: 'success',
        log_details: { actionResults, eventPayload },
      });

      executedCount++;
    }

    return { success: true, data: { executedCount }, correlation_id: correlationId };
  } catch (err: any) {
    logger.error('Error dispatching automation', { correlationId, err });
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}

export async function createWebhookAction(
  tenantId: string,
  targetUrl: string,
  subscribedEvents: string[]
): Promise<ActionResponse<TenantWebhook>> {
  const correlationId = `act-create-hook-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const secretHash = `sec_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;

    const { data, error } = await supabase
      .from('tenant_webhooks')
      .insert({
        tenant_id: tenantId,
        target_url: targetUrl,
        secret_hash: secretHash,
        subscribed_events: subscribedEvents,
        is_active: true,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    revalidatePath(`/settings/automations`);
    return { success: true, data: data as TenantWebhook, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}

export async function getTenantWebhooksAction(tenantId: string): Promise<ActionResponse<TenantWebhook[]>> {
  const correlationId = `act-get-hooks-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('tenant_webhooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    return { success: true, data: (data || []) as TenantWebhook[], correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}
