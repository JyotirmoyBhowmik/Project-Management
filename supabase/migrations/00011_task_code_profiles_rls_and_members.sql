-- ==============================================================================
-- 00011_task_code_profiles_rls_and_members.sql
-- Auto-Generated Task Codes, Cross-Tenant Profiles Visibility, get_tenant_members RPC,
-- and Robust Task INSERT/UPDATE/DELETE RLS Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Auto-Generated Human-Readable Task Codes
-- ------------------------------------------------------------------------------

-- Add task_code column to tasks if missing
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_code text;

-- Add task_counter column to projects if missing
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS task_counter integer DEFAULT 0;

-- Create index for fast task_code lookup
CREATE INDEX IF NOT EXISTS idx_tasks_project_task_code ON public.tasks (project_id, task_code);

-- Thread-safe PostgreSQL trigger function to auto-generate enterprise task code
CREATE OR REPLACE FUNCTION public.generate_task_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counter integer;
  v_prefix text;
BEGIN
  -- If task_code is not explicitly provided, generate one
  IF NEW.task_code IS NULL OR trim(NEW.task_code) = '' THEN
    UPDATE public.projects
    SET task_counter = COALESCE(task_counter, 0) + 1
    WHERE id = NEW.project_id
    RETURNING task_counter, COALESCE(NULLIF(trim(code), ''), UPPER(SUBSTRING(name FROM 1 FOR 4)), 'PRJ')
    INTO v_counter, v_prefix;

    IF v_counter IS NOT NULL THEN
      -- Clean prefix (strip non-alphanumeric, uppercase)
      v_prefix := regexp_replace(upper(v_prefix), '[^A-Z0-9]', '', 'g');
      IF length(v_prefix) = 0 THEN
        v_prefix := 'TASK';
      END IF;
      NEW.task_code := v_prefix || '-' || LPAD(v_counter::text, 3, '0');
    ELSE
      -- Fallback if project is somehow not matched
      NEW.task_code := 'TASK-' || LPAD(floor(random() * 900 + 100)::text, 3, '0');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_task_code ON public.tasks;
CREATE TRIGGER trg_generate_task_code
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.generate_task_code();

-- Backfill existing tasks with sequential task codes
DO $$
DECLARE
  r record;
  r_task record;
  v_cnt integer;
  v_pfx text;
BEGIN
  FOR r IN SELECT DISTINCT project_id FROM public.tasks WHERE task_code IS NULL OR trim(task_code) = '' LOOP
    v_cnt := 0;
    SELECT COALESCE(NULLIF(trim(code), ''), UPPER(SUBSTRING(name FROM 1 FOR 4)), 'PRJ') INTO v_pfx
    FROM public.projects WHERE id = r.project_id;
    v_pfx := regexp_replace(upper(COALESCE(v_pfx, 'PRJ')), '[^A-Z0-9]', '', 'g');
    IF length(v_pfx) = 0 THEN v_pfx := 'PRJ'; END IF;

    FOR r_task IN SELECT id FROM public.tasks WHERE project_id = r.project_id AND (task_code IS NULL OR trim(task_code) = '') ORDER BY created_at, id LOOP
      v_cnt := v_cnt + 1;
      UPDATE public.tasks SET task_code = v_pfx || '-' || LPAD(v_cnt::text, 3, '0') WHERE id = r_task.id;
    END LOOP;

    UPDATE public.projects SET task_counter = GREATEST(COALESCE(task_counter, 0), v_cnt) WHERE id = r.project_id;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Cross-Tenant Profiles Visibility RLS Policy
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Profiles visibility" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;

CREATE POLICY "Profiles visibility" ON public.profiles FOR SELECT
USING (
    auth.uid() = id
    OR public.is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.tenant_memberships tm1
        JOIN public.tenant_memberships tm2 ON tm1.tenant_id = tm2.tenant_id
        WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
    )
);

-- Allow tenant members to view other memberships in their workspace
DROP POLICY IF EXISTS "memberships_same_tenant_select" ON public.tenant_memberships;
CREATE POLICY "memberships_same_tenant_select" ON public.tenant_memberships FOR SELECT
USING (
    public.is_superadmin()
    OR user_id = auth.uid()
    OR public.is_tenant_member(auth.uid(), tenant_id)
);

-- ------------------------------------------------------------------------------
-- 3. Security Definer RPC for Tenant Members
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_tenant_members(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    tm.role::text
  FROM public.tenant_memberships tm
  JOIN public.profiles p ON p.id = tm.user_id
  WHERE tm.tenant_id = p_tenant_id
    AND tm.is_active = true
  ORDER BY p.full_name ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_members(uuid) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- 4. Tasks INSERT / UPDATE / DELETE RLS Policies
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_member_mutate" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
DROP POLICY IF EXISTS "Users update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users delete tasks" ON public.tasks;

CREATE POLICY "Users insert tasks" ON public.tasks FOR INSERT
WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.tenant_memberships
        WHERE tenant_id = tasks.tenant_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'tenant_admin', 'project_manager', 'member')
    )
);

CREATE POLICY "Users update tasks" ON public.tasks FOR UPDATE
USING (
    public.is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.tenant_memberships
        WHERE tenant_id = tasks.tenant_id
          AND user_id = auth.uid()
    )
);

CREATE POLICY "Users delete tasks" ON public.tasks FOR DELETE
USING (
    public.is_superadmin()
    OR EXISTS (
        SELECT 1 FROM public.tenant_memberships
        WHERE tenant_id = tasks.tenant_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'tenant_admin', 'project_manager')
    )
);
