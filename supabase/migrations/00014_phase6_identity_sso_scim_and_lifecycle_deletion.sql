-- ==============================================================================
-- Migration 00014: Enterprise Identity Federation & Lifecycle Deletion Architecture
-- Phase 6: SAML 2.0, Active Directory, LDAP, SCIM & Cascading Purge Engine
-- ==============================================================================

-- 1. SSO & SAML Configurations
CREATE TABLE IF NOT EXISTS public.tenant_sso_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    idp_entity_id TEXT NOT NULL,
    idp_sso_url TEXT NOT NULL,
    idp_certificate TEXT NOT NULL,
    metadata_xml_url TEXT,
    allowed_domains TEXT[] NOT NULL DEFAULT '{}',
    enforce_sso BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Directory Sync & SCIM/LDAP Configurations
CREATE TABLE IF NOT EXISTS public.tenant_directory_sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    protocol TEXT NOT NULL CHECK (protocol IN ('ldap', 'ldaps', 'azure_ad_graph', 'scim')),
    host_url TEXT,
    port INTEGER,
    bind_dn TEXT,
    bind_credentials TEXT,
    search_base TEXT,
    user_search_filter TEXT DEFAULT '(objectClass=user)',
    group_search_filter TEXT,
    sync_interval_hours INTEGER DEFAULT 24,
    auto_deactivate_missing_users BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.directory_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sync_started_at TIMESTAMPTZ DEFAULT now(),
    sync_completed_at TIMESTAMPTZ,
    users_created INTEGER DEFAULT 0,
    users_updated INTEGER DEFAULT 0,
    users_suspended INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('success', 'failed', 'partial')),
    error_payload JSONB
);

-- 3. Membership Suspension Flag
ALTER TABLE public.tenant_memberships 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.tenant_sso_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_directory_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_sync_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: tenant_sso_configs
DROP POLICY IF EXISTS "tenant_sso_configs_select" ON public.tenant_sso_configs;
DROP POLICY IF EXISTS "tenant_sso_configs_modify" ON public.tenant_sso_configs;

CREATE POLICY "tenant_sso_configs_select" ON public.tenant_sso_configs
    FOR SELECT USING (
        public.is_superadmin() OR
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid() AND tm.is_active = true
        )
    );

CREATE POLICY "tenant_sso_configs_modify" ON public.tenant_sso_configs
    FOR ALL USING (
        public.is_superadmin() OR
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        public.is_superadmin() OR
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
        )
    );

-- 6. RLS Policies: tenant_directory_sync_configs
DROP POLICY IF EXISTS "tenant_directory_sync_configs_all" ON public.tenant_directory_sync_configs;

CREATE POLICY "tenant_directory_sync_configs_all" ON public.tenant_directory_sync_configs
    FOR ALL USING (
        public.is_superadmin() OR
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        public.is_superadmin() OR
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
        )
    );

-- 7. RLS Policies: directory_sync_logs
DROP POLICY IF EXISTS "directory_sync_logs_select" ON public.directory_sync_logs;
DROP POLICY IF EXISTS "directory_sync_logs_insert" ON public.directory_sync_logs;

CREATE POLICY "directory_sync_logs_select" ON public.directory_sync_logs
    FOR SELECT USING (
        public.is_superadmin() OR
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "directory_sync_logs_insert" ON public.directory_sync_logs
    FOR INSERT WITH CHECK (
        public.is_superadmin() OR
        tenant_id IN (
            SELECT tm.tenant_id FROM public.tenant_memberships tm
            WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
        )
    );

-- 8. Domain-Lookup Helper RPC (Security Definer for Login Gateway)
CREATE OR REPLACE FUNCTION public.get_sso_config_by_domain(p_domain TEXT)
RETURNS TABLE (
    tenant_id UUID,
    idp_entity_id TEXT,
    idp_sso_url TEXT,
    enforce_sso BOOLEAN,
    is_active BOOLEAN
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT 
        s.tenant_id,
        s.idp_entity_id,
        s.idp_sso_url,
        s.enforce_sso,
        s.is_active
    FROM public.tenant_sso_configs s
    WHERE s.is_active = true
      AND (
        p_domain = ANY(s.allowed_domains) 
        OR ('@' || p_domain) = ANY(s.allowed_domains)
        OR ('.' || p_domain) = ANY(s.allowed_domains)
      )
    LIMIT 1;
$$;

-- 9. Atomic Tenant Purge RPC
CREATE OR REPLACE FUNCTION public.purge_tenant_cascade(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Security guard: Must be system superadmin
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Unauthorized: Only platform SuperAdmins can execute tenant purge.';
    END IF;

    -- Delete all cascading tables bound to tenant_id
    DELETE FROM public.task_dependencies WHERE tenant_id = p_tenant_id;
    DELETE FROM public.task_assignees WHERE tenant_id = p_tenant_id;
    DELETE FROM public.task_assignments WHERE tenant_id = p_tenant_id;
    DELETE FROM public.task_comments WHERE tenant_id = p_tenant_id;
    DELETE FROM public.task_activity_log WHERE tenant_id = p_tenant_id;
    DELETE FROM public.task_attachments WHERE tenant_id = p_tenant_id;
    DELETE FROM public.task_time_logs WHERE tenant_id = p_tenant_id;
    DELETE FROM public.document_task_links WHERE doc_id IN (SELECT id FROM public.project_documents WHERE tenant_id = p_tenant_id);
    DELETE FROM public.project_documents WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tasks WHERE tenant_id = p_tenant_id;
    DELETE FROM public.project_sprints WHERE tenant_id = p_tenant_id;
    DELETE FROM public.project_phases WHERE tenant_id = p_tenant_id;
    DELETE FROM public.project_budgets WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenant_user_rates WHERE tenant_id = p_tenant_id;
    DELETE FROM public.project_guest_access WHERE project_id IN (SELECT id FROM public.projects WHERE tenant_id = p_tenant_id);
    DELETE FROM public.projects WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenant_teams WHERE tenant_id = p_tenant_id;
    DELETE FROM public.calendar_holidays WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenant_automations WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenant_webhooks WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenant_sso_configs WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenant_directory_sync_configs WHERE tenant_id = p_tenant_id;
    DELETE FROM public.directory_sync_logs WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenant_memberships WHERE tenant_id = p_tenant_id;
    DELETE FROM public.tenants WHERE id = p_tenant_id;

    -- Record audit log entry
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'TENANT_PURGED', 'tenant', p_tenant_id::text, jsonb_build_object('timestamp', now()));
END;
$$;

-- 10. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
