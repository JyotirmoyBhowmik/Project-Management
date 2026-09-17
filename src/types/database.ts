// ==============================================================================
// Database Type Definitions
// Corresponds directly with Supabase PostgreSQL 16 schema
// ==============================================================================

export type TenantRole = 'superadmin' | 'tenant_admin' | 'project_manager' | 'contributor' | 'guest';
export type TenantStatus = 'active' | 'suspended' | 'trial';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

export interface TenantBranding {
  primary_color?: string;
  logo_url?: string | null;
  theme_preset?: 'light' | 'dark' | 'navy' | 'monokai' | 'high-contrast';
  company_tagline?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  code: string;
  domain: string | null;
  status: TenantStatus;
  branding_json: TenantBranding;
  feature_flags: Record<string, boolean>;
  storage_quota_mb: number;
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
  updated_at: string;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantRole;
  is_active: boolean;
  invited_by?: string | null;
  created_at: string;
  updated_at: string;
  tenant?: Tenant;
  user?: UserProfile;
}

export interface Team {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface WorkingCalendar {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  week_start_day: number; // 0=Sunday, 1=Monday
  working_days: number[]; // e.g. [1, 2, 3, 4, 5]
  daily_working_hours: number;
  created_at: string;
  updated_at: string;
}

export interface CalendarHoliday {
  id: string;
  tenant_id: string;
  calendar_id: string;
  name: string;
  date: string; // YYYY-MM-DD
  is_recurring: boolean;
  floating_rule?: Record<string, unknown> | null;
  created_at: string;
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string; // YYYY-MM-DD
  target_end_date: string | null;
  calendar_id: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  tenant_id: string;
  project_id: string;
  user_id: string;
  role: 'lead' | 'editor' | 'viewer' | 'guest';
  created_at: string;
  user?: UserProfile;
}

export interface Phase {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  order_index: number;
  color: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface TaskAssignment {
  id: string;
  tenant_id: string;
  task_id: string;
  user_id: string | null;
  team_id: string | null;
  effort_percent: number;
  created_at: string;
  user?: UserProfile;
  team?: Team;
}

export interface TaskDependency {
  id: string;
  tenant_id: string;
  project_id: string;
  predecessor_id: string;
  successor_id: string;
  type: DependencyType;
  lag_days: number;
  created_at: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  project_id: string;
  phase_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  duration_days: number;
  progress_percent: number;
  is_milestone: boolean;
  // CPM Attributes
  early_start: string | null;
  early_finish: string | null;
  late_start: string | null;
  late_finish: string | null;
  total_float: number;
  free_float: number;
  is_critical: boolean;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Optional relations hydrated in queries
  assignments?: TaskAssignment[];
  predecessors?: TaskDependency[];
  successors?: TaskDependency[];
  subtasks?: Task[];
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
