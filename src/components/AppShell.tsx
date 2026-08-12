import { useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, MoonStar, Search, SunMedium, LogOut, Settings, User, FolderKanban, MessageSquare, ShieldAlert } from 'lucide-react';
import { Button, Input, Avatar } from './ui';
import { NotificationsPopover } from './NotificationsPopover';
import { useShell } from '@/providers/ShellProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useProject } from '@/providers/ProjectProvider';
import { useRealtimeSubscription, useSectionsQuery } from '@/features/tasks/taskHooks';
import { useChatsQuery } from '@/features/chat/chatHooks';
import { useEffect, useState } from 'react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { projectId: urlProjectId } = useParams();
  
  // Remember the last project ID so the sidebar doesn't collapse when navigating to global routes like /chat
  const [projectId, setProjectId] = useState<string | undefined>(urlProjectId);
  useEffect(() => {
    if (urlProjectId) {
      setProjectId(urlProjectId);
      localStorage.setItem('sysges_last_project', urlProjectId);
    } else {
      const stored = localStorage.getItem('sysges_last_project');
      if (stored) setProjectId(stored);
    }
  }, [urlProjectId]);

  const { search, setSearch } = useShell();
  const { theme, setTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const { activeProject, setActiveProjectId, activeRole } = useProject();
  const { data: sections = [] } = useSectionsQuery();
  const { data: chats = [] } = useChatsQuery();

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
  const totalUnreadChats = chats.reduce((acc, chat) => acc + (chat.unread_count || 0), 0);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when navigating
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [navigate]);

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - responsive */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 border-r border-border bg-card px-5 py-6 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <img src="/sys-ges-logo.png" alt="Sys-Ges" className="h-11 w-11 rounded-2xl object-contain" />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">Sys-Ges</p>
              <h1 className="text-xl font-semibold">{activeProject?.name ?? 'Task Manager'}</h1>
            </div>
          </div>
        </div>

        <nav className="space-y-2 text-sm flex-1 overflow-y-auto pr-2">
            <button onClick={() => navigate('/projects')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-muted">
              <FolderKanban className="h-4 w-4" />All Projects
            </button>
            <button onClick={() => navigate('/chat')} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-muted group">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4" />Team Chat
              </div>
              {totalUnreadChats > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {totalUnreadChats}
                </span>
              )}
            </button>
            {profile?.is_super_admin && (
              <button onClick={() => navigate('/system')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10">
                <ShieldAlert className="h-4 w-4" />System Admin
              </button>
            )}
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
        
          {projectId && sections.length > 0 && (
            <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-4">
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
        </nav>

        {/* User section */}
        <div className="mt-auto space-y-2 pt-6 border-t border-border shrink-0">
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
            <button 
              className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="pl-9" />
            </div>
            <Button variant="secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="shrink-0">
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
            </Button>
            <NotificationsPopover />
            <button onClick={() => navigate('/profile')} className="hidden lg:flex items-center justify-center">
              <Avatar name={initials} color="#2563eb" src={profile?.avatar_url} className="h-9 w-9" />
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto flex flex-col relative">{children}</main>
      </div>
    </div>
  );
}
