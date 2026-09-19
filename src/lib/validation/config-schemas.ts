// ==============================================================================
// src/lib/validation/config-schemas.ts
// Strict Zod Schemas for Global Base Application Configuration & Feature Controls
// Rules 1.1 - 1.4: Strict boundary validation, typed schema enforcement
// ==============================================================================

import { z } from 'zod';

export const SupportedAppIcons = [
  'FolderKanban',
  'Layers',
  'ShieldCheck',
  'Workflow',
  'Sparkles',
  'Compass',
  'Rocket',
  'Cpu',
  'Building2',
  'Hexagon',
  'Boxes',
  'Zap',
  'Target',
  'Kanban',
] as const;

export type SupportedAppIcon = typeof SupportedAppIcons[number];

export const ControlFeaturesSchema = z.object({
  enable_wiki: z.boolean().default(true),
  enable_graphify: z.boolean().default(true),
  enable_sprints: z.boolean().default(true),
  enable_cpm_engine: z.boolean().default(true),
  enable_evm: z.boolean().default(true),
  enable_subtasks: z.boolean().default(true),
  enable_milestones: z.boolean().default(true),
  enable_scim: z.boolean().default(true),
  enable_sso: z.boolean().default(true),
  enable_sla_milestone_alerts: z.boolean().default(true),
  enable_public_registration: z.boolean().default(false),
  maintenance_mode: z.boolean().default(false),
  maintenance_message: z
    .string()
    .max(500, 'Maintenance message cannot exceed 500 characters')
    .default('Platform is currently undergoing scheduled maintenance. Please check back shortly.'),
});

export type ControlFeatures = z.infer<typeof ControlFeaturesSchema>;

export const SecurityControlsSchema = z.object({
  session_timeout_minutes: z
    .number()
    .int()
    .min(5, 'Session timeout must be at least 5 minutes')
    .max(1440, 'Session timeout cannot exceed 24 hours')
    .default(120),
  max_upload_size_mb: z
    .number()
    .int()
    .min(1, 'Upload size must be at least 1 MB')
    .max(500, 'Upload size cannot exceed 500 MB')
    .default(25),
  mfa_enforcement: z
    .enum(['optional', 'enforced_for_superadmin', 'enforced_all'])
    .default('optional'),
  audit_retention_days: z
    .number()
    .int()
    .min(7, 'Audit retention must be at least 7 days')
    .max(3650, 'Audit retention cannot exceed 10 years')
    .default(90),
});

export type SecurityControls = z.infer<typeof SecurityControlsSchema>;

export const GlobalAppConfigSchema = z.object({
  id: z.literal('global_config').default('global_config'),
  app_name: z
    .string()
    .trim()
    .min(1, 'Application Name is required')
    .max(64, 'Application Name cannot exceed 64 characters'),
  app_short_name: z
    .string()
    .trim()
    .min(1, 'Short Name is required')
    .max(12, 'Short Name cannot exceed 12 characters'),
  app_tagline: z
    .string()
    .trim()
    .max(160, 'Tagline cannot exceed 160 characters')
    .default('Mission-Critical Project Management & Scheduling Platform'),
  app_icon: z.enum(SupportedAppIcons).default('FolderKanban'),
  logo_url: z.string().url('Must be a valid URL').nullable().optional(),
  primary_color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color code')
    .default('#3b82f6'),
  company_name: z
    .string()
    .trim()
    .min(1, 'Company Name is required')
    .max(120, 'Company Name cannot exceed 120 characters')
    .default('Enterprise Core Systems'),
  support_email: z
    .string()
    .email('Must be a valid email address')
    .default('support@pms.jyotirmoyb.com'),
  control_features: ControlFeaturesSchema.default({}),
  security_controls: SecurityControlsSchema.default({}),
  updated_at: z.string().optional(),
  updated_by: z.string().uuid().nullable().optional(),
});

export type GlobalAppConfig = z.infer<typeof GlobalAppConfigSchema>;

export const DEFAULT_GLOBAL_APP_CONFIG: GlobalAppConfig = {
  id: 'global_config',
  app_name: 'Enterprise PMS',
  app_short_name: 'PMS',
  app_tagline: 'Mission-Critical Project Management & Scheduling Platform',
  app_icon: 'FolderKanban',
  logo_url: null,
  primary_color: '#3b82f6',
  company_name: 'Enterprise Core Systems',
  support_email: 'support@pms.jyotirmoyb.com',
  control_features: {
    enable_wiki: true,
    enable_graphify: true,
    enable_sprints: true,
    enable_cpm_engine: true,
    enable_evm: true,
    enable_subtasks: true,
    enable_milestones: true,
    enable_scim: true,
    enable_sso: true,
    enable_sla_milestone_alerts: true,
    enable_public_registration: false,
    maintenance_mode: false,
    maintenance_message: 'Platform is currently undergoing scheduled maintenance. Please check back shortly.',
  },
  security_controls: {
    session_timeout_minutes: 120,
    max_upload_size_mb: 25,
    mfa_enforcement: 'optional',
    audit_retention_days: 90,
  },
};
