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
