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
    const table = entityType === 'task' ? 'tasks'
      : entityType === 'project' ? 'projects'
      : entityType === 'phase' ? 'phases'
      : 'project_documents';

    const { error } = await supabase.from(table).delete().eq('id', entityId);
    if (error) return { success: false, error: error.message, correlation_id: correlationId };

    if (projectId) revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/settings/trash`);
    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to permanently delete item', correlation_id: correlationId };
  }
}

export async function getTrashItemsAction(tenantId: string): Promise<ActionResponse<SoftDeletedItem[]>> {
  const correlationId = `act-get-trash-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const items: SoftDeletedItem[] = [];

    // 1. Deleted tasks
    const { data: deletedTasks } = await supabase
      .from('tasks')
      .select('id, title, task_code, deleted_at, deleted_by, project_id, project:projects(name), deleter:profiles(full_name)')
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    deletedTasks?.forEach((t: any) => {
      items.push({
        id: t.id,
        entity_type: 'task',
        title: t.title,
        code: t.task_code,
        deleted_at: t.deleted_at,
        deleted_by: t.deleted_by,
        deleter_name: t.deleter?.full_name || 'System Admin',
        tenant_id: tenantId,
        project_id: t.project_id,
        project_name: t.project?.name,
      });
    });

    // 2. Deleted projects
    const { data: deletedProjects } = await supabase
      .from('projects')
      .select('id, name, code, deleted_at, deleted_by, deleter:profiles(full_name)')
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    deletedProjects?.forEach((p: any) => {
      items.push({
        id: p.id,
        entity_type: 'project',
        title: p.name,
        code: p.code,
        deleted_at: p.deleted_at,
        deleted_by: p.deleted_by,
        deleter_name: p.deleter?.full_name || 'System Admin',
        tenant_id: tenantId,
      });
    });

    // 3. Deleted wiki documents
    const { data: deletedDocs } = await supabase
      .from('project_documents')
      .select('id, title, deleted_at, deleted_by, project_id, project:projects(name), deleter:profiles(full_name)')
      .eq('tenant_id', tenantId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    deletedDocs?.forEach((d: any) => {
      items.push({
        id: d.id,
        entity_type: 'document',
        title: d.title,
        deleted_at: d.deleted_at,
        deleted_by: d.deleted_by,
        deleter_name: d.deleter?.full_name || 'System Admin',
        tenant_id: tenantId,
        project_id: d.project_id,
        project_name: d.project?.name,
      });
    });

    // Sort by deleted_at descending
    items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    return { success: true, data: items, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch recycle bin', correlation_id: correlationId };
  }
}
