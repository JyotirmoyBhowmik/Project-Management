// ==============================================================================
// src/app/api/v1/projects/route.ts
// Projects API: Scoped by tenant_id and guest access boundaries
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';
import { ProjectCreateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id') || 'a0000000-0000-0000-0000-000000000001';
  const userId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';
  const role = req.headers.get('x-user-role') || 'tenant_admin';

  const projects = db.getProjectsForUser(tenantId, userId, role);
  return createSuccessResponse(projects, correlationId);
});

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const validated = ProjectCreateSchema.parse(body);
  const actorId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';

  const newProject = {
    ...validated,
    id: `prj-${Date.now()}`,
    description: validated.description || null,
    target_end_date: validated.target_end_date || null,
    calendar_id: validated.calendar_id || null,
    is_archived: false,
    created_by: actorId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.projects.push(newProject);

  db.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenant_id: newProject.tenant_id,
    actor_id: actorId,
    action: 'INSERT',
    entity_type: 'project',
    entity_id: newProject.id,
    diff_before: null,
    diff_after: newProject as unknown as Record<string, unknown>,
    correlation_id: correlationId,
    ip_address: '127.0.0.1',
    user_agent: 'PMS Web Client',
    created_at: new Date().toISOString(),
  });

  return createSuccessResponse(newProject, correlationId, 201);
});
