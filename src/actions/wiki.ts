// ==============================================================================
// src/actions/wiki.ts
// Production Server Actions for Living Documentation, Wiki Trees & Task Links
// Robust Profile Hydration: Disambiguates foreign keys to prevent PostgREST PGRST200
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProjectDocument, Task, UserProfile } from '@/types/database';
import { logger } from '@/lib/logger/logger';
import {
  CreateDocSchema,
  type CreateDocInput,
  type ActionResponse,
} from '@/lib/validation/action-schemas';

export async function createDocumentAction(rawInput: CreateDocInput): Promise<ActionResponse<ProjectDocument>> {
  const correlationId = `act-create-doc-${Date.now()}`;
  try {
    const parsed = CreateDocSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues.map((i) => i.message).join(', '), correlation_id: correlationId };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('project_documents')
      .insert({
        tenant_id: parsed.data.tenant_id,
        project_id: parsed.data.project_id,
        parent_doc_id: parsed.data.parent_doc_id || null,
        title: parsed.data.title,
        content_json: parsed.data.content_json,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to create document in database', { correlationId, err: error.message });
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    // Hydrate author profile safely
    let author: UserProfile | undefined = undefined;
    if (user?.id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('id', user.id)
        .maybeSingle();
      if (prof) author = prof as UserProfile;
    }

    revalidatePath(`/projects/${parsed.data.project_id}`);
    return {
      success: true,
      data: { ...data, author } as ProjectDocument,
      correlation_id: correlationId,
    };
  } catch (err: any) {
    logger.error('Exception in createDocumentAction', { correlationId, err: err?.message });
    return { success: false, error: err?.message || 'Failed to create document', correlation_id: correlationId };
  }
}

export async function updateDocumentContentAction(
  docId: string,
  updates: { title?: string; content_json?: Record<string, any>; projectId?: string }
): Promise<ActionResponse<ProjectDocument>> {
  const correlationId = `act-update-doc-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null,
    };
    if (updates.title) payload.title = updates.title;
    if (updates.content_json) payload.content_json = updates.content_json;

    const { data, error } = await supabase
      .from('project_documents')
      .update(payload)
      .eq('id', docId)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to update document', { correlationId, err: error.message });
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    // Hydrate author profile safely
    let author: UserProfile | undefined = undefined;
    if (data.created_by) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('id', data.created_by)
        .maybeSingle();
      if (prof) author = prof as UserProfile;
    }

    if (updates.projectId) revalidatePath(`/projects/${updates.projectId}`);
    return {
      success: true,
      data: { ...data, author } as ProjectDocument,
      correlation_id: correlationId,
    };
  } catch (err: any) {
    logger.error('Exception in updateDocumentContentAction', { correlationId, err: err?.message });
    return { success: false, error: err?.message || 'Failed to update document', correlation_id: correlationId };
  }
}

export async function getDocumentTreeAction(projectId: string): Promise<ActionResponse<ProjectDocument[]>> {
  const correlationId = `act-get-docs-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();

    // Query documents without ambiguous profile embeds to avoid PGRST200
    const { data, error } = await supabase
      .from('project_documents')
      .select('*, links:document_task_links(task_id, task:tasks(id, title, task_code, status))')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch project documents', { correlationId, err: error.message });
      return { success: false, error: error.message, correlation_id: correlationId };
    }

    // Batch hydrate author profiles safely
    const authorIds = Array.from(
      new Set(
        (data || [])
          .map((d: any) => d.created_by)
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    const profileMap = new Map<string, UserProfile>();
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', authorIds);

      (profiles || []).forEach((p: any) => {
        profileMap.set(p.id, p as UserProfile);
      });
    }

    // Format into tree hierarchy
    const docs = (data || []).map((d: any) => ({
      ...d,
      author: d.created_by ? profileMap.get(d.created_by) || null : null,
      linked_tasks: (d.links || []).map((l: any) => l.task).filter(Boolean),
    }));

    const docMap = new Map<string, ProjectDocument>();
    const roots: ProjectDocument[] = [];

    docs.forEach((doc: any) => {
      docMap.set(doc.id, { ...doc, children: [] });
    });

    docs.forEach((doc: any) => {
      const node = docMap.get(doc.id)!;
      if (doc.parent_doc_id && docMap.has(doc.parent_doc_id)) {
        docMap.get(doc.parent_doc_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return { success: true, data: roots, correlation_id: correlationId };
  } catch (err: any) {
    logger.error('Exception in getDocumentTreeAction', { correlationId, err: err?.message });
    return { success: false, error: err?.message || 'Failed to fetch document tree', correlation_id: correlationId };
  }
}

export async function linkTaskToDocAction(docId: string, taskId: string, tenantId: string): Promise<ActionResponse<void>> {
  const correlationId = `act-link-task-doc-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('document_task_links')
      .upsert({ doc_id: docId, task_id: taskId, tenant_id: tenantId });

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}

export async function unlinkTaskFromDocAction(docId: string, taskId: string): Promise<ActionResponse<void>> {
  const correlationId = `act-unlink-task-doc-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('document_task_links')
      .delete()
      .eq('doc_id', docId)
      .eq('task_id', taskId);

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    return { success: true, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}
