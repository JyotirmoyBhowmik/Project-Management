// ==============================================================================
// src/app/api/v1/audit-logs/route.ts
// Audit Logs API: Compliance audit queries scoped by tenant with pagination (Rule 5.2)
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const tenantId = req.headers.get('x-tenant-id') || req.nextUrl.searchParams.get('tenant_id') || undefined;
  const url = req.nextUrl;
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  const { logs, total } = await dbService.getAuditLogs(tenantId, undefined, limit, page);

  return createSuccessResponse(
    logs,
    correlationId,
    200,
    {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    }
  );
});
