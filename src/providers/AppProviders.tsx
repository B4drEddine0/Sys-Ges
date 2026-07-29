import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { ShellProvider } from '@/providers/ShellProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { ProjectProvider } from '@/providers/ProjectProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <ProjectProvider>
              <ShellProvider>{children}</ShellProvider>
            </ProjectProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
