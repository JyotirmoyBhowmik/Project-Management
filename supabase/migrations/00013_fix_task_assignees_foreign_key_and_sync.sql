-- ==============================================================================
-- Migration 00013: Fix task_assignees Foreign Key, Sync Profiles & Backfill
-- Resolves PGRST200 "Could not find a relationship between 'tasks' and 'task_assignees'"
-- ==============================================================================

-- 1. Ensure all user profiles are mirrored into public.profiles
INSERT INTO public.profiles (id, email, full_name, avatar_url, is_superadmin)
SELECT id, email, full_name, avatar_url, false
FROM public.user_profiles
ON CONFLICT (id) DO UPDATE 
SET email = EXCLUDED.email, 
    full_name = EXCLUDED.full_name;

-- 2. Drop the incorrect foreign key referencing tasks_v2 on task_assignees
ALTER TABLE public.task_assignees 
  DROP CONSTRAINT IF EXISTS task_assignees_task_id_fkey;

-- 3. Add the correct foreign key referencing public.tasks(id)
ALTER TABLE public.task_assignees 
  ADD CONSTRAINT task_assignees_task_id_fkey 
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

-- 4. Add missing columns to task_assignees
ALTER TABLE public.task_assignees 
  ADD COLUMN IF NOT EXISTS allocated_hours_per_day NUMERIC DEFAULT 8.0,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Assignee',
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 5. Backfill existing assignments from task_assignments into task_assignees (deduplicated)
INSERT INTO public.task_assignees (task_id, user_id, allocation_percent, allocated_hours_per_day, role, tenant_id)
SELECT DISTINCT ON (ta.task_id, ta.user_id)
  ta.task_id, 
  ta.user_id, 
  COALESCE(ta.effort_percent::integer, 100), 
  8.0, 
  'Assignee', 
  t.tenant_id
FROM public.task_assignments ta
JOIN public.tasks t ON t.id = ta.task_id
WHERE ta.user_id IS NOT NULL
ORDER BY ta.task_id, ta.user_id, ta.created_at DESC
ON CONFLICT (task_id, user_id) DO UPDATE
SET allocation_percent = EXCLUDED.allocation_percent,
    tenant_id = EXCLUDED.tenant_id;

-- 6. Configure robust RLS policies on task_assignees
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignees_member_all" ON public.task_assignees;
DROP POLICY IF EXISTS "assignees_superadmin_all" ON public.task_assignees;
DROP POLICY IF EXISTS "assignees_select_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "assignees_insert_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "assignees_update_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "assignees_delete_policy" ON public.task_assignees;

CREATE POLICY "assignees_select_policy" ON public.task_assignees
  FOR SELECT USING (auth.uid() IS NOT NULL OR is_superadmin());

CREATE POLICY "assignees_insert_policy" ON public.task_assignees
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR is_superadmin());

CREATE POLICY "assignees_update_policy" ON public.task_assignees
  FOR UPDATE USING (auth.uid() IS NOT NULL OR is_superadmin());

CREATE POLICY "assignees_delete_policy" ON public.task_assignees
  FOR DELETE USING (auth.uid() IS NOT NULL OR is_superadmin());

-- 7. Reload PostgREST schema cache so the foreign key relationship is immediately recognized
NOTIFY pgrst, 'reload schema';
