import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Archive, Copy, Plus, Save, Trash2, Layout, Tag, ListTodo, Paperclip, FileText, Activity } from 'lucide-react';
import { Button, Drawer, Input, Progress, Select, Textarea, Checkbox } from '@/components/ui';
import { priorities, taskStatuses } from '@/lib/constants';
import type { Activity as ActivityType, Task } from '@/types';
import { useActivitiesQuery, useLabelsQuery, useSectionsQuery, useTaskMutations, useTasksQuery, useProjectMembersQuery } from './taskHooks';
import { useToast } from '@/providers/ToastProvider';
import { format, parseISO } from 'date-fns';

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, 'Title is required'),
  description: z.string().default(''),
  status: z.enum(['backlog', 'todo', 'in_progress', 'testing', 'done']),
  section: z.string().min(1),
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

function SectionHeading({ title, icon: Icon }: { title: string, icon: any }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
      <Icon className="h-4 w-4" /> {title}
    </h3>
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
  const { data: users = [] } = useProjectMembersQuery();
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

  const assigneeValue = form.watch('assigneeIds')[0] ?? 'unassigned';

  return (
    <Drawer open={open} title={task ? 'Edit Task' : 'Create New Task'} onClose={onClose}>
      <form className="space-y-8 pb-10" onSubmit={save}>
        
        {/* Core Info */}
        <div className="space-y-6">
          <SectionHeading title="Core Information" icon={Layout} />
          
          <div>
            <label className="block text-sm font-medium mb-1.5">Task Title *</label>
            <Input {...form.register('title')} placeholder="e.g. Implement user authentication" className="text-lg font-medium" />
            {form.formState.errors.title && <p className="mt-1 text-xs text-rose-600">{form.formState.errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <Textarea {...form.register('description')} placeholder="Provide context, acceptance criteria, and details..." rows={4} />
          </div>
        </div>

        <div className="w-full h-px bg-border my-6" />

        {/* Properties Grid */}
        <div className="space-y-6">
          <SectionHeading title="Properties" icon={Tag} />
          
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Project Section</label>
              <Select {...form.register('section')}>
                {sections.length > 0
                  ? sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)
                  : (
                      <>
                        <option value="frontend">Frontend</option>
                        <option value="backend">Backend</option>
                      </>
                    )
                }
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Current Status</label>
              <Select {...form.register('status')}>
                {taskStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Priority Level</label>
              <Select {...form.register('priority')}>
                {priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Assign To</label>
              <Select
                value={assigneeValue}
                onChange={(event) => {
                  const value = event.target.value;
                  form.setValue('assigneeIds', value === 'unassigned' ? [] : [value], { shouldDirty: true });
                }}
              >
                <option value="unassigned">Unassigned</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Due Date</label>
              <Input type="date" {...form.register('dueDate')} />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Estimated Hours</label>
              <Input type="number" step="0.5" {...form.register('estimatedHours')} placeholder="e.g. 5" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Labels</label>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <label key={label.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm cursor-pointer hover:bg-muted transition-colors shadow-sm">
                  <input
                    type="checkbox"
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
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
        </div>

        <div className="w-full h-px bg-border my-6" />

        {/* Subtasks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeading title="Subtasks" icon={ListTodo} />
            <Button type="button" variant="secondary" size="sm" onClick={() => appendSubtask({ id: makeId('subtask'), title: '', completed: false })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Subtask
            </Button>
          </div>
          
          <div className="space-y-2">
            {subtaskFields.length > 0 ? subtaskFields.map((subtask, index) => (
              <div key={subtask.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
                <Checkbox checked={Boolean(form.watch(`subtasks.${index}.completed`))} onChange={(checked) => updateSubtask(index, { ...form.getValues(`subtasks.${index}`), completed: checked })} />
                <Input className="border-none bg-transparent px-0 shadow-none h-8 focus-visible:ring-0" placeholder="Describe this subtask..." {...form.register(`subtasks.${index}.title`)} />
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeSubtask(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground italic p-4 text-center border border-dashed border-border rounded-lg bg-muted/20">
                No subtasks added yet. Break down your work into smaller steps!
              </div>
            )}
          </div>
        </div>

        <div className="w-full h-px bg-border my-6" />

        {/* Attachments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeading title="Attachments" icon={Paperclip} />
            <Button type="button" variant="secondary" size="sm" onClick={() => appendAttachment({ id: makeId('attachment'), name: '', url: '' })}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Link
            </Button>
          </div>
          <div className="space-y-2">
            {attachmentFields.length > 0 ? attachmentFields.map((attachment, index) => (
              <div key={attachment.id} className="grid gap-2 rounded-lg border border-border bg-card p-3 shadow-sm md:grid-cols-[1fr_2fr_auto]">
                <Input {...form.register(`attachments.${index}.name`)} placeholder="Display name (e.g. Figma)" className="h-9" />
                <Input {...form.register(`attachments.${index}.url`)} placeholder="https://..." className="h-9" />
                <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeAttachment(index)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )) : (
              <div className="text-sm text-muted-foreground italic p-4 text-center border border-dashed border-border rounded-lg bg-muted/20">
                No attachments added. Add relevant links to docs, designs, or PRs.
              </div>
            )}
          </div>
        </div>

        <div className="w-full h-px bg-border my-6" />

        {/* Internal Notes */}
        <div className="space-y-4">
          <SectionHeading title="Internal Notes" icon={FileText} />
          <Textarea {...form.register('notes')} placeholder="Private implementation notes, edge cases, reminders..." rows={3} className="bg-muted/30" />
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-card/95 backdrop-blur pt-4 mt-8 sticky bottom-0 -mb-5 pb-5 -mx-6 px-6 z-10">
          <Button type="submit" disabled={form.formState.isSubmitting} className="min-w-24">
            <Save className="h-4 w-4 mr-2" /> {task ? 'Save Changes' : 'Create Task'}
          </Button>
          
          {task && (
            <>
              <Button type="button" variant="secondary" onClick={() => onDuplicate(task)}>
                <Copy className="h-4 w-4 mr-2" /> Duplicate
              </Button>
              <Button type="button" variant="secondary" onClick={() => patchTask.mutateAsync({ taskId: task.id, patch: { archived: !task.archived } }).then(() => pushToast({ title: task.archived ? 'Task restored' : 'Task archived', description: task.title }))}>
                <Archive className="h-4 w-4 mr-2" /> {task.archived ? 'Restore' : 'Archive'}
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="destructive" onClick={() => onDelete(task)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            </>
          )}
        </div>

        {/* Activity Log */}
        {task && activities.filter((a) => a.taskId === task.id).length > 0 && (
          <div className="mt-12 space-y-4 pt-8 border-t border-border">
            <SectionHeading title="Activity History" icon={Activity} />
            <div className="space-y-3 pl-2 border-l-2 border-border/50">
              {activities.filter((a) => a.taskId === task.id).map((activity: ActivityType) => (
                <div key={activity.id} className="relative pl-6 py-1">
                  <div className="absolute w-2.5 h-2.5 rounded-full bg-border -left-[27px] top-3" />
                  <div className="flex items-center justify-between gap-3 mb-0.5">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{format(parseISO(activity.createdAt), 'MMM d, p')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
}
