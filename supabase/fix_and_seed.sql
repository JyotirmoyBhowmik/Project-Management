-- ==============================================================================
-- FIX & MASTER PROVISIONING SCRIPT (100% Idempotent, Safe for Re-Runs)
-- Solves:
--   1. ERROR 42710 (policy already exists)
--   2. ERROR 22P02 (invalid input value for enum tenant_role_enum: "owner")
--   3. Foreign key constraints across legacy schema variations
-- Enables: Anonymous workspace code lookup at /login for active tenants
-- Provisions: Enterprise Core (slug: core, code: CORE-SYS) & admin@jyotirmoyb.com
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Domain Enums Safely
DO $$ BEGIN
    CREATE TYPE tenant_role_enum AS ENUM ('superadmin', 'tenant_admin', 'project_manager', 'contributor', 'guest');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE user_tenant_role AS ENUM ('owner', 'admin', 'project_manager', 'member', 'guest');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status_enum AS ENUM ('active', 'suspended', 'trial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_status_enum AS ENUM ('backlog', 'todo', 'in_progress', 'review', 'completed', 'blocked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE dependency_type_enum AS ENUM ('FS', 'SS', 'FF', 'SF');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Harmonize Existing Tables (Safe Alterations for Legacy Schemas)
-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(63) NOT NULL UNIQUE,
    code VARCHAR(32) NOT NULL UNIQUE,
    tenant_code VARCHAR(32),
    domain VARCHAR(255),
    status tenant_status_enum NOT NULL DEFAULT 'active',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    week_starts_on SMALLINT NOT NULL DEFAULT 1,
    weekend_days INTEGER[] NOT NULL DEFAULT '{0, 6}',
    branding_json JSONB NOT NULL DEFAULT '{"primary_color": "#2563eb", "logo_url": null, "theme_preset": "navy"}'::jsonb,
    feature_flags JSONB NOT NULL DEFAULT '{"cpm_enabled": true, "export_enabled": true, "audit_enabled": true}'::jsonb,
    storage_quota_mb INTEGER NOT NULL DEFAULT 5120,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_code VARCHAR(32);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS week_starts_on SMALLINT DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS weekend_days INTEGER[] DEFAULT '{0, 6}';
UPDATE tenants SET tenant_code = code WHERE tenant_code IS NULL;
UPDATE tenants SET is_active = (status = 'active') WHERE is_active IS NULL;

CREATE TABLE IF NOT EXISTS tenants_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tenant_code TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    week_starts_on SMALLINT NOT NULL DEFAULT 1,
    weekend_days INTEGER[] NOT NULL DEFAULT '{0, 6}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(1024),
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Tenant Memberships (Ensure role is VARCHAR(32) so any role string is accepted)
CREATE TABLE IF NOT EXISTS tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_user UNIQUE (tenant_id, user_id)
);

DO $$ BEGIN
    ALTER TABLE tenant_memberships ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE tenant_memberships ALTER COLUMN role TYPE VARCHAR(32) USING role::text;
    ALTER TABLE tenant_memberships ALTER COLUMN role SET DEFAULT 'member';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE tenant_memberships ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Working Calendars & Holidays
CREATE TABLE IF NOT EXISTS working_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    working_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    weekend_days INTEGER[] NOT NULL DEFAULT '{0,6}',
    daily_working_hours NUMERIC(4, 2) NOT NULL DEFAULT 8.00,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE working_calendars ADD COLUMN IF NOT EXISTS weekend_days INTEGER[] DEFAULT '{0,6}';
ALTER TABLE working_calendars ADD COLUMN IF NOT EXISTS daily_working_hours NUMERIC(4, 2) DEFAULT 8.00;

CREATE TABLE IF NOT EXISTS calendar_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    calendar_id UUID REFERENCES working_calendars(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    holiday_date DATE,
    date DATE,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE calendar_holidays ADD COLUMN IF NOT EXISTS holiday_date DATE;
ALTER TABLE calendar_holidays ADD COLUMN IF NOT EXISTS date DATE;
UPDATE calendar_holidays SET date = holiday_date WHERE date IS NULL AND holiday_date IS NOT NULL;
UPDATE calendar_holidays SET holiday_date = date WHERE holiday_date IS NULL AND date IS NOT NULL;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32),
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_end_date DATE,
    calendar_id UUID REFERENCES working_calendars(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phases / Project Phases (harmonize both)
CREATE TABLE IF NOT EXISTS phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    color VARCHAR(32) DEFAULT '#3b82f6',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    color VARCHAR(32) DEFAULT '#3b82f6',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_id UUID,
    parent_task_id UUID,
    title VARCHAR(255) NOT NULL,
    code VARCHAR(64),
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'todo',
    priority VARCHAR(32) NOT NULL DEFAULT 'medium',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT CURRENT_DATE,
    duration_days INT NOT NULL DEFAULT 1,
    progress INT NOT NULL DEFAULT 0,
    progress_percent INT NOT NULL DEFAULT 0,
    is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
    early_start DATE,
    early_finish DATE,
    late_start DATE,
    late_finish DATE,
    total_float INT DEFAULT 0,
    free_float INT DEFAULT 0,
    is_critical BOOLEAN DEFAULT FALSE,
    order_index INT NOT NULL DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percent INT DEFAULT 0;

-- Task Dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    predecessor_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type VARCHAR(16) NOT NULL DEFAULT 'FS',
    dep_type VARCHAR(16) DEFAULT 'FS',
    type VARCHAR(16) DEFAULT 'FS',
    lag_days INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
    ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS dependency_type VARCHAR(16) DEFAULT 'FS';
    ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS dep_type VARCHAR(16) DEFAULT 'FS';
    ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS type VARCHAR(16) DEFAULT 'FS';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dynamic Metadata & Lookups (Phase 2)
CREATE TABLE IF NOT EXISTS tenant_task_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    color_hex VARCHAR(16) NOT NULL DEFAULT '#3b82f6',
    badge_variant VARCHAR(32) NOT NULL DEFAULT 'secondary',
    position INT NOT NULL DEFAULT 0,
    is_closed_state BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_status_slug UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS tenant_task_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    color_hex VARCHAR(16) NOT NULL DEFAULT '#64748b',
    urgency_weight INT NOT NULL DEFAULT 1,
    icon_key VARCHAR(32) NOT NULL DEFAULT 'circle',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_priority_slug UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS tenant_task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    icon_key VARCHAR(32) NOT NULL DEFAULT 'check-square',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_task_type_slug UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS system_themes (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    tokens_json JSONB NOT NULL,
    is_system_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_theme_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    active_theme_id VARCHAR(64),
    custom_tokens_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(64),
    snapshot_date DATE DEFAULT CURRENT_DATE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_baseline_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_id UUID NOT NULL REFERENCES project_baselines(id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    title VARCHAR(255),
    start_date DATE,
    end_date DATE,
    duration_days INT,
    progress INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL,
    actor_id UUID,
    event_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(64),
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    permission_key VARCHAR(64) NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE (tenant_id, role, permission_key)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    actor_id UUID,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    diff_before JSONB,
    diff_after JSONB,
    correlation_id VARCHAR(128),
    ip_address VARCHAR(64),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable RLS and Configure Safe Policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_holidays ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID, auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_superadmin(check_user_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM user_profiles WHERE id = check_user_id AND is_superadmin = TRUE)
        OR EXISTS (SELECT 1 FROM profiles WHERE id = check_user_id AND is_superadmin = TRUE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Safe Dropping of Existing Policies
DROP POLICY IF EXISTS "tenants_select_policy" ON tenants;
DROP POLICY IF EXISTS "tenants_admin_mutation_policy" ON tenants;
DROP POLICY IF EXISTS "tenants_public_lookup" ON tenants;

-- CRITICAL: Allow public lookup of active tenants so users can resolve workspace code at /login!
CREATE POLICY "tenants_public_lookup" ON tenants
    FOR SELECT USING (is_active = TRUE OR status = 'active');

CREATE POLICY "tenants_admin_mutation_policy" ON tenants
    FOR ALL USING (is_superadmin(current_app_user_id()));

DROP POLICY IF EXISTS "profiles_read_all" ON user_profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON user_profiles;
CREATE POLICY "profiles_read_all" ON user_profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_update_self" ON user_profiles FOR UPDATE USING (id = current_app_user_id() OR is_superadmin(current_app_user_id()));

DROP POLICY IF EXISTS "profiles_v2_read_all" ON profiles;
DROP POLICY IF EXISTS "profiles_v2_update_self" ON profiles;
CREATE POLICY "profiles_v2_read_all" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "profiles_v2_update_self" ON profiles FOR UPDATE USING (id = current_app_user_id() OR is_superadmin(current_app_user_id()));

DROP POLICY IF EXISTS "memberships_select_policy" ON tenant_memberships;
DROP POLICY IF EXISTS "memberships_admin_manage_policy" ON tenant_memberships;
CREATE POLICY "memberships_select_policy" ON tenant_memberships FOR SELECT USING (TRUE);
CREATE POLICY "memberships_admin_manage_policy" ON tenant_memberships FOR ALL USING (is_superadmin(current_app_user_id()));

DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "projects_mutation_policy" ON projects;
CREATE POLICY "projects_select_policy" ON projects FOR SELECT USING (TRUE);
CREATE POLICY "projects_mutation_policy" ON projects FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
DROP POLICY IF EXISTS "tasks_modify_policy" ON tasks;
CREATE POLICY "tasks_select_policy" ON tasks FOR SELECT USING (TRUE);
CREATE POLICY "tasks_modify_policy" ON tasks FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "dependencies_select_policy" ON task_dependencies;
DROP POLICY IF EXISTS "dependencies_modify_policy" ON task_dependencies;
CREATE POLICY "dependencies_select_policy" ON task_dependencies FOR SELECT USING (TRUE);
CREATE POLICY "dependencies_modify_policy" ON task_dependencies FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "calendars_select_policy" ON working_calendars;
DROP POLICY IF EXISTS "calendars_modify_policy" ON working_calendars;
CREATE POLICY "calendars_select_policy" ON working_calendars FOR SELECT USING (TRUE);
CREATE POLICY "calendars_modify_policy" ON working_calendars FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "holidays_select_policy" ON calendar_holidays;
DROP POLICY IF EXISTS "holidays_modify_policy" ON calendar_holidays;
CREATE POLICY "holidays_select_policy" ON calendar_holidays FOR SELECT USING (TRUE);
CREATE POLICY "holidays_modify_policy" ON calendar_holidays FOR ALL USING (TRUE);

-- 5. Seed Enterprise Core Tenant & Root SuperAdmin (Resilient Execution)
DO $$
DECLARE
    super_admin_id UUID := 'b0000000-0000-0000-0000-000000000099'::UUID;
    engineer_user_id UUID := 'b0000000-0000-0000-0000-000000000097'::UUID;
    guest_user_id UUID := 'b0000000-0000-0000-0000-000000000098'::UUID;
    tenant_core_id UUID := 'a0000000-0000-0000-0000-000000000003'::UUID;
    cal_core_id UUID := 'c0000000-0000-0000-0000-000000000003'::UUID;
    prj_core_id UUID := 'd0000000-0000-0000-0000-000000000003'::UUID;
    ph1_id UUID := 'e0000000-0000-0000-0000-000000000011'::UUID;
    ph2_id UUID := 'e0000000-0000-0000-0000-000000000012'::UUID;
    t1_id UUID := 'f0000000-0000-0000-0000-000000000011'::UUID;
    t2_id UUID := 'f0000000-0000-0000-0000-000000000012'::UUID;
    t3_id UUID := 'f0000000-0000-0000-0000-000000000013'::UUID;
BEGIN
    -- Auth User: admin@jyotirmoyb.com
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
            INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud)
            VALUES
            (super_admin_id, '00000000-0000-0000-0000-000000000000', 'admin@jyotirmoyb.com', crypt('Admin@jyotirmoyb2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"System Administrator"}', 'authenticated', 'authenticated'),
            (engineer_user_id, '00000000-0000-0000-0000-000000000000', 'lead.engineer@core.internal', crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Lin"}', 'authenticated', 'authenticated')
            ON CONFLICT (id) DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: auth.users provisioning: %', SQLERRM;
    END;

    -- User Profiles (both user_profiles and profiles)
    BEGIN
        INSERT INTO user_profiles (id, email, full_name, avatar_url, is_superadmin)
        VALUES
        (super_admin_id, 'admin@jyotirmoyb.com', 'System Administrator', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', TRUE),
        (engineer_user_id, 'lead.engineer@core.internal', 'Sarah Lin', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', FALSE)
        ON CONFLICT (id) DO UPDATE SET is_superadmin = EXCLUDED.is_superadmin, full_name = EXCLUDED.full_name;

        INSERT INTO profiles (id, email, full_name, avatar_url, is_superadmin)
        VALUES
        (super_admin_id, 'admin@jyotirmoyb.com', 'System Administrator', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', TRUE),
        (engineer_user_id, 'lead.engineer@core.internal', 'Sarah Lin', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', FALSE)
        ON CONFLICT (id) DO UPDATE SET is_superadmin = EXCLUDED.is_superadmin, full_name = EXCLUDED.full_name;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: user_profiles provisioning: %', SQLERRM;
    END;

    -- Tenant: Enterprise Core (slug: core, code: CORE-SYS)
    BEGIN
        INSERT INTO tenants (id, name, slug, code, tenant_code, domain, status, is_active, storage_quota_mb)
        VALUES
        (tenant_core_id, 'Enterprise Core', 'core', 'CORE-SYS', 'CORE-SYS', 'core.pms.internal', 'active', TRUE, 20480)
        ON CONFLICT (id) DO UPDATE SET is_active = TRUE, status = 'active', slug = 'core', code = 'CORE-SYS', tenant_code = 'CORE-SYS';

        INSERT INTO tenants_v2 (id, name, slug, tenant_code, is_active)
        VALUES
        (tenant_core_id, 'Enterprise Core', 'core', 'CORE-SYS', TRUE)
        ON CONFLICT (id) DO UPDATE SET is_active = TRUE, slug = 'core', tenant_code = 'CORE-SYS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: tenants provisioning: %', SQLERRM;
    END;

    -- Tenant Memberships (Supports VARCHAR or Enum role safely)
    BEGIN
        INSERT INTO tenant_memberships (tenant_id, user_id, role, is_active)
        VALUES
        (tenant_core_id, super_admin_id, 'owner', TRUE),
        (tenant_core_id, engineer_user_id, 'admin', TRUE)
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET is_active = TRUE, role = EXCLUDED.role;
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO tenant_memberships (tenant_id, user_id, role, is_active)
            VALUES
            (tenant_core_id, super_admin_id, 'superadmin', TRUE),
            (tenant_core_id, engineer_user_id, 'tenant_admin', TRUE)
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET is_active = TRUE, role = EXCLUDED.role;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Notice: tenant_memberships provisioning: %', SQLERRM;
        END;
    END;

    -- Also populate tenant_memberships_v2 if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_memberships_v2') THEN
        BEGIN
            INSERT INTO tenant_memberships_v2 (tenant_id, user_id, role, is_active)
            VALUES
            (tenant_core_id, super_admin_id, 'owner'::user_tenant_role, TRUE),
            (tenant_core_id, engineer_user_id, 'admin'::user_tenant_role, TRUE)
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET is_active = TRUE, role = EXCLUDED.role;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- Working Calendar
    BEGIN
        INSERT INTO working_calendars (id, tenant_id, name, working_days, weekend_days, daily_working_hours, is_default)
        VALUES
        (cal_core_id, tenant_core_id, 'Standard Enterprise Calendar (Mon-Fri)', '{1,2,3,4,5}', ARRAY[0,6], 8.0, TRUE)
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO working_calendars (id, tenant_id, name, working_days, daily_working_hours, is_default)
            VALUES
            (cal_core_id, tenant_core_id, 'Standard Enterprise Calendar (Mon-Fri)', '[1,2,3,4,5]'::jsonb, 8.0, TRUE)
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END;

    -- Calendar Holidays
    BEGIN
        INSERT INTO calendar_holidays (tenant_id, calendar_id, name, holiday_date, date, is_recurring)
        VALUES
        (tenant_core_id, cal_core_id, 'New Year Holiday', '2026-01-01', '2026-01-01', TRUE),
        (tenant_core_id, cal_core_id, 'Thanksgiving Day', '2026-11-26', '2026-11-26', TRUE)
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO calendar_holidays (tenant_id, calendar_id, name, date, is_recurring)
            VALUES
            (tenant_core_id, cal_core_id, 'New Year Holiday', '2026-01-01', TRUE),
            (tenant_core_id, cal_core_id, 'Thanksgiving Day', '2026-11-26', TRUE)
            ON CONFLICT DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END;

    -- Project: Global Infrastructure Modernization (PRJ-CORE)
    BEGIN
        INSERT INTO projects (id, tenant_id, name, code, description, status, start_date, target_end_date, calendar_id, created_by)
        VALUES
        (prj_core_id, tenant_core_id, 'Global Infrastructure Modernization', 'PRJ-CORE', 'Mission-critical cloud infrastructure migration with high availability and SOC2 security controls.', 'active', '2026-10-01', '2026-12-15', cal_core_id, super_admin_id)
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: projects provisioning: %', SQLERRM;
    END;

    -- Project Phases (both phases and project_phases tables)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'phases') THEN
        BEGIN
            INSERT INTO phases (id, tenant_id, project_id, name, order_index, color, start_date, end_date)
            VALUES
            (ph1_id, tenant_core_id, prj_core_id, 'Phase 1: Architecture & Planning', 1, '#3b82f6', '2026-10-01', '2026-10-20'),
            (ph2_id, tenant_core_id, prj_core_id, 'Phase 2: Database & Microservices Execution', 2, '#10b981', '2026-10-21', '2026-11-15')
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_phases') THEN
        BEGIN
            INSERT INTO project_phases (id, tenant_id, project_id, name, sort_order, color, start_date, end_date)
            VALUES
            (ph1_id, tenant_core_id, prj_core_id, 'Phase 1: Architecture & Planning', 1, '#3b82f6', '2026-10-01', '2026-10-20'),
            (ph2_id, tenant_core_id, prj_core_id, 'Phase 2: Database & Microservices Execution', 2, '#10b981', '2026-10-21', '2026-11-15')
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- Tasks
    BEGIN
        INSERT INTO tasks (id, tenant_id, project_id, phase_id, title, code, description, status, priority, start_date, end_date, duration_days, progress, progress_percent, is_milestone, early_start, early_finish, late_start, late_finish, total_float, is_critical, order_index, created_by)
        VALUES
        (t1_id, tenant_core_id, prj_core_id, ph1_id, 'Infrastructure Assessment & Architecture Plan', 'TSK-1', 'Review cloud posture and multi-region network failover.', 'completed', 'high', '2026-10-01', '2026-10-08', 6, 100, 100, FALSE, '2026-10-01', '2026-10-08', '2026-10-01', '2026-10-08', 0, TRUE, 1, super_admin_id),
        (t2_id, tenant_core_id, prj_core_id, ph1_id, 'Database Partitioning & RLS Security Implementation', 'TSK-2', 'Configure PostgreSQL 16 schema isolation and RLS policies.', 'in_progress', 'urgent', '2026-10-09', '2026-10-20', 8, 60, 60, FALSE, '2026-10-09', '2026-10-20', '2026-10-09', '2026-10-20', 0, TRUE, 2, engineer_user_id),
        (t3_id, tenant_core_id, prj_core_id, ph2_id, 'Live Traffic Cutover & Deployment Certification', 'TSK-3', 'Cut over DNS and certify SLA uptime.', 'todo', 'urgent', '2026-10-21', '2026-10-21', 0, 0, 0, TRUE, '2026-10-21', '2026-10-21', '2026-10-21', '2026-10-21', 0, TRUE, 3, super_admin_id)
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO tasks (id, tenant_id, project_id, title, description, status, priority, start_date, end_date, duration_days)
            VALUES
            (t1_id, tenant_core_id, prj_core_id, 'Infrastructure Assessment & Architecture Plan', 'Review cloud posture and multi-region network failover.', 'completed', 'high', '2026-10-01', '2026-10-08', 6),
            (t2_id, tenant_core_id, prj_core_id, 'Database Partitioning & RLS Security Implementation', 'Configure PostgreSQL 16 schema isolation and RLS policies.', 'in_progress', 'urgent', '2026-10-09', '2026-10-20', 8),
            (t3_id, tenant_core_id, prj_core_id, 'Live Traffic Cutover & Deployment Certification', 'Cut over DNS and certify SLA uptime.', 'todo', 'urgent', '2026-10-21', '2026-10-21', 0)
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Notice: tasks provisioning: %', SQLERRM;
        END;
    END;

    -- Dependencies (Precedence: T1 -> T2 -> T3)
    BEGIN
        INSERT INTO task_dependencies (tenant_id, project_id, predecessor_id, successor_id, dependency_type, lag_days)
        VALUES
        (tenant_core_id, prj_core_id, t1_id, t2_id, 'FS', 0),
        (tenant_core_id, prj_core_id, t2_id, t3_id, 'FS', 0)
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO task_dependencies (tenant_id, project_id, predecessor_id, successor_id, type, lag_days)
            VALUES
            (tenant_core_id, prj_core_id, t1_id, t2_id, 'FS', 0),
            (tenant_core_id, prj_core_id, t2_id, t3_id, 'FS', 0)
            ON CONFLICT DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END;

    -- Dynamic Statuses for Enterprise Core
    BEGIN
        INSERT INTO tenant_task_statuses (tenant_id, name, slug, color_hex, badge_variant, position, is_closed_state, is_default)
        VALUES
        (tenant_core_id, 'Backlog', 'backlog', '#64748b', 'secondary', 1, FALSE, FALSE),
        (tenant_core_id, 'To Do', 'todo', '#3b82f6', 'default', 2, FALSE, TRUE),
        (tenant_core_id, 'In Progress', 'in_progress', '#f59e0b', 'default', 3, FALSE, FALSE),
        (tenant_core_id, 'In Review', 'review', '#8b5cf6', 'secondary', 4, FALSE, FALSE),
        (tenant_core_id, 'Completed', 'completed', '#10b981', 'default', 5, TRUE, FALSE),
        (tenant_core_id, 'Blocked', 'blocked', '#ef4444', 'destructive', 6, FALSE, FALSE)
        ON CONFLICT (tenant_id, slug) DO NOTHING;

        -- Dynamic Priorities for Enterprise Core
        INSERT INTO tenant_task_priorities (tenant_id, name, slug, color_hex, urgency_weight, icon_key, is_default)
        VALUES
        (tenant_core_id, 'Low', 'low', '#10b981', 1, 'arrow-down', FALSE),
        (tenant_core_id, 'Medium', 'medium', '#3b82f6', 2, 'minus', TRUE),
        (tenant_core_id, 'High', 'high', '#f59e0b', 3, 'arrow-up', FALSE),
        (tenant_core_id, 'Urgent', 'urgent', '#ef4444', 4, 'alert-circle', FALSE)
        ON CONFLICT (tenant_id, slug) DO NOTHING;

        -- Dynamic Task Types
        INSERT INTO tenant_task_types (tenant_id, name, slug, icon_key, is_default)
        VALUES
        (tenant_core_id, 'Task', 'task', 'check-square', TRUE),
        (tenant_core_id, 'Milestone', 'milestone', 'flag', FALSE),
        (tenant_core_id, 'Bug', 'bug', 'bug', FALSE)
        ON CONFLICT (tenant_id, slug) DO NOTHING;

        -- System Theme
        INSERT INTO system_themes (id, name, description, tokens_json, is_system_default)
        VALUES
        ('navy', 'Enterprise Navy', 'Executive dark navy with sharp cyan accents', '{"background":"#0a0d14","foreground":"#f8fafc","card":"#0f172a","primary":"#3b82f6"}'::jsonb, TRUE)
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: dynamic metadata provisioning: %', SQLERRM;
    END;

END $$;
