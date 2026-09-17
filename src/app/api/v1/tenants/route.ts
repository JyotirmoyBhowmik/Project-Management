// ==============================================================================
// src/app/api/v1/tenants/route.ts
// Tenant Management API: Lookup, listing, and provisioning
// ==============================================================================

import { NextRequest } from 'next/server';
import { apiHandler, createSuccessResponse } from '@/lib/error/api-handler';
import { db } from '@/lib/supabase/mock-db';
import { TenantCreateSchema } from '@/lib/validation/schemas';

export const GET = apiHandler(async (req: NextRequest, { correlationId }) => {
  const url = req.nextUrl;
  const lookup = url.searchParams.get('lookup'); // slug or code lookup

  if (lookup) {
    const tenant = db.getTenantBySlugOrCode(lookup);
    return createSuccessResponse(tenant, correlationId);
  }

  // Return all tenants for tenant switcher
  return createSuccessResponse(db.tenants, correlationId);
});

export const POST = apiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const validated = TenantCreateSchema.parse(body);

  const newTenant = {
    ...validated,
    id: `tenant-${Date.now()}`,
    domain: validated.domain || null,
    status: 'active' as const,
    feature_flags: { cpm_enabled: true, export_enabled: true, audit_enabled: true },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.tenants.push(newTenant);

  return createSuccessResponse(newTenant, correlationId, 201);
});
