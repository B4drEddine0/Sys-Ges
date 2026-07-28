import { supabase } from '@/lib/supabase';
import type { Activity, Attachment, Label, Section, Subtask, Task, User } from '@/types';

type TaskRow = {
  id: string;
  title: string;
  description: string;
  status: Task['status'];
  section_id: Task['section'];
  assignee_ids: string[] | null;
  priority: Task['priority'];
  label_ids: string[] | null;
  estimated_hours: number | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  notes: string;
  subtasks: Subtask[] | null;
  attachments: Attachment[] | null;
  order_index: number;
  archived: boolean;
};

type LabelRow = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

type SectionRow = {
  id: Section['id'];
  name: string;
  color: string;
  order_index: number;
};

type ActivityRow = {
  id: string;
  task_id: string | null;
  actor_id: string | null;
  type: string;
  title: string;
  description: string;
  created_at: string;
  meta?: Record<string, unknown> | null;
};

type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function fromTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    section: row.section_id,
    assigneeIds: row.assignee_ids ?? [],
    priority: row.priority,
    labelIds: row.label_ids ?? [],
    estimatedHours: row.estimated_hours,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    notes: row.notes,
    subtasks: row.subtasks ?? [],
    attachments: row.attachments ?? [],
    order: row.order_index,
    archived: row.archived,
  };
}

function toTaskRow(task: Task | (TaskInput & { id: string; createdAt: string; updatedAt: string })): TaskRow {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    section_id: task.section,
    assignee_ids: task.assigneeIds,
    priority: task.priority,
    label_ids: task.labelIds,
    estimated_hours: task.estimatedHours,
    due_date: task.dueDate,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    completed_at: task.completedAt,
    notes: task.notes,
    subtasks: task.subtasks,
    attachments: task.attachments,
    order_index: task.order,
    archived: task.archived,
  };
}

function toTaskPatchRow(patch: Partial<Task>) {
  return {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.section !== undefined ? { section_id: patch.section } : {}),
    ...(patch.assigneeIds !== undefined ? { assignee_ids: patch.assigneeIds } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.labelIds !== undefined ? { label_ids: patch.labelIds } : {}),
    ...(patch.estimatedHours !== undefined ? { estimated_hours: patch.estimatedHours } : {}),
    ...(patch.dueDate !== undefined ? { due_date: patch.dueDate } : {}),
    ...(patch.completedAt !== undefined ? { completed_at: patch.completedAt } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.subtasks !== undefined ? { subtasks: patch.subtasks } : {}),
    ...(patch.attachments !== undefined ? { attachments: patch.attachments } : {}),
    ...(patch.order !== undefined ? { order_index: patch.order } : {}),
    ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
    updated_at: new Date().toISOString(),
  };
}

function fromLabelRow(row: LabelRow): Label {
  return { id: row.id, name: row.name, color: row.color, createdAt: row.created_at };
}

function fromSectionRow(row: SectionRow): Section {
  return { id: row.id, name: row.name, color: row.color, order: row.order_index };
}

function fromActivityRow(row: ActivityRow): Activity {
  return {
    id: row.id,
    taskId: row.task_id,
    actorId: row.actor_id,
    type: row.type,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    meta: row.meta ?? undefined,
  };
}

export const taskApi = {
  listTasks: async () => {
    const { data, error } = await supabase.from('tasks').select('*').order('order_index', { ascending: true });
    assertNoError(error);
    return ((data ?? []) as TaskRow[]).map(fromTaskRow);
  },
  listUsers: async () => {
    const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
    assertNoError(error);
    return (data ?? []) as User[];
  },
  listSections: async () => {
    const { data, error } = await supabase.from('sections').select('*').order('order_index', { ascending: true });
    assertNoError(error);
    return ((data ?? []) as SectionRow[]).map(fromSectionRow);
  },
  listLabels: async () => {
    const { data, error } = await supabase.from('labels').select('*').order('name', { ascending: true });
    assertNoError(error);
    return ((data ?? []) as LabelRow[]).map(fromLabelRow);
  },
  listActivities: async () => {
    const { data, error } = await supabase.from('activities').select('*').order('created_at', { ascending: false });
    assertNoError(error);
    return ((data ?? []) as ActivityRow[]).map(fromActivityRow);
  },
  createTask: async (task: TaskInput) => {
    const now = new Date().toISOString();
    const nextTask = { ...task, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    const { data, error } = await supabase.from('tasks').insert(toTaskRow(nextTask)).select('*').single();
    assertNoError(error);
    return fromTaskRow(data as TaskRow);
  },
  updateTask: async (task: Task) => {
    const nextTask = { ...task, updatedAt: new Date().toISOString() };
    const { data, error } = await supabase.from('tasks').update(toTaskRow(nextTask)).eq('id', task.id).select('*').single();
    assertNoError(error);
    return fromTaskRow(data as TaskRow);
  },
  patchTask: async (taskId: string, patch: Partial<Task>) => {
    const { data, error } = await supabase.from('tasks').update(toTaskPatchRow(patch)).eq('id', taskId).select('*').single();
    assertNoError(error);
    return fromTaskRow(data as TaskRow);
  },
  deleteTask: async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    assertNoError(error);
  },
  createActivity: async (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('activities')
      .insert({
        id: crypto.randomUUID(),
        task_id: activity.taskId,
        actor_id: activity.actorId,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        meta: activity.meta ?? null,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    assertNoError(error);
    return fromActivityRow(data as ActivityRow);
  },
};
