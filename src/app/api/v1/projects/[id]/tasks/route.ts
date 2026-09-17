// ==============================================================================
// src/app/api/v1/projects/[id]/tasks/route.ts
// Tasks API: Hierarchy, CRUD, and automatic CPM recalculation
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';
import { TaskCreateSchema, TaskUpdateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';

  const tasks = db.getProjectTasksWithRelations(projectId, tenantId);
  const dependencies = db.dependencies.filter(d => d.project_id === projectId && d.tenant_id === tenantId);

  return createSuccessResponse({ tasks, dependencies }, correlationId);
});

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';
  const actorId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';

  const body = await req.json();
  const validated = TaskCreateSchema.parse({
    ...body,
    project_id: projectId,
    tenant_id: tenantId,
  });

  const newTask = db.createTask(
    {
      ...validated,
      phase_id: validated.phase_id || null,
      parent_id: validated.parent_id || null,
      description: validated.description || null,
      created_by: actorId,
    },
    actorId,
    correlationId
  );

  return createSuccessResponse(newTask, correlationId, 201);
});

export const PUT = apiHandler(async (req: NextRequest, { correlationId }) => {
  const actorId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';
  const body = await req.json();

  if (!body.id) {
    throw new Error('Task ID is required for update');
  }

  const validated = TaskUpdateSchema.parse(body);
  const updatedTask = db.updateTask(body.id, validated, actorId, correlationId);

  return createSuccessResponse(updatedTask, correlationId);
});
