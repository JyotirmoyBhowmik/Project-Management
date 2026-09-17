// ==============================================================================
// src/middleware.ts
// Next.js Edge Middleware: Mandatory Authentication & Tenant Routing Gateway
// Strictly redirects unauthenticated requests to /login (Zero Mock Leakage)
// ==============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 1. Correlation ID Tracing (Rule 4.2)
  const correlationId =
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-request-id') ||
    `corr-${crypto.randomUUID()}`;
  response.headers.set('x-correlation-id', correlationId);

  const pathname = request.nextUrl.pathname;

  // 2. Public Route Whitelist
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/cron') ||
    pathname.includes('.') // static assets, favicon, logos
  ) {
    return response;
  }

  // 3. Subdomain Tenant Extraction (e.g. acme.pms.jyotirmoyb.com -> acme)
  const host = request.headers.get('host') || '';
  if (host.includes('.') && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const parts = host.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0].toLowerCase();
      if (subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'pms') {
        response.headers.set('x-tenant-slug', subdomain);
      }
    }
  }

  // 4. Supabase Session Check
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Database credentials pending; route to login with setup prompt
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If unauthenticated, immediately redirect to /login
    if (!user) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }

    // Pass user ID downstream
    response.headers.set('x-user-id', user.id);
    return response;
  } catch (err) {
    // Fallback safe redirect on any authentication session error
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
