import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import {
  buildCampaignTaskGroups,
  buildTaskBucketSummaries,
  filterTasksByBucket,
  getTaskBucket,
  validateTaskCampaign,
} from './taskInsights';

const baseTask = (overrides: Partial<Task>): Task => ({
  id: overrides.id || `T-${Math.random()}`,
  title: overrides.title || 'Follow up',
  description: overrides.description || '',
  ownerId: overrides.ownerId ?? 'Sarah',
  campaignId: overrides.campaignId ?? 'Campaign A',
  priority: overrides.priority || 'Medium',
  dueDate: overrides.dueDate ?? Date.now() + 86400000,
  completed: overrides.completed ?? false,
  createdAt: overrides.createdAt ?? Date.now() - 86400000,
  updatedAt: overrides.updatedAt ?? Date.now() - 3600000,
  createdBy: overrides.createdBy || 'test',
  flags: overrides.flags,
});

describe('taskInsights', () => {
  it('classifies task buckets from status signals', () => {
    const now = new Date('2026-05-13T12:00:00Z').getTime();

    expect(getTaskBucket(baseTask({ completed: true }), now)).toBe('done');
    expect(getTaskBucket(baseTask({ ownerId: '', completed: false }), now)).toBe('pending');
    expect(getTaskBucket(baseTask({ dueDate: now - 1000, completed: false }), now)).toBe('blocked');
    expect(getTaskBucket(baseTask({
      completed: false,
      flags: [{ id: 'f1', label: 'Client blocker', tone: 'red', resolved: false }],
    }), now)).toBe('blocked');
    expect(getTaskBucket(baseTask({ ownerId: 'Sarah', dueDate: now + 1000, completed: false }), now)).toBe('in-progress');
  });

  it('builds clickable bucket summaries including all old tasks and recently created tasks', () => {
    const now = new Date('2026-05-13T12:00:00Z').getTime();
    const tasks = [
      baseTask({ id: 'done', completed: true, createdAt: now - 10 * 86400000 }),
      baseTask({ id: 'active', completed: false, createdAt: now - 3600000 }),
      baseTask({ id: 'pending', ownerId: '', completed: false, createdAt: now - 3600000 }),
      baseTask({ id: 'blocked', completed: false, dueDate: now - 1000, createdAt: now - 2 * 86400000 }),
    ];

    const summaries = buildTaskBucketSummaries(tasks, now);

    expect(summaries.map((summary) => [summary.bucket, summary.count])).toEqual([
      ['all', 4],
      ['done', 1],
      ['in-progress', 1],
      ['pending', 1],
      ['blocked', 1],
      ['new', 3],
    ]);
    expect(filterTasksByBucket(tasks, 'blocked', now).map((task) => task.id)).toEqual(['blocked']);
    expect(filterTasksByBucket(tasks, 'new', now).map((task) => task.id)).toEqual(['active', 'pending', 'blocked']);
  });

  it('requires campaign ownership before tasks can be saved', () => {
    expect(validateTaskCampaign({ title: 'Ready', campaignId: 'Red Bull' })).toEqual({ ok: true });
    expect(validateTaskCampaign({ title: 'Missing campaign', campaignId: '  ' })).toEqual({
      ok: false,
      message: 'Campaign is required before this task can be saved.',
    });
  });

  it('groups campaign tasks with a stable sequence per campaign', () => {
    const now = new Date('2026-05-13T12:00:00Z').getTime();
    const groups = buildCampaignTaskGroups([
      baseTask({ id: 'c2', campaignId: 'Campaign B', createdAt: now + 2000 }),
      baseTask({ id: 'c1-a', campaignId: 'Campaign A', createdAt: now + 1000 }),
      baseTask({ id: 'c1-b', campaignId: 'Campaign A', createdAt: now + 3000 }),
    ], now);

    expect(groups.map((group) => group.campaignName)).toEqual(['Campaign A', 'Campaign B']);
    expect(groups[0].tasks.map((item) => [item.sequenceLabel, item.task.id])).toEqual([
      ['1.1', 'c1-a'],
      ['1.2', 'c1-b'],
    ]);
    expect(groups[1].tasks.map((item) => [item.sequenceLabel, item.task.id])).toEqual([
      ['2.1', 'c2'],
    ]);
  });
});
