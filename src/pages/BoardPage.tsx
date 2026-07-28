import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Archive, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Modal, Select, Skeleton } from '@/components/ui';
import { KanbanBoard } from '@/components/Kanban';
import { TaskDrawer } from '@/features/tasks/TaskDrawer';
import { useLabelsQuery, useTaskMutations, useTasksQuery, useUsersQuery } from '@/features/tasks/taskHooks';
import { useShell } from '@/providers/ShellProvider';
import { useToast } from '@/providers/ToastProvider';
import { assigneeOptions, sectionTabs, sortOptions, taskStatuses, userFilterOptions } from '@/lib/constants';
import type { Priority, Task, TaskStatus } from '@/types';

type SortKey = typeof sortOptions[number]['id'];

function matchesQuery(task: Task, query: string, labelMap: Record<string, string>, assigneeLabel: string) {
  if (!query) return true;
  const haystack = [task.title, task.description, task.notes, assigneeLabel, ...task.labelIds.map((id) => labelMap[id] ?? id)].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function priorityWeight(priority: Priority) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[priority];
}

export function BoardPage() {
  const params = useParams();
  const section = params.sectionId === 'backend' ? 'backend' : 'frontend';
  const { search } = useShell();
  const { data: tasks = [], isLoading } = useTasksQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: labels = [] } = useLabelsQuery();
  const { createTask, updateTask, patchTask, deleteTask } = useTaskMutations();
  const { pushToast } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [confirmTask, setConfirmTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'me' | 'friend' | 'both' | 'unassigned'>('all');
  const [labelFilter, setLabelFilter] = useState<'all' | string>('all');
  const [archivedFilter, setArchivedFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [sortKey, setSortKey] = useState<SortKey>('manual');

  useEffect(() => {
    setSelectedIds([]);
  }, [section]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (event.key === '/' && activeTag !== 'input' && activeTag !== 'textarea') {
        event.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement | null;
        searchInput?.focus();
      }
      if (event.key.toLowerCase() === 'n' && activeTag !== 'input' && activeTag !== 'textarea') {
        event.preventDefault();
        setDrawerTaskId('new');
      }
      if (event.key === 'Escape') {
        setDrawerTaskId(null);
        setConfirmTask(null);
        setSelectedIds([]);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedIds.length === 1) {
        event.preventDefault();
        const task = tasks.find((item) => item.id === selectedIds[0]);
        if (task) void duplicateTask(task);
      }
      if (event.key === 'Delete' && selectedIds.length) {
        event.preventDefault();
        void bulkDelete();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [selectedIds, tasks]);

  const labelMap = useMemo(() => Object.fromEntries(labels.map((label) => [label.id, label.name])), [labels]);

  const visibleTasks = useMemo(() => {
    const list = tasks.filter((task) => task.section === section);

    return list.filter((task) => {
      const assigneeLabel = task.assigneeIds.includes('both') ? 'both' : task.assigneeIds[0] ?? 'unassigned';
      const queryMatch = matchesQuery(task, search, labelMap, assigneeLabel);
      const statusMatch = statusFilter === 'all' || task.status === statusFilter;
      const priorityMatch = priorityFilter === 'all' || task.priority === priorityFilter;
      const assigneeMatch = assigneeFilter === 'all' || assigneeLabel === assigneeFilter;
      const labelMatch = labelFilter === 'all' || task.labelIds.includes(labelFilter);
      const archivedMatch = archivedFilter === 'all' || (archivedFilter === 'archived' ? task.archived : !task.archived);
      return queryMatch && statusMatch && priorityMatch && assigneeMatch && labelMatch && archivedMatch;
    }).sort((a, b) => {
      switch (sortKey) {
        case 'newest': return String(b.createdAt).localeCompare(String(a.createdAt));
        case 'oldest': return String(a.createdAt).localeCompare(String(b.createdAt));
        case 'priority': return priorityWeight(b.priority) - priorityWeight(a.priority);
        case 'alphabetical': return a.title.localeCompare(b.title);
        case 'updated': return String(b.updatedAt).localeCompare(String(a.updatedAt));
        case 'dueDate': return String(a.dueDate ?? '9999-12-31').localeCompare(String(b.dueDate ?? '9999-12-31'));
        default: return a.order - b.order;
      }
    });
  }, [archivedFilter, assigneeFilter, labelFilter, labelMap, priorityFilter, search, section, sortKey, statusFilter, tasks]);

  const taskForDrawer = drawerTaskId === 'new' ? null : tasks.find((item) => item.id === drawerTaskId) ?? null;

  const toggleSelection = (taskId: string) => setSelectedIds((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);

  const duplicateTask = async (task: Task) => {
    const duplicate = await createTask.mutateAsync({
      title: `${task.title} (copy)`,
      description: task.description,
      status: task.status,
      section: task.section,
      assigneeIds: task.assigneeIds,
      priority: task.priority,
      labelIds: task.labelIds,
      estimatedHours: task.estimatedHours,
      dueDate: task.dueDate,
      completedAt: null,
      notes: task.notes,
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, id: crypto.randomUUID(), completed: false })),
      attachments: task.attachments.map((attachment) => ({ ...attachment, id: crypto.randomUUID() })),
      order: task.order + 0.01,
      archived: false,
    });
    setDrawerTaskId(duplicate.id);
    pushToast({ title: 'Task duplicated', description: duplicate.title });
  };

  const moveTask = async (taskId: string, nextStatus: TaskStatus, nextOrder: number) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    await patchTask.mutateAsync({ taskId, patch: { status: nextStatus, order: nextOrder, section } });
    pushToast({ title: 'Task moved', description: task.title });
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    await Promise.all(ids.map((taskId) => deleteTask.mutateAsync(taskId)));
    setSelectedIds([]);
    pushToast({ title: 'Tasks deleted', description: `${ids.length} task${ids.length === 1 ? '' : 's'} removed` });
  };

  const bulkArchive = async () => {
    await Promise.all(selectedIds.map((taskId) => patchTask.mutateAsync({ taskId, patch: { archived: true } })));
    pushToast({ title: 'Tasks archived', description: `${selectedIds.length} task${selectedIds.length === 1 ? '' : 's'} archived` });
    setSelectedIds([]);
  };

  const bulkStatus = async (status: TaskStatus) => {
    await Promise.all(selectedIds.map((taskId) => patchTask.mutateAsync({ taskId, patch: { status } })));
    pushToast({ title: 'Status updated', description: `${selectedIds.length} task${selectedIds.length === 1 ? '' : 's'} changed` });
    setSelectedIds([]);
  };

  const bulkAssign = async (assigneeId: 'me' | 'friend' | 'both' | 'unassigned') => {
    await Promise.all(selectedIds.map((taskId) => patchTask.mutateAsync({ taskId, patch: { assigneeIds: assigneeId === 'unassigned' ? [] : [assigneeId] } })));
    pushToast({ title: 'Assignee updated', description: `${selectedIds.length} task${selectedIds.length === 1 ? '' : 's'} changed` });
    setSelectedIds([]);
  };

  const restoreTask = async (task: Task) => {
    await updateTask.mutateAsync({ ...task, archived: false });
    pushToast({ title: 'Task restored', description: task.title });
  };

  if (isLoading) {
    return <div className="space-y-4 p-4 lg:p-6"><Skeleton className="h-28" /><Skeleton className="h-[40rem]" /></div>;
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:p-6">
      <Card className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{sectionTabs.find((item) => item.id === section)?.label} board</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Collaborative task board</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search, filter, drag, and manage work with instant persistence.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDrawerTaskId('new')}><Plus className="h-4 w-4" /> New task</Button>
            <Select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="min-w-40">
              {sortOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            {taskStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
          </Select>
          <Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}>
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
          <Select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value as typeof assigneeFilter)}>
            {userFilterOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
          <Select value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)}>
            <option value="all">All labels</option>
            {labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
          </Select>
          <Select value={archivedFilter} onChange={(event) => setArchivedFilter(event.target.value as typeof archivedFilter)}>
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
            <option value="all">All tasks</option>
          </Select>
        </div>
      </Card>

      <div className="flex-1 min-h-0">
        <KanbanBoard tasks={visibleTasks} labels={labels} users={users} selectedIds={selectedIds} onToggleSelect={toggleSelection} onOpen={(taskId) => setDrawerTaskId(taskId)} onMoveTask={moveTask} />
      </div>

      {selectedIds.length ? (
        <Card className="fixed bottom-4 left-1/2 z-50 w-[min(95vw,56rem)] -translate-x-1/2 border-border bg-card p-3 shadow-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{selectedIds.length} selected</Badge>
            <Button variant="secondary" size="sm" onClick={bulkArchive}><Archive className="h-4 w-4" /> Archive</Button>
            <Select className="min-w-36" defaultValue="" onChange={(event) => event.target.value && void bulkStatus(event.target.value as TaskStatus)}>
              <option value="">Change status</option>
              {taskStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </Select>
            <Select className="min-w-36" defaultValue="" onChange={(event) => event.target.value && void bulkAssign(event.target.value as 'me' | 'friend' | 'both' | 'unassigned')}>
              <option value="">Assign to</option>
              {assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>
            <Button variant="destructive" size="sm" onClick={bulkDelete}><Trash2 className="h-4 w-4" /> Delete</Button>
          </div>
        </Card>
      ) : null}

      <TaskDrawer
        open={drawerTaskId !== null}
        taskId={taskForDrawer?.id ?? null}
        onClose={() => setDrawerTaskId(null)}
        onDelete={(task) => setConfirmTask(task)}
        onDuplicate={(task) => void duplicateTask(task)}
      />

      <Modal open={Boolean(confirmTask)} title="Delete task" description={confirmTask ? `Delete ${confirmTask.title}? This can be restored from the toast if needed.` : undefined} onClose={() => setConfirmTask(null)}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmTask(null)}>Cancel</Button>
          <Button variant="destructive" onClick={async () => {
            if (!confirmTask) return;
            const snapshot = confirmTask;
            setConfirmTask(null);
            await deleteTask.mutateAsync(snapshot.id);
            pushToast({
              title: 'Task deleted',
              description: snapshot.title,
              action: { label: 'Undo', onClick: () => void restoreTask(snapshot) },
            });
          }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}