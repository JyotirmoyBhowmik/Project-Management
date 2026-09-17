// ==============================================================================
// src/lib/email/adapters/smtp-adapter.ts
// Standard Node.js SMTP Transporter Email Adapter with Resilience & Fallback
// ==============================================================================

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { IEmailAdapter, SendEmailOptions, EmailResult } from '../types';
import { withRetry, withTimeout, CircuitBreaker } from '@/lib/resilience/resilience';
import { logger } from '@/lib/logger/logger';

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

export class SmtpEmailAdapter implements IEmailAdapter {
  public readonly provider = 'smtp';
  private transporter: Transporter | null = null;
  private readonly defaultFrom: string;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly isConfigured: boolean;

  constructor(config?: SmtpConfig) {
    const host = config?.host || process.env.SMTP_HOST;
    const port = config?.port || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
    const secure = config?.secure ?? (process.env.SMTP_SECURE === 'true' || port === 465);
    const user = config?.user || process.env.SMTP_USER;
    const pass = config?.pass || process.env.SMTP_PASS;

    this.defaultFrom = config?.from || process.env.EMAIL_FROM || 'noreply@jyotirmoyb.com';
    this.circuitBreaker = new CircuitBreaker('smtp-email-transport', 3, 25000);

    if (host && user && pass) {
      this.isConfigured = true;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 8000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      });
    } else {
      this.isConfigured = false;
    }
  }

  public async send(options: SendEmailOptions): Promise<EmailResult> {
    const correlationId = options.correlationId || `email-smtp-${Date.now()}`;

    if (!this.isConfigured || !this.transporter) {
      logger.warn('SMTP transporter not fully configured; operating in simulation mode', {
        fn: 'SmtpEmailAdapter.send',
        corrId: correlationId,
        ctx: { recipient: Array.isArray(options.to) ? options.to.length : options.to },
      });
      return {
        success: true,
        messageId: `smtp-sim-${Date.now()}`,
        provider: 'smtp',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            return await withTimeout(
              this.transporter!.sendMail({
                from: options.from || this.defaultFrom,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
                replyTo: options.replyTo,
              }),
              12000,
              'smtp-send-mail'
            );
          },
          {
            maxRetries: 2,
            initialDelayMs: 400,
            operationName: 'smtp-transport-send',
          }
        );
      });

      logger.info('Email dispatched successfully via SMTP transporter', {
        fn: 'SmtpEmailAdapter.send',
        corrId: correlationId,
        ctx: { messageId: result.messageId, response: result.response },
      });

      return {
        success: true,
        messageId: result.messageId,
        provider: 'smtp',
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to send email via SMTP transporter', {
        fn: 'SmtpEmailAdapter.send',
        corrId: correlationId,
        err,
      });

      return {
        success: false,
        provider: 'smtp',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
