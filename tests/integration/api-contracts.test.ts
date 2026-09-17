// ==============================================================================
// tests/integration/api-contracts.test.ts
// Integration Tests: Standardized Error Contract & API Behavior (Rules 2.3 & 2.4)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { createErrorResponse, createSuccessResponse } from '@/lib/error/api-handler';
import { EntityNotFoundException, DependencyCycleException } from '@/lib/error/domain-errors';
import { z } from 'zod';

describe('Standardized API Error & Response Contracts', () => {
  const correlationId = 'test-corr-id-999';

  it('should format domain exceptions into standardized JSON contract per Rule 2.4', async () => {
    const domainError = new EntityNotFoundException('Project', 'prj-invalid-99');
    const response = createErrorResponse(domainError, correlationId, 'testHandler');

    expect(response.status).toBe(404);
    expect(response.headers.get('x-correlation-id')).toBe(correlationId);

    const body = await response.json();
    expect(body).toMatchObject({
      status_code: 404,
      error_code: 'ENTITY_NOT_FOUND',
      correlation_id: correlationId,
      message: "Project with identifier 'prj-invalid-99' was not found.",
    });
    expect(body.timestamp).toBeDefined();
    // Ensure no stack traces or server paths are leaked in public response
    expect(body.stack).toBeUndefined();
  });

  it('should format validation errors into standardized 400 VALIDATION_FAILED contract', async () => {
    const TestSchema = z.object({
      code: z.string().min(3),
    });

    let zodError: z.ZodError | null = null;
    try {
      TestSchema.parse({ code: 'x' });
    } catch (err) {
      zodError = err as z.ZodError;
    }

    const response = createErrorResponse(zodError, correlationId, 'testHandler');
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error_code).toBe('VALIDATION_FAILED');
    expect(body.status_code).toBe(400);
    expect(body.correlation_id).toBe(correlationId);
    expect(body.details).toBeDefined();
  });

  it('should sanitize unhandled exceptions and never leak internal database or system details', async () => {
    const systemCrash = new Error('FATAL: connection to server at "10.0.0.12", port 5432 failed: FATAL password authentication failed');
    const response = createErrorResponse(systemCrash, correlationId, 'testHandler');

    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body.status_code).toBe(500);
    expect(body.error_code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.message).not.toContain('password authentication');
    expect(body.message).not.toContain('10.0.0.12');
    expect(body.correlation_id).toBe(correlationId);
  });

  it('should wrap success payloads with timestamp and correlation metadata', async () => {
    const data = { id: 'task-100', title: 'Deploy to Vercel' };
    const response = createSuccessResponse(data, correlationId, 200);

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status_code).toBe(200);
    expect(body.correlation_id).toBe(correlationId);
    expect(body.data).toEqual(data);
    expect(body.timestamp).toBeDefined();
  });
});
