import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { Project, ProjectMember, MemberRole } from '@/types/project';

interface ProjectContextValue {
  projects: ProjectMember[];
  activeProject: Project | null;
  activeProjectId: string | null;
  activeRole: MemberRole | null;
  setActiveProjectId: (id: string | null) => void;
  isLoading: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const ACTIVE_PROJECT_KEY = 'sys-ges-active-project';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectMember[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_KEY);
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('project_members')
      .select('*, projects(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true });

    if (!error && data) {
      setProjects(data as ProjectMember[]);

      // Auto-select first project if none is active
      if (!activeProjectId && data.length > 0) {
        const firstProjectId = (data[0] as ProjectMember).project_id;
        setActiveProjectIdState(firstProjectId);
        try {
          localStorage.setItem(ACTIVE_PROJECT_KEY, firstProjectId);
        } catch { /* ignore */ }
      }
    }

    setIsLoading(false);
  }, [user, activeProjectId]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const setActiveProjectId = (id: string | null) => {
    setActiveProjectIdState(id);
    try {
      if (id) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    } catch { /* ignore */ }
  };

  const refreshProjects = async () => {
    await fetchProjects();
  };

  const activeMember = useMemo(
    () => projects.find((pm) => pm.project_id === activeProjectId),
    [projects, activeProjectId],
  );

  const activeProject = activeMember?.projects ?? null;
  const activeRole = activeMember?.role ?? null;

  const value = useMemo(
    () => ({
      projects,
      activeProject,
      activeProjectId,
      activeRole,
      setActiveProjectId,
      isLoading,
      refreshProjects,
    }),
    [projects, activeProject, activeProjectId, activeRole, isLoading],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within ProjectProvider');
  return context;
}
