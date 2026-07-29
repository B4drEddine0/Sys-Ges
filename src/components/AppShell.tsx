import { useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, MoonStar, Search, SunMedium, LogOut, Settings, User, FolderKanban, MessageSquare } from 'lucide-react';
import { Button, Input, Avatar } from './ui';
import { useShell } from '@/providers/ShellProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useProject } from '@/providers/ProjectProvider';
import { useRealtimeSubscription } from '@/features/tasks/taskHooks';
import { useSectionsQuery } from '@/features/tasks/taskHooks';
import { useEffect } from 'react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const params = useParams();
  const projectId = params.projectId;
  const { search, setSearch } = useShell();
  const { theme, setTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const { activeProject, setActiveProjectId, activeRole } = useProject();
  const { data: sections = [] } = useSectionsQuery();

  // Activate project from URL param
  useEffect(() => {
    if (projectId) {
      setActiveProjectId(projectId);
    }
  }, [projectId, setActiveProjectId]);

  // Enable realtime subscriptions for this project
  useRealtimeSubscription();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = (profile?.display_name ?? 'U').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-full bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-card/40 px-5 py-6 lg:flex lg:flex-col">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <img src="/sys-ges-logo.png" alt="Sys-Ges" className="h-11 w-11 rounded-2xl object-contain" />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">Sys-Ges</p>
              <h1 className="text-xl font-semibold">{activeProject?.name ?? 'Task Manager'}</h1>
            </div>
          </div>
        </div>

        <nav className="space-y-2 text-sm">
            <button onClick={() => navigate('/projects')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-muted">
              <FolderKanban className="h-4 w-4" />All Projects
            </button>
            <button onClick={() => navigate('/chat')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-muted text-primary">
              <MessageSquare className="h-4 w-4" />Team Chat
            </button>
          {projectId && (
            <>
              <button onClick={() => navigate(`/project/${projectId}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted">
                <LayoutDashboard className="h-4 w-4" />Dashboard
              </button>
              {sections.length > 0
                ? sections.map((section) => (
                    <button key={section.id} onClick={() => navigate(`/project/${projectId}/board/${section.id}`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted">
                      <KanbanSquare className="h-4 w-4" />{section.name} board
                    </button>
                  ))
                : (
                    <>
                      <button onClick={() => navigate(`/project/${projectId}/board/frontend`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted">
                        <KanbanSquare className="h-4 w-4" />Frontend board
                      </button>
                      <button onClick={() => navigate(`/project/${projectId}/board/backend`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted">
                        <KanbanSquare className="h-4 w-4" />Backend board
                      </button>
                    </>
                  )
              }
              {(activeRole === 'owner' || activeRole === 'admin') && (
                <button onClick={() => navigate(`/project/${projectId}/settings`)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted">
                  <Settings className="h-4 w-4" />Project Settings
                </button>
              )}
            </>
          )}
        </nav>

        {projectId && sections.length > 0 && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sections</p>
            <div className="mt-3 space-y-2">
              {sections.map((section) => (
                <button key={section.id} onClick={() => navigate(`/project/${projectId}/board/${section.id}`)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted">
                  <span>{section.name}</span>
                  <span className="text-xs text-muted-foreground">Board</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* User section */}
        <div className="mt-auto space-y-2 pt-6 border-t border-border">
          <button onClick={() => navigate('/profile')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted">
            <Avatar name={initials} color="#2563eb" src={profile?.avatar_url} className="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.display_name ?? 'User'}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </button>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="h-4 w-4" />Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-4 lg:px-6">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, description, labels, assignee…" className="pl-9" />
            </div>
            <Button variant="secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="shrink-0">
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
            </Button>
            <button onClick={() => navigate('/profile')} className="flex items-center justify-center lg:hidden">
              <Avatar name={initials} color="#2563eb" src={profile?.avatar_url} className="h-9 w-9" />
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
