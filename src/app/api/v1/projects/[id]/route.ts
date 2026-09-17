// ==============================================================================
// src/app/api/v1/projects/[id]/route.ts
// Single Project Detail & Update API Route
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';
import { ProjectUpdateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.length - 1];

  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');
  if (!tenantId) {
    return createSuccessResponse(null, correlationId);
  }

  const [project, calendar, holidays] = await Promise.all([
    dbService.getProjectDetails(projectId, tenantId),
    dbService.getWorkingCalendar(tenantId),
    dbService.getCalendarHolidays(tenantId),
  ]);

  return createSuccessResponse({ project, phases: [], calendar, holidays }, correlationId);
});

export const PUT = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.length - 1];

  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');
  const userId = req.headers.get('x-user-id');

  if (!tenantId) {
    throw new Error('Tenant ID is required for project update');
  }

  const body = await req.json();
  const validated = ProjectUpdateSchema.parse(body);

  const before = await dbService.getProjectDetails(projectId, tenantId);
  const after = await dbService.updateProject(projectId, tenantId, validated);

  if (after) {
    await dbService.createAuditLog({
      tenant_id: tenantId,
      actor_id: userId || null,
      action: 'UPDATE',
      entity_type: 'project',
      entity_id: projectId,
      diff_before: before as unknown as Record<string, unknown>,
      diff_after: after as unknown as Record<string, unknown>,
      correlation_id: correlationId,
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      user_agent: req.headers.get('user-agent') || 'PMS API Client',
    });
  }

  return createSuccessResponse(after, correlationId);
});
