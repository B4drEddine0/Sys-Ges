import { useMemo } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { Archive, CalendarDays, CheckSquare, Clock, Edit2, MoreHorizontal, Paperclip, Trash2 } from 'lucide-react';
import { Avatar, Badge, Button, Modal, Progress } from '@/components/ui';
import { useActivitiesQuery, useLabelsQuery, useSectionsQuery, useTaskMutations, useTasksQuery, useProjectMembersQuery } from './taskHooks';
import { useToast } from '@/providers/ToastProvider';
import { priorities, taskStatuses } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { Task } from '@/types';

function getPriorityTone(priority: Task['priority']) {
  return priorities.find((item) => item.id === priority)?.color ?? 'bg-slate-500/10 text-slate-700';
}

export function TaskViewModal({
  open,
  taskId,
  onClose,
  onEdit,
  onDelete,
}: {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onEdit: (taskId: string) => void;
  onDelete: (task: Task) => void;
}) {
  const { data: tasks = [] } = useTasksQuery();
  const { data: users = [] } = useProjectMembersQuery();
  const { data: sections = [] } = useSectionsQuery();
  const { data: labels = [] } = useLabelsQuery();
  const { data: activities = [] } = useActivitiesQuery();
  const { patchTask } = useTaskMutations();
  const { pushToast } = useToast();

  const task = useMemo(() => tasks.find((item) => item.id === taskId) ?? null, [taskId, tasks]);

  if (!task) {
    return <Modal open={open} onClose={onClose} title="Loading task..."><div className="p-8"></div></Modal>;
  }

  const section = sections.find((s) => s.id === task.section);
  const status = taskStatuses.find((s) => s.id === task.status);
  const priority = priorities.find((p) => p.id === task.priority);
  const taskLabels = task.labelIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean);
  const assignee = users.find((u) => task.assigneeIds.includes(u.id));

  const totalSubtasks = task.subtasks.length;
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const progressValue = totalSubtasks ? (completedSubtasks / totalSubtasks) * 100 : task.status === 'done' ? 100 : 0;

  const handleToggleArchive = async () => {
    await patchTask.mutateAsync({ taskId: task.id, patch: { archived: !task.archived } });
    pushToast({
      title: !task.archived ? 'Task archived' : 'Task restored',
      description: task.title,
    });
    onClose();
  };

  const handleToggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
    const newSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, completed: !currentCompleted } : st
    );
    await patchTask.mutateAsync({ taskId: task.id, patch: { subtasks: newSubtasks } });
  };

  return (
    <Modal open={open} onClose={onClose} title="" className="max-w-4xl">
      <div className="flex flex-col h-[80vh] max-h-[800px] -m-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Badge>{section?.name ?? task.section}</Badge>
            <Badge><span className={getPriorityTone(task.priority)}>{priority?.label}</span></Badge>
            {task.archived && <Badge><span className="text-amber-600 dark:text-amber-400 flex items-center"><Archive className="w-3 h-3 mr-1" /> Archived</span></Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => onEdit(task.id)}>
              <Edit2 className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button variant="secondary" size="sm" onClick={handleToggleArchive}>
              <Archive className="h-4 w-4 mr-1" /> {task.archived ? 'Restore' : 'Archive'}
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { onClose(); onDelete(task); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Content (Left/Center) */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-4">{task.title}</h1>
                <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {task.description || <span className="italic opacity-50">No description provided.</span>}
                </div>
              </div>

              {/* Subtasks */}
              {task.subtasks.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-muted-foreground" />
                      Subtasks
                    </h3>
                    <span className="text-sm text-muted-foreground">{completedSubtasks} / {totalSubtasks} completed</span>
                  </div>
                  <div className="mb-4">
                    <Progress value={progressValue} />
                  </div>
                  <div className="space-y-2 mt-4">
                    {task.subtasks.map((subtask) => (
                      <label key={subtask.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          checked={subtask.completed}
                          onChange={() => handleToggleSubtask(subtask.id, subtask.completed)}
                        />
                        <span className={cn("text-sm leading-tight", subtask.completed && "line-through text-muted-foreground")}>
                          {subtask.title}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {task.notes && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Notes</h3>
                  <div className="p-4 rounded-xl bg-muted/30 text-sm whitespace-pre-wrap border border-border">
                    {task.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar (Right) */}
            <div className="space-y-6">
              {/* Properties */}
              <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">Properties</h4>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Status</span>
                    <Badge>{status?.label}</Badge>
                  </div>
                  
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Assignee</span>
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <div className="scale-75 origin-left">
                          <Avatar name={assignee.name.slice(0, 2).toUpperCase()} color={assignee.color} />
                        </div>
                        <span className="text-sm font-medium -ml-1">{assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Unassigned</span>
                    )}
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Due Date</span>
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {task.dueDate && isValid(parseISO(task.dueDate)) ? format(parseISO(task.dueDate), 'PPP') : <span className="italic text-muted-foreground">No due date</span>}
                    </div>
                  </div>

                  {task.estimatedHours && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Estimate</span>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {task.estimatedHours} hours
                      </div>
                    </div>
                  )}

                  {taskLabels.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground block mb-2">Labels</span>
                      <div className="flex flex-wrap gap-1.5">
                        {taskLabels.map(l => (
                          <Badge key={l?.id}>{l?.name}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments */}
              {task.attachments.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Attachments
                  </h4>
                  <div className="space-y-2">
                    {task.attachments.map(att => (
                      <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm group">
                        <div className="p-2 rounded bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Paperclip className="h-4 w-4" />
                        </div>
                        <span className="font-medium truncate flex-1">{att.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
