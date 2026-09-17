// ==============================================================================
// src/lib/error/api-handler.ts
// Standardized Global API Route Handler Wrapper & Error Contract (Rule 2.3 & 2.4)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DomainException } from './domain-errors';
import { logger } from '../logger/logger';

export interface StandardizedErrorResponse {
  timestamp: string;
  status_code: number;
  error_code: string;
  correlation_id: string;
  message: string;
  details?: unknown;
}

export interface StandardizedSuccessResponse<T> {
  timestamp: string;
  status_code: number;
  correlation_id: string;
  data: T;
  meta?: Record<string, unknown>;
}

export function extractCorrelationId(req: NextRequest | Headers): string {
  const headers = req instanceof NextRequest ? req.headers : req;
  return (
    headers.get('x-correlation-id') ||
    headers.get('x-request-id') ||
    `corr-${Math.random().toString(36).substring(2, 11)}`
  );
}

export function createSuccessResponse<T>(
  data: T,
  correlationId: string,
  statusCode: number = 200,
  meta?: Record<string, unknown>
): NextResponse<StandardizedSuccessResponse<T>> {
  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      status_code: statusCode,
      correlation_id: correlationId,
      data,
      meta,
    },
    { status: statusCode, headers: { 'x-correlation-id': correlationId } }
  );
}

export function createErrorResponse(
  err: unknown,
  correlationId: string,
  functionName: string = 'apiHandler'
): NextResponse<StandardizedErrorResponse> {
  const timestamp = new Date().toISOString();

  // 1. Domain Exceptions
  if (err instanceof DomainException) {
    logger.warn(`Domain exception in ${functionName}: ${err.message}`, {
      fn: functionName,
      traceId: correlationId,
      ctx: { errorCode: err.errorCode, statusCode: err.statusCode },
    });

    return NextResponse.json(
      {
        timestamp,
        status_code: err.statusCode,
        error_code: err.errorCode,
        correlation_id: correlationId,
        message: err.message,
        details: (err as unknown as { details?: unknown }).details,
      },
      { status: err.statusCode, headers: { 'x-correlation-id': correlationId } }
    );
  }

  // 2. Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    logger.warn(`Validation failure in ${functionName}`, {
      fn: functionName,
      traceId: correlationId,
      ctx: { issues: formattedIssues },
    });

    return NextResponse.json(
      {
        timestamp,
        status_code: 400,
        error_code: 'VALIDATION_FAILED',
        correlation_id: correlationId,
        message: 'Invalid request payload provided.',
        details: formattedIssues,
      },
      { status: 400, headers: { 'x-correlation-id': correlationId } }
    );
  }

  // 3. Fallback: Unhandled Internal Server Errors (Strictly Sanitized)
  logger.error(`Unhandled internal error in ${functionName}`, {
    fn: functionName,
    traceId: correlationId,
    err,
  });

  return NextResponse.json(
    {
      timestamp,
      status_code: 500,
      error_code: 'INTERNAL_SERVER_ERROR',
      correlation_id: correlationId,
      message: 'An unexpected internal error occurred. Please contact system support with this correlation ID.',
    },
    { status: 500, headers: { 'x-correlation-id': correlationId } }
  );
}

// Wrapper for Next.js Route Handlers
export function apiHandler(
  handler: (req: NextRequest, ctx: { correlationId: string }) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const correlationId = extractCorrelationId(req);
    try {
      return await handler(req, { correlationId });
    } catch (err) {
      return createErrorResponse(err, correlationId, req.nextUrl.pathname);
    }
  };
}
