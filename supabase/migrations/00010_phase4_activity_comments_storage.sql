-- ==============================================================================
-- Migration: 00010_phase4_activity_comments_storage.sql
-- Phase 4: Task Comments, Activity Log, Attachments & Storage Bucket Configuration
-- ==============================================================================

-- 1. Table: public.task_comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_comments_tenant_id ON public.task_comments(tenant_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_comments_superadmin_all" ON public.task_comments;
CREATE POLICY "task_comments_superadmin_all" ON public.task_comments FOR ALL USING (public.is_superadmin());

DROP POLICY IF EXISTS "task_comments_member_select" ON public.task_comments;
CREATE POLICY "task_comments_member_select" ON public.task_comments FOR SELECT USING (
  public.is_tenant_member(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "task_comments_member_insert" ON public.task_comments;
CREATE POLICY "task_comments_member_insert" ON public.task_comments FOR INSERT WITH CHECK (
  public.is_tenant_member(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "task_comments_author_update" ON public.task_comments;
CREATE POLICY "task_comments_author_update" ON public.task_comments FOR UPDATE USING (
  user_id = auth.uid() OR public.is_superadmin()
);

DROP POLICY IF EXISTS "task_comments_delete" ON public.task_comments;
CREATE POLICY "task_comments_delete" ON public.task_comments FOR DELETE USING (
  user_id = auth.uid()
  OR public.is_superadmin()
  OR public.get_user_tenant_role(auth.uid(), tenant_id) IN ('owner', 'admin')
);

-- 2. Table: public.task_activity_log
CREATE TABLE IF NOT EXISTS public.task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON public.task_activity_log(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_tenant_id ON public.task_activity_log(tenant_id);

ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_activity_log_superadmin_all" ON public.task_activity_log;
CREATE POLICY "task_activity_log_superadmin_all" ON public.task_activity_log FOR ALL USING (public.is_superadmin());

DROP POLICY IF EXISTS "task_activity_log_member_select" ON public.task_activity_log;
CREATE POLICY "task_activity_log_member_select" ON public.task_activity_log FOR SELECT USING (
  public.is_tenant_member(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "task_activity_log_member_insert" ON public.task_activity_log;
CREATE POLICY "task_activity_log_member_insert" ON public.task_activity_log FOR INSERT WITH CHECK (
  public.is_tenant_member(auth.uid(), tenant_id) OR public.is_superadmin() OR auth.uid() IS NULL
);

-- 3. Table: public.task_attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_project_id ON public.task_attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_tenant_id ON public.task_attachments(tenant_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_attachments_superadmin_all" ON public.task_attachments;
CREATE POLICY "task_attachments_superadmin_all" ON public.task_attachments FOR ALL USING (public.is_superadmin());

DROP POLICY IF EXISTS "task_attachments_member_select" ON public.task_attachments;
CREATE POLICY "task_attachments_member_select" ON public.task_attachments FOR SELECT USING (
  public.is_tenant_member(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "task_attachments_member_insert" ON public.task_attachments;
CREATE POLICY "task_attachments_member_insert" ON public.task_attachments FOR INSERT WITH CHECK (
  public.is_tenant_member(auth.uid(), tenant_id)
);

DROP POLICY IF EXISTS "task_attachments_member_delete" ON public.task_attachments;
CREATE POLICY "task_attachments_member_delete" ON public.task_attachments FOR DELETE USING (
  uploaded_by = auth.uid()
  OR public.is_superadmin()
  OR public.get_user_tenant_role(auth.uid(), tenant_id) IN ('owner', 'admin')
);

-- 4. Supabase Storage Bucket: task-attachments (Private, 25MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-attachments', 'task-attachments', false, 26214400, null)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400;

-- 5. Storage RLS on storage.objects
DROP POLICY IF EXISTS "task_attachments_storage_select" ON storage.objects;
CREATE POLICY "task_attachments_storage_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'task-attachments'
  AND (
    public.is_superadmin()
    OR (
      split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND public.is_tenant_member(auth.uid(), split_part(name, '/', 1)::uuid)
    )
  )
);

DROP POLICY IF EXISTS "task_attachments_storage_insert" ON storage.objects;
CREATE POLICY "task_attachments_storage_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'task-attachments'
  AND (
    public.is_superadmin()
    OR (
      split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND public.is_tenant_member(auth.uid(), split_part(name, '/', 1)::uuid)
    )
  )
);

DROP POLICY IF EXISTS "task_attachments_storage_update" ON storage.objects;
CREATE POLICY "task_attachments_storage_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'task-attachments'
  AND (
    public.is_superadmin()
    OR (
      split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND public.is_tenant_member(auth.uid(), split_part(name, '/', 1)::uuid)
    )
  )
);

DROP POLICY IF EXISTS "task_attachments_storage_delete" ON storage.objects;
CREATE POLICY "task_attachments_storage_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'task-attachments'
  AND (
    public.is_superadmin()
    OR (
      split_part(name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND public.is_tenant_member(auth.uid(), split_part(name, '/', 1)::uuid)
    )
  )
);
