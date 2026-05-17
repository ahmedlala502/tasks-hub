import { CampaignStage } from '../constants';
import type { Blocker, Campaign, Handover, Task } from '../types';
import { getTaskBucket, isTaskOverdue } from './taskInsights';

const DAY_MS = 86400000;

export type MyDashboardInsights = {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  blockedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  doneTasks: number;
  completionRate: number;
  metricTotals: {
    target: number;
    confirmations: number;
    coverage: number;
  };
  confirmationRate: number;
  coverageRate: number;
  statusCounts: Record<OperationalTaskStatus, number>;
  urgentTasks: Task[];
  campaignNames: string[];
};

export type LiveOpsInsights = {
  totalCampaigns: number;
  activeCampaigns: number;
  blockedCampaigns: number;
  criticalCampaigns: number;
  openTasks: number;
  overdueTasks: number;
  openBlockers: number;
  healthScore: number;
};

export type DailyFocusItem = Task & {
  reason: 'blocked' | 'overdue' | 'due-today' | 'critical' | 'active';
  score: number;
};

export type DailyFocus = {
  queue: DailyFocusItem[];
  dueToday: number;
  overdue: number;
  blocked: number;
  recommendations: string[];
};

export type UpdateFeedItem = {
  id: string;
  kind: 'campaign' | 'task' | 'blocker' | 'handover';
  title: string;
  detail: string;
  owner: string;
  at: number;
  tone: 'green' | 'orange' | 'red' | 'purple';
};

export type OperationalTaskStatus = 'Pending' | 'In Progress' | 'Blocked' | 'Done';

export type CampaignMatrixLane = {
  name: string;
  tasks: Task[];
  openCount: number;
  doneCount: number;
  blockedCount: number;
};

export type CampaignMatrixItem = {
  campaign: Campaign;
  tasks: Task[];
  taskCount: number;
  doneCount: number;
  openCount: number;
  blockedCount: number;
  confirmationTotal: number;
  coverageTotal: number;
  targetTotal: number;
  progress: number;
  confirmationProgress: number;
  coverageProgress: number;
  teamLanes: CampaignMatrixLane[];
};

function clean(value: string | undefined | null, fallback = 'Unassigned') {
  const next = value?.trim();
  return next || fallback;
}

function normalize(value: string | undefined | null) {
  return clean(value, '').toLowerCase();
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function sameDay(left: number, right: number) {
  return new Date(left).toDateString() === new Date(right).toDateString();
}

function isDueToday(task: Task, now: number) {
  return !task.completed && Number.isFinite(task.dueDate) && sameDay(task.dueDate, now);
}

function hasBlockingFlag(task: Task) {
  return Boolean(task.flags?.some((flag) => !flag.resolved && (flag.tone === 'red' || /block/i.test(flag.label))));
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function taskCampaignKey(task: Task) {
  return normalize(task.campaignId);
}

function campaignKeys(campaign: Campaign) {
  return new Set([campaign.id, campaign.name, campaign.brandId].map(normalize).filter(Boolean));
}

function taskBelongsToCampaign(task: Task, campaign: Campaign) {
  const taskKey = taskCampaignKey(task);
  if (!taskKey) return false;
  const keys = campaignKeys(campaign);
  return keys.has(taskKey);
}

export function getOperationalTaskStatus(task: Task, now = Date.now()): OperationalTaskStatus {
  if (task.completed || task.status === 'Done') return 'Done';
  if (task.status === 'Blocked' || hasBlockingFlag(task) || Boolean(clean(task.blocker, '')) || isTaskOverdue(task, now)) return 'Blocked';
  if (task.status === 'Pending') return 'Pending';
  if (task.status === 'In Progress') return 'In Progress';
  return clean(task.ownerId, '') ? 'In Progress' : 'Pending';
}

export function isTaskForUser(task: Task, userName: string) {
  const user = normalize(userName);
  if (!user) return false;
  const owner = normalize(task.ownerId);
  return owner === user || owner.includes(user) || user.includes(owner);
}

export function buildMyDashboardInsights(tasks: Task[], campaigns: Campaign[], userName: string, now = Date.now()): MyDashboardInsights {
  const personalTasks = tasks.filter((task) => isTaskForUser(task, userName));
  const completedTasks = personalTasks.filter((task) => task.completed).length;
  const statusCounts = personalTasks.reduce<Record<OperationalTaskStatus, number>>((counts, task) => {
    const status = getOperationalTaskStatus(task, now);
    counts[status] += 1;
    return counts;
  }, { Pending: 0, 'In Progress': 0, Blocked: 0, Done: 0 });
  const metricTotals = personalTasks.reduce((totals, task) => {
    totals.target += numberValue(task.metricTarget);
    totals.confirmations += numberValue(task.metricCON);
    totals.coverage += numberValue(task.metricCOV);
    return totals;
  }, { target: 0, confirmations: 0, coverage: 0 });
  const urgentTasks = personalTasks
    .filter((task) => !task.completed && (task.priority === 'Critical' || isTaskOverdue(task, now) || hasBlockingFlag(task)))
    .sort((a, b) => {
      const bucketA = getTaskBucket(a, now);
      const bucketB = getTaskBucket(b, now);
      if (bucketA !== bucketB) return bucketA === 'blocked' ? -1 : 1;
      return a.dueDate - b.dueDate;
    })
    .slice(0, 8);
  const campaignLookup = new Set(campaigns.map((campaign) => campaign.name));
  const campaignNames = [...new Set(personalTasks.map((task) => clean(task.campaignId, '')).filter(Boolean))]
    .filter((name) => campaignLookup.size === 0 || campaignLookup.has(name))
    .sort();

  return {
    totalTasks: personalTasks.length,
    completedTasks,
    activeTasks: personalTasks.length - completedTasks,
    blockedTasks: statusCounts.Blocked,
    inProgressTasks: statusCounts['In Progress'],
    pendingTasks: statusCounts.Pending,
    doneTasks: statusCounts.Done,
    completionRate: pct(completedTasks, personalTasks.length),
    metricTotals,
    confirmationRate: pct(metricTotals.confirmations, metricTotals.target),
    coverageRate: pct(metricTotals.coverage, metricTotals.target),
    statusCounts,
    urgentTasks,
    campaignNames,
  };
}

export function buildMyCampaignMatrix(campaigns: Campaign[], tasks: Task[], now = Date.now()): CampaignMatrixItem[] {
  return campaigns.map((campaign) => {
    const campaignTasks = tasks.filter((task) => taskBelongsToCampaign(task, campaign));
    const doneCount = campaignTasks.filter((task) => getOperationalTaskStatus(task, now) === 'Done').length;
    const blockedCount = campaignTasks.filter((task) => getOperationalTaskStatus(task, now) === 'Blocked').length;
    const taskConfirmationTotal = campaignTasks.reduce((sum, task) => sum + numberValue(task.metricCON), 0);
    const taskCoverageTotal = campaignTasks.reduce((sum, task) => sum + numberValue(task.metricCOV), 0);
    const confirmationTotal = numberValue(campaign.confirmations) || taskConfirmationTotal;
    const coverageTotal = numberValue(campaign.coverage) || taskCoverageTotal;
    const targetTotal = numberValue(campaign.targetInfluencers);
    const coverageTarget = numberValue(campaign.targetPostingCoverage) || targetTotal;
    const departments = new Set(campaignTasks.map((task) => clean(task.department || task.category, 'Operations')));
    const teamLanes = [...departments].sort().map((name) => {
      const laneTasks = campaignTasks.filter((task) => clean(task.department || task.category, 'Operations') === name);
      return {
        name,
        tasks: laneTasks,
        openCount: laneTasks.filter((task) => getOperationalTaskStatus(task, now) !== 'Done').length,
        doneCount: laneTasks.filter((task) => getOperationalTaskStatus(task, now) === 'Done').length,
        blockedCount: laneTasks.filter((task) => getOperationalTaskStatus(task, now) === 'Blocked').length,
      };
    });

    return {
      campaign,
      tasks: campaignTasks,
      taskCount: campaignTasks.length,
      doneCount,
      openCount: campaignTasks.length - doneCount,
      blockedCount,
      confirmationTotal,
      coverageTotal,
      targetTotal,
      progress: pct(doneCount, campaignTasks.length),
      confirmationProgress: pct(confirmationTotal, targetTotal),
      coverageProgress: pct(coverageTotal, coverageTarget),
      teamLanes,
    };
  });
}

export function buildLiveOpsInsights(campaigns: Campaign[], tasks: Task[], blockers: Blocker[], now = Date.now()): LiveOpsInsights {
  const openTasks = tasks.filter((task) => !task.completed).length;
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task, now)).length;
  const openBlockers = blockers.filter((blocker) => blocker.status !== 'Resolved').length;
  const blockedCampaigns = campaigns.filter((campaign) => campaign.status === 'Blocked' || campaign.recordHealth === 'At Risk').length;
  const criticalCampaigns = campaigns.filter((campaign) => campaign.recordHealth === 'Critical').length;
  const totalRisks = blockedCampaigns + criticalCampaigns + openBlockers + overdueTasks;
  const denominator = Math.max(campaigns.length + tasks.length + blockers.length, 1);
  const healthScore = Math.max(0, 100 - Math.round((totalRisks / denominator) * 100));

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === 'Active').length,
    blockedCampaigns,
    criticalCampaigns,
    openTasks,
    overdueTasks,
    openBlockers,
    healthScore,
  };
}

function focusReason(task: Task, now: number): DailyFocusItem['reason'] {
  if (hasBlockingFlag(task)) return 'blocked';
  if (isTaskOverdue(task, now)) return 'overdue';
  if (isDueToday(task, now)) return 'due-today';
  if (task.priority === 'Critical') return 'critical';
  return 'active';
}

function focusScore(task: Task, now: number) {
  const reason = focusReason(task, now);
  const reasonScore = reason === 'blocked' ? 100 : reason === 'overdue' ? 80 : reason === 'due-today' ? 60 : reason === 'critical' ? 50 : 10;
  const priorityScore = task.priority === 'Critical' ? 30 : task.priority === 'High' ? 20 : task.priority === 'Medium' ? 10 : 0;
  const ageScore = Math.max(0, Math.min(20, Math.round((now - task.createdAt) / DAY_MS)));
  return reasonScore + priorityScore + ageScore;
}

export function buildDailyFocus(tasks: Task[], now = Date.now()): DailyFocus {
  const activeTasks = tasks.filter((task) => !task.completed);
  const queue = activeTasks
    .map((task) => ({ ...task, reason: focusReason(task, now), score: focusScore(task, now) }))
    .sort((a, b) => b.score - a.score || a.dueDate - b.dueDate)
    .slice(0, 12);
  const blocked = queue.filter((task) => task.reason === 'blocked').length;
  const overdue = activeTasks.filter((task) => isTaskOverdue(task, now)).length;
  const dueToday = activeTasks.filter((task) => isDueToday(task, now)).length;
  const recommendations: string[] = [];

  if (blocked > 0) recommendations.push(`Start with ${blocked} blocked item${blocked === 1 ? '' : 's'} before routine work.`);
  if (overdue > 0) recommendations.push(`Replan ${overdue} overdue task${overdue === 1 ? '' : 's'} with a clear owner and next step.`);
  if (dueToday > 0) recommendations.push(`Close or update ${dueToday} item${dueToday === 1 ? '' : 's'} due today before handover.`);
  if (recommendations.length === 0) recommendations.push('No urgent work is blocking the day. Keep the routine checklist moving.');

  return { queue, dueToday, overdue, blocked, recommendations };
}

export function buildUpdatesFeed(campaigns: Campaign[], tasks: Task[], blockers: Blocker[], handovers: Handover[]): UpdateFeedItem[] {
  const campaignItems: UpdateFeedItem[] = campaigns.map((campaign) => {
    const campaignTasks = tasks.filter((task) => taskBelongsToCampaign(task, campaign));
    const taskConfirmationTotal = campaignTasks.reduce((sum, task) => sum + numberValue(task.metricCON), 0);
    const taskCoverageTotal = campaignTasks.reduce((sum, task) => sum + numberValue(task.metricCOV), 0);
    const confirmations = numberValue(campaign.confirmations) || taskConfirmationTotal;
    const coverage = numberValue(campaign.coverage) || taskCoverageTotal;
    const target = numberValue(campaign.targetInfluencers);
    const visited = numberValue(campaign.visited);
    const missed = Math.max(target - visited, 0);
    const approved = numberValue(campaign.approved);
    const rejected = numberValue(campaign.reject);
    return {
      id: `campaign-${campaign.id}`,
      kind: 'campaign',
      title: campaign.name,
      detail: `${campaign.status} · target ${target} · confirmations ${confirmations} · visited ${visited} · missed ${missed} · coverage ${coverage}/${numberValue(campaign.targetPostingCoverage) || target} · approved ${approved} · reject ${rejected} · tasks ${campaignTasks.length}`,
      owner: clean(campaign.currentOwner),
      at: campaign.updatedAt || campaign.createdAt,
      tone: campaign.recordHealth === 'Critical' ? 'red' : campaign.recordHealth === 'At Risk' ? 'orange' : 'green',
    };
  });
  const taskItems: UpdateFeedItem[] = tasks.map((task) => ({
    id: `task-${task.id}`,
    kind: 'task',
    title: task.title,
    detail: `${task.completed ? 'Completed' : 'Open'} · ${task.priority} · ${clean(task.campaignId, 'No campaign')}`,
    owner: clean(task.ownerId),
    at: task.updatedAt || task.createdAt,
    tone: task.completed ? 'green' : task.priority === 'Critical' ? 'red' : 'orange',
  }));
  const blockerItems: UpdateFeedItem[] = blockers.map((blocker) => ({
    id: `blocker-${blocker.id}`,
    kind: 'blocker',
    title: blocker.summary,
    detail: `${blocker.status} · ${blocker.severity} · ${blocker.impact}`,
    owner: clean(blocker.ownerId),
    at: blocker.updatedAt || blocker.createdAt,
    tone: blocker.status === 'Resolved' ? 'green' : blocker.severity === 'Critical' ? 'red' : 'orange',
  }));
  const handoverItems: UpdateFeedItem[] = handovers.map((handover) => ({
    id: `handover-${handover.id}`,
    kind: 'handover',
    title: `${handover.team} Handover`,
    detail: `${handover.fromShift} to ${handover.toShift} · ${handover.status} · ${handover.notes}`,
    owner: clean(handover.outgoingLead || handover.createdBy, 'Team'),
    at: handover.updatedAt || handover.createdAt,
    tone: handover.status === 'Reviewed' ? 'green' : 'purple',
  }));

  return [...campaignItems, ...taskItems, ...blockerItems, ...handoverItems]
    .filter((item) => Number.isFinite(item.at))
    .sort((a, b) => b.at - a.at)
    .slice(0, 80);
}
