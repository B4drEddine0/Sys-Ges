import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskApi } from './taskApi';
import { useProject } from '@/providers/ProjectProvider';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/types';

// ============================================================
// Query keys (scoped to project)
// ============================================================

function queryKeys(projectId: string | null) {
  return {
    tasks: ['tasks', projectId] as const,
    members: ['members', projectId] as const,
    sections: ['sections', projectId] as const,
    labels: ['labels', projectId] as const,
    activities: ['activities', projectId] as const,
    comments: (taskId: string) => ['comments', taskId] as const,
  };
}

// ============================================================
// Queries
// ============================================================

export function useTasksQuery() {
  const { activeProjectId } = useProject();
  return useQuery({
    queryKey: queryKeys(activeProjectId).tasks,
    queryFn: () => taskApi.listTasks(activeProjectId!),
    enabled: !!activeProjectId,
  });
}

export function useProjectMembersQuery() {
  const { activeProjectId } = useProject();
  return useQuery({
    queryKey: queryKeys(activeProjectId).members,
    queryFn: () => taskApi.listProjectMembers(activeProjectId!),
    enabled: !!activeProjectId,
  });
}

/** @deprecated Use useProjectMembersQuery instead */
export function useUsersQuery() {
  return useProjectMembersQuery();
}

export function useSectionsQuery() {
  const { activeProjectId } = useProject();
  return useQuery({
    queryKey: queryKeys(activeProjectId).sections,
    queryFn: () => taskApi.listSections(activeProjectId!),
    enabled: !!activeProjectId,
  });
}

export function useLabelsQuery() {
  const { activeProjectId } = useProject();
  return useQuery({
    queryKey: queryKeys(activeProjectId).labels,
    queryFn: () => taskApi.listLabels(activeProjectId!),
    enabled: !!activeProjectId,
  });
}

export function useActivitiesQuery() {
  const { activeProjectId } = useProject();
  return useQuery({
    queryKey: queryKeys(activeProjectId).activities,
    queryFn: () => taskApi.listActivities(activeProjectId!),
    enabled: !!activeProjectId,
  });
}

export function useTaskCommentsQuery(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys(null).comments(taskId!),
    queryFn: () => taskApi.listTaskComments(taskId!),
    enabled: !!taskId,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const { activeProjectId } = useProject();
  const { user } = useAuth();

  const keys = queryKeys(activeProjectId);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.tasks }),
      queryClient.invalidateQueries({ queryKey: keys.activities }),
    ]);
  };

  const createActivity = async (taskId: string | null, type: string, title: string, description: string) => {
    if (!activeProjectId || !user) return;
    try {
      await taskApi.createActivity(
        { taskId, actorId: user.id, type, title, description },
        activeProjectId,
      );
    } catch (e) {
      console.error('Failed to log activity (usually means profile is missing):', e);
    }
  };

  const createTask = useMutation({
    mutationFn: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!activeProjectId) throw new Error('No active project');
      return taskApi.createTask(task, activeProjectId);
    },
    onSuccess: async (created) => {
      await createActivity(created.id, 'task_created', 'Task created', created.title);
      await invalidate();
    },
  });

  const updateTask = useMutation({
    mutationFn: taskApi.updateTask,
    onMutate: async (nextTask: Task) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks });
      const previous = queryClient.getQueryData<Task[]>(keys.tasks);
      if (previous) {
        queryClient.setQueryData<Task[]>(keys.tasks, previous.map((task) => (task.id === nextTask.id ? { ...nextTask } : task)));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(keys.tasks, context.previous);
    },
    onSuccess: async (updated) => {
      await createActivity(updated.id, 'task_updated', 'Task updated', updated.title);
      await invalidate();
    },
  });

  const patchTask = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: Partial<Task> }) => taskApi.patchTask(taskId, patch),
    onMutate: async ({ taskId, patch }) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks });
      const previous = queryClient.getQueryData<Task[]>(keys.tasks);
      if (previous) {
        queryClient.setQueryData<Task[]>(keys.tasks, previous.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(keys.tasks, context.previous);
    },
    onSuccess: async (updated) => {
      await createActivity(updated.id, 'task_updated', 'Task updated', updated.title);
      await invalidate();
    },
  });

  const deleteTask = useMutation({
    mutationFn: taskApi.deleteTask,
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks });
      const previous = queryClient.getQueryData<Task[]>(keys.tasks);
      const deletedTask = previous?.find((t) => t.id === taskId);
      if (previous) queryClient.setQueryData<Task[]>(keys.tasks, previous.filter((task) => task.id !== taskId));
      return { previous, deletedTask };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(keys.tasks, context.previous);
    },
    onSuccess: async (_data, _taskId, context) => {
      if (context?.deletedTask) {
        await createActivity(null, 'task_deleted', 'Task deleted', context.deletedTask.title);
      }
      await invalidate();
    },
  });

  const createComment = useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      taskApi.createTaskComment(taskId, content),
    onSuccess: (comment) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys(null).comments(comment.taskId) });
    },
  });

  const deleteComment = useMutation({
    mutationFn: ({ id, taskId }: { id: string; taskId: string }) => taskApi.deleteTaskComment(id),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys(null).comments(variables.taskId) });
    },
  });

  return { createTask, updateTask, patchTask, deleteTask, createComment, deleteComment };
}

// ============================================================
// Realtime subscriptions (Phase 6)
// ============================================================

export function useRealtimeSubscription() {
  const queryClient = useQueryClient();
  const { activeProjectId } = useProject();

  useEffect(() => {
    if (!activeProjectId) return;

    const keys = queryKeys(activeProjectId);

    const channel = supabase
      .channel(`project-${activeProjectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${activeProjectId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: keys.tasks });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `project_id=eq.${activeProjectId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: keys.activities });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sections', filter: `project_id=eq.${activeProjectId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: keys.sections });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'labels', filter: `project_id=eq.${activeProjectId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: keys.labels });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_members', filter: `project_id=eq.${activeProjectId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: keys.members });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeProjectId, queryClient]);
}