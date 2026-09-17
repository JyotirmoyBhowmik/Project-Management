// ==============================================================================
// src/app/api/v1/projects/[id]/dependencies/route.ts
// Task Dependencies API: Create & Delete with Cycle Detection & CPM recalculation
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';
import { DependencyCreateSchema } from '@/lib/validation/schemas';

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');

  if (!tenantId) {
    throw new Error('Tenant ID is required to add dependency');
  }

  const body = await req.json();
  const validated = DependencyCreateSchema.parse({
    ...body,
    project_id: projectId,
    tenant_id: tenantId,
  });

  const newDep = await dbService.createDependency({
    tenant_id: tenantId,
    project_id: projectId,
    predecessor_id: validated.predecessor_id,
    successor_id: validated.successor_id,
    dep_type: validated.dep_type || 'FS',
    lag_days: validated.lag_days || 0,
  });

  const updatedTasks = await dbService.getTasksForProject(projectId, tenantId);

  return createSuccessResponse({ dependency: newDep, tasks: updatedTasks }, correlationId, 201);
});

export const DELETE = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');

  if (!tenantId) {
    throw new Error('Tenant ID is required to remove dependency');
  }

  const depId = url.searchParams.get('id');
  if (!depId) {
    throw new Error('Dependency ID is required in query parameter');
  }

  const success = await dbService.deleteDependency(depId, tenantId);
  const updatedTasks = await dbService.getTasksForProject(projectId, tenantId);

  return createSuccessResponse({ success, tasks: updatedTasks }, correlationId);
});
