// ==============================================================================
// tests/unit/cron-worker.test.ts
// Unit & Integration Tests: Background Daily Schedule Worker & Authorization
// ==============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/daily-schedule/route';

describe('Daily Schedule Cron Background Worker', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-12345';
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it('should reject unauthorized calls when Bearer token does not match CRON_SECRET', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/daily-schedule', {
      headers: {
        authorization: 'Bearer wrong-secret',
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error_code).toBe('UNAUTHORIZED_CRON');
    expect(body.message).toContain('Unauthorized');
  });

  it('should reject requests missing Authorization header when CRON_SECRET is required', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/daily-schedule');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should successfully execute schedule check and return standardized metrics with valid Bearer token', async () => {
    const request = new NextRequest('http://localhost:3000/api/cron/daily-schedule', {
      headers: {
        authorization: 'Bearer test-secret-12345',
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.metrics).toBeDefined();
    expect(typeof body.metrics.milestonesAlerted).toBe('number');
    expect(typeof body.metrics.overdueTasksProcessed).toBe('number');
    expect(typeof body.metrics.digestsSent).toBe('number');
    expect(body.correlationId).toContain('cron-daily');
    expect(typeof body.executionTimeMs).toBe('number');
  });
});
