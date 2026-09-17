// ==============================================================================
// src/lib/supabase/mock-db.ts
// Enterprise In-Memory Database Adapter & Fallback Provider
// Reflects migrations 00001 - 00006 for zero-config local execution & tests.
// ==============================================================================

import {
  Tenant,
  UserProfile,
  TenantMembership,
  WorkingCalendar,
  CalendarHoliday,
  Project,
  ProjectMember,
  Phase,
  Task,
  TaskAssignment,
  TaskDependency,
  AuditLog,
} from '@/types/database';
import { calculateCPM, CPMResult } from '../cpm/cpm-engine';
import { EntityNotFoundException, GuestAccessViolationException } from '../error/domain-errors';

class DatabaseStore {
  public tenants: Tenant[] = [];
  public users: UserProfile[] = [];
  public memberships: TenantMembership[] = [];
  public calendars: WorkingCalendar[] = [];
  public holidays: CalendarHoliday[] = [];
  public projects: Project[] = [];
  public projectMembers: ProjectMember[] = [];
  public phases: Phase[] = [];
  public tasks: Task[] = [];
  public assignments: TaskAssignment[] = [];
  public dependencies: TaskDependency[] = [];
  public auditLogs: AuditLog[] = [];

  constructor() {
    this.seed();
  }

  public seed() {
    // 1. Tenants
    this.tenants = [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Acme Corporation',
        slug: 'acme-corp',
        code: 'ACME-CORP',
        domain: 'acme.pms.internal',
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
        code: 'GLOBEX',
        domain: 'globex.pms.internal',
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
    ];

    // 2. Users
    this.users = [
      {
        id: 'b0000000-0000-0000-0000-000000000001',
        email: 'superadmin@system.global',
        full_name: 'Alexander Thorne (SuperAdmin)',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        is_superadmin: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000002',
        email: 'admin@acme.com',
        full_name: 'Sarah Connor (Tenant Admin)',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000003',
        email: 'pm@acme.com',
        full_name: 'David Miller (Lead PM)',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000004',
        email: 'elena@acme.com',
        full_name: 'Elena Rostova (Staff Architect)',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000005',
        email: 'marcus@acme.com',
        full_name: 'Marcus Vance (Frontend Lead)',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'b0000000-0000-0000-0000-000000000006',
        email: 'auditor@partner.org',
        full_name: 'Liam Vance (Scoped Guest)',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
        is_superadmin: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    // 3. Memberships
    const acmeId = this.tenants[0].id;
    const globexId = this.tenants[1].id;

    this.memberships = [
      { id: 'm1', tenant_id: acmeId, user_id: this.users[0].id, role: 'superadmin', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'm2', tenant_id: acmeId, user_id: this.users[1].id, role: 'tenant_admin', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'm3', tenant_id: acmeId, user_id: this.users[2].id, role: 'project_manager', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'm4', tenant_id: acmeId, user_id: this.users[3].id, role: 'contributor', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'm5', tenant_id: acmeId, user_id: this.users[4].id, role: 'contributor', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'm6', tenant_id: acmeId, user_id: this.users[5].id, role: 'guest', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'm7', tenant_id: globexId, user_id: this.users[0].id, role: 'superadmin', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 'm8', tenant_id: globexId, user_id: this.users[1].id, role: 'contributor', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ];

    // 4. Calendars & Holidays
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
      { id: 'h1', tenant_id: acmeId, calendar_id: calId, name: 'New Year Holiday', date: '2026-01-01', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h2', tenant_id: acmeId, calendar_id: calId, name: 'Memorial Day', date: '2026-05-25', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h3', tenant_id: acmeId, calendar_id: calId, name: 'Independence Day', date: '2026-07-03', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h4', tenant_id: acmeId, calendar_id: calId, name: 'Labor Day', date: '2026-09-07', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h5', tenant_id: acmeId, calendar_id: calId, name: 'Thanksgiving Day', date: '2026-11-26', is_recurring: true, created_at: '2026-01-01' },
      { id: 'h6', tenant_id: acmeId, calendar_id: calId, name: 'Christmas Day', date: '2026-12-25', is_recurring: true, created_at: '2026-01-01' },
    ];

    // 5. Projects
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

    // Project Members (Scoped Guest: user 5 only has access to prjId)
    this.projectMembers = [
      { id: 'pm1', tenant_id: acmeId, project_id: prjId, user_id: this.users[2].id, role: 'lead', created_at: '2026-01-01' },
      { id: 'pm2', tenant_id: acmeId, project_id: prjId, user_id: this.users[3].id, role: 'editor', created_at: '2026-01-01' },
      { id: 'pm3', tenant_id: acmeId, project_id: prjId, user_id: this.users[4].id, role: 'editor', created_at: '2026-01-01' },
      { id: 'pm4', tenant_id: acmeId, project_id: prjId, user_id: this.users[5].id, role: 'guest', created_at: '2026-01-01' },
    ];

    // Phases
    const ph1 = 'e0000000-0000-0000-0000-000000000001';
    const ph2 = 'e0000000-0000-0000-0000-000000000002';
    const ph3 = 'e0000000-0000-0000-0000-000000000003';
    const ph4 = 'e0000000-0000-0000-0000-000000000004';
    this.phases = [
      { id: ph1, tenant_id: acmeId, project_id: prjId, name: 'Phase 1: Architecture & DB Specs', order_index: 1, color: '#3b82f6', start_date: '2026-10-01', end_date: '2026-10-14', created_at: '2026-01-01' },
      { id: ph2, tenant_id: acmeId, project_id: prjId, name: 'Phase 2: Scheduling & CPM Engines', order_index: 2, color: '#8b5cf6', start_date: '2026-10-15', end_date: '2026-11-04', created_at: '2026-01-01' },
      { id: ph3, tenant_id: acmeId, project_id: prjId, name: 'Phase 3: Interactive SVG Gantt & Canvas', order_index: 3, color: '#10b981', start_date: '2026-11-05', end_date: '2026-11-25', created_at: '2026-01-01' },
      { id: ph4, tenant_id: acmeId, project_id: prjId, name: 'Phase 4: QA, Security & Vercel Launch', order_index: 4, color: '#f59e0b', start_date: '2026-11-26', end_date: '2026-12-15', created_at: '2026-01-01' },
    ];

    // Tasks
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
        parent_id: null,
        title: 'Multi-Tenant DB Schema & RLS Matrix',
        description: 'Design strict tenant_id isolation policies and pgcrypto secrets table',
        status: 'completed',
        priority: 'urgent',
        start_date: '2026-10-01',
        end_date: '2026-10-07',
        duration_days: 5,
        progress_percent: 100,
        is_milestone: false,
        early_start: '2026-10-01',
        early_finish: '2026-10-07',
        late_start: '2026-10-01',
        late_finish: '2026-10-07',
        total_float: 0,
        free_float: 0,
        is_critical: true,
        order_index: 1,
        created_by: this.users[3].id,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t2,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph1,
        parent_id: t1,
        title: 'Postgres Performance Tuning & Trigram Indexes',
        description: 'Configure pg_trgm for fuzzy search and audit triggers',
        status: 'completed',
        priority: 'high',
        start_date: '2026-10-08',
        end_date: '2026-10-14',
        duration_days: 5,
        progress_percent: 100,
        is_milestone: false,
        early_start: '2026-10-08',
        early_finish: '2026-10-14',
        late_start: '2026-10-08',
        late_finish: '2026-10-14',
        total_float: 0,
        free_float: 0,
        is_critical: true,
        order_index: 2,
        created_by: this.users[3].id,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t3,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph2,
        parent_id: null,
        title: 'CPM Forward/Backward Pass Engine',
        description: 'Implement topological sort, float calculator, and cycle detection',
        status: 'in_progress',
        priority: 'urgent',
        start_date: '2026-10-15',
        end_date: '2026-10-23',
        duration_days: 7,
        progress_percent: 65,
        is_milestone: false,
        early_start: '2026-10-15',
        early_finish: '2026-10-23',
        late_start: '2026-10-15',
        late_finish: '2026-10-23',
        total_float: 0,
        free_float: 0,
        is_critical: true,
        order_index: 3,
        created_by: this.users[3].id,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t4,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph2,
        parent_id: null,
        title: 'Working Days & Regional Calendar Engine',
        description: 'Calculate weekend skip and floating/recurring holidays',
        status: 'in_progress',
        priority: 'medium',
        start_date: '2026-10-15',
        end_date: '2026-10-21',
        duration_days: 5,
        progress_percent: 80,
        is_milestone: false,
        early_start: '2026-10-15',
        early_finish: '2026-10-21',
        late_start: '2026-10-19',
        late_finish: '2026-10-27',
        total_float: 4,
        free_float: 0,
        is_critical: false,
        order_index: 4,
        created_by: this.users[4].id,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t5,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph2,
        parent_id: null,
        title: 'Milestone: Scheduling Core Benchmark Passed',
        description: 'Verification of scheduling engine on 10,000 node DAG',
        status: 'todo',
        priority: 'high',
        start_date: '2026-10-26',
        end_date: '2026-10-26',
        duration_days: 0,
        progress_percent: 0,
        is_milestone: true,
        early_start: '2026-10-26',
        early_finish: '2026-10-26',
        late_start: '2026-10-26',
        late_finish: '2026-10-26',
        total_float: 0,
        free_float: 0,
        is_critical: true,
        order_index: 5,
        created_by: this.users[2].id,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t6,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph3,
        parent_id: null,
        title: 'Interactive SVG Gantt & Drag Dependency Engine',
        description: 'Pure SVG timeline with drag handles, snapping, and bezier connectors',
        status: 'todo',
        priority: 'urgent',
        start_date: '2026-10-27',
        end_date: '2026-11-13',
        duration_days: 14,
        progress_percent: 0,
        is_milestone: false,
        early_start: '2026-10-27',
        early_finish: '2026-11-13',
        late_start: '2026-10-27',
        late_finish: '2026-11-13',
        total_float: 0,
        free_float: 0,
        is_critical: true,
        order_index: 6,
        created_by: this.users[4].id,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t7,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph3,
        parent_id: null,
        title: 'Synchronized Kanban & Hierarchical Grid Views',
        description: 'Card movement with optimistic TanStack Query cache updates',
        status: 'todo',
        priority: 'medium',
        start_date: '2026-11-02',
        end_date: '2026-11-16',
        duration_days: 10,
        progress_percent: 0,
        is_milestone: false,
        early_start: '2026-11-02',
        early_finish: '2026-11-16',
        late_start: '2026-11-04',
        late_finish: '2026-11-18',
        total_float: 2,
        free_float: 0,
        is_critical: false,
        order_index: 7,
        created_by: this.users[3].id,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: t8,
        tenant_id: acmeId,
        project_id: prjId,
        phase_id: ph4,
        parent_id: null,
        title: 'Vercel Deployment & Triple-Layer Test Suite',
        description: 'End-to-end integration, RLS penetration testing, and Vercel build',
        status: 'todo',
        priority: 'urgent',
        start_date: '2026-11-16',
        end_date: '2026-12-04',
        duration_days: 15,
        progress_percent: 0,
        is_milestone: false,
        early_start: '2026-11-16',
        early_finish: '2026-12-04',
        late_start: '2026-11-16',
        late_finish: '2026-12-04',
        total_float: 0,
        free_float: 0,
        is_critical: true,
        order_index: 8,
        created_by: this.users[2].id,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ];

    // Dependencies
    this.dependencies = [
      { id: 'dep1', tenant_id: acmeId, project_id: prjId, predecessor_id: t1, successor_id: t2, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep2', tenant_id: acmeId, project_id: prjId, predecessor_id: t2, successor_id: t3, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep3', tenant_id: acmeId, project_id: prjId, predecessor_id: t2, successor_id: t4, type: 'SS', lag_days: 1, created_at: '2026-01-01' },
      { id: 'dep4', tenant_id: acmeId, project_id: prjId, predecessor_id: t3, successor_id: t5, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep5', tenant_id: acmeId, project_id: prjId, predecessor_id: t5, successor_id: t6, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep6', tenant_id: acmeId, project_id: prjId, predecessor_id: t5, successor_id: t7, type: 'SS', lag_days: 2, created_at: '2026-01-01' },
      { id: 'dep7', tenant_id: acmeId, project_id: prjId, predecessor_id: t6, successor_id: t8, type: 'FS', lag_days: 0, created_at: '2026-01-01' },
      { id: 'dep8', tenant_id: acmeId, project_id: prjId, predecessor_id: t7, successor_id: t8, type: 'FF', lag_days: 0, created_at: '2026-01-01' },
    ];

    // Assignments
    this.assignments = [
      { id: 'a1', tenant_id: acmeId, task_id: t1, user_id: this.users[3].id, team_id: null, effort_percent: 100, created_at: '2026-01-01' },
      { id: 'a2', tenant_id: acmeId, task_id: t2, user_id: this.users[3].id, team_id: null, effort_percent: 60, created_at: '2026-01-01' },
      { id: 'a3', tenant_id: acmeId, task_id: t2, user_id: this.users[4].id, team_id: null, effort_percent: 40, created_at: '2026-01-01' },
      { id: 'a4', tenant_id: acmeId, task_id: t3, user_id: this.users[3].id, team_id: null, effort_percent: 80, created_at: '2026-01-01' },
      { id: 'a5', tenant_id: acmeId, task_id: t4, user_id: this.users[4].id, team_id: null, effort_percent: 100, created_at: '2026-01-01' },
      { id: 'a6', tenant_id: acmeId, task_id: t6, user_id: this.users[4].id, team_id: null, effort_percent: 100, created_at: '2026-01-01' },
      { id: 'a7', tenant_id: acmeId, task_id: t7, user_id: this.users[3].id, team_id: null, effort_percent: 50, created_at: '2026-01-01' },
      { id: 'a8', tenant_id: acmeId, task_id: t7, user_id: this.users[4].id, team_id: null, effort_percent: 50, created_at: '2026-01-01' },
      { id: 'a9', tenant_id: acmeId, task_id: t8, user_id: this.users[2].id, team_id: null, effort_percent: 100, created_at: '2026-01-01' },
    ];

    // Audit Logs
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
  }

  // --- QUERY & MUTATION REPOSITORY METHODS ---

  public getTenantBySlugOrCode(val: string): Tenant | null {
    const term = val.toLowerCase();
    return this.tenants.find(t => t.slug.toLowerCase() === term || t.code.toLowerCase() === term) || null;
  }

  public getProjectsForUser(tenantId: string, userId: string, role: string): Project[] {
    const tenantProjects = this.projects.filter(p => p.tenant_id === tenantId && !p.is_archived);

    // Guest Scoping: Only return projects where the user is an explicit member
    if (role === 'guest') {
      const allowedIds = new Set(
        this.projectMembers.filter(pm => pm.tenant_id === tenantId && pm.user_id === userId).map(pm => pm.project_id)
      );
      return tenantProjects.filter(p => allowedIds.has(p.id));
    }

    return tenantProjects;
  }

  public getProject(projectId: string, tenantId: string, userId: string, role: string): Project {
    const prj = this.projects.find(p => p.id === projectId && p.tenant_id === tenantId);
    if (!prj) {
      throw new EntityNotFoundException('Project', projectId);
    }

    if (role === 'guest') {
      const isMember = this.projectMembers.some(pm => pm.project_id === projectId && pm.user_id === userId);
      if (!isMember) {
        throw new GuestAccessViolationException(`project '${prj.name}'`);
      }
    }

    return prj;
  }

  public getProjectTasksWithRelations(projectId: string, tenantId: string): Task[] {
    const projectTasks = this.tasks.filter(t => t.project_id === projectId && t.tenant_id === tenantId);

    return projectTasks.map(t => {
      const assignments = this.assignments
        .filter(a => a.task_id === t.id)
        .map(a => ({
          ...a,
          user: this.users.find(u => u.id === a.user_id),
        }));

      const preds = this.dependencies.filter(d => d.successor_id === t.id);
      const succs = this.dependencies.filter(d => d.predecessor_id === t.id);
      const subtasks = this.tasks.filter(sub => sub.parent_id === t.id);

      return {
        ...t,
        assignments,
        predecessors: preds,
        successors: succs,
        subtasks,
      };
    });
  }

  public recalculateProjectCPM(projectId: string, tenantId: string): CPMResult {
    const projectTasks = this.tasks.filter(t => t.project_id === projectId && t.tenant_id === tenantId);
    const projectDeps = this.dependencies.filter(d => d.project_id === projectId && d.tenant_id === tenantId);
    const calendar = this.calendars.find(c => c.tenant_id === tenantId) || { working_days: [1, 2, 3, 4, 5] };
    const projectHolidays = this.holidays.filter(h => h.tenant_id === tenantId);

    const cpm = calculateCPM(projectTasks, projectDeps, calendar, projectHolidays);

    // Update internal tasks with newly calculated CPM dates and critical flags
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

    // Log Audit mutation
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

    // Re-run CPM calculation for affected project
    this.recalculateProjectCPM(after.project_id, after.tenant_id);

    return this.tasks[idx];
  }

  public createTask(taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'total_float' | 'free_float' | 'is_critical' | 'early_start' | 'early_finish' | 'late_start' | 'late_finish'>, actorId: string, correlationId: string): Task {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}`,
      early_start: taskData.start_date,
      early_finish: taskData.end_date,
      late_start: null,
      late_finish: null,
      total_float: 0,
      free_float: 0,
      is_critical: false,
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

    // Recalculate CPM (will throw DependencyCycleException if a loop is created)
    try {
      this.recalculateProjectCPM(newDep.project_id, newDep.tenant_id);
    } catch (err) {
      // Revert if cycle detected
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
}

// Global Singleton instance for application runtime
export const db = new DatabaseStore();
