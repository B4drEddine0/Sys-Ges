import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/providers/AuthProvider';
import { DashboardPage } from '@/pages/DashboardPage';
import { BoardPage } from '@/pages/BoardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectSettingsPage } from '@/pages/ProjectSettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ChatPage } from '@/pages/ChatPage';

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/projects" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
        <Route path="/register" element={<AuthRedirect><RegisterPage /></AuthRedirect>} />
        <Route path="/forgot-password" element={<AuthRedirect><ForgotPasswordPage /></AuthRedirect>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><Navigate to="/projects" replace /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/projects" replace /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
        <Route
          path="/project/:projectId"
          element={
            <ProtectedRoute>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:projectId/board/:sectionId"
          element={
            <ProtectedRoute>
              <AppShell>
                <BoardPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:projectId/settings"
          element={
            <ProtectedRoute>
              <AppShell>
                <ProjectSettingsPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="/profile" element={<ProtectedRoute><AppShell><ProfilePage /></AppShell></ProtectedRoute>} />

        {/* Old routes redirects */}
        <Route path="/board/:sectionId" element={<ProtectedRoute><Navigate to="/projects" replace /></ProtectedRoute>} />

        {/* 404 */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <AppShell>
                <ChatPage />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}