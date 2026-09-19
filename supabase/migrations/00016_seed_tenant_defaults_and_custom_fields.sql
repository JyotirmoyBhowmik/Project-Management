-- ==============================================================================
-- 00016_seed_tenant_defaults_and_custom_fields.sql
-- Solution-Level Tenant Defaults Seeding & Custom Fields Schema
-- ==============================================================================

-- 1. Create tenant_custom_fields table
CREATE TABLE IF NOT EXISTS public.tenant_custom_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type varchar(30) NOT NULL CHECK (entity_type IN ('project', 'task')),
    field_name varchar(100) NOT NULL,
    field_key varchar(100) NOT NULL,
    field_type varchar(30) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean')),
    options_json jsonb DEFAULT '[]'::jsonb,
    is_required boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_custom_fields UNIQUE (tenant_id, entity_type, field_key)
);

-- 2. Create entity_custom_field_values table
CREATE TABLE IF NOT EXISTS public.entity_custom_field_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL,
    field_id uuid NOT NULL REFERENCES public.tenant_custom_fields(id) ON DELETE CASCADE,
    value_json jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_entity_custom_field_val UNIQUE (tenant_id, entity_id, field_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_custom_fields_tenant ON public.tenant_custom_fields(tenant_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_custom_field_values_lookup ON public.entity_custom_field_values(tenant_id, entity_id);

-- Enable RLS
ALTER TABLE public.tenant_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_custom_field_values ENABLE ROW LEVEL SECURITY;

-- Policies for tenant_custom_fields
DROP POLICY IF EXISTS tenant_custom_fields_select ON public.tenant_custom_fields;
CREATE POLICY tenant_custom_fields_select ON public.tenant_custom_fields
    FOR SELECT TO public
    USING (is_superadmin() OR is_tenant_member(auth.uid(), tenant_id) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS tenant_custom_fields_all ON public.tenant_custom_fields;
CREATE POLICY tenant_custom_fields_all ON public.tenant_custom_fields
    FOR ALL TO public
    USING (is_superadmin() OR is_tenant_member(auth.uid(), tenant_id) OR auth.uid() IS NOT NULL)
    WITH CHECK (is_superadmin() OR is_tenant_member(auth.uid(), tenant_id) OR auth.uid() IS NOT NULL);

-- Policies for entity_custom_field_values
DROP POLICY IF EXISTS entity_custom_field_values_select ON public.entity_custom_field_values;
CREATE POLICY entity_custom_field_values_select ON public.entity_custom_field_values
    FOR SELECT TO public
    USING (is_superadmin() OR is_tenant_member(auth.uid(), tenant_id) OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS entity_custom_field_values_all ON public.entity_custom_field_values;
CREATE POLICY entity_custom_field_values_all ON public.entity_custom_field_values
    FOR ALL TO public
    USING (is_superadmin() OR is_tenant_member(auth.uid(), tenant_id) OR auth.uid() IS NOT NULL)
    WITH CHECK (is_superadmin() OR is_tenant_member(auth.uid(), tenant_id) OR auth.uid() IS NOT NULL);

-- 3. Procedure to idempotently seed defaults for any tenant
CREATE OR REPLACE FUNCTION public.seed_tenant_defaults(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 1. Seed default task statuses if none exist
    IF NOT EXISTS (SELECT 1 FROM public.tenant_task_statuses WHERE tenant_id = p_tenant_id) THEN
        INSERT INTO public.tenant_task_statuses (tenant_id, name, slug, color_hex, badge_variant, position, is_closed_state, is_default)
        VALUES
            (p_tenant_id, 'Backlog', 'backlog', '#64748b', 'secondary', 1, false, false),
            (p_tenant_id, 'To Do', 'todo', '#3b82f6', 'default', 2, false, true),
            (p_tenant_id, 'In Progress', 'in_progress', '#f59e0b', 'default', 3, false, false),
            (p_tenant_id, 'In Review', 'review', '#8b5cf6', 'secondary', 4, false, false),
            (p_tenant_id, 'Completed', 'completed', '#10b981', 'default', 5, true, false),
            (p_tenant_id, 'Blocked', 'blocked', '#ef4444', 'destructive', 6, false, false);
    END IF;

    -- 2. Seed default task priorities if none exist
    IF NOT EXISTS (SELECT 1 FROM public.tenant_task_priorities WHERE tenant_id = p_tenant_id) THEN
        INSERT INTO public.tenant_task_priorities (tenant_id, name, slug, color_hex, urgency_weight, icon_key, is_default)
        VALUES
            (p_tenant_id, 'Low', 'low', '#10b981', 1, 'arrow-down', false),
            (p_tenant_id, 'Medium', 'medium', '#3b82f6', 2, 'minus', true),
            (p_tenant_id, 'High', 'high', '#f59e0b', 3, 'arrow-up', false),
            (p_tenant_id, 'Urgent', 'urgent', '#ef4444', 4, 'alert-circle', false);
    END IF;

    -- 3. Seed default custom fields if none exist
    IF NOT EXISTS (SELECT 1 FROM public.tenant_custom_fields WHERE tenant_id = p_tenant_id) THEN
        INSERT INTO public.tenant_custom_fields (tenant_id, entity_type, field_name, field_key, field_type, options_json, is_required, sort_order)
        VALUES
            (p_tenant_id, 'task', 'Story Points', 'story_points', 'number', '[]'::jsonb, false, 1),
            (p_tenant_id, 'task', 'Risk Severity Tier', 'risk_severity', 'select', '["Low", "Medium", "High", "Critical"]'::jsonb, false, 2),
            (p_tenant_id, 'project', 'Deployment Target', 'deployment_target', 'select', '["Staging", "Production", "Multi-Region Cloud", "On-Premises"]'::jsonb, false, 1);
    END IF;

    -- 4. Seed default working calendar if none exists
    IF NOT EXISTS (SELECT 1 FROM public.working_calendars WHERE tenant_id = p_tenant_id) THEN
        INSERT INTO public.working_calendars (tenant_id, name, week_start_day, working_days, daily_working_hours, is_default)
        VALUES (p_tenant_id, 'Standard Working Calendar', 1, ARRAY[1, 2, 3, 4, 5], 8, true);
    END IF;
END;
$$;

-- 4. Trigger function for any newly created tenant
CREATE OR REPLACE FUNCTION public.handle_new_tenant_seeding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    PERFORM public.seed_tenant_defaults(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_new_tenant ON public.tenants;
CREATE TRIGGER trg_seed_new_tenant
    AFTER INSERT ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_tenant_seeding();

-- 5. Solution-level backfill: Execute seed_tenant_defaults for ALL existing tenants
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        PERFORM public.seed_tenant_defaults(t.id);
    END LOOP;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
