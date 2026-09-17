-- ==============================================================================
-- MASTER SUPABASE SCHEMA & ROOT SUPERADMIN PROVISIONING SCRIPT
-- Project Management System (PMS)
-- Execute this complete script in Supabase Dashboard -> SQL Editor -> New Query
-- ==============================================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 00001_initial_schema.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- 00001_initial_schema.sql
-- Multi-Tenant Project Management System (PMS)
-- Base extensions, enumerations, tenant boundaries, user profiles, and teams.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Domain Enumerations
DO $$ BEGIN
    CREATE TYPE tenant_role_enum AS ENUM (
        'superadmin',
        'tenant_admin',
        'project_manager',
        'contributor',
        'guest'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status_enum AS ENUM (
        'active',
        'suspended',
        'trial'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_status_enum AS ENUM (
        'backlog',
        'todo',
        'in_progress',
        'review',
        'completed',
        'blocked'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_priority_enum AS ENUM (
        'low',
        'medium',
        'high',
        'urgent'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE dependency_type_enum AS ENUM (
        'FS', -- Finish-to-Start
        'SS', -- Start-to-Start
        'FF', -- Finish-to-Finish
        'SF'  -- Start-to-Finish
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- Table: tenants
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(63) NOT NULL UNIQUE,
    code VARCHAR(32) NOT NULL UNIQUE,
    domain VARCHAR(255),
    status tenant_status_enum NOT NULL DEFAULT 'active',
    branding_json JSONB NOT NULL DEFAULT '{"primary_color": "#2563eb", "logo_url": null, "theme_preset": "navy"}'::jsonb,
    feature_flags JSONB NOT NULL DEFAULT '{"cpm_enabled": true, "export_enabled": true, "audit_enabled": true}'::jsonb,
    storage_quota_mb INTEGER NOT NULL DEFAULT 5120,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);

-- ------------------------------------------------------------------------------
-- Table: user_profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    encrypted_settings BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- ------------------------------------------------------------------------------
-- Table: tenant_memberships
-- Cross-tenant association: one user can belong to multiple tenants with distinct roles.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role tenant_role_enum NOT NULL DEFAULT 'contributor',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    invited_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_user UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_role ON tenant_memberships(role);

-- ------------------------------------------------------------------------------
-- Table: teams (groups of users within a tenant)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    color VARCHAR(32) DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_team_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 00002_projects_and_hierarchy.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- 00002_projects_and_hierarchy.sql
-- Work Breakdown Structure (WBS): Projects, Phases, Tasks (4-level nesting),
-- Multi-user effort allocations, and CPM Dependencies (FS/SS/FF/SF with lag).
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE project_status_enum AS ENUM (
        'planning',
        'active',
        'on_hold',
        'completed',
        'archived'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- Table: projects
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32) NOT NULL,
    description TEXT,
    status project_status_enum NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL,
    target_end_date DATE,
    calendar_id UUID, -- References working_calendars (defined in 00003)
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_project_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ------------------------------------------------------------------------------
-- Table: project_members
-- External / Guest access scoping: Users with role 'guest' only see projects
-- explicitly linked here, isolating them from tenant-wide visibility.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'contributor', -- 'lead', 'editor', 'viewer', 'guest'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_tenant ON project_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

-- ------------------------------------------------------------------------------
-- Table: phases (high-level project stages)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(32) DEFAULT '#3b82f6',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id);
CREATE INDEX IF NOT EXISTS idx_phases_tenant ON phases(tenant_id);

-- ------------------------------------------------------------------------------
-- Table: tasks
-- Hierarchical structure: parent_id allows recursive nesting up to 4 levels.
-- Includes CPM fields: early/late dates, total/free float, is_critical flag.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status_enum NOT NULL DEFAULT 'todo',
    priority task_priority_enum NOT NULL DEFAULT 'medium',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days >= 0),
    progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
    -- Critical Path Method (CPM) Attributes
    early_start DATE,
    early_finish DATE,
    late_start DATE,
    late_finish DATE,
    total_float INTEGER DEFAULT 0,
    free_float INTEGER DEFAULT 0,
    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_task_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_phase ON tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_critical ON tasks(is_critical);

-- ------------------------------------------------------------------------------
-- Table: task_assignments
-- Multi-user assignment with percentage effort allocation and optional team binding.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    effort_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (effort_percent > 0 AND effort_percent <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_assignment_target CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_tenant ON task_assignments(tenant_id);

-- ------------------------------------------------------------------------------
-- Table: task_dependencies
-- Precedence Diagramming Method (PDM) links:
-- FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)
-- with positive or negative lag days.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    predecessor_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type dependency_type_enum NOT NULL DEFAULT 'FS',
    lag_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_dependency CHECK (predecessor_id != successor_id),
    CONSTRAINT uq_task_dependency UNIQUE (project_id, predecessor_id, successor_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_project ON task_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_predecessor ON task_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_successor ON task_dependencies(successor_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_tenant ON task_dependencies(tenant_id);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 00003_calendars_and_holidays.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- 00003_calendars_and_holidays.sql
-- Working calendars, regional weekend configuration, and tenant/project holidays.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: working_calendars
-- Defines working days, regional weekend exclusions, and standard hours.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS working_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    week_start_day SMALLINT NOT NULL DEFAULT 1 CHECK (week_start_day BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday
    working_days JSONB NOT NULL DEFAULT '[1, 2, 3, 4, 5]'::jsonb, -- 0=Sun, 1=Mon, ..., 6=Sat
    daily_working_hours NUMERIC(4, 2) NOT NULL DEFAULT 8.00 CHECK (daily_working_hours > 0 AND daily_working_hours <= 24),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_calendar_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_calendars_tenant ON working_calendars(tenant_id);

-- Attach foreign key constraint from projects to working_calendars
DO $$ BEGIN
    ALTER TABLE projects
    ADD CONSTRAINT fk_projects_calendar
    FOREIGN KEY (calendar_id) REFERENCES working_calendars(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- Table: calendar_holidays
-- Fixed and floating non-working holiday dates tied to specific calendars.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    calendar_id UUID NOT NULL REFERENCES working_calendars(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    date DATE NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    floating_rule JSONB, -- Optional metadata for recurring algorithm calculations
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_calendar_holiday_date UNIQUE (calendar_id, date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_calendar ON calendar_holidays(calendar_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON calendar_holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_tenant ON calendar_holidays(tenant_id);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 00004_rls_security_policies.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- 00004_rls_security_policies.sql
-- Row Level Security (RLS) policies enforcing multi-tenant isolation,
-- superadmin administrative access, and scoped guest access boundaries.
-- ==============================================================================

-- Enable Row Level Security on all core application tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_holidays ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Helper Security Functions
-- ------------------------------------------------------------------------------

-- Retrieve currently authenticated user ID from JWT sub claim or auth.uid()
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID,
        auth.uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if a user is designated as global superadmin
CREATE OR REPLACE FUNCTION is_superadmin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = check_user_id AND is_superadmin = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check active tenant membership role for a given user
CREATE OR REPLACE FUNCTION get_user_tenant_role(check_user_id UUID, check_tenant_id UUID)
RETURNS tenant_role_enum AS $$
DECLARE
    found_role tenant_role_enum;
BEGIN
    SELECT role INTO found_role
    FROM tenant_memberships
    WHERE user_id = check_user_id
      AND tenant_id = check_tenant_id
      AND is_active = TRUE;
    RETURN found_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Determine whether user has access to a specific project
-- (Standard members see all tenant projects; guests only see explicitly assigned projects)
CREATE OR REPLACE FUNCTION can_user_access_project(check_user_id UUID, check_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    proj_tenant_id UUID;
    member_role tenant_role_enum;
BEGIN
    IF is_superadmin(check_user_id) THEN
        RETURN TRUE;
    END IF;

    SELECT tenant_id INTO proj_tenant_id FROM projects WHERE id = check_project_id;
    IF proj_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    member_role := get_user_tenant_role(check_user_id, proj_tenant_id);
    IF member_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- If user is standard tenant member, manager, or admin, they have workspace-level read visibility
    IF member_role IN ('superadmin', 'tenant_admin', 'project_manager', 'contributor') THEN
        RETURN TRUE;
    END IF;

    -- If user is a Guest, verify explicit project membership
    IF member_role = 'guest' THEN
        RETURN EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = check_project_id AND user_id = check_user_id
        );
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- RLS Policies: tenants
-- ------------------------------------------------------------------------------
CREATE POLICY "tenants_select_policy" ON tenants
    FOR SELECT USING (
        is_superadmin(current_app_user_id())
        OR id IN (
            SELECT tenant_id FROM tenant_memberships
            WHERE user_id = current_app_user_id() AND is_active = TRUE
        )
    );

CREATE POLICY "tenants_admin_mutation_policy" ON tenants
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), id) = 'tenant_admin'
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: tenant_memberships
-- ------------------------------------------------------------------------------
CREATE POLICY "memberships_select_policy" ON tenant_memberships
    FOR SELECT USING (
        is_superadmin(current_app_user_id())
        OR tenant_id IN (
            SELECT tenant_id FROM tenant_memberships
            WHERE user_id = current_app_user_id() AND is_active = TRUE
        )
    );

CREATE POLICY "memberships_admin_manage_policy" ON tenant_memberships
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) = 'tenant_admin'
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: user_profiles
-- ------------------------------------------------------------------------------
CREATE POLICY "profiles_read_colleagues" ON user_profiles
    FOR SELECT USING (
        id = current_app_user_id()
        OR is_superadmin(current_app_user_id())
        OR id IN (
            SELECT tm.user_id FROM tenant_memberships tm
            WHERE tm.tenant_id IN (
                SELECT my_tm.tenant_id FROM tenant_memberships my_tm
                WHERE my_tm.user_id = current_app_user_id() AND my_tm.is_active = TRUE
            )
        )
    );

CREATE POLICY "profiles_update_self" ON user_profiles
    FOR UPDATE USING (id = current_app_user_id() OR is_superadmin(current_app_user_id()));

-- ------------------------------------------------------------------------------
-- RLS Policies: projects
-- ------------------------------------------------------------------------------
CREATE POLICY "projects_select_policy" ON projects
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), id)
    );

CREATE POLICY "projects_mutation_policy" ON projects
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: project_members
-- ------------------------------------------------------------------------------
CREATE POLICY "project_members_select_policy" ON project_members
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), project_id)
    );

CREATE POLICY "project_members_manage_policy" ON project_members
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: phases
-- ------------------------------------------------------------------------------
CREATE POLICY "phases_select_policy" ON phases
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), project_id)
    );

CREATE POLICY "phases_modify_policy" ON phases
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: tasks
-- ------------------------------------------------------------------------------
CREATE POLICY "tasks_select_policy" ON tasks
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), project_id)
    );

CREATE POLICY "tasks_modify_policy" ON tasks
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager', 'contributor')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: task_assignments
-- ------------------------------------------------------------------------------
CREATE POLICY "assignments_select_policy" ON task_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.id = task_assignments.task_id
              AND can_user_access_project(current_app_user_id(), t.project_id)
        )
    );

CREATE POLICY "assignments_modify_policy" ON task_assignments
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: task_dependencies
-- ------------------------------------------------------------------------------
CREATE POLICY "dependencies_select_policy" ON task_dependencies
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), project_id)
    );

CREATE POLICY "dependencies_modify_policy" ON task_dependencies
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: working_calendars & calendar_holidays
-- ------------------------------------------------------------------------------
CREATE POLICY "calendars_select_policy" ON working_calendars
    FOR SELECT USING (
        is_superadmin(current_app_user_id())
        OR tenant_id IN (
            SELECT tenant_id FROM tenant_memberships
            WHERE user_id = current_app_user_id() AND is_active = TRUE
        )
    );

CREATE POLICY "calendars_modify_policy" ON working_calendars
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) = 'tenant_admin'
    );

CREATE POLICY "holidays_select_policy" ON calendar_holidays
    FOR SELECT USING (
        is_superadmin(current_app_user_id())
        OR tenant_id IN (
            SELECT tenant_id FROM tenant_memberships
            WHERE user_id = current_app_user_id() AND is_active = TRUE
        )
    );

CREATE POLICY "holidays_modify_policy" ON calendar_holidays
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) = 'tenant_admin'
    );


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 00005_audit_logs_and_crypto.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- 00005_audit_logs_and_crypto.sql
-- Audit logging infrastructure with before/after diff tracking, correlation IDs,
-- and pgcrypto field-level secret encryption for sensitive credentials.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: audit_logs
-- Immutable tamper-evident audit record for compliance and destructive actions.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action VARCHAR(32) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'SECURITY_OVERRIDE'
    entity_type VARCHAR(64) NOT NULL, -- 'project', 'task', 'dependency', 'calendar', 'membership'
    entity_id UUID NOT NULL,
    diff_before JSONB,
    diff_after JSONB,
    correlation_id VARCHAR(128),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation ON audit_logs(correlation_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_tenant_admin_read" ON audit_logs
    FOR SELECT USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin')
    );

-- ------------------------------------------------------------------------------
-- Audit Trigger Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_record_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    computed_tenant_id UUID;
    computed_actor_id UUID;
    computed_correlation_id VARCHAR(128);
    before_json JSONB := NULL;
    after_json JSONB := NULL;
    target_id UUID;
BEGIN
    computed_actor_id := current_app_user_id();
    computed_correlation_id := NULLIF(current_setting('request.headers.x-correlation-id', true), '');

    IF (TG_OP = 'DELETE') THEN
        target_id := OLD.id;
        computed_tenant_id := OLD.tenant_id;
        before_json := to_jsonb(OLD);
    ELSIF (TG_OP = 'UPDATE') THEN
        target_id := NEW.id;
        computed_tenant_id := NEW.tenant_id;
        before_json := to_jsonb(OLD);
        after_json := to_jsonb(NEW);
    ELSIF (TG_OP = 'INSERT') THEN
        target_id := NEW.id;
        computed_tenant_id := NEW.tenant_id;
        after_json := to_jsonb(NEW);
    END IF;

    INSERT INTO audit_logs (
        tenant_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        diff_before,
        diff_after,
        correlation_id
    ) VALUES (
        computed_tenant_id,
        computed_actor_id,
        TG_OP,
        TG_TABLE_NAME,
        target_id,
        before_json,
        after_json,
        computed_correlation_id
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to mutation targets
DROP TRIGGER IF EXISTS trg_audit_tasks ON tasks;
CREATE TRIGGER trg_audit_tasks
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION trigger_record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_projects ON projects;
CREATE TRIGGER trg_audit_projects
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION trigger_record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_dependencies ON task_dependencies;
CREATE TRIGGER trg_audit_dependencies
    AFTER INSERT OR UPDATE OR DELETE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION trigger_record_audit_log();

-- ------------------------------------------------------------------------------
-- Table: tenant_credentials (Field-level encryption for sensitive secrets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    service_type VARCHAR(64) NOT NULL, -- 'webhook', 'sso_saml', 'api_key'
    encrypted_secret BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_secret_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant ON tenant_credentials(tenant_id);

ALTER TABLE tenant_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credentials_tenant_admin_only" ON tenant_credentials
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) = 'tenant_admin'
    );

-- Secret encryption / decryption helper procedures using pgcrypto
CREATE OR REPLACE FUNCTION encrypt_tenant_secret(raw_secret TEXT, encryption_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(raw_secret, encryption_key, 'compress-algo=1, cipher-algo=aes256');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION decrypt_tenant_secret(encrypted_data BYTEA, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data, encryption_key);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 00007_schema_refinements.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- 00007_schema_refinements.sql
-- Exact Database Architecture, RBAC Enums, PL/pgSQL Engines & RLS Matrix
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Exact Custom Domain Types & Enums
DO $$ BEGIN
    CREATE TYPE user_tenant_role AS ENUM (
        'owner',
        'admin',
        'project_manager',
        'member',
        'guest'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE dependency_type AS ENUM (
        'FS', -- Finish-to-Start
        'SS', -- Start-to-Start
        'FF', -- Finish-to-Finish
        'SF'  -- Start-to-Finish
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM (
        'low',
        'medium',
        'high',
        'urgent'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'backlog',
        'todo',
        'in_progress',
        'review',
        'done',
        'blocked'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Core Tables Specification

-- Table: tenants
CREATE TABLE IF NOT EXISTS tenants_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tenant_code TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    week_starts_on SMALLINT NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6), -- 0=Sun, 1=Mon
    weekend_days INTEGER[] NOT NULL DEFAULT '{0, 6}', -- e.g. {0, 6} for Sun/Sat, or {5, 6} for Fri/Sat
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_v2_code ON tenants_v2(tenant_code);
CREATE INDEX IF NOT EXISTS idx_tenants_v2_slug ON tenants_v2(slug);

-- Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Table: tenant_memberships
CREATE TABLE IF NOT EXISTS tenant_memberships_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role user_tenant_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_user_v2 UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_v2_tenant ON tenant_memberships_v2(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_v2_user ON tenant_memberships_v2(user_id);

-- Table: tenant_teams
CREATE TABLE IF NOT EXISTS tenant_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_team_name_v2 UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_teams_tenant ON tenant_teams(tenant_id);

-- Table: team_members (Composite PK)
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES tenant_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);

-- Table: calendar_holidays
CREATE TABLE IF NOT EXISTS calendar_holidays_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    holiday_date DATE NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_holiday_date UNIQUE (tenant_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_v2_date ON calendar_holidays_v2(tenant_id, holiday_date);

-- Table: projects
CREATE TABLE IF NOT EXISTS projects_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    target_end_date DATE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_v2_tenant ON projects_v2(tenant_id);

-- Table: project_guest_access
CREATE TABLE IF NOT EXISTS project_guest_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'view' CHECK (access_level IN ('view', 'comment', 'edit')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_guest UNIQUE (project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_project_guest_project ON project_guest_access(project_id);
CREATE INDEX IF NOT EXISTS idx_project_guest_user ON project_guest_access(user_id);
CREATE INDEX IF NOT EXISTS idx_project_guest_email ON project_guest_access(email);

-- Table: project_phases
CREATE TABLE IF NOT EXISTS project_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phases_v2_project ON project_phases(project_id);

-- Table: tasks
CREATE TABLE IF NOT EXISTS tasks_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
    parent_task_id UUID REFERENCES tasks_v2(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days >= 0),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    -- Computed CPM Cache Attributes
    early_start DATE,
    early_finish DATE,
    late_start DATE,
    late_finish DATE,
    total_float INTEGER DEFAULT 0,
    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_v2_project ON tasks_v2(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_v2_parent ON tasks_v2(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_v2_phase ON tasks_v2(phase_id);

-- Table: task_assignees (Composite PK)
CREATE TABLE IF NOT EXISTS task_assignees (
    task_id UUID NOT NULL REFERENCES tasks_v2(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    allocation_percent INTEGER NOT NULL DEFAULT 100 CHECK (allocation_percent > 0 AND allocation_percent <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);

-- Table: task_dependencies
CREATE TABLE IF NOT EXISTS task_dependencies_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
    predecessor_id UUID NOT NULL REFERENCES tasks_v2(id) ON DELETE CASCADE,
    successor_id UUID NOT NULL REFERENCES tasks_v2(id) ON DELETE CASCADE,
    dep_type dependency_type NOT NULL DEFAULT 'FS',
    lag_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_diff_tasks CHECK (predecessor_id <> successor_id),
    CONSTRAINT uq_dep_pair UNIQUE (predecessor_id, successor_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_v2_proj ON task_dependencies_v2(project_id);

-- 3. Security Definer Functions & Calendar Engine in PL/pgSQL

-- Helper: is_member_of(_tenant_id)
CREATE OR REPLACE FUNCTION is_member_of(_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check platform superadmin
    IF EXISTS (SELECT 1 FROM profiles WHERE id = current_uid AND is_superadmin = TRUE) THEN
        RETURN TRUE;
    END IF;

    -- Check tenant membership
    RETURN EXISTS (
        SELECT 1 FROM tenant_memberships_v2
        WHERE tenant_id = _tenant_id AND user_id = current_uid
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper: has_guest_project_access(_project_id)
CREATE OR REPLACE FUNCTION has_guest_project_access(_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID;
    current_email TEXT;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- If superadmin or direct tenant member with non-guest role
    IF EXISTS (
        SELECT 1 FROM projects_v2 p
        JOIN tenant_memberships_v2 tm ON tm.tenant_id = p.tenant_id
        WHERE p.id = _project_id AND tm.user_id = current_uid AND tm.role <> 'guest'
    ) THEN
        RETURN TRUE;
    END IF;

    SELECT email INTO current_email FROM profiles WHERE id = current_uid;

    -- Check project_guest_access
    RETURN EXISTS (
        SELECT 1 FROM project_guest_access
        WHERE project_id = _project_id
          AND (user_id = current_uid OR (current_email IS NOT NULL AND email = current_email))
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Working Day Calculation Function: calculate_working_end_date
CREATE OR REPLACE FUNCTION calculate_working_end_date(
    _tenant_id UUID,
    _start_date DATE,
    _duration_days INT
)
RETURNS DATE AS $$
DECLARE
    computed_end DATE := _start_date;
    days_to_add INT := _duration_days;
    configured_weekends INT[];
    curr_day_of_week INT;
    is_holiday BOOLEAN;
BEGIN
    IF _duration_days <= 0 THEN
        RETURN _start_date;
    END IF;

    SELECT weekend_days INTO configured_weekends
    FROM tenants_v2 WHERE id = _tenant_id;

    IF configured_weekends IS NULL THEN
        configured_weekends := '{0, 6}'::INT[];
    END IF;

    -- Advance to first valid working day if start is on non-working day
    LOOP
        curr_day_of_week := EXTRACT(DOW FROM computed_end)::INT;
        SELECT EXISTS (
            SELECT 1 FROM calendar_holidays_v2
            WHERE tenant_id = _tenant_id AND holiday_date = computed_end
        ) INTO is_holiday;

        IF curr_day_of_week = ANY(configured_weekends) OR is_holiday THEN
            computed_end := computed_end + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    -- Day 1 counts as the start day
    days_to_add := days_to_add - 1;

    WHILE days_to_add > 0 LOOP
        computed_end := computed_end + 1;
        curr_day_of_week := EXTRACT(DOW FROM computed_end)::INT;

        SELECT EXISTS (
            SELECT 1 FROM calendar_holidays_v2
            WHERE tenant_id = _tenant_id AND holiday_date = computed_end
        ) INTO is_holiday;

        IF NOT (curr_day_of_week = ANY(configured_weekends) OR is_holiday) THEN
            days_to_add := days_to_add - 1;
        END IF;
    END LOOP;

    RETURN computed_end;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Row Level Security Policies Enforcing Tenant Isolation & Scoped Guest Access

ALTER TABLE tenants_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_holidays_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_guest_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_v2_select" ON tenants_v2
    FOR SELECT USING (is_member_of(id));

CREATE POLICY "projects_v2_select" ON projects_v2
    FOR SELECT USING (has_guest_project_access(id));

CREATE POLICY "tasks_v2_select" ON tasks_v2
    FOR SELECT USING (has_guest_project_access(project_id));

CREATE POLICY "task_dependencies_v2_select" ON task_dependencies_v2
    FOR SELECT USING (has_guest_project_access(project_id));


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 00008_dynamic_metadata_and_phase2.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- 00008_dynamic_metadata_and_phase2.sql
-- Phase 2: Zero-Hardcoded Metadata, Dynamic Theming, Custom Fields, Baselines,
-- Notification Dispatcher, and Granular Role Permissions
-- ==============================================================================

-- 1. Dynamic Task Attribute Lookup Tables (Zero Hardcoded Statuses / Priorities / Types)

CREATE TABLE IF NOT EXISTS tenant_task_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_tenant_task_statuses_tenant ON tenant_task_statuses(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_task_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    color_hex VARCHAR(16) NOT NULL DEFAULT '#64748b',
    urgency_weight INT NOT NULL DEFAULT 1,
    icon_key VARCHAR(32) NOT NULL DEFAULT 'circle',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_priority_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tenant_task_priorities_tenant ON tenant_task_priorities(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    icon_key VARCHAR(32) NOT NULL DEFAULT 'check-square',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_task_type_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_tenant_task_types_tenant ON tenant_task_types(tenant_id);

-- 2. Dynamic Theming Engine (Database-Stored CSS Variables & Design Tokens)

CREATE TABLE IF NOT EXISTS system_themes (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    tokens_json JSONB NOT NULL,
    is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_theme_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    active_theme_id VARCHAR(64) REFERENCES system_themes(id) ON DELETE SET NULL,
    custom_tokens_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_theme UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_theme_tenant ON tenant_theme_overrides(tenant_id);

-- 3. Dynamic Custom Fields Engine (EAV / JSONB Pattern)

CREATE TABLE IF NOT EXISTS tenant_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL CHECK (entity_type IN ('project', 'task')),
    field_name VARCHAR(64) NOT NULL,
    field_key VARCHAR(64) NOT NULL,
    field_type VARCHAR(32) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'multiselect', 'user_reference', 'checkbox', 'formula')),
    options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_custom_field UNIQUE (tenant_id, entity_type, field_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_fields_tenant ON tenant_custom_fields(tenant_id, entity_type);

CREATE TABLE IF NOT EXISTS entity_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL,
    field_id UUID NOT NULL REFERENCES tenant_custom_fields(id) ON DELETE CASCADE,
    value_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_entity_field_value UNIQUE (entity_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_custom_field_values_entity ON entity_custom_field_values(entity_id);

-- 4. Schedule Baselines & Variance Tracking (Earned Value Engine)

CREATE TABLE IF NOT EXISTS project_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_baselines_project ON project_baselines(project_id);

CREATE TABLE IF NOT EXISTS task_baseline_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baseline_id UUID NOT NULL REFERENCES project_baselines(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks_v2(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INT NOT NULL,
    progress INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_baseline_task UNIQUE (baseline_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_baseline_snapshots_task ON task_baseline_snapshots(task_id);

-- 5. Notifications & Event Dispatcher

CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(64),
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notification_events(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notification_events(tenant_id);

-- 6. Granular Role Permissions

CREATE TABLE IF NOT EXISTS tenant_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants_v2(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    permission_key VARCHAR(64) NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_role_permission UNIQUE (tenant_id, role, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant ON tenant_role_permissions(tenant_id, role);

-- 7. Task Constraints & Optimistic Locking Columns on tasks_v2

ALTER TABLE tasks_v2 
    ADD COLUMN IF NOT EXISTS constraint_type VARCHAR(32) DEFAULT 'asap' CHECK (constraint_type IN ('asap', 'must_start_on', 'must_finish_on', 'start_no_earlier_than')),
    ADD COLUMN IF NOT EXISTS constraint_date DATE,
    ADD COLUMN IF NOT EXISTS task_type_id UUID REFERENCES tenant_task_types(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 8. Row Level Security Policies

ALTER TABLE tenant_task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_task_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_theme_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_baseline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_themes_readable_by_all" ON system_themes FOR SELECT USING (TRUE);

CREATE POLICY "tenant_task_statuses_isolation" ON tenant_task_statuses
    FOR ALL USING (is_member_of(tenant_id));

CREATE POLICY "tenant_task_priorities_isolation" ON tenant_task_priorities
    FOR ALL USING (is_member_of(tenant_id));

CREATE POLICY "tenant_task_types_isolation" ON tenant_task_types
    FOR ALL USING (is_member_of(tenant_id));

CREATE POLICY "tenant_theme_overrides_isolation" ON tenant_theme_overrides
    FOR ALL USING (is_member_of(tenant_id));

CREATE POLICY "tenant_custom_fields_isolation" ON tenant_custom_fields
    FOR ALL USING (is_member_of(tenant_id));

CREATE POLICY "entity_custom_field_values_isolation" ON entity_custom_field_values
    FOR ALL USING (is_member_of(tenant_id));

CREATE POLICY "project_baselines_isolation" ON project_baselines
    FOR ALL USING (is_member_of(tenant_id));

CREATE POLICY "task_baseline_snapshots_isolation" ON task_baseline_snapshots
    FOR ALL USING (EXISTS (
        SELECT 1 FROM project_baselines pb 
        WHERE pb.id = task_baseline_snapshots.baseline_id AND is_member_of(pb.tenant_id)
    ));

CREATE POLICY "notification_events_recipient_only" ON notification_events
    FOR ALL USING (recipient_id = auth.uid() OR is_member_of(tenant_id, 'admin'));

CREATE POLICY "tenant_role_permissions_isolation" ON tenant_role_permissions
    FOR ALL USING (is_member_of(tenant_id));

-- 9. Auto-Seeding Trigger Function for New Tenants

CREATE OR REPLACE FUNCTION seed_tenant_metadata_on_create()
RETURNS TRIGGER AS $$
BEGIN
    -- Seed Default Task Statuses
    INSERT INTO tenant_task_statuses (tenant_id, name, slug, color_hex, badge_variant, position, is_closed_state, is_default) VALUES
        (NEW.id, 'Backlog', 'backlog', '#64748b', 'secondary', 0, FALSE, FALSE),
        (NEW.id, 'To Do', 'todo', '#3b82f6', 'default', 1, FALSE, TRUE),
        (NEW.id, 'In Progress', 'in_progress', '#f59e0b', 'warning', 2, FALSE, FALSE),
        (NEW.id, 'In Review', 'review', '#8b5cf6', 'secondary', 3, FALSE, FALSE),
        (NEW.id, 'Done', 'done', '#10b981', 'success', 4, TRUE, FALSE),
        (NEW.id, 'Blocked', 'blocked', '#ef4444', 'destructive', 5, FALSE, FALSE)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    -- Seed Default Task Priorities
    INSERT INTO tenant_task_priorities (tenant_id, name, slug, color_hex, urgency_weight, icon_key, is_default) VALUES
        (NEW.id, 'Low', 'low', '#64748b', 1, 'arrow-down', FALSE),
        (NEW.id, 'Medium', 'medium', '#3b82f6', 2, 'minus', TRUE),
        (NEW.id, 'High', 'high', '#f59e0b', 3, 'arrow-up', FALSE),
        (NEW.id, 'Urgent', 'urgent', '#ef4444', 4, 'alert-triangle', FALSE)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    -- Seed Default Task Types
    INSERT INTO tenant_task_types (tenant_id, name, slug, icon_key, is_default) VALUES
        (NEW.id, 'Task', 'task', 'check-square', TRUE),
        (NEW.id, 'Milestone', 'milestone', 'flag', FALSE),
        (NEW.id, 'Feature', 'feature', 'sparkles', FALSE),
        (NEW.id, 'Bug', 'bug', 'bug', FALSE),
        (NEW.id, 'Phase', 'phase', 'folder', FALSE)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    -- Seed Default Theme Override
    INSERT INTO tenant_theme_overrides (tenant_id, active_theme_id, custom_tokens_json) VALUES
        (NEW.id, 'navy', '{}'::jsonb)
    ON CONFLICT (tenant_id) DO NOTHING;

    -- Seed Default Role Permissions
    INSERT INTO tenant_role_permissions (tenant_id, role, permission_key, is_granted) VALUES
        -- Owner
        (NEW.id, 'owner', 'tasks.create', TRUE),
        (NEW.id, 'owner', 'tasks.edit', TRUE),
        (NEW.id, 'owner', 'tasks.delete', TRUE),
        (NEW.id, 'owner', 'cpm.recalculate', TRUE),
        (NEW.id, 'owner', 'baselines.create', TRUE),
        (NEW.id, 'owner', 'settings.manage', TRUE),
        (NEW.id, 'owner', 'roles.manage', TRUE),
        -- Admin
        (NEW.id, 'admin', 'tasks.create', TRUE),
        (NEW.id, 'admin', 'tasks.edit', TRUE),
        (NEW.id, 'admin', 'tasks.delete', TRUE),
        (NEW.id, 'admin', 'cpm.recalculate', TRUE),
        (NEW.id, 'admin', 'baselines.create', TRUE),
        (NEW.id, 'admin', 'settings.manage', TRUE),
        (NEW.id, 'admin', 'roles.manage', FALSE),
        -- Project Manager
        (NEW.id, 'project_manager', 'tasks.create', TRUE),
        (NEW.id, 'project_manager', 'tasks.edit', TRUE),
        (NEW.id, 'project_manager', 'tasks.delete', TRUE),
        (NEW.id, 'project_manager', 'cpm.recalculate', TRUE),
        (NEW.id, 'project_manager', 'baselines.create', TRUE),
        (NEW.id, 'project_manager', 'settings.manage', FALSE),
        (NEW.id, 'project_manager', 'roles.manage', FALSE),
        -- Member
        (NEW.id, 'member', 'tasks.create', TRUE),
        (NEW.id, 'member', 'tasks.edit', TRUE),
        (NEW.id, 'member', 'tasks.delete', FALSE),
        (NEW.id, 'member', 'cpm.recalculate', FALSE),
        (NEW.id, 'member', 'baselines.create', FALSE),
        (NEW.id, 'member', 'settings.manage', FALSE),
        (NEW.id, 'member', 'roles.manage', FALSE),
        -- Guest
        (NEW.id, 'guest', 'tasks.create', FALSE),
        (NEW.id, 'guest', 'tasks.edit', FALSE),
        (NEW.id, 'guest', 'tasks.delete', FALSE),
        (NEW.id, 'guest', 'cpm.recalculate', FALSE),
        (NEW.id, 'guest', 'baselines.create', FALSE),
        (NEW.id, 'guest', 'settings.manage', FALSE),
        (NEW.id, 'guest', 'roles.manage', FALSE)
    ON CONFLICT (tenant_id, role, permission_key) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_tenant_metadata ON tenants_v2;
CREATE TRIGGER trg_seed_tenant_metadata
    AFTER INSERT ON tenants_v2
    FOR EACH ROW
    EXECUTE FUNCTION seed_tenant_metadata_on_create();


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: 00009_root_superadmin_and_demo_seed.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ==============================================================================
-- 00009_root_superadmin_and_demo_seed.sql
-- Phase 3: Root SuperAdmin Provisioning & Operational Demo Dataset
-- Root Admin: admin@jyotirmoyb.com
-- Default Workspace: Enterprise Core (code: CORE-SYS, slug: core)
-- ==============================================================================

DO $$
DECLARE
    super_admin_id UUID := 'b0000000-0000-0000-0000-000000000099'::UUID;
    guest_user_id UUID := 'b0000000-0000-0000-0000-000000000098'::UUID;
    engineer_user_id UUID := 'b0000000-0000-0000-0000-000000000097'::UUID;
    devops_user_id UUID := 'b0000000-0000-0000-0000-000000000096'::UUID;

    tenant_core_id UUID := 'a0000000-0000-0000-0000-000000000003'::UUID;
    cal_core_id UUID := 'c0000000-0000-0000-0000-000000000003'::UUID;
    team_platform_id UUID := 'a0000000-0000-0000-0000-000000000011'::UUID;
    team_ops_id UUID := 'a0000000-0000-0000-0000-000000000012'::UUID;

    prj_modernize_id UUID := 'd0000000-0000-0000-0000-000000000003'::UUID;
    ph1_id UUID := 'e0000000-0000-0000-0000-000000000011'::UUID;
    ph2_id UUID := 'e0000000-0000-0000-0000-000000000012'::UUID;
    ph3_id UUID := 'e0000000-0000-0000-0000-000000000013'::UUID;

    t1_id UUID := 'f0000000-0000-0000-0000-000000000011'::UUID;
    t2_id UUID := 'f0000000-0000-0000-0000-000000000012'::UUID;
    t3_id UUID := 'f0000000-0000-0000-0000-000000000013'::UUID;
    t4_id UUID := 'f0000000-0000-0000-0000-000000000014'::UUID;
    t5_id UUID := 'f0000000-0000-0000-0000-000000000015'::UUID;
    t6_id UUID := 'f0000000-0000-0000-0000-000000000016'::UUID;
    t7_id UUID := 'f0000000-0000-0000-0000-000000000017'::UUID;
    t8_id UUID := 'f0000000-0000-0000-0000-000000000018'::UUID;

    base_core_id UUID := 'a0000000-0000-0000-0000-000000000021'::UUID;
BEGIN
    -- 1. Insert Root SuperAdmin & Demo Team Members into auth.users (if auth exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud)
        VALUES
        (super_admin_id, '00000000-0000-0000-0000-000000000000', 'admin@jyotirmoyb.com', crypt('Admin@jyotirmoyb2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"System Administrator"}', 'authenticated', 'authenticated'),
        (guest_user_id, '00000000-0000-0000-0000-000000000000', 'guest@external-partner.com', crypt('GuestPass2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Guest Auditor (Partner Org)"}', 'authenticated', 'authenticated'),
        (engineer_user_id, '00000000-0000-0000-0000-000000000000', 'lead.engineer@core.internal', crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Lin (Lead Architect)"}', 'authenticated', 'authenticated'),
        (devops_user_id, '00000000-0000-0000-0000-000000000000', 'devops@core.internal', crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kenji Sato (Site Reliability)"}', 'authenticated', 'authenticated')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 2. Insert User Profiles
    INSERT INTO user_profiles (id, email, full_name, avatar_url, is_superadmin)
    VALUES
    (super_admin_id, 'admin@jyotirmoyb.com', 'System Administrator', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', TRUE),
    (guest_user_id, 'guest@external-partner.com', 'Guest Auditor (Partner Org)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', FALSE),
    (engineer_user_id, 'lead.engineer@core.internal', 'Sarah Lin (Lead Architect)', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', FALSE),
    (devops_user_id, 'devops@core.internal', 'Kenji Sato (Site Reliability)', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', FALSE)
    ON CONFLICT (id) DO UPDATE SET
        is_superadmin = EXCLUDED.is_superadmin,
        full_name = EXCLUDED.full_name;

    -- 3. Provision Default Enterprise Core Tenant
    INSERT INTO tenants (
        id, name, slug, code, tenant_code, domain, status, is_active,
        week_starts_on, weekend_days, storage_quota_mb,
        branding_json, feature_flags
    )
    VALUES (
        tenant_core_id,
        'Enterprise Core',
        'core',
        'CORE-SYS',
        'CORE-SYS',
        'core.pms.internal',
        'active',
        TRUE,
        1, -- Monday
        ARRAY[0, 6], -- Sunday, Saturday
        20480, -- 20 GB
        '{"primary_color": "#2563eb", "theme_preset": "navy", "company_tagline": "Next-Generation Cloud & Infrastructure Operations"}',
        '{"cpm_enabled": true, "export_enabled": true, "audit_enabled": true, "custom_fields_enabled": true, "resource_heatmap_enabled": true}'
    )
    ON CONFLICT (id) DO UPDATE SET
        status = 'active',
        is_active = TRUE;

    -- 4. Bind SuperAdmin as Owner to Enterprise Core
    INSERT INTO tenant_memberships (tenant_id, user_id, role, is_active)
    VALUES
    (tenant_core_id, super_admin_id, 'owner', TRUE),
    (tenant_core_id, engineer_user_id, 'admin', TRUE),
    (tenant_core_id, devops_user_id, 'member', TRUE),
    (tenant_core_id, guest_user_id, 'guest', TRUE)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- 5. Seed 2 Teams: Core Platform and Operations
    INSERT INTO tenant_teams (id, tenant_id, name, description)
    VALUES
    (team_platform_id, tenant_core_id, 'Core Platform', 'Platform Architecture, High-Availability Infrastructure, and API Gateway engineering.'),
    (team_ops_id, tenant_core_id, 'Operations', 'DevOps, Site Reliability Engineering, CI/CD automation, and multi-region deployment.')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO team_members (team_id, user_id, role)
    VALUES
    (team_platform_id, super_admin_id, 'lead'),
    (team_platform_id, engineer_user_id, 'member'),
    (team_ops_id, devops_user_id, 'lead')
    ON CONFLICT (team_id, user_id) DO NOTHING;

    -- 6. Seed Custom Working Calendar & 3 Holidays (Monday-Friday)
    INSERT INTO working_calendars (id, tenant_id, name, week_start_day, working_days, default_hours_per_day, is_default)
    VALUES
    (cal_core_id, tenant_core_id, 'Standard Corporate Calendar (Mon-Fri)', 1, ARRAY[1, 2, 3, 4, 5], 8, TRUE)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO calendar_holidays (tenant_id, calendar_id, name, holiday_date, is_recurring)
    VALUES
    (tenant_core_id, cal_core_id, 'New Year''s Day', '2026-01-01', TRUE),
    (tenant_core_id, cal_core_id, 'Memorial Day', '2026-05-25', TRUE),
    (tenant_core_id, cal_core_id, 'Labor Day', '2026-09-07', TRUE)
    ON CONFLICT DO NOTHING;

    -- 7. Seed Demonstration Project: Global Infrastructure Modernization
    INSERT INTO projects (id, tenant_id, calendar_id, name, code, description, status, start_date, target_end_date, created_by)
    VALUES
    (
        prj_modernize_id,
        tenant_core_id,
        cal_core_id,
        'Global Infrastructure Modernization',
        'PRJ-CORE',
        'Multi-region migration to modern container orchestration, Zero-Trust network security, and autonomous CI/CD pipelines.',
        'active',
        '2026-10-01',
        '2026-12-15',
        super_admin_id
    )
    ON CONFLICT (id) DO NOTHING;

    -- 8. Seed 3 Phases
    INSERT INTO project_phases (id, tenant_id, project_id, name, order_index, start_date, end_date)
    VALUES
    (ph1_id, tenant_core_id, prj_modernize_id, 'Phase 1: Architecture & Security Baseline', 1, '2026-10-01', '2026-10-15'),
    (ph2_id, tenant_core_id, prj_modernize_id, 'Phase 2: Core Implementation & Workloads', 2, '2026-10-16', '2026-11-20'),
    (ph3_id, tenant_core_id, prj_modernize_id, 'Phase 3: UAT, Penetration Testing & Deployment', 3, '2026-11-23', '2026-12-15')
    ON CONFLICT (id) DO NOTHING;

    -- 9. Seed 8 Tasks with parent-child nesting, durations, and assignees
    -- Task 1: Architecture Blueprint
    INSERT INTO tasks (id, tenant_id, project_id, phase_id, parent_task_id, title, code, description, status, priority, start_date, end_date, duration_days, progress, is_milestone, sort_order)
    VALUES
    (t1_id, tenant_core_id, prj_modernize_id, ph1_id, NULL, 'Zero-Trust Architecture & Threat Modeling', 'TASK-101', 'Define SPIFFE/SPIRE workload identities and mutual TLS topology.', 'done', 'high', '2026-10-01', '2026-10-05', 3, 100, FALSE, 1),
    
    -- Task 2: Kubernetes Infrastructure (Parent Task)
    (t2_id, tenant_core_id, prj_modernize_id, ph1_id, NULL, 'Multi-Cluster Kubernetes Platform Setup', 'TASK-102', 'Provision Terraform infrastructure for multi-region EKS clusters.', 'in_progress', 'urgent', '2026-10-06', '2026-10-14', 7, 60, FALSE, 2),
    
    -- Task 3: Subtask of Task 2
    (t3_id, tenant_core_id, prj_modernize_id, ph1_id, t2_id, 'VPC Peering & Transit Gateway Routing', 'TASK-102-A', 'Configure cross-region routing and peering mesh.', 'done', 'high', '2026-10-06', '2026-10-08', 3, 100, FALSE, 3),

    -- Task 4: Subtask of Task 2
    (t4_id, tenant_core_id, prj_modernize_id, ph1_id, t2_id, 'GitOps ArgoCD Cluster Synchronizers', 'TASK-102-B', 'Setup declarative state synchronization with encrypted SOPS secrets.', 'in_progress', 'medium', '2026-10-09', '2026-10-14', 4, 30, FALSE, 4),

    -- Task 5: Database Migration
    (t5_id, tenant_core_id, prj_modernize_id, ph2_id, NULL, 'PostgreSQL Database Zero-Downtime Replication', 'TASK-201', 'Establish logical replication streams with failover verification.', 'todo', 'urgent', '2026-10-15', '2026-10-23', 7, 0, FALSE, 5),

    -- Task 6: API Gateway & Service Mesh
    (t6_id, tenant_core_id, prj_modernize_id, ph2_id, NULL, 'Envoy Proxy Service Mesh & Rate Limiting', 'TASK-202', 'Implement adaptive rate limiting with Redis-backed token buckets.', 'todo', 'high', '2026-10-26', '2026-11-04', 8, 0, FALSE, 6),

    -- Task 7: Comprehensive Load & Security Audit
    (t7_id, tenant_core_id, prj_modernize_id, ph3_id, NULL, 'Third-Party SOC 2 Penetration Testing', 'TASK-301', 'External audit firm evaluation of perimeter isolation and data encryption.', 'todo', 'high', '2026-11-05', '2026-11-13', 7, 0, FALSE, 7),

    -- Task 8: Production Milestone
    (t8_id, tenant_core_id, prj_modernize_id, ph3_id, NULL, 'Cutover & Global Traffic Switchover Milestone', 'MILE-401', 'Promote staging mesh to primary DNS traffic routing.', 'todo', 'urgent', '2026-11-16', '2026-11-16', 0, 0, TRUE, 8)
    ON CONFLICT (id) DO NOTHING;

    -- 10. Task Assignees
    INSERT INTO task_assignees (task_id, user_id, allocation_percent)
    VALUES
    (t1_id, super_admin_id, 100),
    (t2_id, engineer_user_id, 80),
    (t2_id, devops_user_id, 80),
    (t3_id, devops_user_id, 100),
    (t4_id, engineer_user_id, 100),
    (t5_id, engineer_user_id, 50),
    (t6_id, devops_user_id, 50),
    (t7_id, guest_user_id, 100),
    (t8_id, super_admin_id, 100)
    ON CONFLICT (task_id, user_id) DO NOTHING;

    -- 11. Task Dependencies (FS, SS with lag)
    INSERT INTO task_dependencies (tenant_id, project_id, predecessor_id, successor_id, dep_type, lag_days)
    VALUES
    -- t1 -> t2 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t1_id, t2_id, 'FS', 0),
    -- t3 -> t4 Start-to-Start with 1 day lag (SS +1)
    (tenant_core_id, prj_modernize_id, t3_id, t4_id, 'SS', 1),
    -- t2 -> t5 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t2_id, t5_id, 'FS', 0),
    -- t5 -> t6 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t5_id, t6_id, 'FS', 0),
    -- t6 -> t7 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t6_id, t7_id, 'FS', 0),
    -- t7 -> t8 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t7_id, t8_id, 'FS', 0)
    ON CONFLICT DO NOTHING;

    -- 12. Saved Schedule Baseline Snapshot
    INSERT INTO project_baselines (id, project_id, tenant_id, name, description, created_by, created_at)
    VALUES
    (
        base_core_id,
        prj_modernize_id,
        tenant_core_id,
        'Executive Baseline v1.0 (Q4 Approved)',
        'Approved by the Technical Steering Committee prior to infrastructure sprint kickoff.',
        super_admin_id,
        '2026-09-25T00:00:00Z'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO task_baseline_snapshots (baseline_id, task_id, start_date, end_date, duration_days, progress)
    VALUES
    (base_core_id, t1_id, '2026-10-01', '2026-10-05', 3, 100),
    (base_core_id, t2_id, '2026-10-06', '2026-10-12', 5, 40),  -- 2 days slippage compared to live
    (base_core_id, t3_id, '2026-10-06', '2026-10-08', 3, 100),
    (base_core_id, t4_id, '2026-10-09', '2026-10-13', 3, 20),
    (base_core_id, t5_id, '2026-10-13', '2026-10-21', 7, 0),
    (base_core_id, t6_id, '2026-10-22', '2026-10-30', 7, 0),
    (base_core_id, t7_id, '2026-10-31', '2026-11-10', 7, 0),
    (base_core_id, t8_id, '2026-11-12', '2026-11-12', 0, 0)
    ON CONFLICT DO NOTHING;

    -- 13. External Guest Project-Scoped Containment Record
    INSERT INTO project_guest_access (project_id, user_id, granted_by, can_view_cpm, can_view_budget, expires_at)
    VALUES
    (prj_modernize_id, guest_user_id, super_admin_id, TRUE, FALSE, '2026-12-31T23:59:59Z')
    ON CONFLICT (project_id, user_id) DO NOTHING;

END $$;


