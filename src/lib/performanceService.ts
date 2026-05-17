import { Task, Handover, Member, Status, PerformanceMetrics } from '../types';
import { differenceInHours, parseISO } from 'date-fns';

/**
 * Calculate performance metrics for a team member
 */
export function calculateMemberMetrics(
  memberId: string,
  member: Member,
  tasks: Task[],
  handovers: Handover[]
): PerformanceMetrics {
  const memberTasks = tasks.filter(t => t.owner === member.name);
  const memberHandovers = handovers.filter(h => h.outgoing === member.name || h.incoming === member.name);

  // Calculate task metrics
  const completedTasks = memberTasks.filter(t => t.status === Status.DONE);
  const inProgressTasks = memberTasks.filter(t => t.status === Status.IN_PROGRESS);
  const blockedTasks = memberTasks.filter(t => t.status === Status.BLOCKED);

  // Calculate on-time rate
  const tasksWithDue = completedTasks.filter(t => t.due && t.completedAt);
  const onTimeTasks = tasksWithDue.filter(t => {
    try {
      const dueDate = parseISO(t.due);
      const completedDate = parseISO(t.completedAt || t.updatedAt);
      return completedDate <= dueDate;
    } catch {
      return false;
    }
  });
  const onTimeRate = tasksWithDue.length > 0
    ? Math.round((onTimeTasks.length / tasksWithDue.length) * 100)
    : 0;

  // Calculate average completion time
  const completionTimes = completedTasks
    .filter(t => t.createdAt && t.completedAt)
    .map(t => {
      try {
        return differenceInHours(parseISO(t.completedAt!), parseISO(t.createdAt));
      } catch {
        return 0;
      }
    });
  const avgCompletionTime = completionTimes.length > 0
    ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
    : 0;

  // Calculate quality score (based on on-time rate and blocked rate)
  const blockedRate = memberTasks.length > 0 ? (blockedTasks.length / memberTasks.length) * 100 : 0;
  const qualityScore = Math.max(0, Math.round(onTimeRate * 0.7 + (100 - blockedRate) * 0.3));

  // Get last activity
  const allMemberTasks = [...memberTasks];
  const lastTask = allMemberTasks.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];
  const lastActivityDate = lastTask?.updatedAt;

  // This month and last month metrics
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonthCompleted = completedTasks.filter(t => {
    try {
      return parseISO(t.completedAt || t.updatedAt) >= thisMonth;
    } catch {
      return false;
    }
  }).length;

  const lastMonthCompleted = completedTasks.filter(t => {
    try {
      const date = parseISO(t.completedAt || t.updatedAt);
      return date >= lastMonth && date < thisMonth;
    } catch {
      return false;
    }
  }).length;

  return {
    tasksCompleted: completedTasks.length,
    tasksInProgress: inProgressTasks.length,
    tasksBlocked: blockedTasks.length,
    handoversOut: memberHandovers.filter(h => h.outgoing === member.name).length,
    handoversAcknowledged: memberHandovers.filter(
      h => h.outgoing === member.name && h.status === 'Acknowledged'
    ).length,
    onTimeRate,
    qualityScore,
    avgCompletionTime,
    lastActivityDate,
    thisMonthCompleted,
    lastMonthCompleted,
  };
}

/**
 * Calculate team-wide performance metrics
 */
export function calculateTeamMetrics(
  members: Member[],
  tasks: Task[],
  handovers: Handover[]
): PerformanceMetrics {
  if (members.length === 0) {
    return {
      tasksCompleted: 0,
      tasksInProgress: 0,
      tasksBlocked: 0,
      handoversOut: 0,
      handoversAcknowledged: 0,
      onTimeRate: 0,
      qualityScore: 0,
      avgCompletionTime: 0,
    };
  }

  const memberMetrics = members.map(m => calculateMemberMetrics(m.id, m, tasks, handovers));

  return {
    tasksCompleted: memberMetrics.reduce((sum, m) => sum + m.tasksCompleted, 0),
    tasksInProgress: memberMetrics.reduce((sum, m) => sum + m.tasksInProgress, 0),
    tasksBlocked: memberMetrics.reduce((sum, m) => sum + m.tasksBlocked, 0),
    handoversOut: memberMetrics.reduce((sum, m) => sum + m.handoversOut, 0),
    handoversAcknowledged: memberMetrics.reduce((sum, m) => sum + m.handoversAcknowledged, 0),
    onTimeRate: Math.round(
      memberMetrics.reduce((sum, m) => sum + m.onTimeRate, 0) / memberMetrics.length
    ),
    qualityScore: Math.round(
      memberMetrics.reduce((sum, m) => sum + m.qualityScore, 0) / memberMetrics.length
    ),
    avgCompletionTime: Math.round(
      memberMetrics.reduce((sum, m) => sum + m.avgCompletionTime, 0) / memberMetrics.length
    ),
    thisMonthCompleted: memberMetrics.reduce((sum, m) => sum + (m.thisMonthCompleted || 0), 0),
    lastMonthCompleted: memberMetrics.reduce((sum, m) => sum + (m.lastMonthCompleted || 0), 0),
  };
}

/**
 * Get performance trend (compare two periods)
 */
export function getPerformanceTrend(current: PerformanceMetrics, previous: PerformanceMetrics): {
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
} {
  if (previous.qualityScore === 0) return { trend: 'up', percentChange: 0 };

  const change = current.qualityScore - previous.qualityScore;
  const percentChange = Math.round((change / previous.qualityScore) * 100);

  if (percentChange > 5) return { trend: 'up', percentChange };
  if (percentChange < -5) return { trend: 'down', percentChange };
  return { trend: 'stable', percentChange };
}

/**
 * Generate performance summary
 */
export function getPerformanceSummary(metrics: PerformanceMetrics): string {
  if (metrics.tasksCompleted === 0) {
    return 'No tasks completed yet';
  }

  const insights: string[] = [];

  if (metrics.qualityScore >= 90) {
    insights.push('Excellent performance');
  } else if (metrics.qualityScore >= 75) {
    insights.push('Good performance');
  } else if (metrics.qualityScore >= 60) {
    insights.push('Average performance');
  } else {
    insights.push('Performance needs improvement');
  }

  if (metrics.onTimeRate >= 90) {
    insights.push('Strong on-time delivery');
  } else if (metrics.onTimeRate < 60) {
    insights.push('Improve deadline management');
  }

  if (metrics.tasksBlocked > 0) {
    insights.push(`${metrics.tasksBlocked} tasks are blocked`);
  }

  return insights.join(' • ');
}

/**
 * Generate alert if metrics fall below threshold
 */
export function generatePerformanceAlerts(metrics: PerformanceMetrics): string[] {
  const alerts: string[] = [];

  if (metrics.qualityScore < 60) {
    alerts.push('⚠️ Performance below acceptable threshold');
  }

  if (metrics.onTimeRate < 50) {
    alerts.push('⚠️ On-time delivery rate critically low');
  }

  if (metrics.tasksBlocked > 3) {
    alerts.push(`⚠️ ${metrics.tasksBlocked} tasks blocked - immediate attention needed`);
  }

  if (metrics.handoversOut > 0 && metrics.handoversAcknowledged === 0) {
    alerts.push('⚠️ Handover acknowledgment pending');
  }

  return alerts;
}
