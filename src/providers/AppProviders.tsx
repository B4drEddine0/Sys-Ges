import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ShellProvider } from '@/providers/ShellProvider';
import { AppLoader } from '@/components/AppLoader';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AppLoader>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ShellProvider>{children}</ShellProvider>
          </ToastProvider>
        </QueryClientProvider>
      </AppLoader>
    </ThemeProvider>
  );
}
