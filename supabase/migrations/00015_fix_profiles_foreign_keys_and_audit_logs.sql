-- ==============================================================================
-- Migration 00015: Fix Profiles Foreign Keys & Unify Database Relationships
-- Resolves "Could not find a relationship between 'tenant_memberships' and 'profiles'"
-- and "Could not find a relationship between 'audit_logs' and 'profiles'"
-- ==============================================================================

-- 1. Ensure system user exists in profiles for system audit events
INSERT INTO public.profiles (id, email, full_name, is_superadmin)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@pms.internal', 'System Automation Engine', true)
ON CONFLICT (id) DO UPDATE
SET is_superadmin = true;

-- 2. Sync all user_profiles into profiles
INSERT INTO public.profiles (id, email, full_name, avatar_url, is_superadmin)
SELECT id, email, full_name, avatar_url, is_superadmin
FROM public.user_profiles
ON CONFLICT (id) DO UPDATE 
SET email = EXCLUDED.email, 
    full_name = EXCLUDED.full_name;

-- 3. Update foreign key constraints on tenant_memberships to reference public.profiles
ALTER TABLE public.tenant_memberships 
  DROP CONSTRAINT IF EXISTS tenant_memberships_user_id_fkey;

ALTER TABLE public.tenant_memberships 
  ADD CONSTRAINT tenant_memberships_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.tenant_memberships 
  DROP CONSTRAINT IF EXISTS tenant_memberships_invited_by_fkey;

ALTER TABLE public.tenant_memberships 
  ADD CONSTRAINT tenant_memberships_invited_by_fkey 
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Update foreign key constraints on audit_logs to reference public.profiles
ALTER TABLE public.audit_logs 
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

ALTER TABLE public.audit_logs 
  ADD CONSTRAINT audit_logs_actor_id_fkey 
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. Update foreign keys on other tables to reference public.profiles
ALTER TABLE public.team_members 
  DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
ALTER TABLE public.team_members 
  ADD CONSTRAINT team_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.projects 
  DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE public.projects 
  ADD CONSTRAINT projects_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.project_members 
  DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
ALTER TABLE public.project_members 
  ADD CONSTRAINT project_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.tasks 
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.tasks 
  ADD CONSTRAINT tasks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.task_assignments 
  DROP CONSTRAINT IF EXISTS task_assignments_user_id_fkey;
ALTER TABLE public.task_assignments 
  ADD CONSTRAINT task_assignments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
