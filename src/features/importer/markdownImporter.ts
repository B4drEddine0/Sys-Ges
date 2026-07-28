import { addDays, formatISO } from 'date-fns';
import type { Activity, Label, MarkdownImportTask, Priority, SectionId, SeedDatabase, Subtask, Task } from '@/types';
import { defaultLabels, defaultSections, defaultUsers } from '@/lib/defaultData';

const priorityWeights: Record<Priority, number> = {
  low: 3,
  medium: 5,
  high: 8,
  critical: 13,
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseMetadata(line: string) {
  const match = line.match(/^(?<code>[A-Z0-9-]+)\s+\((?<priority>P[0-2]),\s*(?<lane>Shared|Backend|Frontend)\)\s+(?<title>.+)$/);
  if (!match?.groups) return null;

  return {
    code: match.groups.code,
    priority: match.groups.priority as 'P0' | 'P1' | 'P2',
    lane: match.groups.lane as 'Shared' | 'Backend' | 'Frontend',
    title: match.groups.title.trim(),
  };
}

function inferSection(lane: string, code: string, title: string, index: number): SectionId {
  if (code.includes('BE')) return 'backend';
  if (code.includes('FE')) return 'frontend';
  if (lane === 'Backend') return 'backend';
  if (lane === 'Frontend') return 'frontend';
  const hints = `${title} ${lane}`.toLowerCase();
  if (/(api|backend|database|security|migration|identity|report|export)/.test(hints)) return 'backend';
  if (/(ui|ux|frontend|dashboard|search|table|form|screen|modal|theme)/.test(hints)) return 'frontend';
  return index % 2 === 0 ? 'frontend' : 'backend';
}

function inferLabels(title: string, description: string, lane: string, priority: string) {
  const labels = new Set<string>([lane, priority]);
  const haystack = `${title} ${description}`.toLowerCase();

  const keywordLabels: Array<[RegExp, string]> = [
    [/\bui\b|\binterface\b|\bscreen\b|\bmodal\b/, 'UI'],
    [/\bux\b|\buser experience\b|\bflow\b/, 'UX'],
    [/\bapi\b|\bendpoint\b|\bcontract\b/, 'API'],
    [/\bbackend\b|\bdomain\b|\bservice\b|\bserver\b/, 'Backend'],
    [/\bfrontend\b|\breact\b|\bcomponents?\b/, 'Frontend'],
    [/\bdatabase\b|\bdata\b|\bmigration\b/, 'Database'],
    [/\bauth\b|\blogin\b|\bsecurity\b/, 'Auth'],
    [/\brefactor\b|\barchitecture\b/, 'Refactor'],
    [/\bperformance\b|\bfast\b|\boptimi/, 'Performance'],
    [/\bbug\b|\bfix\b|\berror\b/, 'Bug'],
    [/\bresponsive\b|\bmobile\b|\btablet\b/, 'Responsive'],
    [/\btest\b|\bci\b|\bcoverage\b/, 'Testing'],
    [/\bdeploy\b|\brelease\b|\bexport\b/, 'Deployment'],
  ];

  keywordLabels.forEach(([pattern, label]) => {
    if (pattern.test(haystack)) labels.add(label);
  });

  return [...labels];
}

function parseTaskItems(markdown: string): MarkdownImportTask[] {
  const lines = markdown.split(/\r?\n/);
  const items: MarkdownImportTask[] = [];
  let currentLane: 'Shared' | 'Frontend' | 'Backend' = 'Shared';
  let collecting = false;
  let currentMeta: ReturnType<typeof parseMetadata> | null = null;
  let body: string[] = [];

  const flush = () => {
    const meta = currentMeta;
    if (!meta) return;

    const descriptionLines: string[] = [];
    const doneWhenLines: string[] = [];
    const subtasks: Subtask[] = [];
    let inDoneWhen = false;

    body.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      if (/^done when:/i.test(line)) {
        inDoneWhen = true;
        doneWhenLines.push(line.replace(/^done when:\s*/i, ''));
        return;
      }

      const checkbox = line.match(/^[-*]\s+\[( |x)\]\s+(.+)$/i);
      if (checkbox) {
        subtasks.push({ id: `${slugify(meta.code)}-${subtasks.length + 1}`, title: checkbox[2].trim(), completed: checkbox[1].toLowerCase() === 'x' });
        return;
      }

      if (inDoneWhen) {
        doneWhenLines.push(line);
        return;
      }

      if (/^description:/i.test(line)) {
        descriptionLines.push(line.replace(/^description:\s*/i, ''));
        return;
      }

      descriptionLines.push(line);
    });

    const description = descriptionLines.join(' ').trim();
    const doneWhen = doneWhenLines.join(' ').trim();
    const section = inferSection(meta.lane, meta.code, meta.title, items.length);

    items.push({
      code: meta.code,
      title: meta.title,
      description,
      doneWhen,
      priority: meta.priority,
      lane: meta.lane,
      section,
      order: items.length,
      subtasks,
      labels: inferLabels(meta.title, description, meta.lane, meta.priority),
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^##\s+4\.[123]/.test(line)) {
      collecting = true;
      currentLane = line.toLowerCase().includes('backend') ? 'Backend' : line.toLowerCase().includes('frontend') ? 'Frontend' : 'Shared';
      continue;
    }

    if (/^##\s+5\)/.test(line)) {
      collecting = false;
      flush();
      currentMeta = null;
      body = [];
      continue;
    }

    if (!collecting) continue;

    const numbered = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*$/);
    if (numbered) {
      flush();
      currentMeta = parseMetadata(numbered[1]);
      body = [];
      if (currentMeta && currentMeta.lane === 'Shared' && currentLane !== 'Shared') {
        currentMeta = { ...currentMeta, lane: currentLane };
      }
      continue;
    }

    if (currentMeta) body.push(rawLine);
  }

  flush();
  return items;
}

function makeDueDate(priority: Priority, index: number) {
  const offset = priority === 'critical' ? 3 : priority === 'high' ? 7 : priority === 'medium' ? 14 : 21;
  return formatISO(addDays(new Date(), offset + index % 5), { representation: 'date' });
}

function toTask(item: MarkdownImportTask, index: number): Task {
  const now = new Date();
  const createdAt = new Date(now.getTime() - (item.order + 1) * 24 * 60 * 60 * 1000).toISOString();
  const updatedAt = new Date(now.getTime() - index * 60 * 60 * 1000).toISOString();
  const assigneeIds = item.section === 'backend' ? ['friend'] : item.section === 'frontend' ? ['me'] : ['both'];

  return {
    id: `${slugify(item.code)}-${index + 1}`,
    title: item.title,
    description: item.description || item.doneWhen || item.title,
    status: 'todo',
    section: item.section,
    assigneeIds,
    priority: item.priority === 'P0' ? 'critical' : item.priority === 'P1' ? 'high' : 'medium',
    labelIds: item.labels.map((label) => slugify(label)),
    estimatedHours: priorityWeights[item.priority === 'P0' ? 'critical' : item.priority === 'P1' ? 'high' : 'medium'],
    dueDate: makeDueDate(item.priority === 'P0' ? 'critical' : item.priority === 'P1' ? 'high' : 'medium', index),
    createdAt,
    updatedAt,
    completedAt: null,
    notes: item.doneWhen,
    subtasks: item.subtasks,
    attachments: [],
    order: item.order,
    archived: false,
  };
}

function dedupeLabels(labelNames: string[]): Label[] {
  const map = new Map<string, Label>();
  const now = new Date().toISOString();

  [...defaultLabels, ...labelNames.map((name) => ({ id: slugify(name), name, color: '#64748b', createdAt: now }))].forEach((label) => {
    map.set(label.id, label);
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildSeedDatabase(markdown: string): SeedDatabase {
  const items = parseTaskItems(markdown);
  const tasks = items.map(toTask);
  const labels = dedupeLabels(items.flatMap((item) => item.labels));
  const activities: Activity[] = tasks.map((task, index) => ({
    id: `activity-${index + 1}`,
    taskId: task.id,
    actorId: index % 2 === 0 ? 'me' : 'friend',
    type: 'task_created',
    title: 'Task created from markdown import',
    description: task.title,
    createdAt: task.createdAt,
    meta: { source: 'markdown-import' },
  }));

  return {
    users: defaultUsers,
    sections: defaultSections,
    labels,
    tasks,
    activities,
  };
}

export function parseMarkdownTasks(markdown: string) {
  return parseTaskItems(markdown);
}