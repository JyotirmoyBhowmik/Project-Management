// ==============================================================================
// src/lib/email/email-service.ts
// Enterprise Transactional Email Service Singleton with Adapter Routing & Observability
// ==============================================================================

import {
  IEmailAdapter,
  SendEmailOptions,
  EmailResult,
  SendEmailSchema,
  WorkspaceInvitationTemplateData,
  GuestInvitationTemplateData,
  TaskAssignmentTemplateData,
  SlaMilestoneTemplateData,
  DailyDigestTemplateData,
} from './types';
import { ResendEmailAdapter } from './adapters/resend-adapter';
import { SmtpEmailAdapter } from './adapters/smtp-adapter';
import { renderWorkspaceInvitationEmail } from './templates/workspace-invitation';
import { renderGuestInvitationEmail } from './templates/guest-invitation';
import { renderTaskAssignmentEmail } from './templates/task-assignment';
import { renderSlaMilestoneEmail } from './templates/sla-milestone';
import { renderDailyDigestEmail } from './templates/daily-digest';
import { logger } from '@/lib/logger/logger';

export class EmailService {
  private adapter: IEmailAdapter;

  constructor(adapter?: IEmailAdapter) {
    if (adapter) {
      this.adapter = adapter;
    } else {
      const provider = process.env.EMAIL_PROVIDER?.toLowerCase() || 'resend';
      if (provider === 'smtp') {
        this.adapter = new SmtpEmailAdapter();
      } else {
        this.adapter = new ResendEmailAdapter();
      }
    }
  }

  public setAdapter(adapter: IEmailAdapter): void {
    this.adapter = adapter;
  }

  public getAdapter(): IEmailAdapter {
    return this.adapter;
  }

  public async send(options: SendEmailOptions): Promise<EmailResult> {
    const correlationId = options.correlationId || `tx-email-${Date.now()}`;

    // Schema Validation (Rule 1.2, 1.3)
    const validation = SendEmailSchema.safeParse(options);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.error(`Email payload validation failed: ${errorMsg}`, {
        fn: 'EmailService.send',
        corrId: correlationId,
        ctx: { issues: validation.error.errors },
      });
      return {
        success: false,
        provider: this.adapter.provider,
        error: `Validation error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      };
    }

    // Structured JSON log with PII redaction (mask email handle if needed)
    const recipientMasked = Array.isArray(options.to)
      ? `${options.to.length} recipients`
      : options.to.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    logger.info(`Dispatching transactional email via [${this.adapter.provider}]`, {
      fn: 'EmailService.send',
      corrId: correlationId,
      ctx: { recipient: recipientMasked, subject: options.subject },
    });

    try {
      const result = await this.adapter.send({
        ...options,
        correlationId,
      });
      return result;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Unhandled failure in email adapter: ${errorMsg}`, {
        fn: 'EmailService.send',
        corrId: correlationId,
        err,
      });
      return {
        success: false,
        provider: this.adapter.provider,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ----------------------------------------------------------------------------
  // High-Level Template Dispatchers
  // ----------------------------------------------------------------------------

  public async sendWorkspaceInvitation(
    to: string,
    data: WorkspaceInvitationTemplateData,
    correlationId?: string
  ): Promise<EmailResult> {
    const { subject, html, text } = renderWorkspaceInvitationEmail(data);
    return this.send({
      to,
      subject,
      html,
      text,
      correlationId,
      tags: { category: 'workspace_invite', tenant: data.tenantSlug },
    });
  }

  public async sendGuestInvitation(
    to: string,
    data: GuestInvitationTemplateData,
    correlationId?: string
  ): Promise<EmailResult> {
    const { subject, html, text } = renderGuestInvitationEmail(data);
    return this.send({
      to,
      subject,
      html,
      text,
      correlationId,
      tags: { category: 'guest_invite' },
    });
  }

  public async sendTaskAssignment(
    to: string,
    data: TaskAssignmentTemplateData,
    correlationId?: string
  ): Promise<EmailResult> {
    const { subject, html, text } = renderTaskAssignmentEmail(data);
    return this.send({
      to,
      subject,
      html,
      text,
      correlationId,
      tags: { category: 'task_assignment', task_code: data.taskCode },
    });
  }

  public async sendSlaMilestoneAlert(
    to: string,
    data: SlaMilestoneTemplateData,
    correlationId?: string
  ): Promise<EmailResult> {
    const { subject, html, text } = renderSlaMilestoneEmail(data);
    return this.send({
      to,
      subject,
      html,
      text,
      correlationId,
      tags: { category: 'sla_alert', breached: String(data.isBreached) },
    });
  }

  public async sendDailyDigest(
    to: string,
    data: DailyDigestTemplateData,
    correlationId?: string
  ): Promise<EmailResult> {
    const { subject, html, text } = renderDailyDigestEmail(data);
    return this.send({
      to,
      subject,
      html,
      text,
      correlationId,
      tags: { category: 'daily_digest' },
    });
  }
}

export const emailService = new EmailService();
