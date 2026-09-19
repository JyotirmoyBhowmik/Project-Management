// ==============================================================================
// src/lib/theme/dynamic-theme-provider.tsx
// Database-Driven Theming Engine with Runtime CSS Variable Injection
// Injects design tokens from system_themes and tenant_theme_overrides at runtime.
// ==============================================================================

'use client';

import * as React from 'react';
import { ThemeTokens, SystemTheme } from '@/types/database';
import { useTenantStore } from '@/lib/stores/tenant-store';
import { dbService, DEFAULT_THEME_TOKENS, DEFAULT_SYSTEM_THEMES } from '@/lib/supabase/db-service';
import { createClient } from '@/lib/supabase/client';

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
  const { activeTenant, currentUser } = useTenantStore();
  const tenantId = activeTenant?.id;
  const supabase = React.useMemo(() => createClient(), []);

  const [activeThemeId, setActiveThemeId] = React.useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pms_theme_preference');
      if (stored) return stored;
    }
    return activeTenant?.branding_json?.theme_preset || 'navy';
  });
  const [tokens, setTokens] = React.useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [systemThemes, setSystemThemes] = React.useState<SystemTheme[]>(DEFAULT_SYSTEM_THEMES);

  // Apply theme class to <html> element
  const applyThemeClass = React.useCallback((themeId: string) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) root.classList.remove(cls);
    });
    root.classList.add(`theme-${themeId}`);
    if (themeId === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, []);

  // Refresh theme when tenant changes or mounts
  React.useEffect(() => {
    let isMounted = true;

    async function loadTheme() {
      const themes = await dbService.getSystemThemes();
      if (!isMounted) return;
      setSystemThemes(themes);

      const savedTheme = (typeof window !== 'undefined' && localStorage.getItem('pms_theme_preference')) ||
        currentUser?.theme_preference ||
        activeTenant?.branding_json?.theme_preset ||
        'navy';

      setActiveThemeId(savedTheme);
      applyThemeClass(savedTheme);

      if (tenantId) {
        const tenantTokens = await dbService.getTenantTheme(tenantId);
        if (!isMounted) return;
        setTokens(tenantTokens);
      } else {
        const matched = themes.find((t) => t.id === savedTheme);
        if (matched && isMounted) {
          setTokens(matched.tokens_json);
        }
      }
    }

    loadTheme();

    return () => {
      isMounted = false;
    };
  }, [tenantId, currentUser, activeTenant, applyThemeClass]);

  const setTheme = React.useCallback(
    async (themeId: string) => {
      setActiveThemeId(themeId);
      applyThemeClass(themeId);

      if (typeof window !== 'undefined') {
        localStorage.setItem('pms_theme_preference', themeId);
      }

      const matched = systemThemes.find((t) => t.id === themeId);
      if (matched) {
        setTokens(matched.tokens_json);
      }

      // Persist to user profile if authenticated
      if (currentUser?.id) {
        supabase
          .from('profiles')
          .update({ theme_preference: themeId })
          .eq('id', currentUser.id)
          .then();
      }

      if (tenantId) {
        await dbService.setTenantTheme(tenantId, themeId, {});
        const newTokens = await dbService.getTenantTheme(tenantId);
        setTokens(newTokens);
      }
    },
    [tenantId, systemThemes, currentUser, supabase, applyThemeClass]
  );

  const updateCustomTokens = React.useCallback(
    async (custom: Partial<ThemeTokens>) => {
      setTokens((prev) => ({ ...prev, ...custom }));
      if (tenantId) {
        await dbService.setTenantTheme(tenantId, activeThemeId, custom);
      }
    },
    [tenantId, activeThemeId]
  );

  const resetToDefault = React.useCallback(async () => {
    if (tenantId) {
      await dbService.setTenantTheme(tenantId, activeThemeId, {});
      const newTokens = await dbService.getTenantTheme(tenantId);
      setTokens(newTokens);
    } else {
      setTokens(DEFAULT_THEME_TOKENS);
    }
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
