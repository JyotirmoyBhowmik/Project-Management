// ==============================================================================
// tests/unit/email-service.test.ts
// Unit Tests: Transactional Email Service, Schema Validation & Template Renderers
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  EmailService,
  renderWorkspaceInvitationEmail,
  renderGuestInvitationEmail,
  renderTaskAssignmentEmail,
  renderSlaMilestoneEmail,
  renderDailyDigestEmail,
  SendEmailSchema,
  IEmailAdapter,
  SendEmailOptions,
  EmailResult,
} from '@/lib/email';

class TestMockAdapter implements IEmailAdapter {
  public readonly provider = 'mock' as const;
  public sentEmails: SendEmailOptions[] = [];

  async send(options: SendEmailOptions): Promise<EmailResult> {
    this.sentEmails.push(options);
    return {
      success: true,
      messageId: `mock-msg-${Date.now()}`,
      provider: 'mock',
      timestamp: new Date().toISOString(),
    };
  }
}

describe('Transactional Email Infrastructure', () => {
  describe('Zod Schema Validation (Rules 1.2, 1.3)', () => {
    it('should reject payload with invalid email address format', () => {
      const invalidPayload = {
        to: 'not-an-email',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      };

      const result = SendEmailSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid email address format');
      }
    });

    it('should reject payload with empty subject or empty HTML content', () => {
      const emptySubject = {
        to: 'user@example.com',
        subject: '',
        html: '<p>Content</p>',
      };
      expect(SendEmailSchema.safeParse(emptySubject).success).toBe(false);

      const emptyHtml = {
        to: 'user@example.com',
        subject: 'Subject',
        html: '',
      };
      expect(SendEmailSchema.safeParse(emptyHtml).success).toBe(false);
    });

    it('should accept valid single and multiple recipient payloads', () => {
      const single = {
        to: 'user@example.com',
        subject: 'Welcome',
        html: '<p>Welcome</p>',
      };
      expect(SendEmailSchema.safeParse(single).success).toBe(true);

      const multi = {
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Team Update',
        html: '<p>Update</p>',
      };
      expect(SendEmailSchema.safeParse(multi).success).toBe(true);
    });
  });

  describe('Template Renderers', () => {
    it('should render Workspace Invitation template with tenant details and action link', () => {
      const rendered = renderWorkspaceInvitationEmail({
        recipientName: 'Alice Johnson',
        inviteeEmail: 'alice@acme.com',
        inviterName: 'Bob Smith',
        workspaceName: 'Acme Corp',
        tenantSlug: 'acme',
        role: 'project_manager',
        inviteUrl: 'https://pms.example.com/invites/inv-123',
        expiresAt: '2026-10-01 12:00 UTC',
      });

      expect(rendered.subject).toContain('Acme Corp');
      expect(rendered.html).toContain('Alice Johnson');
      expect(rendered.html).toContain('Bob Smith');
      expect(rendered.html).toContain('project_manager');
      expect(rendered.html).toContain('https://pms.example.com/invites/inv-123');
      expect(rendered.text).toContain('alice@acme.com');
    });

    it('should render Guest Containment Invitation template highlighting isolation boundary', () => {
      const rendered = renderGuestInvitationEmail({
        guestEmail: 'auditor@external.org',
        inviterName: 'Lead Architect',
        projectName: 'Security Audit Q4',
        accessLevel: 'viewer',
        portalUrl: 'https://pms.example.com/guest/portal-456',
        expiresAt: '2026-11-15',
      });

      expect(rendered.subject).toContain('Security Audit Q4');
      expect(rendered.html).toContain('Security Audit Q4');
      expect(rendered.html).toContain('VIEWER');
      expect(rendered.html).toContain('Guest Boundary Isolation');
      expect(rendered.html).toContain('https://pms.example.com/guest/portal-456');
    });

    it('should render Task Assignment template with priority badge and task code', () => {
      const rendered = renderTaskAssignmentEmail({
        assigneeName: 'Carlos Ray',
        taskTitle: 'Implement OAuth PKCE Flow',
        taskCode: 'TSK-104',
        projectName: 'Identity Migration',
        priority: 'urgent',
        dueDate: '2026-10-10',
        taskUrl: 'https://pms.example.com/tasks/tsk-104',
      });

      expect(rendered.subject).toContain('[TSK-104]');
      expect(rendered.html).toContain('TSK-104');
      expect(rendered.html).toContain('Implement OAuth PKCE Flow');
      expect(rendered.html).toContain('URGENT Priority');
      expect(rendered.html).toContain('2026-10-10');
    });

    it('should render SLA Milestone Alert template with correct breach/warning state', () => {
      const warningRender = renderSlaMilestoneEmail({
        recipientName: 'Manager Dave',
        milestoneTitle: 'Beta Delivery',
        projectName: 'Cloud Modernization',
        targetDate: '2026-10-02',
        hoursRemaining: 24,
        isBreached: false,
        actionUrl: 'https://pms.example.com/milestones/ms-1',
      });

      expect(warningRender.subject).toContain('SLA Milestone Warning');
      expect(warningRender.html).toContain('24 hours remaining');
      expect(warningRender.html).not.toContain('CRITICAL SLA THRESHOLD BREACHED');

      const breachRender = renderSlaMilestoneEmail({
        recipientName: 'Manager Dave',
        milestoneTitle: 'Final Acceptance Signoff',
        projectName: 'Cloud Modernization',
        targetDate: '2026-09-10',
        hoursRemaining: 0,
        isBreached: true,
        actionUrl: 'https://pms.example.com/milestones/ms-2',
      });

      expect(breachRender.subject).toContain('CRITICAL SLA BREACH');
      expect(breachRender.html).toContain('CRITICAL SLA THRESHOLD BREACHED');
      expect(breachRender.text).toContain('DEADLINE BREACHED');
    });

    it('should render Daily Digest template with overdue and upcoming sections', () => {
      const rendered = renderDailyDigestEmail({
        recipientName: 'Lead Engineer',
        workspaceName: 'Enterprise Core',
        date: '2026-09-17',
        overdueTasks: [
          { title: 'Database Index Optimization', code: 'TSK-001', dueDate: '2026-09-15' },
        ],
        upcomingTasks: [
          { title: 'Security Pen Testing', code: 'TSK-002', dueDate: '2026-09-19' },
        ],
        digestUrl: 'https://pms.example.com/daily',
      });

      expect(rendered.subject).toContain('Enterprise Core');
      expect(rendered.html).toContain('TSK-001');
      expect(rendered.html).toContain('Database Index Optimization');
      expect(rendered.html).toContain('TSK-002');
      expect(rendered.html).toContain('Security Pen Testing');
      expect(rendered.text).toContain('OVERDUE TASKS (1)');
    });
  });

  describe('EmailService Dispatcher', () => {
    it('should dispatch emails via configured adapter and reject invalid payloads without sending', async () => {
      const mockAdapter = new TestMockAdapter();
      const service = new EmailService(mockAdapter);

      // Attempt sending invalid payload
      const invalidResult = await service.send({
        to: 'invalid-email',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      expect(invalidResult.success).toBe(false);
      expect(mockAdapter.sentEmails.length).toBe(0);

      // Valid template dispatch
      const validResult = await service.sendTaskAssignment('dev@example.com', {
        assigneeName: 'Developer',
        taskTitle: 'Unit Test Creation',
        taskCode: 'DEV-01',
        projectName: 'PMS v1',
        priority: 'high',
        dueDate: '2026-09-20',
        taskUrl: 'https://example.com/tasks/1',
      });

      expect(validResult.success).toBe(true);
      expect(mockAdapter.sentEmails.length).toBe(1);
      expect(mockAdapter.sentEmails[0].to).toBe('dev@example.com');
      expect(mockAdapter.sentEmails[0].subject).toContain('[DEV-01]');
    });
  });
});
