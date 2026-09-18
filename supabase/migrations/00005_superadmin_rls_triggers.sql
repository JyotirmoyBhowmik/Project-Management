-- ==============================================================================
-- Migration: Non-recursive RLS, SuperAdmin bypass, triggers, baseline RPC
-- Applied: 2026-09-19
-- ==============================================================================

-- Drop old function versions
DROP FUNCTION IF EXISTS public.is_superadmin() CASCADE;
DROP FUNCTION IF EXISTS public.is_superadmin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.current_app_user_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_tenant_role(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_user_access_project(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_tenant_member(uuid, uuid) CASCADE;

-- ============ HELPER FUNCTIONS (security definer, non-recursive) ============

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superadmin = true); $$;

CREATE OR REPLACE FUNCTION public.is_superadmin(check_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = check_user_id AND is_superadmin = true); $$;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid); $$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_role(check_user_id uuid, check_tenant_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT role FROM public.tenant_memberships
  WHERE user_id = check_user_id AND tenant_id = check_tenant_id AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(check_user_id uuid, check_tenant_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = check_user_id AND tenant_id = check_tenant_id AND is_active = true
  );
$$;

-- ============ RLS POLICIES ============

-- TENANTS
DROP POLICY IF EXISTS "tenants_superadmin_all" ON public.tenants;
DROP POLICY IF EXISTS "tenants_member_select" ON public.tenants;
CREATE POLICY "tenants_superadmin_all" ON public.tenants FOR ALL USING (public.is_superadmin());
CREATE POLICY "tenants_member_select" ON public.tenants FOR SELECT USING (is_active = true OR public.is_tenant_member(auth.uid(), id));

-- PROFILES
DROP POLICY IF EXISTS "profiles_superadmin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_superadmin_all" ON public.profiles FOR ALL USING (public.is_superadmin());
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid() OR public.is_superadmin());

-- TENANT_MEMBERSHIPS (non-recursive)
DROP POLICY IF EXISTS "memberships_superadmin_all" ON public.tenant_memberships;
DROP POLICY IF EXISTS "memberships_own_select" ON public.tenant_memberships;
DROP POLICY IF EXISTS "memberships_tenant_admin_manage" ON public.tenant_memberships;
CREATE POLICY "memberships_superadmin_all" ON public.tenant_memberships FOR ALL USING (public.is_superadmin());
CREATE POLICY "memberships_own_select" ON public.tenant_memberships FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "memberships_tenant_admin_manage" ON public.tenant_memberships
  FOR ALL USING (public.get_user_tenant_role(auth.uid(), tenant_id) IN ('owner', 'admin', 'tenant_admin'));

-- PROJECTS
DROP POLICY IF EXISTS "projects_superadmin_all" ON public.projects;
DROP POLICY IF EXISTS "projects_member_select" ON public.projects;
DROP POLICY IF EXISTS "projects_member_mutate" ON public.projects;
CREATE POLICY "projects_superadmin_all" ON public.projects FOR ALL USING (public.is_superadmin());
CREATE POLICY "projects_member_select" ON public.projects FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "projects_member_mutate" ON public.projects
  FOR ALL USING (public.get_user_tenant_role(auth.uid(), tenant_id) IN ('owner', 'admin', 'tenant_admin', 'project_manager'));

-- TASKS
DROP POLICY IF EXISTS "tasks_superadmin_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_member_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_member_mutate" ON public.tasks;
CREATE POLICY "tasks_superadmin_all" ON public.tasks FOR ALL USING (public.is_superadmin());
CREATE POLICY "tasks_member_select" ON public.tasks FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tasks_member_mutate" ON public.tasks FOR ALL USING (public.is_tenant_member(auth.uid(), tenant_id));

-- TASK_DEPENDENCIES
DROP POLICY IF EXISTS "deps_superadmin_all" ON public.task_dependencies;
DROP POLICY IF EXISTS "deps_member_select" ON public.task_dependencies;
DROP POLICY IF EXISTS "deps_member_mutate" ON public.task_dependencies;
CREATE POLICY "deps_superadmin_all" ON public.task_dependencies FOR ALL USING (public.is_superadmin());
CREATE POLICY "deps_member_select" ON public.task_dependencies FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "deps_member_mutate" ON public.task_dependencies FOR ALL USING (public.is_tenant_member(auth.uid(), tenant_id));

-- WORKING_CALENDARS
DROP POLICY IF EXISTS "cal_superadmin_all" ON public.working_calendars;
DROP POLICY IF EXISTS "cal_member_select" ON public.working_calendars;
DROP POLICY IF EXISTS "cal_admin_mutate" ON public.working_calendars;
CREATE POLICY "cal_superadmin_all" ON public.working_calendars FOR ALL USING (public.is_superadmin());
CREATE POLICY "cal_member_select" ON public.working_calendars FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cal_admin_mutate" ON public.working_calendars
  FOR ALL USING (public.get_user_tenant_role(auth.uid(), tenant_id) IN ('owner', 'admin', 'tenant_admin'));

-- CALENDAR_HOLIDAYS
DROP POLICY IF EXISTS "hol_superadmin_all" ON public.calendar_holidays;
DROP POLICY IF EXISTS "hol_member_select" ON public.calendar_holidays;
DROP POLICY IF EXISTS "hol_admin_mutate" ON public.calendar_holidays;
CREATE POLICY "hol_superadmin_all" ON public.calendar_holidays FOR ALL USING (public.is_superadmin());
CREATE POLICY "hol_member_select" ON public.calendar_holidays FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "hol_admin_mutate" ON public.calendar_holidays
  FOR ALL USING (public.get_user_tenant_role(auth.uid(), tenant_id) IN ('owner', 'admin', 'tenant_admin'));

-- AUDIT_LOGS
DROP POLICY IF EXISTS "audit_superadmin_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_member_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_insert_system" ON public.audit_logs;
CREATE POLICY "audit_superadmin_all" ON public.audit_logs FOR ALL USING (public.is_superadmin());
CREATE POLICY "audit_member_select" ON public.audit_logs FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "audit_insert_system" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- PROJECT_BASELINES
DROP POLICY IF EXISTS "baselines_superadmin_all" ON public.project_baselines;
DROP POLICY IF EXISTS "baselines_member_select" ON public.project_baselines;
DROP POLICY IF EXISTS "baselines_member_mutate" ON public.project_baselines;
CREATE POLICY "baselines_superadmin_all" ON public.project_baselines FOR ALL USING (public.is_superadmin());
CREATE POLICY "baselines_member_select" ON public.project_baselines FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "baselines_member_mutate" ON public.project_baselines FOR ALL USING (public.is_tenant_member(auth.uid(), tenant_id));

-- TASK_BASELINE_SNAPSHOTS
DROP POLICY IF EXISTS "snapshots_superadmin_all" ON public.task_baseline_snapshots;
DROP POLICY IF EXISTS "snapshots_select" ON public.task_baseline_snapshots;
DROP POLICY IF EXISTS "snapshots_insert" ON public.task_baseline_snapshots;
CREATE POLICY "snapshots_superadmin_all" ON public.task_baseline_snapshots FOR ALL USING (public.is_superadmin());
CREATE POLICY "snapshots_select" ON public.task_baseline_snapshots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "snapshots_insert" ON public.task_baseline_snapshots FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- REMAINING TABLES
CREATE POLICY "assignees_superadmin_all" ON public.task_assignees FOR ALL USING (public.is_superadmin());
CREATE POLICY "assignees_member_all" ON public.task_assignees FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "notifs_superadmin_all" ON public.user_notifications FOR ALL USING (public.is_superadmin());
CREATE POLICY "notifs_own" ON public.user_notifications FOR ALL USING (recipient_id = auth.uid());
CREATE POLICY "tts_superadmin_all" ON public.tenant_task_statuses FOR ALL USING (public.is_superadmin());
CREATE POLICY "tts_member_select" ON public.tenant_task_statuses FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "ttp_superadmin_all" ON public.tenant_task_priorities FOR ALL USING (public.is_superadmin());
CREATE POLICY "ttp_member_select" ON public.tenant_task_priorities FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "ttt_superadmin_all" ON public.tenant_task_types FOR ALL USING (public.is_superadmin());
CREATE POLICY "ttt_member_select" ON public.tenant_task_types FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "trp_superadmin_all" ON public.tenant_role_permissions FOR ALL USING (public.is_superadmin());
CREATE POLICY "trp_member_select" ON public.tenant_role_permissions FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "themes_select_all" ON public.system_themes FOR SELECT USING (true);
CREATE POLICY "themes_superadmin_mutate" ON public.system_themes FOR ALL USING (public.is_superadmin());
CREATE POLICY "tto_superadmin_all" ON public.tenant_theme_overrides FOR ALL USING (public.is_superadmin());
CREATE POLICY "tto_member_select" ON public.tenant_theme_overrides FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ============ TRIGGERS ============

-- Profile auto-creation on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, is_superadmin, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    false,
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Audit trail trigger
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE public.audit_logs ALTER COLUMN actor_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.log_entity_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action text; v_entity_id uuid; v_tenant_id uuid; v_actor_id uuid; v_details jsonb;
BEGIN
  v_actor_id := auth.uid();
  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE'; v_entity_id := OLD.id; v_tenant_id := OLD.tenant_id;
    v_details := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE'; v_entity_id := NEW.id; v_tenant_id := NEW.tenant_id;
    v_details := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  ELSE
    v_action := 'INSERT'; v_entity_id := NEW.id; v_tenant_id := NEW.tenant_id;
    v_details := to_jsonb(NEW);
  END IF;
  INSERT INTO public.audit_logs (id, tenant_id, actor_id, action, entity_type, entity_id, details, created_at)
  VALUES (gen_random_uuid(), v_tenant_id, v_actor_id, v_action, TG_TABLE_NAME, v_entity_id, v_details, NOW());
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_tasks_mutation ON public.tasks;
CREATE TRIGGER audit_tasks_mutation AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_entity_mutation();

DROP TRIGGER IF EXISTS audit_projects_mutation ON public.projects;
CREATE TRIGGER audit_projects_mutation AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_entity_mutation();

DROP TRIGGER IF EXISTS audit_memberships_mutation ON public.tenant_memberships;
CREATE TRIGGER audit_memberships_mutation AFTER INSERT OR UPDATE OR DELETE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.log_entity_mutation();

-- ============ BASELINE LOCKING RPC ============

CREATE OR REPLACE FUNCTION public.lock_project_baseline(
  p_project_id uuid, p_baseline_name text, p_tenant_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_baseline_id uuid; v_tenant uuid;
BEGIN
  IF p_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.projects WHERE id = p_project_id;
  ELSE v_tenant := p_tenant_id;
  END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Project not found: %', p_project_id; END IF;
  v_baseline_id := gen_random_uuid();
  INSERT INTO public.project_baselines (id, project_id, tenant_id, name, snapshot_date, created_by, created_at)
  VALUES (v_baseline_id, p_project_id, v_tenant, p_baseline_name, CURRENT_DATE, auth.uid(), NOW());
  INSERT INTO public.task_baseline_snapshots (id, baseline_id, task_id, title, start_date, end_date, duration_days, progress, created_at)
  SELECT gen_random_uuid(), v_baseline_id, t.id, t.title, t.start_date, t.end_date, t.duration_days,
    COALESCE(t.progress, t.progress_percent, 0), NOW()
  FROM public.tasks t WHERE t.project_id = p_project_id;
  RETURN v_baseline_id;
END;
$$;
