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
