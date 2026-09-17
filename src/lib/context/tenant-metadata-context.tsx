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
import { dbService } from '@/lib/supabase/db-service';

interface TenantMetadataContextType {
  statuses: TenantTaskStatus[];
  priorities: TenantTaskPriority[];
  taskTypes: TenantTaskType[];
  customFields: TenantCustomField[];
  rolePermissions: TenantRolePermission[];
  systemThemes: SystemTheme[];
  isLoading: boolean;
  refreshMetadata: () => Promise<void>;
  getStatus: (slug: string) => TenantTaskStatus | undefined;
  getPriority: (slug: string) => TenantTaskPriority | undefined;
  getTaskType: (slug: string) => TenantTaskType | undefined;
  hasPermission: (permissionKey: string) => boolean;
  createStatus: (data: Omit<TenantTaskStatus, 'id' | 'created_at'>) => Promise<TenantTaskStatus>;
  updateStatus: (id: string, updates: Partial<TenantTaskStatus>) => Promise<TenantTaskStatus | null>;
  deleteStatus: (id: string) => Promise<boolean>;
  createPriority: (data: Omit<TenantTaskPriority, 'id' | 'created_at'>) => Promise<TenantTaskPriority>;
  updatePriority: (id: string, updates: Partial<TenantTaskPriority>) => Promise<TenantTaskPriority | null>;
  createCustomField: (data: Omit<TenantCustomField, 'id' | 'created_at'>) => Promise<TenantCustomField>;
  updatePermission: (role: string, key: string, granted: boolean) => Promise<void>;
}

const TenantMetadataContext = React.createContext<TenantMetadataContextType | null>(null);

export function TenantMetadataProvider({ children }: { children: React.ReactNode }) {
  const { activeTenant, activeRole } = useTenantStore();
  const tenantId = activeTenant?.id;

  const [statuses, setStatuses] = React.useState<TenantTaskStatus[]>([]);
  const [priorities, setPriorities] = React.useState<TenantTaskPriority[]>([]);
  const [taskTypes, setTaskTypes] = React.useState<TenantTaskType[]>([]);
  const [customFields, setCustomFields] = React.useState<TenantCustomField[]>([]);
  const [rolePermissions, setRolePermissions] = React.useState<TenantRolePermission[]>([]);
  const [systemThemes, setSystemThemes] = React.useState<SystemTheme[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshMetadata = React.useCallback(async () => {
    if (!tenantId) {
      setStatuses([]);
      setPriorities([]);
      setTaskTypes([]);
      setCustomFields([]);
      setRolePermissions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [
        fetchedStatuses,
        fetchedPriorities,
        fetchedTaskTypes,
        fetchedCustomFields,
        fetchedRolePermissions,
        fetchedSystemThemes,
      ] = await Promise.all([
        dbService.getTenantTaskStatuses(tenantId),
        dbService.getTenantTaskPriorities(tenantId),
        dbService.getTenantTaskTypes(tenantId),
        dbService.getTenantCustomFields(tenantId),
        dbService.getTenantRolePermissions(tenantId),
        dbService.getSystemThemes(),
      ]);

      setStatuses(fetchedStatuses);
      setPriorities(fetchedPriorities);
      setTaskTypes(fetchedTaskTypes);
      setCustomFields(fetchedCustomFields);
      setRolePermissions(fetchedRolePermissions);
      setSystemThemes(fetchedSystemThemes);
    } catch (err) {
      // Graceful error containment
      setStatuses([]);
      setPriorities([]);
      setTaskTypes([]);
      setCustomFields([]);
      setRolePermissions([]);
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
    (permissionKey: string) => {
      if (!tenantId) return false;
      return dbService.hasPermission(tenantId, activeRole, permissionKey);
    },
    [tenantId, activeRole]
  );

  const createStatus = React.useCallback(
    async (data: Omit<TenantTaskStatus, 'id' | 'created_at'>) => {
      const created = await dbService.createTenantTaskStatus(data);
      await refreshMetadata();
      return created;
    },
    [refreshMetadata]
  );

  const updateStatus = React.useCallback(
    async (id: string, updates: Partial<TenantTaskStatus>) => {
      const updated = await dbService.updateTenantTaskStatus(id, updates);
      await refreshMetadata();
      return updated;
    },
    [refreshMetadata]
  );

  const deleteStatus = React.useCallback(
    async (id: string) => {
      const deleted = await dbService.deleteTenantTaskStatus(id);
      await refreshMetadata();
      return deleted;
    },
    [refreshMetadata]
  );

  const createPriority = React.useCallback(
    async (data: Omit<TenantTaskPriority, 'id' | 'created_at'>) => {
      const created = await dbService.createTenantTaskPriority(data);
      await refreshMetadata();
      return created;
    },
    [refreshMetadata]
  );

  const updatePriority = React.useCallback(
    async (id: string, updates: Partial<TenantTaskPriority>) => {
      const updated = await dbService.updateTenantTaskPriority(id, updates);
      await refreshMetadata();
      return updated;
    },
    [refreshMetadata]
  );

  const createCustomField = React.useCallback(
    async (data: Omit<TenantCustomField, 'id' | 'created_at'>) => {
      const created = await dbService.createTenantCustomField(data);
      await refreshMetadata();
      return created;
    },
    [refreshMetadata]
  );

  const updatePermission = React.useCallback(
    async (role: string, key: string, granted: boolean) => {
      if (!tenantId) return;
      await dbService.updateRolePermission(tenantId, role, key, granted);
      await refreshMetadata();
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

