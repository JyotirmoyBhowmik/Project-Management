// ==============================================================================
// src/middleware.ts
// Next.js Edge Middleware: Tenant Resolution, Correlation Tracing & Guest Route Trapping
// ==============================================================================

import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // 1. Distributed Tracing: Extract or Generate Unique Correlation ID (Rule 4.2)
  const existingCorrId =
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-request-id');
  const correlationId = existingCorrId || `corr-${crypto.randomUUID()}`;
  requestHeaders.set('x-correlation-id', correlationId);

  // 2. Multi-Tenancy Resolution (Domain / Subdomain / Cookie / Header)
  const host = request.headers.get('host') || '';
  const url = request.nextUrl.clone();
  const queryTenant = url.searchParams.get('tenant');
  const cookieTenant = request.cookies.get('pms_active_tenant_id')?.value;

  let resolvedTenantId = cookieTenant || 'a0000000-0000-0000-0000-000000000001';

  // Subdomain parsing (e.g. acme.pms.internal)
  if (host.includes('.') && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const subdomain = host.split('.')[0].toLowerCase();
    if (subdomain === 'globex') {
      resolvedTenantId = 'a0000000-0000-0000-0000-000000000002';
    }
  }

  if (queryTenant) {
    if (queryTenant.toUpperCase() === 'GLOBEX') {
      resolvedTenantId = 'a0000000-0000-0000-0000-000000000002';
    } else if (queryTenant.toUpperCase() === 'ACME-CORP') {
      resolvedTenantId = 'a0000000-0000-0000-0000-000000000001';
    }
  }

  requestHeaders.set('x-tenant-id', resolvedTenantId);

  // 3. Guest Trapping & Scoped Access Guard
  const userRole = request.cookies.get('pms_user_role')?.value || 'tenant_admin';
  const pathname = request.nextUrl.pathname;

  // Guest accounts are strictly forbidden from accessing Tenant Admin and SuperAdmin panels
  if (userRole === 'guest' && (pathname.startsWith('/admin') || pathname.startsWith('/api/v1/admin'))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          timestamp: new Date().toISOString(),
          status_code: 403,
          error_code: 'GUEST_ACCESS_RESTRICTED',
          correlation_id: correlationId,
          message: 'Guest accounts are strictly prohibited from accessing administrative control panels.',
        },
        { status: 403, headers: { 'x-correlation-id': correlationId } }
      );
    }
    // Trapping redirect for web navigation
    url.pathname = '/projects';
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Echo correlation ID back in client response
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('x-tenant-id', resolvedTenantId);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
