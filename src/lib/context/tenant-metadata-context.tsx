// ==============================================================================
// src/lib/context/tenant-metadata-context.tsx
// Dynamic Tenant Metadata Provider (Zero Hardcoded Values Mandate)
// Supplies database-driven statuses, priorities, types, custom fields, and permissions.
// ==============================================================================

'use client';

import * as React from 'react';
import {
  TenantTaskStatus,
  TenantTaskPriority,
  TenantTaskType,
  TenantCustomField,
  TenantRolePermission,
  SystemTheme,
} from '@/types/database';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { db } from '@/lib/supabase/mock-db';

interface TenantMetadataContextType {
  statuses: TenantTaskStatus[];
  priorities: TenantTaskPriority[];
  taskTypes: TenantTaskType[];
  customFields: TenantCustomField[];
  rolePermissions: TenantRolePermission[];
  systemThemes: SystemTheme[];
  isLoading: boolean;
  refreshMetadata: () => void;
  getStatus: (slug: string) => TenantTaskStatus | undefined;
  getPriority: (slug: string) => TenantTaskPriority | undefined;
  getTaskType: (slug: string) => TenantTaskType | undefined;
  hasPermission: (permissionKey: string) => boolean;
  createStatus: (data: Omit<TenantTaskStatus, 'id' | 'created_at'>) => TenantTaskStatus;
  updateStatus: (id: string, updates: Partial<TenantTaskStatus>) => TenantTaskStatus;
  deleteStatus: (id: string) => boolean;
  createPriority: (data: Omit<TenantTaskPriority, 'id' | 'created_at'>) => TenantTaskPriority;
  updatePriority: (id: string, updates: Partial<TenantTaskPriority>) => TenantTaskPriority;
  createCustomField: (data: Omit<TenantCustomField, 'id' | 'created_at'>) => TenantCustomField;
  updatePermission: (role: string, key: string, granted: boolean) => void;
}

const TenantMetadataContext = React.createContext<TenantMetadataContextType | null>(null);

export function TenantMetadataProvider({ children }: { children: React.ReactNode }) {
  const { activeTenant, activeRole } = useTenantStore();
  const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';

  const [statuses, setStatuses] = React.useState<TenantTaskStatus[]>([]);
  const [priorities, setPriorities] = React.useState<TenantTaskPriority[]>([]);
  const [taskTypes, setTaskTypes] = React.useState<TenantTaskType[]>([]);
  const [customFields, setCustomFields] = React.useState<TenantCustomField[]>([]);
  const [rolePermissions, setRolePermissions] = React.useState<TenantRolePermission[]>([]);
  const [systemThemes, setSystemThemes] = React.useState<SystemTheme[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshMetadata = React.useCallback(() => {
    setIsLoading(true);
    try {
      setStatuses([...db.getTenantTaskStatuses(tenantId)]);
      setPriorities([...db.getTenantTaskPriorities(tenantId)]);
      setTaskTypes([...db.getTenantTaskTypes(tenantId)]);
      setCustomFields([...db.getTenantCustomFields(tenantId)]);
      setRolePermissions([...db.getTenantRolePermissions(tenantId)]);
      setSystemThemes([...db.getSystemThemes()]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    refreshMetadata();
  }, [refreshMetadata]);

  const getStatus = React.useCallback(
    (slug: string) => statuses.find((s) => s.slug === slug),
    [statuses]
  );

  const getPriority = React.useCallback(
    (slug: string) => priorities.find((p) => p.slug === slug),
    [priorities]
  );

  const getTaskType = React.useCallback(
    (slug: string) => taskTypes.find((t) => t.slug === slug),
    [taskTypes]
  );

  const hasPermission = React.useCallback(
    (permissionKey: string) => db.hasPermission(tenantId, activeRole, permissionKey),
    [tenantId, activeRole]
  );

  const createStatus = React.useCallback(
    (data: Omit<TenantTaskStatus, 'id' | 'created_at'>) => {
      const created = db.createTenantTaskStatus(data);
      refreshMetadata();
      return created;
    },
    [refreshMetadata]
  );

  const updateStatus = React.useCallback(
    (id: string, updates: Partial<TenantTaskStatus>) => {
      const updated = db.updateTenantTaskStatus(id, updates);
      refreshMetadata();
      return updated;
    },
    [refreshMetadata]
  );

  const deleteStatus = React.useCallback(
    (id: string) => {
      const deleted = db.deleteTenantTaskStatus(id);
      refreshMetadata();
      return deleted;
    },
    [refreshMetadata]
  );

  const createPriority = React.useCallback(
    (data: Omit<TenantTaskPriority, 'id' | 'created_at'>) => {
      const created = db.createTenantTaskPriority(data);
      refreshMetadata();
      return created;
    },
    [refreshMetadata]
  );

  const updatePriority = React.useCallback(
    (id: string, updates: Partial<TenantTaskPriority>) => {
      const updated = db.updateTenantTaskPriority(id, updates);
      refreshMetadata();
      return updated;
    },
    [refreshMetadata]
  );

  const createCustomField = React.useCallback(
    (data: Omit<TenantCustomField, 'id' | 'created_at'>) => {
      const created = db.createTenantCustomField(data);
      refreshMetadata();
      return created;
    },
    [refreshMetadata]
  );

  const updatePermission = React.useCallback(
    (role: string, key: string, granted: boolean) => {
      db.updateRolePermission(tenantId, role, key, granted);
      refreshMetadata();
    },
    [tenantId, refreshMetadata]
  );

  const contextValue = React.useMemo(
    () => ({
      statuses,
      priorities,
      taskTypes,
      customFields,
      rolePermissions,
      systemThemes,
      isLoading,
      refreshMetadata,
      getStatus,
      getPriority,
      getTaskType,
      hasPermission,
      createStatus,
      updateStatus,
      deleteStatus,
      createPriority,
      updatePriority,
      createCustomField,
      updatePermission,
    }),
    [
      statuses,
      priorities,
      taskTypes,
      customFields,
      rolePermissions,
      systemThemes,
      isLoading,
      refreshMetadata,
      getStatus,
      getPriority,
      getTaskType,
      hasPermission,
      createStatus,
      updateStatus,
      deleteStatus,
      createPriority,
      updatePriority,
      createCustomField,
      updatePermission,
    ]
  );

  return (
    <TenantMetadataContext.Provider value={contextValue}>
      {children}
    </TenantMetadataContext.Provider>
  );
}

export function useTenantMetadata() {
  const context = React.useContext(TenantMetadataContext);
  if (!context) {
    throw new Error('useTenantMetadata must be used within a TenantMetadataProvider');
  }
  return context;
}
