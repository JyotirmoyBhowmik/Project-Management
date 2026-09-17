// ==============================================================================
// src/lib/validation/schemas.ts
// Strict boundary validation and DTO schema enforcement (Rule 1.1 - 1.4)
// ==============================================================================

import { z } from 'zod';

// Regex for safe entity codes (alphanumeric with hyphens/underscores)
const SAFE_CODE_REGEX = /^[A-Z0-9_-]{2,32}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// String sanitization helper against script tags & HTML injection
export function sanitizeString(val: string): string {
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

// ------------------------------------------------------------------------------
// Tenant Validation Schemas
// ------------------------------------------------------------------------------
export const TenantCreateSchema = z.object({
  name: z.string().min(2).max(255).transform(sanitizeString),
  code: z.string().regex(SAFE_CODE_REGEX, 'Code must be uppercase alphanumeric with dashes/underscores (2-32 chars)'),
  slug: z.string().min(2).max(63).toLowerCase().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and dashes'),
  domain: z.string().max(255).optional().nullable(),
  branding_json: z.object({
    primary_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#2563eb'),
    theme_preset: z.enum(['light', 'dark', 'navy', 'monokai', 'high-contrast']).default('navy'),
    company_tagline: z.string().max(200).optional(),
  }).default({}),
  storage_quota_mb: z.number().int().positive().max(1048576).default(5120),
});

export const TenantUpdateSchema = TenantCreateSchema.partial();

// ------------------------------------------------------------------------------
// Project Validation Schemas
// ------------------------------------------------------------------------------
export const ProjectCreateBaseSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(2).max(255).transform(sanitizeString),
  code: z.string().regex(SAFE_CODE_REGEX, 'Project code must be uppercase alphanumeric (e.g. PRJ-01)'),
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
// Task Validation Schemas (Hierarchical up to 4 levels)
// ------------------------------------------------------------------------------
export const TaskCreateBaseSchema = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  phase_id: z.string().uuid().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(255).transform(sanitizeString),
  description: z.string().max(5000).optional().nullable().transform(val => val ? sanitizeString(val) : null),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'completed', 'blocked']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  start_date: z.string().regex(DATE_REGEX, 'Start date must be YYYY-MM-DD'),
  end_date: z.string().regex(DATE_REGEX, 'End date must be YYYY-MM-DD'),
  duration_days: z.number().int().min(0, 'Duration days must be non-negative').default(1),
  progress_percent: z.number().int().min(0).max(100).default(0),
  is_milestone: z.boolean().default(false),
  order_index: z.number().int().default(0),
});

export const TaskCreateSchema = TaskCreateBaseSchema.refine(data => {
  return new Date(data.end_date) >= new Date(data.start_date);
}, {
  message: 'end_date cannot precede start_date',
  path: ['end_date'],
});

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
  type: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
  lag_days: z.number().int().min(-365).max(365).default(0),
});

export const DependencyCreateSchema = DependencyCreateBaseSchema.refine(data => data.predecessor_id !== data.successor_id, {
  message: 'Predecessor task cannot be the same as successor task',
  path: ['successor_id'],
});

// ------------------------------------------------------------------------------
// Working Calendar Validation Schema
// ------------------------------------------------------------------------------
export const CalendarConfigSchema = z.object({
  tenant_id: z.string().uuid(),
  name: z.string().min(2).max(128).transform(sanitizeString),
  description: z.string().max(500).optional().nullable(),
  is_default: z.boolean().default(false),
  week_start_day: z.number().int().min(0).max(6),
  working_days: z.array(z.number().int().min(0).max(6)).min(1, 'Must have at least 1 working day per week'),
  daily_working_hours: z.number().positive().max(24).default(8.00),
});

export const HolidayCreateSchema = z.object({
  tenant_id: z.string().uuid(),
  calendar_id: z.string().uuid(),
  name: z.string().min(2).max(128).transform(sanitizeString),
  date: z.string().regex(DATE_REGEX),
  is_recurring: z.boolean().default(false),
});

// ------------------------------------------------------------------------------
// Import File Schema (Dry-run import validation)
// ------------------------------------------------------------------------------
export const ImportRowSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  phase: z.string().optional().nullable(),
  parent_title: z.string().optional().nullable(),
  start_date: z.string().regex(DATE_REGEX, 'Valid date YYYY-MM-DD required'),
  duration_days: z.coerce.number().int().min(0).default(1),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'completed', 'blocked']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assignee: z.string().optional().nullable(),
  dependencies: z.string().optional().nullable(),
});

export type ValidatedImportRow = z.infer<typeof ImportRowSchema>;
