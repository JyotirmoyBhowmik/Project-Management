// ==============================================================================
// src/app/api/v1/projects/[id]/route.ts
// Single Project Detail & Update API Route
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';
import { ProjectUpdateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.length - 1];

  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';
  const userId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';
  const role = req.headers.get('x-user-role') || 'tenant_admin';

  const project = db.getProject(projectId, tenantId, userId, role);
  const phases = db.phases.filter(p => p.project_id === projectId);
  const calendar = db.calendars.find(c => c.id === project.calendar_id) || db.calendars[0];
  const holidays = db.holidays.filter(h => h.tenant_id === tenantId);

  return createSuccessResponse({ project, phases, calendar, holidays }, correlationId);
});

export const PUT = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.length - 1];

  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';
  const userId = req.headers.get('x-user-id') || 'b0000000-0000-0000-0000-000000000002';
  const role = req.headers.get('x-user-role') || 'tenant_admin';

  const project = db.getProject(projectId, tenantId, userId, role);
  const body = await req.json();
  const validated = ProjectUpdateSchema.parse(body);

  const idx = db.projects.findIndex(p => p.id === projectId);
  const before = { ...db.projects[idx] };
  db.projects[idx] = { ...before, ...validated, updated_at: new Date().toISOString() };
  const after = db.projects[idx];

  db.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    tenant_id: tenantId,
    actor_id: userId,
    action: 'UPDATE',
    entity_type: 'project',
    entity_id: projectId,
    diff_before: before as unknown as Record<string, unknown>,
    diff_after: after as unknown as Record<string, unknown>,
    correlation_id: correlationId,
    ip_address: '127.0.0.1',
    user_agent: 'PMS Web Client',
    created_at: new Date().toISOString(),
  });

  return createSuccessResponse(after, correlationId);
});
