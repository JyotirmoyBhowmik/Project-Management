'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEnterpriseTheme } from '@/lib/stores/theme-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30, // 30 seconds
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const { currentTheme, setTheme } = useEnterpriseTheme();

  // Initialize theme classes on HTML element
  React.useEffect(() => {
    setTheme(currentTheme);
  }, [currentTheme, setTheme]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
