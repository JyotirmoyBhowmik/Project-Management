// ==============================================================================
// src/lib/logger/logger.ts
// Enterprise Structured JSON Logger with PII Redaction & Correlation Tracking (Rules 4.1 - 4.3)
// ==============================================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'authorization',
  'cookie',
  'jwt',
  'access_token',
  'refresh_token',
];

export function redactPII(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Redact potential emails
    return obj.replace(/([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, '$1***@$2');
  }
  if (Array.isArray(obj)) {
    return obj.map(redactPII);
  }
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactPII(value);
      }
    }
    return sanitized;
  }
  return obj;
}

export interface StructuredLogPayload {
  level: LogLevel;
  timestamp: string;
  service_name: string;
  function_name?: string;
  correlation_id?: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private serviceName: string;

  constructor(serviceName: string = 'pms-core') {
    this.serviceName = serviceName;
  }

  private write(
    level: LogLevel,
    message: string,
    functionName?: string,
    correlationId?: string,
    context?: Record<string, unknown>,
    err?: unknown
  ) {
    const payload: StructuredLogPayload = {
      level,
      timestamp: new Date().toISOString(),
      service_name: this.serviceName,
      function_name: functionName,
      correlation_id: correlationId || 'trace-unassigned',
      message,
    };

    if (context) {
      payload.context = redactPII(context) as Record<string, unknown>;
    }

    if (err instanceof Error) {
      payload.error = {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      };
    }

    const jsonString = JSON.stringify(payload);
    if (level === 'ERROR') {
      console.error(jsonString);
    } else if (level === 'WARN') {
      console.warn(jsonString);
    } else {
      console.log(jsonString);
    }
  }

  public debug(message: string, meta?: { fn?: string; traceId?: string; corrId?: string; ctx?: Record<string, unknown> }) {
    this.write('DEBUG', message, meta?.fn, meta?.traceId || meta?.corrId, meta?.ctx);
  }

  public info(message: string, meta?: { fn?: string; traceId?: string; corrId?: string; ctx?: Record<string, unknown> }) {
    this.write('INFO', message, meta?.fn, meta?.traceId || meta?.corrId, meta?.ctx);
  }

  public warn(message: string, meta?: { fn?: string; traceId?: string; corrId?: string; ctx?: Record<string, unknown>; err?: unknown }) {
    this.write('WARN', message, meta?.fn, meta?.traceId || meta?.corrId, meta?.ctx, meta?.err);
  }

  public error(message: string, meta?: { fn?: string; traceId?: string; corrId?: string; ctx?: Record<string, unknown>; err?: unknown }) {
    this.write('ERROR', message, meta?.fn, meta?.traceId || meta?.corrId, meta?.ctx, meta?.err);
  }
}

export const logger = new Logger('pms-backend');
