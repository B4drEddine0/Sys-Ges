import { useMemo } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, FlaskConical, Users } from 'lucide-react';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { Card, Panel, Progress, Skeleton } from '@/components/ui';
import { useActivitiesQuery, useTasksQuery, useProjectMembersQuery } from '@/features/tasks/taskHooks';
import { priorities } from '@/lib/constants';
import { useProject } from '@/providers/ProjectProvider';
import type { Task } from '@/types';

function statValue(tasks: Task[], predicate: (task: Task) => boolean) {
  return tasks.filter(predicate).length;
}

export function DashboardPage() {
  const { data: tasks = [], isLoading } = useTasksQuery();
  const { data: users = [] } = useProjectMembersQuery();
  const { data: activities = [] } = useActivitiesQuery();
  const { activeProject } = useProject();

  const stats = useMemo(() => {
    const total = tasks.filter((task) => !task.archived).length;
    const done = statValue(tasks, (task) => task.status === 'done' && !task.archived);
    const testing = statValue(tasks, (task) => task.status === 'testing' && !task.archived);
    const critical = statValue(tasks, (task) => task.priority === 'critical' && !task.archived);
    const frontend = tasks.filter((task) => task.section === 'frontend' && !task.archived);
    const backend = tasks.filter((task) => task.section === 'backend' && !task.archived);
    const upcoming = tasks
      .filter((task) => task.dueDate && task.status !== 'done' && !task.archived)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .slice(0, 5);

    return {
      total,
      done,
      testing,
      critical,
      frontend,
      backend,
      upcoming,
      completion: total ? Math.round((done / total) * 100) : 0,
    };
  }, [tasks]);

  const tasksPerUser = useMemo(() => users.map((user) => ({
    user,
    count: tasks.filter((task) => task.assigneeIds.includes(user.id)).length,
  })), [tasks, users]);

  if (isLoading) {
    return <div className="grid gap-4 p-4 lg:p-6"><Skeleton className="h-32" /><Skeleton className="h-96" /></div>;
  }

  const completionTone = stats.completion >= 80 ? 'text-emerald-600' : stats.completion >= 50 ? 'text-blue-600' : 'text-amber-600';

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {activeProject && (
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{activeProject.name}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Project Dashboard</h2>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Overall progress', value: `${stats.completion}%`, icon: CheckCircle2, meta: `${stats.done} done` },
          { label: 'Testing tasks', value: stats.testing, icon: FlaskConical, meta: 'Ready to verify' },
          { label: 'Critical tasks', value: stats.critical, icon: AlertTriangle, meta: 'Priority now' },
          { label: 'Upcoming deadlines', value: stats.upcoming.length, icon: CalendarDays, meta: 'Due soon' },
        ].map((item) => (
          <Card key={item.label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">{item.value}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{item.meta}</p>
              </div>
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Completion</p>
              <h3 className="mt-1 text-xl font-semibold">Project health</h3>
            </div>
            <span className={completionTone + ' text-sm font-semibold'}>{stats.completion}%</span>
          </div>
          <div className="mt-5 space-y-4">
            <Progress value={stats.completion} />
            <div className="grid gap-3 md:grid-cols-2">
              <Panel title="Frontend" action={<span className="text-sm text-muted-foreground">{stats.frontend.length} tasks</span>}>
                <div className="text-sm text-muted-foreground">Independent board progress for the UI stream.</div>
              </Panel>
              <Panel title="Backend" action={<span className="text-sm text-muted-foreground">{stats.backend.length} tasks</span>}>
                <div className="text-sm text-muted-foreground">Independent board progress for services and data.</div>
              </Panel>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Panel title="Tasks per member" action={<Users className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-3">
              {tasksPerUser.length > 0 ? tasksPerUser.map(({ user, count }) => (
                <div key={user.id}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{user.name}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <Progress value={stats.total ? (count / stats.total) * 100 : 0} />
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              )}
            </div>
          </Panel>

          <Panel title="Recent activity" action={<Activity className="h-4 w-4 text-muted-foreground" />}>
            <div className="space-y-3">
              {activities.length > 0 ? activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="rounded-xl border border-border p-3 text-sm">
                  <p className="font-medium">{activity.title}</p>
                  <p className="mt-1 text-muted-foreground">{activity.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{format(parseISO(activity.createdAt), 'MMM d, p')}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              )}
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Priority distribution" action={<ArrowUpRight className="h-4 w-4 text-muted-foreground" />}>
          <div className="space-y-3">
            {priorities.map((priority) => {
              const count = tasks.filter((task) => task.priority === priority.id && !task.archived).length;
              return (
                <div key={priority.id}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{priority.label}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <Progress value={stats.total ? (count / stats.total) * 100 : 0} />
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Upcoming deadlines" action={<Clock3 className="h-4 w-4 text-muted-foreground" />}>
          <div className="space-y-3">
            {stats.upcoming.length > 0 ? stats.upcoming.map((task) => {
              const overdue = task.dueDate ? isAfter(startOfDay(new Date()), startOfDay(parseISO(task.dueDate))) : false;
              return (
                <div key={task.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{task.title}</p>
                    <span className={overdue ? 'text-rose-600' : 'text-muted-foreground'}>{task.dueDate ? format(parseISO(task.dueDate), 'MMM d') : 'No due date'}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{task.section === 'frontend' ? 'Frontend' : 'Backend'} • {task.status.replaceAll('_', ' ')}</p>
                </div>
              );
            }) : (
              <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}
