// ==============================================================================
// tests/unit/validation.test.ts
// Unit Tests: Schema Enforcement, Boundary Checks, and Sanitization (Rules 1.1 - 1.4)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  TenantCreateSchema,
  ProjectCreateSchema,
  TaskCreateSchema,
  DependencyCreateSchema,
  sanitizeString,
} from '@/lib/validation/schemas';

describe('Input Validation & Boundary Enforcement', () => {
  it('should sanitize HTML tags and script injections', () => {
    const malicious = '<script>alert("xss")</script>Secure Project Name';
    const cleaned = sanitizeString(malicious);
    expect(cleaned).toBe('Secure Project Name');
    expect(cleaned).not.toContain('<script>');
  });

  it('should validate correct tenant creation payload', () => {
    const validTenant = {
      name: 'Acme Global',
      code: 'ACME-GLB',
      slug: 'acme-glb',
      storage_quota_mb: 5120,
    };

    const parsed = TenantCreateSchema.safeParse(validTenant);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid tenant codes with lowercase or special symbols', () => {
    const invalidTenant = {
      name: 'Acme Global',
      code: 'acme_invalid#code!', // invalid format
      slug: 'acme-glb',
    };

    const parsed = TenantCreateSchema.safeParse(invalidTenant);
    expect(parsed.success).toBe(false);
  });

  it('should reject project with target_end_date earlier than start_date', () => {
    const invalidProject = {
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Time Travel Project',
      code: 'PRJ-TT-01',
      start_date: '2026-10-15',
      target_end_date: '2026-10-01', // Before start_date!
    };

    const parsed = ProjectCreateSchema.safeParse(invalidProject);
    expect(parsed.success).toBe(false);
  });

  it('should reject self-referential task dependency', () => {
    const invalidDep = {
      tenant_id: 'a0000000-0000-0000-0000-000000000001',
      project_id: 'd0000000-0000-0000-0000-000000000001',
      predecessor_id: 'f0000000-0000-0000-0000-000000000001',
      successor_id: 'f0000000-0000-0000-0000-000000000001', // same task!
      type: 'FS',
      lag_days: 0,
    };

    const parsed = DependencyCreateSchema.safeParse(invalidDep);
    expect(parsed.success).toBe(false);
  });
});
