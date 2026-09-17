// ==============================================================================
// src/lib/theme/dynamic-theme-provider.tsx
// Database-Driven Theming Engine with Runtime CSS Variable Injection
// Injects design tokens from system_themes and tenant_theme_overrides at runtime.
// ==============================================================================

'use client';

import * as React from 'react';
import { ThemeTokens, SystemTheme } from '@/types/database';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { db } from '@/lib/supabase/mock-db';

interface DynamicThemeContextType {
  activeThemeId: string;
  tokens: ThemeTokens;
  systemThemes: SystemTheme[];
  setTheme: (themeId: string) => void;
  updateCustomTokens: (custom: Partial<ThemeTokens>) => void;
  resetToDefault: () => void;
}

const DynamicThemeContext = React.createContext<DynamicThemeContextType | null>(null);

export function generateCssVariables(tokens: ThemeTokens): string {
  return `
    :root {
      --background: ${tokens.background};
      --foreground: ${tokens.foreground};
      --card: ${tokens.card};
      --card-foreground: ${tokens.card_foreground};
      --popover: ${tokens.popover};
      --popover-foreground: ${tokens.popover_foreground};
      --primary: ${tokens.primary};
      --primary-foreground: ${tokens.primary_foreground};
      --secondary: ${tokens.secondary};
      --secondary-foreground: ${tokens.secondary_foreground};
      --muted: ${tokens.muted};
      --muted-foreground: ${tokens.muted_foreground};
      --accent: ${tokens.accent};
      --accent-foreground: ${tokens.accent_foreground};
      --destructive: ${tokens.destructive};
      --destructive-foreground: ${tokens.destructive_foreground};
      --border: ${tokens.border};
      --input: ${tokens.input};
      --ring: ${tokens.ring};
      --radius: ${tokens.radius};
      --critical-path: ${tokens.critical_path};
      --non-working-day: ${tokens.non_working_day};
      --holiday-day: ${tokens.holiday_day};
    }
  `;
}

export function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const { activeTenant } = useTenantStore();
  const tenantId = activeTenant?.id || 'a0000000-0000-0000-0000-000000000001';

  const [activeThemeId, setActiveThemeId] = React.useState<string>('navy');
  const [tokens, setTokens] = React.useState<ThemeTokens>(() => db.getTenantTheme(tenantId));
  const [systemThemes, setSystemThemes] = React.useState<SystemTheme[]>(() => db.getSystemThemes());

  // Refresh theme when tenant changes
  React.useEffect(() => {
    const override = db.tenantThemeOverrides.find((o) => o.tenant_id === tenantId);
    const themeId = override?.active_theme_id || 'navy';
    setActiveThemeId(themeId);
    setTokens(db.getTenantTheme(tenantId));
    setSystemThemes(db.getSystemThemes());
  }, [tenantId]);

  const setTheme = React.useCallback(
    (themeId: string) => {
      setActiveThemeId(themeId);
      db.setTenantTheme(tenantId, themeId, {});
      const newTokens = db.getTenantTheme(tenantId);
      setTokens(newTokens);
    },
    [tenantId]
  );

  const updateCustomTokens = React.useCallback(
    (custom: Partial<ThemeTokens>) => {
      db.setTenantTheme(tenantId, activeThemeId, custom);
      setTokens((prev) => ({ ...prev, ...custom }));
    },
    [tenantId, activeThemeId]
  );

  const resetToDefault = React.useCallback(() => {
    db.setTenantTheme(tenantId, activeThemeId, {});
    setTokens(db.getTenantTheme(tenantId));
  }, [tenantId, activeThemeId]);

  const cssRules = React.useMemo(() => generateCssVariables(tokens), [tokens]);

  return (
    <DynamicThemeContext.Provider
      value={{
        activeThemeId,
        tokens,
        systemThemes,
        setTheme,
        updateCustomTokens,
        resetToDefault,
      }}
    >
      <style
        id="dynamic-tenant-theme"
        dangerouslySetInnerHTML={{ __html: cssRules }}
      />
      {children}
    </DynamicThemeContext.Provider>
  );
}

export function useDynamicTheme() {
  const context = React.useContext(DynamicThemeContext);
  if (!context) {
    throw new Error('useDynamicTheme must be used within a DynamicThemeProvider');
  }
  return context;
}
