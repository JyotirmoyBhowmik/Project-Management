// ==============================================================================
// src/actions/lifecycle.ts
// Production Server Actions for Comprehensive Lifecycle Deletion Architecture
// Task Dependency Healing, Project Verification Guard & Atomic Tenant Purge RPC
// Only exports async functions to comply with Next.js 15 Server Action invariants
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger/logger';
import {
  DeleteTaskSchema,
  DeleteProjectSchema,
  PurgeTenantSchema,
  type DeleteTaskInput,
  type DeleteProjectInput,
  type PurgeTenantInput,
  type ActionResponse,
} from '@/lib/validation/action-schemas';

// ------------------------------------------------------------------------------
// 1. Task Deletion Engine (With Intelligent Dependency Healing)
// ------------------------------------------------------------------------------

export async function deleteTaskAction(
  rawInput: DeleteTaskInput
): Promise<ActionResponse<{ bridgedDependenciesCount: number; deletedTaskId: string }>> {
  const correlationId = `act-delete-task-${Date.now()}`;
  try {
    const parsed = DeleteTaskSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
        correlation_id: correlationId,
      };
    }

    const { task_id, tenant_id, project_id, dependency_strategy, is_hard_delete } = parsed.data;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized: Session required', correlation_id: correlationId };
    }

    // 1. Snapshot task metadata before deletion
    const { data: taskSnapshot } = await supabase
      .from('tasks')
      .select('id, title, task_code, status, priority, duration_days')
      .eq('id', task_id)
      .maybeSingle();

    // 2. Fetch existing dependency edges connected to this task
    const { data: incomingDeps } = await supabase
      .from('task_dependencies')
      .select('*')
      .eq('successor_id', task_id)
      .eq('project_id', project_id);

    const { data: outgoingDeps } = await supabase
      .from('task_dependencies')
      .select('*')
      .eq('predecessor_id', task_id)
      .eq('project_id', project_id);

    let bridgedCount = 0;

    // 3. Dependency Healing: Bridge Predecessors directly to Successors
    if (dependency_strategy === 'bridge' && incomingDeps && outgoingDeps) {
      const bridgesToCreate = [];

      for (const inc of incomingDeps) {
        for (const out of outgoingDeps) {
          // Avoid self-loops
          if (inc.predecessor_id !== out.successor_id) {
            bridgesToCreate.push({
              tenant_id,
              project_id,
              predecessor_id: inc.predecessor_id,
              successor_id: out.successor_id,
              dep_type: 'FS',
              lag_days: Math.max(inc.lag_days || 0, out.lag_days || 0),
            });
          }
        }
      }

      if (bridgesToCreate.length > 0) {
        // Insert new bridged edges, ignoring duplicates
        const { error: bridgeError } = await supabase
          .from('task_dependencies')
          .upsert(bridgesToCreate, { onConflict: 'predecessor_id,successor_id', ignoreDuplicates: true });

        if (!bridgeError) {
          bridgedCount = bridgesToCreate.length;
        }
      }
    }

    // 4. Sever all existing edges attached to this task
    await supabase
      .from('task_dependencies')
      .delete()
      .or(`predecessor_id.eq.${task_id},successor_id.eq.${task_id}`);

    // 5. Clean up task assignees, comments, time logs, links
    await Promise.all([
      supabase.from('task_assignees').delete().eq('task_id', task_id),
      supabase.from('task_comments').delete().eq('task_id', task_id),
      supabase.from('task_activity_log').delete().eq('task_id', task_id),
      supabase.from('task_attachments').delete().eq('task_id', task_id),
      supabase.from('document_task_links').delete().eq('task_id', task_id),
    ]);

    // 6. Delete or Soft-Delete Task
    if (is_hard_delete) {
      const { error: delError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task_id)
        .eq('tenant_id', tenant_id);

      if (delError) {
        return { success: false, error: delError.message, correlation_id: correlationId };
      }
    } else {
      const { error: softError } = await supabase
        .from('tasks')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', task_id)
        .eq('tenant_id', tenant_id);

      if (softError) {
        return { success: false, error: softError.message, correlation_id: correlationId };
      }
    }

    // 7. Record audit log entry
    await supabase.from('audit_logs').insert({
      tenant_id,
      actor_id: user.id,
      action: 'TASK_DELETED',
      entity_type: 'task',
      entity_id: task_id,
      details: {
        task: taskSnapshot,
        strategy: dependency_strategy,
        bridged_count: bridgedCount,
        is_hard_delete,
      },
    });

    try {
      revalidatePath(`/projects/${project_id}`);
      revalidatePath('/');
    } catch {}

    return {
      success: true,
      data: { bridgedDependenciesCount: bridgedCount, deletedTaskId: task_id },
      correlation_id: correlationId,
    };
  } catch (err: any) {
    logger.error('Exception in deleteTaskAction', { fn: 'deleteTaskAction', err });
    return { success: false, error: err?.message || 'Failed to delete task', correlation_id: correlationId };
  }
}

// ------------------------------------------------------------------------------
// 2. Project Deletion Engine (With Code Confirmation Guard)
// ------------------------------------------------------------------------------

export async function deleteProjectAction(
  rawInput: DeleteProjectInput
): Promise<ActionResponse<{ deletedProjectId: string }>> {
  const correlationId = `act-delete-proj-${Date.now()}`;
  try {
    const parsed = DeleteProjectSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
        correlation_id: correlationId,
      };
    }

    const { project_id, tenant_id, confirm_project_code, is_hard_delete } = parsed.data;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized: Session required', correlation_id: correlationId };
    }

    // 1. Fetch project to verify code confirmation
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id, name, code, tenant_id')
      .eq('id', project_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (projError || !project) {
      return { success: false, error: 'Project not found or unauthorized', correlation_id: correlationId };
    }

    const expectedCode = (project.code || project.name || '').trim().toUpperCase();
    const providedCode = confirm_project_code.trim().toUpperCase();

    if (expectedCode !== providedCode && providedCode !== project.id) {
      return {
        success: false,
        error: `Confirmation mismatch. You typed '${confirm_project_code}', but expected project code '${expectedCode}'.`,
        correlation_id: correlationId,
      };
    }

    // 2. Execute deletion cascade
    if (is_hard_delete) {
      // Cascading wipe
      await Promise.all([
        supabase.from('task_dependencies').delete().eq('project_id', project_id),
        supabase.from('tasks').delete().eq('project_id', project_id),
        supabase.from('project_sprints').delete().eq('project_id', project_id),
        supabase.from('project_documents').delete().eq('project_id', project_id),
        supabase.from('project_phases').delete().eq('project_id', project_id),
        supabase.from('project_budgets').delete().eq('project_id', project_id),
      ]);

      const { error: delError } = await supabase
        .from('projects')
        .delete()
        .eq('id', project_id);

      if (delError) {
        return { success: false, error: delError.message, correlation_id: correlationId };
      }
    } else {
      // Soft-delete project and its tasks
      const now = new Date().toISOString();
      await supabase
        .from('tasks')
        .update({ deleted_at: now, deleted_by: user.id })
        .eq('project_id', project_id);

      const { error: softError } = await supabase
        .from('projects')
        .update({ deleted_at: now, deleted_by: user.id })
        .eq('id', project_id);

      if (softError) {
        return { success: false, error: softError.message, correlation_id: correlationId };
      }
    }

    // 3. Record audit log
    await supabase.from('audit_logs').insert({
      tenant_id,
      actor_id: user.id,
      action: 'PROJECT_DELETED',
      entity_type: 'project',
      entity_id: project_id,
      details: { project_code: project.code, is_hard_delete },
    });

    try {
      revalidatePath('/projects');
      revalidatePath('/');
    } catch {}

    return {
      success: true,
      data: { deletedProjectId: project_id },
      correlation_id: correlationId,
    };
  } catch (err: any) {
    logger.error('Exception in deleteProjectAction', { fn: 'deleteProjectAction', err });
    return { success: false, error: err?.message || 'Failed to delete project', correlation_id: correlationId };
  }
}

// ------------------------------------------------------------------------------
// 3. Tenant Deletion Engine (SuperAdmin Only with Atomic RPC)
// ------------------------------------------------------------------------------

export async function purgeTenantAction(
  rawInput: PurgeTenantInput
): Promise<ActionResponse<{ purgedTenantId: string }>> {
  const correlationId = `act-purge-tenant-${Date.now()}`;
  try {
    const parsed = PurgeTenantSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join(', '),
        correlation_id: correlationId,
      };
    }

    const { tenant_id, confirm_slug } = parsed.data;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized: Session required', correlation_id: correlationId };
    }

    // Verify SuperAdmin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_superadmin')
      .eq('id', user.id)
      .maybeSingle();

    const isSuperAdmin = Boolean(profile?.is_superadmin) || user.email === 'admin@jyotirmoyb.com';
    if (!isSuperAdmin) {
      return {
        success: false,
        error: 'Forbidden: Only platform SuperAdmins can execute tenant purge.',
        correlation_id: correlationId,
      };
    }

    // Verify Tenant Slug
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, slug')
      .eq('id', tenant_id)
      .single();

    if (tenantErr || !tenant) {
      return { success: false, error: 'Tenant not found', correlation_id: correlationId };
    }

    const expectedSlug = (tenant.slug || tenant.name || '').trim().toLowerCase();
    const providedSlug = confirm_slug.trim().toLowerCase();

    if (expectedSlug !== providedSlug) {
      return {
        success: false,
        error: `Confirmation mismatch. You typed '${confirm_slug}', but expected tenant slug '${expectedSlug}'.`,
        correlation_id: correlationId,
      };
    }

    // Invoke atomic PostgreSQL purge procedure
    const { error: rpcError } = await supabase.rpc('purge_tenant_cascade', {
      p_tenant_id: tenant_id,
    });

    if (rpcError) {
      logger.error('Failed to execute purge_tenant_cascade RPC', {
        fn: 'purgeTenantAction',
        ctx: { tenant_id, error: rpcError.message },
      });
      return { success: false, error: rpcError.message, correlation_id: correlationId };
    }

    try {
      revalidatePath('/admin/superadmin');
      revalidatePath('/admin/multisite');
      revalidatePath('/');
    } catch {}

    return {
      success: true,
      data: { purgedTenantId: tenant_id },
      correlation_id: correlationId,
    };
  } catch (err: any) {
    logger.error('Exception in purgeTenantAction', { fn: 'purgeTenantAction', err });
    return { success: false, error: err?.message || 'Failed to purge tenant', correlation_id: correlationId };
  }
}
