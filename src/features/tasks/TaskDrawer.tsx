import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Copy, Plus, Save, Trash2 } from 'lucide-react';
import { Button, Drawer, Input, Progress, Select, Textarea, Checkbox } from '@/components/ui';
import { assigneeOptions, priorities, taskStatuses } from '@/lib/constants';
import type { Activity, Label, Task, TaskStatus } from '@/types';
import { useActivitiesQuery, useLabelsQuery, useSectionsQuery, useTaskMutations, useTasksQuery, useUsersQuery } from './taskHooks';
import { useToast } from '@/providers/ToastProvider';
import { format, parseISO } from 'date-fns';

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, 'Title is required'),
  description: z.string().default(''),
  status: z.enum(['backlog', 'todo', 'in_progress', 'testing', 'done']),
  section: z.enum(['frontend', 'backend']),
  assigneeIds: z.array(z.string()).default([]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  labelIds: z.array(z.string()).default([]),
  estimatedHours: z.coerce.number().nullable(),
  dueDate: z.string().nullable(),
  notes: z.string().default(''),
  subtasks: z.array(z.object({ id: z.string(), title: z.string().min(1), completed: z.boolean() })),
  attachments: z.array(z.object({ id: z.string(), name: z.string().min(1), url: z.string().url() })),
  order: z.coerce.number().default(0),
  archived: z.boolean().default(false),
});

type TaskFormValues = z.infer<typeof taskSchema>;

type TaskAttachmentFormValue = {
  id: string;
  name: string;
  url: string;
};

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function toFormValues(task: Task | null): TaskFormValues {
  return task ?? {
    title: '',
    description: '',
    status: 'todo',
    section: 'frontend',
    assigneeIds: [],
    priority: 'medium',
    labelIds: [],
    estimatedHours: 5,
    dueDate: null,
    notes: '',
    subtasks: [],
    attachments: [],
    order: 0,
    archived: false,
  };
}

function toAttachmentPayload(attachments: TaskAttachmentFormValue[], existingTask: Task | null) {
  return attachments.map((attachment) => {
    const existingAttachment = existingTask?.attachments.find((item) => item.id === attachment.id);
    return {
      ...attachment,
      createdAt: existingAttachment?.createdAt ?? new Date().toISOString(),
    };
  });
}

function buildTaskPayload(task: Task | null, values: TaskFormValues): Task {
  const attachments = toAttachmentPayload(values.attachments, task);

  return {
    id: task?.id ?? crypto.randomUUID(),
    createdAt: task?.createdAt ?? new Date().toISOString(),
    updatedAt: task?.updatedAt ?? new Date().toISOString(),
    completedAt: task?.completedAt ?? null,
    ...values,
    attachments,
  };
}

function SectionProgress({ task }: { task: Task }) {
  const total = task.subtasks.length;
  const completed = task.subtasks.filter((subtask) => subtask.completed).length;
  const value = total ? (completed / total) * 100 : task.status === 'done' ? 100 : 0;

  return (
    <div className="space-y-1.5 rounded-2xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{completed} / {total || 0} completed</span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

export function TaskDrawer({
  open,
  taskId,
  onClose,
  onDelete,
  onDuplicate,
}: {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onDelete: (task: Task) => void;
  onDuplicate: (task: Task) => void;
}) {
  const { data: tasks = [] } = useTasksQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: sections = [] } = useSectionsQuery();
  const { data: labels = [] } = useLabelsQuery();
  const { data: activities = [] } = useActivitiesQuery();
  const { createTask, updateTask, patchTask } = useTaskMutations();
  const { pushToast } = useToast();

  const task = useMemo(() => tasks.find((item) => item.id === taskId) ?? null, [taskId, tasks]);
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: toFormValues(task), mode: 'onChange' });
  const { fields: subtaskFields, append: appendSubtask, remove: removeSubtask, update: updateSubtask } = useFieldArray({ control: form.control, name: 'subtasks' });
  const { fields: attachmentFields, append: appendAttachment, remove: removeAttachment } = useFieldArray({ control: form.control, name: 'attachments' });

  useEffect(() => {
    form.reset(toFormValues(task));
  }, [task, form]);

  useEffect(() => {
    if (!task || !form.formState.isDirty) return;
    const handle = window.setTimeout(() => {
      void form.handleSubmit(async (values) => {
        await updateTask.mutateAsync(buildTaskPayload(task, values));
        pushToast({ title: 'Task autosaved', description: values.title });
      })();
    }, 900);

    return () => window.clearTimeout(handle);
  }, [form, pushToast, task, updateTask]);

  const save = form.handleSubmit(async (values) => {
    if (task) {
      await updateTask.mutateAsync(buildTaskPayload(task, values));
      pushToast({ title: 'Task updated', description: values.title });
    } else {
      const created = await createTask.mutateAsync(buildTaskPayload(null, values));
      pushToast({ title: 'Task created', description: created.title });
      onClose();
    }
  });

  const assigneeSummary = (ids: string[]) => {
    if (!ids.length) return 'Unassigned';
    if (ids.includes('both')) return 'Both';
    return ids.map((id) => users.find((user) => user.id === id)?.name ?? id).join(', ');
  };

  const assigneeValue = form.watch('assigneeIds').includes('both')
    ? 'both'
    : form.watch('assigneeIds').includes('me')
      ? 'me'
      : form.watch('assigneeIds').includes('friend')
        ? 'friend'
        : 'unassigned';

  return (
    <Drawer open={open} title={task ? task.title : 'New task'} onClose={onClose}>
      <form className="space-y-6" onSubmit={save}>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Title</label>
          <Input {...form.register('title')} placeholder="Write a clear task title" />
          {form.formState.errors.title ? <p className="text-xs text-rose-600">{form.formState.errors.title.message}</p> : null}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Description</label>
          <Textarea {...form.register('description')} placeholder="Describe the outcome, context, or acceptance criteria" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-medium">Section</label>
            <Select {...form.register('section')}>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </Select>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Status</label>
            <Select {...form.register('status')}>
              {taskStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </Select>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Priority</label>
            <Select {...form.register('priority')}>
              {priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}
            </Select>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Estimated hours</label>
            <Input type="number" step="0.5" {...form.register('estimatedHours')} />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Due date</label>
            <Input type="date" {...form.register('dueDate')} />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Assignee</label>
            <Select
              value={assigneeValue}
              onChange={(event) => {
                const value = event.target.value as 'unassigned' | 'me' | 'friend' | 'both';
                form.setValue('assigneeIds', value === 'unassigned' ? [] : [value], { shouldDirty: true });
              }}
            >
              {assigneeOptions.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Labels</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {labels.map((label) => (
              <label key={label.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch('labelIds').includes(label.id)}
                  onChange={(event) => {
                    const current = form.getValues('labelIds');
                    form.setValue('labelIds', event.target.checked ? [...current, label.id] : current.filter((id) => id !== label.id), { shouldDirty: true });
                  }}
                />
                <span>{label.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Subtasks</label>
            <Button type="button" variant="ghost" size="sm" onClick={() => appendSubtask({ id: makeId('subtask'), title: 'New subtask', completed: false })}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {subtaskFields.length ? subtaskFields.map((subtask, index) => (
              <div key={subtask.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
                <Checkbox checked={Boolean(form.watch(`subtasks.${index}.completed`))} onChange={(checked) => updateSubtask(index, { ...form.getValues(`subtasks.${index}`), completed: checked })} />
                <Input className="border-none bg-transparent px-0 shadow-none" {...form.register(`subtasks.${index}.title`)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeSubtask(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )) : <p className="text-sm text-muted-foreground">No subtasks yet.</p>}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Attachments</label>
            <Button type="button" variant="ghost" size="sm" onClick={() => appendAttachment({ id: makeId('attachment'), name: 'Attachment', url: 'https://example.com' })}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {attachmentFields.length ? attachmentFields.map((attachment, index) => (
              <div key={attachment.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input {...form.register(`attachments.${index}.name`)} placeholder="File name" />
                <Input {...form.register(`attachments.${index}.url`)} placeholder="https://" />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )) : <p className="text-sm text-muted-foreground">No attachments yet.</p>}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Notes</label>
          <Textarea {...form.register('notes')} placeholder="Implementation notes, reminders, or links" />
        </div>

        {task ? <SectionProgress task={task} /> : null}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}><Save className="h-4 w-4" /> Save</Button>
          {task ? <Button type="button" variant="secondary" onClick={() => onDuplicate(task)}><Copy className="h-4 w-4" /> Duplicate</Button> : null}
          {task ? <Button type="button" variant="secondary" onClick={() => patchTask.mutateAsync({ taskId: task.id, patch: { archived: !task.archived } }).then(() => pushToast({ title: task.archived ? 'Task restored' : 'Task archived', description: task.title }))}><Archive className="h-4 w-4" /> {task.archived ? 'Restore' : 'Archive'}</Button> : null}
          {task ? <Button type="button" variant="destructive" onClick={() => onDelete(task)}><Trash2 className="h-4 w-4" /> Delete</Button> : null}
        </div>

        {task ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-semibold">Activity</h3>
              <div className="mt-3 space-y-3">
                {activities.filter((activity) => activity.taskId === task.id).map((activity: Activity) => (
                  <div key={activity.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{activity.title}</p>
                      <span className="text-xs text-muted-foreground">{format(parseISO(activity.createdAt), 'MMM d, p')}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{activity.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </Drawer>
  );
}
