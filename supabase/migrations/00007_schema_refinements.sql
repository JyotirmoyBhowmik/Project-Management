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

-- Helper: is_member_of(_tenant_id, _required_role)
CREATE OR REPLACE FUNCTION is_member_of(_tenant_id UUID, _required_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check platform superadmin
    IF EXISTS (SELECT 1 FROM profiles WHERE id = current_uid AND is_superadmin = TRUE)
       OR EXISTS (SELECT 1 FROM user_profiles WHERE id = current_uid AND is_superadmin = TRUE) THEN
        RETURN TRUE;
    END IF;

    -- If no specific role required, check general active membership
    IF _required_role IS NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM tenant_memberships
            WHERE tenant_id = _tenant_id AND user_id = current_uid AND is_active = TRUE
        ) OR EXISTS (
            SELECT 1 FROM tenant_memberships_v2
            WHERE tenant_id = _tenant_id AND user_id = current_uid AND is_active = TRUE
        );
    END IF;

    -- If specific role required (e.g. 'admin')
    RETURN EXISTS (
        SELECT 1 FROM tenant_memberships
        WHERE tenant_id = _tenant_id AND user_id = current_uid AND is_active = TRUE
        AND role::text IN (_required_role, 'owner', 'admin', 'superadmin', 'tenant_admin')
    ) OR EXISTS (
        SELECT 1 FROM tenant_memberships_v2
        WHERE tenant_id = _tenant_id AND user_id = current_uid AND is_active = TRUE
        AND role::text IN (_required_role, 'owner', 'admin', 'superadmin', 'tenant_admin')
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

DROP POLICY IF EXISTS "tenants_v2_select" ON tenants_v2;
CREATE POLICY "tenants_v2_select" ON tenants_v2
    FOR SELECT USING (is_member_of(id));

DROP POLICY IF EXISTS "projects_v2_select" ON projects_v2;
CREATE POLICY "projects_v2_select" ON projects_v2
    FOR SELECT USING (has_guest_project_access(id));

DROP POLICY IF EXISTS "tasks_v2_select" ON tasks_v2;
CREATE POLICY "tasks_v2_select" ON tasks_v2
    FOR SELECT USING (has_guest_project_access(project_id));

DROP POLICY IF EXISTS "task_dependencies_v2_select" ON task_dependencies_v2;
CREATE POLICY "task_dependencies_v2_select" ON task_dependencies_v2
    FOR SELECT USING (has_guest_project_access(project_id));
