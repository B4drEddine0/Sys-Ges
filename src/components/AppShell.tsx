import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, MoonStar, Search, SunMedium } from 'lucide-react';
import { Button, Input } from './ui';
import { useShell } from '@/providers/ShellProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { sectionTabs } from '@/lib/constants';

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { search, setSearch } = useShell();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-full bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 border-r border-border bg-card/40 px-5 py-6 lg:flex lg:flex-col">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <img src="/sys-ges-logo.png" alt="Sys-Ges" className="h-11 w-11 rounded-2xl object-contain" />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">Sys-Ges</p>
              <h1 className="text-xl font-semibold">Task Manager</h1>
            </div>
          </div>
        </div>

        <nav className="space-y-2 text-sm">
          <button onClick={() => navigate('/')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted"><LayoutDashboard className="h-4 w-4" />Dashboard</button>
          <button onClick={() => navigate('/board/frontend')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted"><KanbanSquare className="h-4 w-4" />Frontend board</button>
          <button onClick={() => navigate('/board/backend')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted"><KanbanSquare className="h-4 w-4" />Backend board</button>
        </nav>

        <div className="mt-8 rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sections</p>
          <div className="mt-3 space-y-2">
            {sectionTabs.map((section) => (
              <button key={section.id} onClick={() => navigate(`/board/${section.id}`)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted">
                <span>{section.label}</span>
                <span className="text-xs text-muted-foreground">Board</span>
              </button>
            ))}
          </div>
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
          </div>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
