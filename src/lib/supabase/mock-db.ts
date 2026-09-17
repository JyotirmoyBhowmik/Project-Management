// ==============================================================================
// src/lib/supabase/mock-db.ts
// Enterprise In-Memory Database Adapter & Fallback Provider
// Aligned with exact migrations 00001 - 00007 and security definer functions.
// ==============================================================================

import {
  Tenant,
  UserProfile,
  TenantMembership,
  WorkingCalendar,
  CalendarHoliday,
  Project,
  ProjectGuestAccess,
  ProjectPhase,
  Task,
  TaskAssignee,
  TaskDependency,
  AuditLog,
  TenantTeam,
  TeamMember,
  TenantTaskStatus,
  TenantTaskPriority,
  TenantTaskType,
  SystemTheme,
  TenantThemeOverride,
  TenantCustomField,
  EntityCustomFieldValue,
  ProjectBaseline,
  TaskBaselineSnapshot,
  UserNotification,
  TenantRolePermission,
  ThemeTokens,
} from '@/types/database';
import { calculateCPM, CPMResult } from '../cpm/cpm-engine';
import { calculate_working_end_date } from '../calendar/calendar-engine';
import { EntityNotFoundException, GuestAccessViolationException } from '../error/domain-errors';

class DatabaseStore {
  public tenants: Tenant[] = [];
  public users: UserProfile[] = [];
  public memberships: TenantMembership[] = [];
  public teams: TenantTeam[] = [];
  public teamMembers: TeamMember[] = [];
  public calendars: WorkingCalendar[] = [];
  public holidays: CalendarHoliday[] = [];
  public projects: Project[] = [];
  public projectGuestAccess: ProjectGuestAccess[] = [];
  public phases: ProjectPhase[] = [];
  public tasks: Task[] = [];
  public assignees: TaskAssignee[] = [];
  public dependencies: TaskDependency[] = [];
  public auditLogs: AuditLog[] = [];
  public taskStatuses: TenantTaskStatus[] = [];
  public taskPriorities: TenantTaskPriority[] = [];
  public taskTypes: TenantTaskType[] = [];
  public systemThemes: SystemTheme[] = [];
  public tenantThemeOverrides: TenantThemeOverride[] = [];
  public customFields: TenantCustomField[] = [];
  public customFieldValues: EntityCustomFieldValue[] = [];
  public baselines: ProjectBaseline[] = [];
  public baselineSnapshots: TaskBaselineSnapshot[] = [];
  public notifications: UserNotification[] = [];
  public rolePermissions: TenantRolePermission[] = [];

  constructor() {
    // Pure empty store: zero hardcoded mock data seeded by default.
  }

  public seed() {
    // 1. Tenants
    this.tenants = [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Acme Corporation',
        slug: 'acme-corp',
        tenant_code: 'ACME-CORP',
        code: 'ACME-CORP',
        domain: 'acme.pms.internal',
        logo_url: null,
        is_active: true,
        week_starts_on: 1, // Monday
        weekend_days: [0, 6], // Sunday, Saturday
        status: 'active',
        branding_json: {
          primary_color: '#2563eb',
          theme_preset: 'navy',
          company_tagline: 'Industrial Engineering & SaaS',
        },
        feature_flags: { cpm_enabled: true, export_enabled: true, audit_enabled: true },
        storage_quota_mb: 10240,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'a0000000-0000-0000-0000-000000000002',
        name: 'Globex Industries',
        slug: 'globex',
        tenant_code: 'GLOBEX',
        code: 'GLOBEX',
        domain: 'globex.pms.internal',
        logo_url: null,
        is_active: true,
        week_starts_on: 0, // Sunday
        weekend_days: [5, 6], // Friday, Saturday
        status: 'active',
        branding_json: {
          primary_color: '#059669',
          theme_preset: 'monokai',
          company_tagline: 'Global Logistics & Innovations',
        },
        feature_flags: { cpm_enabled: true, export_enabled: true, audit_enabled: true },
        storage_quota_mb: 5120,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'a0000000-0000-0000-0000-000000000003',
        name: 'Enterprise Core',
        slug: 'core',
        tenant_code: 'CORE-SYS',
        code: 'CORE-SYS',
        domain: 'core.pms.internal',
        logo_url: null,
        is_active: true,
        week_starts_on: 1,
        weekend_days: [0, 6],
        status: 'active',
        branding_json: {
          primary_color: '#2563eb',
          theme_preset: 'navy',
          company_tagline: 'Next-Generation Cloud & Infrastructure Operations',
        },
        feature_flags: {
          cpm_enabled: true,
          export_enabled: true,
          audit_enabled: true,
          custom_fields_enabled: true,
          resource_heatmap_enabled: true,
        },
        storage_quota_mb: 20480,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    // 2. Profiles (Users)
    this.users = [
      {
        id: 'b0000000-0000-0000-0000-000000000099',
        email: 'admin@jyotirmoyb.com',
        full_name: 'System Administrator',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
        is_superadmin: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000098',
        email: 'guest@external-partner.com',
        full_name: 'Guest Auditor (Partner Org)',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000097',
        email: 'lead.engineer@core.internal',
        full_name: 'Sarah Lin (Lead Architect)',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000096',
        email: 'devops@core.internal',
        full_name: 'Kenji Sato (Site Reliability)',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000001',
        email: 'superadmin@system.global',
        full_name: 'Alexander Thorne (SuperAdmin)',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        is_superadmin: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000002',
        email: 'admin@acme.com',
        full_name: 'Sarah Connor (Tenant Admin)',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000003',
        email: 'pm@acme.com',
        full_name: 'David Miller (Lead PM)',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000004',
        email: 'elena@acme.com',
        full_name: 'Elena Rostova (Staff Architect)',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000005',
        email: 'marcus@acme.com',
        full_name: 'Marcus Vance (Frontend Lead)',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000006',
        email: 'auditor@partner.org',
        full_name: 'Liam Vance (Scoped Guest)',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    const acmeId = this.tenants[0].id;
    const globexId = this.tenants[1].id;
    const coreId = this.tenants[2].id;

    // 3. Tenant Memberships
    this.memberships = [
      { id: 'm1', tenant_id: acmeId, user_id: this.users[0].id, role: 'admin', is_active: true, created_at: '2026-01-01' },
      { id: 'm2', tenant_id: acmeId, user_id: this.users[1].id, role: 'owner', is_active: true, created_at: '2026-01-01' },
      { id: 'm3', tenant_id: acmeId, user_id: this.users[2].id, role: 'project_manager', is_active: true, created_at: '2026-01-01' },
      { id: 'm4', tenant_id: acmeId, user_id: this.users[3].id, role: 'member', is_active: true, created_at: '2026-01-01' },
      { id: 'm5', tenant_id: acmeId, user_id: this.users[4].id, role: 'member', is_active: true, created_at: '2026-01-01' },
      { id: 'm6', tenant_id: acmeId, user_id: this.users[5].id, role: 'guest', is_active: true, created_at: '2026-01-01' },
      // Globex
      { id: 'm7', tenant_id: globexId, user_id: this.users[0].id, role: 'admin', is_active: true, created_at: '2026-01-01' },
      { id: 'm8', tenant_id: globexId, user_id: this.users[1].id, role: 'member', is_active: true, created_at: '2026-01-01' },
    ];

    // 4. Teams
    this.teams = [
      { id: 'team1', tenant_id: acmeId, name: 'Core Infrastructure', description: 'Backend and Database', created_at: '2026-01-01' },
      { id: 'team2', tenant_id: acmeId, name: 'Web Applications', description: 'Frontend and Design Systems', created_at: '2026-01-01' },
    ];

    this.teamMembers = [
      { team_id: 'team1', user_id: this.users[3].id, created_at: '2026-01-01' },
      { team_id: 'team2', user_id: this.users[4].id, created_at: '2026-01-01' },
    ];

    // 5. Calendars & Holidays
    const calId = 'c0000000-0000-0000-0000-000000000001';
    this.calendars = [
      {
        id: calId,
        tenant_id: acmeId,
        name: 'US Corporate Standard',
        description: 'Monday to Friday 40h/week schedule',
        is_default: true,
        week_start_day: 1,
        working_days: [1, 2, 3, 4, 5],
        daily_working_hours: 8.0,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    this.holidays = [
      { id: 'h1', tenant_id: acmeId, calendar_id: calId, name: 'New Year Holiday', holiday_date: '2026-01-01', date: '2026-01-01', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h2', tenant_id: acmeId, calendar_id: calId, name: 'Memorial Day', holiday_date: '2026-05-25', date: '2026-05-25', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h3', tenant_id: acmeId, calendar_id: calId, name: 'Independence Day', holiday_date: '2026-07-03', date: '2026-07-03', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h4', tenant_id: acmeId, calendar_id: calId, name: 'Labor Day', holiday_date: '2026-09-07', date: '2026-09-07', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h5', tenant_id: acmeId, calendar_id: calId, name: 'Thanksgiving Day', holiday_date: '2026-11-26', date: '2026-11-26', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h6', tenant_id: acmeId, calendar_id: calId, name: 'Christmas Day', holiday_date: '2026-12-25', date: '2026-12-25', is_recurring: true, created_at: '2026-01-01' },
    ];

    // 6. Projects
    const prjId = 'd0000000-0000-0000-0000-000000000001';
    const soc2Id = 'd0000000-0000-0000-0000-000000000002';
    this.projects = [
      {
        id: prjId,
        tenant_id: acmeId,
        name: 'Next-Gen Cloud ERP & PMS Platform',
        code: 'PRJ-ERP-01',
        description: 'Multi-tenant enterprise scheduling and resource management system deployment.',
        status: 'active',
        start_date: '2026-10-01',
        target_end_date: '2026-12-15',
        calendar_id: calId,
        is_archived: false,
        created_by: this.users[2].id,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: soc2Id,
        tenant_id: acmeId,
        name: 'SOC2 Type II Annual Compliance Audit',
        code: 'PRJ-SEC-02',
        description: 'Comprehensive penetration testing, audit trail compliance, and vendor assessments.',
        status: 'planning',
        start_date: '2026-11-01',
        target_end_date: '2027-01-30',
        calendar_id: calId,
        is_archived: false,
        created_by: this.users[2].id,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    // 7. Project Guest Access (Explicitly scopes user 5 to prjId)
    this.projectGuestAccess = [
      {
        id: 'pga1',
        project_id: prjId,
        tenant_id: acmeId,
        email: this.users[5].email,
        user_id: this.users[5].id,
        access_level: 'comment',
        created_at: '2026-01-01',
      },
    ];

    // 8. Project Phases
    const ph1 = 'e0000000-0000-0000-0000-000000000001';
    const ph2 = 'e0000000-0000-0000-0000-000000000002';
    const ph3 = 'e0000000-0000-0000-0000-000000000003';
    const ph4 = 'e0000000-0000-0000-0000-000000000004';
    this.phases = [
      { id: ph1, tenant_id: acmeId, project_id: prjId, name: 'Phase 1: Architecture & DB Specs', sort_order: 1, order_index: 1, color: '#3b82f6', start_date: '2026-10-01', end_date: '2026-10-14', created_at: '2026-01-01' },
      { id: ph2, tenant_id: acmeId, project_id: prjId, name: 'Phase 2: Scheduling & CPM Engines', sort_order: 2, order_index: 2, color: '#8b5cf6', start_date: '2026-10-15', end_date: '2026-11-04', created_at: '2026-01-01' },
      { id: ph3, tenant_id: acmeId, project_id: prjId, name: 'Phase 3: Interactive SVG Gantt & Canvas', sort_order: 3, order_index: 3, color: '#10b981', start_date: '2026-11-05', end_date: '2026-11-25', created_at: '2026-01-01' },
      { id: ph4, tenant_id: acmeId, project_id: prjId, name: 'Phase 4: QA, Security & Vercel Launch', sort_order: 4, order_index: 4, color: '#f59e0b', start_date: '2026-11-26', end_date: '2026-12-15', created_at: '2026-01-01' },
    ];

    // 9. Tasks
    const t1 = 'f0000000-0000-0000-0000-000000000001';
    const t2 = 'f0000000-0000-0000-0000-000000000002';
    const t3 = 'f0000000-0000-0000-0000-000000000003';
    const t4 = 'f0000000-0000-0000-0000-000000000004';
    const t5 = 'f0000000-0000-0000-0000-000000000005';
    const t6 = 'f0000000-0000-0000-0000-000000000006';
    const t7 = 'f0000000-0000-0000-0000-000000000007';
    const t8 = 'f0000000-0000-0000-0000-000000000008';

    this.tasks = [
      {
        id: t1,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph1,
        parent_task_id: null,
        parent_id: null,
        title: 'Multi-Tenant DB Schema & RLS Matrix',
        description: 'Design strict tenant_id isolation policies and pgcrypto secrets table',
        status: 'done',
        priority: 'urgent',
        start_date: '2026-10-01',
        end_date: '2026-10-07',
        duration_days: 5,
        progress: 100,
        progress_percent: 100,
        is_milestone: false,
        sort_order: 1,
        order_index: 1,
        early_start: '2026-10-01',
        early_finish: '2026-10-07',
        late_start: '2026-10-01',
        late_finish: '2026-10-07',
        total_float: 0,
        is_critical: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t2,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph1,
        parent_task_id: t1,
        parent_id: t1,
        title: 'Postgres Performance Tuning & Trigram Indexes',
        description: 'Configure pg_trgm for fuzzy search and audit triggers',
        status: 'done',
        priority: 'high',
        start_date: '2026-10-08',
        end_date: '2026-10-14',
        duration_days: 5,
        progress: 100,
        progress_percent: 100,
        is_milestone: false,
        sort_order: 2,
        order_index: 2,
        early_start: '2026-10-08',
        early_finish: '2026-10-14',
        late_start: '2026-10-08',
        late_finish: '2026-10-14',
        total_float: 0,
        is_critical: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t3,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph2,
        parent_task_id: null,
        parent_id: null,
        title: 'CPM Forward/Backward Pass Engine',
        description: 'Implement topological sort, float calculator, and cycle detection',
        status: 'in_progress',
        priority: 'urgent',
        start_date: '2026-10-15',
        end_date: '2026-10-23',
        duration_days: 7,
        progress: 65,
        progress_percent: 65,
        is_milestone: false,
        sort_order: 3,
        order_index: 3,
        early_start: '2026-10-15',
        early_finish: '2026-10-23',
        late_start: '2026-10-15',
        late_finish: '2026-10-23',
        total_float: 0,
        is_critical: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t4,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph2,
        parent_task_id: null,
        parent_id: null,
        title: 'Working Days & Regional Calendar Engine',
        description: 'Calculate weekend skip and floating/recurring holidays',
        status: 'in_progress',
        priority: 'medium',
        start_date: '2026-10-15',
        end_date: '2026-10-21',
        duration_days: 5,
        progress: 80,
        progress_percent: 80,
        is_milestone: false,
        sort_order: 4,
        order_index: 4,
        early_start: '2026-10-15',
        early_finish: '2026-10-21',
        late_start: '2026-10-19',
        late_finish: '2026-10-27',
        total_float: 4,
        is_critical: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t5,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph2,
        parent_task_id: null,
        parent_id: null,
        title: 'Milestone: Scheduling Core Benchmark Passed',
        description: 'Verification of scheduling engine on 10,000 node DAG',
        status: 'todo',
        priority: 'high',
        start_date: '2026-10-26',
        end_date: '2026-10-26',
        duration_days: 0,
        progress: 0,
        progress_percent: 0,
        is_milestone: true,
        sort_order: 5,
        order_index: 5,
        early_start: '2026-10-26',
        early_finish: '2026-10-26',
        late_start: '2026-10-26',
        late_finish: '2026-10-26',
        total_float: 0,
        is_critical: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t6,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph3,
        parent_task_id: null,
        parent_id: null,
        title: 'Interactive SVG Gantt & Drag Dependency Engine',
        description: 'Pure SVG timeline with drag handles, snapping, and bezier connectors',
        status: 'todo',
        priority: 'urgent',
        start_date: '2026-10-27',
        end_date: '2026-11-13',
        duration_days: 14,
        progress: 0,
        progress_percent: 0,
        is_milestone: false,
        sort_order: 6,
        order_index: 6,
        early_start: '2026-10-27',
        early_finish: '2026-11-13',
        late_start: '2026-10-27',
        late_finish: '2026-11-13',
        total_float: 0,
        is_critical: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t7,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph3,
        parent_task_id: null,
        parent_id: null,
        title: 'Synchronized Kanban & Hierarchical Grid Views',
        description: 'Card movement with optimistic TanStack Query cache updates',
        status: 'todo',
        priority: 'medium',
        start_date: '2026-11-02',
        end_date: '2026-11-16',
        duration_days: 10,
        progress: 0,
        progress_percent: 0,
        is_milestone: false,
        sort_order: 7,
        order_index: 7,
        early_start: '2026-11-02',
        early_finish: '2026-11-16',
        late_start: '2026-11-04',
        late_finish: '2026-11-18',
        total_float: 2,
        is_critical: false,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t8,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph4,
        parent_task_id: null,
        parent_id: null,
        title: 'Vercel Deployment & Triple-Layer Test Suite',
        description: 'End-to-end integration, RLS penetration testing, and Vercel build',
        status: 'todo',
        priority: 'urgent',
        start_date: '2026-11-16',
        end_date: '2026-12-04',
        duration_days: 15,
        progress: 0,
        progress_percent: 0,
        is_milestone: false,
        sort_order: 8,
        order_index: 8,
        early_start: '2026-11-16',
        early_finish: '2026-12-04',
        late_start: '2026-11-16',
        late_finish: '2026-12-04',
        total_float: 0,
        is_critical: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    // 10. Dependencies
    this.dependencies = [
      { id: 'dep1', tenant_id: acmeId, project_id: prjId, predecessor_id: t1, successor_id: t2, dep_type: 'FS', type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep2', tenant_id: acmeId, project_id: prjId, predecessor_id: t2, successor_id: t3, dep_type: 'FS', type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep3', tenant_id: acmeId, project_id: prjId, predecessor_id: t2, successor_id: t4, dep_type: 'SS', type: 'SS', lag_days: 1, created_at: '2026-01-01' },
      { id: 'dep4', tenant_id: acmeId, project_id: prjId, predecessor_id: t3, successor_id: t5, dep_type: 'FS', type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep5', tenant_id: acmeId, project_id: prjId, predecessor_id: t5, successor_id: t6, dep_type: 'FS', type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep6', tenant_id: acmeId, project_id: prjId, predecessor_id: t5, successor_id: t7, dep_type: 'SS', type: 'SS', lag_days: 2, created_at: '2026-01-01' },
      { id: 'dep7', tenant_id: acmeId, project_id: prjId, predecessor_id: t6, successor_id: t8, dep_type: 'FS', type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep8', tenant_id: acmeId, project_id: prjId, predecessor_id: t7, successor_id: t8, dep_type: 'FF', type: 'FF', lag_days: 0, created_at: '2026-01-01' },
    ];

    // 11. Assignees
    this.assignees = [
      { task_id: t1, user_id: this.users[3].id, allocation_percent: 100, created_at: '2026-01-01' },
      { task_id: t2, user_id: this.users[3].id, allocation_percent: 60, created_at: '2026-01-01' },
      { task_id: t2, user_id: this.users[4].id, allocation_percent: 40, created_at: '2026-01-01' },
      { task_id: t3, user_id: this.users[3].id, allocation_percent: 80, created_at: '2026-01-01' },
      { task_id: t4, user_id: this.users[4].id, allocation_percent: 100, created_at: '2026-01-01' },
      { task_id: t6, user_id: this.users[4].id, allocation_percent: 100, created_at: '2026-01-01' },
      { task_id: t7, user_id: this.users[3].id, allocation_percent: 50, created_at: '2026-01-01' },
      { task_id: t7, user_id: this.users[4].id, allocation_percent: 50, created_at: '2026-01-01' },
      { task_id: t8, user_id: this.users[2].id, allocation_percent: 100, created_at: '2026-01-01' },
    ];

    // 12. Audit Logs
    this.auditLogs = [
      {
        id: 'aud1',
        tenant_id: acmeId,
        actor_id: this.users[1].id,
        action: 'INSERT',
        entity_type: 'project',
        entity_id: prjId,
        diff_before: null,
        diff_after: { name: 'Next-Gen Cloud ERP & PMS Platform', code: 'PRJ-ERP-01' },
        correlation_id: 'corr-init-001',
        ip_address: '127.0.0.1',
        user_agent: 'Antigravity/2.0 Engine',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    // 13. System Themes (Database-Stored Design Tokens)
    const NAVY_TOKENS: ThemeTokens = {
      background: '#0a1128',
      foreground: '#f1f5f9',
      card: '#101f42',
      card_foreground: '#ffffff',
      popover: '#101f42',
      popover_foreground: '#ffffff',
      primary: '#38bdf8',
      primary_foreground: '#0a1128',
      secondary: '#1e3a6d',
      secondary_foreground: '#f1f5f9',
      muted: '#1e3a6d',
      muted_foreground: '#94a3b8',
      accent: '#254a85',
      accent_foreground: '#ffffff',
      destructive: '#ff5555',
      destructive_foreground: '#ffffff',
      border: '#1e3a6d',
      input: '#1e3a6d',
      ring: '#38bdf8',
      radius: '0.5rem',
      critical_path: '#f43f5e',
      non_working_day: 'rgba(30, 58, 109, 0.45)',
      holiday_day: 'rgba(136, 19, 55, 0.35)',
    };

    const DARK_TOKENS: ThemeTokens = {
      background: '#090d16',
      foreground: '#f8fafc',
      card: '#111827',
      card_foreground: '#f8fafc',
      popover: '#111827',
      popover_foreground: '#f8fafc',
      primary: '#3b82f6',
      primary_foreground: '#ffffff',
      secondary: '#1f2937',
      secondary_foreground: '#f8fafc',
      muted: '#1f2937',
      muted_foreground: '#9ca3af',
      accent: '#374151',
      accent_foreground: '#f8fafc',
      destructive: '#f87171',
      destructive_foreground: '#ffffff',
      border: '#1f2937',
      input: '#1f2937',
      ring: '#3b82f6',
      radius: '0.5rem',
      critical_path: '#f87171',
      non_working_day: 'rgba(31, 41, 55, 0.4)',
      holiday_day: 'rgba(127, 29, 29, 0.25)',
    };

    const MONOKAI_TOKENS: ThemeTokens = {
      background: '#0d0e0f',
      foreground: '#f8f8f2',
      card: '#191a1c',
      card_foreground: '#f8f8f2',
      popover: '#191a1c',
      popover_foreground: '#f8f8f2',
      primary: '#a6e22e',
      primary_foreground: '#0d0e0f',
      secondary: '#272822',
      secondary_foreground: '#f8f8f2',
      muted: '#272822',
      muted_foreground: '#75715e',
      accent: '#3e3d32',
      accent_foreground: '#fd971f',
      destructive: '#f92672',
      destructive_foreground: '#ffffff',
      border: '#272822',
      input: '#272822',
      ring: '#a6e22e',
      radius: '0.375rem',
      critical_path: '#f92672',
      non_working_day: 'rgba(39, 40, 34, 0.45)',
      holiday_day: 'rgba(249, 38, 114, 0.25)',
    };

    const HIGH_CONTRAST_TOKENS: ThemeTokens = {
      background: '#000000',
      foreground: '#ffffff',
      card: '#0a0a0a',
      card_foreground: '#ffffff',
      popover: '#0a0a0a',
      popover_foreground: '#ffffff',
      primary: '#ffff00',
      primary_foreground: '#000000',
      secondary: '#1c1c1c',
      secondary_foreground: '#ffffff',
      muted: '#1c1c1c',
      muted_foreground: '#e0e0e0',
      accent: '#2d2d2d',
      accent_foreground: '#ffffff',
      destructive: '#ff0055',
      destructive_foreground: '#ffffff',
      border: '#ffffff',
      input: '#2d2d2d',
      ring: '#ffff00',
      radius: '0px',
      critical_path: '#ff0055',
      non_working_day: 'rgba(255, 255, 255, 0.15)',
      holiday_day: 'rgba(255, 0, 85, 0.3)',
    };

    const LIGHT_TOKENS: ThemeTokens = {
      background: '#f8fafc',
      foreground: '#0f172a',
      card: '#ffffff',
      card_foreground: '#0f172a',
      popover: '#ffffff',
      popover_foreground: '#0f172a',
      primary: '#2563eb',
      primary_foreground: '#ffffff',
      secondary: '#f1f5f9',
      secondary_foreground: '#1e293b',
      muted: '#f1f5f9',
      muted_foreground: '#64748b',
      accent: '#e2e8f0',
      accent_foreground: '#0f172a',
      destructive: '#ef4444',
      destructive_foreground: '#ffffff',
      border: '#e2e8f0',
      input: '#e2e8f0',
      ring: '#2563eb',
      radius: '0.5rem',
      critical_path: '#ef4444',
      non_working_day: 'rgba(226, 232, 240, 0.5)',
      holiday_day: 'rgba(254, 226, 226, 0.6)',
    };

    this.systemThemes = [
      { id: 'navy', name: 'Enterprise Navy', description: 'Deep tech enterprise navy blue theme', tokens_json: NAVY_TOKENS, is_system_default: true, created_at: '2026-01-01T00:00:00Z' },
      { id: 'dark', name: 'Dark Charcoal', description: 'Modern dark mode with balanced contrast', tokens_json: DARK_TOKENS, is_system_default: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'monokai', name: 'Monokai OLED', description: 'High-energy developer palette with neon green accents', tokens_json: MONOKAI_TOKENS, is_system_default: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'high-contrast', name: 'High Contrast (AAA)', description: 'WCAG AAA compliance with stark black and yellow', tokens_json: HIGH_CONTRAST_TOKENS, is_system_default: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'light', name: 'Clean Enterprise Light', description: 'Crisp, high-productivity daylight aesthetic', tokens_json: LIGHT_TOKENS, is_system_default: false, created_at: '2026-01-01T00:00:00Z' },
    ];

    this.tenantThemeOverrides = [
      { id: 't-theme-1', tenant_id: acmeId, active_theme_id: 'navy', custom_tokens_json: {}, created_at: '2026-01-01T00:00:00Z' },
      { id: 't-theme-2', tenant_id: globexId, active_theme_id: 'dark', custom_tokens_json: {}, created_at: '2026-01-01T00:00:00Z' },
    ];

    // 14. Tenant Dynamic Task Statuses
    const seedStatusesForTenant = (tId: string) => [
      { id: `st-backlog-${tId}`, tenant_id: tId, name: 'Backlog', slug: 'backlog', color_hex: '#64748b', badge_variant: 'secondary', position: 0, is_closed_state: false, is_default: false },
      { id: `st-todo-${tId}`, tenant_id: tId, name: 'To Do', slug: 'todo', color_hex: '#3b82f6', badge_variant: 'default', position: 1, is_closed_state: false, is_default: true },
      { id: `st-progress-${tId}`, tenant_id: tId, name: 'In Progress', slug: 'in_progress', color_hex: '#f59e0b', badge_variant: 'warning', position: 2, is_closed_state: false, is_default: false },
      { id: `st-review-${tId}`, tenant_id: tId, name: 'In Review', slug: 'review', color_hex: '#8b5cf6', badge_variant: 'secondary', position: 3, is_closed_state: false, is_default: false },
      { id: `st-done-${tId}`, tenant_id: tId, name: 'Done', slug: 'done', color_hex: '#10b981', badge_variant: 'success', position: 4, is_closed_state: true, is_default: false },
      { id: `st-blocked-${tId}`, tenant_id: tId, name: 'Blocked', slug: 'blocked', color_hex: '#ef4444', badge_variant: 'destructive', position: 5, is_closed_state: false, is_default: false },
    ];
    this.taskStatuses = [
      ...seedStatusesForTenant(acmeId),
      ...seedStatusesForTenant(globexId),
    ];

    // 15. Tenant Dynamic Task Priorities
    const seedPrioritiesForTenant = (tId: string) => [
      { id: `pr-low-${tId}`, tenant_id: tId, name: 'Low', slug: 'low', color_hex: '#64748b', urgency_weight: 1, icon_key: 'arrow-down', is_default: false },
      { id: `pr-medium-${tId}`, tenant_id: tId, name: 'Medium', slug: 'medium', color_hex: '#3b82f6', urgency_weight: 2, icon_key: 'minus', is_default: true },
      { id: `pr-high-${tId}`, tenant_id: tId, name: 'High', slug: 'high', color_hex: '#f59e0b', urgency_weight: 3, icon_key: 'arrow-up', is_default: false },
      { id: `pr-urgent-${tId}`, tenant_id: tId, name: 'Urgent', slug: 'urgent', color_hex: '#ef4444', urgency_weight: 4, icon_key: 'alert-triangle', is_default: false },
    ];
    this.taskPriorities = [
      ...seedPrioritiesForTenant(acmeId),
      ...seedPrioritiesForTenant(globexId),
    ];

    // 16. Tenant Dynamic Task Types
    const seedTypesForTenant = (tId: string) => [
      { id: `tt-task-${tId}`, tenant_id: tId, name: 'Task', slug: 'task', icon_key: 'check-square', is_default: true },
      { id: `tt-milestone-${tId}`, tenant_id: tId, name: 'Milestone', slug: 'milestone', icon_key: 'flag', is_default: false },
      { id: `tt-feature-${tId}`, tenant_id: tId, name: 'Feature', slug: 'feature', icon_key: 'sparkles', is_default: false },
      { id: `tt-bug-${tId}`, tenant_id: tId, name: 'Bug', slug: 'bug', icon_key: 'bug', is_default: false },
      { id: `tt-phase-${tId}`, tenant_id: tId, name: 'Phase', slug: 'phase', icon_key: 'folder', is_default: false },
    ];
    this.taskTypes = [
      ...seedTypesForTenant(acmeId),
      ...seedTypesForTenant(globexId),
    ];

    // 17. Custom Fields
    this.customFields = [
      { id: 'cf1', tenant_id: acmeId, entity_type: 'project', field_name: 'Approved Budget ($)', field_key: 'budget_cost', field_type: 'number', is_required: false, sort_order: 1 },
      { id: 'cf2', tenant_id: acmeId, entity_type: 'project', field_name: 'Client Billing Code', field_key: 'client_code', field_type: 'text', is_required: true, sort_order: 2 },
      { id: 'cf3', tenant_id: acmeId, entity_type: 'task', field_name: 'Risk Level', field_key: 'risk_level', field_type: 'dropdown', options_json: ['Low', 'Medium', 'High', 'Critical'], is_required: false, sort_order: 1 },
      { id: 'cf4', tenant_id: acmeId, entity_type: 'task', field_name: 'External Jira ID', field_key: 'jira_key', field_type: 'text', is_required: false, sort_order: 2 },
      { id: 'cf5', tenant_id: acmeId, entity_type: 'task', field_name: 'QA Sign-off Required', field_key: 'qa_signoff', field_type: 'checkbox', is_required: false, sort_order: 3 },
    ];

    this.customFieldValues = [
      { id: 'cfv1', tenant_id: acmeId, entity_id: prjId, field_id: 'cf1', value_json: 750000 },
      { id: 'cfv2', tenant_id: acmeId, entity_id: prjId, field_id: 'cf2', value_json: 'ACME-ENT-2026' },
      { id: 'cfv3', tenant_id: acmeId, entity_id: t1, field_id: 'cf3', value_json: 'High' },
      { id: 'cfv4', tenant_id: acmeId, entity_id: t1, field_id: 'cf4', value_json: 'JIRA-8901' },
      { id: 'cfv5', tenant_id: acmeId, entity_id: t5, field_id: 'cf3', value_json: 'Critical' },
      { id: 'cfv6', tenant_id: acmeId, entity_id: t6, field_id: 'cf5', value_json: true },
    ];

    // 18. Project Baselines & Snapshots (Earned Value & Variance Tracking)
    const baseId = `base-init-${acmeId}`;
    this.baselines = [
      {
        id: baseId,
        project_id: prjId,
        tenant_id: acmeId,
        name: 'Initial Approved Schedule Baseline',
        description: 'Baseline locked after Steering Committee approval on 2026-09-01',
        created_by: this.users[1].id,
        created_at: '2026-09-01T00:00:00Z',
      },
    ];

    this.baselineSnapshots = [
      { id: `bs1-${baseId}`, baseline_id: baseId, task_id: t1, start_date: '2026-10-01', end_date: '2026-10-02', duration_days: 2, progress: 100 },
      { id: `bs2-${baseId}`, baseline_id: baseId, task_id: t2, start_date: '2026-10-05', end_date: '2026-10-08', duration_days: 4, progress: 40 },
      { id: `bs3-${baseId}`, baseline_id: baseId, task_id: t3, start_date: '2026-10-09', end_date: '2026-10-14', duration_days: 4, progress: 0 },
      { id: `bs4-${baseId}`, baseline_id: baseId, task_id: t4, start_date: '2026-10-06', end_date: '2026-10-07', duration_days: 2, progress: 10 },
      { id: `bs5-${baseId}`, baseline_id: baseId, task_id: t5, start_date: '2026-10-15', end_date: '2026-10-21', duration_days: 5, progress: 0 },
      { id: `bs6-${baseId}`, baseline_id: baseId, task_id: t6, start_date: '2026-10-22', end_date: '2026-10-27', duration_days: 4, progress: 0 },
      { id: `bs7-${baseId}`, baseline_id: baseId, task_id: t7, start_date: '2026-10-19', end_date: '2026-10-22', duration_days: 4, progress: 0 },
      { id: `bs8-${baseId}`, baseline_id: baseId, task_id: t8, start_date: '2026-10-28', end_date: '2026-10-28', duration_days: 1, progress: 0 },
    ];

    // 19. Notifications
    this.notifications = [
      {
        id: 'notif-1',
        tenant_id: acmeId,
        recipient_id: this.users[3].id,
        actor_id: this.users[1].id,
        event_type: 'task_assigned',
        title: 'New Task Assignment',
        message: 'You have been assigned as lead engineer for "Core Database Architecture".',
        entity_type: 'task',
        entity_id: t2,
        is_read: false,
        created_at: '2026-09-15T10:00:00Z',
      },
      {
        id: 'notif-2',
        tenant_id: acmeId,
        recipient_id: this.users[3].id,
        actor_id: this.users[2].id,
        event_type: 'dependency_blocked',
        title: 'Schedule Predecessor Completed',
        message: 'Task "Technical Architecture Blueprint" is now complete; you can proceed with DB architecture.',
        entity_type: 'task',
        entity_id: t1,
        is_read: true,
        created_at: '2026-09-14T08:30:00Z',
      },
      {
        id: 'notif-3',
        tenant_id: acmeId,
        recipient_id: this.users[1].id,
        actor_id: this.users[0].id,
        event_type: 'due_soon',
        title: 'Project Milestone Approaching',
        message: 'Sprint 1 Alpha Release is scheduled for delivery in 3 working days.',
        entity_type: 'project',
        entity_id: prjId,
        is_read: false,
        created_at: '2026-09-16T14:15:00Z',
      },
    ];

    // 20. Role Permissions
    const seedPermissionsForTenant = (tId: string) => [
      // Owner
      { id: `p-ow-1-${tId}`, tenant_id: tId, role: 'owner', permission_key: 'tasks.create', is_granted: true },
      { id: `p-ow-2-${tId}`, tenant_id: tId, role: 'owner', permission_key: 'tasks.edit', is_granted: true },
      { id: `p-ow-3-${tId}`, tenant_id: tId, role: 'owner', permission_key: 'tasks.delete', is_granted: true },
      { id: `p-ow-4-${tId}`, tenant_id: tId, role: 'owner', permission_key: 'cpm.recalculate', is_granted: true },
      { id: `p-ow-5-${tId}`, tenant_id: tId, role: 'owner', permission_key: 'baselines.create', is_granted: true },
      { id: `p-ow-6-${tId}`, tenant_id: tId, role: 'owner', permission_key: 'settings.manage', is_granted: true },
      { id: `p-ow-7-${tId}`, tenant_id: tId, role: 'owner', permission_key: 'roles.manage', is_granted: true },
      // Admin
      { id: `p-ad-1-${tId}`, tenant_id: tId, role: 'admin', permission_key: 'tasks.create', is_granted: true },
      { id: `p-ad-2-${tId}`, tenant_id: tId, role: 'admin', permission_key: 'tasks.edit', is_granted: true },
      { id: `p-ad-3-${tId}`, tenant_id: tId, role: 'admin', permission_key: 'tasks.delete', is_granted: true },
      { id: `p-ad-4-${tId}`, tenant_id: tId, role: 'admin', permission_key: 'cpm.recalculate', is_granted: true },
      { id: `p-ad-5-${tId}`, tenant_id: tId, role: 'admin', permission_key: 'baselines.create', is_granted: true },
      { id: `p-ad-6-${tId}`, tenant_id: tId, role: 'admin', permission_key: 'settings.manage', is_granted: true },
      { id: `p-ad-7-${tId}`, tenant_id: tId, role: 'admin', permission_key: 'roles.manage', is_granted: false },
      // Project Manager
      { id: `p-pm-1-${tId}`, tenant_id: tId, role: 'project_manager', permission_key: 'tasks.create', is_granted: true },
      { id: `p-pm-2-${tId}`, tenant_id: tId, role: 'project_manager', permission_key: 'tasks.edit', is_granted: true },
      { id: `p-pm-3-${tId}`, tenant_id: tId, role: 'project_manager', permission_key: 'tasks.delete', is_granted: true },
      { id: `p-pm-4-${tId}`, tenant_id: tId, role: 'project_manager', permission_key: 'cpm.recalculate', is_granted: true },
      { id: `p-pm-5-${tId}`, tenant_id: tId, role: 'project_manager', permission_key: 'baselines.create', is_granted: true },
      { id: `p-pm-6-${tId}`, tenant_id: tId, role: 'project_manager', permission_key: 'settings.manage', is_granted: false },
      { id: `p-pm-7-${tId}`, tenant_id: tId, role: 'project_manager', permission_key: 'roles.manage', is_granted: false },
      // Member
      { id: `p-mb-1-${tId}`, tenant_id: tId, role: 'member', permission_key: 'tasks.create', is_granted: true },
      { id: `p-mb-2-${tId}`, tenant_id: tId, role: 'member', permission_key: 'tasks.edit', is_granted: true },
      { id: `p-mb-3-${tId}`, tenant_id: tId, role: 'member', permission_key: 'tasks.delete', is_granted: false },
      { id: `p-mb-4-${tId}`, tenant_id: tId, role: 'member', permission_key: 'cpm.recalculate', is_granted: false },
      { id: `p-mb-5-${tId}`, tenant_id: tId, role: 'member', permission_key: 'baselines.create', is_granted: false },
      { id: `p-mb-6-${tId}`, tenant_id: tId, role: 'member', permission_key: 'settings.manage', is_granted: false },
      { id: `p-mb-7-${tId}`, tenant_id: tId, role: 'member', permission_key: 'roles.manage', is_granted: false },
      // Guest
      { id: `p-gt-1-${tId}`, tenant_id: tId, role: 'guest', permission_key: 'tasks.create', is_granted: false },
      { id: `p-gt-2-${tId}`, tenant_id: tId, role: 'guest', permission_key: 'tasks.edit', is_granted: false },
      { id: `p-gt-3-${tId}`, tenant_id: tId, role: 'guest', permission_key: 'tasks.delete', is_granted: false },
      { id: `p-gt-4-${tId}`, tenant_id: tId, role: 'guest', permission_key: 'cpm.recalculate', is_granted: false },
      { id: `p-gt-5-${tId}`, tenant_id: tId, role: 'guest', permission_key: 'baselines.create', is_granted: false },
      { id: `p-gt-6-${tId}`, tenant_id: tId, role: 'guest', permission_key: 'settings.manage', is_granted: false },
      { id: `p-gt-7-${tId}`, tenant_id: tId, role: 'guest', permission_key: 'roles.manage', is_granted: false },
    ];
    this.rolePermissions = [
      ...seedPermissionsForTenant(acmeId),
      ...seedPermissionsForTenant(globexId),
      ...seedPermissionsForTenant(coreId),
    ];

    // Seed Complete Phase 3 Operational Demo Dataset for Enterprise Core
    this.seedCoreDemoDataset(
      coreId,
      'b0000000-0000-0000-0000-000000000099',
      'b0000000-0000-0000-0000-000000000098',
      'b0000000-0000-0000-0000-000000000097',
      'b0000000-0000-0000-0000-000000000096'
    );
  }

  private seedCoreDemoDataset(
    coreId: string,
    superAdminId: string,
    guestUserId: string,
    engineerId: string,
    devopsId: string
  ): void {
    // 1. Memberships
    this.memberships.push(
      { id: 'm-core-1', tenant_id: coreId, user_id: superAdminId, role: 'owner', is_active: true, created_at: '2026-01-01' },
      { id: 'm-core-2', tenant_id: coreId, user_id: engineerId, role: 'admin', is_active: true, created_at: '2026-01-01' },
      { id: 'm-core-3', tenant_id: coreId, user_id: devopsId, role: 'member', is_active: true, created_at: '2026-01-01' },
      { id: 'm-core-4', tenant_id: coreId, user_id: guestUserId, role: 'guest', is_active: true, created_at: '2026-01-01' }
    );

    // 2. Teams
    const teamPlatId = 'a0000000-0000-0000-0000-000000000011';
    const teamOpsId = 'a0000000-0000-0000-0000-000000000012';
    this.teams.push(
      { id: teamPlatId, tenant_id: coreId, name: 'Core Platform', description: 'Platform Architecture & Cloud Infrastructure', created_at: '2026-01-01' },
      { id: teamOpsId, tenant_id: coreId, name: 'Operations', description: 'Site Reliability & CI/CD Automation', created_at: '2026-01-01' }
    );
    this.teamMembers.push(
      { team_id: teamPlatId, user_id: superAdminId, created_at: '2026-01-01' },
      { team_id: teamPlatId, user_id: engineerId, created_at: '2026-01-01' },
      { team_id: teamOpsId, user_id: devopsId, created_at: '2026-01-01' }
    );

    // 3. Calendar & Holidays
    const calCoreId = 'c0000000-0000-0000-0000-000000000003';
    this.calendars.push({
      id: calCoreId,
      tenant_id: coreId,
      name: 'Standard Corporate Calendar (Mon-Fri)',
      description: 'Monday to Friday corporate schedule with statutory holidays',
      is_default: true,
      week_start_day: 1,
      working_days: [1, 2, 3, 4, 5],
      daily_working_hours: 8.0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });
    this.holidays.push(
      { id: 'h-core-1', tenant_id: coreId, calendar_id: calCoreId, name: "New Year's Day", holiday_date: '2026-01-01', date: '2026-01-01', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h-core-2', tenant_id: coreId, calendar_id: calCoreId, name: 'Memorial Day', holiday_date: '2026-05-25', date: '2026-05-25', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h-core-3', tenant_id: coreId, calendar_id: calCoreId, name: 'Labor Day', holiday_date: '2026-09-07', date: '2026-09-07', is_recurring: true, created_at: '2026-01-01' }
    );

    // 4. Demonstration Project
    const prjCoreId = 'd0000000-0000-0000-0000-000000000003';
    this.projects.push({
      id: prjCoreId,
      tenant_id: coreId,
      name: 'Global Infrastructure Modernization',
      code: 'PRJ-CORE',
      description: 'Multi-region migration to modern container orchestration, Zero-Trust network security, and autonomous CI/CD pipelines.',
      status: 'active',
      start_date: '2026-10-01',
      target_end_date: '2026-12-15',
      calendar_id: calCoreId,
      is_archived: false,
      created_by: superAdminId,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    // 5. Phases
    const ph1 = 'e0000000-0000-0000-0000-000000000011';
    const ph2 = 'e0000000-0000-0000-0000-000000000012';
    const ph3 = 'e0000000-0000-0000-0000-000000000013';
    this.phases.push(
      { id: ph1, tenant_id: coreId, project_id: prjCoreId, name: 'Phase 1: Architecture & Security Baseline', sort_order: 1, order_index: 1, start_date: '2026-10-01', end_date: '2026-10-15', created_at: '2026-01-01' },
      { id: ph2, tenant_id: coreId, project_id: prjCoreId, name: 'Phase 2: Core Implementation & Workloads', sort_order: 2, order_index: 2, start_date: '2026-10-16', end_date: '2026-11-20', created_at: '2026-01-01' },
      { id: ph3, tenant_id: coreId, project_id: prjCoreId, name: 'Phase 3: UAT, Penetration Testing & Deployment', sort_order: 3, order_index: 3, start_date: '2026-11-23', end_date: '2026-12-15', created_at: '2026-01-01' }
    );

    // 6. Tasks
    const t1 = 'f0000000-0000-0000-0000-000000000011';
    const t2 = 'f0000000-0000-0000-0000-000000000012';
    const t3 = 'f0000000-0000-0000-0000-000000000013';
    const t4 = 'f0000000-0000-0000-0000-000000000014';
    const t5 = 'f0000000-0000-0000-0000-000000000015';
    const t6 = 'f0000000-0000-0000-0000-000000000016';
    const t7 = 'f0000000-0000-0000-0000-000000000017';
    const t8 = 'f0000000-0000-0000-0000-000000000018';

    this.tasks.push(
      {
        id: t1, tenant_id: coreId, project_id: prjCoreId, phase_id: ph1, parent_id: null,
        title: 'Zero-Trust Architecture & Threat Modeling', code: 'TASK-101',
        description: 'Define SPIFFE/SPIRE workload identities and mutual TLS topology.',
        status: 'done', priority: 'high', start_date: '2026-10-01', end_date: '2026-10-05',
        duration_days: 3, progress: 100, progress_percent: 100, is_milestone: false,
        early_start: '2026-10-01', early_finish: '2026-10-05', late_start: '2026-10-01', late_finish: '2026-10-05',
        total_float: 0, free_float: 0, is_critical: true, order_index: 1, created_by: superAdminId,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: t2, tenant_id: coreId, project_id: prjCoreId, phase_id: ph1, parent_id: null,
        title: 'Multi-Cluster Kubernetes Platform Setup', code: 'TASK-102',
        description: 'Provision Terraform infrastructure for multi-region EKS clusters.',
        status: 'in_progress', priority: 'urgent', start_date: '2026-10-06', end_date: '2026-10-14',
        duration_days: 7, progress: 60, progress_percent: 60, is_milestone: false,
        early_start: '2026-10-06', early_finish: '2026-10-14', late_start: '2026-10-06', late_finish: '2026-10-14',
        total_float: 0, free_float: 0, is_critical: true, order_index: 2, created_by: superAdminId,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: t3, tenant_id: coreId, project_id: prjCoreId, phase_id: ph1, parent_id: t2,
        title: 'VPC Peering & Transit Gateway Routing', code: 'TASK-102-A',
        description: 'Configure cross-region routing and peering mesh.',
        status: 'done', priority: 'high', start_date: '2026-10-06', end_date: '2026-10-08',
        duration_days: 3, progress: 100, progress_percent: 100, is_milestone: false,
        early_start: '2026-10-06', early_finish: '2026-10-08', late_start: '2026-10-06', late_finish: '2026-10-08',
        total_float: 0, free_float: 0, is_critical: false, order_index: 3, created_by: superAdminId,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: t4, tenant_id: coreId, project_id: prjCoreId, phase_id: ph1, parent_id: t2,
        title: 'GitOps ArgoCD Cluster Synchronizers', code: 'TASK-102-B',
        description: 'Setup declarative state synchronization with encrypted SOPS secrets.',
        status: 'in_progress', priority: 'medium', start_date: '2026-10-09', end_date: '2026-10-14',
        duration_days: 4, progress: 30, progress_percent: 30, is_milestone: false,
        early_start: '2026-10-09', early_finish: '2026-10-14', late_start: '2026-10-09', late_finish: '2026-10-14',
        total_float: 0, free_float: 0, is_critical: false, order_index: 4, created_by: superAdminId,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: t5, tenant_id: coreId, project_id: prjCoreId, phase_id: ph2, parent_id: null,
        title: 'PostgreSQL Database Zero-Downtime Replication', code: 'TASK-201',
        description: 'Establish logical replication streams with failover verification.',
        status: 'todo', priority: 'urgent', start_date: '2026-10-15', end_date: '2026-10-23',
        duration_days: 7, progress: 0, progress_percent: 0, is_milestone: false,
        early_start: '2026-10-15', early_finish: '2026-10-23', late_start: '2026-10-15', late_finish: '2026-10-23',
        total_float: 0, free_float: 0, is_critical: true, order_index: 5, created_by: superAdminId,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: t6, tenant_id: coreId, project_id: prjCoreId, phase_id: ph2, parent_id: null,
        title: 'Envoy Proxy Service Mesh & Rate Limiting', code: 'TASK-202',
        description: 'Implement adaptive rate limiting with Redis-backed token buckets.',
        status: 'todo', priority: 'high', start_date: '2026-10-26', end_date: '2026-11-04',
        duration_days: 8, progress: 0, progress_percent: 0, is_milestone: false,
        early_start: '2026-10-26', early_finish: '2026-11-04', late_start: '2026-10-26', late_finish: '2026-11-04',
        total_float: 0, free_float: 0, is_critical: true, order_index: 6, created_by: superAdminId,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: t7, tenant_id: coreId, project_id: prjCoreId, phase_id: ph3, parent_id: null,
        title: 'Third-Party SOC 2 Penetration Testing', code: 'TASK-301',
        description: 'External audit firm evaluation of perimeter isolation and data encryption.',
        status: 'todo', priority: 'high', start_date: '2026-11-05', end_date: '2026-11-13',
        duration_days: 7, progress: 0, progress_percent: 0, is_milestone: false,
        early_start: '2026-11-05', early_finish: '2026-11-13', late_start: '2026-11-05', late_finish: '2026-11-13',
        total_float: 0, free_float: 0, is_critical: true, order_index: 7, created_by: superAdminId,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: t8, tenant_id: coreId, project_id: prjCoreId, phase_id: ph3, parent_id: null,
        title: 'Cutover & Global Traffic Switchover Milestone', code: 'MILE-401',
        description: 'Promote staging mesh to primary DNS traffic routing.',
        status: 'todo', priority: 'urgent', start_date: '2026-11-16', end_date: '2026-11-16',
        duration_days: 0, progress: 0, progress_percent: 0, is_milestone: true,
        early_start: '2026-11-16', early_finish: '2026-11-16', late_start: '2026-11-16', late_finish: '2026-11-16',
        total_float: 0, free_float: 0, is_critical: true, order_index: 8, created_by: superAdminId,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      }
    );

    // 7. Assignees
    this.assignees.push(
      { task_id: t1, user_id: superAdminId, allocation_percent: 100 },
      { task_id: t2, user_id: engineerId, allocation_percent: 80 },
      { task_id: t2, user_id: devopsId, allocation_percent: 80 },
      { task_id: t3, user_id: devopsId, allocation_percent: 100 },
      { task_id: t4, user_id: engineerId, allocation_percent: 100 },
      { task_id: t5, user_id: engineerId, allocation_percent: 50 },
      { task_id: t6, user_id: devopsId, allocation_percent: 50 },
      { task_id: t7, user_id: guestUserId, allocation_percent: 100 },
      { task_id: t8, user_id: superAdminId, allocation_percent: 100 }
    );

    // 8. Dependencies
    this.dependencies.push(
      { id: 'dep-core-1', tenant_id: coreId, project_id: prjCoreId, predecessor_id: t1, successor_id: t2, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep-core-2', tenant_id: coreId, project_id: prjCoreId, predecessor_id: t3, successor_id: t4, type: 'SS', lag_days: 1, created_at: '2026-01-01' },
      { id: 'dep-core-3', tenant_id: coreId, project_id: prjCoreId, predecessor_id: t2, successor_id: t5, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep-core-4', tenant_id: coreId, project_id: prjCoreId, predecessor_id: t5, successor_id: t6, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep-core-5', tenant_id: coreId, project_id: prjCoreId, predecessor_id: t6, successor_id: t7, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep-core-6', tenant_id: coreId, project_id: prjCoreId, predecessor_id: t7, successor_id: t8, type: 'FS', lag_days: 0, created_at: '2026-01-01' }
    );

    // 9. Baseline
    const baseCoreId = 'base-core-2026';
    this.baselines.push({
      id: baseCoreId,
      project_id: prjCoreId,
      tenant_id: coreId,
      name: 'Executive Baseline v1.0 (Q4 Approved)',
      description: 'Approved by the Technical Steering Committee prior to infrastructure sprint kickoff.',
      created_by: superAdminId,
      created_at: '2026-09-25T00:00:00Z',
    });

    this.baselineSnapshots.push(
      { id: `bcs-1`, baseline_id: baseCoreId, task_id: t1, start_date: '2026-10-01', end_date: '2026-10-05', duration_days: 3, progress: 100 },
      { id: `bcs-2`, baseline_id: baseCoreId, task_id: t2, start_date: '2026-10-06', end_date: '2026-10-12', duration_days: 5, progress: 40 },
      { id: `bcs-3`, baseline_id: baseCoreId, task_id: t3, start_date: '2026-10-06', end_date: '2026-10-08', duration_days: 3, progress: 100 },
      { id: `bcs-4`, baseline_id: baseCoreId, task_id: t4, start_date: '2026-10-09', end_date: '2026-10-13', duration_days: 3, progress: 20 },
      { id: `bcs-5`, baseline_id: baseCoreId, task_id: t5, start_date: '2026-10-13', end_date: '2026-10-21', duration_days: 7, progress: 0 },
      { id: `bcs-6`, baseline_id: baseCoreId, task_id: t6, start_date: '2026-10-22', end_date: '2026-10-30', duration_days: 7, progress: 0 },
      { id: `bcs-7`, baseline_id: baseCoreId, task_id: t7, start_date: '2026-10-31', end_date: '2026-11-10', duration_days: 7, progress: 0 },
      { id: `bcs-8`, baseline_id: baseCoreId, task_id: t8, start_date: '2026-11-12', end_date: '2026-11-12', duration_days: 0, progress: 0 }
    );

    // 10. Project Guest Scoped Access
    this.projectGuestAccess.push({
      id: 'pga-core-1',
      project_id: prjCoreId,
      tenant_id: coreId,
      email: 'guest@external-partner.com',
      user_id: guestUserId,
      access_level: 'view',
      created_at: '2026-12-31T23:59:59Z',
    });

    // 11. Metadata seeds
    this.seedTenantMetadata(coreId);
  }

  // --- SECURITY DEFINER SIMULATION METHODS ---

  public is_member_of(userId: string, tenantId: string): boolean {
    const user = this.users.find(u => u.id === userId);
    if (user?.is_superadmin) return true;
    return this.memberships.some(m => m.tenant_id === tenantId && m.user_id === userId);
  }

  public has_guest_project_access(userId: string, projectId: string): boolean {
    const user = this.users.find(u => u.id === userId);
    if (user?.is_superadmin) return true;

    const prj = this.projects.find(p => p.id === projectId);
    if (!prj) return false;

    // Check membership role
    const membership = this.memberships.find(m => m.tenant_id === prj.tenant_id && m.user_id === userId);
    if (membership && membership.role !== 'guest') return true;

    // Check explicit project guest access
    return this.projectGuestAccess.some(pga => pga.project_id === projectId && (pga.user_id === userId || (user && pga.email === user.email)));
  }

  public calculate_working_end_date(tenantId: string, startDate: string, durationDays: number): string {
    const tenant = this.tenants.find(t => t.id === tenantId);
    const weekends = tenant?.weekend_days || [0, 6];
    const hols = this.holidays.filter(h => h.tenant_id === tenantId);
    return calculate_working_end_date(tenantId, startDate, durationDays, weekends, hols);
  }

  // --- QUERY & MUTATION REPOSITORY METHODS ---

  public getTenantBySlugOrCode(val: string): Tenant | null {
    const term = val.toLowerCase();
    return this.tenants.find(t => t.slug.toLowerCase() === term || (t.tenant_code && t.tenant_code.toLowerCase() === term) || (t.code && t.code.toLowerCase() === term)) || null;
  }

  public getProjectsForUser(tenantId: string, userId: string, role: string): Project[] {
    const tenantProjects = this.projects.filter(p => p.tenant_id === tenantId && !p.is_archived);

    // Guest Scoping: Only return projects where the user is an explicit guest or member
    if (role === 'guest') {
      return tenantProjects.filter(p => this.has_guest_project_access(userId, p.id));
    }

    return tenantProjects;
  }

  public getProject(projectId: string, tenantId: string, userId: string, role: string): Project {
    const prj = this.projects.find(p => p.id === projectId && p.tenant_id === tenantId);
    if (!prj) {
      throw new EntityNotFoundException('Project', projectId);
    }

    if (role === 'guest' && !this.has_guest_project_access(userId, projectId)) {
      throw new GuestAccessViolationException(`project '${prj.name}'`);
    }

    return prj;
  }

  public getProjectTasksWithRelations(projectId: string, tenantId: string): Task[] {
    const projectTasks = this.tasks.filter(t => t.project_id === projectId && t.tenant_id === tenantId);

    return projectTasks.map(t => {
      const assignees = this.assignees
        .filter(a => a.task_id === t.id)
        .map(a => ({
          ...a,
          user: this.users.find(u => u.id === a.user_id),
        }));

      const preds = this.dependencies.filter(d => d.successor_id === t.id);
      const succs = this.dependencies.filter(d => d.predecessor_id === t.id);
      const subtasks = this.tasks.filter(sub => (sub.parent_task_id === t.id || sub.parent_id === t.id));

      return {
        ...t,
        assignees,
        // backward compatibility
        assignments: assignees.map(a => ({
          id: `${a.task_id}-${a.user_id}`,
          tenant_id: t.tenant_id,
          task_id: a.task_id,
          user_id: a.user_id,
          team_id: null,
          effort_percent: a.allocation_percent,
          created_at: a.created_at,
          user: a.user,
        })),
        predecessors: preds,
        successors: succs,
        subtasks,
      };
    });
  }

  public recalculateProjectCPM(projectId: string, tenantId: string): CPMResult {
    const projectTasks = this.tasks.filter(t => t.project_id === projectId && t.tenant_id === tenantId);
    const projectDeps = this.dependencies.filter(d => d.project_id === projectId && d.tenant_id === tenantId);
    const tenant = this.tenants.find(t => t.id === tenantId);
    const calendar = {
      working_days: tenant?.weekend_days ? [0, 1, 2, 3, 4, 5, 6].filter(d => !tenant.weekend_days?.includes(d)) : [1, 2, 3, 4, 5],
    };
    const projectHolidays = this.holidays.filter(h => h.tenant_id === tenantId);

    const cpm = calculateCPM(projectTasks, projectDeps, calendar, projectHolidays);

    for (const updated of cpm.tasks) {
      const idx = this.tasks.findIndex(t => t.id === updated.id);
      if (idx !== -1) {
        this.tasks[idx] = { ...this.tasks[idx], ...updated };
      }
    }

    return cpm;
  }

  public updateTask(
    taskId: string,
    updates: Partial<Task>,
    actorId: string,
    correlationId: string
  ): Task {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) {
      throw new EntityNotFoundException('Task', taskId);
    }

    const before = { ...this.tasks[idx] };
    this.tasks[idx] = { ...before, ...updates, updated_at: new Date().toISOString() };
    const after = this.tasks[idx];

    this.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      tenant_id: after.tenant_id,
      actor_id: actorId,
      action: 'UPDATE',
      entity_type: 'task',
      entity_id: taskId,
      diff_before: before as unknown as Record<string, unknown>,
      diff_after: after as unknown as Record<string, unknown>,
      correlation_id: correlationId,
      ip_address: '127.0.0.1',
      user_agent: 'PMS Web Client',
      created_at: new Date().toISOString(),
    });

    this.recalculateProjectCPM(after.project_id, after.tenant_id);
    return this.tasks[idx];
  }

  public createTask(
    taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'total_float' | 'is_critical' | 'early_start' | 'early_finish' | 'late_start' | 'late_finish'>,
    actorId: string,
    correlationId: string
  ): Task {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}`,
      early_start: taskData.start_date,
      early_finish: taskData.end_date,
      late_start: null,
      late_finish: null,
      total_float: 0,
      is_critical: false,
      sort_order: taskData.sort_order ?? this.tasks.length + 1,
      progress: taskData.progress ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.tasks.push(newTask);

    this.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      tenant_id: newTask.tenant_id,
      actor_id: actorId,
      action: 'INSERT',
      entity_type: 'task',
      entity_id: newTask.id,
      diff_before: null,
      diff_after: newTask as unknown as Record<string, unknown>,
      correlation_id: correlationId,
      ip_address: '127.0.0.1',
      user_agent: 'PMS Web Client',
      created_at: new Date().toISOString(),
    });

    this.recalculateProjectCPM(newTask.project_id, newTask.tenant_id);
    return newTask;
  }

  public addDependency(depData: Omit<TaskDependency, 'id' | 'created_at'>, actorId: string, correlationId: string): TaskDependency {
    const newDep: TaskDependency = {
      ...depData,
      id: `dep-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    this.dependencies.push(newDep);

    try {
      this.recalculateProjectCPM(newDep.project_id, newDep.tenant_id);
    } catch (err) {
      this.dependencies = this.dependencies.filter(d => d.id !== newDep.id);
      throw err;
    }

    this.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      tenant_id: newDep.tenant_id,
      actor_id: actorId,
      action: 'INSERT',
      entity_type: 'dependency',
      entity_id: newDep.id,
      diff_before: null,
      diff_after: newDep as unknown as Record<string, unknown>,
      correlation_id: correlationId,
      ip_address: '127.0.0.1',
      user_agent: 'PMS Web Client',
      created_at: new Date().toISOString(),
    });

    return newDep;
  }

  public removeDependency(depId: string, actorId: string, correlationId: string): boolean {
    const dep = this.dependencies.find(d => d.id === depId);
    if (!dep) return false;

    this.dependencies = this.dependencies.filter(d => d.id !== depId);

    this.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      tenant_id: dep.tenant_id,
      actor_id: actorId,
      action: 'DELETE',
      entity_type: 'dependency',
      entity_id: depId,
      diff_before: dep as unknown as Record<string, unknown>,
      diff_after: null,
      correlation_id: correlationId,
      ip_address: '127.0.0.1',
      user_agent: 'PMS Web Client',
      created_at: new Date().toISOString(),
    });

    this.recalculateProjectCPM(dep.project_id, dep.tenant_id);
    return true;
  }

  // --- PHASE 2 DYNAMIC METADATA REPOSITORY METHODS ---

  public seedTenantMetadata(tId: string): void {
    this.taskStatuses.push(
      { id: `st-backlog-${tId}`, tenant_id: tId, name: 'Backlog', slug: 'backlog', color_hex: '#64748b', badge_variant: 'secondary', position: 0, is_closed_state: false, is_default: false },
      { id: `st-todo-${tId}`, tenant_id: tId, name: 'To Do', slug: 'todo', color_hex: '#3b82f6', badge_variant: 'default', position: 1, is_closed_state: false, is_default: true },
      { id: `st-progress-${tId}`, tenant_id: tId, name: 'In Progress', slug: 'in_progress', color_hex: '#f59e0b', badge_variant: 'warning', position: 2, is_closed_state: false, is_default: false },
      { id: `st-review-${tId}`, tenant_id: tId, name: 'In Review', slug: 'review', color_hex: '#8b5cf6', badge_variant: 'secondary', position: 3, is_closed_state: false, is_default: false },
      { id: `st-done-${tId}`, tenant_id: tId, name: 'Done', slug: 'done', color_hex: '#10b981', badge_variant: 'success', position: 4, is_closed_state: true, is_default: false },
      { id: `st-blocked-${tId}`, tenant_id: tId, name: 'Blocked', slug: 'blocked', color_hex: '#ef4444', badge_variant: 'destructive', position: 5, is_closed_state: false, is_default: false }
    );
    this.taskPriorities.push(
      { id: `pr-low-${tId}`, tenant_id: tId, name: 'Low', slug: 'low', color_hex: '#64748b', urgency_weight: 1, icon_key: 'arrow-down', is_default: false },
      { id: `pr-medium-${tId}`, tenant_id: tId, name: 'Medium', slug: 'medium', color_hex: '#3b82f6', urgency_weight: 2, icon_key: 'minus', is_default: true },
      { id: `pr-high-${tId}`, tenant_id: tId, name: 'High', slug: 'high', color_hex: '#f59e0b', urgency_weight: 3, icon_key: 'arrow-up', is_default: false },
      { id: `pr-urgent-${tId}`, tenant_id: tId, name: 'Urgent', slug: 'urgent', color_hex: '#ef4444', urgency_weight: 4, icon_key: 'alert-triangle', is_default: false }
    );
    this.taskTypes.push(
      { id: `tt-task-${tId}`, tenant_id: tId, name: 'Task', slug: 'task', icon_key: 'check-square', is_default: true },
      { id: `tt-milestone-${tId}`, tenant_id: tId, name: 'Milestone', slug: 'milestone', icon_key: 'flag', is_default: false },
      { id: `tt-feature-${tId}`, tenant_id: tId, name: 'Feature', slug: 'feature', icon_key: 'sparkles', is_default: false }
    );
  }

  public getTenantTaskStatuses(tenantId: string): TenantTaskStatus[] {
    return this.taskStatuses
      .filter(s => s.tenant_id === tenantId)
      .sort((a, b) => a.position - b.position);
  }

  public createTenantTaskStatus(data: Omit<TenantTaskStatus, 'id' | 'created_at'>): TenantTaskStatus {
    const newStatus: TenantTaskStatus = {
      ...data,
      id: `stat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    this.taskStatuses.push(newStatus);
    return newStatus;
  }

  public updateTenantTaskStatus(statusId: string, updates: Partial<TenantTaskStatus>): TenantTaskStatus {
    const idx = this.taskStatuses.findIndex(s => s.id === statusId);
    if (idx === -1) throw new EntityNotFoundException('TaskStatus', statusId);
    this.taskStatuses[idx] = { ...this.taskStatuses[idx], ...updates };
    return this.taskStatuses[idx];
  }

  public deleteTenantTaskStatus(statusId: string): boolean {
    const beforeLen = this.taskStatuses.length;
    this.taskStatuses = this.taskStatuses.filter(s => s.id !== statusId);
    return this.taskStatuses.length < beforeLen;
  }

  public getTenantTaskPriorities(tenantId: string): TenantTaskPriority[] {
    return this.taskPriorities
      .filter(p => p.tenant_id === tenantId)
      .sort((a, b) => a.urgency_weight - b.urgency_weight);
  }

  public createTenantTaskPriority(data: Omit<TenantTaskPriority, 'id' | 'created_at'>): TenantTaskPriority {
    const newPriority: TenantTaskPriority = {
      ...data,
      id: `prio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    this.taskPriorities.push(newPriority);
    return newPriority;
  }

  public updateTenantTaskPriority(priorityId: string, updates: Partial<TenantTaskPriority>): TenantTaskPriority {
    const idx = this.taskPriorities.findIndex(p => p.id === priorityId);
    if (idx === -1) throw new EntityNotFoundException('TaskPriority', priorityId);
    this.taskPriorities[idx] = { ...this.taskPriorities[idx], ...updates };
    return this.taskPriorities[idx];
  }

  public deleteTenantTaskPriority(priorityId: string): boolean {
    const beforeLen = this.taskPriorities.length;
    this.taskPriorities = this.taskPriorities.filter(p => p.id !== priorityId);
    return this.taskPriorities.length < beforeLen;
  }

  public getTenantTaskTypes(tenantId: string): TenantTaskType[] {
    return this.taskTypes.filter(t => t.tenant_id === tenantId);
  }

  public createTenantTaskType(data: Omit<TenantTaskType, 'id' | 'created_at'>): TenantTaskType {
    const newType: TenantTaskType = {
      ...data,
      id: `type-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    this.taskTypes.push(newType);
    return newType;
  }

  // --- DYNAMIC THEMING METHODS ---

  public getSystemThemes(): SystemTheme[] {
    return this.systemThemes;
  }

  public updateSystemTheme(themeId: string, updates: Partial<SystemTheme>): SystemTheme {
    const idx = this.systemThemes.findIndex(t => t.id === themeId);
    if (idx === -1) throw new EntityNotFoundException('SystemTheme', themeId);
    this.systemThemes[idx] = { ...this.systemThemes[idx], ...updates };
    return this.systemThemes[idx];
  }

  public getTenantTheme(tenantId: string): ThemeTokens {
    const override = this.tenantThemeOverrides.find(o => o.tenant_id === tenantId);
    const activeThemeId = override?.active_theme_id || 'navy';
    const baseTheme = this.systemThemes.find(t => t.id === activeThemeId) || this.systemThemes[0];
    return {
      ...baseTheme.tokens_json,
      ...(override?.custom_tokens_json || {}),
    };
  }

  public setTenantTheme(tenantId: string, themeId: string, customTokens: Partial<ThemeTokens> = {}): TenantThemeOverride {
    const idx = this.tenantThemeOverrides.findIndex(o => o.tenant_id === tenantId);
    const updated: TenantThemeOverride = {
      id: idx !== -1 ? this.tenantThemeOverrides[idx].id : `theme-ovr-${Date.now()}`,
      tenant_id: tenantId,
      active_theme_id: themeId,
      custom_tokens_json: customTokens,
      updated_at: new Date().toISOString(),
    };
    if (idx !== -1) {
      this.tenantThemeOverrides[idx] = updated;
    } else {
      this.tenantThemeOverrides.push(updated);
    }
    return updated;
  }

  public createSystemTheme(theme: SystemTheme): SystemTheme {
    this.systemThemes.push(theme);
    return theme;
  }

  // --- CUSTOM FIELDS METHODS ---

  public getTenantCustomFields(tenantId: string, entityType?: 'project' | 'task'): TenantCustomField[] {
    return this.customFields
      .filter(f => f.tenant_id === tenantId && (!entityType || f.entity_type === entityType))
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  public createTenantCustomField(data: Omit<TenantCustomField, 'id' | 'created_at'>): TenantCustomField {
    const newField: TenantCustomField = {
      ...data,
      id: `cf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    this.customFields.push(newField);
    return newField;
  }

  public deleteTenantCustomField(fieldId: string): boolean {
    const beforeLen = this.customFields.length;
    this.customFields = this.customFields.filter(f => f.id !== fieldId);
    this.customFieldValues = this.customFieldValues.filter(v => v.field_id !== fieldId);
    return this.customFields.length < beforeLen;
  }


  public getEntityCustomFieldValues(entityId: string): Record<string, unknown> {
    const values = this.customFieldValues.filter(v => v.entity_id === entityId);
    const result: Record<string, unknown> = {};
    for (const val of values) {
      const field = this.customFields.find(f => f.id === val.field_id);
      if (field) {
        result[field.field_key] = val.value_json;
      }
    }
    return result;
  }

  public setEntityCustomFieldValue(entityId: string, fieldId: string, value: unknown, tenantId: string): EntityCustomFieldValue {
    const idx = this.customFieldValues.findIndex(v => v.entity_id === entityId && v.field_id === fieldId);
    const record: EntityCustomFieldValue = {
      id: idx !== -1 ? this.customFieldValues[idx].id : `cfv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId,
      entity_id: entityId,
      field_id: fieldId,
      value_json: value,
      updated_at: new Date().toISOString(),
    };
    if (idx !== -1) {
      this.customFieldValues[idx] = record;
    } else {
      this.customFieldValues.push(record);
    }
    return record;
  }

  // --- BASELINES & EARNED VALUE ---

  public createProjectBaseline(projectId: string, name: string, tenantId: string, createdBy: string, description?: string): ProjectBaseline {
    const newBaseline: ProjectBaseline = {
      id: `base-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: projectId,
      tenant_id: tenantId,
      name,
      description: description || null,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    };
    this.baselines.push(newBaseline);

    // Snapshot all current tasks in project
    const projectTasks = this.tasks.filter(t => t.project_id === projectId && t.tenant_id === tenantId);
    for (const t of projectTasks) {
      this.baselineSnapshots.push({
        id: `snap-${Date.now()}-${t.id}`,
        baseline_id: newBaseline.id,
        task_id: t.id,
        start_date: t.start_date,
        end_date: t.end_date,
        duration_days: t.duration_days,
        progress: t.progress ?? t.progress_percent ?? 0,
        created_at: new Date().toISOString(),
      });
    }

    return newBaseline;
  }

  public getProjectBaselines(projectId: string, tenantId: string): ProjectBaseline[] {
    return this.baselines.filter(b => b.project_id === projectId && b.tenant_id === tenantId);
  }

  public getBaselineSnapshots(baselineId: string): TaskBaselineSnapshot[] {
    return this.baselineSnapshots.filter(s => s.baseline_id === baselineId);
  }

  // --- NOTIFICATIONS METHODS ---

  public getUserNotifications(userId: string, tenantId: string): UserNotification[] {
    return this.notifications
      .filter(n => n.recipient_id === userId && n.tenant_id === tenantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public markNotificationRead(notificationId: string): boolean {
    const notif = this.notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.is_read = true;
      return true;
    }
    return false;
  }

  public markAllNotificationsRead(userId: string, tenantId: string): void {
    this.notifications
      .filter(n => n.recipient_id === userId && n.tenant_id === tenantId)
      .forEach(n => { n.is_read = true; });
  }

  public createNotification(data: Omit<UserNotification, 'id' | 'created_at' | 'is_read'>): UserNotification {
    const notif: UserNotification = {
      ...data,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    this.notifications.unshift(notif);
    return notif;
  }

  // --- ROLE PERMISSIONS METHODS ---

  public getTenantRolePermissions(tenantId: string): TenantRolePermission[] {
    return this.rolePermissions.filter(p => p.tenant_id === tenantId);
  }

  public updateRolePermission(tenantId: string, role: string, permissionKey: string, isGranted: boolean): TenantRolePermission {
    const idx = this.rolePermissions.findIndex(p => p.tenant_id === tenantId && p.role === role && p.permission_key === permissionKey);
    if (idx !== -1) {
      this.rolePermissions[idx].is_granted = isGranted;
      return this.rolePermissions[idx];
    } else {
      const newPerm: TenantRolePermission = {
        id: `perm-${Date.now()}`,
        tenant_id: tenantId,
        role,
        permission_key: permissionKey,
        is_granted: isGranted,
      };
      this.rolePermissions.push(newPerm);
      return newPerm;
    }
  }

  public hasPermission(tenantId: string, role: string, permissionKey: string): boolean {
    if (role === 'owner' || role === 'superadmin') return true;
    const perm = this.rolePermissions.find(p => p.tenant_id === tenantId && p.role === role && p.permission_key === permissionKey);
    return perm ? perm.is_granted : false;
  }
}

export const db = new DatabaseStore();
