// ==============================================================================
// src/lib/stores/tenant-store.ts
// Active Tenant Context & Workspace Switcher Zustand Store
// Synchronizes active tenant ID with cookies and local state.
// ==============================================================================

import { create } from 'zustand';
import { Tenant, UserProfile, TenantMembership } from '@/types/database';

interface TenantState {
  activeTenant: Tenant | null;
  activeRole: string;
  currentUser: UserProfile | null;
  memberships: TenantMembership[];
  isLoading: boolean;
  setActiveTenant: (tenant: Tenant, role?: string) => void;
  setCurrentUser: (user: UserProfile) => void;
  setMemberships: (memberships: TenantMembership[]) => void;
  switchTenantById: (tenantId: string) => void;
}

export const useTenantStore = create<TenantState>((set, get) => ({
  activeTenant: {
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
  activeRole: 'tenant_admin',
  currentUser: {
    id: 'b0000000-0000-0000-0000-000000000002',
    email: 'admin@acme.com',
    full_name: 'Sarah Connor (Tenant Admin)',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    is_superadmin: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  memberships: [],
  isLoading: false,

  setActiveTenant: (tenant: Tenant, role: string = 'contributor') => {
    // Sync with cookie for server-side Next.js route resolution
    if (typeof document !== 'undefined') {
      document.cookie = `pms_active_tenant_id=${tenant.id}; path=/; max-age=31536000; SameSite=Lax`;
    }
    set({ activeTenant: tenant, activeRole: role });
  },

  setCurrentUser: (user: UserProfile) => {
    set({ currentUser: user });
  },

  setMemberships: (memberships: TenantMembership[]) => {
    set({ memberships });
  },

  switchTenantById: (tenantId: string) => {
    const { memberships, activeTenant } = get();
    if (activeTenant?.id === tenantId) return;

    const membership = memberships.find(m => m.tenant_id === tenantId);
    if (membership && membership.tenant) {
      if (typeof document !== 'undefined') {
        document.cookie = `pms_active_tenant_id=${tenantId}; path=/; max-age=31536000; SameSite=Lax`;
      }
      set({ activeTenant: membership.tenant, activeRole: membership.role });
    }
  },
}));
