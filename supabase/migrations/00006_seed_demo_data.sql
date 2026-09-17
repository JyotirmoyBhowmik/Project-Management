-- ==============================================================================
-- 00006_seed_demo_data.sql
-- High-fidelity enterprise seed dataset with multi-tenant companies,
-- working calendars, project hierarchies (4 levels), CPM dependencies, and roles.
-- ==============================================================================

DO $$
DECLARE
    tenant_acme_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
    tenant_globex_id UUID := 'a0000000-0000-0000-0000-000000000002'::UUID;

    user_super_id UUID := 'b0000000-0000-0000-0000-000000000001'::UUID;
    user_acme_admin UUID := 'b0000000-0000-0000-0000-000000000002'::UUID;
    user_acme_pm UUID := 'b0000000-0000-0000-0000-000000000003'::UUID;
    user_acme_dev1 UUID := 'b0000000-0000-0000-0000-000000000004'::UUID;
    user_acme_dev2 UUID := 'b0000000-0000-0000-0000-000000000005'::UUID;
    user_guest UUID := 'b0000000-0000-0000-0000-000000000006'::UUID;

    cal_acme_id UUID := 'c0000000-0000-0000-0000-000000000001'::UUID;
    cal_me_id UUID := 'c0000000-0000-0000-0000-000000000002'::UUID;

    prj_erp_id UUID := 'd0000000-0000-0000-0000-000000000001'::UUID;
    prj_soc2_id UUID := 'd0000000-0000-0000-0000-000000000002'::UUID;

    ph1_id UUID := 'e0000000-0000-0000-0000-000000000001'::UUID;
    ph2_id UUID := 'e0000000-0000-0000-0000-000000000002'::UUID;
    ph3_id UUID := 'e0000000-0000-0000-0000-000000000003'::UUID;
    ph4_id UUID := 'e0000000-0000-0000-0000-000000000004'::UUID;

    t1_id UUID := 'f0000000-0000-0000-0000-000000000001'::UUID;
    t2_id UUID := 'f0000000-0000-0000-0000-000000000002'::UUID;
    t3_id UUID := 'f0000000-0000-0000-0000-000000000003'::UUID;
    t4_id UUID := 'f0000000-0000-0000-0000-000000000004'::UUID;
    t5_id UUID := 'f0000000-0000-0000-0000-000000000005'::UUID;
    t6_id UUID := 'f0000000-0000-0000-0000-000000000006'::UUID;
    t7_id UUID := 'f0000000-0000-0000-0000-000000000007'::UUID;
    t8_id UUID := 'f0000000-0000-0000-0000-000000000008'::UUID;
BEGIN
    -- 1. Insert Tenants
    INSERT INTO tenants (id, name, slug, code, domain, status, branding_json, storage_quota_mb)
    VALUES
    (tenant_acme_id, 'Acme Corporation', 'acme-corp', 'ACME-CORP', 'acme.pms.internal', 'active', '{"primary_color": "#2563eb", "theme_preset": "navy", "company_tagline": "Industrial Engineering & SaaS"}', 10240),
    (tenant_globex_id, 'Globex Industries', 'globex', 'GLOBEX', 'globex.pms.internal', 'active', '{"primary_color": "#059669", "theme_preset": "monokai", "company_tagline": "Global Logistics & Innovations"}', 5120)
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert User Profiles
    INSERT INTO user_profiles (id, email, full_name, avatar_url, is_superadmin)
    VALUES
    (user_super_id, 'superadmin@system.global', 'Alexander Thorne (SuperAdmin)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', TRUE),
    (user_acme_admin, 'admin@acme.com', 'Sarah Connor (Tenant Admin)', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', FALSE),
    (user_acme_pm, 'pm@acme.com', 'David Miller (Lead PM)', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', FALSE),
    (user_acme_dev1, 'elena@acme.com', 'Elena Rostova (Staff Architect)', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop', FALSE),
    (user_acme_dev2, 'marcus@acme.com', 'Marcus Vance (Frontend Lead)', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop', FALSE),
    (user_guest, 'auditor@partner.org', 'Liam Vance (Scoped External Auditor)', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', FALSE)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Tenant Memberships (Cross-tenant memberships)
    INSERT INTO tenant_memberships (tenant_id, user_id, role, is_active)
    VALUES
    (tenant_acme_id, user_super_id, 'superadmin', TRUE),
    (tenant_acme_id, user_acme_admin, 'tenant_admin', TRUE),
    (tenant_acme_id, user_acme_pm, 'project_manager', TRUE),
    (tenant_acme_id, user_acme_dev1, 'contributor', TRUE),
    (tenant_acme_id, user_acme_dev2, 'contributor', TRUE),
    (tenant_acme_id, user_guest, 'guest', TRUE),
    -- Globex Memberships
    (tenant_globex_id, user_super_id, 'superadmin', TRUE),
    (tenant_globex_id, user_acme_admin, 'contributor', TRUE)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

    -- 4. Working Calendars
    INSERT INTO working_calendars (id, tenant_id, name, description, is_default, week_start_day, working_days, daily_working_hours)
    VALUES
    (cal_acme_id, tenant_acme_id, 'US Corporate Standard', 'Standard Monday to Friday 40h/week schedule', TRUE, 1, '[1,2,3,4,5]'::jsonb, 8.00),
    (cal_me_id, tenant_acme_id, 'Middle East Region', 'Sunday to Thursday schedule', FALSE, 0, '[0,1,2,3,4]'::jsonb, 8.00)
    ON CONFLICT (tenant_id, name) DO NOTHING;

    -- 5. Calendar Holidays
    INSERT INTO calendar_holidays (tenant_id, calendar_id, name, date, is_recurring)
    VALUES
    (tenant_acme_id, cal_acme_id, 'New Year Holiday', '2026-01-01', TRUE),
    (tenant_acme_id, cal_acme_id, 'Memorial Day', '2026-05-25', TRUE),
    (tenant_acme_id, cal_acme_id, 'Independence Day', '2026-07-03', TRUE),
    (tenant_acme_id, cal_acme_id, 'Labor Day', '2026-09-07', TRUE),
    (tenant_acme_id, cal_acme_id, 'Thanksgiving Day', '2026-11-26', TRUE),
    (tenant_acme_id, cal_acme_id, 'Christmas Day', '2026-12-25', TRUE)
    ON CONFLICT (calendar_id, date) DO NOTHING;

    -- 6. Projects
    INSERT INTO projects (id, tenant_id, name, code, description, status, start_date, target_end_date, calendar_id, created_by)
    VALUES
    (prj_erp_id, tenant_acme_id, 'Next-Gen Cloud ERP & PMS Platform', 'PRJ-ERP-01', 'Multi-tenant enterprise scheduling and resource management system deployment.', 'active', '2026-10-01', '2026-12-15', cal_acme_id, user_acme_pm),
    (prj_soc2_id, tenant_acme_id, 'SOC2 Type II Annual Compliance Audit', 'PRJ-SEC-02', 'Comprehensive penetration testing, audit trail compliance, and vendor assessments.', 'planning', '2026-11-01', '2027-01-30', cal_acme_id, user_acme_pm)
    ON CONFLICT (tenant_id, code) DO NOTHING;

    -- 7. Scoped Guest Access: Guest only gets access to PRJ-ERP-01
    INSERT INTO project_members (tenant_id, project_id, user_id, role)
    VALUES
    (tenant_acme_id, prj_erp_id, user_acme_pm, 'lead'),
    (tenant_acme_id, prj_erp_id, user_acme_dev1, 'editor'),
    (tenant_acme_id, prj_erp_id, user_acme_dev2, 'editor'),
    (tenant_acme_id, prj_erp_id, user_guest, 'guest') -- Scoped Guest
    ON CONFLICT (project_id, user_id) DO NOTHING;

    -- 8. Phases for PRJ-ERP-01
    INSERT INTO phases (id, tenant_id, project_id, name, order_index, color, start_date, end_date)
    VALUES
    (ph1_id, tenant_acme_id, prj_erp_id, 'Phase 1: Architecture & DB Specs', 1, '#3b82f6', '2026-10-01', '2026-10-14'),
    (ph2_id, tenant_acme_id, prj_erp_id, 'Phase 2: Scheduling & CPM Engines', 2, '#8b5cf6', '2026-10-15', '2026-11-04'),
    (ph3_id, tenant_acme_id, prj_erp_id, 'Phase 3: Interactive SVG Gantt & Canvas', 3, '#10b981', '2026-11-05', '2026-11-25'),
    (ph4_id, tenant_acme_id, prj_erp_id, 'Phase 4: QA, Security & Vercel Launch', 4, '#f59e0b', '2026-11-26', '2026-12-15')
    ON CONFLICT (id) DO NOTHING;

    -- 9. Tasks with Hierarchical Nesting & CPM Attributes
    INSERT INTO tasks (
        id, tenant_id, project_id, phase_id, parent_id, title, description,
        status, priority, start_date, end_date, duration_days, progress_percent,
        is_milestone, early_start, early_finish, late_start, late_finish, total_float, is_critical, order_index
    ) VALUES
    -- T1 (Phase 1, Critical)
    (t1_id, tenant_acme_id, prj_erp_id, ph1_id, NULL, 'Multi-Tenant DB Schema & RLS Matrix', 'Design strict tenant_id isolation policies and pgcrypto secrets table', 'completed', 'urgent', '2026-10-01', '2026-10-07', 5, 100, FALSE, '2026-10-01', '2026-10-07', '2026-10-01', '2026-10-07', 0, TRUE, 1),

    -- T2 (Phase 1, Nested under T1, Critical)
    (t2_id, tenant_acme_id, prj_erp_id, ph1_id, t1_id, 'Postgres Performance Tuning & Trigram Indexes', 'Configure pg_trgm for fuzzy search and audit triggers', 'completed', 'high', '2026-10-08', '2026-10-14', 5, 100, FALSE, '2026-10-08', '2026-10-14', '2026-10-08', '2026-10-14', 0, TRUE, 2),

    -- T3 (Phase 2, Critical)
    (t3_id, tenant_acme_id, prj_erp_id, ph2_id, NULL, 'CPM Forward/Backward Pass Engine', 'Implement topological sort, float calculator, and cycle detection', 'in_progress', 'urgent', '2026-10-15', '2026-10-23', 7, 65, FALSE, '2026-10-15', '2026-10-23', '2026-10-15', '2026-10-23', 0, TRUE, 3),

    -- T4 (Phase 2, Parallel non-critical path, float=4)
    (t4_id, tenant_acme_id, prj_erp_id, ph2_id, NULL, 'Working Days & Regional Calendar Engine', 'Calculate weekend skip and floating/recurring holidays', 'in_progress', 'medium', '2026-10-15', '2026-10-21', 5, 80, FALSE, '2026-10-15', '2026-10-21', '2026-10-19', '2026-10-27', 4, FALSE, 4),

    -- T5 (Phase 2, Milestone)
    (t5_id, tenant_acme_id, prj_erp_id, ph2_id, NULL, 'Milestone: Scheduling Core Benchmark Passed', 'Verification of scheduling engine on 10,000 node DAG', 'todo', 'high', '2026-10-26', '2026-10-26', 0, 0, TRUE, '2026-10-26', '2026-10-26', '2026-10-26', '2026-10-26', 0, TRUE, 5),

    -- T6 (Phase 3, Critical)
    (t6_id, tenant_acme_id, prj_erp_id, ph3_id, NULL, 'Interactive SVG Gantt & Drag Dependency Engine', 'Pure SVG timeline with drag handles, snapping, and bezier connectors', 'todo', 'urgent', '2026-10-27', '2026-11-13', 14, 0, FALSE, '2026-10-27', '2026-11-13', '2026-10-27', '2026-11-13', 0, TRUE, 6),

    -- T7 (Phase 3, Parallel path)
    (t7_id, tenant_acme_id, prj_erp_id, ph3_id, NULL, 'Synchronized Kanban & Hierarchical Grid Views', 'Card movement with optimistic TanStack Query cache updates', 'todo', 'medium', '2026-11-02', '2026-11-16', 10, 0, FALSE, '2026-11-02', '2026-11-16', '2026-11-04', '2026-11-18', 2, FALSE, 7),

    -- T8 (Phase 4, Critical)
    (t8_id, tenant_acme_id, prj_erp_id, ph4_id, NULL, 'Vercel Deployment & Triple-Layer Test Suite', 'End-to-end integration, RLS penetration testing, and Vercel build', 'todo', 'urgent', '2026-11-16', '2026-12-04', 15, 0, FALSE, '2026-11-16', '2026-12-04', '2026-11-16', '2026-12-04', 0, TRUE, 8)
    ON CONFLICT (id) DO NOTHING;

    -- 10. Multi-User Task Assignments (with effort percentage)
    INSERT INTO task_assignments (tenant_id, task_id, user_id, effort_percent)
    VALUES
    (tenant_acme_id, t1_id, user_acme_dev1, 100.00),
    (tenant_acme_id, t2_id, user_acme_dev1, 60.00),
    (tenant_acme_id, t2_id, user_acme_dev2, 40.00),
    (tenant_acme_id, t3_id, user_acme_dev1, 80.00),
    (tenant_acme_id, t4_id, user_acme_dev2, 100.00),
    (tenant_acme_id, t6_id, user_acme_dev2, 100.00),
    (tenant_acme_id, t7_id, user_acme_dev1, 50.00),
    (tenant_acme_id, t7_id, user_acme_dev2, 50.00),
    (tenant_acme_id, t8_id, user_acme_pm, 100.00)
    ON CONFLICT DO NOTHING;

    -- 11. Task Dependencies (Precedence Diagramming: FS, SS, FF with lag)
    INSERT INTO task_dependencies (tenant_id, project_id, predecessor_id, successor_id, type, lag_days)
    VALUES
    (tenant_acme_id, prj_erp_id, t1_id, t2_id, 'FS', 0),
    (tenant_acme_id, prj_erp_id, t2_id, t3_id, 'FS', 0),
    (tenant_acme_id, prj_erp_id, t2_id, t4_id, 'SS', 1),
    (tenant_acme_id, prj_erp_id, t3_id, t5_id, 'FS', 0),
    (tenant_acme_id, prj_erp_id, t5_id, t6_id, 'FS', 0),
    (tenant_acme_id, prj_erp_id, t5_id, t7_id, 'SS', 2),
    (tenant_acme_id, prj_erp_id, t6_id, t8_id, 'FS', 0),
    (tenant_acme_id, prj_erp_id, t7_id, t8_id, 'FF', 0)
    ON CONFLICT (project_id, predecessor_id, successor_id) DO NOTHING;

END $$;
