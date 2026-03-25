import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { PropsWithChildren } from 'react';
import { Toaster } from 'sonner';

import { AuthProvider } from '../features/auth/auth-context';
import { SystemControlProvider } from '../features/shared/system-control-context';
import { queryClient } from './query-client';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SystemControlProvider>
          {children}
          <Toaster richColors position="top-right" />
        </SystemControlProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
