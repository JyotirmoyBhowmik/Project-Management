// ==============================================================================
// src/app/api/v1/projects/[id]/dependencies/route.ts
// Task Dependencies API: Create & Delete with Cycle Detection & CPM recalculation
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';
import { DependencyCreateSchema } from '@/lib/validation/schemas';

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';
  const actorId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';

  const body = await req.json();
  const validated = DependencyCreateSchema.parse({
    ...body,
    project_id: projectId,
    tenant_id: tenantId,
  });

  const newDep = db.addDependency(validated, actorId, correlationId);
  const updatedTasks = db.getProjectTasksWithRelations(projectId, tenantId);

  return createSuccessResponse({ dependency: newDep, tasks: updatedTasks }, correlationId, 201);
});

export const DELETE = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';
  const actorId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';

  const depId = url.searchParams.get('id');
  if (!depId) {
    throw new Error('Dependency ID is required in query parameter');
  }

  const success = db.removeDependency(depId, actorId, correlationId);
  const updatedTasks = db.getProjectTasksWithRelations(projectId, tenantId);

  return createSuccessResponse({ success, tasks: updatedTasks }, correlationId);
});
