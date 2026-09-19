// ==============================================================================
// src/app/api/scim/v2/Users/[id]/route.ts
// RFC 7644 SCIM 2.0 Protocol Single User Resource Endpoint
// Supports GET, PUT, PATCH, DELETE
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger/logger';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminClient = createAdminClient();

    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('id, email, full_name, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json(
        {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: 'Resource not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(formatSCIMUser(profile));
  } catch (err: any) {
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: err?.message || 'Server error',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const adminClient = createAdminClient();

    // SCIM 2.0 Patch operations: [{ op: "replace", path: "active", value: false }]
    const operations = body.Operations || [];
    let shouldSuspend: boolean | null = null;
    let newFullName: string | null = null;

    for (const op of operations) {
      if (op.path === 'active' || op.op === 'replace' && op.value?.active !== undefined) {
        const activeVal = op.path === 'active' ? op.value : op.value?.active;
        shouldSuspend = activeVal === false;
      }
      if (op.path === 'name.formatted' || op.path === 'displayName') {
        newFullName = String(op.value);
      }
    }

    if (newFullName) {
      await adminClient.from('profiles').update({ full_name: newFullName }).eq('id', id);
    }

    if (shouldSuspend !== null) {
      await adminClient
        .from('tenant_memberships')
        .update({
          is_suspended: shouldSuspend,
          suspended_at: shouldSuspend ? new Date().toISOString() : null,
        })
        .eq('user_id', id);
    }

    const { data: updatedProfile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json(formatSCIMUser(updatedProfile));
  } catch (err: any) {
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: err?.message || 'Failed to patch user',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminClient = createAdminClient();

    // Deprovision user by removing or suspending memberships
    await adminClient
      .from('tenant_memberships')
      .update({ is_suspended: true, suspended_at: new Date().toISOString() })
      .eq('user_id', id);

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json(
      {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: err?.message || 'Failed to delete user',
      },
      { status: 500 }
    );
  }
}
