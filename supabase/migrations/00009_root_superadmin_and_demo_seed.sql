-- ==============================================================================
-- 00009_root_superadmin_and_demo_seed.sql
-- Phase 3: Root SuperAdmin Provisioning & Operational Demo Dataset
-- Root Admin: admin@jyotirmoyb.com
-- Default Workspace: Enterprise Core (code: CORE-SYS, slug: core)
-- ==============================================================================

DO $$
DECLARE
    super_admin_id UUID := 'b0000000-0000-0000-0000-000000000099'::UUID;
    guest_user_id UUID := 'b0000000-0000-0000-0000-000000000098'::UUID;
    engineer_user_id UUID := 'b0000000-0000-0000-0000-000000000097'::UUID;
    devops_user_id UUID := 'b0000000-0000-0000-0000-000000000096'::UUID;

    tenant_core_id UUID := 'a0000000-0000-0000-0000-000000000003'::UUID;
    cal_core_id UUID := 'c0000000-0000-0000-0000-000000000003'::UUID;
    team_platform_id UUID := 'a0000000-0000-0000-0000-000000000011'::UUID;
    team_ops_id UUID := 'a0000000-0000-0000-0000-000000000012'::UUID;

    prj_modernize_id UUID := 'd0000000-0000-0000-0000-000000000003'::UUID;
    ph1_id UUID := 'e0000000-0000-0000-0000-000000000011'::UUID;
    ph2_id UUID := 'e0000000-0000-0000-0000-000000000012'::UUID;
    ph3_id UUID := 'e0000000-0000-0000-0000-000000000013'::UUID;

    t1_id UUID := 'f0000000-0000-0000-0000-000000000011'::UUID;
    t2_id UUID := 'f0000000-0000-0000-0000-000000000012'::UUID;
    t3_id UUID := 'f0000000-0000-0000-0000-000000000013'::UUID;
    t4_id UUID := 'f0000000-0000-0000-0000-000000000014'::UUID;
    t5_id UUID := 'f0000000-0000-0000-0000-000000000015'::UUID;
    t6_id UUID := 'f0000000-0000-0000-0000-000000000016'::UUID;
    t7_id UUID := 'f0000000-0000-0000-0000-000000000017'::UUID;
    t8_id UUID := 'f0000000-0000-0000-0000-000000000018'::UUID;

    base_core_id UUID := 'a0000000-0000-0000-0000-000000000021'::UUID;
BEGIN
    -- 1. Insert Root SuperAdmin & Demo Team Members into auth.users (if auth exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud)
        VALUES
        (super_admin_id, '00000000-0000-0000-0000-000000000000', 'admin@jyotirmoyb.com', crypt('Admin@jyotirmoyb2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"System Administrator"}', 'authenticated', 'authenticated'),
        (guest_user_id, '00000000-0000-0000-0000-000000000000', 'guest@external-partner.com', crypt('GuestPass2026!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Guest Auditor (Partner Org)"}', 'authenticated', 'authenticated'),
        (engineer_user_id, '00000000-0000-0000-0000-000000000000', 'lead.engineer@core.internal', crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Lin (Lead Architect)"}', 'authenticated', 'authenticated'),
        (devops_user_id, '00000000-0000-0000-0000-000000000000', 'devops@core.internal', crypt('Password123!', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kenji Sato (Site Reliability)"}', 'authenticated', 'authenticated')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 2. Insert User Profiles
    INSERT INTO user_profiles (id, email, full_name, avatar_url, is_superadmin)
    VALUES
    (super_admin_id, 'admin@jyotirmoyb.com', 'System Administrator', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', TRUE),
    (guest_user_id, 'guest@external-partner.com', 'Guest Auditor (Partner Org)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', FALSE),
    (engineer_user_id, 'lead.engineer@core.internal', 'Sarah Lin (Lead Architect)', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', FALSE),
    (devops_user_id, 'devops@core.internal', 'Kenji Sato (Site Reliability)', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', FALSE)
    ON CONFLICT (id) DO UPDATE SET
        is_superadmin = EXCLUDED.is_superadmin,
        full_name = EXCLUDED.full_name;

    -- 3. Provision Default Enterprise Core Tenant
    INSERT INTO tenants (
        id, name, slug, code, tenant_code, domain, status, is_active,
        week_starts_on, weekend_days, storage_quota_mb,
        branding_json, feature_flags
    )
    VALUES (
        tenant_core_id,
        'Enterprise Core',
        'core',
        'CORE-SYS',
        'CORE-SYS',
        'core.pms.internal',
        'active',
        TRUE,
        1, -- Monday
        ARRAY[0, 6], -- Sunday, Saturday
        20480, -- 20 GB
        '{"primary_color": "#2563eb", "theme_preset": "navy", "company_tagline": "Next-Generation Cloud & Infrastructure Operations"}',
        '{"cpm_enabled": true, "export_enabled": true, "audit_enabled": true, "custom_fields_enabled": true, "resource_heatmap_enabled": true}'
    )
    ON CONFLICT (id) DO UPDATE SET
        status = 'active',
        is_active = TRUE;

    -- 4. Bind SuperAdmin as Owner to Enterprise Core
    INSERT INTO tenant_memberships (tenant_id, user_id, role, is_active)
    VALUES
    (tenant_core_id, super_admin_id, 'owner', TRUE),
    (tenant_core_id, engineer_user_id, 'admin', TRUE),
    (tenant_core_id, devops_user_id, 'member', TRUE),
    (tenant_core_id, guest_user_id, 'guest', TRUE)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- 5. Seed 2 Teams: Core Platform and Operations
    INSERT INTO tenant_teams (id, tenant_id, name, description)
    VALUES
    (team_platform_id, tenant_core_id, 'Core Platform', 'Platform Architecture, High-Availability Infrastructure, and API Gateway engineering.'),
    (team_ops_id, tenant_core_id, 'Operations', 'DevOps, Site Reliability Engineering, CI/CD automation, and multi-region deployment.')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO team_members (team_id, user_id, role)
    VALUES
    (team_platform_id, super_admin_id, 'lead'),
    (team_platform_id, engineer_user_id, 'member'),
    (team_ops_id, devops_user_id, 'lead')
    ON CONFLICT (team_id, user_id) DO NOTHING;

    -- 6. Seed Custom Working Calendar & 3 Holidays (Monday-Friday)
    INSERT INTO working_calendars (id, tenant_id, name, week_start_day, working_days, default_hours_per_day, is_default)
    VALUES
    (cal_core_id, tenant_core_id, 'Standard Corporate Calendar (Mon-Fri)', 1, ARRAY[1, 2, 3, 4, 5], 8, TRUE)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO calendar_holidays (tenant_id, calendar_id, name, holiday_date, is_recurring)
    VALUES
    (tenant_core_id, cal_core_id, 'New Year''s Day', '2026-01-01', TRUE),
    (tenant_core_id, cal_core_id, 'Memorial Day', '2026-05-25', TRUE),
    (tenant_core_id, cal_core_id, 'Labor Day', '2026-09-07', TRUE)
    ON CONFLICT DO NOTHING;

    -- 7. Seed Demonstration Project: Global Infrastructure Modernization
    INSERT INTO projects (id, tenant_id, calendar_id, name, code, description, status, start_date, target_end_date, created_by)
    VALUES
    (
        prj_modernize_id,
        tenant_core_id,
        cal_core_id,
        'Global Infrastructure Modernization',
        'PRJ-CORE',
        'Multi-region migration to modern container orchestration, Zero-Trust network security, and autonomous CI/CD pipelines.',
        'active',
        '2026-10-01',
        '2026-12-15',
        super_admin_id
    )
    ON CONFLICT (id) DO NOTHING;

    -- 8. Seed 3 Phases
    INSERT INTO project_phases (id, tenant_id, project_id, name, order_index, start_date, end_date)
    VALUES
    (ph1_id, tenant_core_id, prj_modernize_id, 'Phase 1: Architecture & Security Baseline', 1, '2026-10-01', '2026-10-15'),
    (ph2_id, tenant_core_id, prj_modernize_id, 'Phase 2: Core Implementation & Workloads', 2, '2026-10-16', '2026-11-20'),
    (ph3_id, tenant_core_id, prj_modernize_id, 'Phase 3: UAT, Penetration Testing & Deployment', 3, '2026-11-23', '2026-12-15')
    ON CONFLICT (id) DO NOTHING;

    -- 9. Seed 8 Tasks with parent-child nesting, durations, and assignees
    -- Task 1: Architecture Blueprint
    INSERT INTO tasks (id, tenant_id, project_id, phase_id, parent_task_id, title, code, description, status, priority, start_date, end_date, duration_days, progress, is_milestone, sort_order)
    VALUES
    (t1_id, tenant_core_id, prj_modernize_id, ph1_id, NULL, 'Zero-Trust Architecture & Threat Modeling', 'TASK-101', 'Define SPIFFE/SPIRE workload identities and mutual TLS topology.', 'done', 'high', '2026-10-01', '2026-10-05', 3, 100, FALSE, 1),
    
    -- Task 2: Kubernetes Infrastructure (Parent Task)
    (t2_id, tenant_core_id, prj_modernize_id, ph1_id, NULL, 'Multi-Cluster Kubernetes Platform Setup', 'TASK-102', 'Provision Terraform infrastructure for multi-region EKS clusters.', 'in_progress', 'urgent', '2026-10-06', '2026-10-14', 7, 60, FALSE, 2),
    
    -- Task 3: Subtask of Task 2
    (t3_id, tenant_core_id, prj_modernize_id, ph1_id, t2_id, 'VPC Peering & Transit Gateway Routing', 'TASK-102-A', 'Configure cross-region routing and peering mesh.', 'done', 'high', '2026-10-06', '2026-10-08', 3, 100, FALSE, 3),

    -- Task 4: Subtask of Task 2
    (t4_id, tenant_core_id, prj_modernize_id, ph1_id, t2_id, 'GitOps ArgoCD Cluster Synchronizers', 'TASK-102-B', 'Setup declarative state synchronization with encrypted SOPS secrets.', 'in_progress', 'medium', '2026-10-09', '2026-10-14', 4, 30, FALSE, 4),

    -- Task 5: Database Migration
    (t5_id, tenant_core_id, prj_modernize_id, ph2_id, NULL, 'PostgreSQL Database Zero-Downtime Replication', 'TASK-201', 'Establish logical replication streams with failover verification.', 'todo', 'urgent', '2026-10-15', '2026-10-23', 7, 0, FALSE, 5),

    -- Task 6: API Gateway & Service Mesh
    (t6_id, tenant_core_id, prj_modernize_id, ph2_id, NULL, 'Envoy Proxy Service Mesh & Rate Limiting', 'TASK-202', 'Implement adaptive rate limiting with Redis-backed token buckets.', 'todo', 'high', '2026-10-26', '2026-11-04', 8, 0, FALSE, 6),

    -- Task 7: Comprehensive Load & Security Audit
    (t7_id, tenant_core_id, prj_modernize_id, ph3_id, NULL, 'Third-Party SOC 2 Penetration Testing', 'TASK-301', 'External audit firm evaluation of perimeter isolation and data encryption.', 'todo', 'high', '2026-11-05', '2026-11-13', 7, 0, FALSE, 7),

    -- Task 8: Production Milestone
    (t8_id, tenant_core_id, prj_modernize_id, ph3_id, NULL, 'Cutover & Global Traffic Switchover Milestone', 'MILE-401', 'Promote staging mesh to primary DNS traffic routing.', 'todo', 'urgent', '2026-11-16', '2026-11-16', 0, 0, TRUE, 8)
    ON CONFLICT (id) DO NOTHING;

    -- 10. Task Assignees
    INSERT INTO task_assignees (task_id, user_id, allocation_percent)
    VALUES
    (t1_id, super_admin_id, 100),
    (t2_id, engineer_user_id, 80),
    (t2_id, devops_user_id, 80),
    (t3_id, devops_user_id, 100),
    (t4_id, engineer_user_id, 100),
    (t5_id, engineer_user_id, 50),
    (t6_id, devops_user_id, 50),
    (t7_id, guest_user_id, 100),
    (t8_id, super_admin_id, 100)
    ON CONFLICT (task_id, user_id) DO NOTHING;

    -- 11. Task Dependencies (FS, SS with lag)
    INSERT INTO task_dependencies (tenant_id, project_id, predecessor_id, successor_id, dep_type, lag_days)
    VALUES
    -- t1 -> t2 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t1_id, t2_id, 'FS', 0),
    -- t3 -> t4 Start-to-Start with 1 day lag (SS +1)
    (tenant_core_id, prj_modernize_id, t3_id, t4_id, 'SS', 1),
    -- t2 -> t5 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t2_id, t5_id, 'FS', 0),
    -- t5 -> t6 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t5_id, t6_id, 'FS', 0),
    -- t6 -> t7 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t6_id, t7_id, 'FS', 0),
    -- t7 -> t8 Finish-to-Start (FS)
    (tenant_core_id, prj_modernize_id, t7_id, t8_id, 'FS', 0)
    ON CONFLICT DO NOTHING;

    -- 12. Saved Schedule Baseline Snapshot
    INSERT INTO project_baselines (id, project_id, tenant_id, name, description, created_by, created_at)
    VALUES
    (
        base_core_id,
        prj_modernize_id,
        tenant_core_id,
        'Executive Baseline v1.0 (Q4 Approved)',
        'Approved by the Technical Steering Committee prior to infrastructure sprint kickoff.',
        super_admin_id,
        '2026-09-25T00:00:00Z'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO task_baseline_snapshots (baseline_id, task_id, start_date, end_date, duration_days, progress)
    VALUES
    (base_core_id, t1_id, '2026-10-01', '2026-10-05', 3, 100),
    (base_core_id, t2_id, '2026-10-06', '2026-10-12', 5, 40),  -- 2 days slippage compared to live
    (base_core_id, t3_id, '2026-10-06', '2026-10-08', 3, 100),
    (base_core_id, t4_id, '2026-10-09', '2026-10-13', 3, 20),
    (base_core_id, t5_id, '2026-10-13', '2026-10-21', 7, 0),
    (base_core_id, t6_id, '2026-10-22', '2026-10-30', 7, 0),
    (base_core_id, t7_id, '2026-10-31', '2026-11-10', 7, 0),
    (base_core_id, t8_id, '2026-11-12', '2026-11-12', 0, 0)
    ON CONFLICT DO NOTHING;

    -- 13. External Guest Project-Scoped Containment Record
    INSERT INTO project_guest_access (project_id, user_id, granted_by, can_view_cpm, can_view_budget, expires_at)
    VALUES
    (prj_modernize_id, guest_user_id, super_admin_id, TRUE, FALSE, '2026-12-31T23:59:59Z')
    ON CONFLICT (project_id, user_id) DO NOTHING;

END $$;
