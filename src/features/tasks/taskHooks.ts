import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskApi } from './taskApi';
import type { Task } from '@/types';

const queryKeys = {
  tasks: ['tasks'] as const,
  users: ['users'] as const,
  sections: ['sections'] as const,
  labels: ['labels'] as const,
  activities: ['activities'] as const,
};

export function useTasksQuery() {
  return useQuery({ queryKey: queryKeys.tasks, queryFn: taskApi.listTasks });
}

export function useUsersQuery() {
  return useQuery({ queryKey: queryKeys.users, queryFn: taskApi.listUsers });
}

export function useSectionsQuery() {
  return useQuery({ queryKey: queryKeys.sections, queryFn: taskApi.listSections });
}

export function useLabelsQuery() {
  return useQuery({ queryKey: queryKeys.labels, queryFn: taskApi.listLabels });
}

export function useActivitiesQuery() {
  return useQuery({ queryKey: queryKeys.activities, queryFn: taskApi.listActivities });
}

export function useTaskMutations() {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activities }),
    ]);
  };

  const createTask = useMutation({
    mutationFn: taskApi.createTask,
    onSuccess: invalidate,
  });

  const updateTask = useMutation({
    mutationFn: taskApi.updateTask,
    onMutate: async (nextTask: Task) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      const previous = queryClient.getQueryData<Task[]>(queryKeys.tasks);
      if (previous) {
        queryClient.setQueryData<Task[]>(queryKeys.tasks, previous.map((task) => (task.id === nextTask.id ? { ...nextTask } : task)));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.tasks, context.previous);
    },
    onSuccess: invalidate,
  });

  const patchTask = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: Partial<Task> }) => taskApi.patchTask(taskId, patch),
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: taskApi.deleteTask,
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      const previous = queryClient.getQueryData<Task[]>(queryKeys.tasks);
      if (previous) queryClient.setQueryData<Task[]>(queryKeys.tasks, previous.filter((task) => task.id !== taskId));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.tasks, context.previous);
    },
    onSuccess: invalidate,
  });

  return { createTask, updateTask, patchTask, deleteTask };
}