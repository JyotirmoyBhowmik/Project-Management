// ==============================================================================
// src/app/api/scim/v2/Users/route.ts
// RFC 7644 SCIM 2.0 Protocol User Resource Endpoint
// Supports GET (List/Filter) & POST (Create/Provision)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger/logger';

interface SCIMUserPayload {
  schemas?: string[];
  id?: string;
  userName: string;
  name?: {
    formatted?: string;
    familyName?: string;
    givenName?: string;
  };
  emails?: Array<{ value: string; primary?: boolean; type?: string }>;
  active?: boolean;
}

function formatSCIMUser(profile: any, membership?: any): Record<string, any> {
  const primaryEmail = profile.email;
  const fullName = profile.full_name || 'User';
  const nameParts = fullName.split(' ');

  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: profile.id,
    userName: primaryEmail,
    name: {
      formatted: fullName,
      familyName: nameParts.slice(1).join(' ') || '',
      givenName: nameParts[0] || '',
    },
    displayName: fullName,
    emails: [
      {
        value: primaryEmail,
        type: 'work',
        primary: true,
      },
    ],
    active: membership ? !membership.is_suspended && membership.is_active : true,
    meta: {
      resourceType: 'User',
      created: profile.created_at,
      location: `/api/scim/v2/Users/${profile.id}`,
    },
  };
}

export async function GET(request: NextRequest) {
  const correlationId = `scim-get-users-${Date.now()}`;
  try {
    const adminClient = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter');
    const startIndex = Math.max(1, parseInt(searchParams.get('startIndex') || '1', 10));
    const count = Math.min(100, Math.max(1, parseInt(searchParams.get('count') || '50', 10)));

    let query = adminClient.from('profiles').select('id, email, full_name, created_at', { count: 'exact' });

    // Handle filter (e.g. userName eq "user@example.com")
    if (filter) {
      const match = filter.match(/userName\s+eq\s+"([^"]+)"/i);
      if (match) {
        query = query.eq('email', match[1].toLowerCase().trim());
      }
    }

    const { data: profiles, error, count: totalResults } = await query
      .range(startIndex - 1, startIndex + count - 2)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '500',
          detail: error.message,
        },
        { status: 500 }
      );
    }

    const resources = (profiles || []).map((p) => formatSCIMUser(p));

    return NextResponse.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: totalResults || resources.length,
      startIndex,
      itemsPerPage: count,
      Resources: resources,
    });
  } catch (err: any) {
    logger.error('Exception in SCIM GET Users', { fn: 'SCIM.GET.Users', err });
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: err?.message || 'Internal error in SCIM service',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const correlationId = `scim-post-user-${Date.now()}`;
  try {
    const body: SCIMUserPayload = await request.json();

    const email = body.userName || body.emails?.[0]?.value;
    if (!email) {
      return NextResponse.json(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '400',
          scimType: 'invalidValue',
          detail: 'userName or primary email is required',
        },
        { status: 400 }
      );
    }

    const fullName =
      body.name?.formatted ||
      [body.name?.givenName, body.name?.familyName].filter(Boolean).join(' ') ||
      email.split('@')[0];

    const adminClient = createAdminClient();

    // 1. Check if user profile already exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email, full_name, created_at')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    let targetId = existingProfile?.id;
    let createdDate = existingProfile?.created_at || new Date().toISOString();

    if (!targetId) {
      targetId = crypto.randomUUID();
      const { error: insertError } = await adminClient.from('profiles').insert({
        id: targetId,
        email: email.toLowerCase().trim(),
        full_name: fullName,
        is_superadmin: false,
        created_at: createdDate,
      });

      if (insertError) {
        return NextResponse.json(
          {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            status: '409',
            detail: insertError.message,
          },
          { status: 409 }
        );
      }
    }

    // 2. Link to default active tenant if tenant query param provided
    const tenantIdParam = request.nextUrl.searchParams.get('tenantId');
    if (tenantIdParam) {
      await adminClient.from('tenant_memberships').upsert({
        tenant_id: tenantIdParam,
        user_id: targetId,
        role: 'member',
        is_active: body.active !== false,
        is_suspended: body.active === false,
      }, { onConflict: 'tenant_id,user_id' });
    }

    const scimUser = formatSCIMUser({ id: targetId, email, full_name: fullName, created_at: createdDate });
    return NextResponse.json(scimUser, { status: 201 });
  } catch (err: any) {
    logger.error('Exception in SCIM POST User', { fn: 'SCIM.POST.User', err });
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: err?.message || 'Failed to create SCIM user',
      },
      { status: 500 }
    );
  }
}
