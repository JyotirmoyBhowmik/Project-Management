// ==============================================================================
// src/lib/email/types.ts
// Transactional Email Service Type Definitions & Schemas (Enterprise Standards)
// ==============================================================================

import { z } from 'zod';

export type EmailProvider = 'resend' | 'smtp' | 'mock';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: Record<string, string>;
  correlationId?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: EmailProvider;
  error?: string;
  timestamp: string;
}

export interface IEmailAdapter {
  readonly provider: EmailProvider;
  send(options: SendEmailOptions): Promise<EmailResult>;
}

// ------------------------------------------------------------------------------
// Template Data Contracts
// ------------------------------------------------------------------------------

export interface WorkspaceInvitationTemplateData {
  recipientName: string;
  inviteeEmail: string;
  inviterName: string;
  workspaceName: string;
  tenantSlug: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
}

export interface GuestInvitationTemplateData {
  guestEmail: string;
  inviterName: string;
  projectName: string;
  accessLevel: 'viewer' | 'collaborator' | 'editor';
  portalUrl: string;
  expiresAt: string;
}

export interface TaskAssignmentTemplateData {
  assigneeName: string;
  taskTitle: string;
  taskCode: string;
  projectName: string;
  priority: string;
  dueDate: string;
  taskUrl: string;
}

export interface SlaMilestoneTemplateData {
  recipientName: string;
  milestoneTitle: string;
  projectName: string;
  targetDate: string;
  hoursRemaining: number;
  isBreached: boolean;
  actionUrl: string;
}

export interface DailyDigestTemplateData {
  recipientName: string;
  workspaceName: string;
  date: string;
  overdueTasks: Array<{
    title: string;
    code: string;
    dueDate: string;
  }>;
  upcomingTasks: Array<{
    title: string;
    code: string;
    dueDate: string;
  }>;
  digestUrl: string;
}

// ------------------------------------------------------------------------------
// Validation Schemas (Rule 1.2, 1.3)
// ------------------------------------------------------------------------------

export const SendEmailSchema = z.object({
  to: z.union([
    z.string().email('Invalid email address format'),
    z.array(z.string().email('Invalid email address format')).min(1, 'At least one recipient required'),
  ]),
  subject: z.string().min(1, 'Subject cannot be empty').max(255, 'Subject exceeds max length'),
  html: z.string().min(1, 'HTML content cannot be empty'),
  text: z.string().optional(),
  from: z.string().email().optional(),
  replyTo: z.string().email().optional(),
  tags: z.record(z.string()).optional(),
  correlationId: z.string().optional(),
});
