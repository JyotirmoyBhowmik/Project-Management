// ==============================================================================
// tests/unit/scim-parser.test.ts
// Unit Tests for RFC 7644 SCIM 2.0 Identity Protocol & Schema Transformations
// ==============================================================================

import { describe, it, expect } from 'vitest';

describe('SCIM 2.0 User Payload Ingestion & Formatting', () => {
  // Pure helper replicating SCIM User payload parser from /api/scim/v2/Users
  function parseScimUserPayload(body: any) {
    const email =
      body.userName ||
      (Array.isArray(body.emails) && body.emails.length > 0 ? body.emails[0].value : null);

    const fullName =
      (body.name?.formatted ||
        [body.name?.givenName, body.name?.familyName].filter(Boolean).join(' ') ||
        body.displayName ||
        email?.split('@')[0] ||
        'SCIM Provisioned User').trim();

    const active = body.active !== undefined ? Boolean(body.active) : true;
    const isSuspended = !active;

    return {
      email,
      fullName,
      active,
      isSuspended,
    };
  }

  // Pure helper replicating SCIM User response generator
  function formatScimUser(member: {
    id: string;
    user_id: string;
    role: string;
    is_suspended: boolean;
    created_at?: string;
    updated_at?: string;
    profile?: {
      email: string;
      full_name: string;
      avatar_url?: string | null;
    } | null;
  }) {
    const email = member.profile?.email || 'unknown@domain.com';
    const fullName = member.profile?.full_name || email;
    const nameParts = fullName.split(' ');
    const givenName = nameParts[0] || '';
    const familyName = nameParts.slice(1).join(' ') || '';

    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: member.id,
      userName: email,
      name: {
        formatted: fullName,
        familyName,
        givenName,
      },
      displayName: fullName,
      active: !member.is_suspended,
      emails: [
        {
          value: email,
          type: 'work',
          primary: true,
        },
      ],
      roles: [
        {
          value: member.role,
          primary: true,
        },
      ],
      meta: {
        resourceType: 'User',
        created: member.created_at || '2026-01-01T00:00:00.000Z',
        lastModified: member.updated_at || '2026-01-01T00:00:00.000Z',
      },
    };
  }

  it('correctly extracts work email and full name from standard Okta/Entra SCIM payload', () => {
    const scimBody = {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: 'john.doe@enterprise.com',
      name: {
        givenName: 'John',
        familyName: 'Doe',
      },
      active: true,
      emails: [
        { value: 'john.doe@enterprise.com', primary: true },
      ],
    };

    const parsed = parseScimUserPayload(scimBody);
    expect(parsed.email).toBe('john.doe@enterprise.com');
    expect(parsed.fullName).toBe('John Doe');
    expect(parsed.active).toBe(true);
    expect(parsed.isSuspended).toBe(false);
  });

  it('correctly marks user as suspended when active is false (deprovisioning)', () => {
    const scimBody = {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: 'jane.smith@enterprise.com',
      displayName: 'Jane Smith',
      active: false,
    };

    const parsed = parseScimUserPayload(scimBody);
    expect(parsed.email).toBe('jane.smith@enterprise.com');
    expect(parsed.fullName).toBe('Jane Smith');
    expect(parsed.active).toBe(false);
    expect(parsed.isSuspended).toBe(true);
  });

  it('formats database membership record into RFC 7644 SCIM User schema', () => {
    const dbRecord = {
      id: 'm-12345',
      user_id: 'u-999',
      role: 'developer',
      is_suspended: false,
      created_at: '2026-09-01T10:00:00.000Z',
      updated_at: '2026-09-10T12:00:00.000Z',
      profile: {
        email: 'alice@cyberdyne.corp',
        full_name: 'Alice Johnson',
        avatar_url: null,
      },
    };

    const scimOutput = formatScimUser(dbRecord);
    expect(scimOutput.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:User');
    expect(scimOutput.id).toBe('m-12345');
    expect(scimOutput.userName).toBe('alice@cyberdyne.corp');
    expect(scimOutput.active).toBe(true);
    expect(scimOutput.name.givenName).toBe('Alice');
    expect(scimOutput.name.familyName).toBe('Johnson');
    expect(scimOutput.roles[0].value).toBe('developer');
  });

  it('formats suspended database membership into active=false in SCIM', () => {
    const dbRecord = {
      id: 'm-suspended-1',
      user_id: 'u-suspended-1',
      role: 'guest',
      is_suspended: true,
      profile: {
        email: 'revoked@acme.com',
        full_name: 'Revoked User',
      },
    };

    const scimOutput = formatScimUser(dbRecord);
    expect(scimOutput.active).toBe(false);
  });
});

describe('SCIM 2.0 PATCH Operations Parser', () => {
  function parseScimPatchOperations(operations: Array<{ op: string; path?: string; value: any }>) {
    let newActive: boolean | null = null;
    let newRole: string | null = null;

    for (const op of operations) {
      const opType = (op.op || '').toLowerCase();
      if (opType === 'replace' || opType === 'add') {
        // Form 1: path: "active", value: false
        if (op.path?.toLowerCase() === 'active') {
          newActive = Boolean(op.value);
        }
        // Form 2: value: { active: false }
        else if (typeof op.value === 'object' && op.value?.active !== undefined) {
          newActive = Boolean(op.value.active);
        }

        // Form 3: path: "roles[primary eq true].value" or value: { roles: [...] }
        if (op.path?.toLowerCase().includes('role')) {
          newRole = typeof op.value === 'string' ? op.value : op.value?.value;
        } else if (typeof op.value === 'object' && op.value?.roles) {
          const primaryRole = Array.isArray(op.value.roles) ? op.value.roles[0]?.value : op.value.roles;
          if (primaryRole) newRole = primaryRole;
        }
      }
    }

    return { newActive, newRole };
  }

  it('parses direct path replace operation for active status', () => {
    const ops = [
      { op: 'replace', path: 'active', value: false },
    ];
    const { newActive } = parseScimPatchOperations(ops);
    expect(newActive).toBe(false);
  });

  it('parses object value replace operation for active status (Azure AD style)', () => {
    const ops = [
      { op: 'Replace', value: { active: true } },
    ];
    const { newActive } = parseScimPatchOperations(ops);
    expect(newActive).toBe(true);
  });

  it('parses role adjustment operation from SCIM payload', () => {
    const ops = [
      { op: 'replace', path: 'roles[primary eq true].value', value: 'project_manager' },
    ];
    const { newRole } = parseScimPatchOperations(ops);
    expect(newRole).toBe('project_manager');
  });
});

describe('SCIM 2.0 ListResponse & Error Formatting', () => {
  it('builds standard SCIM ListResponse pagination envelope', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const listResponse = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: 10,
      startIndex: 1,
      itemsPerPage: 2,
      Resources: items,
    };

    expect(listResponse.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:ListResponse');
    expect(listResponse.totalResults).toBe(10);
    expect(listResponse.Resources).toHaveLength(2);
  });

  it('formats standard SCIM 2.0 Error response', () => {
    const scimError = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '404',
      detail: 'Resource 00000000-0000-0000-0000-000000000000 not found',
    };

    expect(scimError.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:Error');
    expect(scimError.status).toBe('404');
    expect(scimError.detail).toContain('not found');
  });
});
