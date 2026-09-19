// ==============================================================================
// src/actions/trash.ts
// Production Server Actions for Universal Soft-Delete Recycle Bin & Governance
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SoftDeletedItem } from '@/types/database';
import { logger } from '@/lib/logger/logger';
import type { ActionResponse } from '@/lib/validation/action-schemas';

export async function softDeleteEntityAction(
  entityType: 'task' | 'project' | 'phase' | 'document',
  entityId: string,
  tenantId: string,
  projectId?: string
): Promise<ActionResponse<void>> {
  const correlationId = `act-soft-delete-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const table = entityType === 'task' ? 'tasks'
      : entityType === 'project' ? 'projects'
      : entityType === 'phase' ? 'phases'
      : 'project_documents';

    const { error } = await supabase
      .from(table)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id || null,
      })
      .eq('id', entityId);

    if (error) return { success: false, error: error.message, correlation_id: correlationId };

    if (projectId) revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/settings/trash`);
    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to soft delete item', correlation_id: correlationId };
  }
}

export async function restoreEntityAction(
  entityType: 'task' | 'project' | 'phase' | 'document',
  entityId: string,
  tenantId: string,
  projectId?: string
): Promise<ActionResponse<void>> {
  const correlationId = `act-restore-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('restore_soft_deleted_entity', {
      p_entity_type: entityType,
      p_entity_id: entityId,
    });

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    if (!data) return { success: false, error: 'Entity restore returned false', correlation_id: correlationId };

    if (projectId) revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/settings/trash`);
    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to restore item', correlation_id: correlationId };
  }
}

export async function permanentDeleteEntityAction(
  entityType: 'task' | 'project' | 'phase' | 'document',
  entityId: string,
  tenantId: string,
  projectId?: string
): Promise<ActionResponse<void>> {
  const correlationId = `act-perm-del-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();

    if (entityType === 'task') {
      // 1. Cascading cleanup of dependent task relationships
      await Promise.all([
        supabase.from('task_assignees').delete().eq('task_id', entityId),
        supabase.from('task_comments').delete().eq('task_id', entityId),
        supabase.from('task_activity_log').delete().eq('task_id', entityId),
        supabase.from('task_attachments').delete().eq('task_id', entityId),
        supabase.from('document_task_links').delete().eq('task_id', entityId),
        supabase.from('task_dependencies').delete().or(`predecessor_id.eq.${entityId},successor_id.eq.${entityId}`),
      ]);
      const { error } = await supabase.from('tasks').delete().eq('id', entityId);
      if (error) return { success: false, error: error.message, correlation_id: correlationId };
    } else if (entityType === 'project') {
      // 2. Cascading cleanup of project entities
      await Promise.all([
        supabase.from('task_dependencies').delete().eq('project_id', entityId),
        supabase.from('tasks').delete().eq('project_id', entityId),
        supabase.from('project_sprints').delete().eq('project_id', entityId),
        supabase.from('project_documents').delete().eq('project_id', entityId),
        supabase.from('project_phases').delete().eq('project_id', entityId),
        supabase.from('project_budgets').delete().eq('project_id', entityId),
        supabase.from('project_members').delete().eq('project_id', entityId),
        supabase.from('project_guest_access').delete().eq('project_id', entityId),
      ]);
      const { error } = await supabase.from('projects').delete().eq('id', entityId);
      if (error) return { success: false, error: error.message, correlation_id: correlationId };
    } else if (entityType === 'document') {
      await supabase.from('document_task_links').delete().eq('document_id', entityId);
      const { error } = await supabase.from('project_documents').delete().eq('id', entityId);
      if (error) return { success: false, error: error.message, correlation_id: correlationId };
    } else {
      const { error } = await supabase.from('phases').delete().eq('id', entityId);
      if (error) return { success: false, error: error.message, correlation_id: correlationId };
    }

    if (projectId) revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/settings/trash`);
    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    logger.error('Exception in permanentDeleteEntityAction', { fn: 'permanentDeleteEntityAction', err });
    return { success: false, error: err?.message || 'Failed to permanently delete item', correlation_id: correlationId };
  }
}

export async function getTrashItemsAction(tenantId: string): Promise<ActionResponse<SoftDeletedItem[]>> {
  const correlationId = `act-get-trash-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const items: SoftDeletedItem[] = [];

    // 1. Fetch soft-deleted tasks without ambiguous profile foreign key joins
    const { data: deletedTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, task_code, deleted_at, deleted_by, project_id, project:projects(name)')
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (tasksError) {
      logger.warn('Failed querying deleted tasks in getTrashItemsAction', {
        fn: 'getTrashItemsAction',
        ctx: { tenantId, error: tasksError.message },
      });
    }

    // 2. Fetch soft-deleted projects
    const { data: deletedProjects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, code, deleted_at, deleted_by')
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (projectsError) {
      logger.warn('Failed querying deleted projects in getTrashItemsAction', {
        fn: 'getTrashItemsAction',
        ctx: { tenantId, error: projectsError.message },
      });
    }

    // 3. Fetch soft-deleted wiki documents
    const { data: deletedDocs, error: docsError } = await supabase
      .from('project_documents')
      .select('id, title, deleted_at, deleted_by, project_id, project:projects(name)')
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (docsError) {
      logger.warn('Failed querying deleted documents in getTrashItemsAction', {
        fn: 'getTrashItemsAction',
        ctx: { tenantId, error: docsError.message },
      });
    }

    // 4. Batch resolve deleter names from profiles to guarantee 0 ambiguous join failures
    const allRawItems = [
      ...(deletedTasks || []),
      ...(deletedProjects || []),
      ...(deletedDocs || []),
    ];

    const deleterIds = Array.from(
      new Set(allRawItems.map((item) => item.deleted_by).filter((id): id is string => Boolean(id)))
    );

    const deleterNameMap = new Map<string, string>();
    if (deleterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', deleterIds);

      profiles?.forEach((p) => {
        deleterNameMap.set(p.id, p.full_name || p.email || 'Workspace Admin');
      });
    }

    // Populate Tasks
    deletedTasks?.forEach((t: any) => {
      items.push({
        id: t.id,
        entity_type: 'task',
        title: t.title,
        code: t.task_code,
        deleted_at: t.deleted_at,
        deleted_by: t.deleted_by,
        deleter_name: (t.deleted_by && deleterNameMap.get(t.deleted_by)) || 'System Admin',
        tenant_id: tenantId,
        project_id: t.project_id,
        project_name: t.project?.name,
      });
    });

    // Populate Projects
    deletedProjects?.forEach((p: any) => {
      items.push({
        id: p.id,
        entity_type: 'project',
        title: p.name,
        code: p.code,
        deleted_at: p.deleted_at,
        deleted_by: p.deleted_by,
        deleter_name: (p.deleted_by && deleterNameMap.get(p.deleted_by)) || 'System Admin',
        tenant_id: tenantId,
      });
    });

    // Populate Documents
    deletedDocs?.forEach((d: any) => {
      items.push({
        id: d.id,
        entity_type: 'document',
        title: d.title,
        deleted_at: d.deleted_at,
        deleted_by: d.deleted_by,
        deleter_name: (d.deleted_by && deleterNameMap.get(d.deleted_by)) || 'System Admin',
        tenant_id: tenantId,
        project_id: d.project_id,
        project_name: d.project?.name,
      });
    });

    // Sort by deleted_at descending
    items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    return { success: true, data: items, correlation_id: correlationId };
  } catch (err: any) {
    logger.error('Exception in getTrashItemsAction', { fn: 'getTrashItemsAction', err });
    return { success: false, error: err?.message || 'Failed to fetch recycle bin', correlation_id: correlationId };
  }
}
