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
