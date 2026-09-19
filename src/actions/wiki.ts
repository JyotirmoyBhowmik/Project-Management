// ==============================================================================
// src/actions/wiki.ts
// Production Server Actions for Living Documentation, Wiki Trees & Task Links
// ==============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProjectDocument, DocumentTaskLink, Task } from '@/types/database';
import { logger } from '@/lib/logger/logger';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  correlation_id?: string;
}

export const CreateDocSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  parent_doc_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1, 'Document title is required').max(200),
  content_json: z.record(z.any()).default({ type: 'doc', content: [] }),
});

export type CreateDocInput = z.infer<typeof CreateDocSchema>;

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
      .select('*, author:profiles(id, full_name, avatar_url)')
      .single();

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    revalidatePath(`/projects/${parsed.data.project_id}`);
    return { success: true, data: data as ProjectDocument, correlation_id: correlationId };
  } catch (err: any) {
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
      .select('*, author:profiles(id, full_name, avatar_url)')
      .single();

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    if (updates.projectId) revalidatePath(`/projects/${updates.projectId}`);
    return { success: true, data: data as ProjectDocument, correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update document', correlation_id: correlationId };
  }
}

export async function getDocumentTreeAction(projectId: string): Promise<ActionResponse<ProjectDocument[]>> {
  const correlationId = `act-get-docs-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from('project_documents')
      .select('*, author:profiles(id, full_name, avatar_url), links:document_task_links(task_id, task:tasks(id, title, task_code, status))')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) return { success: false, error: error.message, correlation_id: correlationId };

    // Format into tree hierarchy
    const docs = (data || []).map((d: any) => ({
      ...d,
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

export async function getTaskLinkedDocsAction(taskId: string): Promise<ActionResponse<ProjectDocument[]>> {
  const correlationId = `act-get-task-docs-${Date.now()}`;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('document_task_links')
      .select('doc_id, document:project_documents(*)')
      .eq('task_id', taskId);

    if (error) return { success: false, error: error.message, correlation_id: correlationId };
    const docs = (data || []).map((d: any) => d.document).filter(Boolean);
    return { success: true, data: docs as ProjectDocument[], correlation_id: correlationId };
  } catch (err: any) {
    return { success: false, error: err?.message, correlation_id: correlationId };
  }
}
