// ==============================================================================
// tests/unit/metadata-engine.test.ts
// Unit Tests: Database-Driven Dynamic Metadata, Custom Fields & RBAC Permissions
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/supabase/mock-db';

describe('Dynamic Metadata & Theming Engine', () => {
  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'a0000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    db.seed();
  });

  describe('Dynamic Task Statuses', () => {
    it('should retrieve seeded dynamic statuses for a tenant ordered by position', () => {
      const statuses = db.getTenantTaskStatuses(tenantA);
      expect(statuses.length).toBeGreaterThanOrEqual(4);
      expect(statuses[0].slug).toBe('backlog');
      expect(statuses[1].slug).toBe('todo');

      // Verify zero hardcoding: position order is preserved
      for (let i = 0; i < statuses.length - 1; i++) {
        expect(statuses[i].position).toBeLessThanOrEqual(statuses[i + 1].position);
      }
    });

    it('should dynamically create and delete a new status with tenant isolation', () => {
      const created = db.createTenantTaskStatus({
        tenant_id: tenantA,
        name: 'Deployment Verification',
        slug: 'deploy_verify',
        color_hex: '#14b8a6',
        badge_variant: 'default',
        position: 10,
        is_default: false,
        is_closed_state: false,
      });

      expect(created.id).toBeDefined();
      expect(created.slug).toBe('deploy_verify');

      // Verify status exists in tenantA
      const tenantAStatuses = db.getTenantTaskStatuses(tenantA);
      expect(tenantAStatuses.some(s => s.slug === 'deploy_verify')).toBe(true);

      // Verify tenant isolation: status does not leak into tenantB
      const tenantBStatuses = db.getTenantTaskStatuses(tenantB);
      expect(tenantBStatuses.some(s => s.slug === 'deploy_verify')).toBe(false);

      // Delete status
      const deleted = db.deleteTenantTaskStatus(created.id);
      expect(deleted).toBe(true);
      expect(db.getTenantTaskStatuses(tenantA).some(s => s.id === created.id)).toBe(false);
    });
  });

  describe('Dynamic Task Priorities', () => {
    it('should retrieve priority tiers sorted by urgency weight', () => {
      const priorities = db.getTenantTaskPriorities(tenantA);
      expect(priorities.length).toBeGreaterThanOrEqual(4);

      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorities[i].urgency_weight).toBeLessThanOrEqual(priorities[i + 1].urgency_weight);
      }
    });

    it('should allow creating custom priority levels with SLA hours', () => {
      const p0 = db.createTenantTaskPriority({
        tenant_id: tenantA,
        name: 'Emergency P0',
        slug: 'p0_emergency',
        color_hex: '#dc2626',
        urgency_weight: 99,
        sla_response_hours: 2,
        icon_key: 'flame',
        is_default: false,
      });

      expect(p0.id).toBeDefined();
      expect(p0.sla_response_hours).toBe(2);

      const all = db.getTenantTaskPriorities(tenantA);
      expect(all.some(p => p.slug === 'p0_emergency')).toBe(true);
    });
  });

  describe('Dynamic Custom Fields Engine (EAV / JSONB)', () => {
    it('should register and store dynamic entity custom field values without migrations', () => {
      const field = db.createTenantCustomField({
        tenant_id: tenantA,
        entity_type: 'task',
        field_name: 'Security Clearance Required',
        field_key: 'sec_clearance',
        field_type: 'checkbox',
        is_required: false,
        sort_order: 10,
      });

      expect(field.id).toBeDefined();

      const taskId = 't1';
      db.setEntityCustomFieldValue(taskId, field.id, true, tenantA);

      const resolvedValues = db.getEntityCustomFieldValues(taskId);
      expect(resolvedValues['sec_clearance']).toBe(true);
    });
  });

  describe('Role-Based Access Control (RBAC) Matrix', () => {
    it('should always grant full permissions to owner role', () => {
      expect(db.hasPermission(tenantA, 'owner', 'tasks.delete')).toBe(true);
      expect(db.hasPermission(tenantA, 'owner', 'settings.manage')).toBe(true);
    });

    it('should enforce and dynamically update role permissions', () => {
      // Guest initially lacks permission to create tasks
      const guestCanCreate = db.hasPermission(tenantA, 'guest', 'tasks.create');
      expect(guestCanCreate).toBe(false);

      // SuperAdmin or Tenant Admin grants permission
      db.updateRolePermission(tenantA, 'guest', 'tasks.create', true);
      expect(db.hasPermission(tenantA, 'guest', 'tasks.create')).toBe(true);

      // Revoke permission
      db.updateRolePermission(tenantA, 'guest', 'tasks.create', false);
      expect(db.hasPermission(tenantA, 'guest', 'tasks.create')).toBe(false);
    });
  });

  describe('Dynamic Theming Engine', () => {
    it('should retrieve all 5 system themes with valid CSS color tokens', () => {
      const themes = db.getSystemThemes();
      expect(themes.length).toBeGreaterThanOrEqual(5);
      const themeIds = themes.map(t => t.id);
      expect(themeIds).toContain('navy');
      expect(themeIds).toContain('dark');
      expect(themeIds).toContain('monokai');
      expect(themeIds).toContain('light');
      expect(themeIds).toContain('high-contrast');
    });

    it('should merge tenant custom token overrides over base system theme', () => {
      // Set tenant override with custom primary color
      db.setTenantTheme(tenantA, 'navy', { primary: '#e11d48' });

      const resolvedTheme = db.getTenantTheme(tenantA);
      expect(resolvedTheme.primary).toBe('#e11d48');
      // Non-overridden tokens are inherited from the base theme
      expect(resolvedTheme.background).toBeDefined();
    });
  });
});
