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
  activeTenant: null,
  activeRole: '',
  currentUser: null,
  memberships: [],
  isLoading: true,

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
