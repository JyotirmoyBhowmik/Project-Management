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
DROP POLICY IF EXISTS "tenants_select_policy" ON tenants;
DROP POLICY IF EXISTS "tenants_public_lookup" ON tenants;
CREATE POLICY "tenants_select_policy" ON tenants
    FOR SELECT USING (
        is_active = TRUE
        OR status = 'active'
        OR is_superadmin(current_app_user_id())
        OR id IN (
            SELECT tenant_id FROM tenant_memberships
            WHERE user_id = current_app_user_id() AND is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "tenants_admin_mutation_policy" ON tenants;
CREATE POLICY "tenants_admin_mutation_policy" ON tenants
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), id) = 'tenant_admin'
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: tenant_memberships
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "memberships_select_policy" ON tenant_memberships;
CREATE POLICY "memberships_select_policy" ON tenant_memberships
    FOR SELECT USING (
        is_superadmin(current_app_user_id())
        OR tenant_id IN (
            SELECT tenant_id FROM tenant_memberships
            WHERE user_id = current_app_user_id() AND is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "memberships_admin_manage_policy" ON tenant_memberships;
CREATE POLICY "memberships_admin_manage_policy" ON tenant_memberships
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) = 'tenant_admin'
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: user_profiles
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_read_colleagues" ON user_profiles;
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

DROP POLICY IF EXISTS "profiles_update_self" ON user_profiles;
CREATE POLICY "profiles_update_self" ON user_profiles
    FOR UPDATE USING (id = current_app_user_id() OR is_superadmin(current_app_user_id()));

-- ------------------------------------------------------------------------------
-- RLS Policies: projects
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
CREATE POLICY "projects_select_policy" ON projects
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), id)
    );

DROP POLICY IF EXISTS "projects_mutation_policy" ON projects;
CREATE POLICY "projects_mutation_policy" ON projects
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: project_members
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "project_members_select_policy" ON project_members;
CREATE POLICY "project_members_select_policy" ON project_members
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), project_id)
    );

DROP POLICY IF EXISTS "project_members_manage_policy" ON project_members;
CREATE POLICY "project_members_manage_policy" ON project_members
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: phases
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "phases_select_policy" ON phases;
CREATE POLICY "phases_select_policy" ON phases
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), project_id)
    );

DROP POLICY IF EXISTS "phases_modify_policy" ON phases;
CREATE POLICY "phases_modify_policy" ON phases
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: tasks
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_policy" ON tasks;
CREATE POLICY "tasks_select_policy" ON tasks
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), project_id)
    );

DROP POLICY IF EXISTS "tasks_modify_policy" ON tasks;
CREATE POLICY "tasks_modify_policy" ON tasks
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager', 'contributor')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: task_assignments
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "assignments_select_policy" ON task_assignments;
CREATE POLICY "assignments_select_policy" ON task_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.id = task_assignments.task_id
              AND can_user_access_project(current_app_user_id(), t.project_id)
        )
    );

DROP POLICY IF EXISTS "assignments_modify_policy" ON task_assignments;
CREATE POLICY "assignments_modify_policy" ON task_assignments
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: task_dependencies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "dependencies_select_policy" ON task_dependencies;
CREATE POLICY "dependencies_select_policy" ON task_dependencies
    FOR SELECT USING (
        can_user_access_project(current_app_user_id(), project_id)
    );

DROP POLICY IF EXISTS "dependencies_modify_policy" ON task_dependencies;
CREATE POLICY "dependencies_modify_policy" ON task_dependencies
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) IN ('tenant_admin', 'project_manager')
    );

-- ------------------------------------------------------------------------------
-- RLS Policies: working_calendars & calendar_holidays
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "calendars_select_policy" ON working_calendars;
CREATE POLICY "calendars_select_policy" ON working_calendars
    FOR SELECT USING (
        is_superadmin(current_app_user_id())
        OR tenant_id IN (
            SELECT tenant_id FROM tenant_memberships
            WHERE user_id = current_app_user_id() AND is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "calendars_modify_policy" ON working_calendars;
CREATE POLICY "calendars_modify_policy" ON working_calendars
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) = 'tenant_admin'
    );

DROP POLICY IF EXISTS "holidays_select_policy" ON calendar_holidays;
CREATE POLICY "holidays_select_policy" ON calendar_holidays
    FOR SELECT USING (
        is_superadmin(current_app_user_id())
        OR tenant_id IN (
            SELECT tenant_id FROM tenant_memberships
            WHERE user_id = current_app_user_id() AND is_active = TRUE
        )
    );

DROP POLICY IF EXISTS "holidays_modify_policy" ON calendar_holidays;
CREATE POLICY "holidays_modify_policy" ON calendar_holidays
    FOR ALL USING (
        is_superadmin(current_app_user_id())
        OR get_user_tenant_role(current_app_user_id(), tenant_id) = 'tenant_admin'
    );
