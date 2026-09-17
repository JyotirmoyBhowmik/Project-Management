'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantMetadataProvider } from '@/lib/context/tenant-metadata-context';
import { DynamicThemeProvider } from '@/lib/theme/dynamic-theme-provider';

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

  return (
    <QueryClientProvider client={queryClient}>
      <TenantMetadataProvider>
        <DynamicThemeProvider>
          {children}
        </DynamicThemeProvider>
      </TenantMetadataProvider>
    </QueryClientProvider>
  );
}
