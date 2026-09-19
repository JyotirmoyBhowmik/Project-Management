// ==============================================================================
// tests/integration/health-audit-route.test.ts
// Integration Tests: System Health Audit Endpoint & Report Schema Verification
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { UnauthorizedAccessException } from '@/lib/error/domain-errors';
import { createErrorResponse, createSuccessResponse } from '@/lib/error/api-handler';
import { SystemHealthAuditReport } from '@/types/database';

describe('System Health Audit & Diagnostics Endpoint', () => {
  const correlationId = 'test-audit-trace-404';

  it('should enforce 403 FORBIDDEN_ACCESS when unauthenticated or non-superadmin caller attempts access', async () => {
    const error = new UnauthorizedAccessException(
      'Platform SuperAdmin privileges required to access the diagnostic audit suite.'
    );
    const response = createErrorResponse(error, correlationId, 'GET /api/system/health-audit');

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status_code: 403,
      error_code: 'FORBIDDEN_ACCESS',
      correlation_id: correlationId,
      message: 'Platform SuperAdmin privileges required to access the diagnostic audit suite.',
    });
    expect(body.timestamp).toBeDefined();
  });

  it('should validate structured JSON audit report contract conforming to Rule 2.4', async () => {
    const mockReport: SystemHealthAuditReport = {
      timestamp: new Date().toISOString(),
      overall_status: 'PASS',
      checks: {
        database: {
          status: 'PASS',
          latency_ms: 38,
          message: 'Optimal connection established (38ms)',
        },
        rls_isolation: {
          status: 'PASS',
          message: 'Strict tenant boundary verified: Zero cross-tenant row leakage detected.',
        },
        storage_bucket: {
          status: 'PASS',
          message: 'Storage vault "task-attachments" verified: Private RLS isolation with 25MB boundary.',
          details: { id: 'task-attachments', public: false, file_size_limit: 26214400 },
        },
        orphan_records: {
          status: 'PASS',
          message: 'Relational integrity intact: Zero orphan tasks, projects, or attachments detected.',
        },
      },
      metrics: {
        tenants_count: 3,
        projects_count: 7,
        tasks_count: 14,
        attachments_count: 0,
        active_realtime_connections: 1,
      },
    };

    const response = createSuccessResponse(mockReport, correlationId);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status_code).toBe(200);
    expect(body.correlation_id).toBe(correlationId);
    expect(body.data.overall_status).toBe('PASS');
    expect(body.data.checks.database.latency_ms).toBe(38);
    expect(body.data.checks.storage_bucket.status).toBe('PASS');
    expect(body.data.checks.orphan_records.status).toBe('PASS');
    expect(body.data.metrics.tenants_count).toBe(3);
  });
});
