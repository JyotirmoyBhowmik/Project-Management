// ==============================================================================
// src/app/api/v1/audit-logs/route.ts
// Audit Logs API: Compliance audit queries scoped by tenant with pagination (Rule 5.2)
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const tenantId = req.headers.get('x-tenant-id') || 'a0000000-0000-0000-0000-000000000001';
  const url = req.nextUrl;
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  const filteredLogs = db.auditLogs.filter(log => log.tenant_id === tenantId);
  const total = filteredLogs.length;

  const startIndex = (page - 1) * limit;
  const paginated = filteredLogs.slice(startIndex, startIndex + limit).map(log => ({
    ...log,
    actor: db.users.find(u => u.id === log.actor_id),
  }));

  return createSuccessResponse(
    paginated,
    correlationId,
    200,
    {
      page,
      limit,
      total,
      hasMore: startIndex + limit < total,
    }
  );
});
