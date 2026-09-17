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
