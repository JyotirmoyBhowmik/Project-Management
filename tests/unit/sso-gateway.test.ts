// ==============================================================================
// tests/unit/sso-gateway.test.ts
// Unit Tests for Enterprise SSO Domain Routing & Identity Federation Schemas
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  TenantSSOConfigSchema,
  TenantDirectorySyncConfigSchema,
} from '@/lib/validation/action-schemas';

describe('SSO Domain Resolution & Normalization', () => {
  function extractAndNormalizeDomain(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    let domain = trimmed;
    if (trimmed.includes('@')) {
      const parts = trimmed.split('@');
      domain = parts[parts.length - 1];
    }

    domain = domain.toLowerCase().trim();
    // Validate that it looks like a domain (has at least one dot and valid characters)
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(domain)) {
      return null;
    }

    return domain;
  }

  it('normalizes corporate email to clean domain', () => {
    expect(extractAndNormalizeDomain('sarah.connor@cyberdyne.systems')).toBe('cyberdyne.systems');
    expect(extractAndNormalizeDomain('  ALICE@ACME-CORP.COM  ')).toBe('acme-corp.com');
  });

  it('normalizes raw domain string with whitespace or mixed case', () => {
    expect(extractAndNormalizeDomain('  Microsoft.COM ')).toBe('microsoft.com');
    expect(extractAndNormalizeDomain('sub.domain.co.uk')).toBe('sub.domain.co.uk');
  });

  it('rejects invalid or malformed domain inputs', () => {
    expect(extractAndNormalizeDomain('')).toBeNull();
    expect(extractAndNormalizeDomain('plainstring')).toBeNull();
    expect(extractAndNormalizeDomain('@nodomain')).toBeNull();
    expect(extractAndNormalizeDomain('user@.invalid')).toBeNull();
  });

  it('verifies domain match against tenant allowed_domains list', () => {
    const allowedDomains = ['acme.com', 'acme-corp.org', 'acme.io'];
    const checkDomainAllowed = (emailOrDomain: string) => {
      const domain = extractAndNormalizeDomain(emailOrDomain);
      if (!domain) return false;
      return allowedDomains.includes(domain);
    };

    expect(checkDomainAllowed('employee@acme.com')).toBe(true);
    expect(checkDomainAllowed('acme-corp.org')).toBe(true);
    expect(checkDomainAllowed('hacker@evil-corp.com')).toBe(false);
  });
});

describe('Enterprise Identity Federation Schemas', () => {
  const validTenantId = 'a0000000-0000-0000-0000-000000000001';

  it('validates standard SAML 2.0 / SSO configuration payload', () => {
    const validConfig = {
      tenant_id: validTenantId,
      idp_entity_id: 'https://sts.windows.net/72f988bf-86f1-41af-91ab-2d7cd011db47/',
      idp_sso_url: 'https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/saml2',
      idp_certificate: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAL...\n-----END CERTIFICATE-----',
      allowed_domains: ['acme.com', 'acme.net'],
      enforce_sso: true,
      is_active: true,
    };

    const parsed = TenantSSOConfigSchema.safeParse(validConfig);
    expect(parsed.success).toBe(true);
  });

  it('rejects SAML config with invalid SSO URL', () => {
    const invalidConfig = {
      tenant_id: validTenantId,
      idp_entity_id: 'entity-id',
      idp_sso_url: 'invalid-url-without-protocol',
      idp_certificate: 'cert-content-too-short',
      allowed_domains: ['acme.com'],
      enforce_sso: false,
      is_active: true,
    };

    const parsed = TenantSSOConfigSchema.safeParse(invalidConfig);
    expect(parsed.success).toBe(false);
  });

  it('validates Active Directory / LDAP directory sync configuration', () => {
    const validLdapConfig = {
      tenant_id: validTenantId,
      protocol: 'azure_ad_graph' as const,
      host_url: 'https://graph.microsoft.com/v1.0',
      port: 443,
      bind_dn: 'cn=sync-service,ou=services,dc=acme,dc=internal',
      bind_credentials: 'EncryptedPassword123!',
      search_base: 'ou=employees,dc=acme,dc=internal',
      user_search_filter: '(&(objectCategory=person)(objectClass=user))',
      sync_interval_hours: 12,
      auto_deactivate_missing_users: true,
      is_enabled: true,
    };

    const parsed = TenantDirectorySyncConfigSchema.safeParse(validLdapConfig);
    expect(parsed.success).toBe(true);
  });

  it('rejects directory sync with port out of bounds', () => {
    const invalidPortConfig = {
      tenant_id: validTenantId,
      protocol: 'ldap' as const,
      host_url: 'ldap.example.com',
      port: 70000, // Invalid port > 65535
      user_search_filter: '(objectClass=inetOrgPerson)',
      sync_interval_hours: 24,
      auto_deactivate_missing_users: false,
      is_enabled: true,
    };

    const parsed = TenantDirectorySyncConfigSchema.safeParse(invalidPortConfig);
    expect(parsed.success).toBe(false);
  });

  it('rejects directory sync with invalid protocol enum', () => {
    const invalidProtocol = {
      tenant_id: validTenantId,
      protocol: 'invalid_proto',
      host_url: 'ldap.example.com',
      port: 389,
      user_search_filter: '(objectClass=*)',
      sync_interval_hours: 24,
      auto_deactivate_missing_users: false,
      is_enabled: true,
    };

    const parsed = TenantDirectorySyncConfigSchema.safeParse(invalidProtocol);
    expect(parsed.success).toBe(false);
  });
});
