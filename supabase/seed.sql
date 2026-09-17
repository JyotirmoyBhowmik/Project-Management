-- ==============================================================================
-- Enterprise Core & SuperAdmin Master Seed & Harmonization Block
-- 100% Idempotent, Handles Legacy Schema Variations & Missing Columns Safely
-- ==============================================================================

-- Pre-migration: Harmonize Table Columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_code VARCHAR(32);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS week_starts_on SMALLINT DEFAULT 1;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS weekend_days INTEGER[] DEFAULT '{0, 6}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS storage_quota_mb INTEGER DEFAULT 5120;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}'::jsonb;
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

-- Ensure tenant_memberships.role is VARCHAR(32) so any role string is accepted
DO $$ BEGIN
    ALTER TABLE tenant_memberships ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE tenant_memberships ALTER COLUMN role TYPE VARCHAR(32) USING role::text;
    ALTER TABLE tenant_memberships ALTER COLUMN role SET DEFAULT 'member';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE tenant_memberships ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Ensure teams and team_members have expected columns
CREATE TABLE IF NOT EXISTS tenant_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT 'member';
    ALTER TABLE team_members ADD COLUMN IF NOT EXISTS tenant_id UUID;
    ALTER TABLE team_members ALTER COLUMN tenant_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Working Calendars & Holidays
ALTER TABLE working_calendars ADD COLUMN IF NOT EXISTS weekend_days INTEGER[] DEFAULT '{0, 6}';
ALTER TABLE working_calendars ADD COLUMN IF NOT EXISTS week_start_day SMALLINT DEFAULT 1;
ALTER TABLE working_calendars ADD COLUMN IF NOT EXISTS default_hours_per_day NUMERIC(4, 2) DEFAULT 8.00;
ALTER TABLE working_calendars ADD COLUMN IF NOT EXISTS daily_working_hours NUMERIC(4, 2) DEFAULT 8.00;

ALTER TABLE calendar_holidays ADD COLUMN IF NOT EXISTS holiday_date DATE;
ALTER TABLE calendar_holidays ADD COLUMN IF NOT EXISTS date DATE;
UPDATE calendar_holidays SET date = holiday_date WHERE date IS NULL AND holiday_date IS NOT NULL;
UPDATE calendar_holidays SET holiday_date = date WHERE holiday_date IS NULL AND date IS NOT NULL;

-- Tasks & Dependencies
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percent INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS phase_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID;

DO $$ BEGIN
    ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS dependency_type VARCHAR(16) DEFAULT 'FS';
    ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS dep_type VARCHAR(16) DEFAULT 'FS';
    ALTER TABLE task_dependencies ADD COLUMN IF NOT EXISTS type VARCHAR(16) DEFAULT 'FS';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Fix GoTrue NULL Scan Errors for all auth.users
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        UPDATE auth.users
        SET 
            confirmation_token = COALESCE(confirmation_token, ''),
            recovery_token = COALESCE(recovery_token, ''),
            email_change = COALESCE(email_change, ''),
            email_change_token_new = COALESCE(email_change_token_new, '');
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        UPDATE auth.users
        SET 
            email_change_token_current = COALESCE(email_change_token_current, ''),
            phone_change = COALESCE(phone_change, ''),
            phone_change_token = COALESCE(phone_change_token, ''),
            reauthentication_token = COALESCE(reauthentication_token, '');
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Execution Block
DO $$
DECLARE
    super_admin_id UUID := 'b0000000-0000-0000-0000-000000000099'::UUID;
    engineer_user_id UUID := 'b0000000-0000-0000-0000-000000000097'::UUID;
    guest_user_id UUID := 'b0000000-0000-0000-0000-000000000098'::UUID;
    devops_user_id UUID := 'b0000000-0000-0000-0000-000000000096'::UUID;

    tenant_core_id UUID := 'a0000000-0000-0000-0000-000000000003'::UUID;
    cal_core_id UUID := 'c0000000-0000-0000-0000-000000000003'::UUID;
    team_platform_id UUID := 'a0000000-0000-0000-0000-000000000011'::UUID;
    team_ops_id UUID := 'a0000000-0000-0000-0000-000000000012'::UUID;

    prj_core_id UUID := 'd0000000-0000-0000-0000-000000000003'::UUID;
    ph1_id UUID := 'e0000000-0000-0000-0000-000000000011'::UUID;
    ph2_id UUID := 'e0000000-0000-0000-0000-000000000012'::UUID;

    t1_id UUID := 'f0000000-0000-0000-0000-000000000011'::UUID;
    t2_id UUID := 'f0000000-0000-0000-0000-000000000012'::UUID;
    t3_id UUID := 'f0000000-0000-0000-0000-000000000013'::UUID;
BEGIN
    -- 1. Auth Users (Explicit empty string tokens to avoid GoTrue NULL scan errors)
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
            INSERT INTO auth.users (
                id, instance_id, email, encrypted_password, email_confirmed_at,
                raw_app_meta_data, raw_user_meta_data, role, aud,
                confirmation_token, recovery_token, email_change, email_change_token_new
            )
            VALUES
            (
                super_admin_id, '00000000-0000-0000-0000-000000000000', 'admin@jyotirmoyb.com',
                crypt('Admin@jyotirmoyb2026!', gen_salt('bf')), NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                '{"full_name":"System Administrator"}'::jsonb,
                'authenticated', 'authenticated',
                '', '', '', ''
            ),
            (
                guest_user_id, '00000000-0000-0000-0000-000000000000', 'guest@external-partner.com',
                crypt('GuestPass2026!', gen_salt('bf')), NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                '{"full_name":"Guest Auditor (Partner Org)"}'::jsonb,
                'authenticated', 'authenticated',
                '', '', '', ''
            ),
            (
                engineer_user_id, '00000000-0000-0000-0000-000000000000', 'lead.engineer@core.internal',
                crypt('Password123!', gen_salt('bf')), NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                '{"full_name":"Sarah Lin"}'::jsonb,
                'authenticated', 'authenticated',
                '', '', '', ''
            ),
            (
                devops_user_id, '00000000-0000-0000-0000-000000000000', 'devops@core.internal',
                crypt('Password123!', gen_salt('bf')), NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                '{"full_name":"Kenji Sato"}'::jsonb,
                'authenticated', 'authenticated',
                '', '', '', ''
            )
            ON CONFLICT (id) DO UPDATE SET
                encrypted_password = EXCLUDED.encrypted_password,
                email_confirmed_at = COALESCE(auth.users.email_confirmed_at, NOW()),
                raw_app_meta_data = EXCLUDED.raw_app_meta_data,
                raw_user_meta_data = EXCLUDED.raw_user_meta_data,
                confirmation_token = '',
                recovery_token = '',
                email_change = '',
                email_change_token_new = '';

            UPDATE auth.users
            SET confirmation_token = COALESCE(confirmation_token, ''),
                recovery_token = COALESCE(recovery_token, ''),
                email_change = COALESCE(email_change, ''),
                email_change_token_new = COALESCE(email_change_token_new, '')
            WHERE id IN (super_admin_id, guest_user_id, engineer_user_id, devops_user_id);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: auth.users provisioning: %', SQLERRM;
    END;

    -- 1b. Auth Identities (Required by GoTrue email provider to allow sign-in)
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'identities') THEN
            INSERT INTO auth.identities (
                id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
            )
            VALUES
            (
                super_admin_id, super_admin_id, super_admin_id::text,
                jsonb_build_object('sub', super_admin_id::text, 'email', 'admin@jyotirmoyb.com'),
                'email', NOW(), NOW(), NOW()
            ),
            (
                engineer_user_id, engineer_user_id, engineer_user_id::text,
                jsonb_build_object('sub', engineer_user_id::text, 'email', 'lead.engineer@core.internal'),
                'email', NOW(), NOW(), NOW()
            )
            ON CONFLICT DO NOTHING;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: auth.identities provisioning: %', SQLERRM;
    END;

    -- 2. User Profiles
    BEGIN
        INSERT INTO user_profiles (id, email, full_name, avatar_url, is_superadmin)
        VALUES
        (super_admin_id, 'admin@jyotirmoyb.com', 'System Administrator', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', TRUE),
        (guest_user_id, 'guest@external-partner.com', 'Guest Auditor (Partner Org)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', FALSE),
        (engineer_user_id, 'lead.engineer@core.internal', 'Sarah Lin', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', FALSE),
        (devops_user_id, 'devops@core.internal', 'Kenji Sato', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', FALSE)
        ON CONFLICT (id) DO UPDATE SET is_superadmin = EXCLUDED.is_superadmin, full_name = EXCLUDED.full_name;

        INSERT INTO profiles (id, email, full_name, avatar_url, is_superadmin)
        VALUES
        (super_admin_id, 'admin@jyotirmoyb.com', 'System Administrator', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', TRUE),
        (guest_user_id, 'guest@external-partner.com', 'Guest Auditor (Partner Org)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', FALSE),
        (engineer_user_id, 'lead.engineer@core.internal', 'Sarah Lin', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', FALSE),
        (devops_user_id, 'devops@core.internal', 'Kenji Sato', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', FALSE)
        ON CONFLICT (id) DO UPDATE SET is_superadmin = EXCLUDED.is_superadmin, full_name = EXCLUDED.full_name;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: user_profiles provisioning: %', SQLERRM;
    END;

    -- 3. Tenant: Enterprise Core (slug: core, code: CORE-SYS)
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

    -- 4. Tenant Memberships
    BEGIN
        INSERT INTO tenant_memberships (tenant_id, user_id, role, is_active)
        VALUES
        (tenant_core_id, super_admin_id, 'owner', TRUE),
        (tenant_core_id, engineer_user_id, 'admin', TRUE),
        (tenant_core_id, devops_user_id, 'member', TRUE),
        (tenant_core_id, guest_user_id, 'guest', TRUE)
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET is_active = TRUE, role = EXCLUDED.role;
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            INSERT INTO tenant_memberships (tenant_id, user_id, role, is_active)
            VALUES
            (tenant_core_id, super_admin_id, 'superadmin', TRUE),
            (tenant_core_id, engineer_user_id, 'tenant_admin', TRUE),
            (tenant_core_id, devops_user_id, 'contributor', TRUE),
            (tenant_core_id, guest_user_id, 'guest', TRUE)
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET is_active = TRUE, role = EXCLUDED.role;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Notice: tenant_memberships provisioning: %', SQLERRM;
        END;
    END;

    -- Sync tenant_memberships_v2 if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_memberships_v2') THEN
        BEGIN
            INSERT INTO tenant_memberships_v2 (tenant_id, user_id, role, is_active)
            VALUES
            (tenant_core_id, super_admin_id, 'owner'::user_tenant_role, TRUE),
            (tenant_core_id, engineer_user_id, 'admin'::user_tenant_role, TRUE),
            (tenant_core_id, devops_user_id, 'member'::user_tenant_role, TRUE),
            (tenant_core_id, guest_user_id, 'guest'::user_tenant_role, TRUE)
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET is_active = TRUE, role = EXCLUDED.role;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- 5. Teams & Team Members
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_teams') THEN
        BEGIN
            INSERT INTO tenant_teams (id, tenant_id, name, description)
            VALUES
            (team_platform_id, tenant_core_id, 'Core Platform', 'Platform Architecture and High-Availability Infrastructure.'),
            (team_ops_id, tenant_core_id, 'Operations', 'DevOps, Site Reliability Engineering, and CI/CD.')
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        BEGIN
            INSERT INTO teams (id, tenant_id, name, description)
            VALUES
            (team_platform_id, tenant_core_id, 'Core Platform', 'Platform Architecture and High-Availability Infrastructure.'),
            (team_ops_id, tenant_core_id, 'Operations', 'DevOps, Site Reliability Engineering, and CI/CD.')
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        BEGIN
            INSERT INTO team_members (tenant_id, team_id, user_id, role)
            VALUES
            (tenant_core_id, team_platform_id, super_admin_id, 'lead'),
            (tenant_core_id, team_platform_id, engineer_user_id, 'member'),
            (tenant_core_id, team_ops_id, devops_user_id, 'lead')
            ON CONFLICT (team_id, user_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                INSERT INTO team_members (team_id, user_id, role)
                VALUES
                (team_platform_id, super_admin_id, 'lead'),
                (team_platform_id, engineer_user_id, 'member'),
                (team_ops_id, devops_user_id, 'lead')
                ON CONFLICT (team_id, user_id) DO NOTHING;
            EXCEPTION WHEN OTHERS THEN
                BEGIN
                    INSERT INTO team_members (tenant_id, team_id, user_id)
                    VALUES
                    (tenant_core_id, team_platform_id, super_admin_id),
                    (tenant_core_id, team_platform_id, engineer_user_id),
                    (tenant_core_id, team_ops_id, devops_user_id)
                    ON CONFLICT (team_id, user_id) DO NOTHING;
                EXCEPTION WHEN OTHERS THEN NULL;
                END;
            END;
        END;
    END IF;

    -- 6. Working Calendar & Holidays
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

    -- 7. Projects
    BEGIN
        INSERT INTO projects (id, tenant_id, name, code, description, status, start_date, target_end_date, calendar_id, created_by)
        VALUES
        (prj_core_id, tenant_core_id, 'Global Infrastructure Modernization', 'PRJ-CORE', 'Mission-critical cloud infrastructure migration with high availability and SOC2 security controls.', 'active', '2026-10-01', '2026-12-15', cal_core_id, super_admin_id)
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Notice: projects provisioning: %', SQLERRM;
    END;

    -- 8. Project Phases
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

    -- 9. Tasks
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

    -- 10. Dependencies
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

    -- 11. Dynamic Metadata (Statuses, Priorities, Types, Themes)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_task_statuses') THEN
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
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_task_priorities') THEN
        BEGIN
            INSERT INTO tenant_task_priorities (tenant_id, name, slug, color_hex, urgency_weight, icon_key, is_default)
            VALUES
            (tenant_core_id, 'Low', 'low', '#10b981', 1, 'arrow-down', FALSE),
            (tenant_core_id, 'Medium', 'medium', '#3b82f6', 2, 'minus', TRUE),
            (tenant_core_id, 'High', 'high', '#f59e0b', 3, 'arrow-up', FALSE),
            (tenant_core_id, 'Urgent', 'urgent', '#ef4444', 4, 'alert-circle', FALSE)
            ON CONFLICT (tenant_id, slug) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_task_types') THEN
        BEGIN
            INSERT INTO tenant_task_types (tenant_id, name, slug, icon_key, is_default)
            VALUES
            (tenant_core_id, 'Task', 'task', 'check-square', TRUE),
            (tenant_core_id, 'Milestone', 'milestone', 'flag', FALSE),
            (tenant_core_id, 'Bug', 'bug', 'bug', FALSE)
            ON CONFLICT (tenant_id, slug) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_themes') THEN
        BEGIN
            INSERT INTO system_themes (id, name, description, tokens_json, is_system_default)
            VALUES
            ('navy', 'Enterprise Navy', 'Executive dark navy with sharp cyan accents', '{"background":"#0a0d14","foreground":"#f8fafc","card":"#0f172a","primary":"#3b82f6"}'::jsonb, TRUE)
            ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

END $$;
