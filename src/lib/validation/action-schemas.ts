// ==============================================================================
// src/lib/validation/action-schemas.ts
// Centralized Validation Schemas & Input Types for Server Actions
// Isolated from "use server" files to comply with Next.js 15 Server Action rules
// (Files with "use server" can only export async functions)
// ==============================================================================

import { z } from 'zod';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  task?: T;
  error?: string;
  details?: any;
  correlation_id?: string;
}

// ------------------------------------------------------------------------------
// 1. Task Schemas
// ------------------------------------------------------------------------------

export const TaskInputSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(255, 'Task title cannot exceed 255 characters'),
  project_id: z.string().uuid('Valid project UUID is required'),
  tenant_id: z.string().uuid('Valid tenant UUID is required'),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional(),
  duration_days: z.number().int().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.string().default('todo'),
  description: z.string().nullable().optional(),
  task_code: z.string().optional(),
  is_milestone: z.boolean().default(false),
  assignee_ids: z.array(z.string().uuid()).optional(),
});

export type TaskInput = z.infer<typeof TaskInputSchema>;

export const UpdateTaskScheduleSchema = z.object({
  taskId: z.string().uuid('Valid task UUID is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  durationDays: z.number().int().min(0, 'Duration days must be non-negative'),
  projectId: z.string().uuid().optional(),
});

export type UpdateTaskScheduleInput = z.infer<typeof UpdateTaskScheduleSchema>;

export const UpdateTaskStatusSchema = z.object({
  taskId: z.string().uuid('Valid task UUID is required'),
  status: z.string().min(1, 'Status cannot be empty'),
  projectId: z.string().uuid().optional(),
});

export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusSchema>;

// ------------------------------------------------------------------------------
// 2. Timesheet Schemas
// ------------------------------------------------------------------------------

export const LogTimeSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  task_id: z.string().uuid(),
  date_worked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  hours_spent: z.number().positive('Hours spent must be greater than zero').max(24, 'Cannot log more than 24 hours per day'),
  is_billable: z.boolean().default(true),
  description: z.string().max(1000).nullable().optional(),
});

export type LogTimeInput = z.infer<typeof LogTimeSchema>;

// ------------------------------------------------------------------------------
// 3. Sprint Schemas
// ------------------------------------------------------------------------------

export const CreateSprintSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1, 'Sprint name is required').max(100),
  sprint_goal: z.string().max(500).nullable().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
});

export type CreateSprintInput = z.infer<typeof CreateSprintSchema>;

// ------------------------------------------------------------------------------
// 4. Automation Schemas
// ------------------------------------------------------------------------------

export const CreateAutomationSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, 'Automation name is required').max(150),
  trigger_type: z.enum(['task_status_changed', 'task_created', 'due_date_approaching', 'dependency_cleared']),
  trigger_config: z.record(z.any()).default({}),
  conditions: z.array(
    z.object({
      field: z.string(),
      operator: z.enum(['equals', 'not_equals', 'greater_than', 'contains', 'is_empty']),
      value: z.any(),
    })
  ).default([]),
  actions: z.array(
    z.object({
      action_type: z.enum(['update_field', 'assign_user', 'dispatch_webhook', 'create_subtask']),
      payload: z.record(z.any()),
    })
  ).min(1, 'At least one action is required'),
});

export type CreateAutomationInput = z.infer<typeof CreateAutomationSchema>;

// ------------------------------------------------------------------------------
// 5. Wiki Document Schemas
// ------------------------------------------------------------------------------

export const CreateDocSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  parent_doc_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1, 'Document title is required').max(200),
  content_json: z.record(z.any()).default({ type: 'doc', content: [] }),
});

export type CreateDocInput = z.infer<typeof CreateDocSchema>;

// ------------------------------------------------------------------------------
// 6. Phase 6: Identity Federation & IAM Schemas
// ------------------------------------------------------------------------------

export const TenantSSOConfigSchema = z.object({
  tenant_id: z.string().uuid('Valid tenant UUID is required'),
  idp_entity_id: z.string().min(1, 'Entity ID is required'),
  idp_sso_url: z.string().url('Valid IdP SSO URL is required'),
  idp_certificate: z.string().min(10, 'Public X.509 certificate is required'),
  metadata_xml_url: z.string().url('Invalid metadata URL').nullable().optional(),
  allowed_domains: z.array(z.string().min(2)).default([]),
  enforce_sso: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export type TenantSSOConfigInput = z.infer<typeof TenantSSOConfigSchema>;

export const TenantDirectorySyncConfigSchema = z.object({
  tenant_id: z.string().uuid('Valid tenant UUID is required'),
  protocol: z.enum(['ldap', 'ldaps', 'azure_ad_graph', 'scim']),
  host_url: z.string().nullable().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  bind_dn: z.string().nullable().optional(),
  bind_credentials: z.string().nullable().optional(),
  search_base: z.string().nullable().optional(),
  user_search_filter: z.string().default('(objectClass=user)'),
  group_search_filter: z.string().nullable().optional(),
  sync_interval_hours: z.number().int().min(1).default(24),
  auto_deactivate_missing_users: z.boolean().default(true),
  is_enabled: z.boolean().default(false),
});

export type TenantDirectorySyncConfigInput = z.infer<typeof TenantDirectorySyncConfigSchema>;

// ------------------------------------------------------------------------------
// 7. Phase 6: Member Provisioning Schemas
// ------------------------------------------------------------------------------

export const ProvisionMemberSchema = z.object({
  tenant_id: z.string().uuid('Valid tenant UUID is required'),
  email: z.string().email('Valid email address is required'),
  full_name: z.string().min(1, 'Full name is required').max(100),
  role: z.enum(['owner', 'admin', 'project_manager', 'member', 'guest']).default('member'),
  team_id: z.string().uuid().nullable().optional(),
  send_invite_email: z.boolean().default(true),
});

export type ProvisionMemberInput = z.infer<typeof ProvisionMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  membership_id: z.string().uuid('Valid membership UUID is required'),
  tenant_id: z.string().uuid('Valid tenant UUID is required'),
  role: z.enum(['owner', 'admin', 'project_manager', 'member', 'guest']),
});

export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

// ------------------------------------------------------------------------------
// 8. Phase 6: Lifecycle Deletion Schemas
// ------------------------------------------------------------------------------

export const DeleteTaskSchema = z.object({
  task_id: z.string().uuid('Valid task UUID is required'),
  tenant_id: z.string().uuid('Valid tenant UUID is required'),
  project_id: z.string().uuid('Valid project UUID is required'),
  dependency_strategy: z.enum(['bridge', 'sever']).default('bridge'),
  is_hard_delete: z.boolean().default(false),
});

export type DeleteTaskInput = z.infer<typeof DeleteTaskSchema>;

export const DeleteProjectSchema = z.object({
  project_id: z.string().uuid('Valid project UUID is required'),
  tenant_id: z.string().uuid('Valid tenant UUID is required'),
  confirm_project_code: z.string().min(1, 'Project code confirmation is required'),
  is_hard_delete: z.boolean().default(false),
});

export type DeleteProjectInput = z.infer<typeof DeleteProjectSchema>;

export const PurgeTenantSchema = z.object({
  tenant_id: z.string().uuid('Valid tenant UUID is required'),
  confirm_slug: z.string().trim().min(1, 'Tenant slug confirmation is required'),
  admin_password_confirmation: z.string().optional(),
});

export type PurgeTenantInput = z.infer<typeof PurgeTenantSchema>;

