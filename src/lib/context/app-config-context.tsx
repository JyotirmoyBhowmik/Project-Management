// ==============================================================================
// src/lib/context/app-config-context.tsx
// Global Base Application Configuration Context Provider & Hook
// ==============================================================================

'use client';

import * as React from 'react';
import {
  FolderKanban,
  Layers,
  ShieldCheck,
  Workflow,
  Sparkles,
  Compass,
  Rocket,
  Cpu,
  Building2,
  Hexagon,
  Boxes,
  Zap,
  Target,
  Kanban,
  LucideProps,
} from 'lucide-react';
import {
  DEFAULT_GLOBAL_APP_CONFIG,
  type GlobalAppConfig,
  type ControlFeatures,
} from '@/lib/validation/config-schemas';
import { getGlobalAppConfigAction, updateGlobalAppConfigAction } from '@/actions/config';
import { toast } from 'sonner';

export const APP_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  FolderKanban,
  Layers,
  ShieldCheck,
  Workflow,
  Sparkles,
  Compass,
  Rocket,
  Cpu,
  Building2,
  Hexagon,
  Boxes,
  Zap,
  Target,
  Kanban,
};

interface AppConfigContextValue {
  config: GlobalAppConfig;
  isLoading: boolean;
  refreshConfig: () => Promise<void>;
  updateConfig: (updates: Partial<GlobalAppConfig>) => Promise<boolean>;
  isFeatureEnabled: (feature: keyof ControlFeatures) => boolean;
  renderAppIcon: (props?: LucideProps) => React.ReactNode;
}

const AppConfigContext = React.createContext<AppConfigContextValue | undefined>(undefined);

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<GlobalAppConfig>(DEFAULT_GLOBAL_APP_CONFIG);
  const [isLoading, setIsLoading] = React.useState(true);

  const refreshConfig = React.useCallback(async () => {
    try {
      const res = await getGlobalAppConfigAction();
      if (res.success && res.data) {
        setConfig(res.data);
      }
    } catch (err) {
      console.error('Failed to load global application configuration:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // Update document title dynamically based on configured application name
  React.useEffect(() => {
    if (typeof document !== 'undefined' && config.app_name) {
      if (!document.title.includes(config.app_name)) {
        document.title = `${config.app_name} | ${config.app_tagline}`;
      }
    }
  }, [config.app_name, config.app_tagline]);

  const updateConfig = React.useCallback(
    async (updates: Partial<GlobalAppConfig>): Promise<boolean> => {
      const merged: GlobalAppConfig = {
        ...config,
        ...updates,
        control_features: {
          ...config.control_features,
          ...(updates.control_features || {}),
        },
        security_controls: {
          ...config.security_controls,
          ...(updates.security_controls || {}),
        },
      };

      const res = await updateGlobalAppConfigAction(merged);
      if (res.success && res.data) {
        setConfig(res.data);
        toast.success('System configuration updated successfully.');
        return true;
      } else {
        toast.error(res.error || 'Failed to update system configuration.');
        return false;
      }
    },
    [config]
  );

  const isFeatureEnabled = React.useCallback(
    (feature: keyof ControlFeatures): boolean => {
      return Boolean(config.control_features?.[feature]);
    },
    [config.control_features]
  );

  const renderAppIcon = React.useCallback(
    (props: LucideProps = { className: 'h-5 w-5' }) => {
      const IconComponent = APP_ICON_MAP[config.app_icon] || FolderKanban;
      return <IconComponent {...props} />;
    },
    [config.app_icon]
  );

  const value = React.useMemo(
    () => ({
      config,
      isLoading,
      refreshConfig,
      updateConfig,
      isFeatureEnabled,
      renderAppIcon,
    }),
    [config, isLoading, refreshConfig, updateConfig, isFeatureEnabled, renderAppIcon]
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfigContextValue {
  const ctx = React.useContext(AppConfigContext);
  if (!ctx) {
    return {
      config: DEFAULT_GLOBAL_APP_CONFIG,
      isLoading: false,
      refreshConfig: async () => {},
      updateConfig: async () => false,
      isFeatureEnabled: () => true,
      renderAppIcon: (props) => <FolderKanban {...(props || { className: 'h-5 w-5' })} />,
    };
  }
  return ctx;
}
