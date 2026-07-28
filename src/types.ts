export type SectionId = 'frontend' | 'backend';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'testing' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type AssigneeId = 'me' | 'friend' | 'both' | 'unassigned';
export type ImportedPriority = 'P0' | 'P1' | 'P2';

export interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
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

export interface SeedDatabase {
  users: User[];
  sections: Section[];
  labels: Label[];
  tasks: Task[];
  activities: Activity[];
}

export interface MarkdownImportTask {
  code: string;
  title: string;
  description: string;
  doneWhen: string;
  priority: ImportedPriority;
  lane: 'Shared' | 'Frontend' | 'Backend';
  section: SectionId;
  order: number;
  subtasks: Subtask[];
  labels: string[];
}
