-- ==============================================================================
-- supabase/migrations/00012_phase5_graphify_finance_agile_wiki_trash.sql
-- Phase 5: Financial Budgets & EVM, Agile Sprints, No-Code Automations,
-- Living Documentation (Wiki), Universal Soft-Delete & Governance
-- ==============================================================================

-- 1. Universal Soft-Delete Schema Updates
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_points integer DEFAULT NULL;

ALTER TABLE public.phases 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. Financial Rates & Budgets Engine
CREATE TABLE IF NOT EXISTS public.tenant_user_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hourly_cost_rate numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (hourly_cost_rate >= 0),
  hourly_billable_rate numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (hourly_billable_rate >= 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, effective_from)
);

CREATE TABLE IF NOT EXISTS public.project_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  total_planned_budget numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_planned_budget >= 0),
  currency text NOT NULL DEFAULT 'USD',
  budget_type text NOT NULL DEFAULT 'fixed' CHECK (budget_type IN ('fixed', 'time_and_materials')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_worked date NOT NULL DEFAULT CURRENT_DATE,
  hours_spent numeric(6,2) NOT NULL CHECK (hours_spent > 0),
  is_billable boolean NOT NULL DEFAULT true,
  description text,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_task ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_date ON public.task_time_logs(user_id, date_worked);
CREATE INDEX IF NOT EXISTS idx_time_logs_project ON public.task_time_logs(project_id);

-- 3. Agile & Sprint Framework
CREATE TABLE IF NOT EXISTS public.project_sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sprint_goal text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES public.project_sprints(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON public.tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprints_project ON public.project_sprints(project_id);

-- 4. No-Code Workflow Automations & Webhooks
CREATE TABLE IF NOT EXISTS public.tenant_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.tenant_automations(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  log_details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.tenant_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  secret_hash text NOT NULL,
  subscribed_events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automations_tenant ON public.tenant_automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_logs_auto ON public.automation_execution_logs(automation_id);

-- 5. Project Living Documentation (Wiki)
CREATE TABLE IF NOT EXISTS public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_doc_id uuid REFERENCES public.project_documents(id) ON DELETE CASCADE,
  title text NOT NULL,
  content_json jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz DEFAULT NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_task_links (
  doc_id uuid NOT NULL REFERENCES public.project_documents(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_docs_project ON public.project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_docs_parent ON public.project_documents(parent_doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_links_task ON public.document_task_links(task_id);

-- 6. Helper RPCs for Recycle Bin Recovery & Purge
CREATE OR REPLACE FUNCTION public.restore_soft_deleted_entity(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_entity_type = 'task' THEN
    UPDATE public.tasks SET deleted_at = NULL, deleted_by = NULL WHERE id = p_entity_id;
    RETURN FOUND;
  ELSIF p_entity_type = 'project' THEN
    UPDATE public.projects SET deleted_at = NULL, deleted_by = NULL WHERE id = p_entity_id;
    RETURN FOUND;
  ELSIF p_entity_type = 'phase' THEN
    UPDATE public.phases SET deleted_at = NULL, deleted_by = NULL WHERE id = p_entity_id;
    RETURN FOUND;
  ELSIF p_entity_type = 'document' THEN
    UPDATE public.project_documents SET deleted_at = NULL, deleted_by = NULL WHERE id = p_entity_id;
    RETURN FOUND;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_soft_deleted_records(
  p_retention_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - (p_retention_days || ' days')::interval;
  v_purged integer := 0;
  v_cnt integer := 0;
BEGIN
  -- 1. Purge documents
  DELETE FROM public.project_documents WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_purged := v_purged + v_cnt;

  -- 2. Purge tasks
  DELETE FROM public.tasks WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_purged := v_purged + v_cnt;

  -- 3. Purge projects
  DELETE FROM public.projects WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_purged := v_purged + v_cnt;

  RETURN v_purged;
END;
$$;

-- 7. Enable RLS and Configure Multi-Tenant Policies
ALTER TABLE public.tenant_user_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_task_links ENABLE ROW LEVEL SECURITY;

-- Tenant User Rates Policies
DROP POLICY IF EXISTS "Rates tenant read" ON public.tenant_user_rates;
CREATE POLICY "Rates tenant read" ON public.tenant_user_rates
FOR SELECT TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Rates admin mutate" ON public.tenant_user_rates;
CREATE POLICY "Rates admin mutate" ON public.tenant_user_rates
FOR ALL TO authenticated
USING (
  public.is_superadmin() OR
  EXISTS (
    SELECT 1 FROM public.tenant_memberships 
    WHERE tenant_id = tenant_user_rates.tenant_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'project_manager')
  )
);

-- Project Budgets Policies
DROP POLICY IF EXISTS "Budgets tenant read" ON public.project_budgets;
CREATE POLICY "Budgets tenant read" ON public.project_budgets
FOR SELECT TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Budgets admin mutate" ON public.project_budgets;
CREATE POLICY "Budgets admin mutate" ON public.project_budgets
FOR ALL TO authenticated
USING (
  public.is_superadmin() OR
  EXISTS (
    SELECT 1 FROM public.tenant_memberships 
    WHERE tenant_id = project_budgets.tenant_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'project_manager')
  )
);

-- Task Time Logs Policies
DROP POLICY IF EXISTS "Time logs tenant read" ON public.task_time_logs;
CREATE POLICY "Time logs tenant read" ON public.task_time_logs
FOR SELECT TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Time logs user mutate" ON public.task_time_logs;
CREATE POLICY "Time logs user mutate" ON public.task_time_logs
FOR INSERT TO authenticated
WITH CHECK (
  public.is_superadmin() OR
  (user_id = auth.uid() AND tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Time logs user update" ON public.task_time_logs;
CREATE POLICY "Time logs user update" ON public.task_time_logs
FOR UPDATE TO authenticated
USING (
  public.is_superadmin() OR
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.tenant_memberships 
    WHERE tenant_id = task_time_logs.tenant_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'project_manager')
  )
);

-- Project Sprints Policies
DROP POLICY IF EXISTS "Sprints tenant read" ON public.project_sprints;
CREATE POLICY "Sprints tenant read" ON public.project_sprints
FOR SELECT TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Sprints manager mutate" ON public.project_sprints;
CREATE POLICY "Sprints manager mutate" ON public.project_sprints
FOR ALL TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

-- Automations Policies
DROP POLICY IF EXISTS "Automations tenant read" ON public.tenant_automations;
CREATE POLICY "Automations tenant read" ON public.tenant_automations
FOR SELECT TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Automations admin mutate" ON public.tenant_automations;
CREATE POLICY "Automations admin mutate" ON public.tenant_automations
FOR ALL TO authenticated
USING (
  public.is_superadmin() OR
  EXISTS (
    SELECT 1 FROM public.tenant_memberships 
    WHERE tenant_id = tenant_automations.tenant_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'project_manager')
  )
);

-- Automation Logs Policies
DROP POLICY IF EXISTS "Auto logs tenant read" ON public.automation_execution_logs;
CREATE POLICY "Auto logs tenant read" ON public.automation_execution_logs
FOR SELECT TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

-- Webhooks Policies
DROP POLICY IF EXISTS "Webhooks admin mutate" ON public.tenant_webhooks;
CREATE POLICY "Webhooks admin mutate" ON public.tenant_webhooks
FOR ALL TO authenticated
USING (
  public.is_superadmin() OR
  EXISTS (
    SELECT 1 FROM public.tenant_memberships 
    WHERE tenant_id = tenant_webhooks.tenant_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  )
);

-- Project Documents Policies
DROP POLICY IF EXISTS "Documents tenant read" ON public.project_documents;
CREATE POLICY "Documents tenant read" ON public.project_documents
FOR SELECT TO authenticated
USING (
  public.is_superadmin() OR
  (
    tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
    AND (deleted_at IS NULL OR EXISTS (
      SELECT 1 FROM public.tenant_memberships 
      WHERE tenant_id = project_documents.tenant_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    ))
  )
);

DROP POLICY IF EXISTS "Documents member mutate" ON public.project_documents;
CREATE POLICY "Documents member mutate" ON public.project_documents
FOR ALL TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);

-- Document Task Links Policies
DROP POLICY IF EXISTS "Doc links tenant read" ON public.document_task_links;
CREATE POLICY "Doc links tenant read" ON public.document_task_links
FOR ALL TO authenticated
USING (
  public.is_superadmin() OR
  tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
);
