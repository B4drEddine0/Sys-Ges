import { useMemo } from 'react';
import { DndContext, DragEndEvent, PointerSensor, KeyboardSensor, closestCorners, pointerWithin, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, MoreHorizontal, Paperclip } from 'lucide-react';
import { Avatar, Badge, Card, Checkbox, Progress } from './ui';
import { cn } from '@/lib/cn';
import { priorities, taskStatuses } from '@/lib/constants';
import type { Label, Task, TaskStatus } from '@/types';
import { format, isValid, parseISO } from 'date-fns';

interface UserLike {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

function getPriorityTone(priority: Task['priority']) {
  return priorities.find((item) => item.id === priority)?.color ?? 'bg-slate-500/10 text-slate-700';
}

function getLabelById(labelIds: string[], labels: Label[]) {
  return labelIds.map((labelId) => labels.find((label) => label.id === labelId)).filter(Boolean) as Label[];
}

function getAssignee(task: Task, users: UserLike[]) {
  if (!task.assigneeIds.length) return 'Unassigned';
  const firstAssignee = users.find((user) => user.id === task.assigneeIds[0]);
  if (firstAssignee) return firstAssignee.name;
  return 'Unknown';
}

function getAssigneeColor(task: Task, users: UserLike[]) {
  if (!task.assigneeIds.length) return '#64748b';
  const firstAssignee = users.find((user) => user.id === task.assigneeIds[0]);
  return firstAssignee?.color ?? '#2563eb';
}

function formatDueDate(value: string | null) {
  if (!value) return 'No due date';
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'MMM d') : 'No due date';
}

function isTaskStatus(value: string): value is TaskStatus {
  return taskStatuses.some((status) => status.id === value);
}

function SubtaskProgress({ task }: { task: Task }) {
  const total = task.subtasks.length;
  const completed = task.subtasks.filter((subtask) => subtask.completed).length;
  const value = total ? (completed / total) * 100 : task.status === 'done' ? 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{completed} / {total || 0} subtasks</span>
        <span>{total ? `${Math.round(value)}%` : task.status === 'done' ? '100%' : '0%'}</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function TaskCard({ task, labels, users, selected, onToggleSelect, onOpen }: {
  task: Task;
  labels: Label[];
  users: UserLike[];
  selected: boolean;
  onToggleSelect: (taskId: string) => void;
  onOpen: (taskId: string) => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const labelRecords = getLabelById(task.labelIds, labels);

  return (
    <Card ref={setNodeRef} style={style} className={cn('group relative cursor-grab active:cursor-grabbing hover:border-foreground/20 p-3 transition-colors', isDragging && 'opacity-50', selected && 'ring-2 ring-accent border-transparent')} {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onChange={() => onToggleSelect(task.id)} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1" onClick={() => onOpen(task.id)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-5">{task.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description || task.notes}</p>
            </div>
            <button type="button" className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge className={cn('border-none', getPriorityTone(task.priority))}>{task.priority}</Badge>
            {labelRecords.slice(0, 2).map((label) => <Badge key={label.id}>{label.name}</Badge>)}
            {labelRecords.length > 2 ? <Badge>+{labelRecords.length - 2}</Badge> : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar name={getAssignee(task, users).slice(0, 2).toUpperCase()} color={getAssigneeColor(task, users)} />
              <span className="truncate">{getAssignee(task, users)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDueDate(task.dueDate)}</span>
              {task.attachments.length ? <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{task.attachments.length}</span> : null}
            </div>
          </div>

          <div className="mt-3">
            <SubtaskProgress task={task} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Column({ status, title, tasks, children }: { status: TaskStatus; title: string; tasks: Task[]; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <section ref={setNodeRef} className="flex h-full min-w-[19rem] max-w-[19rem] flex-col rounded-3xl border border-border bg-muted/25 p-3">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <Badge>{tasks.length}</Badge>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">{children}</div>
    </section>
  );
}

export function KanbanBoard({
  tasks,
  labels,
  users,
  selectedIds,
  onToggleSelect,
  onOpen,
  onMoveTask,
}: {
  tasks: Task[];
  labels: Label[];
  users: UserLike[];
  selectedIds: string[];
  onToggleSelect: (taskId: string) => void;
  onOpen: (taskId: string) => void;
  onMoveTask: (taskId: string, nextStatus: TaskStatus, nextOrder: number) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const tasksByStatus = useMemo(() => {
    return taskStatuses.reduce<Record<TaskStatus, Task[]>>((accumulator, status) => {
      accumulator[status.id] = tasks.filter((task) => task.status === status.id).sort((a, b) => a.order - b.order);
      return accumulator;
    }, {
      backlog: [], todo: [], in_progress: [], testing: [], done: [],
    });
  }, [tasks]);

  const collisionDetection = useMemo(() => {
    return (args: Parameters<typeof pointerWithin>[0]) => {
      const pointerCollisions = pointerWithin(args);
      return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
    };
  }, []);

  const dragTask = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    const activeTask = tasks.find((task) => task.id === activeId);
    if (!activeTask) return;

    const overTask = tasks.find((task) => task.id === overId);
    const nextStatus = isTaskStatus(overId) ? overId : overTask?.status ?? activeTask.status;
    const targetTasks = tasksByStatus[nextStatus].filter((task) => task.id !== activeId);

    let nextOrder = activeTask.order;
    if (!overTask || overTask.status !== nextStatus || isTaskStatus(overId)) {
      nextOrder = targetTasks.length ? targetTasks[targetTasks.length - 1].order + 1 : 0;
    } else {
      const sorted = [...targetTasks].sort((a, b) => a.order - b.order);
      const overIndex = sorted.findIndex((task) => task.id === overTask.id);
      if (overIndex === -1) return;
      const previous = sorted[overIndex - 1];
      const next = sorted[overIndex + 1];
      if (!previous && !next) nextOrder = overTask.order;
      else if (!previous) nextOrder = overTask.order - 1;
      else if (!next) nextOrder = previous.order + 1;
      else nextOrder = (previous.order + next.order) / 2;
    }

    onMoveTask(activeTask.id, nextStatus, nextOrder);
  };

  return (
    <DndContext collisionDetection={collisionDetection} onDragEnd={dragTask} sensors={sensors}>
      <div className="flex h-full gap-4 overflow-x-auto pb-2">
        {taskStatuses.map((status) => (
          <Column key={status.id} status={status.id} title={status.label} tasks={tasksByStatus[status.id]}>
            <SortableContext items={tasksByStatus[status.id].map((task) => task.id)} strategy={verticalListSortingStrategy}>
              {tasksByStatus[status.id].map((task) => (
                <TaskCard key={task.id} task={task} labels={labels} users={users} selected={selectedIds.includes(task.id)} onToggleSelect={onToggleSelect} onOpen={onOpen} />
              ))}
            </SortableContext>
          </Column>
        ))}
      </div>
      <DragOverlay>
        <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-2xl">Moving task…</div>
      </DragOverlay>
    </DndContext>
  );
}
