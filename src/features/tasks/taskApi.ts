import { api } from '@/lib/api';
import type { Activity, Label, Section, Task, User } from '@/types';

export const taskApi = {
  listTasks: async () => (await api.get<Task[]>('/tasks?_sort=order')).data,
  listUsers: async () => (await api.get<User[]>('/users')).data,
  listSections: async () => (await api.get<Section[]>('/sections')).data,
  listLabels: async () => (await api.get<Label[]>('/labels')).data,
  listActivities: async () => (await api.get<Activity[]>('/activities?_sort=-createdAt')).data,
  createTask: async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => (await api.post<Task>('/tasks', { ...task, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })).data,
  updateTask: async (task: Task) => (await api.put<Task>(`/tasks/${task.id}`, { ...task, updatedAt: new Date().toISOString() })).data,
  patchTask: async (taskId: string, patch: Partial<Task>) => (await api.patch<Task>(`/tasks/${taskId}`, { ...patch, updatedAt: new Date().toISOString() })).data,
  deleteTask: async (taskId: string) => {
    await api.delete(`/tasks/${taskId}`);
  },
  createActivity: async (activity: Omit<Activity, 'id' | 'createdAt'>) => (await api.post<Activity>('/activities', { ...activity, id: crypto.randomUUID(), createdAt: new Date().toISOString() })).data,
};
