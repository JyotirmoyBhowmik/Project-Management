// ==============================================================================
// src/app/api/v1/projects/[id]/cpm/route.ts
// Critical Path Method (CPM) Trigger & Diagnostic API Route
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';

  const cpmResult = db.recalculateProjectCPM(projectId, tenantId);
  const tasks = db.getProjectTasksWithRelations(projectId, tenantId);

  return createSuccessResponse({ ...cpmResult, tasks }, correlationId);
});
