// ==============================================================================
// src/app/api/v1/tenants/route.ts
// Tenant Management API: Lookup, listing, and provisioning
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { dbService } from '@/lib/supabase/db-service';
import { TenantCreateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const lookup = url.searchParams.get('lookup'); // slug or code lookup

  if (lookup) {
    const tenant = await dbService.getTenantBySlugOrCode(lookup);
    return createSuccessResponse(tenant, correlationId);
  }

  // Return all tenants for tenant switcher
  const tenants = await dbService.getAllTenants();
  return createSuccessResponse(tenants, correlationId);
});

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const validated = TenantCreateSchema.parse(body);

  const tenantCode = validated.code || (validated as { tenant_code?: string }).tenant_code || 'NEW-TENANT';

  const newTenant = await dbService.createTenant({
    name: validated.name,
    code: tenantCode,
    tenant_code: tenantCode,
    slug: validated.slug,
    domain: validated.domain || null,
    is_active: true,
    week_starts_on: 1,
    weekend_days: [0, 6],
    status: 'active',
    feature_flags: { cpm_enabled: true, export_enabled: true, audit_enabled: true },
  });

  return createSuccessResponse(newTenant, correlationId, 201);
});
