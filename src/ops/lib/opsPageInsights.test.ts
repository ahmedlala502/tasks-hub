import { describe, expect, it } from 'vitest';
import { CampaignStage } from '../constants';
import type { Blocker, Campaign, Handover, Task } from '../types';
import {
  buildDailyFocus,
  buildLiveOpsInsights,
  buildMyCampaignMatrix,
  buildMyDashboardInsights,
  getOperationalTaskStatus,
  buildUpdatesFeed,
  isTaskForUser,
} from './opsPageInsights';

const now = new Date('2026-05-14T10:00:00Z').getTime();

function task(overrides: Partial<Task>): Task {
  return {
    id: 'T-1',
    createdAt: now - 1000,
    updatedAt: now - 500,
    createdBy: 'test',
    title: 'Follow up confirmations',
    description: '',
    ownerId: 'Mona K.',
    dueDate: now + 86400000,
    campaignId: 'Launch KSA',
    priority: 'Medium',
    completed: false,
    ...overrides,
  };
}

function campaign(overrides: Partial<Campaign>): Campaign {
  return {
    id: 'C-1',
    createdAt: now - 5000,
    updatedAt: now - 300,
    createdBy: 'test',
    name: 'Launch KSA',
    clientId: '',
    brandId: '',
    country: 'KSA',
    city: 'Riyadh',
    objective: '',
    platforms: ['Instagram'],
    type: 'Visit',
    budget: 0,
    budgetType: 'Fixed',
    targetInfluencers: 12,
    targetPostingCoverage: 8,
    startDate: '2026-05-01',
    endDate: '2026-05-20',
    deliverables: '',
    tags: '',
    mentions: '',
    links: '',
    visitRequired: true,
    productDetails: '',
    approvalFlow: '',
    reportingCadence: '',
    restrictions: '',
    internalOwners: ['Mona K.'],
    clientOwners: [],
    influencerCriteria: '',
    currentOwner: 'Mona K.',
    nextAction: 'Confirm schedule',
    stage: CampaignStage.COVERAGE_IN_PROGRESS,
    status: 'Active',
    recordHealth: 'Healthy',
    ...overrides,
  };
}

function blocker(overrides: Partial<Blocker>): Blocker {
  return {
    id: 'B-1',
    campaignId: 'Launch KSA',
    summary: 'Missing approval',
    impact: 'Reporting delayed',
    status: 'Open',
    severity: 'Critical',
    ownerId: 'Mona K.',
    createdAt: now - 2000,
    updatedAt: now - 1000,
    createdBy: 'test',
    ...overrides,
  };
}

function handover(overrides: Partial<Handover>): Handover {
  return {
    id: 'H-1',
    handoffDate: '2026-05-14',
    fromShift: 'Morning',
    toShift: 'Mid',
    team: 'Operations',
    region: 'Regional',
    notes: 'Watch blocked campaign',
    taskIds: ['T-1'],
    status: 'Pending',
    createdAt: now - 700,
    updatedAt: now - 700,
    createdBy: 'test',
    ...overrides,
  };
}

describe('ops page insights', () => {
  it('matches personal tasks by owner name case-insensitively', () => {
    expect(isTaskForUser(task({ ownerId: 'mona k.' }), 'Mona K.')).toBe(true);
    expect(isTaskForUser(task({ ownerId: 'Ops Lead' }), 'Mona K.')).toBe(false);
  });

  it('builds my dashboard totals and urgent work', () => {
    const insights = buildMyDashboardInsights([
      task({ id: 'T-1', completed: true, metricTarget: 10, metricCON: 8, metricCOV: 6 }),
      task({ id: 'T-2', dueDate: now - 1000, priority: 'Critical', completed: false, metricTarget: 5, metricCON: 5, metricCOV: 2 }),
      task({ id: 'T-3', ownerId: 'Other User' }),
    ], [campaign({ name: 'Launch KSA' })], 'Mona K.', now);

    expect(insights.totalTasks).toBe(2);
    expect(insights.completedTasks).toBe(1);
    expect(insights.completionRate).toBe(50);
    expect(insights.metricTotals).toEqual({ target: 15, confirmations: 13, coverage: 8 });
    expect(insights.confirmationRate).toBe(87);
    expect(insights.coverageRate).toBe(53);
    expect(insights.urgentTasks[0].id).toBe('T-2');
    expect(insights.campaignNames).toEqual(['Launch KSA']);
  });

  it('derives donor-style operational task status from task fields', () => {
    expect(getOperationalTaskStatus(task({ completed: true }), now)).toBe('Done');
    expect(getOperationalTaskStatus(task({ status: 'Blocked', completed: false }), now)).toBe('Blocked');
    expect(getOperationalTaskStatus(task({ dueDate: now - 1000, completed: false }), now)).toBe('Blocked');
    expect(getOperationalTaskStatus(task({ status: 'Pending', ownerId: '', completed: false }), now)).toBe('Pending');
    expect(getOperationalTaskStatus(task({ ownerId: 'Mona K.', completed: false }), now)).toBe('In Progress');
  });

  it('builds a campaign execution matrix from campaigns and their team tasks', () => {
    const matrix = buildMyCampaignMatrix(
      [campaign({ name: 'Launch KSA', targetInfluencers: 4, targetPostingCoverage: 2 })],
      [
        task({ id: 'T-1', department: 'PMO', completed: true, metricCON: 2, metricCOV: 1 }),
        task({ id: 'T-2', department: 'Coverage', completed: false, metricCON: 1, metricCOV: 0 }),
      ],
      now,
    );

    expect(matrix[0].taskCount).toBe(2);
    expect(matrix[0].doneCount).toBe(1);
    expect(matrix[0].progress).toBe(50);
    expect(matrix[0].confirmationProgress).toBe(75);
    expect(matrix[0].coverageProgress).toBe(50);
    expect(matrix[0].teamLanes.map((lane) => lane.name)).toEqual(['Coverage', 'PMO']);
  });

  it('builds live ops campaign, task, and blocker health', () => {
    const insights = buildLiveOpsInsights(
      [campaign({ status: 'Active' }), campaign({ id: 'C-2', status: 'Blocked', recordHealth: 'Critical' })],
      [task({ completed: false }), task({ id: 'T-2', completed: true })],
      [blocker({ status: 'Open' }), blocker({ id: 'B-2', status: 'Resolved' })],
      now,
    );

    expect(insights.activeCampaigns).toBe(1);
    expect(insights.blockedCampaigns).toBe(1);
    expect(insights.openTasks).toBe(1);
    expect(insights.openBlockers).toBe(1);
    expect(insights.healthScore).toBeLessThan(100);
  });

  it('prioritizes daily focus by blocked, overdue, and due-today work', () => {
    const focus = buildDailyFocus([
      task({ id: 'normal', dueDate: now + 5 * 86400000 }),
      task({ id: 'due-today', dueDate: now + 2 * 3600000 }),
      task({ id: 'overdue', dueDate: now - 1000 }),
      task({ id: 'blocked', flags: [{ id: 'F', label: 'Blocked by client', tone: 'red', resolved: false }] }),
    ], now);

    expect(focus.queue.map((item) => item.id).slice(0, 3)).toEqual(['blocked', 'overdue', 'due-today']);
    expect(focus.recommendations[0]).toContain('blocked');
  });

  it('combines campaign, task, blocker, and handover updates into a recent feed', () => {
    const feed = buildUpdatesFeed([campaign({})], [task({})], [blocker({})], [handover({})]);

    expect(feed.map((item) => item.kind)).toEqual(['campaign', 'task', 'handover', 'blocker']);
    expect(new Set(feed.map((item) => item.kind))).toEqual(new Set(['campaign', 'task', 'blocker', 'handover']));
    expect(feed[0].title).toBe('Launch KSA');
  });
});
