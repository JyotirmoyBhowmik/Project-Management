// ==============================================================================
// src/app/api/v1/projects/[id]/cpm/route.ts
// Critical Path Method (CPM) Trigger & Diagnostic API Route
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';
import { calculateCPM } from '@/lib/cpm/cpm-engine';

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const pathParts = url.pathname.split('/');
  const projectId = pathParts[pathParts.indexOf('projects') + 1];
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id');

  if (!tenantId) {
    throw new Error('Tenant ID is required for CPM recalculation');
  }

  const [tasks, dependencies, calendar, holidays] = await Promise.all([
    dbService.getTasksForProject(projectId, tenantId),
    dbService.getDependenciesForProject(projectId, tenantId),
    dbService.getWorkingCalendar(tenantId),
    dbService.getCalendarHolidays(tenantId),
  ]);

  const workingCal = calendar || { working_days: [1, 2, 3, 4, 5] };
  const cpmResult = calculateCPM(tasks, dependencies, workingCal, holidays);

  // Persist updated CPM attributes back to Supabase
  for (const t of cpmResult.tasks) {
    await dbService.updateTask(t.id, tenantId, {
      early_start: t.early_start,
      early_finish: t.early_finish,
      late_start: t.late_start,
      late_finish: t.late_finish,
      total_float: t.total_float,
      is_critical: t.is_critical,
    });
  }

  return createSuccessResponse({ ...cpmResult, tasks: cpmResult.tasks }, correlationId);
});
