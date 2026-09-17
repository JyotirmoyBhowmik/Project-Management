// ==============================================================================
// src/lib/stores/theme-store.ts
// Enterprise Multi-Theme Switcher
// Supports Light, Dark, Enterprise Navy, Monokai OLED, and High-Contrast.
// ==============================================================================

import { create } from 'zustand';

export type EnterpriseTheme = 'light' | 'dark' | 'navy' | 'monokai' | 'high-contrast';

interface ThemeState {
  currentTheme: EnterpriseTheme;
  setTheme: (theme: EnterpriseTheme) => void;
}

export const useEnterpriseTheme = create<ThemeState>((set) => ({
  currentTheme: 'navy',
  setTheme: (theme: EnterpriseTheme) => {
    if (typeof document !== 'undefined') {
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
