// ==============================================================================
// src/app/api/v1/projects/route.ts
// Projects API: Scoped by tenant_id and guest access boundaries
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';
import { ProjectCreateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');

  if (!tenantId) {
    return createSuccessResponse([], correlationId);
  }

  const projects = await dbService.getTenantProjects(tenantId, userId || undefined, role || undefined);
  return createSuccessResponse(projects, correlationId);
});

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const validated = ProjectCreateSchema.parse(body);
  const actorId = req.headers.get('x-user-id') || null;

  const newProject = await dbService.createProject({
    ...validated,
    description: validated.description || null,
    target_end_date: validated.target_end_date || null,
    calendar_id: validated.calendar_id || null,
    is_archived: false,
    created_by: actorId,
  });

  if (newProject) {
    await dbService.createAuditLog({
      tenant_id: newProject.tenant_id,
      actor_id: actorId,
      action: 'INSERT',
      entity_type: 'project',
      entity_id: newProject.id,
      diff_before: null,
      diff_after: newProject as unknown as Record<string, unknown>,
      correlation_id: correlationId,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'PMS API Client',
    });
  }

  return createSuccessResponse(newProject, correlationId, 201);
});
