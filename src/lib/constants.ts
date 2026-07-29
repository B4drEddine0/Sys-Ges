import type { Priority, TaskStatus } from '@/types';

export const taskStatuses: Array<{ id: TaskStatus; label: string; tone: string }> = [
  { id: 'backlog', label: 'Backlog', tone: 'slate' },
  { id: 'todo', label: 'Todo', tone: 'blue' },
  { id: 'in_progress', label: 'In Progress', tone: 'amber' },
  { id: 'testing', label: 'Testing', tone: 'cyan' },
  { id: 'done', label: 'Done', tone: 'emerald' },
];

export const priorities: Array<{ id: Priority; label: string; color: string }> = [
  { id: 'low', label: 'Low', color: 'bg-slate-400/20 text-slate-700 dark:text-slate-300' },
  { id: 'medium', label: 'Medium', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { id: 'high', label: 'High', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { id: 'critical', label: 'Critical', color: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
];

export const sortOptions = [
  { id: 'manual', label: 'Manual' },
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'priority', label: 'Priority' },
  { id: 'alphabetical', label: 'Alphabetical' },
  { id: 'updated', label: 'Updated' },
  { id: 'dueDate', label: 'Due Date' },
] as const;
