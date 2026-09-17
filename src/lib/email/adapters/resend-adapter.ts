// ==============================================================================
// src/lib/email/adapters/resend-adapter.ts
// Resend REST API Email Adapter with Retry, Circuit Breaker & Observability
// ==============================================================================

import { IEmailAdapter, SendEmailOptions, EmailResult } from '../types';
import { withRetry, withTimeout, CircuitBreaker } from '@/lib/resilience/resilience';
import { logger } from '@/lib/logger/logger';

export class ResendEmailAdapter implements IEmailAdapter {
  public readonly provider = 'resend';
  private readonly apiKey: string;
  private readonly defaultFrom: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey || process.env.RESEND_API_KEY || '';
    this.defaultFrom = defaultFrom || process.env.EMAIL_FROM || 'noreply@jyotirmoyb.com';
    this.circuitBreaker = new CircuitBreaker('resend-email-api', 4, 20000);
  }

  public async send(options: SendEmailOptions): Promise<EmailResult> {
    const correlationId = options.correlationId || `email-resend-${Date.now()}`;

    if (!this.apiKey) {
      logger.warn('Resend API key not configured, falling back to simulated delivery', {
        fn: 'ResendEmailAdapter.send',
        corrId: correlationId,
        ctx: { recipient: Array.isArray(options.to) ? options.to.length : options.to },
      });
      return {
        success: true,
        messageId: `resend-sim-${Date.now()}`,
        provider: 'resend',
        timestamp: new Date().toISOString(),
      };
    }

    const payload = {
      from: options.from || this.defaultFrom,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      reply_to: options.replyTo,
      tags: options.tags
        ? Object.entries(options.tags).map(([name, value]) => ({ name, value }))
        : undefined,
    };

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            return await withTimeout(
              (async () => {
                const response = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-Correlation-Id': correlationId,
                  },
                  body: JSON.stringify(payload),
                });

                if (!response.ok) {
                  const errorBody = await response.text();
                  throw new Error(`Resend API HTTP ${response.status}: ${errorBody}`);
                }

                const data = await response.json();
                return data;
              })(),
              10000,
              'resend-send-email'
            );
          },
          {
            maxRetries: 3,
            initialDelayMs: 300,
            maxDelayMs: 4000,
            operationName: 'resend-api-send',
          }
        );
      });

      logger.info('Email delivered successfully via Resend', {
        fn: 'ResendEmailAdapter.send',
        corrId: correlationId,
        ctx: { messageId: result.id, subject: options.subject },
      });

      return {
        success: true,
        messageId: result.id,
        provider: 'resend',
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to send email via Resend adapter', {
        fn: 'ResendEmailAdapter.send',
        corrId: correlationId,
        err,
      });

      return {
        success: false,
        provider: 'resend',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
