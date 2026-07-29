export type SectionId = string;
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'testing' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
}

export interface Section {
  id: SectionId;
  name: string;
  color: string;
  order: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  section: SectionId;
  assigneeIds: string[];
  priority: Priority;
  labelIds: string[];
  estimatedHours: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notes: string;
  subtasks: Subtask[];
  attachments: Attachment[];
  order: number;
  archived: boolean;
}

export interface Activity {
  id: string;
  taskId: string | null;
  actorId: string | null;
  type: string;
  title: string;
  description: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}
