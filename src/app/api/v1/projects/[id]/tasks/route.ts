// ==============================================================================
// src/app/api/v1/projects/[id]/tasks/route.ts
// Tasks API: Hierarchy, CRUD, and automatic CPM recalculation
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';
import { TaskCreateSchema, TaskUpdateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');

  if (!tenantId) {
    return createSuccessResponse({ tasks: [], dependencies: [] }, correlationId);
  }

  const [tasks, dependencies] = await Promise.all([
    dbService.getTasksForProject(projectId, tenantId),
    dbService.getDependenciesForProject(projectId, tenantId),
  ]);

  return createSuccessResponse({ tasks, dependencies }, correlationId);
});

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');
  const actorId = req.headers.get('x-user-id') || null;

  if (!tenantId) {
    throw new Error('Tenant ID is required to create a task');
  }

  const body = await req.json();
  const validated = TaskCreateSchema.parse({
    ...body,
    project_id: projectId,
    tenant_id: tenantId,
  });

  const newTask = await dbService.createTask({
    ...validated,
    phase_id: validated.phase_id || null,
    parent_id: validated.parent_id || null,
    description: validated.description || null,
    created_by: actorId,
  });

  if (newTask) {
    await dbService.createAuditLog({
      tenant_id: tenantId,
      actor_id: actorId,
      action: 'INSERT',
      entity_type: 'task',
      entity_id: newTask.id,
      diff_before: null,
      diff_after: newTask as unknown as Record<string, unknown>,
      correlation_id: correlationId,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'PMS API Client',
    });
  }

  return createSuccessResponse(newTask, correlationId, 201);
});

export const PUT = apiHandler(async (req: NextRequest, { correlationId }) => {
  const actorId = req.headers.get('x-user-id') || null;
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');
  const body = await req.json();

  if (!body.id) {
    throw new Error('Task ID is required for update');
  }
  if (!tenantId) {
    throw new Error('Tenant ID is required for update');
  }

  const validated = TaskUpdateSchema.parse(body);
  const updatedTask = await dbService.updateTask(body.id, tenantId, validated);

  if (updatedTask) {
    await dbService.createAuditLog({
      tenant_id: tenantId,
      actor_id: actorId,
      action: 'UPDATE',
      entity_type: 'task',
      entity_id: body.id,
      diff_before: null,
      diff_after: updatedTask as unknown as Record<string, unknown>,
      correlation_id: correlationId,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'PMS API Client',
    });
  }

  return createSuccessResponse(updatedTask, correlationId);
});
