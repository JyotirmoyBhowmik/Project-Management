// ==============================================================================
// src/lib/stores/theme-store.ts
// Enterprise Multi-Theme Switcher with LocalStorage Persistence
// Supports Light, Dark, Enterprise Navy, Monokai OLED, and High-Contrast.
// ==============================================================================

import { create } from 'zustand';

export type EnterpriseTheme = 'light' | 'dark' | 'navy' | 'monokai' | 'high-contrast';

interface ThemeState {
  currentTheme: EnterpriseTheme;
  setTheme: (theme: EnterpriseTheme) => void;
}

const STORAGE_KEY = 'pms_theme_preference';

const getInitialTheme = (): EnterpriseTheme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY) as EnterpriseTheme | null;
    if (saved && ['light', 'dark', 'navy', 'monokai', 'high-contrast'].includes(saved)) {
      return saved;
    }
  }
  return 'navy';
};

export const useEnterpriseTheme = create<ThemeState>((set) => ({
  currentTheme: 'navy',
  setTheme: (theme: EnterpriseTheme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
      const root = document.documentElement;
      root.classList.remove('theme-light', 'theme-dark', 'theme-navy', 'theme-monokai', 'theme-high-contrast');
      root.classList.add(`theme-${theme}`);
      if (theme === 'dark' || theme === 'navy' || theme === 'monokai' || theme === 'high-contrast') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    set({ currentTheme: theme });
  },
}));
