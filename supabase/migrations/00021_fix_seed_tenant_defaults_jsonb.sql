-- ==============================================================================
-- 00021_fix_seed_tenant_defaults_jsonb.sql
-- Fix type casting of working_days column in seed_tenant_defaults function.
-- In working_calendars table, working_days is defined as JSONB, so pass '[1, 2, 3, 4, 5]'::jsonb
-- instead of integer[] ARRAY[1, 2, 3, 4, 5] to eliminate Postgres error 42804 on tenant creation.
-- ==============================================================================

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

    -- 4. Seed default working calendar if none exists (JSONB cast fix)
    IF NOT EXISTS (SELECT 1 FROM public.working_calendars WHERE tenant_id = p_tenant_id) THEN
        INSERT INTO public.working_calendars (tenant_id, name, week_start_day, working_days, daily_working_hours, is_default)
        VALUES (p_tenant_id, 'Standard Working Calendar', 1, '[1, 2, 3, 4, 5]'::jsonb, 8, true);
    END IF;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
