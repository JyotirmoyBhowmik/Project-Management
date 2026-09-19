-- ==============================================================================
-- Migration 00018: Global Base Application Configuration & Feature Controls
-- Description: Creates public.system_configurations table for root-level
-- platform identity (app name, icon, branding), master control feature flags,
-- maintenance mode, and operational governance policies.
-- ==============================================================================

-- 1. Create System Configurations Table
CREATE TABLE IF NOT EXISTS public.system_configurations (
    id TEXT PRIMARY KEY DEFAULT 'global_config',
    app_name TEXT NOT NULL DEFAULT 'Enterprise PMS',
    app_short_name TEXT NOT NULL DEFAULT 'PMS',
    app_tagline TEXT NOT NULL DEFAULT 'Mission-Critical Project Management & Scheduling Platform',
    app_icon TEXT NOT NULL DEFAULT 'FolderKanban',
    logo_url TEXT,
    primary_color TEXT NOT NULL DEFAULT '#3b82f6',
    company_name TEXT NOT NULL DEFAULT 'Enterprise Core Systems',
    support_email TEXT NOT NULL DEFAULT 'support@pms.jyotirmoyb.com',
    control_features JSONB NOT NULL DEFAULT '{
        "enable_wiki": true,
        "enable_graphify": true,
        "enable_sprints": true,
        "enable_cpm_engine": true,
        "enable_evm": true,
        "enable_subtasks": true,
        "enable_milestones": true,
        "enable_scim": true,
        "enable_sso": true,
        "enable_sla_milestone_alerts": true,
        "enable_public_registration": false,
        "maintenance_mode": false,
        "maintenance_message": "Platform is currently undergoing scheduled maintenance. Please check back shortly."
    }'::jsonb,
    security_controls JSONB NOT NULL DEFAULT '{
        "session_timeout_minutes": 120,
        "max_upload_size_mb": 25,
        "mfa_enforcement": "optional",
        "audit_retention_days": 90
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT chk_single_global_config CHECK (id = 'global_config')
);

-- 2. Seed Initial Configuration if not present
INSERT INTO public.system_configurations (
    id,
    app_name,
    app_short_name,
    app_tagline,
    app_icon,
    primary_color,
    company_name,
    support_email,
    control_features,
    security_controls
) VALUES (
    'global_config',
    'Enterprise PMS',
    'PMS',
    'Mission-Critical Project Management & Scheduling Platform',
    'FolderKanban',
    '#3b82f6',
    'Enterprise Core Systems',
    'support@pms.jyotirmoyb.com',
    '{
        "enable_wiki": true,
        "enable_graphify": true,
        "enable_sprints": true,
        "enable_cpm_engine": true,
        "enable_evm": true,
        "enable_subtasks": true,
        "enable_milestones": true,
        "enable_scim": true,
        "enable_sso": true,
        "enable_sla_milestone_alerts": true,
        "enable_public_registration": false,
        "maintenance_mode": false,
        "maintenance_message": "Platform is currently undergoing scheduled maintenance. Please check back shortly."
    }'::jsonb,
    '{
        "session_timeout_minutes": 120,
        "max_upload_size_mb": 25,
        "mfa_enforcement": "optional",
        "audit_retention_days": 90
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.system_configurations ENABLE ROW LEVEL SECURITY;

-- Allow public read access so that branding, app title, icon, and maintenance status
-- can be loaded across the unauthenticated login screen and all authenticated routes
DROP POLICY IF EXISTS "Allow public read access for global configuration" ON public.system_configurations;
CREATE POLICY "Allow public read access for global configuration"
    ON public.system_configurations
    FOR SELECT
    USING (true);

-- Restrict mutation (INSERT, UPDATE, DELETE) strictly to SuperAdmins
DROP POLICY IF EXISTS "Allow SuperAdmins to manage global configuration" ON public.system_configurations;
CREATE POLICY "Allow SuperAdmins to manage global configuration"
    ON public.system_configurations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (is_superadmin = true OR email = 'admin@jyotirmoyb.com')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND (is_superadmin = true OR email = 'admin@jyotirmoyb.com')
        )
    );
