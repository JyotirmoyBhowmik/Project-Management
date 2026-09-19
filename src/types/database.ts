// ==============================================================================
// src/types/database.ts
// Database Type Definitions matching exact PostgreSQL 16 & Supabase Schema
// ==============================================================================

export type UserTenantRole = 'owner' | 'admin' | 'project_manager' | 'member' | 'guest';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'completed' | 'blocked';
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

// Backward compatibility alias
export type TenantRole = UserTenantRole;
export type TenantStatus = 'active' | 'suspended' | 'trial';

export interface TenantBranding {
  primary_color?: string;
  logo_url?: string | null;
  theme_preset?: 'light' | 'dark' | 'navy' | 'monokai' | 'high-contrast';
  company_tagline?: string;
}

export interface WorkingCalendar {
  id?: string;
  tenant_id?: string;
  name?: string;
  description?: string | null;
  working_days: number[];
  weekend_days?: number[];
  week_start_day?: number;
  daily_working_hours?: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tenant_code?: string;
  // Alias for backward compatibility
  code?: string;
  logo_url?: string | null;
  domain?: string | null;
  is_active?: boolean;
  status?: TenantStatus;
  week_starts_on?: number; // 0=Sunday, 1=Monday
  weekend_days?: number[]; // e.g. [0, 6] or [5, 6]
  branding_json?: TenantBranding;
  feature_flags?: Record<string, boolean>;
  storage_quota_mb?: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_superadmin: boolean;
  theme_preference?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: UserTenantRole;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
  tenant?: Tenant;
  user?: UserProfile;
}

export interface TenantTeam {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  created_at: string;
}

export interface CalendarHoliday {
  id: string;
  tenant_id: string;
  calendar_id?: string;
  name: string;
  holiday_date?: string; // YYYY-MM-DD
  // Alias
  date?: string;
  is_recurring: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  code?: string;
  task_counter?: number;
  description: string | null;
  status: ProjectStatus;
  start_date: string; // YYYY-MM-DD
  target_end_date: string | null;
  calendar_id?: string | null;
  is_archived?: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectGuestAccess {
  id: string;
  project_id: string;
  tenant_id: string;
  email: string;
  user_id: string | null;
  access_level: 'view' | 'comment' | 'edit';
  created_at: string;
}

export interface ProjectPhase {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  sort_order: number;
  // Alias
  order_index?: number;
  color?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
}

export interface TaskAssignee {
  id?: string;
  task_id: string;
  user_id: string;
  allocation_percent?: number;
  allocated_hours_per_day?: number;
  role?: string;
  created_at?: string;
  user?: UserProfile;
}

export interface TaskDependency {
  id: string;
  tenant_id: string;
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  dep_type?: DependencyType;
  // Alias
  type?: DependencyType;
  dependency_type?: DependencyType;
  lag_days: number;
  created_at: string;
}

export type TaskConstraintType = 'asap' | 'must_start_on' | 'must_finish_on' | 'start_no_earlier_than';

export interface Task {
  id: string;
  tenant_id: string;
  project_id: string;
  phase_id: string | null;
  parent_task_id?: string | null;
  // Alias
  parent_id?: string | null;
  title: string;
  code?: string;
  task_code?: string;
  description: string | null;
  status: TaskStatus | string;
  priority: TaskPriority | string;
  task_type_id?: string | null;
  constraint_type?: TaskConstraintType;
  constraint_date?: string | null;
  version?: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  duration_days: number;
  progress?: number;   // 0-100
  // Alias
  progress_percent?: number;
  is_milestone: boolean;
  sort_order?: number;
  order_index?: number;
  // Computed CPM Attributes
  early_start: string | null;
  early_finish: string | null;
  late_start: string | null;
  late_finish: string | null;
  total_float: number;
  free_float?: number;
  is_critical: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Phase 5 Fields
  sprint_id?: string | null;
  story_points?: number | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  sla_status?: 'ok' | 'warning' | 'breached';
  // Relations & Dynamic Custom Fields
  assignees?: TaskAssignee[];
  predecessors?: TaskDependency[];
  successors?: TaskDependency[];
  subtasks?: Task[];
  custom_field_values?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SECURITY_OVERRIDE';
  entity_type: string;
  entity_id: string;
  details?: Record<string, unknown> | null;
  diff_before: Record<string, unknown> | null;
  diff_after: Record<string, unknown> | null;
  correlation_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  actor?: UserProfile;
}

// ------------------------------------------------------------------------------
// Phase 2: Dynamic Metadata, Theming, Custom Fields, Baselines & Notifications
// ------------------------------------------------------------------------------

export interface TenantTaskStatus {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  color_hex: string;
  badge_variant: string;
  position: number;
  is_closed_state: boolean;
  is_default: boolean;
  created_at?: string;
}

export interface TenantTaskPriority {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  color_hex: string;
  urgency_weight: number;
  sla_response_hours?: number;
  icon_key: string;
  is_default: boolean;
  created_at?: string;
}

export interface TenantTaskType {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  icon_key: string;
  is_default: boolean;
  created_at?: string;
}

export interface ThemeTokens {
  background: string;
  foreground: string;
  card: string;
  card_foreground: string;
  popover: string;
  popover_foreground: string;
  primary: string;
  primary_foreground: string;
  secondary: string;
  secondary_foreground: string;
  muted: string;
  muted_foreground: string;
  accent: string;
  accent_foreground: string;
  destructive: string;
  destructive_foreground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
  critical_path: string;
  non_working_day: string;
  holiday_day: string;
}

export interface SystemTheme {
  id: string;
  name: string;
  description?: string | null;
  tokens_json: ThemeTokens;
  is_system_default?: boolean;
  created_at?: string;
}

export interface TenantThemeOverride {
  id: string;
  tenant_id: string;
  active_theme_id?: string | null;
  custom_tokens_json: Partial<ThemeTokens>;
  created_at?: string;
  updated_at?: string;
}

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'multiselect'
  | 'user_reference'
  | 'checkbox'
  | 'formula';

export interface TenantCustomField {
  id: string;
  tenant_id: string;
  entity_type: 'project' | 'task';
  field_name: string;
  field_key: string;
  field_type: CustomFieldType;
  options_json?: Array<string | { label: string; value: string }>;
  is_required: boolean;
  sort_order: number;
  created_at?: string;
}

export interface EntityCustomFieldValue {
  id: string;
  tenant_id: string;
  entity_id: string;
  field_id: string;
  value_json: unknown;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectBaseline {
  id: string;
  project_id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  version?: string;
  snapshot_date?: string;
  created_by?: string | null;
  created_at: string;
}

export interface TaskBaselineSnapshot {
  id: string;
  baseline_id: string;
  task_id: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  progress: number;
  created_at?: string;
}

export interface UserNotification {
  id: string;
  tenant_id: string;
  recipient_id: string;
  actor_id?: string | null;
  event_type: 'task_assigned' | 'due_soon' | 'dependency_blocked' | 'mention' | 'guest_invite' | string;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  is_read: boolean;
  created_at: string;
  actor?: UserProfile;
}

export interface TenantRolePermission {
  id: string;
  tenant_id: string;
  role: string;
  permission_key: string;
  is_granted: boolean;
  created_at?: string;
}

// ------------------------------------------------------------------------------
// Phase 4: Task Comments, Activity Stream, Attachments & System Health Audit
// ------------------------------------------------------------------------------

export interface TaskComment {
  id: string;
  tenant_id: string;
  task_id: string;
  user_id: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
  author?: UserProfile;
}

export interface TaskActivityLog {
  id: string;
  tenant_id: string;
  task_id: string;
  actor_id: string | null;
  action_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: UserProfile;
}

export interface TaskAttachment {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  uploader?: UserProfile;
  signed_url?: string;
}

export interface SystemHealthCheckResult {
  status: 'PASS' | 'WARN' | 'FAIL';
  latency_ms?: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface SystemHealthAuditReport {
  timestamp: string;
  overall_status: 'PASS' | 'WARN' | 'FAIL';
  checks: {
    database: SystemHealthCheckResult;
    rls_isolation: SystemHealthCheckResult;
    storage_bucket: SystemHealthCheckResult;
    orphan_records: SystemHealthCheckResult;
  };
  metrics: {
    tenants_count: number;
    projects_count: number;
    tasks_count: number;
    attachments_count: number;
    active_realtime_connections?: number;
  };
}

// ------------------------------------------------------------------------------
// Phase 5: Financial Budgets & EVM, Agile Sprints, No-Code Automations,
// Living Documentation (Wiki), Universal Soft-Delete & Governance
// ------------------------------------------------------------------------------

export interface TenantUserRate {
  id: string;
  tenant_id: string;
  user_id: string;
  hourly_cost_rate: number;
  hourly_billable_rate: number;
  effective_from: string;
  created_at: string;
  updated_at: string;
  user?: UserProfile;
}

export interface ProjectBudget {
  id: string;
  tenant_id: string;
  project_id: string;
  total_planned_budget: number;
  currency: string;
  budget_type: 'fixed' | 'time_and_materials';
  created_at: string;
  updated_at: string;
}

export type TimeLogApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface TaskTimeLog {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id: string;
  user_id: string;
  date_worked: string; // YYYY-MM-DD
  hours_spent: number;
  is_billable: boolean;
  description: string | null;
  approval_status: TimeLogApprovalStatus;
  approved_by: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  user?: UserProfile;
  task?: Task;
}

export interface EVMMetrics {
  planned_value: number;       // PV
  earned_value: number;        // EV
  actual_cost: number;         // AC
  cost_variance: number;       // CV = EV - AC
  schedule_variance: number;   // SV = EV - PV
  cpi: number;                 // CPI = EV / AC
  spi: number;                 // SPI = EV / PV
  budget_at_completion: number;// BAC
  estimate_at_completion: number; // EAC = BAC / CPI
  estimate_to_complete: number;   // ETC = EAC - AC
  variance_at_completion: number; // VAC = BAC - EAC
  total_hours_logged: number;
  billable_hours_logged: number;
}

export type SprintStatus = 'planning' | 'active' | 'completed';

export interface ProjectSprint {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  sprint_goal?: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  created_at: string;
  updated_at: string;
  tasks?: Task[];
  total_story_points?: number;
  completed_story_points?: number;
}

export interface SprintBurndownPoint {
  date: string;
  ideal_remaining: number;
  actual_remaining: number;
}

export interface SprintBurnupPoint {
  date: string;
  total_scope: number;
  completed_points: number;
}

export interface CumulativeFlowPoint {
  date: string;
  todo: number;
  in_progress: number;
  in_review: number;
  completed: number;
}

export interface AgileSprintMetrics {
  sprint: ProjectSprint;
  burndown: SprintBurndownPoint[];
  burnup: SprintBurnupPoint[];
  cfd: CumulativeFlowPoint[];
  velocity_history: Array<{ sprint_name: string; points: number }>;
}

export interface TenantAutomation {
  id: string;
  tenant_id: string;
  project_id?: string | null;
  name: string;
  is_active: boolean;
  trigger_type: 'task_status_changed' | 'task_created' | 'due_date_approaching' | 'dependency_cleared';
  trigger_config: Record<string, unknown>;
  conditions: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'contains' | 'is_empty';
    value: unknown;
  }>;
  actions: Array<{
    action_type: 'update_field' | 'assign_user' | 'dispatch_webhook' | 'create_subtask';
    payload: Record<string, unknown>;
  }>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationExecutionLog {
  id: string;
  tenant_id: string;
  automation_id: string;
  triggered_at: string;
  status: 'success' | 'failed' | 'skipped';
  log_details: Record<string, unknown>;
}

export interface TenantWebhook {
  id: string;
  tenant_id: string;
  target_url: string;
  secret_hash: string;
  subscribed_events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocument {
  id: string;
  tenant_id: string;
  project_id: string;
  parent_doc_id?: string | null;
  title: string;
  content_json: Record<string, unknown>;
  sort_order: number;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
  updated_at: string;
  author?: UserProfile;
  children?: ProjectDocument[];
  linked_tasks?: Task[];
}

export interface DocumentTaskLink {
  doc_id: string;
  task_id: string;
  tenant_id: string;
  created_at: string;
  task?: Task;
  document?: ProjectDocument;
}

export interface SoftDeletedItem {
  id: string;
  entity_type: 'task' | 'project' | 'phase' | 'document';
  title: string;
  code?: string;
  deleted_at: string;
  deleted_by?: string | null;
  deleter_name?: string;
  tenant_id: string;
  project_id?: string;
  project_name?: string;
}


