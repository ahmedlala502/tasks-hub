import type { Task } from '../types';

export type TaskBucket = 'all' | 'done' | 'in-progress' | 'pending' | 'blocked' | 'new';

export type TaskBucketSummary = {
  bucket: TaskBucket;
  label: string;
  description: string;
  count: number;
};

export type CampaignTaskGroup = {
  campaignName: string;
  sequence: number;
  total: number;
  done: number;
  pending: number;
  blocked: number;
  tasks: Array<{
    sequenceLabel: string;
    task: Task;
    bucket: Exclude<TaskBucket, 'all' | 'new'>;
  }>;
};

const NEW_TASK_WINDOW_MS = 3 * 86400000;

export const TASK_BUCKET_LABELS: Record<TaskBucket, string> = {
  all: 'Old Tasks',
  done: 'Done',
  'in-progress': 'In Progress',
  pending: 'Pending',
  blocked: 'Blocked',
  new: 'New',
};

const TASK_BUCKET_DESCRIPTIONS: Record<TaskBucket, string> = {
  all: 'Complete historical task archive.',
  done: 'Finished and closed work.',
  'in-progress': 'Assigned work moving now.',
  pending: 'Waiting for an owner or next step.',
  blocked: 'Overdue, critical, or blocked by an unresolved flag.',
  new: 'Recently created task intake.',
};

function clean(value: string | undefined | null): string {
  return (value || '').trim();
}

function hasUnresolvedBlockingFlag(task: Task): boolean {
  return Boolean(task.flags?.some((flag) => !flag.resolved && (flag.tone === 'red' || /block/i.test(flag.label))));
}

export function isTaskOverdue(task: Task, now = Date.now()): boolean {
  if (task.completed) return false;
  if (!Number.isFinite(task.dueDate)) return false;
  const endOfToday = new Date(now).setHours(23, 59, 59, 999);
  return task.dueDate < endOfToday && !sameCalendarDay(task.dueDate, now);
}

function sameCalendarDay(date1: number, date2: number): boolean {
  return new Date(date1).toDateString() === new Date(date2).toDateString();
}

export function isNewTask(task: Task, now = Date.now()): boolean {
  return Number.isFinite(task.createdAt) && now - task.createdAt <= NEW_TASK_WINDOW_MS;
}

export function getTaskBucket(task: Task, now = Date.now()): Exclude<TaskBucket, 'all' | 'new'> {
  if (task.completed) return 'done';
  if (isTaskOverdue(task, now) || task.priority === 'Critical' || hasUnresolvedBlockingFlag(task)) return 'blocked';
  if (!clean(task.ownerId)) return 'pending';
  return 'in-progress';
}

export function filterTasksByBucket(tasks: Task[], bucket: TaskBucket, now = Date.now()): Task[] {
  if (bucket === 'all') return [...tasks];
  if (bucket === 'new') return tasks.filter((task) => isNewTask(task, now));
  return tasks.filter((task) => getTaskBucket(task, now) === bucket);
}

export function buildTaskBucketSummaries(tasks: Task[], now = Date.now()): TaskBucketSummary[] {
  const buckets: TaskBucket[] = ['all', 'done', 'in-progress', 'pending', 'blocked', 'new'];
  return buckets.map((bucket) => ({
    bucket,
    label: TASK_BUCKET_LABELS[bucket],
    description: TASK_BUCKET_DESCRIPTIONS[bucket],
    count: filterTasksByBucket(tasks, bucket, now).length,
  }));
}

export function validateTaskCampaign(task: Partial<Task>): { ok: true } | { ok: false; message: string } {
  if (clean(task.campaignId)) return { ok: true };
  return { ok: false, message: 'Campaign is required before this task can be saved.' };
}

export function buildCampaignTaskGroups(tasks: Task[], now = Date.now()): CampaignTaskGroup[] {
  const byCampaign = new Map<string, Task[]>();

  tasks.forEach((task) => {
    const campaignName = clean(task.campaignId) || 'Unassigned Campaign';
    byCampaign.set(campaignName, [...(byCampaign.get(campaignName) || []), task]);
  });

  return [...byCampaign.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([campaignName, campaignTasks], groupIndex) => {
      const sequence = groupIndex + 1;
      const sortedTasks = [...campaignTasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        return a.title.localeCompare(b.title);
      });

      const items = sortedTasks.map((task, taskIndex) => ({
        sequenceLabel: `${sequence}.${taskIndex + 1}`,
        task,
        bucket: getTaskBucket(task, now),
      }));

      return {
        campaignName,
        sequence,
        total: sortedTasks.length,
        done: items.filter((item) => item.bucket === 'done').length,
        pending: items.filter((item) => item.bucket === 'pending').length,
        blocked: items.filter((item) => item.bucket === 'blocked').length,
        tasks: items,
      };
    });
}
