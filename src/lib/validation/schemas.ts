// ==============================================================================
// src/lib/validation/schemas.ts
// Strict boundary validation and DTO schema enforcement (Rule 1.1 - 1.4)
// ==============================================================================

import { z } from 'zod';

const SAFE_CODE_REGEX = /^[A-Z0-9_-]{2,32}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeString(val: string): string {
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

// ------------------------------------------------------------------------------
// Tenant Validation Schemas
// ------------------------------------------------------------------------------
export const TenantCreateBaseSchema = z.object({
  name: z.string().min(2).max(255).transform(sanitizeString),
  tenant_code: z.string().regex(SAFE_CODE_REGEX, 'Code must be uppercase alphanumeric with dashes/underscores (2-32 chars)').optional(),
  code: z.string().regex(SAFE_CODE_REGEX, 'Code must be uppercase alphanumeric with dashes/underscores (2-32 chars)').optional(),
  slug: z.string().min(2).max(63).toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and dashes'),
  domain: z.string().max(255).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  week_starts_on: z.number().int().min(0).max(6).default(1),
  weekend_days: z.array(z.number().int().min(0).max(6)).default([0, 6]),
  branding_json: z.object({
    primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#2563eb'),
    theme_preset: z.enum(['light', 'dark', 'navy', 'monokai', 'high-contrast']).default('navy'),
    company_tagline: z.string().max(200).optional(),
  }).default({}),
  storage_quota_mb: z.number().int().positive().max(1048576).default(5120),
});

export const TenantCreateSchema = TenantCreateBaseSchema.transform(data => ({
  ...data,
  tenant_code: data.tenant_code || data.code || 'TENANT',
  code: data.code || data.tenant_code || 'TENANT',
}));

export const TenantUpdateSchema = TenantCreateBaseSchema.partial();

// ------------------------------------------------------------------------------
// Project Validation Schemas
// ------------------------------------------------------------------------------
export const ProjectCreateBaseSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(2).max(255).transform(sanitizeString),
  code: z.string().regex(SAFE_CODE_REGEX, 'Project code must be uppercase alphanumeric (e.g. PRJ-01)').optional(),
  description: z.string().max(2000).optional().nullable().transform(val => val ? sanitizeString(val) : null),
  status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']).default('active'),
  start_date: z.string().regex(DATE_REGEX, 'Start date must be in YYYY-MM-DD format'),
  target_end_date: z.string().regex(DATE_REGEX, 'Target end date must be in YYYY-MM-DD format').optional().nullable(),
  calendar_id: z.string().uuid().optional().nullable(),
});

export const ProjectCreateSchema = ProjectCreateBaseSchema.refine(data => {
  if (data.target_end_date && data.start_date) {
    return new Date(data.target_end_date) >= new Date(data.start_date);
  }
  return true;
}, {
  message: 'target_end_date cannot precede start_date',
  path: ['target_end_date'],
});

export const ProjectUpdateSchema = ProjectCreateBaseSchema.partial();

// ------------------------------------------------------------------------------
// Task Validation Schemas
// ------------------------------------------------------------------------------
export const TaskCreateBaseSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  phase_id: z.string().uuid().optional().nullable(),
  parent_task_id: z.string().uuid().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(255).transform(sanitizeString),
  description: z.string().max(5000).optional().nullable().transform(val => val ? sanitizeString(val) : null),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'completed', 'blocked']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  start_date: z.string().regex(DATE_REGEX, 'Start date must be YYYY-MM-DD'),
  end_date: z.string().regex(DATE_REGEX, 'End date must be YYYY-MM-DD'),
  duration_days: z.number().int().min(0, 'Duration days must be non-negative').default(1),
  progress: z.number().int().min(0).max(100).default(0),
  progress_percent: z.number().int().min(0).max(100).optional(),
  is_milestone: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  order_index: z.number().int().default(0),
});

export const TaskCreateSchema = TaskCreateBaseSchema.refine(data => {
  return new Date(data.end_date) >= new Date(data.start_date);
}, {
  message: 'end_date cannot precede start_date',
  path: ['end_date'],
}).transform(data => ({
  ...data,
  parent_task_id: data.parent_task_id || data.parent_id || null,
  parent_id: data.parent_id || data.parent_task_id || null,
  progress: data.progress ?? data.progress_percent ?? 0,
  progress_percent: data.progress_percent ?? data.progress ?? 0,
  sort_order: data.sort_order || data.order_index || 0,
  order_index: data.order_index || data.sort_order || 0,
}));

export const TaskUpdateSchema = TaskCreateBaseSchema.partial();

export const TaskMoveSchema = z.object({
  task_id: z.string().uuid(),
  start_date: z.string().regex(DATE_REGEX),
  end_date: z.string().regex(DATE_REGEX),
  duration_days: z.number().int().min(0).optional(),
});

// ------------------------------------------------------------------------------
// Dependency Validation Schemas
// ------------------------------------------------------------------------------
export const DependencyCreateBaseSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  predecessor_id: z.string().uuid(),
  successor_id: z.string().uuid(),
  dep_type: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
  type: z.enum(['FS', 'SS', 'FF', 'SF']).optional(),
  lag_days: z.number().int().min(-365).max(365).default(0),
});

export const DependencyCreateSchema = DependencyCreateBaseSchema.refine(data => data.predecessor_id !== data.successor_id, {
  message: 'Predecessor task cannot be the same as successor task',
  path: ['successor_id'],
}).transform(data => ({
  ...data,
  dep_type: data.dep_type || data.type || 'FS',
  type: data.type || data.dep_type || 'FS',
}));

// ------------------------------------------------------------------------------
// Working Calendar Validation Schema
// ------------------------------------------------------------------------------
export const CalendarConfigSchema = z.object({
  tenant_id: z.string().uuid(),
  week_starts_on: z.number().int().min(0).max(6).default(1),
  weekend_days: z.array(z.number().int().min(0).max(6)).default([0, 6]),
  daily_working_hours: z.number().positive().max(24).default(8.00),
});

export const HolidayCreateSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(2).max(128).transform(sanitizeString),
  holiday_date: z.string().regex(DATE_REGEX).optional(),
  date: z.string().regex(DATE_REGEX).optional(),
  is_recurring: z.boolean().default(false),
}).transform(data => ({
  ...data,
  holiday_date: data.holiday_date || data.date || '2026-01-01',
  date: data.date || data.holiday_date || '2026-01-01',
}));

// ------------------------------------------------------------------------------
// Exact Standard Schema Definition (for Import/Export & Template Downloads)
// ------------------------------------------------------------------------------
export const StandardPredecessorSchema = z.object({
  id: z.string(),
  type: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
  lag_days: z.number().int().default(0),
});

export const StandardImportRowSchema = z.object({
  phase: z.string().optional().nullable(),
  task_id: z.string().optional().nullable(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  start_date: z.string().regex(DATE_REGEX, 'Valid date YYYY-MM-DD required'),
  duration_days: z.coerce.number().int().min(0).default(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'completed', 'blocked']).default('todo'),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  assignee_emails: z.array(z.string().email()).default([]),
  predecessors: z.array(StandardPredecessorSchema).default([]),
});

export type ValidatedStandardImportRow = z.infer<typeof StandardImportRowSchema>;

export const ImportRowSchema = StandardImportRowSchema;
export type ValidatedImportRow = ValidatedStandardImportRow;

export const AuthRepairSchema = z.object({
  email: z.string().email().transform(sanitizeString),
  password: z.string().min(6).max(100),
});
export type ValidatedAuthRepair = z.infer<typeof AuthRepairSchema>;
