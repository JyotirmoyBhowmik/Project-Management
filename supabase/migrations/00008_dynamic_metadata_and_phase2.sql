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
CREATE OR REPLACE FUNCTION is_member_of(_tenant_id UUID, _required_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Platform superadmin
    IF EXISTS (SELECT 1 FROM profiles WHERE id = current_uid AND is_superadmin = TRUE)
       OR EXISTS (SELECT 1 FROM user_profiles WHERE id = current_uid AND is_superadmin = TRUE) THEN
        RETURN TRUE;
    END IF;

    IF _required_role IS NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM tenant_memberships
            WHERE tenant_id = _tenant_id AND user_id = current_uid AND is_active = TRUE
        ) OR EXISTS (
            SELECT 1 FROM tenant_memberships_v2
            WHERE tenant_id = _tenant_id AND user_id = current_uid AND is_active = TRUE
        );
    END IF;

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

ALTER TABLE project_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_baseline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_themes_readable_by_all" ON system_themes;
CREATE POLICY "system_themes_readable_by_all" ON system_themes FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "tenant_task_statuses_isolation" ON tenant_task_statuses;
CREATE POLICY "tenant_task_statuses_isolation" ON tenant_task_statuses
    FOR ALL USING (is_member_of(tenant_id));

DROP POLICY IF EXISTS "tenant_task_priorities_isolation" ON tenant_task_priorities;
CREATE POLICY "tenant_task_priorities_isolation" ON tenant_task_priorities
    FOR ALL USING (is_member_of(tenant_id));

DROP POLICY IF EXISTS "tenant_task_types_isolation" ON tenant_task_types;
CREATE POLICY "tenant_task_types_isolation" ON tenant_task_types
    FOR ALL USING (is_member_of(tenant_id));

DROP POLICY IF EXISTS "tenant_theme_overrides_isolation" ON tenant_theme_overrides;
CREATE POLICY "tenant_theme_overrides_isolation" ON tenant_theme_overrides
    FOR ALL USING (is_member_of(tenant_id));

DROP POLICY IF EXISTS "tenant_custom_fields_isolation" ON tenant_custom_fields;
CREATE POLICY "tenant_custom_fields_isolation" ON tenant_custom_fields
    FOR ALL USING (is_member_of(tenant_id));

DROP POLICY IF EXISTS "entity_custom_field_values_isolation" ON entity_custom_field_values;
CREATE POLICY "entity_custom_field_values_isolation" ON entity_custom_field_values
    FOR ALL USING (is_member_of(tenant_id));

DROP POLICY IF EXISTS "project_baselines_isolation" ON project_baselines;
CREATE POLICY "project_baselines_isolation" ON project_baselines
    FOR ALL USING (is_member_of(tenant_id));

DROP POLICY IF EXISTS "task_baseline_snapshots_isolation" ON task_baseline_snapshots;
CREATE POLICY "task_baseline_snapshots_isolation" ON task_baseline_snapshots
    FOR ALL USING (EXISTS (
        SELECT 1 FROM project_baselines pb 
        WHERE pb.id = task_baseline_snapshots.baseline_id AND is_member_of(pb.tenant_id)
    ));

DROP POLICY IF EXISTS "notification_events_recipient_only" ON notification_events;
CREATE POLICY "notification_events_recipient_only" ON notification_events
    FOR ALL USING (recipient_id = auth.uid() OR is_member_of(tenant_id, 'admin'));

DROP POLICY IF EXISTS "tenant_role_permissions_isolation" ON tenant_role_permissions;
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
